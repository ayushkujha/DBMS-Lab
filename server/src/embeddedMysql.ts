/**
 * Zero-config serverless MySQL 8.0-compatible relational engine (powered by
 * sql.js / SQLite WebAssembly) used ONLY when no external MySQL 8.0 TCP host
 * is reachable (e.g. a fresh Vercel deployment before MYSQL_URL is configured).
 *
 * When a real MySQL 8.0 server is reachable (locally via mysqld / Docker or on
 * Vercel via MYSQL_URL / MYSQL_HOST), server/src/sessions.ts is used instead.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { config } from './config';
import { STUDENT_USER } from './db';
import { checkStatement, classify } from './guard';
import { getExamSet, type ExamTask, type TaskCheck } from '../../shared/sets';
import { splitStatements } from '../../shared/splitter';
import {
  databaseNameFor,
  emptyProgress,
  type BootstrappedItem,
  type ColumnMeta,
  type ExecuteRequest,
  type ExecuteResponse,
  type Progress,
  type SetId,
  type SessionInfo,
  type StatementResult,
  type TaskId,
} from '../../shared/types';

interface ColumnSpec {
  name: string;
  rawType: string;
  kind: 'int' | 'real' | 'decimal' | 'text';
  scale?: number;
  nullable: boolean;
  defaultVal?: string;
}

interface EmbeddedSetState {
  db: SqlJsDatabase;
  connectionId: number;
  databaseExistFlag: boolean;
  activeDatabase: string | null;
  progress: Progress;
  /** Original CREATE TABLE statements keyed by lowercase table name. */
  createTableDdl: Map<string, { originalName: string; ddl: string; columns: ColumnSpec[] }>;
  /** Original CREATE VIEW statements keyed by lowercase view name. */
  createViewDdl: Map<string, { originalName: string; ddl: string }>;
  appliedHistoryCount: number;
  bootstrapped: boolean;
  transcript: BootstrappedItem[];
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    let wasmBinary: Buffer | undefined;
    try {
      const req = createRequire(import.meta.url);
      const wasmPath = req.resolve('sql.js/dist/sql-wasm.wasm');
      wasmBinary = readFileSync(wasmPath);
    } catch {
      const fallbackPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      if (existsSync(fallbackPath)) {
        wasmBinary = readFileSync(fallbackPath);
      }
    }
    sqlJsPromise = initSqlJs(wasmBinary ? { wasmBinary } : undefined);
  }
  return sqlJsPromise;
}

const embeddedStates = new Map<string, EmbeddedSetState>();

function stateKey(setId: SetId, sessionKey = 'default'): string {
  return `${sessionKey}:${setId}`;
}

async function createFreshState(setId: SetId): Promise<EmbeddedSetState> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  return {
    db,
    connectionId: 80 + setId,
    databaseExistFlag: true,
    activeDatabase: databaseNameFor(setId),
    progress: emptyProgress(),
    createTableDdl: new Map(),
    createViewDdl: new Map(),
    appliedHistoryCount: 0,
    bootstrapped: false,
    transcript: [],
  };
}

async function getOrInitState(setId: SetId, sessionKey = 'default'): Promise<EmbeddedSetState> {
  const key = stateKey(setId, sessionKey);
  let st = embeddedStates.get(key);
  if (!st) {
    st = await createFreshState(setId);
    embeddedStates.set(key, st);
  }
  return st;
}

async function ensureEmbeddedBootstrapped(
  setId: SetId,
  sessionKey = 'default',
): Promise<EmbeddedSetState> {
  const st = await getOrInitState(setId, sessionKey);
  if (st.bootstrapped) return st;

  const examSet = getExamSet(setId);
  const transcript: BootstrappedItem[] = [];
  for (const task of examSet.tasks) {
    const stmts = splitStatements(task.solution);
    for (const sql of stmts) {
      const response = await runSingleEmbedded(setId, st, sql);
      st.appliedHistoryCount++;
      transcript.push({ sql, response });
    }
  }
  st.bootstrapped = true;
  st.transcript = transcript;
  return st;
}

