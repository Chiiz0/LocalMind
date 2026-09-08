/**
 * @vitest-environment happy-dom
 */
import { getOrCreateI18n } from '@affine/i18n';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import type { PdfSemanticState } from '../../../../modules/office';
import type { OfficeEditorDraft } from './edit-draft';
import { PdfEditor } from './pdf';
import { openPdf } from './pdf-tools';

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    loading: _loading,
    variant: _variant,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
      variant?: string;
    }
  >) => <button {...props}>{children}</button>,
  IconButton: ({
    children,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      size?: string;
      tooltip?: string;
    }
  >) => <button {...props}>{children}</button>,
}));

vi.mock('@blocksuite/icons/rc', () => ({
  AddCommentIcon: () => null,
  ArrowDownSmallIcon: () => null,
  ArrowUpSmallIcon: () => null,
  DeleteIcon: () => null,
  MinusIcon: () => null,
  PlusIcon: () => null,
  PrinterIcon: () => null,
  RotateIcon: () => null,
  SearchIcon: () => null,
}));

vi.mock('./pdf-tools', () => ({
  openPdf: vi.fn(),
  renderRedactedPdfPage: vi.fn(),
  searchPdfPages: vi.fn(),
}));

const state = {
  schemaVersion: 'localmind-office-pdf-state/v1',
  modelVersion: 'localmind-office-pdf-model/v1',
  pdfVersion: '1.7',
  byteSize: 1024,
  metadata: { keywords: [] },
  pages: [
    {
      id: 'page-1',
      index: 0,
      widthPt: 612,
      heightPt: 792,
      rotationDeg: 0,
      annotations: [
        { id: 'note-1', subtype: 'Highlight', contents: 'Review this' },
        { id: 'field-1', subtype: 'Widget' },
      ],
    },
    {
      id: 'page-2',
      index: 1,
      widthPt: 612,
      heightPt: 792,
      rotationDeg: 0,
      annotations: [],
    },
  ],
  formFields: [],
  compatibility: { signatures: 0, unsupportedFormFields: [] },
  stats: { pages: 2, annotations: 2, formFields: 0 },
} as PdfSemanticState;

describe('PdfEditor', () => {
  const renderPage = vi.fn(() => ({
    cancel: vi.fn(),
    promise: Promise.resolve(),
  }));
  const getPage = vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 612 * scale,
      height: 792 * scale,
    }),
    render: renderPage,
    cleanup: vi.fn(),
  }));

  beforeEach(() => {
    vi.mocked(openPdf).mockResolvedValue({
      document: {
        getPage,
        destroy: vi.fn(async () => {}),
      },
      worker: { destroy: vi.fn() },
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
    } as never);
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly callback: IntersectionObserverCallback) {}

        observe(target: Element) {
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as never
          );
        }

        disconnect() {}
      }
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('Project annotations and signature drafts discard without changing the PDF', async () => {
    const guards = new Set<OfficeEditorDraft>();
    const gql = vi.fn();
    render(
      <PdfEditor
        state={state}
        revision={
          { id: 'revision-1', sequence: 1, packageUrl: 'about:blank' } as never
        }
        artifactId="artifact-1"
        owner={{ kind: 'project', projectId: 'project-1' }}
        graphql={{ gql } as never}
        readOnly={false}
        onRevision={vi.fn()}
        onCommentAnchorChange={vi.fn()}
        onAiSelectionChange={vi.fn()}
        registerDraft={guard => {
          guards.add(guard);
          return () => {
            guards.delete(guard);
          };
        }}
      />
    );
    fireEvent.change(screen.getByLabelText('Annotation comment'), {
      target: { value: 'Draft annotation' },
    });
    fireEvent.change(screen.getByLabelText('Signer name'), {
      target: { value: 'Alice' },
    });
    const guard = [...guards][0];
    expect(guard.hasUnsavedChanges).toBe(true);
    await act(() => guard.discard());
    expect(guard.hasUnsavedChanges).toBe(false);
    expect(gql).not.toHaveBeenCalled();
  });

  test('renders lazy page thumbnails from one shared PDF document', async () => {
    const onCommentAnchorChange = vi.fn();
    const { container } = render(
      <PdfEditor
        state={state}
        revision={
          {
            id: 'revision-1',
            sequence: 1,
            packageUrl: 'about:blank',
          } as never
        }
        artifactId="artifact-1"
        owner={{ kind: 'workspace', workspaceId: 'workspace-1' }}
        graphql={{} as never}
        readOnly={false}
        onRevision={vi.fn()}
        onCommentAnchorChange={onCommentAnchorChange}
        onAiSelectionChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll('canvas[data-page-thumbnail]')
      ).toHaveLength(2);
      expect(renderPage).toHaveBeenCalledTimes(2);
    });
    expect(openPdf).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/notes/i)).toBeNull();

    const firstPage = screen.getByRole('button', {
      name: 'PDF page 1, 1 annotation',
    });
    const secondPage = screen.getByRole('button', {
      name: 'PDF page 2, no annotations',
    });
    expect(firstPage.dataset.annotationCount).toBe('1');
    expect(secondPage.dataset.annotationCount).toBe('0');

    fireEvent.click(secondPage);
    await waitFor(() => {
      expect(onCommentAnchorChange).toHaveBeenLastCalledWith({
        kind: 'pdf',
        revisionId: 'revision-1',
        pageIndex: 1,
      });
    });
  });
});

beforeAll(async () => {
  await getOrCreateI18n().changeLanguage('en');
});
