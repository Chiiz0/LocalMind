import { UseInterceptors } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ClsInterceptor } from 'nestjs-cls';
import type { Server, Socket } from 'socket.io';
import { diffUpdate, encodeStateVectorFromUpdate } from 'yjs';
import { z } from 'zod';

import { AccessDenied, GatewayErrorWrapper, OnEvent } from '../../base';
import { Models } from '../../models';
import { CurrentUser, type CurrentUser as User } from '../auth';
import { ProjectResourceService } from './resources';

const projectMessage = z
  .object({ projectId: z.string().min(1).max(512) })
  .strict();
const readMessage = projectMessage
  .extend({
    resourceId: z.string().min(1).max(512),
    stateVector: z
      .string()
      .max(1024 * 1024)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .optional(),
  })
  .strict();

@WebSocketGateway()
@UseInterceptors(ClsInterceptor)
export class ProjectResourceGateway {
  @WebSocketServer() private readonly server!: Server;

  constructor(
    private readonly models: Models,
    private readonly resources: ProjectResourceService
  ) {}

  @SubscribeMessage('project:join')
  @GatewayErrorWrapper('project:join')
  async join(
    @CurrentUser() user: User,
    @ConnectedSocket() client: Socket,
    @MessageBody() message: unknown
  ) {
    const { projectId } = projectMessage.parse(message);
    const rooms = [...client.rooms].filter(room =>
      room.startsWith('project-resources:')
    );
    if (rooms.length >= 64 && !client.rooms.has(this.room(projectId)))
      throw new AccessDenied('Too many Project subscriptions');
    await this.models.projectResource.withMember(
      { projectId, actorId: user.id },
      async () => {
        client.data.projectResourceActorId = user.id;
        await client.join(this.room(projectId));
      }
    );
    return { data: { success: true } };
  }

  @SubscribeMessage('project:leave')
  @GatewayErrorWrapper('project:leave')
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: unknown
  ) {
    const { projectId } = projectMessage.parse(message);
    await client.leave(this.room(projectId));
    return { data: { success: true } };
  }

  @SubscribeMessage('project:load-document')
  @GatewayErrorWrapper('project:load-document')
  async load(
    @CurrentUser() user: User,
    @ConnectedSocket() client: Socket,
    @MessageBody() message: unknown
  ) {
    const input = readMessage.parse(message);
    if (!client.rooms.has(this.room(input.projectId)))
      throw new AccessDenied('Join the Project before synchronizing');
    const current = await this.resources.readDocument({
      ...input,
      actorId: user.id,
    });
    const missing = input.stateVector
      ? diffUpdate(current.bytes, Buffer.from(input.stateVector, 'base64'))
      : current.bytes;
    return {
      data: {
        projectId: input.projectId,
        resourceId: input.resourceId,
        missing: Buffer.from(missing).toString('base64'),
        state: Buffer.from(encodeStateVectorFromUpdate(current.bytes)).toString(
          'base64'
        ),
        contentVersion: current.revision.sequence,
      },
    };
  }

  @OnEvent('project.resource.changed')
  async changed(input: Events['project.resource.changed']) {
    if (!this.server) return;
    const room = this.room(input.projectId);
    const sockets = await this.server.in(room).fetchSockets();
    for (const socket of sockets) {
      const actorId: unknown = socket.data.projectResourceActorId;
      if (typeof actorId !== 'string') continue;
      try {
        await this.models.projectResource.withMember(
          { projectId: input.projectId, actorId },
          async () => {
            socket.emit('project:resource-changed', input);
          }
        );
      } catch {
        socket.leave(room);
      }
    }
  }

  private room(projectId: string) {
    return `project-resources:${projectId}`;
  }
}
