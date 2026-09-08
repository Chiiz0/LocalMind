import { Injectable } from '@nestjs/common';

import { PermissionService } from '../../core/permission';
import { type CopilotContextDocumentRef, Models } from '../../models';

export type ContextProjectResolution =
  | 'none'
  | 'single'
  | 'mixed'
  | 'ambiguous'
  | 'selected'
  | 'invalid_selection';

export type ContextScopeResolution = {
  userId: string;
  workspaceId: string | null;
  sessionId: string;
  primaryDocId: string | null;
  readableDocIds: string[];
  readableDocumentRefs: CopilotContextDocumentRef[];
  readableProjectResourceIds?: string[];
  candidateProjectIds: string[];
  projectIds: string[];
  selectedProjectId: string | null;
  projectResolution: ContextProjectResolution;
};

@Injectable()
export class ContextScopeResolver {
  constructor(
    private readonly models: Models,
    private readonly permission: PermissionService
  ) {}

  async resolve(input: {
    userId: string;
    workspaceId: string | null;
    sessionId: string;
    primaryDocId?: string | null;
    selectedProjectId?: string | null;
  }): Promise<ContextScopeResolution> {
    const sources = await this.models.copilotContext.getSessionSources(
      input.sessionId
    );
    const base: ContextScopeResolution = {
      userId: input.userId,
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      primaryDocId: null,
      readableDocIds: [],
      readableDocumentRefs: [],
      readableProjectResourceIds: [],
      candidateProjectIds: [],
      projectIds: [],
      selectedProjectId: null,
      projectResolution: input.selectedProjectId ? 'invalid_selection' : 'none',
    };
    if (!input.workspaceId) {
      const project = input.selectedProjectId
        ? await this.models.copilotContextMemory.getProject(
            input.selectedProjectId
          )
        : null;
      if (
        !project ||
        project.status !== 'active' ||
        input.primaryDocId ||
        !project.members.some(member => member.userId === input.userId)
      )
        return base;
      const scope = {
        projectId: project.id,
        actorId: input.userId,
        sessionId: input.sessionId,
      };
      const context = await this.models.copilotProjectContext.get(scope);
      const resourceIds: string[] = [];
      for (const item of context.items) {
        await this.models.copilotProjectContext.describe(scope, item);
        if (item.kind === 'resource') resourceIds.push(item.resourceId);
      }
      return {
        ...base,
        readableProjectResourceIds: resourceIds,
        candidateProjectIds: [project.id],
        projectIds:
          sources.valid && !sources.hasPrivateAttachments ? [project.id] : [],
        selectedProjectId: project.id,
        projectResolution: 'selected',
      };
    }

    // Workspace document identity no longer implies Project membership or scope.
    const candidates = [
      ...new Set(
        [input.primaryDocId, ...sources.docIds].filter((id): id is string =>
          Boolean(id)
        )
      ),
    ];
    const readable = await this.permission.filterReadableDocs({
      userId: input.userId,
      workspaceId: input.workspaceId,
      docs: candidates.map(docId => ({ docId })),
      allowLocal: true,
      projectId: null,
    });
    const readableDocIds = readable.map(document => document.docId);
    return {
      ...base,
      primaryDocId:
        input.primaryDocId && readableDocIds.includes(input.primaryDocId)
          ? input.primaryDocId
          : null,
      readableDocIds,
      readableDocumentRefs: readableDocIds.map(docId => ({
        workspaceId: input.workspaceId as string,
        docId,
      })),
    };
  }
}
