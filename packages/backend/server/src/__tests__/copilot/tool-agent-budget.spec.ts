import test from 'ava';
import Sinon from 'sinon';

import {
  abortableToolAgentStream,
  ToolAgentBudget,
} from '../../plugins/copilot/mcp/tool-agent-budget';
import type { StreamObject } from '../../plugins/copilot/providers/types';

test.serial(
  'total budget spans multiple model and tool phases beyond 120 seconds',
  async t => {
    const clock = Sinon.useFakeTimers();
    const budget = new ToolAgentBudget({
      totalTimeoutMs: 300_000,
      modelTimeoutMs: 120_000,
      toolTimeoutMs: 60_000,
    });
    try {
      for (let i = 0; i < 2; i++) {
        await clock.tickAsync(90_000);
        budget.toolStarted('doc_read', String(i));
        await clock.tickAsync(10_000);
        budget.toolCompleted();
      }
      t.false(budget.controller.signal.aborted);
      t.is(budget.snapshot().elapsedMs, 200_000);
      await clock.tickAsync(100_000);
      t.is(budget.timeout, 'total');
      t.true(budget.controller.signal.aborted);
      budget.stop();
      t.deepEqual(
        budget.snapshot().stages.map(stage => stage.durationMs),
        [90_000, 10_000, 90_000, 10_000, 100_000]
      );
    } finally {
      budget.stop();
      clock.restore();
    }
  }
);

for (const phase of ['model', 'tool'] as const) {
  test.serial(
    `${phase} deadline interrupts an iterator that ignores abort`,
    async t => {
      const clock = Sinon.useFakeTimers();
      const budget = new ToolAgentBudget({
        totalTimeoutMs: 300_000,
        modelTimeoutMs: 120_000,
        toolTimeoutMs: 60_000,
      });
      try {
        if (phase === 'tool') budget.toolStarted('doc_update', 'write');
        const source =
          (async function* (): AsyncIterableIterator<StreamObject> {
            await new Promise(() => {});
            yield { type: 'text-delta', textDelta: 'late response' };
          })();
        const next = abortableToolAgentStream(
          source,
          budget.controller.signal
        ).next();
        await clock.tickAsync(phase === 'model' ? 120_000 : 60_000);
        t.true((await next).done);
        t.is(budget.timeout, phase);
        budget.stop();
        t.truthy(budget.snapshot().stages.at(-1)?.completedAt);
      } finally {
        budget.stop();
        clock.restore();
      }
    }
  );
}

test.serial(
  'cancellation is not misreported as timeout and clears timers',
  async t => {
    const clock = Sinon.useFakeTimers();
    const budget = new ToolAgentBudget({
      totalTimeoutMs: 300_000,
      modelTimeoutMs: 120_000,
      toolTimeoutMs: 60_000,
    });
    try {
      budget.controller.abort();
      budget.stop();
      await clock.tickAsync(300_000);
      t.is(budget.timeout, null);
      t.is(clock.countTimers(), 0);
    } finally {
      budget.stop();
      clock.restore();
    }
  }
);
