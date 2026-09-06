/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  gql: vi.fn(),
  refresh: vi.fn(async () => {}),
  operations: [] as Record<string, unknown>[],
  olderOperations: [] as Record<string, unknown>[],
}));
vi.mock('@affine/component', () => ({
  Button: (
    props: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>
  ) => <button {...props} />,
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: state.gql }),
}));
vi.mock('@affine/error', () => ({
  UserFriendlyError: { fromAny: (error: Error) => error },
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/graphql', () => ({
  confirmCopilotDocumentDestinationMutation: 'confirm',
  copilotDocumentDestinationFoldersQuery: 'folders',
  copilotDocumentDestinationWorkspacesQuery: 'workspaces',
  copilotDocumentOperationsQuery: 'operations',
  retryCopilotDocumentOperationMutation: 'retry',
  withdrawCopilotDocumentOperationMutation: 'withdraw',
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (request?: {
    query: string;
    variables?: { sessionId?: string; after?: string };
  }) => ({
    mutate: state.refresh,
    isLoading: false,
    error: null,
    data: {
      currentUser: {
        copilot: {
          documentOperations:
            request?.variables?.sessionId === 'session'
              ? request.variables.after
                ? state.olderOperations
                : state.operations
              : [],
          documentDestinationWorkspaces: [
            { id: 'storage', name: 'Storage' },
            { id: 'other', name: 'Other' },
          ],
          documentDestinationFolders: {
            items: [{ id: 'folder', name: 'Folder' }],
            nextCursor: null,
          },
        },
      },
    },
  }),
}));

import { DocumentCreationPanel } from './document-creation-panel';

const label = (key: string) => `com.affine.localmind.documentCreation.${key}`;
beforeEach(() => {
  state.gql.mockReset();
  state.refresh.mockClear();
  state.olderOperations = [];
  state.operations = [
    {
      id: 'operation',
      title: 'Private draft',
      status: 'waiting_location',
      projectStatus: 'not_requested',
      documentId: 'new-doc',
      destinationWorkspaceId: null,
      destinationFolderId: null,
      destinationRevision: 0,
      locationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdDocumentAt: null,
      placedDocumentAt: null,
    },
  ];
});
afterEach(cleanup);

test('copy confirmation identifies the operation and links to its source workspace', () => {
  Object.assign(state.operations[0], {
    kind: 'copy',
    sourceWorkspaceId: 'source-storage',
    sourceDocumentId: 'original-doc',
  });
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  expect(screen.getByText(label('copy'))).toBeTruthy();
  const source = screen.getByText(label('source'));
  expect(source.getAttribute('href')).toContain('source-storage');
  expect(source.getAttribute('href')).toContain('original-doc');
  expect(state.gql).not.toHaveBeenCalled();
  expect(screen.getByText(label('confirm')).hasAttribute('disabled')).toBe(
    true
  );
});

test('expired locations require confirmation and withdrawal remains available without a destination', async () => {
  Object.assign(state.operations[0], {
    status: 'expired',
    locationExpiresAt: '2020-01-01T00:00:00Z',
  });
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  expect(screen.getByText(label('expired'))).toBeTruthy();
  expect(screen.queryByRole('button', { name: label('retry') })).toBeNull();
  expect(
    screen
      .getByRole('button', { name: label('confirm') })
      .hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.action.withdrawRequest',
    })
  );
  await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  expect(state.gql).toHaveBeenCalledWith({
    query: 'withdraw',
    variables: { operationId: 'operation', expectedRevision: 0 },
  });
});

test('withdrawn operations show the terminal result and expose no confirmation or retry', () => {
  Object.assign(state.operations[0], { status: 'cancelled' });
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  expect(screen.getByText(label('withdrawn'))).toBeTruthy();
  expect(screen.queryByRole('button', { name: label('confirm') })).toBeNull();
  expect(screen.queryByLabelText(label('workspace'))).toBeNull();
  expect(state.gql).not.toHaveBeenCalled();
});

test('older pending operations remain reachable and changing sessions resets pagination', () => {
  const template = state.operations[0];
  state.operations = Array.from({ length: 20 }, (_, index) => ({
    ...template,
    id: `operation-${index}`,
    title: `Recent ${index}`,
  }));
  state.olderOperations = [
    { ...template, id: 'old', title: 'Older pending request' },
  ];
  const view = render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText(label('more')));
  expect(screen.getByText('Older pending request')).toBeTruthy();
  expect(screen.queryByText('Recent 0')).toBeNull();
  fireEvent.click(screen.getByText(label('previous')));
  expect(screen.getByText('Recent 0')).toBeTruthy();
  fireEvent.click(screen.getByText(label('more')));
  view.rerender(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="other" />
    </MemoryRouter>
  );
  expect(screen.queryByText('Older pending request')).toBeNull();
  view.rerender(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  expect(screen.getByText('Recent 0')).toBeTruthy();
});

