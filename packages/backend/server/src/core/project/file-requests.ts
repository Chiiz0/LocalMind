import { createHash } from 'node:crypto';

import { Controller, Get, Injectable, Param, Res } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import type { Response } from 'express';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import { z } from 'zod';

import {
  applyAttachHeaders,
  BadRequest,
  EventBus,
  type FileUpload,
  readBufferWithLimit,
  Throttle,
} from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { ProjectBlobStorage } from './resources';

export const FILE_REQUEST_MAX_BYTES = 32 * 1024 * 1024;

@ObjectType()
export class ProjectFileRequestType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field() projectName!: string;
  @Field() title!: string;
  @Field() requesterName!: string;
  @Field() recipientName!: string;
  @Field() status!: string;
  @Field(() => Int) version!: number;
  @Field() isRecipient!: boolean;
  @Field(() => String, { nullable: true }) fileName!: string | null;
  @Field(() => ID, { nullable: true }) resourceId!: string | null;
  @Field() updatedAt!: Date;
}

@ObjectType()
class FileRequestRecipientType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}

@InputType()
class CreateFileRequestInput {
  @Field(() => ID) projectId!: string;
  @Field(() => ID) recipientId!: string;
  @Field() title!: string;
  @Field() requestKey!: string;
}

@Injectable()
export class ProjectFileRequestService {
  constructor(
    private readonly models: Models,
    private readonly blobs: ProjectBlobStorage,
    private readonly events: EventBus
  ) {}

  async submit(input: {
    requestId: string;
    actorId: string;
    expectedVersion: number;
    shareWithProject: boolean;
    file: FileUpload;
  }) {
    if (input.shareWithProject !== true)
      throw new BadRequest(
        'Confirm sharing this file with the Project members'
      );
    const request = await this.models.projectFileRequest.get(
      input.requestId,
      input.actorId
    );
    if (request.recipientId !== input.actorId)
      throw new BadRequest('Only the recipient can submit this file');
    const fileName = z
      .string()
      .trim()
      .min(1)
      .max(512)
      .refine(
        name =>
          !/[/\\]/.test(name) &&
          ![...name].some(char => char.charCodeAt(0) < 32) &&
          name !== '.' &&
          name !== '..'
      )
      .parse(input.file.filename);
    const bytes = await readBufferWithLimit(
      input.file.createReadStream(),
      FILE_REQUEST_MAX_BYTES
    );
    const mimeType = input.file.mimetype || 'application/octet-stream';
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([fileName, mimeType]))
      .update(bytes)
      .digest('hex');
    const completed = await this.models.projectFileRequest.deliver(
      { ...input, fileName, fingerprint },
      async current => {
        // The sender's live request authorizes this exact deposit. The delivery event attributes the uploader separately.
        const scope = {
          projectId: current.projectId,
          actorId: current.requesterId,
        };
        const blob = await this.blobs.put({ ...scope, bytes, mimeType });
        const resource = await this.models.projectResource.create({
          ...scope,
          kind: 'file',
          title: fileName,
          blobKey: blob.key,
          origin: 'import',
          requestKey: `file-request:${current.id}`,
        });
        return resource.id;
      }
    );
    if (completed.resourceId)
      this.events.emitDetached('project.resource.changed', {
        projectId: completed.projectId,
        resourceId: completed.resourceId,
      });
    return completed;
  }

  async download(requestId: string, actorId: string) {
    const request = await this.models.projectFileRequest.get(
      requestId,
      actorId
    );
    if (request.status !== 'completed' || !request.resourceId)
      throw new BadRequest('No file has been submitted');
    const scope = {
      projectId: request.projectId,
      actorId: request.requesterId,
      resourceId: request.resourceId,
    };
    const resource = await this.models.projectResource.get(scope);
    // A file request shares the delivered version only, never later Project edits.
    const revision = await this.models.projectResource.revision({
      ...scope,
      sequence: 1,
    });
    const file = await this.blobs.read({ ...scope, key: revision.blobKey });
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([request.fileName, file.blob.mimeType]))
      .update(file.bytes)
      .digest('hex');
    if (fingerprint !== request.deliveryFingerprint)
      throw new BadRequest('File delivery evidence does not match');
    await this.models.projectFileRequest.get(requestId, actorId);
    return { ...file, resource, fileName: request.fileName as string };
  }
}

@Resolver()
export class ProjectFileRequestResolver {
  constructor(
    private readonly models: Models,
    private readonly service: ProjectFileRequestService
  ) {}

  @Query(() => [FileRequestRecipientType])
  async projectFileRequestRecipients(
    @CurrentUser() user: User,
    @Args('projectId') projectId: string,
    @Args('query') query: string
  ) {
    return this.models.projectFileRequest.recipients({
      projectId,
      actorId: user.id,
      query,
    });
  }

  @Query(() => ProjectFileRequestType)
  async projectFileRequest(
    @CurrentUser() user: User,
    @Args('requestId') requestId: string
  ) {
    return this.models.projectFileRequest.present(
      await this.models.projectFileRequest.get(requestId, user.id),
      user.id
    );
  }

  @Mutation(() => ProjectFileRequestType)
  @Throttle('strict')
  async createProjectFileRequest(
    @CurrentUser() user: User,
    @Args('input') input: CreateFileRequestInput
  ) {
    return this.models.projectFileRequest.present(
      await this.models.projectFileRequest.create({
        ...input,
        actorId: user.id,
      }),
      user.id
    );
  }

  @Mutation(() => ProjectFileRequestType)
  @Throttle('strict')
  async changeProjectFileRequest(
    @CurrentUser() user: User,
    @Args('requestId') requestId: string,
    @Args('expectedVersion', { type: () => Int }) expectedVersion: number,
    @Args('action') action: string
  ) {
    const request = await this.models.projectFileRequest.change({
      requestId,
      actorId: user.id,
      expectedVersion,
      action: z.enum(['start', 'decline', 'cancel']).parse(action),
    });
    return this.models.projectFileRequest.present(request, user.id);
  }

  @Mutation(() => ProjectFileRequestType)
  @Throttle('strict')
  async submitProjectFileRequest(
    @CurrentUser() user: User,
    @Args('requestId') requestId: string,
    @Args('expectedVersion', { type: () => Int }) expectedVersion: number,
    @Args('shareWithProject') shareWithProject: boolean,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload
  ) {
    return this.models.projectFileRequest.present(
      await this.service.submit({
        requestId,
        actorId: user.id,
        expectedVersion,
        shareWithProject,
        file,
      }),
      user.id
    );
  }
}

@Controller('/api/project-file-requests')
export class ProjectFileRequestController {
  constructor(private readonly service: ProjectFileRequestService) {}

  @Get('/:requestId/file')
  async download(
    @CurrentUser() user: User,
    @Param('requestId') requestId: string,
    @Res() response: Response
  ) {
    const result = await this.service.download(requestId, user.id);
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    applyAttachHeaders(response, {
      filename: result.fileName,
      contentType: result.blob.mimeType,
    });
    response.send(result.bytes);
  }
}
