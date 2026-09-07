import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

import { applyAttachHeaders, BadRequest } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { ProjectBlobStorage, ProjectResourceService } from './resources';

@Controller('/api/projects')
export class ProjectResourceController {
  constructor(
    private readonly resources: ProjectResourceService,
    private readonly blobs: ProjectBlobStorage,
    private readonly models: Models
  ) {}

  @Get('/:projectId/resources/:resourceId/revisions/:sequence')
  async document(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Param('resourceId') resourceId: string,
    @Param('sequence') sequence: string,
    @Res() response: Response
  ) {
    if (
      sequence !== 'current' &&
      (!/^\d+$/.test(sequence) ||
        !Number.isSafeInteger(Number(sequence)) ||
        Number(sequence) < 1)
    )
      throw new BadRequest('Invalid Project revision');
    const result = await this.resources.readDocument({
      projectId,
      resourceId,
      actorId: user.id,
      sequence: sequence === 'current' ? undefined : Number(sequence),
    });
    response.setHeader('content-type', 'application/vnd.localmind.yjs');
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader(
      'x-project-content-version',
      String(result.revision.sequence)
    );
    response.send(result.bytes);
  }

  @Get('/:projectId/files/:resourceId')
  async file(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Param('resourceId') resourceId: string,
    @Res() response: Response
  ) {
    const result = await this.resources.readFile({
      projectId,
      resourceId,
      actorId: user.id,
    });
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    applyAttachHeaders(response, {
      contentType: result.blob.mimeType,
      filename: result.resource.title,
    });
    response.send(result.bytes);
  }

  @Get('/:projectId/blobs/:key')
  async blob(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Param('key') key: string,
    @Res() response: Response
  ) {
    await this.models.projectResource.assertBlobDownload({
      projectId,
      key,
      actorId: user.id,
    });
    const { bytes, blob } = await this.blobs.read({
      projectId,
      key,
      actorId: user.id,
    });
    await this.models.projectResource.assertBlobDownload({
      projectId,
      key,
      actorId: user.id,
    });
    response.setHeader('content-type', blob.mimeType);
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader(
      'content-security-policy',
      "default-src 'none'; sandbox"
    );
    response.send(bytes);
  }
}
