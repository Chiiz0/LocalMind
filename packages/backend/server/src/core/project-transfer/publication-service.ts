import { createHash, randomUUID } from 'node:crypto';

import { diffOfficeSemanticStates } from '@localmind/office';
import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma, type ProjectPublication } from '@prisma/client';
import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';

import {
  BadRequest,
  BlobQuotaExceeded,
  StorageQuotaExceeded,
} from '../../base';
import { Models } from '../../models';
import { COPILOT_COPY_BLOB_PREFIX } from '../../models/blob';
import { agentRuntimeFingerprint } from '../../models/copilot-agent-runtime';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';
import {
  PROJECT_PUBLICATION_WORKFLOW,
  type PublicationTarget,
  publicationTargetSchema,
} from '../../models/project-publication';
import {
  type ProjectActor,
  projectResourceHash,
} from '../../models/project-resource';
import { parseYDocToMarkdown } from '../../native';
import {
  DocReader,
  DocumentDestinationService,
  DocWriter,
  readRootDocPageIdsWithYjs,
  WorkspaceOrganizationService,
} from '../doc';
import {
  createFileCopySnapshot,
  inspectDocumentCopySnapshot,
  readFileCopySnapshot,
  remapDocumentCopyBlobs,
  replaceDocumentCopySnapshot,
  retitleDocumentCopySnapshot,
} from '../doc/copy-snapshot';
import { readRootDocPagesWithYjs } from '../doc/root-doc-registration';
import { OfficeArtifactService } from '../office';
import {
  type NativeOfficeState,
  officeStateSearchText,
} from '../office/formats';
import { PermissionAccess } from '../permission';
import { ProjectBlobStorage, ProjectResourceService } from '../project';
import { QuotaService } from '../quota';
import { WorkspaceBlobStorage } from '../storage';
import { isolateImportedReferences } from './references';

const commandSchema = z
  .object({
    version: z.literal('project-publication/v1'),
    publicationId: z.string().uuid(),
    publicationRevision: z.number().int().positive(),
    sourceSequence: z.number().int().positive(),
    sourceResourceVersion: z.number().int().positive(),
    sourceFingerprint: z.string().length(64),
    target: publicationTargetSchema,
    previewFingerprint: z.string().length(16),
  })
  .strict();

export class ProjectPublicationConflict extends Error {
  constructor() {
    super('Publication source, target or permissions changed; compare again');
  }
}

const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

@Injectable()
export class ProjectPublicationService {
  constructor(
    private readonly models: Models,
    private readonly destinations: DocumentDestinationService,
    private readonly organization: WorkspaceOrganizationService,
    private readonly ac: PermissionAccess,
    private readonly resources: ProjectResourceService,
    private readonly projectBlobs: ProjectBlobStorage,
    private readonly blobs: WorkspaceBlobStorage,
    private readonly reader: DocReader,
    private readonly writer: DocWriter,
    private readonly office: OfficeArtifactService,
    private readonly quota: QuotaService
  ) {}

  prepare(
    input: ProjectActor & {
      resourceId: string;
      sessionId?: string;
      kind: 'publish' | 'update';
      requestKey: string;
    }
  ) {
    return this.models.projectPublication.prepare(input);
  }

