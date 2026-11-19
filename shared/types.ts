/**
 * Types shared by the Express backend and the React frontend.
 * Everything that crosses the HTTP boundary is described here.
 */

export type SetId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type TaskId = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

export const SET_IDS: readonly SetId[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const TASK_IDS: readonly TaskId[] = ['a', 'b', 'c', 'd', 'e', 'f'];

/** Map of task id -> completed flag, as recorded by the backend. */
export type Progress = Record<TaskId, boolean>;

export interface ColumnMeta {
  name: string;
  /** MySQL protocol column type id (MYSQL_TYPE_*). */
  type: number;
  /** True when the mysql client would right-align this column (IS_NUM). */
  numeric: boolean;
  /** False when the column carries NOT_NULL_FLAG (affects the minimum width, as in mysql). */
  nullable: boolean;
}

export interface ResultSetResult {
  kind: 'resultset';
  columns: ColumnMeta[];
  /** Raw text values exactly as sent by the server (NULL -> null). */
  rows: (string | null)[][];
  /** Number of rows produced by the server (may exceed rows.length if truncated). */
  totalRows: number;
  truncated: boolean;
}

export interface OkResult {
  kind: 'ok';
  affectedRows: number;
  /** Server info string, e.g. "Rows matched: 1  Changed: 1  Warnings: 0". */
  info: string;
}

export type StatementResult = ResultSetResult | OkResult;

export interface ReconnectInfo {
  connectionId: number;
  database: string | null;
}

interface ResponseBase {
  /** Measured wall time of the statement on the backend, in milliseconds. */
  elapsedMs: number;
  /** Current default database of the console connection after the statement. */
  database: string | null;
  connectionId: number | null;
  progress: Progress;
  /** Tasks that became complete because of this statement. */
  newlyCompleted: TaskId[];
  /** Present when the backend had to open a new MySQL connection for this request. */
  reconnected?: ReconnectInfo;
}

export interface ExecuteSuccess extends ResponseBase {
  ok: true;
  /** True when the statement was a USE statement ("Database changed"). */
  isUse: boolean;
  results: StatementResult[];
  warnings: number;
}

export interface ExecuteMysqlError extends ResponseBase {
  ok: false;
  kind: 'mysql';
  errno: number;
  sqlState: string;
  message: string;
}

/** Errors produced by the lab console itself (never disguised as MySQL errors). */
export interface ConsoleError {
  ok: false;
  kind: 'console';
  message: string;
}

export type ExecuteResponse = ExecuteSuccess | ExecuteMysqlError | ConsoleError;

export interface ExecuteRequest {
  sql: string;
  /** Connection id the client last saw for this set (used to report reconnects). */
  connectionId?: number | null;
  /** Active database the client last saw (restored on serverless reconnect). */
  currentDatabase?: string | null;
  /** Prior mutating statements for stateless serverless replay when needed. */
  replaySql?: string[];
}

export interface BootstrappedItem {
  sql: string;
  response: ExecuteResponse;
}

export interface SessionInfo {
  setId: SetId;
  connectionId: number;
  serverVersion: string;
  versionComment: string;
  database: string | null;
  databaseName: string;
  databaseExists: boolean;
  initElapsedCreateMs?: number;
  initElapsedUseMs?: number;
  progress: Progress;
  /** Pre-executed transcript for all tasks (a)..(f) of the set. */
  transcript: BootstrappedItem[];
}

export interface HealthResponse {
  ok: boolean;
  serverVersion?: string;
  message?: string;
}

export function emptyProgress(): Progress {
  return { a: false, b: false, c: false, d: false, e: false, f: false };
}

export function isSetId(value: unknown): value is SetId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 8;
}

export function databaseNameFor(setId: SetId): string {
  return `dbms_set_${setId}`;
}
