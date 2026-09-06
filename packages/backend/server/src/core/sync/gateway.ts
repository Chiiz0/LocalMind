import {
  applyDecorators,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UseInterceptors,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage as RawSubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Request } from 'express';
import { ClsInterceptor } from 'nestjs-cls';
import semver from 'semver';
import { type Server, Socket } from 'socket.io';
import { diffUpdate, encodeStateVectorFromUpdate } from 'yjs';

import {
  CallMetric,
  checkCanaryDateClientVersion,
  DocNotFound,
  DocUpdateBlocked,
  EventBus,
  GatewayErrorWrapper,
  metrics,
  NotInSpace,
  OnEvent,
  SpaceAccessDenied,
} from '../../base';
import { Models } from '../../models';
import { buildPublicRootDoc } from '../../native';
import { CurrentUser } from '../auth';
import {
  DocReader,
  DocStorageAdapter,
  PgUserspaceDocStorageAdapter,
  PgWorkspaceDocStorageAdapter,
  WorkspaceOrganizationService,
} from '../doc';
import { applyUpdatesWithNative } from '../doc/merge-updates';
import {
  type DocAction,
  PermissionAccess,
  WorkspaceAction,
} from '../permission';
import { DocID } from '../utils/doc';

const SubscribeMessage = (event: string) =>
  applyDecorators(
    GatewayErrorWrapper(event),
    CallMetric('socketio', 'event_duration', { event }),
    RawSubscribeMessage(event)
  );

type EventResponse<Data = any> = Data extends never
  ? {
      data?: never;
    }
  : {
      data: Data;
    };

// sync: shared room for space membership checks and non-protocol broadcasts.
// sync-025: legacy 0.25 doc sync protocol (space:broadcast-doc-update).
// sync-026: current doc sync protocol (space:broadcast-doc-updates).
type RoomType = 'sync' | 'sync-025' | 'sync-026' | `${string}:awareness`;

function Room(
  spaceId: string,
  type: RoomType = 'sync'
): `${string}:${RoomType}` {
  return `${spaceId}:${type}`;
}

const MIN_WS_CLIENT_VERSION = new semver.Range('>=0.25.0', {
  includePrerelease: true,
});
const DOC_UPDATES_PROTOCOL_026 = new semver.Range('>=0.26.0-0', {
  includePrerelease: true,
});

type SyncProtocolRoomType = Extract<RoomType, 'sync-025' | 'sync-026'>;
const SOCKET_PRESENCE_USER_ID_KEY = 'affinePresenceUserId';

function normalizeWsClientVersion(clientVersion: string): string | null {
  const canaryCheck = checkCanaryDateClientVersion(clientVersion);
  if (!canaryCheck.matched) {
    return clientVersion;
  }

  if (!env.namespaces.canary) {
    return null;
  }

  return canaryCheck.allowed ? canaryCheck.normalized : null;
}

function isSupportedWsClientVersion(clientVersion: string): boolean {
  const normalized = normalizeWsClientVersion(clientVersion);
  if (!normalized) {
    return false;
  }

  return Boolean(
    semver.valid(normalized) && MIN_WS_CLIENT_VERSION.test(normalized)
  );
}

function getSyncProtocolRoomType(clientVersion: string): SyncProtocolRoomType {
  const normalized = normalizeWsClientVersion(clientVersion);
  return DOC_UPDATES_PROTOCOL_026.test(normalized ?? clientVersion)
    ? 'sync-026'
    : 'sync-025';
}

enum SpaceType {
  Workspace = 'workspace',
  Userspace = 'userspace',
}

interface JoinSpaceMessage {
  spaceType: SpaceType;
  spaceId: string;
  clientVersion: string;
  docScopeId?: string;
}

interface JoinSpaceAwarenessMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  clientVersion: string;
}

interface LeaveSpaceMessage {
  spaceType: SpaceType;
  spaceId: string;
  docScopeId?: string;
}

interface LeaveSpaceAwarenessMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
}

interface PushDocUpdateMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  update: string;
  docScopeId?: string;
}

interface BroadcastDocUpdatesMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  updates: string[];
  timestamp: number;
  editor?: string;
  compressed?: boolean;
}

interface BroadcastDocUpdateMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  update: string;
  timestamp: number;
  editor: string;
}

interface LoadDocMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  stateVector?: string;
  docScopeId?: string;
}

interface DeleteDocMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  docScopeId?: string;
}

interface LoadDocTimestampsMessage {
  spaceType: SpaceType;
  spaceId: string;
  timestamp?: number;
  docScopeId?: string;
}

interface DocScopeBinding {
  spaceId: string;
  docId: string;
}

interface LoadSpaceAwarenessesMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
}
interface UpdateAwarenessMessage {
  spaceType: SpaceType;
  spaceId: string;
  docId: string;
  awarenessUpdate: string;
}

