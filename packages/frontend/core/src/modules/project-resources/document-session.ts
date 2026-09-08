import { UserFriendlyError } from '@affine/error';
import { I18n } from '@affine/i18n';
import { openDB } from 'idb';
import { applyUpdate, type Doc, encodeStateAsUpdate } from 'yjs';

function contentConflict() {
  return new UserFriendlyError({
    status: 409,
    code: 'Conflict',
    type: 'BAD_REQUEST',
    name: 'BAD_REQUEST',
    get message() {
      return I18n[
        'com.affine.ui.project-content-changed-compare-or-discard-the-local-draft'
      ]();
    },
  });
}

type SaveRequest = {
  expectedContentVersion: number;
  requestKey: string;
  snapshotBase64: string;
};
type Draft = {
  savedAt?: number;
  version: number;
  bytes: Uint8Array;
  pending: SaveRequest | null;
  changeCounter: number;
  savedCounter: number;
  pendingCounter: number;
};
export type ProjectRecoverableDraft = {
  cacheKey: string[];
  version: number;
  savedAt: number | null;
};
export type ProjectDocumentState = {
  phase: 'loading' | 'saved' | 'unsaved' | 'saving' | 'error';
  version: number;
  error: UserFriendlyError | null;
};
type DocumentSessionOptions = {
  doc: Doc;
  cacheKey: string[];
  recoverFrom?: string[];
  onRecoverableDrafts?: (drafts: ProjectRecoverableDraft[]) => void;
  read: () => Promise<{ bytes: Uint8Array; version: number }>;
  save: (request: SaveRequest) => Promise<{ sequence: number }>;
  onState: (state: ProjectDocumentState) => void;
  onSaved: () => void;
  isWritable?: () => boolean;
};

const REMOTE = Symbol('project-remote');
const closingSessions = new Map<string, Promise<void>>();
const draftDatabase = () =>
  openDB('localmind-project-document-drafts', 1, {
    upgrade(database) {
      database.createObjectStore('drafts');
    },
  });

export function encodeProjectSnapshot(bytes: Uint8Array) {
  let text = '';
  for (let index = 0; index < bytes.length; index += 8192)
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(text);
}

/** Serializes immutable save requests and retains ambiguous network results for replay. */
export class ProjectDocumentSession {
  private version = 0;
  private changeCounter = 0;
  private savedCounter = 0;
  private pending: SaveRequest | null = null;
  private pendingCounter = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private persisting: Promise<void> = Promise.resolve();
  private disposed = false;
  private stopped = false;
  private loaded = false;
  private suspended = false;

  constructor(private readonly options: DocumentSessionOptions) {}

  get hasUnsavedChanges() {
    return this.changeCounter > this.savedCounter || !!this.pending;
  }

  async load() {
    this.emit('loading');
    await closingSessions.get(JSON.stringify(this.options.cacheKey));
    const remote = await this.options.read();
    if (this.disposed) return;
    this.version = remote.version;
    const database = await draftDatabase();
    const recoveryKey = this.options.recoverFrom;
    if (
      recoveryKey &&
      (recoveryKey.length !== this.options.cacheKey.length ||
        recoveryKey
          .slice(0, -1)
          .some((part, index) => part !== this.options.cacheKey[index]))
    ) {
      database.close();
      throw new Error('Project draft scope does not match');
    }
    const draft: Draft | undefined = await database.get(
      'drafts',
      recoveryKey ?? this.options.cacheKey
    );
    const recoverable: ProjectRecoverableDraft[] = [];
    if (this.options.onRecoverableDrafts) {
      for (const key of await database.getAllKeys('drafts')) {
        if (
          !Array.isArray(key) ||
          key.length !== this.options.cacheKey.length ||
          key.some(part => typeof part !== 'string') ||
          key
            .slice(0, -1)
            .some((part, index) => part !== this.options.cacheKey[index]) ||
          key.at(-1) === this.options.cacheKey.at(-1)
        )
          continue;
        const stored: Draft = await database.get('drafts', key);
        recoverable.push({
          cacheKey: key as string[],
          version: stored.version ?? 0,
          savedAt: stored.savedAt ?? null,
        });
      }
    }
    database.close();
    if (this.disposed) return;
    this.options.onRecoverableDrafts?.(
      recoverable.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    );
    if (draft) {
      this.version =
        draft.version ?? draft.pending?.expectedContentVersion ?? 0;
      applyUpdate(this.options.doc, draft.bytes, REMOTE);
      this.pending = draft.pending;
      this.changeCounter = draft.changeCounter;
      this.savedCounter = draft.savedCounter;
      this.pendingCounter = draft.pendingCounter;
    } else applyUpdate(this.options.doc, remote.bytes, REMOTE);
    this.options.doc.on('update', this.onUpdate);
    this.loaded = true;
    if (recoveryKey && draft) await this.persist();
    if (draft && this.version !== remote.version) this.fail(contentConflict());
    else {
      this.emit(draft ? 'unsaved' : 'saved');
      if (draft) this.schedule();
    }
  }

