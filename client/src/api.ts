import type {
  ExecuteRequest,
  ExecuteResponse,
  HealthResponse,
  SessionInfo,
  SetId,
} from '../../shared/types';

const SESSION_STORAGE_KEY = 'dbms_lab_visitor_session_id';

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

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health', { headers: defaultHeaders() });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return (await res.json()) as HealthResponse;
}

export async function fetchSetSession(setId: SetId): Promise<SessionInfo> {
  const res = await fetch(`/api/sets/${setId}/session`, {
    method: 'GET',
    headers: defaultHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to initialize Set ${setId} session (${res.status})`);
  }
  return (await res.json()) as SessionInfo;
}

export async function executeSetSql(
  setId: SetId,
  payload: ExecuteRequest,
): Promise<ExecuteResponse> {
  const res = await fetch(`/api/sets/${setId}/execute`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(payload),
  });
  return (await res.json()) as ExecuteResponse;
}

export async function resetSet(setId: SetId): Promise<SessionInfo> {
  const res = await fetch(`/api/sets/${setId}/reset`, {
    method: 'POST',
    headers: defaultHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to reset Set ${setId} (${res.status})`);
  }
  return (await res.json()) as SessionInfo;
}
