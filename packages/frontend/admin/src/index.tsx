import './global.css';
import './setup';

import { createRoot } from 'react-dom/client';

import { App } from './app';
import { AdminI18nProvider } from './i18n';

// oxlint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('app')!).render(
  <AdminI18nProvider>
    <App />
  </AdminI18nProvider>
);
