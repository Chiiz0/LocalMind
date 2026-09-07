import { readFile } from 'node:fs/promises';

import { openDocxPackage, readDocxSemanticState } from '@localmind/office/docx';
import {
  createMinimalPdfFixture,
  createMinimalPptxFixture,
  createMinimalXlsxFixture,
} from '@localmind/office/testing';
import { PrismaClient } from '@prisma/client';
import test from 'ava';

import {
  OFFICE_FORMATS,
  OfficeArtifactService,
  OfficeCommandService,
  OfficeImportService,
} from '../../core/office';
import { ProjectResourceIndexer } from '../../core/office/project-indexer';
import { ProjectBlobStorage, ProjectResourceService } from '../../core/project';
import { CopilotProjectAgentRuntimeWorker } from '../../plugins/copilot/project-agent-runtime-worker';
import { ProjectOfficeAgentCommandService } from '../../plugins/copilot/project-office-agent-command';
import { ToolRuntime } from '../../plugins/copilot/runtime/tool-runtime';
import { createTestingApp, type TestingApp } from '../utils';

let app: TestingApp;
const deployment = env.DEPLOYMENT_TYPE;

test.before(async () => {
  app = await createTestingApp();
  env.DEPLOYMENT_TYPE = 'selfhosted';
});
test.beforeEach(async () => {
  await app.initTestingDB();
});
test.after.always(async () => {
  env.DEPLOYMENT_TYPE = deployment;
  await app.close();
});

async function fixture() {
  const user = await app.createUser();
  await app
    .POST('/api/auth/sign-in')
    .set('x-affine-version', '0.26.7')
    .send({ email: user.email, password: user.password })
    .expect(200);
  const owner = await app.models.user.create({
    email: 'office-owner@example.com',
  });
  const db = app.get(PrismaClient);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Native Office',
      aiPolicy: 'read_only',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: user.id, role: 'member' },
        ],
      },
    },
  });
  return { db, actorId: user.id, projectId: project.id };
}

async function formats() {
  const docx = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const state = readDocxSemanticState(openDocxPackage(docx));
  const paragraph = state.body.find(block => block.type === 'paragraph');
  if (!paragraph) throw new Error('DOCX fixture needs a paragraph');
  return [
    {
      format: 'docx' as const,
      bytes: docx,
      edit: {
        operation: 'office.document.text.replace',
        target: {
          type: 'text_range',
          start: { blockId: paragraph.id, offset: 0 },
          end: { blockId: paragraph.id, offset: 0 },
        },
        text: 'Project edit',
      },
    },
    {
      format: 'xlsx' as const,
      bytes: createMinimalXlsxFixture(),
      edit: {
        operation: 'office.workbook.cell.set',
        target: { type: 'cell', sheetId: '7', address: 'D2' },
        input: { type: 'string', value: 'Project edit' },
      },
    },
    {
      format: 'pptx' as const,
      bytes: createMinimalPptxFixture(),
      edit: {
        operation: 'office.presentation.shape.text.set',
        target: { type: 'shape', slideId: 'slide-rel', shapeId: '2' },
        text: 'Project edit',
      },
    },
    {
      format: 'pdf' as const,
      bytes: await createMinimalPdfFixture(),
      edit: {
        operation: 'office.pdf.page.rotate',
        target: { type: 'page', pageIndex: 0 },
        rotationDeg: 90,
      },
    },
  ];
}

async function aiFixture() {
  const scope = await fixture();
  const session = await app.gql<{
    createCopilotSessionWithHistory: { sessionId: string };
  }>(
    `mutation($options: CreateChatSessionInput!) {
      createCopilotSessionWithHistory(options: $options) { sessionId }
    }`,
    {
      options: {
        projectId: scope.projectId,
        promptName: 'Chat With LocalMind AI',
        reuseLatestChat: false,
      },
    }
  );
  return {
    ...scope,
    sessionId: session.createCopilotSessionWithHistory.sessionId,
  };
}

