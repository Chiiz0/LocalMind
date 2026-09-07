import {
  type OfficeCommand,
  type OfficeCommandBatch,
  parseOfficeCommand,
  parseOfficeCommandBatch,
} from '@localmind/office';
import { Injectable } from '@nestjs/common';
import { OfficeRevisionOrigin, type Prisma } from '@prisma/client';

import { readBufferWithLimit } from '../../base';
import { Models } from '../../models';
import {
  type OfficeOwner,
  officeOwnerFromInput,
  type OfficeOwnerInput,
  officeOwnerToInput,
} from '../../models/office-owner';
import { PermissionAccess } from '../permission';
import { officeFingerprint, officeJsonFingerprint } from './evidence';
import {
  applyNativeOfficeCommand,
  type NativeOfficeState,
  officeFormatForCommand,
  officePackageSearchText,
  officeStateStats,
} from './formats';
import { OfficeResourceStorage } from './resource-storage';

const ORIGIN_BY_SOURCE = {
  user: OfficeRevisionOrigin.user,
  ai: OfficeRevisionOrigin.ai,
  system: OfficeRevisionOrigin.system,
} as const;
const MAX_EXECUTION_FIELD_LENGTH = 512;

type PreparedOfficeCommandResult = {
  packageBytes: Uint8Array;
  state: NativeOfficeState;
  summary: Record<string, unknown>;
};

export type ExecuteOfficeCommandInput = OfficeOwnerInput & {
  actorId: string;
  sourceSessionId?: string | null;
  command: unknown;
};

export type ExecuteOfficeCommandBatchInput = OfficeOwnerInput & {
  actorId: string;
  sourceSessionId?: string | null;
  batch: unknown;
};

function requireExecutionField(value: string, field: string) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > MAX_EXECUTION_FIELD_LENGTH) {
    throw new Error(
      `${field} must contain 1-${MAX_EXECUTION_FIELD_LENGTH} characters`
    );
  }
  return normalized;
}

