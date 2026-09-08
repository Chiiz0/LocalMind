import { ScrollArea } from '@affine/admin/components/ui/scroll-area';
import { useI18n } from '@affine/i18n';

import { Header } from '../header';
import { AboutAFFiNE } from './about';

export function ConfigPage() {
  const i18n = useI18n();
  return (
    <div className="h-dvh flex-1 space-y-1 flex-col flex">
      <Header
        title={i18n['com.affine.integration.external-mcp.meta.server']()}
      />
      <ScrollArea>
        <AboutAFFiNE />
      </ScrollArea>
    </div>
  );
}

export { ConfigPage as Component };