test('revoked authorization keeps creation visible without claiming current project access', () => {
  Object.assign(state.operations[0], {
    status: 'complete',
    projectStatus: 'revoked',
    createdDocumentAt: '2026-09-05T00:00:00Z',
    placedDocumentAt: '2026-09-05T00:00:00Z',
    destinationWorkspaceId: 'storage',
  });
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  expect(screen.getByText(label('created'))).toBeTruthy();
  expect(screen.getByText(label('revoked'))).toBeTruthy();
  expect(screen.queryByText(label('added'))).toBeNull();
});

test('requires both a workspace and explicit root and suppresses duplicate submissions', async () => {
  let resolve: ((value: object) => void) | undefined;
  state.gql.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  const submit = screen.getByRole('button', { name: label('confirm') });
  expect(submit.hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText(label('workspace')), {
    target: { value: 'storage' },
  });
  expect(submit.hasAttribute('disabled')).toBe(true);
  expect(state.gql).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(label('location')), {
    target: { value: '$root' },
  });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(state.gql).toHaveBeenCalledTimes(1);
  expect(state.gql).toHaveBeenCalledWith({
    query: 'confirm',
    variables: {
      input: {
        operationId: 'operation',
        workspaceId: 'storage',
        root: true,
        folderId: null,
        expectedRevision: 0,
      },
    },
  });
  resolve?.({});
  await waitFor(() => expect(state.refresh).toHaveBeenCalled());
});

test('changing workspace clears the prior location without creating anything', () => {
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  const workspace = screen.getByLabelText(label('workspace'));
  fireEvent.change(workspace, { target: { value: 'storage' } });
  fireEvent.change(screen.getByLabelText(label('location')), {
    target: { value: 'folder' },
  });
  fireEvent.change(workspace, { target: { value: 'other' } });
  expect(
    (screen.getByLabelText(label('location')) as HTMLSelectElement).value
  ).toBe('');
  expect(state.gql).not.toHaveBeenCalled();
});

test('keeps actual creation separate from pending project access and hides prior session requests', () => {
  state.operations[0] = {
    ...state.operations[0],
    status: 'complete',
    projectStatus: 'requested',
    destinationWorkspaceId: 'storage',
    createdDocumentAt: '2026-09-05',
    placedDocumentAt: '2026-09-05',
  };
  const view = render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  expect(screen.getByText(label('created'))).toBeTruthy();
  expect(screen.getByText(label('accessPending'))).toBeTruthy();
  expect(screen.queryByText(label('added'))).toBeNull();
  view.rerender(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="another-session" />
    </MemoryRouter>
  );
  expect(screen.queryByText('Private draft')).toBeNull();
});

test('server denial remains an error and never displays creation success', async () => {
  state.gql.mockRejectedValue(new Error('Destination access denied'));
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText(label('workspace')), {
    target: { value: 'storage' },
  });
  fireEvent.change(screen.getByLabelText(label('location')), {
    target: { value: '$root' },
  });
  fireEvent.click(screen.getByRole('button', { name: label('confirm') }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Destination access denied'
    )
  );
  expect(screen.queryByText(label('created'))).toBeNull();
});

test('a later failure refreshes the real created receipt and dependent views', async () => {
  const onChanged = vi.fn();
  state.gql.mockRejectedValueOnce(
    new Error('Properties temporarily unavailable')
  );
  state.refresh.mockImplementationOnce(async () => {
    Object.assign(state.operations[0], {
      status: 'created',
      destinationWorkspaceId: 'storage',
      createdDocumentAt: '2026-09-05',
      failureCode: 'storage_unavailable',
    });
  });
  render(
    <MemoryRouter>
      <DocumentCreationPanel sessionId="session" onChanged={onChanged} />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText(label('workspace')), {
    target: { value: 'storage' },
  });
  fireEvent.change(screen.getByLabelText(label('location')), {
    target: { value: '$root' },
  });
  fireEvent.click(screen.getByRole('button', { name: label('confirm') }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(screen.getByText(label('created'))).toBeTruthy();
  expect(screen.getByText('Properties temporarily unavailable')).toBeTruthy();
  expect(screen.getByRole('button', { name: label('retry') })).toBeTruthy();
});
