import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

import { openDocxPackage, readDocxSemanticState } from '@localmind/office/docx';
import { openPdfPackage, readPdfSemanticState } from '@localmind/office/pdf';
import {
  openPptxPackage,
  PPTX_PRESENTATION_CONTENT_TYPE,
  readPptxSemanticState,
} from '@localmind/office/pptx';
import {
  createMinimalPdfFixture,
  createMinimalPptxFixture,
  createMinimalXlsxFixture,
} from '@localmind/office/testing';
import { openXlsxPackage, readXlsxSemanticState } from '@localmind/office/xlsx';
import { OfficeArtifactKind, OfficeRevisionOrigin } from '@prisma/client';
import test from 'ava';
import { strToU8 } from 'fflate';
import Sinon from 'sinon';

import { OFFICE_FORMATS, OfficeCommandService } from '../../core/office';
import type { PermissionAccess } from '../../core/permission';
import type { WorkspaceBlobStorage } from '../../core/storage';
import type { Models } from '../../models';
import { workspaceOfficeStorage } from './office-storage.fixture';

function fingerprint(bytes: Uint8Array) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function aiBatch(
  artifactId: string,
  revisionId: string,
  commands: Record<string, unknown>[]
) {
  return {
    version: 'localmind-office-command-batch/v1',
    batchId: `${artifactId}-batch`,
    idempotencyKey: `${artifactId}-batch-key`,
    artifactId,
    expectedRevisionId: revisionId,
    source: 'ai',
    commands: commands.map((command, index) => ({
      version: 'localmind-office-command/v1',
      commandId: `${artifactId}-command-${index + 1}`,
      idempotencyKey: `${artifactId}-command-key-${index + 1}`,
      artifactId,
      expectedRevisionId: revisionId,
      source: 'ai',
      ...command,
    })),
  };
}

async function executeNativeBatch(input: {
  artifactId: string;
  revisionId: string;
  kind: OfficeArtifactKind;
  format: keyof typeof OFFICE_FORMATS;
  sourceBytes: Uint8Array;
  batch: ReturnType<typeof aiBatch>;
}) {
  const policy = OFFICE_FORMATS[input.format];
  const written = new Map<string, Buffer>();
  const appendRevision = Sinon.stub().callsFake(async revisionInput => ({
    created: true,
    revision: {
      id: `${input.revisionId}-ai`,
      artifactId: input.artifactId,
      sequence: 2,
      origin: OfficeRevisionOrigin.ai,
      packageBlobKey: revisionInput.package.key,
      stateBlobKey: revisionInput.state?.key,
    },
  }));
  const models = {
    copilotContext: {
      withDocumentSourcesShared: Sinon.stub().callsFake(
        async (_input, execute) => execute()
      ),
    },
    officeArtifact: {
      get: Sinon.stub().resolves({ id: input.artifactId, kind: input.kind }),
      getCurrentRevision: Sinon.stub().resolves({
        id: input.revisionId,
        sequence: 1,
        packageBlobKey: `office/package/${input.format}/source${policy.extension}`,
        packageMimeType: policy.mimeType,
        packageByteSize: input.sourceBytes.byteLength,
        packageFingerprint: fingerprint(input.sourceBytes),
      }),
      appendRevision,
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(Buffer.from(input.sourceBytes)),
      metadata: {
        contentType: policy.mimeType,
        contentLength: input.sourceBytes.byteLength,
      },
    }),
    put: Sinon.stub().callsFake(async (_workspaceId, key, bytes) => {
      written.set(key, Buffer.from(bytes));
    }),
  } as unknown as WorkspaceBlobStorage;
  const assert = Sinon.stub().resolves();
  const access = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeCommandService(
    models,
    workspaceOfficeStorage(storage),
    access
  );

  const result = await service.executeBatch({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch: input.batch,
  });
  const downloadedPackage = written.get(result.packageBlobKey);
  const downloadedState = written.get(result.stateBlobKey);
  if (!downloadedPackage || !downloadedState) {
    throw new Error('Office AI execution did not persist both revision assets');
  }
  return {
    result,
    downloadedPackage,
    downloadedState,
    appendRevision,
    assert,
    writeCount: (storage.put as Sinon.SinonStub).callCount,
  };
}

function firstEditableParagraph(bytes: Uint8Array) {
  const state = readDocxSemanticState(openDocxPackage(bytes));
  const queue = [...state.body];
  while (queue.length) {
    const block = queue.shift();
    if (block?.type === 'paragraph' && block.text.length >= 4) return block;
    if (block?.type === 'contentControl') queue.unshift(...block.blocks);
    if (block?.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row.cells) queue.unshift(...cell.blocks);
      }
    }
  }
  throw new Error('DOCX fixture has no editable paragraph');
}

