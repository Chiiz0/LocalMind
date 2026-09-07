/** @vitest-environment happy-dom */
import {
  changeProjectFileRequestMutation,
  projectFileRequestQuery,
  submitProjectFileRequestMutation,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => {
  const gql = vi.fn();
  return {
    gql,
    service: {
      gql,
      server: { serverMetadata: { baseUrl: 'http://localhost:3013' } },
    },
    changed: vi.fn(),
    t: new Proxy({}, { get: (_, key) => () => String(key) }),
  };
});
vi.mock('@affine/core/modules/cloud', () => ({
  GraphQLService: class {},
  ServerService: class {},
}));
vi.mock('@toeverything/infra', () => ({ useService: () => state.service }));
vi.mock('@affine/i18n', () => ({ useI18n: () => state.t }));
vi.mock('@affine/component', () => ({
  Button: ({
    loading: _loading,
    variant: _variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
  }) => <button {...props} />,
  IconButton: ({
    icon,
    tooltip: _tooltip,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactNode;
    tooltip?: string;
  }) => <button {...props}>{icon}</button>,
  Modal: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

import { ProjectFileRequestDetail } from './detail';

const key = (name: string) => `com.affine.localmind.fileRequest.${name}`;
const request = {
  id: 'request',
  projectId: 'project',
  projectName: 'Project',
  requesterName: 'Sender',
  recipientName: 'member-01',
  title: 'a.txt',
  status: 'pending',
  version: 1,
  isRecipient: true,
  fileName: null,
  resourceId: null,
  updatedAt: new Date().toISOString(),
};
beforeEach(() => {
  state.gql.mockReset();
  state.changed.mockReset();
  state.gql.mockResolvedValue({ projectFileRequest: request });
});
afterEach(cleanup);

test('recipient must choose a file and confirm sharing; duplicate submits make one mutation', async () => {
  render(
    <ProjectFileRequestDetail requestId="request" onChanged={state.changed} />
  );
  const button = await screen.findByRole('button', { name: key('submit') });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText(key('choose')), {
    target: { files: [new File(['a'], 'a.txt')] },
  });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  let resolve!: (value: unknown) => void;
  state.gql.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  fireEvent.click(button);
  fireEvent.click(button);
  expect(
    state.gql.mock.calls.filter(
      ([input]) => input.query === submitProjectFileRequestMutation
    )
  ).toHaveLength(1);
  expect(state.gql.mock.lastCall?.[0].variables).toMatchObject({
    requestId: 'request',
    expectedVersion: 1,
    shareWithProject: true,
  });
  resolve({
    submitProjectFileRequest: {
      ...request,
      status: 'completed',
      version: 2,
      fileName: 'a.txt',
      resourceId: 'file',
    },
  });
  expect((await screen.findByRole('link')).getAttribute('href')).toBe(
    'http://localhost:3013/api/project-file-requests/request/file'
  );
  expect(state.changed).toHaveBeenCalledTimes(1);
});

test('sender sees cancellation confirmation and cannot submit on behalf of the recipient', async () => {
  state.gql.mockResolvedValueOnce({
    projectFileRequest: { ...request, isRecipient: false },
  });
  render(<ProjectFileRequestDetail requestId="request" />);
  fireEvent.click(await screen.findByRole('button', { name: key('cancel') }));
  expect(state.gql).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: key('submit') })).toBeNull();
  state.gql.mockResolvedValueOnce({
    changeProjectFileRequest: {
      ...request,
      isRecipient: false,
      status: 'cancelled',
      version: 2,
    },
  });
  fireEvent.click(screen.getByRole('button', { name: key('confirm') }));
  await waitFor(() =>
    expect(state.gql).toHaveBeenLastCalledWith({
      query: changeProjectFileRequestMutation,
      variables: { requestId: 'request', expectedVersion: 1, action: 'cancel' },
    })
  );
});

test('unavailable request removes actions and can be retried', async () => {
  state.gql.mockRejectedValueOnce(new Error('Permission revoked'));
  render(<ProjectFileRequestDetail requestId="request" />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    key('unavailable')
  );
  expect(screen.queryByRole('button', { name: key('submit') })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: key('refresh') }));
  await screen.findByRole('button', { name: key('submit') });
  expect(state.gql.mock.lastCall?.[0].query).toBe(projectFileRequestQuery);
});

test('oversized file is rejected and a stale-version error leaves the request recoverable', async () => {
  render(<ProjectFileRequestDetail requestId="request" />);
  await screen.findByRole('button', { name: key('submit') });
  const large = new File(['a'], 'large.txt');
  Object.defineProperty(large, 'size', { value: 33 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText(key('choose')), {
    target: { files: [large] },
  });
  expect(screen.getByRole('alert').textContent).toContain(key('tooLarge'));
  state.gql.mockRejectedValueOnce(new Error('version changed'));
  fireEvent.click(screen.getByRole('button', { name: key('start') }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(key('failed'))
  );
  expect(
    screen
      .getByRole('button', { name: key('refresh') })
      .hasAttribute('disabled')
  ).toBe(false);
});
