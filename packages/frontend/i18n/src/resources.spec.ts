import { expect, test } from 'vitest';

import { translationCoverage } from './coverage';
import en from './resources/en.json';
import zh from './resources/zh-Hans.json';

test('Simplified Chinese covers every English resource without empty entries', () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  expect(translationCoverage(en, zh)).toBe(100);
});

test('Office and Admin translations preserve interpolation parameters', () => {
  const parameters = (text: string) =>
    [...text.matchAll(/{{\s*([\w.]+)\s*}}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    if (!/^com\.affine\.(office|admin)\./.test(key)) continue;
    expect(parameters(zh[key]), key).toEqual(parameters(en[key]));
  }
});
