import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import * as officeChatStyles from '../workspace/office/chat.css';

// Native details wraps its body, so constrain scrolling on the disclosure itself.
export const taskRegion = style([
  officeChatStyles.taskRegion,
  {
    display: 'block',
    flexShrink: 0,
    maxHeight: 'min(276px, 35%)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    background: cssVarV2('layer/background/primary'),
  },
]);

export const taskSummary = style([
  officeChatStyles.taskHeader,
  {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: cssVarV2('layer/background/primary'),
  },
]);
