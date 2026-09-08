import { Button, Loading, Modal, notify } from '@affine/component';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useBlocker } from 'react-router-dom';

export type ProjectEditGuard = {
  hasUnsavedChanges: boolean;
  save: () => Promise<void>;
  discard: () => Promise<void>;
  suspend?: () => void;
  resume?: () => void;
};
const GuardContext = createContext<{
  register: (guard: ProjectEditGuard) => () => void;
  confirm: () => Promise<boolean>;
  handoff: { hasUnsavedChanges: () => boolean; save: () => Promise<boolean> };
} | null>(null);

export function useProjectEditGuard(guard: ProjectEditGuard | null) {
  const register = useContext(GuardContext)?.register;
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(
    () =>
      register?.({
        get hasUnsavedChanges() {
          return latest.current?.hasUnsavedChanges ?? false;
        },
        save: async () => latest.current?.save(),
        discard: async () => latest.current?.discard(),
        suspend: () => latest.current?.suspend?.(),
        resume: () => latest.current?.resume?.(),
      }),
    [register]
  );
}

const allow = async () => true;
export function useProjectUnsavedConfirmation() {
  return useContext(GuardContext)?.confirm ?? allow;
}

export function useProjectHandoffPreparation() {
  return useContext(GuardContext)?.handoff;
}

export function ProjectEditorGuard({ children }: PropsWithChildren) {
  const t = useI18n();
  const guards = useRef(new Set<ProjectEditGuard>());
  const localDecision = useRef<((allow: boolean) => void) | null>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const pendingRef = useRef(false);
  const register = useCallback((guard: ProjectEditGuard) => {
    guards.current.add(guard);
    return () => {
      guards.current.delete(guard);
    };
  }, []);
  const dirty = useCallback(
    () => [...guards.current].some(guard => guard.hasUnsavedChanges),
    []
  );
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && dirty()
  );
  const confirm = useCallback(async () => {
    if (!dirty()) return true;
    if (localDecision.current || pendingRef.current) return false;
    setLocalOpen(true);
    return new Promise<boolean>(resolve => {
      localDecision.current = resolve;
    });
  }, [dirty]);
  const saveForHandoff = useCallback(async () => {
    if (pendingRef.current || localDecision.current)
      throw new Error('A Project edit decision is pending');
    if (!dirty()) return false;
    pendingRef.current = true;
    setHandoffSaving(true);
    const active = [...guards.current];
    active.forEach(guard => guard.suspend?.());
    try {
      for (const guard of active)
        if (guard.hasUnsavedChanges) await guard.save();
      if (dirty()) throw new Error('Project changes remain unsaved');
      return true;
    } finally {
      active.forEach(guard => guard.resume?.());
      pendingRef.current = false;
      setHandoffSaving(false);
    }
  }, [dirty]);
  const context = useMemo(
    () => ({
      register,
      confirm,
      handoff: { hasUnsavedChanges: dirty, save: saveForHandoff },
    }),
    [register, confirm, dirty, saveForHandoff]
  );
  const open = blocker.state === 'blocked' || localOpen;
  useEffect(() => {
    const active = [...guards.current];
    if (open) active.forEach(guard => guard.suspend?.());
    return () => active.forEach(guard => guard.resume?.());
  }, [open]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if ([...guards.current].some(guard => guard.hasUnsavedChanges)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      localDecision.current?.(false);
    };
  }, []);
  const decide = (allowed: boolean) => {
    localDecision.current?.(allowed);
    localDecision.current = null;
    setLocalOpen(false);
    if (blocker.state === 'blocked') {
      if (allowed) blocker.proceed();
      else blocker.reset();
    }
  };
  const finish = async (action: 'save' | 'discard') => {
    if (pendingRef.current || !open) return;
    pendingRef.current = true;
    setPending(true);
    try {
      for (const guard of guards.current)
        if (guard.hasUnsavedChanges) await guard[action]();
      if (dirty()) throw new Error('Project changes remain unsaved');
      decide(true);
    } catch (caught) {
      const friendly = UserFriendlyError.fromAny(caught);
      notify.error({
        title:
          t[
            friendly.isStatus(409)
              ? 'com.affine.localmind.project-files.conflict'
              : 'com.affine.localmind.project-files.operationFailed'
          ](),
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return (
    <GuardContext.Provider value={context}>
      {children}
      <Modal
        open={handoffSaving}
        title={t['com.affine.localmind.project-tasks.savingBeforeHandoff']()}
        onOpenChange={() => {}}
      >
        <Loading size={24} />
      </Modal>
      <Modal
        open={open}
        title={t['com.affine.localmind.project-files.unsavedConfirm']()}
        onOpenChange={value => {
          if (!value && !pendingRef.current) decide(false);
        }}
      >
        <p>{t['com.affine.localmind.project-files.unsavedDescription']()}</p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button disabled={pending} onClick={() => decide(false)}>
            {t['Cancel']()}
          </Button>
          <Button disabled={pending} onClick={() => void finish('discard')}>
            {t['com.affine.localmind.project-files.discard']()}
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={pending}
            onClick={() => void finish('save')}
          >
            {t['com.affine.localmind.project-files.save']()}
          </Button>
        </div>
      </Modal>
    </GuardContext.Provider>
  );
}
