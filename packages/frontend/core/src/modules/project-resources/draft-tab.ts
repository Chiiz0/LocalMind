let draftTab: string | undefined;

// A reload recovers this tab's drafts, but never its previous edit lease.
export function projectDraftTabId() {
  if (draftTab) return draftTab;
  const key = 'localmind-project-draft-tab';
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  try {
    const saved = sessionStorage.getItem(key);
    draftTab =
      saved &&
      (navigation?.type === 'reload' || navigation?.type === 'back_forward')
        ? saved
        : crypto.randomUUID();
    sessionStorage.setItem(key, draftTab);
  } catch {
    draftTab = crypto.randomUUID();
  }
  return draftTab;
}
