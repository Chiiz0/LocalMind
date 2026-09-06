/// <reference types="vite/client" />

import { buildSchema, parse, validate } from 'graphql';
import { expect, test } from 'vitest';

import serverSchema from '../../../../backend/server/src/schema.gql?raw';
import {
  abandonCopilotBlockerMutation,
  confirmCopilotBlockerSuggestionMutation,
  confirmCopilotDocumentDestinationMutation,
  copilotDocumentDestinationFoldersQuery,
  copilotDocumentDestinationWorkspacesQuery,
  copilotDocumentOperationsQuery,
  copilotWorkbenchBlockersGetQuery,
  copilotWorkbenchTaskGetQuery,
  copilotWorkbenchTaskPanelGetQuery,
  copilotWorkbenchTasksGetQuery,
  createCopilotBlockerMutation,
  resolveCopilotBlockerMutation,
  retryCopilotDocumentOperationMutation,
} from '../graphql';

const schema = buildSchema(serverSchema);

test.each([
  abandonCopilotBlockerMutation,
  confirmCopilotBlockerSuggestionMutation,
  confirmCopilotDocumentDestinationMutation,
  copilotDocumentDestinationFoldersQuery,
  copilotDocumentDestinationWorkspacesQuery,
  copilotDocumentOperationsQuery,
  copilotWorkbenchBlockersGetQuery,
  copilotWorkbenchTaskGetQuery,
  copilotWorkbenchTaskPanelGetQuery,
  copilotWorkbenchTasksGetQuery,
  createCopilotBlockerMutation,
  resolveCopilotBlockerMutation,
  retryCopilotDocumentOperationMutation,
])(
  '$id sends a complete executable operation including its fragments',
  operation => {
    expect(
      validate(schema, parse(operation.query)).map(error => error.message)
    ).toEqual([]);
  }
);
