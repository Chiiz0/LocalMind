/**
 * @vitest-environment happy-dom
 */
import { render } from 'lit';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  type BlockerSuggestionConfirmation,
  StreamObjectSchema,
} from '../ai-chat-messages/type';
import {
  blockerSuggestionFromToolResult,
  ChatContentStreamObjects,
  officeToolResultView,
} from './stream-objects';

const blockerSuggestion = {
  aiSuggestionId: 'b3b94f5e-936d-4d0e-875a-a0475f612f80',
  confirmationProof: 'hidden-signed-confirmation-proof',
  projectId: 'project-1',
  title: '等待供应商提供最终交付文件'.repeat(12),
  type: 'wait_file',
  waitingOn: '供应商客户成功团队'.repeat(12),
  dueAt: '2026-09-05T17:00:00.000Z',
  origin: 'ai_suggested',
  confirmationRequired: true,
} as const;

const labels: BlockerSuggestionConfirmation['labels'] = {
  title: 'Suggested blocker',
  type: 'Type',
  waitingOn: 'Waiting on',
  dueAt: 'Due date',
  create: 'Create blocker',
  creating: 'Creating blocker...',
  created: 'Blocker created',
  failed: 'The blocker was not created. Try again.',
  typeNames: {
    wait_reply: 'Reply',
    wait_file: 'File',
    wait_decision: 'Decision',
    custom: 'Other',
  },
};

