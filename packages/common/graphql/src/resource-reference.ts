export type ResourceOwner =
  | { ownerType: 'workspace'; workspaceId: string }
  | { ownerType: 'project'; projectId: string };

export type ResourceReference = ResourceOwner & { resourceId: string };

export function resourceReferenceKey(resource: ResourceReference) {
  const ownerId =
    resource.ownerType === 'project'
      ? resource.projectId
      : resource.workspaceId;
  return JSON.stringify([resource.ownerType, ownerId, resource.resourceId]);
}
