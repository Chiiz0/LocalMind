import { Prisma } from '@prisma/client';

import { BadRequest } from '../../../base';
import type { PermissionService } from '../../../core/permission';
import type { EmbeddingRouteContext } from '../embedding/types';

export function readableContextDocPredicate(
  permission: PermissionService,
  workspaceId: string,
  routeContext?: EmbeddingRouteContext,
  projectId: string | null = null
) {
  if (!routeContext?.userId) {
    throw new BadRequest('Document embedding search requires a user id.');
  }
  return permission.docReadableSqlPredicate({
    userId: routeContext.userId,
    workspaceId,
    action: 'Doc.Read',
    projectId,
    docIdColumn: Prisma.raw('w."doc_id"'),
  });
}