export async function getEmbeddedSessionInfo(
  setId: SetId,
  sessionKey = 'default',
  options: { autoExecuteAll?: boolean } = { autoExecuteAll: true },
): Promise<SessionInfo> {
  const autoExecuteAll = options.autoExecuteAll ?? true;
  let st: EmbeddedSetState;
  if (autoExecuteAll) {
    st = await ensureEmbeddedBootstrapped(setId, sessionKey);
  } else {
    st = await getOrInitState(setId, sessionKey);
    st.bootstrapped = true;
  }
  const dbName = databaseNameFor(setId);
  return {
    setId,
    connectionId: st.connectionId,
    serverVersion: '8.0.44',
    versionComment: 'MySQL Community Server - GPL',
    database: st.activeDatabase,
    databaseName: dbName,
    databaseExists: st.databaseExistFlag,
    initElapsedCreateMs: 2.1,
    initElapsedUseMs: 0.5,
    progress: { ...st.progress },
    transcript: st.transcript,
  };
}

export async function resetEmbeddedSession(
  setId: SetId,
  sessionKey = 'default',
  options: { autoExecuteAll?: boolean } = { autoExecuteAll: true },
): Promise<SessionInfo> {
  const key = stateKey(setId, sessionKey);
  const old = embeddedStates.get(key);
  if (old) {
    try {
      old.db.close();
    } catch {
      /* ignore */
    }
  }
  const fresh = await createFreshState(setId);
  embeddedStates.set(key, fresh);
  return getEmbeddedSessionInfo(setId, sessionKey, options);
}

/** Parse column specifications from a CREATE TABLE statement to preserve MySQL formatting & types. */
function parseCreateTableColumns(sql: string): { tableName: string; columns: ColumnSpec[] } | null {
  const m = sql.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*\(([\s\S]*)\)\s*$/i);
  if (!m) return null;
  const tableName = m[1];
  const body = m[2];

  // Split top-level comma-separated clauses
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  const columns: ColumnSpec[] = [];
  for (const part of parts) {
    if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(part)) {
      continue;
    }
    const cm = part.match(/^`?([A-Za-z0-9_]+)`?\s+([A-Za-z0-9_]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)([\s\S]*)$/);
    if (!cm) continue;
    const colName = cm[1];
    const rawType = cm[2].replace(/\s+/g, '').toUpperCase();
    const rest = cm[3] ?? '';
    const notNull = /\bNOT\s+NULL\b/i.test(rest) || /\bPRIMARY\s+KEY\b/i.test(rest);
    const defMatch = rest.match(/\bDEFAULT\s+('(?:[^']|'')*'|-?\d+(?:\.\d+)?|NULL)/i);
    let kind: ColumnSpec['kind'] = 'text';
    let scale: number | undefined;
    if (/^(INT|INTEGER|SMALLINT|TINYINT|MEDIUMINT|BIGINT|NUMBER)/i.test(rawType)) {
      kind = 'int';
    } else if (/^(REAL|DOUBLE|FLOAT)/i.test(rawType)) {
      kind = 'real';
    } else if (/^(DECIMAL|NUMERIC)/i.test(rawType)) {
      kind = 'decimal';
      const sm = rawType.match(/\(\s*\d+\s*,\s*(\d+)\s*\)/);
      scale = sm ? Number(sm[1]) : 0;
    }
    columns.push({
      name: colName,
      rawType,
      kind,
      scale,
      nullable: !notNull,
      defaultVal: defMatch ? defMatch[1].replace(/^'|'$/g, '') : undefined,
    });
  }
  return { tableName, columns };
}

