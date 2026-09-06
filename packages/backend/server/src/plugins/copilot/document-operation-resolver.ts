import {
  Args,
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import { BadRequest, Throttle } from '../../base';
import { type CurrentUser as Actor, CurrentUser } from '../../core/auth';
import { DocumentDestinationService } from '../../core/doc';
import { Models } from '../../models';
import { CopilotDocumentOperationService } from './document-operation-service';
import { CopilotType } from './resolver';

@ObjectType()
class CopilotDocumentOperationType {
  @Field() kind!: string;
  @Field(() => ID, { nullable: true }) sourceWorkspaceId!: string | null;
  @Field(() => ID, { nullable: true }) sourceDocumentId!: string | null;
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() status!: string;
  @Field() projectStatus!: string;
  @Field(() => ID) documentId!: string;
  @Field(() => ID, { nullable: true }) destinationWorkspaceId!: string | null;
  @Field(() => ID, { nullable: true }) destinationFolderId!: string | null;
  @Field(() => Int) destinationRevision!: number;
  @Field(() => GraphQLISODateTime) locationExpiresAt!: Date;
  @Field(() => GraphQLISODateTime, { nullable: true })
  createdDocumentAt!: Date | null;
  @Field(() => GraphQLISODateTime, { nullable: true })
  placedDocumentAt!: Date | null;
  @Field(() => String, { nullable: true }) failureCode!: string | null;
  @Field(() => ID, { nullable: true }) accessRequestId!: string | null;
}

@ObjectType()
class CopilotDocumentWorkspaceType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}

@ObjectType()
class CopilotDocumentFolderType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}

@ObjectType()
class CopilotDocumentFoldersType {
  @Field(() => [CopilotDocumentFolderType]) items!: CopilotDocumentFolderType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
}

@InputType()
class ConfirmCopilotDocumentDestinationInput {
  @Field(() => ID) operationId!: string;
  @Field(() => ID) workspaceId!: string;
  @Field(() => ID, { nullable: true }) folderId!: string | null;
  @Field(() => Boolean) root!: boolean;
  @Field(() => Int) expectedRevision!: number;
}

@Throttle()
@Resolver(() => CopilotType)
export class CopilotDocumentOperationResolver {
  constructor(
    private readonly models: Models,
    private readonly service: CopilotDocumentOperationService,
    private readonly destinations: DocumentDestinationService
  ) {}

  @ResolveField(() => [CopilotDocumentOperationType])
  async documentOperations(
    @CurrentUser() user: Actor,
    @Args('sessionId', { type: () => ID }) sessionId: string,
    @Args('after', { type: () => ID, nullable: true }) after?: string
  ) {
    return await this.models.copilotDocumentOperation.list(
      sessionId,
      user.id,
      after
    );
  }

  @ResolveField(() => [CopilotDocumentWorkspaceType])
  async documentDestinationWorkspaces(@CurrentUser() user: Actor) {
    return await this.destinations.workspaces(user.id);
  }

  @ResolveField(() => CopilotDocumentFoldersType)
  async documentDestinationFolders(
    @CurrentUser() user: Actor,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('after', { type: () => String, nullable: true }) after?: string
  ) {
    const page = await this.destinations.folders({
      actorId: user.id,
      workspaceId,
      after,
    });
    return {
      nextCursor: page.nextCursor,
      items: page.items.map(item => ({
        id: item.folderId,
        name: item.path.map(folder => folder.name).join(' / '),
      })),
    };
  }

  @Mutation(() => CopilotDocumentOperationType)
  async confirmCopilotDocumentDestination(
    @CurrentUser() user: Actor,
    @Args('input') input: ConfirmCopilotDocumentDestinationInput
  ) {
    if ((input.root && input.folderId) || (!input.root && !input.folderId))
      throw new BadRequest('Choose either the workspace root or one directory');
    const confirmed = await this.service.confirmDestination({
      ...input,
      actorId: user.id,
      folderId: input.root ? null : input.folderId,
    });
    await this.service.execute({
      operationId: confirmed.id,
      actorId: user.id,
      expectedRevision: confirmed.destinationRevision,
    });
    await this.service.resumeDelegatedOperation(confirmed.id, user.id);
    return await this.models.copilotDocumentOperation.receipt({
      operationId: confirmed.id,
      actorId: user.id,
    });
  }

  @Mutation(() => CopilotDocumentOperationType)
  async withdrawCopilotDocumentOperation(
    @CurrentUser() user: Actor,
    @Args('operationId', { type: () => ID }) operationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number
  ) {
    return await this.service.withdraw({
      operationId,
      actorId: user.id,
      expectedRevision,
    });
  }

  @Mutation(() => CopilotDocumentOperationType)
  async retryCopilotDocumentOperation(
    @CurrentUser() user: Actor,
    @Args('operationId', { type: () => ID }) operationId: string,
    @Args('expectedRevision', { type: () => Int }) expectedRevision: number
  ) {
    await this.service.execute({
      operationId,
      actorId: user.id,
      expectedRevision,
    });
    await this.service.resumeDelegatedOperation(operationId, user.id);
    return await this.models.copilotDocumentOperation.receipt({
      operationId,
      actorId: user.id,
    });
  }
}
