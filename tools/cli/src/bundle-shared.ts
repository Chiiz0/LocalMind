import type { DevServerMiddlewareHandler } from '@rspack/core';
import type { Configuration as RspackDevServerConfiguration } from '@rspack/dev-server';

export const RSPACK_SUPPORTED_PACKAGES = [
  '@affine/admin',
  '@affine/web',
  '@affine/mobile',
  '@affine/ios',
  '@affine/android',
  '@affine/electron-renderer',
  '@affine/server',
  '@affine/reader',
] as const;

const rspackSupportedPackageSet = new Set<string>(RSPACK_SUPPORTED_PACKAGES);
const devServerProxyTarget =
  process.env.AFFINE_DEV_SERVER_PROXY_TARGET || 'http://localhost:3010';
const selfHostedAdminAssetPathPattern =
  /^\/admin\/(?:(?:assets|fonts|js|static|workers)\/|[^/?#]+\.[^/?#]+)/;

export function isRspackSupportedPackageName(name: string) {
  return rspackSupportedPackageSet.has(name);
}

export function assertRspackSupportedPackageName(name: string) {
  if (isRspackSupportedPackageName(name)) {
    return;
  }

  throw new Error(
    `Rspack bundling currently supports: ${Array.from(RSPACK_SUPPORTED_PACKAGES).join(', ')}. Unsupported package: ${name}.`
  );
}

function rewriteSelfHostedAdminAssetPath(url: string | undefined) {
  if (process.env.SELF_HOSTED !== 'true' || !url) {
    return url;
  }

  const separatorIndex = url.search(/[?#]/);
  const pathname = separatorIndex === -1 ? url : url.slice(0, separatorIndex);

  if (!selfHostedAdminAssetPathPattern.test(pathname)) {
    return url;
  }

  return pathname.slice('/admin'.length) + url.slice(pathname.length);
}

// A local dev proxy represents its own frontend to a production-mode local server.
// Keep foreign origins intact so the server can reject them normally.
export function rewriteDevProxyOrigin(
  origin: string | undefined,
  host: string | undefined,
  target: string
) {
  if (!origin || !host) return origin;
  try {
    const source = new URL(origin);
    const destination = new URL(target);
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    if (
      source.host === host &&
      loopback.has(source.hostname) &&
      loopback.has(destination.hostname) &&
      ['http:', 'https:'].includes(source.protocol) &&
      ['http:', 'https:'].includes(destination.protocol)
    )
      return destination.origin;
  } catch {
    // Malformed origins remain subject to the server's normal validation.
  }
  return origin;
}

export const DEFAULT_DEV_SERVER_CONFIG: RspackDevServerConfiguration = {
  host: '0.0.0.0',
  allowedHosts: 'all',
  hot: false,
  liveReload: true,
  compress: !process.env.CI,
  setupExitSignals: true,
  client: {
    overlay: process.env.DISABLE_DEV_OVERLAY === 'true' ? false : undefined,
    logging: process.env.CI ? 'none' : 'error',
    // see: https://webpack.js.org/configuration/dev-server/#websocketurl
    // must be an explicit ws/wss URL because custom protocols (e.g. assets://)
    // cannot be used to construct WebSocket endpoints in Electron
    webSocketURL: 'ws://0.0.0.0:8080/ws',
  },
  historyApiFallback: {
    rewrites: [
      {
        from: /.*/,
        to: () => {
          return process.env.SELF_HOSTED === 'true'
            ? '/selfhost.html'
            : '/index.html';
        },
      },
    ],
  },
  setupMiddlewares: middlewares => {
    middlewares.unshift({
      name: 'self-hosted-admin-asset-public-path',
      middleware: ((req, _res, next) => {
        req.url = rewriteSelfHostedAdminAssetPath(req.url);
        if (/^\/(api|graphql|socket\.io)(\/|\?|$)/.test(req.url ?? '')) {
          const origin = rewriteDevProxyOrigin(
            req.headers.origin,
            req.headers.host,
            devServerProxyTarget
          );
          if (origin) req.headers.origin = origin;
        }
        next();
      }) satisfies DevServerMiddlewareHandler,
    });

    return middlewares;
  },
  proxy: [
    {
      context: '/api',
      target: devServerProxyTarget,
    },
    {
      context: '/socket.io',
      target: devServerProxyTarget,
      ws: true,
    },
    {
      context: '/graphql',
      target: devServerProxyTarget,
    },
  ],
};
