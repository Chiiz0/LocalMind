import { officeAssetUrl } from '@affine/core/modules/office';
import { I18n } from '@affine/i18n';
export type PdfSearchResult = {
  pageIndex: number;
  matches: number;
  snippet: string;
};

type PdfRect = {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
};

async function fetchPdfBytes(url: string) {
  const response = await fetch(officeAssetUrl(url), { credentials: 'include' });
  if (!response.ok) {
    throw new Error(
      I18n['com.affine.office.pdf-load-failed']({
        status: String(response.status),
      })
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function openPdf(url: string) {
  const pdfJs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = await fetchPdfBytes(url);
  const port = new Worker(new URL('./pdf.worker.ts', import.meta.url), {
    type: 'module',
  });
  const worker = pdfJs.PDFWorker.create({ port });
  const task = pdfJs.getDocument({
    data,
    worker,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  try {
    return { document: await task.promise, worker };
  } catch (error) {
    worker.destroy();
    throw error;
  }
}

function pageText(items: readonly unknown[]) {
  return items
    .flatMap(item =>
      item &&
      typeof item === 'object' &&
      'str' in item &&
      typeof item.str === 'string'
        ? [item.str]
        : []
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchPdfPages(url: string, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const opened = await openPdf(url);
  const results: PdfSearchResult[] = [];
  try {
    for (
      let pageNumber = 1;
      pageNumber <= opened.document.numPages;
      pageNumber++
    ) {
      const page = await opened.document.getPage(pageNumber);
      const text = pageText((await page.getTextContent()).items);
      const lower = text.toLocaleLowerCase();
      let cursor = 0;
      let matches = 0;
      let first = -1;
      while ((cursor = lower.indexOf(normalized, cursor)) !== -1) {
        if (first === -1) first = cursor;
        matches++;
        cursor += Math.max(1, normalized.length);
      }
      if (matches) {
        const start = Math.max(0, first - 60);
        const end = Math.min(text.length, first + normalized.length + 100);
        results.push({
          pageIndex: pageNumber - 1,
          matches,
          snippet: `${start ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`,
        });
      }
      page.cleanup();
    }
    return results;
  } finally {
    await opened.document.destroy();
    opened.worker.destroy();
  }
}

function canvasPngBase64(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(
          new Error(
            I18n['com.affine.office.failed-to-encode-the-redacted-pdf-page']()
          )
        );
        return;
      }
      const reader = new FileReader();
      reader.onerror = () =>
        reject(
          new Error(I18n['com.affine.office.failed-to-read-redacted-page']())
        );
      reader.onload = () => {
        const value = String(reader.result ?? '');
        resolve(value.slice(value.indexOf(',') + 1));
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

export async function renderRedactedPdfPage(
  url: string,
  pageIndex: number,
  pageSize: { widthPt: number; heightPt: number },
  rects: readonly PdfRect[]
) {
  const opened = await openPdf(url);
  try {
    const page = await opened.document.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context)
      throw new Error(
        I18n['com.affine.office.canvas-rendering-is-unavailable']()
      );
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    const scaleX = canvas.width / pageSize.widthPt;
    const scaleY = canvas.height / pageSize.heightPt;
    context.save();
    context.fillStyle = '#000000';
    for (const rect of rects) {
      context.fillRect(
        rect.xPt * scaleX,
        (pageSize.heightPt - rect.yPt - rect.heightPt) * scaleY,
        rect.widthPt * scaleX,
        rect.heightPt * scaleY
      );
    }
    context.restore();
    page.cleanup();
    return await canvasPngBase64(canvas);
  } finally {
    await opened.document.destroy();
    opened.worker.destroy();
  }
}
