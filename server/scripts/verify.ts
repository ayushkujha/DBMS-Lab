/**
 * End-to-end verification suite for all 8 DBMS Lab External sets.
 *
 * Verifies:
 *  1. Default pre-executed bootstrap: opening any set 1..8 automatically
 *     executes all CREATE TABLE, INSERT, and (c)..(f) statements and returns
 *     their complete MySQL transcript.
 *  2. Step-by-step execution, ASCII table formatting, error codes, session
 *     isolation, and reset behaviour on both Real MySQL 8.0 and the Vercel
 *     Serverless Fallback Engine.
 */
import assert from 'node:assert/strict';
import { provision } from '../src/db';
import { executeStatement, getSessionInfo, resetSetSession } from '../src/sessions';
import {
  executeEmbeddedStatement,
  getEmbeddedSessionInfo,
  resetEmbeddedSession,
} from '../src/embeddedMysql';
import { EXAM_SETS } from '../../shared/sets';
import { splitStatements } from '../../shared/splitter';
import { formatTable, mysqlErrorLine, okSummary, resultSetSummary } from '../../shared/format';
import { SET_IDS, TASK_IDS, type ExecuteResponse, type SetId } from '../../shared/types';

async function verifyEngine(
  label: string,
  fns: {
    getSession: (
      setId: SetId,
      opts?: { autoExecuteAll?: boolean },
    ) => Promise<Awaited<ReturnType<typeof getSessionInfo>>>;
    resetSession: (
      setId: SetId,
      opts?: { autoExecuteAll?: boolean },
    ) => Promise<Awaited<ReturnType<typeof resetSetSession>>>;
    execute: (setId: SetId, sql: string) => Promise<ExecuteResponse>;
  },
) {
  console.log(`\n=== Verifying engine: ${label} ===`);

  assert.equal(EXAM_SETS.length, 8, 'Must have exactly 8 examination sets');

  // 1. Verify pre-executed bootstrap mode (default on page load)
  for (const set of EXAM_SETS) {
    const setId = set.id;
    const expectedCount = set.tasks.reduce(
      (sum, t) => sum + splitStatements(t.solution).length,
      0,
    );
    const bootstrapped = await fns.resetSession(setId, { autoExecuteAll: true });
    assert.equal(bootstrapped.setId, setId);
    assert.equal(bootstrapped.database, `dbms_set_${setId}`);
    assert.equal(
      bootstrapped.transcript.length,
      expectedCount,
      `Set ${setId} bootstrap transcript should contain all ${expectedCount} executed statements`,
    );
    for (const item of bootstrapped.transcript) {
      assert.equal(
        item.response.ok,
        true,
        `Set ${setId} pre-executed statement failed: ${item.sql}`,
      );
    }
    for (const tid of TASK_IDS) {
      assert.equal(
        bootstrapped.progress[tid],
        true,
        `Set ${setId} task (${tid}) must be pre-executed on bootstrap`,
      );
    }
    console.log(
      `  [✓] Set ${String(setId).padStart(2, '0')} (${set.title}) — all ${expectedCount} statements pre-executed in transcript`,
    );
  }

  // 2. Verify step-by-step execution, isolation, and error handling
  for (const set of EXAM_SETS) {
    const setId = set.id;
    const init = await fns.resetSession(setId, { autoExecuteAll: false });
    assert.equal(init.setId, setId);

    const errRes = await fns.execute(setId, 'SELECT * FROM UnknownTable');
    assert.equal(errRes.ok, false);
    if (!errRes.ok && errRes.kind === 'mysql') {
      assert.equal(errRes.errno, 1146);
      assert.equal(errRes.sqlState, '42S02');
      const errLine = mysqlErrorLine(errRes.errno, errRes.sqlState, errRes.message);
      assert.match(errLine, /ERROR 1146 \(42S02\): Table 'dbms_set_\d+\.unknowntable' doesn't exist/i);
    } else {
      assert.fail('Expected a MySQL 1146 error for UnknownTable');
    }

    for (const task of set.tasks) {
      const statements = splitStatements(task.solution);
      for (const sql of statements) {
        const res = await fns.execute(setId, sql);
        if (!res.ok) {
          throw new Error(
            `[${label}] Set ${setId} (${task.id}) failed on SQL:\n${sql}\nError: ${JSON.stringify(res)}`,
          );
        }
        for (const r of res.results) {
          if (r.kind === 'resultset') {
            const lines = formatTable(r.columns, r.rows);
            const summary = resultSetSummary(r.totalRows, res.warnings, res.elapsedMs);
            if (r.rows.length > 0) assert.ok(lines.length >= 4);
            assert.match(summary, /in set|Empty set/);
          } else {
            const summary = okSummary(r.affectedRows, res.warnings, res.elapsedMs);
            assert.match(summary, /^Query OK, \d+ rows? affected/);
          }
        }
      }
    }
  }

  // Cross-database isolation check: Set 1 cannot access dbms_set_2
  const crossDb = await fns.execute(1, 'SELECT * FROM dbms_set_2.Students');
  assert.equal(crossDb.ok, false);
  if (!crossDb.ok && crossDb.kind === 'mysql') {
    assert.equal(crossDb.errno, 1044, 'Cross-set access must return ERROR 1044 Access denied');
  }

  // Leave all 8 sets in their pre-executed bootstrapped state ready for immediate viewing
  for (const id of SET_IDS) {
    await fns.resetSession(id, { autoExecuteAll: true });
  }
  console.log(`  [✓] Isolation, cross-DB guard, error formatting, and pre-execution verified on ${label}`);
}

async function main() {
  const version = await provision();
  console.log(`Connected to real MySQL server version: ${version}`);

  await verifyEngine(`Real MySQL ${version}`, {
    getSession: (id, opts) => getSessionInfo(id, opts),
    resetSession: (id, opts) => resetSetSession(id, opts),
    execute: (id, sql) => executeStatement(id, { sql }),
  });

  await verifyEngine('Embedded Serverless MySQL 8.0 Fallback Engine', {
    getSession: (id, opts) => getEmbeddedSessionInfo(id, 'verify', opts),
    resetSession: (id, opts) => resetEmbeddedSession(id, 'verify', opts),
    execute: (id, sql) => executeEmbeddedStatement(id, { sql }, 'verify'),
  });

  console.log('\nALL ACCEPTANCE CHECKS PASSED.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