function commandEvidence(command: OfficeCommand) {
  switch (command.operation) {
    case 'office.document.text.format':
      return { target: command.target, format: command.format };
    case 'office.document.text.replace':
      return {
        target: command.target,
        replacementTextLength: command.text.length,
      };
    case 'office.document.paragraph.format':
      return { target: command.target, format: command.format };
    case 'office.document.break.insert':
      return { target: command.target, breakType: command.breakType };
    case 'office.document.section.insert':
      return {
        target: command.target,
        sectionType: command.sectionType,
        sourceSectionIndex: command.sourceSectionIndex,
      };
    case 'office.document.table.insert':
      return {
        afterBlockId: command.afterBlockId,
        rows: command.rows,
        columns: command.columns,
        populatedCells:
          command.cells?.reduce(
            (total, row) => total + row.filter(value => value.length).length,
            0
          ) ?? 0,
      };
    case 'office.document.page.layout.set':
      return { sectionIndex: command.sectionIndex, layout: command.layout };
    case 'office.document.header_footer.text.set':
      return {
        sectionIndex: command.sectionIndex,
        storyKind: command.storyKind,
        storyType: command.storyType,
        textLength: command.text.length,
      };
    case 'office.document.content_control.text.set':
      return {
        contentControlId: command.contentControlId,
        textLength: command.text.length,
      };
    case 'office.document.review.resolve':
      return {
        action: command.action,
        changeCount: command.changeIds?.length,
      };
    case 'office.document.mail_merge.apply':
      return {
        fieldNames: Object.keys(command.values).sort(),
        valueLengths: Object.fromEntries(
          Object.entries(command.values).map(([key, value]) => [
            key,
            value.length,
          ])
        ),
      };
    case 'office.document.object.insert':
      return {
        target: command.target,
        objectType: command.object.type,
        object:
          command.object.type === 'image'
            ? {
                mimeType: command.object.mimeType,
                widthPt: command.object.widthPt,
                heightPt: command.object.heightPt,
                name: command.object.name,
                descriptionLength: command.object.description?.length,
                byteLength: Math.floor(command.object.dataBase64.length * 0.75),
              }
            : command.object.type === 'chart'
              ? {
                  chartType: command.object.chartType,
                  titleLength: command.object.title?.length,
                  categories: command.object.categories.length,
                  series: command.object.series.map(series => ({
                    nameLength: series.name.length,
                    values: series.values.length,
                  })),
                  widthPt: command.object.widthPt,
                  heightPt: command.object.heightPt,
                }
              : command.object.type === 'shape'
                ? {
                    shape: command.object.shape,
                    widthPt: command.object.widthPt,
                    heightPt: command.object.heightPt,
                    textLength: command.object.text?.length,
                    fillColor: command.object.fillColor,
                    lineColor: command.object.lineColor,
                  }
                : { linearTextLength: command.object.linearText.length },
      };
    case 'office.workbook.cell.set':
      return {
        target: command.target,
        inputType: command.input.type,
        styleIndex: command.styleIndex,
        inputLength:
          command.input.type === 'string'
            ? command.input.value.length
            : command.input.type === 'formula'
              ? command.input.formula.length
              : undefined,
      };
    case 'office.workbook.range.format':
      return { target: command.target, format: command.format };
    case 'office.workbook.cells.merge.set':
      return { target: command.target, merged: command.merged };
    case 'office.workbook.row.properties.set':
      return {
        sheetId: command.sheetId,
        row: command.row,
        heightPt: command.heightPt,
        hidden: command.hidden,
      };
    case 'office.workbook.column.properties.set':
      return {
        sheetId: command.sheetId,
        startColumn: command.startColumn,
        endColumn: command.endColumn,
        width: command.width,
        hidden: command.hidden,
      };
    case 'office.workbook.filter.set':
      return {
        target: command.target,
        criteria: command.criteria.map(item => ({
          columnIndex: item.columnIndex,
          valueCount: item.values.length,
        })),
      };
    case 'office.workbook.validation.set':
      return {
        target: command.target,
        validation:
          command.validation === false
            ? false
            : {
                ...command.validation,
                promptLength: command.validation.prompt?.length,
                errorLength: command.validation.error?.length,
                prompt: undefined,
                error: undefined,
              },
      };
    case 'office.workbook.sheet.add':
      return { name: command.name, afterSheetId: command.afterSheetId };
    case 'office.workbook.sheet.delete':
      return { sheetId: command.sheetId };
    case 'office.workbook.sheet.rename':
      return { sheetId: command.sheetId, name: command.name };
    case 'office.workbook.sheets.reorder':
      return { sheetIds: command.sheetIds };
    case 'office.workbook.dimension.change':
      return {
        sheetId: command.sheetId,
        axis: command.axis,
        action: command.action,
        index: command.index,
        count: command.count,
      };
    case 'office.workbook.table.set':
      return { target: command.target, table: command.table };
    case 'office.workbook.chart.add':
      return {
        sheetId: command.sheetId,
        chartType: command.chartType,
        titleLength: command.title?.length,
        categoryRange: command.categoryRange,
        series: command.series,
        anchor: command.anchor,
      };
    case 'office.workbook.chart.delete':
      return { sheetId: command.sheetId, chartId: command.chartId };
    case 'office.presentation.shape.text.set':
      return { target: command.target, textLength: command.text.length };
    case 'office.presentation.shape.geometry.set':
      return { target: command.target, geometry: command.geometry };
    case 'office.presentation.shape.add':
      return {
        slideId: command.slideId,
        shape: command.shape,
        geometry: command.geometry,
        textLength: command.text?.length,
        fillColor: command.fillColor,
        lineColor: command.lineColor,
      };
    case 'office.presentation.shape.delete':
      return { target: command.target };
    case 'office.presentation.image.add':
      return {
        slideId: command.slideId,
        mimeType: command.mimeType,
        geometry: command.geometry,
        name: command.name,
        descriptionLength: command.description?.length,
        byteLength: Math.floor(command.dataBase64.length * 0.75),
      };
    case 'office.presentation.slide.add':
      return {
        afterSlideId: command.afterSlideId,
        titleLength: command.title?.length,
      };
    case 'office.presentation.slide.duplicate':
    case 'office.presentation.slide.delete':
      return { slideId: command.slideId };
    case 'office.presentation.slides.reorder':
      return { slideIds: command.slideIds };
    case 'office.presentation.notes.text.set':
      return { slideId: command.slideId, textLength: command.text.length };
    case 'office.presentation.theme.color.set':
      return {
        masterId: command.masterId,
        slot: command.slot,
        color: command.color,
      };
    case 'office.pdf.annotation.add':
      return {
        target: command.target,
        subtype: command.annotation.subtype,
        rect: command.annotation.rect,
        contentsLength: command.annotation.contents.length,
      };
    case 'office.pdf.annotation.update':
      return {
        annotationId: command.annotationId,
        contentsLength: command.contents?.length,
        color: command.color,
        rect: command.rect,
      };
    case 'office.pdf.annotation.delete':
      return { annotationId: command.annotationId };
    case 'office.pdf.form.set':
      return {
        fieldName: command.fieldName,
        valueType: Array.isArray(command.value)
          ? 'array'
          : typeof command.value,
        valueLength:
          typeof command.value === 'string'
            ? command.value.length
            : Array.isArray(command.value)
              ? command.value.length
              : 1,
      };
    case 'office.pdf.page.rotate':
      return {
        target: command.target,
        rotationDeg: command.rotationDeg,
      };
    case 'office.pdf.page.delete':
      return { target: command.target };
    case 'office.pdf.pages.reorder':
      return { order: command.order };
    case 'office.pdf.signature.appearance.add':
      return {
        target: command.target,
        rect: command.rect,
        signerNameLength: command.signerName.length,
        reasonLength: command.reason?.length,
        hasImage: Boolean(command.imagePngBase64),
      };
    case 'office.pdf.redaction.apply':
      return {
        target: command.target,
        rects: command.rects,
        flattenedPageByteLength: Math.floor(
          command.flattenedPagePngBase64.length * 0.75
        ),
      };
  }
}

