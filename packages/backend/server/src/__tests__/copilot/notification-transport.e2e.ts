import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { PrismaClient } from '@prisma/client';
import { createAdapter } from '@socket.io/redis-adapter';
import test from 'ava';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';

import { NotificationService } from '../../core/notification/service';
import {
  realtimeNotificationRoom,
  RealtimePublisher,
} from '../../core/realtime';
import { Models } from '../../models';
import { createTestingModule } from '../utils';

const transportTest =
  process.env.LOCALMIND_TEST_REDIS_PUBLICATION_PAUSE === '1'
    ? test.serial
    : test.serial.skip;

transportTest(
  'durable decisions survive an isolated Redis publication pause and recovery',
  async t => {
    assert.match(
      new URL(process.env.DATABASE_URL ?? '').pathname,
      /^\/localmind_project_ai_stage2_[a-z0-9_]+$/
    );
    assert.equal(process.env.REDIS_SERVER_HOST, 'localmind_project_ai_redis');
    await using module = await createTestingModule({}, false);
    await module.init();
    const models = module.get(Models);
    const db = module.get(PrismaClient);
    const suffix = randomUUID();
    const owner = await models.user.create({
      email: `transport-owner-${suffix}@example.invalid`,
    });
    const requester = await models.user.create({
      email: `transport-requester-${suffix}@example.invalid`,
    });
    const workspace = await models.workspace.create(owner.id);
    const request =
      await models.intelligenceWorkbenchAuthorization.requestUserDocumentAccess(
        {
          workspaceId: workspace.id,
          docId: `synthetic-${suffix}`,
          requesterUserId: requester.id,
          requestedLevel: 'read',
          idempotencyKey: suffix,
        }
      );
    const clients = Array.from(
      { length: 4 },
      () =>
        new Redis({
          host: process.env.REDIS_SERVER_HOST,
          lazyConnect: true,
          enableOfflineQueue: false,
        })
    );
    const first = new Server();
    const second = new Server();
    const room = realtimeNotificationRoom(requester.id);
    let socket: ReturnType<typeof io> | undefined;
    try {
      await Promise.all(clients.map(client => client.connect()));
      const adapterOptions = { key: `stage2-transport-${suffix}` };
      first.adapter(createAdapter(clients[0], clients[1], adapterOptions));
      first.listen(0);
      second.adapter(createAdapter(clients[2], clients[3], adapterOptions));
      second.on('connection', client => {
        void client.join(room);
      });
      second.listen(0);
      const address = second.httpServer.address();
      assert(address && typeof address !== 'string');
      socket = io(`http://127.0.0.1:${address.port}`, {
        transports: ['websocket'],
        reconnection: false,
      });
      await new Promise<void>((resolve, reject) => {
        socket!.once('connect', resolve);
        socket!.once('connect_error', reject);
      });
      const events: unknown[] = [];
      socket.on('realtime:event', event => events.push(event));
      module.get(RealtimePublisher).attachServer(first);
      await delay(100);
      await clients[0].client('PAUSE', 3000, 'WRITE');
      const startedAt = Date.now();
      const approved =
        await models.intelligenceWorkbenchAuthorization.approveAccessRequest({
          requestId: request.request.id,
          actorUserId: owner.id,
        });
      assert.equal(approved.status, 'approved');
      await module.get(NotificationService).deliverPendingRefreshes();
      assert(
        Date.now() - startedAt < 2500,
        'Database result waited on Redis publication'
      );
      assert.equal(events.length, 0);
      assert.equal(
        await db.notification.count({
          where: {
            userId: requester.id,
            type: 'AccessRequestResolved',
            body: { path: ['requestId'], equals: approved.id },
          },
        }),
        1
      );
      const audits = await db.accessRequestAuditEvent.count({
        where: { accessRequestId: approved.id },
      });
      await clients[0].client('UNPAUSE');
      for (let attempt = 0; !events.length && attempt < 50; attempt++)
        await delay(100);
      assert(events.length > 0, 'Recovered Redis publication did not arrive');
      socket.disconnect();
      const replay =
        await models.intelligenceWorkbenchAuthorization.approveAccessRequest({
          requestId: approved.id,
          actorUserId: owner.id,
        });
      assert.equal(replay.status, 'approved');
      assert.equal(
        await db.accessRequestAuditEvent.count({
          where: { accessRequestId: approved.id },
        }),
        audits
      );
      const notifications = await models.notification.findManyByUserId(
        requester.id,
        { includeRead: true, first: 10 }
      );
      assert(
        notifications.some(
          notification => notification.type === 'AccessRequestResolved'
        )
      );
      t.log(
        JSON.stringify({
          workspaceId: workspace.id,
          requestId: approved.id,
          durableDuringRedisPause: true,
          replayAuditCount: audits,
          recoveredEvents: events.length,
        })
      );
      t.pass();
    } finally {
      await clients[0].client('UNPAUSE').catch(() => {});
      socket?.disconnect();
      await Promise.allSettled([first.close(), second.close()]);
      clients.forEach(client => client.disconnect());
    }
  }
);
