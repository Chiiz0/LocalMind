import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
} from '@nestjs/graphql';
import { ProjectResourceKind } from '@prisma/client';

import { BadRequest, Throttle } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { PermissionAccess } from '../permission';
import { ProjectResourceType } from '../project/types';
import { ProjectImportService } from './import-service';

@InputType()
export class ImportWorkspaceResourceToProjectInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID) workspaceId!: string;
  @Field(() => ID) sourceResourceId!: string;
  @Field(() => ID, { nullable: true }) parentId?: string | null;
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => ProjectResourceKind) kind!: ProjectResourceKind;
  @Field() requestKey!: string;
}

@ObjectType()
export class ProjectImportPermissionRequestType {
  @Field(() => ID) id!: string;
  @Field() status!: string;
  @Field() purpose!: string;
}

@Resolver()
export class ProjectImportResolver {
  constructor(
    private readonly imports: ProjectImportService,
    private readonly models: Models,
    private readonly ac: PermissionAccess
  ) {}

  @Mutation(() => ProjectResourceType)
  @Throttle('strict')
  async importWorkspaceResourceToProject(
    @CurrentUser() user: User,
    @Args('input') input: ImportWorkspaceResourceToProjectInput
  ) {
    if (input.kind === 'folder')
      throw new BadRequest(
        'Choose a document or native Office resource to import'
      );
    return this.imports.import({
      ...input,
      kind: input.kind,
      actorId: user.id,
    });
  }

  @Mutation(() => ProjectImportPermissionRequestType)
  @Throttle('strict')
  async requestProjectImportPermission(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('resourceId') resourceId: string,
    @Args('requestKey') requestKey: string
  ) {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    await this.ac
      .user(user.id)
      .doc(workspaceId, resourceId)
      .projectScope(null)
      .assert('Doc.Read');
    const result =
      await this.models.intelligenceWorkbenchAuthorization.requestProjectCopy({
        projectId,
        workspaceId,
        docId: resourceId,
        actorId: user.id,
        requestKey,
      });
    return {
      id: result.request.id,
      status: result.request.status,
      purpose: result.request.purpose,
    };
  }
}
