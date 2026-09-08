import { SWRConfigProvider } from '@affine/core/components/providers/swr-config-provider';
import { DefaultServerService } from '@affine/core/modules/cloud';
import { useAppLayoutReady } from '@affine/core/modules/desktop-api';
import { FrameworkScope, useService } from '@toeverything/infra';

import { GlobalTasksComponent } from '../workspace/tasks';

export const Component = () => {
  useAppLayoutReady();
  const server = useService(DefaultServerService).server;

  return (
    <FrameworkScope scope={server?.scope}>
      <SWRConfigProvider>
        <GlobalTasksComponent />
      </SWRConfigProvider>
    </FrameworkScope>
  );
};
