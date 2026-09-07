import {
  Args,
  Field,
  ID,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import type { ProjectResourceMigration } from '@prisma/client';

import { BadRequest, JobQueue, Throttle } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { PermissionAccess } from '../permission';
import { ProjectImportPermissionRequestType } from './resolver';

@ObjectType()
class ProjectResourceMigrationType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field() status!: string;
  @Field(() => Int) revision!: number;
  @Field(() => String, { nullable: true }) title!: string | null;
  @Field(() => String, { nullable: true }) failureCode!: string | null;
  @Field(() => ID, { nullable: true }) resourceId!: string | null;
}

@ObjectType()
class ProjectResourceMigrationPageType {
  @Field(() => [ProjectResourceMigrationType])
  items!: ProjectResourceMigrationType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@Resolver()
export class ProjectResourceMigrationResolver {
  constructor(
    private readonly models: Models,
    private readonly ac: PermissionAccess,
    private readonly jobs: JobQueue
  ) {}

  private async view(row: ProjectResourceMigration, actorId: string) {
    let title: string | null = null;
    if (row.resourceId) {
      const resource = await this.models.projectResource.get({
        projectId: row.projectId,
        actorId,
        resourceId: row.resourceId,
        includeTrash: true,
      });
      title = resource.title;
    } else if (
      await this.ac
        .user(actorId)
        .doc(row.sourceWorkspaceId, row.sourceResourceId)
        .projectScope(row.projectId)
        .can('Doc.Read')
    ) {
      const native = await this.models.officeArtifact.get(
        row.sourceWorkspaceId,
        row.sourceResourceId
      );
      title =
        native?.title ??
        (
          await this.models.doc.getMeta(
            row.sourceWorkspaceId,
            row.sourceResourceId
          )
        )?.title ??
        null;
    }
    return {
      id: row.id,
      projectId: row.projectId,
      title,
      status: row.status,
      revision: row.revision,
      failureCode: row.failureCode,
      resourceId: row.resourceId,
    };
  }

  @Query(() => ProjectResourceMigrationPageType)
  async projectResourceMigrations(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    const rows = await this.models.projectResourceMigration.list({
      projectId,
      actorId: user.id,
      after: cursor,
      limit: 20,
    });
    const items = [];
    for (const row of rows.slice(0, 20))
      items.push(await this.view(row, user.id));
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    return {
      items,
      nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null,
    };
  }

  @Mutation(() => ProjectResourceMigrationPageType)
  @Throttle('strict')
  async discoverProjectResourceMigrations(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string
  ) {
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    await this.models.projectResourceMigration.discover(projectId);
    await this.jobs.add(
      'doc.projectResources.migrate',
      {},
      { jobId: 'project-resource-migration-scan' }
    );
    return this.projectResourceMigrations(user, projectId);
  }

  @Mutation(() => ProjectResourceMigrationType)
  @Throttle('strict')
  async changeProjectResourceMigration(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('migrationId') migrationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number,
    @Args('action') action: string
  ) {
    if (action !== 'retry' && action !== 'cancel')
      throw new BadRequest('Invalid migration action');
    const row = await this.models.projectResourceMigration.change({
      projectId,
      actorId: user.id,
      migrationId,
      expectedRevision,
      action,
    });
    if (row.status === 'pending')
      await this.jobs.add(
        'doc.projectResources.migrate',
        { migrationId },
        { jobId: `project-migration-${migrationId}` }
      );
    return this.view(row, user.id);
  }

  @Mutation(() => ProjectImportPermissionRequestType)
  @Throttle('strict')
  async requestProjectMigrationPermission(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('migrationId') migrationId: string,
    @Args('requestKey') requestKey: string
  ) {
    const row = await this.models.projectResourceMigration.get({
      projectId,
      actorId: user.id,
      migrationId,
    });
    if (row.status === 'complete')
      throw new BadRequest('This Project resource was already imported');
    const result =
      await this.models.intelligenceWorkbenchAuthorization.requestProjectCopy({
        projectId,
        actorId: user.id,
        workspaceId: row.sourceWorkspaceId,
        docId: row.sourceResourceId,
        requestKey,
      });
    return {
      id: result.request.id,
      status: result.request.status,
      purpose: result.request.purpose,
    };
  }
}
