import type { LoaderFunction, RouteObject } from 'react-router-dom';
import { redirect } from 'react-router-dom';

import { getProjectPath, PROJECT_ROUTE_PATH } from './route-paths';

export { PROJECT_ROUTE_PATH } from './route-paths';
export const TASKS_ROUTE_PATH = '/tasks';

export const legacyProjectRedirectLoader: LoaderFunction = ({
  request,
  params,
}) => {
  const url = new URL(request.url);
  const projectId = params.projectId ?? url.searchParams.get('project');
  const resourceId = params.resourceId ?? url.searchParams.get('resource');
  url.searchParams.delete('project');
  url.searchParams.delete('resource');
  return redirect(
    `${getProjectPath(projectId, resourceId)}${url.search}${url.hash}`,
    301
  );
};

export const projectTopLevelRoutes = [
  {
    path: PROJECT_ROUTE_PATH,
    lazy: () => import('./pages/intelligence'),
  },
  {
    path: `${PROJECT_ROUTE_PATH}/:projectId`,
    lazy: () => import('./pages/intelligence'),
  },
  {
    path: `${PROJECT_ROUTE_PATH}/:projectId/resources/:resourceId`,
    lazy: () => import('./pages/intelligence'),
  },
  {
    path: TASKS_ROUTE_PATH,
    lazy: () => import('./pages/tasks'),
  },
  ...[
    '/intelligence',
    '/chat',
    '/workspace/:workspaceId/chat',
    '/workspace/:workspaceId/intelligence',
  ].flatMap(path => [
    { path, loader: legacyProjectRedirectLoader },
    { path: `${path}/:projectId`, loader: legacyProjectRedirectLoader },
    {
      path: `${path}/:projectId/resources/:resourceId`,
      loader: legacyProjectRedirectLoader,
    },
  ]),
] satisfies RouteObject[];
