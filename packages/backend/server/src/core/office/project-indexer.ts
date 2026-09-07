import { Injectable, Logger } from '@nestjs/common';

import { JOB_SIGNAL, JobQueue, OnJob } from '../../base';
import { Models } from '../../models';
import { parseYDocToMarkdown } from '../../native';
import { ProjectResourceService } from '../project';
import { OfficeArtifactService } from './artifact-service';
import {
  OFFICE_FORMATS,
  officePackageSearchText,
  readNativeOfficeState,
} from './formats';

declare global {
  interface Jobs {
    'indexer.projectResources.index': { afterId?: string };
  }
}

@Injectable()
export class ProjectResourceIndexer {
  private readonly logger = new Logger(ProjectResourceIndexer.name);
  constructor(
    private readonly models: Models,
    private readonly resources: ProjectResourceService,
    private readonly artifacts: OfficeArtifactService,
    private readonly jobs: JobQueue
  ) {}

  @OnJob('indexer.projectResources.index')
  async run(input: Jobs['indexer.projectResources.index']) {
    const rows = await this.models.projectResource.pendingSearchIndex(
      input.afterId
    );
    for (const row of rows) {
      const scope = {
        projectId: row.projectId,
        actorId: row.actorId,
        resourceId: row.id,
      };
      try {
        const resource = await this.models.projectResource.get(scope);
        if (row.officeArtifactId) {
          const artifact = await this.artifacts.get(
            { projectId: row.projectId },
            row.actorId,
            row.officeArtifactId
          );
          const asset = await this.artifacts.readRevisionAsset(
            { projectId: row.projectId },
            row.actorId,
            row.officeArtifactId,
            artifact.revision.id,
            'package'
          );
          const format = Object.values(OFFICE_FORMATS).find(
            format => format.kind === artifact.artifact.kind
          );
          if (!format) throw new Error('Unsupported Project Office kind');
          const state = await readNativeOfficeState(format, asset.bytes);
          await this.models.projectResource.updateSearchText({
            ...scope,
            sequence: asset.revision.sequence,
            text: await officePackageSearchText(state, asset.bytes),
          });
        } else if (resource.kind === 'page' || resource.kind === 'edgeless') {
          const document = await this.resources.readDocument(scope);
          await this.models.projectResource.updateSearchText({
            ...scope,
            sequence: document.revision.sequence,
            text: parseYDocToMarkdown(
              document.bytes,
              resource.id,
              true
            ).markdown.slice(0, 250000),
          });
        } else {
          await this.models.projectResource.updateSearchText({
            ...scope,
            sequence: resource.contentVersion,
            text: '',
          });
        }
      } catch {
        // Stale versions remain pending; a later bounded scan can retry them.
        this.logger.warn('Project resource indexing deferred', {
          projectId: row.projectId,
          resourceId: row.id,
        });
      }
    }
    const last = rows.at(-1);
    if (rows.length === 20 && last)
      await this.jobs.add('indexer.projectResources.index', {
        afterId: last.id,
      });
    return JOB_SIGNAL.Done;
  }
}
