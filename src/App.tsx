import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getExamSet } from '../shared/sets';
import { linePrompts, splitInput } from '../shared/splitter';
import {
  SET_IDS,
  emptyProgress,
  isSetId,
  type BootstrappedItem,
  type Progress,
  type SessionInfo,
  type SetId,
} from '../shared/types';
import { executeSetSql, fetchSetSession, resetSet } from './api';
import {
  MYSQL_HELP_LINES,
  MysqlTerminal,
  type EchoLine,
  type TranscriptEntry,
} from './components/MysqlTerminal';

interface SetWorkspace {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  session: SessionInfo | null;
  showBanner: boolean;
  entries: TranscriptEntry[];
  input: string;
  delimiter: string;
  commandHistory: string[];
  historyIndex: number;
  draftInput: string;
  replaySql: string[];
  progress: Progress;
}

function createInitialWorkspaces(): Record<SetId, SetWorkspace> {
  const map = {} as Record<SetId, SetWorkspace>;
  for (const id of SET_IDS) {
    map[id] = {
      initialized: false,
      loading: false,
      error: null,
      session: null,
      showBanner: true,
      entries: [],
      input: '',
      delimiter: ';',
      commandHistory: [],
      historyIndex: -1,
      draftInput: '',
      replaySql: [],
      progress: emptyProgress(),
    };
  }
  return map;
}

function buildEchoLines(sql: string, delimiter: string, suffix: string): EchoLine[] {
  const full = sql + suffix;
  const prompts = linePrompts(full, delimiter);
  const lines = full.split('\n');
  return lines.map((text, idx) => ({
    prompt: prompts[idx] ?? (idx === 0 ? 'mysql>' : '    ->'),
    text,
  }));
}

let entryCounter = 0;
function nextEntryId(): string {
  entryCounter += 1;
  return `entry_${Date.now()}_${entryCounter}`;
}

function transcriptToEntries(items: BootstrappedItem[]): {
  entries: TranscriptEntry[];
  history: string[];
} {
  const entries: TranscriptEntry[] = [];
  const history: string[] = [];
  for (const item of items) {
    const echo = buildEchoLines(item.sql, ';', ';');
    history.push(`${item.sql};`);
    entries.push({
      id: nextEntryId(),
      kind: 'execution',
      echo,
      vertical: false,
      response: item.response,
    });
  }
  return { entries, history };
}

function digitFromKeyEvent(e: KeyboardEvent): SetId | null {
  const codeMatch = e.code?.match(/^(?:Digit|Numpad)([1-8])$/);
  if (codeMatch) {
    const n = Number(codeMatch[1]);
    if (isSetId(n)) return n;
  }
  if (/^[1-8]$/.test(e.key)) {
    const n = Number(e.key);
    if (isSetId(n)) return n;
  }
  return null;
}

