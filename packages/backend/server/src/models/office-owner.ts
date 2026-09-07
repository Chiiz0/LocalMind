export type OfficeOwner = string | { projectId: string };

export type OfficeOwnerInput =
  | { workspaceId: string; projectId?: never }
  | { projectId: string; workspaceId?: never };

export function officeOwnerColumns(
  owner: OfficeOwner
):
  | { workspaceId: string; projectId: null }
  | { workspaceId: null; projectId: string } {
  const id = typeof owner === 'string' ? owner : owner.projectId;
  if (typeof id !== 'string' || !id.trim() || id.length > 512)
    throw new Error('Office resource owner is required');
  return typeof owner === 'string'
    ? { workspaceId: id, projectId: null }
    : { workspaceId: null, projectId: id };
}

export function officeOwnerFromInput(input: OfficeOwnerInput): OfficeOwner {
  if (input.projectId !== undefined) {
    if (input.workspaceId !== undefined)
      throw new Error('Office resources have exactly one owner');
    return { projectId: input.projectId };
  }
  return input.workspaceId;
}

export function officeOwnerToInput(owner: OfficeOwner): OfficeOwnerInput {
  return typeof owner === 'string'
    ? { workspaceId: owner }
    : { projectId: owner.projectId };
}

export function officeWriterLock(owner: OfficeOwner, artifactId: string) {
  return typeof owner === 'string'
    ? `office-artifact:${owner}:${artifactId}`
    : `office-artifact:project:${owner.projectId}:${artifactId}`;
}
