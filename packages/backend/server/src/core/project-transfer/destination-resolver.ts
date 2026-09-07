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

import { JobQueue, Throttle } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { DocumentDestinationService } from '../doc';
import { ProjectDestinationFolderService } from './destination-folder-service';

@ObjectType()
class ProjectDestinationWorkspaceType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}

@ObjectType()
class ProjectDestinationFolderType {
  @Field(() => ID) workspaceId!: string;
  @Field(() => ID, { nullable: true }) folderId!: string | null;
  @Field(() => [ProjectDestinationWorkspaceType]) path!: {
    id: string;
    name: string;
  }[];
  @Field() fingerprint!: string;
  @Field() canSave!: boolean;
  @Field() canCreateFolder!: boolean;
}

@ObjectType()
class ProjectDestinationPageType {
  @Field(() => ProjectDestinationFolderType)
  current!: ProjectDestinationFolderType;
  @Field() revision!: string;
  @Field(() => [ProjectDestinationFolderType])
  items!: ProjectDestinationFolderType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@ObjectType()
class ProjectDestinationFolderResultType {
  @Field(() => ID) runId!: string;
  @Field() status!: string;
  @Field(() => String, { nullable: true }) folderId!: string | null;
  @Field(() => String, { nullable: true }) failureCode!: string | null;
}

@Resolver()
export class ProjectDestinationResolver {
  constructor(
    private readonly models: Models,
    private readonly destinations: DocumentDestinationService,
    private readonly folders: ProjectDestinationFolderService,
    private readonly jobs: JobQueue
  ) {}

  @Mutation(() => ProjectDestinationFolderResultType)
  @Throttle('strict')
  async createProjectDestinationFolder(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('publicationId') publicationId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('parentId', { type: () => String, nullable: true })
    parentId: string | null,
    @Args('title') title: string,
    @Args('expectedDirectoryRevision') expectedDirectoryRevision: string,
    @Args('requestKey') requestKey: string
  ) {
    const prepared = await this.folders.prepare({
      projectId,
      actorId: user.id,
      publicationId,
      workspaceId,
      parentId: parentId ?? null,
      title,
      expectedDirectoryRevision,
      requestKey,
    });
    if (prepared.status === 'queued')
      await this.jobs.add(
        'copilot.projectAgentRuntime.run',
        { projectId, runId: prepared.id },
        { jobId: `project-agent-${prepared.id}` }
      );
    const run = await this.folders.runPrepared(prepared);
    const result = run.projectExecutionResults.find(
      result => result.resultStatus === 'completed'
    );
    const payload = result?.resultPayload as
      | { sideEffectSummary?: { folderId?: string } }
      | undefined;
    return {
      runId: run.id,
      status: run.status,
      folderId: payload?.sideEffectSummary?.folderId ?? null,
      failureCode: run.failureCode,
    };
  }

  @Query(() => [ProjectDestinationWorkspaceType])
  async projectDestinationWorkspaces(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string
  ) {
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    return this.destinations.workspaces(user.id);
  }

  @Query(() => ProjectDestinationPageType)
  async projectDestinationFolders(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('parentId', { type: () => String, nullable: true })
    parentId?: string | null,
    @Args('query', { type: () => String, nullable: true }) query?: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ) {
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    const result = await this.destinations.locations({
      actorId: user.id,
      workspaceId,
      parentId: parentId ?? null,
      query,
      cursor,
      limit,
    });
    await this.models.projectResource.assertMember({
      projectId,
      actorId: user.id,
    });
    return result;
  }
}