test.serial(
  'Project Office AI tools approve real four-format revisions and replay durable receipts',
  async t => {
    const { db, ...scope } = await aiFixture();
    const runtime = app.models.copilotProjectAgentRuntime;
    const service = app.get(ProjectOfficeAgentCommandService);
    const worker = app.get(CopilotProjectAgentRuntimeWorker);
    for (const item of await formats()) {
      const source = await app.get(ProjectBlobStorage).put({
        ...scope,
        bytes: Buffer.from(item.bytes),
        mimeType: OFFICE_FORMATS[item.format].mimeType,
      });
      const imported = await app.get(OfficeImportService).import({
        ...scope,
        title: `AI ${item.format}`,
        sourceFileName: `ai.${item.format}`,
        sourceBlobKey: source.key,
        importIdempotencyKey: `ai-${item.format}`,
      });
      const command = {
        version: 'localmind-office-command/v1',
        commandId: `ai-edit-${item.format}`,
        idempotencyKey: `ai-edit-${item.format}`,
        artifactId: imported.artifact.id,
        expectedRevisionId: imported.revision.id,
        source: 'ai',
        ...item.edit,
      };
      const tools = await app.get(ToolRuntime).getTools(
        {
          user: scope.actorId,
          session: scope.sessionId,
          tools: ['office'],
          officeContext: {
            version: 'localmind-project-office-ai-context/v1',
            projectId: scope.projectId,
            artifactId: imported.artifact.id,
            artifactKind: imported.artifact.kind,
            revisionId: imported.revision.id,
          },
        },
        'test'
      );
      t.truthy(tools.office_read);
      t.truthy(tools.office_command_request);
      const rejected = await tools.office_command_request.execute({ command });
      t.true(JSON.stringify(rejected).includes('Call office_read'));
      await tools.office_read.execute({});
      const requested = (await tools.office_command_request.execute({
        command,
      })) as { taskId: string; taskStatus: string };
      t.is(requested.taskStatus, 'waiting_approval', JSON.stringify(requested));
      const run = await runtime.get({ ...scope, runId: requested.taskId });
      t.is(
        await runtime.acquire({
          projectId: scope.projectId,
          runId: run.id,
          workerLeaseId: 'unapproved',
        }),
        null
      );
      t.is(
        (
          await db.officeArtifact.findUniqueOrThrow({
            where: { id: imported.artifact.id },
          })
        ).revisionCounter,
        1
      );
      await runtime.approve({
        ...scope,
        runId: run.id,
        targetFingerprint: run.targetFingerprint,
      });
      await worker.run({ projectId: scope.projectId, runId: run.id });
      const completed = await runtime.get({ ...scope, runId: run.id });
      t.is(completed.status, 'completed');
      t.is(completed.projectExecutionResults.length, 1);
      const revision = await db.officeRevision.findFirstOrThrow({
        where: { artifactId: imported.artifact.id, sequence: 2 },
      });
      t.is(revision.origin, 'ai');
      t.true(
        JSON.stringify(
          completed.projectExecutionResults[0].resultPayload
        ).includes(revision.id)
      );
      const repeated = await service.request({
        ...scope,
        command,
        readProof: {
          artifactId: imported.artifact.id,
          revisionId: imported.revision.id,
        },
      });
      t.is(repeated.taskId, run.id);
      t.is(repeated.taskStatus, 'completed');
      await worker.run({ projectId: scope.projectId, runId: run.id });
      t.is(
        await db.officeRevision.count({
          where: { artifactId: imported.artifact.id },
        }),
        2
      );
      if (item.format !== 'pdf') {
        const matches = await app.models.projectResource.search({
          ...scope,
          query: 'Project edit',
        });
        t.is(
          matches.items.find(match => match.id === imported.artifact.id)
            ?.contentVersion,
          2
        );
      }
      t.false(
        await app.models.projectResource.updateSearchText({
          ...scope,
          resourceId: imported.artifact.id,
          sequence: 1,
          text: 'stale search text',
        })
      );
      if (item.format === 'xlsx') {
        await service.read({ ...scope, artifactId: imported.artifact.id });
        const batch = {
          version: 'localmind-office-command-batch/v1',
          batchId: 'approved-batch',
          idempotencyKey: 'approved-batch',
          artifactId: imported.artifact.id,
          expectedRevisionId: revision.id,
          source: 'ai',
          commands: ['E2', 'F2'].map((address, index) => ({
            ...command,
            commandId: `approved-${index}`,
            idempotencyKey: `approved-${index}`,
            expectedRevisionId: revision.id,
            target: { type: 'cell', sheetId: '7', address },
          })),
        };
        const pending = await service.request({
          ...scope,
          batch,
          readProof: {
            artifactId: imported.artifact.id,
            revisionId: revision.id,
          },
        });
        const task = await runtime.get({ ...scope, runId: pending.taskId });
        await runtime.approve({
          ...scope,
          runId: task.id,
          targetFingerprint: task.targetFingerprint,
        });
        await worker.run({ projectId: scope.projectId, runId: task.id });
        t.is(
          (await runtime.get({ ...scope, runId: task.id })).status,
          'completed'
        );
        t.is(
          await db.officeRevision.count({
            where: { artifactId: imported.artifact.id },
          }),
          3
        );
      }
      await t.throwsAsync(
        service.request({
          ...scope,
          command: { ...command, source: 'user' },
          readProof: {
            artifactId: imported.artifact.id,
            revisionId: imported.revision.id,
          },
        }),
        { message: /source=ai/ }
      );
    }
    t.is(await db.workspace.count(), 0);
    t.is(await db.blob.count(), 0);
    await db.projectResource.updateMany({
      data: { searchText: '', searchVersion: 0 },
    });
    await app.get(ProjectResourceIndexer).run({});
    t.is(
      (
        await app.models.projectResource.search({
          ...scope,
          query: 'Project edit',
        })
      ).items.length,
      3
    );
    t.is(
      (
        await app.models.projectResource.search({
          ...scope,
          query: '',
          limit: 2,
        })
      ).items.length,
      2
    );
    t.is((await app.models.projectResource.pendingSearchIndex()).length, 0);
  }
);

