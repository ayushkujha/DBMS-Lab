declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export interface Statement {
    getColumnNames(): string[];
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: SqlValue[] | Record<string, SqlValue>): this;
    exec(sql: string, params?: SqlValue[] | Record<string, SqlValue>): QueryExecResult[];
    prepare(sql: string, params?: SqlValue[] | Record<string, SqlValue>): Statement;
    getRowsModified(): number;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