@WebSocketGateway()
@UseInterceptors(ClsInterceptor)
export class SpaceSyncGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  protected logger = new Logger(SpaceSyncGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  private connectionCount = 0;
  private readonly socketUsers = new Map<string, string>();
  private readonly localUserConnectionCounts = new Map<string, number>();
  private unresolvedPresenceSockets = 0;
  private flushTimer?: NodeJS.Timeout;
  private activeUsersFlushTimer?: NodeJS.Timeout;
  private activeUsersFlushInFlight = false;
  private activeUsersFlushQueued = false;
  private readonly docScopeBindings = new WeakMap<Socket, DocScopeBinding>();
  private readonly joinOperations = new WeakMap<Socket, Promise<void>>();

  constructor(
    private readonly ac: PermissionAccess,
    private readonly event: EventBus,
    private readonly workspace: PgWorkspaceDocStorageAdapter,
    private readonly userspace: PgUserspaceDocStorageAdapter,
    private readonly docReader: DocReader,
    private readonly models: Models,
    private readonly organization: WorkspaceOrganizationService
  ) {}

  onModuleInit() {
    this.scheduleActiveUsersFlush(0);
    this.flushTimer = setInterval(() => {
      this.scheduleActiveUsersFlush(0);
    }, 60_000);
    this.flushTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (this.activeUsersFlushTimer) {
      clearTimeout(this.activeUsersFlushTimer);
      this.activeUsersFlushTimer = undefined;
    }
    this.activeUsersFlushQueued = false;
  }

  private encodeUpdates(updates: Uint8Array[]) {
    return updates.map(update => Buffer.from(update).toString('base64'));
  }

  private buildBroadcastPayload(
    spaceType: SpaceType,
    spaceId: string,
    docId: string,
    updates: Uint8Array[],
    timestamp: number,
    editor?: string
  ): BroadcastDocUpdatesMessage {
    const encodedUpdates = this.encodeUpdates(updates);
    if (updates.length <= 1) {
      return {
        spaceType,
        spaceId,
        docId,
        updates: encodedUpdates,
        timestamp,
        editor,
        compressed: false,
      };
    }

    try {
      const merged = applyUpdatesWithNative(
        updates,
        'socketio.broadcast',
        this.logger
      );
      metrics.socketio.counter('doc_updates_compressed').add(1);
      return {
        spaceType,
        spaceId,
        docId,
        updates: [Buffer.from(merged).toString('base64')],
        timestamp,
        editor,
        compressed: true,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to merge updates for broadcast, falling back to batch: ${this.formatError(error)}`
      );
      return {
        spaceType,
        spaceId,
        docId,
        updates: encodedUpdates,
        timestamp,
        editor,
        compressed: false,
      };
    }
  }

  private async broadcastDocUpdate(
    client: Socket,
    adapter: SyncSocketAdapter,
    spaceType: SpaceType,
    spaceId: string,
    docId: string,
    update: string,
    timestamp: number,
    editor: string
  ) {
    if (
      spaceType === SpaceType.Workspace &&
      docId === `db$${spaceId}$folders`
    ) {
      await this.broadcastDirectoryUpdate({
        spaceId,
        docId,
        updates: [Buffer.from(update, 'base64')],
        timestamp,
        editor,
        excludeSocketId: client.id,
      });
      return;
    }
    const payload = this.buildBroadcastPayload(
      spaceType,
      spaceId,
      docId,
      [Buffer.from(update, 'base64')],
      timestamp,
      editor
    );
    client
      .to(adapter.room(spaceId, 'sync-026'))
      .emit('space:broadcast-doc-updates', payload);
    metrics.socketio
      .counter('doc_updates_broadcast')
      .add(payload.updates.length, {
        mode: payload.compressed ? 'compressed' : 'batch',
      });

    client
      .to(adapter.room(spaceId, 'sync-025'))
      .emit('space:broadcast-doc-update', {
        spaceType,
        spaceId,
        docId,
        update,
        timestamp,
        editor,
      } satisfies BroadcastDocUpdateMessage);
  }

  private async broadcastDirectoryUpdate(input: {
    spaceId: string;
    docId: string;
    updates: Uint8Array[];
    timestamp: number;
    editor?: string | null;
    excludeSocketId?: string;
  }) {
    const rooms = [
      `${SpaceType.Workspace}:${Room(input.spaceId, 'sync-025')}`,
      `${SpaceType.Workspace}:${Room(input.spaceId, 'sync-026')}`,
    ];
    await this.models.workspaceDirectoryGrant.withMutationLock(
      input.spaceId,
      async () => {
        const sockets = await this.server.in(rooms).fetchSockets();
        const access = new Map<string, boolean>();
        const payload = this.buildBroadcastPayload(
          SpaceType.Workspace,
          input.spaceId,
          input.docId,
          input.updates,
          input.timestamp,
          input.editor ?? undefined
        );
        for (const socket of sockets) {
          if (socket.id === input.excludeSocketId) continue;
          const actorId = this.resolvePresenceUserId(socket);
          if (!actorId) continue;
          let allowed = access.get(actorId);
          if (allowed === undefined) {
            allowed =
              (await this.ac
                .user(actorId)
                .doc(input.spaceId, input.docId)
                .projectScope(null)
                .can('Doc.Read')) &&
              (await this.models.workspaceDirectoryGrant.canReadWholeTable(
                input.spaceId,
                actorId
              ));
            access.set(actorId, allowed);
          }
          if (!allowed) continue;
          if (socket.rooms.has(rooms[1]))
            socket.emit('space:broadcast-doc-updates', payload);
          if (socket.rooms.has(rooms[0])) {
            for (const update of this.encodeUpdates(input.updates))
              socket.emit('space:broadcast-doc-update', {
                spaceType: SpaceType.Workspace,
                spaceId: input.spaceId,
                docId: input.docId,
                update,
                timestamp: input.timestamp,
                editor: input.editor ?? '',
              });
          }
        }
      }
    );
  }

  private rejectJoin(client: Socket) {
    // Give socket.io a chance to flush the ack packet before disconnecting.
    setImmediate(() => client.disconnect());
  }

  private async assertDocActionAllowed(
    spaceType: SpaceType,
    userId: string,
    spaceId: string,
    docId: string,
    action: DocAction
  ) {
    if (spaceType === SpaceType.Userspace) {
      if (spaceId !== userId) {
        throw new SpaceAccessDenied({ spaceId });
      }
      return;
    }

    await this.ac.user(userId).doc(spaceId, docId).assert(action);
  }

  private normalizeDocScopeId(
    spaceType: SpaceType,
    spaceId: string,
    docScopeId: string
  ) {
    if (
      spaceType !== SpaceType.Workspace ||
      typeof docScopeId !== 'string' ||
      !docScopeId.trim()
    ) {
      throw new SpaceAccessDenied({ spaceId });
    }

    try {
      const normalized = new DocID(docScopeId, spaceId).guid;
      if (normalized === spaceId || normalized === `db$${spaceId}$folders`) {
        throw new SpaceAccessDenied({ spaceId });
      }
      return normalized;
    } catch (error) {
      if (error instanceof SpaceAccessDenied) {
        throw error;
      }
      throw new SpaceAccessDenied({ spaceId });
    }
  }

  private hasWorkspaceSyncRoom(client: Socket) {
    return Array.from(client.rooms).some(room =>
      /:(?:sync|sync-025|sync-026)$/.test(room)
    );
  }

  private assertScopedBinding(
    client: Socket,
    message: {
      spaceType: SpaceType;
      spaceId: string;
      docScopeId: string;
    }
  ) {
    const docId = this.normalizeDocScopeId(
      message.spaceType,
      message.spaceId,
      message.docScopeId
    );
    const binding = this.docScopeBindings.get(client);
    if (
      !binding ||
      binding.spaceId !== message.spaceId ||
      binding.docId !== docId
    ) {
      throw new NotInSpace({ spaceId: message.spaceId });
    }
    return binding;
  }

  private assertScopedDocumentRequest(
    client: Socket,
    message: {
      spaceType: SpaceType;
      spaceId: string;
      docId: string;
      docScopeId: string;
    },
    allowSyntheticRoot: boolean
  ) {
    const binding = this.assertScopedBinding(client, message);
    const requestedDocId = new DocID(message.docId, message.spaceId).guid;
    if (
      requestedDocId !== binding.docId &&
      (!allowSyntheticRoot || requestedDocId !== message.spaceId)
    ) {
      throw new SpaceAccessDenied({ spaceId: message.spaceId });
    }
    return { binding, requestedDocId };
  }

  private async getScopedRootDiff(
    workspaceId: string,
    docId: string,
    stateVector?: Uint8Array
  ) {
    const [root, scopedDoc, docMeta] = await Promise.all([
      this.docReader.getDoc(workspaceId, workspaceId),
      this.docReader.getDoc(workspaceId, docId),
      this.models.doc.getMeta(workspaceId, docId, {
        select: { title: true },
      }),
    ]);
    if (!root) {
      throw new DocNotFound({ spaceId: workspaceId, docId: workspaceId });
    }
    if (!scopedDoc) {
      throw new DocNotFound({ spaceId: workspaceId, docId });
    }

    const safeRoot = buildPublicRootDoc(Buffer.from(root.bin), [
      { id: docId, title: docMeta?.title ?? undefined },
    ]);
    return {
      missing: stateVector ? diffUpdate(safeRoot, stateVector) : safeRoot,
      state: encodeStateVectorFromUpdate(safeRoot),
      // Do not reveal the activity cadence of the real workspace root.
      timestamp: scopedDoc.timestamp,
    };
  }

  private async serializeJoin<T>(client: Socket, operation: () => Promise<T>) {
    const previous = this.joinOperations.get(client) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const completion = current.then(
      () => undefined,
      () => undefined
    );
    this.joinOperations.set(client, completion);
    try {
      return await current;
    } finally {
      if (this.joinOperations.get(client) === completion) {
        this.joinOperations.delete(client);
      }
    }
  }

  handleConnection(client: Socket) {
    this.connectionCount++;
    this.logger.debug(`New connection, total: ${this.connectionCount}`);
    metrics.socketio.gauge('connections').record(this.connectionCount);
    const userId = this.attachPresenceUserId(client);
    this.trackConnectedSocket(client.id, userId);
    this.scheduleActiveUsersFlush();
  }

  handleDisconnect(client: Socket) {
    this.docScopeBindings.delete(client);
    this.joinOperations.delete(client);
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.trackDisconnectedSocket(client.id);
    this.logger.debug(
      `Connection disconnected, total: ${this.connectionCount}`
    );
    metrics.socketio.gauge('connections').record(this.connectionCount);
    this.scheduleActiveUsersFlush();
  }

  private attachPresenceUserId(client: Socket): string | null {
    const request = client.request as Request;
    const userId = request.session?.user.id;
    if (typeof userId !== 'string' || !userId) {
      this.logger.warn(
        `Unable to resolve authenticated user id for socket ${client.id}`
      );
      return null;
    }

    client.data[SOCKET_PRESENCE_USER_ID_KEY] = userId;
    return userId;
  }

  private resolvePresenceUserId(socket: { data?: unknown }) {
    if (!socket.data || typeof socket.data !== 'object') {
      return null;
    }

    const userId = (socket.data as Record<string, unknown>)[
      SOCKET_PRESENCE_USER_ID_KEY
    ];
    return typeof userId === 'string' && userId ? userId : null;
  }

  private trackConnectedSocket(socketId: string, userId: string | null) {
    if (!userId) {
      this.unresolvedPresenceSockets++;
      return;
    }

    this.socketUsers.set(socketId, userId);
    const prev = this.localUserConnectionCounts.get(userId) ?? 0;
    this.localUserConnectionCounts.set(userId, prev + 1);
  }

  private trackDisconnectedSocket(socketId: string) {
    const userId = this.socketUsers.get(socketId);
    if (!userId) {
      this.unresolvedPresenceSockets = Math.max(
        0,
        this.unresolvedPresenceSockets - 1
      );
      return;
    }

    this.socketUsers.delete(socketId);
    const next = (this.localUserConnectionCounts.get(userId) ?? 1) - 1;
    if (next <= 0) {
      this.localUserConnectionCounts.delete(userId);
    } else {
      this.localUserConnectionCounts.set(userId, next);
    }
  }

  private resolveLocalActiveUsers() {
    if (this.unresolvedPresenceSockets > 0) {
      return Math.max(0, this.connectionCount);
    }

    return this.localUserConnectionCounts.size;
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private scheduleActiveUsersFlush(delayMs = 250) {
    if (this.activeUsersFlushTimer) {
      return;
    }

    if (this.activeUsersFlushInFlight) {
      this.activeUsersFlushQueued = true;
      return;
    }

    this.activeUsersFlushTimer = setTimeout(() => {
      this.activeUsersFlushTimer = undefined;
      this.runScheduledActiveUsersFlush();
    }, delayMs);
    this.activeUsersFlushTimer.unref?.();
  }

  private runScheduledActiveUsersFlush() {
    if (this.activeUsersFlushInFlight) {
      this.activeUsersFlushQueued = true;
      return;
    }

    this.activeUsersFlushInFlight = true;
    void this.flushActiveUsersMinute()
      .catch(error => {
        this.logger.warn(
          `Failed to flush active users minute: ${this.formatError(error)}`
        );
      })
      .finally(() => {
        this.activeUsersFlushInFlight = false;
        if (this.activeUsersFlushQueued) {
          this.activeUsersFlushQueued = false;
          this.scheduleActiveUsersFlush(0);
        }
      });
  }

  private async flushActiveUsersMinute(options?: {
    aggregateAcrossCluster?: boolean;
    skipWriteOnAggregateError?: boolean;
  }) {
    const minute = new Date();
    minute.setSeconds(0, 0);

    const aggregateAcrossCluster = options?.aggregateAcrossCluster ?? true;
    const skipWriteOnAggregateError =
      options?.skipWriteOnAggregateError ?? aggregateAcrossCluster;
    let activeUsers = this.resolveLocalActiveUsers();
    if (aggregateAcrossCluster) {
      try {
        const sockets = await this.server.fetchSockets();
        const uniqueUsers = new Set<string>();
        let missingUserCount = 0;
        for (const socket of sockets) {
          const userId = this.resolvePresenceUserId(socket);
          if (userId) {
            uniqueUsers.add(userId);
          } else {
            missingUserCount++;
          }
        }

        if (missingUserCount > 0) {
          activeUsers = sockets.length;
          this.logger.warn(
            `Unable to resolve user id for ${missingUserCount} active sockets, fallback to connection count`
          );
        } else {
          activeUsers = uniqueUsers.size;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to aggregate active users from sockets: ${this.formatError(error)}`
        );
        if (skipWriteOnAggregateError) return;
      }
    }

    await this.models.workspaceAnalytics.upsertSyncActiveUsersMinute(
      minute,
      activeUsers
    );
  }

  @OnEvent('doc.updates.pushed')
  async onDocUpdatesPushed({
    spaceType,
    spaceId,
    docId,
    updates,
    timestamp,
    editor,
  }: Events['doc.updates.pushed']) {
    if (!this.server || updates.length === 0) {
      return;
    }
    if (
      spaceType === SpaceType.Workspace &&
      docId === `db$${spaceId}$folders`
    ) {
      await this.broadcastDirectoryUpdate({
        spaceId,
        docId,
        updates,
        timestamp,
        editor,
      });
      return;
    }

    const room025 = `${spaceType}:${Room(spaceId, 'sync-025')}`;
    const encodedUpdates = this.encodeUpdates(updates);
    for (const update of encodedUpdates) {
      const payload: BroadcastDocUpdateMessage = {
        spaceType: spaceType as SpaceType,
        spaceId,
        docId,
        update,
        timestamp,
        editor: editor ?? '',
      };
      this.server.to(room025).emit('space:broadcast-doc-update', payload);
    }

    const room026 = `${spaceType}:${Room(spaceId, 'sync-026')}`;
    const payload = this.buildBroadcastPayload(
      spaceType as SpaceType,
      spaceId,
      docId,
      updates,
      timestamp,
      editor
    );
    this.server.to(room026).emit('space:broadcast-doc-updates', payload);
    metrics.socketio
      .counter('doc_updates_broadcast')
      .add(payload.updates.length, {
        mode: payload.compressed ? 'compressed' : 'batch',
      });
  }

  selectAdapter(client: Socket, spaceType: SpaceType): SyncSocketAdapter {
    let adapters: Record<SpaceType, SyncSocketAdapter> = (client as any)
      .affineSyncAdapters;

    if (!adapters) {
      const workspace = new WorkspaceSyncAdapter(
        client,
        this.workspace,
        this.ac,
        this.docReader,
        this.models,
        this.organization
      );
      const userspace = new UserspaceSyncAdapter(client, this.userspace);

      adapters = { workspace, userspace };
      (client as any).affineSyncAdapters = adapters;
    }

    return adapters[spaceType];
  }

  // v3
  @SubscribeMessage('space:join')
  async onJoinSpace(
    @CurrentUser() user: CurrentUser,
    @ConnectedSocket() client: Socket,
    @MessageBody()
    message: JoinSpaceMessage
  ): Promise<EventResponse<{ clientId: string; success: boolean }>> {
    return await this.serializeJoin(client, async () => {
      return await this.joinSpace(user, client, message);
    });
  }

  private async joinSpace(
    user: CurrentUser,
    client: Socket,
    { spaceType, spaceId, clientVersion, docScopeId }: JoinSpaceMessage
  ): Promise<EventResponse<{ clientId: string; success: boolean }>> {
    if (![SpaceType.Userspace, SpaceType.Workspace].includes(spaceType)) {
      this.rejectJoin(client);
      return { data: { clientId: client.id, success: false } };
    }

    if (!isSupportedWsClientVersion(clientVersion)) {
      this.rejectJoin(client);
      return { data: { clientId: client.id, success: false } };
    }

    const existingScope = this.docScopeBindings.get(client);
    if (docScopeId !== undefined) {
      const scopedDocId = this.normalizeDocScopeId(
        spaceType,
        spaceId,
        docScopeId
      );
      if (
        (existingScope &&
          (existingScope.spaceId !== spaceId ||
            existingScope.docId !== scopedDocId)) ||
        this.hasWorkspaceSyncRoom(client)
      ) {
        throw new SpaceAccessDenied({ spaceId });
      }

      try {
        await this.assertDocActionAllowed(
          spaceType,
          user.id,
          spaceId,
          scopedDocId,
          'Doc.Read'
        );
      } catch (error) {
        if (existingScope) {
          this.docScopeBindings.delete(client);
        }
        throw error;
      }

      // Recheck after the asynchronous ACL lookup so concurrent joins cannot
      // race this socket from one document scope into another.
      const racedScope = this.docScopeBindings.get(client);
      if (
        (racedScope &&
          (racedScope.spaceId !== spaceId ||
            racedScope.docId !== scopedDocId)) ||
        this.hasWorkspaceSyncRoom(client) ||
        !client.connected
      ) {
        throw new SpaceAccessDenied({ spaceId });
      }
      this.docScopeBindings.set(client, {
        spaceId,
        docId: scopedDocId,
      });

      return { data: { clientId: client.id, success: true } };
    }

    if (existingScope) {
      throw new SpaceAccessDenied({ spaceId });
    }

    if (spaceType === SpaceType.Workspace) {
      this.event.emit('workspace.embedding', { workspaceId: spaceId });
    }

    const adapter = this.selectAdapter(client, spaceType);
    await adapter.join(user.id, spaceId);

    const protocolRoomType = getSyncProtocolRoomType(clientVersion);
    const protocolRoom = adapter.room(spaceId, protocolRoomType);
    const otherProtocolRoom = adapter.room(
      spaceId,
      protocolRoomType === 'sync-025' ? 'sync-026' : 'sync-025'
    );
    if (client.rooms.has(otherProtocolRoom)) {
      await client.leave(otherProtocolRoom);
    }
    if (!client.rooms.has(protocolRoom)) {
      await client.join(protocolRoom);
    }

    return { data: { clientId: client.id, success: true } };
  }

  @SubscribeMessage('space:leave')
  async onLeaveSpace(
    @ConnectedSocket() client: Socket,
    @MessageBody() { spaceType, spaceId, docScopeId }: LeaveSpaceMessage
  ): Promise<EventResponse<{ clientId: string; success: true }>> {
    if (docScopeId !== undefined) {
      this.assertScopedBinding(client, { spaceType, spaceId, docScopeId });
      this.docScopeBindings.delete(client);
      return { data: { clientId: client.id, success: true } };
    }
    if (this.docScopeBindings.has(client)) {
      throw new NotInSpace({ spaceId });
    }

    await this.selectAdapter(client, spaceType).leave(spaceId);

    return { data: { clientId: client.id, success: true } };
  }

  @SubscribeMessage('space:load-doc')
  async onLoadSpaceDoc(
    @ConnectedSocket() client: Socket,
    @CurrentUser() user: CurrentUser,
    @MessageBody()
    { spaceType, spaceId, docId, stateVector, docScopeId }: LoadDocMessage
  ): Promise<
    EventResponse<{ missing: string; state: string; timestamp: number }>
  > {
    const adapter = this.selectAdapter(client, spaceType);
    if (docScopeId !== undefined) {
      const scoped = this.assertScopedDocumentRequest(
        client,
        { spaceType, spaceId, docId, docScopeId },
        true
      );
      await this.assertDocActionAllowed(
        spaceType,
        user.id,
        spaceId,
        scoped.binding.docId,
        'Doc.Read'
      );
      const state = stateVector
        ? Buffer.from(stateVector, 'base64')
        : undefined;
      const doc =
        scoped.requestedDocId === spaceId
          ? await this.getScopedRootDiff(spaceId, scoped.binding.docId, state)
          : await adapter.diffScoped(spaceId, scoped.binding.docId, state);
      if (!doc) {
        throw new DocNotFound({ spaceId, docId });
      }
      return {
        data: {
          missing: Buffer.from(doc.missing).toString('base64'),
          state: Buffer.from(doc.state).toString('base64'),
          timestamp: doc.timestamp,
        },
      };
    }

    const id = new DocID(docId, spaceId);
    adapter.assertIn(spaceId);
    await this.assertDocActionAllowed(
      spaceType,
      user.id,
      spaceId,
      id.guid,
      'Doc.Read'
    );

    const load = () =>
      adapter.diff(
        spaceId,
        id.guid,
        stateVector ? Buffer.from(stateVector, 'base64') : undefined
      );
    const doc =
      spaceType === SpaceType.Workspace && id.guid === `db$${spaceId}$folders`
        ? await this.models.workspaceDirectoryGrant.withMutationLock(
            spaceId,
            async () => {
              if (
                !(await this.models.workspaceDirectoryGrant.canReadWholeTable(
                  spaceId,
                  user.id
                ))
              )
                throw new SpaceAccessDenied({ spaceId });
              return await load();
            }
          )
        : await load();

    if (!doc) {
      throw new DocNotFound({ spaceId, docId });
    }

    return {
      data: {
        missing: Buffer.from(doc.missing).toString('base64'),
        state: Buffer.from(doc.state).toString('base64'),
        timestamp: doc.timestamp,
      },
    };
  }

  @SubscribeMessage('space:delete-doc')
  async onDeleteSpaceDoc(
    @ConnectedSocket() client: Socket,
    @CurrentUser() user: CurrentUser,
    @MessageBody() { spaceType, spaceId, docId, docScopeId }: DeleteDocMessage
  ): Promise<EventResponse<{ success: true }>> {
    if (docScopeId !== undefined) {
      throw new SpaceAccessDenied({ spaceId });
    }
    const adapter = this.selectAdapter(client, spaceType);
    await this.assertDocActionAllowed(
      spaceType,
      user.id,
      spaceId,
      docId,
      'Doc.Delete'
    );
    await adapter.delete(spaceId, docId);
    return { data: { success: true } };
  }

  /**
   * client should always merge updates on their own
   */
  @SubscribeMessage('space:push-doc-update')
  async onReceiveDocUpdate(
    @ConnectedSocket() client: Socket,
    @CurrentUser() user: CurrentUser,
    @MessageBody()
    message: PushDocUpdateMessage
  ): Promise<EventResponse<{ accepted: true; timestamp?: number }>> {
    const { spaceType, spaceId, docId, update } = message;
    const adapter = this.selectAdapter(client, spaceType);

    // Quota recovery mode is intentionally not applied to sync in this phase.
    if (message.docScopeId !== undefined) {
      const scoped = this.assertScopedDocumentRequest(
        client,
        {
          spaceType,
          spaceId,
          docId,
          docScopeId: message.docScopeId,
        },
        false
      );
      await this.assertDocActionAllowed(
        spaceType,
        user.id,
        spaceId,
        scoped.binding.docId,
        'Doc.Update'
      );
      const timestamp = await adapter.pushScoped(
        spaceId,
        scoped.binding.docId,
        [Buffer.from(update, 'base64')],
        user.id
      );
      await this.broadcastDocUpdate(
        client,
        adapter,
        spaceType,
        spaceId,
        scoped.binding.docId,
        update,
        timestamp,
        user.id
      );
      return { data: { accepted: true, timestamp } };
    }

    await this.assertDocActionAllowed(
      spaceType,
      user.id,
      spaceId,
      docId,
      'Doc.Update'
    );
    const timestamp = await adapter.push(
      spaceId,
      docId,
      [Buffer.from(update, 'base64')],
      user.id
    );

    await this.broadcastDocUpdate(
      client,
      adapter,
      spaceType,
      spaceId,
      docId,
      update,
      timestamp,
      user.id
    );

    return {
      data: {
        accepted: true,
        timestamp,
      },
    };
  }

  @SubscribeMessage('space:load-doc-timestamps')
  async onLoadDocTimestamps(
    @ConnectedSocket() client: Socket,
    @CurrentUser() user: CurrentUser,
    @MessageBody()
    { spaceType, spaceId, timestamp, docScopeId }: LoadDocTimestampsMessage
  ): Promise<EventResponse<Record<string, number>>> {
    const adapter = this.selectAdapter(client, spaceType);

    if (docScopeId !== undefined) {
      const binding = this.assertScopedBinding(client, {
        spaceType,
        spaceId,
        docScopeId,
      });
      await this.assertDocActionAllowed(
        spaceType,
        user.id,
        spaceId,
        binding.docId,
        'Doc.Read'
      );
      const scopedDoc = await adapter.diffScoped(spaceId, binding.docId);
      if (
        !scopedDoc ||
        (timestamp !== undefined && scopedDoc.timestamp <= timestamp)
      ) {
        return { data: {} };
      }
      return {
        data: {
          [spaceId]: scopedDoc.timestamp,
          [binding.docId]: scopedDoc.timestamp,
        },
      };
    }

    const stats = await adapter.getTimestamps(spaceId, timestamp);
    if (!stats || spaceType === SpaceType.Userspace) {
      return {
        data: stats ?? {},
      };
    }

    const readableDocs = await this.ac
      .user(user.id)
      .workspace(spaceId)
      .docs(
        Object.keys(stats).map(docId => ({ docId })),
        'Doc.Read'
      );
    const readableDocIds = new Set(readableDocs.map(doc => doc.docId));

    return {
      data: Object.fromEntries(
        Object.entries(stats).filter(([docId]) => readableDocIds.has(docId))
      ),
    };
  }

  @SubscribeMessage('space:join-awareness')
  async onJoinAwareness(
    @ConnectedSocket() client: Socket,
    @CurrentUser() user: CurrentUser,
    @MessageBody()
    { spaceType, spaceId, docId, clientVersion }: JoinSpaceAwarenessMessage
  ) {
    if (![SpaceType.Userspace, SpaceType.Workspace].includes(spaceType)) {
      this.rejectJoin(client);
      return { data: { clientId: client.id, success: false } };
    }

    if (!isSupportedWsClientVersion(clientVersion)) {
      this.rejectJoin(client);
      return { data: { clientId: client.id, success: false } };
    }

    await this.selectAdapter(client, spaceType).join(
      user.id,
      spaceId,
      `${docId}:awareness`
    );

    return { data: { clientId: client.id, success: true } };
  }

  @SubscribeMessage('space:leave-awareness')
  async onLeaveAwareness(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { spaceType, spaceId, docId }: LeaveSpaceAwarenessMessage
  ) {
    await this.selectAdapter(client, spaceType).leave(
      spaceId,
      `${docId}:awareness`
    );

    return { data: { clientId: client.id, success: true } };
  }

  @SubscribeMessage('space:load-awarenesses')
  async onLoadAwareness(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { spaceType, spaceId, docId }: LoadSpaceAwarenessesMessage
  ) {
    const adapter = this.selectAdapter(client, spaceType);

    const roomType = `${docId}:awareness` as const;
    adapter.assertIn(spaceId, roomType);
    client
      .to(adapter.room(spaceId, roomType))
      .emit('space:collect-awareness', { spaceType, spaceId, docId });

    return { data: { clientId: client.id } };
  }

  @SubscribeMessage('space:update-awareness')
  async onUpdateAwareness(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: UpdateAwarenessMessage
  ) {
    const { spaceType, spaceId, docId } = message;
    const adapter = this.selectAdapter(client, spaceType);

    const roomType = `${docId}:awareness` as const;
    adapter.assertIn(spaceId, roomType);
    client
      .to(adapter.room(spaceId, roomType))
      .emit('space:broadcast-awareness-update', message);

    return {};
  }
}

