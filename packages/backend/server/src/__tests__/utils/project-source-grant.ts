import type { PrismaClient } from '@prisma/client';

// Seed historical provenance to test revocation without recreating retired APIs.
export async function seedProjectSourceGrant(
  db: PrismaClient,
  input: {
    projectId: string;
    workspaceId: string;
    docId: string;
    requesterUserId: string;
    requestedLevel: 'read' | 'write';
  }
) {
  return db.aiContextProjectGrant.create({
    data: {
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      docId: input.docId,
      level: input.requestedLevel,
      source: 'direct',
      grantedByUserId: input.requesterUserId,
      grantorUserIdSnapshot: input.requesterUserId,
    },
  });
}
