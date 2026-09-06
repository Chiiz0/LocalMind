import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { permissionActionRoleMatrixV1 } from '../../native';
import type { DocAction } from './types';

export type PermissionSqlPredicate = {
  sql: string;
  params: unknown[];
};

type RawDocIdColumn = 'doc_id' | 'docs.id';

@Injectable()
export class PermissionSqlPredicateBuilder {
  private readonly matrix = permissionActionRoleMatrixV1() as {
    doc?: { roles?: Record<string, string[]> };
    workspace?: { roles?: Record<string, string[]> };
  };

  private docRolesForAction(action: DocAction) {
    return Object.entries(this.matrix.doc?.roles ?? {})
      .filter(([, actions]) => actions.includes(action))
      .map(([role]) => role)
      .filter(role => role !== 'none');
  }

  private inheritedWorkspaceRolesForDocAction(action: DocAction) {
    const docRoles = new Set(this.docRolesForAction(action));
    return [
      docRoles.has('owner') ? 'owner' : null,
      docRoles.has('manager') ? 'admin' : null,
    ].filter((role): role is string => role !== null);
  }

  private nonMemberDocGrantRolesForAction(action: DocAction) {
    const roles = new Set(this.docRolesForAction(action));
    roles.delete('external');
    roles.delete('manager');
    roles.delete('owner');
    if (roles.has('editor')) {
      roles.add('manager');
      roles.add('owner');
    }
    return [...roles];
  }

  private projectGrantLevelsForAction(action: DocAction) {
    const roles = new Set(this.docRolesForAction(action));
    return [
      roles.has('reader') ? 'read' : null,
      roles.has('editor') ? 'write' : null,
    ].filter((level): level is 'read' | 'write' => level !== null);
  }

  private rawDocIdColumn(column: RawDocIdColumn = 'doc_id') {
    switch (column) {
      case 'doc_id':
      case 'docs.id':
        return column;
      default:
        throw new Error(`Unsupported doc id column: ${column}`);
    }
  }

  docReadable(input: {
    workspaceId: string;
    userId?: string;
    action: DocAction;
    docIdColumn?: RawDocIdColumn;
    projectId?: string | null;
  }): PermissionSqlPredicate {
    const docRoles = this.docRolesForAction(input.action);
    const inheritedWorkspaceRoles = this.inheritedWorkspaceRolesForDocAction(
      input.action
    );
    const grantRoles = docRoles.filter(role => role !== 'external');
    const nonMemberGrantRoles = this.nonMemberDocGrantRolesForAction(
      input.action
    );
    const projectGrantLevels = this.projectGrantLevelsForAction(input.action);
    const docIdColumn = this.rawDocIdColumn(input.docIdColumn);

    return {
      sql: [
        `EXISTS (SELECT 1 FROM workspace_access_policies wap`,
        `LEFT JOIN doc_access_policies dap ON dap.workspace_id = wap.workspace_id`,
        `AND dap.doc_id = ${docIdColumn}`,
        `LEFT JOIN workspace_members wm ON wm.workspace_id = wap.workspace_id`,
        `AND wm.user_id = ? AND wm.state = 'active'`,
        `LEFT JOIN doc_grants dg ON dg.workspace_id = wap.workspace_id`,
        `AND dg.doc_id = ${docIdColumn} AND dg.principal_type = 'user' AND dg.principal_id = ?`,
        `WHERE wap.workspace_id = ?`,
        `AND (`,
        `(wm.id IS NOT NULL AND dg.role = ANY(?::text[]))`,
        `OR (wm.id IS NULL AND wap.sharing_enabled AND dg.role = ANY(?::text[]))`,
        `OR wm.role = ANY(?::text[])`,
        `OR (wm.id IS NOT NULL AND dg.principal_id IS NULL AND COALESCE(dap.member_default_role, wap.member_default_doc_role) = ANY(?::text[]))`,
        `OR (wap.sharing_enabled AND dap.visibility = 'public' AND dap.public_role = ANY(?::text[]))`,
        `OR EXISTS (SELECT 1 FROM ai_context_project_grants project_grant`,
        `JOIN ai_context_projects project ON project.id = project_grant.project_id AND project.status = 'active'`,
        `JOIN ai_context_project_members project_member ON project_member.project_id = project_grant.project_id AND project_member.user_id = ?`,
        `WHERE project_grant.workspace_id = ? AND project_grant.doc_id = ${docIdColumn}`,
        `AND project_grant.status = 'active'`,
        ...(input.projectId === undefined
          ? []
          : input.projectId === null
            ? ['AND FALSE']
            : ['AND project_grant.project_id = ?']),
        `AND (project_grant.level = ANY(?::text[]) OR dg.role = ANY(?::text[])))`,
        `))`,
      ].join(' '),
      params: [
        input.userId,
        input.userId,
        input.workspaceId,
        grantRoles,
        nonMemberGrantRoles,
        inheritedWorkspaceRoles,
        grantRoles,
        docRoles,
        input.userId,
        input.workspaceId,
        ...(typeof input.projectId === 'string' ? [input.projectId] : []),
        projectGrantLevels,
        nonMemberGrantRoles,
      ],
    };
  }

