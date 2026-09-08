import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import {
  BadRequest,
  type FileUpload,
  readBufferWithLimit,
  Throttle,
} from '../../base';
import { Models } from '../../models';
import { PROJECT_BLOB_MAX_BYTES } from '../../models/project-resource';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { ProjectBlobStorage, ProjectResourceService } from './resources';
import {
  ChangeProjectResourceInput,
  CreateProjectFileInput,
  CreateProjectResourceInput,
  PermanentlyDeleteProjectResourceInput,
  ProjectResourcePageType,
  ProjectResourceRevisionType,
  ProjectResourceType,
  ProjectSearchPageType,
  SaveProjectDocumentInput,
} from './types';

@Resolver()
export class ProjectResourceResolver {
  constructor(
    private readonly models: Models,
    private readonly resources: ProjectResourceService,
    private readonly blobs: ProjectBlobStorage
  ) {}

  @Query(() => ProjectSearchPageType)
  async searchProjectResources(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('query') query: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ) {
    return this.models.projectResource.search({
      projectId,
      actorId: user.id,
      query,
      cursor,
      limit,
    });
  }

  @Query(() => ProjectResourcePageType)
  async projectResources(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('parentId', { type: () => String, nullable: true })
    parentId?: string | null,
    @Args('cursor', { type: () => String, nullable: true })
    cursor?: string | null,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('trash', { type: () => Boolean, nullable: true }) trash?: boolean,
    @Args('search', { type: () => String, nullable: true }) search?: string
  ) {
    return this.models.projectResource.list({
      projectId,
      actorId: user.id,
      parentId,
      cursor,
      limit,
      trash,
      search,
    });
  }

  @Query(() => ProjectResourceType)
  async projectResource(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string
  ) {
    return this.models.projectResource.get({
      projectId,
      resourceId,
      actorId: user.id,
    });
  }

  @Query(() => [ProjectResourceType])
  async projectResourcePath(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string
  ) {
    return this.models.projectResource.path({
      projectId,
      resourceId,
      actorId: user.id,
    });
  }

  @Query(() => ProjectResourceRevisionType)
  async projectResourceRevision(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('resourceId') resourceId: string,
    @Args('sequence', { type: () => Int, nullable: true }) sequence?: number
  ) {
    return this.models.projectResource.revision({
      projectId,
      resourceId,
      sequence,
      actorId: user.id,
    });
  }

  @Mutation(() => ProjectResourceType)
  @Throttle('strict')
  async createProjectResource(
    @CurrentUser() user: User,
    @Args('input') input: CreateProjectResourceInput
  ) {
    const scope = { ...input, actorId: user.id };
    if (input.kind === 'folder') {
      const folder = await this.resources.createFolder(scope);
      return folder;
    }
    if (input.kind !== 'page' && input.kind !== 'edgeless')
      throw new BadRequest('Use the native resource import for this file type');
    return this.resources.createDocument({
      ...scope,
      kind: input.kind,
      origin: 'user',
    });
  }

  @Mutation(() => ProjectResourceType)
  async createProjectFile(
    @CurrentUser() user: User,
    @Args('input') input: CreateProjectFileInput
  ) {
    return this.resources.createFile({ ...input, actorId: user.id });
  }

  @Mutation(() => String)
  @Throttle('strict')
  async uploadProjectBlob(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload
  ) {
    const scope = { projectId, actorId: user.id };
    await this.models.projectResource.assertMember(scope);
    const bytes = await readBufferWithLimit(
      file.createReadStream(),
      PROJECT_BLOB_MAX_BYTES
    );
    const blob = await this.blobs.put({
      ...scope,
      bytes,
      mimeType: file.mimetype || 'application/octet-stream',
    });
    return blob.key;
  }

  @Mutation(() => ProjectResourceType)
  @Throttle('strict')
  async changeProjectResource(
    @CurrentUser() user: User,
    @Args('input') input: ChangeProjectResourceInput
  ) {
    const resource = await this.resources.change({
      ...input,
      editLease: input.editLease
        ? { ...input.editLease, kind: 'user' }
        : undefined,
      actorId: user.id,
    });
    return resource;
  }

  @Mutation(() => Boolean)
  @Throttle('strict')
  async permanentlyDeleteProjectResource(
    @CurrentUser() user: User,
    @Args('input') input: PermanentlyDeleteProjectResourceInput
  ) {
    return this.models.projectResource.permanentlyDelete({
      ...input,
      actorId: user.id,
    });
  }

  @Mutation(() => ProjectResourceRevisionType)
  async saveProjectDocument(
    @CurrentUser() user: User,
    @Args('input') input: SaveProjectDocumentInput
  ) {
    if (
      input.snapshotBase64.length > 24 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(input.snapshotBase64)
    )
      throw new BadRequest('Invalid Project document snapshot');
    return this.resources.saveDocument({
      ...input,
      editLease: { ...input.editLease, kind: 'user' },
      actorId: user.id,
      bytes: Buffer.from(input.snapshotBase64, 'base64'),
      origin: 'user',
    });
  }
}
