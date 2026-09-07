import { Button, IconButton, Loading } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { ServerService } from '@affine/core/modules/cloud';
import { downloadOfficePackage } from '@affine/core/modules/office';
import {
  ProjectResourceKind,
  projectResourcePathQuery,
  projectResourceQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { CloseIcon, DownloadIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useState } from 'react';

import { ProjectDocument } from './project-document';
import * as styles from './project-files.css';
import { ProjectOffice } from './project-office';
import { ProjectPublicationActions } from './project-publications';
import { ProjectSourceRefresh } from './project-source-refresh';

export function ProjectResourcePreview({
  projectId,
  resourceId,
  onClose,
  onOpenResource,
}: {
  projectId: string;
  resourceId: string;
  onClose: () => void;
  onOpenResource: (resourceId: string) => void;
}) {
  const t = useI18n();
  const server = useService(ServerService).server;
  const query = useQuery(
    { query: projectResourceQuery, variables: { projectId, resourceId } },
    { suspense: false, shouldRetryOnError: false, refreshInterval: 10000 }
  );
  const path = useQuery(
    { query: projectResourcePathQuery, variables: { projectId, resourceId } },
    { suspense: false, shouldRetryOnError: false, refreshInterval: 10000 }
  );
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const resource = query.data?.projectResource;
  const queryError = query.error ?? path.error;
  return (
    <section
      className={styles.preview}
      aria-label={
        resource?.title ?? t['com.affine.localmind.project-files.title']()
      }
    >
      <header className={styles.toolbar}>
        <h2
          className={styles.heading}
          title={path.data?.projectResourcePath
            .map(item => item.title)
            .join(' / ')}
        >
          {queryError
            ? t['com.affine.localmind.project-files.title']()
            : resource?.title}
        </h2>
        {resource && !queryError ? (
          <ProjectPublicationActions
            key={`publication:${projectId}:${resourceId}`}
            projectId={projectId}
            resourceId={resourceId}
          />
        ) : null}
        {resource && !queryError ? (
          <ProjectSourceRefresh
            key={`source:${projectId}:${resourceId}`}
            projectId={projectId}
            resourceId={resourceId}
            onRefreshed={() => {
              setRefreshVersion(value => value + 1);
              void query.mutate().catch(console.error);
            }}
          />
        ) : null}
        <IconButton
          size="20"
          icon={<CloseIcon />}
          tooltip={t['com.affine.localmind.project-files.close']()}
          aria-label={t['com.affine.localmind.project-files.close']()}
          onClick={onClose}
        />
      </header>
      {query.isLoading ? (
        <div className={styles.state}>
          <Loading size={24} />
        </div>
      ) : queryError || !resource ? (
        <div className={styles.state} role="alert">
          <span>
            {queryError?.message ??
              t['com.affine.localmind.project-files.empty']()}
          </span>
          <Button
            onClick={() => {
              query.mutate().catch(console.error);
              path.mutate().catch(console.error);
            }}
          >
            {t['com.affine.localmind.project-files.retry']()}
          </Button>
        </div>
      ) : resource.officeArtifactId ? (
        <ProjectOffice
          key={`${resourceId}:${refreshVersion}`}
          projectId={projectId}
          artifactId={resource.officeArtifactId}
          onOpenResource={onOpenResource}
        />
      ) : resource.kind === ProjectResourceKind.page ||
        resource.kind === ProjectResourceKind.edgeless ? (
        <ProjectDocument
          key={`${resourceId}:${refreshVersion}`}
          projectId={projectId}
          resourceId={resourceId}
          title={resource.title}
          mode={
            resource.kind === ProjectResourceKind.edgeless ? 'edgeless' : 'page'
          }
        />
      ) : (
        <div className={styles.state}>
          <Button
            prefix={<DownloadIcon />}
            loading={downloading}
            disabled={downloading}
            onClick={() => {
              setDownloading(true);
              setError(null);
              const url = new URL(
                `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(resourceId)}`,
                server.serverMetadata.baseUrl
              );
              void downloadOfficePackage(url.toString(), resource.title)
                .catch(caught =>
                  setError(
                    caught instanceof Error ? caught.message : String(caught)
                  )
                )
                .finally(() => setDownloading(false));
            }}
          >
            {t['com.affine.localmind.project-files.download']()}
          </Button>
          {error ? <span role="alert">{error}</span> : null}
        </div>
      )}
    </section>
  );
}
