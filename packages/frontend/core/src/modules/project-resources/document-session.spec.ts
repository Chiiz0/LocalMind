import 'fake-indexeddb/auto';

import { afterEach, describe, expect, test, vi } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { ProjectDocumentSession } from './document-session';

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
  const open = (key = cacheKey) => {
    const doc = newDoc();
    const session = new ProjectDocumentSession({
      doc,
      cacheKey: key,
      save,
      read,
      onState,
      onSaved: vi.fn(),
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

  test('retains local and remote Yjs edits after an explicit conflict retry', async () => {
    const f = fixture();
    const { session, doc } = f.open();
    await session.load();
    doc.getMap('content').set('local', 'My edit');
    f.changeRemote();
    await session.flush();
    expect(f.receipts.size).toBe(0);
    await session.retry();
    expect(f.server.getMap('content').get('local')).toBe('My edit');
    expect(f.server.getMap('content').get('remote')).toBe('Another member');
    expect(f.receipts.size).toBe(1);
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