test.serial(
  'Project Office AI cancellation, batch conflicts and live member revocation preserve the original package',
  async t => {
    const { db, ...scope } = await aiFixture();
    const runtime = app.models.copilotProjectAgentRuntime;
    const service = app.get(ProjectOfficeAgentCommandService);
    const worker = app.get(CopilotProjectAgentRuntimeWorker);
    const item = (await formats()).find(item => item.format === 'xlsx')!;
    const blob = await app.get(ProjectBlobStorage).put({
      ...scope,
      bytes: Buffer.from(item.bytes),
      mimeType: OFFICE_FORMATS.xlsx.mimeType,
    });
    const imported = await app.get(OfficeImportService).import({
      ...scope,
      title: 'Batch conflicts',
      sourceFileName: 'batch.xlsx',
      sourceBlobKey: blob.key,
      importIdempotencyKey: 'batch',
    });
    const readProof = {
      artifactId: imported.artifact.id,
      revisionId: imported.revision.id,
    };
    const command = {
      version: 'localmind-office-command/v1',
      commandId: 'batch-cmd',
      idempotencyKey: 'batch-cmd',
      artifactId: imported.artifact.id,
      expectedRevisionId: imported.revision.id,
      source: 'ai',
      ...item.edit,
    };
    await service.read({ ...scope, artifactId: imported.artifact.id });
    const cancelled = await service.request({ ...scope, command, readProof });
    await runtime.cancel({ ...scope, runId: cancelled.taskId });
    await worker.run({ projectId: scope.projectId, runId: cancelled.taskId });
    t.is(
      (await runtime.get({ ...scope, runId: cancelled.taskId })).status,
      'cancelled'
    );
    const batch = {
      version: 'localmind-office-command-batch/v1',
      batchId: 'batch',
      idempotencyKey: 'batch',
      artifactId: imported.artifact.id,
      expectedRevisionId: imported.revision.id,
      source: 'ai',
      commands: [
        { ...command, commandId: 'batch-1', idempotencyKey: 'batch-1' },
        {
          ...command,
          commandId: 'batch-2',
          idempotencyKey: 'batch-2',
          target: { type: 'cell', sheetId: '7', address: 'E2' },
        },
      ],
    };
    const requested = await service.request({ ...scope, batch, readProof });
    const revoked = await service.request({
      ...scope,
      command: { ...command, commandId: 'revoked', idempotencyKey: 'revoked' },
      readProof,
    });
    for (const taskId of [requested.taskId, revoked.taskId]) {
      const run = await runtime.get({ ...scope, runId: taskId });
      await runtime.approve({
        ...scope,
        runId: run.id,
        targetFingerprint: run.targetFingerprint,
      });
    }
    await app.get(OfficeCommandService).execute({
      ...scope,
      command: {
        ...command,
        source: 'user',
        commandId: 'manual',
        idempotencyKey: 'manual',
      },
    });
    await worker.run({ projectId: scope.projectId, runId: requested.taskId });
    t.is(
      (await runtime.get({ ...scope, runId: requested.taskId })).status,
      'failed'
    );
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    await worker.run({ projectId: scope.projectId, runId: revoked.taskId });
    t.is(
      (await db.aiAgentRun.findUniqueOrThrow({ where: { id: revoked.taskId } }))
        .status,
      'failed'
    );
    t.is(
      await db.officeRevision.count({
        where: { artifactId: imported.artifact.id },
      }),
      2
    );
    t.is(
      await db.officeRevision.count({
        where: { artifactId: imported.artifact.id, origin: 'ai' },
      }),
      0
    );
  }
);