export const App: React.FC = () => {
  const [activeSetId, setActiveSetId] = useState<SetId>(1);
  const [workspaces, setWorkspaces] = useState<Record<SetId, SetWorkspace>>(
    createInitialWorkspaces,
  );
  const [executingSetId, setExecutingSetId] = useState<SetId | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState<number>(0);
  const [showStealthHelp, setShowStealthHelp] = useState<boolean>(false);

  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeSetIdRef = useRef(activeSetId);
  activeSetIdRef.current = activeSetId;

  const updateWorkspace = useCallback(
    (setId: SetId, updater: (prev: SetWorkspace) => SetWorkspace) => {
      setWorkspaces((prev) => ({
        ...prev,
        [setId]: updater(prev[setId]),
      }));
    },
    [],
  );

  const ensureSetLoaded = useCallback(
    async (setId: SetId) => {
      const cur = workspacesRef.current[setId];
      if (cur.initialized || cur.loading) return;

      updateWorkspace(setId, (ws) => ({ ...ws, loading: true, error: null }));
      try {
        const info = await fetchSetSession(setId);
        const { entries, history } = transcriptToEntries(info.transcript ?? []);
        updateWorkspace(setId, (ws) => ({
          ...ws,
          initialized: true,
          loading: false,
          error: null,
          session: info,
          entries,
          commandHistory: history,
          progress: info.progress,
        }));
      } catch (err) {
        updateWorkspace(setId, (ws) => ({
          ...ws,
          loading: false,
          error: (err as Error).message || 'Connection failed',
        }));
      }
    },
    [updateWorkspace],
  );

  // Load Set 1 immediately, then pre-warm Sets 2..8 in the background for instant Ctrl+1..8 switching
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureSetLoaded(1);
      for (const id of SET_IDS) {
        if (cancelled) break;
        if (id !== 1) {
          await ensureSetLoaded(id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureSetLoaded]);

  useEffect(() => {
    void ensureSetLoaded(activeSetId);
  }, [activeSetId, ensureSetLoaded]);

  const handleResetSession = useCallback(
    async (targetSetId?: SetId) => {
      const setId = targetSetId ?? activeSetIdRef.current;
      setExecutingSetId(setId);
      try {
        const freshSession = await resetSet(setId);
        const { entries, history } = transcriptToEntries(
          freshSession.transcript ?? [],
        );
        updateWorkspace(setId, (ws) => ({
          ...ws,
          initialized: true,
          loading: false,
          error: null,
          session: freshSession,
          showBanner: true,
          entries,
          commandHistory: history,
          input: '',
          delimiter: ';',
          historyIndex: -1,
          replaySql: [],
          progress: freshSession.progress,
        }));
      } catch (err) {
        updateWorkspace(setId, (ws) => ({
          ...ws,
          error: (err as Error).message || 'Failed to reset session',
        }));
      } finally {
        setExecutingSetId(null);
      }
    },
    [updateWorkspace],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showStealthHelp) {
        e.preventDefault();
        setShowStealthHelp(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowStealthHelp((v) => !v);
        return;
      }

      if ((e.ctrlKey || e.metaKey || e.altKey) && !e.repeat) {
        const digit = digitFromKeyEvent(e);
        if (digit !== null) {
          e.preventDefault();
          e.stopPropagation();
          setActiveSetId(digit);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [showStealthHelp]);

  const handleInputChange = (val: string) => {
    updateWorkspace(activeSetId, (ws) => ({
      ...ws,
      input: val,
      historyIndex: -1,
    }));
  };

  const handleClearScreen = () => {
    updateWorkspace(activeSetId, (ws) => ({
      ...ws,
      showBanner: false,
      entries: [],
    }));
  };

  const handleCancelBuffer = () => {
    const ws = workspacesRef.current[activeSetId];
    const echo = buildEchoLines(ws.input, ws.delimiter, '^C');
    const entry: TranscriptEntry = {
      id: nextEntryId(),
      kind: 'client-output',
      echo,
      lines: [],
    };
    updateWorkspace(activeSetId, (prev) => ({
      ...prev,
      entries: [...prev.entries, entry],
      input: '',
      historyIndex: -1,
    }));
    setScrollTrigger((n) => n + 1);
  };

  const handleNavigateHistory = (dir: 'up' | 'down') => {
    updateWorkspace(activeSetId, (ws) => {
      const history = ws.commandHistory;
      if (history.length === 0) return ws;

      if (dir === 'up') {
        if (ws.historyIndex === -1) {
          const nextIdx = history.length - 1;
          return {
            ...ws,
            draftInput: ws.input,
            historyIndex: nextIdx,
            input: history[nextIdx],
          };
        }
        if (ws.historyIndex > 0) {
          const nextIdx = ws.historyIndex - 1;
          return {
            ...ws,
            historyIndex: nextIdx,
            input: history[nextIdx],
          };
        }
        return ws;
      } else {
        if (ws.historyIndex === -1) return ws;
        if (ws.historyIndex < history.length - 1) {
          const nextIdx = ws.historyIndex + 1;
          return {
            ...ws,
            historyIndex: nextIdx,
            input: history[nextIdx],
          };
        }
        return {
          ...ws,
          historyIndex: -1,
          input: ws.draftInput,
        };
      }
    });
  };

  const handleSubmitBuffer = async (forceTerminate = false) => {
    const setId = activeSetId;
    const ws = workspacesRef.current[setId];
    if (!ws.session || executingSetId !== null) return;

    const rawTrimmed = ws.input.trim();

    // Stealth terminal commands: `\1`..`\8` or `set 1`..`set 8` silently switch sets
    const stealthSetMatch = rawTrimmed.match(/^(?:\\([1-8])|set\s+([1-8])\s*;?)$/i);
    if (stealthSetMatch) {
      const target = Number(stealthSetMatch[1] ?? stealthSetMatch[2]);
      if (isSetId(target)) {
        updateWorkspace(setId, (prev) => ({ ...prev, input: '', historyIndex: -1 }));
        setActiveSetId(target);
        return;
      }
    }

    // Stealth reset command: `\r` resets and re-executes the current set
    if (/^\\r$/i.test(rawTrimmed)) {
      updateWorkspace(setId, (prev) => ({ ...prev, input: '', historyIndex: -1 }));
      await handleResetSession(setId);
      return;
    }

    let candidate = ws.input;
    if (forceTerminate && candidate.trim().length > 0) {
      const trimmed = candidate.trimEnd();
      if (
        !trimmed.endsWith(ws.delimiter) &&
        !trimmed.endsWith('\\g') &&
        !trimmed.endsWith('\\G')
      ) {
        candidate = trimmed + ws.delimiter;
      }
    }

    const split = splitInput(candidate + '\n', ws.delimiter);

    if (split.items.length === 0) {
      if (ws.input.trim().length === 0) {
        const emptyEntry: TranscriptEntry = {
          id: nextEntryId(),
          kind: 'client-output',
          echo: [{ prompt: 'mysql>', text: '' }],
          lines: [],
        };
        updateWorkspace(setId, (prev) => ({
          ...prev,
          entries: [...prev.entries, emptyEntry],
          input: '',
        }));
        setScrollTrigger((n) => n + 1);
        return;
      }
      updateWorkspace(setId, (prev) => ({
        ...prev,
        input: prev.input + '\n',
      }));
      setScrollTrigger((n) => n + 1);
      return;
    }

    const remainingInput = split.remainder.replace(/\n$/, '');
    let runningDelimiter = ws.delimiter;
    let runningSession = ws.session;
    let runningReplay = [...ws.replaySql];

    updateWorkspace(setId, (prev) => ({
      ...prev,
      input: remainingInput,
      delimiter: split.delimiter,
      historyIndex: -1,
    }));

    setExecutingSetId(setId);
    try {
      for (const item of split.items) {
        if (item.type === 'delimiter') {
          const echo: EchoLine[] = [
            { prompt: 'mysql>', text: `DELIMITER ${item.value}` },
          ];
          runningDelimiter = item.value;
          updateWorkspace(setId, (prev) => ({
            ...prev,
            delimiter: item.value,
            entries: [
              ...prev.entries,
              { id: nextEntryId(), kind: 'client-output', echo, lines: [] },
            ],
          }));
          continue;
        }

        if (item.type === 'clear-buffer') {
          const echo: EchoLine[] = [{ prompt: 'mysql>', text: '\\c' }];
          updateWorkspace(setId, (prev) => ({
            ...prev,
            entries: [
              ...prev.entries,
              { id: nextEntryId(), kind: 'client-output', echo, lines: [] },
            ],
          }));
          continue;
        }

        if (item.type === 'clear-screen') {
          updateWorkspace(setId, (prev) => ({
            ...prev,
            showBanner: false,
            entries: [],
          }));
          continue;
        }

        if (item.type === 'help') {
          const echo: EchoLine[] = [{ prompt: 'mysql>', text: 'help;' }];
          updateWorkspace(setId, (prev) => ({
            ...prev,
            commandHistory: [...prev.commandHistory, 'help;'],
            entries: [
              ...prev.entries,
              {
                id: nextEntryId(),
                kind: 'client-output',
                echo,
                lines: MYSQL_HELP_LINES,
              },
            ],
          }));
          continue;
        }

        if (item.type === 'quit') {
          const echo: EchoLine[] = [{ prompt: 'mysql>', text: 'exit;' }];
          updateWorkspace(setId, (prev) => ({
            ...prev,
            entries: [
              ...prev.entries,
              {
                id: nextEntryId(),
                kind: 'client-output',
                echo,
                lines: ['Bye'],
              },
            ],
          }));
          continue;
        }

        if (item.type === 'empty') {
          const echo: EchoLine[] = [{ prompt: 'mysql>', text: runningDelimiter }];
          updateWorkspace(setId, (prev) => ({
            ...prev,
            entries: [
              ...prev.entries,
              {
                id: nextEntryId(),
                kind: 'client-output',
                echo,
                lines: ['ERROR:', 'No query specified'],
              },
            ],
          }));
          continue;
        }

        const suffix = item.vertical ? '\\G' : runningDelimiter;
        const echo = buildEchoLines(item.sql, runningDelimiter, suffix);
        const historyText = `${item.sql}${suffix}`;

        const response = await executeSetSql(setId, {
          sql: item.sql,
          connectionId: runningSession.connectionId,
          currentDatabase: runningSession.database,
          replaySql: runningReplay,
        });

        if (response.ok) {
          runningReplay = [...runningReplay, item.sql];
        }

        if (response.ok || response.kind === 'mysql') {
          runningSession = {
            ...runningSession,
            database: response.database,
            connectionId: response.connectionId ?? runningSession.connectionId,
            progress: response.progress,
          };
        }

        const entry: TranscriptEntry = {
          id: nextEntryId(),
          kind: 'execution',
          echo,
          vertical: item.vertical,
          response,
        };

        updateWorkspace(setId, (prev) => ({
          ...prev,
          session: runningSession,
          progress:
            response.ok || response.kind === 'mysql'
              ? response.progress
              : prev.progress,
          replaySql: runningReplay,
          commandHistory: [...prev.commandHistory, historyText],
          entries: [...prev.entries, entry],
        }));
      }
    } catch (err) {
      const errEntry: TranscriptEntry = {
        id: nextEntryId(),
        kind: 'client-output',
        echo: [{ prompt: 'mysql>', text: candidate }],
        lines: [
          `ERROR 2013 (HY000): Lost connection to MySQL server during query (${(err as Error).message})`,
        ],
      };
      updateWorkspace(setId, (prev) => ({
        ...prev,
        entries: [...prev.entries, errEntry],
      }));
    } finally {
      setExecutingSetId(null);
      setScrollTrigger((n) => n + 1);
    }
  };

  const currentSet = getExamSet(activeSetId);
  const currentWorkspace = workspaces[activeSetId];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-[#cccccc]">
      <MysqlTerminal
        session={currentWorkspace.session}
        loadingSession={currentWorkspace.loading}
        sessionError={currentWorkspace.error}
        showBanner={currentWorkspace.showBanner}
        entries={currentWorkspace.entries}
        input={currentWorkspace.input}
        delimiter={currentWorkspace.delimiter}
        isExecuting={executingSetId === activeSetId}
        scrollTrigger={scrollTrigger}
        onInputChange={handleInputChange}
        onSubmitBuffer={(force) => void handleSubmitBuffer(force)}
        onCancelBuffer={handleCancelBuffer}
        onClearScreen={handleClearScreen}
        onNavigateHistory={handleNavigateHistory}
      />

      {/* Stealth monochrome overlay (only visible while toggled via Ctrl+/) */}
      {showStealthHelp && (
        <div className="fixed bottom-2 right-2 z-50 max-h-[70vh] w-96 overflow-y-auto border border-[#333333] bg-black p-3 font-mono text-xs text-[#cccccc]">
          <div className="flex items-center justify-between border-b border-[#222222] pb-1.5 mb-2">
            <span>
              Set {currentSet.id} ({currentSet.title})
            </span>
            <button
              type="button"
              onClick={() => setShowStealthHelp(false)}
              className="cursor-pointer text-[#888888] hover:text-[#cccccc]"
            >
              [Esc]
            </button>
          </div>
          <div className="space-y-1.5 mb-2 text-[11px] text-[#999999]">
            <div>Switch set: Ctrl+1..8 or Alt+1..8 or type \1..\8</div>
            <div>Reset set: type \r · Toggle this box: Ctrl+/</div>
          </div>
          <div className="space-y-1.5 border-t border-[#222222] pt-2">
            {currentSet.tasks.map((t) => (
              <div key={t.id} className="text-[11px]">
                <div>
                  ({t.id}) {t.question}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
