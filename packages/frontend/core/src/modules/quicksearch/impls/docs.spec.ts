/* eslint-disable rxjs/finnish */
import { Framework, LiveData } from '@toeverything/infra';
import { of, throwError } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';

import { DocsQuickSearchSession } from './docs';

afterEach(() => vi.useRealTimers());

it('serializes load-more clicks, preserves results on failure and resets the next query', async () => {
  vi.useFakeTimers();
  let fail = false;
  const search = vi.fn((_query: string, _mode: string, limit: number) =>
    fail
      ? throwError(() => new Error('unavailable'))
      : of(
          Array.from({ length: Math.min(limit, 61) }, (_, i) => ({
            docId: String(i),
            score: 61 - i,
          }))
        )
  );
  const framework = new Framework();
  framework.entity(
    DocsQuickSearchSession,
    () =>
      new DocsQuickSearchSession(
        { workspace: { flavour: 'local' } } as never,
        {} as never,
        {
          indexerState$: new LiveData({ completed: true }),
          search$: search,
        } as never,
        { list: { doc$: (id: string) => new LiveData({ id }) } } as never,
        {
          getDocDisplayMeta: ({ id }: { id: string }) => ({
            title: id,
            icon: () => null,
            updatedDate: new Date(),
          }),
        } as never,
        { flags: { enable_battery_save_mode: { value: false } } } as never
      )
  );
  const session = framework.provider().createEntity(DocsQuickSearchSession);
  session.query('资料');
  await vi.advanceTimersByTimeAsync(550);
  expect(session.items$.value).toHaveLength(51);
  const more = session.items$.value.find(item => item.id === 'docs:load-more')!;
  fail = true;
  more.beforeSubmit?.();
  more.beforeSubmit?.();
  await vi.advanceTimersByTimeAsync(550);
  expect(search.mock.calls.map(call => call[2])).toEqual([51, 101]);
  expect(session.items$.value).toHaveLength(51);
  expect(session.error$.value).toBe('unavailable');
  fail = false;
  more.beforeSubmit?.();
  await vi.advanceTimersByTimeAsync(550);
  expect(search.mock.calls.map(call => call[2])).toEqual([51, 101, 101]);
  expect(session.items$.value).toHaveLength(61);
  session.query('另一份资料');
  await vi.advanceTimersByTimeAsync(550);
  expect(search.mock.calls.at(-1)?.[2]).toBe(51);
  session.dispose();
});
