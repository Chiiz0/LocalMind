import { projectAiModelQuery } from '@affine/graphql';
import { signal } from '@preact/signals-core';
import { Entity } from '@toeverything/infra';

import type { GraphQLService } from '../../cloud';
import type { AIModel, AIModelSelection } from '../services/models';

export class ProjectAIModel
  extends Entity<{ projectId: string | null }>
  implements AIModelSelection
{
  readonly modelId = signal<string | undefined>(undefined);
  readonly models = signal<AIModel[]>([]);
  private inflight?: Promise<void>;
  private disposed = false;

  constructor(private readonly gql: GraphQLService) {
    super();
    this.refresh();
    const timer = setInterval(this.refresh, 30_000);
    window.addEventListener('focus', this.refresh);
    this.disposables.push(() => {
      this.disposed = true;
      clearInterval(timer);
      window.removeEventListener('focus', this.refresh);
    });
  }

  private readonly refresh = () => {
    if (this.inflight || this.disposed || !this.props.projectId) return;
    this.inflight = this.gql
      .gql({
        query: projectAiModelQuery,
        variables: { projectId: this.props.projectId },
      })
      .then(({ projectAiModel: model }) => {
        if (this.disposed) return;
        this.modelId.value = model.configured
          ? (model.modelId ?? undefined)
          : undefined;
        this.models.value =
          model.configured && model.modelId
            ? [
                {
                  id: model.modelId,
                  name: model.modelId,
                  version: model.modelId,
                  category: model.provider ?? 'Project AI',
                  providerSource: 'byok_project_global',
                  isDefault: true,
                  isPro: false,
                },
              ]
            : [];
      })
      .catch(() => {
        if (this.disposed) return;
        this.modelId.value = undefined;
        this.models.value = [];
      })
      .finally(() => {
        this.inflight = undefined;
      });
  };

  setWorkspaceId = (_workspaceId?: string | null) => {
    this.refresh();
  };
  setPromptName = (_promptName?: string | null) => {
    this.refresh();
  };
  setModel = (_modelId: string) => {
    this.refresh();
  };
}
