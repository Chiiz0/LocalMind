import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { CopilotFailedToGenerateEmbedding } from '../../../base/error/errors.gen';
import {
  ChunkSimilarity,
  Embedding,
  EMBEDDING_DIMENSIONS,
} from '../../../models';
import { type CopilotRerankRequest } from '../providers/types';
import { CapabilityRuntime } from '../runtime/capability-runtime';
import { TaskPolicy } from '../runtime/task-policy';
import {
  type EmbeddingCallOptionsInput,
  EmbeddingClient,
  normalizeEmbeddingCallOptions,
  type ReRankResult,
} from './types';

class ProductionEmbeddingClient extends EmbeddingClient {
  private readonly logger = new Logger(ProductionEmbeddingClient.name);

  constructor(
    private readonly taskPolicy: TaskPolicy,
    private readonly runtime: CapabilityRuntime
  ) {
    super();
  }

  override async configured(): Promise<boolean> {
    const embeddingDiagnostics = await this.runtime.describeEmbeddingRoute(
      await this.taskPolicy.resolveEffectiveWorkspaceIndexingModelId(),
      {
        dimensions: EMBEDDING_DIMENSIONS,
        featureKind: 'workspace_indexing',
      }
    );
    if (!embeddingDiagnostics.configured) {
      this.logger.warn(
        'Copilot embedding client is not configured properly, please check your configuration.'
      );
    }
    if (embeddingDiagnostics.dimensionMismatch) {
      this.logger.warn(
        `Copilot embedding route ${embeddingDiagnostics.providerId ?? 'auto'}/${
          embeddingDiagnostics.modelId ?? 'auto'
        } declares ${embeddingDiagnostics.modelEmbeddingDimensions} dimensions, ` +
          `but workspace indexes require ${EMBEDDING_DIMENSIONS}. ` +
          'The request will ask for the workspace dimension; rebuild indexes ' +
          'or choose a compatible embedding model if the provider cannot honor it.'
      );
    }

    const rerankDiagnostics = await this.runtime.describeRerankRoute(
      await this.taskPolicy.resolveEffectiveRerankModelId(),
      {
        featureKind: 'rerank',
      }
    );
    if (!rerankDiagnostics.configured) {
      this.logger.warn(
        'Copilot rerank route is not configured; workspace search will fall back to vector distance sorting.'
      );
    } else {
      this.logger.verbose(
        `Copilot rerank route configured: ${
          rerankDiagnostics.providerId ?? 'auto'
        }/${rerankDiagnostics.modelId ?? 'auto'}`
      );
    }

    return embeddingDiagnostics.configured;
  }

  private validateEmbeddingDimensions(
    modelId: string | undefined,
    embeddings: number[][]
  ) {
    const invalid = embeddings.find(
      embedding => embedding.length !== EMBEDDING_DIMENSIONS
    );
    if (!invalid) {
      return;
    }

    const provider = modelId ?? 'auto';
    const message =
      `Expected ${EMBEDDING_DIMENSIONS} embedding dimensions, ` +
      `got ${invalid.length}. Current workspace vector indexes require ` +
      `${EMBEDDING_DIMENSIONS} dimensions; update the configured embedding ` +
      'model or rebuild indexes before using this route.';
    this.logger.error(
      `Copilot embedding model ${provider} returned incompatible vector dimensions. ${message}`
    );
    throw new CopilotFailedToGenerateEmbedding({
      provider,
      message,
    });
  }

  async getEmbeddings(
    input: string[],
    options?: EmbeddingCallOptionsInput
  ): Promise<Embedding[]> {
    const normalizedOptions = normalizeEmbeddingCallOptions(options);
    const featureKind = normalizedOptions.featureKind ?? 'embedding';
    const modelId =
      featureKind === 'workspace_indexing'
        ? await this.taskPolicy.resolveEffectiveWorkspaceIndexingModelId(
            normalizedOptions.workspaceId
          )
        : await this.taskPolicy.resolveEffectiveEmbeddingModelId(
            normalizedOptions.workspaceId
          );
    const embeddings = await this.runtime.embed(modelId, input, {
      dimensions: EMBEDDING_DIMENSIONS,
      signal: normalizedOptions.signal,
      user: normalizedOptions.userId,
      session: normalizedOptions.sessionId,
      workspace: normalizedOptions.workspaceId,
      byokLeaseId: normalizedOptions.byokLeaseId,
      featureKind,
    });
    if (embeddings.length !== input.length) {
      throw new CopilotFailedToGenerateEmbedding({
        provider: modelId ?? 'auto',
        message: `Expected ${input.length} embeddings, got ${embeddings.length}`,
      });
    }
    this.validateEmbeddingDimensions(modelId, embeddings);

    return Array.from(embeddings.entries()).map(([index, embedding]) => ({
      index,
      embedding,
      content: input[index],
    }));
  }

