/**
 * Client-side statement splitter modelled on the mysql command-line client.
 *
 * Like the real `mysql` program, the console never sends several statements
 * in one request: the input buffer is cut at the active delimiter (default
 * `;`, or `\g` / `\G`) outside quotes and comments, and each statement is
 * sent to the server individually.
 *
 * Supported client commands (as in mysql):
 *   DELIMITER <str>   change the statement delimiter
 *   \c  / clear       discard the current input statement
 *   \g  / \G          terminate a statement (\G = vertical output)
 *   help / \h / ?     show the client help
 *   exit / quit / \q  leave the session (the console reconnects)
 *   use <db>          change database (semicolon optional)
 *   \! cls / system cls / \! clear   clear the screen
 */

export type SplitItem =
  | { type: 'sql'; sql: string; vertical: boolean }
  | { type: 'empty' }
  | { type: 'delimiter'; value: string }
  | { type: 'clear-buffer' }
  | { type: 'clear-screen' }
  | { type: 'help' }
  | { type: 'quit' };

export interface SplitResult {
  items: SplitItem[];
  /** Index in the input up to which text was consumed by complete items. */
  consumed: number;
  /** Incomplete trailing input (not yet terminated). */
  remainder: string;
  /** Delimiter in effect after processing. */
  delimiter: string;
}

type ScanState = 'normal' | "'" | '"' | '`' | 'block' | 'line';

export type PromptKind = 'mysql>' | '    ->' | "    '>" | '    ">' | '    `>' | '   /*>';

const HELP_RE = /^\s*(help|\?|\\h)\s*;?\s*$/i;
const QUIT_RE = /^\s*(exit|quit|\\q)\s*;?\s*$/i;
const CLEAR_RE = /^\s*clear\s*;?\s*$/i;
const CLS_RE = /^\s*(\\!|system)\s+(cls|clear)\s*;?\s*$/i;
const USE_RE = /^\s*use\s+(`[^`]+`|[^\s;]+)\s*;?\s*$/i;
const DELIM_RE = /^\s*delimiter\s+(\S+)\s*$/i;

function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

interface ScanHooks {
  onLineStart?: (lineIndex: number, state: ScanState, bufferBlank: boolean) => void;
}

function scan(text: string, startDelimiter: string, hooks: ScanHooks = {}): SplitResult {
  const items: SplitItem[] = [];
  let delimiter = startDelimiter;
  let state: ScanState = 'normal';
  let buffer = '';
  let consumed = 0;
  let lineIndex = 0;
  let atLineStart = true;
  let i = 0;

  const pushSql = (vertical: boolean) => {
    const sql = buffer.trim();
    if (sql.length === 0) items.push({ type: 'empty' });
    else items.push({ type: 'sql', sql, vertical });
    buffer = '';
  };

  while (i < text.length) {
    if (atLineStart) {
      hooks.onLineStart?.(lineIndex, state, isBlank(buffer));
      atLineStart = false;

      // Long-form client commands are only recognised at the start of a statement.
      if (state === 'normal' && isBlank(buffer)) {
        const end = text.indexOf('\n', i);
        const lineEnd = end === -1 ? text.length : end;
        const line = text.slice(i, lineEnd);
        const next = end === -1 ? text.length : end + 1;
        let handled: SplitItem | null = null;
        let m: RegExpMatchArray | null;
        if ((m = line.match(DELIM_RE))) handled = { type: 'delimiter', value: m[1] };
        else if (HELP_RE.test(line)) handled = { type: 'help' };
        else if (QUIT_RE.test(line)) handled = { type: 'quit' };
        else if (CLS_RE.test(line)) handled = { type: 'clear-screen' };
        else if (CLEAR_RE.test(line)) handled = { type: 'clear-buffer' };
        else if ((m = line.match(USE_RE))) handled = { type: 'sql', sql: `USE ${m[1]}`, vertical: false };
        if (handled) {
          if (handled.type === 'delimiter') delimiter = handled.value;
          items.push(handled);
          buffer = '';
          i = next;
          consumed = next;
          if (end !== -1) {
            lineIndex++;
            atLineStart = true;
          }
          continue;
        }
      }
    }

    const ch = text[i];
    const nx = text[i + 1];

    if (ch === '\n') {
      if (state === 'line') state = 'normal';
      buffer += ch;
      i++;
      lineIndex++;
      atLineStart = true;
      if (isBlank(buffer) && state === 'normal') consumed = i;
      continue;
    }

    switch (state) {
      case 'normal': {
        if (text.startsWith(delimiter, i)) {
          pushSql(false);
          i += delimiter.length;
          consumed = i;
          continue;
        }
        if (ch === '\\' && (nx === 'g' || nx === 'G')) {
          pushSql(nx === 'G');
          i += 2;
          consumed = i;
          continue;
        }
        if (ch === '\\' && nx === 'c') {
          buffer = '';
          items.push({ type: 'clear-buffer' });
          i += 2;
          consumed = i;
          continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') state = ch;
        else if (ch === '#') state = 'line';
        else if (ch === '-' && nx === '-' && (i + 2 >= text.length || /\s/.test(text[i + 2]))) state = 'line';
        else if (ch === '/' && nx === '*') {
          state = 'block';
          buffer += '/*';
          i += 2;
          continue;
        }
        buffer += ch;
        i++;
        continue;
      }
      case "'":
      case '"': {
        buffer += ch;
        if (ch === '\\' && nx !== undefined && nx !== '\n') {
          buffer += nx;
          i += 2;
          continue;
        }
        if (ch === state) {
          if (nx === state) {
            buffer += nx;
            i += 2;
            continue;
          }
          state = 'normal';
        }
        i++;
        continue;
      }
      case '`': {
        buffer += ch;
        if (ch === '`') {
          if (nx === '`') {
            buffer += nx;
            i += 2;
            continue;
          }
          state = 'normal';
        }
        i++;
        continue;
      }
      case 'block': {
        buffer += ch;
        if (ch === '*' && nx === '/') {
          buffer += '/';
          state = 'normal';
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      case 'line': {
        buffer += ch;
        i++;
        continue;
      }
    }
  }

  if (atLineStart) hooks.onLineStart?.(lineIndex, state, isBlank(buffer));

  return { items, consumed, remainder: text.slice(consumed), delimiter };
}

/** Split an input buffer into executable items (statements and client commands). */
export function splitInput(text: string, delimiter = ';'): SplitResult {
  return scan(text, delimiter);
}

/** Prompt shown in front of each line of the input buffer, exactly like mysql. */
export function linePrompts(text: string, delimiter = ';'): PromptKind[] {
  const prompts: PromptKind[] = [];
  scan(text, delimiter, {
    onLineStart: (index, state, blank) => {
      let p: PromptKind;
      switch (state) {
        case "'":
          p = "    '>";
          break;
        case '"':
          p = '    ">';
          break;
        case '`':
          p = '    `>';
          break;
        case 'block':
          p = '   /*>';
          break;
        default:
          p = blank ? 'mysql>' : '    ->';
      }
      prompts[index] = p;
    },
  });
  const lineCount = text.split('\n').length;
  for (let i = 0; i < lineCount; i++) if (!prompts[i]) prompts[i] = i === 0 ? 'mysql>' : '    ->';
  return prompts.slice(0, lineCount);
}

/** Split a block of reference SQL (e.g. a solution) into its statements. */
export function splitStatements(text: string): string[] {
  return splitInput(text)
    .items.filter((it): it is Extract<SplitItem, { type: 'sql' }> => it.type === 'sql')
    .map((it) => it.sql);
}
