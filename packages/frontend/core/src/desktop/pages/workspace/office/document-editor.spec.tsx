/** @vitest-environment happy-dom */
import type * as Components from '@affine/component';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { DocxSemanticState } from '../../../../modules/office';
import { DocumentEditor } from './document';
import type { OfficeEditorDraft } from './edit-draft';
import type * as Shared from './shared';
import { executeAndReloadOfficeCommand } from './shared';

vi.mock('@affine/component', async importOriginal => ({
  ...(await importOriginal<typeof Components>()),
  Modal: ({ open, children }: PropsWithChildren<{ open: boolean }>) =>
    open ? <div role="dialog">{children}</div> : null,
}));
vi.mock('./shared', async importOriginal => ({
  ...(await importOriginal<typeof Shared>()),
  executeAndReloadOfficeCommand: vi.fn(),
}));

const state: DocxSemanticState = {
  schemaVersion: 'localmind-office-docx-state/v1',
  modelVersion: 'localmind-office-docx-model/v1',
  documentPart: 'word/document.xml',
  body: [
    {
      id: 'paragraph-1',
      type: 'paragraph',
      text: 'Before',
      runs: [{ content: [{ type: 'text', text: 'Before' }] }],
      fields: [],
      bookmarks: [],
    },
  ],
  styles: [],
  sections: [],
  stories: [],
  notes: { footnotes: [], endnotes: [] },
  references: {
    fields: [],
    bookmarks: [],
    tableOfContentsFields: [],
    crossReferenceFields: [],
    mailMergeFields: [],
  },
  review: { trackRevisions: false, comments: [], changes: [] },
  package: { parts: [], opaqueParts: [], externalRelationships: [] },
  compatibility: { unsupportedBodyElements: [] },
  stats: {
    blocks: 1,
    paragraphs: 1,
    runs: 1,
    textCharacters: 6,
    tables: 0,
    styles: 0,
    sections: 0,
    headersFooters: 0,
    footnotes: 0,
    endnotes: 0,
    fields: 0,
    bookmarks: 0,
    comments: 0,
    changes: 0,
    objects: 0,
    packageParts: 0,
    opaqueParts: 0,
    externalRelationships: 0,
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(editParagraph = true) {
  const guards = new Set<OfficeEditorDraft>();
  const onRevision = vi.fn();
  render(
    <DocumentEditor
      state={state}
      revision={
        { id: 'revision-1', sequence: 1, packageUrl: '/document.docx' } as never
      }
      artifactId="artifact-1"
      owner={{ kind: 'project', projectId: 'project-1' }}
      graphql={{} as never}
      readOnly={false}
      onRevision={onRevision}
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
  const paragraph = screen.getByLabelText('Editable document paragraph');
  if (editParagraph) {
    paragraph.textContent = 'After';
    fireEvent.input(paragraph);
  }
  return { paragraph, guard: [...guards][0], guards, onRevision };
}

describe('Project native document drafts', () => {
  test('opening a layout dialog is clean and discarding form edits never writes', async () => {
    const { guards } = setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Page setup' }));
    expect([...guards].some(guard => guard.hasUnsavedChanges)).toBe(false);
    const width = screen.getByLabelText('Page width (pt)');
    fireEvent.change(width, { target: { value: '600' } });
    const draft = [...guards].find(guard => guard.hasUnsavedChanges);
    expect(draft).toBeDefined();
    await act(() => draft!.discard());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(executeAndReloadOfficeCommand).not.toHaveBeenCalled();
  });

  test('blur and discard never execute the draft as a command', async () => {
    const { paragraph, guard } = setup();
    fireEvent.blur(paragraph);
    expect(guard.hasUnsavedChanges).toBe(true);
    expect(executeAndReloadOfficeCommand).not.toHaveBeenCalled();
    await act(() => guard.discard());
    expect(guard.hasUnsavedChanges).toBe(false);
    expect(paragraph.textContent).toBe('Before');
    expect(executeAndReloadOfficeCommand).not.toHaveBeenCalled();
  });

  test('explicit save retains expected revision and clears only a successful draft', async () => {
    const { guard, onRevision } = setup();
    vi.mocked(executeAndReloadOfficeCommand).mockRejectedValueOnce(
      new Error('conflict')
    );
    await expect(guard.save()).rejects.toThrow('conflict');
    expect(guard.hasUnsavedChanges).toBe(true);
    vi.mocked(executeAndReloadOfficeCommand).mockResolvedValueOnce({
      revision: { id: 'revision-2', sequence: 2 } as never,
      state,
      preview: {} as never,
      summary: {},
    });
    await act(() => guard.save());
    expect(
      vi.mocked(executeAndReloadOfficeCommand).mock.lastCall?.[0].command
    ).toMatchObject({
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-1',
      operation: 'office.document.text.replace',
    });
    expect(guard.hasUnsavedChanges).toBe(false);
    expect(onRevision).toHaveBeenCalledOnce();
  });
});
