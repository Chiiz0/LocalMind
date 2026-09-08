import type { GraphQLService } from '@affine/core/modules/cloud';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { WorkbenchTask } from './types';
import { executeWorkbenchTaskAction } from './workbench-task-action';

const tokens = vi.hoisted(() => ({
  abandonBlocker: Symbol('abandonBlocker'),
  acceptInvitation: Symbol('acceptInvitation'),
  approveAccess: Symbol('approveAccess'),
  controlTask: Symbol('controlTask'),
  declineInvitation: Symbol('declineInvitation'),
  rejectAccess: Symbol('rejectAccess'),
  resolveBlocker: Symbol('resolveBlocker'),
  withdrawAccess: Symbol('withdrawAccess'),
  withdrawInvitation: Symbol('withdrawInvitation'),
}));

vi.mock('@affine/graphql', () => ({
  abandonCopilotBlockerMutation: tokens.abandonBlocker,
  acceptCopilotProjectInvitationMutation: tokens.acceptInvitation,
  approveCopilotAccessRequestMutation: tokens.approveAccess,
  controlCopilotTaskMutation: tokens.controlTask,
  declineCopilotProjectInvitationMutation: tokens.declineInvitation,
  rejectCopilotAccessRequestMutation: tokens.rejectAccess,
  resolveCopilotBlockerMutation: tokens.resolveBlocker,
  withdrawCopilotAccessRequestMutation: tokens.withdrawAccess,
  withdrawCopilotProjectInvitationMutation: tokens.withdrawInvitation,
}));

const gql = vi.fn();
const graphql = { gql } as unknown as GraphQLService;

const item = (overrides: Partial<WorkbenchTask> = {}): WorkbenchTask => ({
  projectName: 'Project',
  documentTitle: 'Document',
  relatedUserName: null,
  relatedUserEmail: null,
  id: 'access-request:request-1',
  entityId: 'request-1',
  kind: 'access_request',
  segment: 'todo',
  attention: 'needs_my_action',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  title: 'Request',
  status: 'pending',
  requestedLevel: 'read',
  documentId: 'doc-1',
  redacted: false,
  relatedUserId: 'user-1',
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
  completedAt: null,
  availableActions: ['approve_access_request'],
  blocker: null,
  projectTask: null,
  run: null,
  ...overrides,
});

describe('executeWorkbenchTaskAction', () => {
  beforeEach(() => {
    gql.mockReset();
    gql.mockResolvedValue({});
  });

  test('dispatches access requests through the dedicated state machine', async () => {
    await executeWorkbenchTaskAction(
      graphql,
      item(),
      'approve_access_request',
      {
        requestId: 'request-1',
        action: 'approve_access_request',
      }
    );

    expect(gql).toHaveBeenCalledWith({
      query: tokens.approveAccess,
      variables: { input: { requestId: 'request-1' } },
    });
  });

  test('rejects absent or mismatched decision confirmation without a mutation', async () => {
    for (const confirmation of [
      undefined,
      { requestId: 'other', action: 'approve_access_request' as const },
      { requestId: 'request-1', action: 'reject_access_request' as const },
    ]) {
      await expect(
        executeWorkbenchTaskAction(
          graphql,
          item(),
          'approve_access_request',
          confirmation
        )
      ).rejects.toThrow('human confirmation');
    }
    expect(gql).not.toHaveBeenCalled();
  });

  test('preserves the human rejection reason', async () => {
    await executeWorkbenchTaskAction(
      graphql,
      item({ availableActions: ['reject_access_request'] }),
      'reject_access_request',
      {
        requestId: 'request-1',
        action: 'reject_access_request',
        reason: 'This document must remain private.',
      }
    );
    expect(gql).toHaveBeenCalledWith({
      query: tokens.rejectAccess,
      variables: {
        input: {
          requestId: 'request-1',
          reason: 'This document must remain private.',
        },
      },
    });
  });

  test('uses the opaque run entity id instead of the projection id', async () => {
    await executeWorkbenchTaskAction(
      graphql,
      item({
        id: 'run:workspace-1:run-1',
        entityId: 'run-1',
        kind: 'run',
        availableActions: ['cancel'],
      }),
      'cancel'
    );

    expect(gql).toHaveBeenCalledWith({
      query: tokens.controlTask,
      variables: {
        input: {
          workspaceId: 'workspace-1',
          taskId: 'run-1',
          action: 'cancel',
        },
      },
    });
  });

  test('fails closed for a kind/action mismatch', async () => {
    await expect(
      executeWorkbenchTaskAction(
        graphql,
        item({ availableActions: ['accept_project_invitation'] }),
        'accept_project_invitation'
      )
    ).rejects.toThrow('does not match');
    expect(gql).not.toHaveBeenCalled();
  });

  test.each([
    ['resolve_blocker', tokens.resolveBlocker],
    ['abandon_blocker', tokens.abandonBlocker],
  ] as const)(
    'dispatches %s only through the blocker state machine',
    async (action, query) => {
      await executeWorkbenchTaskAction(
        graphql,
        item({
          id: 'blocker:blocker-1',
          entityId: 'blocker-1',
          kind: 'blocker',
          status: 'waiting',
          availableActions: [action],
          blocker: {
            creatorUserId: 'user-1',
            type: 'wait_reply',
            waitingOn: 'Vendor',
            dueAt: null,
            overdue: false,
            origin: 'user_created',
            resolutionActorUserId: null,
          },
        }),
        action
      );

      expect(gql).toHaveBeenCalledWith({
        query,
        variables: { blockerId: 'blocker-1' },
      });
    }
  );

  test('rejects actions removed by a fresher server projection', async () => {
    await expect(
      executeWorkbenchTaskAction(
        graphql,
        item({ availableActions: [] }),
        'approve_access_request'
      )
    ).rejects.toThrow('no longer available');
    expect(gql).not.toHaveBeenCalled();
  });
});