function boundedCommandEvidence(command: OfficeCommand) {
  const evidence = commandEvidence(command);
  const serialized = JSON.stringify(evidence);
  const byteSize = Buffer.byteLength(serialized, 'utf8');
  return byteSize <= 4096
    ? evidence
    : {
        evidenceByteSize: byteSize,
        evidenceFingerprint: officeJsonFingerprint(evidence),
        evidenceTruncated: true,
      };
}

function batchSummary(
  batch: OfficeCommandBatch,
  summaries: Prisma.InputJsonObject[]
): Prisma.InputJsonObject {
  const operations: Prisma.InputJsonObject[] = [];
  let truncatedOperationCount = 0;
  for (const [index, command] of batch.commands.entries()) {
    const candidate = JSON.parse(
      JSON.stringify({
        index,
        operation: command.operation,
        summary: summaries[index],
        ...boundedCommandEvidence(command),
      })
    ) as Prisma.InputJsonObject;
    const next = [...operations, candidate];
    if (Buffer.byteLength(JSON.stringify(next), 'utf8') > 24 * 1024) {
      truncatedOperationCount = batch.commands.length - index;
      break;
    }
    operations.push(candidate);
  }
  return {
    operation: 'office.command.batch',
    batchId: batch.batchId,
    commandCount: batch.commands.length,
    operations,
    truncatedOperationCount,
  };
}

@Injectable()
export class OfficeCommandService {
  constructor(
    private readonly models: Models,
    private readonly storage: OfficeResourceStorage,
    private readonly ac: PermissionAccess
  ) {}

  async preview(input: ExecuteOfficeCommandInput) {
    const prepared = await this.prepare(input);
    const packageBytes = Buffer.from(prepared.result.packageBytes);
    const stateBytes = Buffer.from(
      JSON.stringify(prepared.result.state),
      'utf8'
    );
    return {
      artifact: prepared.artifact,
      revision: prepared.parent,
      command: prepared.command,
      packageFingerprint: officeFingerprint(packageBytes),
      stateFingerprint: officeFingerprint(stateBytes),
      stats: officeStateStats(prepared.result.state),
      summary: prepared.result.summary,
    };
  }

  async previewBatch(input: ExecuteOfficeCommandBatchInput) {
    const prepared = await this.prepareBatch(input);
    const packageBytes = Buffer.from(prepared.result.packageBytes);
    const stateBytes = Buffer.from(
      JSON.stringify(prepared.result.state),
      'utf8'
    );
    return {
      artifact: prepared.artifact,
      revision: prepared.parent,
      batch: prepared.batch,
      packageFingerprint: officeFingerprint(packageBytes),
      stateFingerprint: officeFingerprint(stateBytes),
      stats: officeStateStats(prepared.result.state),
      summary: prepared.result.summary,
    };
  }

  async execute(input: ExecuteOfficeCommandInput) {
    const { owner, actorId, command, artifact, parent, policy, result } =
      await this.prepare(input, true);
    const idempotencyFingerprint = officeJsonFingerprint({
      version: 'localmind-office-command-execution/v1',
      format: policy.format,
      ...officeOwnerToInput(owner),
      actorId,
      parentRevisionId: parent.id,
      parentPackageFingerprint: parent.packageFingerprint,
      command,
    });
    const operationSummary = {
      engine: policy.engine,
      modelVersion: policy.modelVersion,
      commandId: command.commandId,
      source: command.source,
      ...result.summary,
      ...boundedCommandEvidence(command),
      operation: command.operation,
    } satisfies Prisma.InputJsonObject;
    return await this.persistPrepared({
      owner,
      actorId,
      artifact,
      parent,
      policy,
      result,
      source: command.source,
      idempotencyKey: command.idempotencyKey,
      idempotencyFingerprint,
      operationSummary,
      sourceSessionId: input.sourceSessionId,
    });
  }

