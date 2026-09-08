/** @vitest-environment happy-dom */
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test('reload and restored history recover drafts while duplicated tabs get a new draft identity', async () => {
  const navigation = vi.spyOn(performance, 'getEntriesByType');
  for (const type of ['reload', 'back_forward', 'navigate']) {
    vi.resetModules();
    sessionStorage.setItem('localmind-project-draft-tab', 'previous-tab');
    navigation.mockReturnValue([{ type } as unknown as PerformanceEntry]);
    const { projectDraftTabId } = await import('./draft-tab');
    const id = projectDraftTabId();
    if (type === 'navigate') expect(id).not.toBe('previous-tab');
    else expect(id).toBe('previous-tab');
    expect(projectDraftTabId()).toBe(id);
    const { projectEditorTabId } = await import('./edit-lease-store');
    expect(projectEditorTabId()).not.toBe(id);
  }
});

test('blocked session storage still permits a stable in-document identity', async () => {
  vi.resetModules();
  vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  const { projectDraftTabId } = await import('./draft-tab');
  expect(projectDraftTabId()).toBe(projectDraftTabId());
});
