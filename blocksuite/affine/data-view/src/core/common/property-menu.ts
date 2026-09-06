import { menu } from '@blocksuite/affine-components/context-menu';
import { html } from 'lit/static-html.js';

import type { PropertyMetaConfig } from '../property/property-config.js';
import { renderUniLit } from '../utils/uni-component/index.js';
import type { Property } from '../view-manager/property.js';

export function propertyTypeItem(
  property: Property,
  config: PropertyMetaConfig
) {
  const source = property.view.manager.dataSource;
  const preview = source.propertyTypeConversionPreview?.(
    property.id,
    config.type
  );
  const chinese = document.documentElement.lang.startsWith('zh');
  const selected = property.type$.value === config.type;
  const change = () => property.typeSet?.(config.type);
  if (!preview || selected || (preview.total === 0 && preview.supported)) {
    return menu.action({
      name: config.config.name,
      isSelected: selected,
      prefix: renderUniLit(config.renderer.icon),
      select: change,
    });
  }
  const blocked = !preview.supported || preview.incompatible > 0;
  const summary = blocked
    ? chinese
      ? `无法转换：${preview.incompatible} 项不兼容，原列保持不变`
      : `Cannot convert: ${preview.incompatible} incompatible values. Original column is preserved.`
    : chinese
      ? `转换 ${preview.total} 行，可撤销`
      : `Convert ${preview.total} rows. This can be undone.`;
  return menu.subMenu({
    name: config.config.name,
    prefix: renderUniLit(config.renderer.icon),
    openOnHover: false,
    options: {
      title: { text: summary },
      items: [
        ...(blocked
          ? []
          : [
              menu.action({
                name: chinese ? '确认转换' : 'Confirm conversion',
                select: element => {
                  const current = source.propertyTypeConversionPreview?.(
                    property.id,
                    config.type
                  );
                  if (
                    !current?.supported ||
                    current.incompatible ||
                    current.total !== preview.total
                  ) {
                    element.setAttribute('role', 'alert');
                    element.textContent = chinese
                      ? '数据或权限已变化，请重新选择字段类型'
                      : 'Data or permissions changed. Select the field type again.';
                    return false;
                  }
                  change();
                  return;
                },
              }),
            ]),
        menu.action({
          name: chinese ? '保留原列' : 'Keep original column',
          select: () => {},
        }),
      ],
    },
  });
}

export const inputConfig = (property: Property) => {
  return menu.input({
    prefix: html`
      <div class="affine-database-column-type-menu-icon">
        ${renderUniLit(property.icon)}
      </div>
    `,
    initialValue: property.name$.value,
    placeholder: 'Property name',
    onBlur: text => {
      property.nameSet(text);
    },
  });
};
export const typeConfig = (property: Property) => {
  return menu.group({
    items: [
      menu.subMenu({
        name: 'Type',
        hide: () => !property.typeCanSet,
        postfix: html` <div
          class="affine-database-column-type-icon"
          style="color: var(--affine-text-secondary-color);gap:4px;font-size: 14px;"
        >
          ${renderUniLit(property.icon)}
          ${property.view.propertyMetas$.value.find(
            v => v.type === property.type$.value
          )?.config.name}
        </div>`,
        options: {
          title: {
            text: 'Property type',
          },
          items: [
            menu.group({
              items: property.view.propertyMetas$.value.map(config =>
                propertyTypeItem(property, config)
              ),
            }),
          ],
        },
      }),
    ],
  });
};