  async executeBatch(input: ExecuteOfficeCommandBatchInput) {
    const { owner, actorId, batch, artifact, parent, policy, result } =
      await this.prepareBatch(input, true);
    const idempotencyFingerprint = officeJsonFingerprint({
      version: 'localmind-office-command-batch-execution/v1',
      format: policy.format,
      ...officeOwnerToInput(owner),
      actorId,
      parentRevisionId: parent.id,
      parentPackageFingerprint: parent.packageFingerprint,
      batch,
    });
    const operationSummary = {
      engine: policy.engine,
      modelVersion: policy.modelVersion,
      source: batch.source,
      ...result.summary,
    } satisfies Prisma.InputJsonObject;
    return await this.persistPrepared({
      owner,
      actorId,
      artifact,
      parent,
      policy,
      result,
      source: batch.source,
      idempotencyKey: batch.idempotencyKey,
      idempotencyFingerprint,
      operationSummary,
      sourceSessionId: input.sourceSessionId,
    });
  }

  private async persistPrepared(input: {
    owner: OfficeOwner;
    actorId: string;
    artifact: Awaited<ReturnType<Models['officeArtifact']['get']>> & {};
    parent: NonNullable<
      Awaited<ReturnType<Models['officeArtifact']['getCurrentRevision']>>
    >;
    policy: ReturnType<typeof officeFormatForCommand>;
    result: PreparedOfficeCommandResult;
    source: 'user' | 'ai' | 'system';
    sourceSessionId?: string | null;
    idempotencyKey: string;
    idempotencyFingerprint: string;
    operationSummary: Prisma.InputJsonObject;
  }) {
    if (typeof input.owner !== 'string') {
      const projectId = input.owner.projectId;
      const execute = async () => {
        await this.models.projectResource.assertOfficeResource({
          projectId,
          actorId: input.actorId,
          artifactId: input.artifact.id,
        });
        return this.persistAuthorized(input);
      };
      if (input.source === 'ai') {
        if (!input.sourceSessionId)
          throw new Error(
            'Project AI writes require their source conversation'
          );
        return this.models.copilotContext.withProjectSourcesShared(
          {
            projectId,
            actorId: input.actorId,
            sessionId: input.sourceSessionId,
            sink: {
              type: 'tool_write',
              projectId,
              id: input.artifact.id,
              phase: 'execute',
            },
          },
          execute
        );
      }
      return this.models.projectResource.withMember(
        { projectId, actorId: input.actorId },
        execute
      );
    }
    if (input.source === 'ai')
      return await this.models.copilotContext.withDocumentSourcesShared(
        {
          sessionId: input.sourceSessionId,
          actorId: input.actorId,
          sink: {
            type: 'tool_write',
            id: input.artifact.id,
            documentId: input.artifact.id,
            workspaceId: input.owner,
            phase: 'execute',
          },
        },
        () => this.persistAuthorized(input)
      );
    return await this.persistAuthorized(input);
  }

