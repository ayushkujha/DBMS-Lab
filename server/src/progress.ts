/**
 * Task completion tracking.
 *
 * Completion is decided only from real execution against MySQL:
 *  - (a)/(b) and DDL tasks: the database state is inspected after each statement;
 *  - query tasks: the student's own result set is compared with the reference
 *    solution executed against the same, current database;
 *  - UPDATE tasks: the student's UPDATE must actually change a row.
 * Progress is stored in the bookkeeping database (parameterised statements only).
 */
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { config } from './config';
import { connectAsStudent, getAdminPool } from './db';
import { classify } from './guard';
import { getExamSet, type ExamTask, type TaskCheck } from '../../shared/sets';
import { TASK_IDS, databaseNameFor, emptyProgress, type Progress, type SetId, type TaskId } from '../../shared/types';

const meta = mysql.escapeId(config.metaDatabase);

export async function loadProgress(setId: SetId): Promise<Progress> {
  const [rows] = await getAdminPool().query<RowDataPacket[]>(`SELECT task FROM ${meta}.progress WHERE set_id = ?`, [setId]);
  const progress = emptyProgress();
  for (const r of rows) {
    const t = String(r.task) as TaskId;
    if (TASK_IDS.includes(t)) progress[t] = true;
  }
  return progress;
}

async function markComplete(setId: SetId, tasks: TaskId[]): Promise<void> {
  for (const t of tasks) {
    await getAdminPool().query(`INSERT IGNORE INTO ${meta}.progress (set_id, task) VALUES (?, ?)`, [setId, t]);
  }
}

export async function clearProgress(setId: SetId): Promise<void> {
  await getAdminPool().query(`DELETE FROM ${meta}.progress WHERE set_id = ?`, [setId]);
}

/* ----------------------------- verification ----------------------------- */

/** What the console just executed (successfully). */
export interface ExecutedStatement {
  sql: string;
  kind: 'resultset' | 'ok';
  rows?: (string | null)[][];
  columnCount?: number;
  changedRows?: number;
}

const verifiers = new Map<SetId, Connection>();

async function verifier(setId: SetId): Promise<Connection> {
  let conn = verifiers.get(setId);
  if (conn) {
    try {
      await conn.ping();
      return conn;
    } catch {
      conn.destroy();
      verifiers.delete(setId);
    }
  }
  conn = await connectAsStudent({ setId });
  conn.on('error', () => verifiers.delete(setId));
  verifiers.set(setId, conn);
  return conn;
}

export function dropVerifier(setId: SetId): void {
  const conn = verifiers.get(setId);
  if (conn) conn.destroy();
  verifiers.delete(setId);
}

async function q(conn: Connection, sql: string, params: unknown[] = []): Promise<(string | null)[][]> {
  const [rows] = await conn.query({ sql, rowsAsArray: true }, params);
  return rows as unknown as (string | null)[][];
}

function canonical(rows: (string | null)[][]): string[] {
  return rows.map((r) => JSON.stringify(r)).sort();
}

function sameRows(a: (string | null)[][], b: (string | null)[][]): boolean {
  if (a.length !== b.length) return false;
  if (a.length > 0 && a[0].length !== b[0].length) return false;
  const ca = canonical(a);
  const cb = canonical(b);
  return ca.every((v, i) => v === cb[i]);
}

async function columnsOf(conn: Connection, db: string): Promise<Map<string, Map<string, string>>> {
  const rows = await q(
    conn,
    `SELECT LOWER(c.TABLE_NAME), LOWER(c.COLUMN_NAME), LOWER(c.DATA_TYPE)
       FROM information_schema.COLUMNS c
       JOIN information_schema.TABLES t
         ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      WHERE c.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE'`,
    [db],
  );
  const map = new Map<string, Map<string, string>>();
  for (const [table, column, type] of rows) {
    const t = String(table);
    if (!map.has(t)) map.set(t, new Map());
    map.get(t)!.set(String(column), String(type));
  }
  return map;
}

function referencesTable(masked: string, tables: string[]): boolean {
  return tables.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(masked));
}

