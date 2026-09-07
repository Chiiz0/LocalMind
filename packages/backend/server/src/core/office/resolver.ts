import { parseOfficeCommand } from '@localmind/office';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  type OfficeArtifact,
  OfficeArtifactKind,
  type OfficeRevision,
} from '@prisma/client';
import { SafeIntResolver } from 'graphql-scalars';

import { Throttle, URLHelper } from '../../base';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../auth';
import { OfficeArtifactService } from './artifact-service';
import { OfficeCommandService } from './command-service';
import { OfficeImportService } from './import-service';
import {
  ExecuteOfficeCommandResultType,
  ExecuteOfficeDocxCommandResultType,
  ImportOfficeArtifactRequestInput,
  ImportOfficeArtifactResultType,
  ImportOfficeDocxRequestInput,
  ImportOfficeDocxResultType,
  OfficeArtifactType,
  OfficeCommandInput,
  OfficeCommandPreviewType,
  OfficeDocxCommandInput,
  OfficeDocxCommandPreviewType,
  OfficeRevisionCompareType,
  OfficeRevisionType,
} from './types';

type ArtifactWithRevision = {
  artifact: OfficeArtifact;
  revision: OfficeRevision;
};

@Resolver()
export class OfficeResolver {
  constructor(
    private readonly artifacts: OfficeArtifactService,
    private readonly imports: OfficeImportService,
    private readonly commands: OfficeCommandService,
    private readonly url: URLHelper
  ) {}

  @Query(() => [OfficeArtifactType], {
    description: 'List native Office resources in a workspace',
  })
  async officeArtifacts(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('kind', { type: () => OfficeArtifactKind, nullable: true })
    kind?: OfficeArtifactKind,
    @Args('limit', {
      type: () => SafeIntResolver,
      nullable: true,
      defaultValue: 50,
    })
    limit?: number
  ) {
    const records = await this.artifacts.list(
      workspaceId,
      user.id,
      limit,
      kind
    );
    return records.map(record =>
      this.projectArtifact(record as ArtifactWithRevision)
    );
  }

  @Query(() => OfficeArtifactType, {
    nullable: true,
    description: 'Get one native Office resource and its current revision',
  })
  async officeArtifact(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('artifactId', { type: () => String }) artifactId: string
  ) {
    const record = await this.artifacts.get(workspaceId, user.id, artifactId);
    return this.projectArtifact(record);
  }

  @Query(() => OfficeRevisionType, {
    nullable: true,
    description: 'Get a current or specific immutable Office revision',
  })
  async officeRevision(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('artifactId') artifactId: string,
    @Args('revisionId', { nullable: true }) revisionId?: string
  ) {
    const revision = await this.artifacts.getRevision(
      workspaceId,
      user.id,
      artifactId,
      revisionId
    );
    return this.projectRevision(revision);
  }

  @Query(() => [OfficeRevisionType], {
    description: 'List immutable revisions for one Office resource',
  })
  async officeRevisions(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('artifactId') artifactId: string,
    @Args('limit', {
      type: () => SafeIntResolver,
      nullable: true,
      defaultValue: 50,
    })
    limit?: number
  ) {
    const revisions = await this.artifacts.listRevisions(
      workspaceId,
      user.id,
      artifactId,
      limit
    );
    return revisions.map(revision => this.projectRevision(revision));
  }

  @Query(() => OfficeRevisionCompareType, {
    description:
      'Compare two immutable semantic revisions of one native Office resource',
  })
  async officeRevisionCompare(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('artifactId') artifactId: string,
    @Args('beforeRevisionId') beforeRevisionId: string,
    @Args('afterRevisionId') afterRevisionId: string
  ) {
    const result = await this.artifacts.compareRevisions(
      workspaceId,
      user.id,
      artifactId,
      beforeRevisionId,
      afterRevisionId
    );
    return {
      artifactId: result.artifact.id,
      kind: result.artifact.kind,
      beforeRevision: this.projectRevision(result.beforeRevision),
      afterRevision: this.projectRevision(result.afterRevision),
      changed: result.diff.changed,
      truncated: result.diff.truncated,
      summary: result.diff.summary,
      changes: result.diff.changes,
    };
  }

  @Query(() => OfficeDocxCommandPreviewType, {
    description: 'Preview a native DOCX command without persisting changes',
  })
  async previewOfficeDocxCommand(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: OfficeDocxCommandInput
  ) {
    this.assertInteractiveUserCommand(input.command, 'document');
    const result = await this.commands.preview({
      workspaceId: input.workspaceId,
      actorId: user.id,
      command: input.command,
    });
    return {
      artifactId: result.artifact.id,
      expectedRevisionId: result.revision.id,
      packageFingerprint: result.packageFingerprint,
      stateFingerprint: result.stateFingerprint,
      stats: result.stats,
      summary: result.summary,
    };
  }