  private async persistAuthorized(
    input: Parameters<OfficeCommandService['persistPrepared']>[0]
  ) {
    const {
      owner,
      actorId,
      artifact,
      parent,
      policy,
      result,
      source,
      idempotencyKey,
      idempotencyFingerprint,
      operationSummary,
    } = input;
    const packageBytes = Buffer.from(result.packageBytes);
    const packageFingerprint = officeFingerprint(packageBytes);
    const hash = packageFingerprint.slice('sha256:'.length);
    const packageBlobKey = await this.storage.put(
      owner,
      actorId,
      `office/package/${policy.format}/${hash}${policy.extension}`,
      packageBytes,
      {
        contentType: policy.mimeType,
        contentLength: packageBytes.byteLength,
      }
    );
    const stateBytes = Buffer.from(JSON.stringify(result.state), 'utf8');
    if (
      !stateBytes.byteLength ||
      stateBytes.byteLength > policy.maxStateBytes
    ) {
      throw new Error(
        `${policy.format.toUpperCase()} semantic state exceeds its byte limit`
      );
    }
    const stateFingerprint = officeFingerprint(stateBytes);
    const stateBlobKey = await this.storage.put(
      owner,
      actorId,
      `office/state/${policy.format}/${stateFingerprint.slice('sha256:'.length)}.json`,
      stateBytes,
      {
        contentType: policy.stateMimeType,
        contentLength: stateBytes.byteLength,
      }
    );
    const appended = await this.models.officeArtifact.appendRevision({
      ...officeOwnerToInput(owner),
      artifactId: artifact.id,
      actorId,
      origin: ORIGIN_BY_SOURCE[source],
      expectedParentRevisionId: parent.id,
      idempotencyKey,
      idempotencyFingerprint,
      package: {
        key: packageBlobKey,
        mimeType: policy.mimeType,
        byteSize: packageBytes.byteLength,
        fingerprint: packageFingerprint,
      },
      state: {
        key: stateBlobKey,
        byteSize: stateBytes.byteLength,
        fingerprint: stateFingerprint,
      },
      modelVersion: policy.modelVersion,
      operationSummary,
    });
    if (typeof owner !== 'string')
      await this.models.projectResource.updateSearchText({
        projectId: owner.projectId,
        actorId,
        resourceId: artifact.id,
        sequence: appended.revision.sequence,
        text: await officePackageSearchText(result.state, packageBytes),
      });
    return {
      ...appended,
      packageBlobKey,
      packageFingerprint,
      stateBlobKey,
      stateFingerprint,
      stats: officeStateStats(result.state),
      summary: result.summary,
    };
  }

  private async prepare(input: ExecuteOfficeCommandInput, allowReplay = false) {
    const owner = officeOwnerFromInput(input);
    const actorId = requireExecutionField(input.actorId, 'actor id');
    const command = parseOfficeCommand(input.command);
    const policy = officeFormatForCommand(command);
    await this.assertPermissions(
      owner,
      actorId,
      command.source,
      command.artifactId
    );
    const artifact = await this.models.officeArtifact.get(
      owner,
      command.artifactId
    );
    if (!artifact || artifact.kind !== policy.kind) {
      throw new Error(
        `Office ${policy.format.toUpperCase()} artifact not found: ${command.artifactId}`
      );
    }
    const parent = await this.commandParent(
      owner,
      command.artifactId,
      command.expectedRevisionId,
      command.idempotencyKey,
      allowReplay
    );
    if (!parent || parent.id !== command.expectedRevisionId) {
      throw new Error(
        `Office artifact revision conflict: expected ${command.expectedRevisionId}`
      );
    }
    if (parent.packageMimeType !== policy.mimeType) {
      throw new Error(
        `Office ${policy.format.toUpperCase()} revision has an invalid MIME type: ${parent.id}`
      );
    }
    const parentBytes = await this.readRevisionPackage(
      owner,
      actorId,
      parent.packageBlobKey,
      parent.packageMimeType,
      parent.packageByteSize,
      policy.maxPackageBytes,
      policy.format
    );
    if (officeFingerprint(parentBytes) !== parent.packageFingerprint) {
      throw new Error(
        `Office ${policy.format.toUpperCase()} revision fingerprint does not match: ${parent.id}`
      );
    }
    const result = await applyNativeOfficeCommand(policy, parentBytes, command);
    return {
      owner,
      actorId,
      command,
      artifact,
      parent,
      policy,
      result,
    };
  }

