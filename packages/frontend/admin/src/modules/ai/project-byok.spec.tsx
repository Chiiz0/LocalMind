/**
 * @vitest-environment happy-dom
 */
import {
  ByokProvider,
  saveProjectByokConfigMutation,
  setProjectByokEnabledMutation,
  testProjectByokConfigMutation,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  configured: false,
  enabled: false,
  revision: 0,
  busy: false,
  error: undefined as Error | undefined,
  save: vi.fn(),
  test: vi.fn(),
  toggle: vi.fn(),
  reload: vi.fn(),
}));

vi.mock('@affine/admin/use-query', () => ({
  useQuery: () => ({
    data: {
      adminProjectByokSettings: {
        configured: state.configured,
        enabled: state.enabled,
        revision: state.revision,
        provider: ByokProvider.openai,
        endpoint: null,
        modelId: state.configured ? 'global-model' : null,
        allowedProviders: [ByokProvider.openai, ByokProvider.anthropic],
        customEndpointSupported: true,
        auditEvents: [],
        lastError: null,
      },
    },
    error: state.error,
    isValidating: false,
    mutate: state.reload,
  }),
}));

vi.mock('@affine/admin/use-mutation', () => ({
  useMutation: ({ mutation }: { mutation: unknown }) => ({
    isMutating: state.busy,
    trigger:
      mutation === saveProjectByokConfigMutation
        ? state.save
        : mutation === testProjectByokConfigMutation
          ? state.test
          : mutation === setProjectByokEnabledMutation
            ? state.toggle
            : undefined,
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ProjectByokAdmin } from './project-byok';

beforeEach(() => {
  state.configured = false;
  state.enabled = false;
  state.revision = 0;
  state.busy = false;
  state.error = undefined;
  state.save.mockReset().mockResolvedValue({});
  state.test
    .mockReset()
    .mockResolvedValue({ testProjectByokConfig: { ok: true, message: null } });
  state.toggle.mockReset().mockResolvedValue({});
  state.reload.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('saves one global configuration with no workspace or user assignment', async () => {
  render(<ProjectByokAdmin />);
  expect(screen.queryByText('Workspace')).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Verify and save',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Model ID'), {
    target: { value: 'project-model' },
  });
  fireEvent.change(screen.getByLabelText('API key'), {
    target: { value: 'new-key' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and save' }));
  await waitFor(() =>
    expect(state.save).toHaveBeenCalledWith({
      input: {
        expectedRevision: 0,
        provider: 'openai',
        endpoint: null,
        modelId: 'project-model',
        apiKey: 'new-key',
      },
    })
  );
  await waitFor(() =>
    expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe(
      ''
    )
  );
  expect(state.reload).toHaveBeenCalled();
});

test('editing retains saved credentials without returning a key to the browser', async () => {
  state.configured = true;
  state.enabled = true;
  state.revision = 4;
  render(<ProjectByokAdmin />);
  expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Verify and save' }));
  await waitFor(() =>
    expect(state.save).toHaveBeenCalledWith({
      input: {
        expectedRevision: 4,
        provider: 'openai',
        endpoint: null,
        modelId: 'global-model',
        apiKey: undefined,
      },
    })
  );
});

test('failed probes give feedback and do not save or enable the global configuration', async () => {
  state.configured = true;
  state.test.mockResolvedValue({
    testProjectByokConfig: { ok: false, message: 'Provider rejected the key.' },
  });
  render(<ProjectByokAdmin />);
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Provider rejected the key.'
    )
  );
  expect(state.save).not.toHaveBeenCalled();
  expect(state.toggle).not.toHaveBeenCalled();
});

test('disabled controls block repeated actions and loading errors offer reload', () => {
  state.configured = true;
  state.busy = true;
  const { rerender } = render(<ProjectByokAdmin />);
  expect(screen.queryByRole('button', { name: 'Verify and save' })).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'Verifying...' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(
    (screen.getByLabelText('API key') as HTMLInputElement).closest('fieldset')
      ?.disabled
  ).toBe(true);
  state.busy = false;
  state.error = new Error('offline');
  rerender(<ProjectByokAdmin />);
  expect(screen.getByRole('alert').textContent).toContain(
    'Reload before saving'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reload Project BYOK' }));
  expect(state.reload).toHaveBeenCalled();
});

test('disabling all project conversations requires confirmation', async () => {
  state.configured = true;
  state.enabled = true;
  state.revision = 3;
  const confirm = vi.fn().mockReturnValue(false);
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    writable: true,
    value: confirm,
  });
  render(<ProjectByokAdmin />);
  fireEvent.click(screen.getByRole('switch', { name: 'Project AI enabled' }));
  expect(confirm).toHaveBeenCalled();
  expect(state.toggle).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('switch', { name: 'Project AI enabled' }));
  await waitFor(() =>
    expect(state.toggle).toHaveBeenCalledWith({
      expectedRevision: 3,
      enabled: false,
    })
  );
});
