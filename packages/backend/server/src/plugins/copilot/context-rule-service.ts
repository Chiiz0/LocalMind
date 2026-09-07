import { Injectable } from '@nestjs/common';

import {
  type CopilotContextPolicyInput,
  type CopilotContextRuleConditions,
  type CopilotContextRuleInput,
  type CopilotContextRuleMode,
  type CopilotContextRuleStatus,
  Models,
} from '../../models';
import type { ContextScopeResolution } from './context-scope-resolver';

export type ApplicableContextDirective = {
  id: string;
  revisionId: string;
  sourceType: 'rule' | 'policy';
  scope: 'user' | 'workspace' | 'project';
  content: string;
  priority: number;
  score: number;
  matchReason: 'always' | 'condition' | 'semantic' | 'manual';
  updatedAt: Date;
};

const SEMANTIC_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'this',
  'to',
  'what',
  'when',
  'where',
  'which',
  'who',
  'with',
]);

function terms(value: string) {
  return value
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter(term => term.length >= 2 && !SEMANTIC_STOP_WORDS.has(term));
}

function normalizeConditions(value: unknown): CopilotContextRuleConditions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const strings = (candidate: unknown) =>
    Array.isArray(candidate)
      ? [...new Set(candidate.filter(item => typeof item === 'string'))].slice(
          0,
          100
        )
      : undefined;
  const documentRefs = Array.isArray(input.documentRefs)
    ? [
        ...new Map(
          input.documentRefs
            .filter(
              (item): item is Record<string, unknown> =>
                !!item && typeof item === 'object' && !Array.isArray(item)
            )
            .flatMap(item => {
              const workspaceId =
                typeof item.workspaceId === 'string'
                  ? item.workspaceId.trim()
                  : '';
              const docId =
                typeof item.docId === 'string' ? item.docId.trim() : '';
              return workspaceId && docId
                ? [
                    [
                      `${workspaceId}\0${docId}`,
                      { workspaceId, docId },
                    ] as const,
                  ]
                : [];
            })
        ).values(),
      ].slice(0, 100)
    : undefined;
  return {
    keywords: strings(input.keywords),
    docIds: strings(input.docIds),
    documentRefs,
    projectIds: strings(input.projectIds),
    match: input.match === 'all' ? 'all' : 'any',
  };
}

function conditionMatch(
  conditions: CopilotContextRuleConditions,
  scope: ContextScopeResolution,
  query: string
) {
  const checks: boolean[] = [];
  if (conditions.docIds?.length) {
    checks.push(
      conditions.docIds.some(docId => scope.readableDocIds.includes(docId))
    );
  }
  if (conditions.documentRefs?.length) {
    const readableRefs = new Set(
      scope.readableDocumentRefs.map(
        document => `${document.workspaceId}\0${document.docId}`
      )
    );
    checks.push(
      conditions.documentRefs.some(document =>
        readableRefs.has(`${document.workspaceId}\0${document.docId}`)
      )
    );
  }
  if (conditions.projectIds?.length) {
    checks.push(
      conditions.projectIds.some(projectId =>
        scope.projectIds.includes(projectId)
      )
    );
  }
  if (conditions.keywords?.length) {
    const normalizedQuery = query.toLocaleLowerCase();
    checks.push(
      conditions.keywords.some(keyword =>
        normalizedQuery.includes(keyword.toLocaleLowerCase())
      )
    );
  }
  if (!checks.length) return null;
  return conditions.match === 'all'
    ? checks.every(Boolean)
    : checks.some(Boolean);
}

function semanticScore(query: string, values: string[]) {
  const queryTerms = new Set(terms(query));
  if (!queryTerms.size) return 0;
  const directiveTerms = new Set(terms(values.join(' ')));
  let overlap = 0;
  for (const term of queryTerms) {
    if (directiveTerms.has(term)) overlap += 1;
  }
  return overlap / queryTerms.size;
}

@Injectable()
export class ContextRuleService {
  constructor(private readonly models: Models) {}

