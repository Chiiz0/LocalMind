import test from 'ava';
import * as Y from 'yjs';

import {
  inspectDocumentCopySnapshot,
  remapDocumentCopyBlobs,
} from '../../core/doc/copy-snapshot';

test('copy snapshot finds block attachments and rich-text footnotes without collecting ordinary text', t => {
  const document = new Y.Doc();
  try {
    const block = new Y.Map();
    block.set('prop:sourceId', 'image-blob');
    block.set(
      'prop:caption',
      'Do not interpret sourceId:private as an attachment'
    );
    const text = new Y.Text();
    text.insert(0, 'citation', {
      reference: { type: 'attachment', blobId: 'footnote-blob' },
    });
    block.set('prop:text', text);
    block.set('prop:nested', [
      { sourceId: 'image-blob' },
      { sourceId: 'https://example.com/image.png' },
    ]);
    document.getMap('blocks').set('image', block);
    const original = Y.encodeStateAsUpdate(document);
    const inspected = inspectDocumentCopySnapshot(original);
    t.deepEqual(inspected.blobIds, ['footnote-blob', 'image-blob']);
    t.deepEqual(inspected.binary, Buffer.from(original));
    original.fill(0);
    t.not(inspected.binary[0], 0);
  } finally {
    document.destroy();
  }
});

test('copy snapshot rejects transient attachments and excessive reference counts', t => {
  const document = new Y.Doc();
  try {
    const block = new Y.Map();
    document.getMap('blocks').set('attachment', block);
    block.set('prop:sourceId', 'blob:temporary-upload');
    t.throws(
      () => inspectDocumentCopySnapshot(Y.encodeStateAsUpdate(document)),
      { message: 'Document contains an unsupported attachment reference' }
    );
    block.delete('prop:sourceId');
    block.set(
      'prop:attachments',
      Array.from({ length: 257 }, (_, index) => ({ blobId: `blob-${index}` }))
    );
    t.throws(
      () => inspectDocumentCopySnapshot(Y.encodeStateAsUpdate(document)),
      { message: 'Document has too many attachments' }
    );
  } finally {
    document.destroy();
  }
});

test('copy blob remapping preserves formatted citations, nested structures and original snapshot', t => {
  const source = new Y.Doc();
  const target = new Y.Doc();
  try {
    const block = new Y.Map();
    block.set('prop:sourceId', 'source-image');
    block.set('prop:columns', [
      { id: 'status', name: 'source-image', data: { options: ['Open'] } },
    ]);
    const text = new Y.Text();
    text.insert(0, 'Citation', {
      bold: true,
      reference: { blobId: 'source-citation', type: 'attachment' },
    });
    text.insert(8, ' plain text');
    block.set('prop:text', text);
    const nested = new Y.Array();
    nested.push([{ blobId: 'source-image' }]);
    block.set('prop:attachments', nested);
    source.getMap('blocks').set('block', block);
    const snapshot = Y.encodeStateAsUpdate(source);
    const mapped = remapDocumentCopyBlobs(
      snapshot,
      new Map([
        ['source-image', 'target-image'],
        ['source-citation', 'target-citation'],
      ])
    );
    Y.applyUpdate(target, mapped);
    const targetBlock = target.getMap<Y.Map<unknown>>('blocks').get('block')!;
    t.is(targetBlock.get('prop:sourceId'), 'target-image');
    t.deepEqual(targetBlock.get('prop:columns'), block.get('prop:columns'));
    const targetText = targetBlock.get('prop:text') as Y.Text;
    t.is(targetText.toString(), text.toString());
    t.like(targetText.toDelta()[0], {
      attributes: {
        bold: true,
        reference: { blobId: 'target-citation', type: 'attachment' },
      },
    });
    t.deepEqual(
      (targetBlock.get('prop:attachments') as Y.Array<unknown>).toArray(),
      [{ blobId: 'target-image' }]
    );
    t.deepEqual(inspectDocumentCopySnapshot(snapshot).blobIds, [
      'source-citation',
      'source-image',
    ]);
    t.throws(() => remapDocumentCopyBlobs(snapshot, new Map()));
  } finally {
    source.destroy();
    target.destroy();
  }
});
