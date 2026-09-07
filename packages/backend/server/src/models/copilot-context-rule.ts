import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { NotFound } from '../base';
import { BaseModel } from './base';
import type {
  CopilotContextDocumentRef,
  CopilotContextMemoryScope,
} from './copilot-context-memory';

export const COPILOT_CONTEXT_RULE_MODES = [
  'always',
  'relevant',
  'manual',
] as const;
export type CopilotContextRuleMode =
  (typeof COPILOT_CONTEXT_RULE_MODES)[number];

export const COPILOT_CONTEXT_RULE_STATUSES = ['active', 'disabled'] as const;
export type CopilotContextRuleStatus =
  (typeof COPILOT_CONTEXT_RULE_STATUSES)[number];

export type CopilotContextRuleConditions = {
  keywords?: string[];
  docIds?: string[];
  documentRefs?: CopilotContextDocumentRef[];
  projectIds?: string[];
  match?: 'any' | 'all';
};

export type CopilotContextRuleInput = {
  ownerUserId: string;
  workspaceId?: string | null;
  projectId?: string | null;
  scope: Exclude<CopilotContextMemoryScope, 'document'>;
  name: string;
  description?: string;
  applicationMode: CopilotContextRuleMode;
  priority: number;
  conditions: CopilotContextRuleConditions;
  content: string;
};

export type CopilotContextPolicyInput = {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  description?: string;
  applicationMode: Exclude<CopilotContextRuleMode, 'manual'>;
  priority: number;
  conditions: CopilotContextRuleConditions;
  content: string;
};

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function fingerprintContextRuleRevision(input: {
  family: 'rule' | 'policy';
  parentId: string;
  revision: number;
  content: string;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        content: normalize(input.content),
      })
    )
    .digest('hex');
}

@Injectable()
export class CopilotContextRuleModel extends BaseModel {
  private ruleManagementWhere(id: string, actorUserId: string) {
    return {
      id,
      OR: [
        {
          ownerUserId: actorUserId,
          scope: { not: 'project' },
        },
        {
          scope: 'project',
          project: {
            status: 'active',
            members: {
              some: { userId: actorUserId, role: 'owner' },
            },
          },
        },
      ],
    } satisfies Prisma.AiContextRuleWhereInput;
  }