async function evaluateTask(
  conn: Connection,
  db: string,
  check: TaskCheck,
  stmt: ExecutedStatement | null,
): Promise<boolean> {
  switch (check.kind) {
    case 'tables': {
      const cols = await columnsOf(conn, db);
      return check.tables.every((t) => {
        const c = cols.get(t.name.toLowerCase());
        return !!c && t.columns.every((col) => c.has(col.toLowerCase()));
      });
    }
    case 'rows': {
      for (const t of check.tables) {
        const rows = await q(conn, `SELECT COUNT(*) FROM ${mysql.escapeId(db)}.${mysql.escapeId(t)}`);
        if (Number(rows[0][0]) < check.min) return false;
      }
      return true;
    }
    case 'column': {
      const cols = await columnsOf(conn, db);
      return cols.get(check.table.toLowerCase())?.get(check.column.toLowerCase()) === check.dataType;
    }
    case 'view': {
      const views = await q(conn, 'SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?', [db]);
      if (views.length === 0) return false;
      const reference = await q(conn, check.reference);
      for (const [name] of views) {
        try {
          const rows = await q(conn, `SELECT * FROM ${mysql.escapeId(db)}.${mysql.escapeId(String(name))}`);
          if (sameRows(rows, reference)) return true;
        } catch {
          /* invalid view – ignore */
        }
      }
      return false;
    }
    case 'result': {
      if (!stmt || stmt.kind !== 'resultset' || !stmt.rows) return false;
      const { masked } = classify(stmt.sql);
      if (!referencesTable(masked, check.tables)) return false;
      if (check.mustUse && !check.mustUse.every((m) => new RegExp(m.pattern, 'i').test(masked))) return false;
      const reference = await q(conn, check.reference);
      if (reference.length === 0) return false;
      return sameRows(stmt.rows, reference);
    }
    case 'update': {
      if (!stmt || stmt.kind !== 'ok') return false;
      const { masked, first } = classify(stmt.sql);
      if (first !== 'UPDATE') return false;
      const target = new RegExp(`^UPDATE\\s+(?:LOW_PRIORITY\\s+)?(?:IGNORE\\s+)?(?:\`?\\w+\`?\\.)?\`?${check.table}\`?\\b`, 'i');
      if (!target.test(masked) && !target.test(classify(stmt.sql).body)) return false;
      if (!new RegExp(`\\bSET\\b[\\s\\S]*\\b${check.column}\\b`, 'i').test(masked)) return false;
      return (stmt.changedRows ?? 0) > 0;
    }
  }
}

/**
 * Re-evaluate the incomplete tasks of a set after a successful statement.
 * Returns the full progress and the tasks completed by this statement.
 */
export async function evaluateProgress(
  setId: SetId,
  stmt: ExecutedStatement | null,
): Promise<{ progress: Progress; newlyCompleted: TaskId[] }> {
  const progress = await loadProgress(setId);
  const pending = getExamSet(setId).tasks.filter((t) => !progress[t.id]);
  if (pending.length === 0) return { progress, newlyCompleted: [] };

  const db = databaseNameFor(setId);
  const newlyCompleted: TaskId[] = [];
  let conn: Connection;
  try {
    conn = await verifier(setId);
    const exists = await q(conn, 'SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [db]);
    if (exists.length === 0) return { progress, newlyCompleted };
    await conn.query(`USE ${mysql.escapeId(db)}`);
  } catch {
    return { progress, newlyCompleted };
  }

  const isPrereq = (t: ExamTask) => t.id === 'a' || t.id === 'b';
  for (const task of pending) {
    // (c)-(f) only count once the schema exists and holds the sample data.
    if (!isPrereq(task) && !(progress.a && progress.b)) continue;
    try {
      if (await evaluateTask(conn, db, task.check, stmt)) {
        progress[task.id] = true;
        newlyCompleted.push(task.id);
      }
    } catch {
      /* a failing check simply means "not complete yet" */
    }
  }
  if (newlyCompleted.length) await markComplete(setId, newlyCompleted);
  return { progress, newlyCompleted };
}
