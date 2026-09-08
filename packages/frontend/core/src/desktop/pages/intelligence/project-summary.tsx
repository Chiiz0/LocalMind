import { Button, IconButton, Loading, Modal, notify } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  projectErrorMessage,
  reportProjectError,
} from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  copilotContextMemoryCreateMutation,
  CopilotContextMemoryManualKindInput,
  CopilotContextMemoryScopeInput,
  projectSummariesQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { PageIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useRef, useState } from 'react';

import * as styles from './project-publications.css';

export function ProjectSummary({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const query = useQuery(open ? { query: projectSummariesQuery } : undefined, {
    suspense: false,
    shouldRetryOnError: false,
  });
  useProjectRefresh(projectId, 'list', () =>
    open ? query.mutate() : undefined
  );
  const create = async () => {
    if (!content.trim() || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      await graphql.gql({
        query: copilotContextMemoryCreateMutation,
        variables: {
          input: {
            projectId,
            scope: CopilotContextMemoryScopeInput.project,
            kind: CopilotContextMemoryManualKindInput.project_summary,
            content: content.trim(),
          },
        },
      });
      setContent('');
      notify.success({
        title: t['com.affine.localmind.tasks.action.success'](),
      });
      await query.mutate();
    } catch (caught) {
      reportProjectError(caught);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  const title = t['com.affine.localmind.aiContext.projectSummary']();
  return (
    <>
      <IconButton
        size="20"
        icon={<PageIcon />}
        aria-label={title}
        tooltip={title}
        onClick={() => setOpen(true)}
      />
      <Modal
        open={open}
        onOpenChange={value => {
          if (!pending) setOpen(value);
        }}
        title={title}
        width={520}
      >
        <div className={styles.form}>
          <strong>{projectName}</strong>
          {query.isLoading ? (
            <Loading size={20} />
          ) : query.error ? (
            <div role="alert">
              {projectErrorMessage(query.error)}
              <Button
                onClick={() => void query.mutate().catch(reportProjectError)}
              >
                {t['Retry']()}
              </Button>
            </div>
          ) : (
            <div className={styles.browser}>
              {query.data?.currentUser?.copilot?.contextMemories
                .filter(
                  item =>
                    item.projectId === projectId &&
                    item.kind === 'project_summary'
                )
                .map(item => (
                  <p
                    key={item.id}
                    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {item.content}
                  </p>
                ))}
            </div>
          )}
          <textarea
            aria-label={title}
            value={content}
            maxLength={8000}
            rows={6}
            disabled={pending}
            onChange={event => setContent(event.target.value)}
          />
          <div className={styles.footer}>
            <Button disabled={pending} onClick={() => setOpen(false)}>
              {t['Close']()}
            </Button>
            <Button
              variant="primary"
              disabled={pending || !content.trim()}
              loading={pending}
              onClick={() => void create()}
            >
              {t['Create']()}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
