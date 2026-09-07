import type { EditorHost } from '@blocksuite/affine/std';

import {
  type AIActionId,
  type AIActionOptions,
  resolveActionPromptName,
} from '../runtime/request';
import { getAIPanelWidget } from '../utils/ai-widgets';

export async function applyActionModelId(
  host: EditorHost,
  actionId: AIActionId,
  options: AIActionOptions
) {
  const promptName = resolveActionPromptName(actionId, options);
  const explicitModelId =
    typeof options.modelId === 'string' ? options.modelId.trim() : '';

  if (explicitModelId) {
    options.modelSelection = {
      modelId: explicitModelId,
      promptName,
      source: 'explicit',
    };
    return options;
  }

  if (!options.workspaceId) {
    options.modelSelection = { promptName, source: 'unresolved' };
    return options;
  }
  const modelId = await getAIPanelWidget(host).config?.resolveActionModelId?.({
    actionId,
    promptName,
    workspaceId: options.workspaceId,
    docId: options.docId,
    options: { ...options, workspaceId: options.workspaceId },
  });

  if (modelId) {
    options.modelId = modelId;
    options.modelSelection = {
      modelId,
      promptName,
      source: 'prompt_preference',
    };
  } else {
    options.modelSelection = {
      promptName,
      source: 'unresolved',
    };
  }

  return options;
}
