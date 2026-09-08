/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { HelpCenterPage } from './index';

const navigate = vi.hoisted(() => vi.fn());
const openDialog = vi.hoisted(() => vi.fn());
const WorkspaceDialogServiceToken = vi.hoisted(
  () => class WorkspaceDialogService {}
);

vi.mock('@affine/i18n', () => {
  const messages: Record<string, string> = {
    'com.affine.localmind.help.title': 'Help & guide',
    'com.affine.localmind.help.pageTitle': 'LocalMind guide',
    'com.affine.localmind.help.search.placeholder': 'Search the guide',
    'com.affine.localmind.help.search.clear': 'Clear search',
    'com.affine.localmind.help.openChat': 'Open AI Chat',
    'com.affine.localmind.help.manageContext': 'Manage AI context',
    'com.affine.localmind.help.openEmbedding': 'Open Embedding settings',
    'com.affine.localmind.help.alert.title':
      'AI Chat will prompt you to start a new chat after a document changes',
    'com.affine.localmind.help.section.snapshots.title':
      'Document updates and snapshots',
    'com.affine.localmind.help.snapshots.why.description':
      'A chat preserves the source version it read so prior answers remain reproducible.',
    'com.affine.localmind.help.section.permissions.title':
      'Permissions and privacy',
  };
  const translate = (key: string) => messages[key] ?? key;
  const t = new Proxy(
    { t: translate },
    {
      get(target, key: string) {
        if (key in target) return target[key as keyof typeof target];
        return () => translate(key);
      },
    }
  );
  return { useI18n: () => t };
});

vi.mock('@affine/core/components/pure/header', () => ({
  Header: ({ left, right }: { left?: ReactNode; right?: ReactNode }) => (
    <header>
      {left}
      {right}
    </header>
  ),
}));

vi.mock('@affine/core/modules/dialogs', () => ({
  WorkspaceDialogService: WorkspaceDialogServiceToken,
}));

vi.mock('@affine/core/modules/workbench', () => ({
  ViewBody: ({ children }: PropsWithChildren) => (
    <div data-testid="view-body">{children}</div>
  ),
  ViewHeader: ({ children }: PropsWithChildren) => (
    <div data-testid="view-header">{children}</div>
  ),
  ViewIcon: () => null,
  ViewTitle: () => null,
}));

vi.mock('@toeverything/infra', () => ({
  useService: (token: unknown) => {
    if (token === WorkspaceDialogServiceToken) {
      return { open: openDialog };
    }
    return {};
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

describe('LocalMind help center', () => {
  afterEach(cleanup);

  beforeEach(() => {
    navigate.mockReset();
    openDialog.mockReset();
  });

  test('filters guide sections from translated content that is displayed', () => {
    render(<HelpCenterPage />);

    fireEvent.change(screen.getByPlaceholderText('Search the guide'), {
      target: { value: 'reproducible' },
    });

    expect(screen.getByTestId('guide-section-snapshots')).not.toBeNull();
    expect(screen.queryByTestId('guide-section-start')).toBeNull();
  });

  test('keeps the document snapshot warning visible while searching', () => {
    render(<HelpCenterPage />);

    expect(
      screen.getByText(
        'AI Chat will prompt you to start a new chat after a document changes'
      )
    ).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Search the guide'), {
      target: { value: 'permissions' },
    });

    expect(screen.getByTestId('guide-section-permissions')).not.toBeNull();
    expect(screen.queryByTestId('guide-section-start')).toBeNull();
    expect(
      screen.getByText(
        'AI Chat will prompt you to start a new chat after a document changes'
      )
    ).not.toBeNull();
  });

  test('opens AI chat and contextual workspace settings', () => {
    render(<HelpCenterPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI Chat' }));
    expect(navigate).toHaveBeenCalledWith('/project');

    fireEvent.click(screen.getByRole('button', { name: 'Manage AI context' }));
    expect(openDialog).toHaveBeenCalledWith('setting', {
      activeTab: 'workspace:ai-context',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Embedding settings' })
    );
    expect(openDialog).toHaveBeenCalledWith('setting', {
      activeTab: 'workspace:embedding',
    });
  });

  test('uses unique section anchors when two help views are open', () => {
    render(
      <>
        <HelpCenterPage />
        <HelpCenterPage />
      </>
    );

    const sections = screen.getAllByTestId(/^guide-section-/);
    const ids = sections.map(section => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
