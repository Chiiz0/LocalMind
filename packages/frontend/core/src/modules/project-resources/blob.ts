import type { FetchService, GraphQLService } from '@affine/core/modules/cloud';
import { uploadProjectBlobMutation } from '@affine/graphql';
import { NoopLogger } from '@blocksuite/affine/global/utils';
import { BlobEngine, type BlobSource } from '@blocksuite/affine/sync';

class ProjectBlobSource implements BlobSource {
  readonly name = 'project';
  readonly readonly = false;
  private readonly pending = new Map<string, Blob>();

  constructor(
    private readonly projectId: string,
    private readonly graphql: GraphQLService,
    private readonly fetcher: FetchService
  ) {}

  async get(key: string) {
    const pending = this.pending.get(key);
    if (pending) return pending;
    const result = await this.fetcher.fetch(
      `/api/projects/${encodeURIComponent(this.projectId)}/blobs/${encodeURIComponent(key)}`,
      { credentials: 'include' }
    );
    return result.blob();
  }

  async set(_key: string, value: Blob) {
    const result = await this.graphql.gql({
      query: uploadProjectBlobMutation,
      variables: {
        projectId: this.projectId,
        file: new File([value], 'attachment', { type: value.type }),
      },
    });
    this.pending.set(result.uploadProjectBlob, value);
    return result.uploadProjectBlob;
  }

  async delete() {
    throw new Error('Project revision attachments are immutable');
  }
  async list() {
    return [...this.pending.keys()];
  }
  clearPending() {
    this.pending.clear();
  }
}

export class ProjectBlobEngine extends BlobEngine {
  constructor(
    projectId: string,
    graphql: GraphQLService,
    fetcher: FetchService
  ) {
    super(
      new ProjectBlobSource(projectId, graphql, fetcher),
      [],
      new NoopLogger()
    );
  }

  override async set(value: Blob): Promise<string>;
  override async set(key: string, value: Blob): Promise<string>;
  override async set(valueOrKey: string | Blob, value?: Blob) {
    const blob = typeof valueOrKey === 'string' ? value : valueOrKey;
    if (!blob) throw new Error('Project attachment is empty');
    return this.main.set('', blob);
  }

  clearPending() {
    (this.main as ProjectBlobSource).clearPending();
  }
}
