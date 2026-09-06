import { Prisma, PrismaClient } from '@prisma/client';
import test from 'ava';

import { createModule } from '../../../__tests__/create-module';
import { Mockers } from '../../../__tests__/mocks';
import { Models } from '../../../models';
import { AccessControllerBuilder } from '../builder';
import { DocRole, PermissionModule, WorkspaceRole } from '../index';
import { PermissionSqlPredicateBuilder } from '../sql-predicate';
import type { DocAction } from '../types';

const module = await createModule({
  imports: [PermissionModule],
});

const builder = module.get(AccessControllerBuilder);
const models = module.get(Models);
const db = module.get(PrismaClient);
const sqlPredicate = module.get(PermissionSqlPredicateBuilder);

test.after.always(async () => {
  await module.close();
});

async function sqlReadableDocIds(input: {
  workspaceId: string;
  userId?: string;
  action?: DocAction;
  docIds: string[];
  projectId?: string | null;
  rawPredicate?: boolean;
}) {
  const values = Prisma.join(
    input.docIds.map((docId, index) => Prisma.sql`(${docId}, ${index})`)
  );
  let predicate = sqlPredicate.docReadableSql({
    workspaceId: input.workspaceId,
    userId: input.userId,
    action: input.action ?? 'Doc.Read',
    docIdColumn: Prisma.raw('docs.id'),
    projectId: input.projectId,
  });
  if (input.rawPredicate) {
    const raw = sqlPredicate.docReadable({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: input.action ?? 'Doc.Read',
      projectId: input.projectId,
      docIdColumn: 'docs.id',
    });
    predicate = Prisma.sql(raw.sql.split('?'), ...raw.params);
  }
  const rows = await db.$queryRaw<{ docId: string }[]>`
    WITH docs(id, ord) AS (VALUES ${values})
    SELECT docs.id AS "docId"
    FROM docs
    WHERE ${predicate}
    ORDER BY docs.ord ASC
  `;
  return rows.map(row => row.docId);
}

async function resetProjection(workspaceId: string) {
  await db.$executeRaw`DELETE FROM doc_grants WHERE workspace_id = ${workspaceId}`;
  await db.$executeRaw`DELETE FROM doc_access_policies WHERE workspace_id = ${workspaceId}`;
  await db.$executeRaw`DELETE FROM workspace_members WHERE workspace_id = ${workspaceId}`;
  await db.$executeRaw`
    INSERT INTO workspace_access_policies (
      workspace_id,
      visibility,
      sharing_enabled,
      url_preview_enabled,
      member_default_doc_role,
      updated_at
    )
    VALUES (${workspaceId}, 'private', true, false, 'none', now())
    ON CONFLICT (workspace_id)
    DO UPDATE SET
      visibility = EXCLUDED.visibility,
      sharing_enabled = EXCLUDED.sharing_enabled,
      url_preview_enabled = EXCLUDED.url_preview_enabled,
      member_default_doc_role = EXCLUDED.member_default_doc_role,
      updated_at = now()
  `;
  await setWritableRuntime(workspaceId);
}

async function setWritableRuntime(workspaceId: string) {
  await db.effectiveWorkspaceQuotaState.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      plan: 'free',
      usesOwnerQuota: false,
      seatLimit: 0,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      readonly: false,
      known: true,
    },
    update: {
      readonly: false,
      readonlyReasons: [],
      known: true,
      stale: false,
    },
  });
}

test('should filter docs by Doc.Read', async t => {
  const owner = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner,
  });

  const docs1 = await builder
    .user(owner.id)
    .workspace(workspace.id)
    .docs(
      [{ docId: 'doc1' }, { docId: 'doc2' }, { docId: 'doc3' }],
      'Doc.Read'
    );

  t.is(docs1.length, 3);
  t.snapshot(docs1);

  // member should have access to the docs
  const member = await module.create(Mockers.User);
  await module.create(Mockers.WorkspaceUser, {
    workspaceId: workspace.id,
    userId: member.id,
    type: WorkspaceRole.Collaborator,
  });

  await module.create(Mockers.DocUser, {
    workspaceId: workspace.id,
    docId: 'doc1',
    userId: member.id,
    type: DocRole.Reader,
  });

  await module.create(Mockers.DocUser, {
    workspaceId: workspace.id,
    docId: 'doc2',
    userId: member.id,
    type: DocRole.Manager,
  });

  const docs2 = await builder
    .user(member.id)
    .workspace(workspace.id)
    .docs(
      [{ docId: 'doc1' }, { docId: 'doc2' }, { docId: 'doc3' }],
      'Doc.Read'
    );

  t.is(docs2.length, 3);
  t.snapshot(docs2);

  // other user should not have access to the docs
  const other = await module.create(Mockers.User);

  const docs3 = await builder
    .user(other.id)
    .workspace(workspace.id)
    .docs(
      [{ docId: 'doc1' }, { docId: 'doc2' }, { docId: 'doc3' }],
      'Doc.Read'
    );

  t.is(docs3.length, 0);
});

