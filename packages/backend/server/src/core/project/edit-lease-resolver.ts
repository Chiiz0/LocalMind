import {
  Args,
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';

@InputType()
export class ProjectEditLeaseInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID) resourceId!: string;
  @Field() tabId!: string;
}

@InputType()
export class ProjectEditLeaseProofInput {
  @Field() tabId!: string;
  @Field() leaseId!: string;
}

@InputType()
export class ProjectEditLeaseChangeInput extends ProjectEditLeaseInput {
  @Field() leaseId!: string;
}

@ObjectType()
export class ProjectEditLeaseType {
  @Field(() => ID) resourceId!: string;
  @Field(() => ID) projectId!: string;
  @Field() kind!: string;
  @Field(() => ID) holderId!: string;
  @Field() holderName!: string;
  @Field() owned!: boolean;
  @Field(() => String, { nullable: true }) leaseId!: string | null;
  @Field(() => GraphQLISODateTime) acquiredAt!: Date;
  @Field(() => GraphQLISODateTime) expiresAt!: Date;
}

@ObjectType()
export class ProjectEditLeaseResultType {
  @Field() acquired!: boolean;
  @Field(() => ProjectEditLeaseType, { nullable: true })
  lease!: ProjectEditLeaseType | null;
}

@Resolver()
export class ProjectEditLeaseResolver {
  constructor(private readonly models: Models) {}

  @Query(() => ProjectEditLeaseType, { nullable: true })
  async projectResourceEditLease(
    @CurrentUser() user: User,
    @Args('input') input: ProjectEditLeaseInput
  ) {
    const identity = { ...input, actorId: user.id };
    const lease = await this.models.projectResourceEditLease.get(identity);
    return this.models.projectResourceEditLease.view(lease, identity);
  }

  @Mutation(() => ProjectEditLeaseResultType)
  async acquireProjectResourceEditLease(
    @CurrentUser() user: User,
    @Args('input') input: ProjectEditLeaseInput
  ) {
    const identity = { ...input, actorId: user.id, kind: 'user' as const };
    const result = await this.models.projectResourceEditLease.acquire(identity);
    return {
      acquired: result.acquired,
      lease: this.models.projectResourceEditLease.view(result.lease, identity),
    };
  }

  @Mutation(() => ProjectEditLeaseResultType)
  async renewProjectResourceEditLease(
    @CurrentUser() user: User,
    @Args('input') input: ProjectEditLeaseChangeInput
  ) {
    const identity = { ...input, actorId: user.id, kind: 'user' as const };
    const result = await this.models.projectResourceEditLease.renew(identity);
    return {
      acquired: result.acquired,
      lease: this.models.projectResourceEditLease.view(result.lease, identity),
    };
  }

  @Mutation(() => Boolean)
  async releaseProjectResourceEditLease(
    @CurrentUser() user: User,
    @Args('input') input: ProjectEditLeaseChangeInput
  ) {
    return this.models.projectResourceEditLease.release({
      ...input,
      actorId: user.id,
      kind: 'user',
    });
  }
}
