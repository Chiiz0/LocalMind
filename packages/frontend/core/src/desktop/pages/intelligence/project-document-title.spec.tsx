/**
 * @vitest-environment happy-dom
 */
import type { Workspace } from '@affine/core/modules/workspace';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Subject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';

import { ProjectDocumentTitle } from './project-document-title';
import type { WorkbenchDocument } from './types';

afterEach(cleanup);

const document = {
  workspaceId: 'workspace-1',
  docId: 'doc-1',
  title: 'Old title',
  status: 'granted',
  requestedLevel: 'read',
} as WorkbenchDocument;

function setup() {
  const docMetaUpdated$ = new Subject<void>();
  let title: string | undefined = 'Old title';
  const getDocMeta = vi.fn(() => (title === undefined ? undefined : { title }));
  const workspace = {
    id: 'workspace-1',
    docCollection: {
      meta: {
        docMetaUpdated: {
          subscribe: (onChange: () => void) =>
            docMetaUpdated$.subscribe(onChange),
        },
        getDocMeta,
      },
    },
  } as unknown as Workspace;
  return {
    workspace,
    getDocMeta,
    docMetaUpdated$,
    rename(value: string | undefined) {
      act(() => {
        title = value;
        docMetaUpdated$.next();
      });
    },
  };
}

test('updates the displayed title and tooltip from synchronized metadata', () => {
  const state = setup();
  const view = render(
    <ProjectDocumentTitle
      document={document}
      workspace={state.workspace}
      fallback="Old title"
      untitled="Untitled"
    />
  );
  state.rename('Renamed by AI');
  expect(screen.getByText('Renamed by AI').title).toBe('Renamed by AI');
  expect(screen.queryByText('Old title')).toBeNull();
  state.rename('');
  expect(screen.getByText('Untitled')).toBeTruthy();
  view.unmount();
  expect(state.docMetaUpdated$.observed).toBe(false);
});

test.each([
  { ...document, workspaceId: 'other-workspace' },
  { ...document, status: 'revoked' },
  { ...document, status: 'pending' },
] as WorkbenchDocument[])(
  'does not resolve local metadata for an inaccessible or foreign document: %o',
  document => {
    const state = setup();
    render(
      <ProjectDocumentTitle
        document={document}
        workspace={state.workspace}
        fallback="Server-authorized title"
        untitled="Untitled"
      />
    );
    state.rename('Private local title');
    expect(screen.getByText('Server-authorized title')).toBeTruthy();
    expect(state.getDocMeta).not.toHaveBeenCalled();
    expect(state.docMetaUpdated$.observed).toBe(false);
  }
);

test('keeps the server title until local metadata becomes available', () => {
  const state = setup();
  state.rename(undefined);
  render(
    <ProjectDocumentTitle
      document={document}
      workspace={state.workspace}
      fallback="Server title"
      untitled="Untitled"
    />
  );
  expect(screen.getByText('Server title')).toBeTruthy();
  state.rename('Synced title');
  expect(screen.getByText('Synced title')).toBeTruthy();
});
