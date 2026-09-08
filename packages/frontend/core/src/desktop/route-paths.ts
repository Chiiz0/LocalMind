export const WORKSPACE_ROUTE_PATH = '/workspace/:workspaceId/*';
export const SHARE_ROUTE_PATH = '/share/:workspaceId/:pageId';
export const NOT_FOUND_ROUTE_PATH = '/404';
export const CATCH_ALL_ROUTE_PATH = '*';
export const PROJECT_ROUTE_PATH = '/project';

export const getProjectPath = (
  projectId?: string | null,
  resourceId?: string | null
) => {
  if (!projectId) return PROJECT_ROUTE_PATH;
  const projectPath = `${PROJECT_ROUTE_PATH}/${encodeURIComponent(projectId)}`;
  return resourceId
    ? `${projectPath}/resources/${encodeURIComponent(resourceId)}`
    : projectPath;
};

export function getWorkspaceDocPath(workspaceId: string, docId: string) {
  return `/workspace/${workspaceId}/${docId}`;
}
