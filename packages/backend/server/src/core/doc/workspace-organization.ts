import { createHash } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

import { BadRequest, NotFound } from '../../base';
import { Models } from '../../models';
import type { DirectoryRights } from '../../models/workspace-directory-grant';
import { DocReader } from './reader';
import { DocWriter } from './writer';

const MAX_OPERATIONS = 100;
const MAX_INPUT_BYTES = 512 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_FOLDER_LIFECYCLE_NODES = 2_000;
const FOLDER_TRASH_OPERATION_ID = '$localmindTrashOperationId';
const FOLDER_TRASH_ROOT = '$localmindTrashRoot';
const FOLDER_TRASH_ACTOR_ID = '$localmindTrashActorId';
const FOLDER_TRASHED_AT = '$localmindTrashedAt';
const FOLDER_TRASH_DOCUMENT_IDS = '$localmindTrashDocumentIds';
const FOLDER_TRASH_NEW_DOCUMENT_IDS = '$localmindTrashNewDocumentIds';
const FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS = '$localmindTrashPreviousDocumentIds';
const FOLDER_TRASH_FINGERPRINT = '$localmindTrashFingerprint';
const DOCUMENT_TRASH_CLAIMS = '$localmindTrashClaims';
const DIRECT_DOCUMENT_TRASH_CLAIM = 'direct';
const FOLDER_TRASH_METADATA_KEYS = [
  FOLDER_TRASH_OPERATION_ID,
  FOLDER_TRASH_ROOT,
  FOLDER_TRASH_ACTOR_ID,
  FOLDER_TRASHED_AT,
  FOLDER_TRASH_DOCUMENT_IDS,
  FOLDER_TRASH_NEW_DOCUMENT_IDS,
  FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS,
  FOLDER_TRASH_FINGERPRINT,
] as const;

export type JsonObject = Record<string, unknown>;

export type WorkspaceRootOperation =
  | { op: 'set_workspace_profile'; name?: string; avatar?: string | null }
  | { op: 'set_document_trashed'; docId: string; trashed: boolean }
  | {
      op: 'create_tag';
      id?: string;
      value: string;
      color: string;
      parentId?: string | null;
    }
  | {
      op: 'update_tag';
      tagId: string;
      value?: string;
      color?: string;
      parentId?: string | null;
    }
  | { op: 'delete_tag'; tagId: string }
  | { op: 'set_document_tags'; docId: string; tagIds: string[] }
  | {
      op: 'create_collection';
      id?: string;
      name: string;
      rules?: JsonObject;
      allowList?: string[];
    }
  | {
      op: 'update_collection';
      collectionId: string;
      name?: string;
      rules?: JsonObject;
      allowList?: string[];
    }
  | { op: 'delete_collection'; collectionId: string };

export const WORKSPACE_DATA_TABLES = [
  'folders',
  'document_properties',
  'workspace_properties',
  'pinned_collections',
  'explorer_icons',
  'favorites',
  'user_settings',
] as const;

export type WorkspaceDataTable = (typeof WORKSPACE_DATA_TABLES)[number];

export type WorkspaceDataOperation =
  | { op: 'upsert'; key: string; values: JsonObject }
  | { op: 'delete'; key: string };

type TableDescriptor = {
  docId: (workspaceId: string, userId: string) => string;
  keyField: string;
};

const TABLES: Record<WorkspaceDataTable, TableDescriptor> = {
  // The server reads persisted docs directly, so use the physical IDs emitted
  // by the frontend nbstore id converter rather than its logical table IDs.
  folders: {
    docId: workspaceId => `db$${workspaceId}$folders`,
    keyField: 'id',
  },
  document_properties: {
    docId: workspaceId => `db$${workspaceId}$docProperties`,
    keyField: 'id',
  },
  workspace_properties: {
    docId: workspaceId => `db$${workspaceId}$docCustomPropertyInfo`,
    keyField: 'id',
  },
  pinned_collections: {
    docId: workspaceId => `db$${workspaceId}$pinnedCollections`,
    keyField: 'collectionId',
  },
  explorer_icons: {
    docId: workspaceId => `db$${workspaceId}$explorerIcon`,
    keyField: 'id',
  },
  favorites: {
    docId: (workspaceId, userId) =>
      `userdata$${userId}$${workspaceId}$favorite`,
    keyField: 'key',
  },
  user_settings: {
    docId: (workspaceId, userId) =>
      `userdata$${userId}$${workspaceId}$settings`,
    keyField: 'key',
  },
};

export function resolveWorkspaceDataDocId(
  table: WorkspaceDataTable,
  workspaceId: string,
  userId: string
) {
  return TABLES[table].docId(workspaceId, userId);
}

type LoadedDoc = {
  doc: Y.Doc;
  stateVector: Uint8Array;
  sourceRevision: string;
};

function directorySnapshotRevision(bin?: Uint8Array) {
  // Hash the complete merged snapshot, including delete sets. A state vector
  // alone cannot identify deletions; re-encoding thousands of roots is costly.
  return createHash('sha256')
    .update(bin ?? new Uint8Array([0, 0]))
    .digest('hex');
}

