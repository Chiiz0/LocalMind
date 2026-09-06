import { describe, expect, it } from 'vitest';

import { readBrowserWorkbenchState } from './browser-state';

const state = {
  localmindWorkbench: 1,
  basename: '/workspace/test',
  activeViewIndex: 1,
  views: [
    { id: 'source', path: { pathname: '/a', search: '', hash: '' }, size: 100 },
    {
      id: 'reference',
      path: { pathname: '/b', search: '?blockIds=paragraph', hash: '' },
      size: 80,
    },
  ],
};

describe('browser pane history', () => {
  it('bounds persisted page scroll positions', () => {
    const withScroll = {
      ...state,
      views: state.views.map(view => ({ ...view, scrollTop: 600 })),
    };
    expect(
      readBrowserWorkbenchState(
        withScroll,
        '/workspace/test',
        '/workspace/test/b?blockIds=paragraph'
      )
    ).toEqual(withScroll);
    withScroll.views[0].scrollTop = -1;
    expect(
      readBrowserWorkbenchState(
        withScroll,
        '/workspace/test',
        '/workspace/test/b?blockIds=paragraph'
      )
    ).toBeNull();
  });
  it('restores both pages and the selected block on refresh', () => {
    expect(
      readBrowserWorkbenchState(
        state,
        '/workspace/test',
        '/workspace/test/b?blockIds=paragraph'
      )
    ).toEqual(state);
  });
  it('does not restore layouts from another workspace or unrelated URL', () => {
    expect(
      readBrowserWorkbenchState(
        state,
        '/workspace/other',
        '/workspace/other/b?blockIds=paragraph'
      )
    ).toBeNull();
    expect(
      readBrowserWorkbenchState(state, '/workspace/test', '/workspace/test/c')
    ).toBeNull();
  });
  it.each([
    null,
    { ...state, activeViewIndex: 10 },
    { ...state, views: [state.views[0], state.views[0]] },
    { ...state, views: [{ ...state.views[0], size: -1 }] },
    {
      ...state,
      views: [
        {
          ...state.views[0],
          path: { pathname: '//host/a', search: '', hash: '' },
        },
      ],
    },
  ])('rejects malformed persisted layouts', value => {
    expect(
      readBrowserWorkbenchState(
        value,
        '/workspace/test',
        '/workspace/test/b?blockIds=paragraph'
      )
    ).toBeNull();
  });
});
