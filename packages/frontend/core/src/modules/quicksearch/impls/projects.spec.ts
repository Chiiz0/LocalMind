/**
 * @vitest-environment happy-dom
 */
import { notify } from '@affine/component';
import { copilotWorkbenchProjectsGetQuery } from '@affine/graphql';
import { Framework } from '@toeverything/infra';
import { afterEach, expect, test, vi } from 'vitest';

import { ProjectsQuickSearchSession } from './projects';

const sessions: ProjectsQuickSearchSession[] = [];
const fixture = (gql: ReturnType<typeof vi.fn>) => {
  const framework = new Framework();
  framework.entity(
    ProjectsQuickSearchSession,
    () =>
      new ProjectsQuickSearchSession({
        server: { scope: { get: () => ({ gql }) } },
      } as never)
  );
  const session = framework.provider().createEntity(ProjectsQuickSearchSession);
  sessions.push(session);
  return session;
};
afterEach(() => {
  sessions.splice(0).forEach(session => session.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('searches only listed projects, paginates resources and serializes repeated load-more', async () => {
  vi.useFakeTimers();
  const gql = vi.fn(async ({ query, variables }) =>
    query === copilotWorkbenchProjectsGetQuery
      ? {
          currentUser: {
            copilot: {
              contextProjects: [{ id: 'allowed', name: 'Budget project' }],
            },
          },
        }
      : {
          searchProjectResources: {
            items: [
              {
                id: variables.cursor ? 'second' : 'first',
                title: 'Budget resource',
                path: [{ title: 'Finance' }],
              },
            ],
            nextCursor: variables.cursor ? null : 'next',
          },
        }
  );
  const session = fixture(gql);
  session.query('Budget');
  await vi.advanceTimersByTimeAsync(250);
  expect(session.items$.value.map(item => item.payload)).toEqual([
    { projectId: 'allowed' },
    { projectId: 'allowed', resourceId: 'first' },
    { projectId: 'allowed' },
  ]);
  const more = session.items$.value.at(-1);
  more?.beforeSubmit?.();
  more?.beforeSubmit?.();
  await vi.advanceTimersByTimeAsync(0);
  expect(gql).toHaveBeenCalledTimes(3);
  expect(session.items$.value.map(item => item.payload.resourceId)).toEqual([
    undefined,
    'first',
    'second',
  ]);
  expect(
    gql.mock.calls
      .slice(1)
      .every(([request]) => request.variables.projectId === 'allowed')
  ).toBe(true);
});

test('query changes and disposal discard in-flight results and denied membership is reported', async () => {
  vi.useFakeTimers();
  const report = vi
    .spyOn(notify, 'error')
    .mockImplementation(() => 'test-notification');
  let finish: ((result: unknown) => void) | undefined;
  const gql = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    )
    .mockRejectedValueOnce(new Error('denied'));
  const session = fixture(gql);
  session.query('old');
  await vi.advanceTimersByTimeAsync(250);
  session.query('new');
  finish?.({
    currentUser: {
      copilot: { contextProjects: [{ id: 'stale', name: 'old' }] },
    },
  });
  await vi.advanceTimersByTimeAsync(250);
  expect(session.items$.value).toEqual([]);
  expect(report).toHaveBeenCalledOnce();
  session.query('cancelled');
  session.dispose();
  await vi.advanceTimersByTimeAsync(250);
  expect(gql).toHaveBeenCalledTimes(2);
});
