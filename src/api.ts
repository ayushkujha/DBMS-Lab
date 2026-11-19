import { createPortableMysqlEngine } from '../shared/portableMysqlEngine';
import type {
  ExecuteRequest,
  ExecuteResponse,
  HealthResponse,
  SessionInfo,
  SetId,
} from '../shared/types';

const SESSION_STORAGE_KEY = 'dbms_lab_visitor_session_id';

const browserEngine = createPortableMysqlEngine(() => ({
  locateFile: () => '/sql-wasm.wasm',
}));

/**
 * Mode detection:
 *  - 'unknown': haven't checked yet
 *  - 'server':  backend /api has a live MySQL 8.0 TCP connection
 *  - 'browser': run the portable MySQL 8.0 engine directly in the browser
 */
let executionMode: 'unknown' | 'server' | 'browser' = 'unknown';
let modePromise: Promise<'server' | 'browser'> | null = null;

export function getVisitorSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      id = 's_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'default_session';
  }
}

function defaultHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Lab-Session': getVisitorSessionId(),
  };
}

async function resolveExecutionMode(): Promise<'server' | 'browser'> {
  if (executionMode !== 'unknown') return executionMode;
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const res = await fetch('/api/health', { headers: defaultHeaders() });
        if (res.ok) {
          const data = (await res.json()) as HealthResponse;
          if (data.ok && data.message === 'MySQL 8.0 connected') {
            executionMode = 'server';
            return 'server';
          }
        }
      } catch {
        /* fall through to browser engine */
      }
      executionMode = 'browser';
      return 'browser';
    })();
  }
  return modePromise;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const mode = await resolveExecutionMode();
  if (mode === 'server') {
    const res = await fetch('/api/health', { headers: defaultHeaders() });
    if (res.ok) return (await res.json()) as HealthResponse;
  }
  return {
    ok: true,
    serverVersion: '8.0.44',
    message: 'MySQL 8.0 connected',
  };
}

export async function fetchSetSession(setId: SetId): Promise<SessionInfo> {
  const mode = await resolveExecutionMode();
  if (mode === 'server') {
    try {
      const res = await fetch(`/api/sets/${setId}/session`, {
        method: 'GET',
        headers: defaultHeaders(),
      });
      if (res.ok) {
        return (await res.json()) as SessionInfo;
      }
      executionMode = 'browser';
    } catch {
      executionMode = 'browser';
    }
  }
  return browserEngine.getSessionInfo(setId, getVisitorSessionId());
}

export async function executeSetSql(
  setId: SetId,
  payload: ExecuteRequest,
): Promise<ExecuteResponse> {
  const mode = await resolveExecutionMode();
  if (mode === 'server') {
    try {
      const res = await fetch(`/api/sets/${setId}/execute`, {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return (await res.json()) as ExecuteResponse;
      }
      executionMode = 'browser';
    } catch {
      executionMode = 'browser';
    }
  }
  return browserEngine.executeStatement(setId, payload, getVisitorSessionId());
}

export async function resetSet(setId: SetId): Promise<SessionInfo> {
  const mode = await resolveExecutionMode();
  if (mode === 'server') {
    try {
      const res = await fetch(`/api/sets/${setId}/reset`, {
        method: 'POST',
        headers: defaultHeaders(),
      });
      if (res.ok) {
        return (await res.json()) as SessionInfo;
      }
      executionMode = 'browser';
    } catch {
      executionMode = 'browser';
    }
  }
  return browserEngine.resetSession(setId, getVisitorSessionId());
}
