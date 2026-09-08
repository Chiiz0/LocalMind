/**
 * @vitest-environment happy-dom
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  activeSidebarTab: vi.fn(),
  closeSidebar: vi.fn(),
  haveChatTab: false,
  navigate: vi.fn(),
  openSidebar: vi.fn(),
  sidebarOpen: false,
}));

/* eslint-disable rxjs/finnish -- Mock keys mirror the WorkbenchService observable API. */
const tokens = vi.hoisted(() => ({
  WorkbenchService: class WorkbenchService {},
  activeLocation$: Symbol('activeLocation$'),
  activeSidebarTab$: Symbol('activeSidebarTab$'),
  activeView$: Symbol('activeView$'),
  sidebarOpen$: Symbol('sidebarOpen$'),
  sidebarTabs$: {
    map: (selector: (tabs: Array<{ id: string }>) => boolean) => ({
      kind: 'mappedTabs',
      selector,
    }),
  },
}));

const activeView = {
  activeSidebarTab$: tokens.activeSidebarTab$,
  activeSidebarTab: state.activeSidebarTab,
  location$: tokens.activeLocation$,
  sidebarTabs$: tokens.sidebarTabs$,
};
/* eslint-enable rxjs/finnish */

vi.mock('@affine/core/modules/workbench', () => ({
  WorkbenchService: tokens.WorkbenchService,
}));

vi.mock('@toeverything/infra', () => ({
  useService: () => ({
    workbench: {
      /* eslint-disable rxjs/finnish -- Symbols identify mocked observable sources. */
      activeView$: tokens.activeView$,
      sidebarOpen$: tokens.sidebarOpen$,
      /* eslint-enable rxjs/finnish */
      closeSidebar: state.closeSidebar,
      openSidebar: state.openSidebar,
    },
  }),
  useLiveData: (source: unknown) => {
    if (source === tokens.activeView$) return activeView;
    if (source === tokens.activeLocation$) return { pathname: '/all' };
    if (source === tokens.activeSidebarTab$) return null;
    if (source === tokens.sidebarOpen$) return state.sidebarOpen;
    if ((source as { kind?: string })?.kind === 'mappedTabs') {
      const mapped = source as {
        selector: (tabs: Array<{ id: string }>) => boolean;
      };
      return mapped.selector(state.haveChatTab ? [{ id: 'chat' }] : []);
    }
    return undefined;
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => state.navigate,
}));

vi.mock('./container', () => ({
  IslandContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('./icons', () => ({ AIIcon: () => <svg /> }));
vi.mock('./styles.css', () => ({
  aiIslandBtn: 'aiIslandBtn',
  aiIslandWrapper: 'aiIslandWrapper',
  toolStyle: 'toolStyle',
}));

import { AIIsland } from './index';

describe('AIIsland navigation', () => {
  beforeEach(() => {
    state.activeSidebarTab.mockReset();
    state.closeSidebar.mockReset();
    state.haveChatTab = false;
    state.navigate.mockReset();
    state.openSidebar.mockReset();
    state.sidebarOpen = false;
  });

  afterEach(cleanup);

  test('opens the top-level Intelligence route when no document chat exists', async () => {
    render(<AIIsland />);
    await waitFor(() => {
      expect(screen.getByTestId('ai-island').parentElement?.dataset.hide).toBe(
        'false'
      );
    });

    fireEvent.click(screen.getByTestId('ai-island'));
    expect(state.navigate).toHaveBeenCalledWith('/project');
    expect(state.closeSidebar).toHaveBeenCalledTimes(1);
    expect(state.openSidebar).not.toHaveBeenCalled();
  });

  test('keeps the document-attached chat branch unchanged', async () => {
    state.haveChatTab = true;
    render(<AIIsland />);
    await waitFor(() => {
      expect(screen.getByTestId('ai-island').parentElement?.dataset.hide).toBe(
        'false'
      );
    });

    fireEvent.click(screen.getByTestId('ai-island'));
    expect(state.openSidebar).toHaveBeenCalledTimes(1);
    expect(state.activeSidebarTab).toHaveBeenCalledWith('chat');
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
