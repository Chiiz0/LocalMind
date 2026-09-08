import { describe, expect, it } from 'vitest';

import { translationCoverage } from './coverage';

describe('translation coverage', () => {
  it('never reports complete when even one source entry is missing', () => {
    const source = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [String(i), 'Text'])
    );
    expect(translationCoverage(source, { ...source, 999: '' })).toBe(99);
    expect(translationCoverage(source, source)).toBe(100);
  });

  it('ignores obsolete keys and whitespace-only values', () => {
    expect(
      translationCoverage(
        { a: 'A', b: 'B' },
        { a: '翻译', b: '  ', obsolete: '旧翻译' }
      )
    ).toBe(50);
  });

  it('counts regional translations together with their base language', () => {
    expect(
      translationCoverage({ a: 'A', b: 'B' }, { a: 'Regional' }, { b: 'Base' })
    ).toBe(100);
  });
});
