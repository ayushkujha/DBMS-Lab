import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { config } from './config';
import { getServerVersionInfo, isMysqlAvailable, provision } from './db';
import { executeStatement, getSessionInfo, resetSetSession } from './sessions';
import {
  executeEmbeddedStatement,
  getEmbeddedSessionInfo,
  resetEmbeddedSession,
} from './embeddedMysql';
import { EXAM_SETS } from '../../shared/sets';
import { isSetId, type ExecuteRequest, type HealthResponse, type SetId } from '../../shared/types';

let initPromise: Promise<void> | null = null;

export function ensureBackendInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const version = await provision();
        console.log(`[dbms-lab] Connected to MySQL ${version} at ${config.mysql.host}:${config.mysql.port}`);
      } catch (err) {
        console.warn(
          `[dbms-lab] MySQL TCP server at ${config.mysql.host}:${config.mysql.port} not reachable (${(err as Error).message}). Using embedded MySQL 8.0 engine fallback.`,
        );
      }
    })();
  }
  return initPromise;
}

function parseSetId(param: string): SetId | null {
  const n = Number.parseInt(param, 10);
  return isSetId(n) ? n : null;
}

function getVisitorSessionKey(req: Request): string {
  const raw = req.header('x-lab-session');
  if (typeof raw === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(raw)) {
    return raw;
  }
  return 'default';
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));

  // Ensure DB provisioning has run before handling any /api request (essential for Vercel serverless cold start).
  app.use('/api', async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await ensureBackendInitialized();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/health', (_req: Request, res: Response<HealthResponse>) => {
    const { serverVersion } = getServerVersionInfo();
    res.json({
      ok: true,
      serverVersion,
      message: isMysqlAvailable() ? 'MySQL 8.0 connected' : 'MySQL 8.0 engine ready',
    });
  });

  app.get('/api/sets', (_req: Request, res: Response) => {
    res.json({ sets: EXAM_SETS });
  });

  app.get('/api/sets/:id/session', async (req: Request, res: Response) => {
    const setId = parseSetId(String(req.params.id));
    if (!setId) {
      res.status(400).json({ ok: false, kind: 'console', message: 'Invalid set number (must be 1..8).' });
      return;
    }
    try {
      const info = isMysqlAvailable()
        ? await getSessionInfo(setId)
        : await getEmbeddedSessionInfo(setId, getVisitorSessionKey(req));
      res.json(info);
    } catch (err) {
      res.status(500).json({
        ok: false,
        kind: 'console',
        message: (err as Error).message || 'Failed to initialize session.',
      });
    }
  });

  app.post('/api/sets/:id/execute', async (req: Request, res: Response) => {
    const setId = parseSetId(String(req.params.id));
    if (!setId) {
      res.status(400).json({ ok: false, kind: 'console', message: 'Invalid set number (must be 1..8).' });
      return;
    }
    const body = (req.body ?? {}) as ExecuteRequest;
    try {
      const result = isMysqlAvailable()
        ? await executeStatement(setId, body)
        : await executeEmbeddedStatement(setId, body, getVisitorSessionKey(req));
      res.json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        kind: 'console',
        message: (err as Error).message || 'Unexpected execution failure.',
      });
    }
  });

  app.post('/api/sets/:id/reset', async (req: Request, res: Response) => {
    const setId = parseSetId(String(req.params.id));
    if (!setId) {
      res.status(400).json({ ok: false, kind: 'console', message: 'Invalid set number (must be 1..8).' });
      return;
    }
    try {
      const info = isMysqlAvailable()
        ? await resetSetSession(setId)
        : await resetEmbeddedSession(setId, getVisitorSessionKey(req));
      res.json(info);
    } catch (err) {
      res.status(500).json({
        ok: false,
        kind: 'console',
        message: (err as Error).message || 'Failed to reset session.',
      });
    }
  });

  // Serve built frontend in production when running as a standalone Node server.
  if (existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get('/{*splat}', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  return app;
}
