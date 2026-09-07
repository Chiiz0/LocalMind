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
import { Prisma, type ProjectPublication } from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-scalars';

import { BadRequest, JobQueue, Throttle } from '../../base';
import { Models } from '../../models';
import { publicationTargetSchema } from '../../models/project-publication';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { PermissionAccess } from '../permission';
import { ProjectPublicationService } from './publication-service';

@ObjectType()
class ProjectPublicationType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field(() => ID) resourceId!: string;
  @Field(() => ID, { nullable: true }) runId!: string | null;
  @Field(() => Int) revision!: number;
  @Field() kind!: string;
  @Field() title!: string;
  @Field() status!: string;
  @Field(() => Int) sourceSequence!: number;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
  @Field(() => GraphQLISODateTime) expiresAt!: Date;
  @Field(() => String, { nullable: true }) targetFingerprint!: string | null;
  @Field(() => String, { nullable: true }) failureCode!: string | null;
  @Field(() => GraphQLJSONObject, { nullable: true })
  target!: Prisma.JsonValue | null;
  @Field(() => GraphQLJSONObject, { nullable: true })
  preview!: Prisma.JsonValue | null;
  @Field(() => GraphQLJSONObject, { nullable: true })
  receipt!: Prisma.JsonValue | null;
}

@ObjectType()
class ProjectPublicationPageType {
  @Field(() => [ProjectPublicationType]) items!: ProjectPublicationType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@ObjectType()
class ProjectPublicationPathType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}

@ObjectType()
class ProjectPublicationCandidateType {
  @Field(() => ID) resourceId!: string;
  @Field() title!: string;
  @Field() kind!: string;
  @Field(() => ID, { nullable: true }) folderId!: string | null;
  @Field(() => [ProjectPublicationPathType])
  path!: ProjectPublicationPathType[];
  @Field() canUpdate!: boolean;
}

@ObjectType()
class ProjectPublicationCandidatesType {
  @Field(() => [ProjectPublicationCandidateType])
  items!: ProjectPublicationCandidateType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@Resolver()
export class ProjectPublicationResolver {
  constructor(
    private readonly models: Models,
    private readonly service: ProjectPublicationService,
    private readonly jobs: JobQueue,
    private readonly ac: PermissionAccess
  ) {}

  @Query(() => ProjectPublicationCandidatesType)
  async projectPublicationCandidates(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('parentId', { type: () => String, nullable: true })
    parentId: string | null,
    @Args('query', { type: () => String, nullable: true }) query?: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string
  ) {
    return this.service.targets({
      projectId,
      actorId: user.id,
      resourceId,
      workspaceId,
      parentId: parentId ?? null,
      query,
      cursor,
    });
  }

  private async view(
    record: ProjectPublication
  ): Promise<ProjectPublicationType> {
    const actor = { projectId: record.projectId, actorId: record.actorId };
    const resource = await this.models.projectResource.get({
      ...actor,
      resourceId: record.resourceId,
      includeTrash: true,
    });
    const run = record.runId
      ? await this.models.copilotProjectAgentRuntime.get({
          ...actor,
          runId: record.runId,
        })
      : null;
    const target = record.target
      ? publicationTargetSchema.parse(record.target)
      : null;
    const previewVisible =
      !target ||
      record.kind === 'publish' ||
      (await this.ac
        .user(record.actorId)
        .doc(target.workspaceId, target.resourceId)
        .projectScope(null)
        .can('Doc.Read'));
    const result = run?.projectExecutionResults.find(
      item => item.resultStatus === 'completed'
    );
    const resultPayload = result?.resultPayload as
      | Prisma.JsonObject
      | undefined;
    const expired =
      ['waiting_for_location', 'waiting_for_confirmation'].includes(
        record.status
      ) && record.expiresAt <= new Date();
    return {
      ...record,
      title: resource.title,
      status: expired
        ? 'expired'
        : record.status === 'submitted' && run
          ? run.failureCode === 'publication_conflict'
            ? 'conflict'
            : run.status === 'completed'
              ? 'complete'
              : run.status
          : record.status,
      targetFingerprint: run?.targetFingerprint ?? null,
      failureCode: run?.failureCode ?? null,
      preview: previewVisible ? record.preview : null,
      receipt: resultPayload?.sideEffectSummary ?? null,
    };
  }

  @Query(() => ProjectPublicationType)
  async projectPublication(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('publicationId') publicationId: string
  ) {
    return this.view(
      await this.models.projectPublication.get({
        projectId,
        actorId: user.id,
        publicationId,
      })
    );
  }

  @Query(() => ProjectPublicationPageType)
  async projectPublications(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId', { type: () => String, nullable: true })
    resourceId?: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ) {
    const result = await this.models.projectPublication.list({
      projectId,
      actorId: user.id,
      resourceId,
      cursor,
      limit,
    });
    return {
      ...result,
      items: await Promise.all(result.items.map(record => this.view(record))),
    };
  }

  @Mutation(() => ProjectPublicationType)
  @Throttle('strict')
  async prepareProjectPublication(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string,
    @Args('kind') kind: string,
    @Args('requestKey') requestKey: string,
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId?: string
  ) {
    if (kind !== 'publish' && kind !== 'update')
      throw new BadRequest('Choose publish or update');
    return this.view(
      await this.service.prepare({
        projectId,
        actorId: user.id,
        resourceId,
        kind,
        requestKey,
        sessionId,
      })
    );
  }

  @Mutation(() => ProjectPublicationType)
  @Throttle('strict')
  async previewProjectPublication(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('publicationId') publicationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number,
    @Args('workspaceId') workspaceId: string,
    @Args('folderId', { type: () => String, nullable: true })
    folderId: string | null,
    @Args('targetResourceId', { type: () => String, nullable: true })
    targetResourceId?: string
  ) {
    return this.view(
      await this.service.preview({
        projectId,
        actorId: user.id,
        publicationId,
        expectedRevision,
        workspaceId,
        folderId: folderId ?? null,
        targetResourceId,
      })
    );
  }

  @Mutation(() => ProjectPublicationType)
  @Throttle('strict')
  async confirmProjectPublication(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('publicationId') publicationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number,
    @Args('targetFingerprint') targetFingerprint: string
  ) {
    const record = await this.service.submit({
      projectId,
      actorId: user.id,
      publicationId,
      expectedRevision,
      targetFingerprint,
    });
    if (record.runId)
      await this.jobs.add(
        'copilot.projectAgentRuntime.run',
        { projectId, runId: record.runId },
        { jobId: `project-agent-${record.runId}` }
      );
    return this.view(record);
  }

  @Mutation(() => ProjectPublicationType)
  @Throttle('strict')
  async changeProjectPublication(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('publicationId') publicationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number,
    @Args('action') action: string
  ) {
    const input = {
      projectId,
      actorId: user.id,
      publicationId,
      expectedRevision,
    };
    if (action !== 'cancel' && action !== 'reopen')
      throw new BadRequest('Choose cancel or reopen');
    return this.view(
      await (action === 'cancel'
        ? this.models.projectPublication.cancel(input)
        : this.models.projectPublication.reopen(input))
    );
  }
}
