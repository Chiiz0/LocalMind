import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { JOB_SIGNAL, JobQueue, OneDay, OnJob } from '../../base';
import { Models } from '../../models';
import { ExternalMcpConnectionService } from './external-mcp/service';
import { CopilotTranscriptionService } from './transcript';

const CLEANUP_EMBEDDING_JOB_BATCH_SIZE = 100;
const CLEANUP_SUPPORT_BUNDLE_RETENTION_JOB_BATCH_SIZE = 50;
const CLEANUP_SUPPORT_BUNDLE_DOWNLOAD_AUTHORIZATION_JOB_BATCH_SIZE = 50;
const PROCESS_SUPPORT_BUNDLE_TRANSFER_FORWARDING_JOB_BATCH_SIZE = 50;
const RECOVER_AGENT_RUNTIME_LEASE_JOB_BATCH_SIZE = 50;
const ENQUEUE_QUEUED_AGENT_RUNTIME_JOB_BATCH_SIZE = 50;
const RECOVER_REPAIR_EXECUTION_LEASE_JOB_BATCH_SIZE = 50;
const ENQUEUE_QUEUED_REPAIR_EXECUTION_JOB_BATCH_SIZE = 50;
const ENQUEUE_PROVIDER_HEALTH_PROBE_JOB_BATCH_SIZE = 100;
const PROCESS_PROVIDER_HEALTH_PROBE_JOB_BATCH_SIZE = 50;
const PROCESS_EXTERNAL_MCP_REMOTE_OPERATION_JOB_BATCH_SIZE = 25;
const BACKFILL_EMBEDDING_DIMENSION_JOB_BATCH_SIZE = 64;

declare global {
  interface Jobs {
    'copilot.session.cleanupEmptySessions': {};
    'copilot.session.generateMissingTitles': {};
    'copilot.workspace.cleanupTrashedDocEmbeddings': {
      nextSid?: number;
    };
    'copilot.supportBundle.cleanupRetention': {
      limit?: number;
    };
    'copilot.supportBundle.cleanupDownloadAuthorizations': {
      limit?: number;
    };
    'copilot.supportBundle.processTransferForwardingEvents': {
      limit?: number;
    };
    'copilot.repairExecution.recoverExpiredLeases': {
      limit?: number;
    };
    'copilot.repairExecution.enqueueQueued': {
      limit?: number;
    };
    'copilot.agentRuntime.recoverExpiredLeases': {
      limit?: number;
    };
    'copilot.agentRuntime.enqueueQueued': {
      limit?: number;
    };
    'copilot.providerHealth.persistConfiguredSnapshots': {};
    'copilot.providerHealth.enqueueWorkspaceProbeAttempts': {
      limit?: number;
    };
    'copilot.providerHealth.processProbeAttempts': {
      limit?: number;
      attemptId?: string;
    };
    'copilot.externalMcp.processPendingOperations': {
      limit?: number;
    };
  }
}

@Injectable()
export class CopilotCronJobs {
  private readonly logger = new Logger(CopilotCronJobs.name);

