import { z } from 'zod';

import type { Workbench } from '../entities/workbench';

const pathSchema = z.object({
  pathname: z
    .string()
    .max(4096)
    .regex(/^\/(?!\/)/),
  search: z.string().max(8192),
  hash: z.string().max(4096),
});

export const browserWorkbenchStateSchema = z
  .object({
    localmindWorkbench: z.literal(1),
    basename: z.string(),
    activeViewIndex: z.number().int().min(0),
    views: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          path: pathSchema,
          size: z.number().positive().max(10000),
          scrollTop: z.number().min(0).max(10000000).optional(),
        })
      )
      .min(1)
      .max(20),
  })
  .refine(
    state =>
      state.activeViewIndex < state.views.length &&
      new Set(state.views.map(view => view.id)).size === state.views.length
  );

export type BrowserWorkbenchState = z.infer<typeof browserWorkbenchStateSchema>;

export function captureWorkbenchState(
  workbench: Workbench,
  basename: string
): BrowserWorkbenchState {
  return {
    localmindWorkbench: 1,
    basename,
    activeViewIndex: workbench.activeViewIndex$.value,
    views: workbench.views$.value.map(view => {
      const { pathname, search, hash } = view.history.location;
      const scroll = view.getScrollPosition();
      return {
        id: view.id,
        path: { pathname, search, hash },
        size: view.size$.value,
        ...(typeof scroll === 'number' ? { scrollTop: scroll } : {}),
      };
    }),
  };
}

export function readBrowserWorkbenchState(
  value: unknown,
  basename: string,
  path: string
) {
  const result = browserWorkbenchStateSchema.safeParse(value);
  if (!result.success || result.data.basename !== basename) return null;
  const active = result.data.views[result.data.activeViewIndex].path;
  return `${basename}${active.pathname}${active.search}${active.hash}` === path
    ? result.data
    : null;
}
