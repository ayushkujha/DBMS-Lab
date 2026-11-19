import React, { useEffect, useRef } from 'react';
import {
  formatElapsed,
  formatTable,
  formatVertical,
  mysqlErrorLine,
  okSummary,
  resultSetSummary,
} from '../../shared/format';
import { linePrompts, type PromptKind } from '../../shared/splitter';
import type { ExecuteResponse, SessionInfo } from '../../shared/types';

export interface EchoLine {
  prompt: PromptKind;
  text: string;
}

export type TranscriptEntry =
  | {
      id: string;
      kind: 'execution';
      echo: EchoLine[];
      vertical: boolean;
      response: ExecuteResponse;
    }
  | {
      id: string;
      kind: 'client-output';
      echo: EchoLine[];
      lines: string[];
    };

interface MysqlTerminalProps {
  session: SessionInfo | null;
  loadingSession: boolean;
  sessionError: string | null;
  showBanner: boolean;
  entries: TranscriptEntry[];
  input: string;
  delimiter: string;
  isExecuting: boolean;
  scrollTrigger: number;
  onInputChange: (val: string) => void;
  onSubmitBuffer: (forceTerminate?: boolean) => void;
  onCancelBuffer: () => void;
  onClearScreen: () => void;
  onNavigateHistory: (dir: 'up' | 'down') => void;
}

export const MYSQL_HELP_LINES = [
  'For information about MySQL products and services, visit:',
  '   http://www.mysql.com/',
  '',
  'List of all MySQL commands:',
  "Note that all text commands must be first on line and end with ';'",
  '?         (\\?) Synonym for `help\'.',
  'clear     (\\c) Clear the current input statement.',
  'delimiter (\\d) Set statement delimiter.',
  'ego       (\\G) Send command to mysql server, display result vertically.',
  'exit      (\\q) Exit mysql. Same as quit.',
  'go        (\\g) Send command to mysql server.',
  'help      (\\h) Display this help.',
  'quit      (\\q) Quit mysql.',
  'use       (\\u) Use another database. Takes database name as argument.',
];

