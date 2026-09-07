import {
  Args,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { SafeIntResolver } from 'graphql-scalars';

import { Throttle } from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { Admin } from '../../../core/common';
import { Models } from '../../../models';
import { ByokService, ProjectByokInput } from './service';
import { ByokProvider } from './types';

@ObjectType()
class ProjectByokAuditEventType {
  @Field(() => SafeIntResolver)
  revision!: number;

  @Field()
  actorId!: string;

  @Field(() => ByokProvider)
  provider!: ByokProvider;

  @Field(() => String, { nullable: true })
  endpoint!: string | null;

  @Field()
  modelId!: string;

  @Field()
  enabled!: boolean;

  @Field()
  credentialChanged!: boolean;

  @Field()
  createdAt!: Date;
}

@ObjectType()
class ProjectByokSettingsType {
  @Field()
  configured!: boolean;

  @Field(() => SafeIntResolver)
  revision!: number;

  @Field(() => ByokProvider)
  provider!: ByokProvider;

  @Field(() => String, { nullable: true })
  endpoint!: string | null;

  @Field(() => String, { nullable: true })
  modelId!: string | null;

  @Field()
  enabled!: boolean;

  @Field(() => Date, { nullable: true })
  lastValidatedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  lastUsedAt!: Date | null;

  @Field(() => String, { nullable: true })
  lastError!: string | null;

  @Field(() => Date, { nullable: true })
  updatedAt!: Date | null;

  @Field(() => String, { nullable: true })
  updatedBy!: string | null;

  @Field(() => [ByokProvider])
  allowedProviders!: ByokProvider[];

  @Field()
  customEndpointSupported!: boolean;

  @Field(() => [ProjectByokAuditEventType])
  auditEvents!: ProjectByokAuditEventType[];
}

@ObjectType()
class ProjectByokTestResultType {
  @Field()
  ok!: boolean;

  @Field(() => String, { nullable: true })
  message!: string | null;
}

@InputType()
class ProjectByokConfigInput implements ProjectByokInput {
  @Field(() => SafeIntResolver)
  expectedRevision!: number;

  @Field(() => ByokProvider)
  provider!: ByokProvider;

  @Field(() => String, { nullable: true })
  apiKey?: string | null;

  @Field(() => String, { nullable: true })
  endpoint?: string | null;

  @Field()
  modelId!: string;
}

@Admin()
@Resolver()
export class ProjectByokResolver {
  constructor(private readonly byok: ByokService) {}

  @Query(() => ProjectByokSettingsType)
  adminProjectByokSettings(@CurrentUser() user: CurrentUser) {
    return this.byok.getAdminProjectSettings(user.id);
  }

  @Throttle('strict')
  @Mutation(() => ProjectByokTestResultType)
  testProjectByokConfig(
    @CurrentUser() user: CurrentUser,
    @Args('input') input: ProjectByokConfigInput
  ) {
    return this.byok.testProjectConfig(input, user.id);
  }

  @Throttle('strict')
  @Mutation(() => ProjectByokSettingsType)
  saveProjectByokConfig(
    @CurrentUser() user: CurrentUser,
    @Args('input') input: ProjectByokConfigInput
  ) {
    return this.byok.saveProjectConfig(input, user.id);
  }

  @Throttle('strict')
  @Mutation(() => ProjectByokSettingsType)
  setProjectByokEnabled(
    @CurrentUser() user: CurrentUser,
    @Args('expectedRevision', { type: () => SafeIntResolver })
    expectedRevision: number,
    @Args('enabled') enabled: boolean
  ) {
    return this.byok.setProjectConfigEnabled(
      expectedRevision,
      enabled,
      user.id
    );
  }
}

@ObjectType()
class ProjectAiModelType {
  @Field()
  configured!: boolean;

  @Field(() => String, { nullable: true })
  modelId!: string | null;

  @Field(() => ByokProvider, { nullable: true })
  provider!: ByokProvider | null;
}

@Resolver()
export class ProjectAiModelResolver {
  constructor(private readonly models: Models) {}

  @Query(() => ProjectAiModelType)
  async projectAiModel(
    @CurrentUser() user: CurrentUser,
    @Args('projectId') projectId: string
  ) {
    await this.models.copilotProjectByok.assertProjectMember(
      projectId,
      user.id
    );
    const config = await this.models.copilotProjectByok.get();
    return {
      configured: Boolean(config?.enabled),
      modelId: config?.enabled ? config.modelId : null,
      provider: config?.enabled ? config.provider : null,
    };
  }
}
