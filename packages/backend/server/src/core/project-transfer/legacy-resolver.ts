import {
  Args,
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import type { CopilotDocumentOperation } from '@prisma/client';

import { BadRequest, Throttle } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { ProjectResourceService } from '../project';
import { ProjectImportService } from './import-service';

@ObjectType()
class ProjectLegacyOperationType {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() status!: string;
  @Field(() => Int) revision!: number;
  @Field(() => ID, { nullable: true }) resourceId!: string | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}
@ObjectType()
class ProjectLegacyOperationPageType {
  @Field(() => [ProjectLegacyOperationType])
  items!: ProjectLegacyOperationType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}
@ObjectType()
class ProjectLegacyConversationType {
  @Field(() => ID) id!: string;
  @Field(() => String, { nullable: true }) title!: string | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}
@ObjectType()
class ProjectLegacyConversationPageType {
  @Field(() => [ProjectLegacyConversationType])
  items!: ProjectLegacyConversationType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}
@ObjectType()
class ProjectLegacyMessageType {
  @Field(() => ID) id!: string;
  @Field() role!: string;
  @Field() content!: string;
  @Field() truncated!: boolean;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}
@ObjectType()
class ProjectLegacyMessagePageType {
  @Field(() => [ProjectLegacyMessageType]) items!: ProjectLegacyMessageType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@Resolver()
export class ProjectLegacyResolver {
  constructor(
    private readonly models: Models,
    private readonly resources: ProjectResourceService,
    private readonly imports: ProjectImportService
  ) {}

  private view(row: CopilotDocumentOperation) {
    return {
      id: row.id,
      title: row.title.slice(0, 512),
      status: row.projectMigrationStatus ?? 'pending',
      revision: row.projectMigrationRevision,
      resourceId: row.projectMigrationResourceId,
      createdAt: row.createdAt,
    };
  }

  @Query(() => ProjectLegacyOperationPageType)
  async projectLegacyOperations(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    const rows =
      await this.models.copilotDocumentOperation.legacyProjectOperations({
        projectId,
        actorId: user.id,
        after: cursor,
      });
    const items = rows.slice(0, 20).map(row => this.view(row));
    return {
      items,
      nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null,
    };
  }

  @Mutation(() => ProjectLegacyOperationType)
  @Throttle('strict')
  async changeProjectLegacyOperation(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('operationId') operationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number,
    @Args('action') action: string
  ) {
    if (action !== 'recover' && action !== 'cancel')
      throw new BadRequest('Invalid legacy recovery action');
    const input = {
      projectId,
      actorId: user.id,
      operationId,
      expectedRevision,
      action,
    };
    try {
      const row =
        await this.models.copilotDocumentOperation.recoverLegacyProjectOperation(
          { ...input, action },
          async operation => {
            if (operation.createdDocumentAt)
              throw new BadRequest(
                'This historical operation already has an external result'
              );
            if (operation.kind === 'copy') {
              await this.models.copilotContext.assertProjectSourcesShared({
                projectId,
                actorId: user.id,
                sessionId: operation.sessionId,
                sink: {
                  type: 'tool_write',
                  projectId,
                  id: operation.id,
                  phase: 'execute',
                },
              });
              const source =
                await this.models.copilotDocumentOperation.copySource({
                  operationId,
                  actorId: user.id,
                });
              if (!source)
                throw new BadRequest('Historical copy source is unavailable');
              const metadata = await this.models.doc.getMeta(
                source.workspaceId,
                source.documentId
              );
              return this.imports.import({
                projectId,
                actorId: user.id,
                workspaceId: source.workspaceId,
                sourceResourceId: source.documentId,
                legacyOperationId: operationId,
                kind: metadata?.mode === 1 ? 'edgeless' : 'page',
                title: operation.title,
                requestKey: `legacy-project-operation:${operation.id}`,
              });
            }
            if (operation.kind !== 'create')
              throw new BadRequest('Unsupported historical operation');
            return this.resources.createDocument({
              projectId,
              actorId: user.id,
              title: operation.title,
              markdown: operation.markdown,
              requestKey: `legacy-project-operation:${operation.id}`,
              origin: 'ai',
              sourceSessionId: operation.sessionId,
            });
          }
        );
      return this.view(row);
    } catch (error) {
      if (action === 'recover')
        await this.models.copilotDocumentOperation.blockLegacyProjectOperation(
          input
        );
      throw error;
    }
  }

  @Query(() => ProjectLegacyConversationPageType)
  async projectLegacyConversations(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    if (cursor && cursor.length > 256)
      throw new BadRequest('Invalid historical conversation cursor');
    const rows =
      await this.models.copilotDocumentOperation.legacyProjectConversations({
        projectId,
        actorId: user.id,
        after: cursor,
      });
    const items = rows.slice(0, 20);
    return {
      items,
      nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null,
    };
  }

  @Query(() => ProjectLegacyMessagePageType)
  async projectLegacyMessages(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('sessionId') sessionId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    if (cursor && cursor.length > 256)
      throw new BadRequest('Invalid historical message cursor');
    const rows =
      await this.models.copilotDocumentOperation.legacyProjectMessages({
        projectId,
        actorId: user.id,
        sessionId,
        after: cursor,
      });
    const items = rows.slice(0, 20).map(row => ({
      ...row,
      content: row.content.slice(0, 8000),
      truncated: row.content.length > 8000,
    }));
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    return {
      items,
      nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null,
    };
  }
}