function assertJsonValue(value: unknown, path = 'value', seen = new Set()) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return;
  }
  if (typeof value !== 'object') {
    throw new Error(`${path} must contain only JSON values.`);
  }
  if (seen.has(value)) throw new Error(`${path} must not contain cycles.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertJsonValue(item, `${path}[${index}]`, seen)
    );
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new Error(`${path} contains a forbidden key.`);
      }
      assertJsonValue(item, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function assertOperations(operations: unknown[]) {
  if (!operations.length)
    throw new Error('At least one operation is required.');
  if (operations.length > MAX_OPERATIONS) {
    throw new Error(`At most ${MAX_OPERATIONS} operations are allowed.`);
  }
  assertJsonValue(operations, 'operations');
  if (Buffer.byteLength(JSON.stringify(operations)) > MAX_INPUT_BYTES) {
    throw new Error(`Operation input exceeds ${MAX_INPUT_BYTES} bytes.`);
  }
}

function serialize(value: unknown): unknown {
  if (value instanceof Y.Text) {
    return { text: value.toString(), delta: value.toDelta() };
  }
  if (value instanceof Y.Array) return value.toArray().map(serialize);
  if (value instanceof Y.Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, item]) => [key, serialize(item)])
    );
  }
  if (value instanceof Uint8Array) {
    return { base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serialize(item)])
    );
  }
  return value;
}

function jsonObject(value: unknown): JsonObject {
  const serialized = serialize(value);
  return serialized &&
    typeof serialized === 'object' &&
    !Array.isArray(serialized)
    ? (serialized as JsonObject)
    : {};
}

function tableRecord(type: Y.AbstractType<any>): JsonObject {
  return Y.Map.prototype.toJSON.call(type) as JsonObject;
}

function tableField(type: Y.AbstractType<any>, key: string) {
  return Y.Map.prototype.get.call(type, key) as unknown;
}

function tableRecords(doc: Y.Doc, includeDeleted = false) {
  const records: JsonObject[] = [];
  for (const type of doc.share.values()) {
    if (!includeDeleted && tableField(type, '$$DELETED') === true) continue;
    const record = tableRecord(type);
    if (typeof record.id === 'string') records.push(record);
  }
  return records;
}

function folderDescendants(records: JsonObject[], folderId: string) {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records) {
      if (
        typeof record.id === 'string' &&
        typeof record.parentId === 'string' &&
        ids.has(record.parentId) &&
        !ids.has(record.id)
      ) {
        ids.add(record.id);
        changed = true;
      }
    }
  }
  return records.filter(
    record => typeof record.id === 'string' && ids.has(record.id)
  );
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function folderTrashFingerprint(input: {
  rootFolderId: string;
  nodes: JsonObject[];
  documentIds: string[];
  newlyTrashedDocumentIds: string[];
  previouslyTrashedDocumentIds: string[];
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 'localmind-folder-trash-manifest/v1',
        rootFolderId: input.rootFolderId,
        nodes: input.nodes
          .map(record => ({
            id: record.id,
            parentId: record.parentId ?? null,
            type: record.type,
            data: record.data,
            index: record.index,
          }))
          .sort((left, right) =>
            String(left.id).localeCompare(String(right.id))
          ),
        documentIds: [...input.documentIds].sort(),
        newlyTrashedDocumentIds: [...input.newlyTrashedDocumentIds].sort(),
        previouslyTrashedDocumentIds: [
          ...input.previouslyTrashedDocumentIds,
        ].sort(),
      })
    )
    .digest('hex');
}

type FolderTrashManifestRepair = {
  rootId: string;
  documentIds: string[];
  newlyTrashedDocumentIds: string[];
  previouslyTrashedDocumentIds: string[];
  fingerprint: string;
};

function folderTrashManifestRepairs(input: {
  records: JsonObject[];
  removedDocumentIds: Set<string>;
  removedRecordIds: Set<string>;
  ignoredOperationIds?: Set<string>;
}) {
  const repairs: FolderTrashManifestRepair[] = [];
  for (const root of input.records) {
    if (
      root.$$DELETED !== true ||
      root[FOLDER_TRASH_ROOT] !== true ||
      typeof root.id !== 'string'
    ) {
      continue;
    }
    const operationId = String(root[FOLDER_TRASH_OPERATION_ID] ?? '');
    if (!operationId || input.ignoredOperationIds?.has(operationId)) continue;
    const documentIds = stringArray(root[FOLDER_TRASH_DOCUMENT_IDS]);
    if (
      !documentIds.some(documentId => input.removedDocumentIds.has(documentId))
    ) {
      continue;
    }
    const nodes = input.records.filter(
      record =>
        record.$$DELETED === true &&
        record[FOLDER_TRASH_OPERATION_ID] === operationId
    );
    const newlyTrashedDocumentIds = stringArray(
      root[FOLDER_TRASH_NEW_DOCUMENT_IDS]
    );
    const previouslyTrashedDocumentIds = stringArray(
      root[FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS]
    );
    const currentFingerprint = folderTrashFingerprint({
      rootFolderId: root.id,
      nodes,
      documentIds,
      newlyTrashedDocumentIds,
      previouslyTrashedDocumentIds,
    });
    if (root[FOLDER_TRASH_FINGERPRINT] !== currentFingerprint) {
      throw new Error(`The trashed folder manifest for ${root.id} is invalid.`);
    }
    const remainingDocumentIds = documentIds.filter(
      documentId => !input.removedDocumentIds.has(documentId)
    );
    const remainingNewDocumentIds = newlyTrashedDocumentIds.filter(
      documentId => !input.removedDocumentIds.has(documentId)
    );
    const remainingPreviousDocumentIds = previouslyTrashedDocumentIds.filter(
      documentId => !input.removedDocumentIds.has(documentId)
    );
    const remainingNodes = nodes.filter(
      record =>
        typeof record.id !== 'string' || !input.removedRecordIds.has(record.id)
    );
    repairs.push({
      rootId: root.id,
      documentIds: remainingDocumentIds,
      newlyTrashedDocumentIds: remainingNewDocumentIds,
      previouslyTrashedDocumentIds: remainingPreviousDocumentIds,
      fingerprint: folderTrashFingerprint({
        rootFolderId: root.id,
        nodes: remainingNodes,
        documentIds: remainingDocumentIds,
        newlyTrashedDocumentIds: remainingNewDocumentIds,
        previouslyTrashedDocumentIds: remainingPreviousDocumentIds,
      }),
    });
  }
  return repairs;
}

function permanentlyRemoveTableRecords(
  doc: Y.Doc,
  records: JsonObject[],
  manifestRepairs: FolderTrashManifestRepair[]
) {
  for (const record of records) {
    const id = String(record.id);
    const stored = doc.getMap<unknown>(id);
    for (const key of Array.from(stored.keys())) {
      if (key !== 'id') stored.delete(key);
    }
    stored.set('id', id);
    stored.set('$$DELETED', true);
  }
  for (const repair of manifestRepairs) {
    const stored = doc.getMap<unknown>(repair.rootId);
    stored.set(FOLDER_TRASH_DOCUMENT_IDS, repair.documentIds);
    stored.set(FOLDER_TRASH_NEW_DOCUMENT_IDS, repair.newlyTrashedDocumentIds);
    stored.set(
      FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS,
      repair.previouslyTrashedDocumentIds
    );
    stored.set(FOLDER_TRASH_FINGERPRINT, repair.fingerprint);
  }
}

function rootPage(doc: Y.Doc, docId: string) {
  const pages = rootPages(doc);
  const index = findArrayEntry(pages, 'id', docId);
  return index < 0 ? null : { pages, index, value: pages.get(index) };
}

function rootPageRecord(value: unknown) {
  return jsonObject(value);
}

function publicRootPageRecord(value: unknown) {
  const record = rootPageRecord(value);
  delete record[DOCUMENT_TRASH_CLAIMS];
  return record;
}

function storedRootPageTrashClaims(value: unknown): string[] | null {
  const record = jsonObject(value);
  if (!Array.isArray(record[DOCUMENT_TRASH_CLAIMS])) return null;
  return [
    ...new Set(
      record[DOCUMENT_TRASH_CLAIMS].filter(
        (claim): claim is string =>
          typeof claim === 'string' && claim.length > 0 && claim.length <= 256
      )
    ),
  ].sort();
}

function rootPageTrashClaims(
  value: unknown,
  legacyClaims: string[] = [DIRECT_DOCUMENT_TRASH_CLAIM]
) {
  const stored = storedRootPageTrashClaims(value);
  if (stored) return stored;
  return jsonObject(value).trash === true ? [...legacyClaims] : [];
}

function setRootPageTrashClaims(value: unknown, claims: string[]) {
  const normalized = [...new Set(claims)].sort();
  const trashed = normalized.length > 0;
  if (value instanceof Y.Map) {
    if (trashed) {
      value.set('trash', true);
      if (typeof value.get('trashDate') !== 'number') {
        value.set('trashDate', Date.now());
      }
      value.set(DOCUMENT_TRASH_CLAIMS, normalized);
    } else {
      value.delete('trash');
      value.delete('trashDate');
      value.delete(DOCUMENT_TRASH_CLAIMS);
    }
    return;
  }
  const next = jsonObject(value);
  if (trashed) {
    next.trash = true;
    if (typeof next.trashDate !== 'number') next.trashDate = Date.now();
    next[DOCUMENT_TRASH_CLAIMS] = normalized;
  } else {
    delete next.trash;
    delete next.trashDate;
    delete next[DOCUMENT_TRASH_CLAIMS];
  }
  return next;
}

function findArrayEntry(array: Y.Array<unknown>, key: string, value: string) {
  return array.toArray().findIndex(item => jsonObject(item)[key] === value);
}

function replaceArrayEntry(
  array: Y.Array<unknown>,
  index: number,
  value: JsonObject
) {
  array.delete(index, 1);
  array.insert(index, [value]);
}

function ensureMap(parent: Y.Map<unknown>, key: string) {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) return existing;
  const map = new Y.Map<unknown>();
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    for (const [entryKey, value] of Object.entries(existing)) {
      map.set(entryKey, value);
    }
  }
  parent.set(key, map);
  return map;
}

function ensureArray(parent: Y.Map<unknown>, key: string) {
  const existing = parent.get(key);
  if (existing instanceof Y.Array) return existing as Y.Array<unknown>;
  const array = new Y.Array<unknown>();
  if (Array.isArray(existing)) array.push(existing);
  parent.set(key, array);
  return array;
}

function rootPages(doc: Y.Doc) {
  return ensureArray(doc.getMap('meta'), 'pages');
}

function rootTagOptions(doc: Y.Doc) {
  const properties = ensureMap(doc.getMap('meta'), 'properties');
  const tags = ensureMap(properties, 'tags');
  return ensureArray(tags, 'options');
}

function rootCollections(doc: Y.Doc) {
  return ensureArray(doc.getMap('setting'), 'collections');
}

function validateTableRecord(
  table: WorkspaceDataTable,
  key: string,
  record: JsonObject
) {
  const string = (field: string, nullable = false) => {
    const value = record[field];
    if (value === undefined || (nullable && value === null)) return;
    if (typeof value !== 'string') {
      throw new Error(`${table}.${key}.${field} must be a string.`);
    }
  };

  switch (table) {
    case 'folders':
      string('parentId', true);
      string('data');
      string('index');
      if (
        record.type !== undefined &&
        !['folder', 'doc', 'tag', 'collection'].includes(String(record.type))
      ) {
        throw new Error(`Unsupported folder node type for ${key}.`);
      }
      break;
    case 'document_properties':
      for (const field of [
        'primaryMode',
        'edgelessColorTheme',
        'journal',
        'pageWidth',
        'integrationType',
        'createdBy',
        'updatedBy',
      ]) {
        string(field, true);
      }
      if (
        record.isTemplate !== undefined &&
        typeof record.isTemplate !== 'boolean'
      ) {
        throw new Error(`${table}.${key}.isTemplate must be boolean.`);
      }
      break;
    case 'workspace_properties':
      string('name', true);
      string('type');
      string('show', true);
      string('index', true);
      string('icon', true);
      if (
        record.isDeleted !== undefined &&
        typeof record.isDeleted !== 'boolean'
      ) {
        throw new Error(`${table}.${key}.isDeleted must be boolean.`);
      }
      break;
    case 'pinned_collections':
      string('index');
      break;
    case 'explorer_icons':
      if (!/^(doc|collection|folder|tag):[^:]+$/.test(key)) {
        throw new Error(`Invalid explorer icon key ${key}.`);
      }
      if (
        record.icon !== undefined &&
        (!record.icon ||
          typeof record.icon !== 'object' ||
          Array.isArray(record.icon))
      ) {
        throw new Error(`${table}.${key}.icon must be an object.`);
      }
      break;
    case 'favorites':
      if (!/^(collection|doc|tag|folder):[^:]+$/.test(key)) {
        throw new Error(`Invalid favorite key ${key}.`);
      }
      string('index');
      break;
    case 'user_settings':
      break;
  }
}

function validateFolderGraph(doc: Y.Doc) {
  const records = new Map<string, JsonObject>();
  for (const [id, type] of doc.share.entries()) {
    if (tableField(type, '$$DELETED') === true) continue;
    const record = tableRecord(type);
    if (record.id === id) records.set(id, record);
  }
  for (const [id, record] of records) {
    if (!record.data || !record.type || !record.index) {
      throw new Error(`Folder node ${id} is missing required fields.`);
    }
    const parentId = record.parentId;
    if (parentId === null || parentId === undefined) {
      if (record.type !== 'folder') {
        throw new Error('Only folders can be root organization nodes.');
      }
      continue;
    }
    const parent = records.get(String(parentId));
    if (!parent || parent.type !== 'folder') {
      throw new Error(`Parent folder ${String(parentId)} was not found.`);
    }
    const visited = new Set([id]);
    let current: JsonObject | undefined = parent;
    while (current?.parentId) {
      const currentId = String(current.parentId);
      if (visited.has(currentId))
        throw new Error('Folder cycles are not allowed.');
      visited.add(currentId);
      current = records.get(currentId);
    }
  }
}

@Injectable()
export class WorkspaceOrganizationService {
  private readonly directorySnapshots = new Map<
    string,
    {
      revision: string;
      rows: JsonObject[];
      bytes: number;
      expiresAt: number;
    }
  >();
  private directorySnapshotBytes = 0;

  constructor(
    private readonly reader: DocReader,
    private readonly writer: DocWriter,
    private readonly models: Models
  ) {}

  async withAiSourceCheck<T>(
    input: { workspaceId: string; actorId: string; sessionId?: string | null },
    operation: () => Promise<T>
  ) {
    return await this.writer.withDeferredBroadcasts(() =>
      this.models.copilotContext.withDocumentSourcesShared(
        {
          ...input,
          sink: {
            type: 'tool_write',
            id: input.workspaceId,
            documentId: input.workspaceId,
            workspaceId: input.workspaceId,
            phase: 'execute',
          },
        },
        operation
      )
    );
  }

  private async assertFolderMutation(
    workspaceId: string,
    actorId: string,
    before: JsonObject[],
    after: JsonObject[],
    changedIds: Set<string>
  ) {
    const previous = new Map(before.map(row => [String(row.id), row]));
    for (const rows of [before, after]) {
      const records = new Map(rows.map(row => [String(row.id), row]));
      for (const row of rows) {
        const path: string[] = [];
        let current: JsonObject | undefined = row;
        const seen = new Set<string>();
        while (current) {
          const id = String(current.id);
          if (seen.has(id) || (current.type === 'folder' && path.length >= 64))
            throw new Error('Directory path is invalid or too deeply nested');
          seen.add(id);
          if (current.type === 'folder') path.push(id);
          current =
            typeof current.parentId === 'string'
              ? records.get(current.parentId)
              : undefined;
        }
        if (
          !changedIds.has(String(row.id)) &&
          !path.some(id => changedIds.has(id))
        )
          continue;
        const rights = await this.models.workspaceDirectoryGrant.rights({
          workspaceId,
          actorId,
          directoryIds: path,
        });
        const createsFolder =
          rows === after &&
          row.type === 'folder' &&
          previous.get(String(row.id))?.type !== 'folder';
        if (
          !rights.canRead ||
          !rights.canWrite ||
          !rights.canOrganize ||
          (createsFolder && !rights.canCreateFolder)
        )
          throw new NotFound(
            'The selected directory does not allow this operation'
          );
      }
    }
  }

  async acceptFolderSync<T>(input: {
    workspaceId: string;
    actorId: string;
    updates: Uint8Array[];
    persist: () => Promise<T>;
  }) {
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      input.workspaceId,
      async () => {
        const loaded = await this.load(
          input.workspaceId,
          resolveWorkspaceDataDocId(
            'folders',
            input.workspaceId,
            input.actorId
          ),
          true
        );
        try {
          const before = tableRecords(loaded.doc, true);
          for (const update of input.updates) Y.applyUpdate(loaded.doc, update);
          if (loaded.doc.store.pendingStructs || loaded.doc.store.pendingDs)
            throw new Error(
              'Directory sync requires all update dependencies before authorization'
            );
          for (const [id, type] of loaded.doc.share) {
            if (tableField(type, 'id') !== id)
              throw new Error(
                'Directory sync contains an invalid record identity'
              );
          }
          validateFolderGraph(loaded.doc);
          const after = tableRecords(loaded.doc, true);
          const previous = new Map(
            before.map(row => [String(row.id), JSON.stringify(row)])
          );
          const next = new Map(
            after.map(row => [String(row.id), JSON.stringify(row)])
          );
          const changed = new Set(
            [...previous.keys(), ...next.keys()].filter(
              id => previous.get(id) !== next.get(id)
            )
          );
          await this.assertFolderMutation(
            input.workspaceId,
            input.actorId,
            before,
            after,
            changed
          );
          return await input.persist();
        } finally {
          loaded.doc.destroy();
        }
      }
    );
  }

  private async load(
    workspaceId: string,
    docId: string,
    createIfMissing = false
  ): Promise<LoadedDoc> {
    const record = await this.reader.getDoc(workspaceId, docId);
    if (!record?.bin && !createIfMissing) {
      throw new NotFoundException(`Document ${docId} not found`);
    }
    const doc = new Y.Doc({ guid: docId });
    if (record?.bin) Y.applyUpdate(doc, record.bin);
    return {
      doc,
      stateVector: Y.encodeStateVector(doc),
      sourceRevision: directorySnapshotRevision(record?.bin),
    };
  }

  private async save(
    workspaceId: string,
    docId: string,
    editorId: string,
    loaded: LoadedDoc
  ) {
    const update = Y.encodeStateAsUpdate(loaded.doc, loaded.stateVector);
    return await this.writer.pushDocUpdate(
      workspaceId,
      docId,
      update,
      editorId
    );
  }

  private async readTable(
    workspaceId: string,
    userId: string,
    table: WorkspaceDataTable
  ) {
    const descriptor = TABLES[table];
    const docId = resolveWorkspaceDataDocId(table, workspaceId, userId);
    const loaded = await this.load(workspaceId, docId, true);
    try {
      const records: JsonObject[] = [];
      for (const type of loaded.doc.share.values()) {
        if (tableField(type, '$$DELETED') === true) continue;
        const record = tableRecord(type);
        if (typeof record[descriptor.keyField] === 'string')
          records.push(record);
      }
      return records;
    } finally {
      loaded.doc.destroy();
    }
  }

  async readFolders(workspaceId: string, userId: string) {
    return (await this.readDirectory(workspaceId, userId)).entries.map(
      entry => entry.row
    );
  }

  async documentLocations(
    workspaceId: string,
    userId: string,
    docIds: string[]
  ) {
    if (docIds.length > 200)
      throw new Error('Document location page exceeds its bounds');
    const raw = await this.readDirectorySnapshot(workspaceId, userId);
    const visible = await this.readDirectory(workspaceId, userId);
    const requested = new Set(docIds);
    const placed = new Set(
      raw.rows
        .filter(row => row.type === 'doc' && requested.has(String(row.data)))
        .map(row => String(row.data))
    );
    return docIds.flatMap(docId => {
      if (!placed.has(docId))
        return visible.rootRights.canRead
          ? [{ docId, folderId: null as string | null }]
          : [];
      return visible.entries
        .filter(entry => entry.row.type === 'doc' && entry.row.data === docId)
        .map(entry => ({
          docId,
          folderId:
            typeof entry.row.parentId === 'string' ? entry.row.parentId : null,
        }));
    });
  }

  private async readDirectorySnapshot(workspaceId: string, userId: string) {
    // Storage is read on every request, so missed realtime/Redis invalidation
    // cannot reuse a stale tree. Only parsing is cached, never actor rights.
    const record = await this.reader.getDoc(
      workspaceId,
      resolveWorkspaceDataDocId('folders', workspaceId, userId)
    );
    const revision = directorySnapshotRevision(record?.bin);
    const now = Date.now();
    for (const [key, entry] of this.directorySnapshots) {
      if (entry.expiresAt <= now) {
        this.directorySnapshots.delete(key);
        this.directorySnapshotBytes -= entry.bytes;
      }
    }
    const cached = this.directorySnapshots.get(workspaceId);
    if (cached?.revision === revision) {
      this.directorySnapshots.delete(workspaceId);
      this.directorySnapshots.set(workspaceId, cached);
      return { revision, rows: structuredClone(cached.rows) };
    }
    if (cached) {
      this.directorySnapshots.delete(workspaceId);
      this.directorySnapshotBytes -= cached.bytes;
    }
    const doc = new Y.Doc();
    let rows: JsonObject[];
    try {
      if (record?.bin) Y.applyUpdate(doc, record.bin);
      rows = tableRecords(doc);
      if (rows.length > 10_000)
        throw new BadRequest('Directory listing exceeds the supported limit');
    } finally {
      doc.destroy();
    }
    const bytes = Buffer.byteLength(JSON.stringify(rows));
    if (bytes <= 4 * 1024 * 1024) {
      while (
        this.directorySnapshots.size >= 8 ||
        this.directorySnapshotBytes + bytes > 16 * 1024 * 1024
      ) {
        const oldest = this.directorySnapshots.entries().next().value;
        if (!oldest) break;
        this.directorySnapshots.delete(oldest[0]);
        this.directorySnapshotBytes -= oldest[1].bytes;
      }
      this.directorySnapshots.set(workspaceId, {
        revision,
        rows: structuredClone(rows),
        bytes,
        expiresAt: now + 30_000,
      });
      this.directorySnapshotBytes += bytes;
    }
    return { revision, rows };
  }

  async readDirectory(workspaceId: string, userId: string) {
    const { rows, revision } = await this.readDirectorySnapshot(
      workspaceId,
      userId
    );
    const policies = await this.models.workspaceDirectoryGrant.snapshot(
      workspaceId,
      userId
    );
    const records = new Map(rows.map(row => [String(row.id), row]));
    const byPath = new Map<string, DirectoryRights>();
    const entries: { row: JsonObject; rights: DirectoryRights }[] = [];
    for (const row of rows) {
      const path: string[] = [];
      const seen = new Set<string>();
      let current: JsonObject | undefined = row;
      let valid = true;
      while (current) {
        const id = String(current.id);
        if (seen.has(id) || (current.type === 'folder' && path.length >= 64)) {
          valid = false;
          break;
        }
        seen.add(id);
        if (current.type === 'folder') path.push(id);
        if (typeof current.parentId !== 'string') break;
        current = records.get(current.parentId);
        if (!current || current.type !== 'folder') {
          valid = false;
          break;
        }
      }
      if (!valid) continue;
      const key = JSON.stringify(path);
      let rights = byPath.get(key);
      if (!rights) {
        rights = policies.rights(path);
        byPath.set(key, rights);
      }
      if (rights.canRead) entries.push({ row, rights });
    }
    return {
      entries,
      revision,
      fullSyncAllowed: policies.fullSyncAllowed,
      rootRights: policies.rights([]),
    };
  }

  async readFoldersForAdministration(workspaceId: string, actorId: string) {
    await this.models.workspaceDirectoryGrant.assertAdministrator(
      workspaceId,
      actorId
    );
    return (await this.readDirectorySnapshot(workspaceId, actorId)).rows;
  }

  async directoryRevision(workspaceId: string, userId: string) {
    const record = await this.reader.getDoc(
      workspaceId,
      resolveWorkspaceDataDocId('folders', workspaceId, userId)
    );
    return directorySnapshotRevision(record?.bin);
  }

  async applyConditionalFolderOperations(input: {
    workspaceId: string;
    actorId: string;
    expectedRevision: string;
    operations: WorkspaceDataOperation[];
    authorizeDocument: (docId: string) => Promise<void>;
  }) {
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      input.workspaceId,
      async () => {
        const loaded = await this.load(
          input.workspaceId,
          resolveWorkspaceDataDocId(
            'folders',
            input.workspaceId,
            input.actorId
          ),
          true
        );
        try {
          const revision = loaded.sourceRevision;
          if (revision !== input.expectedRevision)
            throw new Error('Directory changed; refresh before editing');
          const records = new Map(
            tableRecords(loaded.doc, true).map(row => [String(row.id), row])
          );
          const docs = new Set<string>();
          for (const operation of input.operations) {
            const current = records.get(operation.key);
            if (current?.type === 'doc' && typeof current.data === 'string')
              docs.add(current.data);
            if (
              operation.op === 'upsert' &&
              operation.values.type === 'doc' &&
              typeof operation.values.data === 'string'
            )
              docs.add(operation.values.data);
          }
          for (const docId of docs) await input.authorizeDocument(docId);
          await this.applyDataOperations(
            input.workspaceId,
            input.actorId,
            input.actorId,
            'folders',
            input.operations
          );
          return {
            revision: await this.directoryRevision(
              input.workspaceId,
              input.actorId
            ),
          };
        } finally {
          loaded.doc.destroy();
        }
      }
    );
  }

  async readOrganization(workspaceId: string, userId: string) {
    const root = await this.load(workspaceId, workspaceId);
    try {
      const [
        folders,
        documentProperties,
        workspaceProperties,
        pinnedCollections,
        explorerIcons,
        favorites,
        userSettings,
      ] = await Promise.all([
        this.readFolders(workspaceId, userId),
        this.readTable(workspaceId, userId, 'document_properties'),
        this.readTable(workspaceId, userId, 'workspace_properties'),
        this.readTable(workspaceId, userId, 'pinned_collections'),
        this.readTable(workspaceId, userId, 'explorer_icons'),
        this.readTable(workspaceId, userId, 'favorites'),
        this.readTable(workspaceId, userId, 'user_settings'),
      ]);
      const meta = root.doc.getMap('meta');
      return {
        workspace: {
          id: workspaceId,
          name: meta.get('name') ?? null,
          avatar: meta.get('avatar') ?? null,
        },
        documents: rootPages(root.doc).toArray().map(publicRootPageRecord),
        tags: serialize(rootTagOptions(root.doc)),
        collections: serialize(rootCollections(root.doc)),
        folders,
        documentProperties,
        workspaceProperties,
        pinnedCollections,
        explorerIcons,
        favorites,
        userSettings,
      };
    } finally {
      root.doc.destroy();
    }
  }

  async setDocumentTrashed(input: {
    workspaceId: string;
    editorId: string;
    documentId: string;
    expectedTitle: string;
    trashed: boolean;
  }) {
    const loaded = await this.load(input.workspaceId, input.workspaceId);
    try {
      const page = rootPage(loaded.doc, input.documentId);
      if (!page) {
        throw new Error(`Document ${input.documentId} was not found.`);
      }
      const record = rootPageRecord(page.value);
      const title = typeof record.title === 'string' ? record.title : '';
      if (title !== input.expectedTitle) {
        throw new Error(
          'expected_title does not match the current document title.'
        );
      }
      const currentlyTrashed = record.trash === true;
      const currentClaims = rootPageTrashClaims(page.value);
      const nextClaims = input.trashed
        ? [...new Set([...currentClaims, DIRECT_DOCUMENT_TRASH_CLAIM])]
        : currentClaims.filter(claim => claim !== DIRECT_DOCUMENT_TRASH_CLAIM);
      if (
        currentClaims.length === nextClaims.length &&
        currentClaims.every(claim => nextClaims.includes(claim))
      ) {
        return {
          success: true,
          documentId: input.documentId,
          title,
          trashed: currentlyTrashed,
          requestedTrashed: input.trashed,
          remainingTrashClaims: currentClaims.length,
          changed: false,
          idempotentReplay: true,
        };
      }
      const replacement = setRootPageTrashClaims(page.value, nextClaims);
      if (replacement) replaceArrayEntry(page.pages, page.index, replacement);
      await this.save(
        input.workspaceId,
        input.workspaceId,
        input.editorId,
        loaded
      );
      return {
        success: true,
        documentId: input.documentId,
        title,
        trashed: nextClaims.length > 0,
        requestedTrashed: input.trashed,
        remainingTrashClaims: nextClaims.length,
        changed: true,
        idempotentReplay: false,
      };
    } finally {
      loaded.doc.destroy();
    }
  }

  async deleteDocumentPermanently(input: {
    workspaceId: string;
    userId: string;
    editorId: string;
    documentId: string;
    expectedTitle: string;
  }) {
    const root = await this.load(input.workspaceId, input.workspaceId);
    const folders = await this.load(
      input.workspaceId,
      resolveWorkspaceDataDocId('folders', input.workspaceId, input.userId),
      true
    );
    try {
      const page = rootPage(root.doc, input.documentId);
      const allFolderRecords = tableRecords(folders.doc, true);
      const placements = allFolderRecords.filter(
        folder => folder.type === 'doc' && folder.data === input.documentId
      );
      const removedRecordIds = new Set(
        placements.map(placement => String(placement.id))
      );
      const manifestRepairs = folderTrashManifestRepairs({
        records: allFolderRecords,
        removedDocumentIds: new Set([input.documentId]),
        removedRecordIds,
      });
      if (!page) {
        const existingDoc = await this.reader.getDoc(
          input.workspaceId,
          input.documentId
        );
        if (existingDoc) {
          throw new Error(
            'Document must already be in Trash before permanent deletion.'
          );
        }
        if (placements.length || manifestRepairs.length) {
          folders.doc.transact(() => {
            permanentlyRemoveTableRecords(
              folders.doc,
              placements,
              manifestRepairs
            );
          });
          await this.save(
            input.workspaceId,
            resolveWorkspaceDataDocId(
              'folders',
              input.workspaceId,
              input.userId
            ),
            input.editorId,
            folders
          );
        }
        const changed =
          !!existingDoc || placements.length > 0 || manifestRepairs.length > 0;
        return {
          success: true,
          documentId: input.documentId,
          removedPlacementCount: placements.length,
          alreadyAbsent: !changed,
          changed,
          idempotentReplay: !changed,
        };
      }
      const record = rootPageRecord(page.value);
      const title = typeof record.title === 'string' ? record.title : '';
      if (title !== input.expectedTitle) {
        throw new Error(
          'expected_title does not match the current document title.'
        );
      }
      if (record.trash !== true) {
        throw new Error(
          'Document must already be in Trash before permanent deletion.'
        );
      }

      await this.writer.deleteDocPermanently(
        input.workspaceId,
        input.documentId
      );
      root.doc.transact(() => page.pages.delete(page.index, 1));
      folders.doc.transact(() => {
        permanentlyRemoveTableRecords(folders.doc, placements, manifestRepairs);
      });
      await this.save(
        input.workspaceId,
        input.workspaceId,
        input.editorId,
        root
      );
      await this.save(
        input.workspaceId,
        resolveWorkspaceDataDocId('folders', input.workspaceId, input.userId),
        input.editorId,
        folders
      );
      return {
        success: true,
        documentId: input.documentId,
        title,
        removedPlacementCount: placements.length,
        alreadyAbsent: false,
        changed: true,
        idempotentReplay: false,
      };
    } finally {
      root.doc.destroy();
      folders.doc.destroy();
    }
  }

  async trashFolderTree(input: {
    workspaceId: string;
    userId: string;
    editorId: string;
    folderId: string;
    expectedName: string;
    recursive: boolean;
    authorizeDocument: (documentId: string) => Promise<void>;
  }) {
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      input.workspaceId,
      () => this.trashFolderTreeInternal(input)
    );
  }

  private async trashFolderTreeInternal(
    input: Parameters<WorkspaceOrganizationService['trashFolderTree']>[0]
  ) {
    const folderDocId = resolveWorkspaceDataDocId(
      'folders',
      input.workspaceId,
      input.userId
    );
    const folders = await this.load(input.workspaceId, folderDocId, true);
    const root = await this.load(input.workspaceId, input.workspaceId);
    try {
      const authorizationRecords = tableRecords(folders.doc, true);
      await this.assertFolderMutation(
        input.workspaceId,
        input.editorId,
        authorizationRecords,
        authorizationRecords,
        new Set([input.folderId])
      );
      const activeRecords = tableRecords(folders.doc);
      const target = activeRecords.find(
        record => record.id === input.folderId && record.type === 'folder'
      );
      if (!target) {
        const allRecords = tableRecords(folders.doc, true);
        const deletedTarget = allRecords.find(
          record =>
            record.id === input.folderId &&
            record.type === 'folder' &&
            record.$$DELETED === true &&
            record[FOLDER_TRASH_ROOT] === true
        );
        if (!deletedTarget) {
          return {
            success: true,
            folderId: input.folderId,
            alreadyAbsent: true,
            changed: false,
            idempotentReplay: true,
          };
        }
        if (deletedTarget.data !== input.expectedName) {
          throw new Error(
            'expected_name does not match the trashed folder name.'
          );
        }
        const operationId = String(
          deletedTarget[FOLDER_TRASH_OPERATION_ID] ?? ''
        );
        const nodes = allRecords.filter(
          record =>
            record.$$DELETED === true &&
            record[FOLDER_TRASH_OPERATION_ID] === operationId
        );
        const documentIds = stringArray(
          deletedTarget[FOLDER_TRASH_DOCUMENT_IDS]
        );
        const newlyTrashedDocumentIds = stringArray(
          deletedTarget[FOLDER_TRASH_NEW_DOCUMENT_IDS]
        );
        const previouslyTrashedDocumentIds = stringArray(
          deletedTarget[FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS]
        );
        const manifestFingerprint = folderTrashFingerprint({
          rootFolderId: input.folderId,
          nodes,
          documentIds,
          newlyTrashedDocumentIds,
          previouslyTrashedDocumentIds,
        });
        if (deletedTarget[FOLDER_TRASH_FINGERPRINT] !== manifestFingerprint) {
          throw new Error(
            'The trashed folder manifest fingerprint is invalid.'
          );
        }
        let repairedDocumentCount = 0;
        const folderClaim = `folder:${operationId}`;
        for (const documentId of documentIds) {
          await input.authorizeDocument(documentId);
          const page = rootPage(root.doc, documentId);
          if (!page) {
            throw new Error(
              `Folder references missing document ${documentId}.`
            );
          }
          const legacyClaims = newlyTrashedDocumentIds.includes(documentId)
            ? []
            : [DIRECT_DOCUMENT_TRASH_CLAIM];
          const claims = rootPageTrashClaims(page.value, legacyClaims);
          if (!claims.includes(folderClaim)) {
            const replacement = setRootPageTrashClaims(page.value, [
              ...claims,
              folderClaim,
            ]);
            if (replacement)
              replaceArrayEntry(page.pages, page.index, replacement);
            repairedDocumentCount++;
          }
        }
        if (repairedDocumentCount) {
          await this.save(
            input.workspaceId,
            input.workspaceId,
            input.editorId,
            root
          );
        }
        return {
          success: true,
          folderId: input.folderId,
          trashOperationId: operationId,
          manifestFingerprint,
          trashedFolderCount: nodes.filter(record => record.type === 'folder')
            .length,
          trashedDocumentCount: documentIds.length,
          repairedDocumentCount,
          alreadyAbsent: false,
          changed: repairedDocumentCount > 0,
          idempotentReplay: repairedDocumentCount === 0,
        };
      }
      if (target.data !== input.expectedName) {
        throw new Error(
          'expected_name does not match the current folder name.'
        );
      }
      const subtree = folderDescendants(activeRecords, input.folderId);
      if (subtree.length > MAX_FOLDER_LIFECYCLE_NODES) {
        throw new Error(
          `The folder tree exceeds the ${MAX_FOLDER_LIFECYCLE_NODES}-record safety limit.`
        );
      }
      if (subtree.length > 1 && !input.recursive) {
        throw new Error(
          'The folder is not empty. Set recursive=true to move the folder tree and its documents to Trash.'
        );
      }
      const documentIds = [
        ...new Set(
          subtree.flatMap(record =>
            record.type === 'doc' && typeof record.data === 'string'
              ? [record.data]
              : []
          )
        ),
      ];
      const trashOperationId = nanoid();
      const folderClaim = `folder:${trashOperationId}`;
      const newlyTrashedDocumentIds: string[] = [];
      const previouslyTrashedDocumentIds: string[] = [];
      for (const documentId of documentIds) {
        await input.authorizeDocument(documentId);
        const page = rootPage(root.doc, documentId);
        if (!page) {
          throw new Error(`Folder references missing document ${documentId}.`);
        }
        if (rootPageTrashClaims(page.value).length > 0) {
          previouslyTrashedDocumentIds.push(documentId);
        } else {
          newlyTrashedDocumentIds.push(documentId);
        }
      }
      const manifestFingerprint = folderTrashFingerprint({
        rootFolderId: input.folderId,
        nodes: subtree,
        documentIds,
        newlyTrashedDocumentIds,
        previouslyTrashedDocumentIds,
      });
      root.doc.transact(() => {
        for (const documentId of documentIds) {
          const page = rootPage(root.doc, documentId);
          if (!page) continue;
          const replacement = setRootPageTrashClaims(page.value, [
            ...rootPageTrashClaims(page.value),
            folderClaim,
          ]);
          if (replacement)
            replaceArrayEntry(page.pages, page.index, replacement);
        }
      });
      folders.doc.transact(() => {
        for (const node of subtree) {
          const stored = folders.doc.getMap<unknown>(String(node.id));
          stored.set('$$DELETED', true);
          stored.set(FOLDER_TRASH_OPERATION_ID, trashOperationId);
          if (node.id === input.folderId) {
            stored.set(FOLDER_TRASH_ROOT, true);
            stored.set(FOLDER_TRASH_ACTOR_ID, input.editorId);
            stored.set(FOLDER_TRASHED_AT, Date.now());
            stored.set(FOLDER_TRASH_DOCUMENT_IDS, documentIds);
            stored.set(FOLDER_TRASH_NEW_DOCUMENT_IDS, newlyTrashedDocumentIds);
            stored.set(
              FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS,
              previouslyTrashedDocumentIds
            );
            stored.set(FOLDER_TRASH_FINGERPRINT, manifestFingerprint);
          }
        }
      });
      await this.save(input.workspaceId, folderDocId, input.editorId, folders);
      await this.save(
        input.workspaceId,
        input.workspaceId,
        input.editorId,
        root
      );
      return {
        success: true,
        folderId: input.folderId,
        trashOperationId,
        manifestFingerprint,
        trashedFolderCount: subtree.filter(record => record.type === 'folder')
          .length,
        trashedPlacementCount: subtree.filter(
          record => record.type !== 'folder'
        ).length,
        trashedDocumentCount: documentIds.length,
        newlyTrashedDocumentCount: newlyTrashedDocumentIds.length,
        previouslyTrashedDocumentCount: previouslyTrashedDocumentIds.length,
        alreadyAbsent: false,
        changed: true,
        idempotentReplay: false,
      };
    } finally {
      folders.doc.destroy();
      root.doc.destroy();
    }
  }

  async restoreFolderTree(input: {
    workspaceId: string;
    userId: string;
    editorId: string;
    folderId: string;
    expectedName: string;
    authorizeDocument: (documentId: string) => Promise<void>;
  }) {
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      input.workspaceId,
      () => this.restoreFolderTreeInternal(input)
    );
  }

  private async restoreFolderTreeInternal(
    input: Parameters<WorkspaceOrganizationService['restoreFolderTree']>[0]
  ) {
    const folderDocId = resolveWorkspaceDataDocId(
      'folders',
      input.workspaceId,
      input.userId
    );
    const folders = await this.load(input.workspaceId, folderDocId, true);
    const root = await this.load(input.workspaceId, input.workspaceId);
    try {
      const allRecords = tableRecords(folders.doc, true);
      await this.assertFolderMutation(
        input.workspaceId,
        input.editorId,
        allRecords,
        allRecords,
        new Set([input.folderId])
      );
      const activeTarget = allRecords.find(
        record =>
          record.id === input.folderId &&
          record.type === 'folder' &&
          record.$$DELETED !== true
      );
      if (activeTarget) {
        if (activeTarget.data !== input.expectedName) {
          throw new Error(
            'expected_name does not match the current folder name.'
          );
        }
        return {
          success: true,
          folderId: input.folderId,
          changed: false,
          idempotentReplay: true,
        };
      }
      const target = allRecords.find(
        record =>
          record.id === input.folderId &&
          record.type === 'folder' &&
          record.$$DELETED === true &&
          record[FOLDER_TRASH_ROOT] === true
      );
      if (!target)
        throw new Error(`Trashed folder ${input.folderId} was not found.`);
      if (target.data !== input.expectedName) {
        throw new Error(
          'expected_name does not match the trashed folder name.'
        );
      }
      const operationId = String(target[FOLDER_TRASH_OPERATION_ID] ?? '');
      const nodes = allRecords.filter(
        record =>
          record.$$DELETED === true &&
          record[FOLDER_TRASH_OPERATION_ID] === operationId
      );
      const documentIds = stringArray(target[FOLDER_TRASH_DOCUMENT_IDS]);
      const newlyTrashedDocumentIds = stringArray(
        target[FOLDER_TRASH_NEW_DOCUMENT_IDS]
      );
      const previouslyTrashedDocumentIds = stringArray(
        target[FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS]
      );
      const fingerprint = folderTrashFingerprint({
        rootFolderId: input.folderId,
        nodes,
        documentIds,
        newlyTrashedDocumentIds,
        previouslyTrashedDocumentIds,
      });
      if (target[FOLDER_TRASH_FINGERPRINT] !== fingerprint) {
        throw new Error('The trashed folder manifest fingerprint is invalid.');
      }
      const activeIds = new Set(
        allRecords.flatMap(record =>
          record.$$DELETED !== true && typeof record.id === 'string'
            ? [record.id]
            : []
        )
      );
      const operationNodeIds = new Set(nodes.map(record => String(record.id)));
      const parentId =
        typeof target.parentId === 'string' ? target.parentId : null;
      if (
        parentId &&
        !activeIds.has(parentId) &&
        !operationNodeIds.has(parentId)
      ) {
        throw new Error('The original parent folder is no longer available.');
      }
      for (const documentId of documentIds) {
        await input.authorizeDocument(documentId);
        const page = rootPage(root.doc, documentId);
        if (!page) {
          throw new Error(`Document ${documentId} can no longer be restored.`);
        }
      }
      const folderClaim = `folder:${operationId}`;
      let restoredDocumentCount = 0;
      root.doc.transact(() => {
        for (const documentId of documentIds) {
          const page = rootPage(root.doc, documentId);
          if (!page) continue;
          const legacyClaims = newlyTrashedDocumentIds.includes(documentId)
            ? [folderClaim]
            : [DIRECT_DOCUMENT_TRASH_CLAIM, folderClaim];
          const remainingClaims = rootPageTrashClaims(
            page.value,
            legacyClaims
          ).filter(claim => claim !== folderClaim);
          if (!remainingClaims.length) restoredDocumentCount++;
          const replacement = setRootPageTrashClaims(
            page.value,
            remainingClaims
          );
          if (replacement)
            replaceArrayEntry(page.pages, page.index, replacement);
        }
      });
      folders.doc.transact(() => {
        for (const node of nodes) {
          const stored = folders.doc.getMap<unknown>(String(node.id));
          stored.delete('$$DELETED');
          for (const key of FOLDER_TRASH_METADATA_KEYS) stored.delete(key);
        }
      });
      validateFolderGraph(folders.doc);
      await this.save(
        input.workspaceId,
        input.workspaceId,
        input.editorId,
        root
      );
      await this.save(input.workspaceId, folderDocId, input.editorId, folders);
      return {
        success: true,
        folderId: input.folderId,
        trashOperationId: operationId,
        manifestFingerprint: fingerprint,
        restoredFolderCount: nodes.filter(record => record.type === 'folder')
          .length,
        restoredPlacementCount: nodes.filter(record => record.type !== 'folder')
          .length,
        restoredDocumentCount,
        leftInTrashDocumentCount: documentIds.length - restoredDocumentCount,
        changed: true,
        idempotentReplay: false,
      };
    } finally {
      folders.doc.destroy();
      root.doc.destroy();
    }
  }

  async deleteFolderTreePermanently(input: {
    workspaceId: string;
    userId: string;
    editorId: string;
    folderId: string;
    expectedName: string;
    authorizeDocument: (documentId: string) => Promise<void>;
  }) {
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      input.workspaceId,
      () => this.deleteFolderTreePermanentlyInternal(input)
    );
  }

  private async deleteFolderTreePermanentlyInternal(
    input: Parameters<
      WorkspaceOrganizationService['deleteFolderTreePermanently']
    >[0]
  ) {
    const folderDocId = resolveWorkspaceDataDocId(
      'folders',
      input.workspaceId,
      input.userId
    );
    const folders = await this.load(input.workspaceId, folderDocId, true);
    const root = await this.load(input.workspaceId, input.workspaceId);
    try {
      const allRecords = tableRecords(folders.doc, true);
      await this.assertFolderMutation(
        input.workspaceId,
        input.editorId,
        allRecords,
        allRecords,
        new Set([input.folderId])
      );
      const activeTarget = allRecords.find(
        record =>
          record.id === input.folderId &&
          record.type === 'folder' &&
          record.$$DELETED !== true
      );
      if (activeTarget) {
        throw new Error(
          'Folder must already be in Trash before permanent deletion.'
        );
      }
      const target = allRecords.find(
        record =>
          record.id === input.folderId &&
          record.type === 'folder' &&
          record.$$DELETED === true &&
          record[FOLDER_TRASH_ROOT] === true
      );
      if (!target) {
        return {
          success: true,
          folderId: input.folderId,
          alreadyAbsent: true,
          changed: false,
          idempotentReplay: true,
        };
      }
      if (target.data !== input.expectedName) {
        throw new Error(
          'expected_name does not match the trashed folder name.'
        );
      }
      const operationId = String(target[FOLDER_TRASH_OPERATION_ID] ?? '');
      const nodes = allRecords.filter(
        record =>
          record.$$DELETED === true &&
          record[FOLDER_TRASH_OPERATION_ID] === operationId
      );
      const documentIds = stringArray(target[FOLDER_TRASH_DOCUMENT_IDS]);
      const newlyTrashedDocumentIds = stringArray(
        target[FOLDER_TRASH_NEW_DOCUMENT_IDS]
      );
      const previouslyTrashedDocumentIds = stringArray(
        target[FOLDER_TRASH_PREVIOUS_DOCUMENT_IDS]
      );
      const fingerprint = folderTrashFingerprint({
        rootFolderId: input.folderId,
        nodes,
        documentIds,
        newlyTrashedDocumentIds,
        previouslyTrashedDocumentIds,
      });
      if (target[FOLDER_TRASH_FINGERPRINT] !== fingerprint) {
        throw new Error('The trashed folder manifest fingerprint is invalid.');
      }
      for (const documentId of documentIds) {
        const page = rootPage(root.doc, documentId);
        if (page && rootPageRecord(page.value).trash !== true) {
          throw new Error(
            `Document ${documentId} is no longer in Trash; permanent deletion scope changed.`
          );
        }
        if (page) {
          await input.authorizeDocument(documentId);
        } else if (await this.reader.getDoc(input.workspaceId, documentId)) {
          throw new Error(
            `Document ${documentId} is no longer in Trash; permanent deletion scope changed.`
          );
        }
      }
      const documentIdSet = new Set(documentIds);
      const permanentlyRemovedRecords = allRecords.filter(
        record =>
          record[FOLDER_TRASH_OPERATION_ID] === operationId ||
          (record.type === 'doc' &&
            typeof record.data === 'string' &&
            documentIdSet.has(record.data))
      );
      const removedRecordIds = new Set(
        permanentlyRemovedRecords.map(record => String(record.id))
      );
      const manifestRepairs = folderTrashManifestRepairs({
        records: allRecords,
        removedDocumentIds: documentIdSet,
        removedRecordIds,
        ignoredOperationIds: new Set([operationId]),
      });
      for (const documentId of documentIds) {
        await this.writer.deleteDocPermanently(input.workspaceId, documentId);
      }
      const pageIndexes = documentIds
        .map(documentId => rootPage(root.doc, documentId)?.index)
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => right - left);
      root.doc.transact(() => {
        const pages = rootPages(root.doc);
        for (const index of pageIndexes) pages.delete(index, 1);
      });
      folders.doc.transact(() => {
        permanentlyRemoveTableRecords(
          folders.doc,
          permanentlyRemovedRecords,
          manifestRepairs
        );
      });
      await this.save(
        input.workspaceId,
        input.workspaceId,
        input.editorId,
        root
      );
      await this.save(input.workspaceId, folderDocId, input.editorId, folders);
      return {
        success: true,
        folderId: input.folderId,
        trashOperationId: operationId,
        manifestFingerprint: fingerprint,
        permanentlyDeletedFolderCount: nodes.filter(
          record => record.type === 'folder'
        ).length,
        permanentlyDeletedDocumentCount: documentIds.length,
        removedPlacementCount: permanentlyRemovedRecords.filter(
          record => record.type === 'doc'
        ).length,
        alreadyAbsent: false,
        changed: true,
        idempotentReplay: false,
      };
    } finally {
      folders.doc.destroy();
      root.doc.destroy();
    }
  }

  async applyRootOperations(
    workspaceId: string,
    editorId: string,
    operations: WorkspaceRootOperation[]
  ) {
    assertOperations(operations);
    const loaded = await this.load(workspaceId, workspaceId);
    const createdTagIds: string[] = [];
    const createdCollectionIds: string[] = [];
    try {
      loaded.doc.transact(() => {
        for (const operation of operations) {
          const pages = rootPages(loaded.doc);
          const tags = rootTagOptions(loaded.doc);
          const collections = rootCollections(loaded.doc);
          switch (operation.op) {
            case 'set_workspace_profile': {
              const meta = loaded.doc.getMap('meta');
              if (operation.name !== undefined)
                meta.set('name', operation.name);
              if (operation.avatar === null) meta.delete('avatar');
              else if (operation.avatar !== undefined) {
                meta.set('avatar', operation.avatar);
              }
              break;
            }
            case 'set_document_trashed': {
              const index = findArrayEntry(pages, 'id', operation.docId);
              if (index < 0)
                throw new Error(`Document ${operation.docId} was not found.`);
              const page = pages.get(index);
              const currentClaims = rootPageTrashClaims(page);
              const nextClaims = operation.trashed
                ? [...new Set([...currentClaims, DIRECT_DOCUMENT_TRASH_CLAIM])]
                : currentClaims.filter(
                    claim => claim !== DIRECT_DOCUMENT_TRASH_CLAIM
                  );
              const replacement = setRootPageTrashClaims(page, nextClaims);
              if (replacement) replaceArrayEntry(pages, index, replacement);
              break;
            }
            case 'create_tag': {
              const id = operation.id ?? nanoid();
              if (findArrayEntry(tags, 'id', id) >= 0) {
                throw new Error(`Tag ${id} already exists.`);
              }
              tags.push([
                {
                  id,
                  value: operation.value,
                  color: operation.color,
                  createDate: Date.now(),
                  updateDate: Date.now(),
                  ...(operation.parentId
                    ? { parentId: operation.parentId }
                    : {}),
                },
              ]);
              createdTagIds.push(id);
              break;
            }
            case 'update_tag': {
              const index = findArrayEntry(tags, 'id', operation.tagId);
              if (index < 0)
                throw new Error(`Tag ${operation.tagId} was not found.`);
              const next = jsonObject(tags.get(index));
              if (operation.value !== undefined) next.value = operation.value;
              if (operation.color !== undefined) next.color = operation.color;
              if (operation.parentId === null) delete next.parentId;
              else if (operation.parentId !== undefined)
                next.parentId = operation.parentId;
              next.updateDate = Date.now();
              replaceArrayEntry(tags, index, next);
              break;
            }
            case 'delete_tag': {
              const index = findArrayEntry(tags, 'id', operation.tagId);
              if (index < 0)
                throw new Error(`Tag ${operation.tagId} was not found.`);
              tags.delete(index, 1);
              pages.forEach(page => {
                if (!(page instanceof Y.Map)) return;
                const pageTags = page.get('tags');
                if (!(pageTags instanceof Y.Array)) return;
                const next = pageTags
                  .toArray()
                  .filter(tagId => tagId !== operation.tagId);
                pageTags.delete(0, pageTags.length);
                pageTags.push(next);
              });
              break;
            }
            case 'set_document_tags': {
              for (const tagId of operation.tagIds) {
                if (findArrayEntry(tags, 'id', tagId) < 0) {
                  throw new Error(`Tag ${tagId} was not found.`);
                }
              }
              const index = findArrayEntry(pages, 'id', operation.docId);
              if (index < 0)
                throw new Error(`Document ${operation.docId} was not found.`);
              const page = pages.get(index);
              if (page instanceof Y.Map) {
                let pageTags = page.get('tags');
                if (!(pageTags instanceof Y.Array)) {
                  pageTags = new Y.Array<string>();
                  page.set('tags', pageTags);
                }
                pageTags.delete(0, pageTags.length);
                pageTags.push(operation.tagIds);
              } else {
                replaceArrayEntry(pages, index, {
                  ...jsonObject(page),
                  tags: [...operation.tagIds],
                });
              }
              break;
            }
            case 'create_collection': {
              const id = operation.id ?? nanoid();
              if (findArrayEntry(collections, 'id', id) >= 0) {
                throw new Error(`Collection ${id} already exists.`);
              }
              collections.push([
                {
                  id,
                  name: operation.name,
                  rules: operation.rules ?? { filters: [] },
                  allowList: operation.allowList ?? [],
                },
              ]);
              createdCollectionIds.push(id);
              break;
            }
            case 'update_collection': {
              const index = findArrayEntry(
                collections,
                'id',
                operation.collectionId
              );
              if (index < 0) {
                throw new Error(
                  `Collection ${operation.collectionId} was not found.`
                );
              }
              const next = jsonObject(collections.get(index));
              if (operation.name !== undefined) next.name = operation.name;
              if (operation.rules !== undefined) next.rules = operation.rules;
              if (operation.allowList !== undefined)
                next.allowList = operation.allowList;
              replaceArrayEntry(collections, index, next);
              break;
            }
            case 'delete_collection': {
              const index = findArrayEntry(
                collections,
                'id',
                operation.collectionId
              );
              if (index < 0) {
                throw new Error(
                  `Collection ${operation.collectionId} was not found.`
                );
              }
              collections.delete(index, 1);
              break;
            }
          }
        }
      });
      const saved = await this.save(workspaceId, workspaceId, editorId, loaded);
      return { workspaceId, createdTagIds, createdCollectionIds, ...saved };
    } finally {
      loaded.doc.destroy();
    }
  }

  async applyDataOperations(
    workspaceId: string,
    userId: string,
    editorId: string,
    table: WorkspaceDataTable,
    operations: WorkspaceDataOperation[]
  ) {
    const apply = () =>
      this.applyDataOperationsInternal(
        workspaceId,
        userId,
        editorId,
        table,
        operations
      );
    return table === 'folders'
      ? await this.models.workspaceDirectoryGrant.withMutationLock(
          workspaceId,
          apply
        )
      : await apply();
  }

  private async applyDataOperationsInternal(
    workspaceId: string,
    userId: string,
    editorId: string,
    table: WorkspaceDataTable,
    operations: WorkspaceDataOperation[]
  ) {
    assertOperations(operations);
    const descriptor = TABLES[table];
    const docId = resolveWorkspaceDataDocId(table, workspaceId, userId);
    const loaded = await this.load(workspaceId, docId, true);
    try {
      const previousFolders =
        table === 'folders' ? tableRecords(loaded.doc) : [];
      loaded.doc.transact(() => {
        for (const operation of operations) {
          const existed = loaded.doc.share.has(operation.key);
          const record = loaded.doc.getMap<unknown>(operation.key);
          if (operation.op === 'delete') {
            if (!existed || record.get('$$DELETED') === true) {
              throw new Error(
                `${table} record ${operation.key} was not found.`
              );
            }
            for (const key of Array.from(record.keys())) {
              if (key !== descriptor.keyField) record.delete(key);
            }
            record.set(descriptor.keyField, operation.key);
            record.set('$$DELETED', true);
            continue;
          }
          if (
            Object.prototype.hasOwnProperty.call(
              operation.values,
              descriptor.keyField
            )
          ) {
            throw new Error(
              `${descriptor.keyField} is controlled by the operation key.`
            );
          }
          validateTableRecord(table, operation.key, operation.values);
          record.set(descriptor.keyField, operation.key);
          for (const [key, value] of Object.entries(operation.values)) {
            record.set(key, value);
          }
          record.delete('$$DELETED');
        }
      });
      if (table === 'folders') {
        validateFolderGraph(loaded.doc);
        await this.assertFolderMutation(
          workspaceId,
          editorId,
          previousFolders,
          tableRecords(loaded.doc),
          new Set(operations.map(operation => operation.key))
        );
      }
      const saved = await this.save(workspaceId, docId, editorId, loaded);
      return { workspaceId, table, storageDocId: docId, ...saved };
    } finally {
      loaded.doc.destroy();
    }
  }
}
