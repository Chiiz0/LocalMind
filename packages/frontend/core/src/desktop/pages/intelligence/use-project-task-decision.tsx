import { notify, useConfirmModal } from '@affine/component';
import { GraphQLService } from '@affine/core/modules/cloud';
import { reportProjectError } from '@affine/core/modules/project-resources/error';
import {
  decideProjectAgentTaskMutation,
  type ProjectAgentTaskFieldsFragment,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useRef } from 'react';

export function useProjectTaskDecision() {
  const graphql = useService(GraphQLService);
  const t = useI18n();
  const { openConfirmModal } = useConfirmModal();
  const pending = useRef(new Set<string>());
  const keys = useRef(new Map<string, string>());
  return useCallback(
    async (
      task: ProjectAgentTaskFieldsFragment,
      action: 'approve' | 'reject' | 'cancel'
    ) => {
      if (pending.current.has(task.id)) return false;
      pending.current.add(task.id);
      try {
        if (action !== 'cancel') {
          const preview = task.preview as Record<string, unknown> | null;
          const confirmed = await new Promise<boolean>(resolve => {
            openConfirmModal({
              title:
                t[
                  action === 'approve'
                    ? 'com.affine.localmind.project-tasks.approve'
                    : 'com.affine.localmind.project-tasks.reject'
                ](),
              description: task.title,
              children: (
                <div>
                  {typeof preview?.artifactTitle === 'string' ? (
                    <p>{preview.artifactTitle}</p>
                  ) : null}
                  {typeof preview?.commandCount === 'number' ? (
                    <p>
                      {t['com.affine.localmind.project-tasks.commands']({
                        count: String(preview.commandCount),
                      })}
                    </p>
                  ) : null}
                </div>
              ),
              confirmText:
                t[
                  action === 'approve'
                    ? 'com.affine.localmind.project-tasks.approve'
                    : 'com.affine.localmind.project-tasks.reject'
                ](),
              cancelText: t['Cancel'](),
              autoFocusConfirm: false,
              confirmButtonOptions: {
                variant: action === 'approve' ? 'primary' : 'error',
              },
              onConfirm: () => resolve(true),
              onCancel: () => resolve(false),
              onOpenChange: open => {
                if (!open) resolve(false);
              },
            });
          });
          if (!confirmed) return false;
        }
        const identity = JSON.stringify([
          task.id,
          task.status,
          task.updatedAt,
          action,
        ]);
        let requestKey = keys.current.get(identity);
        if (!requestKey) {
          requestKey = crypto.randomUUID();
          keys.current.set(identity, requestKey);
        }
        const { decideProjectAgentTask: result } = await graphql.gql({
          query: decideProjectAgentTaskMutation,
          variables: {
            input: {
              projectId: task.projectId,
              runId: task.id,
              targetFingerprint: task.targetFingerprint,
              expectedStatus: task.status,
              action,
              requestKey,
            },
          },
        });
        keys.current.delete(identity);
        notify.success({
          title: result.applied
            ? t['com.affine.localmind.tasks.action.success']()
            : t['com.affine.localmind.project-tasks.alreadyProcessed']({
                name: result.processedByName,
              }),
        });
        return true;
      } catch (caught) {
        reportProjectError(caught);
        return false;
      } finally {
        pending.current.delete(task.id);
      }
    },
    [graphql, openConfirmModal, t]
  );
}
