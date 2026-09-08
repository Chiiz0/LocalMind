import { UserFriendlyError } from '@affine/error';
import { ServerDeploymentType } from '@affine/graphql';
import { SocketConnection } from '@affine/nbstore/cloud';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useRef } from 'react';
import { Observable } from 'rxjs';

import { ServerService } from '../cloud';
import { NbstoreService } from '../storage';
import { reportProjectError } from './error';
import {
  ProjectRealtimeStore,
  type ProjectRefreshChannel,
} from './realtime-store';

export function projectResourceEvents(
  endpoint: string,
  selfHosted: boolean,
  projectId: string
) {
  return new Observable<unknown>(subscriber => {
    const connection = new SocketConnection(endpoint, selfHosted, false);
    const controller = new AbortController();
    let detach: (() => void) | undefined;
    connection.connect();
    const setup = async () => {
      await connection.waitForConnected(controller.signal);
      if (subscriber.closed) return;
      const socket = connection.inner.socket;
      const changed = (event: { projectId: string }) => {
        if (event.projectId === projectId) subscriber.next(event);
      };
      const join = async () => {
        try {
          const ack = await socket
            .timeout(10000)
            .emitWithAck('project:join', { projectId });
          if ('error' in ack) throw UserFriendlyError.fromAny(ack.error);
          if (!subscriber.closed) subscriber.next({ type: 'ready' });
        } catch (error) {
          if (!subscriber.closed) subscriber.error(error);
        }
      };
      socket.on('project:resource-changed', changed);
      socket.on('connect', join);
      detach = () => {
        socket.off('project:resource-changed', changed);
        socket.off('connect', join);
        if (socket.connected)
          socket.emit('project:leave', { projectId }, () => {});
      };
      await join();
    };
    void setup().catch(error => {
      if (!subscriber.closed) subscriber.error(error);
    });
    return () => {
      controller.abort();
      detach?.();
      connection.disconnect(true);
    };
  });
}

const stores = new WeakMap<
  object,
  { accountId: string; store: ProjectRealtimeStore }
>();

export function useProjectRefresh(
  projectId: string | null,
  channel: ProjectRefreshChannel,
  refresh: () => unknown | Promise<unknown>
) {
  const server = useService(ServerService).server;
  const account = useLiveData(server.account$);
  const config = useLiveData(server.config$);
  const nbstore = useService(NbstoreService);
  const callback = useRef(refresh);
  callback.current = refresh;
  const selfHosted = config?.type === ServerDeploymentType.Selfhosted;
  useEffect(() => {
    const current = stores.get(server);
    if (!account) {
      current?.store.dispose();
      stores.delete(server);
      return;
    }
    if (current && current.accountId !== account.id) current.store.dispose();
    const store =
      current?.accountId === account.id
        ? current.store
        : new ProjectRealtimeStore({
            global: channel =>
              nbstore.realtime.subscribe(`project.${channel}.changed`, {}),
            project: (id, channel) =>
              channel === 'resource'
                ? projectResourceEvents(server.baseUrl, selfHosted, id)
                : nbstore.realtime.subscribe('project.lease.changed', {
                    projectId: id,
                  }),
            onError: reportProjectError,
          });
    stores.set(server, { accountId: account.id, store });
    return store.subscribe(projectId, channel, () => callback.current());
  }, [account, channel, nbstore, projectId, selfHosted, server]);
}
