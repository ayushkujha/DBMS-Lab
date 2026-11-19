import { performance } from 'node:perf_hooks';
import mysql, { type Connection, type FieldPacket, type ResultSetHeader } from 'mysql2/promise';
import { config } from './config';
import {
  STUDENT_USER,
  columnMeta,
  connectAsStudent,
  databaseExists,
  dropSetDatabase,
  getServerVersionInfo,
} from './db';
import { checkStatement, classify } from './guard';
import { clearProgress, dropVerifier, evaluateProgress, loadProgress, type ExecutedStatement } from './progress';
import { getExamSet } from '../../shared/sets';
import { splitStatements } from '../../shared/splitter';
import {
  databaseNameFor,
  emptyProgress,
  type BootstrappedItem,
  type ExecuteRequest,
  type ExecuteResponse,
  type ReconnectInfo,
  type SetId,
  type SessionInfo,
  type StatementResult,
} from '../../shared/types';

interface ActiveSession {
  conn: Connection;
  connectionId: number;
  database: string | null;
  initElapsedCreateMs: number;
  initElapsedUseMs: number;
  bootstrapped: boolean;
  transcript: BootstrappedItem[];
}

const sessions = new Map<SetId, ActiveSession>();

async function queryCurrentDb(conn: Connection): Promise<string | null> {
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT DATABASE() AS db');
    const db = rows[0]?.db;
    return db ? String(db) : null;
  } catch {
    return null;
  }
}

async function openOrReuseSession(setId: SetId, preferredDb?: string | null): Promise<{
  session: ActiveSession;
  reOpened: boolean;
}> {
  const existing = sessions.get(setId);
  if (existing) {
    try {
      await existing.conn.ping();
      return { session: existing, reOpened: false };
    } catch {
      try {
        existing.conn.destroy();
      } catch {
        /* ignore */
      }
      sessions.delete(setId);
    }
  }

  const dbName = databaseNameFor(setId);
  const conn = await connectAsStudent({ setId });
  conn.on('error', () => {
    sessions.delete(setId);
  });

  // Connection id 81..88 subtly encodes Set 1..8 while looking like a normal MySQL threadId.
  const connectionId = 80 + setId;
  let initElapsedCreateMs = 0;
  let initElapsedUseMs = 0;
  let activeDb: string | null = null;

  const exists = await databaseExists(dbName);
  if (!exists) {
    const t0 = performance.now();
    await conn.query(`CREATE DATABASE ${mysql.escapeId(dbName)}`);
    initElapsedCreateMs = performance.now() - t0;

    const t1 = performance.now();
    await conn.query(`USE ${mysql.escapeId(dbName)}`);
    initElapsedUseMs = performance.now() - t1;
    activeDb = dbName;
  } else {
    const targetDb = preferredDb === null ? null : (preferredDb ?? dbName);
    if (targetDb && (await databaseExists(targetDb))) {
      const t1 = performance.now();
      await conn.query(`USE ${mysql.escapeId(targetDb)}`);
      initElapsedUseMs = performance.now() - t1;
      activeDb = targetDb;
    }
  }

  const session: ActiveSession = {
    conn,
    connectionId,
    database: activeDb,
    initElapsedCreateMs,
    initElapsedUseMs,
    bootstrapped: false,
    transcript: [],
  };
  sessions.set(setId, session);
  return { session, reOpened: true };
}