  constructor(
    private readonly models: Models,
    private readonly jobs: JobQueue,
    private readonly transcript: CopilotTranscriptionService,
    private readonly externalMcp: ExternalMcpConnectionService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileTranscriptDispatches() {
    await this.transcript.reconcileDispatches();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleEmbeddingDimensionBackfill() {
    await this.jobs.add(
      'copilot.embedding.backfillDimensions',
      { limit: BACKFILL_EMBEDDING_DIMENSION_JOB_BATCH_SIZE },
      { jobId: 'minute-copilot-embedding-dimension-backfill' }
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyCleanupJob() {
    await this.jobs.add(
      'copilot.session.cleanupEmptySessions',
      {},
      { jobId: 'daily-copilot-cleanup-empty-sessions' }
    );

    await this.jobs.add(
      'copilot.session.generateMissingTitles',
      {},
      { jobId: 'daily-copilot-generate-missing-titles' }
    );

    await this.jobs.add(
      'copilot.workspace.cleanupTrashedDocEmbeddings',
      {},
      { jobId: 'daily-copilot-cleanup-trashed-doc-embeddings' }
    );

    await this.jobs.add(
      'copilot.supportBundle.cleanupRetention',
      {
        limit: CLEANUP_SUPPORT_BUNDLE_RETENTION_JOB_BATCH_SIZE,
      },
      { jobId: 'daily-copilot-support-bundle-retention-cleanup' }
    );

    await this.jobs.add(
      'copilot.supportBundle.cleanupDownloadAuthorizations',
      {
        limit: CLEANUP_SUPPORT_BUNDLE_DOWNLOAD_AUTHORIZATION_JOB_BATCH_SIZE,
      },
      {
        jobId: 'daily-copilot-support-bundle-download-authorization-cleanup',
      }
    );

    await this.jobs.add(
      'copilot.supportBundle.processTransferForwardingEvents',
      {
        limit: PROCESS_SUPPORT_BUNDLE_TRANSFER_FORWARDING_JOB_BATCH_SIZE,
      },
      {
        jobId: 'daily-copilot-support-bundle-transfer-forwarding-events',
      }
    );

    await this.jobs.add(
      'copilot.providerHealth.persistConfiguredSnapshots',
      {},
      { jobId: 'daily-copilot-provider-health-snapshot-persistence' }
    );

    await this.jobs.add(
      'copilot.providerHealth.enqueueWorkspaceProbeAttempts',
      {
        limit: ENQUEUE_PROVIDER_HEALTH_PROBE_JOB_BATCH_SIZE,
      },
      { jobId: 'daily-copilot-provider-health-probe-enqueue' }
    );

    await this.jobs.add(
      'copilot.providerHealth.processProbeAttempts',
      {
        limit: PROCESS_PROVIDER_HEALTH_PROBE_JOB_BATCH_SIZE,
      },
      { jobId: 'daily-copilot-provider-health-probe-process' }
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleAgentRuntimeRuns() {
    await this.jobs.add(
      'copilot.supportBundle.processTransferForwardingEvents',
      {
        limit: PROCESS_SUPPORT_BUNDLE_TRANSFER_FORWARDING_JOB_BATCH_SIZE,
      },
      {
        jobId: 'minute-copilot-support-bundle-transfer-forwarding-events',
      }
    );
    await this.jobs.add(
      'copilot.agentRuntime.recoverExpiredLeases',
      {
        limit: RECOVER_AGENT_RUNTIME_LEASE_JOB_BATCH_SIZE,
      },
      { jobId: 'minute-copilot-agent-runtime-recover-expired-leases' }
    );
    await this.jobs.add(
      'copilot.agentRuntime.enqueueQueued',
      {
        limit: ENQUEUE_QUEUED_AGENT_RUNTIME_JOB_BATCH_SIZE,
      },
      { jobId: 'minute-copilot-agent-runtime-enqueue-queued' }
    );
    await this.jobs.add('copilot.agentRuntime.run', {});
    await this.jobs.add(
      'copilot.mcpDelegation.deliverCallback',
      {},
      { jobId: 'minute-copilot-mcp-delegation-deliver-callback' }
    );
    await this.jobs.add(
      'copilot.repairExecution.recoverExpiredLeases',
      {
        limit: RECOVER_REPAIR_EXECUTION_LEASE_JOB_BATCH_SIZE,
      },
      { jobId: 'minute-copilot-repair-execution-recover-expired-leases' }
    );
    await this.jobs.add(
      'copilot.repairExecution.enqueueQueued',
      {
        limit: ENQUEUE_QUEUED_REPAIR_EXECUTION_JOB_BATCH_SIZE,
      },
      { jobId: 'minute-copilot-repair-execution-enqueue-queued' }
    );

    await this.jobs.add(
      'copilot.providerHealth.processProbeAttempts',
      {
        limit: PROCESS_PROVIDER_HEALTH_PROBE_JOB_BATCH_SIZE,
      },
      { jobId: 'minute-copilot-provider-health-probe-process' }
    );
    await this.jobs.add(
      'copilot.externalMcp.processPendingOperations',
      {
        limit: PROCESS_EXTERNAL_MCP_REMOTE_OPERATION_JOB_BATCH_SIZE,
      },
      { jobId: 'minute-copilot-external-mcp-process-pending-operations' }
    );
  }

  @OnJob('copilot.externalMcp.processPendingOperations')
  async processExternalMcpPendingOperations(
    params: Jobs['copilot.externalMcp.processPendingOperations']
  ) {
    const limit = Math.min(
      Math.max(
        params.limit ?? PROCESS_EXTERNAL_MCP_REMOTE_OPERATION_JOB_BATCH_SIZE,
        1
      ),
      100
    );
    const result = await this.externalMcp.processPendingOperations({ limit });
    this.logger.log(
      `Processed ${result.processedCount} SparkClaw remote operations: completed ${result.completedCount}, rescheduled ${result.rescheduledCount}, failed ${result.failedCount}, and cancelled ${result.cancelledCount}`
    );
    return result.processedCount >= limit ? JOB_SIGNAL.Repeat : JOB_SIGNAL.Done;
  }

  async triggerGenerateMissingTitles() {
    await this.jobs.add(
      'copilot.session.generateMissingTitles',
      {},
      { jobId: 'trigger-copilot-generate-missing-titles' }
    );
  }

  @OnJob('copilot.session.cleanupEmptySessions')
  async cleanupEmptySessions() {
    const { removed, cleaned } =
      await this.models.copilotSession.cleanupEmptySessions(
        new Date(Date.now() - OneDay)
      );

    this.logger.log(
      `Cleanup completed: ${removed} sessions deleted, ${cleaned} sessions marked as deleted`
    );
  }

  @OnJob('copilot.session.generateMissingTitles')
  async generateMissingTitles() {
    const sessions = await this.models.copilotSession.toBeGenerateTitle();

    for (const session of sessions) {
      await this.jobs.add('copilot.session.generateTitle', {
        sessionId: session.id,
      });
    }
    this.logger.log(
      `Scheduled title generation for ${sessions.length} sessions`
    );
  }

  @OnJob('copilot.workspace.cleanupTrashedDocEmbeddings')
  async cleanupTrashedDocEmbeddings(
    params: Jobs['copilot.workspace.cleanupTrashedDocEmbeddings']
  ) {
    const nextSid = params.nextSid ?? 0;
    // only consider workspaces that cleared their embeddings more than 24 hours ago
    const oneDayAgo = new Date(Date.now() - OneDay);
    const workspaces = await this.models.workspace.list(
      { sid: { gt: nextSid }, lastCheckEmbeddings: { lt: oneDayAgo } },
      { id: true, sid: true },
      CLEANUP_EMBEDDING_JOB_BATCH_SIZE
    );
    if (!workspaces.length) {
      return JOB_SIGNAL.Done;
    }
    for (const { id: workspaceId } of workspaces) {
      await this.jobs.add(
        'copilot.embedding.cleanupTrashedDocEmbeddings',
        { workspaceId },
        { jobId: `cleanup-trashed-doc-embeddings-${workspaceId}` }
      );
    }
    params.nextSid = workspaces[workspaces.length - 1].sid;
    return JOB_SIGNAL.Repeat;
  }

  @OnJob('copilot.supportBundle.cleanupRetention')
  async cleanupSupportBundleRetention(
    params: Jobs['copilot.supportBundle.cleanupRetention']
  ) {
    const limit = Math.min(
      Math.max(
        params.limit ?? CLEANUP_SUPPORT_BUNDLE_RETENTION_JOB_BATCH_SIZE,
        1
      ),
      100
    );
    const cleanup =
      await this.models.copilotSupportBundle.cleanupScheduledRetention({
        limit,
      });

    this.logger.log(
      `Support bundle retention cleanup expired ${cleanup.expiredBundleCount} bundles, expired ${cleanup.expiredAuthorizationCount} authorizations, retried ${cleanup.archiveObjectCleanupRetryCount} archive object cleanups, recovered ${cleanup.archiveObjectCleanupRecoveredCount}, and left ${cleanup.archiveObjectCleanupFailedCount} failed; retried ${cleanup.manifestObjectRewriteRetryCount} manifest object rewrites, recovered ${cleanup.manifestObjectRewriteRecoveredCount}, and left ${cleanup.manifestObjectRewriteFailedCount} failed`
    );

    const progressedCleanupCount =
      cleanup.expiredBundleCount +
      cleanup.archiveObjectCleanupRecoveredCount +
      cleanup.manifestObjectRewriteRecoveredCount;
    return progressedCleanupCount >= limit &&
      cleanup.archiveObjectCleanupFailedCount === 0 &&
      cleanup.manifestObjectRewriteFailedCount === 0
      ? JOB_SIGNAL.Repeat
      : JOB_SIGNAL.Done;
  }

  @OnJob('copilot.supportBundle.cleanupDownloadAuthorizations')
  async cleanupSupportBundleDownloadAuthorizations(
    params: Jobs['copilot.supportBundle.cleanupDownloadAuthorizations']
  ) {
    const limit = Math.min(
      Math.max(
        params.limit ??
          CLEANUP_SUPPORT_BUNDLE_DOWNLOAD_AUTHORIZATION_JOB_BATCH_SIZE,
        1
      ),
      100
    );
    const cleanup =
      await this.models.copilotSupportBundle.expireDueDownloadAuthorizations({
        limit,
      });

    this.logger.log(
      `Expired ${cleanup.expiredAuthorizationCount} support bundle download authorizations`
    );

    return cleanup.expiredAuthorizationCount >= limit
      ? JOB_SIGNAL.Repeat
      : JOB_SIGNAL.Done;
  }

  @OnJob('copilot.supportBundle.processTransferForwardingEvents')
  async processSupportBundleTransferForwardingEvents(
    params: Jobs['copilot.supportBundle.processTransferForwardingEvents']
  ) {
    const limit = Math.min(
      Math.max(
        params.limit ??
          PROCESS_SUPPORT_BUNDLE_TRANSFER_FORWARDING_JOB_BATCH_SIZE,
        1
      ),
      100
    );
    const processing =
      await this.models.copilotSupportBundle.processDueDirectDownloadTransferForwardingEvents(
        {
          limit,
        }
      );

    this.logger.log(
      `Processed ${processing.processedCount} support bundle transfer forwarding events, forwarded ${processing.forwardedCount}, scheduled ${processing.retryScheduledCount} retries, dead-lettered ${processing.deadLetteredCount}, and failed ${processing.failedCount}`
    );

    return processing.processedCount >= limit
      ? JOB_SIGNAL.Repeat
      : JOB_SIGNAL.Done;
  }

  @OnJob('copilot.repairExecution.recoverExpiredLeases')
  async recoverExpiredRepairExecutionLeases(
    params: Jobs['copilot.repairExecution.recoverExpiredLeases']
  ) {
    const limit = Math.min(
      Math.max(
        params.limit ?? RECOVER_REPAIR_EXECUTION_LEASE_JOB_BATCH_SIZE,
        1
      ),
      100
    );
    const expired =
      await this.models.copilotRepairExecution.listExpiredRunningWorkerLeases({
        limit,
      });
    if (!expired.length) {
      return JOB_SIGNAL.Done;
    }

    let recoveredCount = 0;
    let requeuedCount = 0;
    let failedCount = 0;
    for (const stale of expired) {
      try {
        const record =
          await this.models.copilotRepairExecution.recoverExpiredWorkerLease({
            workspaceId: stale.workspaceId,
            id: stale.id,
          });
        recoveredCount += 1;
        await this.models.copilotAgentRuntime?.syncRepairExecution({
          record,
        });
        if (record.status === 'queued') {
          requeuedCount += 1;
          await this.jobs.add(
            'copilot.repairExecution.run',
            {
              workspaceId: record.workspaceId,
              executionRequestId: record.id,
            },
            {
              jobId: `copilot-repair-execution-run-${record.id}-recover-expired-${record.workerAttempt}-${record.workerMaxAttempts}`,
            }
          );
        } else if (record.status === 'failed') {
          failedCount += 1;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to recover expired repair execution lease ${stale.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `Recovered ${recoveredCount} expired repair execution leases, requeued ${requeuedCount}, failed ${failedCount}`
    );

    return recoveredCount >= limit ? JOB_SIGNAL.Repeat : JOB_SIGNAL.Done;
  }

  @OnJob('copilot.repairExecution.enqueueQueued')
  async enqueueQueuedRepairExecutions(
    params: Jobs['copilot.repairExecution.enqueueQueued']
  ) {
    const limit = Math.min(
      Math.max(
        params.limit ?? ENQUEUE_QUEUED_REPAIR_EXECUTION_JOB_BATCH_SIZE,
        1
      ),
      100
    );
    const queued =
      await this.models.copilotRepairExecution.listQueuedExecutableRequests({
        limit,
      });
    if (!queued.length) {
      return JOB_SIGNAL.Done;
    }

    for (const record of queued) {
      await this.jobs.add(
        'copilot.repairExecution.run',
        {
          workspaceId: record.workspaceId,
          executionRequestId: record.id,
        },
        {
          jobId: `copilot-repair-execution-run-${record.id}-queued-${record.workerAttempt}-${record.workerMaxAttempts}`,
        }
      );
    }

    this.logger.log(
      `Enqueued ${queued.length} queued repair execution requests`
    );

    return queued.length >= limit ? JOB_SIGNAL.Repeat : JOB_SIGNAL.Done;
  }

  @OnJob('copilot.agentRuntime.enqueueQueued')
  async enqueueQueuedAgentRuntimeRuns(
    params: Jobs['copilot.agentRuntime.enqueueQueued']
  ) {
    const expired =
      await this.models.copilotDocumentOperation.expireLocations();
    const recovered =
      await this.models.copilotMcpDelegation.recoverConfirmedLocations(50);
    const moreLocations = expired.count >= 50 || recovered >= 50;
    const limit = Math.min(
      Math.max(params.limit ?? ENQUEUE_QUEUED_AGENT_RUNTIME_JOB_BATCH_SIZE, 1),
      100
    );
    const queued =
      await this.models.copilotAgentRuntime.listQueuedStandaloneRuns({
        limit,
      });
    if (!queued.length) {
      return moreLocations ? JOB_SIGNAL.Repeat : JOB_SIGNAL.Done;
    }

    for (const run of queued) {
      await this.jobs.add(
        'copilot.agentRuntime.run',
        {
          workspaceId: run.workspaceId,
          runId: run.id,
        },
        {
          jobId: `copilot-agent-runtime-run-${run.id}-queued-${run.workerAttempt}-${run.workerMaxAttempts}`,
        }
      );
    }

    this.logger.log(
      `Enqueued ${queued.length} queued standalone Agent Runtime runs`
    );

    return queued.length >= limit || moreLocations
      ? JOB_SIGNAL.Repeat
      : JOB_SIGNAL.Done;
  }

  @OnJob('copilot.agentRuntime.recoverExpiredLeases')
  async recoverExpiredAgentRuntimeLeases(
    params: Jobs['copilot.agentRuntime.recoverExpiredLeases']
  ) {
    const limit = Math.min(
      Math.max(params.limit ?? RECOVER_AGENT_RUNTIME_LEASE_JOB_BATCH_SIZE, 1),
      100
    );
    const expired =
      await this.models.copilotAgentRuntime.listExpiredStandaloneWorkerLeases({
        limit,
      });
    if (!expired.length) {
      return JOB_SIGNAL.Done;
    }

    let recoveredCount = 0;
    let requeuedCount = 0;
    let failedCount = 0;
    for (const stale of expired) {
      try {
        const run =
          await this.models.copilotAgentRuntime.recoverExpiredStandaloneWorkerLease(
            {
              workspaceId: stale.workspaceId,
              id: stale.id,
            }
          );
        recoveredCount += 1;
        if (run.status === 'queued') {
          requeuedCount += 1;
          await this.jobs.add(
            'copilot.agentRuntime.run',
            {
              workspaceId: run.workspaceId,
              runId: run.id,
            },
            {
              jobId: `copilot-agent-runtime-run-${run.id}-recover-expired-${run.workerAttempt}-${run.workerMaxAttempts}`,
            }
          );
        } else if (run.status === 'failed') {
          failedCount += 1;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to recover expired Agent Runtime lease ${stale.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `Recovered ${recoveredCount} expired Agent Runtime leases, requeued ${requeuedCount}, failed ${failedCount}`
    );

    return recoveredCount >= limit ? JOB_SIGNAL.Repeat : JOB_SIGNAL.Done;
  }
}
