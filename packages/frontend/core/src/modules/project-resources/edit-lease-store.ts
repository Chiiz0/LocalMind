import {
  acquireProjectResourceEditLeaseMutation,
  projectAgentTaskQuery,
  type ProjectEditLeaseFieldsFragment,
  type ProjectEditLeaseProofInput,
  projectResourceEditLeaseQuery,
  releaseProjectResourceEditLeaseMutation,
  renewProjectResourceEditLeaseMutation,
} from '@affine/graphql';

import type { GraphQLService } from '../cloud';

// Reloads and duplicated tabs must never inherit another document's authority.
let tabId: string | undefined;
export const projectEditorTabId = () => (tabId ??= crypto.randomUUID());

type Lease = ProjectEditLeaseFieldsFragment;
type State = {
  lease: Lease | null;
  proof: ProjectEditLeaseProofInput | null;
  pending: boolean;
  error: unknown;
  handoff: { taskId: string; submitted: boolean; uncertain?: boolean } | null;
};

/** One serialized lifecycle per resource and GraphQL identity, shared by editors and short writes. */
export class ProjectEditLeaseStore {
  private state: State = {
    lease: null,
    proof: null,
    pending: true,
    error: null,
    handoff: null,
  };
  private readonly listeners = new Set<() => void>();
  private users = 0;
  private suspended = false;
  private failures = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private renewal?: ReturnType<typeof setTimeout>;
  private expiry?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly graphql: Pick<GraphQLService, 'gql'>,
    private readonly input: {
      projectId: string;
      resourceId: string;
      tabId: string;
    }
  ) {}

  readonly snapshot = () => this.state;
  readonly report = (error: unknown) => this.update({ error, pending: false });
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(change: Partial<State>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(error => {
      this.update({ error, pending: false });
    });
    return result;
  }

  private get active() {
    return this.users > 0 && !this.suspended && !this.state.handoff;
  }

  retain() {
    if (++this.users === 1) {
      window.addEventListener('pagehide', this.hide);
      window.addEventListener('pageshow', this.show);
      void (this.state.handoff ? this.refresh() : this.acquire()).catch(() => {
        /* Published through the store. */
      });
    }
    let released = false;
    return () => {
      if (released) return this.tail;
      released = true;
      if (--this.users === 0) {
        window.removeEventListener('pagehide', this.hide);
        window.removeEventListener('pageshow', this.show);
        return this.release();
      }
      return this.tail;
    };
  }

  private readonly hide = () => {
    this.suspended = true;
    this.update({ proof: null });
    void this.release().catch(() => {
      /* A disconnected page expires on the server. */
    });
  };

  private readonly show = () => {
    this.suspended = false;
    void (this.state.handoff ? this.refresh() : this.acquire()).catch(() => {
      /* Published through the store. */
    });
  };

  private accept(lease: Lease | null) {
    clearTimeout(this.expiry);
    const proof =
      this.active &&
      lease?.owned &&
      lease.leaseId &&
      Date.parse(lease.expiresAt) > Date.now()
        ? { tabId: this.input.tabId, leaseId: lease.leaseId }
        : null;
    this.update({ lease, proof, pending: false, error: null });
    if (proof && lease)
      this.expiry = setTimeout(
        () => {
          this.update({
            proof: null,
            error: new Error('Project edit lease expired'),
          });
        },
        Math.max(0, Date.parse(lease.expiresAt) - Date.now())
      );
    this.schedule();
  }

  private schedule() {
    if (!this.active || !this.state.lease?.owned) {
      clearTimeout(this.renewal);
      this.renewal = undefined;
      return;
    }
    // Snapshot refreshes must not postpone the 20 second renewal deadline.
    if (this.renewal) return;
    this.renewal = setTimeout(() => {
      this.renewal = undefined;
      void this.renew().catch(() => {
        /* Published through the store. */
      });
    }, 20000);
  }

  readonly acquire = () => this.enqueue(() => this.acquireCurrent());

  private async acquireCurrent() {
    if (!this.active || this.state.proof) return;
    this.update({ pending: true });
    const result = await this.graphql.gql({
      query: acquireProjectResourceEditLeaseMutation,
      variables: { input: this.input },
    });
    this.failures = 0;
    this.accept(result.acquireProjectResourceEditLease.lease);
  }

  /** Release only this tab's proof, and stay read-only until this exact task settles. */
  readonly handoff = (taskId: string, isClean: () => boolean = () => true) =>
    this.enqueue(async () => {
      if (this.state.handoff) throw new Error('A Project handoff is pending');
      const proof = this.state.proof;
      if (!this.active || !proof) return false;
      if (!isClean()) throw new Error('Project changes remain unsaved');
      this.update({ handoff: { taskId, submitted: false }, proof: null });
      this.schedule();
      clearTimeout(this.expiry);
      try {
        await this.graphql.gql({
          query: releaseProjectResourceEditLeaseMutation,
          variables: { input: { ...this.input, leaseId: proof.leaseId } },
        });
        this.update({ lease: null });
        return true;
      } catch (error) {
        // Approval has not been sent. Recheck authority after an ambiguous release.
        this.update({ handoff: null, lease: null });
        await this.acquireCurrent();
        throw error;
      }
    });

  readonly trackHandoff = async (taskId: string, uncertain = false) => {
    if (this.state.handoff?.taskId !== taskId) return;
    this.update({ handoff: { taskId, submitted: true, uncertain } });
    await this.refresh();
  };

  readonly refresh = () =>
    this.enqueue(async () => {
      if (!this.users || this.suspended) return;
      const handoff = this.state.handoff;
      if (handoff?.submitted) {
        const { projectAgentTask: task } = await this.graphql.gql({
          query: projectAgentTaskQuery,
          variables: { projectId: this.input.projectId, runId: handoff.taskId },
        });
        if (
          task.id !== handoff.taskId ||
          task.projectId !== this.input.projectId
        )
          throw new Error('Project handoff task does not match');
        if (
          ['completed', 'failed', 'cancelled'].includes(task.status) ||
          (task.status === 'waiting_approval' && !handoff.uncertain)
        ) {
          this.update({ handoff: null, lease: null, proof: null });
          await this.acquireCurrent();
          return;
        }
        if (task.status !== 'waiting_approval' && handoff.uncertain)
          this.update({ handoff: { ...handoff, uncertain: false } });
      }
      const result = await this.graphql.gql({
        query: projectResourceEditLeaseQuery,
        variables: { input: this.input },
      });
      const next = result.projectResourceEditLease;
      // A snapshot must not restore a proof after consecutive renewal failures.
      if (next?.owned && this.failures >= 2) {
        this.update({ lease: next });
        return;
      }
      this.accept(next);
    });

  readonly renew = () =>
    this.enqueue(async () => {
      const lease = this.state.lease;
      if (!this.active || !lease?.owned || !lease.leaseId) return;
      try {
        const result = await this.graphql.gql({
          query: renewProjectResourceEditLeaseMutation,
          variables: { input: { ...this.input, leaseId: lease.leaseId } },
        });
        this.failures = 0;
        this.accept(result.renewProjectResourceEditLease.lease);
      } catch (error) {
        this.failures++;
        this.update({ error, ...(this.failures >= 2 ? { proof: null } : {}) });
        throw error;
      } finally {
        this.schedule();
      }
    });

  private release() {
    clearTimeout(this.renewal);
    this.renewal = undefined;
    clearTimeout(this.expiry);
    return this.enqueue(async () => {
      if (this.active) return;
      const lease = this.state.lease;
      this.update({ proof: null, lease: null, pending: false });
      if (lease?.owned && lease.leaseId)
        await this.graphql.gql({
          query: releaseProjectResourceEditLeaseMutation,
          variables: { input: { ...this.input, leaseId: lease.leaseId } },
          context: { keepalive: true },
        });
    });
  }

  async withProof<T>(
    operation: (proof: ProjectEditLeaseProofInput) => Promise<T>
  ) {
    const release = this.retain();
    try {
      await this.acquire();
      const proof = this.state.proof;
      if (!proof) throw new Error('Project edit lease is unavailable');
      return await operation(proof);
    } finally {
      await release();
    }
  }
}

const stores = new WeakMap<object, Map<string, ProjectEditLeaseStore>>();
export function projectEditLeaseStore(
  graphql: Pick<GraphQLService, 'gql'>,
  projectId: string,
  resourceId: string
) {
  let resources = stores.get(graphql);
  if (!resources) stores.set(graphql, (resources = new Map()));
  const key = JSON.stringify([projectId, resourceId]);
  let store = resources.get(key);
  if (!store) {
    store = new ProjectEditLeaseStore(graphql, {
      projectId,
      resourceId,
      tabId: projectEditorTabId(),
    });
    resources.set(key, store);
  }
  return store;
}
