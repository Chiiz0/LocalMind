/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { gql, notifySuccess, subscribe } = vi.hoisted(() => ({
  gql: vi.fn(),
  notifySuccess: vi.fn(),
  subscribe: vi.fn(() => ({
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  })),
}));
const services = vi.hoisted(() => ({
  graphql: { gql: null as any },
  nbstore: { realtime: { subscribe: null as any } },
  workspace: { workspace: { id: 'workspace-one', flavour: 'cloud' } },
  permission: {
    permission: {
      isOwnerOrAdmin$: null as unknown as BehaviorSubject<boolean>,
    },
  },
}));

vi.mock('@affine/component', () => ({
  Button: ({ children, loading: _loading, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: ({ checked, label, onChange, ...props }: any) => (
    <input
      {...props}
      aria-label={label}
      checked={checked}
      type="checkbox"
      onChange={event => onChange?.(event, event.target.checked)}
    />
  ),
  Loading: () => <span>loading</span>,
  notify: { success: notifySuccess, error: vi.fn() },
}));

vi.mock('@affine/component/setting-components', () => ({
  SettingHeader: ({ title, subtitle }: any) => (
    <header>
      {title} {subtitle}
    </header>
  ),
  SettingWrapper: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock('@affine/core/modules/cloud', () => ({
  GraphQLService: class GraphQLService {},
}));
vi.mock('@affine/core/modules/permissions', () => ({
  WorkspacePermissionService: class WorkspacePermissionService {},
}));
vi.mock('@affine/core/modules/storage', () => ({
  NbstoreService: class NbstoreService {},
}));
vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: class WorkspaceService {},
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => () => String(key),
      }
    ),
}));

vi.mock('@toeverything/infra', () => ({
  useLiveData: (value$: BehaviorSubject<boolean>) => value$.getValue(),
  useService: (service: { name: string }) => {
    if (service.name === 'GraphQLService') return services.graphql;
    if (service.name === 'NbstoreService') return services.nbstore;
    if (service.name === 'WorkspaceService') return services.workspace;
    if (service.name === 'WorkspacePermissionService')
      return services.permission;
    throw new Error(`Unexpected service ${service.name}`);
  },
}));

import {
  directoryPolicyKey,
  formatDirectoryRights,
  mergeDirectoryAuditEvents,
  WorkspaceDirectoryPermissions,
} from '.';

const snapshot = {
  revision: 'a'.repeat(64),
  directories: [
    { id: '$root', parentId: null, name: 'Root' },
    { id: 'folder-one', parentId: null, name: 'Finance' },
  ],
  principals: [
    { id: '*', name: 'All members', email: null, allMembers: true },
    {
      id: 'member-one',
      name: 'Alice',
      email: 'alice@example.invalid',
      allMembers: false,
    },
  ],
  policies: [
    {
      directoryId: '$root',
      principalId: '*',
      updatedAt: '2026-09-06T00:00:00.000Z',
      rights: {
        canRead: true,
        canWrite: false,
        canOrganize: false,
        canCreateFolder: false,
      },
    },
  ],
  auditEvents: [],
  auditNextCursor: null,
};

describe('WorkspaceDirectoryPermissions', () => {
  beforeEach(() => {
    services.workspace.workspace = { id: 'workspace-one', flavour: 'cloud' };
    services.permission.permission.isOwnerOrAdmin$ = new BehaviorSubject(true);
    services.graphql.gql = gql;
    services.nbstore.realtime.subscribe = subscribe;
    gql.mockReset();
    subscribe.mockClear();
    notifySuccess.mockClear();
    gql.mockImplementation(async ({ query }: any) => {
      if (query.id === 'workspaceDirectoryAdministrationQuery')
        return { workspaceDirectoryAdministration: snapshot };
      return {
        changeWorkspaceDirectoryPolicy: {
          revision: 'b'.repeat(64),
          policy: snapshot.policies[0],
        },
      };
    });
  });

  test('hides the prior Workspace snapshot while loading a different Workspace', async () => {
    const view = render(<WorkspaceDirectoryPermissions />);

    await screen.findByTestId('directory-policy-list');
    services.workspace.workspace = { id: 'workspace-two', flavour: 'cloud' };
    gql.mockImplementationOnce(() => new Promise(() => {}));

    view.rerender(<WorkspaceDirectoryPermissions />);

    expect(screen.queryByTestId('directory-policy-list')).toBeNull();
    await waitFor(() =>
      expect(gql).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ workspaceId: 'workspace-two' }),
        })
      )
    );
  });

  test('loads the administrative snapshot and saves the selected override', async () => {
    render(<WorkspaceDirectoryPermissions />);

    const save = await screen.findByTestId('directory-policy-save');
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false)
    );
    fireEvent.click(save);

    await waitFor(() =>
      expect(gql).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            id: 'changeWorkspaceDirectoryPolicyMutation',
          }),
          variables: expect.objectContaining({
            workspaceId: 'workspace-one',
            expectedRevision: 'a'.repeat(64),
            directoryId: '$root',
            principalId: '*',
            rights: snapshot.policies[0].rights,
          }),
        })
      )
    );
    expect(subscribe).toHaveBeenCalledWith(
      'workspace.directory-policy.changed',
      { workspaceId: 'workspace-one' }
    );
    expect(notifySuccess).toHaveBeenCalledTimes(1);
  });
});

describe('directory permission helpers', () => {
  test('uses an unambiguous compound policy key', () => {
    expect(directoryPolicyKey('a', 'bc')).not.toBe(
      directoryPolicyKey('ab', 'c')
    );
  });

  test('deduplicates and orders paged audit events', () => {
    const first = {
      id: 'one',
      createdAt: '2026-09-06T01:00:00.000Z',
    } as any;
    const second = {
      id: 'two',
      createdAt: '2026-09-06T02:00:00.000Z',
    } as any;
    expect(mergeDirectoryAuditEvents([first], [first, second])).toEqual([
      second,
      first,
    ]);
  });

  test('formats only enabled rights', () => {
    expect(
      formatDirectoryRights(
        {
          canRead: true,
          canWrite: false,
          canOrganize: true,
          canCreateFolder: false,
        },
        {
          canRead: 'Read',
          canWrite: 'Write',
          canOrganize: 'Organize',
          canCreateFolder: 'Create folders',
        }
      )
    ).toBe('Read · Organize');
  });
});
