import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test, vi } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import {
  ProjectDocumentSession,
  type ProjectRecoverableDraft,
} from './document-session';

const sessions: ProjectDocumentSession[] = [];
const documents: Doc[] = [];
const newDoc = () => {
  const doc = new Doc();
  documents.push(doc);
  return doc;
};

function fixture(
  cacheKey = [crypto.randomUUID(), 'actor', 'project', 'file', 'tab']
) {
  const server = newDoc();
  server.getMap('content').set('title', 'Project document');
  let version = 1;
  const receipts = new Map<string, { sequence: number }>();
  const save = vi.fn(
    async (request: {
      requestKey: string;
      snapshotBase64: string;
      expectedContentVersion: number;
    }) => {
      const previous = receipts.get(request.requestKey);
      if (previous) return previous;
      if (request.expectedContentVersion !== version)
        throw new Error('Project content changed; reload before saving');
      applyUpdate(
        server,
        new Uint8Array(Buffer.from(request.snapshotBase64, 'base64'))
      );
      const result = { sequence: ++version };
      receipts.set(request.requestKey, result);
      return result;
    }
  );
  const read = vi.fn(async () => ({
    bytes: encodeStateAsUpdate(server),
    version,
  }));
  const onState = vi.fn();
  const open = (
    key = cacheKey,
    options: {
      recoverFrom?: string[];
      onRecoverableDrafts?: (drafts: ProjectRecoverableDraft[]) => void;
    } = {}
  ) => {
    const doc = newDoc();
    const session = new ProjectDocumentSession({
      doc,
      cacheKey: key,
      save,
      read,
      onState,
      onSaved: vi.fn(),
      ...options,
    });
    sessions.push(session);
    return { doc, session };
  };
  return {
    open,
    save,
    read,
    onState,
    server,
    receipts,
    changeRemote: () => {
      server.getMap('content').set('remote', 'Another member');
      version++;
    },
  };
}

afterEach(async () => {
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  documents.splice(0).forEach(doc => doc.destroy());
});