  private async getManageableRule(id: string, actorUserId: string) {
    return await this.db.aiContextRule.findFirst({
      where: this.ruleManagementWhere(id, actorUserId),
      include: {
        revisions: { orderBy: { revision: 'desc' } },
        hits: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  @Transactional()
  async createRule(input: CopilotContextRuleInput) {
    if (input.scope === 'project') {
      const project = await this.db.aiContextProject.findFirst({
        where: {
          id: input.projectId ?? undefined,
          status: 'active',
          members: {
            some: { userId: input.ownerUserId, role: 'owner' },
          },
        },
        select: { id: true },
      });
      if (!project) throw new NotFound('AI context project not found');
    }
    const rule = await this.db.aiContextRule.create({
      data: {
        ownerUserId: input.ownerUserId,
        workspaceId:
          input.scope === 'project' ? null : (input.workspaceId ?? null),
        projectId: input.projectId ?? null,
        scope: input.scope,
        name: normalize(input.name),
        description: input.description?.trim() ?? '',
        applicationMode: input.applicationMode,
        priority: input.priority,
        conditions: input.conditions as Prisma.InputJsonValue,
      },
    });
    const revision = await this.db.aiContextRuleRevision.create({
      data: {
        ruleId: rule.id,
        revision: 1,
        content: normalize(input.content),
        fingerprint: fingerprintContextRuleRevision({
          family: 'rule',
          parentId: rule.id,
          revision: 1,
          content: input.content,
        }),
        createdByUserId: input.ownerUserId,
        source: 'manual',
      },
    });
    return { ...rule, revisions: [revision], hits: [] };
  }

  async getRule(id: string) {
    return await this.db.aiContextRule.findUnique({
      where: { id },
      include: {
        revisions: { orderBy: { revision: 'desc' } },
        hits: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  async listRules(input: {
    ownerUserId: string;
    workspaceId: string | null;
    projectIds?: string[];
    includeDisabled?: boolean;
  }) {
    return await this.db.aiContextRule.findMany({
      where: {
        ...(input.includeDisabled ? {} : { status: 'active' }),
        OR: [
          {
            ownerUserId: input.ownerUserId,
            scope: 'user',
            workspaceId: null,
            projectId: null,
          },
          {
            ownerUserId: input.ownerUserId,
            scope: 'workspace',
            workspaceId: input.workspaceId,
            projectId: null,
          },
          ...(input.projectIds?.length
            ? [
                {
                  scope: 'project',
                  workspaceId: null,
                  projectId: { in: input.projectIds },
                  project: {
                    status: 'active',
                    members: { some: { userId: input.ownerUserId } },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        revisions: { orderBy: { revision: 'desc' } },
        hits: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 256,
    });
  }

  @Transactional()
  async updateRule(
    id: string,
    actorUserId: string,
    input: {
      name?: string;
      description?: string;
      applicationMode?: CopilotContextRuleMode;
      priority?: number;
      conditions?: CopilotContextRuleConditions;
      status?: CopilotContextRuleStatus;
      content?: string;
    },
    source: 'manual' | 'rollback' = 'manual'
  ) {
    const current = await this.getManageableRule(id, actorUserId);
    if (!current) return null;
    const nextRevision = current.activeRevision + 1;
    const activeContent = current.revisions.find(
      revision => revision.revision === current.activeRevision
    )?.content;
    const content =
      input.content === undefined ? activeContent : normalize(input.content);
    if (!content) return null;
    const createsRevision =
      input.content !== undefined && content !== activeContent;

    const updated = await this.db.aiContextRule.updateMany({
      where: {
        ...this.ruleManagementWhere(id, actorUserId),
        activeRevision: current.activeRevision,
        updatedAt: current.updatedAt,
      },
      data: {
        name: input.name ? normalize(input.name) : undefined,
        description: input.description?.trim(),
        applicationMode: input.applicationMode,
        priority: input.priority,
        conditions: input.conditions as Prisma.InputJsonValue | undefined,
        status: input.status,
        activeRevision: createsRevision ? nextRevision : undefined,
      },
    });
    if (updated.count !== 1) {
      throw new Error('Context rule changed while updating');
    }
    if (createsRevision) {
      await this.db.aiContextRuleRevision.create({
        data: {
          ruleId: id,
          revision: nextRevision,
          content,
          fingerprint: fingerprintContextRuleRevision({
            family: 'rule',
            parentId: id,
            revision: nextRevision,
            content,
          }),
          createdByUserId: actorUserId,
          source,
        },
      });
    }
    return await this.getRule(id);
  }

  async rollbackRule(input: {
    id: string;
    actorUserId: string;
    revision: number;
  }) {
    const rule = await this.getManageableRule(input.id, input.actorUserId);
    const target = rule?.revisions.find(
      revision => revision.revision === input.revision
    );
    if (!rule || !target) return null;
    return await this.updateRule(
      input.id,
      input.actorUserId,
      { content: target.content },
      'rollback'
    );
  }

  @Transactional()
  async deleteRule(id: string, actorUserId: string) {
    const result = await this.db.aiContextRule.deleteMany({
      where: this.ruleManagementWhere(id, actorUserId),
    });
    return result.count > 0;
  }

  @Transactional()
  async createPolicy(input: CopilotContextPolicyInput) {
    const policy = await this.db.aiContextPolicy.create({
      data: {
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        name: normalize(input.name),
        description: input.description?.trim() ?? '',
        applicationMode: input.applicationMode,
        priority: input.priority,
        conditions: input.conditions as Prisma.InputJsonValue,
      },
    });
    const revision = await this.db.aiContextPolicyRevision.create({
      data: {
        policyId: policy.id,
        revision: 1,
        content: normalize(input.content),
        fingerprint: fingerprintContextRuleRevision({
          family: 'policy',
          parentId: policy.id,
          revision: 1,
          content: input.content,
        }),
        createdByUserId: input.createdByUserId,
        source: 'manual',
      },
    });
    return { ...policy, revisions: [revision], hits: [] };
  }

  async getPolicy(id: string) {
    return await this.db.aiContextPolicy.findUnique({
      where: { id },
      include: {
        revisions: { orderBy: { revision: 'desc' } },
        hits: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  async listPolicies(input: {
    workspaceId: string;
    includeDisabled?: boolean;
  }) {
    return await this.db.aiContextPolicy.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.includeDisabled ? {} : { status: 'active' }),
      },
      include: {
        revisions: { orderBy: { revision: 'desc' } },
        hits: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 256,
    });
  }

  @Transactional()
  async updatePolicy(
    id: string,
    workspaceId: string,
    actorUserId: string,
    input: {
      name?: string;
      description?: string;
      applicationMode?: Exclude<CopilotContextRuleMode, 'manual'>;
      priority?: number;
      conditions?: CopilotContextRuleConditions;
      status?: CopilotContextRuleStatus;
      content?: string;
    },
    source: 'manual' | 'rollback' = 'manual'
  ) {
    const current = await this.getPolicy(id);
    if (!current || current.workspaceId !== workspaceId) return null;
    const nextRevision = current.activeRevision + 1;
    const activeContent = current.revisions.find(
      revision => revision.revision === current.activeRevision
    )?.content;
    const content =
      input.content === undefined ? activeContent : normalize(input.content);
    if (!content) return null;
    const createsRevision =
      input.content !== undefined && content !== activeContent;
    const updated = await this.db.aiContextPolicy.updateMany({
      where: {
        id,
        workspaceId,
        activeRevision: current.activeRevision,
        updatedAt: current.updatedAt,
      },
      data: {
        name: input.name ? normalize(input.name) : undefined,
        description: input.description?.trim(),
        applicationMode: input.applicationMode,
        priority: input.priority,
        conditions: input.conditions as Prisma.InputJsonValue | undefined,
        status: input.status,
        activeRevision: createsRevision ? nextRevision : undefined,
      },
    });
    if (updated.count !== 1) {
      throw new Error('Context policy changed while updating');
    }
    if (createsRevision) {
      await this.db.aiContextPolicyRevision.create({
        data: {
          policyId: id,
          revision: nextRevision,
          content,
          fingerprint: fingerprintContextRuleRevision({
            family: 'policy',
            parentId: id,
            revision: nextRevision,
            content,
          }),
          createdByUserId: actorUserId,
          source,
        },
      });
    }
    return await this.getPolicy(id);
  }

  async rollbackPolicy(input: {
    id: string;
    workspaceId: string;
    actorUserId: string;
    revision: number;
  }) {
    const policy = await this.getPolicy(input.id);
    const target = policy?.revisions.find(
      revision => revision.revision === input.revision
    );
    if (!policy || policy.workspaceId !== input.workspaceId || !target) {
      return null;
    }
    return await this.updatePolicy(
      input.id,
      input.workspaceId,
      input.actorUserId,
      { content: target.content },
      'rollback'
    );
  }

  @Transactional()
  async deletePolicy(id: string, workspaceId: string) {
    const result = await this.db.aiContextPolicy.deleteMany({
      where: { id, workspaceId },
    });
    return result.count > 0;
  }

  @Transactional()
  async recordHits(input: {
    sessionId: string;
    sourceTurnId?: string | null;
    rules: Array<{
      ruleId: string;
      revisionId: string;
      matchReason: 'always' | 'condition' | 'semantic' | 'manual';
      score: number;
    }>;
    policies: Array<{
      policyId: string;
      revisionId: string;
      matchReason: 'always' | 'condition' | 'semantic';
      score: number;
    }>;
  }) {
    const [rules, policies] = await Promise.all([
      input.rules.length
        ? this.db.aiContextRuleHit.createMany({
            data: input.rules.map(hit => ({
              ...hit,
              sessionId: input.sessionId,
              sourceTurnId: input.sourceTurnId ?? null,
            })),
          })
        : { count: 0 },
      input.policies.length
        ? this.db.aiContextPolicyHit.createMany({
            data: input.policies.map(hit => ({
              ...hit,
              sessionId: input.sessionId,
              sourceTurnId: input.sourceTurnId ?? null,
            })),
          })
        : { count: 0 },
    ]);
    return { ruleCount: rules.count, policyCount: policies.count };
  }
}
