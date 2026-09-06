import type { GraphQLService } from '@affine/core/modules/cloud';
import {
  abandonCopilotBlockerMutation,
  acceptCopilotProjectInvitationMutation,
  approveCopilotAccessRequestMutation,
  controlCopilotTaskMutation,
  declineCopilotProjectInvitationMutation,
  rejectCopilotAccessRequestMutation,
  reRequestCopilotProjectDocumentAccessMutation,
  resolveCopilotBlockerMutation,
  withdrawCopilotAccessRequestMutation,
  withdrawCopilotProjectInvitationMutation,
} from '@affine/graphql';

import type { WorkbenchPanelTaskAction, WorkbenchTask } from './types';

const runActions = new Set<WorkbenchPanelTaskAction>([
  'approve',
  'reject',
  'cancel',
  'resume',
  'abandon',
]);

export type AccessRequestConfirmation = {
  requestId: string;
  action: 'approve_access_request' | 'reject_access_request';
  reason?: string;
};

export async function executeWorkbenchTaskAction(
  graphqlService: GraphQLService,
  task: WorkbenchTask,
  action: WorkbenchPanelTaskAction,
  confirmation?: AccessRequestConfirmation | null
) {
  if (!task.availableActions.includes(action)) {
    throw new Error('Task action is no longer available');
  }
  if (task.kind === 'run' && runActions.has(action)) {
    if (!task.workspaceId) throw new Error('Task workspace is missing');
    await graphqlService.gql({
      query: controlCopilotTaskMutation,
      variables: {
        input: {
          workspaceId: task.workspaceId,
          taskId: task.entityId,
          action: action as
            | 'approve'
            | 'reject'
            | 'cancel'
            | 'resume'
            | 'abandon',
          ...(action === 'approve' && task.run?.approvalFingerprint
            ? { expectedApprovalFingerprint: task.run.approvalFingerprint }
            : {}),
        },
      },
    });
    return;
  }
  if (task.kind === 'access_request') {
    const requiresConfirmation =
      action === 'approve_access_request' || action === 'reject_access_request';
    if (
      requiresConfirmation &&
      (confirmation?.requestId !== task.entityId ||
        confirmation.action !== action)
    ) {
      throw new Error('Access request decisions require human confirmation');
    }
    const query =
      action === 'approve_access_request'
        ? approveCopilotAccessRequestMutation
        : action === 'reject_access_request'
          ? rejectCopilotAccessRequestMutation
          : action === 'withdraw_access_request'
            ? withdrawCopilotAccessRequestMutation
            : null;
    if (query) {
      await graphqlService.gql({
        query,
        variables: {
          input: {
            requestId: task.entityId,
            ...(action === 'reject_access_request' && confirmation?.reason
              ? { reason: confirmation.reason }
              : {}),
          },
        },
      });
      return;
    }
  }
  if (task.kind === 'project_invitation') {
    const query =
      action === 'accept_project_invitation'
        ? acceptCopilotProjectInvitationMutation
        : action === 'decline_project_invitation'
          ? declineCopilotProjectInvitationMutation
          : action === 'withdraw_project_invitation'
            ? withdrawCopilotProjectInvitationMutation
            : null;
    if (query) {
      await graphqlService.gql({
        query,
        variables: { invitationId: task.entityId },
      });
      return;
    }
  }
  if (task.kind === 'project_grant' && action === 'request_project_access') {
    await graphqlService.gql({
      query: reRequestCopilotProjectDocumentAccessMutation,
      variables: { input: { grantId: task.entityId } },
    });
    return;
  }
  if (task.kind === 'blocker') {
    const query =
      action === 'resolve_blocker'
        ? resolveCopilotBlockerMutation
        : action === 'abandon_blocker'
          ? abandonCopilotBlockerMutation
          : null;
    if (query) {
      await graphqlService.gql({
        query,
        variables: { blockerId: task.entityId },
      });
      return;
    }
  }
  throw new Error('Task action does not match its entity kind');
}