export const MysqlTerminal: React.FC<MysqlTerminalProps> = ({
  session,
  sessionError,
  showBanner,
  entries,
  input,
  delimiter,
  isExecuting,
  scrollTrigger,
  onInputChange,
  onSubmitBuffer,
  onCancelBuffer,
  onClearScreen,
  onNavigateHistory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const prompts = linePrompts(input, delimiter);
  const inputLines = input.split('\n');
  const lineCount = Math.max(1, inputLines.length);

  // Scroll to bottom when a manual command is submitted
  useEffect(() => {
    if (scrollTrigger === 0) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [scrollTrigger]);

  // Reset scroll to top when switching sets so the full session from CREATE TABLE -> queries is visible
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [session?.setId]);

  const handleContainerClick = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // Ctrl+L -> clear screen without clearing DB
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      onClearScreen();
      return;
    }

    // Ctrl+C when nothing is selected and input is non-empty -> cancel statement (^C)
    if (
      e.ctrlKey &&
      !e.metaKey &&
      e.key.toLowerCase() === 'c' &&
      ta.selectionStart === ta.selectionEnd &&
      input.length > 0
    ) {
      e.preventDefault();
      onCancelBuffer();
      return;
    }

    // Ctrl+Enter or Cmd+Enter -> force terminate & execute immediately
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmitBuffer(true);
      return;
    }

    // Enter -> check if buffer has a terminated statement or client command
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onSubmitBuffer(false);
      return;
    }

    // Tab -> insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const nextVal = input.slice(0, start) + '  ' + input.slice(end);
      onInputChange(nextVal);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
      return;
    }

    // Up arrow on first line -> previous command in history
    if (e.key === 'ArrowUp') {
      const beforeCaret = input.slice(0, ta.selectionStart);
      if (!beforeCaret.includes('\n')) {
        e.preventDefault();
        onNavigateHistory('up');
        return;
      }
    }

    // Down arrow on last line -> next command in history
    if (e.key === 'ArrowDown') {
      const afterCaret = input.slice(ta.selectionEnd);
      if (!afterCaret.includes('\n')) {
        e.preventDefault();
        onNavigateHistory('down');
        return;
      }
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      onClick={handleContainerClick}
      className="h-full w-full overflow-y-auto bg-black px-2 py-1.5 text-[14px] leading-[1.35] text-[#cccccc] cursor-text font-mono"
    >
      <div className="max-w-full">
        {sessionError && (
          <div className="mb-3">
            ERROR 2003 (HY000): Can&apos;t connect to MySQL server ({sessionError})
          </div>
        )}

        {/* Authentic MySQL 8.0 Welcome Banner & Session Initialization */}
        {session && showBanner && (
          <div>
            <pre className="whitespace-pre-wrap font-mono text-[#cccccc] m-0">
{`Welcome to the MySQL monitor.  Commands end with ; or \\g.
Your MySQL connection id is ${session.connectionId}
Server version: ${session.serverVersion} ${session.versionComment}

Copyright (c) 2000, 2026, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\\h' for help. Type '\\c' to clear the current input statement.

mysql> CREATE DATABASE ${session.databaseName};
Query OK, 1 row affected ${formatElapsed(session.initElapsedCreateMs ?? 1.2)}

mysql> USE ${session.databaseName};
Database changed`}
            </pre>
          </div>
        )}

        {/* Executed command history & responses */}
        {entries.map((entry) => {
          if (entry.kind === 'client-output') {
            return (
              <div key={entry.id}>
                <div>
                  {entry.echo.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">
                      <span>{line.prompt} </span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
                {entry.lines.length > 0 && (
                  <pre className="overflow-x-auto whitespace-pre font-mono text-[#cccccc] m-0">
                    {entry.lines.join('\n')}
                  </pre>
                )}
              </div>
            );
          }

          const { response, echo, vertical } = entry;
          return (
            <div key={entry.id} className="mb-3">
              {/* Echoed prompt + SQL lines */}
              <div>
                {echo.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">
                    <span>{line.prompt} </span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>

              {/* Reconnect notice if connection was reopened */}
              {response.ok && response.reconnected && (
                <div>
                  No connection. Trying to reconnect...
                  <br />
                  Connection id:    {response.reconnected.connectionId}
                  <br />
                  Current database: {response.reconnected.database ?? '*** NONE ***'}
                </div>
              )}

              {/* Successful execution output */}
              {response.ok && (
                <div>
                  {response.isUse ? (
                    <div>Database changed</div>
                  ) : (
                    response.results.map((res, rIdx) => {
                      if (res.kind === 'resultset') {
                        const tableLines =
                          res.rows.length > 0
                            ? vertical
                              ? formatVertical(res.columns, res.rows)
                              : formatTable(res.columns, res.rows)
                            : [];
                        const summary = resultSetSummary(
                          res.totalRows,
                          response.warnings,
                          response.elapsedMs,
                        );

                        return (
                          <div key={rIdx}>
                            {tableLines.length > 0 && (
                              <pre className="overflow-x-auto whitespace-pre font-mono text-[#cccccc] m-0">
                                {tableLines.join('\n')}
                              </pre>
                            )}
                            <div>{summary}</div>
                            {res.truncated && (
                              <div>
                                Output truncated to {res.rows.length} of {res.totalRows} rows.
                              </div>
                            )}
                          </div>
                        );
                      }

                      // OK packet (CREATE, INSERT, UPDATE, DELETE, ALTER, DROP)
                      const summary = okSummary(
                        res.affectedRows,
                        response.warnings,
                        response.elapsedMs,
                      );
                      return (
                        <div key={rIdx}>
                          <div>{summary}</div>
                          {res.info && <div>{res.info}</div>}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* MySQL or console error output */}
              {!response.ok && (
                <div className="whitespace-pre-wrap">
                  {response.kind === 'mysql'
                    ? mysqlErrorLine(response.errno, response.sqlState, response.message)
                    : `ERROR: ${response.message}`}
                </div>
              )}
            </div>
          );
        })}

        {/* Active command prompt & multiline input */}
        {session && (
          <div className="pb-6">
            <div className="flex items-start">
              {/* Left column: per-line prompts (mysql> / -> / '> / ">) */}
              <div
                aria-hidden="true"
                className="shrink-0 select-none pr-1.5 font-mono text-[#cccccc]"
              >
                {prompts.map((p, idx) => (
                  <div key={idx} className="leading-[1.35] whitespace-pre">
                    {p}
                  </div>
                ))}
              </div>

              {/* Right column: multiline SQL textarea */}
              <div className="relative flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  disabled={isExecuting}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={lineCount}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  aria-label="MySQL command line input"
                  className="block w-full resize-none overflow-hidden bg-transparent p-0 font-mono text-[14px] leading-[1.35] text-[#cccccc] caret-[#cccccc] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
