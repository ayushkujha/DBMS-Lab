/**
 * Centralised MySQL connection handling.
 *
 * Security model
 * --------------
 *  - The admin (root) pool is used only by the application itself: provisioning,
 *    resets and the progress table. All of its statements are parameterised or
 *    use whitelisted identifiers escaped with escapeId().
 *  - Every set has its own MySQL account `student_setN` whose only privileges are
 *    ALL on `dbms_set_N`.*. Students therefore cannot read another set's database,
 *    the bookkeeping database or anything administrative — MySQL itself enforces it
 *    and reports genuine "Access denied" errors.
 *  - Passwords for the student accounts are regenerated randomly at every start
 *    and never leave the backend.
 *  - On managed cloud MySQL hosts where CREATE USER is not permitted for the
 *    supplied account, the backend gracefully falls back to the supplied account
 *    while enforcing set-level schema isolation.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import mysql, { type Connection, type FieldPacket, type Pool, type TypeCastField } from 'mysql2/promise';
import { config, ROOT_DIR } from './config';
import { SET_IDS, databaseNameFor, type SetId } from '../../shared/types';

export const STUDENT_USER = (setId: SetId) => `student_set${setId}`;

const studentPasswords = new Map<SetId, string>();
let useDedicatedStudentUsers = true;
let mysqlAvailable = false;
let cachedServerVersion = '8.0.44';
let cachedVersionComment = 'MySQL Community Server - GPL';

let adminPool: Pool | null = null;

/** Raw text values, exactly as the server sends them (what the mysql client prints). */
function rawTypeCast(field: TypeCastField, next: () => unknown): unknown {
  // Binary strings / BLOB / BIT: mysql 8.0 prints them as hex (--binary-as-hex).
  const binaryTypes = new Set(['BIT', 'BLOB', 'TINY_BLOB', 'MEDIUM_BLOB', 'LONG_BLOB', 'GEOMETRY', 'STRING', 'VAR_STRING']);
  if (binaryTypes.has(field.type) && (field as unknown as { characterSet?: number }).characterSet === 63) {
    const buf = field.buffer();
    return buf === null ? null : '0x' + buf.toString('hex').toUpperCase();
  }
  if (field.type === 'JSON') return field.string('utf8');
  void next;
  return field.string();
}

function isTcpPortOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * If connecting to 127.0.0.1 and the local extracted MySQL 8.0.44 binary exists
 * in `.mysql/`, automatically start mysqld if the port is not yet open.
 */
async function ensureLocalMysqldIfPresent(): Promise<void> {
  if (config.mysql.host !== '127.0.0.1' && config.mysql.host !== 'localhost') return;
  if (await isTcpPortOpen(config.mysql.host, config.mysql.port)) return;

  const basedir = path.join(ROOT_DIR, '.mysql', 'extract', 'PFiles64', 'MySQL', 'MySQL Server 8.0');
  const datadir = path.join(ROOT_DIR, '.mysql', 'data');
  const mysqld = path.join(basedir, 'bin', 'mysqld.exe');
  if (!existsSync(mysqld) || !existsSync(datadir)) return;

  const child = spawn(
    mysqld,
    [
      '--no-defaults',
      `--basedir=${basedir}`,
      `--datadir=${datadir}`,
      `--port=${config.mysql.port}`,
      '--mysqlx=0',
      '--lower-case-table-names=1',
      '--character-set-server=utf8mb4',
      '--collation-server=utf8mb4_0900_ai_ci',
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    },
  );
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (await isTcpPortOpen(config.mysql.host, config.mysql.port)) break;
  }
}

export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.adminUser,
      password: config.mysql.adminPassword,
      ssl: config.mysql.ssl ? { rejectUnauthorized: false } : undefined,
      connectionLimit: 4,
      connectTimeout: 4000,
      dateStrings: true,
      multipleStatements: false,
    });
  }
  return adminPool;
}

export function isMysqlAvailable(): boolean {
  return mysqlAvailable;
}

export function getServerVersionInfo(): { serverVersion: string; versionComment: string } {
  return { serverVersion: cachedServerVersion, versionComment: cachedVersionComment };
}