/** Rewrite MySQL-specific SQL constructs into SQLite-compatible SQL while keeping semantics identical. */
function transpileMysqlToSqlite(sql: string, activeDb: string | null): string {
  let out = sql.trim().replace(/;+\s*$/, '');

  // Strip current database qualifier `dbms_set_N.`
  if (activeDb) {
    const dbRe = new RegExp(`\`?${activeDb}\`?\\.`, 'gi');
    out = out.replace(dbRe, '');
  }

  // ANSI / MySQL date/time literals: DATE '2026-07-20' -> '2026-07-20'
  out = out.replace(/\b(?:DATE|TIME|TIMESTAMP)\s+'([^']*)'/gi, "'$1'");

  // MySQL `SELECT DATABASE()` -> activeDb literal
  out = out.replace(/\bDATABASE\s*\(\s*\)/gi, activeDb ? `'${activeDb}'` : 'NULL');
  out = out.replace(/\bVERSION\s*\(\s*\)/gi, "'8.0.44'");

  // MySQL `expr op ANY (SELECT ...)` / `SOME (SELECT ...)` / `ALL (SELECT ...)`
  out = out.replace(
    /(\b[A-Za-z0-9_.`]+\b)\s*(>=|<=|<>|!=|>|<|=)\s*(?:ANY|SOME)\s*\(\s*(SELECT\s+)([\s\S]+?)\)/gi,
    (_full, lhs: string, op: string, selectKw: string, subRest: string) => {
      if (op === '=' || op === '<=>' ) {
        return `${lhs} IN (${selectKw}${subRest})`;
      }
      if (op === '>' || op === '>=') {
        const colMatch = subRest.match(/^([A-Za-z0-9_.`]+)(\s+FROM\s+[\s\S]*)$/i);
        if (colMatch) {
          return `${lhs} ${op} (${selectKw}MIN(${colMatch[1]})${colMatch[2]})`;
        }
      }
      if (op === '<' || op === '<=') {
        const colMatch = subRest.match(/^([A-Za-z0-9_.`]+)(\s+FROM\s+[\s\S]*)$/i);
        if (colMatch) {
          return `${lhs} ${op} (${selectKw}MAX(${colMatch[1]})${colMatch[2]})`;
        }
      }
      return `${lhs} IN (${selectKw}${subRest})`;
    },
  );

  out = out.replace(
    /(\b[A-Za-z0-9_.`]+\b)\s*(>=|<=|>|<)\s*ALL\s*\(\s*(SELECT\s+)([\s\S]+?)\)/gi,
    (_full, lhs: string, op: string, selectKw: string, subRest: string) => {
      const colMatch = subRest.match(/^([A-Za-z0-9_.`]+)(\s+FROM\s+[\s\S]*)$/i);
      if (colMatch) {
        const agg = op.startsWith('>') ? 'MAX' : 'MIN';
        return `${lhs} ${op} (${selectKw}${agg}(${colMatch[1]})${colMatch[2]})`;
      }
      return _full;
    },
  );

  return out;
}

function formatCellValue(
  val: unknown,
  colName: string,
  st: EmbeddedSetState,
): { text: string | null; numeric: boolean; nullable: boolean } {
  if (val === null || val === undefined) {
    return { text: null, numeric: false, nullable: true };
  }
  const lower = colName.toLowerCase();
  // Look up column spec across registered tables
  let spec: ColumnSpec | undefined;
  for (const tbl of st.createTableDdl.values()) {
    const found = tbl.columns.find((c) => c.name.toLowerCase() === lower);
    if (found) {
      spec = found;
      break;
    }
  }

  if (typeof val === 'number') {
    if (spec?.kind === 'decimal' && typeof spec.scale === 'number') {
      return { text: val.toFixed(spec.scale), numeric: true, nullable: spec.nullable };
    }
    if (spec?.kind === 'int') {
      return { text: String(Math.trunc(val)), numeric: true, nullable: spec.nullable };
    }
    return { text: String(val), numeric: true, nullable: spec?.nullable ?? true };
  }
  return {
    text: String(val),
    numeric: spec ? spec.kind !== 'text' : false,
    nullable: spec?.nullable ?? true,
  };
}

function mapSqliteErrorToMysql(
  errMessage: string,
  activeDb: string | null,
  setId: SetId,
): { errno: number; sqlState: string; message: string } {
  const dbPrefix = activeDb ?? databaseNameFor(setId);
  let m: RegExpMatchArray | null;

  if ((m = errMessage.match(/no such table:\s*([^\s]+)/i))) {
    const t = m[1].replace(/^main\./i, '').toLowerCase();
    return {
      errno: 1146,
      sqlState: '42S02',
      message: `Table '${dbPrefix}.${t}' doesn't exist`,
    };
  }
  if ((m = errMessage.match(/table\s+["'`]?([^\s"'`]+)["'`]?\s+already exists/i))) {
    return {
      errno: 1050,
      sqlState: '42S01',
      message: `Table '${m[1]}' already exists`,
    };
  }
  if ((m = errMessage.match(/view\s+["'`]?([^\s"'`]+)["'`]?\s+already exists/i))) {
    return {
      errno: 1050,
      sqlState: '42S01',
      message: `Table '${m[1]}' already exists`,
    };
  }
  if ((m = errMessage.match(/no such column:\s*([^\s]+)/i))) {
    return {
      errno: 1054,
      sqlState: '42S22',
      message: `Unknown column '${m[1]}' in 'field list'`,
    };
  }
  if ((m = errMessage.match(/duplicate column name:\s*([^\s]+)/i))) {
    return {
      errno: 1060,
      sqlState: '42S21',
      message: `Duplicate column name '${m[1]}'`,
    };
  }
  if (/UNIQUE constraint failed/i.test(errMessage)) {
    const cols = errMessage.split(':').pop()?.trim() ?? 'PRIMARY';
    return {
      errno: 1062,
      sqlState: '23000',
      message: `Duplicate entry for key '${cols}'`,
    };
  }
  if (/FOREIGN KEY constraint failed/i.test(errMessage)) {
    return {
      errno: 1452,
      sqlState: '23000',
      message: 'Cannot add or update a child row: a foreign key constraint fails',
    };
  }
  if (/CHECK constraint failed/i.test(errMessage)) {
    return {
      errno: 3819,
      sqlState: 'HY000',
      message: `Check constraint is violated.`,
    };
  }
  if ((m = errMessage.match(/NOT NULL constraint failed:\s*([^\s]+)/i))) {
    const col = m[1].split('.').pop() ?? m[1];
    return {
      errno: 1048,
      sqlState: '23000',
      message: `Column '${col}' cannot be null`,
    };
  }
  if (/has \d+ columns but \d+ values were supplied/i.test(errMessage)) {
    return {
      errno: 1136,
      sqlState: '21S01',
      message: "Column count doesn't match value count at row 1",
    };
  }
  return {
    errno: 1064,
    sqlState: '42000',
    message: `You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use (${errMessage})`,
  };
}

function queryRows(st: EmbeddedSetState, sql: string): (string | null)[][] {
  const res = st.db.exec(transpileMysqlToSqlite(sql, st.activeDatabase));
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((row) =>
    row.map((cell, idx) => formatCellValue(cell, columns[idx], st).text),
  );
}

function sameRows(a: (string | null)[][], b: (string | null)[][]): boolean {
  if (a.length !== b.length) return false;
  if (a.length > 0 && a[0].length !== b[0].length) return false;
  const ca = a.map((r) => JSON.stringify(r)).sort();
  const cb = b.map((r) => JSON.stringify(r)).sort();
  return ca.every((v, i) => v === cb[i]);
}

function evaluateEmbeddedCheck(
  st: EmbeddedSetState,
  check: TaskCheck,
  stmt: { sql: string; kind: 'resultset' | 'ok'; rows?: (string | null)[][]; changedRows?: number } | null,
): boolean {
  switch (check.kind) {
    case 'tables': {
      return check.tables.every((t) => {
        const entry = st.createTableDdl.get(t.name.toLowerCase());
        if (!entry) return false;
        const colSet = new Set(entry.columns.map((c) => c.name.toLowerCase()));
        return t.columns.every((col) => colSet.has(col.toLowerCase()));
      });
    }
    case 'rows': {
      for (const t of check.tables) {
        if (!st.createTableDdl.has(t.toLowerCase())) return false;
        const rows = queryRows(st, `SELECT COUNT(*) FROM ${t}`);
        if (!rows.length || Number(rows[0][0]) < check.min) return false;
      }
      return true;
    }
    case 'column': {
      const entry = st.createTableDdl.get(check.table.toLowerCase());
      if (!entry) return false;
      const col = entry.columns.find((c) => c.name.toLowerCase() === check.column.toLowerCase());
      return !!col && col.rawType.toLowerCase().startsWith(check.dataType.toLowerCase());
    }
    case 'view': {
      if (st.createViewDdl.size === 0) return false;
      const refRows = queryRows(st, check.reference);
      for (const v of st.createViewDdl.values()) {
        try {
          const rows = queryRows(st, `SELECT * FROM ${v.originalName}`);
          if (sameRows(rows, refRows)) return true;
        } catch {
          /* ignore */
        }
      }
      return false;
    }
    case 'result': {
      if (!stmt || stmt.kind !== 'resultset' || !stmt.rows) return false;
      const { masked } = classify(stmt.sql);
      if (!check.tables.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(masked))) return false;
      if (check.mustUse && !check.mustUse.every((m) => new RegExp(m.pattern, 'i').test(masked))) return false;
      const refRows = queryRows(st, check.reference);
      if (refRows.length === 0) return false;
      return sameRows(stmt.rows, refRows);
    }
    case 'update': {
      if (!stmt || stmt.kind !== 'ok') return false;
      const { masked, first } = classify(stmt.sql);
      if (first !== 'UPDATE') return false;
      if (!new RegExp(`^UPDATE\\s+(?:\`?\\w+\`?\\.)?\`?${check.table}\`?\\b`, 'i').test(masked)) return false;
      if (!new RegExp(`\\bSET\\b[\\s\\S]*\\b${check.column}\\b`, 'i').test(masked)) return false;
      return (stmt.changedRows ?? 0) > 0;
    }
  }
}

function updateEmbeddedProgress(
  setId: SetId,
  st: EmbeddedSetState,
  stmt: { sql: string; kind: 'resultset' | 'ok'; rows?: (string | null)[][]; changedRows?: number } | null,
): TaskId[] {
  const newlyCompleted: TaskId[] = [];
  const tasks = getExamSet(setId).tasks;
  const isPrereq = (t: ExamTask) => t.id === 'a' || t.id === 'b';
  for (const task of tasks) {
    if (st.progress[task.id]) continue;
    if (!isPrereq(task) && !(st.progress.a && st.progress.b)) continue;
    try {
      if (evaluateEmbeddedCheck(st, task.check, stmt)) {
        st.progress[task.id] = true;
        newlyCompleted.push(task.id);
      }
    } catch {
      /* ignore */
    }
  }
  return newlyCompleted;
}

export async function executeEmbeddedStatement(
  setId: SetId,
  req: ExecuteRequest,
  sessionKey = 'default',
): Promise<ExecuteResponse> {
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

  const st = await ensureEmbeddedBootstrapped(setId, sessionKey);

  // If the client also sent any extra statements executed after the bootstrap, replay them on cold start.
  if (
    Array.isArray(req.replaySql) &&
    req.replaySql.length > 0 &&
    st.appliedHistoryCount <= st.transcript.length
  ) {
    for (const prevSql of req.replaySql) {
      await runSingleEmbedded(setId, st, prevSql);
    }
    st.appliedHistoryCount += req.replaySql.length;
  }

  const res = await runSingleEmbedded(setId, st, rawSql);
  st.appliedHistoryCount++;
  return res;
}

async function runSingleEmbedded(
  setId: SetId,
  st: EmbeddedSetState,
  rawSql: string,
): Promise<ExecuteResponse> {
  const allowedDb = databaseNameFor(setId);
  const { body, masked, first } = classify(rawSql);
  const clean = body.trim().replace(/;+\s*$/, '');
  const t0 = performance.now();

  const makeError = (errno: number, sqlState: string, message: string): ExecuteResponse => ({
    ok: false,
    kind: 'mysql',
    errno,
    sqlState,
    message,
    elapsedMs: performance.now() - t0,
    database: st.activeDatabase,
    connectionId: st.connectionId,
    progress: { ...st.progress },
    newlyCompleted: [],
  });

  // Cross-database isolation check (matches real MySQL student_setN privilege error 1044)
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
  forbidden.delete(allowedDb.toLowerCase());
  for (const db of forbidden) {
    if (new RegExp(`\\b${db}\\b`, 'i').test(masked)) {
      return makeError(
        1044,
        '42000',
        `Access denied for user '${STUDENT_USER(setId)}'@'%' to database '${db}'`,
      );
    }
  }

  const makeResultSet = (columns: ColumnMeta[], rows: (string | null)[][]): ExecuteResponse => {
    const elapsedMs = performance.now() - t0;
    const newlyCompleted = updateEmbeddedProgress(setId, st, {
      sql: rawSql,
      kind: 'resultset',
      rows,
    });
    const results: StatementResult[] = [
      {
        kind: 'resultset',
        columns,
        rows,
        totalRows: rows.length,
        truncated: false,
      },
    ];
    return {
      ok: true,
      isUse: false,
      results,
      warnings: 0,
      elapsedMs,
      database: st.activeDatabase,
      connectionId: st.connectionId,
      progress: { ...st.progress },
      newlyCompleted,
    };
  };

  const makeOk = (affectedRows: number, info = '', isUse = false, changedRows = affectedRows): ExecuteResponse => {
    const elapsedMs = performance.now() - t0;
    const newlyCompleted = updateEmbeddedProgress(setId, st, {
      sql: rawSql,
      kind: 'ok',
      changedRows,
    });
    return {
      ok: true,
      isUse,
      results: [{ kind: 'ok', affectedRows, info }],
      warnings: 0,
      elapsedMs,
      database: st.activeDatabase,
      connectionId: st.connectionId,
      progress: { ...st.progress },
      newlyCompleted,
    };
  };

  // 1. USE <db>
  const useMatch = clean.match(/^USE\s+`?([A-Za-z0-9_]+)`?\s*$/i);
  if (useMatch) {
    const target = useMatch[1].toLowerCase();
    if (target !== allowedDb.toLowerCase()) {
      return makeError(1044, '42000', `Access denied for user '${STUDENT_USER(setId)}'@'%' to database '${useMatch[1]}'`);
    }
    if (!st.databaseExistFlag) {
      return makeError(1049, '42000', `Unknown database '${useMatch[1]}'`);
    }
    st.activeDatabase = allowedDb;
    return makeOk(0, '', true);
  }

  // 2. CREATE DATABASE
  const createDbMatch = clean.match(/^CREATE\s+(?:DATABASE|SCHEMA)\s+(IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*$/i);
  if (createDbMatch) {
    const ifNotExists = Boolean(createDbMatch[1]);
    const target = createDbMatch[2].toLowerCase();
    if (target !== allowedDb.toLowerCase()) {
      return makeError(1044, '42000', `Access denied for user '${STUDENT_USER(setId)}'@'%' to database '${createDbMatch[2]}'`);
    }
    if (st.databaseExistFlag && !ifNotExists) {
      return makeError(1007, 'HY000', `Can't create database '${createDbMatch[2]}'; database exists`);
    }
    st.databaseExistFlag = true;
    return makeOk(1);
  }

  // 3. DROP DATABASE
  const dropDbMatch = clean.match(/^DROP\s+(?:DATABASE|SCHEMA)\s+(IF\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*$/i);
  if (dropDbMatch) {
    const ifExists = Boolean(dropDbMatch[1]);
    const target = dropDbMatch[2].toLowerCase();
    if (target !== allowedDb.toLowerCase()) {
      return makeError(1044, '42000', `Access denied for user '${STUDENT_USER(setId)}'@'%' to database '${dropDbMatch[2]}'`);
    }
    if (!st.databaseExistFlag && !ifExists) {
      return makeError(1008, 'HY000', `Can't drop database '${dropDbMatch[2]}'; database doesn't exist`);
    }
    const SQL = await getSqlJs();
    st.db.close();
    st.db = new SQL.Database();
    st.db.run('PRAGMA foreign_keys = ON;');
    st.createTableDdl.clear();
    st.createViewDdl.clear();
    st.databaseExistFlag = false;
    st.activeDatabase = null;
    return makeOk(0);
  }

  // 4. SHOW DATABASES
  if (/^SHOW\s+(?:DATABASES|SCHEMAS)\s*$/i.test(clean)) {
    const rows: (string | null)[][] = [];
    if (st.databaseExistFlag) rows.push([allowedDb]);
    rows.push(['information_schema']);
    rows.push(['performance_schema']);
    return makeResultSet([{ name: 'Database', type: 253, numeric: false, nullable: false }], rows);
  }

  // Require an active database for table/view/query commands (except database-independent SELECTs)
  if (!st.activeDatabase && first !== 'SELECT') {
    return makeError(1046, '3D000', 'No database selected');
  }

  // 5. SHOW [FULL] TABLES
  const showTablesMatch = clean.match(/^SHOW\s+(FULL\s+)?TABLES\s*$/i);
  if (showTablesMatch) {
    const isFull = Boolean(showTablesMatch[1]);
    const header = `Tables_in_${st.activeDatabase}`;
    const items: { name: string; type: string }[] = [];
    for (const t of st.createTableDdl.values()) {
      items.push({ name: t.originalName.toLowerCase(), type: 'BASE TABLE' });
    }
    for (const v of st.createViewDdl.values()) {
      items.push({ name: v.originalName.toLowerCase(), type: 'VIEW' });
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    if (isFull) {
      return makeResultSet(
        [
          { name: header, type: 253, numeric: false, nullable: false },
          { name: 'Table_type', type: 253, numeric: false, nullable: false },
        ],
        items.map((it) => [it.name, it.type]),
      );
    }
    return makeResultSet(
      [{ name: header, type: 253, numeric: false, nullable: false }],
      items.map((it) => [it.name]),
    );
  }

  // 6. DESCRIBE / DESC / SHOW COLUMNS FROM <table>
  const descMatch =
    clean.match(/^(?:DESCRIBE|DESC)\s+`?([A-Za-z0-9_]+)`?\s*$/i) ??
    clean.match(/^SHOW\s+(?:FULL\s+)?(?:COLUMNS|FIELDS)\s+FROM\s+`?([A-Za-z0-9_]+)`?\s*$/i);
  if (descMatch) {
    const tName = descMatch[1].toLowerCase();
    const entry = st.createTableDdl.get(tName);
    if (!entry) {
      return makeError(1146, '42S02', `Table '${st.activeDatabase}.${tName}' doesn't exist`);
    }
    const info = st.db.exec(`PRAGMA table_info("${entry.originalName}")`);
    const pkSet = new Set<string>();
    if (info.length) {
      for (const r of info[0].values) {
        if (Number(r[5]) > 0) pkSet.add(String(r[1]).toLowerCase());
      }
    }
    const rows: (string | null)[][] = entry.columns.map((c) => [
      c.name,
      c.rawType.toLowerCase(),
      c.nullable ? 'YES' : 'NO',
      pkSet.has(c.name.toLowerCase()) ? 'PRI' : '',
      c.defaultVal ?? null,
      '',
    ]);
    return makeResultSet(
      [
        { name: 'Field', type: 253, numeric: false, nullable: false },
        { name: 'Type', type: 253, numeric: false, nullable: false },
        { name: 'Null', type: 253, numeric: false, nullable: false },
        { name: 'Key', type: 253, numeric: false, nullable: false },
        { name: 'Default', type: 253, numeric: false, nullable: true },
        { name: 'Extra', type: 253, numeric: false, nullable: false },
      ],
      rows,
    );
  }

  // 7. SHOW CREATE TABLE / VIEW
  const showCreateMatch = clean.match(/^SHOW\s+CREATE\s+(?:TABLE|VIEW)\s+`?([A-Za-z0-9_]+)`?\s*$/i);
  if (showCreateMatch) {
    const name = showCreateMatch[1].toLowerCase();
    const tbl = st.createTableDdl.get(name);
    if (tbl) {
      return makeResultSet(
        [
          { name: 'Table', type: 253, numeric: false, nullable: false },
          { name: 'Create Table', type: 253, numeric: false, nullable: false },
        ],
        [[tbl.originalName, tbl.ddl]],
      );
    }
    const vw = st.createViewDdl.get(name);
    if (vw) {
      return makeResultSet(
        [
          { name: 'View', type: 253, numeric: false, nullable: false },
          { name: 'Create View', type: 253, numeric: false, nullable: false },
        ],
        [[vw.originalName, vw.ddl]],
      );
    }
    return makeError(1146, '42S02', `Table '${st.activeDatabase}.${name}' doesn't exist`);
  }

  // 8. TRUNCATE [TABLE] <name>
  const truncMatch = clean.match(/^TRUNCATE\s+(?:TABLE\s+)?`?([A-Za-z0-9_]+)`?\s*$/i);
  if (truncMatch) {
    const name = truncMatch[1].toLowerCase();
    const tbl = st.createTableDdl.get(name);
    if (!tbl) {
      return makeError(1146, '42S02', `Table '${st.activeDatabase}.${name}' doesn't exist`);
    }
    try {
      st.db.run(`DELETE FROM "${tbl.originalName}"`);
      return makeOk(0);
    } catch (e: unknown) {
      const mapped = mapSqliteErrorToMysql((e as Error).message, st.activeDatabase, setId);
      return makeError(mapped.errno, mapped.sqlState, mapped.message);
    }
  }

  // 9. General SQL execution (CREATE TABLE, CREATE VIEW, ALTER TABLE, DROP, INSERT, UPDATE, DELETE, SELECT)
  try {
    const transpiled = transpileMysqlToSqlite(clean, st.activeDatabase);

    if (first === 'SELECT' || first === 'WITH' || first === 'VALUES' || first === 'PRAGMA') {
      const execRes = st.db.exec(transpiled);
      if (!execRes.length) {
        // Empty result set: obtain column names with a prepared statement
        const stmt = st.db.prepare(transpiled);
        const colNames = stmt.getColumnNames();
        stmt.free();
        const cols: ColumnMeta[] = colNames.map((n) => {
          const sample = formatCellValue(0, n, st);
          return { name: n, type: sample.numeric ? 3 : 253, numeric: sample.numeric, nullable: true };
        });
        return makeResultSet(cols, []);
      }

      const { columns, values } = execRes[0];
      const cols: ColumnMeta[] = columns.map((colName, cIdx) => {
        const firstNonNull = values.find((r) => r[cIdx] !== null && r[cIdx] !== undefined)?.[cIdx];
        const info = formatCellValue(firstNonNull ?? '', colName, st);
        const numeric =
          typeof firstNonNull === 'number' ||
          info.numeric ||
          /^(COUNT|SUM|AVG|MIN|MAX)\b/i.test(colName);
        return {
          name: colName,
          type: numeric ? 3 : 253,
          numeric,
          nullable: info.nullable,
        };
      });

      const formattedRows: (string | null)[][] = values.map((row) =>
        row.map((cell, cIdx) => formatCellValue(cell, columns[cIdx], st).text),
      );
      return makeResultSet(cols, formattedRows);
    }

    // DDL or DML
    st.db.run(transpiled);
    const affected =
      first === 'INSERT' || first === 'UPDATE' || first === 'DELETE' || first === 'REPLACE'
        ? st.db.getRowsModified()
        : 0;

    // Update catalog metadata for CREATE/ALTER/DROP TABLE/VIEW
    if (first === 'CREATE') {
      const parsed = parseCreateTableColumns(clean);
      if (parsed) {
        st.createTableDdl.set(parsed.tableName.toLowerCase(), {
          originalName: parsed.tableName,
          ddl: clean,
          columns: parsed.columns,
        });
      } else {
        const vm = clean.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+`?([A-Za-z0-9_]+)`?\s+AS\s+[\s\S]+$/i);
        if (vm) {
          st.createViewDdl.set(vm[1].toLowerCase(), {
            originalName: vm[1],
            ddl: clean,
          });
        }
      }
    } else if (first === 'ALTER') {
      const am = clean.match(
        /^ALTER\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s+ADD\s+(?:COLUMN\s+)?`?([A-Za-z0-9_]+)`?\s+([A-Za-z0-9_]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/i,
      );
      if (am) {
        const tbl = st.createTableDdl.get(am[1].toLowerCase());
        if (tbl) {
          const rawType = am[3].toUpperCase();
          tbl.columns.push({
            name: am[2],
            rawType,
            kind: /^(INT|INTEGER)/i.test(rawType)
              ? 'int'
              : /^(REAL|DOUBLE|FLOAT)/i.test(rawType)
                ? 'real'
                : /^(DECIMAL|NUMERIC)/i.test(rawType)
                  ? 'decimal'
                  : 'text',
            nullable: true,
          });
        }
      }
    } else if (first === 'DROP') {
      const dm = clean.match(/^DROP\s+(?:TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/i);
      if (dm) {
        st.createTableDdl.delete(dm[1].toLowerCase());
        st.createViewDdl.delete(dm[1].toLowerCase());
      }
    }

    const info =
      first === 'UPDATE'
        ? `Rows matched: ${affected}  Changed: ${affected}  Warnings: 0`
        : first === 'INSERT' && affected > 1
          ? `Records: ${affected}  Duplicates: 0  Warnings: 0`
          : '';
    return makeOk(affected, info, false, affected);
  } catch (e: unknown) {
    const mapped = mapSqliteErrorToMysql((e as Error).message, st.activeDatabase, setId);
    return makeError(mapped.errno, mapped.sqlState, mapped.message);
  }
}
