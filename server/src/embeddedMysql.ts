import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ROOT_DIR } from './config';
import { createPortableMysqlEngine } from '../../shared/portableMysqlEngine';

const engine = createPortableMysqlEngine(() => {
  const candidates = [
    path.join(ROOT_DIR, 'public', 'sql-wasm.wasm'),
    path.join(process.cwd(), 'public', 'sql-wasm.wasm'),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  try {
    const req = createRequire(import.meta.url);
    candidates.unshift(req.resolve('sql.js/dist/sql-wasm.wasm'));
  } catch {
    /* ignore */
  }
  for (const p of candidates) {
    if (existsSync(p)) {
      return { wasmBinary: readFileSync(p) };
    }
  }
  return undefined;
});

export const getEmbeddedSessionInfo = engine.getSessionInfo;
export const resetEmbeddedSession = engine.resetSession;
export const executeEmbeddedStatement = engine.executeStatement;