test('SQL doc read predicate handles member default and public candidates', async t => {
  const owner = await module.create(Mockers.User);
  const member = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner,
  });
  await resetProjection(workspace.id);
  await db.$executeRaw`
    UPDATE workspace_access_policies
    SET member_default_doc_role = 'reader'
    WHERE workspace_id = ${workspace.id}
  `;
  await db.$executeRaw`
    INSERT INTO workspace_members (
      workspace_id,
      user_id,
      role,
      state,
      source,
      updated_at
    )
    VALUES (${workspace.id}, ${member.id}, 'member', 'active', 'legacy', now())
  `;
  await db.$executeRaw`
    INSERT INTO doc_access_policies (
      workspace_id,
      doc_id,
      visibility,
      public_role,
      member_default_role,
      updated_at
    )
    VALUES
      (${workspace.id}, 'member-default-none', 'private', NULL, 'none', now()),
      (${workspace.id}, 'public-doc', 'public', 'external', NULL, now())
  `;

  const docIds = ['missing-policy', 'member-default-none', 'public-doc'];
  const sqlReadable = await sqlReadableDocIds({
    workspaceId: workspace.id,
    userId: member.id,
    docIds,
  });
  t.deepEqual(sqlReadable, ['missing-policy', 'public-doc']);
});

test('SQL doc read predicate handles non-member grant and sharing disabled', async t => {
  const owner = await module.create(Mockers.User);
  const nonMember = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner,
  });
  await resetProjection(workspace.id);
  await db.$executeRaw`
    INSERT INTO doc_access_policies (
      workspace_id,
      doc_id,
      visibility,
      public_role,
      member_default_role,
      updated_at
    )
    VALUES
      (${workspace.id}, 'public-doc', 'public', 'external', NULL, now()),
      (${workspace.id}, 'private-doc', 'private', NULL, NULL, now()),
      (${workspace.id}, 'explicit-grant', 'private', NULL, NULL, now()),
      (${workspace.id}, 'explicit-owner-grant', 'private', NULL, NULL, now())
  `;
  await db.$executeRaw`
    INSERT INTO doc_grants (
      workspace_id,
      doc_id,
      principal_type,
      principal_id,
      role,
      updated_at
    )
    VALUES
      (
        ${workspace.id},
        'explicit-grant',
        'user',
        ${nonMember.id},
        'reader',
        now()
      ),
      (
        ${workspace.id},
        'explicit-owner-grant',
        'user',
        ${nonMember.id},
        'owner',
        now()
      )
  `;

  const docIds = [
    'public-doc',
    'private-doc',
    'explicit-grant',
    'explicit-owner-grant',
  ];
  const sharingEnabledReadable = await sqlReadableDocIds({
    workspaceId: workspace.id,
    userId: nonMember.id,
    docIds,
  });
  const sharingEnabledUpdate = await sqlReadableDocIds({
    workspaceId: workspace.id,
    userId: nonMember.id,
    action: 'Doc.Update',
    docIds,
  });

  await db.$executeRaw`
    UPDATE workspace_access_policies
    SET sharing_enabled = false
    WHERE workspace_id = ${workspace.id}
  `;
  const sharingDisabledReadable = await sqlReadableDocIds({
    workspaceId: workspace.id,
    userId: nonMember.id,
    docIds,
  });

  t.deepEqual(sharingEnabledReadable, [
    'public-doc',
    'explicit-grant',
    'explicit-owner-grant',
  ]);
  t.deepEqual(sharingEnabledUpdate, ['explicit-owner-grant']);
  t.deepEqual(sharingDisabledReadable, []);
});

