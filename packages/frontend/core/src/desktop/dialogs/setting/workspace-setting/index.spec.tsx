/**
 * @vitest-environment happy-dom
 */

import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('./ai-context', () => ({ AIContextSettings: () => null }));
vi.mock('./billing', () => ({ WorkspaceSettingBilling: () => null }));
vi.mock('./directory-permissions', () => ({
  WorkspaceDirectoryPermissions: () => null,
}));
vi.mock('./integration', () => ({ IntegrationSetting: () => null }));
vi.mock('./license', () => ({ WorkspaceSettingLicense: () => null }));
vi.mock('./members', () => ({ MembersPanel: () => null }));
vi.mock('./preference', () => ({ WorkspaceSettingDetail: () => null }));
vi.mock('./properties', () => ({ WorkspaceSettingProperties: () => null }));
vi.mock('./storage', () => ({ WorkspaceSettingStorage: () => null }));
vi.mock('@affine/core/modules/workspace-indexer-embedding', () => ({
  EmbeddingSettings: () => null,
}));

import { WorkspaceSetting } from '.';

describe('WorkspaceSetting', () => {
  test('does not render the removed direct BYOK settings route', () => {
    const { container } = render(
      <WorkspaceSetting
        activeTab={'workspace:byok' as never}
        onChangeSettingState={vi.fn()}
        onCloseSetting={vi.fn()}
      />
    );

    expect(container.textContent).toBe('');
  });
});