  @Mutation(() => ImportOfficeDocxResultType, {
    description: 'Import a completed workspace DOCX blob as a native resource',
  })
  @Throttle('strict')
  async importOfficeDocx(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ImportOfficeDocxRequestInput
  ) {
    if (!input.sourceFileName.toLowerCase().endsWith('.docx')) {
      throw new Error('DOCX import source file name must end with .docx');
    }
    const result = await this.imports.import({
      workspaceId: input.workspaceId,
      actorId: user.id,
      sourceBlobKey: input.sourceBlobKey,
      title: input.title,
      sourceFileName: input.sourceFileName,
      importIdempotencyKey: input.idempotencyKey,
    });
    return {
      created: result.created,
      artifact: this.projectArtifact({
        artifact: result.artifact,
        revision: result.revision,
      }),
      revision: this.projectRevision(result.revision),
    };
  }

  @Mutation(() => ExecuteOfficeDocxCommandResultType, {
    description: 'Execute and persist a native DOCX user command',
  })
  @Throttle('strict')
  async executeOfficeDocxCommand(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: OfficeDocxCommandInput
  ) {
    this.assertInteractiveUserCommand(input.command, 'document');
    const result = await this.commands.execute({
      workspaceId: input.workspaceId,
      actorId: user.id,
      command: input.command,
    });
    const current = await this.artifacts.get(
      input.workspaceId,
      user.id,
      result.revision.artifactId
    );
    return {
      created: result.created,
      artifact: this.projectArtifact(current),
      revision: this.projectRevision(result.revision),
      summary: result.summary,
    };
  }

  @Query(() => OfficeCommandPreviewType, {
    description:
      'Preview a native Docs, Sheets, Slides, or PDF command without persisting changes',
  })
  async previewOfficeCommand(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: OfficeCommandInput
  ) {
    this.assertInteractiveUserCommand(input.command);
    const result = await this.commands.preview({
      workspaceId: input.workspaceId,
      actorId: user.id,
      command: input.command,
    });
    return {
      artifactId: result.artifact.id,
      expectedRevisionId: result.revision.id,
      packageFingerprint: result.packageFingerprint,
      stateFingerprint: result.stateFingerprint,
      stats: result.stats,
      summary: result.summary,
    };
  }

  @Mutation(() => ImportOfficeArtifactResultType, {
    description:
      'Import a completed workspace DOCX, XLSX, PPTX, or PDF blob as a native resource',
  })
  @Throttle('strict')
  async importOfficeArtifact(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ImportOfficeArtifactRequestInput
  ) {
    const result = await this.imports.import({
      workspaceId: input.workspaceId,
      actorId: user.id,
      sourceBlobKey: input.sourceBlobKey,
      title: input.title,
      sourceFileName: input.sourceFileName,
      importIdempotencyKey: input.idempotencyKey,
    });
    return {
      created: result.created,
      artifact: this.projectArtifact({
        artifact: result.artifact,
        revision: result.revision,
      }),
      revision: this.projectRevision(result.revision),
    };
  }

  @Mutation(() => ExecuteOfficeCommandResultType, {
    description:
      'Execute and persist a native Docs, Sheets, Slides, or PDF user command',
  })
  @Throttle('strict')
  async executeOfficeCommand(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: OfficeCommandInput
  ) {
    this.assertInteractiveUserCommand(input.command);
    const result = await this.commands.execute({
      workspaceId: input.workspaceId,
      actorId: user.id,
      command: input.command,
    });
    const current = await this.artifacts.get(
      input.workspaceId,
      user.id,
      result.revision.artifactId
    );
    return {
      created: result.created,
      artifact: this.projectArtifact(current),
      revision: this.projectRevision(result.revision),
      summary: result.summary,
    };
  }

  private assertInteractiveUserCommand(input: unknown, expected?: 'document') {
    const command = parseOfficeCommand(input);
    if (command.source !== 'user') {
      throw new Error('Interactive Office commands must use source=user');
    }
    if (
      expected === 'document' &&
      !command.operation.startsWith('office.document.')
    ) {
      throw new Error('DOCX command endpoint only accepts document operations');
    }
  }

  private projectArtifact(record: ArtifactWithRevision): OfficeArtifactType {
    if (!record.artifact.workspaceId || record.artifact.projectId)
      throw new Error(
        'This Office endpoint requires a Workspace-owned artifact'
      );
    return {
      ...record.artifact,
      workspaceId: record.artifact.workspaceId,
      compatibility: record.artifact.compatibility as Record<string, unknown>,
      currentRevision: this.projectRevision(record.revision),
    };
  }

  private projectRevision(revision: OfficeRevision): OfficeRevisionType {
    if (!revision.workspaceId || revision.projectId)
      throw new Error(
        'This Office endpoint requires a Workspace-owned revision'
      );
    const root = `/api/workspaces/${encodeURIComponent(
      revision.workspaceId
    )}/office/artifacts/${encodeURIComponent(
      revision.artifactId
    )}/revisions/${encodeURIComponent(revision.id)}`;
    return {
      ...revision,
      workspaceId: revision.workspaceId,
      operationSummary: revision.operationSummary as Record<string, unknown>,
      packageUrl: this.url.link(`${root}/package`),
      stateUrl: revision.stateBlobKey ? this.url.link(`${root}/state`) : null,
    };
  }
}