  private getTargetId<T extends ChunkSimilarity>(embedding: T) {
    return 'docId' in embedding && typeof embedding.docId === 'string'
      ? embedding.docId
      : 'fileId' in embedding && typeof embedding.fileId === 'string'
        ? embedding.fileId
        : '';
  }

  private async getEmbeddingRelevance<
    Chunk extends ChunkSimilarity = ChunkSimilarity,
  >(
    query: string,
    embeddings: Chunk[],
    options?: EmbeddingCallOptionsInput
  ): Promise<ReRankResult> {
    const normalizedOptions = normalizeEmbeddingCallOptions(options);
    if (!embeddings.length) return [];

    const rerankRequest: CopilotRerankRequest = {
      query,
      candidates: embeddings.map((embedding, index) => ({
        id: String(index),
        text: embedding.content,
      })),
    };

    const ranks = await this.runtime.rerank(
      await this.taskPolicy.resolveEffectiveRerankModelId(
        normalizedOptions.workspaceId
      ),
      rerankRequest,
      {
        signal: normalizedOptions.signal,
        user: normalizedOptions.userId,
        session: normalizedOptions.sessionId,
        workspace: normalizedOptions.workspaceId,
        byokLeaseId: normalizedOptions.byokLeaseId,
        featureKind: 'rerank',
      }
    );

    try {
      return ranks.map((score, i) => {
        const chunk = embeddings[i];
        return {
          chunk: chunk.chunk,
          targetId: this.getTargetId(chunk),
          score: Math.max(score, 1 - (chunk.distance || -Infinity)),
        };
      });
    } catch (error) {
      this.logger.error('Failed to parse rerank results', error);
      // silent error, will fallback to default sorting in parent method
      return [];
    }
  }

  override async reRank<Chunk extends ChunkSimilarity = ChunkSimilarity>(
    query: string,
    embeddings: Chunk[],
    topK: number,
    options?: EmbeddingCallOptionsInput
  ): Promise<Chunk[]> {
    const normalizedOptions = normalizeEmbeddingCallOptions(options);
    // search in context and workspace may find same chunks, de-duplicate them
    const { deduped: dedupedEmbeddings } = embeddings.reduce(
      (acc, e) => {
        const key = `${this.getTargetId(e)}:${e.chunk}`;
        if (!acc.seen.has(key)) {
          acc.seen.add(key);
          acc.deduped.push(e);
        }
        return acc;
      },
      { deduped: [] as Chunk[], seen: new Set<string>() }
    );
    const sortedEmbeddings = dedupedEmbeddings.toSorted(
      (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
    );

    const chunks = sortedEmbeddings.reduce(
      (acc, e) => {
        const targetId = this.getTargetId(e);
        const key = `${targetId}:${e.chunk}`;
        acc[key] = e;
        return acc;
      },
      {} as Record<string, Chunk>
    );

    try {
      // The rerank prompt is expected to handle the full deduped candidate list.
      const ranks = await this.getEmbeddingRelevance(
        query,
        sortedEmbeddings,
        normalizedOptions
      );
      if (sortedEmbeddings.length !== ranks.length) {
        // llm return wrong result, fallback to default sorting
        this.logger.warn(
          `Batch size mismatch: expected ${sortedEmbeddings.length}, got ${ranks.length}`
        );
        return await super.reRank(
          query,
          dedupedEmbeddings,
          topK,
          normalizedOptions
        );
      }

      const highConfidenceChunks = ranks
        .flat()
        .toSorted((a, b) => b.score - a.score)
        .filter(r => r.score > 0.5)
        .map(r => chunks[`${r.targetId}:${r.chunk}`])
        .filter(Boolean);

      this.logger.verbose(
        `ReRank completed: ${highConfidenceChunks.length} high-confidence results found, total ${sortedEmbeddings.length} embeddings`,
        highConfidenceChunks.length !== sortedEmbeddings.length
          ? JSON.stringify(ranks)
          : undefined
      );
      return highConfidenceChunks.slice(0, topK);
    } catch (error) {
      this.logger.warn('ReRank failed, falling back to default sorting', error);
      return await super.reRank(
        query,
        dedupedEmbeddings,
        topK,
        normalizedOptions
      );
    }
  }
}

@Injectable()
export class CopilotEmbeddingClientService {
  private client: EmbeddingClient | undefined;

  constructor(
    private readonly taskPolicy: TaskPolicy,
    private readonly runtime: CapabilityRuntime
  ) {}

  async refresh() {
    const client = new ProductionEmbeddingClient(this.taskPolicy, this.runtime);
    await client.configured();
    this.client = client;
    return this.client;
  }

  getClient() {
    return this.client;
  }
}

export class MockEmbeddingClient extends EmbeddingClient {
  private embed(content: string) {
    const seed = createHash('sha256').update(content).digest();
    return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => {
      const byte = seed[index % seed.length];
      return byte / 255;
    });
  }

  async getEmbeddings(input: string[]): Promise<Embedding[]> {
    return input.map((content, i) => ({
      index: i,
      content,
      embedding: this.embed(content),
    }));
  }
}
