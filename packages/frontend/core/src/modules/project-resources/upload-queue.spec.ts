import { describe, expect, test, vi } from 'vitest';

import { ProjectUploadQueue } from './upload-queue';

describe('ProjectUploadQueue', () => {
  test('bounds overlapping drops and deduplicates an active retry', async () => {
    const finish: (() => void)[] = [];
    const execute = vi.fn(
      () => new Promise<void>(resolve => finish.push(resolve))
    );
    const queue = new ProjectUploadQueue(execute, vi.fn());
    queue.enqueue(['a', 'b', 'c', 'd'].map(requestKey => ({ requestKey })));
    queue.enqueue(['a', 'e'].map(requestKey => ({ requestKey })));
    expect(execute).toHaveBeenCalledTimes(3);
    finish[0]();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(4));
    finish[1]();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(5));
    queue.dispose();
    finish.forEach(resolve => resolve());
  });

  test('unmount aborts active uploads and never starts queued files', async () => {
    const finish: (() => void)[] = [];
    const signals: AbortSignal[] = [];
    const execute = vi.fn((_job, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<void>(resolve => finish.push(resolve));
    });
    const queue = new ProjectUploadQueue(execute, vi.fn());
    queue.enqueue(['a', 'b', 'c', 'd'].map(requestKey => ({ requestKey })));
    queue.dispose();
    expect(signals.every(signal => signal.aborted)).toBe(true);
    finish.forEach(resolve => resolve());
    await Promise.resolve();
    await Promise.resolve();
    queue.enqueue([{ requestKey: 'e' }]);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  test('a failed file releases its slot and can retry with the same request key', async () => {
    const error = new Error('upload failed');
    const execute = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const queue = new ProjectUploadQueue(execute, onError, 1);
    queue.enqueue([{ requestKey: 'a' }, { requestKey: 'b' }]);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenCalledWith({ requestKey: 'a' }, error);
    queue.enqueue([{ requestKey: 'a' }]);
    expect(execute).toHaveBeenCalledTimes(3);
    queue.dispose();
  });
});
