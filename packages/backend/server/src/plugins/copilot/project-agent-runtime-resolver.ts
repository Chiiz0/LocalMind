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
import type { Prisma } from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';

import { BadRequest, JobQueue, Throttle } from '../../base';
import { CurrentUser, type CurrentUser as User } from '../../core/auth';
import { Models } from '../../models';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';

@ObjectType()
class ProjectAgentTaskType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field(() => ID, { nullable: true }) sessionId!: string | null;
  @Field() title!: string;
  @Field() status!: string;
  @Field() workflow!: string;
  @Field() targetFingerprint!: string;
  @Field(() => Int) workerAttempt!: number;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
  @Field(() => GraphQLISODateTime) updatedAt!: Date;
  @Field(() => String, { nullable: true }) failureCode!: string | null;
  @Field(() => String, { nullable: true }) failureMessage!: string | null;
  @Field(() => GraphQLJSONObject, { nullable: true })
  receipt!: Prisma.JsonObject | null;
  @Field(() => GraphQLJSONObject, { nullable: true })
  preview!: Prisma.JsonObject | null;
}

@ObjectType()
class ProjectAgentTaskPageType {
  @Field(() => [ProjectAgentTaskType]) items!: ProjectAgentTaskType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function view(
  run: Omit<ProjectAgentRun, 'projectId' | 'workspaceId'> & {
    projectId: string | null;
    workspaceId: string | null;
  }
): ProjectAgentTaskType {
  if (!run.projectId || run.workspaceId)
    throw new BadRequest('Project task ownership is invalid');
  const result = run.projectExecutionResults.find(
    result => result.resultStatus === 'completed'
  );
  const input = object(
    run.steps.find(step => step.stepKey === 'execute')?.input
  );
  return {
    id: run.id,
    projectId: run.projectId,
    sessionId: run.sessionId,
    title: run.title ?? run.workflow,
    workflow: run.workflow,
    status: run.status,
    targetFingerprint: run.targetFingerprint,
    workerAttempt: run.workerAttempt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    failureCode: run.failureCode,
    failureMessage: run.failureMessage,
    receipt: object(object(result?.resultPayload)?.sideEffectSummary),
    preview: object(input?.preview),
  };
}

@Resolver()
export class ProjectAgentRuntimeResolver {
  constructor(
    private readonly models: Models,
    private readonly jobs: JobQueue
  ) {}

  @Query(() => ProjectAgentTaskType)
  async projectAgentTask(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('runId') runId: string
  ) {
    return view(
      await this.models.copilotProjectAgentRuntime.get({
        projectId,
        actorId: user.id,
        runId,
      })
    );
  }

  @Query(() => ProjectAgentTaskPageType)
  async projectAgentTasks(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId?: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ) {
    const result = await this.models.copilotProjectAgentRuntime.list({
      projectId,
      actorId: user.id,
      sessionId,
      beforeId: cursor,
      limit,
    });
    return { ...result, items: result.items.map(view) };
  }

  @Mutation(() => ProjectAgentTaskType)
  @Throttle('strict')
  async approveProjectAgentTask(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('runId') runId: string,
    @Args('targetFingerprint') targetFingerprint: string
  ) {
    const input = {
      projectId,
      actorId: user.id,
      runId,
      targetFingerprint,
    };
    const publication = await this.models.projectPublication.forRun(input);
    if (publication)
      throw new BadRequest(
        'Review and confirm this publication through its destination preview'
      );
    const run = await this.models.copilotProjectAgentRuntime.approve(input);
    if (run.status === 'queued')
      await this.jobs.add(
        'copilot.projectAgentRuntime.run',
        { projectId, runId },
        { jobId: `project-agent-${runId}` }
      );
    return view(run);
  }

  @Mutation(() => ProjectAgentTaskType)
  @Throttle('strict')
  async cancelProjectAgentTask(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('runId') runId: string
  ) {
    return view(
      await this.models.copilotProjectAgentRuntime.cancel({
        projectId,
        actorId: user.id,
        runId,
      })
    );
  }
}
