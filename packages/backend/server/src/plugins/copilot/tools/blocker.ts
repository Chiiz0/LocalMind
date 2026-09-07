import { z } from 'zod';

import { INTELLIGENCE_WORKBENCH_BLOCKER_TYPES } from '../../../models';
import { toolError } from './error';
import { defineTool } from './tool';

type BlockerSuggestionResult = {
  aiSuggestionId: string;
  confirmationProof: string;
  projectId: string;
  title: string;
  type: (typeof INTELLIGENCE_WORKBENCH_BLOCKER_TYPES)[number];
  waitingOn: string;
  dueAt: Date | null;
};

export const createBlockerSuggestionTool = (
  suggest: (input: {
    title: string;
    type: (typeof INTELLIGENCE_WORKBENCH_BLOCKER_TYPES)[number];
    waitingOn: string;
    dueAt?: string;
  }) => Promise<BlockerSuggestionResult>
) =>
  defineTool({
    description:
      "Suggest a reminder-only Blocker when the user asks to track waiting for someone's reply, file, or decision. Return a confirmation card rather than only giving example text. To actually ask a member for a file, use the file request tools instead. This tool never sends messages, creates a Blocker, or changes permissions, approvals, invitations, access requests, or execution state. Present the suggestion to the user and wait for explicit confirmation before the separate confirm mutation is called.",
    inputSchema: z
      .object({
        title: z.string().trim().min(1).max(256),
        type: z.enum(INTELLIGENCE_WORKBENCH_BLOCKER_TYPES),
        waiting_on: z.string().trim().min(1).max(512),
        due_at: z
          .string()
          .datetime({ offset: true })
          .nullish()
          .describe(
            'Optional deadline. Use null when no date or reminder time was requested.'
          ),
      })
      .strict(),
    execute: async ({ title, type, waiting_on, due_at }) => {
      try {
        const suggestion = await suggest({
          title,
          type,
          waitingOn: waiting_on,
          dueAt: due_at ?? undefined,
        });
        return {
          aiSuggestionId: suggestion.aiSuggestionId,
          confirmationProof: suggestion.confirmationProof,
          projectId: suggestion.projectId,
          title: suggestion.title,
          type: suggestion.type,
          waitingOn: suggestion.waitingOn,
          dueAt: suggestion.dueAt?.toISOString() ?? null,
          origin: 'ai_suggested' as const,
          confirmationRequired: true as const,
        };
      } catch (error) {
        return toolError(
          'Blocker Suggestion Failed',
          error instanceof Error ? error.message : 'Blocker suggestion failed'
        );
      }
    },
  });