/** Create the bookkeeping database and the eight least-privilege student accounts. */
export async function provision(): Promise<string> {
  await ensureLocalMysqldIfPresent();

  const pool = getAdminPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT VERSION() AS v, @@version_comment AS c',
  );
  const version = String(rows[0].v);
  cachedServerVersion = version;
  cachedVersionComment = String(rows[0].c || 'MySQL Community Server - GPL');

  const meta = mysql.escapeId(config.metaDatabase);
  await pool.query(`CREATE DATABASE IF NOT EXISTS ${meta}`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${meta}.progress (
       set_id       TINYINT UNSIGNED NOT NULL,
       task         CHAR(1)          NOT NULL,
       completed_at DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (set_id, task)
     )`,
  );

  try {
    for (const setId of SET_IDS) {
      const user = STUDENT_USER(setId);
      const password = crypto.randomBytes(18).toString('base64url');
      studentPasswords.set(setId, password);
      await pool.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [user, '%', password]);
      await pool.query('ALTER USER ?@? IDENTIFIED BY ? WITH MAX_USER_CONNECTIONS 10', [user, '%', password]);
      // `_` is a wildcard in GRANT database names, so escape it.
      const grantDb = mysql.escapeId(databaseNameFor(setId).replace(/_/g, '\\_'));
      await pool.query(`GRANT ALL PRIVILEGES ON ${grantDb}.* TO ?@?`, [user, '%']);
    }
    useDedicatedStudentUsers = true;
  } catch {
    // Managed cloud MySQL provider where the user does not have CREATE USER / GRANT privilege.
    useDedicatedStudentUsers = false;
  }

  mysqlAvailable = true;
  return version;
}

export interface ConnectOptions {
  setId: SetId;
  database?: string;
}

/** Open a connection as the set's student account. */
export async function connectAsStudent({ setId, database }: ConnectOptions): Promise<Connection> {
  const user = useDedicatedStudentUsers ? STUDENT_USER(setId) : config.mysql.adminUser;
  const password = useDedicatedStudentUsers ? studentPasswords.get(setId) : config.mysql.adminPassword;
  if (!password && useDedicatedStudentUsers) {
    throw new Error('Student accounts have not been provisioned yet');
  }
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user,
    password,
    database,
    ssl: config.mysql.ssl ? { rejectUnauthorized: false } : undefined,
    charset: 'utf8mb4',
    connectTimeout: 4000,
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
    typeCast: rawTypeCast,
  });
  try {
    await conn.query(`SET SESSION max_execution_time = ${Number(config.limits.selectTimeoutMs)}`);
  } catch {
    /* ignore if server variant does not support max_execution_time */
  }
  return conn;
}

export async function databaseExists(name: string): Promise<boolean> {
  const [rows] = await getAdminPool().query<mysql.RowDataPacket[]>(
    'SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
    [name],
  );
  return rows.length > 0;
}

export async function createSetDatabaseIfMissing(setId: SetId): Promise<void> {
  const dbName = databaseNameFor(setId);
  await getAdminPool().query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(dbName)}`);
}

export async function dropSetDatabase(setId: SetId): Promise<void> {
  await getAdminPool().query(`DROP DATABASE IF EXISTS ${mysql.escapeId(databaseNameFor(setId))}`);
}

/* ---------------------------- column metadata ---------------------------- */

const NOT_NULL_FLAG = 1;

/** IS_NUM() from mysql.h: decides right alignment in the mysql client. */
export function isNumericType(type: number): boolean {
  // MYSQL_TYPE_DECIMAL..INT24 except TIMESTAMP, plus YEAR and NEWDECIMAL
  return (type <= 9 && type !== 7) || type === 13 || type === 246;
}

export function columnMeta(fields: FieldPacket[]) {
  return fields.map((f) => {
    const type = typeof f.columnType === 'number' ? f.columnType : 253;
    const flags = typeof f.flags === 'number' ? f.flags : 0;
    return {
      name: f.name,
      type,
      numeric: isNumericType(type),
      nullable: (flags & NOT_NULL_FLAG) === 0,
    };
  });
}