  private readonly onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || this.disposed) return;
    this.changeCounter++;
    this.emit('unsaved');
    void this.persist()
      .then(() => this.schedule())
      .catch(error => this.fail(error));
  };

  private emit(
    phase: ProjectDocumentState['phase'],
    error: UserFriendlyError | null = null
  ) {
    if (!this.disposed)
      this.options.onState({ phase, version: this.version, error });
  }

  private fail(error: unknown) {
    this.stopped = true;
    this.emit('error', UserFriendlyError.fromAny(error));
  }

  private persist() {
    const draft: Draft = {
      savedAt: Date.now(),
      version: this.version,
      bytes: encodeStateAsUpdate(this.options.doc),
      pending: this.pending,
      changeCounter: this.changeCounter,
      savedCounter: this.savedCounter,
      pendingCounter: this.pendingCounter,
    };
    const dirty = this.changeCounter > this.savedCounter || !!this.pending;
    this.persisting = this.persisting
      .catch(() => {})
      .then(async () => {
        const database = await draftDatabase();
        try {
          if (dirty) await database.put('drafts', draft, this.options.cacheKey);
          else await database.delete('drafts', this.options.cacheKey);
        } finally {
          database.close();
        }
      });
    return this.persisting;
  }

  private schedule() {
    if (
      this.disposed ||
      this.stopped ||
      this.suspended ||
      this.options.isWritable?.() === false
    )
      return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush().catch(error => this.fail(error));
    }, 700);
  }

  async flush() {
    clearTimeout(this.timer);
    if (
      this.disposed ||
      this.stopped ||
      this.suspended ||
      this.options.isWritable?.() === false
    )
      return;
    if (this.saving) return this.saving;
    this.saving = this.saveNext();
    try {
      await this.saving;
    } finally {
      this.saving = null;
    }
    if (!this.stopped && this.changeCounter > this.savedCounter)
      this.schedule();
  }

  private async saveNext() {
    if (!this.pending && this.changeCounter === this.savedCounter) return;
    if (!this.pending) {
      this.pendingCounter = this.changeCounter;
      this.pending = {
        expectedContentVersion: this.version,
        requestKey: crypto.randomUUID(),
        snapshotBase64: encodeProjectSnapshot(
          encodeStateAsUpdate(this.options.doc)
        ),
      };
    }
    this.emit('saving');
    try {
      await this.persist();
      const result = await this.options.save(this.pending);
      this.version = Math.max(this.version, result.sequence);
      this.savedCounter = this.pendingCounter;
      this.pending = null;
      await this.persist();
      this.emit(this.changeCounter > this.savedCounter ? 'unsaved' : 'saved');
      this.options.onSaved();
    } catch (error) {
      this.fail(error);
    }
  }

  async refresh() {
    if (this.disposed || this.saving || this.stopped) return;
    try {
      const remote = await this.options.read();
      if (this.disposed || this.saving || this.stopped) return;
      if (remote.version > this.version) {
        if (this.hasUnsavedChanges) {
          this.fail(contentConflict());
          return;
        }
        applyUpdate(this.options.doc, remote.bytes, REMOTE);
        this.version = remote.version;
      }
    } catch (error) {
      this.fail(error);
    }
  }

  async retry() {
    if (this.disposed || this.saving || this.options.isWritable?.() === false)
      return;
    // A version conflict proves that the frozen request did not commit.
    // First replay it to recover a possible success whose response was lost.
    if (this.pending) {
      try {
        const result = await this.options.save(this.pending);
        this.version = Math.max(this.version, result.sequence);
        this.savedCounter = this.pendingCounter;
        this.pending = null;
      } catch (error) {
        this.fail(error);
        return;
      }
    }
    this.stopped = false;
    await this.refresh();
    if (this.stopped) return;
    await this.persist();
    await this.flush();
    if (!this.stopped && this.changeCounter === this.savedCounter)
      this.emit('saved');
  }

  suspend() {
    this.suspended = true;
    clearTimeout(this.timer);
  }

  resume() {
    this.suspended = false;
    if (this.hasUnsavedChanges) this.schedule();
  }

  async saveChanges() {
    if (this.options.isWritable?.() === false)
      throw new Error('Project edit lease is unavailable');
    this.suspended = false;
    await this.retry();
    while (this.hasUnsavedChanges && !this.stopped && !this.disposed)
      await this.flush();
    if (this.hasUnsavedChanges)
      throw new Error('Project changes remain unsaved');
  }

  async discardChanges() {
    this.suspend();
    await this.saving;
    this.pending = null;
    this.savedCounter = this.changeCounter;
    this.stopped = false;
    await this.persist();
    this.emit('saved');
  }

  dispose() {
    this.options.doc.off('update', this.onUpdate);
    clearTimeout(this.timer);
    this.disposed = true;
    const key = JSON.stringify(this.options.cacheKey);
    if (!this.loaded) return closingSessions.get(key) ?? Promise.resolve();
    const pending = Promise.resolve(this.saving).then(() => this.persist());
    closingSessions.set(key, pending);
    void pending
      .finally(() => {
        if (closingSessions.get(key) === pending) closingSessions.delete(key);
      })
      .catch(() => {});
    return pending;
  }
}
