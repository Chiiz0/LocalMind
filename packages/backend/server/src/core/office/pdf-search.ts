import { BadRequest } from '../../base';

// PDF.js is also the native PDF viewer's parser. Extract only bounded text;
// document actions, scripts, rendering and external resource fetches are disabled.
export async function pdfSearchText(bytes: Uint8Array, maxCharacters: number) {
  if (bytes.length > 64 * 1024 * 1024)
    throw new BadRequest('PDF text extraction exceeds its byte limit');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: Uint8Array.from(bytes),
    isEvalSupported: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const extract = async () => {
    const document = await task.promise;
    const parts: string[] = [];
    let remaining = maxCharacters;
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(document.numPages, 500) && remaining > 0;
      pageNumber++
    ) {
      const page = await document.getPage(pageNumber);
      const stream = page.streamTextContent().getReader();
      let done = false;
      try {
        while (remaining > 0) {
          const chunk = await stream.read();
          if (chunk.done) {
            done = true;
            break;
          }
          for (const item of chunk.value.items) {
            if (!('str' in item) || remaining <= 0) continue;
            const text = item.str.slice(0, remaining);
            parts.push(text);
            remaining -= text.length + 1;
          }
        }
      } finally {
        if (!done) await stream.cancel(new Error('PDF text budget reached'));
        stream.releaseLock();
        page.cleanup();
      }
    }
    return parts.join(' ').slice(0, maxCharacters);
  };
  try {
    return await Promise.race([
      extract(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new BadRequest('PDF text extraction timed out')),
          15000
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof BadRequest) throw error;
    throw new BadRequest('PDF text could not be extracted');
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}
