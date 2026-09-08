import { gqlFetcherFactory, uploadProjectBlobMutation } from '@affine/graphql';

export type ProjectUploadProgress = { loaded: number; total: number };

export async function uploadProjectBlobWithProgress(input: {
  baseUrl: string;
  projectId: string;
  file: File;
  signal: AbortSignal;
  onProgress: (progress: ProjectUploadProgress) => void;
}) {
  const gql = gqlFetcherFactory(
    '/graphql',
    (url, init) =>
      new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        xhr.open('POST', new URL(url, input.baseUrl));
        xhr.withCredentials = true;
        xhr.timeout = 120_000;
        xhr.responseType = 'blob';
        const headers = new Headers(init?.headers);
        headers.set('x-affine-version', BUILD_CONFIG.appVersion);
        headers.set(
          'x-affine-client-kind',
          BUILD_CONFIG.isNative ? 'native' : 'web'
        );
        headers.forEach((value, key) => xhr.setRequestHeader(key, value));
        xhr.upload.onprogress = event => {
          if (event.lengthComputable)
            input.onProgress({ loaded: event.loaded, total: event.total });
        };
        xhr.onload = () =>
          resolve(
            new Response(xhr.response, {
              status: xhr.status,
              headers: {
                'content-type':
                  xhr.getResponseHeader('content-type') ??
                  'application/octet-stream',
              },
            })
          );
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.ontimeout = () =>
          reject(new DOMException('Upload timed out', 'TimeoutError'));
        xhr.onabort = () =>
          reject(new DOMException('Upload cancelled', 'AbortError'));
        xhr.onloadend = () => input.signal.removeEventListener('abort', abort);
        if (input.signal.aborted) {
          reject(input.signal.reason);
          return;
        }
        input.signal.addEventListener('abort', abort, { once: true });
        xhr.send(init?.body as FormData);
      })
  );
  const result = await gql({
    query: uploadProjectBlobMutation,
    variables: { projectId: input.projectId, file: input.file },
    signal: input.signal,
  });
  return result.uploadProjectBlob;
}