describe('Project document persistence', () => {
  test('another tab lists isolated local drafts and recovers only after explicit selection without merging remote edits', async () => {
    const prefix = [crypto.randomUUID(), 'actor', 'project', 'resource'];
    const oldKey = [...prefix, 'old-tab'];
    const f = fixture(oldKey);
    const first = f.open();
    await first.session.load();
    first.doc.getMap('content').set('local', 'Earlier tab');
    await first.session.dispose();
    f.changeRemote();
    const drafts = vi.fn();
    const key = [...prefix, 'new-tab'];
    const fresh = f.open(key, { onRecoverableDrafts: drafts });
    await fresh.session.load();
    expect(fresh.doc.getMap('content').has('local')).toBe(false);
    expect(drafts.mock.lastCall?.[0]).toEqual([
      expect.objectContaining({ cacheKey: oldKey, version: 1 }),
    ]);
    await fresh.session.dispose();
    const recovered = f.open(key, { recoverFrom: oldKey });
    await recovered.session.load();
    expect(recovered.doc.getMap('content').get('local')).toBe('Earlier tab');
    expect(recovered.doc.getMap('content').has('remote')).toBe(false);
    await recovered.session.saveChanges().catch(() => {});
    expect(f.save).not.toHaveBeenCalled();
    expect(f.onState.mock.lastCall?.[0].phase).toBe('error');
    expect(f.onState.mock.lastCall?.[0].error.status).toBe(409);
    const denied = f.open(key, {
      recoverFrom: [prefix[0], 'other-actor', 'project', 'resource', 'old-tab'],
    });
    await expect(denied.session.load()).rejects.toThrow('scope');
  });
  test('discarding a suspended draft removes it without sending a save', async () => {
    const f = fixture();
    const { session, doc } = f.open();
    await session.load();
    doc.getMap('content').set('body', 'Discarded draft');
    session.suspend();
    await session.flush();
    expect(f.save).not.toHaveBeenCalled();
    await session.discardChanges();
    session.resume();
    await session.dispose();
    const reopened = f.open();
    await reopened.session.load();
    expect(reopened.doc.getMap('content').get('body')).toBeUndefined();
    expect(f.save).not.toHaveBeenCalled();
  });

  test('explicit save waits for the draft and fails if it remains unsaved', async () => {
    const f = fixture();
    const { session, doc } = f.open();
    await session.load();
    doc.getMap('content').set('body', 'Close after saving');
    session.suspend();
    await session.saveChanges();
    expect(session.hasUnsavedChanges).toBe(false);
    expect(f.server.getMap('content').get('body')).toBe('Close after saving');
    doc.getMap('content').set('body', 'Still offline');
    f.save.mockRejectedValue(new Error('Offline'));
    await expect(session.saveChanges()).rejects.toThrow('remain unsaved');
    expect(session.hasUnsavedChanges).toBe(true);
  });
  test('replays the exact request after a committed response is lost', async () => {
    const f = fixture();
    const { session, doc } = f.open();
    await session.load();
    const commit = f.save.getMockImplementation();
    f.save.mockImplementationOnce(async request => {
      await commit?.(request);
      throw new Error('Network disconnected');
    });
    doc.getMap('content').set('body', 'Saved once');
    await session.flush();
    expect(f.onState.mock.lastCall?.[0].phase).toBe('error');
    await session.retry();
    expect(f.receipts.size).toBe(1);
    expect(f.save.mock.calls[1][0]).toEqual(f.save.mock.calls[0][0]);
    expect(session.hasUnsavedChanges).toBe(false);
  });

  test('saves edits made during a request in a later version', async () => {
    const f = fixture();
    const { session, doc } = f.open();
    await session.load();
    const commit = f.save.getMockImplementation();
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    f.save.mockImplementationOnce(async request => {
      await gate;
      return (await commit?.(request)) ?? { sequence: 2 };
    });
    doc.getMap('content').set('body', 'First');
    const pending = session.flush();
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(1));
    doc.getMap('content').set('body', 'Second');
    release();
    await pending;
    expect(session.hasUnsavedChanges).toBe(true);
    await session.flush();
    expect(f.server.getMap('content').get('body')).toBe('Second');
    expect(f.receipts.size).toBe(2);
    expect(f.save.mock.calls[1][0].expectedContentVersion).toBe(2);
  });

  test('a conflict retains the local draft without merging or overwriting the remote version', async () => {
    const f = fixture();
    const { session, doc } = f.open();
    await session.load();
    doc.getMap('content').set('local', 'My edit');
    f.changeRemote();
    await session.flush();
    expect(f.receipts.size).toBe(0);
    await session.retry();
    expect(f.server.getMap('content').get('local')).toBeUndefined();
    expect(f.server.getMap('content').get('remote')).toBe('Another member');
    expect(f.receipts.size).toBe(0);
    expect(doc.getMap('content').get('local')).toBe('My edit');
    expect(doc.getMap('content').get('remote')).toBeUndefined();
    expect(session.hasUnsavedChanges).toBe(true);
  });

  test('reopens a durable failed request without changing its identity', async () => {
    const f = fixture();
    const first = f.open();
    await first.session.load();
    first.doc.getMap('content').set('body', 'Draft after disconnect');
    f.save.mockRejectedValueOnce(new Error('Offline'));
    await first.session.flush();
    await first.session.dispose();
    const second = f.open();
    await second.session.load();
    await second.session.flush();
    expect(f.save.mock.calls[1][0]).toEqual(f.save.mock.calls[0][0]);
    expect(f.receipts.size).toBe(1);
    expect(second.session.hasUnsavedChanges).toBe(false);
  });

  test('authorizes before loading a draft and isolates Project and actor keys', async () => {
    const f = fixture();
    const first = f.open();
    await first.session.load();
    first.doc.getMap('content').set('privateDraft', 'Only this project');
    await first.session.dispose();
    const other = f.open([
      'server',
      'another-actor',
      'another-project',
      'file',
      'tab',
    ]);
    await other.session.load();
    expect(other.doc.getMap('content').has('privateDraft')).toBe(false);
    f.read.mockRejectedValueOnce(new Error('Project membership required'));
    const denied = f.open();
    await expect(denied.session.load()).rejects.toThrow('membership');
    expect(denied.doc.getMap('content').has('privateDraft')).toBe(false);
    await denied.session.dispose();
    const recovered = f.open();
    await recovered.session.load();
    expect(recovered.doc.getMap('content').get('privateDraft')).toBe(
      'Only this project'
    );
  });
});
