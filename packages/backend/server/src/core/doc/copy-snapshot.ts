import * as Y from 'yjs';

import { updateDocTitle } from '../../native';

const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;
const MAX_BLOBS = 256;
const BLOB_REFERENCE_KEY = /^(?:prop:)?(?:sourceId|blobId)$/;

export function inspectDocumentCopySnapshot(snapshot: Uint8Array) {
  if (!snapshot.byteLength || snapshot.byteLength > MAX_SNAPSHOT_BYTES)
    throw new Error('Document snapshot exceeds its bounds');
  const binary = Buffer.from(snapshot);
  const document = new Y.Doc();
  const blobIds = new Set<string>();
  let visited = 0;
  const visit = (value: unknown, depth = 0, key?: string): void => {
    if (++visited > 100_000 || depth > 64)
      throw new Error('Document snapshot structure exceeds its bounds');
    if (typeof value === 'string' && BLOB_REFERENCE_KEY.test(key ?? '')) {
      if (!value || /^https?:\/\//i.test(value) || value.startsWith('/'))
        return;
      if (
        value.length > 256 ||
        value.includes('/') ||
        value.includes('\\') ||
        value.includes(':')
      )
        throw new Error(
          'Document contains an unsupported attachment reference'
        );
      blobIds.add(value);
      if (blobIds.size > MAX_BLOBS)
        throw new Error('Document has too many attachments');
      return;
    }
    if (value instanceof Y.Text) {
      visit(value.toDelta(), depth + 1);
    } else if (value instanceof Y.Map) {
      for (const [childKey, child] of value.entries())
        visit(child, depth + 1, childKey);
    } else if (value instanceof Y.Array) {
      for (const child of value.toArray()) visit(child, depth + 1);
    } else if (Array.isArray(value)) {
      for (const child of value) visit(child, depth + 1);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value))
        visit(child, depth + 1, childKey);
    }
  };
  try {
    Y.applyUpdate(document, binary);
    if (!document.getMap('blocks').size)
      throw new Error(
        'A document copy requires a structured document snapshot'
      );
    // BlockSuite document roots are maps. Traverse live values, including rich-text attributes.
    for (const name of document.share.keys()) visit(document.getMap(name));
    return { binary, blobIds: [...blobIds].sort() };
  } finally {
    document.destroy();
  }
}

export function retitleDocumentCopySnapshot(
  snapshot: Uint8Array,
  title: string,
  documentId: string
) {
  const inspected = inspectDocumentCopySnapshot(snapshot);
  const titleUpdate = updateDocTitle(inspected.binary, title, documentId);
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, inspected.binary);
    Y.applyUpdate(document, titleUpdate);
    return inspectDocumentCopySnapshot(Y.encodeStateAsUpdate(document)).binary;
  } finally {
    document.destroy();
  }
}

export function remapDocumentCopyBlobs(
  snapshot: Uint8Array,
  replacements: ReadonlyMap<string, string>
) {
  const inspected = inspectDocumentCopySnapshot(snapshot);
  if (inspected.blobIds.some(key => !replacements.has(key)))
    throw new Error('Document copy attachment mapping is incomplete');
  const document = new Y.Doc();
  let visited = 0;
  const rewrite = (value: unknown, depth = 0, key?: string): unknown => {
    if (++visited > 100_000 || depth > 64)
      throw new Error('Document snapshot structure exceeds its bounds');
    if (typeof value === 'string' && BLOB_REFERENCE_KEY.test(key ?? ''))
      return replacements.get(value) ?? value;
    if (value instanceof Y.Text) {
      const delta = value.toDelta();
      const updated = rewrite(delta, depth + 1) as typeof delta;
      if (JSON.stringify(delta) !== JSON.stringify(updated)) {
        value.delete(0, value.length);
        value.applyDelta(updated);
      }
    } else if (value instanceof Y.Map) {
      for (const [childKey, child] of value.entries()) {
        const updated = rewrite(child, depth + 1, childKey);
        if (updated !== child) value.set(childKey, updated);
      }
    } else if (value instanceof Y.Array) {
      value.toArray().forEach((child, index) => {
        const updated = rewrite(child, depth + 1);
        if (updated !== child) {
          value.delete(index, 1);
          value.insert(index, [updated]);
        }
      });
    } else if (Array.isArray(value)) {
      return value.map(child => rewrite(child, depth + 1));
    } else if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, child]) => [
          childKey,
          rewrite(child, depth + 1, childKey),
        ])
      );
    }
    return value;
  };
  try {
    Y.applyUpdate(document, inspected.binary);
    document.transact(() => {
      for (const name of document.share.keys()) rewrite(document.getMap(name));
    });
    return inspectDocumentCopySnapshot(Y.encodeStateAsUpdate(document)).binary;
  } finally {
    document.destroy();
  }
}
