import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ProjectResourceKind } from '@prisma/client';

import { JobQueue, Throttle } from '../../base';
import { Models } from '../../models';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';
import { projectWorkspaceImportCommand } from '../../models/project-workspace-import';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { ProjectWorkspaceImportService } from './workspace-import-service';

@ObjectType()
class ProjectImportWorkspaceType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}
@ObjectType()
class ProjectImportWorkspacePageType {
  @Field(() => [ProjectImportWorkspaceType])
  items!: ProjectImportWorkspaceType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}
@ObjectType()
class ProjectImportSourceType {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field(() => ProjectResourceKind) kind!: ProjectResourceKind;
  @Field() permission!: string;
}
@ObjectType()
class ProjectImportSourcePageType {
  @Field(() => [ProjectImportSourceType]) items!: ProjectImportSourceType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}
@ObjectType()
class ProjectWorkspaceImportTaskType {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() status!: string;
  @Field(() => ID, { nullable: true }) resourceId!: string | null;
  @Field(() => ID, { nullable: true }) accessRequestId!: string | null;
  @Field(() => String, { nullable: true }) failureCode!: string | null;
}
@ObjectType()
class ProjectWorkspaceImportTaskPageType {
  @Field(() => [ProjectWorkspaceImportTaskType])
  items!: ProjectWorkspaceImportTaskType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}
@InputType()
class SubmitProjectWorkspaceImportInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID) workspaceId!: string;
  @Field(() => ID) sourceResourceId!: string;
  @Field(() => ID, { nullable: true }) parentId?: string | null;
  @Field() requestKey!: string;
  @Field() requestApproval!: boolean;
}

function task(run: ProjectAgentRun) {
  const step = run.steps.find(step => step.stepKey === 'execute');
  const command = projectWorkspaceImportCommand.parse(step?.input);
  const output = step?.outputSummary as { resourceId?: string } | undefined;
  return {
    id: run.id,
    title: run.title,
    status: run.status,
    resourceId:
      run.status === 'completed' ? (output?.resourceId ?? null) : null,
    accessRequestId: command.accessRequestId,
    failureCode: run.failureCode,
  };
}

@Resolver()
export class ProjectWorkspaceImportResolver {
  constructor(
    private readonly service: ProjectWorkspaceImportService,
    private readonly models: Models,
    private readonly jobs: JobQueue
  ) {}

  @Query(() => ProjectImportWorkspacePageType)
  projectImportWorkspaces(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    return this.service.workspaces({ projectId, actorId: user.id, cursor });
  }

  @Query(() => ProjectImportSourcePageType)
  projectImportSources(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('query', { type: () => String, nullable: true }) query?: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    return this.service.sources({
      projectId,
      actorId: user.id,
      workspaceId,
      query,
      cursor,
    });
  }

  @Mutation(() => ProjectWorkspaceImportTaskType)
  @Throttle('strict')
  async submitProjectWorkspaceImport(
    @CurrentUser() user: User,
    @Args('input') input: SubmitProjectWorkspaceImportInput
  ) {
    const run = await this.service.submit({
      ...input,
      actorId: user.id,
      parentId: input.parentId ?? null,
    });
    await this.enqueue(run);
    return task(run);
  }

  @Mutation(() => ProjectWorkspaceImportTaskType)
  @Throttle('strict')
  async retryProjectWorkspaceImport(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('runId') runId: string
  ) {
    const run = await this.service.retry({
      projectId,
      actorId: user.id,
      runId,
    });
    await this.enqueue(run);
    return task(run);
  }

  @Query(() => ProjectWorkspaceImportTaskPageType)
  async projectWorkspaceImports(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('parentId', { type: () => ID, nullable: true }) parentId?: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    const page = await this.models.projectWorkspaceImport.list({
      projectId,
      actorId: user.id,
      parentId: parentId ?? null,
      cursor,
    });
    return { items: page.items.map(task), nextCursor: page.nextCursor };
  }

  private async enqueue(run: ProjectAgentRun) {
    if (run.status !== 'queued') return;
    // The durable queued row is also recovered by the minute worker if Redis is unavailable.
    await this.jobs.add(
      'copilot.projectAgentRuntime.run',
      { projectId: run.projectId, runId: run.id },
      { jobId: `project-import-${run.id}-${run.workerAttempt}` }
    );
  }
}
