/**
 * Statement restrictions for the student console.
 *
 * MySQL privileges are the real enforcement boundary (each set's account can
 * only touch its own database). This guard additionally refuses statement
 * classes that have no place in a lab exam — server administration, account
 * management, file I/O — before they reach the server, and enforces that a
 * request carries exactly one statement.
 */

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

/** Remove leading whitespace and comments so the first keyword can be inspected. */
export function stripLeadingComments(sql: string): string {
  let s = sql;
  for (;;) {
    const before = s;
    s = s.replace(/^\s+/, '');
    if (s.startsWith('/*') && !s.startsWith('/*!')) {
      const end = s.indexOf('*/');
      s = end === -1 ? '' : s.slice(end + 2);
    } else if (s.startsWith('#') || /^--(\s|$)/.test(s)) {
      const end = s.indexOf('\n');
      s = end === -1 ? '' : s.slice(end + 1);
    }
    if (s === before) return s;
  }
}

/** Replace string literals, quoted identifiers and comments with blanks. */
export function maskLiterals(sql: string): string {
  return sql
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
    .replace(/"(?:[^"\\]|\\.|"")*"/g, '""')
    .replace(/`(?:[^`]|``)*`/g, '``')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(#|--\s)[^\n]*/g, ' ');
}

const BLOCKED: { re: RegExp; what: string }[] = [
  { re: /^(GRANT|REVOKE)\b/i, what: 'Privilege management' },
  { re: /^(CREATE|DROP|ALTER|RENAME)\s+(USER|ROLE)\b/i, what: 'Account management' },
  { re: /^SET\s+(DEFAULT\s+ROLE|ROLE|PASSWORD|RESOURCE\s+GROUP)\b/i, what: 'Account management' },
  { re: /^SET\s+(@@)?(GLOBAL|PERSIST|PERSIST_ONLY)\b/i, what: 'Changing global server variables' },
  { re: /^SET\s+@@(global|persist|persist_only)\./i, what: 'Changing global server variables' },
  { re: /^(SHUTDOWN|RESTART|KILL|FLUSH|RESET|PURGE|CLONE|INSTALL|UNINSTALL|BINLOG|CACHE\s+INDEX|LOAD\s+INDEX)\b/i, what: 'Server administration' },
  { re: /^(CHANGE\s+(MASTER|REPLICATION)|START\s+(SLAVE|REPLICA|GROUP_REPLICATION)|STOP\s+(SLAVE|REPLICA|GROUP_REPLICATION))\b/i, what: 'Replication control' },
  { re: /^LOCK\s+INSTANCE\b|^UNLOCK\s+INSTANCE\b/i, what: 'Server administration' },
  { re: /^(LOAD\s+(DATA|XML)|IMPORT\s+TABLE)\b/i, what: 'Server-side file import' },
  { re: /^(CREATE|ALTER|DROP)\s+(SERVER|TABLESPACE|LOGFILE\s+GROUP|SPATIAL\s+REFERENCE\s+SYSTEM|RESOURCE\s+GROUP|UNDO\s+TABLESPACE)\b/i, what: 'Server administration' },
  { re: /^HELP\b/i, what: 'Server-side HELP tables' },
];

export function checkStatement(sql: string): GuardResult {
  const body = stripLeadingComments(sql);
  if (body.length === 0) return { allowed: false, reason: 'No query specified' };

  for (const { re, what } of BLOCKED) {
    if (re.test(body)) {
      return { allowed: false, reason: `${what} is disabled in the DBMS Lab console.` };
    }
  }

  const masked = maskLiterals(body);
  if (/\bINTO\s+(OUTFILE|DUMPFILE)\b/i.test(masked)) {
    return { allowed: false, reason: 'Writing server-side files (INTO OUTFILE/DUMPFILE) is disabled in the DBMS Lab console.' };
  }
  if (/\bLOAD_FILE\s*\(/i.test(masked)) {
    return { allowed: false, reason: 'LOAD_FILE() is disabled in the DBMS Lab console.' };
  }
  // One statement per request: a delimiter followed by more SQL is refused here
  // (MySQL would refuse it too, because multipleStatements is off).
  const trimmed = masked.trim().replace(/;+\s*$/, '');
  if (/;\s*\S/.test(trimmed) && !/^\s*CREATE\b[\s\S]*\b(PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i.test(trimmed)) {
    return { allowed: false, reason: 'Send one statement at a time (the console splits your input at each delimiter).' };
  }
  return { allowed: true };
}

/** Classification used for "Database changed" output and completion checks. */
export function classify(sql: string) {
  const body = stripLeadingComments(sql);
  const masked = maskLiterals(body);
  const first = (masked.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
  return { body, masked, first };
}
