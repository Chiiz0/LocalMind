import { openPdfPackage } from '@localmind/office/pdf';
import { createMinimalPdfFixture } from '@localmind/office/testing';
import test from 'ava';

import {
  OFFICE_FORMATS,
  officePackageSearchText,
  readNativeOfficeState,
} from '../../core/office/formats';
import { pdfSearchText } from '../../core/office/pdf-search';

test('PDF text extraction reads real page content independently of metadata and respects the character budget', async t => {
  const pkg = await openPdfPackage(await createMinimalPdfFixture());
  pkg.document.setTitle('Neutral metadata');
  pkg.document
    .getPage(0)
    .drawText('UNIQUE_PROJECT_PDF_BODY', { x: 40, y: 500 });
  const bytes = await pkg.document.save();
  const state = await readNativeOfficeState(
    OFFICE_FORMATS.pdf,
    Buffer.from(bytes)
  );
  t.false(JSON.stringify(state).includes('UNIQUE_PROJECT_PDF_BODY'));
  t.true(
    (await officePackageSearchText(state, bytes)).includes(
      'UNIQUE_PROJECT_PDF_BODY'
    )
  );
  t.is((await pdfSearchText(bytes, 6)).length, 6);
  await t.throwsAsync(pdfSearchText(new Uint8Array([1, 2, 3]), 100));
});