abstract class SyncSocketAdapter {
  constructor(
    private readonly spaceType: SpaceType,
    public readonly client: Socket,
    public readonly storage: DocStorageAdapter
  ) {}

  room(spaceId: string, roomType: RoomType = 'sync') {
    return `${this.spaceType}:${Room(spaceId, roomType)}`;
  }

  async join(userId: string, spaceId: string, roomType: RoomType = 'sync') {
    if (this.in(spaceId, roomType)) {
      return;
    }
    await this.assertAccessible(spaceId, userId, 'Workspace.Sync');
    return this.client.join(this.room(spaceId, roomType));
  }

  async leave(spaceId: string, roomType: RoomType = 'sync') {
    if (!this.in(spaceId, roomType)) {
      return;
    }
    return this.client.leave(this.room(spaceId, roomType));
  }

  in(spaceId: string, roomType: RoomType = 'sync') {
    return this.client.rooms.has(this.room(spaceId, roomType));
  }

  assertIn(spaceId: string, roomType: RoomType = 'sync') {
    if (!this.client.rooms.has(this.room(spaceId, roomType))) {
      throw new NotInSpace({ spaceId });
    }
  }

  abstract assertAccessible(
    spaceId: string,
    userId: string,
    action: WorkspaceAction
  ): Promise<void>;

