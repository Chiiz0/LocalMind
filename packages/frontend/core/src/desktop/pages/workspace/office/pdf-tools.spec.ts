/** @vitest-environment happy-dom */
import { afterEach, expect, test, vi } from 'vitest';

import { openPdf } from './pdf-tools';

const pdf = vi.hoisted(() => ({
  createWorker: vi.fn(() => ({ destroy: vi.fn() })),
  getDocument: vi.fn(() => ({ promise: Promise.resolve({ numPages: 52 }) })),
}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  PDFWorker: { create: pdf.createWorker },
  getDocument: pdf.getDocument,
}));
const originalUrl = window.location.href;
afterEach(() => {
  window.location.href = originalUrl;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('PDF rendering fetches the authenticated Project package through the local frontend proxy', async () => {
  vi.stubGlobal('BUILD_CONFIG', { ...BUILD_CONFIG, debug: true, isWeb: true });
  vi.stubGlobal('Worker', class {});
  window.location.href = 'http://localhost:8081/project/p';
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal('fetch', fetch);
  const result = await openPdf(
    'http://localhost:3011/api/projects/p/office/artifacts/a/revisions/r/package'
  );
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8081/api/projects/p/office/artifacts/a/revisions/r/package',
    { credentials: 'include' }
  );
  expect(result.document.numPages).toBe(52);
  expect(pdf.getDocument).toHaveBeenCalledWith(
    expect.objectContaining({
      data: new Uint8Array([1, 2, 3]),
      isEvalSupported: false,
    })
  );
});

test('a rejected package request cannot start a PDF worker', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
  );
  await expect(
    openPdf(
      'https://localmind.test/api/projects/p/office/artifacts/a/revisions/r/package'
    )
  ).rejects.toThrow(/403/);
  expect(pdf.createWorker).not.toHaveBeenCalled();
});