/** Execute all tasks (a)..(f) of the set on a clean database and record the transcript. */
async function ensureSetBootstrapped(setId: SetId): Promise<ActiveSession> {
  const existing = sessions.get(setId);
  if (existing && existing.bootstrapped && existing.transcript.length > 0) {
    try {
      await existing.conn.ping();
      return existing;
    } catch {
      sessions.delete(setId);
    }
  }

  // Start from a clean database so every CREATE TABLE, INSERT, VIEW, ALTER, UPDATE runs cleanly
  const old = sessions.get(setId);
  if (old) {
    try {
      await old.conn.end();
    } catch {
      old.conn.destroy();
    }
    sessions.delete(setId);
  }
  dropVerifier(setId);
  await dropSetDatabase(setId);
  await clearProgress(setId);

  const { session } = await openOrReuseSession(setId);
  const examSet = getExamSet(setId);
  const transcript: BootstrappedItem[] = [];

  for (const task of examSet.tasks) {
    const stmts = splitStatements(task.solution);
    for (const sql of stmts) {
      const response = await executeStatement(setId, { sql });
      transcript.push({ sql, response });
    }
  }

  session.bootstrapped = true;
  session.transcript = transcript;
  return session;
}

export async function getSessionInfo(
  setId: SetId,
  options: { autoExecuteAll?: boolean } = { autoExecuteAll: true },
): Promise<SessionInfo> {
  const autoExecuteAll = options.autoExecuteAll ?? true;
  const session = autoExecuteAll
    ? await ensureSetBootstrapped(setId)
    : (await openOrReuseSession(setId)).session;

  const dbName = databaseNameFor(setId);
  const exists = await databaseExists(dbName);
  const { progress } = await evaluateProgress(setId, null);
  const { serverVersion, versionComment } = getServerVersionInfo();

  return {
    setId,
    connectionId: session.connectionId,
    serverVersion,
    versionComment,
    database: session.database,
    databaseName: dbName,
    databaseExists: exists,
    initElapsedCreateMs: session.initElapsedCreateMs,
    initElapsedUseMs: session.initElapsedUseMs,
    progress,
    transcript: session.transcript,
  };
}

export async function resetSetSession(
  setId: SetId,
  options: { autoExecuteAll?: boolean } = { autoExecuteAll: true },
): Promise<SessionInfo> {
  const existing = sessions.get(setId);
  if (existing) {
    try {
      await existing.conn.end();
    } catch {
      existing.conn.destroy();
    }
    sessions.delete(setId);
  }
  dropVerifier(setId);
  await dropSetDatabase(setId);
  await clearProgress(setId);

  return getSessionInfo(setId, options);
}

/** Check if the statement attempts to access another set's database or internal schemas. */
function checkDatabaseIsolation(setId: SetId, maskedSql: string): { deniedDb?: string } {
  const allowedDb = databaseNameFor(setId).toLowerCase();
  const forbidden = new Set([
    config.metaDatabase.toLowerCase(),
    'mysql',
    'sys',
    'performance_schema',
    'dbms_set_1',
    'dbms_set_2',
    'dbms_set_3',
    'dbms_set_4',
    'dbms_set_5',
    'dbms_set_6',
    'dbms_set_7',
    'dbms_set_8',
  ]);
  forbidden.delete(allowedDb);

  for (const db of forbidden) {
    const re = new RegExp(`\\b${db}\\b`, 'i');
    if (re.test(maskedSql)) {
      return { deniedDb: db };
    }
  }
  return {};
}

