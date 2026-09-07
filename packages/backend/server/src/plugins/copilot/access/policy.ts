import { Injectable } from '@nestjs/common';

import { CopilotByokNotConfigured } from '../../../base';
import { ByokService } from '../byok/service';
import type { ByokFeatureKind } from '../byok/types';
import type { CopilotProviderProfile } from '../config';
import { ConversationPolicy } from '../conversation/policy';
import { getByokSourceCoverage } from './feature-coverage';

export type CopilotAccessContext = {
  sessionId?: string;
  projectId?: string;
  userId?: string;
  workspaceId?: string;
  byokLeaseId?: string;
  featureKind?: ByokFeatureKind;
  quotaBackedRoutesAllowed?: boolean;
};

export type CopilotRouteAccess = {
  byokProfiles: CopilotProviderProfile[];
  quotaBackedRoutesAvailable: boolean;
};

export type CopilotTurnRouteAccess = {
  byokProfiles: CopilotProviderProfile[];
  quotaBackedRoutesAllowed?: boolean;
};

@Injectable()
export class CopilotAccessPolicy {
  constructor(
    private readonly conversationPolicy: ConversationPolicy,
    private readonly byok: ByokService
  ) {}

  async getByokProfiles(context: CopilotAccessContext = {}) {
    const coverage = getByokSourceCoverage(context.featureKind);
    return await this.byok.getProfiles(context, coverage);
  }

  canUseQuotaBackedRoutes(_context: CopilotAccessContext = {}) {
    return false;
  }

  async getQuota(userId: string) {
    return await this.conversationPolicy.getQuota(userId);
  }

  async checkQuota(userId: string) {
    await this.conversationPolicy.checkQuota(userId);
  }

  async resolveRouteAccess(
    context: CopilotAccessContext = {}
  ): Promise<CopilotRouteAccess> {
    const byokProfiles = await this.getByokProfiles(context);
    return { byokProfiles, quotaBackedRoutesAvailable: false };
  }

  async resolveTurnRouteAccess(
    context: CopilotAccessContext
  ): Promise<CopilotTurnRouteAccess> {
    const byokProfiles = await this.getByokProfiles(context);
    this.assertByokConfigured(byokProfiles);
    return { byokProfiles, quotaBackedRoutesAllowed: false };
  }

  async assertQuotaOrByok(context: CopilotAccessContext) {
    const byokProfiles = await this.getByokProfiles(context);
    this.assertByokConfigured(byokProfiles);
  }

  private assertByokConfigured(byokProfiles: CopilotProviderProfile[]) {
    if (!byokProfiles.length) {
      throw new CopilotByokNotConfigured();
    }
  }
}
