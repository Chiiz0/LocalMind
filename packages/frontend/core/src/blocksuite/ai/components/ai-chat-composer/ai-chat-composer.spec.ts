/**
 * @vitest-environment happy-dom
 */
import { describe, expect, test, vi } from 'vitest';

import type { AIChatRuntime, AIChatSnapshot } from '../../runtime/chat';
import {
  hasActiveComposerContextOperation,
  initializeComposerContext,
  shouldShowContextProjectSelector,
} from './ai-chat-composer';

describe('AIChatComposer', () => {
  test('loads persisted document context without global user event state', async () => {
    const snapshot = {
      activeSessionId: 'session-1',
      composer: {
        context: {
          embeddingCompleted: true,
          items: [
            {
              kind: 'doc',
              docId: 'doc-1',
              state: 'finished',
            },
          ],
        },
      },
    } as unknown as AIChatSnapshot;
    const dispatch = vi.fn(async (_event: { type: string }) => {});
    const runtime = {
      dispatch,
      getSnapshot: () => snapshot,
    } as unknown as AIChatRuntime;
    const sync = vi.fn();
    const reset = vi.fn();

    await initializeComposerContext(
      runtime,
      'session-1',
      () => true,
      reset,
      sync
    );

    expect(dispatch.mock.calls.map(([event]) => event.type)).toEqual([
      'stopContextPolling',
      'loadContext',
      'startContextPolling',
      'pollEmbeddingStatus',
    ]);
    expect(reset).not.toHaveBeenCalled();
    expect(sync).toHaveBeenCalledTimes(2);
  });

  test('does not reload context while a new session context write is active', () => {
    const runtime = {
      getSnapshot: () =>
        ({
          activeSessionId: 'session-1',
          composer: {
            context: {
              loading: true,
            },
          },
        }) as AIChatSnapshot,
    } as unknown as AIChatRuntime;

    expect(hasActiveComposerContextOperation(runtime, 'session-1')).toBe(true);
    expect(hasActiveComposerContextOperation(runtime, 'session-2')).toBe(false);
  });

  test('keeps available projects selectable after clearing the selection', () => {
    const scope = (projectResolution: string, candidates: unknown[] = []) =>
      ({
        loading: false,
        error: null,
        selectedProjectId: null,
        projectResolution,
        candidates,
      }) as AIChatSnapshot['composer']['projectScope'];

    expect(shouldShowContextProjectSelector(scope('none'))).toBe(false);
    expect(
      shouldShowContextProjectSelector(
        scope('none', [{ id: 'project-1', name: 'One' }])
      )
    ).toBe(true);
    expect(shouldShowContextProjectSelector(scope('single'))).toBe(false);
    expect(
      shouldShowContextProjectSelector(
        scope('ambiguous', [{ id: 'project-1', name: 'One' }])
      )
    ).toBe(true);
    expect(shouldShowContextProjectSelector(scope('invalid_selection'))).toBe(
      true
    );
  });
});
