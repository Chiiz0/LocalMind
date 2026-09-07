import { parseOfficeCommand } from '@localmind/office';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { OfficeArtifact, OfficeRevision } from '@prisma/client';
import { SafeIntResolver } from 'graphql-scalars';

import { BadRequest, Throttle, URLHelper } from '../../base';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { OfficeArtifactService } from './artifact-service';
import { OfficeCommandService } from './command-service';
import { OfficeImportService } from './import-service';
import {
  ImportProjectOfficeInput,
  ProjectOfficeArtifactType,
  ProjectOfficeCommandInput,
  ProjectOfficeCompareType,
  ProjectOfficeResultType,
  ProjectOfficeRevisionType,
} from './project-types';
import { OfficeCommandPreviewType } from './types';

@Resolver()
export class ProjectOfficeResolver {
  constructor(
    private readonly artifacts: OfficeArtifactService,
    private readonly imports: OfficeImportService,
    private readonly commands: OfficeCommandService,
    private readonly url: URLHelper
  ) {}

  @Query(() => ProjectOfficeArtifactType)
  async projectOfficeArtifact(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('artifactId') artifactId: string
  ) {
    return this.artifact(
      await this.artifacts.get({ projectId }, user.id, artifactId)
    );
  }

  @Query(() => [ProjectOfficeRevisionType])
  async projectOfficeRevisions(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('artifactId') artifactId: string,
    @Args('limit', {
      type: () => SafeIntResolver,
      nullable: true,
      defaultValue: 50,
    })
    limit?: number
  ) {
    return (
      await this.artifacts.listRevisions(
        { projectId },
        user.id,
        artifactId,
        limit
      )
    ).map(revision => this.revision(revision));
  }

  @Query(() => ProjectOfficeCompareType)
  async projectOfficeRevisionCompare(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('artifactId') artifactId: string,
    @Args('beforeRevisionId') beforeRevisionId: string,
    @Args('afterRevisionId') afterRevisionId: string
  ) {
    const result = await this.artifacts.compareRevisions(
      { projectId },
      user.id,
      artifactId,
      beforeRevisionId,
      afterRevisionId
    );
    return {
      artifactId,
      kind: result.artifact.kind,
      beforeRevision: this.revision(result.beforeRevision),
      afterRevision: this.revision(result.afterRevision),
      changed: result.diff.changed,
      truncated: result.diff.truncated,
      summary: result.diff.summary,
      changes: result.diff.changes,
    };
  }

  @Mutation(() => ProjectOfficeResultType)
  @Throttle('strict')
  async importProjectOffice(
    @CurrentUser() user: User,
    @Args('input') input: ImportProjectOfficeInput
  ) {
    const result = await this.imports.import({
      ...input,
      actorId: user.id,
      importIdempotencyKey: input.idempotencyKey,
    });
    return {
      created: result.created,
      artifact: this.artifact(result),
      revision: this.revision(result.revision),
      summary: result.stats,
    };
  }

  @Query(() => OfficeCommandPreviewType)
  async previewProjectOfficeCommand(
    @CurrentUser() user: User,
    @Args('input') input: ProjectOfficeCommandInput
  ) {
    const command = this.userCommand(input.command);
    const result = await this.commands.preview({
      projectId: input.projectId,
      actorId: user.id,
      command,
    });
    return {
      ...result,
      artifactId: result.artifact.id,
      expectedRevisionId: result.revision.id,
    };
  }

  @Mutation(() => ProjectOfficeResultType)
  @Throttle('strict')
  async executeProjectOfficeCommand(
    @CurrentUser() user: User,
    @Args('input') input: ProjectOfficeCommandInput
  ) {
    const command = this.userCommand(input.command);
    const result = await this.commands.execute({
      projectId: input.projectId,
      actorId: user.id,
      command,
    });
    return {
      created: result.created,
      artifact: this.artifact(
        await this.artifacts.get(
          { projectId: input.projectId },
          user.id,
          command.artifactId
        )
      ),
      revision: this.revision(result.revision),
      summary: result.summary,
    };
  }

  private userCommand(input: unknown) {
    const command = parseOfficeCommand(input);
    if (command.source !== 'user')
      throw new BadRequest('Interactive Office commands must use source=user');
    return command;
  }

  private artifact(record: {
    artifact: OfficeArtifact;
    revision: OfficeRevision;
  }): ProjectOfficeArtifactType {
    const {
      projectId,
      workspaceId: _workspaceId,
      ...artifact
    } = record.artifact;
    if (!projectId || _workspaceId)
      throw new BadRequest('Project Office ownership does not match');
    return {
      ...artifact,
      projectId,
      compatibility: artifact.compatibility as Record<string, unknown>,
      currentRevision: this.revision(record.revision),
    };
  }

  private revision(revision: OfficeRevision): ProjectOfficeRevisionType {
    const { projectId, workspaceId: _workspaceId, ...fields } = revision;
    if (!projectId || _workspaceId)
      throw new BadRequest('Project Office ownership does not match');
    const root = `/api/projects/${encodeURIComponent(projectId)}/office/artifacts/${encodeURIComponent(revision.artifactId)}/revisions/${encodeURIComponent(revision.id)}`;
    return {
      ...fields,
      projectId,
      operationSummary: revision.operationSummary as Record<string, unknown>,
      packageUrl: this.url.link(`${root}/package`),
      stateUrl: revision.stateBlobKey ? this.url.link(`${root}/state`) : null,
    };
  }
}
