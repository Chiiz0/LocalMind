export type ProjectUploadJob = { requestKey: string };

/** One queue spans all drops and retries, including overlapping selections. */
export class ProjectUploadQueue<T extends ProjectUploadJob> {
  private readonly waiting = new Map<string, T>();
  private readonly active = new Map<string, AbortController>();
  private disposed = false;

  constructor(
    private readonly execute: (job: T, signal: AbortSignal) => Promise<void>,
    private readonly onError: (job: T, error: unknown) => void,
    private readonly concurrency = 3
  ) {}

  enqueue(jobs: T[]) {
    if (this.disposed) return;
    for (const job of jobs) {
      if (!this.active.has(job.requestKey))
        this.waiting.set(job.requestKey, job);
    }
    this.pump();
  }

  dispose() {
    this.disposed = true;
    this.waiting.clear();
    for (const controller of this.active.values()) controller.abort();
  }

  private pump() {
    while (!this.disposed && this.active.size < this.concurrency) {
      const job = this.waiting.values().next().value;
      if (!job) return;
      this.waiting.delete(job.requestKey);
      const controller = new AbortController();
      this.active.set(job.requestKey, controller);
      void this.execute(job, controller.signal)
        .catch(error => {
          if (!controller.signal.aborted) this.onError(job, error);
        })
        .finally(() => {
          this.active.delete(job.requestKey);
          this.pump();
        });
    }
  }
}