test('SQL doc predicate suppresses member default when explicit grant exists', async t => {
  const owner = await module.create(Mockers.User);
  const member = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner,
  });
  await resetProjection(workspace.id);
  await db.$executeRaw`
    UPDATE workspace_access_policies
    SET member_default_doc_role = 'manager'
    WHERE workspace_id = ${workspace.id}
  `;
  await db.$executeRaw`
    INSERT INTO workspace_members (
      workspace_id,
      user_id,
      role,
      state,
      source,
      updated_at
    )
    VALUES (${workspace.id}, ${member.id}, 'member', 'active', 'legacy', now())
  `;
  await db.$executeRaw`
    INSERT INTO doc_access_policies (
      workspace_id,
      doc_id,
      visibility,
      public_role,
      member_default_role,
      updated_at
    )
    VALUES
      (${workspace.id}, 'default-manager', 'private', NULL, NULL, now()),
      (${workspace.id}, 'explicit-reader', 'private', NULL, NULL, now())
  `;
  await db.$executeRaw`
    INSERT INTO doc_grants (
      workspace_id,
      doc_id,
      principal_type,
      principal_id,
      role,
      updated_at
    )
    VALUES (
      ${workspace.id},
      'explicit-reader',
      'user',
      ${member.id},
      'reader',
      now()
    )
  `;

  const docIds = ['default-manager', 'explicit-reader'];
  const sqlUpdateAllowed = await sqlReadableDocIds({
    workspaceId: workspace.id,
    userId: member.id,
    action: 'Doc.Update',
    docIds,
  });

  t.deepEqual(sqlUpdateAllowed, ['default-manager']);
});

test('project grants authorize active members without granting document management', async t => {
  const sourceOwner = await module.create(Mockers.User);
  const projectMember = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner: sourceOwner,
  });
  await resetProjection(workspace.id);
  await db.workspaceAccessPolicy.update({
    where: { workspaceId: workspace.id },
    data: { sharingEnabled: false },
  });

  const project = await db.aiContextProject.create({
    data: {
      createdByUserId: sourceOwner.id,
      name: 'Project grant permission boundary',
      members: {
        create: [
          { userId: sourceOwner.id, role: 'owner' },
          { userId: projectMember.id, role: 'member' },
        ],
      },
    },
  });
  await db.$transaction(async tx => {
    for (const [docId, level] of [
      ['project-read', 'read'],
      ['project-write', 'write'],
      ['project-only', 'read'],
    ] as const) {
      await tx.aiContextProjectDoc.create({
        data: {
          projectId: project.id,
          workspaceId: workspace.id,
          docId,
          status: 'granted',
          requestedLevel: level,
          addedByUserId: sourceOwner.id,
        },
      });
      await tx.aiContextProjectGrant.create({
        data: {
          projectId: project.id,
          workspaceId: workspace.id,
          docId,
          level,
          source: 'direct',
          grantedByUserId: sourceOwner.id,
          grantorUserIdSnapshot: sourceOwner.id,
        },
      });
    }
    await tx.docGrant.createMany({
      data: [
        {
          workspaceId: workspace.id,
          docId: 'project-write',
          principalType: 'user',
          principalId: projectMember.id,
          role: 'reader',
        },
        {
          workspaceId: workspace.id,
          docId: 'project-read',
          principalType: 'user',
          principalId: projectMember.id,
          role: 'editor',
        },
      ],
    });
  });

  for (const rawPredicate of [false, true]) {
    for (const projectId of [undefined, null, project.id, 'another-project']) {
      t.deepEqual(
        await sqlReadableDocIds({
          workspaceId: workspace.id,
          userId: projectMember.id,
          docIds: ['project-read', 'project-write', 'project-only'],
          projectId,
          rawPredicate,
        }),
        projectId === undefined || projectId === project.id
          ? ['project-read', 'project-write', 'project-only']
          : []
      );
    }
  }

  const readPermissions = await builder
    .user(projectMember.id)
    .doc(workspace.id, 'project-read')
    .permissions();
  const writePermissions = await builder
    .user(projectMember.id)
    .doc(workspace.id, 'project-write')
    .permissions();
  t.is(readPermissions.role, DocRole.Editor);
  t.true(readPermissions.permissions['Doc.Read']);
  t.true(readPermissions.permissions['Doc.Update']);
  t.false(readPermissions.permissions['Doc.Users.Manage']);
  t.is(writePermissions.role, DocRole.Editor);
  t.true(writePermissions.permissions['Doc.Read']);
  t.true(writePermissions.permissions['Doc.Update']);
  t.false(writePermissions.permissions['Doc.Users.Manage']);

  t.deepEqual(
    await sqlReadableDocIds({
      workspaceId: workspace.id,
      userId: projectMember.id,
      docIds: ['project-read', 'project-write'],
    }),
    ['project-read', 'project-write']
  );
  t.deepEqual(
    await sqlReadableDocIds({
      workspaceId: workspace.id,
      userId: projectMember.id,
      action: 'Doc.Update',
      docIds: ['project-read', 'project-write'],
    }),
    ['project-read', 'project-write']
  );
  t.deepEqual(
    await sqlReadableDocIds({
      workspaceId: workspace.id,
      userId: projectMember.id,
      action: 'Doc.Users.Manage',
      docIds: ['project-read', 'project-write'],
    }),
    []
  );

  await db.$transaction([
    db.aiContextProjectGrant.updateMany({
      where: { projectId: project.id, docId: 'project-write' },
      data: {
        status: 'revoked',
        revokedByUserId: sourceOwner.id,
        revokerUserIdSnapshot: sourceOwner.id,
        revokedAt: new Date(),
      },
    }),
    db.aiContextProjectDoc.update({
      where: {
        projectId_workspaceId_docId: {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'project-write',
        },
      },
      data: { status: 'revoked', revokedAt: new Date() },
    }),
  ]);
  t.false(
    await builder
      .user(projectMember.id)
      .doc(workspace.id, 'project-write')
      .can('Doc.Read')
  );

  await db.aiContextProject.update({
    where: { id: project.id },
    data: { status: 'archived' },
  });
  t.false(
    await builder
      .user(projectMember.id)
      .doc(workspace.id, 'project-read')
      .can('Doc.Read')
  );
  await db.aiContextProject.update({
    where: { id: project.id },
    data: { status: 'active' },
  });

  await db.aiContextProjectMember.delete({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: projectMember.id,
      },
    },
  });
  t.false(
    await builder
      .user(projectMember.id)
      .doc(workspace.id, 'project-read')
      .can('Doc.Read')
  );
});

