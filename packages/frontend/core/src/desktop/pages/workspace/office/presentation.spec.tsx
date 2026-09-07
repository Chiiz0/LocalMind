/**
 * @vitest-environment happy-dom
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { PptxSemanticState } from '../../../../modules/office';
import { PresentationEditor } from './presentation';
import type * as SharedModule from './shared';
import { executeAndReloadOfficeCommand } from './shared';

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
  ArrowDownSmallIcon: () => null,
  ArrowUpSmallIcon: () => null,
  DeleteIcon: () => null,
  DuplicateIcon: () => null,
  ImageIcon: () => null,
  PlusIcon: () => null,
  ShapeIcon: () => null,
}));

vi.mock('./shared', async importOriginal => {
  const original = await importOriginal<typeof SharedModule>();
  return {
    ...original,
    executeAndReloadOfficeCommand: vi.fn(),
  };
});

const state = {
  schemaVersion: 'localmind-office-pptx-state/v1',
  modelVersion: 'localmind-office-pptx-model/v1',
  presentationPart: 'ppt/presentation.xml',
  slideSize: { widthPt: 960, heightPt: 540 },
  slides: [
    {
      id: 'slide-1',
      relationshipId: 'rId1',
      part: 'ppt/slides/slide1.xml',
      name: 'Slide 1',
      commentParts: [],
      shapes: [
        {
          id: 'shape-1',
          type: 'shape',
          name: 'Title',
          geometry: {
            xPt: 72,
            yPt: 72,
            widthPt: 360,
            heightPt: 72,
          },
          text: 'LocalMind',
          paragraphs: [{ text: 'LocalMind', runs: [{ text: 'LocalMind' }] }],
          relationshipIds: [],
        },
      ],
    },
  ],
  masters: [
    {
      id: 'master-1',
      relationshipId: 'rId2',
      part: 'ppt/slideMasters/slideMaster1.xml',
      themePart: 'ppt/theme/theme1.xml',
      themeColors: {
        accent1: '#0057B8',
        accent2: '#CC5500',
      },
      layoutParts: [],
      shapes: [],
    },
  ],
  package: { parts: [], opaqueParts: [], externalRelationships: [] },
  compatibility: {
    animationParts: [],
    animatedSlideIds: [],
    unsupportedShapeElements: [],
  },
  stats: {
    slides: 1,
    masters: 1,
    shapes: 1,
    textCharacters: 9,
    packageParts: 0,
    opaqueParts: 0,
  },
} as PptxSemanticState;

describe('PresentationEditor', () => {
  beforeEach(() => {
    vi.mocked(executeAndReloadOfficeCommand).mockResolvedValue({
      revision: {
        id: 'revision-2',
        sequence: 2,
        packageUrl: '/presentation.pptx',
      } as never,
      state,
      preview: {} as never,
      summary: {},
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('loads the selected theme slot and sends it through the command bus', async () => {
    const props = {
      state,
      revision: {
        id: 'revision-1',
        sequence: 1,
        packageUrl: '/presentation.pptx',
      } as never,
      artifactId: 'artifact-1',
      owner: { kind: 'workspace' as const, workspaceId: 'workspace-1' },
      graphql: {} as never,
      readOnly: false,
      onRevision: vi.fn(),
      onCommentAnchorChange: vi.fn(),
      onAiSelectionChange: vi.fn(),
    };
    const { rerender } = render(<PresentationEditor {...props} />);

    const slot = screen.getByLabelText<HTMLSelectElement>('Theme color slot');
    const color = screen.getByLabelText<HTMLInputElement>('Theme color value');
    expect(color.value).toBe('#0057b8');

    fireEvent.change(slot, { target: { value: 'accent2' } });
    await waitFor(() => expect(color.value).toBe('#cc5500'));

    const revisedState = {
      ...state,
      masters: [
        {
          ...state.masters[0],
          themeColors: {
            ...state.masters[0].themeColors,
            accent2: '#123456',
          },
        },
      ],
    } as PptxSemanticState;
    rerender(
      <PresentationEditor
        {...props}
        state={revisedState}
        revision={
          {
            id: 'revision-2',
            sequence: 2,
            packageUrl: '/presentation.pptx',
          } as never
        }
      />
    );
    await waitFor(() => expect(color.value).toBe('#123456'));

    fireEvent.change(color, { target: { value: '#abcdef' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply theme color' }));

    await waitFor(() => {
      expect(executeAndReloadOfficeCommand).toHaveBeenCalledTimes(1);
    });
    expect(
      vi.mocked(executeAndReloadOfficeCommand).mock.calls[0][0].command
    ).toMatchObject({
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-2',
      source: 'user',
      operation: 'office.presentation.theme.color.set',
      masterId: 'master-1',
      slot: 'accent2',
      color: '#abcdef',
    });
  });
});