  async targets(
    input: ProjectActor & {
      resourceId: string;
      workspaceId: string;
      parentId: string | null;
      query?: string;
      cursor?: string;
    }
  ) {
    const source = await this.models.projectPublication.source(input);
    const query = (input.query ?? '').trim();
    if (query.length > 128 || (input.cursor?.length ?? 0) > 4096)
      throw new BadRequest('Invalid publication target page');
    const location = await this.destinations.locations({
      ...input,
      query: undefined,
      cursor: undefined,
      limit: 1,
    });
    const identity = {
      projectId: input.projectId,
      resourceId: input.resourceId,
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      query,
      revision: location.revision,
    };
    let after: string | undefined;
    if (input.cursor) {
      try {
        const decoded = z
          .object({
            identity: z.string().length(64),
            after: z.string().min(1).max(256),
          })
          .strict()
          .parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString()));
        if (decoded.identity !== projectResourceHash(identity))
          throw new Error('cursor');
        after = decoded.after;
      } catch {
        throw new BadRequest('Target page changed; reload this directory');
      }
    }
    const candidates = await this.models.projectPublication.workspaceCandidates(
      {
        workspaceId: input.workspaceId,
        after,
        query,
        kind: source.resource.kind,
      }
    );
    const root = source.office
      ? null
      : await this.reader.getDoc(input.workspaceId, input.workspaceId);
    const active = new Map(
      root
        ? readRootDocPagesWithYjs(root.bin).map(page => [page.id, page.title])
        : []
    );
    const page = candidates.slice(0, 100);
    const locations = await this.organization.documentLocations(
      input.workspaceId,
      input.actorId,
      page.map(item => item.resourceId)
    );
    const items = [];
    for (const candidate of page) {
      if (!source.office && !active.has(candidate.resourceId)) continue;
      const placement = locations.find(
        item =>
          item.docId === candidate.resourceId &&
          (query || item.folderId === input.parentId)
      );
      if (!placement) continue;
      const access = this.ac
        .user(input.actorId)
        .doc(input.workspaceId, candidate.resourceId)
        .projectScope(null);
      if (!(await access.can('Doc.Read'))) continue;
      const title =
        candidate.title ??
        active.get(candidate.resourceId) ??
        candidate.resourceId;
      if (
        query &&
        !title.toLowerCase().includes(query.toLowerCase()) &&
        !candidate.resourceId.toLowerCase().includes(query.toLowerCase())
      )
        continue;
      if (source.resource.kind === 'file') {
        const document = await this.reader.getDoc(
          input.workspaceId,
          candidate.resourceId
        );
        if (!document || !readFileCopySnapshot(document.bin)) continue;
      }
      const parent =
        placement.folderId === input.parentId
          ? location.current
          : (
              await this.destinations.locations({
                actorId: input.actorId,
                workspaceId: input.workspaceId,
                parentId: placement.folderId,
                limit: 1,
              })
            ).current;
      items.push({
        ...candidate,
        title,
        folderId: placement.folderId,
        path: parent.path,
        canUpdate: await access.can('Doc.Update'),
      });
      if (items.length === 20) break;
    }
    const last =
      items.length === 20 ? items.at(-1)?.resourceId : page.at(-1)?.resourceId;
    await this.models.projectResource.assertMember(input);
    return {
      items,
      nextCursor:
        last &&
        (candidates.length > 100 ||
          (items.length === 20 && last !== candidates.at(-1)?.resourceId))
          ? Buffer.from(
              JSON.stringify({
                identity: projectResourceHash(identity),
                after: last,
              })
            ).toString('base64url')
          : null,
    };
  }

  @Transactional<TransactionalAdapterPrisma>({ timeout: 60000 })
  async preview(
    input: ProjectActor & {
      publicationId: string;
      expectedRevision: number;
      workspaceId: string;
      folderId: string | null;
      targetResourceId?: string;
    }
  ) {
    const record = await this.models.projectPublication.lock(input);
    if (
      record.status !== 'waiting_for_location' ||
      record.expiresAt <= new Date()
    )
      throw new BadRequest('Publication is not waiting for a location');
    if ((record.kind === 'update') !== !!input.targetResourceId)
      throw new BadRequest('Choose an exact existing target for an update');
    const targetId = input.targetResourceId ?? randomUUID();
    return this.models.projectPublication.withTargetLock(
      { workspaceId: input.workspaceId, resourceId: targetId },
      async () => {
        const source = await this.source(record);
        const target = await this.target(record, source, {
          workspaceId: input.workspaceId,
          folderId: input.folderId,
          resourceId: targetId,
        });
        const preview = await this.compare(record, source, target);
        const command = {
          version: 'project-publication/v1' as const,
          publicationId: record.id,
          publicationRevision: record.revision + 1,
          sourceSequence: source.sequence,
          sourceResourceVersion: source.resource.version,
          sourceFingerprint: source.fingerprint,
          target: target.evidence,
          previewFingerprint: agentRuntimeFingerprint(preview),
        };
        const run = await this.models.copilotProjectAgentRuntime.prepare({
          projectId: record.projectId,
          actorId: record.actorId,
          sessionId: record.sessionId ?? undefined,
          requestKey: `${record.id}:${record.revision}`,
          workflow: PROJECT_PUBLICATION_WORKFLOW,
          sourceType: 'project_publication',
          title: `${record.kind}: ${source.resource.title}`,
          command,
          status: 'waiting_approval',
        });
        return this.models.projectPublication.setPreview({
          ...input,
          sourceSequence: source.sequence,
          sourceResourceVersion: source.resource.version,
          target: target.evidence,
          preview,
          runId: run.id,
        });
      }
    );
  }

  @Transactional<TransactionalAdapterPrisma>({ timeout: 60000 })
  async submit(
    input: ProjectActor & {
      publicationId: string;
      expectedRevision: number;
      targetFingerprint: string;
    }
  ) {
    const record = await this.models.projectPublication.lock({
      ...input,
      expectedRevision: undefined,
    });
    if (record.status === 'submitted')
      return this.models.projectPublication.submit(input);
    const target = publicationTargetSchema.parse(record.target);
    return this.models.projectPublication.withTargetLock(target, async () => {
      await this.validate(record);
      return this.models.projectPublication.submit(input);
    });
  }

  async execute(run: ProjectAgentRun) {
    const command = commandSchema.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    );
    const record = await this.models.projectPublication.lock({
      projectId: run.projectId,
      actorId: run.actorId,
      publicationId: command.publicationId,
    });
    if (
      record.status !== 'submitted' ||
      record.runId !== run.id ||
      record.revision !== command.publicationRevision + 1
    )
      throw new BadRequest('Publication confirmation is no longer current');
    return this.models.projectPublication.withTargetLock(
      command.target,
      async () => {
        const { source, target } = await this.validate(record, command);
        // Reconcile once before publishing any Blob. Reconciliation uses its own
        // connection, while Blob publication marks quota state stale in this transaction.
        const quota =
          source.office ||
          (source.bytes &&
            inspectDocumentCopySnapshot(source.bytes).blobIds.length)
            ? await this.quota.getWorkspaceQuotaWithUsage(
                target.evidence.workspaceId
              )
            : null;
        let additionalBytes = 0;
        const allocated = new Set<string>();
        const allocate = async (key: string, bytes: number) => {
          if (allocated.has(key)) return;
          const existing = await this.models.blob.get(
            target.evidence.workspaceId,
            key
          );
          if (existing?.status !== 'completed') {
            if (!quota || bytes > quota.blobLimit)
              throw new BlobQuotaExceeded();
            if (
              quota.usedStorageQuota + additionalBytes + bytes >
              quota.storageQuota
            )
              throw new StorageQuotaExceeded();
            additionalBytes += bytes;
          }
          allocated.add(key);
        };
        const revalidate = async () => {
          await this.models.projectResource.assertMember({
            projectId: record.projectId,
            actorId: record.actorId,
          });
          if (record.expiresAt <= new Date())
            throw new BadRequest('Publication expired');
          await this.targetPermissions(record, target.evidence);
        };
        let targetVersion: string;
        if (source.office && source.officeRevision) {
          if (
            !source.officeRevision.stateBlobKey ||
            !source.officeRevision.stateFingerprint
          )
            throw new BadRequest(
              'Office publication state evidence is unavailable'
            );
          if (record.kind === 'update' && !target.evidence.expectedVersion)
            throw new BadRequest(
              'Office update requires the confirmed target version'
            );
          const packageAsset = await this.office.readRevisionAsset(
            { projectId: record.projectId },
            record.actorId,
            source.resource.id,
            source.officeRevision.id,
            'package'
          );
          const stateAsset = await this.office.readRevisionAsset(
            { projectId: record.projectId },
            record.actorId,
            source.resource.id,
            source.officeRevision.id,
            'state'
          );
          const packageKey = await this.transfer(
            record,
            target.evidence,
            packageAsset.bytes,
            source.officeRevision.packageMimeType,
            revalidate,
            allocate
          );
          const stateBlob = await this.models.projectResource.getBlob({
            projectId: record.projectId,
            actorId: record.actorId,
            key: source.officeRevision.stateBlobKey,
          });
          const stateKey = await this.transfer(
            record,
            target.evidence,
            stateAsset.bytes,
            stateBlob.mimeType,
            revalidate,
            allocate
          );
          await revalidate();
          const packageInput = {
            key: packageKey,
            mimeType: source.officeRevision.packageMimeType,
            byteSize: packageAsset.bytes.length,
            fingerprint: source.officeRevision.packageFingerprint,
          };
          const stateInput = {
            key: stateKey,
            byteSize: stateAsset.bytes.length,
            fingerprint: source.officeRevision.stateFingerprint,
          };
          const operationSummary = {
            type: 'project_publication',
            publicationId: record.id,
            projectId: record.projectId,
            sourceResourceId: record.resourceId,
            sourceSequence: source.sequence,
          };
          const result =
            record.kind === 'publish'
              ? await this.models.officeArtifact.createOrReuseImported({
                  workspaceId: target.evidence.workspaceId,
                  actorId: record.actorId,
                  artifactId: target.evidence.resourceId,
                  kind: source.office.kind,
                  title: source.resource.title,
                  sourceFileName: source.office.sourceFileName,
                  source: packageInput,
                  state: stateInput,
                  modelVersion: source.officeRevision.modelVersion,
                  importIdempotencyKey: `publication:${record.id}:${command.publicationRevision}`,
                  importFingerprint: command.sourceFingerprint,
                  compatibility: json(source.office.compatibility),
                  operationSummary,
                })
              : await this.models.officeArtifact.appendRevision({
                  workspaceId: target.evidence.workspaceId,
                  actorId: record.actorId,
                  artifactId: target.evidence.resourceId,
                  origin: 'user',
                  expectedParentRevisionId:
                    target.evidence.expectedVersion ?? '',
                  idempotencyKey: `publication:${record.id}:${command.publicationRevision}`,
                  idempotencyFingerprint: run.targetFingerprint,
                  package: packageInput,
                  state: stateInput,
                  modelVersion: source.officeRevision.modelVersion,
                  operationSummary,
                });
          targetVersion = result.revision.id;
        } else {
          if (!source.bytes)
            throw new BadRequest('Publication source bytes are unavailable');
          const replacements = new Map<string, string>();
          for (const key of inspectDocumentCopySnapshot(source.bytes).blobIds) {
            const blob = await this.projectBlobs.read({
              projectId: record.projectId,
              actorId: record.actorId,
              key,
            });
            replacements.set(
              key,
              await this.transfer(
                record,
                target.evidence,
                blob.bytes,
                blob.blob.mimeType,
                revalidate,
                allocate
              )
            );
          }
          const snapshot = retitleDocumentCopySnapshot(
            isolateImportedReferences(
              remapDocumentCopyBlobs(source.bytes, replacements),
              {
                projectId: record.projectId,
                sourceResourceId: record.resourceId,
                resourceId: target.evidence.resourceId,
              }
            ),
            source.resource.title,
            target.evidence.resourceId
          );
          if (record.kind === 'publish') {
            await this.writer.createDocFromSnapshot(
              target.evidence.workspaceId,
              source.resource.title,
              snapshot,
              record.actorId,
              target.evidence.resourceId,
              revalidate
            );
            await this.models.doc.upsertMeta(
              target.evidence.workspaceId,
              target.evidence.resourceId,
              {
                mode: source.resource.kind === 'edgeless' ? 1 : 0,
                title: source.resource.title,
              }
            );
          } else {
            if (!target.document)
              throw new BadRequest('The selected target is unavailable');
            const update = replaceDocumentCopySnapshot(
              target.document.bin,
              snapshot,
              source.resource.title,
              target.evidence.resourceId
            );
            await this.writer.pushDocUpdate(
              target.evidence.workspaceId,
              target.evidence.resourceId,
              update,
              record.actorId,
              revalidate
            );
            await this.writer.updateDocMeta(
              target.evidence.workspaceId,
              target.evidence.resourceId,
              { title: source.resource.title },
              record.actorId,
              revalidate
            );
          }
          const saved = await this.reader.getDoc(
            target.evidence.workspaceId,
            target.evidence.resourceId
          );
          if (!saved)
            throw new BadRequest('Published document was not persisted');
          targetVersion = hash(saved.bin);
        }
        if (record.kind === 'publish' && target.evidence.folderId)
          await this.place(record, target.evidence);
        await revalidate();
        // Document history reads reconcile quota on another connection. Invalidate
        // after all content/directory writes, but before this transaction commits.
        if (additionalBytes)
          await this.models.blob.markQuotaStateStale(
            target.evidence.workspaceId
          );
        const receipt = {
          version: 'project-publication-receipt/v1',
          publicationId: record.id,
          kind: record.kind,
          projectId: record.projectId,
          resourceId: record.resourceId,
          sourceSequence: source.sequence,
          workspaceId: target.evidence.workspaceId,
          targetResourceId: target.evidence.resourceId,
          folderId: target.evidence.folderId,
          targetVersion,
          permissionFingerprint: target.evidence.permissionFingerprint,
        };
        await this.models.projectPublication.recordCompleted({
          projectId: record.projectId,
          actorId: record.actorId,
          publicationId: record.id,
          runId: run.id,
          targetVersion,
          receipt,
        });
        return receipt;
      }
    );
  }

  private async source(record: ProjectPublication) {
    const input = {
      projectId: record.projectId,
      actorId: record.actorId,
      resourceId: record.resourceId,
    };
    const source = await this.models.projectPublication.source(input);
    if (source.office) {
      await this.models.officeArtifact.lockArtifactWriter(
        { projectId: record.projectId },
        source.resource.id
      );
      const officeRevision =
        await this.models.officeArtifact.getCurrentRevision(
          { projectId: record.projectId },
          source.resource.id
        );
      if (!officeRevision)
        throw new BadRequest('Project Office revision is unavailable');
      return {
        ...source,
        file: null,
        sequence: officeRevision.sequence,
        officeRevision,
        bytes: null,
        fingerprint: projectResourceHash({
          revision: officeRevision.id,
          package: officeRevision.packageFingerprint,
          state: officeRevision.stateFingerprint,
        }),
      };
    }
    if (source.resource.kind === 'file') {
      const file = await this.resources.readFile(input);
      return {
        ...source,
        file: file.blob,
        officeRevision: null,
        bytes: createFileCopySnapshot({
          documentId: source.resource.id,
          title: source.resource.title,
          key: file.blob.key,
          mimeType: file.blob.mimeType,
          byteSize: file.blob.byteSize,
        }),
        fingerprint: file.blob.fingerprint,
      };
    }
    const document = await this.resources.readDocument(input);
    return {
      ...source,
      file: null,
      officeRevision: null,
      bytes: document.bytes,
      fingerprint: hash(document.bytes),
    };
  }

  private async targetPermissions(
    record: ProjectPublication,
    target: PublicationTarget
  ) {
    const current = await this.destination(record, target);
    if (current.fingerprint !== target.folderFingerprint)
      throw new ProjectPublicationConflict();
    const permissions = await this.models.projectPublication.targetPermissions({
      workspaceId: target.workspaceId,
      resourceId: record.kind === 'update' ? target.resourceId : null,
      directoryIds: current.path.map(item => item.id),
    });
    if (permissions.fingerprint !== target.permissionFingerprint)
      throw new ProjectPublicationConflict();
  }

  private async destination(
    record: ProjectPublication,
    target: { workspaceId: string; folderId: string | null; resourceId: string }
  ) {
    if (target.workspaceId === target.resourceId)
      throw new BadRequest(
        'Workspace root documents cannot be publication targets'
      );
    if (record.kind === 'publish')
      return this.destinations.authorize({
        ...target,
        actorId: record.actorId,
      });
    const access = this.ac
      .user(record.actorId)
      .doc(target.workspaceId, target.resourceId)
      .projectScope(null);
    await access.assert('Doc.Read');
    await access.assert('Doc.Update');
    const location = await this.destinations.locations({
      actorId: record.actorId,
      workspaceId: target.workspaceId,
      parentId: target.folderId,
      limit: 1,
    });
    const rows = await this.organization.readFolders(
      target.workspaceId,
      record.actorId
    );
    const placements = rows.filter(
      row => row.type === 'doc' && row.data === target.resourceId
    );
    if (
      placements.some(row => (row.parentId ?? null) !== target.folderId) ||
      (target.folderId && !placements.length)
    )
      throw new ProjectPublicationConflict();
    return location.current;
  }

  private async target(
    record: ProjectPublication,
    source: Awaited<ReturnType<ProjectPublicationService['source']>>,
    target: { workspaceId: string; folderId: string | null; resourceId: string }
  ) {
    const destination = await this.destination(record, target);
    const permissions = await this.models.projectPublication.targetPermissions({
      workspaceId: target.workspaceId,
      resourceId: record.kind === 'update' ? target.resourceId : null,
      directoryIds: destination.path.map(item => item.id),
    });
    await this.models.doc.lockContentWrite(
      target.workspaceId,
      target.resourceId
    );
    await this.models.officeArtifact.lockArtifactWriter(
      target.workspaceId,
      target.resourceId
    );
    const office = await this.models.officeArtifact.get(
      target.workspaceId,
      target.resourceId
    );
    const document = await this.reader.getDoc(
      target.workspaceId,
      target.resourceId
    );
    const officeRevision = office
      ? await this.models.officeArtifact.getCurrentRevision(
          target.workspaceId,
          target.resourceId
        )
      : null;
    if (record.kind === 'publish' && (office || document))
      throw new ProjectPublicationConflict();
    if (record.kind === 'update') {
      if (!office && !document)
        throw new BadRequest('The selected target no longer exists');
      if (
        source.office
          ? office?.kind !== source.office.kind || !officeRevision
          : !!office || !document
      )
        throw new BadRequest('Publication resource types do not match');
      if (document) {
        if (source.file && !readFileCopySnapshot(document.bin))
          throw new BadRequest(
            'Choose a document containing only the target file'
          );
        const root = await this.reader.getDoc(
          target.workspaceId,
          target.workspaceId
        );
        if (
          !root ||
          !readRootDocPageIdsWithYjs(root.bin).includes(target.resourceId)
        )
          throw new BadRequest(
            'The selected target is deleted or no longer registered'
          );
        const metadata = await this.models.doc.getMeta(
          target.workspaceId,
          target.resourceId
        );
        if (
          (metadata?.mode ?? 0) !==
          (source.resource.kind === 'edgeless' ? 1 : 0)
        )
          throw new BadRequest('Publication document modes do not match');
      }
    }
    return {
      document,
      office,
      officeRevision,
      destination,
      permissions,
      evidence: {
        ...target,
        folderFingerprint: destination.fingerprint,
        permissionFingerprint: permissions.fingerprint,
        expectedVersion:
          officeRevision?.id ?? (document ? hash(document.bin) : null),
      } satisfies PublicationTarget,
    };
  }

  private async compare(
    record: ProjectPublication,
    source: Awaited<ReturnType<ProjectPublicationService['source']>>,
    target: Awaited<ReturnType<ProjectPublicationService['target']>>
  ) {
    let difference: Prisma.InputJsonObject;
    if (source.office && source.officeRevision) {
      const after = await this.office.readRevisionAsset(
        { projectId: record.projectId },
        record.actorId,
        source.resource.id,
        source.officeRevision.id,
        'state'
      );
      if (target.officeRevision) {
        const before = await this.office.readRevisionAsset(
          target.evidence.workspaceId,
          record.actorId,
          target.evidence.resourceId,
          target.officeRevision.id,
          'state'
        );
        const compared = diffOfficeSemanticStates(
          source.office.kind,
          JSON.parse(before.bytes.toString()),
          JSON.parse(after.bytes.toString())
        );
        const changes = [];
        let remaining = 24000;
        for (const change of compared.changes) {
          remaining -= Buffer.byteLength(JSON.stringify(change));
          if (remaining < 0) break;
          changes.push(change);
        }
        difference = json({
          ...compared,
          changes,
          truncated:
            compared.truncated || changes.length < compared.changes.length,
        });
      } else {
        const text = officeStateSearchText(
          JSON.parse(after.bytes.toString()) as NativeOfficeState
        );
        difference = {
          before: '',
          after: text.slice(0, 8000),
          truncated: text.length > 8000,
        };
      }
    } else if (source.file) {
      const before = target.document
        ? readFileCopySnapshot(target.document.bin)
        : null;
      difference = {
        before: before
          ? `${before.title}\n${before.mimeType}\n${before.byteSize} bytes`
          : '',
        after: `${source.resource.title}\n${source.file.mimeType}\n${source.file.byteSize} bytes`,
        truncated: false,
      };
    } else {
      const before = target.document
        ? parseYDocToMarkdown(
            Buffer.from(target.document.bin),
            target.evidence.resourceId,
            true
          ).markdown
        : '';
      const after = source.bytes
        ? parseYDocToMarkdown(source.bytes, source.resource.id, true).markdown
        : '';
      difference = {
        before: before.slice(0, 8000),
        after: after.slice(0, 8000),
        beforeCharacters: before.length,
        afterCharacters: after.length,
        truncated: before.length > 8000 || after.length > 8000,
      };
    }
    const workspace = await this.models.workspace.get(
      target.evidence.workspaceId
    );
    const targetMeta = target.document
      ? await this.models.doc.getMeta(
          target.evidence.workspaceId,
          target.evidence.resourceId
        )
      : null;
    return json({
      kind: record.kind,
      title: source.resource.title,
      resourceKind: source.resource.kind,
      sourceSequence: source.sequence,
      sourceFingerprint: source.fingerprint,
      target: target.evidence,
      targetTitle:
        target.office?.title ?? targetMeta?.title ?? source.resource.title,
      workspaceName: workspace?.name ?? target.evidence.workspaceId,
      targetSequence: target.officeRevision?.sequence ?? null,
      targetModifiedAt: target.document
        ? new Date(target.document.timestamp).toISOString()
        : null,
      targetPath: target.destination.path,
      audience: target.permissions,
      difference,
    });
  }

  private async validate(
    record: ProjectPublication,
    frozen?: z.infer<typeof commandSchema>
  ) {
    if (!record.runId || record.expiresAt <= new Date())
      throw new BadRequest('Publication expired or has no confirmation');
    const run = await this.models.copilotProjectAgentRuntime.get({
      projectId: record.projectId,
      actorId: record.actorId,
      runId: record.runId,
    });
    const command =
      frozen ??
      commandSchema.parse(
        run.steps.find(step => step.stepKey === 'execute')?.input
      );
    const source = await this.source(record);
    const target = await this.target(record, source, command.target);
    if (
      source.sequence !== command.sourceSequence ||
      source.resource.version !== command.sourceResourceVersion ||
      source.fingerprint !== command.sourceFingerprint ||
      agentRuntimeFingerprint(target.evidence) !==
        agentRuntimeFingerprint(command.target) ||
      agentRuntimeFingerprint(record.preview) !== command.previewFingerprint
    )
      throw new ProjectPublicationConflict();
    return { source, target };
  }

  private async transfer(
    record: ProjectPublication,
    target: PublicationTarget,
    bytes: Buffer,
    mimeType: string,
    revalidate: () => Promise<void>,
    allocate: (key: string, bytes: number) => Promise<void>
  ) {
    const key = `${COPILOT_COPY_BLOB_PREFIX}${target.resourceId}-${createHash('sha256').update(bytes).digest('base64url')}`;
    const authorize = async () => {
      await revalidate();
      await this.ac
        .user(record.actorId)
        .workspace(target.workspaceId)
        .assert('Workspace.Blobs.Write');
    };
    await authorize();
    await allocate(key, bytes.length);
    await this.blobs.putCopyAttachment(
      target.workspaceId,
      key,
      bytes,
      {
        uploadId: record.id,
        contentType: mimeType,
        deferQuotaInvalidation: true,
      },
      authorize
    );
    return key;
  }

  private async place(record: ProjectPublication, target: PublicationTarget) {
    const rows = await this.organization.readFolders(
      target.workspaceId,
      record.actorId
    );
    const indices = rows
      .filter(row => row.parentId === target.folderId)
      .map(row => row.index)
      .filter((value): value is string => typeof value === 'string')
      .sort();
    await this.organization.applyDataOperations(
      target.workspaceId,
      record.actorId,
      record.actorId,
      'folders',
      [
        {
          op: 'upsert',
          key: `project-publication-${target.resourceId}`,
          values: {
            type: 'doc',
            data: target.resourceId,
            parentId: target.folderId,
            index: generateKeyBetween(indices.at(-1) ?? null, null),
          },
        },
      ]
    );
  }
}