test('SQL personal scope retains direct ACL while excluding project-only documents', async t => {
  const owner = await module.create(Mockers.User);
  const reader = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, { owner });
  await resetProjection(workspace.id);
  await db.docGrant.create({
    data: {
      workspaceId: workspace.id,
      docId: 'personal',
      principalType: 'user',
      principalId: reader.id,
      role: 'reader',
    },
  });
  for (const rawPredicate of [false, true]) {
    for (const projectId of [undefined, null, 'unrelated-project']) {
      t.deepEqual(
        await sqlReadableDocIds({
          workspaceId: workspace.id,
          userId: reader.id,
          docIds: ['personal', 'hidden'],
          projectId,
          rawPredicate,
        }),
        ['personal']
      );
    }
  }
});

test('should filter docs by Doc.Publish', async t => {
  const owner = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace, {
    owner,
  });
  await models.workspace.update(workspace.id, { enableSharing: true });
  await setWritableRuntime(workspace.id);

  const docs1 = await builder
    .user(owner.id)
    .workspace(workspace.id)
    .docs(
      [{ docId: 'doc1' }, { docId: 'doc2' }, { docId: 'doc3' }],
      'Doc.Publish'
    );

  t.is(docs1.length, 3);
  t.snapshot(docs1);

  // member should have access to the docs
  const member = await module.create(Mockers.User);
  await module.create(Mockers.WorkspaceUser, {
    workspaceId: workspace.id,
    userId: member.id,
    type: WorkspaceRole.Collaborator,
  });

  await module.create(Mockers.DocUser, {
    workspaceId: workspace.id,
    docId: 'doc1',
    userId: member.id,
    type: DocRole.Reader,
  });

  await module.create(Mockers.DocUser, {
    workspaceId: workspace.id,
    docId: 'doc2',
    userId: member.id,
    type: DocRole.Manager,
  });

  const docs2 = await builder
    .user(member.id)
    .workspace(workspace.id)
    .docs(
      [{ docId: 'doc1' }, { docId: 'doc2' }, { docId: 'doc3' }],
      'Doc.Publish'
    );

  t.is(docs2.length, 2);
  t.snapshot(docs2);

  // other user should not have access to the docs
  const other = await module.create(Mockers.User);

  const docs3 = await builder
    .user(other.id)
    .workspace(workspace.id)
    .docs(
      [{ docId: 'doc1' }, { docId: 'doc2' }, { docId: 'doc3' }],
      'Doc.Publish'
    );

  t.is(docs3.length, 0);
});