  private async prepareBatch(
    input: ExecuteOfficeCommandBatchInput,
    allowReplay = false
  ) {
    const owner = officeOwnerFromInput(input);
    const actorId = requireExecutionField(input.actorId, 'actor id');
    const batch = parseOfficeCommandBatch(input.batch);
    const policy = officeFormatForCommand(batch.commands[0]);
    for (const command of batch.commands.slice(1)) {
      if (officeFormatForCommand(command).format !== policy.format) {
        throw new Error(
          'Office command batch must target exactly one native resource kind'
        );
      }
    }
    await this.assertPermissions(
      owner,
      actorId,
      batch.source,
      batch.artifactId
    );
    const artifact = await this.models.officeArtifact.get(
      owner,
      batch.artifactId
    );
    if (!artifact || artifact.kind !== policy.kind) {
      throw new Error(
        `Office ${policy.format.toUpperCase()} artifact not found: ${batch.artifactId}`
      );
    }
    const parent = await this.commandParent(
      owner,
      batch.artifactId,
      batch.expectedRevisionId,
      batch.idempotencyKey,
      allowReplay
    );
    if (!parent || parent.id !== batch.expectedRevisionId) {
      throw new Error(
        `Office artifact revision conflict: expected ${batch.expectedRevisionId}`
      );
    }
    if (parent.packageMimeType !== policy.mimeType) {
      throw new Error(
        `Office ${policy.format.toUpperCase()} revision has an invalid MIME type: ${parent.id}`
      );
    }
    let packageBytes = await this.readRevisionPackage(
      owner,
      actorId,
      parent.packageBlobKey,
      parent.packageMimeType,
      parent.packageByteSize,
      policy.maxPackageBytes,
      policy.format
    );
    if (officeFingerprint(packageBytes) !== parent.packageFingerprint) {
      throw new Error(
        `Office ${policy.format.toUpperCase()} revision fingerprint does not match: ${parent.id}`
      );
    }
    const summaries: Prisma.InputJsonObject[] = [];
    let finalResult: PreparedOfficeCommandResult | null = null;
    for (const command of batch.commands) {
      const applied = await applyNativeOfficeCommand(
        policy,
        packageBytes,
        command
      );
      finalResult = {
        ...applied,
        summary: JSON.parse(
          JSON.stringify(applied.summary)
        ) as Prisma.InputJsonObject,
      };
      packageBytes = Buffer.from(finalResult.packageBytes);
      summaries.push(
        JSON.parse(
          JSON.stringify(finalResult.summary)
        ) as Prisma.InputJsonObject
      );
    }
    if (!finalResult) {
      throw new Error('Office command batch must contain at least one command');
    }
    return {
      owner,
      actorId,
      batch,
      artifact,
      parent,
      policy,
      result: {
        ...finalResult,
        summary: batchSummary(batch, summaries),
      },
    };
  }

  private async commandParent(
    owner: OfficeOwner,
    artifactId: string,
    expectedRevisionId: string,
    requestKey: string,
    allowReplay: boolean
  ) {
    const current = await this.models.officeArtifact.getCurrentRevision(
      owner,
      artifactId
    );
    if (
      typeof owner !== 'string' &&
      allowReplay &&
      current?.id !== expectedRevisionId
    ) {
      const committed = await this.models.officeArtifact.getRevisionByRequest(
        owner,
        artifactId,
        requestKey
      );
      if (committed?.parentRevisionId === expectedRevisionId)
        return this.models.officeArtifact.getRevision(
          owner,
          artifactId,
          expectedRevisionId
        );
    }
    return current;
  }

  private async assertPermissions(
    owner: OfficeOwner,
    actorId: string,
    source: 'user' | 'ai' | 'system',
    artifactId: string
  ) {
    if (typeof owner !== 'string') {
      await this.models.projectResource.assertOfficeResource({
        projectId: owner.projectId,
        actorId,
        artifactId,
      });
      return;
    }
    const checks = [
      this.ac.user(actorId).workspace(owner).assert('Workspace.Blobs.Write'),
    ];
    if (source === 'ai') {
      checks.push(
        this.ac.user(actorId).workspace(owner).assert('Workspace.Copilot')
      );
    }
    await Promise.all(checks);
  }

  private async readRevisionPackage(
    owner: OfficeOwner,
    actorId: string,
    key: string,
    mimeType: string,
    byteSize: number,
    maxPackageBytes: number,
    format: string
  ) {
    if (
      !Number.isSafeInteger(byteSize) ||
      byteSize <= 0 ||
      byteSize > maxPackageBytes
    ) {
      throw new Error(
        `Office ${format.toUpperCase()} revision has an invalid byte size: ${key}`
      );
    }
    const stored = await this.storage.get(owner, actorId, key);
    if (!stored.body) {
      throw new Error(
        `Office ${format.toUpperCase()} revision bytes are not available: ${key}`
      );
    }
    if (
      stored.metadata &&
      (stored.metadata.contentLength !== byteSize ||
        stored.metadata.contentType !== mimeType)
    ) {
      stored.body.destroy();
      throw new Error(
        `Office ${format.toUpperCase()} revision object metadata does not match: ${key}`
      );
    }
    let bytes: Buffer;
    try {
      bytes = await readBufferWithLimit(stored.body, maxPackageBytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read Office ${format.toUpperCase()} revision: ${message}`
      );
    }
    if (bytes.byteLength !== byteSize) {
      throw new Error(
        `Office ${format.toUpperCase()} revision byte size does not match: ${key}`
      );
    }
    return bytes;
  }
}