function richPptxFixture(opaque: Uint8Array) {
  return createMinimalPptxFixture({
    '[Content_Types].xml': strToU8(`
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Default Extension="bin" ContentType="application/octet-stream"/>
        <Override PartName="/ppt/presentation.xml" ContentType="${PPTX_PRESENTATION_CONTENT_TYPE}"/>
        <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
        <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
        <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
        <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
      </Types>`),
    'ppt/presentation.xml': strToU8(`
      <p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="master-rel"/></p:sldMasterIdLst>
        <p:sldIdLst><p:sldId id="256" r:id="slide-rel"/></p:sldIdLst>
        <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
      </p:presentation>`),
    'ppt/_rels/presentation.xml.rels': strToU8(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="master-rel" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
        <Relationship Id="slide-rel" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      </Relationships>`),
    'ppt/slides/_rels/slide1.xml.rels': strToU8(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="layout-rel" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`),
    'ppt/slideMasters/slideMaster1.xml': strToU8(`
      <p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
      </p:sldMaster>`),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': strToU8(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="layout-rel" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
        <Relationship Id="theme-rel" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
      </Relationships>`),
    'ppt/slideLayouts/slideLayout1.xml': strToU8(`
      <p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
      </p:sldLayout>`),
    'ppt/theme/theme1.xml': strToU8(
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="LocalMind"/>'
    ),
    'custom/opaque.bin': opaque,
  });
}

test('DOCX AI batch formats text and Heading 2 through one immutable revision', async t => {
  const sourceBytes = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const sourcePackage = openDocxPackage(sourceBytes);
  const opaque = sourcePackage.requirePart('customXml/item1.xml');
  const paragraph = firstEditableParagraph(sourceBytes);
  const execution = await executeNativeBatch({
    artifactId: 'artifact-docx',
    revisionId: 'revision-docx-1',
    kind: OfficeArtifactKind.document,
    format: 'docx',
    sourceBytes,
    batch: aiBatch('artifact-docx', 'revision-docx-1', [
      {
        operation: 'office.document.text.format',
        target: {
          type: 'text_range',
          start: { blockId: paragraph.id, offset: 0 },
          end: { blockId: paragraph.id, offset: 4 },
        },
        format: {
          fontSizePt: 14,
          textColor: '#0000FF',
          italic: true,
          underline: { style: 'single', color: '#FF0000' },
          paragraphStyleId: 'Heading2',
        },
      },
    ]),
  });

  const reopenedPackage = openDocxPackage(execution.downloadedPackage);
  const reopened = readDocxSemanticState(reopenedPackage);
  const changed = reopened.body.find(
    block => block.type === 'paragraph' && block.id === paragraph.id
  );
  t.is(changed?.type, 'paragraph');
  if (changed?.type !== 'paragraph') return;
  t.is(changed.properties?.styleId, 'Heading2');
  t.true(
    changed.runs.some(
      run =>
        run.format?.fontSizePt === 14 &&
        run.format.color === '#0000FF' &&
        run.format.italic === true &&
        run.format.underline !== false &&
        run.format.underline?.style === 'single' &&
        run.format.underline.color === '#FF0000'
    )
  );
  t.deepEqual(reopenedPackage.requirePart('customXml/item1.xml'), opaque);
  t.is(execution.writeCount, 2);
  t.true(execution.appendRevision.calledOnce);
  t.is(
    execution.appendRevision.firstCall.args[0].origin,
    OfficeRevisionOrigin.ai
  );
  t.is(execution.result.revision.sequence, 2);
});

test('XLSX AI batch writes a formula, formats a range, and adds a chart', async t => {
  const opaque = new Uint8Array([8, 6, 7, 5, 3, 0, 9]);
  const sourceBytes = createMinimalXlsxFixture({
    'custom/opaque.bin': opaque,
  });
  const execution = await executeNativeBatch({
    artifactId: 'artifact-xlsx',
    revisionId: 'revision-xlsx-1',
    kind: OfficeArtifactKind.workbook,
    format: 'xlsx',
    sourceBytes,
    batch: aiBatch('artifact-xlsx', 'revision-xlsx-1', [
      {
        operation: 'office.workbook.cell.set',
        target: { type: 'cell', sheetId: '7', address: 'D2' },
        input: { type: 'formula', formula: 'SUM(A2:C2)' },
      },
      {
        operation: 'office.workbook.range.format',
        target: { type: 'cell_range', sheetId: '7', range: 'A2:D2' },
        format: {
          fontSizePt: 14,
          bold: true,
          textColor: '#0057B8',
          fillColor: '#FFF200',
          horizontalAlignment: 'center',
        },
      },
      {
        operation: 'office.workbook.chart.add',
        sheetId: '7',
        chartType: 'column',
        title: 'AI Budget chart',
        categoryRange: 'Budget!$A$2:$A$2',
        series: [{ name: 'Total', valueRange: 'Budget!$D$2:$D$2' }],
        anchor: { fromCell: 'F2', toCell: 'M16' },
      },
    ]),
  });

  const reopenedPackage = openXlsxPackage(execution.downloadedPackage);
  const reopened = readXlsxSemanticState(reopenedPackage);
  const sheet = reopened.sheets.find(item => item.id === '7');
  const formula = sheet?.cells.find(cell => cell.address === 'D2');
  t.is(formula?.formula, 'SUM(A2:C2)');
  const style = reopened.styles.cells[formula?.styleIndex ?? 0];
  t.is(reopened.styles.fonts[style?.fontId ?? 0]?.sizePt, 14);
  t.is(reopened.styles.fonts[style?.fontId ?? 0]?.color, '#0057B8');
  t.is(reopened.styles.fills[style?.fillId ?? 0]?.foregroundColor, '#FFF200');
  t.is(sheet?.charts[0]?.title, 'AI Budget chart');
  t.deepEqual(reopenedPackage.requirePart('custom/opaque.bin'), opaque);
  t.is(execution.writeCount, 2);
  t.true(execution.appendRevision.calledOnce);
});

test('PPTX AI batch changes the title, adds a shape, and updates theme color', async t => {
  const opaque = new Uint8Array([4, 2, 4, 2]);
  const sourceBytes = richPptxFixture(opaque);
  const initial = readPptxSemanticState(openPptxPackage(sourceBytes));
  const masterId = initial.masters[0]?.id;
  if (!masterId) throw new Error('PPTX fixture has no theme master');
  const execution = await executeNativeBatch({
    artifactId: 'artifact-pptx',
    revisionId: 'revision-pptx-1',
    kind: OfficeArtifactKind.presentation,
    format: 'pptx',
    sourceBytes,
    batch: aiBatch('artifact-pptx', 'revision-pptx-1', [
      {
        operation: 'office.presentation.shape.text.set',
        target: { type: 'shape', slideId: 'slide-rel', shapeId: '2' },
        text: 'AI Roadmap',
      },
      {
        operation: 'office.presentation.shape.add',
        slideId: 'slide-rel',
        shape: 'roundedRectangle',
        geometry: { xPt: 120, yPt: 180, widthPt: 260, heightPt: 90 },
        text: 'Approved change',
        fillColor: '#FFF200',
        lineColor: '#0057B8',
      },
      {
        operation: 'office.presentation.theme.color.set',
        masterId,
        slot: 'accent1',
        color: '#0057B8',
      },
    ]),
  });

  const reopenedPackage = openPptxPackage(execution.downloadedPackage);
  const reopened = readPptxSemanticState(reopenedPackage);
  const slide = reopened.slides.find(item => item.id === 'slide-rel');
  t.is(slide?.shapes.find(shape => shape.id === '2')?.text, 'AI Roadmap');
  t.truthy(slide?.shapes.find(shape => shape.text === 'Approved change'));
  t.is(reopened.masters[0]?.themeColors.accent1, '#0057B8');
  t.deepEqual(reopenedPackage.requirePart('custom/opaque.bin'), opaque);
  t.is(execution.writeCount, 2);
  t.true(execution.appendRevision.calledOnce);
});

test('PDF AI batch adds an annotation, rotates a page, and applies fixed-layout redaction', async t => {
  const sourceBytes = await createMinimalPdfFixture();
  const execution = await executeNativeBatch({
    artifactId: 'artifact-pdf',
    revisionId: 'revision-pdf-1',
    kind: OfficeArtifactKind.pdf,
    format: 'pdf',
    sourceBytes,
    batch: aiBatch('artifact-pdf', 'revision-pdf-1', [
      {
        operation: 'office.pdf.annotation.add',
        target: { type: 'page', pageIndex: 1 },
        annotation: {
          subtype: 'highlight',
          rect: { xPt: 20, yPt: 220, widthPt: 100, heightPt: 18 },
          contents: 'AI review',
          color: '#FFFF00',
        },
      },
      {
        operation: 'office.pdf.page.rotate',
        target: { type: 'page', pageIndex: 1 },
        rotationDeg: 90,
      },
      {
        operation: 'office.pdf.redaction.apply',
        target: { type: 'page', pageIndex: 0 },
        flattenedPagePngBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKsAAAAASUVORK5CYII=',
        rects: [{ xPt: 65, yPt: 710, widthPt: 100, heightPt: 24 }],
      },
    ]),
  });

  const reopened = readPdfSemanticState(
    await openPdfPackage(execution.downloadedPackage)
  );
  t.is(reopened.pages[0]?.annotations.length, 0);
  t.is(reopened.pages[1]?.rotationDeg, 90);
  t.true(
    reopened.pages[1]?.annotations.some(
      annotation => annotation.contents === 'AI review'
    ) ?? false
  );
  t.is(execution.writeCount, 2);
  t.true(execution.appendRevision.calledOnce);
  t.is(
    JSON.parse(execution.downloadedState.toString('utf8')).schemaVersion,
    'localmind-office-pdf-state/v1'
  );
});
