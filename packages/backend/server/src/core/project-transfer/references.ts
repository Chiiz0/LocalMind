import {
  applyUpdate,
  Array as YArray,
  Doc,
  encodeStateAsUpdate,
  Map as YMap,
  Text as YText,
} from 'yjs';
import { z } from 'zod';

import { BadRequest } from '../../base';

const referenceSchema = z
  .object({ pageId: z.string().min(1).max(512) })
  .passthrough();

export function isolateImportedReferences(
  bytes: Buffer,
  input: (
    | { workspaceId: string; projectId?: never }
    | { projectId: string; workspaceId?: never }
  ) & { sourceResourceId: string; resourceId: string }
) {
  const document = new Doc();
  const ownerId = input.projectId ?? input.workspaceId;
  if (!ownerId) throw new BadRequest('Imported reference owner is unavailable');
  const url = (id: string) =>
    input.projectId
      ? `/project/${encodeURIComponent(input.projectId)}/resources/${encodeURIComponent(id)}`
      : `/workspace/${encodeURIComponent(ownerId)}/${encodeURIComponent(id)}`;
  let visited = 0;
  const visit = (value: unknown, depth = 0): void => {
    if (++visited > 100000 || depth > 64)
      throw new BadRequest(
        'Imported references exceed their structural bounds'
      );
    if (value instanceof YText) {
      const delta: {
        insert?: string | object;
        retain?: number;
        delete?: number;
        attributes?: Record<string, unknown>;
      }[] = value.toDelta();
      let changed = false;
      const next = delta.map(part => {
        const ref = referenceSchema.safeParse(part.attributes?.reference);
        if (!ref.success) return part;
        changed = true;
        const attributes = { ...part.attributes };
        if (ref.data.pageId === input.sourceResourceId) {
          attributes.reference = { ...ref.data, pageId: input.resourceId };
        } else {
          delete attributes.reference;
          attributes.link = url(ref.data.pageId);
        }
        return { ...part, attributes };
      });
      if (changed) {
        value.delete(0, value.length);
        value.applyDelta(next);
      }
    } else if (value instanceof YMap) {
      const flavour = value.get('sys:flavour');
      const id: unknown = value.get('prop:pageId');
      if (
        (flavour === 'affine:embed-linked-doc' ||
          flavour === 'affine:embed-synced-doc') &&
        typeof id === 'string'
      ) {
        if (id === input.sourceResourceId)
          value.set('prop:pageId', input.resourceId);
        else {
          // An external embed becomes an explicit link; no recursive source copy or shared mutable editor is retained.
          value.set('sys:flavour', 'affine:bookmark');
          value.set('sys:version', 1);
          value.set('prop:url', url(id));
          value.set('prop:style', 'horizontal');
          value.delete('prop:pageId');
          value.delete('prop:params');
          value.delete('prop:alias');
        }
      }
      for (const child of value.values()) visit(child, depth + 1);
    } else if (value instanceof YArray) {
      for (const child of value.toArray()) visit(child, depth + 1);
    }
  };
  try {
    applyUpdate(document, bytes);
    document.transact(() => {
      for (const name of document.share.keys()) visit(document.getMap(name));
    });
    return Buffer.from(encodeStateAsUpdate(document));
  } finally {
    document.destroy();
  }
}