  docReadableSql(input: {
    workspaceId: string;
    userId?: string;
    action: DocAction;
    docIdColumn?: Prisma.Sql;
    projectId?: string | null;
  }): Prisma.Sql {
    const docRoles = this.docRolesForAction(input.action);
    const grantRoles = docRoles.filter(role => role !== 'external');
    const nonMemberGrantRoles = this.nonMemberDocGrantRolesForAction(
      input.action
    );
    const inheritedWorkspaceRoles = this.inheritedWorkspaceRolesForDocAction(
      input.action
    );
    const projectGrantLevels = this.projectGrantLevelsForAction(input.action);
    const docIdColumn = input.docIdColumn ?? Prisma.raw('doc_id');

    return Prisma.sql`
      EXISTS (
        SELECT 1
        FROM workspace_access_policies wap
        LEFT JOIN doc_access_policies dap
          ON dap.workspace_id = wap.workspace_id
         AND dap.doc_id = ${docIdColumn}
        LEFT JOIN workspace_members wm
          ON wm.workspace_id = wap.workspace_id
         AND wm.user_id = ${input.userId}
         AND wm.state = 'active'
        LEFT JOIN doc_grants dg
          ON dg.workspace_id = wap.workspace_id
         AND dg.doc_id = ${docIdColumn}
         AND dg.principal_type = 'user'
         AND dg.principal_id = ${input.userId}
        WHERE wap.workspace_id = ${input.workspaceId}
          AND (
            (wm.id IS NOT NULL AND dg.role = ANY(${Prisma.sql`${grantRoles}::text[]`}))
            OR (wm.id IS NULL AND wap.sharing_enabled AND dg.role = ANY(${Prisma.sql`${nonMemberGrantRoles}::text[]`}))
            OR wm.role = ANY(${Prisma.sql`${inheritedWorkspaceRoles}::text[]`})
            OR (wm.id IS NOT NULL AND dg.principal_id IS NULL AND COALESCE(dap.member_default_role, wap.member_default_doc_role) = ANY(${Prisma.sql`${grantRoles}::text[]`}))
            OR (wap.sharing_enabled AND dap.visibility = 'public' AND dap.public_role = ANY(${Prisma.sql`${docRoles}::text[]`}))
            OR EXISTS (
              SELECT 1
              FROM ai_context_project_grants project_grant
              JOIN ai_context_projects project
                ON project.id = project_grant.project_id
               AND project.status = 'active'
              JOIN ai_context_project_members project_member
                ON project_member.project_id = project_grant.project_id
               AND project_member.user_id = ${input.userId}
              WHERE project_grant.workspace_id = ${input.workspaceId}
                AND project_grant.doc_id = ${docIdColumn}
                AND project_grant.status = 'active'
                ${input.projectId === undefined ? Prisma.empty : input.projectId === null ? Prisma.sql`AND FALSE` : Prisma.sql`AND project_grant.project_id = ${input.projectId}`}
                AND (
                  project_grant.level = ANY(${Prisma.sql`${projectGrantLevels}::text[]`})
                  OR dg.role = ANY(${Prisma.sql`${nonMemberGrantRoles}::text[]`})
                )
            )
          )
      )
    `;
  }
}