  protected pushDocUpdates(
    spaceId: string,
    docId: string,
    updates: Buffer[],
    editorId: string
  ) {
    return this.storage.pushDocUpdates(spaceId, docId, updates, editorId);
  }

  async push(
    spaceId: string,
    docId: string,
    updates: Buffer[],
    editorId: string
  ) {
    this.assertIn(spaceId);
    return await this.pushDocUpdates(spaceId, docId, updates, editorId);
  }

  async pushScoped(
    spaceId: string,
    docId: string,
    updates: Buffer[],
    editorId: string
  ) {
    return await this.pushDocUpdates(spaceId, docId, updates, editorId);
  }

  protected loadDocDiff(
    spaceId: string,
    docId: string,
    stateVector?: Uint8Array
  ) {
    return this.storage.getDocDiff(spaceId, docId, stateVector);
  }

  diff(spaceId: string, docId: string, stateVector?: Uint8Array) {
    this.assertIn(spaceId);
    return this.loadDocDiff(spaceId, docId, stateVector);
  }

  diffScoped(spaceId: string, docId: string, stateVector?: Uint8Array) {
    return this.loadDocDiff(spaceId, docId, stateVector);
  }

  delete(spaceId: string, docId: string) {
    this.assertIn(spaceId);
    return this.storage.deleteDoc(spaceId, docId);
  }

