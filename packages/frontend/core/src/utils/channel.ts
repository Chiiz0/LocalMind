import { I18n } from '@affine/i18n';
import { z } from 'zod';

export const appSchemes = z.enum([
  'localmind',
  'localmind-canary',
  'localmind-beta',
  'localmind-internal',
  'localmind-dev',
  'affine',
  'affine-canary',
  'affine-beta',
  'affine-internal',
  'affine-dev',
]);

export type Scheme = z.infer<typeof appSchemes>;
export type Channel = 'stable' | 'canary' | 'beta' | 'internal';

export const schemeToChannel = {
  localmind: 'stable',
  'localmind-canary': 'canary',
  'localmind-beta': 'beta',
  'localmind-internal': 'internal',
  'localmind-dev': 'canary',
  affine: 'stable',
  'affine-canary': 'canary',
  'affine-beta': 'beta',
  'affine-internal': 'internal',
  'affine-dev': 'canary', // dev does not have a dedicated app. use canary as the placeholder.
} as Record<Scheme, Channel>;

export const channelToScheme = {
  stable: 'localmind',
  canary: BUILD_CONFIG.debug ? 'localmind-dev' : 'localmind-canary',
  beta: 'localmind-beta',
  internal: 'localmind-internal',
} as Record<Channel, Scheme>;

export const appIconMap = {
  stable: '/imgs/app-icon-stable.ico',
  canary: '/imgs/app-icon-canary.ico',
  beta: '/imgs/app-icon-beta.ico',
  internal: '/imgs/app-icon-internal.ico',
} satisfies Record<Channel, string>;

export const appNames = {
  stable: 'LocalMind',
  canary: 'LocalMind Canary',
  beta: 'LocalMind Beta',
  internal: 'LocalMind Internal',
} satisfies Record<Channel, string>;

export const appSchemaUrl = z.custom<string>(
  (url: string) => {
    try {
      return appSchemes.safeParse(new URL(url).protocol.replace(':', ''))
        .success;
    } catch {
      return false;
    }
  },
  {
    get message() {
      return I18n['com.affine.ui.invalid-url-or-protocol']();
    },
  }
);
