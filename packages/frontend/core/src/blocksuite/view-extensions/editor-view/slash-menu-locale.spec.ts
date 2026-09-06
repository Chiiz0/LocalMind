import type { SlashMenuItem } from '@blocksuite/affine/widgets/slash-menu';
import { describe, expect, it } from 'vitest';

import { chineseSlashVocabulary, localizeSlashItem } from './slash-menu-locale';

describe('Chinese slash vocabulary', () => {
  it.each(Object.entries(chineseSlashVocabulary))(
    'preserves %s identity and adds Chinese, pinyin and initials',
    (id, [label, pinyin, initials]) => {
      const action = () => {};
      const item = {
        id,
        name: id,
        action,
        icon: null,
      } as unknown as SlashMenuItem;
      const translated = localizeSlashItem(item, 'zh-Hans');
      expect(translated.id).toBe(id);
      expect(translated.name).toBe(id);
      expect(translated.label).toBe(label);
      expect(translated.searchAlias).toEqual(
        expect.arrayContaining([label, pinyin, initials])
      );
      expect(localizeSlashItem(item, 'en').label).toBeUndefined();
    }
  );
});
