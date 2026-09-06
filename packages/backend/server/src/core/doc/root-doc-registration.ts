import * as Y from 'yjs';

import { addDocToRootDoc, readAllDocIdsFromRootDoc } from '../../native';

const SIMPLE_PAGE_META_KEYS = [
  'id',
  'title',
  'createDate',
  'updatedDate',
  'trash',
  'trashDate',
  'headerImage',
] as const;

export interface RootDocUpdatePlan {
  update: Uint8Array;
  replacementSnapshot?: Uint8Array;
}

function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)])
    );
  }
  return value;
}

function cloneYValue(value: unknown): unknown {
  if (value instanceof Y.Array) {
    const copy = new Y.Array();
    copy.push(value.toArray().map(cloneYValue));
    return copy;
  }
  if (value instanceof Y.Map) {
    const copy = new Y.Map();
    for (const [key, child] of value.entries()) {
      copy.set(key, cloneYValue(child));
    }
    return copy;
  }
  if (value instanceof Y.Text) {
    const copy = new Y.Text();
    copy.applyDelta(value.toDelta());
    return copy;
  }
  if (value instanceof Y.Doc) {
    return new Y.Doc({
      guid: value.guid,
      gc: value.gc,
      autoLoad: value.autoLoad,
      meta: cloneJsonValue(value.meta),
    });
  }
  return cloneJsonValue(value);
}

function pageValue(page: unknown, key: string) {
  if (page instanceof Y.Map) return page.get(key);
  if (page && typeof page === 'object') {
    return (page as Record<string, unknown>)[key];
  }
  return undefined;
}

function appendPage(
  pages: Y.Array<Y.Map<unknown>>,
  page: unknown,
  overrides?: { id: string; title: string; createDate: number }
) {
  const copy = new Y.Map<unknown>();
  pages.push([copy]);
  for (const key of SIMPLE_PAGE_META_KEYS) {
    const value =
      overrides?.[key as keyof typeof overrides] ?? pageValue(page, key);
    if (value !== undefined) copy.set(key, cloneYValue(value));
  }
  const tags = pageValue(page, 'tags');
  if (tags instanceof Y.Array) {
    copy.set('tags', cloneYValue(tags));
  } else {
    const tagCopy = new Y.Array();
    if (Array.isArray(tags)) tagCopy.push(tags.map(cloneYValue));
    copy.set('tags', tagCopy);
  }
}

export function readRootDocPageIdsWithYjs(
  rootDocBin: Uint8Array,
  includeTrash = false
) {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, rootDocBin);
    const pages = document.getMap('meta').get('pages');
    if (!(pages instanceof Y.Array)) return [];
    const ids: string[] = [];
    for (const page of pages.toArray()) {
      const id = pageValue(page, 'id');
      const trash = pageValue(page, 'trash');
      if (typeof id === 'string' && (includeTrash || trash !== true)) {
        ids.push(id);
      }
    }
    return ids;
  } finally {
    document.destroy();
  }
}

function buildCanonicalRootSnapshot(
  rootDocBin: Uint8Array,
  docId: string,
  title: string
) {
  const source = new Y.Doc();
  const target = new Y.Doc();
  try {
    Y.applyUpdate(source, rootDocBin);
    const clients = Y.decodeStateVector(Y.encodeStateVector(source)).keys();
    const maxClientId = Math.max(0, ...clients);
    if (maxClientId < Number.MAX_SAFE_INTEGER) {
      target.clientID = maxClientId + 1;
    }

    const sourceMeta = source.getMap('meta');
    const targetMeta = target.getMap('meta');
    for (const [key, value] of sourceMeta.entries()) {
      if (key !== 'pages') targetMeta.set(key, cloneYValue(value));
    }

    const targetPages = new Y.Array<Y.Map<unknown>>();
    targetMeta.set('pages', targetPages);
    const copiedIds = new Set<string>();
    const sourcePages = sourceMeta.get('pages');
    if (sourcePages instanceof Y.Array) {
      for (const page of sourcePages.toArray()) {
        const id = pageValue(page, 'id');
        if (typeof id !== 'string' || copiedIds.has(id)) continue;
        copiedIds.add(id);
        appendPage(targetPages, page);
      }
    }
    if (!copiedIds.has(docId)) {
      appendPage(targetPages, undefined, {
        id: docId,
        title,
        createDate: Date.now(),
      });
    }

    const sourceSpaces = source.getMap('spaces');
    const targetSpaces = target.getMap('spaces');
    for (const [key, value] of sourceSpaces.entries()) {
      targetSpaces.set(key, cloneYValue(value));
    }
    if (!targetSpaces.has(docId)) {
      targetSpaces.set(docId, new Y.Doc({ guid: docId }));
    }

    const snapshot = Y.encodeStateAsUpdate(target);
    if (
      !readRootDocPageIdsWithYjs(snapshot).includes(docId) ||
      !readAllDocIdsFromRootDoc(Buffer.from(snapshot), false).includes(docId)
    ) {
      throw new Error('Failed to build a compatible workspace root snapshot');
    }
    return snapshot;
  } finally {
    source.destroy();
    target.destroy();
  }
}

export function prepareRootDocRegistration(
  rootDocBin: Uint8Array,
  docId: string,
  title: string
): RootDocUpdatePlan {
  if (readRootDocPageIdsWithYjs(rootDocBin, true).includes(docId)) {
    return { update: new Uint8Array([0, 0]) };
  }

  const update = addDocToRootDoc(Buffer.from(rootDocBin), docId, title);
  const replay = new Y.Doc();
  try {
    Y.applyUpdate(replay, rootDocBin);
    Y.applyUpdate(replay, update);
    const visible = replay.getMap('meta').get('pages');
    if (
      visible instanceof Y.Array &&
      visible.toArray().some(page => pageValue(page, 'id') === docId)
    ) {
      return { update };
    }
  } finally {
    replay.destroy();
  }

  const replacementSnapshot = buildCanonicalRootSnapshot(
    rootDocBin,
    docId,
    title
  );
  return { update: replacementSnapshot, replacementSnapshot };
}
