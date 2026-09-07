import {
  Args,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import { type FileUpload, readBufferWithLimit, Throttle } from '../../base';
import { CurrentUser, type CurrentUser as User } from '../../core/auth';
import { Models } from '../../models';
import { ProjectContextService } from './project-context-service';

@InputType()
class ProjectChatContextItemInput {
  @Field() kind!: string;
  @Field(() => String, { nullable: true }) resourceId?: string;
  @Field(() => Int, { nullable: true }) sequence?: number;
  @Field(() => String, { nullable: true }) blobKey?: string;
  @Field(() => String, { nullable: true }) name?: string;
}

@ObjectType()
class ProjectChatContextItemType {
  @Field() kind!: string;
  @Field() title!: string;
  @Field() available!: boolean;
  @Field(() => String, { nullable: true }) resourceId?: string;
  @Field(() => Int, { nullable: true }) sequence?: number;
  @Field(() => String, { nullable: true }) blobKey?: string;
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => String, { nullable: true }) resourceKind?: string | null;
  @Field(() => Int, { nullable: true }) currentSequence?: number | null;
  @Field(() => String, { nullable: true }) mimeType?: string | null;
  @Field(() => Int, { nullable: true }) byteSize?: number | null;
}

@ObjectType()
class ProjectChatContextType {
  @Field() projectId!: string;
  @Field() sessionId!: string;
  @Field(() => Int) version!: number;
  @Field(() => [ProjectChatContextItemType])
  items!: ProjectChatContextItemType[];
}

@Resolver()
export class ProjectContextResolver {
  constructor(
    private readonly models: Models,
    private readonly context: ProjectContextService
  ) {}

  @Query(() => ProjectChatContextType)
  projectChatContext(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('sessionId') sessionId: string
  ) {
    return this.context.view({ actorId: user.id, projectId, sessionId });
  }

  @Mutation(() => ProjectChatContextType)
  @Throttle('strict')
  async updateProjectChatContext(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('sessionId') sessionId: string,
    @Args('expectedVersion', { type: () => Int }) expectedVersion: number,
    @Args('items', { type: () => [ProjectChatContextItemInput] })
    items: ProjectChatContextItemInput[]
  ) {
    const scope = { actorId: user.id, projectId, sessionId };
    await this.models.copilotProjectContext.set({
      ...scope,
      expectedVersion,
      items: JSON.parse(JSON.stringify(items)),
    });
    return this.context.view(scope);
  }

  @Mutation(() => ProjectChatContextType)
  @Throttle('strict')
  async uploadProjectChatContextFile(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('sessionId') sessionId: string,
    @Args('expectedVersion', { type: () => Int }) expectedVersion: number,
    @Args('file', { type: () => GraphQLUpload }) file: FileUpload
  ) {
    await this.models.copilotProjectContext.get({
      actorId: user.id,
      projectId,
      sessionId,
    });
    const bytes = await readBufferWithLimit(
      file.createReadStream(),
      50 * 1024 * 1024
    );
    return this.context.upload({
      actorId: user.id,
      projectId,
      sessionId,
      expectedVersion,
      bytes,
      mimeType: file.mimetype,
      name: file.filename,
    });
  }
}
