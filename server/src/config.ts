import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

// Load the project .env (Node >= 20.12 / 21.7 ships process.loadEnvFile).
const envFile = path.join(ROOT_DIR, '.env');
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    /* ignore if already loaded */
  }
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseMysqlUrl(rawUrl?: string) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    return {
      host: u.hostname || '127.0.0.1',
      port: u.port ? Number.parseInt(u.port, 10) : 3306,
      adminUser: decodeURIComponent(u.username || 'root'),
      adminPassword: decodeURIComponent(u.password || ''),
      ssl: u.searchParams.get('ssl') === 'true' || u.searchParams.has('ssl-mode') || u.searchParams.has('sslaccept'),
    };
  } catch {
    return null;
  }
}

const fromUrl = parseMysqlUrl(process.env.MYSQL_URL ?? process.env.DATABASE_URL);

export const config = {
  port: int('PORT', 4000),
  mysql: {
    host: fromUrl?.host ?? process.env.MYSQL_HOST ?? '127.0.0.1',
    port: fromUrl?.port ?? int('MYSQL_PORT', 3307),
    adminUser: fromUrl?.adminUser ?? process.env.MYSQL_USER ?? process.env.MYSQL_ROOT_USER ?? 'root',
    adminPassword: fromUrl?.adminPassword ?? process.env.MYSQL_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD ?? 'dbmslab_root_pw',
    ssl: fromUrl?.ssl || process.env.MYSQL_SSL === 'true',
  },
  /** Database holding the console's own bookkeeping (never visible to students). */
  metaDatabase: 'dbms_lab_meta',
  /** Hard limits applied to the student console. */
  limits: {
    maxSqlLength: 64 * 1024,
    maxRows: 2000,
    /** Server-side SELECT timeout (MAX_EXECUTION_TIME), ms. */
    selectTimeoutMs: 15_000,
    /** Client-side timeout for any statement, ms. */
    queryTimeoutMs: 30_000,
  },
  clientDist: path.join(ROOT_DIR, 'dist'),
};