test.serial(
  'four native Office formats import, edit, reopen and revoke without Workspace ownership',
  async t => {
    const { db, ...scope } = await fixture();
    const blobs = app.get(ProjectBlobStorage);
    const imports = app.get(OfficeImportService);
    const commands = app.get(OfficeCommandService);
    const artifacts = app.get(OfficeArtifactService);
    const folder = await app
      .get(ProjectResourceService)
      .createFolder({ ...scope, title: 'Office', requestKey: 'office-folder' });
    for (const item of await formats()) {
      const source = await blobs.put({
        ...scope,
        bytes: Buffer.from(item.bytes),
        mimeType: OFFICE_FORMATS[item.format].mimeType,
      });
      const input = {
        ...scope,
        parentId: folder.id,
        title: `Project ${item.format}`,
        sourceFileName: `project.${item.format}`,
        sourceBlobKey: source.key,
        importIdempotencyKey: `import-${item.format}`,
      };
      const imported = await imports.import(input);
      const repeated = await imports.import(input);
      t.is(repeated.artifact.id, imported.artifact.id);
      t.false(repeated.created);
      t.is(imported.artifact.workspaceId, null);
      t.is(imported.artifact.projectId, scope.projectId);
      const node = await app.models.projectResource.get({
        ...scope,
        resourceId: imported.artifact.id,
      });
      t.is(node.kind, OFFICE_FORMATS[item.format].kind);
      t.is(node.officeArtifactId, imported.artifact.id);
      t.is(node.parentId, folder.id);
      const command = {
        version: 'localmind-office-command/v1',
        commandId: `edit-${item.format}`,
        idempotencyKey: `edit-${item.format}`,
        artifactId: imported.artifact.id,
        expectedRevisionId: imported.revision.id,
        source: 'user',
        ...item.edit,
      };
      const edited = await commands.execute({ ...scope, command });
      const replay = await commands.execute({ ...scope, command });
      t.is(replay.revision.id, edited.revision.id);
      t.false(replay.created);
      t.is(edited.revision.sequence, 2);
      t.is(edited.revision.parentRevisionId, imported.revision.id);
      t.not(
        edited.revision.packageFingerprint,
        imported.revision.packageFingerprint
      );
      const reopened = await artifacts.readRevisionAsset(
        { projectId: scope.projectId },
        scope.actorId,
        imported.artifact.id,
        edited.revision.id,
        'package'
      );
      t.is(reopened.revision.id, edited.revision.id);
      const original = await artifacts.readRevisionAsset(
        { projectId: scope.projectId },
        scope.actorId,
        imported.artifact.id,
        imported.revision.id,
        'package'
      );
      t.deepEqual(original.bytes, Buffer.from(item.bytes));
      await t.throwsAsync(
        commands.execute({
          ...scope,
          command: { ...command, idempotencyKey: `stale-${item.format}` },
        }),
        { message: /revision conflict/ }
      );
      await t.throwsAsync(
        commands.execute({
          ...scope,
          command: {
            ...command,
            source: 'ai',
            idempotencyKey: `ai-${item.format}`,
            expectedRevisionId: edited.revision.id,
          },
        }),
        { message: /source conversation/ }
      );
      const response = await app
        .GET(
          `/api/projects/${scope.projectId}/office/artifacts/${node.id}/revisions/${edited.revision.id}/package`
        )
        .expect(200);
      t.is(response.headers['cache-control'], 'private, no-store');
      const loaded = await app.gql<{
        projectOfficeArtifact: {
          projectId: string;
          currentRevision: { sequence: number };
        };
      }>(
        'query Office($projectId: String!, $artifactId: String!) { projectOfficeArtifact(projectId: $projectId, artifactId: $artifactId) { projectId currentRevision { sequence } } }',
        { projectId: scope.projectId, artifactId: node.id }
      );
      t.is(loaded.projectOfficeArtifact.currentRevision.sequence, 2);
      await t.throwsAsync(
        db.officeArtifact.update({
          where: { id: node.id },
          data: { sourceFingerprint: 'sha256:forged' },
        })
      );
      await t.throwsAsync(
        db.officeRevision.update({
          where: { id: edited.revision.id },
          data: { operationSummary: { forged: true } },
        })
      );
    }
    t.is(await db.workspace.count(), 0);
    t.is(await db.blob.count(), 0);
    t.is(await db.officeArtifact.count(), 4);
    t.is(await db.officeRevision.count(), 8);
    t.is(await db.projectResourceRevision.count(), 0);

    const artifact = await db.officeArtifact.findFirstOrThrow();
    const revision = await db.officeRevision.findFirstOrThrow({
      where: { artifactId: artifact.id },
    });
    const trashed = await app.models.projectResource.change({
      ...scope,
      resourceId: folder.id,
      expectedVersion: folder.version,
      trash: true,
    });
    await t.throwsAsync(
      artifacts.get({ projectId: scope.projectId }, scope.actorId, artifact.id),
      { message: /Trash/ }
    );
    await t.throwsAsync(
      artifacts.listRevisions(
        { projectId: scope.projectId },
        scope.actorId,
        artifact.id
      ),
      { message: /Trash/ }
    );
    await app
      .GET(
        `/api/projects/${scope.projectId}/office/artifacts/${artifact.id}/revisions/${revision.id}/state`
      )
      .expect(400);
    await app.models.projectResource.change({
      ...scope,
      resourceId: folder.id,
      expectedVersion: trashed.version,
      trash: false,
    });
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    await app
      .GET(
        `/api/projects/${scope.projectId}/office/artifacts/${artifact.id}/revisions/${revision.id}/package`
      )
      .expect(403);
    await t.throwsAsync(
      artifacts.get({ projectId: scope.projectId }, scope.actorId, artifact.id)
    );
  }
);
