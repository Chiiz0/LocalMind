import { matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  legacyProjectRedirectLoader,
  PROJECT_ROUTE_PATH,
  projectTopLevelRoutes,
  TASKS_ROUTE_PATH,
} from './project-router';
import { WORKSPACE_ROUTE_PATH } from './route-paths';
import { workbenchRoutes } from './workbench-router';

describe('Project top-level routes', () => {
  const routesUnderRoot = [
    ...projectTopLevelRoutes.map(route => ({
      path: route.path,
      loader: 'loader' in route ? route.loader : undefined,
    })),
    { path: WORKSPACE_ROUTE_PATH },
  ];

  it('matches without an active workspace', () => {
    const matches = matchRoutes(routesUnderRoot, '/project');

    expect(matches?.at(-1)?.route.path).toBe(PROJECT_ROUTE_PATH);
    expect(matches?.at(-1)?.params.workspaceId).toBeUndefined();
  });

  it('matches the full global Tasks view without an active workspace', () => {
    const matches = matchRoutes(
      routesUnderRoot,
      '/tasks?filter=all&taskId=workspace-b-task'
    );

    expect(matches?.at(-1)?.route.path).toBe(TASKS_ROUTE_PATH);
    expect(matches?.at(-1)?.params.workspaceId).toBeUndefined();
  });

  it.each([
    ['/intelligence?project=project-1#in-progress', undefined],
    ['/chat?project=project-1#in-progress', undefined],
    [
      '/workspace/missing-workspace/chat?project=project-1#in-progress',
      'missing-workspace',
    ],
  ])(
    'redirects legacy route %s across the top level',
    async (path, workspaceId) => {
      const matches = matchRoutes(routesUnderRoot, path);
      const matchedRoute = matches?.at(-1)?.route;
      expect(
        matchedRoute && 'loader' in matchedRoute
          ? matchedRoute.loader
          : undefined
      ).toBe(legacyProjectRedirectLoader);
      expect(matches?.at(-1)?.params.workspaceId).toBe(workspaceId);

      const response = await legacyProjectRedirectLoader({
        request: new Request(`https://app.local${path}`),
        params: matches?.at(-1)?.params ?? {},
        context: undefined,
      });

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(301);
      expect((response as Response).headers.get('Location')).toBe(
        '/project/project-1#in-progress'
      );
    }
  );

  it('matches shareable project and resource paths without a Workspace scope', () => {
    expect(
      matchRoutes(routesUnderRoot, '/project/project-1')?.at(-1)?.params
    ).toEqual({ projectId: 'project-1' });
    expect(
      matchRoutes(
        routesUnderRoot,
        '/project/project-1/resources/resource-1'
      )?.at(-1)?.params
    ).toEqual({ projectId: 'project-1', resourceId: 'resource-1' });
  });

  it('moves legacy resource identity into the path while preserving auxiliary state', async () => {
    const response = await legacyProjectRedirectLoader({
      request: new Request(
        'https://app.local/chat?project=p%2F1&resource=r%202&fileRequest=f#message'
      ),
      params: {},
      context: undefined,
    });
    expect((response as Response).headers.get('Location')).toBe(
      '/project/p%2F1/resources/r%202?fileRequest=f#message'
    );
  });

  it('keeps the workspace Tasks compatibility route and removes legacy chat', () => {
    expect(workbenchRoutes.some(route => route.path === '/tasks')).toBe(true);
    expect(workbenchRoutes.some(route => route.path === '/chat')).toBe(false);
  });
});