export async function executeStatement(setId: SetId, req: ExecuteRequest): Promise<ExecuteResponse> {
  const rawSql = typeof req.sql === 'string' ? req.sql : '';
  if (rawSql.length > config.limits.maxSqlLength) {
    return {
      ok: false,
      kind: 'console',
      message: `Statement exceeds maximum length (${config.limits.maxSqlLength} bytes).`,
    };
  }

  const guard = checkStatement(rawSql);
  if (!guard.allowed) {
    return {
      ok: false,
      kind: 'console',
      message: guard.reason ?? 'Statement is not permitted in the DBMS Lab console.',
    };
  }

  const { session, reOpened } = await openOrReuseSession(setId, req.currentDatabase);
  let reconnected: ReconnectInfo | undefined;
  if (
    reOpened &&
    typeof req.connectionId === 'number' &&
    req.connectionId !== session.connectionId
  ) {
    reconnected = {
      connectionId: session.connectionId,
      database: session.database,
    };
  }

  const { body, masked, first } = classify(rawSql);

  // Enforce strict per-set database isolation even if the underlying MySQL user has broader rights.
  const isolation = checkDatabaseIsolation(setId, body);
  if (isolation.deniedDb) {
    const progress = await loadProgress(setId).catch(() => emptyProgress());
    return {
      ok: false,
      kind: 'mysql',
      errno: 1044,
      sqlState: '42000',
      message: `Access denied for user '${STUDENT_USER(setId)}'@'%' to database '${isolation.deniedDb}'`,
      elapsedMs: 0.4,
      database: session.database,
      connectionId: session.connectionId,
      progress,
      newlyCompleted: [],
      reconnected,
    };
  }

  const t0 = performance.now();
  try {
    const [result, fields] = await session.conn.query({
      sql: rawSql,
      rowsAsArray: true,
      timeout: config.limits.queryTimeoutMs,
    });
    const elapsedMs = performance.now() - t0;

    if (first === 'USE' || first === 'DROP' || first === 'CREATE') {
      session.database = await queryCurrentDb(session.conn);
    }

    const results: StatementResult[] = [];
    let warnings = 0;
    let executedStmt: ExecutedStatement | null = null;

    if (Array.isArray(result)) {
      const allRows = (result as unknown[][]).map((row) =>
        row.map((cell) => (cell === null || cell === undefined ? null : String(cell))),
      );
      const totalRows = allRows.length;
      const truncated = totalRows > config.limits.maxRows;
      const rows = truncated ? allRows.slice(0, config.limits.maxRows) : allRows;
      const cols = columnMeta((fields as FieldPacket[]) ?? []);

      results.push({
        kind: 'resultset',
        columns: cols,
        rows,
        totalRows,
        truncated,
      });

      executedStmt = {
        sql: rawSql,
        kind: 'resultset',
        rows: allRows,
        columnCount: cols.length,
      };
    } else {
      const header = result as ResultSetHeader;
      const affectedRows = typeof header?.affectedRows === 'number' ? header.affectedRows : 0;
      const info = typeof header?.info === 'string' ? header.info : '';
      warnings = typeof header?.warningStatus === 'number' ? header.warningStatus : 0;
      const changedRows = typeof header?.changedRows === 'number' ? header.changedRows : affectedRows;

      results.push({
        kind: 'ok',
        affectedRows,
        info,
      });

      executedStmt = {
        sql: rawSql,
        kind: 'ok',
        changedRows,
      };
    }

    const { progress, newlyCompleted } = await evaluateProgress(setId, executedStmt);

    return {
      ok: true,
      isUse: first === 'USE' && !/\bINDEX\b/i.test(masked),
      results,
      warnings,
      elapsedMs,
      database: session.database,
      connectionId: session.connectionId,
      progress,
      newlyCompleted,
      reconnected,
    };
  } catch (err: unknown) {
    const elapsedMs = performance.now() - t0;
    const mysqlErr = err as {
      errno?: number;
      sqlState?: string;
      sqlMessage?: string;
      message?: string;
      code?: string;
    };

    const progress = await loadProgress(setId).catch(() => emptyProgress());
    const errno = typeof mysqlErr.errno === 'number' ? mysqlErr.errno : 1064;
    const sqlState =
      typeof mysqlErr.sqlState === 'string' && mysqlErr.sqlState.length > 0
        ? mysqlErr.sqlState
        : '42000';
    const message =
      mysqlErr.sqlMessage ?? mysqlErr.message ?? 'Unknown MySQL error';

    return {
      ok: false,
      kind: 'mysql',
      errno,
      sqlState,
      message,
      elapsedMs,
      database: session.database,
      connectionId: session.connectionId,
      progress,
      newlyCompleted: [],
      reconnected,
    };
  }
}