  getTimestamps(spaceId: string, timestamp?: number) {
    this.assertIn(spaceId);
    return this.getTimestampsScoped(spaceId, timestamp);
  }

  getTimestampsScoped(spaceId: string, timestamp?: number) {
    return this.storage.getSpaceDocTimestamps(spaceId, timestamp);
  }
}

class WorkspaceSyncAdapter extends SyncSocketAdapter {
  constructor(
    client: Socket,
    storage: DocStorageAdapter,
    private readonly ac: PermissionAccess,
    private readonly docReader: DocReader,
    private readonly models: Models,
    private readonly organization: WorkspaceOrganizationService
  ) {
    super(SpaceType.Workspace, client, storage);
  }

  protected override async pushDocUpdates(
    spaceId: string,
    docId: string,
    updates: Buffer[],
    editorId: string
  ) {
    const docMeta = await this.models.doc.getMeta(spaceId, docId, {
      select: {
        blocked: true,
      },
    });
    if (docMeta?.blocked) {
      throw new DocUpdateBlocked({ spaceId, docId });
    }
    if (docId === `db$${spaceId}$folders`) {
      return await this.organization.acceptFolderSync({
        workspaceId: spaceId,
        actorId: editorId,
        updates,
        persist: async () => {
          await this.ac
            .user(editorId)
            .doc(spaceId, docId)
            .projectScope(null)
            .assert('Doc.Update');
          return await super.pushDocUpdates(spaceId, docId, updates, editorId);
        },
      });
    }
    return await super.pushDocUpdates(spaceId, docId, updates, editorId);
  }

  protected override async loadDocDiff(
    spaceId: string,
    docId: string,
    stateVector?: Uint8Array
  ) {
    return await this.docReader.getDocDiff(spaceId, docId, stateVector);
  }

  async assertAccessible(
    spaceId: string,
    userId: string,
    action: WorkspaceAction
  ) {
    await this.ac.user(userId).workspace(spaceId).assert(action);
  }
}

class UserspaceSyncAdapter extends SyncSocketAdapter {
  constructor(client: Socket, storage: DocStorageAdapter) {
    super(SpaceType.Userspace, client, storage);
  }

  async assertAccessible(
    spaceId: string,
    userId: string,
    _action: WorkspaceAction
  ) {
    if (spaceId !== userId) {
      throw new SpaceAccessDenied({ spaceId });
    }
  }
}
