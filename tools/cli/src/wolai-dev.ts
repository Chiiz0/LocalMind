import { Workspace } from '@affine-tools/utils/workspace';

import { BundleCommand } from './bundle';

await BundleCommand.dev(new Workspace().getPackage('@affine/web'), {
  host: '127.0.0.1',
  port: 8086,
  client: { webSocketURL: 'ws://127.0.0.1:8086/ws' },
});
