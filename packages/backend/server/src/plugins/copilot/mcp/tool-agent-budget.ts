import type { StreamObject } from '../providers/types';

type Stage = {
  phase: 'model' | 'tool';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  toolName?: string;
  toolCallId?: string;
};

/** Execution-local clocks; durable snapshots are written by the leased worker. */
export class ToolAgentBudget {
  readonly controller = new AbortController();
  readonly startedAt = Date.now();
  readonly stages: Stage[] = [];
  timeout: 'total' | 'model' | 'tool' | null = null;
  private readonly totalTimer: ReturnType<typeof setTimeout>;
  private stageTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly limits: {
      totalTimeoutMs: number;
      modelTimeoutMs: number;
      toolTimeoutMs: number;
    }
  ) {
    this.totalTimer = setTimeout(
      () => this.expire('total'),
      limits.totalTimeoutMs
    );
    this.start('model');
  }

  private expire(phase: 'total' | 'model' | 'tool') {
    if (this.controller.signal.aborted) return;
    this.timeout = phase;
    this.controller.abort();
  }

  private finishStage() {
    clearTimeout(this.stageTimer);
    const stage = this.stages.at(-1);
    if (!stage || stage.completedAt) return;
    stage.completedAt = new Date().toISOString();
    stage.durationMs = Math.max(0, Date.now() - Date.parse(stage.startedAt));
  }

  private start(
    phase: Stage['phase'],
    tool?: { toolName: string; toolCallId: string }
  ) {
    this.finishStage();
    if (this.controller.signal.aborted) return;
    // The executor has a hard limit of 20 tools; keep diagnostics bounded too.
    if (this.stages.length < 61) {
      this.stages.push({ phase, startedAt: new Date().toISOString(), ...tool });
    }
    this.stageTimer = setTimeout(
      () => this.expire(phase),
      phase === 'model' ? this.limits.modelTimeoutMs : this.limits.toolTimeoutMs
    );
  }

  toolStarted(toolName: string, toolCallId: string) {
    this.start('tool', { toolName, toolCallId });
  }

  toolCompleted() {
    this.start('model');
  }

  snapshot() {
    return {
      totalTimeoutMs: this.limits.totalTimeoutMs,
      modelTimeoutMs: this.limits.modelTimeoutMs,
      toolTimeoutMs: this.limits.toolTimeoutMs,
      startedAt: new Date(this.startedAt).toISOString(),
      elapsedMs: Math.max(0, Date.now() - this.startedAt),
      timeoutPhase: this.timeout,
      stages: this.stages.map(stage => ({ ...stage })),
    };
  }

  stop() {
    clearTimeout(this.totalTimer);
    this.finishStage();
  }
}

/** Bound iterator waits even when a provider ignores abort or closes normally. */
export async function* abortableToolAgentStream(
  stream: AsyncIterableIterator<StreamObject>,
  signal: AbortSignal
) {
  let abort: () => void = () => {};
  const aborted = new Promise<null>(resolve => {
    abort = () => resolve(null);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    while (!signal.aborted) {
      const next = await Promise.race([stream.next(), aborted]);
      if (!next || next.done) return;
      yield next.value;
    }
  } finally {
    signal.removeEventListener('abort', abort);
    // A non-cooperative iterator's return may itself wait on the stuck next().
    void stream.return?.().catch(() => {});
  }
}
