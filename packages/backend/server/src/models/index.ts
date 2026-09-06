import {
  ExistingProvider,
  FactoryProvider,
  Global,
  Module,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { ApplyType } from '../base';
import { AuthSessionModel } from './auth-session';
import { BlobModel } from './blob';
import { CalendarAccountModel } from './calendar-account';
import { CalendarEventModel } from './calendar-event';
import { CalendarEventInstanceModel } from './calendar-event-instance';
import { CalendarSubscriptionModel } from './calendar-subscription';
import { CommentModel } from './comment';
import { CommentAttachmentModel } from './comment-attachment';
import { AppConfigModel } from './config';
import { CopilotActionRunModel } from './copilot-action-run';
import { CopilotAgentRuntimeModel } from './copilot-agent-runtime';
import { CopilotAiProfileModel } from './copilot-ai-profile';
import { CopilotWorkspaceByokConfigModel } from './copilot-byok';
import { CopilotContextModel } from './copilot-context';
import { CopilotContextMemoryModel } from './copilot-context-memory';
import { CopilotContextRuleModel } from './copilot-context-rule';
import { CopilotDocumentOperationModel } from './copilot-document-operation';
import { CopilotEnterpriseAuthorizationModel } from './copilot-enterprise-authorization';
import { CopilotEnterpriseConnectionModel } from './copilot-enterprise-connection';
import { CopilotExternalMcpModel } from './copilot-external-mcp';
import { CopilotJobModel } from './copilot-job';
import { CopilotMcpDelegationModel } from './copilot-mcp-delegation';
import { CopilotModelRegistryRevisionModel } from './copilot-model-registry-revision';
import { CopilotPromptModel } from './copilot-prompt';
import { CopilotPromptRegistryRevisionModel } from './copilot-prompt-registry-revision';
import { CopilotProviderHealthStateModel } from './copilot-provider-health-state';
import { CopilotProviderRegistryRevisionModel } from './copilot-provider-registry-revision';
import { CopilotRepairExecutionModel } from './copilot-repair-execution';
import { CopilotSessionModel } from './copilot-session';
import { CopilotSupportBundleModel } from './copilot-support-bundle';
import { CopilotTaskRoutePolicyRevisionModel } from './copilot-task-route-policy-revision';
import { CopilotTranscriptTaskModel } from './copilot-transcript-task';
import { CopilotUsageModel } from './copilot-usage';
import { CopilotWorkspaceConfigModel } from './copilot-workspace';
import { DocModel } from './doc';
import { DocUserModel } from './doc-user';
import { FeatureModel } from './feature';
import { HistoryModel } from './history';
import { IntelligenceWorkbenchAuthorizationModel } from './intelligence-workbench-authorization';
import { IntelligenceWorkbenchBlockerModel } from './intelligence-workbench-blocker';
import { IntelligenceWorkbenchTaskProjectionModel } from './intelligence-workbench-task-projection';
import { IscpModel } from './iscp';
import { MagicLinkOtpModel } from './magic-link-otp';
import { MailDeliveryModel } from './mail-delivery';
import { McpCredentialModel } from './mcp-credential';
import { NotificationModel } from './notification';
import { OfficeArtifactModel } from './office-artifact';
import { OfficeCommandRequestModel } from './office-command-request';
import {
  DocAccessPolicyModel,
  DocGrantModel,
  WorkspaceAccessPolicyModel,
  WorkspaceInvitationModel,
  WorkspaceMemberModel,
} from './permission-write';
import { MODELS_SYMBOL } from './provider';
import { SessionModel } from './session';
import { UserModel } from './user';
import { UserDocModel } from './user-doc';
import { UserFeatureModel } from './user-feature';
import { UserSettingsModel } from './user-settings';
import { VerificationTokenModel } from './verification-token';
import { WorkspaceModel } from './workspace';
import { WorkspaceAnalyticsModel } from './workspace-analytics';
import { WorkspaceCalendarModel } from './workspace-calendar';
import { WorkspaceDirectoryGrantModel } from './workspace-directory-grant';
import { WorkspaceUserModel } from './workspace-user';

const MODELS = {
  user: UserModel,
  session: SessionModel,
  verificationToken: VerificationTokenModel,
  magicLinkOtp: MagicLinkOtpModel,
  mailDelivery: MailDeliveryModel,
  authSession: AuthSessionModel,
  feature: FeatureModel,
  workspace: WorkspaceModel,
  workspaceDirectoryGrant: WorkspaceDirectoryGrantModel,
  userFeature: UserFeatureModel,
  doc: DocModel,
  userDoc: UserDocModel,
  workspaceUser: WorkspaceUserModel,
  docUser: DocUserModel,
  history: HistoryModel,
  notification: NotificationModel,
  officeArtifact: OfficeArtifactModel,
  officeCommandRequest: OfficeCommandRequestModel,
  iscp: IscpModel,
  intelligenceWorkbenchAuthorization: IntelligenceWorkbenchAuthorizationModel,
  intelligenceWorkbenchBlocker: IntelligenceWorkbenchBlockerModel,
  intelligenceWorkbenchTaskProjection: IntelligenceWorkbenchTaskProjectionModel,
  workspaceMember: WorkspaceMemberModel,
  workspaceInvitation: WorkspaceInvitationModel,
  workspaceAccessPolicy: WorkspaceAccessPolicyModel,
  docAccessPolicy: DocAccessPolicyModel,
  docGrant: DocGrantModel,
  userSettings: UserSettingsModel,
  copilotSession: CopilotSessionModel,
  copilotDocumentOperation: CopilotDocumentOperationModel,
  copilotUsage: CopilotUsageModel,
  copilotTranscriptTask: CopilotTranscriptTaskModel,
  copilotActionRun: CopilotActionRunModel,
  copilotAgentRuntime: CopilotAgentRuntimeModel,
  copilotAiProfile: CopilotAiProfileModel,
  copilotContext: CopilotContextModel,
  copilotContextMemory: CopilotContextMemoryModel,
  copilotContextRule: CopilotContextRuleModel,
  copilotEnterpriseAuthorization: CopilotEnterpriseAuthorizationModel,
  copilotEnterpriseConnection: CopilotEnterpriseConnectionModel,
  copilotExternalMcp: CopilotExternalMcpModel,
  copilotWorkspace: CopilotWorkspaceConfigModel,
  copilotWorkspaceByokConfig: CopilotWorkspaceByokConfigModel,
  copilotJob: CopilotJobModel,
  copilotMcpDelegation: CopilotMcpDelegationModel,
  copilotModelRegistryRevision: CopilotModelRegistryRevisionModel,
  copilotPrompt: CopilotPromptModel,
  copilotPromptRegistryRevision: CopilotPromptRegistryRevisionModel,
  copilotProviderHealthState: CopilotProviderHealthStateModel,
  copilotProviderRegistryRevision: CopilotProviderRegistryRevisionModel,
  copilotTaskRoutePolicyRevision: CopilotTaskRoutePolicyRevisionModel,
  copilotRepairExecution: CopilotRepairExecutionModel,
  copilotSupportBundle: CopilotSupportBundleModel,
  appConfig: AppConfigModel,
  comment: CommentModel,
  commentAttachment: CommentAttachmentModel,
  blob: BlobModel,
  mcpCredential: McpCredentialModel,
  calendarAccount: CalendarAccountModel,
  calendarSubscription: CalendarSubscriptionModel,
  calendarEvent: CalendarEventModel,
  calendarEventInstance: CalendarEventInstanceModel,
  workspaceCalendar: WorkspaceCalendarModel,
  workspaceAnalytics: WorkspaceAnalyticsModel,
};

type ModelsType = {
  [K in keyof typeof MODELS]: InstanceType<(typeof MODELS)[K]>;
};

export class Models extends ApplyType<ModelsType>() {}

const ModelsProvider: FactoryProvider = {
  provide: Models,
  useFactory: (ref: ModuleRef) => {
    return new Proxy({} as any, {
      get: (target, prop) => {
        // cache
        if (prop in target) {
          return target[prop];
        }

        // find the model instance
        // @ts-expect-error null detection happens right after
        const Model = MODELS[prop];
        if (!Model) {
          return undefined;
        }

        const model = ref.get(Model);

        if (!model) {
          throw new Error(`Failed to initialize model ${Model.name}`);
        }

        target[prop] = model;
        return model;
      },
    });
  },
  inject: [ModuleRef],
};

const ModelsSymbolProvider: ExistingProvider = {
  provide: MODELS_SYMBOL,
  useExisting: Models,
};

@Global()
@Module({
  providers: [...Object.values(MODELS), ModelsProvider, ModelsSymbolProvider],
  exports: [ModelsProvider],
})
export class ModelsModule {}

export * from './auth-session';
export * from './blob';
export * from './calendar-account';
export * from './calendar-event';
export * from './calendar-event-instance';
export * from './calendar-subscription';
export * from './comment';
export * from './comment-attachment';
export * from './common';
export * from './copilot-agent-runtime';
export * from './copilot-ai-profile';
export * from './copilot-byok';
export * from './copilot-context';
export * from './copilot-context-memory';
export * from './copilot-context-rule';
export * from './copilot-document-operation';
export * from './copilot-enterprise-authorization';
export * from './copilot-enterprise-connection';
export * from './copilot-job';
export * from './copilot-model-registry-revision';
export * from './copilot-prompt';
export * from './copilot-prompt-registry-revision';
export * from './copilot-provider-health-state';
export * from './copilot-provider-registry-revision';
export * from './copilot-repair-execution';
export * from './copilot-session';
export * from './copilot-support-bundle';
export * from './copilot-task-route-policy-revision';
export * from './copilot-transcript-task';
export * from './copilot-usage';
export * from './copilot-workspace';
export * from './doc';
export * from './doc-user';
export * from './feature';
export * from './history';
export * from './intelligence-workbench-authorization';
export * from './intelligence-workbench-blocker';
export * from './intelligence-workbench-task-projection';
export * from './iscp';
export * from './magic-link-otp';
export * from './mail-delivery';
export * from './notification';
export * from './office-artifact';
export * from './office-command-request';
export * from './permission-write';
export * from './session';
export * from './user';
export * from './user-doc';
export * from './user-feature';
export * from './user-settings';
export * from './verification-token';
export * from './workspace';
export * from './workspace-analytics';
export * from './workspace-calendar';
export * from './workspace-user';
export type { WorkspaceUserCompat } from './workspace-user-compat';
