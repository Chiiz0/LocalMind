import { z } from 'zod';

const projectSearchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
      title: z.string(),
      snippet: z.string(),
    })
  ),
});

const keywordSearchSchema = z.array(
  z.object({ docId: z.string().min(1), title: z.string() })
);

const semanticSearchSchema = z.array(
  z.object({
    docId: z.string().min(1).optional(),
    title: z.string().optional(),
    content: z.string(),
  })
);

interface DocSearchResults {
  scope: 'project' | 'workspace';
  items: Array<{ docId?: string; title?: string; content?: string }>;
}

export function parseDocSearchResults(
  value: unknown,
  kind: 'keyword' | 'semantic'
): DocSearchResults | null {
  if (Array.isArray(value)) {
    const parsed = (
      kind === 'keyword' ? keywordSearchSchema : semanticSearchSchema
    ).safeParse(value);
    return parsed.success ? { scope: 'workspace', items: parsed.data } : null;
  }
  const parsed = projectSearchSchema.safeParse(value);
  return parsed.success
    ? {
        scope: 'project',
        items: parsed.data.items.map(item => ({
          docId: item.id,
          title: item.title,
          content: item.snippet,
        })),
      }
    : null;
}
