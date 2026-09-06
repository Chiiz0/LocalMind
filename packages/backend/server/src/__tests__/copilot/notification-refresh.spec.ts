import test from 'ava';

import { NotificationService } from '../../core/notification/service';
import type { Models } from '../../models';

test('notification refresh retries failed publication and acknowledges only the published revision', async t => {
  const acknowledged: string[][] = [];
  const deferred: string[][] = [];
  const published: unknown[] = [];
  const service = new NotificationService(
    {
      notification: {
        pendingRefreshes: async () => [
          { userId: 'failed', revision: 'one' },
          { userId: 'sent', revision: 'two' },
          { userId: 'throws', revision: 'three' },
        ],
        countByUserId: async () => 2,
        acknowledgeRefresh: async (...args: string[]) => {
          acknowledged.push(args);
        },
        deferRefresh: async (...args: string[]) => {
          deferred.push(args);
        },
      },
    } as unknown as Models,
    null!,
    null!,
    null!,
    {
      publish: (...args: unknown[]) => {
        published.push(args);
        if (published.length === 3) throw new Error('offline');
        return published.length === 2;
      },
    } as never,
    null!,
    null!
  );
  await service.deliverPendingRefreshes();
  t.is(published.length, 3);
  t.deepEqual(acknowledged, [['sent', 'two']]);
  t.deepEqual(deferred, [
    ['failed', 'one'],
    ['throws', 'three'],
  ]);
});