  async retrieveApplicable(input: {
    userId: string;
    workspaceId: string | null;
    scope: ContextScopeResolution;
    query: string;
  }): Promise<ApplicableContextDirective[]> {
    const [rules, policies] = await Promise.all([
      this.models.copilotContextRule.listRules({
        ownerUserId: input.userId,
        workspaceId: input.workspaceId,
        projectIds: input.scope.projectIds,
      }),
      input.workspaceId
        ? this.models.copilotContextRule.listPolicies({
            workspaceId: input.workspaceId,
          })
        : [],
    ]);
    const directives: ApplicableContextDirective[] = [];

    for (const rule of rules) {
      if (!input.workspaceId && rule.scope !== 'project') continue;
      const revision = rule.revisions.find(
        item => item.revision === rule.activeRevision
      );
      if (!revision) continue;
      const conditions = normalizeConditions(rule.conditions);
      const condition = conditionMatch(conditions, input.scope, input.query);
      if (condition === false) continue;
      const semantic = semanticScore(input.query, [
        rule.name,
        rule.description,
        revision.content,
      ]);
      const manual =
        input.query
          .toLocaleLowerCase()
          .includes(`@rule:${rule.name.toLocaleLowerCase()}`) ||
        input.query.includes(`[[rule:${rule.id}]]`);
      const matchReason =
        rule.applicationMode === 'always'
          ? condition === true
            ? 'condition'
            : 'always'
          : rule.applicationMode === 'manual'
            ? manual
              ? 'manual'
              : null
            : condition === true
              ? 'condition'
              : semantic > 0
                ? 'semantic'
                : null;
      if (!matchReason) continue;
      directives.push({
        id: rule.id,
        revisionId: revision.id,
        sourceType: 'rule',
        scope: rule.scope as ApplicableContextDirective['scope'],
        content: revision.content,
        priority: rule.priority,
        score: 10 + rule.priority / 100 + semantic,
        matchReason,
        updatedAt: rule.updatedAt,
      });
    }

    for (const policy of policies) {
      const revision = policy.revisions.find(
        item => item.revision === policy.activeRevision
      );
      if (!revision) continue;
      const conditions = normalizeConditions(policy.conditions);
      const condition = conditionMatch(conditions, input.scope, input.query);
      if (condition === false) continue;
      const semantic = semanticScore(input.query, [
        policy.name,
        policy.description,
        revision.content,
      ]);
      const matchReason =
        policy.applicationMode === 'always'
          ? condition === true
            ? 'condition'
            : 'always'
          : condition === true
            ? 'condition'
            : semantic > 0
              ? 'semantic'
              : null;
      if (!matchReason) continue;
      directives.push({
        id: policy.id,
        revisionId: revision.id,
        sourceType: 'policy',
        scope: 'workspace',
        content: revision.content,
        priority: policy.priority,
        score: 20 + policy.priority / 100 + semantic,
        matchReason,
        updatedAt: policy.updatedAt,
      });
    }
    return directives.sort(
      (left, right) =>
        right.score - left.score ||
        right.updatedAt.getTime() - left.updatedAt.getTime()
    );
  }

  createRule(input: CopilotContextRuleInput) {
    return this.models.copilotContextRule.createRule(input);
  }

  getRule(id: string) {
    return this.models.copilotContextRule.getRule(id);
  }

  listRules(input: {
    userId: string;
    workspaceId: string;
    projectIds?: string[];
    includeDisabled?: boolean;
  }) {
    return this.models.copilotContextRule.listRules({
      ownerUserId: input.userId,
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      includeDisabled: input.includeDisabled,
    });
  }

  updateRule(
    id: string,
    userId: string,
    input: {
      name?: string;
      description?: string;
      applicationMode?: CopilotContextRuleMode;
      priority?: number;
      conditions?: CopilotContextRuleConditions;
      status?: CopilotContextRuleStatus;
      content?: string;
    }
  ) {
    return this.models.copilotContextRule.updateRule(id, userId, input);
  }

  rollbackRule(id: string, userId: string, revision: number) {
    return this.models.copilotContextRule.rollbackRule({
      id,
      actorUserId: userId,
      revision,
    });
  }

  deleteRule(id: string, userId: string) {
    return this.models.copilotContextRule.deleteRule(id, userId);
  }

  createPolicy(input: CopilotContextPolicyInput) {
    return this.models.copilotContextRule.createPolicy(input);
  }

  getPolicy(id: string) {
    return this.models.copilotContextRule.getPolicy(id);
  }

  listPolicies(workspaceId: string, includeDisabled?: boolean) {
    return this.models.copilotContextRule.listPolicies({
      workspaceId,
      includeDisabled,
    });
  }

  updatePolicy(
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
    }
  ) {
    return this.models.copilotContextRule.updatePolicy(
      id,
      workspaceId,
      actorUserId,
      input
    );
  }

  rollbackPolicy(
    id: string,
    workspaceId: string,
    actorUserId: string,
    revision: number
  ) {
    return this.models.copilotContextRule.rollbackPolicy({
      id,
      workspaceId,
      actorUserId,
      revision,
    });
  }

  deletePolicy(id: string, workspaceId: string) {
    return this.models.copilotContextRule.deletePolicy(id, workspaceId);
  }
}