const renderBlockerSuggestion = async (
  confirmation?: BlockerSuggestionConfirmation
) => {
  const instance = Object.create(ChatContentStreamObjects.prototype) as
    | ChatContentStreamObjects
    | Record<string, unknown>;
  Object.defineProperties(instance, {
    answer: {
      configurable: true,
      writable: true,
      value: [
        {
          type: 'tool-result',
          toolCallId: 'tool-call-1',
          toolName: 'blocker_suggest',
          args: {},
          result: blockerSuggestion,
        },
      ],
    },
    blockerSuggestionConfirmation: {
      configurable: true,
      writable: true,
      value: confirmation,
    },
    pendingBlockerSuggestions: {
      configurable: true,
      writable: true,
      value: new Set<string>(),
    },
    confirmedBlockerSuggestions: {
      configurable: true,
      writable: true,
      value: new Set<string>(),
    },
    blockerSuggestionErrors: {
      configurable: true,
      writable: true,
      value: new Set<string>(),
    },
    width: {
      configurable: true,
      writable: true,
      value: undefined,
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const rerender = () => {
    render(
      (
        ChatContentStreamObjects.prototype as unknown as { render(): unknown }
      ).render.call(instance) as never,
      container
    );
  };
  rerender();
  return { container, instance, rerender };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('Office tool result presentation', () => {
  test('restored read validation errors without an isError flag never claim success', () => {
    expect(
      officeToolResultView('office_read', {
        message: 'selector JSON must match the required Office schema',
      })
    ).toEqual({ status: 'error', name: 'Office read failed' });
    expect(officeToolResultView('office_read', {})).toEqual({
      status: 'error',
      name: 'Office read failed',
    });
  });
  test('states that an approval request has not created a revision', () => {
    const view = officeToolResultView('office_command_request', {
      success: true,
      approvalRequired: true,
      taskId: 'task-1',
      commandCount: 1,
      previewSummary: { operation: 'office.document.text.format' },
    });

    expect(view.status).toBe('success');
    if (view.status !== 'success') return;
    expect(view.name).toBe('Office change awaiting approval');
    expect(view.results[0]?.title).toBe('Approval required');
    expect(view.results[0]?.content).toContain(
      'No Office revision has been created'
    );
    expect(view.results[0]?.content).not.toMatch(
      /completed|modification done/i
    );
  });

  test('renders bounded read and persisted batch evidence without completion claims', () => {
    const read = officeToolResultView('office_read', {
      revisionId: 'revision-4',
      sequence: 4,
      truncated: false,
    });
    expect(read).toEqual({
      status: 'success',
      kind: 'read',
      name: 'Read Revision 4',
      results: [
        {
          title: 'Revision 4',
          content:
            'Bounded native Office semantic state was read successfully.',
        },
      ],
    });

    const batch = officeToolResultView('office_command_batch_request', {
      success: true,
      approvalRequired: false,
      taskId: 'task-2',
      commandCount: 3,
      previewSummary: { operation: 'office.command.batch' },
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') return;
    expect(batch.name).toBe('Office change request saved');
    expect(batch.results[0]?.content).toContain(
      'Execution status is available from the persisted Office task'
    );
    expect(batch.results[1]?.content).toContain('Commands: 3');
  });

  test('preserves and renders native Office tool execution errors', () => {
    const parsed = StreamObjectSchema.parse({
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'office_read',
      args: { selector: '{"kind":"pdf","page_index":0}' },
      result: { message: 'selector validation failed' },
      isError: true,
    });
    expect(parsed.type).toBe('tool-result');
    if (parsed.type !== 'tool-result') return;
    expect(parsed.isError).toBe(true);
    expect(
      officeToolResultView(parsed.toolName, parsed.result, parsed.isError)
    ).toEqual({ status: 'error', name: 'Office read failed' });
  });
});

describe('Blocker suggestion confirmation', () => {
  test('accepts only the strict server payload and a UUID v4 suggestion id', () => {
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', blockerSuggestion)
    ).toEqual(blockerSuggestion);
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', {
        ...blockerSuggestion,
        aiSuggestionId: 'not-a-uuid',
      })
    ).toBeNull();
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', {
        ...blockerSuggestion,
        confirmationRequired: false,
      })
    ).toBeNull();
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', {
        ...blockerSuggestion,
        origin: 'user_created',
      })
    ).toBeNull();
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', {
        ...blockerSuggestion,
        confirmationProof: 'p'.repeat(4097),
      })
    ).toBeNull();
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', {
        ...blockerSuggestion,
        confirmationProof: undefined,
      })
    ).toBeNull();
    expect(
      blockerSuggestionFromToolResult('blocker_suggest', {
        ...blockerSuggestion,
        dueAt: '2'.repeat(129),
      })
    ).toBeNull();
    expect(
      blockerSuggestionFromToolResult(
        'blocker_suggest',
        blockerSuggestion,
        true
      )
    ).toBeNull();
  });

  test('keeps the generic tool-result behavior when no confirmation callback is supplied', async () => {
    const { container } = await renderBlockerSuggestion();

    expect(container.querySelector('.blocker-suggestion')).toBeNull();
    const generic = container.querySelector('tool-result-card') as
      | (HTMLElement & { name?: string })
      | null;
    expect(generic).not.toBeNull();
    expect(generic?.name).toBe('blocker_suggest tool result');
    expect(container.querySelector('button')).toBeNull();
  });

  test('requires a click, exposes loading, and suppresses duplicate confirmation', async () => {
    let finish: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const { container, rerender } = await renderBlockerSuggestion({
      onConfirm,
      labels,
    });
    const button = container.querySelector('button');

    expect(button).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(container.textContent).toContain(blockerSuggestion.title);
    expect(container.textContent).toContain(blockerSuggestion.waitingOn);
    expect(container.textContent).not.toContain(
      blockerSuggestion.aiSuggestionId
    );
    expect(container.textContent).not.toContain(
      blockerSuggestion.confirmationProof
    );
    expect(container.innerHTML).not.toContain(
      blockerSuggestion.confirmationProof
    );
    button?.click();
    button?.click();

    rerender();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(blockerSuggestion);
    expect(button?.disabled).toBe(true);
    expect(button?.textContent?.trim()).toBe(labels.creating);

    finish?.();
    await vi.waitFor(async () => {
      await Promise.resolve();
      rerender();
      expect(button?.textContent?.trim()).toBe(labels.created);
    });
    expect(button?.disabled).toBe(true);
  });

  test('retains suggestion content after failure and allows an explicit retry', async () => {
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(undefined);
    const { container, rerender } = await renderBlockerSuggestion({
      onConfirm,
      labels,
    });
    const button = container.querySelector('button');
    button?.click();

    await vi.waitFor(async () => {
      await Promise.resolve();
      rerender();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        labels.failed
      );
    });
    expect(container.textContent).toContain(blockerSuggestion.title);
    expect(button?.disabled).toBe(false);

    button?.click();
    await vi.waitFor(async () => {
      await Promise.resolve();
      rerender();
      expect(button?.textContent?.trim()).toBe(labels.created);
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
