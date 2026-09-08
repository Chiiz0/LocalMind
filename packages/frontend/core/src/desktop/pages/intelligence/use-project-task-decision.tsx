import { notify, useConfirmModal } from '@affine/component';
import { GraphQLService } from '@affine/core/modules/cloud';
import { reportProjectError } from '@affine/core/modules/project-resources/error';
import { projectTaskEditor } from '@affine/core/modules/project-resources/task-handoff';
import {
  decideProjectAgentTaskMutation,
  type ProjectAgentTaskFieldsFragment,
  projectOfficeArtifactQuery,
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
        const editor =
          action === 'approve' ? projectTaskEditor(graphql, task) : undefined;
        const preview = task.preview as Record<string, unknown> | null;
        if (action !== 'cancel') {
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
                  {action === 'approve' ? (
                    <p>
                      {editor
                        ? t[
                            'com.affine.localmind.project-tasks.handoffDescription'
                          ]()
                        : t[
                            'com.affine.localmind.project-tasks.approvalWaitDescription'
                          ]()}
                    </p>
                  ) : null}
                </div>
              ),
              confirmText: editor
                ? t[
                    editor.hasUnsavedChanges()
                      ? 'com.affine.localmind.project-tasks.saveAndReview'
                      : 'com.affine.localmind.project-tasks.approveAndHandoff'
                  ]()
                : t[
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
        if (action === 'approve') {
          // Saving changes invalidates the immutable AI preview; never approve it silently.
          if (editor && (await editor.save())) {
            notify.success({
              title:
                t['com.affine.localmind.project-tasks.savedNeedsPreview'](),
            });
            return false;
          }
          if (
            task.workflow === 'agent_runtime_project_office_command' &&
            typeof preview?.artifactId === 'string' &&
            typeof preview.expectedRevisionId === 'string'
          ) {
            const { projectOfficeArtifact } = await graphql.gql({
              query: projectOfficeArtifactQuery,
              variables: {
                projectId: task.projectId,
                artifactId: preview.artifactId,
              },
            });
            if (
              projectOfficeArtifact.currentRevision?.id !==
              preview.expectedRevisionId
            ) {
              notify.error({
                title:
                  t['com.affine.localmind.project-tasks.previewOutdated'](),
              });
              return false;
            }
          }
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
        const currentEditor =
          action === 'approve' ? projectTaskEditor(graphql, task) : undefined;
        if (currentEditor?.hasUnsavedChanges()) {
          notify.error({
            title: t['com.affine.localmind.project-tasks.previewOutdated'](),
          });
          return false;
        }
        const handedOff =
          currentEditor &&
          (await currentEditor.store.handoff(
            task.id,
            () => !currentEditor.hasUnsavedChanges()
          ));
        let result;
        try {
          ({ decideProjectAgentTask: result } = await graphql.gql({
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
          }));
        } finally {
          // Reconcile even after a lost response: approval may have reached the server.
          if (handedOff)
            await currentEditor.store
              .trackHandoff(task.id, !result)
              .catch(currentEditor.store.report);
        }
        keys.current.delete(identity);
        notify.success({
          title: result.applied
            ? t[
                action === 'approve'
                  ? 'com.affine.localmind.project-tasks.approvedQueued'
                  : 'com.affine.localmind.tasks.action.success'
              ]()
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
