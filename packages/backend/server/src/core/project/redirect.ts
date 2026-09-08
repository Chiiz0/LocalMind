import type { Application } from 'express';

export function registerProjectRedirects(app: Application, basePath: string) {
  const paths = [
    '/intelligence',
    '/chat',
    '/workspace/:workspaceId/chat',
    '/workspace/:workspaceId/intelligence',
  ];
  app.get(
    paths.flatMap(path => [
      basePath + path,
      `${basePath}${path}/:projectId`,
      `${basePath}${path}/:projectId/resources/:resourceId`,
    ]),
    (req, res) => {
      const url = new URL(req.originalUrl, 'http://localhost');
      const projectId =
        typeof req.params.projectId === 'string'
          ? req.params.projectId
          : url.searchParams.get('project');
      const resourceId =
        typeof req.params.resourceId === 'string'
          ? req.params.resourceId
          : url.searchParams.get('resource');
      url.searchParams.delete('project');
      url.searchParams.delete('resource');
      let path = `${basePath}/project`;
      if (projectId) {
        path += `/${encodeURIComponent(projectId)}`;
        if (resourceId) path += `/resources/${encodeURIComponent(resourceId)}`;
      }
      res.redirect(301, `${path}${url.search}`);
    }
  );
}
