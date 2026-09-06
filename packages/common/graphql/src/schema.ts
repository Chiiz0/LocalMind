export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: string; output: string };
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: unknown; output: unknown };
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: { input: any; output: any };
  /** The `SafeInt` scalar type represents non-fractional signed whole numeric values that are considered safe as defined by the ECMAScript specification. */
  SafeInt: { input: number; output: number };
  /** The `Upload` scalar type represents a file upload. */
  Upload: { input: File; output: File };
}

export interface AccessRequestNotificationBodyType {
  __typename?: 'AccessRequestNotificationBodyType';
  canDecide: Scalars['Boolean']['output'];
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  docId: Maybe<Scalars['String']['output']>;
  docTitle: Maybe<Scalars['String']['output']>;
  projectId: Maybe<Scalars['ID']['output']>;
  projectName: Maybe<Scalars['String']['output']>;
  requestId: Scalars['ID']['output'];
  requestedLevel: Maybe<Scalars['String']['output']>;
  resolutionReason: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface AddContextBlobInput {
  blobId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
}

export interface AddContextCategoryInput {
  categoryId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
  docs?: InputMaybe<Array<Scalars['String']['input']>>;
  type: ContextCategories;
}

export interface AddContextDocInput {
  contextId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}

export interface AddContextFileInput {
  contextId: Scalars['String']['input'];
}

export interface AddCopilotContextProjectDocumentInput {
  docId: Scalars['String']['input'];
  groupId?: InputMaybe<Scalars['String']['input']>;
  projectId: Scalars['ID']['input'];
  requestedLevel?: InputMaybe<Scalars['String']['input']>;
  requestedTitle?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface AdminAiProfileCredentialType {
  __typename?: 'AdminAiProfileCredentialType';
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  modelId: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface AdminAiProfileType {
  __typename?: 'AdminAiProfileType';
  createdAt: Scalars['DateTime']['output'];
  credentialIds: Array<Scalars['ID']['output']>;
  credentials: Array<AdminAiProfileCredentialType>;
  description: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
  workspaceName: Maybe<Scalars['String']['output']>;
}

export interface AdminAllSharedLink {
  __typename?: 'AdminAllSharedLink';
  docId: Scalars['String']['output'];
  docUpdatedAt: Maybe<Scalars['DateTime']['output']>;
  guestViews: Maybe<Scalars['SafeInt']['output']>;
  lastAccessedAt: Maybe<Scalars['DateTime']['output']>;
  lastUpdaterId: Maybe<Scalars['String']['output']>;
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  shareUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  uniqueViews: Maybe<Scalars['SafeInt']['output']>;
  views: Maybe<Scalars['SafeInt']['output']>;
  workspaceId: Scalars['String']['output'];
  workspaceOwnerId: Maybe<Scalars['String']['output']>;
}

export interface AdminAllSharedLinkEdge {
  __typename?: 'AdminAllSharedLinkEdge';
  cursor: Scalars['String']['output'];
  node: AdminAllSharedLink;
}

export interface AdminAllSharedLinksFilterInput {
  analyticsWindowDays?: InputMaybe<Scalars['Int']['input']>;
  includeTotal?: InputMaybe<Scalars['Boolean']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<AdminSharedLinksOrder>;
  updatedAfter?: InputMaybe<Scalars['DateTime']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface AdminDashboard {
  __typename?: 'AdminDashboard';
  blobStorageBytes: Scalars['SafeInt']['output'];
  blobStorageHistory: Array<AdminDashboardValueDayPoint>;
  copilotConversations: Scalars['SafeInt']['output'];
  copilotWindow: TimeWindow;
  generatedAt: Scalars['DateTime']['output'];
  storageWindow: TimeWindow;
  syncActiveUsers: Scalars['Int']['output'];
  syncActiveUsersTimeline: Array<AdminDashboardMinutePoint>;
  syncWindow: TimeWindow;
  topSharedLinks: Array<AdminSharedLinkTopItem>;
  topSharedLinksWindow: TimeWindow;
  workspaceStorageBytes: Scalars['SafeInt']['output'];
  workspaceStorageHistory: Array<AdminDashboardValueDayPoint>;
}

export interface AdminDashboardInput {
  copilotWindowDays?: InputMaybe<Scalars['Int']['input']>;
  sharedLinkWindowDays?: InputMaybe<Scalars['Int']['input']>;
  storageHistoryDays?: InputMaybe<Scalars['Int']['input']>;
  syncHistoryHours?: InputMaybe<Scalars['Int']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
}

export interface AdminDashboardMinutePoint {
  __typename?: 'AdminDashboardMinutePoint';
  activeUsers: Scalars['Int']['output'];
  minute: Scalars['DateTime']['output'];
}

export interface AdminDashboardValueDayPoint {
  __typename?: 'AdminDashboardValueDayPoint';
  date: Scalars['DateTime']['output'];
  value: Scalars['SafeInt']['output'];
}

export interface AdminLicensePreview {
  __typename?: 'AdminLicensePreview';
  endAt: Scalars['DateTime']['output'];
  entity: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  issuedAt: Scalars['DateTime']['output'];
  issuer: Scalars['String']['output'];
  plan: SubscriptionPlan;
  quantity: Scalars['Int']['output'];
  recurring: SubscriptionRecurring;
  valid: Scalars['Boolean']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface AdminMailDeliveriesInput {
  hours?: Scalars['Int']['input'];
}

export interface AdminMailDeliveryAnalytics {
  __typename?: 'AdminMailDeliveryAnalytics';
  byOutcome: Array<AdminMailDeliverySeries>;
  byStatus: Array<AdminMailDeliverySeries>;
  byType: Array<AdminMailDeliverySeries>;
  summary: AdminMailDeliverySummary;
  window: TimeWindow;
}

export interface AdminMailDeliveryPoint {
  __typename?: 'AdminMailDeliveryPoint';
  bucket: Scalars['DateTime']['output'];
  count: Scalars['Int']['output'];
}

export interface AdminMailDeliverySeries {
  __typename?: 'AdminMailDeliverySeries';
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  points: Array<AdminMailDeliveryPoint>;
  total: Scalars['Int']['output'];
}

export interface AdminMailDeliverySummary {
  __typename?: 'AdminMailDeliverySummary';
  canceled: Scalars['Int']['output'];
  failed: Scalars['Int']['output'];
  queued: Scalars['Int']['output'];
  retryWait: Scalars['Int']['output'];
  sending: Scalars['Int']['output'];
  sent: Scalars['Int']['output'];
  skipped: Scalars['Int']['output'];
  successRate: Scalars['Float']['output'];
  total: Scalars['Int']['output'];
}

export interface AdminSharedLinkTopItem {
  __typename?: 'AdminSharedLinkTopItem';
  docId: Scalars['String']['output'];
  guestViews: Scalars['SafeInt']['output'];
  lastAccessedAt: Maybe<Scalars['DateTime']['output']>;
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  shareUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  uniqueViews: Scalars['SafeInt']['output'];
  views: Scalars['SafeInt']['output'];
  workspaceId: Scalars['String']['output'];
}

export enum AdminSharedLinksOrder {
  PublishedAtDesc = 'PublishedAtDesc',
  UpdatedAtDesc = 'UpdatedAtDesc',
  ViewsDesc = 'ViewsDesc',
}

export interface AdminUpdateWorkspaceInput {
  avatarKey?: InputMaybe<Scalars['String']['input']>;
  enableAi?: InputMaybe<Scalars['Boolean']['input']>;
  enableDocEmbedding?: InputMaybe<Scalars['Boolean']['input']>;
  enableSharing?: InputMaybe<Scalars['Boolean']['input']>;
  enableUrlPreview?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  public?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface AdminUserAiProfileAssignmentType {
  __typename?: 'AdminUserAiProfileAssignmentType';
  createdAt: Scalars['DateTime']['output'];
  profile: AdminAiProfileType;
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface AdminWorkspace {
  __typename?: 'AdminWorkspace';
  avatarKey: Maybe<Scalars['String']['output']>;
  blobCount: Scalars['Int']['output'];
  blobSize: Scalars['SafeInt']['output'];
  createdAt: Scalars['DateTime']['output'];
  enableAi: Scalars['Boolean']['output'];
  enableDocEmbedding: Scalars['Boolean']['output'];
  enableSharing: Scalars['Boolean']['output'];
  enableUrlPreview: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
  /** Members of workspace */
  members: Array<AdminWorkspaceMember>;
  name: Maybe<Scalars['String']['output']>;
  owner: Maybe<WorkspaceUserType>;
  public: Scalars['Boolean']['output'];
  publicPageCount: Scalars['Int']['output'];
  sharedLinks: Array<AdminWorkspaceSharedLink>;
  snapshotCount: Scalars['Int']['output'];
  snapshotSize: Scalars['SafeInt']['output'];
}

export interface AdminWorkspaceMembersArgs {
  query?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface AdminWorkspaceByokScopeType {
  __typename?: 'AdminWorkspaceByokScopeType';
  enableAi: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  memberCount: Scalars['SafeInt']['output'];
  name: Maybe<Scalars['String']['output']>;
}

export interface AdminWorkspaceMember {
  __typename?: 'AdminWorkspaceMember';
  avatarUrl: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  role: AdminWorkspaceMemberRole;
  status: WorkspaceMemberStatus;
}

export enum AdminWorkspaceMemberRole {
  Admin = 'Admin',
  Collaborator = 'Collaborator',
  Owner = 'Owner',
}

export interface AdminWorkspaceSharedLink {
  __typename?: 'AdminWorkspaceSharedLink';
  docId: Scalars['String']['output'];
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  title: Maybe<Scalars['String']['output']>;
}

export enum AdminWorkspaceSort {
  BlobCount = 'BlobCount',
  BlobSize = 'BlobSize',
  CreatedAt = 'CreatedAt',
  MemberCount = 'MemberCount',
  PublicPageCount = 'PublicPageCount',
  SnapshotCount = 'SnapshotCount',
  SnapshotSize = 'SnapshotSize',
}

export interface AggregateBucketHitsObjectType {
  __typename?: 'AggregateBucketHitsObjectType';
  nodes: Array<SearchNodeObjectType>;
}

export interface AggregateBucketObjectType {
  __typename?: 'AggregateBucketObjectType';
  count: Scalars['Int']['output'];
  /** The hits object */
  hits: AggregateBucketHitsObjectType;
  key: Scalars['String']['output'];
}

export interface AggregateHitsOptions {
  fields: Array<Scalars['String']['input']>;
  highlights?: InputMaybe<Array<SearchHighlight>>;
  pagination?: InputMaybe<AggregateHitsPagination>;
}

export interface AggregateHitsPagination {
  limit?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface AggregateInput {
  field: Scalars['String']['input'];
  options: AggregateOptions;
  query: SearchQuery;
  table: SearchTable;
}

export interface AggregateOptions {
  hits: AggregateHitsOptions;
  pagination?: InputMaybe<SearchPagination>;
}

export interface AggregateResultObjectType {
  __typename?: 'AggregateResultObjectType';
  buckets: Array<AggregateBucketObjectType>;
  pagination: SearchResultPagination;
}

export enum AiJobStatus {
  claimed = 'claimed',
  failed = 'failed',
  finished = 'finished',
  pending = 'pending',
  running = 'running',
}

export interface AlreadyInSpaceDataType {
  __typename?: 'AlreadyInSpaceDataType';
  spaceId: Scalars['String']['output'];
}

export interface AppConfigValidateResult {
  __typename?: 'AppConfigValidateResult';
  error: Maybe<Scalars['String']['output']>;
  key: Scalars['String']['output'];
  module: Scalars['String']['output'];
  valid: Scalars['Boolean']['output'];
  value: Scalars['JSON']['output'];
}

export interface AudioSliceManifestItemInput {
  byteSize?: InputMaybe<Scalars['Int']['input']>;
  durationSec: Scalars['Float']['input'];
  fileName: Scalars['String']['input'];
  index: Scalars['Int']['input'];
  mimeType: Scalars['String']['input'];
  startSec: Scalars['Float']['input'];
}

export interface AudioSliceManifestItemType {
  __typename?: 'AudioSliceManifestItemType';
  byteSize: Maybe<Scalars['Int']['output']>;
  durationSec: Scalars['Float']['output'];
  fileName: Scalars['String']['output'];
  index: Scalars['Int']['output'];
  mimeType: Scalars['String']['output'];
  startSec: Scalars['Float']['output'];
}

export interface AuthSigningKeyType {
  __typename?: 'AuthSigningKeyType';
  canDelete: Scalars['Boolean']['output'];
  createdAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  retiredAt: Maybe<Scalars['DateTime']['output']>;
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  verifyUntil: Maybe<Scalars['DateTime']['output']>;
}

export interface BlobNotFoundDataType {
  __typename?: 'BlobNotFoundDataType';
  blobId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface BlobUploadInit {
  __typename?: 'BlobUploadInit';
  alreadyUploaded: Maybe<Scalars['Boolean']['output']>;
  blobKey: Scalars['String']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  headers: Maybe<Scalars['JSONObject']['output']>;
  method: BlobUploadMethod;
  partSize: Maybe<Scalars['Int']['output']>;
  uploadId: Maybe<Scalars['String']['output']>;
  uploadUrl: Maybe<Scalars['String']['output']>;
  uploadedParts: Maybe<Array<BlobUploadedPart>>;
}

/** Blob upload method */
export enum BlobUploadMethod {
  GRAPHQL = 'GRAPHQL',
  MULTIPART = 'MULTIPART',
  PRESIGNED = 'PRESIGNED',
}

export interface BlobUploadPart {
  __typename?: 'BlobUploadPart';
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  headers: Maybe<Scalars['JSONObject']['output']>;
  uploadUrl: Scalars['String']['output'];
}

export interface BlobUploadPartInput {
  etag: Scalars['String']['input'];
  partNumber: Scalars['Int']['input'];
}

export interface BlobUploadedPart {
  __typename?: 'BlobUploadedPart';
  etag: Scalars['String']['output'];
  partNumber: Scalars['Int']['output'];
}

export enum ByokKeyStorage {
  local = 'local',
  server = 'server',
}

export enum ByokKeyTestStatus {
  failed = 'failed',
  passed = 'passed',
  untested = 'untested',
}

export enum ByokProvider {
  anthropic = 'anthropic',
  fal = 'fal',
  gemini = 'gemini',
  openai = 'openai',
}

export interface CalendarAccountObjectType {
  __typename?: 'CalendarAccountObjectType';
  calendars: Array<CalendarSubscriptionObjectType>;
  calendarsCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayName: Maybe<Scalars['String']['output']>;
  email: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  lastError: Maybe<Scalars['String']['output']>;
  provider: CalendarProviderType;
  providerAccountId: Scalars['String']['output'];
  refreshIntervalMinutes: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
}

export interface CalendarCalDavProviderPresetObjectType {
  __typename?: 'CalendarCalDAVProviderPresetObjectType';
  docsUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  requiresAppPassword: Maybe<Scalars['Boolean']['output']>;
}

export interface CalendarEventObjectType {
  __typename?: 'CalendarEventObjectType';
  allDay: Scalars['Boolean']['output'];
  description: Maybe<Scalars['String']['output']>;
  endAtUtc: Scalars['DateTime']['output'];
  externalEventId: Scalars['String']['output'];
  id: Scalars['String']['output'];
  location: Maybe<Scalars['String']['output']>;
  originalTimezone: Maybe<Scalars['String']['output']>;
  recurrenceId: Maybe<Scalars['String']['output']>;
  startAtUtc: Scalars['DateTime']['output'];
  status: Maybe<Scalars['String']['output']>;
  subscriptionId: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
}

export interface CalendarProviderRequestErrorDataType {
  __typename?: 'CalendarProviderRequestErrorDataType';
  message: Scalars['String']['output'];
  status: Scalars['Int']['output'];
}

export enum CalendarProviderType {
  CalDAV = 'CalDAV',
  Google = 'Google',
}

export interface CalendarSubscriptionObjectType {
  __typename?: 'CalendarSubscriptionObjectType';
  accountId: Scalars['String']['output'];
  color: Maybe<Scalars['String']['output']>;
  displayName: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  externalCalendarId: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lastSyncAt: Maybe<Scalars['DateTime']['output']>;
  provider: CalendarProviderType;
  timezone: Maybe<Scalars['String']['output']>;
}

export enum ChatHistoryOrder {
  asc = 'asc',
  desc = 'desc',
}

export interface ChatMessage {
  __typename?: 'ChatMessage';
  attachments: Maybe<Array<Scalars['String']['output']>>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Maybe<Scalars['ID']['output']>;
  params: Maybe<Scalars['JSON']['output']>;
  role: Scalars['String']['output'];
  streamObjects: Maybe<Array<StreamObject>>;
}

/** Comment change action */
export enum CommentChangeAction {
  delete = 'delete',
  update = 'update',
}

export interface CommentChangeObjectType {
  __typename?: 'CommentChangeObjectType';
  /** The action of the comment change */
  action: CommentChangeAction;
  commentId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  /** The item of the comment or reply, different types have different fields, see UnionCommentObjectType */
  item: Scalars['JSONObject']['output'];
}

export interface CommentChangeObjectTypeEdge {
  __typename?: 'CommentChangeObjectTypeEdge';
  cursor: Scalars['String']['output'];
  node: CommentChangeObjectType;
}

export interface CommentCreateInput {
  content: Scalars['JSONObject']['input'];
  docId: Scalars['ID']['input'];
  docMode: DocMode;
  docTitle: Scalars['String']['input'];
  /** The mention user ids, if not provided, the comment will not be mentioned */
  mentions?: InputMaybe<Array<Scalars['String']['input']>>;
  workspaceId: Scalars['ID']['input'];
}

export interface CommentObjectType {
  __typename?: 'CommentObjectType';
  /** The content of the comment */
  content: Scalars['JSONObject']['output'];
  /** The created at time of the comment */
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** The replies of the comment */
  replies: Array<ReplyObjectType>;
  /** Whether the comment is resolved */
  resolved: Scalars['Boolean']['output'];
  /** The updated at time of the comment */
  updatedAt: Scalars['DateTime']['output'];
  /** The user who created the comment */
  user: PublicUserType;
}

export interface CommentObjectTypeEdge {
  __typename?: 'CommentObjectTypeEdge';
  cursor: Scalars['String']['output'];
  node: CommentObjectType;
}

export interface CommentResolveInput {
  id: Scalars['ID']['input'];
  /** Whether the comment is resolved */
  resolved: Scalars['Boolean']['input'];
}

export interface CommentUpdateInput {
  content: Scalars['JSONObject']['input'];
  id: Scalars['ID']['input'];
}

export interface ConfirmCopilotBlockerSuggestionInput {
  projectId: Scalars['ID']['input'];
  suggestion: CopilotBlockerSuggestionInput;
}

export interface ConfirmCopilotDocumentDestinationInput {
  expectedRevision: Scalars['Int']['input'];
  folderId?: InputMaybe<Scalars['ID']['input']>;
  operationId: Scalars['ID']['input'];
  root: Scalars['Boolean']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface ConnectExternalMcpInput {
  accessTicket: Scalars['String']['input'];
  name?: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export enum ContextCategories {
  Collection = 'Collection',
  Tag = 'Tag',
}

export enum ContextEmbedStatus {
  failed = 'failed',
  finished = 'finished',
  processing = 'processing',
}

export interface ContextMatchedDocChunk {
  __typename?: 'ContextMatchedDocChunk';
  chunk: Scalars['SafeInt']['output'];
  content: Scalars['String']['output'];
  distance: Maybe<Scalars['Float']['output']>;
  docId: Scalars['String']['output'];
}

export interface ContextMatchedFileChunk {
  __typename?: 'ContextMatchedFileChunk';
  blobId: Scalars['String']['output'];
  chunk: Scalars['SafeInt']['output'];
  content: Scalars['String']['output'];
  distance: Maybe<Scalars['Float']['output']>;
  fileId: Scalars['String']['output'];
  mimeType: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface ContextWorkspaceEmbeddingStatus {
  __typename?: 'ContextWorkspaceEmbeddingStatus';
  embedded: Scalars['SafeInt']['output'];
  total: Scalars['SafeInt']['output'];
}

export interface Copilot {
  __typename?: 'Copilot';
  /** Get sanitized prepared route diagnostics for an action run in the current workspace */
  actionRunPreparedRouteTrace: Maybe<CopilotActionRunPreparedRouteDiagnosticsType>;
  /** List recent sanitized action runs for diagnostics in the current workspace */
  actionRuns: Array<CopilotActionRunDiagnosticsItemType>;
  /** Get a persisted Agent Runtime run with steps and timeline for the current workspace */
  agentRun: Maybe<CopilotAgentRunType>;
  /** List recent persisted Agent Runtime runs for the current workspace */
  agentRuns: Array<CopilotAgentRunType>;
  /** List registered Agent Runtime workflow adapter capabilities for standalone run diagnostics */
  agentRuntimeWorkflowAdapters: Array<CopilotAgentRuntimeWorkflowAdapterType>;
  chats: PaginatedCopilotHistoriesType;
  /** List authorized rules, automatic memories, and project summaries */
  contextMemories: Array<CopilotContextMemoryType>;
  /** List Automatic Memory writer and undo events */
  contextMemoryEvents: Array<CopilotContextMemoryEventType>;
  /** List immutable context planner revisions and checkpoint activity */
  contextPlannerStrategies: Array<CopilotContextStrategyType>;
  /** List workspace-enforced AI context policies */
  contextPolicies: Array<CopilotContextPolicyType>;
  /** Get a global context project by membership */
  contextProject: CopilotContextProjectType;
  /** List global context projects the current user belongs to */
  contextProjects: Array<CopilotContextProjectType>;
  /** List the current user rules and revision history */
  contextRules: Array<CopilotContextRuleType>;
  /** Resolve the readable documents and candidate context projects for a chat session */
  contextSessionScope: Maybe<CopilotContextSessionScopeType>;
  /** Get the current user context preferences for this workspace */
  contextSettings: CopilotContextSettingsType;
  /** Get the context list of a session */
  contexts: Array<CopilotContext>;
  /** Get one standalone Copilot task owned by the current user in the current workspace. */
  copilotTask: Maybe<CopilotTaskType>;
  /** List standalone Copilot tasks owned by the current user in one workspace or across all accessible workspaces. */
  copilotTasks: Array<CopilotTaskType>;
  documentDestinationFolders: CopilotDocumentFoldersType;
  documentDestinationWorkspaces: Array<CopilotDocumentWorkspaceType>;
  documentOperations: Array<CopilotDocumentOperationType>;
  /** @deprecated use `chats` instead */
  histories: Array<CopilotHistories>;
  /** List available models for a prompt, with human-readable names */
  models: CopilotModelsType;
  /** Evaluate whether the current prompt registry row can pass the publish gate */
  promptRegistryPublishGate: Maybe<CopilotPromptRegistryPublishGateVerdictType>;
  /** Read-only preflight for a prompt registry repair submission contract */
  promptRegistryRepairPreflight: Maybe<CopilotPromptRegistryRepairPreflightType>;
  /** List prompt catalog metadata for diagnostics */
  prompts: Array<CopilotPromptCatalogItemType>;
  /** List recent DB-backed provider health probe attempts for the current workspace */
  providerHealthProbeAttempts: Array<CopilotProviderHealthProbeAttemptType>;
  /** Get the quota of the user in the workspace */
  quota: CopilotQuota;
  /** List recent persisted repair execution requests for the current workspace */
  repairExecutions: Array<CopilotRepairExecutionRecordType>;
  /** Get the session by id */
  session: CopilotSessionType;
  /**
   * Get the session list in the workspace
   * @deprecated use `chats` instead
   */
  sessions: Array<CopilotSessionType>;
  /** Get a DB-backed support bundle request and record a read audit event */
  supportBundle: Maybe<CopilotSupportBundleType>;
  /** List recent DB-backed support bundle requests for the current workspace */
  supportBundles: Array<CopilotSupportBundleType>;
  /** @deprecated Use realtime subscription "copilot.transcript.task.changed" instead. */
  transcriptTask: Maybe<TranscriptionResultType>;
  /** List access requests visible to the current user. */
  workbenchAccessRequests: Array<CopilotAccessRequestType>;
  /** List reminder-only Blockers visible through active global Project membership. */
  workbenchBlockers: Array<CopilotBlockerType>;
  /** List project grants on source documents the current user may manage. */
  workbenchProjectGrantsForSource: Array<CopilotProjectGrantType>;
  /** List project invitations visible to the current user. */
  workbenchProjectInvitations: Array<CopilotProjectInvitationType>;
  workbenchTask: Maybe<CopilotWorkbenchTaskItemType>;
  /** Project the current user task attention panel across all currently accessible workspaces. */
  workbenchTaskPanel: CopilotWorkbenchTaskPanelType;
  /** List the current user workbench tasks across all currently accessible workspaces. */
  workbenchTasks: CopilotWorkbenchTaskListType;
  workspaceId: Maybe<Scalars['ID']['output']>;
}

export interface CopilotActionRunPreparedRouteTraceArgs {
  runId: Scalars['String']['input'];
}

export interface CopilotActionRunsArgs {
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}

export interface CopilotAgentRunArgs {
  id: Scalars['String']['input'];
}

export interface CopilotAgentRunsArgs {
  filter?: InputMaybe<CopilotAgentRunListFilterInput>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}

export interface CopilotChatsArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
  pagination: PaginationInput;
}

export interface CopilotContextMemoriesArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  includeDisabled?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CopilotContextMemoryEventsArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
}

export interface CopilotContextPoliciesArgs {
  includeDisabled?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CopilotContextProjectArgs {
  id: Scalars['ID']['input'];
}

export interface CopilotContextProjectsArgs {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CopilotContextRulesArgs {
  includeDisabled?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CopilotContextSessionScopeArgs {
  sessionId: Scalars['ID']['input'];
}

export interface CopilotContextsArgs {
  contextId?: InputMaybe<Scalars['String']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotCopilotTaskArgs {
  id: Scalars['String']['input'];
}

export interface CopilotCopilotTasksArgs {
  filter?: InputMaybe<CopilotTaskListFilterInput>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}

export interface CopilotDocumentDestinationFoldersArgs {
  after?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface CopilotDocumentOperationsArgs {
  after?: InputMaybe<Scalars['ID']['input']>;
  sessionId: Scalars['ID']['input'];
}

export interface CopilotHistoriesArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}

export interface CopilotModelsArgs {
  promptName: Scalars['String']['input'];
}

export interface CopilotPromptRegistryPublishGateArgs {
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  name: Scalars['String']['input'];
}

export interface CopilotPromptRegistryRepairPreflightArgs {
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  name: Scalars['String']['input'];
  submission: CopilotPromptRegistryRepairSubmissionInput;
}

export interface CopilotProviderHealthProbeAttemptsArgs {
  filter?: InputMaybe<CopilotProviderHealthProbeAttemptFilterInput>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}

export interface CopilotRepairExecutionsArgs {
  filter?: InputMaybe<CopilotRepairExecutionListFilterInput>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}

export interface CopilotSessionArgs {
  sessionId: Scalars['String']['input'];
}

export interface CopilotSessionsArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatSessionsInput>;
}

export interface CopilotSupportBundleArgs {
  id: Scalars['String']['input'];
}

export interface CopilotSupportBundlesArgs {
  filter?: InputMaybe<CopilotSupportBundleListFilterInput>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}

export interface CopilotTranscriptTaskArgs {
  blobId?: InputMaybe<Scalars['String']['input']>;
  taskId?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotWorkbenchAccessRequestsArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
  view?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotWorkbenchBlockersArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface CopilotWorkbenchProjectGrantsForSourceArgs {
  docId?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotWorkbenchProjectInvitationsArgs {
  direction?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface CopilotWorkbenchTaskArgs {
  taskId: Scalars['String']['input'];
}

export interface CopilotWorkbenchTaskPanelArgs {
  projectId?: InputMaybe<Scalars['ID']['input']>;
}

export interface CopilotWorkbenchTasksArgs {
  cursor?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
}

export interface CopilotAccessRequestType {
  __typename?: 'CopilotAccessRequestType';
  beneficiaryProjectId: Maybe<Scalars['String']['output']>;
  beneficiaryType: Scalars['String']['output'];
  beneficiaryUserId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  docId: Maybe<Scalars['String']['output']>;
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  requestedLevel: Scalars['String']['output'];
  requestedTitle: Maybe<Scalars['String']['output']>;
  requesterUserId: Scalars['String']['output'];
  resolutionReason: Maybe<Scalars['String']['output']>;
  resolvedAt: Maybe<Scalars['DateTime']['output']>;
  resolvedByUserId: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadataType {
  __typename?: 'CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadataType';
  actionId: Scalars['String']['output'];
  actionVersion: Scalars['String']['output'];
  artifact: Scalars['String']['output'];
  auditEventCreated: Scalars['Boolean']['output'];
  auditEventFingerprint: Scalars['String']['output'];
  auditEventStatus: Scalars['String']['output'];
  auditEventVersion: Scalars['String']['output'];
  boundary: Scalars['String']['output'];
  exportPolicyFingerprint: Scalars['String']['output'];
  exportPolicyStatus: Scalars['String']['output'];
  exportPolicyVersion: Scalars['String']['output'];
  filename: Scalars['String']['output'];
  manifestFingerprint: Scalars['String']['output'];
  manifestVersion: Scalars['String']['output'];
  metadataFilename: Scalars['String']['output'];
  mime: Scalars['String']['output'];
  projectionSource: Scalars['String']['output'];
  retentionPolicyFingerprint: Scalars['String']['output'];
  retentionPolicyStatus: Scalars['String']['output'];
  retentionPolicyVersion: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  runStatus: Scalars['String']['output'];
  schemaReadiness: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotActionRunAgentRuntimeDiagnosticsManifestType {
  __typename?: 'CopilotActionRunAgentRuntimeDiagnosticsManifestType';
  actionId: Scalars['String']['output'];
  actionVersion: Scalars['String']['output'];
  fingerprint: Scalars['String']['output'];
  hasPreparedRouteTrace: Scalars['Boolean']['output'];
  nativeTraceEventTypes: Array<Scalars['String']['output']>;
  preparedRouteActualCount: Scalars['SafeInt']['output'];
  preparedRouteCount: Scalars['SafeInt']['output'];
  preparedRouteStepCount: Scalars['SafeInt']['output'];
  projectionContractFingerprint: Scalars['String']['output'];
  projectionGapCount: Scalars['SafeInt']['output'];
  projectionSource: Scalars['String']['output'];
  runStatus: Scalars['String']['output'];
  schemaReadiness: Scalars['String']['output'];
  schemaReadinessGapCount: Scalars['SafeInt']['output'];
  timelineEventTypes: Array<Scalars['String']['output']>;
  timelineGapCount: Scalars['SafeInt']['output'];
  timelineItemCount: Scalars['SafeInt']['output'];
  timelineRouteEvidenceSetFingerprint: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotActionRunAgentRuntimeTimelineItemType {
  __typename?: 'CopilotActionRunAgentRuntimeTimelineItemType';
  actualRouteCount: Scalars['SafeInt']['output'];
  eventKey: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  fallbackProviderIds: Array<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  kind: Maybe<Scalars['String']['output']>;
  label: Scalars['String']['output'];
  routeBehaviorFlags: Array<Scalars['String']['output']>;
  routeCanonicalModelKeys: Array<Scalars['String']['output']>;
  routeCount: Scalars['SafeInt']['output'];
  routeCountMismatch: Scalars['Boolean']['output'];
  routeDimensionEvidence: Array<Scalars['String']['output']>;
  routeEvidenceFingerprint: Scalars['String']['output'];
  routeModelBackendKinds: Array<Scalars['String']['output']>;
  routeTargets: Array<Scalars['String']['output']>;
  runId: Scalars['String']['output'];
  sequence: Scalars['SafeInt']['output'];
  status: Scalars['String']['output'];
  stepId: Maybe<Scalars['String']['output']>;
  stepType: Maybe<Scalars['String']['output']>;
}

export interface CopilotActionRunDiagnosticsItemType {
  __typename?: 'CopilotActionRunDiagnosticsItemType';
  actionId: Scalars['String']['output'];
  actionVersion: Scalars['String']['output'];
  agentRuntimeDiagnosticsFingerprint: Scalars['String']['output'];
  agentRuntimeDiagnosticsManifest: CopilotActionRunAgentRuntimeDiagnosticsManifestType;
  agentRuntimeDiagnosticsManifestExportMetadata: CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadataType;
  agentRuntimeNativeTraceEventTypes: Array<Scalars['String']['output']>;
  agentRuntimeProjectedRunStatuses: Array<Scalars['String']['output']>;
  agentRuntimeProjectedSchemaComponents: Array<Scalars['String']['output']>;
  agentRuntimeProjectedStepStatuses: Array<Scalars['String']['output']>;
  agentRuntimeProjectedStepTypes: Array<Scalars['String']['output']>;
  agentRuntimeProjectedTimelineEventTypes: Array<Scalars['String']['output']>;
  agentRuntimeProjectionContractFingerprint: Scalars['String']['output'];
  agentRuntimeProjectionGaps: Array<Scalars['String']['output']>;
  agentRuntimeProjectionSource: Scalars['String']['output'];
  agentRuntimeRunId: Scalars['String']['output'];
  agentRuntimeRunStatus: Scalars['String']['output'];
  agentRuntimeRunStatusGaps: Array<Scalars['String']['output']>;
  agentRuntimeSchemaReadiness: Scalars['String']['output'];
  agentRuntimeSchemaReadinessGaps: Array<Scalars['String']['output']>;
  agentRuntimeStepCount: Scalars['SafeInt']['output'];
  agentRuntimeStepIds: Array<Scalars['String']['output']>;
  agentRuntimeStepKinds: Array<Scalars['String']['output']>;
  agentRuntimeStepStatusGaps: Array<Scalars['String']['output']>;
  agentRuntimeStepStatuses: Array<Scalars['String']['output']>;
  agentRuntimeStepTypes: Array<Scalars['String']['output']>;
  agentRuntimeTargetRunStatuses: Array<Scalars['String']['output']>;
  agentRuntimeTargetSchemaComponents: Array<Scalars['String']['output']>;
  agentRuntimeTargetStepStatuses: Array<Scalars['String']['output']>;
  agentRuntimeTargetStepTypes: Array<Scalars['String']['output']>;
  agentRuntimeTargetTimelineEventTypes: Array<Scalars['String']['output']>;
  agentRuntimeTimelineEntries: Array<Scalars['String']['output']>;
  agentRuntimeTimelineEventTypes: Array<Scalars['String']['output']>;
  agentRuntimeTimelineGaps: Array<Scalars['String']['output']>;
  agentRuntimeTimelineItems: Array<CopilotActionRunAgentRuntimeTimelineItemType>;
  agentRuntimeTimelineRouteEvidenceSetFingerprint: Scalars['String']['output'];
  agentRuntimeUnsupportedRunStatuses: Array<Scalars['String']['output']>;
  agentRuntimeUnsupportedStepStatuses: Array<Scalars['String']['output']>;
  agentRuntimeUnsupportedStepTypes: Array<Scalars['String']['output']>;
  agentRuntimeUnsupportedTimelineEventTypes: Array<Scalars['String']['output']>;
  attempt: Scalars['SafeInt']['output'];
  createdAt: Scalars['DateTime']['output'];
  docId: Maybe<Scalars['String']['output']>;
  errorCode: Maybe<Scalars['String']['output']>;
  hasPreparedRouteTrace: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  preparedRouteActualCount: Scalars['SafeInt']['output'];
  preparedRouteBehaviorFlags: Array<Scalars['String']['output']>;
  preparedRouteCanonicalModelKeys: Array<Scalars['String']['output']>;
  preparedRouteCount: Scalars['SafeInt']['output'];
  preparedRouteDimensionEvidence: Array<Scalars['String']['output']>;
  preparedRouteFallbackOrder: Array<Scalars['String']['output']>;
  preparedRouteFallbackProviderIds: Array<Scalars['String']['output']>;
  preparedRouteKinds: Array<Scalars['String']['output']>;
  preparedRouteModelBackendKinds: Array<Scalars['String']['output']>;
  preparedRouteModelIds: Array<Scalars['String']['output']>;
  preparedRouteOrder: Array<Scalars['String']['output']>;
  preparedRouteProtocols: Array<Scalars['String']['output']>;
  preparedRouteProviderIds: Array<Scalars['String']['output']>;
  preparedRouteRequestLayers: Array<Scalars['String']['output']>;
  preparedRouteRequestedModelIds: Array<Scalars['String']['output']>;
  preparedRouteRequestedModelSources: Array<Scalars['String']['output']>;
  preparedRouteRequestedTargets: Array<Scalars['String']['output']>;
  preparedRouteStepBehaviorFlags: Array<Scalars['String']['output']>;
  preparedRouteStepCanonicalModelKeys: Array<Scalars['String']['output']>;
  preparedRouteStepCount: Scalars['SafeInt']['output'];
  preparedRouteStepDimensionEvidence: Array<Scalars['String']['output']>;
  preparedRouteStepFallbackOrder: Array<Scalars['String']['output']>;
  preparedRouteStepFallbackProviderIds: Array<Scalars['String']['output']>;
  preparedRouteStepIds: Array<Scalars['String']['output']>;
  preparedRouteStepModelBackendKinds: Array<Scalars['String']['output']>;
  preparedRouteStepOrder: Array<Scalars['String']['output']>;
  preparedRouteStepProtocols: Array<Scalars['String']['output']>;
  preparedRouteStepRequestLayers: Array<Scalars['String']['output']>;
  preparedRouteStepRequestedModelSources: Array<Scalars['String']['output']>;
  preparedRouteStepRequestedTargets: Array<Scalars['String']['output']>;
  preparedRouteStepRouteCountMismatches: Array<Scalars['String']['output']>;
  preparedRouteStepRouteCounts: Array<Scalars['String']['output']>;
  preparedRouteStepTargets: Array<Scalars['String']['output']>;
  preparedRouteTargets: Array<Scalars['String']['output']>;
  retryOf: Maybe<Scalars['String']['output']>;
  sessionId: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
}

export interface CopilotActionRunPreparedRouteDiagnosticsRouteType {
  __typename?: 'CopilotActionRunPreparedRouteDiagnosticsRouteType';
  behaviorFlags: Maybe<Array<Scalars['String']['output']>>;
  canonicalModelKey: Maybe<Scalars['String']['output']>;
  dimensionMismatch: Maybe<Scalars['Boolean']['output']>;
  fallbackOrderIndex: Maybe<Scalars['SafeInt']['output']>;
  modelBackendKind: Maybe<Scalars['String']['output']>;
  modelEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  modelId: Scalars['String']['output'];
  protocol: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerHealth: Maybe<Scalars['String']['output']>;
  providerHealthCheckedAt: Maybe<Scalars['String']['output']>;
  providerHealthLastError: Maybe<Scalars['String']['output']>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerPrivacy: Maybe<Scalars['String']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  requestLayer: Maybe<Scalars['String']['output']>;
  requestedDimensions: Maybe<Scalars['SafeInt']['output']>;
  routeIndex: Scalars['SafeInt']['output'];
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
}

export interface CopilotActionRunPreparedRouteDiagnosticsStepType {
  __typename?: 'CopilotActionRunPreparedRouteDiagnosticsStepType';
  actualRouteCount: Scalars['SafeInt']['output'];
  fallbackProviderIds: Array<Scalars['String']['output']>;
  kind: Scalars['String']['output'];
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
  routeCount: Scalars['SafeInt']['output'];
  routeCountMismatch: Scalars['Boolean']['output'];
  routes: Array<CopilotActionRunPreparedRouteDiagnosticsRouteType>;
  stepId: Scalars['String']['output'];
}

export interface CopilotActionRunPreparedRouteDiagnosticsType {
  __typename?: 'CopilotActionRunPreparedRouteDiagnosticsType';
  status: Scalars['String']['output'];
  steps: Array<CopilotActionRunPreparedRouteDiagnosticsStepType>;
  type: Scalars['String']['output'];
}

export interface CopilotAgentRunListFilterInput {
  query?: InputMaybe<Scalars['String']['input']>;
  sourceId?: InputMaybe<Scalars['String']['input']>;
  sourceType?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  workflow?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotAgentRunType {
  __typename?: 'CopilotAgentRunType';
  actorId: Scalars['String']['output'];
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  evidenceFingerprint: Scalars['String']['output'];
  executionResultCount: Scalars['SafeInt']['output'];
  executionResults: Array<CopilotAgentRuntimeExecutionResultType>;
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  lastAttemptAt: Maybe<Scalars['DateTime']['output']>;
  queuedAt: Maybe<Scalars['DateTime']['output']>;
  sourceId: Scalars['String']['output'];
  sourceType: Scalars['String']['output'];
  startedAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  steps: Array<CopilotAgentStepType>;
  targetFingerprint: Scalars['String']['output'];
  timelineEvents: Array<CopilotAgentTimelineEventType>;
  timelineFingerprint: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workerAttempt: Scalars['SafeInt']['output'];
  workerLeaseExpiresAt: Maybe<Scalars['DateTime']['output']>;
  workerLeaseId: Maybe<Scalars['String']['output']>;
  workerMaxAttempts: Scalars['SafeInt']['output'];
  workflow: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotAgentRuntimeControlInput {
  action: Scalars['String']['input'];
  expectedApprovalFingerprint?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  runId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotAgentRuntimeDocUpdateRequestInput {
  content: Scalars['String']['input'];
  contentFingerprint?: InputMaybe<Scalars['String']['input']>;
  docId: Scalars['String']['input'];
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  sessionId?: InputMaybe<Scalars['ID']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotAgentRuntimeExecutionResultType {
  __typename?: 'CopilotAgentRuntimeExecutionResultType';
  actorId: Scalars['String']['output'];
  adapterWorkflow: Scalars['String']['output'];
  completedAt: Scalars['DateTime']['output'];
  createdAt: Scalars['DateTime']['output'];
  executor: Scalars['String']['output'];
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  resultFingerprint: Scalars['String']['output'];
  resultPayload: Scalars['JSON']['output'];
  resultStatus: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  sideEffectMode: Scalars['String']['output'];
  sideEffectsApplied: Scalars['Boolean']['output'];
  sourceId: Scalars['String']['output'];
  sourceType: Scalars['String']['output'];
  summary: Scalars['String']['output'];
  workerAttempt: Scalars['SafeInt']['output'];
  workerLeaseId: Scalars['String']['output'];
  workflow: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotAgentRuntimeOfficeCommandRequestInput {
  command: Scalars['JSON']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotAgentRuntimeWorkflowAdapterCapabilitiesType {
  __typename?: 'CopilotAgentRuntimeWorkflowAdapterCapabilitiesType';
  sideEffectMode: Scalars['String']['output'];
  summary: Scalars['String']['output'];
  supportedStepTypes: Array<Scalars['String']['output']>;
  version: Scalars['String']['output'];
}

export interface CopilotAgentRuntimeWorkflowAdapterType {
  __typename?: 'CopilotAgentRuntimeWorkflowAdapterType';
  capabilities: CopilotAgentRuntimeWorkflowAdapterCapabilitiesType;
  workflow: Scalars['String']['output'];
}

export interface CopilotAgentStepType {
  __typename?: 'CopilotAgentStepType';
  actorId: Scalars['String']['output'];
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  evidenceFingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  order: Scalars['SafeInt']['output'];
  outputSummary: Scalars['JSON']['output'];
  runId: Scalars['String']['output'];
  startedAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  stepKey: Scalars['String']['output'];
  stepType: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotAgentTimelineEventType {
  __typename?: 'CopilotAgentTimelineEventType';
  actorId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  eventFingerprint: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  id: Scalars['String']['output'];
  ordinal: Scalars['SafeInt']['output'];
  payload: Scalars['JSON']['output'];
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  stepId: Maybe<Scalars['String']['output']>;
  summary: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotBlockerSuggestionInput {
  aiSuggestionId: Scalars['String']['input'];
  confirmationProof: Scalars['String']['input'];
  confirmationRequired: Scalars['Boolean']['input'];
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  origin: Scalars['String']['input'];
  title: Scalars['String']['input'];
  type: Scalars['String']['input'];
  waitingOn: Scalars['String']['input'];
}

export interface CopilotBlockerType {
  __typename?: 'CopilotBlockerType';
  createdAt: Scalars['DateTime']['output'];
  creatorUserId: Scalars['String']['output'];
  dueAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  origin: Scalars['String']['output'];
  overdue: Scalars['Boolean']['output'];
  projectId: Scalars['ID']['output'];
  resolutionActorUserId: Maybe<Scalars['String']['output']>;
  resolvedAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  waitingOn: Scalars['String']['output'];
}

export interface CopilotContext {
  __typename?: 'CopilotContext';
  /** list blobs in context */
  blobs: Array<CopilotContextBlob>;
  /** list collections in context */
  collections: Array<CopilotContextCategory>;
  /** list files in context */
  docs: Array<CopilotContextDoc>;
  /** list files in context */
  files: Array<CopilotContextFile>;
  id: Maybe<Scalars['ID']['output']>;
  /** match file in context */
  matchFiles: Array<ContextMatchedFileChunk>;
  /** match workspace docs */
  matchWorkspaceDocs: Array<ContextMatchedDocChunk>;
  /** list tags in context */
  tags: Array<CopilotContextCategory>;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotContextMatchFilesArgs {
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}

export interface CopilotContextMatchWorkspaceDocsArgs {
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}

export interface CopilotContextBlob {
  __typename?: 'CopilotContextBlob';
  createdAt: Scalars['SafeInt']['output'];
  id: Scalars['ID']['output'];
  status: Maybe<ContextEmbedStatus>;
}

export interface CopilotContextCategory {
  __typename?: 'CopilotContextCategory';
  createdAt: Scalars['SafeInt']['output'];
  docs: Array<CopilotContextDoc>;
  id: Scalars['ID']['output'];
  type: ContextCategories;
}

export interface CopilotContextDoc {
  __typename?: 'CopilotContextDoc';
  createdAt: Scalars['SafeInt']['output'];
  id: Scalars['ID']['output'];
  isModified: Scalars['Boolean']['output'];
  snapshotUpdatedAt: Maybe<Scalars['SafeInt']['output']>;
  status: Maybe<ContextEmbedStatus>;
  updatedAt: Maybe<Scalars['SafeInt']['output']>;
}

export interface CopilotContextDocumentRefType {
  __typename?: 'CopilotContextDocumentRefType';
  docId: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotContextFile {
  __typename?: 'CopilotContextFile';
  blobId: Scalars['String']['output'];
  chunkSize: Scalars['SafeInt']['output'];
  createdAt: Scalars['SafeInt']['output'];
  error: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  name: Scalars['String']['output'];
  status: ContextEmbedStatus;
}

export interface CopilotContextFileNotSupportedDataType {
  __typename?: 'CopilotContextFileNotSupportedDataType';
  fileName: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface CopilotContextMemoryEventType {
  __typename?: 'CopilotContextMemoryEventType';
  canUndo: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  explicit: Scalars['Boolean']['output'];
  factKey: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  memoryId: Maybe<Scalars['String']['output']>;
  operation: Scalars['String']['output'];
  previousMemoryId: Maybe<Scalars['String']['output']>;
  reasonCode: Scalars['String']['output'];
  sourceSessionId: Maybe<Scalars['String']['output']>;
  sourceTurnId: Maybe<Scalars['String']['output']>;
  targetEventId: Maybe<Scalars['String']['output']>;
  undoneAt: Maybe<Scalars['DateTime']['output']>;
  writerVersion: Scalars['String']['output'];
}

export enum CopilotContextMemoryManualKindInput {
  project_summary = 'project_summary',
  rule = 'rule',
}

export enum CopilotContextMemoryMutableStatusInput {
  active = 'active',
  disabled = 'disabled',
}

export enum CopilotContextMemoryScopeInput {
  document = 'document',
  project = 'project',
  user = 'user',
  workspace = 'workspace',
}

export interface CopilotContextMemoryType {
  __typename?: 'CopilotContextMemoryType';
  captureMode: Scalars['String']['output'];
  confidence: Scalars['Float']['output'];
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  docId: Maybe<Scalars['String']['output']>;
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  factKey: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  importance: Scalars['Float']['output'];
  kind: Scalars['String']['output'];
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  ownerUserId: Scalars['String']['output'];
  projectId: Maybe<Scalars['String']['output']>;
  scope: Scalars['String']['output'];
  sensitivity: Scalars['String']['output'];
  sourceSessionId: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  supersedesId: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  useCount: Scalars['Int']['output'];
  validFrom: Maybe<Scalars['DateTime']['output']>;
  validUntil: Maybe<Scalars['DateTime']['output']>;
  visibility: Scalars['String']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
  writerVersion: Scalars['String']['output'];
}

export interface CopilotContextPolicyRevisionType {
  __typename?: 'CopilotContextPolicyRevisionType';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Maybe<Scalars['String']['output']>;
  fingerprint: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  revision: Scalars['Int']['output'];
  source: Scalars['String']['output'];
}

export interface CopilotContextPolicyType {
  __typename?: 'CopilotContextPolicyType';
  activeRevision: Scalars['Int']['output'];
  applicationMode: Scalars['String']['output'];
  canManage: Scalars['Boolean']['output'];
  conditions: Scalars['JSON']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  hits: Array<CopilotContextRuleHitType>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  priority: Scalars['Int']['output'];
  revisions: Array<CopilotContextPolicyRevisionType>;
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotContextProjectDocumentAddResultType {
  __typename?: 'CopilotContextProjectDocumentAddResultType';
  outcome: Scalars['String']['output'];
  projectDocument: CopilotContextProjectDocumentType;
}

export interface CopilotContextProjectDocumentInputType {
  docId: Scalars['String']['input'];
  groupId?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotContextProjectDocumentType {
  __typename?: 'CopilotContextProjectDocumentType';
  accessRequestId: Maybe<Scalars['String']['output']>;
  addedByMe: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  docId: Maybe<Scalars['String']['output']>;
  groupId: Maybe<Scalars['String']['output']>;
  requestedLevel: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotContextProjectMemberType {
  __typename?: 'CopilotContextProjectMemberType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  name: Scalars['String']['output'];
  role: Scalars['String']['output'];
  userId: Scalars['String']['output'];
}

export interface CopilotContextProjectType {
  __typename?: 'CopilotContextProjectType';
  aiPolicy: Scalars['String']['output'];
  canManage: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  documentCount: Scalars['Int']['output'];
  documents: Array<CopilotContextProjectDocumentType>;
  id: Scalars['ID']['output'];
  members: Array<CopilotContextProjectMemberType>;
  name: Scalars['String']['output'];
  role: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
}

export interface CopilotContextProjectWorkspaceDocumentInputType {
  docId: Scalars['String']['input'];
  groupId?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
}

export interface CopilotContextProjectWorkspaceDocumentsInputType {
  documents: Array<CopilotContextProjectWorkspaceDocumentInputType>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotContextRuleConditionsInput {
  docIds?: InputMaybe<Array<Scalars['String']['input']>>;
  documentRefs?: InputMaybe<Array<CopilotContextRuleDocumentRefInput>>;
  keywords?: InputMaybe<Array<Scalars['String']['input']>>;
  match?: InputMaybe<Scalars['String']['input']>;
  projectIds?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface CopilotContextRuleDocumentRefInput {
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotContextRuleHitType {
  __typename?: 'CopilotContextRuleHitType';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  matchReason: Scalars['String']['output'];
  score: Scalars['Float']['output'];
  sessionId: Scalars['String']['output'];
  sourceTurnId: Maybe<Scalars['String']['output']>;
}

export interface CopilotContextRuleRevisionType {
  __typename?: 'CopilotContextRuleRevisionType';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdByUserId: Maybe<Scalars['String']['output']>;
  fingerprint: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  revision: Scalars['Int']['output'];
  source: Scalars['String']['output'];
}

export interface CopilotContextRuleType {
  __typename?: 'CopilotContextRuleType';
  activeRevision: Scalars['Int']['output'];
  applicationMode: Scalars['String']['output'];
  conditions: Scalars['JSON']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  hits: Array<CopilotContextRuleHitType>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  ownerUserId: Scalars['String']['output'];
  priority: Scalars['Int']['output'];
  projectId: Maybe<Scalars['String']['output']>;
  revisions: Array<CopilotContextRuleRevisionType>;
  scope: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotContextScopeProjectType {
  __typename?: 'CopilotContextScopeProjectType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
}

export interface CopilotContextSessionScopeType {
  __typename?: 'CopilotContextSessionScopeType';
  candidateProjectIds: Array<Scalars['String']['output']>;
  candidateProjects: Array<CopilotContextScopeProjectType>;
  primaryDocId: Maybe<Scalars['String']['output']>;
  projectIds: Array<Scalars['String']['output']>;
  projectResolution: Scalars['String']['output'];
  readableDocIds: Array<Scalars['String']['output']>;
  readableDocumentRefs: Array<CopilotContextDocumentRefType>;
  selectedProjectId: Maybe<Scalars['String']['output']>;
  sessionId: Scalars['String']['output'];
}

export interface CopilotContextSettingsType {
  __typename?: 'CopilotContextSettingsType';
  autoMemoryEnabled: Scalars['Boolean']['output'];
}

export interface CopilotContextStrategyType {
  __typename?: 'CopilotContextStrategyType';
  checkpointCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  fingerprint: Scalars['String']['output'];
  lastCheckpointAt: Maybe<Scalars['DateTime']['output']>;
  lastTraceAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  traceCount: Scalars['Int']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotDocNotFoundDataType {
  __typename?: 'CopilotDocNotFoundDataType';
  docId: Scalars['String']['output'];
}

export interface CopilotDocumentFolderType {
  __typename?: 'CopilotDocumentFolderType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
}

export interface CopilotDocumentFoldersType {
  __typename?: 'CopilotDocumentFoldersType';
  items: Array<CopilotDocumentFolderType>;
  nextCursor: Maybe<Scalars['String']['output']>;
}

export interface CopilotDocumentOperationType {
  __typename?: 'CopilotDocumentOperationType';
  accessRequestId: Maybe<Scalars['ID']['output']>;
  createdDocumentAt: Maybe<Scalars['DateTime']['output']>;
  destinationFolderId: Maybe<Scalars['ID']['output']>;
  destinationRevision: Scalars['Int']['output'];
  destinationWorkspaceId: Maybe<Scalars['ID']['output']>;
  documentId: Scalars['ID']['output'];
  failureCode: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  locationExpiresAt: Scalars['DateTime']['output'];
  placedDocumentAt: Maybe<Scalars['DateTime']['output']>;
  projectStatus: Scalars['String']['output'];
  sourceDocumentId: Maybe<Scalars['ID']['output']>;
  sourceWorkspaceId: Maybe<Scalars['ID']['output']>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
}

export interface CopilotDocumentWorkspaceType {
  __typename?: 'CopilotDocumentWorkspaceType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
}

export interface CopilotFailedToAddWorkspaceFileEmbeddingDataType {
  __typename?: 'CopilotFailedToAddWorkspaceFileEmbeddingDataType';
  message: Scalars['String']['output'];
}

export interface CopilotFailedToGenerateEmbeddingDataType {
  __typename?: 'CopilotFailedToGenerateEmbeddingDataType';
  message: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface CopilotFailedToMatchContextDataType {
  __typename?: 'CopilotFailedToMatchContextDataType';
  content: Scalars['String']['output'];
  contextId: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface CopilotFailedToMatchGlobalContextDataType {
  __typename?: 'CopilotFailedToMatchGlobalContextDataType';
  content: Scalars['String']['output'];
  message: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotFailedToModifyContextDataType {
  __typename?: 'CopilotFailedToModifyContextDataType';
  contextId: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface CopilotHistories {
  __typename?: 'CopilotHistories';
  /** An mark identifying which view to use to display the session */
  action: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  docId: Maybe<Scalars['String']['output']>;
  messages: Array<ChatMessage>;
  model: Scalars['String']['output'];
  optionalModels: Array<Scalars['String']['output']>;
  parentSessionId: Maybe<Scalars['String']['output']>;
  pinned: Scalars['Boolean']['output'];
  promptName: Scalars['String']['output'];
  selectedContextProjectId: Maybe<Scalars['String']['output']>;
  sessionId: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  /** The number of tokens used in the session */
  tokens: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotHistoriesTypeEdge {
  __typename?: 'CopilotHistoriesTypeEdge';
  cursor: Scalars['String']['output'];
  node: CopilotHistories;
}

export interface CopilotInvalidContextDataType {
  __typename?: 'CopilotInvalidContextDataType';
  contextId: Scalars['String']['output'];
}

export interface CopilotMessageNotFoundDataType {
  __typename?: 'CopilotMessageNotFoundDataType';
  messageId: Scalars['String']['output'];
}

export interface CopilotModelPromptSourceType {
  __typename?: 'CopilotModelPromptSourceType';
  candidateSource: Scalars['String']['output'];
  modelConfigPath: Maybe<Scalars['String']['output']>;
  modelSource: Maybe<Scalars['String']['output']>;
}

export interface CopilotModelRegistryPublishInput {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  modelDefinition: Scalars['JSON']['input'];
  modelId: Scalars['String']['input'];
  providerId: Scalars['String']['input'];
  revision?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotModelRegistryRevisionType {
  __typename?: 'CopilotModelRegistryRevisionType';
  actorId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fallbackSourceChain: Scalars['JSON']['output'];
  fingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  modelDefinition: Scalars['JSON']['output'];
  modelId: Scalars['String']['output'];
  providerId: Scalars['String']['output'];
  publishEventCount: Scalars['SafeInt']['output'];
  publishEvents: Array<CopilotRegistryRevisionPublishEventType>;
  revision: Scalars['String']['output'];
  scopeType: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotModelRegistrySourceChainEntryType {
  __typename?: 'CopilotModelRegistrySourceChainEntryType';
  actorId: Maybe<Scalars['String']['output']>;
  fingerprint: Maybe<Scalars['String']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  providerId: Maybe<Scalars['String']['output']>;
  revision: Maybe<Scalars['String']['output']>;
  scope: Scalars['String']['output'];
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Maybe<Scalars['String']['output']>;
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotModelType {
  __typename?: 'CopilotModelType';
  contextWindow: Maybe<Scalars['SafeInt']['output']>;
  costInputPer1M: Maybe<Scalars['Int']['output']>;
  costOutputPer1M: Maybe<Scalars['Int']['output']>;
  effectiveSourceFingerprint: Maybe<Scalars['String']['output']>;
  effectiveSourceFingerprintInputs: Maybe<Array<Scalars['String']['output']>>;
  effectiveSourceFingerprintVersion: Maybe<Scalars['String']['output']>;
  embeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  id: Scalars['String']['output'];
  maxOutputTokens: Maybe<Scalars['SafeInt']['output']>;
  modelRegistryRevision: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionActorId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  modelRegistryRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  modelRegistryRevisionScope: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionSourceChain: Maybe<
    Array<CopilotModelRegistrySourceChainEntryType>
  >;
  modelRegistryRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  modelRegistryRevisionStatus: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  promptAction: Maybe<Scalars['String']['output']>;
  promptCategory: Scalars['String']['output'];
  promptDefaultPolicy: Maybe<Scalars['String']['output']>;
  promptModelConfigPath: Maybe<Scalars['String']['output']>;
  promptModelSource: Maybe<Scalars['String']['output']>;
  promptModelSources: Array<CopilotModelPromptSourceType>;
  promptName: Scalars['String']['output'];
  promptOverrideApplied: Scalars['Boolean']['output'];
  promptSource: Scalars['String']['output'];
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerHealth: Maybe<Scalars['String']['output']>;
  providerHealthCheckedAt: Maybe<Scalars['String']['output']>;
  providerHealthLastError: Maybe<Scalars['String']['output']>;
  providerId: Maybe<Scalars['String']['output']>;
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerPrivacy: Maybe<Scalars['String']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
  routeAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeAttachmentSourceKinds: Maybe<Array<Scalars['String']['output']>>;
  routeBackendKind: Maybe<Scalars['String']['output']>;
  routeBehaviorFlags: Maybe<Array<Scalars['String']['output']>>;
  routeCanonicalModelKey: Maybe<Scalars['String']['output']>;
  routeFallbackProviderIds: Maybe<Array<Scalars['String']['output']>>;
  routeInputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeModelId: Maybe<Scalars['String']['output']>;
  routeOutputTypes: Maybe<Array<Scalars['String']['output']>>;
  routePolicyAllowedPrivacy: Maybe<Array<Scalars['String']['output']>>;
  routePolicyAllowedProviderIds: Maybe<Array<Scalars['String']['output']>>;
  routePolicyBlockedProviderIds: Maybe<Array<Scalars['String']['output']>>;
  routePolicyEnabled: Scalars['Boolean']['output'];
  routePolicyFeatureKind: Maybe<Scalars['String']['output']>;
  routePolicyPreferredPrivacy: Maybe<Array<Scalars['String']['output']>>;
  routePolicyWorkspaceId: Maybe<Scalars['String']['output']>;
  routeProtocol: Maybe<Scalars['String']['output']>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
  routeRequestLayer: Maybe<Scalars['String']['output']>;
  routeStructuredAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeStructuredAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeStructuredAttachmentSourceKinds: Maybe<
    Array<Scalars['String']['output']>
  >;
  sources: Array<Scalars['String']['output']>;
}

export interface CopilotModelsType {
  __typename?: 'CopilotModelsType';
  defaultModel: Scalars['String']['output'];
  defaultModelFallbackReason: Maybe<Scalars['String']['output']>;
  defaultModelSource: Scalars['String']['output'];
  embeddingRoute: Maybe<CopilotTaskRouteDiagnosticsType>;
  optionalModels: Array<CopilotModelType>;
  proModels: Array<CopilotModelType>;
  promptDefaultModel: Scalars['String']['output'];
  rerankRoute: Maybe<CopilotTaskRouteDiagnosticsType>;
}

export interface CopilotPreparedTaskRouteDiagnosticsType {
  __typename?: 'CopilotPreparedTaskRouteDiagnosticsType';
  behaviorFlags: Maybe<Array<Scalars['String']['output']>>;
  canonicalModelKey: Maybe<Scalars['String']['output']>;
  dimensionMismatch: Maybe<Scalars['Boolean']['output']>;
  fallbackOrderIndex: Maybe<Scalars['SafeInt']['output']>;
  modelBackendKind: Maybe<Scalars['String']['output']>;
  modelEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  modelId: Scalars['String']['output'];
  protocol: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  requestLayer: Maybe<Scalars['String']['output']>;
  requestedDimensions: Maybe<Scalars['SafeInt']['output']>;
  routeIndex: Scalars['SafeInt']['output'];
}

export interface CopilotProjectAiPolicyType {
  __typename?: 'CopilotProjectAiPolicyType';
  policy: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  updatedAt: Maybe<Scalars['DateTime']['output']>;
  updatedByUserId: Maybe<Scalars['String']['output']>;
}

export interface CopilotProjectGrantRevocationType {
  __typename?: 'CopilotProjectGrantRevocationType';
  grant: CopilotProjectGrantType;
  quarantinedMemoryCount: Scalars['Int']['output'];
  rerequestCardId: Maybe<Scalars['String']['output']>;
}

export interface CopilotProjectGrantType {
  __typename?: 'CopilotProjectGrantType';
  accessRequestId: Maybe<Scalars['String']['output']>;
  approvingSide: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  docId: Scalars['String']['output'];
  grantedAt: Scalars['DateTime']['output'];
  grantedByUserId: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  level: Scalars['String']['output'];
  projectId: Scalars['String']['output'];
  projectName: Scalars['String']['output'];
  revocable: Scalars['Boolean']['output'];
  revokedAt: Maybe<Scalars['DateTime']['output']>;
  revokedByUserId: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotProjectInvitationType {
  __typename?: 'CopilotProjectInvitationType';
  acceptedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  declinedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  inviteeUserId: Scalars['String']['output'];
  inviterUserId: Scalars['String']['output'];
  projectId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  withdrawnAt: Maybe<Scalars['DateTime']['output']>;
}

export interface CopilotPromptCatalogItemType {
  __typename?: 'CopilotPromptCatalogItemType';
  action: Maybe<Scalars['String']['output']>;
  category: Scalars['String']['output'];
  defaultPolicy: Maybe<Scalars['String']['output']>;
  fingerprint: Scalars['String']['output'];
  model: Scalars['String']['output'];
  modelConfigPath: Maybe<Scalars['String']['output']>;
  modelSource: Scalars['String']['output'];
  modelStrategyFingerprint: Scalars['String']['output'];
  name: Scalars['String']['output'];
  optionalModelCount: Scalars['SafeInt']['output'];
  optionalModels: Array<Scalars['String']['output']>;
  optionalModelsConfigPath: Maybe<Scalars['String']['output']>;
  optionalModelsSource: Scalars['String']['output'];
  overrideApplied: Scalars['Boolean']['output'];
  paramCount: Scalars['SafeInt']['output'];
  paramKeys: Array<Scalars['String']['output']>;
  proModelCount: Scalars['SafeInt']['output'];
  proModelsConfigPath: Maybe<Scalars['String']['output']>;
  proModelsSource: Scalars['String']['output'];
  registryFingerprint: Maybe<Scalars['String']['output']>;
  registryId: Maybe<Scalars['SafeInt']['output']>;
  registryMessageCount: Maybe<Scalars['SafeInt']['output']>;
  registryModified: Maybe<Scalars['Boolean']['output']>;
  registryRecordSource: Maybe<Scalars['String']['output']>;
  registryRevision: Maybe<Scalars['String']['output']>;
  registryRevisionActorId: Maybe<Scalars['String']['output']>;
  registryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  registryRevisionId: Maybe<Scalars['String']['output']>;
  registryRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  registryRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  registryRevisionScope: Maybe<Scalars['String']['output']>;
  registryRevisionStatus: Maybe<Scalars['String']['output']>;
  registryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  registrySourceChain: Maybe<Array<CopilotPromptRegistrySourceChainEntryType>>;
  registrySourceChainFingerprint: Maybe<Scalars['String']['output']>;
  registryUpdatedAt: Maybe<Scalars['DateTime']['output']>;
  registryValidationBlockingCount: Maybe<Scalars['SafeInt']['output']>;
  registryValidationDetail: Maybe<Scalars['String']['output']>;
  registryValidationErrorCount: Maybe<Scalars['SafeInt']['output']>;
  registryValidationIssueCount: Maybe<Scalars['SafeInt']['output']>;
  registryValidationIssues: Maybe<
    Array<CopilotPromptRegistryValidationIssueType>
  >;
  registryValidationPublishStatus: Maybe<Scalars['String']['output']>;
  registryValidationReason: Maybe<Scalars['String']['output']>;
  registryValidationRemediations: Maybe<
    Array<CopilotPromptRegistryValidationRemediationType>
  >;
  registryValidationStatus: Maybe<Scalars['String']['output']>;
  revision: Scalars['String']['output'];
  source: Scalars['String']['output'];
  templateFingerprint: Scalars['String']['output'];
  versionEvidence: CopilotPromptCatalogVersionEvidenceType;
}

export interface CopilotPromptCatalogVersionEvidenceType {
  __typename?: 'CopilotPromptCatalogVersionEvidenceType';
  defaultPolicy: Maybe<Scalars['String']['output']>;
  fingerprint: Scalars['String']['output'];
  modelConfigPath: Maybe<Scalars['String']['output']>;
  modelStrategyFingerprint: Scalars['String']['output'];
  optionalModelsConfigPath: Maybe<Scalars['String']['output']>;
  overrideApplied: Scalars['Boolean']['output'];
  proModelsConfigPath: Maybe<Scalars['String']['output']>;
  registryFingerprint: Maybe<Scalars['String']['output']>;
  registryId: Maybe<Scalars['SafeInt']['output']>;
  registryMessageCount: Maybe<Scalars['SafeInt']['output']>;
  registryModified: Maybe<Scalars['Boolean']['output']>;
  registryRecordSource: Maybe<Scalars['String']['output']>;
  registryRevision: Maybe<Scalars['String']['output']>;
  registryRevisionActorId: Maybe<Scalars['String']['output']>;
  registryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  registryRevisionId: Maybe<Scalars['String']['output']>;
  registryRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  registryRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  registryRevisionScope: Maybe<Scalars['String']['output']>;
  registryRevisionStatus: Maybe<Scalars['String']['output']>;
  registryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  registrySourceChain: Maybe<Array<CopilotPromptRegistrySourceChainEntryType>>;
  registrySourceChainFingerprint: Maybe<Scalars['String']['output']>;
  registryUpdatedAt: Maybe<Scalars['DateTime']['output']>;
  registryValidationBlockingCount: Maybe<Scalars['SafeInt']['output']>;
  registryValidationDetail: Maybe<Scalars['String']['output']>;
  registryValidationErrorCount: Maybe<Scalars['SafeInt']['output']>;
  registryValidationIssueCount: Maybe<Scalars['SafeInt']['output']>;
  registryValidationIssues: Maybe<
    Array<CopilotPromptRegistryValidationIssueType>
  >;
  registryValidationPublishStatus: Maybe<Scalars['String']['output']>;
  registryValidationReason: Maybe<Scalars['String']['output']>;
  registryValidationRemediations: Maybe<
    Array<CopilotPromptRegistryValidationRemediationType>
  >;
  registryValidationStatus: Maybe<Scalars['String']['output']>;
  revision: Scalars['String']['output'];
  templateFingerprint: Scalars['String']['output'];
}

export interface CopilotPromptNotFoundDataType {
  __typename?: 'CopilotPromptNotFoundDataType';
  name: Scalars['String']['output'];
}

export interface CopilotPromptRegistryBodyEditDiffLineType {
  __typename?: 'CopilotPromptRegistryBodyEditDiffLineType';
  kind: Scalars['String']['output'];
  newLine: Maybe<Scalars['SafeInt']['output']>;
  oldLine: Maybe<Scalars['SafeInt']['output']>;
  text: Scalars['String']['output'];
}

export interface CopilotPromptRegistryBodyEditDiffType {
  __typename?: 'CopilotPromptRegistryBodyEditDiffType';
  addedLineCount: Scalars['SafeInt']['output'];
  lines: Array<CopilotPromptRegistryBodyEditDiffLineType>;
  removedLineCount: Scalars['SafeInt']['output'];
  unchangedLineCount: Scalars['SafeInt']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotPromptRegistryBodyEditPreviewInput {
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  messageIndex: Scalars['SafeInt']['input'];
  name: Scalars['String']['input'];
  nextContent: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotPromptRegistryBodyEditPreviewType {
  __typename?: 'CopilotPromptRegistryBodyEditPreviewType';
  changed: Scalars['Boolean']['output'];
  currentContent: Scalars['String']['output'];
  currentContentFingerprint: Scalars['String']['output'];
  diff: CopilotPromptRegistryBodyEditDiffType;
  diffFingerprint: Scalars['String']['output'];
  messageIndex: Scalars['SafeInt']['output'];
  name: Scalars['String']['output'];
  nextContent: Scalars['String']['output'];
  nextContentFingerprint: Scalars['String']['output'];
  previewFingerprint: Scalars['String']['output'];
  registryFingerprint: Scalars['String']['output'];
  registryId: Scalars['SafeInt']['output'];
  registryUpdatedAt: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotPromptRegistryBodyEditPublishInput {
  expectedPreviewFingerprint: Scalars['String']['input'];
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  messageIndex: Scalars['SafeInt']['input'];
  name: Scalars['String']['input'];
  nextContent: Scalars['String']['input'];
  reviewNote?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotPromptRegistryBodyEditPublishType {
  __typename?: 'CopilotPromptRegistryBodyEditPublishType';
  preview: CopilotPromptRegistryBodyEditPreviewType;
  revision: CopilotPromptRegistryRevisionType;
}

export interface CopilotPromptRegistryPublishGateActionRouteDryRunRouteType {
  __typename?: 'CopilotPromptRegistryPublishGateActionRouteDryRunRouteType';
  fallbackOrderIndex: Maybe<Scalars['SafeInt']['output']>;
  modelId: Scalars['String']['output'];
  protocol: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerHealth: Maybe<Scalars['String']['output']>;
  providerHealthCheckedAt: Maybe<Scalars['String']['output']>;
  providerHealthLastError: Maybe<Scalars['String']['output']>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerPrivacy: Maybe<Scalars['String']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  requestLayer: Maybe<Scalars['String']['output']>;
  routeIndex: Scalars['SafeInt']['output'];
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryPublishGateActionRouteDryRunStepType {
  __typename?: 'CopilotPromptRegistryPublishGateActionRouteDryRunStepType';
  actualRouteCount: Scalars['SafeInt']['output'];
  fallbackProviderIds: Array<Scalars['String']['output']>;
  kind: Scalars['String']['output'];
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
  routeCount: Scalars['SafeInt']['output'];
  routeCountMismatch: Scalars['Boolean']['output'];
  routes: Array<CopilotPromptRegistryPublishGateActionRouteDryRunRouteType>;
  stepId: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateActionRouteDryRunType {
  __typename?: 'CopilotPromptRegistryPublishGateActionRouteDryRunType';
  actionId: Maybe<Scalars['String']['output']>;
  actualRouteCount: Scalars['SafeInt']['output'];
  diagnosticsErrorCode: Maybe<Scalars['String']['output']>;
  diagnosticsErrorMessage: Maybe<Scalars['String']['output']>;
  diagnosticsErrorStage: Maybe<Scalars['String']['output']>;
  errorCode: Maybe<Scalars['String']['output']>;
  errorMessage: Maybe<Scalars['String']['output']>;
  expectedRouteCount: Scalars['SafeInt']['output'];
  featureKind: Scalars['String']['output'];
  missingRouteCount: Scalars['SafeInt']['output'];
  routeCountMismatch: Scalars['Boolean']['output'];
  routeCountMismatchStepIds: Array<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  steps: Array<CopilotPromptRegistryPublishGateActionRouteDryRunStepType>;
}

export interface CopilotPromptRegistryPublishGateExpectedVersionInput {
  registryFingerprint?: InputMaybe<Scalars['String']['input']>;
  registryId?: InputMaybe<Scalars['SafeInt']['input']>;
  registryUpdatedAt?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotPromptRegistryPublishGateModelRouteType {
  __typename?: 'CopilotPromptRegistryPublishGateModelRouteType';
  available: Scalars['Boolean']['output'];
  behaviorFlags: Maybe<Array<Scalars['String']['output']>>;
  candidateConfigPath: Maybe<Scalars['String']['output']>;
  candidateCount: Scalars['SafeInt']['output'];
  candidateIndex: Scalars['SafeInt']['output'];
  candidateKind: Scalars['String']['output'];
  canonicalModelKey: Maybe<Scalars['String']['output']>;
  checked: Scalars['Boolean']['output'];
  configured: Scalars['Boolean']['output'];
  diagnosticsErrorCode: Maybe<Scalars['String']['output']>;
  diagnosticsErrorMessage: Maybe<Scalars['String']['output']>;
  diagnosticsErrorStage: Maybe<Scalars['String']['output']>;
  effectiveSourceFingerprint: Maybe<Scalars['String']['output']>;
  effectiveSourceFingerprintInputs: Maybe<Array<Scalars['String']['output']>>;
  effectiveSourceFingerprintVersion: Maybe<Scalars['String']['output']>;
  fallbackProviderIds: Array<Scalars['String']['output']>;
  featureKind: Scalars['String']['output'];
  matchedCandidateCount: Scalars['SafeInt']['output'];
  modelBackendKind: Maybe<Scalars['String']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  modelRegistryRevision: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionActorId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionScope: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionSourceChain: Maybe<
    Array<CopilotModelRegistrySourceChainEntryType>
  >;
  modelRegistryRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  modelRegistryRevisionStatus: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  outputType: Scalars['String']['output'];
  policyAllowedPrivacy: Maybe<Array<Scalars['String']['output']>>;
  policyAllowedProviderIds: Maybe<Array<Scalars['String']['output']>>;
  policyBlockedProviderIds: Maybe<Array<Scalars['String']['output']>>;
  policyCandidates: Array<CopilotPromptRegistryPublishGatePolicyCandidateType>;
  policyEnabled: Scalars['Boolean']['output'];
  policyFeatureKind: Maybe<Scalars['String']['output']>;
  policyPreferredPrivacy: Maybe<Array<Scalars['String']['output']>>;
  policyWorkspaceId: Maybe<Scalars['String']['output']>;
  protocol: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerHealth: Maybe<Scalars['String']['output']>;
  providerHealthCheckedAt: Maybe<Scalars['String']['output']>;
  providerHealthLastError: Maybe<Scalars['String']['output']>;
  providerId: Maybe<Scalars['String']['output']>;
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerPrivacy: Maybe<Scalars['String']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  requestLayer: Maybe<Scalars['String']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
  routeCandidates: Array<CopilotPromptRegistryPublishGateRouteCandidateType>;
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
  routeTrace: Array<CopilotPromptRegistryPublishGateRouteTracePhaseType>;
}

export interface CopilotPromptRegistryPublishGatePolicyCandidateType {
  __typename?: 'CopilotPromptRegistryPublishGatePolicyCandidateType';
  allowed: Scalars['Boolean']['output'];
  available: Scalars['Boolean']['output'];
  candidateFingerprint: Scalars['String']['output'];
  candidateKey: Scalars['String']['output'];
  health: Scalars['String']['output'];
  healthCheckedAt: Maybe<Scalars['String']['output']>;
  privacy: Scalars['String']['output'];
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
}

export interface CopilotPromptRegistryPublishGateRepairActionCatalogEntryType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairActionCatalogEntryType';
  actionKind: Scalars['String']['output'];
  catalogVersion: Scalars['String']['output'];
  inputSchema: Scalars['JSON']['output'];
  recommendationCount: Scalars['SafeInt']['output'];
  requiredCapabilities: Array<Scalars['String']['output']>;
  safety: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairActionMutationGuardType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairActionMutationGuardType';
  auditSummary: Scalars['String']['output'];
  auditSummaryFingerprint: Scalars['String']['output'];
  catalogFingerprint: Scalars['String']['output'];
  catalogVersion: Scalars['String']['output'];
  expectedRegistryFingerprint: Scalars['String']['output'];
  expectedRegistryId: Scalars['SafeInt']['output'];
  expectedRegistryUpdatedAt: Scalars['String']['output'];
  guardFingerprint: Scalars['String']['output'];
  inputSchemaFingerprint: Scalars['String']['output'];
  intentFingerprint: Scalars['String']['output'];
  recommendationCategories: Array<Scalars['String']['output']>;
  recommendationCodes: Array<Scalars['String']['output']>;
  recommendationCount: Scalars['SafeInt']['output'];
  recommendationFingerprints: Array<Scalars['String']['output']>;
  required: Scalars['Boolean']['output'];
  requiredCapabilities: Array<Scalars['String']['output']>;
  requiredReviewModes: Array<Scalars['String']['output']>;
  safetyLevels: Array<Scalars['String']['output']>;
  suggestedActionKinds: Array<Scalars['String']['output']>;
  targetLocatorCount: Scalars['SafeInt']['output'];
  targetLocatorFingerprint: Scalars['String']['output'];
  targetLocatorKinds: Array<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryPublishGateRepairActionPreviewOperationType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairActionPreviewOperationType';
  actionKind: Scalars['String']['output'];
  candidateEvidenceCount: Scalars['SafeInt']['output'];
  candidateEvidenceEntries: Array<CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType>;
  candidateEvidenceFingerprint: Scalars['String']['output'];
  candidateEvidenceFingerprints: Array<Scalars['String']['output']>;
  candidateEvidenceKeys: Array<Scalars['String']['output']>;
  category: Scalars['String']['output'];
  code: Scalars['String']['output'];
  diagnosticsFingerprint: Scalars['String']['output'];
  embeddingIndexContractEvidenceFingerprints: Array<
    Scalars['String']['output']
  >;
  inputSchema: Scalars['JSON']['output'];
  instanceKey: Maybe<Scalars['String']['output']>;
  operationFingerprint: Scalars['String']['output'];
  preparedRouteOrderFingerprints: Array<Scalars['String']['output']>;
  previewStatus: Scalars['String']['output'];
  requiredCapabilities: Array<Scalars['String']['output']>;
  rerankRuntimeContractEvidenceFingerprints: Array<Scalars['String']['output']>;
  reviewMode: Scalars['String']['output'];
  safety: Scalars['String']['output'];
  target: Scalars['String']['output'];
  targetLocator: Maybe<CopilotPromptRegistryPublishGateRepairTargetLocatorType>;
  targetLocatorFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceFingerprints: Array<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryPublishGateRepairActionPreviewType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairActionPreviewType';
  approvalCheckpoints: Array<Scalars['String']['output']>;
  approvalModes: Array<Scalars['String']['output']>;
  approvalPolicyFingerprint: Scalars['String']['output'];
  approvalPolicyVersion: Scalars['String']['output'];
  approvalRequired: Scalars['Boolean']['output'];
  auditSummaryFingerprint: Scalars['String']['output'];
  authorizationFingerprint: Scalars['String']['output'];
  authorizationStatus: Scalars['String']['output'];
  candidateCount: Scalars['SafeInt']['output'];
  candidateEvidenceSetFingerprint: Scalars['String']['output'];
  catalogFingerprint: Scalars['String']['output'];
  catalogVersion: Scalars['String']['output'];
  embeddingIndexContractEvidenceSetFingerprint: Scalars['String']['output'];
  guardFingerprint: Scalars['String']['output'];
  operationFingerprints: Array<Scalars['String']['output']>;
  operationSetFingerprint: Scalars['String']['output'];
  operations: Array<CopilotPromptRegistryPublishGateRepairActionPreviewOperationType>;
  preparedRouteOrderEvidenceSetFingerprint: Scalars['String']['output'];
  previewFingerprint: Scalars['String']['output'];
  readOnly: Scalars['Boolean']['output'];
  requiredCapabilities: Array<Scalars['String']['output']>;
  rerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['output'];
  status: Scalars['String']['output'];
  submissionContract: CopilotPromptRegistryPublishGateRepairActionSubmissionContractType;
  taskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairActionSubmissionContractType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairActionSubmissionContractType';
  approvalPolicyFingerprint: Scalars['String']['output'];
  authorizationFingerprint: Scalars['String']['output'];
  candidateEvidenceSetFingerprint: Scalars['String']['output'];
  catalogFingerprint: Scalars['String']['output'];
  contractVersion: Scalars['String']['output'];
  embeddingIndexContractEvidenceSetFingerprint: Scalars['String']['output'];
  expectedRegistryFingerprint: Scalars['String']['output'];
  expectedRegistryId: Scalars['SafeInt']['output'];
  expectedRegistryUpdatedAt: Scalars['String']['output'];
  guardFingerprint: Scalars['String']['output'];
  idempotencyKey: Scalars['String']['output'];
  mutationAvailable: Scalars['Boolean']['output'];
  operationSetFingerprint: Scalars['String']['output'];
  preparedRouteOrderEvidenceSetFingerprint: Scalars['String']['output'];
  previewFingerprint: Scalars['String']['output'];
  readOnly: Scalars['Boolean']['output'];
  requiredInputs: Array<Scalars['String']['output']>;
  rerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['output'];
  status: Scalars['String']['output'];
  submissionFingerprint: Scalars['String']['output'];
  targetLocatorFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairCandidateEvidenceType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairCandidateEvidenceType';
  allowed: Maybe<Scalars['Boolean']['output']>;
  available: Maybe<Scalars['Boolean']['output']>;
  candidateFingerprint: Scalars['String']['output'];
  candidateIndex: Scalars['SafeInt']['output'];
  candidateKey: Maybe<Scalars['String']['output']>;
  candidateModelIds: Maybe<Array<Scalars['String']['output']>>;
  costInputPer1M: Maybe<Scalars['Int']['output']>;
  costOutputPer1M: Maybe<Scalars['Int']['output']>;
  diagnosticsErrorSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  diagnosticsErrors: Maybe<
    Array<CopilotPromptRegistryPublishGateRepairDiagnosticsErrorType>
  >;
  dimensionMismatch: Maybe<Scalars['Boolean']['output']>;
  embeddingIndexContractDimensions: Maybe<Scalars['SafeInt']['output']>;
  embeddingIndexContractFingerprint: Maybe<Scalars['String']['output']>;
  embeddingIndexContractStatus: Maybe<Scalars['String']['output']>;
  embeddingIndexContractVersion: Maybe<Scalars['String']['output']>;
  errorCategory: Maybe<Scalars['String']['output']>;
  errorCode: Maybe<Scalars['String']['output']>;
  fallbackProviderIds: Maybe<Array<Scalars['String']['output']>>;
  health: Maybe<Scalars['String']['output']>;
  healthCheckedAt: Maybe<Scalars['String']['output']>;
  matched: Maybe<Scalars['Boolean']['output']>;
  modelEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  modelRegistryRevision: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionActorId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  modelRegistryRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  modelRegistryRevisionScope: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionSourceChain: Maybe<
    Array<CopilotModelRegistrySourceChainEntryType>
  >;
  modelRegistryRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  modelRegistryRevisionStatus: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  policyCandidateSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  policyCandidates: Maybe<
    Array<CopilotPromptRegistryPublishGatePolicyCandidateType>
  >;
  prepareCandidateSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  prepareCandidates: Maybe<
    Array<CopilotTaskRoutePrepareCandidateDiagnosticsType>
  >;
  prepared: Maybe<Scalars['Boolean']['output']>;
  preparedModelId: Maybe<Scalars['String']['output']>;
  preparedRouteOrderFingerprint: Maybe<Scalars['String']['output']>;
  preparedRouteSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  preparedRouteTargetFingerprint: Maybe<Scalars['String']['output']>;
  preparedRouteTargets: Maybe<Array<Scalars['String']['output']>>;
  preparedRoutes: Maybe<Array<CopilotPreparedTaskRouteDiagnosticsType>>;
  privacy: Maybe<Scalars['String']['output']>;
  providerCapabilitySnapshotFingerprint: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerCostSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  providerHealthSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  providerId: Scalars['String']['output'];
  providerLimitSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
  requestedDimensions: Maybe<Scalars['SafeInt']['output']>;
  requestedModelConfigKey: Maybe<Scalars['String']['output']>;
  requestedModelConfigPath: Maybe<Scalars['String']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
  rerankRuntimeContractFingerprint: Maybe<Scalars['String']['output']>;
  rerankRuntimeContractStatus: Maybe<Scalars['String']['output']>;
  rerankRuntimeContractTopK: Maybe<Scalars['SafeInt']['output']>;
  rerankRuntimeContractVersion: Maybe<Scalars['String']['output']>;
  routeAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeAttachmentSourceKinds: Maybe<Array<Scalars['String']['output']>>;
  routeCandidateSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  routeContextWindow: Maybe<Scalars['SafeInt']['output']>;
  routeEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  routeInputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeMaxOutputTokens: Maybe<Scalars['SafeInt']['output']>;
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeOutputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
  routeStructuredAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeStructuredAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeStructuredAttachmentSourceKinds: Maybe<
    Array<Scalars['String']['output']>
  >;
  routeTrace: Maybe<Array<CopilotPromptRegistryPublishGateRouteTracePhaseType>>;
  routeTracePhases: Maybe<Array<Scalars['String']['output']>>;
  routeTraceSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  scope: Scalars['String']['output'];
  taskRouteDimensionSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  taskRouteEffectiveSourceFingerprint: Maybe<Scalars['String']['output']>;
  taskRouteEffectiveSourceFingerprintInputs: Maybe<
    Array<Scalars['String']['output']>
  >;
  taskRouteEffectiveSourceFingerprintVersion: Maybe<
    Scalars['String']['output']
  >;
  taskRouteEmbeddingIndexContractSnapshotFingerprint: Maybe<
    Scalars['String']['output']
  >;
  taskRouteModelSourceSnapshotFingerprint: Maybe<Scalars['String']['output']>;
  taskRouteRerankRuntimeContractSnapshotFingerprint: Maybe<
    Scalars['String']['output']
  >;
}

export interface CopilotPromptRegistryPublishGateRepairDiagnosticsErrorType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairDiagnosticsErrorType';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  stage: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairGateManifestExportMetadataType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairGateManifestExportMetadataType';
  artifact: Scalars['String']['output'];
  auditEventCreated: Scalars['Boolean']['output'];
  auditEventFingerprint: Scalars['String']['output'];
  auditEventStatus: Scalars['String']['output'];
  auditEventVersion: Scalars['String']['output'];
  boundary: Scalars['String']['output'];
  exportPolicyFingerprint: Scalars['String']['output'];
  exportPolicyStatus: Scalars['String']['output'];
  exportPolicyVersion: Scalars['String']['output'];
  filename: Scalars['String']['output'];
  gateStatus: Scalars['String']['output'];
  manifestFingerprint: Scalars['String']['output'];
  manifestVersion: Scalars['String']['output'];
  metadataFilename: Scalars['String']['output'];
  mime: Scalars['String']['output'];
  publishStatus: Scalars['String']['output'];
  redactionPolicyFingerprint: Scalars['String']['output'];
  redactionPolicyStatus: Scalars['String']['output'];
  redactionPolicyVersion: Scalars['String']['output'];
  registryFingerprint: Scalars['String']['output'];
  registryId: Scalars['SafeInt']['output'];
  registryUpdatedAt: Scalars['String']['output'];
  retentionPolicyFingerprint: Scalars['String']['output'];
  retentionPolicyStatus: Scalars['String']['output'];
  retentionPolicyVersion: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairGateManifestType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairGateManifestType';
  approvalPolicyFingerprint: Scalars['String']['output'];
  authorizationFingerprint: Scalars['String']['output'];
  blockingCount: Scalars['SafeInt']['output'];
  boundary: Scalars['String']['output'];
  candidateEvidenceSetFingerprint: Scalars['String']['output'];
  catalogFingerprint: Scalars['String']['output'];
  catalogVersion: Scalars['String']['output'];
  embeddingIndexContractEvidenceSetFingerprint: Scalars['String']['output'];
  fingerprint: Scalars['String']['output'];
  gateStatus: Scalars['String']['output'];
  guardFingerprint: Scalars['String']['output'];
  issueCount: Scalars['SafeInt']['output'];
  mutationAvailable: Scalars['Boolean']['output'];
  operationCount: Scalars['SafeInt']['output'];
  operationFingerprints: Array<Scalars['String']['output']>;
  operationSetFingerprint: Scalars['String']['output'];
  preparedRouteOrderEvidenceSetFingerprint: Scalars['String']['output'];
  previewFingerprint: Scalars['String']['output'];
  publishStatus: Scalars['String']['output'];
  readOnly: Scalars['Boolean']['output'];
  reason: Scalars['String']['output'];
  recommendationCount: Scalars['SafeInt']['output'];
  recommendationFingerprints: Array<Scalars['String']['output']>;
  registryFingerprint: Scalars['String']['output'];
  registryId: Scalars['SafeInt']['output'];
  registryUpdatedAt: Scalars['String']['output'];
  requiredCapabilities: Array<Scalars['String']['output']>;
  requiredReviewModes: Array<Scalars['String']['output']>;
  rerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['output'];
  safetyLevels: Array<Scalars['String']['output']>;
  submissionFingerprint: Scalars['String']['output'];
  targetLocatorFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairRecommendationType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairRecommendationType';
  candidateEvidence: Maybe<
    Array<CopilotPromptRegistryPublishGateRepairCandidateEvidenceType>
  >;
  category: Scalars['String']['output'];
  code: Scalars['String']['output'];
  detail: Scalars['String']['output'];
  diagnosticsFingerprint: Scalars['String']['output'];
  evidence: Array<Scalars['String']['output']>;
  instanceKey: Maybe<Scalars['String']['output']>;
  severity: Scalars['String']['output'];
  suggestedAction: Scalars['String']['output'];
  suggestedActionCatalogVersion: Scalars['String']['output'];
  suggestedActionInputSchema: Scalars['JSON']['output'];
  suggestedActionKind: Scalars['String']['output'];
  suggestedActionRequiredCapabilities: Array<Scalars['String']['output']>;
  suggestedActionSafety: Scalars['String']['output'];
  target: Scalars['String']['output'];
  targetLocator: Maybe<CopilotPromptRegistryPublishGateRepairTargetLocatorType>;
  title: Scalars['String']['output'];
}

export interface CopilotPromptRegistryPublishGateRepairTargetLocatorType {
  __typename?: 'CopilotPromptRegistryPublishGateRepairTargetLocatorType';
  actionId: Maybe<Scalars['String']['output']>;
  candidateIndex: Maybe<Scalars['SafeInt']['output']>;
  candidateKind: Maybe<Scalars['String']['output']>;
  fallbackOrderIndex: Maybe<Scalars['SafeInt']['output']>;
  featureKind: Maybe<Scalars['String']['output']>;
  kind: Scalars['String']['output'];
  outputType: Maybe<Scalars['String']['output']>;
  path: Scalars['String']['output'];
  providerId: Maybe<Scalars['String']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  registryFingerprint: Scalars['String']['output'];
  registryId: Scalars['SafeInt']['output'];
  registryUpdatedAt: Scalars['String']['output'];
  requestedModelConfigKey: Maybe<Scalars['String']['output']>;
  requestedModelConfigPath: Maybe<Scalars['String']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
  routeIndex: Maybe<Scalars['SafeInt']['output']>;
  status: Maybe<Scalars['String']['output']>;
  stepId: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryPublishGateRouteCandidateType {
  __typename?: 'CopilotPromptRegistryPublishGateRouteCandidateType';
  candidateModelIds: Maybe<Array<Scalars['String']['output']>>;
  costInputPer1M: Maybe<Scalars['Int']['output']>;
  costOutputPer1M: Maybe<Scalars['Int']['output']>;
  health: Maybe<Scalars['String']['output']>;
  healthCheckedAt: Maybe<Scalars['String']['output']>;
  matched: Scalars['Boolean']['output'];
  modelId: Maybe<Scalars['String']['output']>;
  modelRegistryRevision: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionActorId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionScope: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionSourceChain: Maybe<
    Array<CopilotModelRegistrySourceChainEntryType>
  >;
  modelRegistryRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  modelRegistryRevisionStatus: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  privacy: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  routeAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeAttachmentSourceKinds: Maybe<Array<Scalars['String']['output']>>;
  routeContextWindow: Maybe<Scalars['SafeInt']['output']>;
  routeEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  routeInputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeMaxOutputTokens: Maybe<Scalars['SafeInt']['output']>;
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeOutputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
  routeStructuredAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeStructuredAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeStructuredAttachmentSourceKinds: Maybe<
    Array<Scalars['String']['output']>
  >;
}

export interface CopilotPromptRegistryPublishGateRouteTracePhaseType {
  __typename?: 'CopilotPromptRegistryPublishGateRouteTracePhaseType';
  availableCount: Maybe<Scalars['SafeInt']['output']>;
  blockedCount: Maybe<Scalars['SafeInt']['output']>;
  candidateCount: Scalars['SafeInt']['output'];
  matchedCount: Maybe<Scalars['SafeInt']['output']>;
  phase: Scalars['String']['output'];
  preparedCount: Maybe<Scalars['SafeInt']['output']>;
  reasons: Array<Scalars['String']['output']>;
  selectedCount: Maybe<Scalars['SafeInt']['output']>;
}

export interface CopilotPromptRegistryPublishGateVerdictType {
  __typename?: 'CopilotPromptRegistryPublishGateVerdictType';
  actionRouteDryRun: Maybe<CopilotPromptRegistryPublishGateActionRouteDryRunType>;
  allowed: Scalars['Boolean']['output'];
  blockingCount: Scalars['SafeInt']['output'];
  errorCount: Scalars['SafeInt']['output'];
  issueCount: Scalars['SafeInt']['output'];
  issues: Array<CopilotPromptRegistryValidationIssueType>;
  modelRoute: Maybe<CopilotPromptRegistryPublishGateModelRouteType>;
  modelRoutes: Array<CopilotPromptRegistryPublishGateModelRouteType>;
  name: Scalars['String']['output'];
  publishStatus: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  registryFingerprint: Scalars['String']['output'];
  registryId: Scalars['SafeInt']['output'];
  registryUpdatedAt: Scalars['DateTime']['output'];
  remediations: Array<CopilotPromptRegistryValidationRemediationType>;
  repairActionCatalog: Array<CopilotPromptRegistryPublishGateRepairActionCatalogEntryType>;
  repairActionCatalogFingerprint: Scalars['String']['output'];
  repairActionMutationGuard: CopilotPromptRegistryPublishGateRepairActionMutationGuardType;
  repairActionPreview: CopilotPromptRegistryPublishGateRepairActionPreviewType;
  repairGateManifest: CopilotPromptRegistryPublishGateRepairGateManifestType;
  repairGateManifestExportMetadata: CopilotPromptRegistryPublishGateRepairGateManifestExportMetadataType;
  repairRecommendations: Array<CopilotPromptRegistryPublishGateRepairRecommendationType>;
  stale: Scalars['Boolean']['output'];
  staleReasons: Array<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  taskRoutes: Array<CopilotTaskRouteDiagnosticsType>;
}

export interface CopilotPromptRegistryPublishInput {
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  reviewNote?: InputMaybe<Scalars['String']['input']>;
  revision?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType {
  __typename?: 'CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType';
  candidateEvidenceCategory: Maybe<Scalars['String']['output']>;
  candidateEvidenceFingerprint: Scalars['String']['output'];
  candidateEvidenceKey: Maybe<Scalars['String']['output']>;
  candidateEvidenceProviderId: Scalars['String']['output'];
  candidateEvidenceScope: Scalars['String']['output'];
  candidateIndex: Scalars['SafeInt']['output'];
  policyCandidateEntries: Maybe<
    Array<CopilotPromptRegistryPublishGatePolicyCandidateType>
  >;
  prepareCandidateEntries: Maybe<
    Array<CopilotTaskRoutePrepareCandidateDiagnosticsType>
  >;
  preparedRouteEntries: Maybe<Array<CopilotPreparedTaskRouteDiagnosticsType>>;
  preparedRouteOrderFingerprint: Maybe<Scalars['String']['output']>;
  routeCandidateEntries: Maybe<
    Array<CopilotPromptRegistryPublishGateRouteCandidateType>
  >;
  taskRouteEffectiveSourceFingerprint: Maybe<Scalars['String']['output']>;
  taskRouteModelSourceSnapshotEntries: Maybe<
    Array<CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntryType>
  >;
  taskRouteModelSourceSnapshotFingerprint: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryRepairExecutionRequestInput {
  expectedApprovalRecordFingerprint: Scalars['String']['input'];
  expectedApprovalRequestFingerprint: Scalars['String']['input'];
  expectedAuditEventFingerprint: Scalars['String']['input'];
  expectedCandidateEvidenceSetFingerprint: Scalars['String']['input'];
  expectedEmbeddingIndexContractEvidenceSetFingerprint: Scalars['String']['input'];
  expectedExecutionGateFingerprint: Scalars['String']['input'];
  expectedExecutionGateStatus: Scalars['String']['input'];
  expectedExecutionStateFingerprint: Scalars['String']['input'];
  expectedIdempotencyFingerprint: Scalars['String']['input'];
  expectedPolicyBindingFingerprint: Scalars['String']['input'];
  expectedPreflightStatus: Scalars['String']['input'];
  expectedPreparedRouteOrderEvidenceSetFingerprint: Scalars['String']['input'];
  expectedRepairGateManifestExportPolicyFingerprint: Scalars['String']['input'];
  expectedRepairGateManifestFingerprint: Scalars['String']['input'];
  expectedRepairGateManifestRetentionPolicyFingerprint: Scalars['String']['input'];
  expectedRepairJobFingerprint: Scalars['String']['input'];
  expectedRerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['input'];
  expectedReviewBindingFingerprint: Scalars['String']['input'];
  expectedRollbackPlanFingerprint: Scalars['String']['input'];
  expectedTargetLocatorFingerprint: Scalars['String']['input'];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['input'];
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  name: Scalars['String']['input'];
  submission: CopilotPromptRegistryRepairSubmissionInput;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntryType {
  __typename?: 'CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntryType';
  candidateEvidenceCategories: Array<Scalars['String']['output']>;
  candidateEvidenceCategoryCount: Scalars['SafeInt']['output'];
  candidateEvidenceCount: Scalars['SafeInt']['output'];
  candidateEvidenceEntries: Array<CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType>;
  candidateEvidenceFingerprint: Scalars['String']['output'];
  candidateEvidenceFingerprints: Array<Scalars['String']['output']>;
  candidateEvidenceKeys: Array<Scalars['String']['output']>;
  candidateEvidenceProviderIds: Array<Scalars['String']['output']>;
  candidateEvidenceReferenceSchemaArtifactFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactRecordStorageStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaArtifactStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaFields: Array<Scalars['String']['output']>;
  candidateEvidenceReferenceSchemaFingerprint: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  candidateEvidenceReferenceSchemaRegistryStatus: Scalars['String']['output'];
  candidateEvidenceReferenceSchemaVersion: Scalars['String']['output'];
  candidateEvidenceScopes: Array<Scalars['String']['output']>;
  diagnosticsFingerprint: Scalars['String']['output'];
  operationFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceFingerprints: Array<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryRepairExecutionRequestType {
  __typename?: 'CopilotPromptRegistryRepairExecutionRequestType';
  accepted: Scalars['Boolean']['output'];
  approvalRecordRequestCreated: Scalars['Boolean']['output'];
  approvalRecordRequestFingerprint: Scalars['String']['output'];
  approvalRecordRequestInputs: Array<Scalars['String']['output']>;
  approvalRecordRequestStatus: Scalars['String']['output'];
  approvalRecordRequestVersion: Scalars['String']['output'];
  auditEventRequestCreated: Scalars['Boolean']['output'];
  auditEventRequestFingerprint: Scalars['String']['output'];
  auditEventRequestInputs: Array<Scalars['String']['output']>;
  auditEventRequestStatus: Scalars['String']['output'];
  auditEventRequestVersion: Scalars['String']['output'];
  executionApprovalDecisionRequestCreated: Scalars['Boolean']['output'];
  executionApprovalDecisionRequestFingerprint: Scalars['String']['output'];
  executionApprovalDecisionRequestInputs: Array<Scalars['String']['output']>;
  executionApprovalDecisionRequestStatus: Scalars['String']['output'];
  executionApprovalDecisionRequestVersion: Scalars['String']['output'];
  executionApprovalUiRequestCreated: Scalars['Boolean']['output'];
  executionApprovalUiRequestFingerprint: Scalars['String']['output'];
  executionApprovalUiRequestInputs: Array<Scalars['String']['output']>;
  executionApprovalUiRequestStatus: Scalars['String']['output'];
  executionApprovalUiRequestVersion: Scalars['String']['output'];
  executionCompletionEventRequestCreated: Scalars['Boolean']['output'];
  executionCompletionEventRequestFingerprint: Scalars['String']['output'];
  executionCompletionEventRequestInputs: Array<Scalars['String']['output']>;
  executionCompletionEventRequestStatus: Scalars['String']['output'];
  executionCompletionEventRequestVersion: Scalars['String']['output'];
  executionCompletionRequestCreated: Scalars['Boolean']['output'];
  executionCompletionRequestFingerprint: Scalars['String']['output'];
  executionCompletionRequestInputs: Array<Scalars['String']['output']>;
  executionCompletionRequestStatus: Scalars['String']['output'];
  executionCompletionRequestVersion: Scalars['String']['output'];
  executionDiffPreviewRequestCreated: Scalars['Boolean']['output'];
  executionDiffPreviewRequestFingerprint: Scalars['String']['output'];
  executionDiffPreviewRequestInputs: Array<Scalars['String']['output']>;
  executionDiffPreviewRequestStatus: Scalars['String']['output'];
  executionDiffPreviewRequestVersion: Scalars['String']['output'];
  executionFailureEventRequestCreated: Scalars['Boolean']['output'];
  executionFailureEventRequestFingerprint: Scalars['String']['output'];
  executionFailureEventRequestInputs: Array<Scalars['String']['output']>;
  executionFailureEventRequestStatus: Scalars['String']['output'];
  executionFailureEventRequestVersion: Scalars['String']['output'];
  executionFinalizationEventRequestCreated: Scalars['Boolean']['output'];
  executionFinalizationEventRequestFingerprint: Scalars['String']['output'];
  executionFinalizationEventRequestInputs: Array<Scalars['String']['output']>;
  executionFinalizationEventRequestStatus: Scalars['String']['output'];
  executionFinalizationEventRequestVersion: Scalars['String']['output'];
  executionFinalizationRequestCreated: Scalars['Boolean']['output'];
  executionFinalizationRequestFingerprint: Scalars['String']['output'];
  executionFinalizationRequestInputs: Array<Scalars['String']['output']>;
  executionFinalizationRequestStatus: Scalars['String']['output'];
  executionFinalizationRequestVersion: Scalars['String']['output'];
  executionJobRunRequestCreated: Scalars['Boolean']['output'];
  executionJobRunRequestFingerprint: Scalars['String']['output'];
  executionJobRunRequestInputs: Array<Scalars['String']['output']>;
  executionJobRunRequestStatus: Scalars['String']['output'];
  executionJobRunRequestVersion: Scalars['String']['output'];
  executionOperationEntryRequestCreated: Scalars['Boolean']['output'];
  executionOperationEntryRequestFingerprint: Scalars['String']['output'];
  executionOperationEntryRequestInputs: Array<Scalars['String']['output']>;
  executionOperationEntryRequestStatus: Scalars['String']['output'];
  executionOperationEntryRequestVersion: Scalars['String']['output'];
  executionProviderResponseRequestCreated: Scalars['Boolean']['output'];
  executionProviderResponseRequestFingerprint: Scalars['String']['output'];
  executionProviderResponseRequestInputs: Array<Scalars['String']['output']>;
  executionProviderResponseRequestStatus: Scalars['String']['output'];
  executionProviderResponseRequestVersion: Scalars['String']['output'];
  executionQueueRequestCreated: Scalars['Boolean']['output'];
  executionQueueRequestFingerprint: Scalars['String']['output'];
  executionQueueRequestInputs: Array<Scalars['String']['output']>;
  executionQueueRequestStatus: Scalars['String']['output'];
  executionQueueRequestVersion: Scalars['String']['output'];
  executionRecord: Maybe<CopilotRepairExecutionRecordType>;
  executionRequested: Scalars['Boolean']['output'];
  executionResultRequestCreated: Scalars['Boolean']['output'];
  executionResultRequestFingerprint: Scalars['String']['output'];
  executionResultRequestInputs: Array<Scalars['String']['output']>;
  executionResultRequestStatus: Scalars['String']['output'];
  executionResultRequestVersion: Scalars['String']['output'];
  executionRetryPolicyRequestCreated: Scalars['Boolean']['output'];
  executionRetryPolicyRequestFingerprint: Scalars['String']['output'];
  executionRetryPolicyRequestInputs: Array<Scalars['String']['output']>;
  executionRetryPolicyRequestStatus: Scalars['String']['output'];
  executionRetryPolicyRequestVersion: Scalars['String']['output'];
  executionRollbackExecutorRequestCreated: Scalars['Boolean']['output'];
  executionRollbackExecutorRequestFingerprint: Scalars['String']['output'];
  executionRollbackExecutorRequestInputs: Array<Scalars['String']['output']>;
  executionRollbackExecutorRequestStatus: Scalars['String']['output'];
  executionRollbackExecutorRequestVersion: Scalars['String']['output'];
  executionRollbackOperationRequestCreated: Scalars['Boolean']['output'];
  executionRollbackOperationRequestFingerprint: Scalars['String']['output'];
  executionRollbackOperationRequestInputs: Array<Scalars['String']['output']>;
  executionRollbackOperationRequestStatus: Scalars['String']['output'];
  executionRollbackOperationRequestVersion: Scalars['String']['output'];
  executionRollbackOutcomeRequestCreated: Scalars['Boolean']['output'];
  executionRollbackOutcomeRequestFingerprint: Scalars['String']['output'];
  executionRollbackOutcomeRequestInputs: Array<Scalars['String']['output']>;
  executionRollbackOutcomeRequestStatus: Scalars['String']['output'];
  executionRollbackOutcomeRequestVersion: Scalars['String']['output'];
  executionRollbackTriggerRequestCreated: Scalars['Boolean']['output'];
  executionRollbackTriggerRequestFingerprint: Scalars['String']['output'];
  executionRollbackTriggerRequestInputs: Array<Scalars['String']['output']>;
  executionRollbackTriggerRequestStatus: Scalars['String']['output'];
  executionRollbackTriggerRequestVersion: Scalars['String']['output'];
  executionRunStepCompletionRequestCreated: Scalars['Boolean']['output'];
  executionRunStepCompletionRequestFingerprint: Scalars['String']['output'];
  executionRunStepCompletionRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepCompletionRequestStatus: Scalars['String']['output'];
  executionRunStepCompletionRequestVersion: Scalars['String']['output'];
  executionRunStepRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRequestFingerprint: Scalars['String']['output'];
  executionRunStepRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepRequestStatus: Scalars['String']['output'];
  executionRunStepRequestVersion: Scalars['String']['output'];
  executionRunStepResultRequestCreated: Scalars['Boolean']['output'];
  executionRunStepResultRequestFingerprint: Scalars['String']['output'];
  executionRunStepResultRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepResultRequestStatus: Scalars['String']['output'];
  executionRunStepResultRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptArchiveRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptArchiveRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptArchiveRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptArchiveRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptArchiveRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptCloseRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptCloseRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptCloseRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptCloseRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptCloseRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptCloseStatusEventRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptCloseStatusEventRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptCloseStatusEventRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptCloseStatusEventRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptCloseStatusEventRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptCompletionRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptCompletionRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptCompletionRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptCompletionRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptCompletionRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptCompletionStatusEventRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptCompletionStatusEventRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptCompletionStatusEventRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptCompletionStatusEventRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptFinalizationRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptFinalizationRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptFinalizationRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptFinalizationRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptFinalizationRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptFinalizationStatusEventRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptFinalizationStatusEventRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptFinalizationStatusEventRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptFinalizationStatusEventRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepRetryAttemptRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptResultRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptResultRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptResultRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptResultRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptResultRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionLeaseRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptRetentionLeaseRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionLeaseRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptRetentionLeaseRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionLeaseRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionPolicyRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptRetentionPolicyRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionPolicyRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptRetentionPolicyRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionPolicyRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptStatusEventRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptStatusEventRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptStatusEventRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptStatusEventRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptStatusEventRequestVersion: Scalars['String']['output'];
  executionRunStepRetryAttemptTraceRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryAttemptTraceRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryAttemptTraceRequestInputs: Array<
    Scalars['String']['output']
  >;
  executionRunStepRetryAttemptTraceRequestStatus: Scalars['String']['output'];
  executionRunStepRetryAttemptTraceRequestVersion: Scalars['String']['output'];
  executionRunStepRetryRequestCreated: Scalars['Boolean']['output'];
  executionRunStepRetryRequestFingerprint: Scalars['String']['output'];
  executionRunStepRetryRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepRetryRequestStatus: Scalars['String']['output'];
  executionRunStepRetryRequestVersion: Scalars['String']['output'];
  executionRunStepStatusEventRequestCreated: Scalars['Boolean']['output'];
  executionRunStepStatusEventRequestFingerprint: Scalars['String']['output'];
  executionRunStepStatusEventRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepStatusEventRequestStatus: Scalars['String']['output'];
  executionRunStepStatusEventRequestVersion: Scalars['String']['output'];
  executionRunStepTraceRequestCreated: Scalars['Boolean']['output'];
  executionRunStepTraceRequestFingerprint: Scalars['String']['output'];
  executionRunStepTraceRequestInputs: Array<Scalars['String']['output']>;
  executionRunStepTraceRequestStatus: Scalars['String']['output'];
  executionRunStepTraceRequestVersion: Scalars['String']['output'];
  executionStartRequestCreated: Scalars['Boolean']['output'];
  executionStartRequestFingerprint: Scalars['String']['output'];
  executionStartRequestInputs: Array<Scalars['String']['output']>;
  executionStartRequestStatus: Scalars['String']['output'];
  executionStartRequestVersion: Scalars['String']['output'];
  executionStateRequestCreated: Scalars['Boolean']['output'];
  executionStateRequestFingerprint: Scalars['String']['output'];
  executionStateRequestInputs: Array<Scalars['String']['output']>;
  executionStateRequestStatus: Scalars['String']['output'];
  executionStateRequestVersion: Scalars['String']['output'];
  executionStatusPollRequestCreated: Scalars['Boolean']['output'];
  executionStatusPollRequestFingerprint: Scalars['String']['output'];
  executionStatusPollRequestInputs: Array<Scalars['String']['output']>;
  executionStatusPollRequestStatus: Scalars['String']['output'];
  executionStatusPollRequestVersion: Scalars['String']['output'];
  executionTraceRequestCreated: Scalars['Boolean']['output'];
  executionTraceRequestFingerprint: Scalars['String']['output'];
  executionTraceRequestInputs: Array<Scalars['String']['output']>;
  executionTraceRequestStatus: Scalars['String']['output'];
  executionTraceRequestVersion: Scalars['String']['output'];
  executionWorkerLeaseRequestCreated: Scalars['Boolean']['output'];
  executionWorkerLeaseRequestFingerprint: Scalars['String']['output'];
  executionWorkerLeaseRequestInputs: Array<Scalars['String']['output']>;
  executionWorkerLeaseRequestStatus: Scalars['String']['output'];
  executionWorkerLeaseRequestVersion: Scalars['String']['output'];
  expectedCandidateEvidenceSetFingerprint: Scalars['String']['output'];
  expectedEmbeddingIndexContractEvidenceSetFingerprint: Scalars['String']['output'];
  expectedPreparedRouteOrderEvidenceSetFingerprint: Scalars['String']['output'];
  expectedRepairGateManifestExportPolicyFingerprint: Scalars['String']['output'];
  expectedRepairGateManifestFingerprint: Scalars['String']['output'];
  expectedRepairGateManifestRetentionPolicyFingerprint: Scalars['String']['output'];
  expectedRerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['output'];
  expectedTargetLocatorFingerprint: Scalars['String']['output'];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
  idempotencyLockAcquired: Scalars['Boolean']['output'];
  idempotencyLockFingerprint: Scalars['String']['output'];
  idempotencyLockInputs: Array<Scalars['String']['output']>;
  idempotencyLockScope: Scalars['String']['output'];
  idempotencyLockStatus: Scalars['String']['output'];
  idempotencyLockVersion: Scalars['String']['output'];
  matchedFields: Array<Scalars['String']['output']>;
  mismatchedFields: Array<Scalars['String']['output']>;
  mutationAvailable: Scalars['Boolean']['output'];
  preflight: CopilotPromptRegistryRepairPreflightType;
  readOnly: Scalars['Boolean']['output'];
  repairJobRequestCreated: Scalars['Boolean']['output'];
  repairJobRequestFingerprint: Scalars['String']['output'];
  repairJobRequestInputs: Array<Scalars['String']['output']>;
  repairJobRequestStatus: Scalars['String']['output'];
  repairJobRequestVersion: Scalars['String']['output'];
  requestFingerprint: Scalars['String']['output'];
  requestInputs: Array<Scalars['String']['output']>;
  requestStatus: Scalars['String']['output'];
  requestVersion: Scalars['String']['output'];
  rollbackPlanRequestCreated: Scalars['Boolean']['output'];
  rollbackPlanRequestFingerprint: Scalars['String']['output'];
  rollbackPlanRequestInputs: Array<Scalars['String']['output']>;
  rollbackPlanRequestStatus: Scalars['String']['output'];
  rollbackPlanRequestVersion: Scalars['String']['output'];
  supportBundleArchiveFormat: Scalars['String']['output'];
  supportBundleArchiveRequestCreated: Scalars['Boolean']['output'];
  supportBundleArchiveRequestFingerprint: Scalars['String']['output'];
  supportBundleArchiveRequestInputs: Array<Scalars['String']['output']>;
  supportBundleArchiveRequestStatus: Scalars['String']['output'];
  supportBundleArchiveRequestVersion: Scalars['String']['output'];
  supportBundleArchiveScope: Scalars['String']['output'];
  supportBundleArchiveSignaturePolicy: Scalars['String']['output'];
  supportBundleArchiveSignatureRequestCreated: Scalars['Boolean']['output'];
  supportBundleArchiveSignatureRequestFingerprint: Scalars['String']['output'];
  supportBundleArchiveSignatureRequestInputs: Array<
    Scalars['String']['output']
  >;
  supportBundleArchiveSignatureRequestStatus: Scalars['String']['output'];
  supportBundleArchiveSignatureRequestVersion: Scalars['String']['output'];
  supportBundleArtifactCreated: Scalars['Boolean']['output'];
  supportBundleArtifactFingerprint: Scalars['String']['output'];
  supportBundleArtifactInputs: Array<Scalars['String']['output']>;
  supportBundleArtifactRecordRequestCreated: Scalars['Boolean']['output'];
  supportBundleArtifactRecordRequestFingerprint: Scalars['String']['output'];
  supportBundleArtifactRecordRequestInputs: Array<Scalars['String']['output']>;
  supportBundleArtifactRecordRequestStatus: Scalars['String']['output'];
  supportBundleArtifactRecordRequestVersion: Scalars['String']['output'];
  supportBundleArtifactStatus: Scalars['String']['output'];
  supportBundleArtifactVersion: Scalars['String']['output'];
  supportBundleAuditPersistenceRequestCreated: Scalars['Boolean']['output'];
  supportBundleAuditPersistenceRequestFingerprint: Scalars['String']['output'];
  supportBundleAuditPersistenceRequestInputs: Array<
    Scalars['String']['output']
  >;
  supportBundleAuditPersistenceRequestStatus: Scalars['String']['output'];
  supportBundleAuditPersistenceRequestVersion: Scalars['String']['output'];
  supportBundleAuditPersistenceStatus: Scalars['String']['output'];
  supportBundleDownloadAuthorizationRequestCreated: Scalars['Boolean']['output'];
  supportBundleDownloadAuthorizationRequestFingerprint: Scalars['String']['output'];
  supportBundleDownloadAuthorizationRequestInputs: Array<
    Scalars['String']['output']
  >;
  supportBundleDownloadAuthorizationRequestStatus: Scalars['String']['output'];
  supportBundleDownloadAuthorizationRequestVersion: Scalars['String']['output'];
  supportBundleDownloadAuthorizationStatus: Scalars['String']['output'];
  supportBundleDownloadResolverRequestCreated: Scalars['Boolean']['output'];
  supportBundleDownloadResolverRequestFingerprint: Scalars['String']['output'];
  supportBundleDownloadResolverRequestInputs: Array<
    Scalars['String']['output']
  >;
  supportBundleDownloadResolverRequestStatus: Scalars['String']['output'];
  supportBundleDownloadResolverRequestVersion: Scalars['String']['output'];
  supportBundleDownloadResolverRoute: Scalars['String']['output'];
  supportBundleManifestFilename: Scalars['String']['output'];
  supportBundleManifestFingerprint: Scalars['String']['output'];
  supportBundleManifestMetadataFilename: Scalars['String']['output'];
  supportBundleManifestMetadataFingerprint: Scalars['String']['output'];
  supportBundlePackageCreated: Scalars['Boolean']['output'];
  supportBundlePackageFingerprint: Scalars['String']['output'];
  supportBundlePackageInputs: Array<Scalars['String']['output']>;
  supportBundlePackageStatus: Scalars['String']['output'];
  supportBundlePackageVersion: Scalars['String']['output'];
  supportBundleRetentionCleanupRequestCreated: Scalars['Boolean']['output'];
  supportBundleRetentionCleanupRequestFingerprint: Scalars['String']['output'];
  supportBundleRetentionCleanupRequestInputs: Array<
    Scalars['String']['output']
  >;
  supportBundleRetentionCleanupRequestStatus: Scalars['String']['output'];
  supportBundleRetentionCleanupRequestVersion: Scalars['String']['output'];
  supportBundleRetentionCleanupStatus: Scalars['String']['output'];
  supportBundleSignedUrlPolicy: Scalars['String']['output'];
  supportBundleSignedUrlRequestCreated: Scalars['Boolean']['output'];
  supportBundleSignedUrlRequestFingerprint: Scalars['String']['output'];
  supportBundleSignedUrlRequestInputs: Array<Scalars['String']['output']>;
  supportBundleSignedUrlRequestStatus: Scalars['String']['output'];
  supportBundleSignedUrlRequestVersion: Scalars['String']['output'];
  supportBundleSignedUrlScope: Scalars['String']['output'];
  supportBundleStorageKeyRequestCreated: Scalars['Boolean']['output'];
  supportBundleStorageKeyRequestFingerprint: Scalars['String']['output'];
  supportBundleStorageKeyRequestInputs: Array<Scalars['String']['output']>;
  supportBundleStorageKeyRequestStatus: Scalars['String']['output'];
  supportBundleStorageKeyRequestVersion: Scalars['String']['output'];
  supportBundleStorageKeyScope: Scalars['String']['output'];
  supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints: Array<
    Scalars['String']['output']
  >;
  supportBundleTaskRouteEffectiveSourceEvidenceSetEntries: Array<CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntryType>;
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
  supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints: Array<
    Scalars['String']['output']
  >;
  supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints: Array<
    Scalars['String']['output']
  >;
}

export interface CopilotPromptRegistryRepairPreflightType {
  __typename?: 'CopilotPromptRegistryRepairPreflightType';
  accepted: Scalars['Boolean']['output'];
  actorFingerprint: Scalars['String']['output'];
  actorSnapshotInputs: Array<Scalars['String']['output']>;
  actorSnapshotStatus: Scalars['String']['output'];
  actorSnapshotVersion: Scalars['String']['output'];
  actorType: Scalars['String']['output'];
  approvalCheckpoints: Array<Scalars['String']['output']>;
  approvalModes: Array<Scalars['String']['output']>;
  approvalRecordCreated: Scalars['Boolean']['output'];
  approvalRecordFingerprint: Scalars['String']['output'];
  approvalRecordInputs: Array<Scalars['String']['output']>;
  approvalRecordStatus: Scalars['String']['output'];
  approvalRecordVersion: Scalars['String']['output'];
  approvalRequestFingerprint: Scalars['String']['output'];
  approvalRequestInputs: Array<Scalars['String']['output']>;
  approvalRequestStatus: Scalars['String']['output'];
  approvalRequestVersion: Scalars['String']['output'];
  approvalRequired: Scalars['Boolean']['output'];
  auditBindingFingerprint: Scalars['String']['output'];
  auditBindingInputs: Array<Scalars['String']['output']>;
  auditBindingStatus: Scalars['String']['output'];
  auditBindingVersion: Scalars['String']['output'];
  auditEventCreated: Scalars['Boolean']['output'];
  auditEventFingerprint: Scalars['String']['output'];
  auditEventInputs: Array<Scalars['String']['output']>;
  auditEventStatus: Scalars['String']['output'];
  auditEventVersion: Scalars['String']['output'];
  authorizationStatus: Scalars['String']['output'];
  candidateEvidenceSetFingerprint: Scalars['String']['output'];
  capabilityCheckMode: Scalars['String']['output'];
  capabilityFingerprint: Scalars['String']['output'];
  capabilitySource: Scalars['String']['output'];
  capabilityStatus: Scalars['String']['output'];
  contractVersion: Scalars['String']['output'];
  currentSubmissionFingerprint: Scalars['String']['output'];
  embeddingIndexContractEvidenceSetFingerprint: Scalars['String']['output'];
  executionGateFingerprint: Scalars['String']['output'];
  executionGateInputs: Array<Scalars['String']['output']>;
  executionGateStatus: Scalars['String']['output'];
  executionGateVersion: Scalars['String']['output'];
  executionStateCreated: Scalars['Boolean']['output'];
  executionStateFingerprint: Scalars['String']['output'];
  executionStateInputs: Array<Scalars['String']['output']>;
  executionStateStatus: Scalars['String']['output'];
  executionStateVersion: Scalars['String']['output'];
  expectedCandidateEvidenceSetFingerprint: Scalars['String']['output'];
  expectedEmbeddingIndexContractEvidenceSetFingerprint: Scalars['String']['output'];
  expectedPreparedRouteOrderEvidenceSetFingerprint: Scalars['String']['output'];
  expectedRerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['output'];
  expectedSubmissionFingerprint: Scalars['String']['output'];
  expectedTargetLocatorFingerprint: Scalars['String']['output'];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
  idempotencyFingerprint: Scalars['String']['output'];
  idempotencyKey: Scalars['String']['output'];
  idempotencyLockAcquired: Scalars['Boolean']['output'];
  idempotencyScope: Scalars['String']['output'];
  idempotencyStatus: Scalars['String']['output'];
  idempotencyVersion: Scalars['String']['output'];
  matchedFields: Array<Scalars['String']['output']>;
  mismatchedFields: Array<Scalars['String']['output']>;
  mutationAvailable: Scalars['Boolean']['output'];
  permissionCheckMode: Scalars['String']['output'];
  permissionChecked: Scalars['Boolean']['output'];
  permissionFingerprint: Scalars['String']['output'];
  permissionScope: Scalars['String']['output'];
  permissionStatus: Scalars['String']['output'];
  policyBindingFingerprint: Scalars['String']['output'];
  policyBindingInputs: Array<Scalars['String']['output']>;
  policyBindingStatus: Scalars['String']['output'];
  policyBindingVersion: Scalars['String']['output'];
  policySource: Scalars['String']['output'];
  preparedRouteOrderEvidenceSetFingerprint: Scalars['String']['output'];
  readOnly: Scalars['Boolean']['output'];
  repairJobCreated: Scalars['Boolean']['output'];
  repairJobFingerprint: Scalars['String']['output'];
  repairJobInputs: Array<Scalars['String']['output']>;
  repairJobStatus: Scalars['String']['output'];
  repairJobVersion: Scalars['String']['output'];
  requiredCapabilities: Array<Scalars['String']['output']>;
  requiredCapabilityCount: Scalars['SafeInt']['output'];
  requiredPermission: Scalars['String']['output'];
  rerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['output'];
  reviewBindingFingerprint: Scalars['String']['output'];
  reviewBindingInputs: Array<Scalars['String']['output']>;
  reviewBindingStatus: Scalars['String']['output'];
  reviewBindingVersion: Scalars['String']['output'];
  rollbackPlanCreated: Scalars['Boolean']['output'];
  rollbackPlanFingerprint: Scalars['String']['output'];
  rollbackPlanInputs: Array<Scalars['String']['output']>;
  rollbackPlanStatus: Scalars['String']['output'];
  rollbackPlanVersion: Scalars['String']['output'];
  status: Scalars['String']['output'];
  targetLocatorFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['output'];
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<
    Scalars['String']['output']
  >;
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: Scalars['String']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryRepairSubmissionInput {
  approvalPolicyFingerprint: Scalars['String']['input'];
  authorizationFingerprint: Scalars['String']['input'];
  candidateEvidenceSetFingerprint: Scalars['String']['input'];
  catalogFingerprint: Scalars['String']['input'];
  contractVersion: Scalars['String']['input'];
  embeddingIndexContractEvidenceSetFingerprint: Scalars['String']['input'];
  expectedRegistryFingerprint: Scalars['String']['input'];
  expectedRegistryId: Scalars['SafeInt']['input'];
  expectedRegistryUpdatedAt: Scalars['String']['input'];
  guardFingerprint: Scalars['String']['input'];
  idempotencyKey: Scalars['String']['input'];
  operationSetFingerprint: Scalars['String']['input'];
  preparedRouteOrderEvidenceSetFingerprint: Scalars['String']['input'];
  previewFingerprint: Scalars['String']['input'];
  requiredInputs: Array<Scalars['String']['input']>;
  rerankRuntimeContractEvidenceSetFingerprint: Scalars['String']['input'];
  submissionFingerprint: Scalars['String']['input'];
  targetLocatorFingerprint: Scalars['String']['input'];
  taskRouteEffectiveSourceEvidenceSetFingerprint: Scalars['String']['input'];
}

export interface CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntryType {
  __typename?: 'CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntryType';
  featureKind: Scalars['String']['output'];
  requestedModelConfigKey: Maybe<Scalars['String']['output']>;
  requestedModelConfigPath: Maybe<Scalars['String']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryRevisionType {
  __typename?: 'CopilotPromptRegistryRevisionType';
  actorId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fallbackSourceChain: Scalars['JSON']['output'];
  fingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  promptName: Scalars['String']['output'];
  publishEventCount: Scalars['SafeInt']['output'];
  publishEvents: Array<CopilotRegistryRevisionPublishEventType>;
  revision: Scalars['String']['output'];
  scopeType: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistrySourceChainEntryType {
  __typename?: 'CopilotPromptRegistrySourceChainEntryType';
  actorId: Maybe<Scalars['String']['output']>;
  configPath: Maybe<Scalars['String']['output']>;
  fingerprint: Maybe<Scalars['String']['output']>;
  registryId: Maybe<Scalars['SafeInt']['output']>;
  revision: Maybe<Scalars['String']['output']>;
  scope: Scalars['String']['output'];
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Maybe<Scalars['String']['output']>;
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotPromptRegistryValidationIssueType {
  __typename?: 'CopilotPromptRegistryValidationIssueType';
  code: Scalars['String']['output'];
  detail: Scalars['String']['output'];
  fieldLabel: Scalars['String']['output'];
  message: Maybe<Scalars['String']['output']>;
  messageIndex: Maybe<Scalars['SafeInt']['output']>;
  path: Scalars['String']['output'];
  publishBlocking: Scalars['Boolean']['output'];
  reason: Scalars['String']['output'];
  severity: Scalars['String']['output'];
  source: Scalars['String']['output'];
  sourceLocator: CopilotPromptRegistryValidationSourceLocatorType;
}

export interface CopilotPromptRegistryValidationRemediationType {
  __typename?: 'CopilotPromptRegistryValidationRemediationType';
  detail: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  label: Scalars['String']['output'];
  target: Scalars['String']['output'];
  targetLocator: CopilotPromptRegistryValidationSourceLocatorType;
}

export interface CopilotPromptRegistryValidationSourceLocatorType {
  __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
  field: Scalars['String']['output'];
  messageIndex: Maybe<Scalars['SafeInt']['output']>;
  path: Scalars['String']['output'];
  registryFingerprint: Scalars['String']['output'];
  registryId: Scalars['SafeInt']['output'];
  registryUpdatedAt: Scalars['String']['output'];
  table: Scalars['String']['output'];
}

export interface CopilotProviderHealthEventType {
  __typename?: 'CopilotProviderHealthEventType';
  actorId: Maybe<Scalars['String']['output']>;
  checkedAt: Scalars['DateTime']['output'];
  createdAt: Scalars['DateTime']['output'];
  eventType: Scalars['String']['output'];
  fingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lastError: Maybe<Scalars['String']['output']>;
  metadata: Scalars['JSON']['output'];
  providerId: Scalars['String']['output'];
  providerType: Maybe<Scalars['String']['output']>;
  scopeType: Scalars['String']['output'];
  source: Scalars['String']['output'];
  stateFingerprint: Scalars['String']['output'];
  stateId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotProviderHealthProbeAttemptFilterInput {
  providerId?: InputMaybe<Scalars['String']['input']>;
  providerProfileFingerprint?: InputMaybe<Scalars['String']['input']>;
  providerRegistryRevisionFingerprint?: InputMaybe<Scalars['String']['input']>;
  providerRegistryRevisionId?: InputMaybe<Scalars['String']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  requestFingerprint?: InputMaybe<Scalars['String']['input']>;
  resultFingerprint?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotProviderHealthProbeAttemptRetryInput {
  attemptId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotProviderHealthProbeAttemptType {
  __typename?: 'CopilotProviderHealthProbeAttemptType';
  actorId: Scalars['String']['output'];
  attemptCount: Scalars['SafeInt']['output'];
  checkedAt: Maybe<Scalars['DateTime']['output']>;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deadLetteredAt: Maybe<Scalars['DateTime']['output']>;
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  maxAttempts: Scalars['SafeInt']['output'];
  providerHealthStateFingerprint: Maybe<Scalars['String']['output']>;
  providerHealthStateId: Maybe<Scalars['String']['output']>;
  providerId: Scalars['String']['output'];
  providerProfileFingerprint: Scalars['String']['output'];
  providerProfileSnapshot: Scalars['JSON']['output'];
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerRegistryRevisionFingerprint: Scalars['String']['output'];
  providerRegistryRevisionId: Scalars['String']['output'];
  providerType: Maybe<Scalars['String']['output']>;
  requestFingerprint: Scalars['String']['output'];
  resultFingerprint: Maybe<Scalars['String']['output']>;
  resultLastError: Maybe<Scalars['String']['output']>;
  resultMetadata: Scalars['JSON']['output'];
  resultStatus: Maybe<Scalars['String']['output']>;
  scheduledAt: Scalars['DateTime']['output'];
  scopeType: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workerLeaseExpiresAt: Maybe<Scalars['DateTime']['output']>;
  workerLeaseId: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotProviderHealthStateRecordInput {
  lastError?: InputMaybe<Scalars['String']['input']>;
  providerId: Scalars['String']['input'];
  status: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotProviderHealthStateType {
  __typename?: 'CopilotProviderHealthStateType';
  actorId: Maybe<Scalars['String']['output']>;
  checkedAt: Scalars['DateTime']['output'];
  createdAt: Scalars['DateTime']['output'];
  eventCount: Scalars['SafeInt']['output'];
  events: Array<CopilotProviderHealthEventType>;
  fingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lastError: Maybe<Scalars['String']['output']>;
  providerId: Scalars['String']['output'];
  providerType: Maybe<Scalars['String']['output']>;
  scopeType: Scalars['String']['output'];
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotProviderNotSupportedDataType {
  __typename?: 'CopilotProviderNotSupportedDataType';
  kind: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface CopilotProviderRegistryPublishInput {
  displayName?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  modelDefinitions?: InputMaybe<Scalars['JSON']['input']>;
  models?: InputMaybe<Array<Scalars['String']['input']>>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  privacy?: InputMaybe<Scalars['String']['input']>;
  providerId: Scalars['String']['input'];
  revision?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotProviderRegistryRevisionType {
  __typename?: 'CopilotProviderRegistryRevisionType';
  actorId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fallbackSourceChain: Scalars['JSON']['output'];
  fingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  /** Immediate durable no-network provider health probe attempt created for this workspace provider revision. */
  providerHealthProbeAttempt: Maybe<CopilotProviderHealthProbeAttemptType>;
  providerId: Scalars['String']['output'];
  providerProfile: Scalars['JSON']['output'];
  providerType: Maybe<Scalars['String']['output']>;
  publishEventCount: Scalars['SafeInt']['output'];
  publishEvents: Array<CopilotRegistryRevisionPublishEventType>;
  revision: Scalars['String']['output'];
  scopeType: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotProviderSideErrorDataType {
  __typename?: 'CopilotProviderSideErrorDataType';
  kind: Scalars['String']['output'];
  message: Scalars['String']['output'];
  provider: Scalars['String']['output'];
}

export interface CopilotQuota {
  __typename?: 'CopilotQuota';
  limit: Maybe<Scalars['SafeInt']['output']>;
  used: Scalars['SafeInt']['output'];
}

export interface CopilotRegistryRevisionPublishEventType {
  __typename?: 'CopilotRegistryRevisionPublishEventType';
  actorId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  eventFingerprint: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  id: Scalars['String']['output'];
  metadata: Scalars['JSON']['output'];
  publishSource: Scalars['String']['output'];
  registryFamily: Scalars['String']['output'];
  registryKey: Scalars['String']['output'];
  registryModelId: Maybe<Scalars['String']['output']>;
  registryProviderId: Maybe<Scalars['String']['output']>;
  revision: Scalars['String']['output'];
  revisionFingerprint: Scalars['String']['output'];
  revisionId: Scalars['String']['output'];
  revisionStatus: Scalars['String']['output'];
  scopeType: Scalars['String']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotRepairExecutionApprovalDecisionInput {
  decision: Scalars['String']['input'];
  executionRequestId: Scalars['String']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotRepairExecutionAuditEventType {
  __typename?: 'CopilotRepairExecutionAuditEventType';
  actorId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  eventFingerprint: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  executionRequestId: Scalars['String']['output'];
  id: Scalars['String']['output'];
  metadata: Scalars['JSON']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotRepairExecutionControlInput {
  action: Scalars['String']['input'];
  executionRequestId: Scalars['String']['input'];
  executorPayload?: InputMaybe<Scalars['JSON']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotRepairExecutionListFilterInput {
  approvalState?: InputMaybe<Scalars['String']['input']>;
  promptName?: InputMaybe<Scalars['String']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  requestedAction?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotRepairExecutionRecordType {
  __typename?: 'CopilotRepairExecutionRecordType';
  actorId: Scalars['String']['output'];
  agentRun: Maybe<CopilotAgentRunType>;
  approvalRecordFingerprint: Scalars['String']['output'];
  approvalState: Scalars['String']['output'];
  auditEventCount: Scalars['SafeInt']['output'];
  auditEventFingerprint: Scalars['String']['output'];
  auditEvents: Array<CopilotRepairExecutionAuditEventType>;
  candidateEvidenceSetFingerprint: Scalars['String']['output'];
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  idempotencyFingerprint: Scalars['String']['output'];
  idempotencyKey: Scalars['String']['output'];
  lastAttemptAt: Maybe<Scalars['DateTime']['output']>;
  permissionStatus: Scalars['String']['output'];
  promptName: Scalars['String']['output'];
  queuedAt: Maybe<Scalars['DateTime']['output']>;
  repairJobFingerprint: Scalars['String']['output'];
  requestFingerprint: Scalars['String']['output'];
  requestedAction: Scalars['String']['output'];
  runtimeResult: CopilotRepairExecutionRuntimeResultType;
  sideEffectCount: Scalars['SafeInt']['output'];
  sideEffects: Array<CopilotRepairExecutionSideEffectType>;
  status: Scalars['String']['output'];
  targetLocatorFingerprint: Scalars['String']['output'];
  taskRouteEvidenceSetFingerprint: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workerAttempt: Scalars['SafeInt']['output'];
  workerLeaseExpiresAt: Maybe<Scalars['DateTime']['output']>;
  workerLeaseId: Maybe<Scalars['String']['output']>;
  workerMaxAttempts: Scalars['SafeInt']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotRepairExecutionRuntimeResultType {
  __typename?: 'CopilotRepairExecutionRuntimeResultType';
  executor: Scalars['String']['output'];
  message: Scalars['String']['output'];
  sideEffectFingerprint: Maybe<Scalars['String']['output']>;
  sideEffectKind: Maybe<Scalars['String']['output']>;
  sideEffectRecordId: Maybe<Scalars['String']['output']>;
  sideEffectSummary: Maybe<Scalars['JSON']['output']>;
  sideEffectsApplied: Scalars['Boolean']['output'];
  version: Scalars['String']['output'];
}

export interface CopilotRepairExecutionSideEffectType {
  __typename?: 'CopilotRepairExecutionSideEffectType';
  actorId: Scalars['String']['output'];
  appliedAt: Scalars['DateTime']['output'];
  createdAt: Scalars['DateTime']['output'];
  executionRequestId: Scalars['String']['output'];
  executorPayloadFingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  sideEffectFingerprint: Scalars['String']['output'];
  sideEffectKind: Scalars['String']['output'];
  sideEffectRecordId: Scalars['String']['output'];
  sideEffectSummary: Scalars['JSON']['output'];
  workerAttempt: Scalars['SafeInt']['output'];
  workerLeaseId: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotSessionType {
  __typename?: 'CopilotSessionType';
  docId: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  model: Scalars['String']['output'];
  optionalModels: Array<Scalars['String']['output']>;
  parentSessionId: Maybe<Scalars['ID']['output']>;
  pinned: Scalars['Boolean']['output'];
  promptName: Scalars['String']['output'];
  selectedContextProjectId: Maybe<Scalars['ID']['output']>;
  title: Maybe<Scalars['String']['output']>;
}

export interface CopilotSupportBundleAuditEventType {
  __typename?: 'CopilotSupportBundleAuditEventType';
  actorId: Scalars['String']['output'];
  bundleId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  eventFingerprint: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  id: Scalars['String']['output'];
  metadata: Scalars['JSON']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotSupportBundleCreateInput {
  workspaceId: Scalars['String']['input'];
}

export interface CopilotSupportBundleDirectDownloadAcknowledgeInput {
  authorizationId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotSupportBundleDownloadAuthorizationType {
  __typename?: 'CopilotSupportBundleDownloadAuthorizationType';
  actorId: Scalars['String']['output'];
  artifactFilename: Scalars['String']['output'];
  artifactFingerprint: Scalars['String']['output'];
  artifactKind: Scalars['String']['output'];
  artifactMime: Scalars['String']['output'];
  authorizationFingerprint: Scalars['String']['output'];
  bundleId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deliveryMethod: Scalars['String']['output'];
  directDownloadExpiresAt: Maybe<Scalars['DateTime']['output']>;
  directDownloadUrl: Maybe<Scalars['String']['output']>;
  downloadUrl: Scalars['String']['output'];
  downloadedAt: Maybe<Scalars['DateTime']['output']>;
  expiresAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  manifestFingerprint: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotSupportBundleDownloadAuthorizeInput {
  artifactKind?: InputMaybe<Scalars['String']['input']>;
  bundleId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotSupportBundleListFilterInput {
  query?: InputMaybe<Scalars['String']['input']>;
  retentionStatus?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  transferForwardingStatus?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotSupportBundleManifestType {
  __typename?: 'CopilotSupportBundleManifestType';
  actorId: Scalars['String']['output'];
  archive: Scalars['JSON']['output'];
  bundleId: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  retention: CopilotSupportBundleRetentionType;
  sourceEvidenceSetFingerprint: Scalars['String']['output'];
  sourceEvidenceSummary: CopilotSupportBundleSourceEvidenceSummaryType;
  version: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotSupportBundleRetentionCleanupInput {
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotSupportBundleRetentionCleanupType {
  __typename?: 'CopilotSupportBundleRetentionCleanupType';
  actorId: Scalars['String']['output'];
  archiveObjectCleanupFailedCount: Scalars['SafeInt']['output'];
  archiveObjectCleanupRecoveredCount: Scalars['SafeInt']['output'];
  archiveObjectCleanupRetryCount: Scalars['SafeInt']['output'];
  cleanedAt: Scalars['DateTime']['output'];
  cleanupFingerprint: Scalars['String']['output'];
  expiredAuthorizationCount: Scalars['SafeInt']['output'];
  expiredBundleCount: Scalars['SafeInt']['output'];
  expiredBundles: Array<CopilotSupportBundleType>;
  manifestObjectRewriteFailedCount: Scalars['SafeInt']['output'];
  manifestObjectRewriteRecoveredCount: Scalars['SafeInt']['output'];
  manifestObjectRewriteRetryCount: Scalars['SafeInt']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotSupportBundleRetentionType {
  __typename?: 'CopilotSupportBundleRetentionType';
  expiresAt: Scalars['String']['output'];
  status: Scalars['String']['output'];
}

export interface CopilotSupportBundleSourceEvidenceSummaryType {
  __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
  actionRunCount: Scalars['SafeInt']['output'];
  includedSections: Array<Scalars['String']['output']>;
  promptCatalogItemCount: Scalars['SafeInt']['output'];
  source: Scalars['String']['output'];
  taskRouteCount: Scalars['SafeInt']['output'];
}

export interface CopilotSupportBundleTransferEventType {
  __typename?: 'CopilotSupportBundleTransferEventType';
  artifactFingerprint: Scalars['String']['output'];
  artifactKind: Scalars['String']['output'];
  authorizationFingerprint: Scalars['String']['output'];
  authorizationId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deliveryMethod: Scalars['String']['output'];
  eventFingerprint: Scalars['String']['output'];
  eventId: Maybe<Scalars['String']['output']>;
  eventSource: Scalars['String']['output'];
  id: Scalars['String']['output'];
  manifestFingerprint: Scalars['String']['output'];
  notificationAuthEvidenceFingerprint: Scalars['String']['output'];
  storageByteSize: Scalars['SafeInt']['output'];
  storageContentType: Scalars['String']['output'];
  storageKey: Scalars['String']['output'];
  transferredAt: Scalars['DateTime']['output'];
}

export interface CopilotSupportBundleTransferForwardingEventType {
  __typename?: 'CopilotSupportBundleTransferForwardingEventType';
  attemptCount: Scalars['SafeInt']['output'];
  authorizationId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deadLetteredAt: Maybe<Scalars['DateTime']['output']>;
  eventId: Maybe<Scalars['String']['output']>;
  eventSource: Scalars['String']['output'];
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  forwardedAt: Maybe<Scalars['DateTime']['output']>;
  forwardedTransferEventFingerprint: Maybe<Scalars['String']['output']>;
  forwardingEventFingerprint: Scalars['String']['output'];
  forwardingPayload: Scalars['JSON']['output'];
  forwardingPayloadFingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  lastAttemptAt: Maybe<Scalars['DateTime']['output']>;
  maxAttempts: Scalars['SafeInt']['output'];
  nextAttemptAt: Maybe<Scalars['DateTime']['output']>;
  providerSignatureEvidenceFingerprint: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workerLeaseExpiresAt: Maybe<Scalars['DateTime']['output']>;
  workerLeaseId: Maybe<Scalars['String']['output']>;
}

export interface CopilotSupportBundleTransferForwardingReplayInput {
  forwardingEventId: Scalars['String']['input'];
  maxAttempts?: InputMaybe<Scalars['SafeInt']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotSupportBundleType {
  __typename?: 'CopilotSupportBundleType';
  actorId: Scalars['String']['output'];
  archiveByteSize: Maybe<Scalars['SafeInt']['output']>;
  archiveFilename: Maybe<Scalars['String']['output']>;
  archiveFingerprint: Maybe<Scalars['String']['output']>;
  archiveMime: Maybe<Scalars['String']['output']>;
  archiveStorageKey: Maybe<Scalars['String']['output']>;
  auditEventCount: Scalars['SafeInt']['output'];
  auditEvents: Array<CopilotSupportBundleAuditEventType>;
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Scalars['DateTime']['output'];
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  manifestByteSize: Maybe<Scalars['SafeInt']['output']>;
  manifestFilename: Maybe<Scalars['String']['output']>;
  manifestFingerprint: Scalars['String']['output'];
  manifestJson: CopilotSupportBundleManifestType;
  manifestMime: Maybe<Scalars['String']['output']>;
  manifestStorageKey: Maybe<Scalars['String']['output']>;
  retentionStatus: Scalars['String']['output'];
  sourceEvidenceSetFingerprint: Scalars['String']['output'];
  sourceEvidenceSummary: CopilotSupportBundleSourceEvidenceSummaryType;
  status: Scalars['String']['output'];
  transferEventCount: Scalars['SafeInt']['output'];
  transferEvents: Array<CopilotSupportBundleTransferEventType>;
  transferForwardingEventCount: Scalars['SafeInt']['output'];
  transferForwardingEvents: Array<CopilotSupportBundleTransferForwardingEventType>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotTaskApprovalType {
  __typename?: 'CopilotTaskApprovalType';
  decidedAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  stepId: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
}

export interface CopilotTaskArtifactType {
  __typename?: 'CopilotTaskArtifactType';
  id: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotTaskControlInput {
  action: Scalars['String']['input'];
  expectedApprovalFingerprint?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CopilotTaskDocumentUpdateType {
  __typename?: 'CopilotTaskDocumentUpdateType';
  content: Scalars['String']['output'];
  docId: Scalars['String']['output'];
  expectedVersion: Scalars['String']['output'];
  needsReconfirmation: Scalars['Boolean']['output'];
  previousVersion: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotTaskListFilterInput {
  query?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
}

export interface CopilotTaskRouteCandidateDiagnosticsType {
  __typename?: 'CopilotTaskRouteCandidateDiagnosticsType';
  candidateKey: Maybe<Scalars['String']['output']>;
  candidateModelIds: Maybe<Array<Scalars['String']['output']>>;
  costInputPer1M: Maybe<Scalars['Int']['output']>;
  costOutputPer1M: Maybe<Scalars['Int']['output']>;
  health: Maybe<Scalars['String']['output']>;
  healthCheckedAt: Maybe<Scalars['String']['output']>;
  matched: Scalars['Boolean']['output'];
  modelId: Maybe<Scalars['String']['output']>;
  modelRegistryRevision: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionActorId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  modelRegistryRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  modelRegistryRevisionScope: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionSourceChain: Maybe<
    Array<CopilotModelRegistrySourceChainEntryType>
  >;
  modelRegistryRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  modelRegistryRevisionStatus: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  privacy: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  routeAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeAttachmentSourceKinds: Maybe<Array<Scalars['String']['output']>>;
  routeContextWindow: Maybe<Scalars['SafeInt']['output']>;
  routeEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  routeInputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeMaxOutputTokens: Maybe<Scalars['SafeInt']['output']>;
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeOutputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
  routeStructuredAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeStructuredAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeStructuredAttachmentSourceKinds: Maybe<
    Array<Scalars['String']['output']>
  >;
}

export interface CopilotTaskRouteDiagnosticsErrorType {
  __typename?: 'CopilotTaskRouteDiagnosticsErrorType';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  stage: Scalars['String']['output'];
}

export interface CopilotTaskRouteDiagnosticsType {
  __typename?: 'CopilotTaskRouteDiagnosticsType';
  behaviorFlags: Maybe<Array<Scalars['String']['output']>>;
  candidateCount: Maybe<Scalars['SafeInt']['output']>;
  canonicalModelKey: Maybe<Scalars['String']['output']>;
  configured: Scalars['Boolean']['output'];
  diagnosticsErrors: Array<CopilotTaskRouteDiagnosticsErrorType>;
  dimensionMismatch: Maybe<Scalars['Boolean']['output']>;
  effectiveSourceFingerprint: Maybe<Scalars['String']['output']>;
  effectiveSourceFingerprintInputs: Maybe<Array<Scalars['String']['output']>>;
  effectiveSourceFingerprintVersion: Maybe<Scalars['String']['output']>;
  embeddingIndexContractDimensions: Maybe<Scalars['SafeInt']['output']>;
  embeddingIndexContractFingerprint: Maybe<Scalars['String']['output']>;
  embeddingIndexContractStatus: Maybe<Scalars['String']['output']>;
  embeddingIndexContractVersion: Maybe<Scalars['String']['output']>;
  errorCode: Maybe<Scalars['String']['output']>;
  errorMessage: Maybe<Scalars['String']['output']>;
  fallbackProviderIds: Array<Scalars['String']['output']>;
  featureKind: Scalars['String']['output'];
  modelBackendKind: Maybe<Scalars['String']['output']>;
  modelEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  policyAllowedPrivacy: Maybe<Array<Scalars['String']['output']>>;
  policyAllowedProviderIds: Maybe<Array<Scalars['String']['output']>>;
  policyBlockedProviderIds: Maybe<Array<Scalars['String']['output']>>;
  policyCandidates: Array<CopilotTaskRoutePolicyCandidateDiagnosticsType>;
  policyEnabled: Scalars['Boolean']['output'];
  policyFeatureKind: Maybe<Scalars['String']['output']>;
  policyPreferredPrivacy: Maybe<Array<Scalars['String']['output']>>;
  policyWorkspaceId: Maybe<Scalars['String']['output']>;
  prepareCandidates: Array<CopilotTaskRoutePrepareCandidateDiagnosticsType>;
  preparedProviderCount: Scalars['SafeInt']['output'];
  preparedRouteTargetFingerprint: Scalars['String']['output'];
  preparedRouteTargets: Array<Scalars['String']['output']>;
  preparedRoutes: Array<CopilotPreparedTaskRouteDiagnosticsType>;
  protocol: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Maybe<Scalars['String']['output']>;
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  requestLayer: Maybe<Scalars['String']['output']>;
  requestedDimensions: Maybe<Scalars['SafeInt']['output']>;
  requestedModelConfigKey: Maybe<Scalars['String']['output']>;
  requestedModelConfigPath: Maybe<Scalars['String']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  requestedModelSource: Maybe<Scalars['String']['output']>;
  rerankRuntimeContractFingerprint: Maybe<Scalars['String']['output']>;
  rerankRuntimeContractStatus: Maybe<Scalars['String']['output']>;
  rerankRuntimeContractTopK: Maybe<Scalars['SafeInt']['output']>;
  rerankRuntimeContractVersion: Maybe<Scalars['String']['output']>;
  routeCandidates: Array<CopilotTaskRouteCandidateDiagnosticsType>;
  routeTrace: Array<CopilotTaskRouteTracePhaseDiagnosticsType>;
  taskRoutePolicyRevision: Maybe<Scalars['String']['output']>;
  taskRoutePolicyRevisionActorId: Maybe<Scalars['String']['output']>;
  taskRoutePolicyRevisionFingerprint: Maybe<Scalars['String']['output']>;
  taskRoutePolicyRevisionId: Maybe<Scalars['String']['output']>;
  taskRoutePolicyRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  taskRoutePolicyRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  taskRoutePolicyRevisionScope: Maybe<Scalars['String']['output']>;
  taskRoutePolicyRevisionSourceChain: Maybe<
    Array<CopilotTaskRoutePolicySourceChainEntryType>
  >;
  taskRoutePolicyRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  taskRoutePolicyRevisionStatus: Maybe<Scalars['String']['output']>;
  taskRoutePolicyRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  topK: Maybe<Scalars['SafeInt']['output']>;
}

export interface CopilotTaskRoutePolicyCandidateDiagnosticsType {
  __typename?: 'CopilotTaskRoutePolicyCandidateDiagnosticsType';
  allowed: Scalars['Boolean']['output'];
  available: Scalars['Boolean']['output'];
  candidateFingerprint: Scalars['String']['output'];
  candidateKey: Scalars['String']['output'];
  health: Scalars['String']['output'];
  healthCheckedAt: Maybe<Scalars['String']['output']>;
  privacy: Scalars['String']['output'];
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
}

export interface CopilotTaskRoutePolicyPublishInput {
  featureKind: Scalars['String']['input'];
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  modelId: Scalars['String']['input'];
  revision?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CopilotTaskRoutePolicyRevisionType {
  __typename?: 'CopilotTaskRoutePolicyRevisionType';
  actorId: Maybe<Scalars['String']['output']>;
  configKey: Maybe<Scalars['String']['output']>;
  configPath: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fallbackSourceChain: Scalars['JSON']['output'];
  featureKind: Scalars['String']['output'];
  fingerprint: Scalars['String']['output'];
  id: Scalars['String']['output'];
  modelId: Maybe<Scalars['String']['output']>;
  publishEventCount: Scalars['SafeInt']['output'];
  publishEvents: Array<CopilotRegistryRevisionPublishEventType>;
  revision: Scalars['String']['output'];
  scopeType: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotTaskRoutePolicySourceChainEntryType {
  __typename?: 'CopilotTaskRoutePolicySourceChainEntryType';
  actorId: Maybe<Scalars['String']['output']>;
  configKey: Maybe<Scalars['String']['output']>;
  configPath: Maybe<Scalars['String']['output']>;
  featureKind: Maybe<Scalars['String']['output']>;
  fingerprint: Maybe<Scalars['String']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  revision: Maybe<Scalars['String']['output']>;
  scope: Scalars['String']['output'];
  source: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Maybe<Scalars['String']['output']>;
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotTaskRoutePrepareCandidateDiagnosticsType {
  __typename?: 'CopilotTaskRoutePrepareCandidateDiagnosticsType';
  candidateKey: Maybe<Scalars['String']['output']>;
  candidateModelIds: Maybe<Array<Scalars['String']['output']>>;
  costInputPer1M: Maybe<Scalars['Int']['output']>;
  costOutputPer1M: Maybe<Scalars['Int']['output']>;
  errorCategory: Maybe<Scalars['String']['output']>;
  errorCode: Maybe<Scalars['String']['output']>;
  health: Maybe<Scalars['String']['output']>;
  healthCheckedAt: Maybe<Scalars['String']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  modelRegistryRevision: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionActorId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionFingerprint: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionId: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionPublishEventCount: Maybe<Scalars['SafeInt']['output']>;
  modelRegistryRevisionPublishEvents: Maybe<
    Array<CopilotRegistryRevisionPublishEventType>
  >;
  modelRegistryRevisionScope: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionSourceChain: Maybe<
    Array<CopilotModelRegistrySourceChainEntryType>
  >;
  modelRegistryRevisionSourceChainFingerprint: Maybe<
    Scalars['String']['output']
  >;
  modelRegistryRevisionStatus: Maybe<Scalars['String']['output']>;
  modelRegistryRevisionWorkspaceId: Maybe<Scalars['String']['output']>;
  prepared: Scalars['Boolean']['output'];
  preparedModelId: Maybe<Scalars['String']['output']>;
  privacy: Maybe<Scalars['String']['output']>;
  providerConfiguredModelCount: Maybe<Scalars['SafeInt']['output']>;
  providerConfiguredModelIds: Maybe<Array<Scalars['String']['output']>>;
  providerId: Scalars['String']['output'];
  providerName: Maybe<Scalars['String']['output']>;
  providerPriority: Maybe<Scalars['SafeInt']['output']>;
  providerProfileConfigPath: Maybe<Scalars['String']['output']>;
  providerProfileId: Maybe<Scalars['String']['output']>;
  providerProfileSource: Maybe<Scalars['String']['output']>;
  providerSource: Maybe<Scalars['String']['output']>;
  providerType: Maybe<Scalars['String']['output']>;
  reasons: Array<Scalars['String']['output']>;
  registryAvailable: Maybe<Scalars['Boolean']['output']>;
  registryKind: Maybe<Scalars['String']['output']>;
  registrySelected: Maybe<Scalars['Boolean']['output']>;
  requestedModelId: Maybe<Scalars['String']['output']>;
  routeAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeAttachmentSourceKinds: Maybe<Array<Scalars['String']['output']>>;
  routeContextWindow: Maybe<Scalars['SafeInt']['output']>;
  routeEmbeddingDimensions: Maybe<Scalars['SafeInt']['output']>;
  routeInputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeMaxOutputTokens: Maybe<Scalars['SafeInt']['output']>;
  routeModelAliasMatched: Maybe<Scalars['Boolean']['output']>;
  routeModelDefinitionAliases: Maybe<Array<Scalars['String']['output']>>;
  routeModelDefinitionId: Maybe<Scalars['String']['output']>;
  routeModelDefinitionSource: Maybe<Scalars['String']['output']>;
  routeOutputTypes: Maybe<Array<Scalars['String']['output']>>;
  routeRawModelId: Maybe<Scalars['String']['output']>;
  routeStructuredAttachmentAllowRemoteUrls: Maybe<Scalars['Boolean']['output']>;
  routeStructuredAttachmentKinds: Maybe<Array<Scalars['String']['output']>>;
  routeStructuredAttachmentSourceKinds: Maybe<
    Array<Scalars['String']['output']>
  >;
}

export interface CopilotTaskRouteTracePhaseDiagnosticsType {
  __typename?: 'CopilotTaskRouteTracePhaseDiagnosticsType';
  availableCount: Maybe<Scalars['SafeInt']['output']>;
  blockedCount: Maybe<Scalars['SafeInt']['output']>;
  candidateCount: Scalars['SafeInt']['output'];
  matchedCount: Maybe<Scalars['SafeInt']['output']>;
  phase: Scalars['String']['output'];
  preparedCount: Maybe<Scalars['SafeInt']['output']>;
  reasons: Array<Scalars['String']['output']>;
  selectedCount: Maybe<Scalars['SafeInt']['output']>;
}

export interface CopilotTaskStepType {
  __typename?: 'CopilotTaskStepType';
  completedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  key: Scalars['String']['output'];
  order: Scalars['SafeInt']['output'];
  startedAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
}

export interface CopilotTaskType {
  __typename?: 'CopilotTaskType';
  abandoned: Scalars['Boolean']['output'];
  approval: Maybe<CopilotTaskApprovalType>;
  approvalFingerprint: Maybe<Scalars['String']['output']>;
  approvalSummary: Maybe<Scalars['JSON']['output']>;
  artifacts: Array<CopilotTaskArtifactType>;
  availableActions: Array<Scalars['String']['output']>;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  documentUpdate: Maybe<CopilotTaskDocumentUpdateType>;
  failureCode: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  projectId: Maybe<Scalars['String']['output']>;
  resultEvidence: Maybe<Scalars['JSON']['output']>;
  resultSummary: Maybe<Scalars['String']['output']>;
  sessionId: Maybe<Scalars['String']['output']>;
  startedAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
  steps: Array<CopilotTaskStepType>;
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workflow: Scalars['String']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotWorkbenchBlockerTaskType {
  __typename?: 'CopilotWorkbenchBlockerTaskType';
  creatorUserId: Scalars['String']['output'];
  dueAt: Maybe<Scalars['DateTime']['output']>;
  origin: Scalars['String']['output'];
  overdue: Scalars['Boolean']['output'];
  resolutionActorUserId: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  waitingOn: Scalars['String']['output'];
}

export interface CopilotWorkbenchTaskItemType {
  __typename?: 'CopilotWorkbenchTaskItemType';
  attention: Maybe<Scalars['String']['output']>;
  availableActions: Array<Scalars['String']['output']>;
  blocker: Maybe<CopilotWorkbenchBlockerTaskType>;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  documentId: Maybe<Scalars['String']['output']>;
  entityId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  projectId: Maybe<Scalars['String']['output']>;
  redacted: Scalars['Boolean']['output'];
  relatedUserId: Maybe<Scalars['String']['output']>;
  requestedLevel: Maybe<Scalars['String']['output']>;
  run: Maybe<CopilotTaskType>;
  segment: Scalars['String']['output'];
  status: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Maybe<Scalars['String']['output']>;
}

export interface CopilotWorkbenchTaskListType {
  __typename?: 'CopilotWorkbenchTaskListType';
  capped: Scalars['Boolean']['output'];
  items: Array<CopilotWorkbenchTaskItemType>;
  nextCursor: Maybe<Scalars['String']['output']>;
}

export interface CopilotWorkbenchTaskPanelType {
  __typename?: 'CopilotWorkbenchTaskPanelType';
  done: CopilotWorkbenchTaskSegmentType;
  inProgress: CopilotWorkbenchTaskSegmentType;
  todo: CopilotWorkbenchTaskSegmentType;
}

export interface CopilotWorkbenchTaskSegmentType {
  __typename?: 'CopilotWorkbenchTaskSegmentType';
  capped: Scalars['Boolean']['output'];
  items: Array<CopilotWorkbenchTaskItemType>;
}

export interface CopilotWorkspaceConfig {
  __typename?: 'CopilotWorkspaceConfig';
  allIgnoredDocs: Array<CopilotWorkspaceIgnoredDoc>;
  files: PaginatedCopilotWorkspaceFileType;
  ignoredDocs: PaginatedIgnoredDocsType;
  workspaceId: Scalars['String']['output'];
}

export interface CopilotWorkspaceConfigFilesArgs {
  pagination: PaginationInput;
}

export interface CopilotWorkspaceConfigIgnoredDocsArgs {
  pagination: PaginationInput;
}

export interface CopilotWorkspaceFile {
  __typename?: 'CopilotWorkspaceFile';
  blobId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  fileId: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
  mimeType: Scalars['String']['output'];
  size: Scalars['SafeInt']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface CopilotWorkspaceFileTypeEdge {
  __typename?: 'CopilotWorkspaceFileTypeEdge';
  cursor: Scalars['String']['output'];
  node: CopilotWorkspaceFile;
}

export interface CopilotWorkspaceIgnoredDoc {
  __typename?: 'CopilotWorkspaceIgnoredDoc';
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<Scalars['String']['output']>;
  createdByAvatar: Maybe<Scalars['String']['output']>;
  docCreatedAt: Maybe<Scalars['DateTime']['output']>;
  docId: Scalars['String']['output'];
  docUpdatedAt: Maybe<Scalars['DateTime']['output']>;
  title: Maybe<Scalars['String']['output']>;
  updatedBy: Maybe<Scalars['String']['output']>;
}

export interface CopilotWorkspaceIgnoredDocTypeEdge {
  __typename?: 'CopilotWorkspaceIgnoredDocTypeEdge';
  cursor: Scalars['String']['output'];
  node: CopilotWorkspaceIgnoredDoc;
}

export interface CreateChatMessageInput {
  /** @deprecated use blobs */
  attachments?: InputMaybe<Array<Scalars['String']['input']>>;
  blob?: InputMaybe<Scalars['Upload']['input']>;
  blobs?: InputMaybe<Array<Scalars['Upload']['input']>>;
  content?: InputMaybe<Scalars['String']['input']>;
  params?: InputMaybe<Scalars['JSON']['input']>;
  sessionId: Scalars['String']['input'];
}

export interface CreateChatSessionInput {
  docId?: InputMaybe<Scalars['String']['input']>;
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  /** The prompt name to use for the session */
  promptName: Scalars['String']['input'];
  /** true by default, compliant for old version */
  reuseLatestChat?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface CreateCheckoutSessionInput {
  args?: InputMaybe<Scalars['JSONObject']['input']>;
  coupon?: InputMaybe<Scalars['String']['input']>;
  /** @deprecated not required anymore */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  recurring?: InputMaybe<SubscriptionRecurring>;
  successCallbackLink: Scalars['String']['input'];
  variant?: InputMaybe<SubscriptionVariant>;
}

export interface CreateCopilotBlockerInput {
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  projectId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
  type: Scalars['String']['input'];
  waitingOn: Scalars['String']['input'];
}

export interface CreateCopilotContextMemoryInput {
  content: Scalars['String']['input'];
  docId?: InputMaybe<Scalars['String']['input']>;
  kind: CopilotContextMemoryManualKindInput;
  projectId?: InputMaybe<Scalars['String']['input']>;
  scope: CopilotContextMemoryScopeInput;
  sourceDocuments?: InputMaybe<Array<CopilotContextRuleDocumentRefInput>>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateCopilotContextPolicyInput {
  applicationMode: Scalars['String']['input'];
  conditions?: InputMaybe<CopilotContextRuleConditionsInput>;
  content: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  priority: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CreateCopilotContextProjectInput {
  description?: InputMaybe<Scalars['String']['input']>;
  documents?: InputMaybe<Array<CopilotContextProjectDocumentInputType>>;
  name: Scalars['String']['input'];
}

export interface CreateCopilotContextRuleInput {
  applicationMode: Scalars['String']['input'];
  conditions?: InputMaybe<CopilotContextRuleConditionsInput>;
  content: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  priority: Scalars['Int']['input'];
  projectId?: InputMaybe<Scalars['String']['input']>;
  scope: Scalars['String']['input'];
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateEnterpriseConnectionInput {
  name?: InputMaybe<Scalars['String']['input']>;
  provider: EnterpriseProvider;
  workspaceId: Scalars['String']['input'];
}

export interface CreateMcpCredentialInput {
  accessMode?: McpAccessMode;
  callbackUrl?: InputMaybe<Scalars['String']['input']>;
  capabilities?: InputMaybe<Array<Scalars['String']['input']>>;
  expirationDays?: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface CreateUserInput {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
}

export interface CredentialsRequirementType {
  __typename?: 'CredentialsRequirementType';
  password: PasswordLimitsType;
}

export interface DeleteAccount {
  __typename?: 'DeleteAccount';
  success: Scalars['Boolean']['output'];
}

export interface DeleteSessionInput {
  docId?: InputMaybe<Scalars['String']['input']>;
  sessionIds: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface DocActionDeniedDataType {
  __typename?: 'DocActionDeniedDataType';
  action: Scalars['String']['output'];
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface DocHistoryNotFoundDataType {
  __typename?: 'DocHistoryNotFoundDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
  timestamp: Scalars['Int']['output'];
}

export interface DocHistoryType {
  __typename?: 'DocHistoryType';
  editor: Maybe<EditorType>;
  id: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface DocMemberLastAccess {
  __typename?: 'DocMemberLastAccess';
  lastAccessedAt: Scalars['DateTime']['output'];
  lastDocId: Maybe<Scalars['String']['output']>;
  user: PublicUserType;
}

export interface DocMemberLastAccessEdge {
  __typename?: 'DocMemberLastAccessEdge';
  cursor: Scalars['String']['output'];
  node: DocMemberLastAccess;
}

/** Doc mode */
export enum DocMode {
  edgeless = 'edgeless',
  page = 'page',
}

export interface DocNotFoundDataType {
  __typename?: 'DocNotFoundDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface DocPageAnalytics {
  __typename?: 'DocPageAnalytics';
  generatedAt: Scalars['DateTime']['output'];
  series: Array<DocPageAnalyticsPoint>;
  summary: DocPageAnalyticsSummary;
  window: TimeWindow;
}

export interface DocPageAnalyticsInput {
  timezone?: InputMaybe<Scalars['String']['input']>;
  windowDays?: InputMaybe<Scalars['Int']['input']>;
}

export interface DocPageAnalyticsPoint {
  __typename?: 'DocPageAnalyticsPoint';
  date: Scalars['DateTime']['output'];
  guestViews: Scalars['SafeInt']['output'];
  totalViews: Scalars['SafeInt']['output'];
  uniqueViews: Scalars['SafeInt']['output'];
}

export interface DocPageAnalyticsSummary {
  __typename?: 'DocPageAnalyticsSummary';
  guestViews: Scalars['SafeInt']['output'];
  lastAccessedAt: Maybe<Scalars['DateTime']['output']>;
  totalViews: Scalars['SafeInt']['output'];
  uniqueViews: Scalars['SafeInt']['output'];
}

export interface DocPermissions {
  __typename?: 'DocPermissions';
  Doc_Comments_Create: Scalars['Boolean']['output'];
  Doc_Comments_Delete: Scalars['Boolean']['output'];
  Doc_Comments_Read: Scalars['Boolean']['output'];
  Doc_Comments_Resolve: Scalars['Boolean']['output'];
  Doc_Comments_Update: Scalars['Boolean']['output'];
  Doc_Copy: Scalars['Boolean']['output'];
  Doc_Delete: Scalars['Boolean']['output'];
  Doc_Duplicate: Scalars['Boolean']['output'];
  Doc_Properties_Read: Scalars['Boolean']['output'];
  Doc_Properties_Update: Scalars['Boolean']['output'];
  Doc_Publish: Scalars['Boolean']['output'];
  Doc_Read: Scalars['Boolean']['output'];
  Doc_Restore: Scalars['Boolean']['output'];
  Doc_TransferOwner: Scalars['Boolean']['output'];
  Doc_Trash: Scalars['Boolean']['output'];
  Doc_Update: Scalars['Boolean']['output'];
  Doc_Users_Manage: Scalars['Boolean']['output'];
  Doc_Users_Read: Scalars['Boolean']['output'];
}

/** User permission in doc */
export enum DocRole {
  Commenter = 'Commenter',
  Editor = 'Editor',
  External = 'External',
  Manager = 'Manager',
  None = 'None',
  Owner = 'Owner',
  Reader = 'Reader',
}

export interface DocType {
  __typename?: 'DocType';
  /** Doc page analytics in a time window */
  analytics: DocPageAnalytics;
  createdAt: Maybe<Scalars['DateTime']['output']>;
  /** Doc create user */
  createdBy: Maybe<PublicUserType>;
  creatorId: Maybe<Scalars['String']['output']>;
  defaultRole: DocRole;
  /** paginated doc granted users list */
  grantedUsersList: PaginatedGrantedDocUserType;
  id: Scalars['String']['output'];
  /** Paginated last accessed members of the current doc */
  lastAccessedMembers: PaginatedDocMemberLastAccess;
  /** Doc last updated user */
  lastUpdatedBy: Maybe<PublicUserType>;
  lastUpdaterId: Maybe<Scalars['String']['output']>;
  /** Doc metadata */
  meta: WorkspaceDocMeta;
  mode: PublicDocMode;
  permissions: DocPermissions;
  public: Scalars['Boolean']['output'];
  summary: Maybe<Scalars['String']['output']>;
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Maybe<Scalars['DateTime']['output']>;
  workspaceId: Scalars['String']['output'];
}

export interface DocTypeAnalyticsArgs {
  input?: InputMaybe<DocPageAnalyticsInput>;
}

export interface DocTypeGrantedUsersListArgs {
  pagination: PaginationInput;
}

export interface DocTypeLastAccessedMembersArgs {
  includeTotal?: InputMaybe<Scalars['Boolean']['input']>;
  pagination: PaginationInput;
  query?: InputMaybe<Scalars['String']['input']>;
}

export interface DocTypeEdge {
  __typename?: 'DocTypeEdge';
  cursor: Scalars['String']['output'];
  node: DocType;
}

export interface DocUpdateBlockedDataType {
  __typename?: 'DocUpdateBlockedDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface EditorType {
  __typename?: 'EditorType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
}

export interface EnterpriseAuthorizationSessionType {
  __typename?: 'EnterpriseAuthorizationSessionType';
  authorizationUrl: Maybe<Scalars['String']['output']>;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  connectionId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lastErrorCode: Maybe<Scalars['String']['output']>;
  lastErrorMessage: Maybe<Scalars['String']['output']>;
  provider: EnterpriseProvider;
  qrCodeUrl: Maybe<Scalars['String']['output']>;
  startedAt: Maybe<Scalars['DateTime']['output']>;
  status: EnterpriseAuthorizationStatus;
  updatedAt: Scalars['DateTime']['output'];
  userCode: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['String']['output'];
}

export enum EnterpriseAuthorizationStatus {
  AUTHORIZED = 'AUTHORIZED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  STARTING = 'STARTING',
  WAITING = 'WAITING',
}

export interface EnterpriseConnectionPolicyType {
  __typename?: 'EnterpriseConnectionPolicyType';
  allowedProviders: Array<EnterpriseProvider>;
  enabled: Scalars['Boolean']['output'];
}

export enum EnterpriseConnectionStatus {
  ACTIVE = 'ACTIVE',
  CONNECTING = 'CONNECTING',
  DEGRADED = 'DEGRADED',
  DISABLED = 'DISABLED',
  REAUTH_REQUIRED = 'REAUTH_REQUIRED',
}

export enum EnterpriseConnectionTransport {
  CLI = 'CLI',
  MCP = 'MCP',
}

export interface EnterpriseConnectionType {
  __typename?: 'EnterpriseConnectionType';
  createdAt: Scalars['DateTime']['output'];
  enabledToolNames: Array<Scalars['String']['output']>;
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  externalTenantId: Maybe<Scalars['String']['output']>;
  externalUserId: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identityType: Maybe<Scalars['String']['output']>;
  lastCheckedAt: Maybe<Scalars['DateTime']['output']>;
  lastConnectedAt: Maybe<Scalars['DateTime']['output']>;
  lastErrorCode: Maybe<Scalars['String']['output']>;
  lastErrorMessage: Maybe<Scalars['String']['output']>;
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  provider: EnterpriseProvider;
  status: EnterpriseConnectionStatus;
  tools: Array<EnterpriseToolType>;
  transport: EnterpriseConnectionTransport;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export enum EnterpriseProvider {
  DINGTALK = 'DINGTALK',
  LARK = 'LARK',
  WECOM = 'WECOM',
}

export interface EnterpriseToolType {
  __typename?: 'EnterpriseToolType';
  description: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  inputSchema: Scalars['JSON']['output'];
  name: Scalars['String']['output'];
  requiresConfirmation: Scalars['Boolean']['output'];
  risk: Scalars['String']['output'];
  supportsDryRun: Scalars['Boolean']['output'];
}

export type ErrorDataUnion =
  | AlreadyInSpaceDataType
  | BlobNotFoundDataType
  | CalendarProviderRequestErrorDataType
  | CopilotContextFileNotSupportedDataType
  | CopilotDocNotFoundDataType
  | CopilotFailedToAddWorkspaceFileEmbeddingDataType
  | CopilotFailedToGenerateEmbeddingDataType
  | CopilotFailedToMatchContextDataType
  | CopilotFailedToMatchGlobalContextDataType
  | CopilotFailedToModifyContextDataType
  | CopilotInvalidContextDataType
  | CopilotMessageNotFoundDataType
  | CopilotPromptNotFoundDataType
  | CopilotProviderNotSupportedDataType
  | CopilotProviderSideErrorDataType
  | DocActionDeniedDataType
  | DocHistoryNotFoundDataType
  | DocNotFoundDataType
  | DocUpdateBlockedDataType
  | ExpectToGrantDocUserRolesDataType
  | ExpectToRevokeDocUserRolesDataType
  | ExpectToUpdateDocUserRoleDataType
  | GraphqlBadRequestDataType
  | HttpRequestErrorDataType
  | ImageFormatNotSupportedDataType
  | InvalidAppConfigDataType
  | InvalidAppConfigInputDataType
  | InvalidEmailDataType
  | InvalidHistoryTimestampDataType
  | InvalidIndexerInputDataType
  | InvalidLicenseToActivateDataType
  | InvalidLicenseUpdateParamsDataType
  | InvalidOauthCallbackCodeDataType
  | InvalidOauthResponseDataType
  | InvalidPasswordLengthDataType
  | InvalidRuntimeConfigTypeDataType
  | InvalidSearchProviderRequestDataType
  | MemberNotFoundInSpaceDataType
  | MentionUserDocAccessDeniedDataType
  | MissingOauthQueryParameterDataType
  | NoCopilotProviderAvailableDataType
  | NoMoreSeatDataType
  | NotInSpaceDataType
  | QueryTooLongDataType
  | ResponseTooLargeErrorDataType
  | RuntimeConfigNotFoundDataType
  | SameSubscriptionRecurringDataType
  | SpaceAccessDeniedDataType
  | SpaceNotFoundDataType
  | SpaceOwnerNotFoundDataType
  | SpaceShouldHaveOnlyOneOwnerDataType
  | SsrfBlockedErrorDataType
  | SubscriptionAlreadyExistsDataType
  | SubscriptionNotExistsDataType
  | SubscriptionPlanNotFoundDataType
  | UnknownOauthProviderDataType
  | UnsupportedClientVersionDataType
  | UnsupportedServerVersionDataType
  | UnsupportedSubscriptionPlanDataType
  | ValidationErrorDataType
  | VersionRejectedDataType
  | WorkspacePermissionNotFoundDataType
  | WrongSignInCredentialsDataType;

export enum ErrorNames {
  ACCESS_DENIED = 'ACCESS_DENIED',
  ACCESS_TOKEN_EXPIRED = 'ACCESS_TOKEN_EXPIRED',
  ACCESS_TOKEN_INVALID = 'ACCESS_TOKEN_INVALID',
  ACTION_FORBIDDEN = 'ACTION_FORBIDDEN',
  ACTION_FORBIDDEN_ON_NON_TEAM_WORKSPACE = 'ACTION_FORBIDDEN_ON_NON_TEAM_WORKSPACE',
  ALREADY_IN_SPACE = 'ALREADY_IN_SPACE',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_SESSION_REVOKED = 'AUTH_SESSION_REVOKED',
  AUTH_SESSION_TEMPORARILY_UNAVAILABLE = 'AUTH_SESSION_TEMPORARILY_UNAVAILABLE',
  BAD_REQUEST = 'BAD_REQUEST',
  BLOB_INVALID = 'BLOB_INVALID',
  BLOB_NOT_FOUND = 'BLOB_NOT_FOUND',
  BLOB_QUOTA_EXCEEDED = 'BLOB_QUOTA_EXCEEDED',
  CALENDAR_PROVIDER_REQUEST_ERROR = 'CALENDAR_PROVIDER_REQUEST_ERROR',
  CANNOT_DELETE_ACCOUNT_WITH_OWNED_TEAM_WORKSPACE = 'CANNOT_DELETE_ACCOUNT_WITH_OWNED_TEAM_WORKSPACE',
  CANNOT_DELETE_ALL_ADMIN_ACCOUNT = 'CANNOT_DELETE_ALL_ADMIN_ACCOUNT',
  CANNOT_DELETE_OWN_ACCOUNT = 'CANNOT_DELETE_OWN_ACCOUNT',
  CANT_UPDATE_ONETIME_PAYMENT_SUBSCRIPTION = 'CANT_UPDATE_ONETIME_PAYMENT_SUBSCRIPTION',
  CAN_NOT_BATCH_GRANT_DOC_OWNER_PERMISSIONS = 'CAN_NOT_BATCH_GRANT_DOC_OWNER_PERMISSIONS',
  CAN_NOT_REVOKE_YOURSELF = 'CAN_NOT_REVOKE_YOURSELF',
  CAPTCHA_VERIFICATION_FAILED = 'CAPTCHA_VERIFICATION_FAILED',
  COMMENT_ATTACHMENT_NOT_FOUND = 'COMMENT_ATTACHMENT_NOT_FOUND',
  COMMENT_ATTACHMENT_QUOTA_EXCEEDED = 'COMMENT_ATTACHMENT_QUOTA_EXCEEDED',
  COMMENT_NOT_FOUND = 'COMMENT_NOT_FOUND',
  COPILOT_ACTION_TAKEN = 'COPILOT_ACTION_TAKEN',
  COPILOT_BYOK_NOT_CONFIGURED = 'COPILOT_BYOK_NOT_CONFIGURED',
  COPILOT_CONTEXT_FILE_NOT_SUPPORTED = 'COPILOT_CONTEXT_FILE_NOT_SUPPORTED',
  COPILOT_DOCS_NOT_FOUND = 'COPILOT_DOCS_NOT_FOUND',
  COPILOT_DOC_NOT_FOUND = 'COPILOT_DOC_NOT_FOUND',
  COPILOT_EMBEDDING_DISABLED = 'COPILOT_EMBEDDING_DISABLED',
  COPILOT_EMBEDDING_UNAVAILABLE = 'COPILOT_EMBEDDING_UNAVAILABLE',
  COPILOT_FAILED_TO_ADD_WORKSPACE_FILE_EMBEDDING = 'COPILOT_FAILED_TO_ADD_WORKSPACE_FILE_EMBEDDING',
  COPILOT_FAILED_TO_CREATE_MESSAGE = 'COPILOT_FAILED_TO_CREATE_MESSAGE',
  COPILOT_FAILED_TO_GENERATE_EMBEDDING = 'COPILOT_FAILED_TO_GENERATE_EMBEDDING',
  COPILOT_FAILED_TO_GENERATE_TEXT = 'COPILOT_FAILED_TO_GENERATE_TEXT',
  COPILOT_FAILED_TO_MATCH_CONTEXT = 'COPILOT_FAILED_TO_MATCH_CONTEXT',
  COPILOT_FAILED_TO_MATCH_GLOBAL_CONTEXT = 'COPILOT_FAILED_TO_MATCH_GLOBAL_CONTEXT',
  COPILOT_FAILED_TO_MODIFY_CONTEXT = 'COPILOT_FAILED_TO_MODIFY_CONTEXT',
  COPILOT_INVALID_CONTEXT = 'COPILOT_INVALID_CONTEXT',
  COPILOT_MESSAGE_NOT_FOUND = 'COPILOT_MESSAGE_NOT_FOUND',
  COPILOT_PROMPT_INVALID = 'COPILOT_PROMPT_INVALID',
  COPILOT_PROMPT_NOT_FOUND = 'COPILOT_PROMPT_NOT_FOUND',
  COPILOT_PROVIDER_NOT_SUPPORTED = 'COPILOT_PROVIDER_NOT_SUPPORTED',
  COPILOT_PROVIDER_SIDE_ERROR = 'COPILOT_PROVIDER_SIDE_ERROR',
  COPILOT_QUOTA_EXCEEDED = 'COPILOT_QUOTA_EXCEEDED',
  COPILOT_SESSION_DELETED = 'COPILOT_SESSION_DELETED',
  COPILOT_SESSION_INVALID_INPUT = 'COPILOT_SESSION_INVALID_INPUT',
  COPILOT_SESSION_NOT_FOUND = 'COPILOT_SESSION_NOT_FOUND',
  COPILOT_TRANSCRIPTION_AUDIO_NOT_PROVIDED = 'COPILOT_TRANSCRIPTION_AUDIO_NOT_PROVIDED',
  COPILOT_TRANSCRIPTION_JOB_EXISTS = 'COPILOT_TRANSCRIPTION_JOB_EXISTS',
  COPILOT_TRANSCRIPTION_JOB_NOT_FOUND = 'COPILOT_TRANSCRIPTION_JOB_NOT_FOUND',
  CUSTOMER_PORTAL_CREATE_FAILED = 'CUSTOMER_PORTAL_CREATE_FAILED',
  DOC_ACTION_DENIED = 'DOC_ACTION_DENIED',
  DOC_DEFAULT_ROLE_CAN_NOT_BE_OWNER = 'DOC_DEFAULT_ROLE_CAN_NOT_BE_OWNER',
  DOC_HISTORY_NOT_FOUND = 'DOC_HISTORY_NOT_FOUND',
  DOC_IS_NOT_PUBLIC = 'DOC_IS_NOT_PUBLIC',
  DOC_NOT_FOUND = 'DOC_NOT_FOUND',
  DOC_UPDATE_BLOCKED = 'DOC_UPDATE_BLOCKED',
  EMAIL_ALREADY_USED = 'EMAIL_ALREADY_USED',
  EMAIL_SERVICE_NOT_CONFIGURED = 'EMAIL_SERVICE_NOT_CONFIGURED',
  EMAIL_TOKEN_NOT_FOUND = 'EMAIL_TOKEN_NOT_FOUND',
  EMAIL_VERIFICATION_REQUIRED = 'EMAIL_VERIFICATION_REQUIRED',
  EXPECT_TO_GRANT_DOC_USER_ROLES = 'EXPECT_TO_GRANT_DOC_USER_ROLES',
  EXPECT_TO_PUBLISH_DOC = 'EXPECT_TO_PUBLISH_DOC',
  EXPECT_TO_REVOKE_DOC_USER_ROLES = 'EXPECT_TO_REVOKE_DOC_USER_ROLES',
  EXPECT_TO_REVOKE_PUBLIC_DOC = 'EXPECT_TO_REVOKE_PUBLIC_DOC',
  EXPECT_TO_UPDATE_DOC_USER_ROLE = 'EXPECT_TO_UPDATE_DOC_USER_ROLE',
  FAILED_TO_CHECKOUT = 'FAILED_TO_CHECKOUT',
  FAILED_TO_SAVE_UPDATES = 'FAILED_TO_SAVE_UPDATES',
  FAILED_TO_UPSERT_SNAPSHOT = 'FAILED_TO_UPSERT_SNAPSHOT',
  GRAPHQL_BAD_REQUEST = 'GRAPHQL_BAD_REQUEST',
  HTTP_REQUEST_ERROR = 'HTTP_REQUEST_ERROR',
  IMAGE_FORMAT_NOT_SUPPORTED = 'IMAGE_FORMAT_NOT_SUPPORTED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  INVALID_APP_CONFIG = 'INVALID_APP_CONFIG',
  INVALID_APP_CONFIG_INPUT = 'INVALID_APP_CONFIG_INPUT',
  INVALID_AUTH_STATE = 'INVALID_AUTH_STATE',
  INVALID_CHECKOUT_PARAMETERS = 'INVALID_CHECKOUT_PARAMETERS',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_EMAIL_TOKEN = 'INVALID_EMAIL_TOKEN',
  INVALID_HISTORY_TIMESTAMP = 'INVALID_HISTORY_TIMESTAMP',
  INVALID_INDEXER_INPUT = 'INVALID_INDEXER_INPUT',
  INVALID_INVITATION = 'INVALID_INVITATION',
  INVALID_LICENSE_SESSION_ID = 'INVALID_LICENSE_SESSION_ID',
  INVALID_LICENSE_TO_ACTIVATE = 'INVALID_LICENSE_TO_ACTIVATE',
  INVALID_LICENSE_UPDATE_PARAMS = 'INVALID_LICENSE_UPDATE_PARAMS',
  INVALID_OAUTH_CALLBACK_CODE = 'INVALID_OAUTH_CALLBACK_CODE',
  INVALID_OAUTH_CALLBACK_STATE = 'INVALID_OAUTH_CALLBACK_STATE',
  INVALID_OAUTH_RESPONSE = 'INVALID_OAUTH_RESPONSE',
  INVALID_PASSWORD_LENGTH = 'INVALID_PASSWORD_LENGTH',
  INVALID_RUNTIME_CONFIG_TYPE = 'INVALID_RUNTIME_CONFIG_TYPE',
  INVALID_SEARCH_PROVIDER_REQUEST = 'INVALID_SEARCH_PROVIDER_REQUEST',
  INVALID_SUBSCRIPTION_PARAMETERS = 'INVALID_SUBSCRIPTION_PARAMETERS',
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  LICENSE_NOT_FOUND = 'LICENSE_NOT_FOUND',
  LICENSE_REVEALED = 'LICENSE_REVEALED',
  LINK_EXPIRED = 'LINK_EXPIRED',
  MAILER_SERVICE_IS_NOT_CONFIGURED = 'MAILER_SERVICE_IS_NOT_CONFIGURED',
  MANAGED_BY_APP_STORE_OR_PLAY = 'MANAGED_BY_APP_STORE_OR_PLAY',
  MEMBER_NOT_FOUND_IN_SPACE = 'MEMBER_NOT_FOUND_IN_SPACE',
  MEMBER_QUOTA_EXCEEDED = 'MEMBER_QUOTA_EXCEEDED',
  MENTION_USER_DOC_ACCESS_DENIED = 'MENTION_USER_DOC_ACCESS_DENIED',
  MENTION_USER_ONESELF_DENIED = 'MENTION_USER_ONESELF_DENIED',
  MISSING_OAUTH_QUERY_PARAMETER = 'MISSING_OAUTH_QUERY_PARAMETER',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NEW_OWNER_IS_NOT_ACTIVE_MEMBER = 'NEW_OWNER_IS_NOT_ACTIVE_MEMBER',
  NOTIFICATION_NOT_FOUND = 'NOTIFICATION_NOT_FOUND',
  NOT_FOUND = 'NOT_FOUND',
  NOT_IN_SPACE = 'NOT_IN_SPACE',
  NO_COPILOT_PROVIDER_AVAILABLE = 'NO_COPILOT_PROVIDER_AVAILABLE',
  NO_MORE_SEAT = 'NO_MORE_SEAT',
  OAUTH_ACCOUNT_ALREADY_CONNECTED = 'OAUTH_ACCOUNT_ALREADY_CONNECTED',
  OAUTH_STATE_EXPIRED = 'OAUTH_STATE_EXPIRED',
  OWNER_CAN_NOT_LEAVE_WORKSPACE = 'OWNER_CAN_NOT_LEAVE_WORKSPACE',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
  QUERY_TOO_LONG = 'QUERY_TOO_LONG',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED = 'REFRESH_TOKEN_REUSED',
  REPLY_NOT_FOUND = 'REPLY_NOT_FOUND',
  RESPONSE_TOO_LARGE_ERROR = 'RESPONSE_TOO_LARGE_ERROR',
  RUNTIME_CONFIG_NOT_FOUND = 'RUNTIME_CONFIG_NOT_FOUND',
  SAME_EMAIL_PROVIDED = 'SAME_EMAIL_PROVIDED',
  SAME_SUBSCRIPTION_RECURRING = 'SAME_SUBSCRIPTION_RECURRING',
  SEARCH_PROVIDER_NOT_FOUND = 'SEARCH_PROVIDER_NOT_FOUND',
  SIGN_UP_FORBIDDEN = 'SIGN_UP_FORBIDDEN',
  SPACE_ACCESS_DENIED = 'SPACE_ACCESS_DENIED',
  SPACE_NOT_FOUND = 'SPACE_NOT_FOUND',
  SPACE_OWNER_NOT_FOUND = 'SPACE_OWNER_NOT_FOUND',
  SPACE_SHOULD_HAVE_ONLY_ONE_OWNER = 'SPACE_SHOULD_HAVE_ONLY_ONE_OWNER',
  SSRF_BLOCKED_ERROR = 'SSRF_BLOCKED_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  SUBSCRIPTION_ALREADY_EXISTS = 'SUBSCRIPTION_ALREADY_EXISTS',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_HAS_BEEN_CANCELED = 'SUBSCRIPTION_HAS_BEEN_CANCELED',
  SUBSCRIPTION_HAS_NOT_BEEN_CANCELED = 'SUBSCRIPTION_HAS_NOT_BEEN_CANCELED',
  SUBSCRIPTION_NOT_EXISTS = 'SUBSCRIPTION_NOT_EXISTS',
  SUBSCRIPTION_PLAN_NOT_FOUND = 'SUBSCRIPTION_PLAN_NOT_FOUND',
  TOO_MANY_REQUEST = 'TOO_MANY_REQUEST',
  UNKNOWN_OAUTH_PROVIDER = 'UNKNOWN_OAUTH_PROVIDER',
  UNSPLASH_IS_NOT_CONFIGURED = 'UNSPLASH_IS_NOT_CONFIGURED',
  UNSUPPORTED_CLIENT_VERSION = 'UNSUPPORTED_CLIENT_VERSION',
  UNSUPPORTED_SERVER_VERSION = 'UNSUPPORTED_SERVER_VERSION',
  UNSUPPORTED_SUBSCRIPTION_PLAN = 'UNSUPPORTED_SUBSCRIPTION_PLAN',
  USER_AVATAR_NOT_FOUND = 'USER_AVATAR_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VERSION_REJECTED = 'VERSION_REJECTED',
  WORKSPACE_ID_REQUIRED_FOR_TEAM_SUBSCRIPTION = 'WORKSPACE_ID_REQUIRED_FOR_TEAM_SUBSCRIPTION',
  WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION = 'WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION',
  WORKSPACE_LICENSE_ALREADY_EXISTS = 'WORKSPACE_LICENSE_ALREADY_EXISTS',
  WORKSPACE_PERMISSION_NOT_FOUND = 'WORKSPACE_PERMISSION_NOT_FOUND',
  WRONG_SIGN_IN_CREDENTIALS = 'WRONG_SIGN_IN_CREDENTIALS',
  WRONG_SIGN_IN_METHOD = 'WRONG_SIGN_IN_METHOD',
}

export interface ExecuteOfficeCommandResultType {
  __typename?: 'ExecuteOfficeCommandResultType';
  artifact: OfficeArtifactType;
  created: Scalars['Boolean']['output'];
  revision: OfficeRevisionType;
  summary: Scalars['JSONObject']['output'];
}

export interface ExecuteOfficeDocxCommandResultType {
  __typename?: 'ExecuteOfficeDocxCommandResultType';
  artifact: OfficeArtifactType;
  created: Scalars['Boolean']['output'];
  revision: OfficeRevisionType;
  summary: Scalars['JSONObject']['output'];
}

export interface ExpectToGrantDocUserRolesDataType {
  __typename?: 'ExpectToGrantDocUserRolesDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface ExpectToRevokeDocUserRolesDataType {
  __typename?: 'ExpectToRevokeDocUserRolesDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export interface ExpectToUpdateDocUserRoleDataType {
  __typename?: 'ExpectToUpdateDocUserRoleDataType';
  docId: Scalars['String']['output'];
  spaceId: Scalars['String']['output'];
}

export enum ExternalMcpConnectionStatus {
  ACTIVE = 'ACTIVE',
  CONNECTING = 'CONNECTING',
  DEGRADED = 'DEGRADED',
  DISABLED = 'DISABLED',
  REAUTH_REQUIRED = 'REAUTH_REQUIRED',
}

export interface ExternalMcpConnectionType {
  __typename?: 'ExternalMcpConnectionType';
  createdAt: Scalars['DateTime']['output'];
  enabledToolNames: Array<Scalars['String']['output']>;
  endpoint: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastCheckedAt: Maybe<Scalars['DateTime']['output']>;
  lastConnectedAt: Maybe<Scalars['DateTime']['output']>;
  lastErrorCode: Maybe<Scalars['String']['output']>;
  lastErrorMessage: Maybe<Scalars['String']['output']>;
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  protocolVersion: Scalars['String']['output'];
  serverName: Maybe<Scalars['String']['output']>;
  serverVersion: Maybe<Scalars['String']['output']>;
  sessionFingerprint: Maybe<Scalars['String']['output']>;
  status: ExternalMcpConnectionStatus;
  toolCatalogFingerprint: Maybe<Scalars['String']['output']>;
  tools: Array<ExternalMcpToolType>;
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['String']['output'];
}

export interface ExternalMcpSettingsType {
  __typename?: 'ExternalMcpSettingsType';
  connection: Maybe<ExternalMcpConnectionType>;
  endpoint: Scalars['String']['output'];
  protocolVersion: Scalars['String']['output'];
}

export interface ExternalMcpToolCallResultType {
  __typename?: 'ExternalMcpToolCallResultType';
  result: Scalars['JSON']['output'];
  toolName: Scalars['String']['output'];
}

export interface ExternalMcpToolType {
  __typename?: 'ExternalMcpToolType';
  description: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  inputSchema: Scalars['JSON']['output'];
  name: Scalars['String']['output'];
  requiresExplicitUserRequest: Scalars['Boolean']['output'];
  risk: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
}

export enum FeatureType {
  Admin = 'Admin',
}

export interface ForkChatSessionInput {
  docId: Scalars['String']['input'];
  /** Identify a message in the array and keep it with all previous messages into a forked session. */
  latestMessageId?: InputMaybe<Scalars['String']['input']>;
  sessionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface GrantDocUserRolesInput {
  docId: Scalars['String']['input'];
  role: DocRole;
  userIds: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface GrantedDocUserType {
  __typename?: 'GrantedDocUserType';
  role: DocRole;
  user: WorkspaceUserType;
}

export interface GrantedDocUserTypeEdge {
  __typename?: 'GrantedDocUserTypeEdge';
  cursor: Scalars['String']['output'];
  node: GrantedDocUserType;
}

export interface GraphqlBadRequestDataType {
  __typename?: 'GraphqlBadRequestDataType';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
}

export interface HttpRequestErrorDataType {
  __typename?: 'HttpRequestErrorDataType';
  message: Scalars['String']['output'];
}

export interface ImageFormatNotSupportedDataType {
  __typename?: 'ImageFormatNotSupportedDataType';
  format: Scalars['String']['output'];
}

export interface ImportOfficeArtifactRequestInput {
  idempotencyKey: Scalars['String']['input'];
  sourceBlobKey: Scalars['String']['input'];
  sourceFileName: Scalars['String']['input'];
  title: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface ImportOfficeArtifactResultType {
  __typename?: 'ImportOfficeArtifactResultType';
  artifact: OfficeArtifactType;
  created: Scalars['Boolean']['output'];
  revision: OfficeRevisionType;
}

export interface ImportOfficeDocxRequestInput {
  idempotencyKey: Scalars['String']['input'];
  sourceBlobKey: Scalars['String']['input'];
  sourceFileName: Scalars['String']['input'];
  title: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface ImportOfficeDocxResultType {
  __typename?: 'ImportOfficeDocxResultType';
  artifact: OfficeArtifactType;
  created: Scalars['Boolean']['output'];
  revision: OfficeRevisionType;
}

export interface ImportUsersInput {
  users: Array<CreateUserInput>;
}

export interface InvalidAppConfigDataType {
  __typename?: 'InvalidAppConfigDataType';
  hint: Scalars['String']['output'];
  key: Scalars['String']['output'];
  module: Scalars['String']['output'];
}

export interface InvalidAppConfigInputDataType {
  __typename?: 'InvalidAppConfigInputDataType';
  message: Scalars['String']['output'];
}

export interface InvalidEmailDataType {
  __typename?: 'InvalidEmailDataType';
  email: Scalars['String']['output'];
}

export interface InvalidHistoryTimestampDataType {
  __typename?: 'InvalidHistoryTimestampDataType';
  timestamp: Scalars['String']['output'];
}

export interface InvalidIndexerInputDataType {
  __typename?: 'InvalidIndexerInputDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidLicenseToActivateDataType {
  __typename?: 'InvalidLicenseToActivateDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidLicenseUpdateParamsDataType {
  __typename?: 'InvalidLicenseUpdateParamsDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidOauthCallbackCodeDataType {
  __typename?: 'InvalidOauthCallbackCodeDataType';
  body: Scalars['String']['output'];
  status: Scalars['Int']['output'];
}

export interface InvalidOauthResponseDataType {
  __typename?: 'InvalidOauthResponseDataType';
  reason: Scalars['String']['output'];
}

export interface InvalidPasswordLengthDataType {
  __typename?: 'InvalidPasswordLengthDataType';
  max: Scalars['Int']['output'];
  min: Scalars['Int']['output'];
}

export interface InvalidRuntimeConfigTypeDataType {
  __typename?: 'InvalidRuntimeConfigTypeDataType';
  get: Scalars['String']['output'];
  key: Scalars['String']['output'];
  want: Scalars['String']['output'];
}

export interface InvalidSearchProviderRequestDataType {
  __typename?: 'InvalidSearchProviderRequestDataType';
  reason: Scalars['String']['output'];
  type: Scalars['String']['output'];
}

export interface InvitationAcceptedNotificationBodyType {
  __typename?: 'InvitationAcceptedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationBlockedNotificationBodyType {
  __typename?: 'InvitationBlockedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationNotificationBodyType {
  __typename?: 'InvitationNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationReviewApprovedNotificationBodyType {
  __typename?: 'InvitationReviewApprovedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationReviewDeclinedNotificationBodyType {
  __typename?: 'InvitationReviewDeclinedNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationReviewRequestNotificationBodyType {
  __typename?: 'InvitationReviewRequestNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  inviteId: Scalars['ID']['output'];
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface InvitationType {
  __typename?: 'InvitationType';
  /** Invitee information */
  invitee: WorkspaceUserType;
  /** Invitation status in workspace */
  status: Maybe<WorkspaceMemberStatus>;
  /** User information */
  user: WorkspaceUserType;
  /** Workspace information */
  workspace: InvitationWorkspaceType;
}

export interface InvitationWorkspaceType {
  __typename?: 'InvitationWorkspaceType';
  /** Base64 encoded avatar */
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Workspace name */
  name: Scalars['String']['output'];
}

export interface InviteLink {
  __typename?: 'InviteLink';
  /** Invite link expire time */
  expireTime: Scalars['DateTime']['output'];
  /** Invite link */
  link: Scalars['String']['output'];
}

export interface InviteResult {
  __typename?: 'InviteResult';
  email: Scalars['String']['output'];
  /** Invite error */
  error: Maybe<Scalars['JSONObject']['output']>;
  /** Invite id, null if invite record create failed */
  inviteId: Maybe<Scalars['String']['output']>;
}

export interface InviteUserType {
  __typename?: 'InviteUserType';
  /** User avatar url */
  avatarUrl: Maybe<Scalars['String']['output']>;
  /**
   * User email verified
   * @deprecated useless
   */
  createdAt: Maybe<Scalars['DateTime']['output']>;
  /** User is disabled */
  disabled: Maybe<Scalars['Boolean']['output']>;
  /** User email */
  email: Maybe<Scalars['String']['output']>;
  /** User email verified */
  emailVerified: Maybe<Scalars['Boolean']['output']>;
  /** User password has been set */
  hasPassword: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  /** Invite id */
  inviteId: Scalars['String']['output'];
  /** User name */
  name: Maybe<Scalars['String']['output']>;
  /**
   * User permission in workspace
   * @deprecated Use role instead
   */
  permission: Permission;
  /** User role in workspace */
  role: Permission;
  /** Member invite status in workspace */
  status: WorkspaceMemberStatus;
}

export enum InvoiceStatus {
  Draft = 'Draft',
  Open = 'Open',
  Paid = 'Paid',
  Uncollectible = 'Uncollectible',
  Void = 'Void',
}

export interface InvoiceType {
  __typename?: 'InvoiceType';
  amount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  lastPaymentError: Maybe<Scalars['String']['output']>;
  link: Maybe<Scalars['String']['output']>;
  /** @deprecated removed */
  plan: Maybe<SubscriptionPlan>;
  reason: Scalars['String']['output'];
  /** @deprecated removed */
  recurring: Maybe<SubscriptionRecurring>;
  status: InvoiceStatus;
  updatedAt: Scalars['DateTime']['output'];
}

export interface License {
  __typename?: 'License';
  expiredAt: Maybe<Scalars['DateTime']['output']>;
  installedAt: Scalars['DateTime']['output'];
  quantity: Scalars['Int']['output'];
  recurring: SubscriptionRecurring;
  validatedAt: Scalars['DateTime']['output'];
  variant: Maybe<SubscriptionVariant>;
}

export interface LimitedUserType {
  __typename?: 'LimitedUserType';
  /** User email */
  email: Scalars['String']['output'];
  /** User password has been set */
  hasPassword: Maybe<Scalars['Boolean']['output']>;
}

export interface LinkCalDavAccountInput {
  displayName?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
  providerPresetId: Scalars['String']['input'];
  username: Scalars['String']['input'];
}

export interface LinkCalendarAccountInput {
  provider: CalendarProviderType;
  redirectUri?: InputMaybe<Scalars['String']['input']>;
}

export interface ListUserInput {
  features?: InputMaybe<Array<FeatureType>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface ListWorkspaceInput {
  enableAi?: InputMaybe<Scalars['Boolean']['input']>;
  enableDocEmbedding?: InputMaybe<Scalars['Boolean']['input']>;
  enableSharing?: InputMaybe<Scalars['Boolean']['input']>;
  enableUrlPreview?: InputMaybe<Scalars['Boolean']['input']>;
  first?: Scalars['Int']['input'];
  keyword?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<AdminWorkspaceSort>;
  public?: InputMaybe<Scalars['Boolean']['input']>;
  skip?: Scalars['Int']['input'];
}

export interface ListedBlob {
  __typename?: 'ListedBlob';
  createdAt: Scalars['String']['output'];
  key: Scalars['String']['output'];
  mime: Scalars['String']['output'];
  size: Scalars['Int']['output'];
}

export interface ManageUserInput {
  /** User email */
  email?: InputMaybe<Scalars['String']['input']>;
  /** User name */
  name?: InputMaybe<Scalars['String']['input']>;
}

export enum McpAccessMode {
  READ_ONLY = 'READ_ONLY',
  READ_WRITE = 'READ_WRITE',
}

export enum McpCredentialStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  EXPIRING = 'EXPIRING',
  REVOKED = 'REVOKED',
  ROTATING = 'ROTATING',
}

export interface McpCredentialType {
  __typename?: 'McpCredentialType';
  accessMode: McpAccessMode;
  callbackConfigured: Scalars['Boolean']['output'];
  capabilities: Array<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Scalars['DateTime']['output'];
  fingerprint: Scalars['String']['output'];
  graceEndsAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  revokedAt: Maybe<Scalars['DateTime']['output']>;
  status: McpCredentialStatus;
  workspaceId: Scalars['String']['output'];
}

export interface MeetingActionItemType {
  __typename?: 'MeetingActionItemType';
  deadline: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  owner: Maybe<Scalars['String']['output']>;
}

export interface MeetingSummaryV2Type {
  __typename?: 'MeetingSummaryV2Type';
  actionItems: Array<MeetingActionItemType>;
  attendees: Array<Scalars['String']['output']>;
  blockers: Array<Scalars['String']['output']>;
  decisions: Array<Scalars['String']['output']>;
  durationMinutes: Scalars['Float']['output'];
  keyPoints: Array<Scalars['String']['output']>;
  openQuestions: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
}

export interface MemberNotFoundInSpaceDataType {
  __typename?: 'MemberNotFoundInSpaceDataType';
  spaceId: Scalars['String']['output'];
}

export interface MentionDocInput {
  /** The block id in the doc */
  blockId?: InputMaybe<Scalars['String']['input']>;
  /** The element id in the doc */
  elementId?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  mode: DocMode;
  title: Scalars['String']['input'];
}

export interface MentionDocType {
  __typename?: 'MentionDocType';
  blockId: Maybe<Scalars['String']['output']>;
  elementId: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  mode: DocMode;
  title: Scalars['String']['output'];
}

export interface MentionInput {
  doc: MentionDocInput;
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MentionNotificationBodyType {
  __typename?: 'MentionNotificationBodyType';
  /** The user who created the notification, maybe null when user is deleted or sent by system */
  createdByUser: Maybe<PublicUserType>;
  doc: MentionDocType;
  /** The type of the notification */
  type: NotificationType;
  workspace: Maybe<NotificationWorkspaceType>;
}

export interface MentionUserDocAccessDeniedDataType {
  __typename?: 'MentionUserDocAccessDeniedDataType';
  docId: Scalars['String']['output'];
}

export interface MissingOauthQueryParameterDataType {
  __typename?: 'MissingOauthQueryParameterDataType';
  name: Scalars['String']['output'];
}

export interface Mutation {
  __typename?: 'Mutation';
  abandonCopilotBlocker: CopilotBlockerType;
  abortBlobUpload: Scalars['Boolean']['output'];
  acceptCopilotProjectInvitation: CopilotProjectInvitationType;
  acceptInviteById: Scalars['Boolean']['output'];
  /** Acknowledge client completion telemetry for a direct object-storage support bundle download. */
  acknowledgeCopilotSupportBundleDirectDownload: CopilotSupportBundleDownloadAuthorizationType;
  activateLicense: License;
  /** add a blob to context */
  addContextBlob: CopilotContextBlob;
  /** add a category to context */
  addContextCategory: CopilotContextCategory;
  /** add a doc to context */
  addContextDoc: CopilotContextDoc;
  /** add a file to context */
  addContextFile: CopilotContextFile;
  addCopilotContextProjectDocument: CopilotContextProjectDocumentAddResultType;
  /** Update workspace embedding files */
  addWorkspaceEmbeddingFiles: CopilotWorkspaceFile;
  /** Update workspace flags for admin */
  adminUpdateWorkspace: Maybe<AdminWorkspace>;
  approveCopilotAccessRequest: CopilotAccessRequestType;
  approveMember: Scalars['Boolean']['output'];
  /** Authorize a short-lived manifest or archive artifact download for a DB-backed support bundle. */
  authorizeCopilotSupportBundleDownload: CopilotSupportBundleDownloadAuthorizationType;
  /** Ban an user */
  banUser: UserType;
  beginEnterpriseAuthorization: EnterpriseAuthorizationSessionType;
  cancelEnterpriseAuthorization: EnterpriseAuthorizationSessionType;
  cancelSubscription: SubscriptionType;
  changeEmail: UserType;
  changePassword: Scalars['Boolean']['output'];
  changeWorkspaceDirectoryPolicy: WorkspaceDirectoryPolicyMutationType;
  /** Cleanup sessions */
  cleanupCopilotSession: Array<Scalars['String']['output']>;
  /** Expire DB-backed support bundles whose retention window has elapsed and retry failed archive object cleanup. */
  cleanupCopilotSupportBundleRetention: CopilotSupportBundleRetentionCleanupType;
  clearWorkspaceByokConfigs: Scalars['Boolean']['output'];
  completeBlobUpload: Scalars['String']['output'];
  confirmCopilotBlockerSuggestion: CopilotBlockerType;
  confirmCopilotDocumentDestination: CopilotDocumentOperationType;
  connectExternalMcp: ExternalMcpConnectionType;
  /** Control a standalone persisted Agent Runtime run outside repair execution. */
  controlCopilotAgentRuntimeRun: CopilotAgentRunType;
  /** Cancel, retry, or recover a stale persisted repair execution request after workspace permission checks. */
  controlCopilotRepairExecution: CopilotRepairExecutionRecordType;
  /** Control a current-user Copilot task after workspace and actor ownership checks. */
  controlCopilotTask: CopilotTaskType;
  createBlobUpload: BlobUploadInit;
  /** Create change password url */
  createChangePasswordUrl: Scalars['String']['output'];
  /** Create a subscription checkout link of stripe */
  createCheckoutSession: Scalars['String']['output'];
  createComment: CommentObjectType;
  createCopilotBlocker: CopilotBlockerType;
  /** Create a context session */
  createCopilotContext: Scalars['String']['output'];
  createCopilotContextMemory: CopilotContextMemoryType;
  createCopilotContextPolicy: CopilotContextPolicyType;
  createCopilotContextProject: CopilotContextProjectType;
  createCopilotContextRule: CopilotContextRuleType;
  /** Create a chat message */
  createCopilotMessage: Scalars['String']['output'];
  /**
   * Create a chat session
   * @deprecated use `createCopilotSessionWithHistory` instead
   */
  createCopilotSession: Scalars['String']['output'];
  /** Create a chat session and return full session payload */
  createCopilotSessionWithHistory: CopilotHistories;
  /** Create a DB-backed support bundle request with a minimal persisted manifest. */
  createCopilotSupportBundle: CopilotSupportBundleType;
  /** Create a stripe customer portal to manage payment methods */
  createCustomerPortal: Scalars['String']['output'];
  createEnterpriseConnection: EnterpriseConnectionType;
  createInviteLink: InviteLink;
  createMcpCredential: RevealedMcpCredentialType;
  createOfficeComment: OfficeCommentType;
  createOfficeCommentReply: OfficeCommentReplyType;
  createReply: ReplyObjectType;
  createSelfhostWorkspaceCustomerPortal: Scalars['String']['output'];
  createSparkClawPairing: SparkClawPairingType;
  /** Create a new user */
  createUser: UserType;
  /** Create a new workspace */
  createWorkspace: WorkspaceType;
  deactivateLicense: Scalars['Boolean']['output'];
  /** Approve or reject a persisted repair execution request that is waiting for approval. */
  decideCopilotRepairExecutionApproval: CopilotRepairExecutionRecordType;
  declineCopilotProjectInvitation: CopilotProjectInvitationType;
  deleteAccount: DeleteAccount;
  deleteAdminAiProfile: Scalars['Boolean']['output'];
  deleteAuthSigningKey: Array<AuthSigningKeyType>;
  deleteBlob: Scalars['Boolean']['output'];
  /** Delete a comment */
  deleteComment: Scalars['Boolean']['output'];
  deleteCopilotContextMemory: Scalars['Boolean']['output'];
  deleteCopilotContextPolicy: Scalars['Boolean']['output'];
  deleteCopilotContextProject: Scalars['Boolean']['output'];
  deleteCopilotContextRule: Scalars['Boolean']['output'];
  deleteEnterpriseConnection: Scalars['Boolean']['output'];
  deleteExternalMcp: Scalars['Boolean']['output'];
  deleteOfficeComment: Scalars['Boolean']['output'];
  deleteOfficeCommentReply: Scalars['Boolean']['output'];
  /** Delete a reply */
  deleteReply: Scalars['Boolean']['output'];
  /** Delete a user account */
  deleteUser: DeleteAccount;
  deleteWorkspace: Scalars['Boolean']['output'];
  deleteWorkspaceByokConfig: Scalars['Boolean']['output'];
  disableEnterpriseConnection: EnterpriseConnectionType;
  disableExternalMcp: ExternalMcpConnectionType;
  disconnectSparkClawEndpoint: Scalars['Boolean']['output'];
  /** delete a notification from the current user inbox */
  dismissNotification: Scalars['Boolean']['output'];
  /** delete all read notifications from the current user inbox */
  dismissReadNotifications: Scalars['Boolean']['output'];
  /** Reenable an banned user */
  enableUser: UserType;
  /** Execute and persist a native Docs, Sheets, Slides, or PDF user command */
  executeOfficeCommand: ExecuteOfficeCommandResultType;
  /** Execute and persist a native DOCX user command */
  executeOfficeDocxCommand: ExecuteOfficeDocxCommandResultType;
  /** Create a chat session */
  forkCopilotSession: Scalars['String']['output'];
  generateLicenseKey: Scalars['String']['output'];
  grantCommercialEntitlement: Scalars['Boolean']['output'];
  grantDocUserRoles: Scalars['Boolean']['output'];
  grantMember: Scalars['Boolean']['output'];
  /** Import a completed workspace DOCX, XLSX, PPTX, or PDF blob as a native resource */
  importOfficeArtifact: ImportOfficeArtifactResultType;
  /** Import a completed workspace DOCX blob as a native resource */
  importOfficeDocx: ImportOfficeDocxResultType;
  /** import users */
  importUsers: Array<UserImportResultType>;
  installLicense: License;
  inviteMembers: Array<InviteResult>;
  leaveCopilotContextProject: Scalars['Boolean']['output'];
  leaveWorkspace: Scalars['Boolean']['output'];
  linkCalDAVAccount: CalendarAccountObjectType;
  linkCalendarAccount: Scalars['String']['output'];
  /** mention user in a doc */
  mentionUser: Scalars['ID']['output'];
  mutateWorkspaceDirectory: WorkspaceDirectoryMutationType;
  /** Preview a Prompt Registry message body edit and return a publishable diff fingerprint before writing. */
  previewCopilotPromptRegistryBodyEdit: CopilotPromptRegistryBodyEditPreviewType;
  previewLicense: AdminLicensePreview;
  /** Publish a workspace-scoped DB-backed model definition revision for an existing configured provider. */
  publishCopilotModelRegistryRevision: CopilotModelRegistryRevisionType;
  /** Publish a Prompt Registry message body edit after a matching diff preview fingerprint. */
  publishCopilotPromptRegistryBodyEdit: CopilotPromptRegistryBodyEditPublishType;
  /** Publish a workspace-scoped DB-backed prompt registry revision after publish-gate and route-readiness checks. */
  publishCopilotPromptRegistryRevision: CopilotPromptRegistryRevisionType;
  /** Publish a workspace-scoped DB-backed provider profile metadata revision for an existing configured provider. */
  publishCopilotProviderRegistryRevision: CopilotProviderRegistryRevisionType;
  /** Publish a workspace-scoped DB-backed task route policy revision for embedding, workspace indexing, or rerank model selection. */
  publishCopilotTaskRoutePolicyRevision: CopilotTaskRoutePolicyRevisionType;
  publishDoc: DocType;
  /** queue workspace doc embedding */
  queueWorkspaceEmbedding: Scalars['Boolean']['output'];
  reRequestCopilotProjectDocumentAccess: CopilotAccessRequestType;
  /** mark all notifications as read */
  readAllNotifications: Scalars['Boolean']['output'];
  /** mark notification as read */
  readNotification: Scalars['Boolean']['output'];
  /** Persist a workspace-scoped provider health state for an existing configured provider. */
  recordCopilotProviderHealthState: CopilotProviderHealthStateType;
  recoverDoc: Scalars['DateTime']['output'];
  refreshEnterpriseConnection: EnterpriseConnectionType;
  refreshExternalMcpTools: ExternalMcpConnectionType;
  /** Refresh current user subscriptions and return latest. */
  refreshUserSubscriptions: Array<SubscriptionType>;
  rejectCopilotAccessRequest: CopilotAccessRequestType;
  releaseDeletedBlobs: Scalars['Boolean']['output'];
  /** Remove user avatar */
  removeAvatar: RemoveAvatar;
  /** remove a blob from context */
  removeContextBlob: Scalars['Boolean']['output'];
  /** remove a category from context */
  removeContextCategory: Scalars['Boolean']['output'];
  /** remove a doc from context */
  removeContextDoc: Scalars['Boolean']['output'];
  /** remove a file from context */
  removeContextFile: Scalars['Boolean']['output'];
  removeCopilotContextProjectDocument: CopilotContextProjectType;
  removeCopilotContextProjectMember: Scalars['Boolean']['output'];
  /** Remove workspace embedding files */
  removeWorkspaceEmbeddingFiles: Scalars['Boolean']['output'];
  reorderWorkspaceByokConfigs: Array<WorkspaceByokKeyConfigType>;
  /** Queue a fresh replay for a dead-lettered support bundle transfer forwarding event without mutating terminal evidence. */
  replayCopilotSupportBundleTransferForwardingEvent: CopilotSupportBundleTransferForwardingEventType;
  /** Request to apply the subscription in advance */
  requestApplySubscription: Array<SubscriptionType>;
  /** Request an approval-gated Agent Runtime office task that updates one workspace document after approval. */
  requestCopilotAgentRuntimeDocUpdate: CopilotAgentRunType;
  /** Preview and persist one native Office AI command as an immutable approval-gated Agent Runtime task. */
  requestCopilotAgentRuntimeOfficeCommand: CopilotAgentRunType;
  requestCopilotDocumentAccess: CopilotAccessRequestType;
  /** Request prompt registry repair execution. Approval-gated requests can publish a DB-backed workspace prompt registry revision after approval. */
  requestCopilotPromptRegistryRepairExecution: CopilotPromptRegistryRepairExecutionRequestType;
  /** Resolve a comment or not */
  resolveComment: Scalars['Boolean']['output'];
  resolveCopilotBlocker: CopilotBlockerType;
  resolveOfficeComment: OfficeCommentType;
  resumeSubscription: SubscriptionType;
  retryCopilotDocumentOperation: CopilotDocumentOperationType;
  /** Queue a fresh Provider Health probe attempt for a dead-lettered workspace attempt without mutating terminal evidence. */
  retryCopilotProviderHealthProbeAttempt: CopilotProviderHealthProbeAttemptType;
  retryTranscriptTask: Maybe<TranscriptionResultType>;
  revokeCommercialEntitlement: Scalars['Boolean']['output'];
  revokeCopilotProjectGrant: CopilotProjectGrantRevocationType;
  revokeDocUserRoles: Scalars['Boolean']['output'];
  revokeInviteLink: Scalars['Boolean']['output'];
  revokeMcpCredential: Scalars['Boolean']['output'];
  revokeMember: Scalars['Boolean']['output'];
  revokePublicDoc: DocType;
  rollbackCopilotContextPolicy: CopilotContextPolicyType;
  rollbackCopilotContextRule: CopilotContextRuleType;
  rotateAuthSigningKey: Array<AuthSigningKeyType>;
  rotateMcpCredential: RevealedMcpCredentialType;
  sendChangeEmail: Scalars['Boolean']['output'];
  sendChangePasswordEmail: Scalars['Boolean']['output'];
  sendCopilotProjectInvitation: CopilotProjectInvitationType;
  sendSetPasswordEmail: Scalars['Boolean']['output'];
  sendTestEmail: Scalars['Boolean']['output'];
  sendVerifyChangeEmail: Scalars['Boolean']['output'];
  sendVerifyEmail: Scalars['Boolean']['output'];
  setAdminUserAiProfileAssignment: Maybe<AdminUserAiProfileAssignmentType>;
  setBlob: Scalars['String']['output'];
  setCopilotContextProjectAiPolicy: CopilotProjectAiPolicyType;
  settleTranscriptTask: Maybe<TranscriptionResultType>;
  submitTranscriptTask: Maybe<TranscriptionResultType>;
  testExternalMcpConversation: ExternalMcpToolCallResultType;
  testWorkspaceByokConfig: TestWorkspaceByokConfigResultType;
  transferCopilotContextProjectOwnership: Scalars['Boolean']['output'];
  undoCopilotContextMemoryEvent: CopilotContextMemoryEventType;
  unlinkCalendarAccount: Scalars['Boolean']['output'];
  /** update app configuration */
  updateAppConfig: Scalars['JSONObject']['output'];
  updateCalendarAccount: Maybe<CalendarAccountObjectType>;
  /** Update a comment content */
  updateComment: Scalars['Boolean']['output'];
  updateCopilotContextMemory: CopilotContextMemoryType;
  updateCopilotContextPolicy: CopilotContextPolicyType;
  updateCopilotContextProject: CopilotContextProjectType;
  updateCopilotContextProjectDocument: CopilotContextProjectType;
  updateCopilotContextRule: CopilotContextRuleType;
  updateCopilotContextSettings: CopilotContextSettingsType;
  /** Update a chat session */
  updateCopilotSession: Scalars['String']['output'];
  updateDocDefaultRole: Scalars['Boolean']['output'];
  updateDocUserRole: Scalars['Boolean']['output'];
  updateEnterpriseToolAllowlist: EnterpriseConnectionType;
  updateExternalMcpToolAllowlist: ExternalMcpConnectionType;
  updateOfficeComment: OfficeCommentType;
  updateOfficeCommentReply: OfficeCommentReplyType;
  updateProfile: UserType;
  /** Update a reply content */
  updateReply: Scalars['Boolean']['output'];
  /** Update user settings */
  updateSettings: Scalars['Boolean']['output'];
  updateSubscriptionRecurring: SubscriptionType;
  /** Update an user */
  updateUser: UserType;
  /** update user enabled feature */
  updateUserFeatures: Array<FeatureType>;
  /** Update workspace */
  updateWorkspace: WorkspaceType;
  updateWorkspaceCalendars: WorkspaceCalendarObjectType;
  /** Update ignored docs */
  updateWorkspaceEmbeddingIgnoredDocs: Scalars['Int']['output'];
  /** Upload user avatar */
  uploadAvatar: UserType;
  /** Upload a comment attachment and return the access url */
  uploadCommentAttachment: Scalars['String']['output'];
  upsertAdminAiProfile: AdminAiProfileType;
  upsertWorkspaceByokConfig: WorkspaceByokKeyConfigType;
  verifyEmail: Scalars['Boolean']['output'];
  withdrawCopilotAccessRequest: CopilotAccessRequestType;
  withdrawCopilotDocumentOperation: CopilotDocumentOperationType;
  withdrawCopilotProjectInvitation: CopilotProjectInvitationType;
}

export interface MutationAbandonCopilotBlockerArgs {
  blockerId: Scalars['ID']['input'];
}

export interface MutationAbortBlobUploadArgs {
  docScopeId?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  uploadId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAcceptCopilotProjectInvitationArgs {
  invitationId: Scalars['ID']['input'];
}

export interface MutationAcceptInviteByIdArgs {
  inviteId: Scalars['String']['input'];
  sendAcceptMail?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationAcknowledgeCopilotSupportBundleDirectDownloadArgs {
  input: CopilotSupportBundleDirectDownloadAcknowledgeInput;
}

export interface MutationActivateLicenseArgs {
  license: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAddContextBlobArgs {
  options: AddContextBlobInput;
}

export interface MutationAddContextCategoryArgs {
  options: AddContextCategoryInput;
}

export interface MutationAddContextDocArgs {
  options: AddContextDocInput;
}

export interface MutationAddContextFileArgs {
  content: Scalars['Upload']['input'];
  options: AddContextFileInput;
}

export interface MutationAddCopilotContextProjectDocumentArgs {
  input: AddCopilotContextProjectDocumentInput;
}

export interface MutationAddWorkspaceEmbeddingFilesArgs {
  blob: Scalars['Upload']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAdminUpdateWorkspaceArgs {
  input: AdminUpdateWorkspaceInput;
}

export interface MutationApproveCopilotAccessRequestArgs {
  input: ResolveCopilotAccessRequestInput;
}

export interface MutationApproveMemberArgs {
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationAuthorizeCopilotSupportBundleDownloadArgs {
  input: CopilotSupportBundleDownloadAuthorizeInput;
}

export interface MutationBanUserArgs {
  id: Scalars['String']['input'];
}

export interface MutationBeginEnterpriseAuthorizationArgs {
  connectionId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationCancelEnterpriseAuthorizationArgs {
  sessionId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationCancelSubscriptionArgs {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationChangeEmailArgs {
  email: Scalars['String']['input'];
  token: Scalars['String']['input'];
}

export interface MutationChangePasswordArgs {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationChangeWorkspaceDirectoryPolicyArgs {
  directoryId: Scalars['ID']['input'];
  expectedRevision: Scalars['String']['input'];
  principalId: Scalars['ID']['input'];
  rights?: InputMaybe<WorkspaceDirectoryRightsInput>;
  workspaceId: Scalars['ID']['input'];
}

export interface MutationCleanupCopilotSessionArgs {
  options: DeleteSessionInput;
}

export interface MutationCleanupCopilotSupportBundleRetentionArgs {
  input: CopilotSupportBundleRetentionCleanupInput;
}

export interface MutationClearWorkspaceByokConfigsArgs {
  provider?: InputMaybe<ByokProvider>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCompleteBlobUploadArgs {
  docScopeId?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  parts?: InputMaybe<Array<BlobUploadPartInput>>;
  uploadId?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationConfirmCopilotBlockerSuggestionArgs {
  input: ConfirmCopilotBlockerSuggestionInput;
}

export interface MutationConfirmCopilotDocumentDestinationArgs {
  input: ConfirmCopilotDocumentDestinationInput;
}

export interface MutationConnectExternalMcpArgs {
  input: ConnectExternalMcpInput;
}

export interface MutationControlCopilotAgentRuntimeRunArgs {
  input: CopilotAgentRuntimeControlInput;
}

export interface MutationControlCopilotRepairExecutionArgs {
  input: CopilotRepairExecutionControlInput;
}

export interface MutationControlCopilotTaskArgs {
  input: CopilotTaskControlInput;
}

export interface MutationCreateBlobUploadArgs {
  docScopeId?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  mime: Scalars['String']['input'];
  size: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateChangePasswordUrlArgs {
  callbackUrl: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}

export interface MutationCreateCheckoutSessionArgs {
  input: CreateCheckoutSessionInput;
}

export interface MutationCreateCommentArgs {
  input: CommentCreateInput;
}

export interface MutationCreateCopilotBlockerArgs {
  input: CreateCopilotBlockerInput;
}

export interface MutationCreateCopilotContextArgs {
  sessionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateCopilotContextMemoryArgs {
  input: CreateCopilotContextMemoryInput;
}

export interface MutationCreateCopilotContextPolicyArgs {
  input: CreateCopilotContextPolicyInput;
}

export interface MutationCreateCopilotContextProjectArgs {
  input: CreateCopilotContextProjectInput;
}

export interface MutationCreateCopilotContextRuleArgs {
  input: CreateCopilotContextRuleInput;
}

export interface MutationCreateCopilotMessageArgs {
  options: CreateChatMessageInput;
}

export interface MutationCreateCopilotSessionArgs {
  options: CreateChatSessionInput;
}

export interface MutationCreateCopilotSessionWithHistoryArgs {
  options: CreateChatSessionInput;
}

export interface MutationCreateCopilotSupportBundleArgs {
  input: CopilotSupportBundleCreateInput;
}

export interface MutationCreateEnterpriseConnectionArgs {
  input: CreateEnterpriseConnectionInput;
}

export interface MutationCreateInviteLinkArgs {
  expireTime: WorkspaceInviteLinkExpireTime;
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateMcpCredentialArgs {
  input: CreateMcpCredentialInput;
}

export interface MutationCreateOfficeCommentArgs {
  input: OfficeCommentCreateInput;
}

export interface MutationCreateOfficeCommentReplyArgs {
  input: OfficeCommentReplyCreateInput;
}

export interface MutationCreateReplyArgs {
  input: ReplyCreateInput;
}

export interface MutationCreateSelfhostWorkspaceCustomerPortalArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationCreateUserArgs {
  input: CreateUserInput;
}

export interface MutationCreateWorkspaceArgs {
  init?: InputMaybe<Scalars['Upload']['input']>;
}

export interface MutationDeactivateLicenseArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDecideCopilotRepairExecutionApprovalArgs {
  input: CopilotRepairExecutionApprovalDecisionInput;
}

export interface MutationDeclineCopilotProjectInvitationArgs {
  invitationId: Scalars['ID']['input'];
}

export interface MutationDeleteAdminAiProfileArgs {
  id: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationDeleteAuthSigningKeyArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteBlobArgs {
  hash?: InputMaybe<Scalars['String']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  permanently?: Scalars['Boolean']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDeleteCommentArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteCopilotContextMemoryArgs {
  id: Scalars['ID']['input'];
}

export interface MutationDeleteCopilotContextPolicyArgs {
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDeleteCopilotContextProjectArgs {
  id: Scalars['ID']['input'];
}

export interface MutationDeleteCopilotContextRuleArgs {
  id: Scalars['ID']['input'];
}

export interface MutationDeleteEnterpriseConnectionArgs {
  connectionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDeleteExternalMcpArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDeleteOfficeCommentArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteOfficeCommentReplyArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteReplyArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteUserArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteWorkspaceArgs {
  id: Scalars['String']['input'];
}

export interface MutationDeleteWorkspaceByokConfigArgs {
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisableEnterpriseConnectionArgs {
  connectionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisableExternalMcpArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationDisconnectSparkClawEndpointArgs {
  endpointId: Scalars['ID']['input'];
}

export interface MutationDismissNotificationArgs {
  id: Scalars['String']['input'];
}

export interface MutationEnableUserArgs {
  id: Scalars['String']['input'];
}

export interface MutationExecuteOfficeCommandArgs {
  input: OfficeCommandInput;
}

export interface MutationExecuteOfficeDocxCommandArgs {
  input: OfficeDocxCommandInput;
}

export interface MutationForkCopilotSessionArgs {
  options: ForkChatSessionInput;
}

export interface MutationGenerateLicenseKeyArgs {
  sessionId: Scalars['String']['input'];
}

export interface MutationGrantCommercialEntitlementArgs {
  plan: Scalars['String']['input'];
  quantity?: InputMaybe<Scalars['Int']['input']>;
  targetId: Scalars['String']['input'];
  targetType: Scalars['String']['input'];
}

export interface MutationGrantDocUserRolesArgs {
  input: GrantDocUserRolesInput;
}

export interface MutationGrantMemberArgs {
  permission: Permission;
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationImportOfficeArtifactArgs {
  input: ImportOfficeArtifactRequestInput;
}

export interface MutationImportOfficeDocxArgs {
  input: ImportOfficeDocxRequestInput;
}

export interface MutationImportUsersArgs {
  input: ImportUsersInput;
}

export interface MutationInstallLicenseArgs {
  license: Scalars['Upload']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationInviteMembersArgs {
  emails: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationLeaveCopilotContextProjectArgs {
  projectId: Scalars['ID']['input'];
}

export interface MutationLeaveWorkspaceArgs {
  sendLeaveMail?: InputMaybe<Scalars['Boolean']['input']>;
  workspaceId: Scalars['String']['input'];
  workspaceName?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationLinkCalDavAccountArgs {
  input: LinkCalDavAccountInput;
}

export interface MutationLinkCalendarAccountArgs {
  input: LinkCalendarAccountInput;
}

export interface MutationMentionUserArgs {
  input: MentionInput;
}

export interface MutationMutateWorkspaceDirectoryArgs {
  changes: Array<WorkspaceDirectoryChangeInput>;
  expectedRevision: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface MutationPreviewCopilotPromptRegistryBodyEditArgs {
  input: CopilotPromptRegistryBodyEditPreviewInput;
}

export interface MutationPreviewLicenseArgs {
  license: Scalars['Upload']['input'];
}

export interface MutationPublishCopilotModelRegistryRevisionArgs {
  input: CopilotModelRegistryPublishInput;
}

export interface MutationPublishCopilotPromptRegistryBodyEditArgs {
  input: CopilotPromptRegistryBodyEditPublishInput;
}

export interface MutationPublishCopilotPromptRegistryRevisionArgs {
  input: CopilotPromptRegistryPublishInput;
}

export interface MutationPublishCopilotProviderRegistryRevisionArgs {
  input: CopilotProviderRegistryPublishInput;
}

export interface MutationPublishCopilotTaskRoutePolicyRevisionArgs {
  input: CopilotTaskRoutePolicyPublishInput;
}

export interface MutationPublishDocArgs {
  docId: Scalars['String']['input'];
  mode?: InputMaybe<PublicDocMode>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationQueueWorkspaceEmbeddingArgs {
  docId: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationReRequestCopilotProjectDocumentAccessArgs {
  input: ReRequestCopilotProjectDocumentInput;
}

export interface MutationReadNotificationArgs {
  id: Scalars['String']['input'];
}

export interface MutationRecordCopilotProviderHealthStateArgs {
  input: CopilotProviderHealthStateRecordInput;
}

export interface MutationRecoverDocArgs {
  guid: Scalars['String']['input'];
  timestamp: Scalars['DateTime']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRefreshEnterpriseConnectionArgs {
  connectionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRefreshExternalMcpToolsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationRejectCopilotAccessRequestArgs {
  input: ResolveCopilotAccessRequestInput;
}

export interface MutationReleaseDeletedBlobsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationRemoveContextBlobArgs {
  options: RemoveContextBlobInput;
}

export interface MutationRemoveContextCategoryArgs {
  options: RemoveContextCategoryInput;
}

export interface MutationRemoveContextDocArgs {
  options: RemoveContextDocInput;
}

export interface MutationRemoveContextFileArgs {
  options: RemoveContextFileInput;
}

export interface MutationRemoveCopilotContextProjectDocumentArgs {
  input: RemoveCopilotContextProjectDocumentInput;
}

export interface MutationRemoveCopilotContextProjectMemberArgs {
  input: RemoveCopilotProjectMemberInput;
}

export interface MutationRemoveWorkspaceEmbeddingFilesArgs {
  fileId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationReorderWorkspaceByokConfigsArgs {
  input: ReorderWorkspaceByokConfigsInput;
}

export interface MutationReplayCopilotSupportBundleTransferForwardingEventArgs {
  input: CopilotSupportBundleTransferForwardingReplayInput;
}

export interface MutationRequestApplySubscriptionArgs {
  transactionId: Scalars['String']['input'];
}

export interface MutationRequestCopilotAgentRuntimeDocUpdateArgs {
  input: CopilotAgentRuntimeDocUpdateRequestInput;
}

export interface MutationRequestCopilotAgentRuntimeOfficeCommandArgs {
  input: CopilotAgentRuntimeOfficeCommandRequestInput;
}

export interface MutationRequestCopilotDocumentAccessArgs {
  input: RequestCopilotDocumentAccessInput;
}

export interface MutationRequestCopilotPromptRegistryRepairExecutionArgs {
  input: CopilotPromptRegistryRepairExecutionRequestInput;
}

export interface MutationResolveCommentArgs {
  input: CommentResolveInput;
}

export interface MutationResolveCopilotBlockerArgs {
  blockerId: Scalars['ID']['input'];
}

export interface MutationResolveOfficeCommentArgs {
  input: OfficeCommentResolveInput;
}

export interface MutationResumeSubscriptionArgs {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationRetryCopilotDocumentOperationArgs {
  expectedRevision: Scalars['Int']['input'];
  operationId: Scalars['ID']['input'];
}

export interface MutationRetryCopilotProviderHealthProbeAttemptArgs {
  input: CopilotProviderHealthProbeAttemptRetryInput;
}

export interface MutationRetryTranscriptTaskArgs {
  taskId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokeCommercialEntitlementArgs {
  targetId: Scalars['String']['input'];
  targetType: Scalars['String']['input'];
}

export interface MutationRevokeCopilotProjectGrantArgs {
  input: RevokeCopilotProjectGrantInput;
}

export interface MutationRevokeDocUserRolesArgs {
  input: RevokeDocUserRoleInput;
}

export interface MutationRevokeInviteLinkArgs {
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokeMcpCredentialArgs {
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokeMemberArgs {
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRevokePublicDocArgs {
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRollbackCopilotContextPolicyArgs {
  id: Scalars['ID']['input'];
  revision: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationRollbackCopilotContextRuleArgs {
  id: Scalars['ID']['input'];
  revision: Scalars['Int']['input'];
}

export interface MutationRotateAuthSigningKeyArgs {
  expectedActiveKeyId: Scalars['String']['input'];
}

export interface MutationRotateMcpCredentialArgs {
  expirationDays?: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationSendChangeEmailArgs {
  callbackUrl: Scalars['String']['input'];
}

export interface MutationSendChangePasswordEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationSendCopilotProjectInvitationArgs {
  input: SendCopilotProjectInvitationInput;
}

export interface MutationSendSetPasswordEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationSendTestEmailArgs {
  config: Scalars['JSONObject']['input'];
}

export interface MutationSendVerifyChangeEmailArgs {
  callbackUrl: Scalars['String']['input'];
  email: Scalars['String']['input'];
  token: Scalars['String']['input'];
}

export interface MutationSendVerifyEmailArgs {
  callbackUrl: Scalars['String']['input'];
}

export interface MutationSetAdminUserAiProfileAssignmentArgs {
  profileId?: InputMaybe<Scalars['ID']['input']>;
  userId: Scalars['ID']['input'];
}

export interface MutationSetBlobArgs {
  blob: Scalars['Upload']['input'];
  docScopeId?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationSetCopilotContextProjectAiPolicyArgs {
  input: SetCopilotProjectAiPolicyInput;
}

export interface MutationSettleTranscriptTaskArgs {
  taskId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationSubmitTranscriptTaskArgs {
  blob?: InputMaybe<Scalars['Upload']['input']>;
  blobId: Scalars['String']['input'];
  blobs?: InputMaybe<Array<Scalars['Upload']['input']>>;
  input?: InputMaybe<SubmitAudioTranscriptionInput>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationTestExternalMcpConversationArgs {
  query: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationTestWorkspaceByokConfigArgs {
  input: TestWorkspaceByokConfigInput;
}

export interface MutationTransferCopilotContextProjectOwnershipArgs {
  input: TransferCopilotProjectOwnershipInput;
}

export interface MutationUndoCopilotContextMemoryEventArgs {
  eventId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationUnlinkCalendarAccountArgs {
  accountId: Scalars['String']['input'];
}

export interface MutationUpdateAppConfigArgs {
  updates: Array<UpdateAppConfigInput>;
}

export interface MutationUpdateCalendarAccountArgs {
  accountId: Scalars['String']['input'];
  refreshIntervalMinutes: Scalars['Int']['input'];
}

export interface MutationUpdateCommentArgs {
  input: CommentUpdateInput;
}

export interface MutationUpdateCopilotContextMemoryArgs {
  input: UpdateCopilotContextMemoryInput;
}

export interface MutationUpdateCopilotContextPolicyArgs {
  input: UpdateCopilotContextPolicyInput;
}

export interface MutationUpdateCopilotContextProjectArgs {
  input: UpdateCopilotContextProjectInput;
}

export interface MutationUpdateCopilotContextProjectDocumentArgs {
  input: UpdateCopilotContextProjectDocumentInput;
}

export interface MutationUpdateCopilotContextRuleArgs {
  input: UpdateCopilotContextRuleInput;
}

export interface MutationUpdateCopilotContextSettingsArgs {
  input: UpdateCopilotContextSettingsInput;
}

export interface MutationUpdateCopilotSessionArgs {
  options: UpdateChatSessionInput;
}

export interface MutationUpdateDocDefaultRoleArgs {
  input: UpdateDocDefaultRoleInput;
}

export interface MutationUpdateDocUserRoleArgs {
  input: UpdateDocUserRoleInput;
}

export interface MutationUpdateEnterpriseToolAllowlistArgs {
  connectionId: Scalars['String']['input'];
  enabledToolNames: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationUpdateExternalMcpToolAllowlistArgs {
  enabledToolNames: Array<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationUpdateOfficeCommentArgs {
  input: OfficeCommentUpdateInput;
}

export interface MutationUpdateOfficeCommentReplyArgs {
  input: OfficeCommentReplyUpdateInput;
}

export interface MutationUpdateProfileArgs {
  input: UpdateUserInput;
}

export interface MutationUpdateReplyArgs {
  input: ReplyUpdateInput;
}

export interface MutationUpdateSettingsArgs {
  input: UpdateUserSettingsInput;
}

export interface MutationUpdateSubscriptionRecurringArgs {
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  plan?: InputMaybe<SubscriptionPlan>;
  recurring: SubscriptionRecurring;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface MutationUpdateUserArgs {
  id: Scalars['String']['input'];
  input: ManageUserInput;
}

export interface MutationUpdateUserFeaturesArgs {
  features: Array<FeatureType>;
  id: Scalars['String']['input'];
}

export interface MutationUpdateWorkspaceArgs {
  input: UpdateWorkspaceInput;
}

export interface MutationUpdateWorkspaceCalendarsArgs {
  input: UpdateWorkspaceCalendarsInput;
}

export interface MutationUpdateWorkspaceEmbeddingIgnoredDocsArgs {
  add?: InputMaybe<Array<Scalars['String']['input']>>;
  remove?: InputMaybe<Array<Scalars['String']['input']>>;
  workspaceId: Scalars['String']['input'];
}

export interface MutationUploadAvatarArgs {
  avatar: Scalars['Upload']['input'];
}

export interface MutationUploadCommentAttachmentArgs {
  attachment: Scalars['Upload']['input'];
  docId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface MutationUpsertAdminAiProfileArgs {
  input: UpsertAdminAiProfileInput;
}

export interface MutationUpsertWorkspaceByokConfigArgs {
  input: UpsertWorkspaceByokConfigInput;
}

export interface MutationVerifyEmailArgs {
  token: Scalars['String']['input'];
}

export interface MutationWithdrawCopilotAccessRequestArgs {
  input: ResolveCopilotAccessRequestInput;
}

export interface MutationWithdrawCopilotDocumentOperationArgs {
  expectedRevision: Scalars['Int']['input'];
  operationId: Scalars['ID']['input'];
}

export interface MutationWithdrawCopilotProjectInvitationArgs {
  invitationId: Scalars['ID']['input'];
}

export interface NoCopilotProviderAvailableDataType {
  __typename?: 'NoCopilotProviderAvailableDataType';
  modelId: Scalars['String']['output'];
}

export interface NoMoreSeatDataType {
  __typename?: 'NoMoreSeatDataType';
  spaceId: Scalars['String']['output'];
}

export interface NormalizedTranscriptSegmentType {
  __typename?: 'NormalizedTranscriptSegmentType';
  end: Scalars['String']['output'];
  endSec: Scalars['Float']['output'];
  speaker: Scalars['String']['output'];
  start: Scalars['String']['output'];
  startSec: Scalars['Float']['output'];
  text: Scalars['String']['output'];
}

export interface NotInSpaceDataType {
  __typename?: 'NotInSpaceDataType';
  spaceId: Scalars['String']['output'];
}

/** Notification level */
export enum NotificationLevel {
  Default = 'Default',
  High = 'High',
  Low = 'Low',
  Min = 'Min',
  None = 'None',
}

export interface NotificationObjectType {
  __typename?: 'NotificationObjectType';
  /** Just a placeholder to export UnionNotificationBodyType, don't use it */
  _placeholderForUnionNotificationBodyType: UnionNotificationBodyType;
  /** The body of the notification, different types have different fields, see UnionNotificationBodyType */
  body: Scalars['JSONObject']['output'];
  /** The created at time of the notification */
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** The level of the notification */
  level: NotificationLevel;
  /** Whether the notification has been read */
  read: Scalars['Boolean']['output'];
  /** The type of the notification */
  type: NotificationType;
  /** The updated at time of the notification */
  updatedAt: Scalars['DateTime']['output'];
}

export interface NotificationObjectTypeEdge {
  __typename?: 'NotificationObjectTypeEdge';
  cursor: Scalars['String']['output'];
  node: NotificationObjectType;
}

/** Notification type */
export enum NotificationType {
  AccessRequest = 'AccessRequest',
  AccessRequestResolved = 'AccessRequestResolved',
  Comment = 'Comment',
  CommentMention = 'CommentMention',
  Invitation = 'Invitation',
  InvitationAccepted = 'InvitationAccepted',
  InvitationBlocked = 'InvitationBlocked',
  InvitationRejected = 'InvitationRejected',
  InvitationReviewApproved = 'InvitationReviewApproved',
  InvitationReviewDeclined = 'InvitationReviewDeclined',
  InvitationReviewRequest = 'InvitationReviewRequest',
  Mention = 'Mention',
}

export interface NotificationWorkspaceType {
  __typename?: 'NotificationWorkspaceType';
  /** Workspace avatar url */
  avatarUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Workspace name */
  name: Scalars['String']['output'];
}

export enum OAuthProviderType {
  Apple = 'Apple',
  GitHub = 'GitHub',
  Google = 'Google',
  OIDC = 'OIDC',
}

/** Native LocalMind Office resource kind */
export enum OfficeArtifactKind {
  document = 'document',
  pdf = 'pdf',
  presentation = 'presentation',
  workbook = 'workbook',
}

export interface OfficeArtifactType {
  __typename?: 'OfficeArtifactType';
  compatibility: Scalars['JSONObject']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdBy: Scalars['ID']['output'];
  currentRevision: OfficeRevisionType;
  id: Scalars['ID']['output'];
  kind: OfficeArtifactKind;
  revisionCounter: Scalars['SafeInt']['output'];
  sourceByteSize: Scalars['SafeInt']['output'];
  sourceFileName: Scalars['String']['output'];
  sourceFingerprint: Scalars['String']['output'];
  sourceMimeType: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  workspaceId: Scalars['ID']['output'];
}

export interface OfficeCommandInput {
  command: Scalars['JSON']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface OfficeCommandPreviewType {
  __typename?: 'OfficeCommandPreviewType';
  artifactId: Scalars['ID']['output'];
  expectedRevisionId: Scalars['ID']['output'];
  packageFingerprint: Scalars['String']['output'];
  stateFingerprint: Scalars['String']['output'];
  stats: Scalars['JSONObject']['output'];
  summary: Scalars['JSONObject']['output'];
}

export interface OfficeCommentCreateInput {
  artifactId: Scalars['ID']['input'];
  content: Scalars['JSON']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface OfficeCommentReplyCreateInput {
  commentId: Scalars['ID']['input'];
  content: Scalars['JSON']['input'];
}

export interface OfficeCommentReplyType {
  __typename?: 'OfficeCommentReplyType';
  commentId: Scalars['ID']['output'];
  content: Scalars['JSONObject']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: PublicUserType;
}

export interface OfficeCommentReplyUpdateInput {
  content: Scalars['JSON']['input'];
  id: Scalars['ID']['input'];
}

export interface OfficeCommentResolveInput {
  id: Scalars['ID']['input'];
  resolved: Scalars['Boolean']['input'];
}

export interface OfficeCommentType {
  __typename?: 'OfficeCommentType';
  content: Scalars['JSONObject']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  replies: Array<OfficeCommentReplyType>;
  resolved: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: PublicUserType;
}

export interface OfficeCommentUpdateInput {
  content: Scalars['JSON']['input'];
  id: Scalars['ID']['input'];
}

export interface OfficeDocxCommandInput {
  command: Scalars['JSON']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface OfficeDocxCommandPreviewType {
  __typename?: 'OfficeDocxCommandPreviewType';
  artifactId: Scalars['ID']['output'];
  expectedRevisionId: Scalars['ID']['output'];
  packageFingerprint: Scalars['String']['output'];
  stateFingerprint: Scalars['String']['output'];
  stats: Scalars['JSONObject']['output'];
  summary: Scalars['JSONObject']['output'];
}

export interface OfficeRevisionCompareType {
  __typename?: 'OfficeRevisionCompareType';
  afterRevision: OfficeRevisionType;
  artifactId: Scalars['ID']['output'];
  beforeRevision: OfficeRevisionType;
  changed: Scalars['Boolean']['output'];
  changes: Scalars['JSON']['output'];
  kind: OfficeArtifactKind;
  summary: Scalars['JSONObject']['output'];
  truncated: Scalars['Boolean']['output'];
}

/** Origin of an immutable Office revision */
export enum OfficeRevisionOrigin {
  ai = 'ai',
  import = 'import',
  system = 'system',
  user = 'user',
}

export interface OfficeRevisionType {
  __typename?: 'OfficeRevisionType';
  artifactId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdBy: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  modelVersion: Scalars['String']['output'];
  operationSummary: Scalars['JSONObject']['output'];
  origin: OfficeRevisionOrigin;
  packageByteSize: Scalars['SafeInt']['output'];
  packageFingerprint: Scalars['String']['output'];
  packageMimeType: Scalars['String']['output'];
  packageUrl: Scalars['String']['output'];
  parentRevisionId: Maybe<Scalars['ID']['output']>;
  sequence: Scalars['SafeInt']['output'];
  stateByteSize: Maybe<Scalars['SafeInt']['output']>;
  stateFingerprint: Maybe<Scalars['String']['output']>;
  stateUrl: Maybe<Scalars['String']['output']>;
  workspaceId: Scalars['ID']['output'];
}

export interface PageInfo {
  __typename?: 'PageInfo';
  endCursor: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Maybe<Scalars['String']['output']>;
}

export interface PaginatedAdminAllSharedLink {
  __typename?: 'PaginatedAdminAllSharedLink';
  analyticsWindow: TimeWindow;
  edges: Array<AdminAllSharedLinkEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
}

export interface PaginatedCommentChangeObjectType {
  __typename?: 'PaginatedCommentChangeObjectType';
  edges: Array<CommentChangeObjectTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedCommentObjectType {
  __typename?: 'PaginatedCommentObjectType';
  edges: Array<CommentObjectTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedCopilotHistoriesType {
  __typename?: 'PaginatedCopilotHistoriesType';
  edges: Array<CopilotHistoriesTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedCopilotWorkspaceFileType {
  __typename?: 'PaginatedCopilotWorkspaceFileType';
  edges: Array<CopilotWorkspaceFileTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedDocMemberLastAccess {
  __typename?: 'PaginatedDocMemberLastAccess';
  edges: Array<DocMemberLastAccessEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
}

export interface PaginatedDocType {
  __typename?: 'PaginatedDocType';
  edges: Array<DocTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedGrantedDocUserType {
  __typename?: 'PaginatedGrantedDocUserType';
  edges: Array<GrantedDocUserTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedIgnoredDocsType {
  __typename?: 'PaginatedIgnoredDocsType';
  edges: Array<CopilotWorkspaceIgnoredDocTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginatedNotificationObjectType {
  __typename?: 'PaginatedNotificationObjectType';
  edges: Array<NotificationObjectTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
}

export interface PaginationInput {
  /** returns the elements in the list that come after the specified cursor. */
  after?: InputMaybe<Scalars['String']['input']>;
  /** returns the first n elements from the list. */
  first?: InputMaybe<Scalars['Int']['input']>;
  /** ignore the first n elements from the list. */
  offset?: InputMaybe<Scalars['Int']['input']>;
}

export interface PasswordLimitsType {
  __typename?: 'PasswordLimitsType';
  maxLength: Scalars['Int']['output'];
  minLength: Scalars['Int']['output'];
}

/** User permission in workspace */
export enum Permission {
  Admin = 'Admin',
  Collaborator = 'Collaborator',
  External = 'External',
  Owner = 'Owner',
}

/** The mode which the public doc default in */
export enum PublicDocMode {
  Edgeless = 'Edgeless',
  Page = 'Page',
}

export interface PublicUserType {
  __typename?: 'PublicUserType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface Query {
  __typename?: 'Query';
  adminAiProfiles: Array<AdminAiProfileType>;
  /** List all shared links across workspaces for admin panel */
  adminAllSharedLinks: PaginatedAdminAllSharedLink;
  /** Get aggregated dashboard metrics for admin panel */
  adminDashboard: AdminDashboard;
  /** Aggregate mail delivery timeline facts for admin panel */
  adminMailDeliveries: AdminMailDeliveryAnalytics;
  adminUserAiProfileAssignment: Maybe<AdminUserAiProfileAssignmentType>;
  /** Get workspace detail for admin */
  adminWorkspace: Maybe<AdminWorkspace>;
  adminWorkspaceByokScopes: Array<AdminWorkspaceByokScopeType>;
  adminWorkspaceByokSettings: WorkspaceByokSettingsType;
  /** List workspaces for admin */
  adminWorkspaces: Array<AdminWorkspace>;
  /** Workspaces count for admin */
  adminWorkspacesCount: Scalars['Int']['output'];
  /** get the whole app configuration */
  appConfig: Scalars['JSONObject']['output'];
  authSigningKeys: Array<AuthSigningKeyType>;
  /** Get current user */
  currentUser: Maybe<UserType>;
  enterpriseAuthorizationSession: EnterpriseAuthorizationSessionType;
  enterpriseConnectionPolicy: EnterpriseConnectionPolicyType;
  enterpriseConnections: Array<EnterpriseConnectionType>;
  error: ErrorDataUnion;
  externalMcpSettings: ExternalMcpSettingsType;
  /** get workspace invitation info */
  getInviteInfo: InvitationType;
  hello: Scalars['String']['output'];
  latestEnterpriseAuthorizationSession: Maybe<EnterpriseAuthorizationSessionType>;
  mcpCredentialReadWriteAvailable: Scalars['Boolean']['output'];
  mcpCredentials: Array<McpCredentialType>;
  /** Get one native Office resource and its current revision */
  officeArtifact: Maybe<OfficeArtifactType>;
  /** List native Office resources in a workspace */
  officeArtifacts: Array<OfficeArtifactType>;
  /** List users represented in native Office revision and comment history */
  officeCollaborators: Array<PublicUserType>;
  /** List comments anchored to one native Office artifact */
  officeComments: Array<OfficeCommentType>;
  /** Get a current or specific immutable Office revision */
  officeRevision: Maybe<OfficeRevisionType>;
  /** Compare two immutable semantic revisions of one native Office resource */
  officeRevisionCompare: OfficeRevisionCompareType;
  /** List immutable revisions for one Office resource */
  officeRevisions: Array<OfficeRevisionType>;
  /** Preview a native Docs, Sheets, Slides, or PDF command without persisting changes */
  previewOfficeCommand: OfficeCommandPreviewType;
  /** Preview a native DOCX command without persisting changes */
  previewOfficeDocxCommand: OfficeDocxCommandPreviewType;
  prices: Array<SubscriptionPrice>;
  /** Get public user by id */
  publicUserById: Maybe<PublicUserType>;
  /**
   * query workspace embedding status
   * @deprecated Use realtime subscription "workspace.embedding.progress.changed" instead.
   */
  queryWorkspaceEmbeddingStatus: ContextWorkspaceEmbeddingStatus;
  /** server config */
  serverConfig: ServerConfigType;
  /** Get user by email */
  user: Maybe<UserOrLimitedUser>;
  /** Get user by email for admin */
  userByEmail: Maybe<UserType>;
  /** Get user by id */
  userById: UserType;
  /** List registered users */
  users: Array<UserType>;
  /** Get users count */
  usersCount: Scalars['Int']['output'];
  /** validate app configuration */
  validateAppConfig: Array<AppConfigValidateResult>;
  /** Get workspace by id */
  workspace: WorkspaceType;
  workspaceDirectory: WorkspaceDirectoryPageType;
  workspaceDirectoryAdministration: WorkspaceDirectoryAdministrationType;
  /**
   * Get workspace role permissions
   * @deprecated use WorkspaceType[permissions] instead
   */
  workspaceRolePermissions: WorkspaceRolePermissions;
  /** Get all accessible workspaces for current user */
  workspaces: Array<WorkspaceType>;
}

export interface QueryAdminAiProfilesArgs {
  workspaceId?: InputMaybe<Scalars['ID']['input']>;
}

export interface QueryAdminAllSharedLinksArgs {
  filter?: InputMaybe<AdminAllSharedLinksFilterInput>;
  pagination: PaginationInput;
}

export interface QueryAdminDashboardArgs {
  input?: InputMaybe<AdminDashboardInput>;
}

export interface QueryAdminMailDeliveriesArgs {
  input?: InputMaybe<AdminMailDeliveriesInput>;
}

export interface QueryAdminUserAiProfileAssignmentArgs {
  userId: Scalars['ID']['input'];
}

export interface QueryAdminWorkspaceArgs {
  id: Scalars['String']['input'];
}

export interface QueryAdminWorkspaceByokScopesArgs {
  first?: InputMaybe<Scalars['SafeInt']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
}

export interface QueryAdminWorkspaceByokSettingsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryAdminWorkspacesArgs {
  filter: ListWorkspaceInput;
}

export interface QueryAdminWorkspacesCountArgs {
  filter: ListWorkspaceInput;
}

export interface QueryEnterpriseAuthorizationSessionArgs {
  sessionId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryEnterpriseConnectionPolicyArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryEnterpriseConnectionsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryErrorArgs {
  name: ErrorNames;
}

export interface QueryExternalMcpSettingsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryGetInviteInfoArgs {
  inviteId: Scalars['String']['input'];
}

export interface QueryLatestEnterpriseAuthorizationSessionArgs {
  connectionId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryMcpCredentialsArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeArtifactArgs {
  artifactId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeArtifactsArgs {
  kind?: InputMaybe<OfficeArtifactKind>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeCollaboratorsArgs {
  artifactId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeCommentsArgs {
  artifactId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeRevisionArgs {
  artifactId: Scalars['String']['input'];
  revisionId?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeRevisionCompareArgs {
  afterRevisionId: Scalars['String']['input'];
  artifactId: Scalars['String']['input'];
  beforeRevisionId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface QueryOfficeRevisionsArgs {
  artifactId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface QueryPreviewOfficeCommandArgs {
  input: OfficeCommandInput;
}

export interface QueryPreviewOfficeDocxCommandArgs {
  input: OfficeDocxCommandInput;
}

export interface QueryPublicUserByIdArgs {
  id: Scalars['String']['input'];
}

export interface QueryQueryWorkspaceEmbeddingStatusArgs {
  workspaceId: Scalars['String']['input'];
}

export interface QueryUserArgs {
  email: Scalars['String']['input'];
}

export interface QueryUserByEmailArgs {
  email: Scalars['String']['input'];
}

export interface QueryUserByIdArgs {
  id: Scalars['String']['input'];
}

export interface QueryUsersArgs {
  filter: ListUserInput;
}

export interface QueryUsersCountArgs {
  filter?: InputMaybe<ListUserInput>;
}

export interface QueryValidateAppConfigArgs {
  updates: Array<UpdateAppConfigInput>;
}

export interface QueryWorkspaceArgs {
  id: Scalars['String']['input'];
}

export interface QueryWorkspaceDirectoryArgs {
  after?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryWorkspaceDirectoryAdministrationArgs {
  auditAfter?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['ID']['input'];
}

export interface QueryWorkspaceRolePermissionsArgs {
  id: Scalars['String']['input'];
}

export interface QueryChatHistoriesInput {
  action?: InputMaybe<Scalars['Boolean']['input']>;
  fork?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  messageOrder?: InputMaybe<ChatHistoryOrder>;
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
  sessionOrder?: InputMaybe<ChatHistoryOrder>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  withMessages?: InputMaybe<Scalars['Boolean']['input']>;
  withPrompt?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface QueryChatSessionsInput {
  action?: InputMaybe<Scalars['Boolean']['input']>;
  fork?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface QueryTooLongDataType {
  __typename?: 'QueryTooLongDataType';
  max: Scalars['Int']['output'];
}

export interface ReRequestCopilotProjectDocumentInput {
  grantId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
}

export interface ReleaseVersionType {
  __typename?: 'ReleaseVersionType';
  changelog: Scalars['String']['output'];
  publishedAt: Scalars['DateTime']['output'];
  url: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface RemoveAvatar {
  __typename?: 'RemoveAvatar';
  success: Scalars['Boolean']['output'];
}

export interface RemoveContextBlobInput {
  blobId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
}

export interface RemoveContextCategoryInput {
  categoryId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
  type: ContextCategories;
}

export interface RemoveContextDocInput {
  contextId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}

export interface RemoveContextFileInput {
  contextId: Scalars['String']['input'];
  fileId: Scalars['String']['input'];
}

export interface RemoveCopilotContextProjectDocumentInput {
  docId: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface RemoveCopilotProjectMemberInput {
  memberUserId: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
}

export interface ReorderWorkspaceByokConfigsInput {
  ids: Array<Scalars['ID']['input']>;
  storage: ByokKeyStorage;
  workspaceId: Scalars['String']['input'];
}

export interface ReplyCreateInput {
  commentId: Scalars['ID']['input'];
  content: Scalars['JSONObject']['input'];
  docMode: DocMode;
  docTitle: Scalars['String']['input'];
  /** The mention user ids, if not provided, the comment reply will not be mentioned */
  mentions?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface ReplyObjectType {
  __typename?: 'ReplyObjectType';
  commentId: Scalars['ID']['output'];
  /** The content of the reply */
  content: Scalars['JSONObject']['output'];
  /** The created at time of the reply */
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  /** The updated at time of the reply */
  updatedAt: Scalars['DateTime']['output'];
  /** The user who created the reply */
  user: PublicUserType;
}

export interface ReplyUpdateInput {
  content: Scalars['JSONObject']['input'];
  id: Scalars['ID']['input'];
}

export interface RequestCopilotDocumentAccessInput {
  docId: Scalars['String']['input'];
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  projectId?: InputMaybe<Scalars['String']['input']>;
  requestedLevel?: InputMaybe<Scalars['String']['input']>;
  requestedTitle?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface ResolveCopilotAccessRequestInput {
  reason?: InputMaybe<Scalars['String']['input']>;
  requestId: Scalars['ID']['input'];
}

export interface ResponseTooLargeErrorDataType {
  __typename?: 'ResponseTooLargeErrorDataType';
  limitBytes: Scalars['Int']['output'];
  receivedBytes: Scalars['Int']['output'];
}

export interface RevealedMcpCredentialType {
  __typename?: 'RevealedMcpCredentialType';
  callbackSecret: Maybe<Scalars['String']['output']>;
  credential: McpCredentialType;
  token: Scalars['String']['output'];
}

export interface RevokeCopilotProjectGrantInput {
  grantId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
}

export interface RevokeDocUserRoleInput {
  docId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface RuntimeConfigNotFoundDataType {
  __typename?: 'RuntimeConfigNotFoundDataType';
  key: Scalars['String']['output'];
}

export interface SameSubscriptionRecurringDataType {
  __typename?: 'SameSubscriptionRecurringDataType';
  recurring: Scalars['String']['output'];
}

export interface SearchDocObjectType {
  __typename?: 'SearchDocObjectType';
  blockId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdByUser: Maybe<PublicUserType>;
  docId: Scalars['String']['output'];
  highlight: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  updatedByUser: Maybe<PublicUserType>;
}

export interface SearchDocsInput {
  keyword: Scalars['String']['input'];
  /** Limit the number of docs to return, default is 20 */
  limit?: InputMaybe<Scalars['Int']['input']>;
}

export interface SearchHighlight {
  before: Scalars['String']['input'];
  end: Scalars['String']['input'];
  field: Scalars['String']['input'];
}

export interface SearchInput {
  options: SearchOptions;
  query: SearchQuery;
  table: SearchTable;
}

export interface SearchNodeObjectType {
  __typename?: 'SearchNodeObjectType';
  /** The search result fields, see UnionSearchItemObjectType */
  fields: Scalars['JSONObject']['output'];
  /** The search result fields, see UnionSearchItemObjectType */
  highlights: Maybe<Scalars['JSONObject']['output']>;
}

export interface SearchOptions {
  fields: Array<Scalars['String']['input']>;
  highlights?: InputMaybe<Array<SearchHighlight>>;
  pagination?: InputMaybe<SearchPagination>;
}

export interface SearchPagination {
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}

export interface SearchQuery {
  boost?: InputMaybe<Scalars['Float']['input']>;
  field?: InputMaybe<Scalars['String']['input']>;
  match?: InputMaybe<Scalars['String']['input']>;
  occur?: InputMaybe<SearchQueryOccur>;
  queries?: InputMaybe<Array<SearchQuery>>;
  query?: InputMaybe<SearchQuery>;
  type: SearchQueryType;
}

/** Search query occur */
export enum SearchQueryOccur {
  must = 'must',
  must_not = 'must_not',
  should = 'should',
}

/** Search query type */
export enum SearchQueryType {
  all = 'all',
  boolean = 'boolean',
  boost = 'boost',
  exists = 'exists',
  match = 'match',
}

export interface SearchResultObjectType {
  __typename?: 'SearchResultObjectType';
  nodes: Array<SearchNodeObjectType>;
  pagination: SearchResultPagination;
}

export interface SearchResultPagination {
  __typename?: 'SearchResultPagination';
  count: Scalars['Int']['output'];
  hasMore: Scalars['Boolean']['output'];
  nextCursor: Maybe<Scalars['String']['output']>;
}

/** Search table */
export enum SearchTable {
  block = 'block',
  doc = 'doc',
}

export interface SendCopilotProjectInvitationInput {
  email: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
}

export interface ServerConfigType {
  __typename?: 'ServerConfigType';
  /** fetch latest available upgradable release of server */
  availableUpgrade: Maybe<ReleaseVersionType>;
  /** Features for user that can be configured */
  availableUserFeatures: Array<FeatureType>;
  /** server base url */
  baseUrl: Scalars['String']['output'];
  calendarCalDAVProviders: Array<CalendarCalDavProviderPresetObjectType>;
  calendarProviders: Array<CalendarProviderType>;
  /** credentials requirement */
  credentialsRequirement: CredentialsRequirementType;
  /** enabled server features */
  features: Array<ServerFeature>;
  /** whether server has been initialized */
  initialized: Scalars['Boolean']['output'];
  /** server identical name could be shown as badge on user interface */
  name: Scalars['String']['output'];
  oauthProviders: Array<OAuthProviderType>;
  /** server type */
  type: ServerDeploymentType;
  /** server version */
  version: Scalars['String']['output'];
}

export enum ServerDeploymentType {
  Affine = 'Affine',
  Selfhosted = 'Selfhosted',
}

export enum ServerFeature {
  Captcha = 'Captcha',
  Comment = 'Comment',
  Copilot = 'Copilot',
  CopilotEmbedding = 'CopilotEmbedding',
  Indexer = 'Indexer',
  LocalWorkspace = 'LocalWorkspace',
  OAuth = 'OAuth',
  Payment = 'Payment',
}

export interface SetCopilotProjectAiPolicyInput {
  policy: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
}

export interface SpaceAccessDeniedDataType {
  __typename?: 'SpaceAccessDeniedDataType';
  spaceId: Scalars['String']['output'];
}

export interface SpaceNotFoundDataType {
  __typename?: 'SpaceNotFoundDataType';
  spaceId: Scalars['String']['output'];
}

export interface SpaceOwnerNotFoundDataType {
  __typename?: 'SpaceOwnerNotFoundDataType';
  spaceId: Scalars['String']['output'];
}

export interface SpaceShouldHaveOnlyOneOwnerDataType {
  __typename?: 'SpaceShouldHaveOnlyOneOwnerDataType';
  spaceId: Scalars['String']['output'];
}

export interface SparkClawEndpointType {
  __typename?: 'SparkClawEndpointType';
  createdAt: Scalars['DateTime']['output'];
  deviceId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastSeenAt: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
}

export interface SparkClawPairingType {
  __typename?: 'SparkClawPairingType';
  command: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
}

export interface SsrfBlockedErrorDataType {
  __typename?: 'SsrfBlockedErrorDataType';
  reason: Scalars['String']['output'];
}

export interface StreamObject {
  __typename?: 'StreamObject';
  args: Maybe<Scalars['JSON']['output']>;
  result: Maybe<Scalars['JSON']['output']>;
  textDelta: Maybe<Scalars['String']['output']>;
  toolCallId: Maybe<Scalars['String']['output']>;
  toolName: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
}

export interface SubmitAudioTranscriptionInput {
  quality?: InputMaybe<TranscriptionQualityInput>;
  sliceManifest?: InputMaybe<Array<AudioSliceManifestItemInput>>;
  sourceAudio?: InputMaybe<TranscriptionSourceAudioInput>;
  strategy?: InputMaybe<Scalars['String']['input']>;
}

export interface SubscriptionAlreadyExistsDataType {
  __typename?: 'SubscriptionAlreadyExistsDataType';
  plan: Scalars['String']['output'];
}

export interface SubscriptionNotExistsDataType {
  __typename?: 'SubscriptionNotExistsDataType';
  plan: Scalars['String']['output'];
}

export enum SubscriptionPlan {
  AI = 'AI',
  Enterprise = 'Enterprise',
  Free = 'Free',
  Pro = 'Pro',
  SelfHosted = 'SelfHosted',
  SelfHostedTeam = 'SelfHostedTeam',
  Team = 'Team',
}

export interface SubscriptionPlanNotFoundDataType {
  __typename?: 'SubscriptionPlanNotFoundDataType';
  plan: Scalars['String']['output'];
  recurring: Scalars['String']['output'];
}

export interface SubscriptionPrice {
  __typename?: 'SubscriptionPrice';
  amount: Maybe<Scalars['Int']['output']>;
  currency: Scalars['String']['output'];
  lifetimeAmount: Maybe<Scalars['Int']['output']>;
  plan: SubscriptionPlan;
  type: Scalars['String']['output'];
  yearlyAmount: Maybe<Scalars['Int']['output']>;
}

export enum SubscriptionRecurring {
  Lifetime = 'Lifetime',
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}

export enum SubscriptionStatus {
  Active = 'Active',
  Canceled = 'Canceled',
  Incomplete = 'Incomplete',
  IncompleteExpired = 'IncompleteExpired',
  PastDue = 'PastDue',
  Paused = 'Paused',
  Trialing = 'Trialing',
  Unpaid = 'Unpaid',
}

export interface SubscriptionType {
  __typename?: 'SubscriptionType';
  canceledAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  end: Maybe<Scalars['DateTime']['output']>;
  /** If provider is revenuecat, indicates underlying store. Read-only. One of: app_store | play_store */
  iapStore: Maybe<Scalars['String']['output']>;
  /** @deprecated removed */
  id: Maybe<Scalars['String']['output']>;
  nextBillAt: Maybe<Scalars['DateTime']['output']>;
  /**
   * The 'Free' plan just exists to be a placeholder and for the type convenience of frontend.
   * There won't actually be a subscription with plan 'Free'
   */
  plan: SubscriptionPlan;
  /** Payment provider of this subscription. Read-only. One of: stripe | revenuecat */
  provider: Maybe<Scalars['String']['output']>;
  recurring: SubscriptionRecurring;
  start: Scalars['DateTime']['output'];
  status: SubscriptionStatus;
  trialEnd: Maybe<Scalars['DateTime']['output']>;
  trialStart: Maybe<Scalars['DateTime']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  variant: Maybe<SubscriptionVariant>;
}

export enum SubscriptionVariant {
  Onetime = 'Onetime',
}

export interface TestWorkspaceByokConfigInput {
  apiKey?: InputMaybe<Scalars['String']['input']>;
  configId?: InputMaybe<Scalars['ID']['input']>;
  endpoint?: InputMaybe<Scalars['String']['input']>;
  modelId?: InputMaybe<Scalars['String']['input']>;
  provider: ByokProvider;
  storage: ByokKeyStorage;
  workspaceId: Scalars['String']['input'];
}

export interface TestWorkspaceByokConfigResultType {
  __typename?: 'TestWorkspaceByokConfigResultType';
  message: Maybe<Scalars['String']['output']>;
  ok: Scalars['Boolean']['output'];
  status: ByokKeyTestStatus;
}

export enum TimeBucket {
  Day = 'Day',
  Hour = 'Hour',
  Minute = 'Minute',
}

export interface TimeWindow {
  __typename?: 'TimeWindow';
  bucket: TimeBucket;
  effectiveSize: Scalars['Int']['output'];
  from: Scalars['DateTime']['output'];
  requestedSize: Scalars['Int']['output'];
  timezone: Scalars['String']['output'];
  to: Scalars['DateTime']['output'];
}

export interface TranscriptProviderMetaType {
  __typename?: 'TranscriptProviderMetaType';
  model: Maybe<Scalars['String']['output']>;
  provider: Maybe<Scalars['String']['output']>;
}

export interface TranscriptionItemType {
  __typename?: 'TranscriptionItemType';
  end: Scalars['String']['output'];
  speaker: Scalars['String']['output'];
  start: Scalars['String']['output'];
  transcription: Scalars['String']['output'];
}

export interface TranscriptionQualityInput {
  degraded?: InputMaybe<Scalars['Boolean']['input']>;
  overflowCount?: InputMaybe<Scalars['Int']['input']>;
}

export interface TranscriptionQualityType {
  __typename?: 'TranscriptionQualityType';
  degraded: Maybe<Scalars['Boolean']['output']>;
  overflowCount: Maybe<Scalars['Int']['output']>;
}

export interface TranscriptionResultType {
  __typename?: 'TranscriptionResultType';
  actions: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  normalizedSegments: Maybe<Array<NormalizedTranscriptSegmentType>>;
  normalizedTranscript: Maybe<Scalars['String']['output']>;
  providerMeta: Maybe<TranscriptProviderMetaType>;
  quality: Maybe<TranscriptionQualityType>;
  sliceManifest: Maybe<Array<AudioSliceManifestItemType>>;
  sourceAudio: Maybe<TranscriptionSourceAudioType>;
  status: AiJobStatus;
  strategy: Maybe<Scalars['String']['output']>;
  summary: Maybe<Scalars['String']['output']>;
  summaryJson: Maybe<MeetingSummaryV2Type>;
  title: Maybe<Scalars['String']['output']>;
  transcription: Maybe<Array<TranscriptionItemType>>;
  version: Maybe<Scalars['String']['output']>;
}

export interface TranscriptionSourceAudioInput {
  channels?: InputMaybe<Scalars['Int']['input']>;
  durationMs?: InputMaybe<Scalars['Int']['input']>;
  mimeType?: InputMaybe<Scalars['String']['input']>;
  sampleRate?: InputMaybe<Scalars['Int']['input']>;
}

export interface TranscriptionSourceAudioType {
  __typename?: 'TranscriptionSourceAudioType';
  blobId: Maybe<Scalars['String']['output']>;
  channels: Maybe<Scalars['Int']['output']>;
  durationMs: Maybe<Scalars['Int']['output']>;
  mimeType: Maybe<Scalars['String']['output']>;
  sampleRate: Maybe<Scalars['Int']['output']>;
}

export interface TransferCopilotProjectOwnershipInput {
  memberUserId: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
}

export type UnionNotificationBodyType =
  | AccessRequestNotificationBodyType
  | InvitationAcceptedNotificationBodyType
  | InvitationBlockedNotificationBodyType
  | InvitationNotificationBodyType
  | InvitationReviewApprovedNotificationBodyType
  | InvitationReviewDeclinedNotificationBodyType
  | InvitationReviewRequestNotificationBodyType
  | MentionNotificationBodyType;

export interface UnknownOauthProviderDataType {
  __typename?: 'UnknownOauthProviderDataType';
  name: Scalars['String']['output'];
}

export interface UnsupportedClientVersionDataType {
  __typename?: 'UnsupportedClientVersionDataType';
  clientVersion: Scalars['String']['output'];
  requiredVersion: Scalars['String']['output'];
}

export interface UnsupportedServerVersionDataType {
  __typename?: 'UnsupportedServerVersionDataType';
  requiredVersion: Scalars['String']['output'];
}

export interface UnsupportedSubscriptionPlanDataType {
  __typename?: 'UnsupportedSubscriptionPlanDataType';
  plan: Scalars['String']['output'];
}

export interface UpdateAppConfigInput {
  key: Scalars['String']['input'];
  module: Scalars['String']['input'];
  value: Scalars['JSON']['input'];
}

export interface UpdateChatSessionInput {
  /** The workspace id of the session */
  docId?: InputMaybe<Scalars['String']['input']>;
  /** Whether to pin the session */
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  /** The prompt name to use for the session */
  promptName?: InputMaybe<Scalars['String']['input']>;
  /** The explicitly selected AI context project */
  selectedContextProjectId?: InputMaybe<Scalars['String']['input']>;
  sessionId: Scalars['String']['input'];
}

export interface UpdateCopilotContextMemoryInput {
  content?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  status?: InputMaybe<CopilotContextMemoryMutableStatusInput>;
}

export interface UpdateCopilotContextPolicyInput {
  applicationMode?: InputMaybe<Scalars['String']['input']>;
  conditions?: InputMaybe<CopilotContextRuleConditionsInput>;
  content?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface UpdateCopilotContextProjectDocumentInput {
  docId: Scalars['String']['input'];
  groupId?: InputMaybe<Scalars['String']['input']>;
  projectId: Scalars['ID']['input'];
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['String']['input'];
}

export interface UpdateCopilotContextProjectInput {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  workspaceDocuments?: InputMaybe<CopilotContextProjectWorkspaceDocumentsInputType>;
}

export interface UpdateCopilotContextRuleInput {
  applicationMode?: InputMaybe<Scalars['String']['input']>;
  conditions?: InputMaybe<CopilotContextRuleConditionsInput>;
  content?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateCopilotContextSettingsInput {
  autoMemoryEnabled: Scalars['Boolean']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface UpdateDocDefaultRoleInput {
  docId: Scalars['String']['input'];
  role: DocRole;
  workspaceId: Scalars['String']['input'];
}

export interface UpdateDocUserRoleInput {
  docId: Scalars['String']['input'];
  role: DocRole;
  userId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}

export interface UpdateUserInput {
  /** User name */
  name?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateUserSettingsInput {
  /** Receive comment email */
  receiveCommentEmail?: InputMaybe<Scalars['Boolean']['input']>;
  /** Receive invitation email */
  receiveInvitationEmail?: InputMaybe<Scalars['Boolean']['input']>;
  /** Receive mention email */
  receiveMentionEmail?: InputMaybe<Scalars['Boolean']['input']>;
  /** Receive notifications through SparkClaw */
  receiveSparkClawNotifications?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface UpdateWorkspaceCalendarsInput {
  items: Array<WorkspaceCalendarItemInput>;
  workspaceId: Scalars['String']['input'];
}

export interface UpdateWorkspaceInput {
  /** Enable AI */
  enableAi?: InputMaybe<Scalars['Boolean']['input']>;
  /** Enable doc embedding */
  enableDocEmbedding?: InputMaybe<Scalars['Boolean']['input']>;
  /** Enable workspace sharing */
  enableSharing?: InputMaybe<Scalars['Boolean']['input']>;
  /** Enable url previous when sharing */
  enableUrlPreview?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  /** is Public workspace */
  public?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface UpsertAdminAiProfileInput {
  credentialIds: Array<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  enabled: Scalars['Boolean']['input'];
  id?: InputMaybe<Scalars['ID']['input']>;
  isDefault: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
}

export interface UpsertWorkspaceByokConfigInput {
  apiKey?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  endpoint?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  modelId?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  provider: ByokProvider;
  sortOrder?: InputMaybe<Scalars['SafeInt']['input']>;
  storage: ByokKeyStorage;
  workspaceId: Scalars['String']['input'];
}

export interface UserImportFailedType {
  __typename?: 'UserImportFailedType';
  email: Scalars['String']['output'];
  error: Scalars['String']['output'];
}

export type UserImportResultType = UserImportFailedType | UserType;

export type UserOrLimitedUser = LimitedUserType | UserType;

export interface UserQuotaHumanReadableType {
  __typename?: 'UserQuotaHumanReadableType';
  blobLimit: Scalars['String']['output'];
  copilotActionLimit: Scalars['String']['output'];
  historyPeriod: Scalars['String']['output'];
  memberLimit: Scalars['String']['output'];
  name: Scalars['String']['output'];
  storageQuota: Scalars['String']['output'];
  usedStorageQuota: Scalars['String']['output'];
}

export interface UserQuotaType {
  __typename?: 'UserQuotaType';
  blobLimit: Scalars['SafeInt']['output'];
  copilotActionLimit: Maybe<Scalars['Int']['output']>;
  historyPeriod: Scalars['SafeInt']['output'];
  humanReadable: UserQuotaHumanReadableType;
  memberLimit: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  storageQuota: Scalars['SafeInt']['output'];
  usedStorageQuota: Scalars['SafeInt']['output'];
}

export interface UserQuotaUsageType {
  __typename?: 'UserQuotaUsageType';
  /** @deprecated use `UserQuotaType['usedStorageQuota']` instead */
  storageQuota: Scalars['SafeInt']['output'];
}

export interface UserSettingsType {
  __typename?: 'UserSettingsType';
  /** Receive comment email */
  receiveCommentEmail: Scalars['Boolean']['output'];
  /** Receive invitation email */
  receiveInvitationEmail: Scalars['Boolean']['output'];
  /** Receive mention email */
  receiveMentionEmail: Scalars['Boolean']['output'];
  /** Receive notifications through SparkClaw */
  receiveSparkClawNotifications: Scalars['Boolean']['output'];
}

export interface UserType {
  __typename?: 'UserType';
  /** User avatar url */
  avatarUrl: Maybe<Scalars['String']['output']>;
  calendarAccounts: Array<CalendarAccountObjectType>;
  copilot: Copilot;
  /**
   * User email verified
   * @deprecated useless
   */
  createdAt: Maybe<Scalars['DateTime']['output']>;
  /** User is disabled */
  disabled: Scalars['Boolean']['output'];
  /** User email */
  email: Scalars['String']['output'];
  /** User email verified */
  emailVerified: Scalars['Boolean']['output'];
  /** Enabled features of a user */
  features: Array<FeatureType>;
  /** User password has been set */
  hasPassword: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  /** Get user invoice count */
  invoiceCount: Scalars['Int']['output'];
  invoices: Array<InvoiceType>;
  /** User name */
  name: Scalars['String']['output'];
  /** Get current user notifications */
  notifications: PaginatedNotificationObjectType;
  quota: UserQuotaType;
  quotaUsage: UserQuotaUsageType;
  /** Get user settings */
  settings: UserSettingsType;
  sparkClawEndpoints: Array<SparkClawEndpointType>;
  subscriptions: Array<SubscriptionType>;
  /** @deprecated use auth session exchange instead */
  token: TokenType;
}

export interface UserTypeCopilotArgs {
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}

export interface UserTypeInvoicesArgs {
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface UserTypeNotificationsArgs {
  includeRead?: InputMaybe<Scalars['Boolean']['input']>;
  pagination: PaginationInput;
}

export interface ValidationErrorDataType {
  __typename?: 'ValidationErrorDataType';
  errors: Scalars['String']['output'];
}

export interface VersionRejectedDataType {
  __typename?: 'VersionRejectedDataType';
  serverVersion: Scalars['String']['output'];
  version: Scalars['String']['output'];
}

export interface WorkspaceByokCapabilityWarningType {
  __typename?: 'WorkspaceByokCapabilityWarningType';
  featureKind: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  requiredProviders: Array<ByokProvider>;
}

export interface WorkspaceByokKeyConfigType {
  __typename?: 'WorkspaceByokKeyConfigType';
  capabilities: Array<Scalars['String']['output']>;
  configured: Scalars['Boolean']['output'];
  description: Maybe<Scalars['String']['output']>;
  disabledReason: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  endpoint: Maybe<Scalars['String']['output']>;
  endpointEditable: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lastError: Maybe<Scalars['String']['output']>;
  lastErrorAt: Maybe<Scalars['DateTime']['output']>;
  lastTestError: Maybe<Scalars['String']['output']>;
  lastTestedAt: Maybe<Scalars['DateTime']['output']>;
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  modelId: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  provider: ByokProvider;
  sortOrder: Scalars['SafeInt']['output'];
  storage: ByokKeyStorage;
  testStatus: ByokKeyTestStatus;
}

export interface WorkspaceByokSettingsType {
  __typename?: 'WorkspaceByokSettingsType';
  allowedProviders: Array<ByokProvider>;
  customEndpointSupported: Scalars['Boolean']['output'];
  entitled: Scalars['Boolean']['output'];
  entitlementRequired: Array<Scalars['String']['output']>;
  hasAiPlan: Scalars['Boolean']['output'];
  keys: Array<WorkspaceByokKeyConfigType>;
  localEntitled: Scalars['Boolean']['output'];
  localStorageSupported: Scalars['Boolean']['output'];
  privateEndpointSupported: Scalars['Boolean']['output'];
  serverEntitled: Scalars['Boolean']['output'];
  warnings: Array<WorkspaceByokCapabilityWarningType>;
  workspaceId: Scalars['String']['output'];
}

export interface WorkspaceByokUsagePointType {
  __typename?: 'WorkspaceByokUsagePointType';
  date: Scalars['DateTime']['output'];
  featureKind: Scalars['String']['output'];
  totalTokens: Scalars['SafeInt']['output'];
}

export interface WorkspaceCalendarItemInput {
  colorOverride?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  subscriptionId: Scalars['String']['input'];
}

export interface WorkspaceCalendarItemObjectType {
  __typename?: 'WorkspaceCalendarItemObjectType';
  colorOverride: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  sortOrder: Maybe<Scalars['Int']['output']>;
  subscriptionId: Scalars['String']['output'];
}

export interface WorkspaceCalendarObjectType {
  __typename?: 'WorkspaceCalendarObjectType';
  colorOverride: Maybe<Scalars['String']['output']>;
  createdByUserId: Scalars['String']['output'];
  displayNameOverride: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  events: Array<CalendarEventObjectType>;
  id: Scalars['String']['output'];
  items: Array<WorkspaceCalendarItemObjectType>;
  workspaceId: Scalars['String']['output'];
}

export interface WorkspaceCalendarObjectTypeEventsArgs {
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
}

export interface WorkspaceDirectoryAdministrationType {
  __typename?: 'WorkspaceDirectoryAdministrationType';
  auditEvents: Array<WorkspaceDirectoryPolicyAuditType>;
  auditNextCursor: Maybe<Scalars['String']['output']>;
  directories: Array<WorkspaceDirectoryPolicyDirectoryType>;
  policies: Array<WorkspaceDirectoryPolicyType>;
  principals: Array<WorkspaceDirectoryPolicyPrincipalType>;
  revision: Scalars['String']['output'];
}

export interface WorkspaceDirectoryChangeInput {
  key: Scalars['ID']['input'];
  op: Scalars['String']['input'];
  values?: InputMaybe<WorkspaceDirectoryValuesInput>;
}

export interface WorkspaceDirectoryEntryType {
  __typename?: 'WorkspaceDirectoryEntryType';
  data: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  index: Scalars['String']['output'];
  parentId: Maybe<Scalars['ID']['output']>;
  rights: WorkspaceDirectoryRightsType;
  type: Scalars['String']['output'];
}

export interface WorkspaceDirectoryMutationType {
  __typename?: 'WorkspaceDirectoryMutationType';
  revision: Scalars['String']['output'];
}

export interface WorkspaceDirectoryPageType {
  __typename?: 'WorkspaceDirectoryPageType';
  authorizationRevision: Scalars['String']['output'];
  fullSyncAllowed: Scalars['Boolean']['output'];
  items: Array<WorkspaceDirectoryEntryType>;
  nextCursor: Maybe<Scalars['String']['output']>;
  revision: Scalars['String']['output'];
  rootRights: WorkspaceDirectoryRightsType;
}

export interface WorkspaceDirectoryPolicyAuditType {
  __typename?: 'WorkspaceDirectoryPolicyAuditType';
  action: Scalars['String']['output'];
  actorId: Scalars['ID']['output'];
  after: Maybe<WorkspaceDirectoryRightsType>;
  before: Maybe<WorkspaceDirectoryRightsType>;
  createdAt: Scalars['DateTime']['output'];
  directoryId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  principalId: Scalars['ID']['output'];
}

export interface WorkspaceDirectoryPolicyDirectoryType {
  __typename?: 'WorkspaceDirectoryPolicyDirectoryType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parentId: Maybe<Scalars['ID']['output']>;
}

export interface WorkspaceDirectoryPolicyMutationType {
  __typename?: 'WorkspaceDirectoryPolicyMutationType';
  policy: Maybe<WorkspaceDirectoryPolicyType>;
  revision: Scalars['String']['output'];
}

export interface WorkspaceDirectoryPolicyPrincipalType {
  __typename?: 'WorkspaceDirectoryPolicyPrincipalType';
  allMembers: Scalars['Boolean']['output'];
  email: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Maybe<Scalars['String']['output']>;
}

export interface WorkspaceDirectoryPolicyType {
  __typename?: 'WorkspaceDirectoryPolicyType';
  directoryId: Scalars['ID']['output'];
  principalId: Scalars['ID']['output'];
  rights: WorkspaceDirectoryRightsType;
  updatedAt: Scalars['DateTime']['output'];
}

export interface WorkspaceDirectoryRightsInput {
  canCreateFolder: Scalars['Boolean']['input'];
  canOrganize: Scalars['Boolean']['input'];
  canRead: Scalars['Boolean']['input'];
  canWrite: Scalars['Boolean']['input'];
}

export interface WorkspaceDirectoryRightsType {
  __typename?: 'WorkspaceDirectoryRightsType';
  canCreateFolder: Scalars['Boolean']['output'];
  canOrganize: Scalars['Boolean']['output'];
  canRead: Scalars['Boolean']['output'];
  canWrite: Scalars['Boolean']['output'];
}

export interface WorkspaceDirectoryValuesInput {
  data: Scalars['String']['input'];
  index: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
  type: Scalars['String']['input'];
}

export interface WorkspaceDocMeta {
  __typename?: 'WorkspaceDocMeta';
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<EditorType>;
  updatedAt: Scalars['DateTime']['output'];
  updatedBy: Maybe<EditorType>;
}

/** Workspace invite link expire time */
export enum WorkspaceInviteLinkExpireTime {
  OneDay = 'OneDay',
  OneMonth = 'OneMonth',
  OneWeek = 'OneWeek',
  ThreeDays = 'ThreeDays',
}

/** Member invite status in workspace */
export enum WorkspaceMemberStatus {
  Accepted = 'Accepted',
  AllocatingSeat = 'AllocatingSeat',
  NeedMoreSeat = 'NeedMoreSeat',
  NeedMoreSeatAndReview = 'NeedMoreSeatAndReview',
  Pending = 'Pending',
  UnderReview = 'UnderReview',
}

export interface WorkspacePermissionNotFoundDataType {
  __typename?: 'WorkspacePermissionNotFoundDataType';
  spaceId: Scalars['String']['output'];
}

export interface WorkspacePermissions {
  __typename?: 'WorkspacePermissions';
  Workspace_Administrators_Manage: Scalars['Boolean']['output'];
  Workspace_Blobs_List: Scalars['Boolean']['output'];
  Workspace_Blobs_Read: Scalars['Boolean']['output'];
  Workspace_Blobs_Write: Scalars['Boolean']['output'];
  Workspace_Copilot: Scalars['Boolean']['output'];
  Workspace_CreateDoc: Scalars['Boolean']['output'];
  Workspace_Delete: Scalars['Boolean']['output'];
  Workspace_Organize_Read: Scalars['Boolean']['output'];
  Workspace_Payment_Manage: Scalars['Boolean']['output'];
  Workspace_Properties_Create: Scalars['Boolean']['output'];
  Workspace_Properties_Delete: Scalars['Boolean']['output'];
  Workspace_Properties_Read: Scalars['Boolean']['output'];
  Workspace_Properties_Update: Scalars['Boolean']['output'];
  Workspace_Read: Scalars['Boolean']['output'];
  Workspace_Settings_Read: Scalars['Boolean']['output'];
  Workspace_Settings_Update: Scalars['Boolean']['output'];
  Workspace_Sync: Scalars['Boolean']['output'];
  Workspace_TransferOwner: Scalars['Boolean']['output'];
  Workspace_Users_Manage: Scalars['Boolean']['output'];
  Workspace_Users_Read: Scalars['Boolean']['output'];
}

export interface WorkspaceQuotaHumanReadableType {
  __typename?: 'WorkspaceQuotaHumanReadableType';
  blobLimit: Scalars['String']['output'];
  historyPeriod: Scalars['String']['output'];
  memberCount: Scalars['String']['output'];
  memberLimit: Scalars['String']['output'];
  name: Scalars['String']['output'];
  overcapacityMemberCount: Scalars['String']['output'];
  storageQuota: Scalars['String']['output'];
  storageQuotaUsed: Scalars['String']['output'];
}

export interface WorkspaceQuotaType {
  __typename?: 'WorkspaceQuotaType';
  blobLimit: Scalars['SafeInt']['output'];
  historyPeriod: Scalars['SafeInt']['output'];
  humanReadable: WorkspaceQuotaHumanReadableType;
  memberCount: Scalars['Int']['output'];
  memberLimit: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  overcapacityMemberCount: Scalars['Int']['output'];
  storageQuota: Scalars['SafeInt']['output'];
  usedStorageQuota: Scalars['SafeInt']['output'];
}

export interface WorkspaceRolePermissions {
  __typename?: 'WorkspaceRolePermissions';
  permissions: WorkspacePermissions;
  role: Permission;
}

export interface WorkspaceType {
  __typename?: 'WorkspaceType';
  /** Search a specific table with aggregate */
  aggregate: AggregateResultObjectType;
  /** Get blob upload part url */
  blobUploadPartUrl: BlobUploadPart;
  /** List blobs of workspace */
  blobs: Array<ListedBlob>;
  /** Blobs size of workspace */
  blobsSize: Scalars['Int']['output'];
  byokSettings: WorkspaceByokSettingsType;
  byokUsage: Array<WorkspaceByokUsagePointType>;
  calendars: Array<WorkspaceCalendarObjectType>;
  /** Get comment changes of a doc */
  commentChanges: PaginatedCommentChangeObjectType;
  /** Get comments of a doc */
  comments: PaginatedCommentObjectType;
  /** Workspace created date */
  createdAt: Scalars['DateTime']['output'];
  /** Get get with given id */
  doc: DocType;
  docs: PaginatedDocType;
  embedding: CopilotWorkspaceConfig;
  /** Enable AI */
  enableAi: Scalars['Boolean']['output'];
  /** Enable doc embedding */
  enableDocEmbedding: Scalars['Boolean']['output'];
  /** Enable workspace sharing */
  enableSharing: Scalars['Boolean']['output'];
  /** Enable url previous when sharing */
  enableUrlPreview: Scalars['Boolean']['output'];
  histories: Array<DocHistoryType>;
  id: Scalars['ID']['output'];
  /** is current workspace initialized */
  initialized: Scalars['Boolean']['output'];
  /** invite link for workspace */
  inviteLink: Maybe<InviteLink>;
  /** Get user invoice count */
  invoiceCount: Scalars['Int']['output'];
  invoices: Array<InvoiceType>;
  /** The selfhost license of the workspace */
  license: Maybe<License>;
  /** member count of workspace */
  memberCount: Scalars['Int']['output'];
  /** Members of workspace */
  members: Array<InviteUserType>;
  /** Owner of workspace */
  owner: UserType;
  /**
   * Cloud page metadata of workspace
   * @deprecated use [WorkspaceType.doc] instead
   */
  pageMeta: WorkspaceDocMeta;
  /** map of action permissions */
  permissions: WorkspacePermissions;
  /** is Public workspace */
  public: Scalars['Boolean']['output'];
  /** Get public docs of a workspace */
  publicDocs: Array<DocType>;
  /** quota of workspace */
  quota: WorkspaceQuotaType;
  /** Get recently updated docs of a workspace */
  recentlyUpdatedDocs: PaginatedDocType;
  /** Role of current signed in user in workspace */
  role: Permission;
  /** Search a specific table */
  search: SearchResultObjectType;
  /** Search docs by keyword */
  searchDocs: Array<SearchDocObjectType>;
  /** The team subscription of the workspace, if exists. */
  subscription: Maybe<SubscriptionType>;
  /** if workspace is team workspace */
  team: Scalars['Boolean']['output'];
}

export interface WorkspaceTypeAggregateArgs {
  input: AggregateInput;
}

export interface WorkspaceTypeBlobUploadPartUrlArgs {
  docScopeId?: InputMaybe<Scalars['String']['input']>;
  key: Scalars['String']['input'];
  partNumber: Scalars['Int']['input'];
  uploadId: Scalars['String']['input'];
}

export interface WorkspaceTypeByokUsageArgs {
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
}

export interface WorkspaceTypeCommentChangesArgs {
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
}

export interface WorkspaceTypeCommentsArgs {
  docId: Scalars['String']['input'];
  pagination?: InputMaybe<PaginationInput>;
}

export interface WorkspaceTypeDocArgs {
  docId: Scalars['String']['input'];
}

export interface WorkspaceTypeDocsArgs {
  pagination: PaginationInput;
}

export interface WorkspaceTypeHistoriesArgs {
  before?: InputMaybe<Scalars['DateTime']['input']>;
  guid: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface WorkspaceTypeInvoicesArgs {
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface WorkspaceTypeMembersArgs {
  query?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}

export interface WorkspaceTypePageMetaArgs {
  pageId: Scalars['String']['input'];
}

export interface WorkspaceTypeRecentlyUpdatedDocsArgs {
  pagination: PaginationInput;
}

export interface WorkspaceTypeSearchArgs {
  input: SearchInput;
}

export interface WorkspaceTypeSearchDocsArgs {
  input: SearchDocsInput;
}

export interface WorkspaceUserType {
  __typename?: 'WorkspaceUserType';
  avatarUrl: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
}

export interface WrongSignInCredentialsDataType {
  __typename?: 'WrongSignInCredentialsDataType';
  email: Scalars['String']['output'];
}

export interface TokenType {
  __typename?: 'tokenType';
  refresh: Scalars['String']['output'];
  sessionToken: Maybe<Scalars['String']['output']>;
  token: Scalars['String']['output'];
}

export type AdminAiProfilesQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type AdminAiProfilesQuery = {
  __typename?: 'Query';
  adminAiProfiles: Array<{
    __typename?: 'AdminAiProfileType';
    id: string;
    workspaceId: string;
    workspaceName: string | null;
    name: string;
    description: string | null;
    enabled: boolean;
    isDefault: boolean;
    credentialIds: Array<string>;
    createdAt: string;
    updatedAt: string;
    credentials: Array<{
      __typename?: 'AdminAiProfileCredentialType';
      id: string;
      provider: string;
      name: string;
      modelId: string | null;
      enabled: boolean;
    }>;
  }>;
};

export type AdminAllSharedLinksQueryVariables = Exact<{
  pagination: PaginationInput;
  filter?: InputMaybe<AdminAllSharedLinksFilterInput>;
}>;

export type AdminAllSharedLinksQuery = {
  __typename?: 'Query';
  adminAllSharedLinks: {
    __typename?: 'PaginatedAdminAllSharedLink';
    totalCount: number | null;
    analyticsWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    edges: Array<{
      __typename?: 'AdminAllSharedLinkEdge';
      cursor: string;
      node: {
        __typename?: 'AdminAllSharedLink';
        workspaceId: string;
        docId: string;
        title: string | null;
        publishedAt: string | null;
        docUpdatedAt: string | null;
        workspaceOwnerId: string | null;
        lastUpdaterId: string | null;
        shareUrl: string;
        views: number | null;
        uniqueViews: number | null;
        guestViews: number | null;
        lastAccessedAt: string | null;
      };
    }>;
  };
};

export type AdminDashboardQueryVariables = Exact<{
  input?: InputMaybe<AdminDashboardInput>;
}>;

export type AdminDashboardQuery = {
  __typename?: 'Query';
  adminDashboard: {
    __typename?: 'AdminDashboard';
    syncActiveUsers: number;
    copilotConversations: number;
    workspaceStorageBytes: number;
    blobStorageBytes: number;
    generatedAt: string;
    syncActiveUsersTimeline: Array<{
      __typename?: 'AdminDashboardMinutePoint';
      minute: string;
      activeUsers: number;
    }>;
    syncWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    copilotWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    workspaceStorageHistory: Array<{
      __typename?: 'AdminDashboardValueDayPoint';
      date: string;
      value: number;
    }>;
    blobStorageHistory: Array<{
      __typename?: 'AdminDashboardValueDayPoint';
      date: string;
      value: number;
    }>;
    storageWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    topSharedLinks: Array<{
      __typename?: 'AdminSharedLinkTopItem';
      workspaceId: string;
      docId: string;
      title: string | null;
      shareUrl: string;
      publishedAt: string | null;
      views: number;
      uniqueViews: number;
      guestViews: number;
      lastAccessedAt: string | null;
    }>;
    topSharedLinksWindow: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
  };
};

export type AdminMailDeliveriesQueryVariables = Exact<{
  input?: InputMaybe<AdminMailDeliveriesInput>;
}>;

export type AdminMailDeliveriesQuery = {
  __typename?: 'Query';
  adminMailDeliveries: {
    __typename?: 'AdminMailDeliveryAnalytics';
    window: {
      __typename?: 'TimeWindow';
      from: string;
      to: string;
      timezone: string;
      bucket: TimeBucket;
      requestedSize: number;
      effectiveSize: number;
    };
    summary: {
      __typename?: 'AdminMailDeliverySummary';
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      canceled: number;
      queued: number;
      sending: number;
      retryWait: number;
      successRate: number;
    };
    byStatus: Array<{
      __typename?: 'AdminMailDeliverySeries';
      key: string;
      label: string;
      total: number;
      points: Array<{
        __typename?: 'AdminMailDeliveryPoint';
        bucket: string;
        count: number;
      }>;
    }>;
    byType: Array<{
      __typename?: 'AdminMailDeliverySeries';
      key: string;
      label: string;
      total: number;
      points: Array<{
        __typename?: 'AdminMailDeliveryPoint';
        bucket: string;
        count: number;
      }>;
    }>;
    byOutcome: Array<{
      __typename?: 'AdminMailDeliverySeries';
      key: string;
      label: string;
      total: number;
      points: Array<{
        __typename?: 'AdminMailDeliveryPoint';
        bucket: string;
        count: number;
      }>;
    }>;
  };
};

export type AdminServerConfigQueryVariables = Exact<{ [key: string]: never }>;

export type AdminServerConfigQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    version: string;
    baseUrl: string;
    name: string;
    features: Array<ServerFeature>;
    type: ServerDeploymentType;
    initialized: boolean;
    availableUserFeatures: Array<FeatureType>;
    credentialsRequirement: {
      __typename?: 'CredentialsRequirementType';
      password: {
        __typename?: 'PasswordLimitsType';
        minLength: number;
        maxLength: number;
      };
    };
    availableUpgrade: {
      __typename?: 'ReleaseVersionType';
      changelog: string;
      version: string;
      publishedAt: string;
      url: string;
    } | null;
  };
};

export type AdminUpdateWorkspaceMutationVariables = Exact<{
  input: AdminUpdateWorkspaceInput;
}>;

export type AdminUpdateWorkspaceMutation = {
  __typename?: 'Mutation';
  adminUpdateWorkspace: {
    __typename?: 'AdminWorkspace';
    id: string;
    public: boolean;
    createdAt: string;
    name: string | null;
    avatarKey: string | null;
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    memberCount: number;
    publicPageCount: number;
    snapshotCount: number;
    snapshotSize: number;
    blobCount: number;
    blobSize: number;
    owner: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
  } | null;
};

export type AdminUserAiProfileAssignmentQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type AdminUserAiProfileAssignmentQuery = {
  __typename?: 'Query';
  adminUserAiProfileAssignment: {
    __typename?: 'AdminUserAiProfileAssignmentType';
    userId: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    profile: {
      __typename?: 'AdminAiProfileType';
      id: string;
      workspaceId: string;
      workspaceName: string | null;
      name: string;
      description: string | null;
      enabled: boolean;
      isDefault: boolean;
      credentialIds: Array<string>;
      createdAt: string;
      updatedAt: string;
      credentials: Array<{
        __typename?: 'AdminAiProfileCredentialType';
        id: string;
        provider: string;
        name: string;
        modelId: string | null;
        enabled: boolean;
      }>;
    };
  } | null;
};

export type AdminWorkspaceByokScopesQueryVariables = Exact<{
  keyword?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['SafeInt']['input']>;
}>;

export type AdminWorkspaceByokScopesQuery = {
  __typename?: 'Query';
  adminWorkspaceByokScopes: Array<{
    __typename?: 'AdminWorkspaceByokScopeType';
    id: string;
    name: string | null;
    enableAi: boolean;
    memberCount: number;
  }>;
};

export type AdminWorkspaceByokSettingsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type AdminWorkspaceByokSettingsQuery = {
  __typename?: 'Query';
  adminWorkspaceByokSettings: {
    __typename?: 'WorkspaceByokSettingsType';
    workspaceId: string;
    entitled: boolean;
    serverEntitled: boolean;
    allowedProviders: Array<ByokProvider>;
    customEndpointSupported: boolean;
    privateEndpointSupported: boolean;
    keys: Array<{
      __typename?: 'WorkspaceByokKeyConfigType';
      id: string;
      provider: ByokProvider;
      name: string;
      description: string | null;
      storage: ByokKeyStorage;
      configured: boolean;
      enabled: boolean;
      endpoint: string | null;
      modelId: string | null;
      endpointEditable: boolean;
      sortOrder: number;
      capabilities: Array<string>;
      testStatus: ByokKeyTestStatus;
      disabledReason: string | null;
      lastTestedAt: string | null;
      lastTestError: string | null;
      lastUsedAt: string | null;
      lastErrorAt: string | null;
      lastError: string | null;
    }>;
    warnings: Array<{
      __typename?: 'WorkspaceByokCapabilityWarningType';
      featureKind: string;
      reason: string;
      requiredProviders: Array<ByokProvider>;
    }>;
  };
};

export type AdminWorkspaceQueryVariables = Exact<{
  id: Scalars['String']['input'];
  memberSkip?: InputMaybe<Scalars['Int']['input']>;
  memberTake?: InputMaybe<Scalars['Int']['input']>;
  memberQuery?: InputMaybe<Scalars['String']['input']>;
}>;

export type AdminWorkspaceQuery = {
  __typename?: 'Query';
  adminWorkspace: {
    __typename?: 'AdminWorkspace';
    id: string;
    public: boolean;
    createdAt: string;
    name: string | null;
    avatarKey: string | null;
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    memberCount: number;
    publicPageCount: number;
    snapshotCount: number;
    snapshotSize: number;
    blobCount: number;
    blobSize: number;
    owner: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
    sharedLinks: Array<{
      __typename?: 'AdminWorkspaceSharedLink';
      docId: string;
      title: string | null;
      publishedAt: string | null;
    }>;
    members: Array<{
      __typename?: 'AdminWorkspaceMember';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      role: AdminWorkspaceMemberRole;
      status: WorkspaceMemberStatus;
    }>;
  } | null;
};

export type AdminWorkspacesQueryVariables = Exact<{
  filter: ListWorkspaceInput;
}>;

export type AdminWorkspacesQuery = {
  __typename?: 'Query';
  adminWorkspaces: Array<{
    __typename?: 'AdminWorkspace';
    id: string;
    public: boolean;
    createdAt: string;
    name: string | null;
    avatarKey: string | null;
    enableAi: boolean;
    enableSharing: boolean;
    enableUrlPreview: boolean;
    enableDocEmbedding: boolean;
    memberCount: number;
    publicPageCount: number;
    snapshotCount: number;
    snapshotSize: number;
    blobCount: number;
    blobSize: number;
    owner: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    } | null;
  }>;
};

export type AdminWorkspacesCountQueryVariables = Exact<{
  filter: ListWorkspaceInput;
}>;

export type AdminWorkspacesCountQuery = {
  __typename?: 'Query';
  adminWorkspacesCount: number;
};

export type AuthSigningKeysQueryVariables = Exact<{ [key: string]: never }>;

export type AuthSigningKeysQuery = {
  __typename?: 'Query';
  authSigningKeys: Array<{
    __typename?: 'AuthSigningKeyType';
    id: string;
    status: string;
    source: string;
    createdAt: string | null;
    retiredAt: string | null;
    verifyUntil: string | null;
    canDelete: boolean;
  }>;
};

export type CreateChangePasswordUrlMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;

export type CreateChangePasswordUrlMutation = {
  __typename?: 'Mutation';
  createChangePasswordUrl: string;
};

export type AppConfigQueryVariables = Exact<{ [key: string]: never }>;

export type AppConfigQuery = { __typename?: 'Query'; appConfig: any };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;

export type CreateUserMutation = {
  __typename?: 'Mutation';
  createUser: { __typename?: 'UserType'; id: string };
};

export type DeleteAdminAiProfileMutationVariables = Exact<{
  workspaceId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
}>;

export type DeleteAdminAiProfileMutation = {
  __typename?: 'Mutation';
  deleteAdminAiProfile: boolean;
};

export type DeleteAuthSigningKeyMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteAuthSigningKeyMutation = {
  __typename?: 'Mutation';
  deleteAuthSigningKey: Array<{
    __typename?: 'AuthSigningKeyType';
    id: string;
    status: string;
    source: string;
    createdAt: string | null;
    retiredAt: string | null;
    verifyUntil: string | null;
    canDelete: boolean;
  }>;
};

export type DeleteUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteUserMutation = {
  __typename?: 'Mutation';
  deleteUser: { __typename?: 'DeleteAccount'; success: boolean };
};

export type DisableUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DisableUserMutation = {
  __typename?: 'Mutation';
  banUser: { __typename?: 'UserType'; email: string; disabled: boolean };
};

export type EnableUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type EnableUserMutation = {
  __typename?: 'Mutation';
  enableUser: { __typename?: 'UserType'; email: string; disabled: boolean };
};

export type GetUserByEmailQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type GetUserByEmailQuery = {
  __typename?: 'Query';
  userByEmail: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    features: Array<FeatureType>;
    hasPassword: boolean | null;
    emailVerified: boolean;
    avatarUrl: string | null;
    disabled: boolean;
  } | null;
};

export type ImportUsersMutationVariables = Exact<{
  input: ImportUsersInput;
}>;

export type ImportUsersMutation = {
  __typename?: 'Mutation';
  importUsers: Array<
    | { __typename: 'UserImportFailedType'; email: string; error: string }
    | { __typename: 'UserType'; id: string; name: string; email: string }
  >;
};

export type ListUsersQueryVariables = Exact<{
  filter: ListUserInput;
}>;

export type ListUsersQuery = {
  __typename?: 'Query';
  usersCount: number;
  users: Array<{
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    disabled: boolean;
    features: Array<FeatureType>;
    hasPassword: boolean | null;
    emailVerified: boolean;
    avatarUrl: string | null;
  }>;
};

export type RotateAuthSigningKeyMutationVariables = Exact<{
  expectedActiveKeyId: Scalars['String']['input'];
}>;

export type RotateAuthSigningKeyMutation = {
  __typename?: 'Mutation';
  rotateAuthSigningKey: Array<{
    __typename?: 'AuthSigningKeyType';
    id: string;
    status: string;
    source: string;
    createdAt: string | null;
    retiredAt: string | null;
    verifyUntil: string | null;
    canDelete: boolean;
  }>;
};

export type SendTestEmailMutationVariables = Exact<{
  name: Scalars['String']['input'];
  host: Scalars['String']['input'];
  port: Scalars['Int']['input'];
  sender: Scalars['String']['input'];
  username: Scalars['String']['input'];
  password: Scalars['String']['input'];
  ignoreTLS: Scalars['Boolean']['input'];
}>;

export type SendTestEmailMutation = {
  __typename?: 'Mutation';
  sendTestEmail: boolean;
};

export type SetAdminUserAiProfileAssignmentMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  profileId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type SetAdminUserAiProfileAssignmentMutation = {
  __typename?: 'Mutation';
  setAdminUserAiProfileAssignment: {
    __typename?: 'AdminUserAiProfileAssignmentType';
    userId: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    profile: {
      __typename?: 'AdminAiProfileType';
      id: string;
      workspaceId: string;
      workspaceName: string | null;
      name: string;
      enabled: boolean;
      isDefault: boolean;
    };
  } | null;
};

export type UpdateAccountFeaturesMutationVariables = Exact<{
  userId: Scalars['String']['input'];
  features: Array<FeatureType> | FeatureType;
}>;

export type UpdateAccountFeaturesMutation = {
  __typename?: 'Mutation';
  updateUserFeatures: Array<FeatureType>;
};

export type UpdateAccountMutationVariables = Exact<{
  id: Scalars['String']['input'];
  input: ManageUserInput;
}>;

export type UpdateAccountMutation = {
  __typename?: 'Mutation';
  updateUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
  };
};

export type UpdateAppConfigMutationVariables = Exact<{
  updates: Array<UpdateAppConfigInput> | UpdateAppConfigInput;
}>;

export type UpdateAppConfigMutation = {
  __typename?: 'Mutation';
  updateAppConfig: any;
};

export type UpsertAdminAiProfileMutationVariables = Exact<{
  input: UpsertAdminAiProfileInput;
}>;

export type UpsertAdminAiProfileMutation = {
  __typename?: 'Mutation';
  upsertAdminAiProfile: {
    __typename?: 'AdminAiProfileType';
    id: string;
    workspaceId: string;
    workspaceName: string | null;
    name: string;
    description: string | null;
    enabled: boolean;
    isDefault: boolean;
    credentialIds: Array<string>;
    createdAt: string;
    updatedAt: string;
    credentials: Array<{
      __typename?: 'AdminAiProfileCredentialType';
      id: string;
      provider: string;
      name: string;
      modelId: string | null;
      enabled: boolean;
    }>;
  };
};

export type ValidateConfigQueryVariables = Exact<{
  updates: Array<UpdateAppConfigInput> | UpdateAppConfigInput;
}>;

export type ValidateConfigQuery = {
  __typename?: 'Query';
  validateAppConfig: Array<{
    __typename?: 'AppConfigValidateResult';
    module: string;
    key: string;
    value: unknown;
    valid: boolean;
    error: string | null;
  }>;
};

export type DeleteBlobMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  permanently?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type DeleteBlobMutation = {
  __typename?: 'Mutation';
  deleteBlob: boolean;
};

export type ListBlobsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ListBlobsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    blobs: Array<{
      __typename?: 'ListedBlob';
      key: string;
      size: number;
      mime: string;
      createdAt: string;
    }>;
  };
};

export type ReleaseDeletedBlobsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ReleaseDeletedBlobsMutation = {
  __typename?: 'Mutation';
  releaseDeletedBlobs: boolean;
};

export type SetBlobMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  blob: Scalars['Upload']['input'];
  docScopeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type SetBlobMutation = { __typename?: 'Mutation'; setBlob: string };

export type AbortBlobUploadMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  uploadId: Scalars['String']['input'];
  docScopeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type AbortBlobUploadMutation = {
  __typename?: 'Mutation';
  abortBlobUpload: boolean;
};

export type CompleteBlobUploadMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  uploadId?: InputMaybe<Scalars['String']['input']>;
  parts?: InputMaybe<Array<BlobUploadPartInput> | BlobUploadPartInput>;
  docScopeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type CompleteBlobUploadMutation = {
  __typename?: 'Mutation';
  completeBlobUpload: string;
};

export type CreateBlobUploadMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  size: Scalars['Int']['input'];
  mime: Scalars['String']['input'];
  docScopeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type CreateBlobUploadMutation = {
  __typename?: 'Mutation';
  createBlobUpload: {
    __typename?: 'BlobUploadInit';
    method: BlobUploadMethod;
    blobKey: string;
    alreadyUploaded: boolean | null;
    uploadUrl: string | null;
    headers: any | null;
    expiresAt: string | null;
    uploadId: string | null;
    partSize: number | null;
    uploadedParts: Array<{
      __typename?: 'BlobUploadedPart';
      partNumber: number;
      etag: string;
    }> | null;
  };
};

export type GetBlobUploadPartUrlQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  uploadId: Scalars['String']['input'];
  partNumber: Scalars['Int']['input'];
  docScopeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetBlobUploadPartUrlQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    blobUploadPartUrl: {
      __typename?: 'BlobUploadPart';
      uploadUrl: string;
      headers: any | null;
      expiresAt: string | null;
    };
  };
};

export type CalendarAccountsQueryVariables = Exact<{ [key: string]: never }>;

export type CalendarAccountsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    calendarAccounts: Array<{
      __typename?: 'CalendarAccountObjectType';
      id: string;
      provider: CalendarProviderType;
      providerAccountId: string;
      displayName: string | null;
      email: string | null;
      status: string;
      lastError: string | null;
      refreshIntervalMinutes: number;
      calendarsCount: number;
      createdAt: string;
      updatedAt: string;
      calendars: Array<{
        __typename?: 'CalendarSubscriptionObjectType';
        id: string;
        accountId: string;
        provider: CalendarProviderType;
        externalCalendarId: string;
        displayName: string | null;
        timezone: string | null;
        color: string | null;
        enabled: boolean;
        lastSyncAt: string | null;
      }>;
    }>;
  } | null;
};

export type CalendarEventsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
}>;

export type CalendarEventsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    calendars: Array<{
      __typename?: 'WorkspaceCalendarObjectType';
      id: string;
      events: Array<{
        __typename?: 'CalendarEventObjectType';
        id: string;
        subscriptionId: string;
        externalEventId: string;
        recurrenceId: string | null;
        status: string | null;
        title: string | null;
        description: string | null;
        location: string | null;
        startAtUtc: string;
        endAtUtc: string;
        originalTimezone: string | null;
        allDay: boolean;
      }>;
    }>;
  };
};

export type CalendarProvidersQueryVariables = Exact<{ [key: string]: never }>;

export type CalendarProvidersQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    calendarProviders: Array<CalendarProviderType>;
    calendarCalDAVProviders: Array<{
      __typename?: 'CalendarCalDAVProviderPresetObjectType';
      id: string;
      label: string;
      requiresAppPassword: boolean | null;
      docsUrl: string | null;
    }>;
  };
};

export type LinkCalDavAccountMutationVariables = Exact<{
  input: LinkCalDavAccountInput;
}>;

export type LinkCalDavAccountMutation = {
  __typename?: 'Mutation';
  linkCalDAVAccount: {
    __typename?: 'CalendarAccountObjectType';
    id: string;
    provider: CalendarProviderType;
    providerAccountId: string;
    displayName: string | null;
    email: string | null;
    status: string;
    lastError: string | null;
    refreshIntervalMinutes: number;
    calendarsCount: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type LinkCalendarAccountMutationVariables = Exact<{
  input: LinkCalendarAccountInput;
}>;

export type LinkCalendarAccountMutation = {
  __typename?: 'Mutation';
  linkCalendarAccount: string;
};

export type UnlinkCalendarAccountMutationVariables = Exact<{
  accountId: Scalars['String']['input'];
}>;

export type UnlinkCalendarAccountMutation = {
  __typename?: 'Mutation';
  unlinkCalendarAccount: boolean;
};

export type UpdateCalendarAccountMutationVariables = Exact<{
  accountId: Scalars['String']['input'];
  refreshIntervalMinutes: Scalars['Int']['input'];
}>;

export type UpdateCalendarAccountMutation = {
  __typename?: 'Mutation';
  updateCalendarAccount: {
    __typename?: 'CalendarAccountObjectType';
    id: string;
    provider: CalendarProviderType;
    providerAccountId: string;
    displayName: string | null;
    email: string | null;
    status: string;
    lastError: string | null;
    refreshIntervalMinutes: number;
    calendarsCount: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type UpdateWorkspaceCalendarsMutationVariables = Exact<{
  input: UpdateWorkspaceCalendarsInput;
}>;

export type UpdateWorkspaceCalendarsMutation = {
  __typename?: 'Mutation';
  updateWorkspaceCalendars: {
    __typename?: 'WorkspaceCalendarObjectType';
    id: string;
    workspaceId: string;
    createdByUserId: string;
    displayNameOverride: string | null;
    colorOverride: string | null;
    enabled: boolean;
    items: Array<{
      __typename?: 'WorkspaceCalendarItemObjectType';
      id: string;
      subscriptionId: string;
      sortOrder: number | null;
      colorOverride: string | null;
      enabled: boolean;
    }>;
  };
};

export type WorkspaceCalendarsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type WorkspaceCalendarsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    calendars: Array<{
      __typename?: 'WorkspaceCalendarObjectType';
      id: string;
      workspaceId: string;
      createdByUserId: string;
      displayNameOverride: string | null;
      colorOverride: string | null;
      enabled: boolean;
      items: Array<{
        __typename?: 'WorkspaceCalendarItemObjectType';
        id: string;
        subscriptionId: string;
        sortOrder: number | null;
        colorOverride: string | null;
        enabled: boolean;
      }>;
    }>;
  };
};

export type CancelSubscriptionMutationVariables = Exact<{
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type CancelSubscriptionMutation = {
  __typename?: 'Mutation';
  cancelSubscription: {
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    nextBillAt: string | null;
    canceledAt: string | null;
  };
};

export type ChangeEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
  email: Scalars['String']['input'];
}>;

export type ChangeEmailMutation = {
  __typename?: 'Mutation';
  changeEmail: { __typename?: 'UserType'; id: string; email: string };
};

export type ChangePasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  userId: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
}>;

export type ChangePasswordMutation = {
  __typename?: 'Mutation';
  changePassword: boolean;
};

export type ListCommentChangesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type ListCommentChangesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    commentChanges: {
      __typename?: 'PaginatedCommentChangeObjectType';
      totalCount: number;
      edges: Array<{
        __typename?: 'CommentChangeObjectTypeEdge';
        cursor: string;
        node: {
          __typename?: 'CommentChangeObjectType';
          action: CommentChangeAction;
          id: string;
          commentId: string | null;
          item: any;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        startCursor: string | null;
        endCursor: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  };
};

export type CreateCommentMutationVariables = Exact<{
  input: CommentCreateInput;
}>;

export type CreateCommentMutation = {
  __typename?: 'Mutation';
  createComment: {
    __typename?: 'CommentObjectType';
    id: string;
    content: any;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    replies: Array<{
      __typename?: 'ReplyObjectType';
      commentId: string;
      id: string;
      content: any;
      createdAt: string;
      updatedAt: string;
      user: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  };
};

export type DeleteCommentMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteCommentMutation = {
  __typename?: 'Mutation';
  deleteComment: boolean;
};

export type ListCommentsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination?: InputMaybe<PaginationInput>;
}>;

export type ListCommentsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    comments: {
      __typename?: 'PaginatedCommentObjectType';
      totalCount: number;
      edges: Array<{
        __typename?: 'CommentObjectTypeEdge';
        cursor: string;
        node: {
          __typename?: 'CommentObjectType';
          id: string;
          content: any;
          resolved: boolean;
          createdAt: string;
          updatedAt: string;
          user: {
            __typename?: 'PublicUserType';
            id: string;
            name: string;
            avatarUrl: string | null;
          };
          replies: Array<{
            __typename?: 'ReplyObjectType';
            commentId: string;
            id: string;
            content: any;
            createdAt: string;
            updatedAt: string;
            user: {
              __typename?: 'PublicUserType';
              id: string;
              name: string;
              avatarUrl: string | null;
            };
          }>;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        startCursor: string | null;
        endCursor: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  };
};

export type CreateReplyMutationVariables = Exact<{
  input: ReplyCreateInput;
}>;

export type CreateReplyMutation = {
  __typename?: 'Mutation';
  createReply: {
    __typename?: 'ReplyObjectType';
    commentId: string;
    id: string;
    content: any;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
};

export type DeleteReplyMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteReplyMutation = {
  __typename?: 'Mutation';
  deleteReply: boolean;
};

export type UpdateReplyMutationVariables = Exact<{
  input: ReplyUpdateInput;
}>;

export type UpdateReplyMutation = {
  __typename?: 'Mutation';
  updateReply: boolean;
};

export type ResolveCommentMutationVariables = Exact<{
  input: CommentResolveInput;
}>;

export type ResolveCommentMutation = {
  __typename?: 'Mutation';
  resolveComment: boolean;
};

export type UpdateCommentMutationVariables = Exact<{
  input: CommentUpdateInput;
}>;

export type UpdateCommentMutation = {
  __typename?: 'Mutation';
  updateComment: boolean;
};

export type UploadCommentAttachmentMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  attachment: Scalars['Upload']['input'];
}>;

export type UploadCommentAttachmentMutation = {
  __typename?: 'Mutation';
  uploadCommentAttachment: string;
};

export type ApproveCopilotAccessRequestMutationVariables = Exact<{
  input: ResolveCopilotAccessRequestInput;
}>;

export type ApproveCopilotAccessRequestMutation = {
  __typename?: 'Mutation';
  approveCopilotAccessRequest: {
    __typename?: 'CopilotAccessRequestType';
    id: string;
    status: string;
    resolvedByUserId: string | null;
    resolutionReason: string | null;
    resolvedAt: string | null;
    updatedAt: string;
  };
};

export type RejectCopilotAccessRequestMutationVariables = Exact<{
  input: ResolveCopilotAccessRequestInput;
}>;

export type RejectCopilotAccessRequestMutation = {
  __typename?: 'Mutation';
  rejectCopilotAccessRequest: {
    __typename?: 'CopilotAccessRequestType';
    id: string;
    status: string;
    resolvedByUserId: string | null;
    resolutionReason: string | null;
    resolvedAt: string | null;
    updatedAt: string;
  };
};

export type WithdrawCopilotAccessRequestMutationVariables = Exact<{
  input: ResolveCopilotAccessRequestInput;
}>;

export type WithdrawCopilotAccessRequestMutation = {
  __typename?: 'Mutation';
  withdrawCopilotAccessRequest: {
    __typename?: 'CopilotAccessRequestType';
    id: string;
    status: string;
    resolvedByUserId: string | null;
    resolutionReason: string | null;
    resolvedAt: string | null;
    updatedAt: string;
  };
};

export type GetCopilotActionRunPreparedRouteTraceQueryVariables = Exact<{
  runId: Scalars['String']['input'];
  workspaceId: Scalars['String']['input'];
}>;

export type GetCopilotActionRunPreparedRouteTraceQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      actionRunPreparedRouteTrace: {
        __typename?: 'CopilotActionRunPreparedRouteDiagnosticsType';
        status: string;
        type: string;
        steps: Array<{
          __typename?: 'CopilotActionRunPreparedRouteDiagnosticsStepType';
          actualRouteCount: number;
          fallbackProviderIds: Array<string>;
          kind: string;
          requestedModelId: string | null;
          requestedModelSource: string | null;
          routeCount: number;
          routeCountMismatch: boolean;
          stepId: string;
          routes: Array<{
            __typename?: 'CopilotActionRunPreparedRouteDiagnosticsRouteType';
            behaviorFlags: Array<string> | null;
            canonicalModelKey: string | null;
            dimensionMismatch: boolean | null;
            fallbackOrderIndex: number | null;
            modelId: string;
            modelBackendKind: string | null;
            modelEmbeddingDimensions: number | null;
            protocol: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerHealth: string | null;
            providerHealthCheckedAt: string | null;
            providerHealthLastError: string | null;
            providerId: string;
            providerName: string | null;
            providerPrivacy: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            requestLayer: string | null;
            requestedDimensions: number | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            routeRawModelId: string | null;
            routeIndex: number;
          }>;
        }>;
      } | null;
    };
  } | null;
};

export type GetCopilotActionRunsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}>;

export type GetCopilotActionRunsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      actionRuns: Array<{
        __typename?: 'CopilotActionRunDiagnosticsItemType';
        actionId: string;
        actionVersion: string;
        agentRuntimeDiagnosticsFingerprint: string;
        agentRuntimeNativeTraceEventTypes: Array<string>;
        agentRuntimeProjectedSchemaComponents: Array<string>;
        agentRuntimeProjectedRunStatuses: Array<string>;
        agentRuntimeProjectedStepStatuses: Array<string>;
        agentRuntimeProjectedStepTypes: Array<string>;
        agentRuntimeProjectedTimelineEventTypes: Array<string>;
        agentRuntimeProjectionContractFingerprint: string;
        agentRuntimeProjectionSource: string;
        agentRuntimeProjectionGaps: Array<string>;
        agentRuntimeRunStatusGaps: Array<string>;
        agentRuntimeRunId: string;
        agentRuntimeRunStatus: string;
        agentRuntimeSchemaReadiness: string;
        agentRuntimeSchemaReadinessGaps: Array<string>;
        agentRuntimeStepCount: number;
        agentRuntimeStepStatusGaps: Array<string>;
        agentRuntimeStepIds: Array<string>;
        agentRuntimeStepKinds: Array<string>;
        agentRuntimeStepStatuses: Array<string>;
        agentRuntimeStepTypes: Array<string>;
        agentRuntimeTimelineEntries: Array<string>;
        agentRuntimeTimelineEventTypes: Array<string>;
        agentRuntimeTimelineGaps: Array<string>;
        agentRuntimeTimelineRouteEvidenceSetFingerprint: string;
        agentRuntimeTargetRunStatuses: Array<string>;
        agentRuntimeTargetSchemaComponents: Array<string>;
        agentRuntimeTargetStepStatuses: Array<string>;
        agentRuntimeTargetStepTypes: Array<string>;
        agentRuntimeTargetTimelineEventTypes: Array<string>;
        agentRuntimeUnsupportedRunStatuses: Array<string>;
        agentRuntimeUnsupportedStepStatuses: Array<string>;
        agentRuntimeUnsupportedStepTypes: Array<string>;
        agentRuntimeUnsupportedTimelineEventTypes: Array<string>;
        attempt: number;
        createdAt: string;
        docId: string | null;
        errorCode: string | null;
        hasPreparedRouteTrace: boolean;
        id: string;
        preparedRouteActualCount: number;
        preparedRouteCount: number;
        preparedRouteBehaviorFlags: Array<string>;
        preparedRouteCanonicalModelKeys: Array<string>;
        preparedRouteDimensionEvidence: Array<string>;
        preparedRouteFallbackProviderIds: Array<string>;
        preparedRouteFallbackOrder: Array<string>;
        preparedRouteModelBackendKinds: Array<string>;
        preparedRouteStepFallbackProviderIds: Array<string>;
        preparedRouteStepIds: Array<string>;
        preparedRouteKinds: Array<string>;
        preparedRouteModelIds: Array<string>;
        preparedRouteOrder: Array<string>;
        preparedRouteProtocols: Array<string>;
        preparedRouteProviderIds: Array<string>;
        preparedRouteRequestedModelIds: Array<string>;
        preparedRouteRequestedModelSources: Array<string>;
        preparedRouteStepRequestedModelSources: Array<string>;
        preparedRouteRequestLayers: Array<string>;
        preparedRouteStepFallbackOrder: Array<string>;
        preparedRouteStepBehaviorFlags: Array<string>;
        preparedRouteStepCanonicalModelKeys: Array<string>;
        preparedRouteStepDimensionEvidence: Array<string>;
        preparedRouteStepModelBackendKinds: Array<string>;
        preparedRouteStepOrder: Array<string>;
        preparedRouteStepRouteCountMismatches: Array<string>;
        preparedRouteStepRouteCounts: Array<string>;
        preparedRouteStepProtocols: Array<string>;
        preparedRouteStepRequestLayers: Array<string>;
        preparedRouteStepCount: number;
        preparedRouteTargets: Array<string>;
        preparedRouteStepTargets: Array<string>;
        preparedRouteRequestedTargets: Array<string>;
        preparedRouteStepRequestedTargets: Array<string>;
        retryOf: string | null;
        sessionId: string | null;
        status: string;
        updatedAt: string;
        agentRuntimeDiagnosticsManifest: {
          __typename?: 'CopilotActionRunAgentRuntimeDiagnosticsManifestType';
          actionId: string;
          actionVersion: string;
          fingerprint: string;
          hasPreparedRouteTrace: boolean;
          nativeTraceEventTypes: Array<string>;
          preparedRouteActualCount: number;
          preparedRouteCount: number;
          preparedRouteStepCount: number;
          projectionContractFingerprint: string;
          projectionGapCount: number;
          projectionSource: string;
          runStatus: string;
          schemaReadiness: string;
          schemaReadinessGapCount: number;
          timelineEventTypes: Array<string>;
          timelineGapCount: number;
          timelineItemCount: number;
          timelineRouteEvidenceSetFingerprint: string;
          version: string;
        };
        agentRuntimeDiagnosticsManifestExportMetadata: {
          __typename?: 'CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadataType';
          actionId: string;
          actionVersion: string;
          artifact: string;
          auditEventCreated: boolean;
          auditEventFingerprint: string;
          auditEventStatus: string;
          auditEventVersion: string;
          boundary: string;
          exportPolicyFingerprint: string;
          exportPolicyStatus: string;
          exportPolicyVersion: string;
          filename: string;
          manifestFingerprint: string;
          manifestVersion: string;
          metadataFilename: string;
          mime: string;
          projectionSource: string;
          retentionPolicyFingerprint: string;
          retentionPolicyStatus: string;
          retentionPolicyVersion: string;
          runId: string;
          runStatus: string;
          schemaReadiness: string;
          version: string;
        };
        agentRuntimeTimelineItems: Array<{
          __typename?: 'CopilotActionRunAgentRuntimeTimelineItemType';
          actualRouteCount: number;
          eventKey: string;
          eventType: string;
          fallbackProviderIds: Array<string>;
          id: string;
          kind: string | null;
          label: string;
          routeBehaviorFlags: Array<string>;
          routeCanonicalModelKeys: Array<string>;
          routeCount: number;
          routeCountMismatch: boolean;
          routeDimensionEvidence: Array<string>;
          routeEvidenceFingerprint: string;
          routeModelBackendKinds: Array<string>;
          routeTargets: Array<string>;
          runId: string;
          sequence: number;
          status: string;
          stepId: string | null;
          stepType: string | null;
        }>;
      }>;
    };
  } | null;
};

export type GetCopilotAgentRunQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  id: Scalars['String']['input'];
}>;

export type GetCopilotAgentRunQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      agentRuntimeWorkflowAdapters: Array<{
        __typename?: 'CopilotAgentRuntimeWorkflowAdapterType';
        workflow: string;
        capabilities: {
          __typename?: 'CopilotAgentRuntimeWorkflowAdapterCapabilitiesType';
          version: string;
          supportedStepTypes: Array<string>;
          sideEffectMode: string;
          summary: string;
        };
      }>;
      agentRun: {
        __typename?: 'CopilotAgentRunType';
        actorId: string;
        completedAt: string | null;
        createdAt: string;
        evidenceFingerprint: string;
        executionResultCount: number;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        lastAttemptAt: string | null;
        queuedAt: string | null;
        sourceId: string;
        sourceType: string;
        startedAt: string | null;
        status: string;
        targetFingerprint: string;
        timelineFingerprint: string;
        title: string | null;
        updatedAt: string;
        workerAttempt: number;
        workerLeaseExpiresAt: string | null;
        workerLeaseId: string | null;
        workerMaxAttempts: number;
        workflow: string;
        workspaceId: string;
        executionResults: Array<{
          __typename?: 'CopilotAgentRuntimeExecutionResultType';
          actorId: string;
          adapterWorkflow: string;
          completedAt: string;
          createdAt: string;
          executor: string;
          failureCode: string | null;
          failureMessage: string | null;
          id: string;
          resultFingerprint: string;
          resultPayload: unknown;
          resultStatus: string;
          runId: string;
          sideEffectMode: string;
          sideEffectsApplied: boolean;
          sourceId: string;
          sourceType: string;
          summary: string;
          workerAttempt: number;
          workerLeaseId: string;
          workflow: string;
          workspaceId: string;
        }>;
        steps: Array<{
          __typename?: 'CopilotAgentStepType';
          actorId: string;
          completedAt: string | null;
          createdAt: string;
          evidenceFingerprint: string;
          id: string;
          order: number;
          outputSummary: unknown;
          runId: string;
          startedAt: string | null;
          status: string;
          stepKey: string;
          stepType: string;
          title: string | null;
          updatedAt: string;
          workspaceId: string;
        }>;
        timelineEvents: Array<{
          __typename?: 'CopilotAgentTimelineEventType';
          actorId: string;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          id: string;
          ordinal: number;
          payload: unknown;
          runId: string;
          status: string;
          stepId: string | null;
          summary: string;
          workspaceId: string;
        }>;
      } | null;
    };
  } | null;
};

export type GetCopilotAgentRunsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  filter?: InputMaybe<CopilotAgentRunListFilterInput>;
}>;

export type GetCopilotAgentRunsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      agentRuntimeWorkflowAdapters: Array<{
        __typename?: 'CopilotAgentRuntimeWorkflowAdapterType';
        workflow: string;
        capabilities: {
          __typename?: 'CopilotAgentRuntimeWorkflowAdapterCapabilitiesType';
          version: string;
          supportedStepTypes: Array<string>;
          sideEffectMode: string;
          summary: string;
        };
      }>;
      agentRuns: Array<{
        __typename?: 'CopilotAgentRunType';
        actorId: string;
        completedAt: string | null;
        createdAt: string;
        evidenceFingerprint: string;
        executionResultCount: number;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        lastAttemptAt: string | null;
        queuedAt: string | null;
        sourceId: string;
        sourceType: string;
        startedAt: string | null;
        status: string;
        targetFingerprint: string;
        timelineFingerprint: string;
        title: string | null;
        updatedAt: string;
        workerAttempt: number;
        workerLeaseExpiresAt: string | null;
        workerLeaseId: string | null;
        workerMaxAttempts: number;
        workflow: string;
        workspaceId: string;
        executionResults: Array<{
          __typename?: 'CopilotAgentRuntimeExecutionResultType';
          actorId: string;
          adapterWorkflow: string;
          completedAt: string;
          createdAt: string;
          executor: string;
          failureCode: string | null;
          failureMessage: string | null;
          id: string;
          resultFingerprint: string;
          resultPayload: unknown;
          resultStatus: string;
          runId: string;
          sideEffectMode: string;
          sideEffectsApplied: boolean;
          sourceId: string;
          sourceType: string;
          summary: string;
          workerAttempt: number;
          workerLeaseId: string;
          workflow: string;
          workspaceId: string;
        }>;
        steps: Array<{
          __typename?: 'CopilotAgentStepType';
          actorId: string;
          completedAt: string | null;
          createdAt: string;
          evidenceFingerprint: string;
          id: string;
          order: number;
          outputSummary: unknown;
          runId: string;
          startedAt: string | null;
          status: string;
          stepKey: string;
          stepType: string;
          title: string | null;
          updatedAt: string;
          workspaceId: string;
        }>;
        timelineEvents: Array<{
          __typename?: 'CopilotAgentTimelineEventType';
          actorId: string;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          id: string;
          ordinal: number;
          payload: unknown;
          runId: string;
          status: string;
          stepId: string | null;
          summary: string;
          workspaceId: string;
        }>;
      }>;
    };
  } | null;
};

export type ControlCopilotAgentRuntimeRunMutationVariables = Exact<{
  input: CopilotAgentRuntimeControlInput;
}>;

export type ControlCopilotAgentRuntimeRunMutation = {
  __typename?: 'Mutation';
  controlCopilotAgentRuntimeRun: {
    __typename?: 'CopilotAgentRunType';
    actorId: string;
    completedAt: string | null;
    createdAt: string;
    evidenceFingerprint: string;
    executionResultCount: number;
    failureCode: string | null;
    failureMessage: string | null;
    id: string;
    lastAttemptAt: string | null;
    queuedAt: string | null;
    sourceId: string;
    sourceType: string;
    startedAt: string | null;
    status: string;
    targetFingerprint: string;
    timelineFingerprint: string;
    title: string | null;
    updatedAt: string;
    workerAttempt: number;
    workerLeaseExpiresAt: string | null;
    workerLeaseId: string | null;
    workerMaxAttempts: number;
    workflow: string;
    workspaceId: string;
    executionResults: Array<{
      __typename?: 'CopilotAgentRuntimeExecutionResultType';
      actorId: string;
      adapterWorkflow: string;
      completedAt: string;
      createdAt: string;
      executor: string;
      failureCode: string | null;
      failureMessage: string | null;
      id: string;
      resultFingerprint: string;
      resultPayload: unknown;
      resultStatus: string;
      runId: string;
      sideEffectMode: string;
      sideEffectsApplied: boolean;
      sourceId: string;
      sourceType: string;
      summary: string;
      workerAttempt: number;
      workerLeaseId: string;
      workflow: string;
      workspaceId: string;
    }>;
    steps: Array<{
      __typename?: 'CopilotAgentStepType';
      actorId: string;
      completedAt: string | null;
      createdAt: string;
      evidenceFingerprint: string;
      id: string;
      order: number;
      outputSummary: unknown;
      runId: string;
      startedAt: string | null;
      status: string;
      stepKey: string;
      stepType: string;
      title: string | null;
      updatedAt: string;
      workspaceId: string;
    }>;
    timelineEvents: Array<{
      __typename?: 'CopilotAgentTimelineEventType';
      actorId: string;
      createdAt: string;
      eventFingerprint: string;
      eventType: string;
      id: string;
      ordinal: number;
      payload: unknown;
      runId: string;
      status: string;
      stepId: string | null;
      summary: string;
      workspaceId: string;
    }>;
  };
};

export type RequestCopilotAgentRuntimeDocUpdateMutationVariables = Exact<{
  input: CopilotAgentRuntimeDocUpdateRequestInput;
}>;

export type RequestCopilotAgentRuntimeDocUpdateMutation = {
  __typename?: 'Mutation';
  requestCopilotAgentRuntimeDocUpdate: {
    __typename?: 'CopilotAgentRunType';
    id: string;
    workspaceId: string;
    actorId: string;
    workflow: string;
    sourceType: string;
    sourceId: string;
    status: string;
    title: string | null;
    targetFingerprint: string;
    evidenceFingerprint: string;
    timelineFingerprint: string;
    workerAttempt: number;
    workerMaxAttempts: number;
    createdAt: string;
    updatedAt: string;
    steps: Array<{
      __typename?: 'CopilotAgentStepType';
      id: string;
      stepKey: string;
      stepType: string;
      status: string;
      title: string | null;
      order: number;
      evidenceFingerprint: string;
      outputSummary: unknown;
    }>;
  };
};

export type RequestCopilotAgentRuntimeOfficeCommandMutationVariables = Exact<{
  input: CopilotAgentRuntimeOfficeCommandRequestInput;
}>;

export type RequestCopilotAgentRuntimeOfficeCommandMutation = {
  __typename?: 'Mutation';
  requestCopilotAgentRuntimeOfficeCommand: {
    __typename?: 'CopilotAgentRunType';
    id: string;
    workspaceId: string;
    actorId: string;
    workflow: string;
    sourceType: string;
    sourceId: string;
    status: string;
    title: string | null;
    targetFingerprint: string;
    evidenceFingerprint: string;
    timelineFingerprint: string;
    workerAttempt: number;
    workerMaxAttempts: number;
    createdAt: string;
    updatedAt: string;
    steps: Array<{
      __typename?: 'CopilotAgentStepType';
      id: string;
      stepKey: string;
      stepType: string;
      status: string;
      title: string | null;
      order: number;
      evidenceFingerprint: string;
      outputSummary: unknown;
    }>;
  };
};

export type AbandonCopilotBlockerMutationVariables = Exact<{
  blockerId: Scalars['ID']['input'];
}>;

export type AbandonCopilotBlockerMutation = {
  __typename?: 'Mutation';
  abandonCopilotBlocker: {
    __typename?: 'CopilotBlockerType';
    id: string;
    projectId: string;
    creatorUserId: string;
    title: string;
    type: string;
    waitingOn: string;
    dueAt: string | null;
    overdue: boolean;
    status: string;
    origin: string;
    resolutionActorUserId: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type CreateCopilotBlockerMutationVariables = Exact<{
  input: CreateCopilotBlockerInput;
}>;

export type CreateCopilotBlockerMutation = {
  __typename?: 'Mutation';
  createCopilotBlocker: {
    __typename?: 'CopilotBlockerType';
    id: string;
    projectId: string;
    creatorUserId: string;
    title: string;
    type: string;
    waitingOn: string;
    dueAt: string | null;
    overdue: boolean;
    status: string;
    origin: string;
    resolutionActorUserId: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type ResolveCopilotBlockerMutationVariables = Exact<{
  blockerId: Scalars['ID']['input'];
}>;

export type ResolveCopilotBlockerMutation = {
  __typename?: 'Mutation';
  resolveCopilotBlocker: {
    __typename?: 'CopilotBlockerType';
    id: string;
    projectId: string;
    creatorUserId: string;
    title: string;
    type: string;
    waitingOn: string;
    dueAt: string | null;
    overdue: boolean;
    status: string;
    origin: string;
    resolutionActorUserId: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type ConfirmCopilotBlockerSuggestionMutationVariables = Exact<{
  input: ConfirmCopilotBlockerSuggestionInput;
}>;

export type ConfirmCopilotBlockerSuggestionMutation = {
  __typename?: 'Mutation';
  confirmCopilotBlockerSuggestion: {
    __typename?: 'CopilotBlockerType';
    id: string;
    projectId: string;
    creatorUserId: string;
    title: string;
    type: string;
    waitingOn: string;
    dueAt: string | null;
    overdue: boolean;
    status: string;
    origin: string;
    resolutionActorUserId: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type AddContextBlobMutationVariables = Exact<{
  options: AddContextBlobInput;
}>;

export type AddContextBlobMutation = {
  __typename?: 'Mutation';
  addContextBlob: {
    __typename?: 'CopilotContextBlob';
    id: string;
    createdAt: number;
    status: ContextEmbedStatus | null;
  };
};

export type RemoveContextBlobMutationVariables = Exact<{
  options: RemoveContextBlobInput;
}>;

export type RemoveContextBlobMutation = {
  __typename?: 'Mutation';
  removeContextBlob: boolean;
};

export type AddContextCategoryMutationVariables = Exact<{
  options: AddContextCategoryInput;
}>;

export type AddContextCategoryMutation = {
  __typename?: 'Mutation';
  addContextCategory: {
    __typename?: 'CopilotContextCategory';
    id: string;
    createdAt: number;
    type: ContextCategories;
    docs: Array<{
      __typename?: 'CopilotContextDoc';
      id: string;
      createdAt: number;
      status: ContextEmbedStatus | null;
      snapshotUpdatedAt: number | null;
      updatedAt: number | null;
      isModified: boolean;
    }>;
  };
};

export type RemoveContextCategoryMutationVariables = Exact<{
  options: RemoveContextCategoryInput;
}>;

export type RemoveContextCategoryMutation = {
  __typename?: 'Mutation';
  removeContextCategory: boolean;
};

export type CreateCopilotContextMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
}>;

export type CreateCopilotContextMutation = {
  __typename?: 'Mutation';
  createCopilotContext: string;
};

export type CopilotContextDashboardGetQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  includeDisabled?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type CopilotContextDashboardGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contextSettings: {
        __typename?: 'CopilotContextSettingsType';
        autoMemoryEnabled: boolean;
      };
      contextPlannerStrategies: Array<{
        __typename?: 'CopilotContextStrategyType';
        version: string;
        fingerprint: string;
        status: string;
        checkpointCount: number;
        lastCheckpointAt: string | null;
        traceCount: number;
        lastTraceAt: string | null;
        createdAt: string;
      }>;
      contextProjects: Array<{
        __typename?: 'CopilotContextProjectType';
        id: string;
        createdByUserId: string | null;
        name: string;
        description: string;
        status: string;
        role: string;
        documentCount: number;
        canManage: boolean;
        createdAt: string;
        updatedAt: string;
        documents: Array<{
          __typename?: 'CopilotContextProjectDocumentType';
          workspaceId: string;
          docId: string | null;
          title: string | null;
          groupId: string | null;
          sortOrder: number;
        }>;
      }>;
      contextMemories: Array<{
        __typename?: 'CopilotContextMemoryType';
        id: string;
        ownerUserId: string;
        workspaceId: string | null;
        docId: string | null;
        projectId: string | null;
        sourceSessionId: string | null;
        scope: string;
        kind: string;
        status: string;
        content: string;
        factKey: string | null;
        confidence: number;
        importance: number;
        sensitivity: string;
        captureMode: string;
        writerVersion: string;
        validFrom: string | null;
        validUntil: string | null;
        expiresAt: string | null;
        supersedesId: string | null;
        lastUsedAt: string | null;
        useCount: number;
        createdAt: string;
        updatedAt: string;
      }>;
      contextMemoryEvents: Array<{
        __typename?: 'CopilotContextMemoryEventType';
        id: string;
        sourceSessionId: string | null;
        sourceTurnId: string | null;
        operation: string;
        memoryId: string | null;
        previousMemoryId: string | null;
        targetEventId: string | null;
        factKey: string | null;
        explicit: boolean;
        reasonCode: string;
        writerVersion: string;
        undoneAt: string | null;
        canUndo: boolean;
        createdAt: string;
      }>;
      contextRules: Array<{
        __typename?: 'CopilotContextRuleType';
        id: string;
        ownerUserId: string;
        workspaceId: string | null;
        projectId: string | null;
        scope: string;
        name: string;
        description: string;
        applicationMode: string;
        priority: number;
        conditions: unknown;
        status: string;
        activeRevision: number;
        createdAt: string;
        updatedAt: string;
        revisions: Array<{
          __typename?: 'CopilotContextRuleRevisionType';
          id: string;
          revision: number;
          content: string;
          fingerprint: string;
          createdByUserId: string | null;
          source: string;
          createdAt: string;
        }>;
        hits: Array<{
          __typename?: 'CopilotContextRuleHitType';
          id: string;
          sessionId: string;
          sourceTurnId: string | null;
          matchReason: string;
          score: number;
          createdAt: string;
        }>;
      }>;
      contextPolicies: Array<{
        __typename?: 'CopilotContextPolicyType';
        id: string;
        workspaceId: string;
        name: string;
        description: string;
        applicationMode: string;
        priority: number;
        conditions: unknown;
        status: string;
        activeRevision: number;
        canManage: boolean;
        createdAt: string;
        updatedAt: string;
        revisions: Array<{
          __typename?: 'CopilotContextPolicyRevisionType';
          id: string;
          revision: number;
          content: string;
          fingerprint: string;
          createdByUserId: string | null;
          source: string;
          createdAt: string;
        }>;
        hits: Array<{
          __typename?: 'CopilotContextRuleHitType';
          id: string;
          sessionId: string;
          sourceTurnId: string | null;
          matchReason: string;
          score: number;
          createdAt: string;
        }>;
      }>;
    };
  } | null;
};

export type AddContextDocMutationVariables = Exact<{
  options: AddContextDocInput;
}>;

export type AddContextDocMutation = {
  __typename?: 'Mutation';
  addContextDoc: {
    __typename?: 'CopilotContextDoc';
    id: string;
    createdAt: number;
    status: ContextEmbedStatus | null;
    snapshotUpdatedAt: number | null;
    updatedAt: number | null;
    isModified: boolean;
  };
};

export type RemoveContextDocMutationVariables = Exact<{
  options: RemoveContextDocInput;
}>;

export type RemoveContextDocMutation = {
  __typename?: 'Mutation';
  removeContextDoc: boolean;
};

export type AddContextFileMutationVariables = Exact<{
  content: Scalars['Upload']['input'];
  options: AddContextFileInput;
}>;

export type AddContextFileMutation = {
  __typename?: 'Mutation';
  addContextFile: {
    __typename?: 'CopilotContextFile';
    id: string;
    createdAt: number;
    name: string;
    mimeType: string;
    chunkSize: number;
    error: string | null;
    status: ContextEmbedStatus;
    blobId: string;
  };
};

export type RemoveContextFileMutationVariables = Exact<{
  options: RemoveContextFileInput;
}>;

export type RemoveContextFileMutation = {
  __typename?: 'Mutation';
  removeContextFile: boolean;
};

export type ListContextObjectQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
  contextId: Scalars['String']['input'];
}>;

export type ListContextObjectQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        blobs: Array<{
          __typename?: 'CopilotContextBlob';
          id: string;
          status: ContextEmbedStatus | null;
          createdAt: number;
        }>;
        docs: Array<{
          __typename?: 'CopilotContextDoc';
          id: string;
          status: ContextEmbedStatus | null;
          createdAt: number;
          snapshotUpdatedAt: number | null;
          updatedAt: number | null;
          isModified: boolean;
        }>;
        files: Array<{
          __typename?: 'CopilotContextFile';
          id: string;
          name: string;
          mimeType: string;
          blobId: string;
          chunkSize: number;
          error: string | null;
          status: ContextEmbedStatus;
          createdAt: number;
        }>;
        tags: Array<{
          __typename?: 'CopilotContextCategory';
          type: ContextCategories;
          id: string;
          createdAt: number;
          docs: Array<{
            __typename?: 'CopilotContextDoc';
            id: string;
            status: ContextEmbedStatus | null;
            createdAt: number;
            snapshotUpdatedAt: number | null;
            updatedAt: number | null;
            isModified: boolean;
          }>;
        }>;
        collections: Array<{
          __typename?: 'CopilotContextCategory';
          type: ContextCategories;
          id: string;
          createdAt: number;
          docs: Array<{
            __typename?: 'CopilotContextDoc';
            id: string;
            status: ContextEmbedStatus | null;
            createdAt: number;
            snapshotUpdatedAt: number | null;
            updatedAt: number | null;
            isModified: boolean;
          }>;
        }>;
      }>;
    };
  } | null;
};

export type ListContextQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
}>;

export type ListContextQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        id: string | null;
        workspaceId: string;
      }>;
    };
  } | null;
};

export type MatchContextQueryVariables = Exact<{
  contextId?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}>;

export type MatchContextQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        matchFiles: Array<{
          __typename?: 'ContextMatchedFileChunk';
          fileId: string;
          blobId: string;
          name: string;
          mimeType: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
        matchWorkspaceDocs: Array<{
          __typename?: 'ContextMatchedDocChunk';
          docId: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
      }>;
    };
  } | null;
};

export type MatchWorkspaceDocsQueryVariables = Exact<{
  contextId?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}>;

export type MatchWorkspaceDocsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        matchWorkspaceDocs: Array<{
          __typename?: 'ContextMatchedDocChunk';
          docId: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
      }>;
    };
  } | null;
};

export type MatchFilesQueryVariables = Exact<{
  contextId?: InputMaybe<Scalars['String']['input']>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  scopedThreshold?: InputMaybe<Scalars['Float']['input']>;
  threshold?: InputMaybe<Scalars['Float']['input']>;
}>;

export type MatchFilesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contexts: Array<{
        __typename?: 'CopilotContext';
        matchFiles: Array<{
          __typename?: 'ContextMatchedFileChunk';
          fileId: string;
          blobId: string;
          chunk: number;
          content: string;
          distance: number | null;
        }>;
      }>;
    };
  } | null;
};

export type CopilotContextMemoriesGetQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  docId?: InputMaybe<Scalars['String']['input']>;
  includeDisabled?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type CopilotContextMemoriesGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contextMemories: Array<{
        __typename?: 'CopilotContextMemoryType';
        id: string;
        ownerUserId: string;
        workspaceId: string | null;
        docId: string | null;
        projectId: string | null;
        sourceSessionId: string | null;
        scope: string;
        kind: string;
        status: string;
        content: string;
        createdAt: string;
        updatedAt: string;
      }>;
    };
  } | null;
};

export type CopilotContextMemoryCreateMutationVariables = Exact<{
  input: CreateCopilotContextMemoryInput;
}>;

export type CopilotContextMemoryCreateMutation = {
  __typename?: 'Mutation';
  createCopilotContextMemory: {
    __typename?: 'CopilotContextMemoryType';
    id: string;
    ownerUserId: string;
    workspaceId: string | null;
    docId: string | null;
    projectId: string | null;
    sourceSessionId: string | null;
    scope: string;
    kind: string;
    status: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type CopilotContextMemoryDeleteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type CopilotContextMemoryDeleteMutation = {
  __typename?: 'Mutation';
  deleteCopilotContextMemory: boolean;
};

export type CopilotContextMemoryUpdateMutationVariables = Exact<{
  input: UpdateCopilotContextMemoryInput;
}>;

export type CopilotContextMemoryUpdateMutation = {
  __typename?: 'Mutation';
  updateCopilotContextMemory: {
    __typename?: 'CopilotContextMemoryType';
    id: string;
    ownerUserId: string;
    workspaceId: string | null;
    docId: string | null;
    projectId: string | null;
    sourceSessionId: string | null;
    scope: string;
    kind: string;
    status: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type SetCopilotContextProjectAiPolicyMutationVariables = Exact<{
  input: SetCopilotProjectAiPolicyInput;
}>;

export type SetCopilotContextProjectAiPolicyMutation = {
  __typename?: 'Mutation';
  setCopilotContextProjectAiPolicy: {
    __typename?: 'CopilotProjectAiPolicyType';
    projectId: string;
    policy: string;
    updatedByUserId: string | null;
    updatedAt: string | null;
  };
};

export type CopilotContextProjectCreateMutationVariables = Exact<{
  input: CreateCopilotContextProjectInput;
}>;

export type CopilotContextProjectCreateMutation = {
  __typename?: 'Mutation';
  createCopilotContextProject: {
    __typename?: 'CopilotContextProjectType';
    id: string;
    createdByUserId: string | null;
    name: string;
    description: string;
    status: string;
    aiPolicy: string;
    role: string;
    documentCount: number;
    canManage: boolean;
    createdAt: string;
    updatedAt: string;
    members: Array<{
      __typename?: 'CopilotContextProjectMemberType';
      userId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      role: string;
      createdAt: string;
    }>;
    documents: Array<{
      __typename?: 'CopilotContextProjectDocumentType';
      workspaceId: string;
      docId: string | null;
      title: string | null;
      groupId: string | null;
      sortOrder: number;
      status: string;
      requestedLevel: string;
      accessRequestId: string | null;
      addedByMe: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type CopilotContextProjectDeleteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type CopilotContextProjectDeleteMutation = {
  __typename?: 'Mutation';
  deleteCopilotContextProject: boolean;
};

export type CopilotContextProjectDocumentAddMutationVariables = Exact<{
  input: AddCopilotContextProjectDocumentInput;
}>;

export type CopilotContextProjectDocumentAddMutation = {
  __typename?: 'Mutation';
  addCopilotContextProjectDocument: {
    __typename?: 'CopilotContextProjectDocumentAddResultType';
    outcome: string;
    projectDocument: {
      __typename?: 'CopilotContextProjectDocumentType';
      workspaceId: string;
      docId: string | null;
      title: string | null;
      groupId: string | null;
      sortOrder: number;
      status: string;
      requestedLevel: string;
      accessRequestId: string | null;
      addedByMe: boolean;
      createdAt: string;
      updatedAt: string;
    };
  };
};

export type CopilotContextProjectDocumentRemoveMutationVariables = Exact<{
  input: RemoveCopilotContextProjectDocumentInput;
}>;

export type CopilotContextProjectDocumentRemoveMutation = {
  __typename?: 'Mutation';
  removeCopilotContextProjectDocument: {
    __typename?: 'CopilotContextProjectType';
    id: string;
    role: string;
    documentCount: number;
    canManage: boolean;
    updatedAt: string;
    documents: Array<{
      __typename?: 'CopilotContextProjectDocumentType';
      workspaceId: string;
      docId: string | null;
      title: string | null;
      groupId: string | null;
      sortOrder: number;
      status: string;
      requestedLevel: string;
      accessRequestId: string | null;
      addedByMe: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type CopilotContextProjectDocumentUpdateMutationVariables = Exact<{
  input: UpdateCopilotContextProjectDocumentInput;
}>;

export type CopilotContextProjectDocumentUpdateMutation = {
  __typename?: 'Mutation';
  updateCopilotContextProjectDocument: {
    __typename?: 'CopilotContextProjectType';
    id: string;
    role: string;
    documentCount: number;
    canManage: boolean;
    updatedAt: string;
    documents: Array<{
      __typename?: 'CopilotContextProjectDocumentType';
      workspaceId: string;
      docId: string | null;
      title: string | null;
      groupId: string | null;
      sortOrder: number;
      status: string;
      requestedLevel: string;
      accessRequestId: string | null;
      addedByMe: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type LeaveCopilotContextProjectMutationVariables = Exact<{
  projectId: Scalars['ID']['input'];
}>;

export type LeaveCopilotContextProjectMutation = {
  __typename?: 'Mutation';
  leaveCopilotContextProject: boolean;
};

export type RemoveCopilotContextProjectMemberMutationVariables = Exact<{
  input: RemoveCopilotProjectMemberInput;
}>;

export type RemoveCopilotContextProjectMemberMutation = {
  __typename?: 'Mutation';
  removeCopilotContextProjectMember: boolean;
};

export type TransferCopilotContextProjectOwnershipMutationVariables = Exact<{
  input: TransferCopilotProjectOwnershipInput;
}>;

export type TransferCopilotContextProjectOwnershipMutation = {
  __typename?: 'Mutation';
  transferCopilotContextProjectOwnership: boolean;
};

export type CopilotContextProjectUpdateMutationVariables = Exact<{
  input: UpdateCopilotContextProjectInput;
}>;

export type CopilotContextProjectUpdateMutation = {
  __typename?: 'Mutation';
  updateCopilotContextProject: {
    __typename?: 'CopilotContextProjectType';
    id: string;
    createdByUserId: string | null;
    name: string;
    description: string;
    status: string;
    aiPolicy: string;
    role: string;
    documentCount: number;
    canManage: boolean;
    createdAt: string;
    updatedAt: string;
    members: Array<{
      __typename?: 'CopilotContextProjectMemberType';
      userId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      role: string;
      createdAt: string;
    }>;
    documents: Array<{
      __typename?: 'CopilotContextProjectDocumentType';
      workspaceId: string;
      docId: string | null;
      title: string | null;
      groupId: string | null;
      sortOrder: number;
      status: string;
      requestedLevel: string;
      accessRequestId: string | null;
      addedByMe: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type CopilotContextSettingsUpdateMutationVariables = Exact<{
  input: UpdateCopilotContextSettingsInput;
}>;

export type CopilotContextSettingsUpdateMutation = {
  __typename?: 'Mutation';
  updateCopilotContextSettings: {
    __typename?: 'CopilotContextSettingsType';
    autoMemoryEnabled: boolean;
  };
};

export type CopilotContextSessionScopeQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['ID']['input'];
}>;

export type CopilotContextSessionScopeQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contextSessionScope: {
        __typename?: 'CopilotContextSessionScopeType';
        sessionId: string;
        primaryDocId: string | null;
        readableDocIds: Array<string>;
        candidateProjectIds: Array<string>;
        projectIds: Array<string>;
        selectedProjectId: string | null;
        projectResolution: string;
        readableDocumentRefs: Array<{
          __typename?: 'CopilotContextDocumentRefType';
          workspaceId: string;
          docId: string;
        }>;
        candidateProjects: Array<{
          __typename?: 'CopilotContextScopeProjectType';
          id: string;
          name: string;
        }>;
      } | null;
    };
  } | null;
};

export type CreateCopilotContextRuleMutationVariables = Exact<{
  input: CreateCopilotContextRuleInput;
}>;

export type CreateCopilotContextRuleMutation = {
  __typename?: 'Mutation';
  createCopilotContextRule: {
    __typename?: 'CopilotContextRuleType';
    id: string;
  };
};

export type UpdateCopilotContextRuleMutationVariables = Exact<{
  input: UpdateCopilotContextRuleInput;
}>;

export type UpdateCopilotContextRuleMutation = {
  __typename?: 'Mutation';
  updateCopilotContextRule: {
    __typename?: 'CopilotContextRuleType';
    id: string;
  };
};

export type RollbackCopilotContextRuleMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  revision: Scalars['Int']['input'];
}>;

export type RollbackCopilotContextRuleMutation = {
  __typename?: 'Mutation';
  rollbackCopilotContextRule: {
    __typename?: 'CopilotContextRuleType';
    id: string;
  };
};

export type DeleteCopilotContextRuleMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteCopilotContextRuleMutation = {
  __typename?: 'Mutation';
  deleteCopilotContextRule: boolean;
};

export type CreateCopilotContextPolicyMutationVariables = Exact<{
  input: CreateCopilotContextPolicyInput;
}>;

export type CreateCopilotContextPolicyMutation = {
  __typename?: 'Mutation';
  createCopilotContextPolicy: {
    __typename?: 'CopilotContextPolicyType';
    id: string;
  };
};

export type UpdateCopilotContextPolicyMutationVariables = Exact<{
  input: UpdateCopilotContextPolicyInput;
}>;

export type UpdateCopilotContextPolicyMutation = {
  __typename?: 'Mutation';
  updateCopilotContextPolicy: {
    __typename?: 'CopilotContextPolicyType';
    id: string;
  };
};

export type RollbackCopilotContextPolicyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
  revision: Scalars['Int']['input'];
}>;

export type RollbackCopilotContextPolicyMutation = {
  __typename?: 'Mutation';
  rollbackCopilotContextPolicy: {
    __typename?: 'CopilotContextPolicyType';
    id: string;
  };
};

export type DeleteCopilotContextPolicyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}>;

export type DeleteCopilotContextPolicyMutation = {
  __typename?: 'Mutation';
  deleteCopilotContextPolicy: boolean;
};

export type UndoCopilotContextMemoryEventMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  eventId: Scalars['ID']['input'];
}>;

export type UndoCopilotContextMemoryEventMutation = {
  __typename?: 'Mutation';
  undoCopilotContextMemoryEvent: {
    __typename?: 'CopilotContextMemoryEventType';
    id: string;
    operation: string;
    targetEventId: string | null;
  };
};

export type QueueWorkspaceEmbeddingMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type QueueWorkspaceEmbeddingMutation = {
  __typename?: 'Mutation';
  queueWorkspaceEmbedding: boolean;
};

export type RequestCopilotDocumentAccessMutationVariables = Exact<{
  input: RequestCopilotDocumentAccessInput;
}>;

export type RequestCopilotDocumentAccessMutation = {
  __typename?: 'Mutation';
  requestCopilotDocumentAccess: {
    __typename?: 'CopilotAccessRequestType';
    id: string;
    workspaceId: string;
    docId: string | null;
    beneficiaryType: string;
    beneficiaryUserId: string | null;
    beneficiaryProjectId: string | null;
    requesterUserId: string;
    requestedLevel: string;
    requestedTitle: string | null;
    status: string;
    resolvedByUserId: string | null;
    resolutionReason: string | null;
    resolvedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type CopilotDocumentDestinationWorkspacesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type CopilotDocumentDestinationWorkspacesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      documentDestinationWorkspaces: Array<{
        __typename?: 'CopilotDocumentWorkspaceType';
        id: string;
        name: string;
      }>;
    };
  } | null;
};

export type CopilotDocumentDestinationFoldersQueryVariables = Exact<{
  workspaceId: Scalars['ID']['input'];
  after?: InputMaybe<Scalars['String']['input']>;
}>;

export type CopilotDocumentDestinationFoldersQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      documentDestinationFolders: {
        __typename?: 'CopilotDocumentFoldersType';
        nextCursor: string | null;
        items: Array<{
          __typename?: 'CopilotDocumentFolderType';
          id: string;
          name: string;
        }>;
      };
    };
  } | null;
};

export type CopilotDocumentOperationsQueryVariables = Exact<{
  sessionId: Scalars['ID']['input'];
  after?: InputMaybe<Scalars['ID']['input']>;
}>;

export type CopilotDocumentOperationsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      documentOperations: Array<{
        __typename?: 'CopilotDocumentOperationType';
        id: string;
        kind: string;
        sourceWorkspaceId: string | null;
        sourceDocumentId: string | null;
        title: string;
        status: string;
        projectStatus: string;
        documentId: string;
        destinationWorkspaceId: string | null;
        destinationFolderId: string | null;
        destinationRevision: number;
        locationExpiresAt: string;
        createdDocumentAt: string | null;
        placedDocumentAt: string | null;
        failureCode: string | null;
        accessRequestId: string | null;
      }>;
    };
  } | null;
};

export type ConfirmCopilotDocumentDestinationMutationVariables = Exact<{
  input: ConfirmCopilotDocumentDestinationInput;
}>;

export type ConfirmCopilotDocumentDestinationMutation = {
  __typename?: 'Mutation';
  confirmCopilotDocumentDestination: {
    __typename?: 'CopilotDocumentOperationType';
    id: string;
    kind: string;
    sourceWorkspaceId: string | null;
    sourceDocumentId: string | null;
    title: string;
    status: string;
    projectStatus: string;
    documentId: string;
    destinationWorkspaceId: string | null;
    destinationFolderId: string | null;
    destinationRevision: number;
    locationExpiresAt: string;
    createdDocumentAt: string | null;
    placedDocumentAt: string | null;
    failureCode: string | null;
    accessRequestId: string | null;
  };
};

export type RetryCopilotDocumentOperationMutationVariables = Exact<{
  operationId: Scalars['ID']['input'];
  expectedRevision: Scalars['Int']['input'];
}>;

export type RetryCopilotDocumentOperationMutation = {
  __typename?: 'Mutation';
  retryCopilotDocumentOperation: {
    __typename?: 'CopilotDocumentOperationType';
    id: string;
    kind: string;
    sourceWorkspaceId: string | null;
    sourceDocumentId: string | null;
    title: string;
    status: string;
    projectStatus: string;
    documentId: string;
    destinationWorkspaceId: string | null;
    destinationFolderId: string | null;
    destinationRevision: number;
    locationExpiresAt: string;
    createdDocumentAt: string | null;
    placedDocumentAt: string | null;
    failureCode: string | null;
    accessRequestId: string | null;
  };
};

export type WithdrawCopilotDocumentOperationMutationVariables = Exact<{
  operationId: Scalars['ID']['input'];
  expectedRevision: Scalars['Int']['input'];
}>;

export type WithdrawCopilotDocumentOperationMutation = {
  __typename?: 'Mutation';
  withdrawCopilotDocumentOperation: {
    __typename?: 'CopilotDocumentOperationType';
    id: string;
    kind: string;
    sourceWorkspaceId: string | null;
    sourceDocumentId: string | null;
    title: string;
    status: string;
    projectStatus: string;
    documentId: string;
    destinationWorkspaceId: string | null;
    destinationFolderId: string | null;
    destinationRevision: number;
    locationExpiresAt: string;
    createdDocumentAt: string | null;
    placedDocumentAt: string | null;
    failureCode: string | null;
    accessRequestId: string | null;
  };
};

export type GetCopilotHistoryIdsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotHistoryIdsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            pinned: boolean;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              createdAt: string;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotDocSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotDocSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotPinnedSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId?: InputMaybe<Scalars['String']['input']>;
  messageOrder?: InputMaybe<ChatHistoryOrder>;
  withPrompt?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type GetCopilotPinnedSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotWorkspaceSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotWorkspaceSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotHistoriesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotHistoriesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type CreateCopilotMessageMutationVariables = Exact<{
  options: CreateChatMessageInput;
}>;

export type CreateCopilotMessageMutation = {
  __typename?: 'Mutation';
  createCopilotMessage: string;
};

export type GetPromptModelsQueryVariables = Exact<{
  promptName: Scalars['String']['input'];
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetPromptModelsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      models: {
        __typename?: 'CopilotModelsType';
        defaultModel: string;
        defaultModelFallbackReason: string | null;
        defaultModelSource: string;
        promptDefaultModel: string;
        embeddingRoute: {
          __typename?: 'CopilotTaskRouteDiagnosticsType';
          behaviorFlags: Array<string> | null;
          candidateCount: number | null;
          canonicalModelKey: string | null;
          configured: boolean;
          dimensionMismatch: boolean | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          embeddingIndexContractDimensions: number | null;
          embeddingIndexContractFingerprint: string | null;
          embeddingIndexContractStatus: string | null;
          embeddingIndexContractVersion: string | null;
          errorCode: string | null;
          errorMessage: string | null;
          fallbackProviderIds: Array<string>;
          featureKind: string;
          modelBackendKind: string | null;
          modelEmbeddingDimensions: number | null;
          modelId: string | null;
          policyAllowedPrivacy: Array<string> | null;
          policyAllowedProviderIds: Array<string> | null;
          policyBlockedProviderIds: Array<string> | null;
          policyEnabled: boolean;
          policyFeatureKind: string | null;
          policyPreferredPrivacy: Array<string> | null;
          policyWorkspaceId: string | null;
          preparedProviderCount: number;
          preparedRouteTargets: Array<string>;
          preparedRouteTargetFingerprint: string;
          providerId: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          protocol: string | null;
          rerankRuntimeContractFingerprint: string | null;
          rerankRuntimeContractStatus: string | null;
          rerankRuntimeContractTopK: number | null;
          rerankRuntimeContractVersion: string | null;
          requestedModelConfigKey: string | null;
          requestedModelConfigPath: string | null;
          requestedModelId: string | null;
          requestedModelSource: string | null;
          taskRoutePolicyRevision: string | null;
          taskRoutePolicyRevisionActorId: string | null;
          taskRoutePolicyRevisionFingerprint: string | null;
          taskRoutePolicyRevisionId: string | null;
          taskRoutePolicyRevisionScope: string | null;
          taskRoutePolicyRevisionSourceChainFingerprint: string | null;
          taskRoutePolicyRevisionStatus: string | null;
          taskRoutePolicyRevisionWorkspaceId: string | null;
          taskRoutePolicyRevisionPublishEventCount: number | null;
          requestedDimensions: number | null;
          requestLayer: string | null;
          topK: number | null;
          diagnosticsErrors: Array<{
            __typename?: 'CopilotTaskRouteDiagnosticsErrorType';
            code: string;
            message: string;
            stage: string;
          }>;
          policyCandidates: Array<{
            __typename?: 'CopilotTaskRoutePolicyCandidateDiagnosticsType';
            allowed: boolean;
            available: boolean;
            candidateFingerprint: string;
            candidateKey: string;
            health: string;
            healthCheckedAt: string | null;
            privacy: string;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerPriority: number | null;
            providerType: string | null;
            reasons: Array<string>;
          }>;
          routeCandidates: Array<{
            __typename?: 'CopilotTaskRouteCandidateDiagnosticsType';
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeMaxOutputTokens: number | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeInputTypes: Array<string> | null;
            routeOutputTypes: Array<string> | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            matched: boolean;
            modelId: string | null;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            providerPriority: number | null;
            privacy: string | null;
            health: string | null;
            healthCheckedAt: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            modelRegistryRevisionPublishEventCount: number | null;
            routeRawModelId: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
            modelRegistryRevisionPublishEvents: Array<{
              __typename?: 'CopilotRegistryRevisionPublishEventType';
              actorId: string | null;
              createdAt: string;
              eventFingerprint: string;
              eventType: string;
              id: string;
              metadata: unknown;
              publishSource: string;
              registryFamily: string;
              registryKey: string;
              registryModelId: string | null;
              registryProviderId: string | null;
              revision: string;
              revisionFingerprint: string;
              revisionId: string;
              revisionStatus: string;
              scopeType: string;
              workspaceId: string | null;
            }> | null;
          }>;
          routeTrace: Array<{
            __typename?: 'CopilotTaskRouteTracePhaseDiagnosticsType';
            availableCount: number | null;
            blockedCount: number | null;
            candidateCount: number;
            matchedCount: number | null;
            phase: string;
            preparedCount: number | null;
            reasons: Array<string>;
            selectedCount: number | null;
          }>;
          prepareCandidates: Array<{
            __typename?: 'CopilotTaskRoutePrepareCandidateDiagnosticsType';
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeMaxOutputTokens: number | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeInputTypes: Array<string> | null;
            routeOutputTypes: Array<string> | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            errorCategory: string | null;
            errorCode: string | null;
            health: string | null;
            healthCheckedAt: string | null;
            modelId: string | null;
            prepared: boolean;
            preparedModelId: string | null;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            privacy: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            modelRegistryRevisionPublishEventCount: number | null;
            routeRawModelId: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
            modelRegistryRevisionPublishEvents: Array<{
              __typename?: 'CopilotRegistryRevisionPublishEventType';
              actorId: string | null;
              createdAt: string;
              eventFingerprint: string;
              eventType: string;
              id: string;
              metadata: unknown;
              publishSource: string;
              registryFamily: string;
              registryKey: string;
              registryModelId: string | null;
              registryProviderId: string | null;
              revision: string;
              revisionFingerprint: string;
              revisionId: string;
              revisionStatus: string;
              scopeType: string;
              workspaceId: string | null;
            }> | null;
          }>;
          preparedRoutes: Array<{
            __typename?: 'CopilotPreparedTaskRouteDiagnosticsType';
            behaviorFlags: Array<string> | null;
            canonicalModelKey: string | null;
            dimensionMismatch: boolean | null;
            fallbackOrderIndex: number | null;
            modelBackendKind: string | null;
            modelEmbeddingDimensions: number | null;
            modelId: string;
            protocol: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerId: string;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            requestedDimensions: number | null;
            requestLayer: string | null;
            routeIndex: number;
          }>;
          taskRoutePolicyRevisionSourceChain: Array<{
            __typename?: 'CopilotTaskRoutePolicySourceChainEntryType';
            actorId: string | null;
            configKey: string | null;
            configPath: string | null;
            featureKind: string | null;
            fingerprint: string | null;
            modelId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
          taskRoutePolicyRevisionPublishEvents: Array<{
            __typename?: 'CopilotRegistryRevisionPublishEventType';
            actorId: string | null;
            createdAt: string;
            eventFingerprint: string;
            eventType: string;
            id: string;
            metadata: unknown;
            publishSource: string;
            registryFamily: string;
            registryKey: string;
            registryModelId: string | null;
            registryProviderId: string | null;
            revision: string;
            revisionFingerprint: string;
            revisionId: string;
            revisionStatus: string;
            scopeType: string;
            workspaceId: string | null;
          }> | null;
        } | null;
        optionalModels: Array<{
          __typename?: 'CopilotModelType';
          contextWindow: number | null;
          costInputPer1M: number | null;
          costOutputPer1M: number | null;
          embeddingDimensions: number | null;
          id: string;
          maxOutputTokens: number | null;
          name: string;
          promptAction: string | null;
          promptCategory: string;
          promptDefaultPolicy: string | null;
          promptModelConfigPath: string | null;
          promptModelSource: string | null;
          promptName: string;
          promptOverrideApplied: boolean;
          promptSource: string;
          providerId: string | null;
          providerName: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          routeModelId: string | null;
          providerType: string | null;
          providerPrivacy: string | null;
          providerHealth: string | null;
          providerHealthCheckedAt: string | null;
          providerHealthLastError: string | null;
          providerPriority: number | null;
          registryAvailable: boolean | null;
          registryKind: string | null;
          registrySelected: boolean | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          routeBackendKind: string | null;
          routeBehaviorFlags: Array<string> | null;
          routeCanonicalModelKey: string | null;
          routeFallbackProviderIds: Array<string> | null;
          routeInputTypes: Array<string> | null;
          routeAttachmentAllowRemoteUrls: boolean | null;
          routeAttachmentKinds: Array<string> | null;
          routeAttachmentSourceKinds: Array<string> | null;
          routeModelAliasMatched: boolean | null;
          routeModelDefinitionAliases: Array<string> | null;
          routeModelDefinitionId: string | null;
          routeModelDefinitionSource: string | null;
          modelRegistryRevision: string | null;
          modelRegistryRevisionActorId: string | null;
          modelRegistryRevisionFingerprint: string | null;
          modelRegistryRevisionId: string | null;
          modelRegistryRevisionScope: string | null;
          modelRegistryRevisionSourceChainFingerprint: string | null;
          modelRegistryRevisionStatus: string | null;
          modelRegistryRevisionWorkspaceId: string | null;
          modelRegistryRevisionPublishEventCount: number | null;
          routeOutputTypes: Array<string> | null;
          routeStructuredAttachmentAllowRemoteUrls: boolean | null;
          routeStructuredAttachmentKinds: Array<string> | null;
          routeStructuredAttachmentSourceKinds: Array<string> | null;
          routeProtocol: string | null;
          routeRawModelId: string | null;
          routeRequestLayer: string | null;
          routePolicyAllowedPrivacy: Array<string> | null;
          routePolicyAllowedProviderIds: Array<string> | null;
          routePolicyBlockedProviderIds: Array<string> | null;
          routePolicyEnabled: boolean;
          routePolicyFeatureKind: string | null;
          routePolicyPreferredPrivacy: Array<string> | null;
          routePolicyWorkspaceId: string | null;
          sources: Array<string>;
          promptModelSources: Array<{
            __typename?: 'CopilotModelPromptSourceType';
            candidateSource: string;
            modelConfigPath: string | null;
            modelSource: string | null;
          }>;
          modelRegistryRevisionSourceChain: Array<{
            __typename?: 'CopilotModelRegistrySourceChainEntryType';
            actorId: string | null;
            fingerprint: string | null;
            modelId: string | null;
            providerId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
          modelRegistryRevisionPublishEvents: Array<{
            __typename?: 'CopilotRegistryRevisionPublishEventType';
            actorId: string | null;
            createdAt: string;
            eventFingerprint: string;
            eventType: string;
            id: string;
            metadata: unknown;
            publishSource: string;
            registryFamily: string;
            registryKey: string;
            registryModelId: string | null;
            registryProviderId: string | null;
            revision: string;
            revisionFingerprint: string;
            revisionId: string;
            revisionStatus: string;
            scopeType: string;
            workspaceId: string | null;
          }> | null;
        }>;
        proModels: Array<{
          __typename?: 'CopilotModelType';
          contextWindow: number | null;
          costInputPer1M: number | null;
          costOutputPer1M: number | null;
          embeddingDimensions: number | null;
          id: string;
          maxOutputTokens: number | null;
          name: string;
          promptAction: string | null;
          promptCategory: string;
          promptDefaultPolicy: string | null;
          promptModelConfigPath: string | null;
          promptModelSource: string | null;
          promptName: string;
          promptOverrideApplied: boolean;
          promptSource: string;
          providerId: string | null;
          providerName: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          routeModelId: string | null;
          providerType: string | null;
          providerPrivacy: string | null;
          providerHealth: string | null;
          providerHealthCheckedAt: string | null;
          providerHealthLastError: string | null;
          providerPriority: number | null;
          registryAvailable: boolean | null;
          registryKind: string | null;
          registrySelected: boolean | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          routeBackendKind: string | null;
          routeBehaviorFlags: Array<string> | null;
          routeCanonicalModelKey: string | null;
          routeFallbackProviderIds: Array<string> | null;
          routeInputTypes: Array<string> | null;
          routeAttachmentAllowRemoteUrls: boolean | null;
          routeAttachmentKinds: Array<string> | null;
          routeAttachmentSourceKinds: Array<string> | null;
          routeModelAliasMatched: boolean | null;
          routeModelDefinitionAliases: Array<string> | null;
          routeModelDefinitionId: string | null;
          routeModelDefinitionSource: string | null;
          modelRegistryRevision: string | null;
          modelRegistryRevisionActorId: string | null;
          modelRegistryRevisionFingerprint: string | null;
          modelRegistryRevisionId: string | null;
          modelRegistryRevisionScope: string | null;
          modelRegistryRevisionSourceChainFingerprint: string | null;
          modelRegistryRevisionStatus: string | null;
          modelRegistryRevisionWorkspaceId: string | null;
          modelRegistryRevisionPublishEventCount: number | null;
          routeOutputTypes: Array<string> | null;
          routeStructuredAttachmentAllowRemoteUrls: boolean | null;
          routeStructuredAttachmentKinds: Array<string> | null;
          routeStructuredAttachmentSourceKinds: Array<string> | null;
          routeProtocol: string | null;
          routeRawModelId: string | null;
          routeRequestLayer: string | null;
          routePolicyAllowedPrivacy: Array<string> | null;
          routePolicyAllowedProviderIds: Array<string> | null;
          routePolicyBlockedProviderIds: Array<string> | null;
          routePolicyEnabled: boolean;
          routePolicyFeatureKind: string | null;
          routePolicyPreferredPrivacy: Array<string> | null;
          routePolicyWorkspaceId: string | null;
          sources: Array<string>;
          promptModelSources: Array<{
            __typename?: 'CopilotModelPromptSourceType';
            candidateSource: string;
            modelConfigPath: string | null;
            modelSource: string | null;
          }>;
          modelRegistryRevisionSourceChain: Array<{
            __typename?: 'CopilotModelRegistrySourceChainEntryType';
            actorId: string | null;
            fingerprint: string | null;
            modelId: string | null;
            providerId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
          modelRegistryRevisionPublishEvents: Array<{
            __typename?: 'CopilotRegistryRevisionPublishEventType';
            actorId: string | null;
            createdAt: string;
            eventFingerprint: string;
            eventType: string;
            id: string;
            metadata: unknown;
            publishSource: string;
            registryFamily: string;
            registryKey: string;
            registryModelId: string | null;
            registryProviderId: string | null;
            revision: string;
            revisionFingerprint: string;
            revisionId: string;
            revisionStatus: string;
            scopeType: string;
            workspaceId: string | null;
          }> | null;
        }>;
        rerankRoute: {
          __typename?: 'CopilotTaskRouteDiagnosticsType';
          behaviorFlags: Array<string> | null;
          candidateCount: number | null;
          canonicalModelKey: string | null;
          configured: boolean;
          dimensionMismatch: boolean | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          embeddingIndexContractDimensions: number | null;
          embeddingIndexContractFingerprint: string | null;
          embeddingIndexContractStatus: string | null;
          embeddingIndexContractVersion: string | null;
          errorCode: string | null;
          errorMessage: string | null;
          fallbackProviderIds: Array<string>;
          featureKind: string;
          modelBackendKind: string | null;
          modelEmbeddingDimensions: number | null;
          modelId: string | null;
          policyAllowedPrivacy: Array<string> | null;
          policyAllowedProviderIds: Array<string> | null;
          policyBlockedProviderIds: Array<string> | null;
          policyEnabled: boolean;
          policyFeatureKind: string | null;
          policyPreferredPrivacy: Array<string> | null;
          policyWorkspaceId: string | null;
          preparedProviderCount: number;
          preparedRouteTargets: Array<string>;
          preparedRouteTargetFingerprint: string;
          providerId: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          protocol: string | null;
          rerankRuntimeContractFingerprint: string | null;
          rerankRuntimeContractStatus: string | null;
          rerankRuntimeContractTopK: number | null;
          rerankRuntimeContractVersion: string | null;
          requestedModelConfigKey: string | null;
          requestedModelConfigPath: string | null;
          requestedModelId: string | null;
          requestedModelSource: string | null;
          taskRoutePolicyRevision: string | null;
          taskRoutePolicyRevisionActorId: string | null;
          taskRoutePolicyRevisionFingerprint: string | null;
          taskRoutePolicyRevisionId: string | null;
          taskRoutePolicyRevisionScope: string | null;
          taskRoutePolicyRevisionSourceChainFingerprint: string | null;
          taskRoutePolicyRevisionStatus: string | null;
          taskRoutePolicyRevisionWorkspaceId: string | null;
          taskRoutePolicyRevisionPublishEventCount: number | null;
          requestedDimensions: number | null;
          requestLayer: string | null;
          topK: number | null;
          diagnosticsErrors: Array<{
            __typename?: 'CopilotTaskRouteDiagnosticsErrorType';
            code: string;
            message: string;
            stage: string;
          }>;
          policyCandidates: Array<{
            __typename?: 'CopilotTaskRoutePolicyCandidateDiagnosticsType';
            allowed: boolean;
            available: boolean;
            candidateFingerprint: string;
            candidateKey: string;
            health: string;
            healthCheckedAt: string | null;
            privacy: string;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerPriority: number | null;
            providerType: string | null;
            reasons: Array<string>;
          }>;
          routeCandidates: Array<{
            __typename?: 'CopilotTaskRouteCandidateDiagnosticsType';
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeMaxOutputTokens: number | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeInputTypes: Array<string> | null;
            routeOutputTypes: Array<string> | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            matched: boolean;
            modelId: string | null;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            providerPriority: number | null;
            privacy: string | null;
            health: string | null;
            healthCheckedAt: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            modelRegistryRevisionPublishEventCount: number | null;
            routeRawModelId: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
            modelRegistryRevisionPublishEvents: Array<{
              __typename?: 'CopilotRegistryRevisionPublishEventType';
              actorId: string | null;
              createdAt: string;
              eventFingerprint: string;
              eventType: string;
              id: string;
              metadata: unknown;
              publishSource: string;
              registryFamily: string;
              registryKey: string;
              registryModelId: string | null;
              registryProviderId: string | null;
              revision: string;
              revisionFingerprint: string;
              revisionId: string;
              revisionStatus: string;
              scopeType: string;
              workspaceId: string | null;
            }> | null;
          }>;
          routeTrace: Array<{
            __typename?: 'CopilotTaskRouteTracePhaseDiagnosticsType';
            availableCount: number | null;
            blockedCount: number | null;
            candidateCount: number;
            matchedCount: number | null;
            phase: string;
            preparedCount: number | null;
            reasons: Array<string>;
            selectedCount: number | null;
          }>;
          prepareCandidates: Array<{
            __typename?: 'CopilotTaskRoutePrepareCandidateDiagnosticsType';
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeMaxOutputTokens: number | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeInputTypes: Array<string> | null;
            routeOutputTypes: Array<string> | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            errorCategory: string | null;
            errorCode: string | null;
            health: string | null;
            healthCheckedAt: string | null;
            modelId: string | null;
            prepared: boolean;
            preparedModelId: string | null;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            privacy: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            modelRegistryRevisionPublishEventCount: number | null;
            routeRawModelId: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
            modelRegistryRevisionPublishEvents: Array<{
              __typename?: 'CopilotRegistryRevisionPublishEventType';
              actorId: string | null;
              createdAt: string;
              eventFingerprint: string;
              eventType: string;
              id: string;
              metadata: unknown;
              publishSource: string;
              registryFamily: string;
              registryKey: string;
              registryModelId: string | null;
              registryProviderId: string | null;
              revision: string;
              revisionFingerprint: string;
              revisionId: string;
              revisionStatus: string;
              scopeType: string;
              workspaceId: string | null;
            }> | null;
          }>;
          preparedRoutes: Array<{
            __typename?: 'CopilotPreparedTaskRouteDiagnosticsType';
            behaviorFlags: Array<string> | null;
            canonicalModelKey: string | null;
            dimensionMismatch: boolean | null;
            fallbackOrderIndex: number | null;
            modelBackendKind: string | null;
            modelEmbeddingDimensions: number | null;
            modelId: string;
            protocol: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerId: string;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            requestedDimensions: number | null;
            requestLayer: string | null;
            routeIndex: number;
          }>;
          taskRoutePolicyRevisionSourceChain: Array<{
            __typename?: 'CopilotTaskRoutePolicySourceChainEntryType';
            actorId: string | null;
            configKey: string | null;
            configPath: string | null;
            featureKind: string | null;
            fingerprint: string | null;
            modelId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
          taskRoutePolicyRevisionPublishEvents: Array<{
            __typename?: 'CopilotRegistryRevisionPublishEventType';
            actorId: string | null;
            createdAt: string;
            eventFingerprint: string;
            eventType: string;
            id: string;
            metadata: unknown;
            publishSource: string;
            registryFamily: string;
            registryKey: string;
            registryModelId: string | null;
            registryProviderId: string | null;
            revision: string;
            revisionFingerprint: string;
            revisionId: string;
            revisionStatus: string;
            scopeType: string;
            workspaceId: string | null;
          }> | null;
        } | null;
      };
    };
  } | null;
};

export type ReRequestCopilotProjectDocumentAccessMutationVariables = Exact<{
  input: ReRequestCopilotProjectDocumentInput;
}>;

export type ReRequestCopilotProjectDocumentAccessMutation = {
  __typename?: 'Mutation';
  reRequestCopilotProjectDocumentAccess: {
    __typename?: 'CopilotAccessRequestType';
    id: string;
    beneficiaryProjectId: string | null;
    requestedLevel: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type RevokeCopilotProjectGrantMutationVariables = Exact<{
  input: RevokeCopilotProjectGrantInput;
}>;

export type RevokeCopilotProjectGrantMutation = {
  __typename?: 'Mutation';
  revokeCopilotProjectGrant: {
    __typename?: 'CopilotProjectGrantRevocationType';
    rerequestCardId: string | null;
    quarantinedMemoryCount: number;
    grant: {
      __typename?: 'CopilotProjectGrantType';
      id: string;
      projectId: string;
      projectName: string;
      workspaceId: string;
      docId: string;
      level: string;
      status: string;
      source: string;
      approvingSide: string;
      revocable: boolean;
      grantedByUserId: string | null;
      accessRequestId: string | null;
      grantedAt: string;
      revokedByUserId: string | null;
      revokedAt: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
};

export type AcceptCopilotProjectInvitationMutationVariables = Exact<{
  invitationId: Scalars['ID']['input'];
}>;

export type AcceptCopilotProjectInvitationMutation = {
  __typename?: 'Mutation';
  acceptCopilotProjectInvitation: {
    __typename?: 'CopilotProjectInvitationType';
    id: string;
    projectId: string;
    status: string;
    acceptedAt: string | null;
    updatedAt: string;
  };
};

export type DeclineCopilotProjectInvitationMutationVariables = Exact<{
  invitationId: Scalars['ID']['input'];
}>;

export type DeclineCopilotProjectInvitationMutation = {
  __typename?: 'Mutation';
  declineCopilotProjectInvitation: {
    __typename?: 'CopilotProjectInvitationType';
    id: string;
    projectId: string;
    status: string;
    declinedAt: string | null;
    updatedAt: string;
  };
};

export type SendCopilotProjectInvitationMutationVariables = Exact<{
  input: SendCopilotProjectInvitationInput;
}>;

export type SendCopilotProjectInvitationMutation = {
  __typename?: 'Mutation';
  sendCopilotProjectInvitation: {
    __typename?: 'CopilotProjectInvitationType';
    id: string;
    projectId: string;
    inviteeUserId: string;
    inviterUserId: string;
    status: string;
    acceptedAt: string | null;
    declinedAt: string | null;
    withdrawnAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type WithdrawCopilotProjectInvitationMutationVariables = Exact<{
  invitationId: Scalars['ID']['input'];
}>;

export type WithdrawCopilotProjectInvitationMutation = {
  __typename?: 'Mutation';
  withdrawCopilotProjectInvitation: {
    __typename?: 'CopilotProjectInvitationType';
    id: string;
    projectId: string;
    status: string;
    withdrawnAt: string | null;
    updatedAt: string;
  };
};

export type GetCopilotPromptRegistryPublishGateQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
}>;

export type GetCopilotPromptRegistryPublishGateQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      promptRegistryPublishGate: {
        __typename?: 'CopilotPromptRegistryPublishGateVerdictType';
        allowed: boolean;
        blockingCount: number;
        errorCount: number;
        issueCount: number;
        name: string;
        publishStatus: string;
        reason: string;
        registryFingerprint: string;
        registryId: number;
        registryUpdatedAt: string;
        repairActionCatalogFingerprint: string;
        stale: boolean;
        staleReasons: Array<string>;
        status: string;
        actionRouteDryRun: {
          __typename?: 'CopilotPromptRegistryPublishGateActionRouteDryRunType';
          actionId: string | null;
          actualRouteCount: number;
          diagnosticsErrorCode: string | null;
          diagnosticsErrorMessage: string | null;
          diagnosticsErrorStage: string | null;
          errorCode: string | null;
          errorMessage: string | null;
          expectedRouteCount: number;
          featureKind: string;
          missingRouteCount: number;
          routeCountMismatch: boolean;
          routeCountMismatchStepIds: Array<string>;
          status: string;
          steps: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateActionRouteDryRunStepType';
            actualRouteCount: number;
            fallbackProviderIds: Array<string>;
            kind: string;
            requestedModelId: string | null;
            requestedModelSource: string | null;
            routeCount: number;
            routeCountMismatch: boolean;
            stepId: string;
            routes: Array<{
              __typename?: 'CopilotPromptRegistryPublishGateActionRouteDryRunRouteType';
              fallbackOrderIndex: number | null;
              modelId: string;
              protocol: string | null;
              providerConfiguredModelCount: number | null;
              providerConfiguredModelIds: Array<string> | null;
              providerHealth: string | null;
              providerHealthCheckedAt: string | null;
              providerHealthLastError: string | null;
              providerId: string;
              providerName: string | null;
              providerPrivacy: string | null;
              providerPriority: number | null;
              providerProfileConfigPath: string | null;
              providerProfileId: string | null;
              providerProfileSource: string | null;
              providerSource: string | null;
              providerType: string | null;
              requestLayer: string | null;
              routeIndex: number;
              routeModelAliasMatched: boolean | null;
              routeModelDefinitionAliases: Array<string> | null;
              routeModelDefinitionId: string | null;
              routeModelDefinitionSource: string | null;
              routeRawModelId: string | null;
            }>;
          }>;
        } | null;
        issues: Array<{
          __typename?: 'CopilotPromptRegistryValidationIssueType';
          code: string;
          detail: string;
          fieldLabel: string;
          message: string | null;
          messageIndex: number | null;
          path: string;
          publishBlocking: boolean;
          reason: string;
          severity: string;
          source: string;
          sourceLocator: {
            __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
            field: string;
            messageIndex: number | null;
            path: string;
            registryFingerprint: string;
            registryId: number;
            registryUpdatedAt: string;
            table: string;
          };
        }>;
        modelRoute: {
          __typename?: 'CopilotPromptRegistryPublishGateModelRouteType';
          available: boolean;
          behaviorFlags: Array<string> | null;
          candidateCount: number;
          candidateConfigPath: string | null;
          candidateIndex: number;
          candidateKind: string;
          canonicalModelKey: string | null;
          checked: boolean;
          configured: boolean;
          diagnosticsErrorCode: string | null;
          diagnosticsErrorMessage: string | null;
          diagnosticsErrorStage: string | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          fallbackProviderIds: Array<string>;
          featureKind: string;
          matchedCandidateCount: number;
          modelBackendKind: string | null;
          modelId: string | null;
          outputType: string;
          policyAllowedPrivacy: Array<string> | null;
          policyAllowedProviderIds: Array<string> | null;
          policyBlockedProviderIds: Array<string> | null;
          policyEnabled: boolean;
          policyFeatureKind: string | null;
          policyPreferredPrivacy: Array<string> | null;
          policyWorkspaceId: string | null;
          protocol: string | null;
          providerId: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerHealth: string | null;
          providerHealthCheckedAt: string | null;
          providerHealthLastError: string | null;
          providerName: string | null;
          providerPrivacy: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          reasons: Array<string>;
          requestedModelId: string | null;
          requestedModelSource: string | null;
          requestLayer: string | null;
          routeModelAliasMatched: boolean | null;
          routeModelDefinitionAliases: Array<string> | null;
          routeModelDefinitionId: string | null;
          routeModelDefinitionSource: string | null;
          modelRegistryRevision: string | null;
          modelRegistryRevisionActorId: string | null;
          modelRegistryRevisionFingerprint: string | null;
          modelRegistryRevisionId: string | null;
          modelRegistryRevisionScope: string | null;
          modelRegistryRevisionSourceChainFingerprint: string | null;
          modelRegistryRevisionStatus: string | null;
          modelRegistryRevisionWorkspaceId: string | null;
          routeRawModelId: string | null;
          policyCandidates: Array<{
            __typename?: 'CopilotPromptRegistryPublishGatePolicyCandidateType';
            allowed: boolean;
            available: boolean;
            candidateFingerprint: string;
            candidateKey: string;
            health: string;
            healthCheckedAt: string | null;
            privacy: string;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            reasons: Array<string>;
          }>;
          modelRegistryRevisionSourceChain: Array<{
            __typename?: 'CopilotModelRegistrySourceChainEntryType';
            actorId: string | null;
            fingerprint: string | null;
            modelId: string | null;
            providerId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
          routeCandidates: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateRouteCandidateType';
            candidateModelIds: Array<string> | null;
            health: string | null;
            healthCheckedAt: string | null;
            matched: boolean;
            modelId: string | null;
            privacy: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerId: string;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            routeRawModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
          }>;
          routeTrace: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateRouteTracePhaseType';
            availableCount: number | null;
            blockedCount: number | null;
            candidateCount: number;
            matchedCount: number | null;
            phase: string;
            preparedCount: number | null;
            reasons: Array<string>;
            selectedCount: number | null;
          }>;
        } | null;
        modelRoutes: Array<{
          __typename?: 'CopilotPromptRegistryPublishGateModelRouteType';
          available: boolean;
          behaviorFlags: Array<string> | null;
          candidateCount: number;
          candidateConfigPath: string | null;
          candidateIndex: number;
          candidateKind: string;
          canonicalModelKey: string | null;
          checked: boolean;
          configured: boolean;
          diagnosticsErrorCode: string | null;
          diagnosticsErrorMessage: string | null;
          diagnosticsErrorStage: string | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          fallbackProviderIds: Array<string>;
          featureKind: string;
          matchedCandidateCount: number;
          modelBackendKind: string | null;
          modelId: string | null;
          outputType: string;
          policyAllowedPrivacy: Array<string> | null;
          policyAllowedProviderIds: Array<string> | null;
          policyBlockedProviderIds: Array<string> | null;
          policyEnabled: boolean;
          policyFeatureKind: string | null;
          policyPreferredPrivacy: Array<string> | null;
          policyWorkspaceId: string | null;
          protocol: string | null;
          providerId: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerHealth: string | null;
          providerHealthCheckedAt: string | null;
          providerHealthLastError: string | null;
          providerName: string | null;
          providerPrivacy: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          reasons: Array<string>;
          requestedModelId: string | null;
          requestedModelSource: string | null;
          requestLayer: string | null;
          routeModelAliasMatched: boolean | null;
          routeModelDefinitionAliases: Array<string> | null;
          routeModelDefinitionId: string | null;
          routeModelDefinitionSource: string | null;
          modelRegistryRevision: string | null;
          modelRegistryRevisionActorId: string | null;
          modelRegistryRevisionFingerprint: string | null;
          modelRegistryRevisionId: string | null;
          modelRegistryRevisionScope: string | null;
          modelRegistryRevisionSourceChainFingerprint: string | null;
          modelRegistryRevisionStatus: string | null;
          modelRegistryRevisionWorkspaceId: string | null;
          routeRawModelId: string | null;
          policyCandidates: Array<{
            __typename?: 'CopilotPromptRegistryPublishGatePolicyCandidateType';
            allowed: boolean;
            available: boolean;
            candidateFingerprint: string;
            candidateKey: string;
            health: string;
            healthCheckedAt: string | null;
            privacy: string;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            reasons: Array<string>;
          }>;
          modelRegistryRevisionSourceChain: Array<{
            __typename?: 'CopilotModelRegistrySourceChainEntryType';
            actorId: string | null;
            fingerprint: string | null;
            modelId: string | null;
            providerId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
          routeCandidates: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateRouteCandidateType';
            candidateModelIds: Array<string> | null;
            health: string | null;
            healthCheckedAt: string | null;
            matched: boolean;
            modelId: string | null;
            privacy: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerId: string;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            routeRawModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
          }>;
          routeTrace: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateRouteTracePhaseType';
            availableCount: number | null;
            blockedCount: number | null;
            candidateCount: number;
            matchedCount: number | null;
            phase: string;
            preparedCount: number | null;
            reasons: Array<string>;
            selectedCount: number | null;
          }>;
        }>;
        taskRoutes: Array<{
          __typename?: 'CopilotTaskRouteDiagnosticsType';
          behaviorFlags: Array<string> | null;
          candidateCount: number | null;
          canonicalModelKey: string | null;
          configured: boolean;
          dimensionMismatch: boolean | null;
          effectiveSourceFingerprint: string | null;
          effectiveSourceFingerprintInputs: Array<string> | null;
          effectiveSourceFingerprintVersion: string | null;
          embeddingIndexContractDimensions: number | null;
          embeddingIndexContractFingerprint: string | null;
          embeddingIndexContractStatus: string | null;
          embeddingIndexContractVersion: string | null;
          errorCode: string | null;
          errorMessage: string | null;
          fallbackProviderIds: Array<string>;
          featureKind: string;
          modelBackendKind: string | null;
          modelEmbeddingDimensions: number | null;
          modelId: string | null;
          policyAllowedPrivacy: Array<string> | null;
          policyAllowedProviderIds: Array<string> | null;
          policyBlockedProviderIds: Array<string> | null;
          policyEnabled: boolean;
          policyFeatureKind: string | null;
          policyPreferredPrivacy: Array<string> | null;
          policyWorkspaceId: string | null;
          preparedProviderCount: number;
          preparedRouteTargets: Array<string>;
          preparedRouteTargetFingerprint: string;
          providerId: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          protocol: string | null;
          rerankRuntimeContractFingerprint: string | null;
          rerankRuntimeContractStatus: string | null;
          rerankRuntimeContractTopK: number | null;
          rerankRuntimeContractVersion: string | null;
          requestedModelConfigKey: string | null;
          requestedModelConfigPath: string | null;
          requestedModelId: string | null;
          requestedModelSource: string | null;
          requestedDimensions: number | null;
          requestLayer: string | null;
          topK: number | null;
          diagnosticsErrors: Array<{
            __typename?: 'CopilotTaskRouteDiagnosticsErrorType';
            code: string;
            message: string;
            stage: string;
          }>;
          policyCandidates: Array<{
            __typename?: 'CopilotTaskRoutePolicyCandidateDiagnosticsType';
            allowed: boolean;
            available: boolean;
            health: string;
            healthCheckedAt: string | null;
            privacy: string;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerSource: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerType: string | null;
            reasons: Array<string>;
          }>;
          routeCandidates: Array<{
            __typename?: 'CopilotTaskRouteCandidateDiagnosticsType';
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeMaxOutputTokens: number | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeInputTypes: Array<string> | null;
            routeOutputTypes: Array<string> | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            matched: boolean;
            modelId: string | null;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            providerPriority: number | null;
            privacy: string | null;
            health: string | null;
            healthCheckedAt: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            routeRawModelId: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
          }>;
          routeTrace: Array<{
            __typename?: 'CopilotTaskRouteTracePhaseDiagnosticsType';
            availableCount: number | null;
            blockedCount: number | null;
            candidateCount: number;
            matchedCount: number | null;
            phase: string;
            preparedCount: number | null;
            reasons: Array<string>;
            selectedCount: number | null;
          }>;
          prepareCandidates: Array<{
            __typename?: 'CopilotTaskRoutePrepareCandidateDiagnosticsType';
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeMaxOutputTokens: number | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeInputTypes: Array<string> | null;
            routeOutputTypes: Array<string> | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            errorCategory: string | null;
            errorCode: string | null;
            health: string | null;
            healthCheckedAt: string | null;
            modelId: string | null;
            prepared: boolean;
            preparedModelId: string | null;
            providerId: string;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            privacy: string | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            routeRawModelId: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelId: string | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
          }>;
          preparedRoutes: Array<{
            __typename?: 'CopilotPreparedTaskRouteDiagnosticsType';
            behaviorFlags: Array<string> | null;
            canonicalModelKey: string | null;
            dimensionMismatch: boolean | null;
            fallbackOrderIndex: number | null;
            modelBackendKind: string | null;
            modelEmbeddingDimensions: number | null;
            modelId: string;
            protocol: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerId: string;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            requestedDimensions: number | null;
            requestLayer: string | null;
            routeIndex: number;
          }>;
        }>;
        repairActionCatalog: Array<{
          __typename?: 'CopilotPromptRegistryPublishGateRepairActionCatalogEntryType';
          actionKind: string;
          catalogVersion: string;
          inputSchema: unknown;
          recommendationCount: number;
          requiredCapabilities: Array<string>;
          safety: string;
        }>;
        repairActionMutationGuard: {
          __typename?: 'CopilotPromptRegistryPublishGateRepairActionMutationGuardType';
          auditSummary: string;
          auditSummaryFingerprint: string;
          catalogFingerprint: string;
          catalogVersion: string;
          expectedRegistryFingerprint: string;
          expectedRegistryId: number;
          expectedRegistryUpdatedAt: string;
          guardFingerprint: string;
          intentFingerprint: string;
          inputSchemaFingerprint: string;
          recommendationCategories: Array<string>;
          recommendationCount: number;
          recommendationCodes: Array<string>;
          recommendationFingerprints: Array<string>;
          requiredCapabilities: Array<string>;
          requiredReviewModes: Array<string>;
          required: boolean;
          safetyLevels: Array<string>;
          suggestedActionKinds: Array<string>;
          targetLocatorCount: number;
          targetLocatorFingerprint: string;
          targetLocatorKinds: Array<string>;
        };
        repairActionPreview: {
          __typename?: 'CopilotPromptRegistryPublishGateRepairActionPreviewType';
          approvalCheckpoints: Array<string>;
          approvalModes: Array<string>;
          approvalPolicyFingerprint: string;
          approvalPolicyVersion: string;
          approvalRequired: boolean;
          auditSummaryFingerprint: string;
          authorizationFingerprint: string;
          authorizationStatus: string;
          candidateCount: number;
          candidateEvidenceSetFingerprint: string;
          taskRouteEffectiveSourceEvidenceSetFingerprint: string;
          taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
          taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
          embeddingIndexContractEvidenceSetFingerprint: string;
          rerankRuntimeContractEvidenceSetFingerprint: string;
          preparedRouteOrderEvidenceSetFingerprint: string;
          catalogFingerprint: string;
          catalogVersion: string;
          guardFingerprint: string;
          operationFingerprints: Array<string>;
          operationSetFingerprint: string;
          previewFingerprint: string;
          readOnly: boolean;
          requiredCapabilities: Array<string>;
          status: string;
          operations: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateRepairActionPreviewOperationType';
            actionKind: string;
            candidateEvidenceCount: number;
            candidateEvidenceFingerprint: string;
            candidateEvidenceFingerprints: Array<string>;
            candidateEvidenceKeys: Array<string>;
            category: string;
            code: string;
            diagnosticsFingerprint: string;
            embeddingIndexContractEvidenceFingerprints: Array<string>;
            rerankRuntimeContractEvidenceFingerprints: Array<string>;
            taskRouteEffectiveSourceFingerprints: Array<string>;
            inputSchema: unknown;
            instanceKey: string | null;
            operationFingerprint: string;
            preparedRouteOrderFingerprints: Array<string>;
            previewStatus: string;
            requiredCapabilities: Array<string>;
            reviewMode: string;
            safety: string;
            target: string;
            targetLocatorFingerprint: string;
            targetLocator: {
              __typename?: 'CopilotPromptRegistryPublishGateRepairTargetLocatorType';
              actionId: string | null;
              candidateIndex: number | null;
              candidateKind: string | null;
              fallbackOrderIndex: number | null;
              featureKind: string | null;
              kind: string;
              outputType: string | null;
              path: string;
              providerId: string | null;
              providerProfileConfigPath: string | null;
              providerProfileId: string | null;
              providerProfileSource: string | null;
              registryFingerprint: string;
              registryId: number;
              registryUpdatedAt: string;
              requestedModelConfigKey: string | null;
              requestedModelConfigPath: string | null;
              requestedModelId: string | null;
              requestedModelSource: string | null;
              routeIndex: number | null;
              status: string | null;
              stepId: string | null;
            } | null;
          }>;
          submissionContract: {
            __typename?: 'CopilotPromptRegistryPublishGateRepairActionSubmissionContractType';
            approvalPolicyFingerprint: string;
            authorizationFingerprint: string;
            candidateEvidenceSetFingerprint: string;
            taskRouteEffectiveSourceEvidenceSetFingerprint: string;
            taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
            taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
            embeddingIndexContractEvidenceSetFingerprint: string;
            rerankRuntimeContractEvidenceSetFingerprint: string;
            preparedRouteOrderEvidenceSetFingerprint: string;
            catalogFingerprint: string;
            contractVersion: string;
            expectedRegistryFingerprint: string;
            expectedRegistryId: number;
            expectedRegistryUpdatedAt: string;
            guardFingerprint: string;
            idempotencyKey: string;
            mutationAvailable: boolean;
            operationSetFingerprint: string;
            previewFingerprint: string;
            readOnly: boolean;
            requiredInputs: Array<string>;
            status: string;
            submissionFingerprint: string;
            targetLocatorFingerprint: string;
          };
        };
        repairGateManifest: {
          __typename?: 'CopilotPromptRegistryPublishGateRepairGateManifestType';
          version: string;
          boundary: string;
          fingerprint: string;
          registryFingerprint: string;
          registryId: number;
          registryUpdatedAt: string;
          gateStatus: string;
          publishStatus: string;
          reason: string;
          issueCount: number;
          blockingCount: number;
          recommendationCount: number;
          operationCount: number;
          guardFingerprint: string;
          previewFingerprint: string;
          submissionFingerprint: string;
          candidateEvidenceSetFingerprint: string;
          taskRouteEffectiveSourceEvidenceSetFingerprint: string;
          taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
          taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
          embeddingIndexContractEvidenceSetFingerprint: string;
          rerankRuntimeContractEvidenceSetFingerprint: string;
          preparedRouteOrderEvidenceSetFingerprint: string;
          operationSetFingerprint: string;
          targetLocatorFingerprint: string;
          approvalPolicyFingerprint: string;
          authorizationFingerprint: string;
          catalogFingerprint: string;
          catalogVersion: string;
          readOnly: boolean;
          mutationAvailable: boolean;
          requiredCapabilities: Array<string>;
          requiredReviewModes: Array<string>;
          safetyLevels: Array<string>;
          operationFingerprints: Array<string>;
          recommendationFingerprints: Array<string>;
        };
        repairGateManifestExportMetadata: {
          __typename?: 'CopilotPromptRegistryPublishGateRepairGateManifestExportMetadataType';
          version: string;
          artifact: string;
          filename: string;
          mime: string;
          metadataFilename: string;
          manifestVersion: string;
          manifestFingerprint: string;
          registryFingerprint: string;
          registryId: number;
          registryUpdatedAt: string;
          gateStatus: string;
          publishStatus: string;
          boundary: string;
          redactionPolicyVersion: string;
          redactionPolicyStatus: string;
          redactionPolicyFingerprint: string;
          exportPolicyVersion: string;
          exportPolicyStatus: string;
          exportPolicyFingerprint: string;
          auditEventVersion: string;
          auditEventStatus: string;
          auditEventCreated: boolean;
          auditEventFingerprint: string;
          retentionPolicyVersion: string;
          retentionPolicyStatus: string;
          retentionPolicyFingerprint: string;
        };
        remediations: Array<{
          __typename?: 'CopilotPromptRegistryValidationRemediationType';
          detail: string;
          kind: string;
          label: string;
          target: string;
          targetLocator: {
            __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
            field: string;
            messageIndex: number | null;
            path: string;
            registryFingerprint: string;
            registryId: number;
            registryUpdatedAt: string;
            table: string;
          };
        }>;
        repairRecommendations: Array<{
          __typename?: 'CopilotPromptRegistryPublishGateRepairRecommendationType';
          category: string;
          code: string;
          detail: string;
          diagnosticsFingerprint: string;
          evidence: Array<string>;
          instanceKey: string | null;
          severity: string;
          suggestedAction: string;
          suggestedActionCatalogVersion: string;
          suggestedActionInputSchema: unknown;
          suggestedActionKind: string;
          suggestedActionRequiredCapabilities: Array<string>;
          suggestedActionSafety: string;
          target: string;
          title: string;
          candidateEvidence: Array<{
            __typename?: 'CopilotPromptRegistryPublishGateRepairCandidateEvidenceType';
            allowed: boolean | null;
            available: boolean | null;
            candidateFingerprint: string;
            candidateIndex: number;
            candidateKey: string | null;
            candidateModelIds: Array<string> | null;
            costInputPer1M: number | null;
            costOutputPer1M: number | null;
            dimensionMismatch: boolean | null;
            embeddingIndexContractDimensions: number | null;
            embeddingIndexContractFingerprint: string | null;
            embeddingIndexContractStatus: string | null;
            embeddingIndexContractVersion: string | null;
            diagnosticsErrorSnapshotFingerprint: string | null;
            errorCategory: string | null;
            errorCode: string | null;
            fallbackProviderIds: Array<string> | null;
            health: string | null;
            healthCheckedAt: string | null;
            matched: boolean | null;
            modelEmbeddingDimensions: number | null;
            modelId: string | null;
            prepared: boolean | null;
            preparedModelId: string | null;
            prepareCandidateSnapshotFingerprint: string | null;
            preparedRouteOrderFingerprint: string | null;
            preparedRouteSnapshotFingerprint: string | null;
            providerCapabilitySnapshotFingerprint: string | null;
            providerCostSnapshotFingerprint: string | null;
            providerHealthSnapshotFingerprint: string | null;
            providerLimitSnapshotFingerprint: string | null;
            rerankRuntimeContractFingerprint: string | null;
            rerankRuntimeContractStatus: string | null;
            rerankRuntimeContractTopK: number | null;
            rerankRuntimeContractVersion: string | null;
            taskRouteEmbeddingIndexContractSnapshotFingerprint: string | null;
            taskRouteRerankRuntimeContractSnapshotFingerprint: string | null;
            taskRouteDimensionSnapshotFingerprint: string | null;
            taskRouteEffectiveSourceFingerprint: string | null;
            taskRouteEffectiveSourceFingerprintInputs: Array<string> | null;
            taskRouteEffectiveSourceFingerprintVersion: string | null;
            taskRouteModelSourceSnapshotFingerprint: string | null;
            preparedRouteTargets: Array<string> | null;
            preparedRouteTargetFingerprint: string | null;
            policyCandidateSnapshotFingerprint: string | null;
            privacy: string | null;
            providerConfiguredModelCount: number | null;
            providerConfiguredModelIds: Array<string> | null;
            providerId: string;
            providerName: string | null;
            providerPriority: number | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            providerSource: string | null;
            providerType: string | null;
            reasons: Array<string>;
            registryAvailable: boolean | null;
            registryKind: string | null;
            registrySelected: boolean | null;
            requestedModelConfigKey: string | null;
            requestedModelConfigPath: string | null;
            requestedDimensions: number | null;
            requestedModelId: string | null;
            requestedModelSource: string | null;
            routeAttachmentAllowRemoteUrls: boolean | null;
            routeAttachmentKinds: Array<string> | null;
            routeAttachmentSourceKinds: Array<string> | null;
            routeCandidateSnapshotFingerprint: string | null;
            routeContextWindow: number | null;
            routeEmbeddingDimensions: number | null;
            routeInputTypes: Array<string> | null;
            routeMaxOutputTokens: number | null;
            routeModelAliasMatched: boolean | null;
            routeModelDefinitionAliases: Array<string> | null;
            routeModelDefinitionId: string | null;
            routeModelDefinitionSource: string | null;
            modelRegistryRevision: string | null;
            modelRegistryRevisionActorId: string | null;
            modelRegistryRevisionFingerprint: string | null;
            modelRegistryRevisionId: string | null;
            modelRegistryRevisionScope: string | null;
            modelRegistryRevisionSourceChainFingerprint: string | null;
            modelRegistryRevisionStatus: string | null;
            modelRegistryRevisionWorkspaceId: string | null;
            routeOutputTypes: Array<string> | null;
            routeRawModelId: string | null;
            routeStructuredAttachmentAllowRemoteUrls: boolean | null;
            routeStructuredAttachmentKinds: Array<string> | null;
            routeStructuredAttachmentSourceKinds: Array<string> | null;
            routeTracePhases: Array<string> | null;
            routeTraceSnapshotFingerprint: string | null;
            scope: string;
            diagnosticsErrors: Array<{
              __typename?: 'CopilotPromptRegistryPublishGateRepairDiagnosticsErrorType';
              code: string;
              message: string;
              stage: string;
            }> | null;
            preparedRoutes: Array<{
              __typename?: 'CopilotPreparedTaskRouteDiagnosticsType';
              behaviorFlags: Array<string> | null;
              canonicalModelKey: string | null;
              dimensionMismatch: boolean | null;
              fallbackOrderIndex: number | null;
              modelBackendKind: string | null;
              modelEmbeddingDimensions: number | null;
              modelId: string;
              protocol: string | null;
              providerConfiguredModelCount: number | null;
              providerConfiguredModelIds: Array<string> | null;
              providerId: string;
              providerName: string | null;
              providerPriority: number | null;
              providerProfileConfigPath: string | null;
              providerProfileId: string | null;
              providerProfileSource: string | null;
              providerSource: string | null;
              providerType: string | null;
              requestedDimensions: number | null;
              requestLayer: string | null;
              routeIndex: number;
            }> | null;
            policyCandidates: Array<{
              __typename?: 'CopilotPromptRegistryPublishGatePolicyCandidateType';
              allowed: boolean;
              available: boolean;
              health: string;
              healthCheckedAt: string | null;
              privacy: string;
              providerConfiguredModelCount: number | null;
              providerConfiguredModelIds: Array<string> | null;
              providerId: string;
              providerName: string | null;
              providerPriority: number | null;
              providerProfileConfigPath: string | null;
              providerProfileId: string | null;
              providerProfileSource: string | null;
              providerSource: string | null;
              providerType: string | null;
              reasons: Array<string>;
            }> | null;
            modelRegistryRevisionSourceChain: Array<{
              __typename?: 'CopilotModelRegistrySourceChainEntryType';
              actorId: string | null;
              fingerprint: string | null;
              modelId: string | null;
              providerId: string | null;
              revision: string | null;
              scope: string;
              source: string;
              status: string;
              updatedAt: string | null;
              workspaceId: string | null;
            }> | null;
            routeTrace: Array<{
              __typename?: 'CopilotPromptRegistryPublishGateRouteTracePhaseType';
              availableCount: number | null;
              blockedCount: number | null;
              candidateCount: number;
              matchedCount: number | null;
              phase: string;
              preparedCount: number | null;
              reasons: Array<string>;
              selectedCount: number | null;
            }> | null;
          }> | null;
          targetLocator: {
            __typename?: 'CopilotPromptRegistryPublishGateRepairTargetLocatorType';
            actionId: string | null;
            candidateIndex: number | null;
            candidateKind: string | null;
            fallbackOrderIndex: number | null;
            featureKind: string | null;
            kind: string;
            outputType: string | null;
            path: string;
            providerId: string | null;
            providerProfileConfigPath: string | null;
            providerProfileId: string | null;
            providerProfileSource: string | null;
            registryFingerprint: string;
            registryId: number;
            registryUpdatedAt: string;
            requestedModelConfigKey: string | null;
            requestedModelConfigPath: string | null;
            requestedModelId: string | null;
            requestedModelSource: string | null;
            routeIndex: number | null;
            status: string | null;
            stepId: string | null;
          } | null;
        }>;
      } | null;
    };
  } | null;
};

export type RequestCopilotPromptRegistryRepairExecutionMutationVariables =
  Exact<{
    input: CopilotPromptRegistryRepairExecutionRequestInput;
  }>;

export type RequestCopilotPromptRegistryRepairExecutionMutation = {
  __typename?: 'Mutation';
  requestCopilotPromptRegistryRepairExecution: {
    __typename?: 'CopilotPromptRegistryRepairExecutionRequestType';
    accepted: boolean;
    approvalRecordRequestCreated: boolean;
    approvalRecordRequestFingerprint: string;
    approvalRecordRequestInputs: Array<string>;
    approvalRecordRequestStatus: string;
    approvalRecordRequestVersion: string;
    auditEventRequestCreated: boolean;
    auditEventRequestFingerprint: string;
    auditEventRequestInputs: Array<string>;
    auditEventRequestStatus: string;
    auditEventRequestVersion: string;
    expectedCandidateEvidenceSetFingerprint: string;
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
    expectedEmbeddingIndexContractEvidenceSetFingerprint: string;
    expectedRerankRuntimeContractEvidenceSetFingerprint: string;
    expectedPreparedRouteOrderEvidenceSetFingerprint: string;
    expectedTargetLocatorFingerprint: string;
    expectedRepairGateManifestFingerprint: string;
    expectedRepairGateManifestExportPolicyFingerprint: string;
    expectedRepairGateManifestRetentionPolicyFingerprint: string;
    executionCompletionEventRequestCreated: boolean;
    executionCompletionEventRequestFingerprint: string;
    executionCompletionEventRequestInputs: Array<string>;
    executionCompletionEventRequestStatus: string;
    executionCompletionEventRequestVersion: string;
    executionCompletionRequestCreated: boolean;
    executionCompletionRequestFingerprint: string;
    executionCompletionRequestInputs: Array<string>;
    executionCompletionRequestStatus: string;
    executionCompletionRequestVersion: string;
    executionFinalizationEventRequestCreated: boolean;
    executionFinalizationEventRequestFingerprint: string;
    executionFinalizationEventRequestInputs: Array<string>;
    executionFinalizationEventRequestStatus: string;
    executionFinalizationEventRequestVersion: string;
    executionFinalizationRequestCreated: boolean;
    executionFinalizationRequestFingerprint: string;
    executionFinalizationRequestInputs: Array<string>;
    executionFinalizationRequestStatus: string;
    executionFinalizationRequestVersion: string;
    executionStatusPollRequestCreated: boolean;
    executionStatusPollRequestFingerprint: string;
    executionStatusPollRequestInputs: Array<string>;
    executionStatusPollRequestStatus: string;
    executionStatusPollRequestVersion: string;
    executionOperationEntryRequestCreated: boolean;
    executionOperationEntryRequestFingerprint: string;
    executionOperationEntryRequestInputs: Array<string>;
    executionOperationEntryRequestStatus: string;
    executionOperationEntryRequestVersion: string;
    executionApprovalUiRequestCreated: boolean;
    executionApprovalUiRequestFingerprint: string;
    executionApprovalUiRequestInputs: Array<string>;
    executionApprovalUiRequestStatus: string;
    executionApprovalUiRequestVersion: string;
    executionDiffPreviewRequestCreated: boolean;
    executionDiffPreviewRequestFingerprint: string;
    executionDiffPreviewRequestInputs: Array<string>;
    executionDiffPreviewRequestStatus: string;
    executionDiffPreviewRequestVersion: string;
    executionApprovalDecisionRequestCreated: boolean;
    executionApprovalDecisionRequestFingerprint: string;
    executionApprovalDecisionRequestInputs: Array<string>;
    executionApprovalDecisionRequestStatus: string;
    executionApprovalDecisionRequestVersion: string;
    executionStartRequestCreated: boolean;
    executionStartRequestFingerprint: string;
    executionStartRequestInputs: Array<string>;
    executionStartRequestStatus: string;
    executionStartRequestVersion: string;
    executionQueueRequestCreated: boolean;
    executionQueueRequestFingerprint: string;
    executionQueueRequestInputs: Array<string>;
    executionQueueRequestStatus: string;
    executionQueueRequestVersion: string;
    executionWorkerLeaseRequestCreated: boolean;
    executionWorkerLeaseRequestFingerprint: string;
    executionWorkerLeaseRequestInputs: Array<string>;
    executionWorkerLeaseRequestStatus: string;
    executionWorkerLeaseRequestVersion: string;
    executionJobRunRequestCreated: boolean;
    executionJobRunRequestFingerprint: string;
    executionJobRunRequestInputs: Array<string>;
    executionJobRunRequestStatus: string;
    executionJobRunRequestVersion: string;
    executionRunStepRequestCreated: boolean;
    executionRunStepRequestFingerprint: string;
    executionRunStepRequestInputs: Array<string>;
    executionRunStepRequestStatus: string;
    executionRunStepRequestVersion: string;
    executionRunStepTraceRequestCreated: boolean;
    executionRunStepTraceRequestFingerprint: string;
    executionRunStepTraceRequestInputs: Array<string>;
    executionRunStepTraceRequestStatus: string;
    executionRunStepTraceRequestVersion: string;
    executionRunStepResultRequestCreated: boolean;
    executionRunStepResultRequestFingerprint: string;
    executionRunStepResultRequestInputs: Array<string>;
    executionRunStepResultRequestStatus: string;
    executionRunStepResultRequestVersion: string;
    executionRunStepCompletionRequestCreated: boolean;
    executionRunStepCompletionRequestFingerprint: string;
    executionRunStepCompletionRequestInputs: Array<string>;
    executionRunStepCompletionRequestStatus: string;
    executionRunStepCompletionRequestVersion: string;
    executionRunStepStatusEventRequestCreated: boolean;
    executionRunStepStatusEventRequestFingerprint: string;
    executionRunStepStatusEventRequestInputs: Array<string>;
    executionRunStepStatusEventRequestStatus: string;
    executionRunStepStatusEventRequestVersion: string;
    executionRunStepRetryRequestCreated: boolean;
    executionRunStepRetryRequestFingerprint: string;
    executionRunStepRetryRequestInputs: Array<string>;
    executionRunStepRetryRequestStatus: string;
    executionRunStepRetryRequestVersion: string;
    executionRunStepRetryAttemptRequestCreated: boolean;
    executionRunStepRetryAttemptRequestFingerprint: string;
    executionRunStepRetryAttemptRequestInputs: Array<string>;
    executionRunStepRetryAttemptRequestStatus: string;
    executionRunStepRetryAttemptRequestVersion: string;
    executionRunStepRetryAttemptStatusEventRequestCreated: boolean;
    executionRunStepRetryAttemptStatusEventRequestFingerprint: string;
    executionRunStepRetryAttemptStatusEventRequestInputs: Array<string>;
    executionRunStepRetryAttemptStatusEventRequestStatus: string;
    executionRunStepRetryAttemptStatusEventRequestVersion: string;
    executionRunStepRetryAttemptTraceRequestCreated: boolean;
    executionRunStepRetryAttemptTraceRequestFingerprint: string;
    executionRunStepRetryAttemptTraceRequestInputs: Array<string>;
    executionRunStepRetryAttemptTraceRequestStatus: string;
    executionRunStepRetryAttemptTraceRequestVersion: string;
    executionRunStepRetryAttemptResultRequestCreated: boolean;
    executionRunStepRetryAttemptResultRequestFingerprint: string;
    executionRunStepRetryAttemptResultRequestInputs: Array<string>;
    executionRunStepRetryAttemptResultRequestStatus: string;
    executionRunStepRetryAttemptResultRequestVersion: string;
    executionRunStepRetryAttemptCompletionRequestCreated: boolean;
    executionRunStepRetryAttemptCompletionRequestFingerprint: string;
    executionRunStepRetryAttemptCompletionRequestInputs: Array<string>;
    executionRunStepRetryAttemptCompletionRequestStatus: string;
    executionRunStepRetryAttemptCompletionRequestVersion: string;
    executionRunStepRetryAttemptCompletionStatusEventRequestCreated: boolean;
    executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint: string;
    executionRunStepRetryAttemptCompletionStatusEventRequestInputs: Array<string>;
    executionRunStepRetryAttemptCompletionStatusEventRequestStatus: string;
    executionRunStepRetryAttemptCompletionStatusEventRequestVersion: string;
    executionRunStepRetryAttemptFinalizationRequestCreated: boolean;
    executionRunStepRetryAttemptFinalizationRequestFingerprint: string;
    executionRunStepRetryAttemptFinalizationRequestInputs: Array<string>;
    executionRunStepRetryAttemptFinalizationRequestStatus: string;
    executionRunStepRetryAttemptFinalizationRequestVersion: string;
    executionRunStepRetryAttemptFinalizationStatusEventRequestCreated: boolean;
    executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint: string;
    executionRunStepRetryAttemptFinalizationStatusEventRequestInputs: Array<string>;
    executionRunStepRetryAttemptFinalizationStatusEventRequestStatus: string;
    executionRunStepRetryAttemptFinalizationStatusEventRequestVersion: string;
    executionRunStepRetryAttemptCloseRequestCreated: boolean;
    executionRunStepRetryAttemptCloseRequestFingerprint: string;
    executionRunStepRetryAttemptCloseRequestInputs: Array<string>;
    executionRunStepRetryAttemptCloseRequestStatus: string;
    executionRunStepRetryAttemptCloseRequestVersion: string;
    executionRunStepRetryAttemptCloseStatusEventRequestCreated: boolean;
    executionRunStepRetryAttemptCloseStatusEventRequestFingerprint: string;
    executionRunStepRetryAttemptCloseStatusEventRequestInputs: Array<string>;
    executionRunStepRetryAttemptCloseStatusEventRequestStatus: string;
    executionRunStepRetryAttemptCloseStatusEventRequestVersion: string;
    executionRunStepRetryAttemptRetentionPolicyRequestCreated: boolean;
    executionRunStepRetryAttemptRetentionPolicyRequestFingerprint: string;
    executionRunStepRetryAttemptRetentionPolicyRequestInputs: Array<string>;
    executionRunStepRetryAttemptRetentionPolicyRequestStatus: string;
    executionRunStepRetryAttemptRetentionPolicyRequestVersion: string;
    executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated: boolean;
    executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint: string;
    executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs: Array<string>;
    executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus: string;
    executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion: string;
    executionRunStepRetryAttemptRetentionLeaseRequestCreated: boolean;
    executionRunStepRetryAttemptRetentionLeaseRequestFingerprint: string;
    executionRunStepRetryAttemptRetentionLeaseRequestInputs: Array<string>;
    executionRunStepRetryAttemptRetentionLeaseRequestStatus: string;
    executionRunStepRetryAttemptRetentionLeaseRequestVersion: string;
    executionRunStepRetryAttemptArchiveRequestCreated: boolean;
    executionRunStepRetryAttemptArchiveRequestFingerprint: string;
    executionRunStepRetryAttemptArchiveRequestInputs: Array<string>;
    executionRunStepRetryAttemptArchiveRequestStatus: string;
    executionRunStepRetryAttemptArchiveRequestVersion: string;
    executionFailureEventRequestCreated: boolean;
    executionFailureEventRequestFingerprint: string;
    executionFailureEventRequestInputs: Array<string>;
    executionFailureEventRequestStatus: string;
    executionFailureEventRequestVersion: string;
    executionProviderResponseRequestCreated: boolean;
    executionProviderResponseRequestFingerprint: string;
    executionProviderResponseRequestInputs: Array<string>;
    executionProviderResponseRequestStatus: string;
    executionProviderResponseRequestVersion: string;
    executionResultRequestCreated: boolean;
    executionResultRequestFingerprint: string;
    executionResultRequestInputs: Array<string>;
    executionResultRequestStatus: string;
    executionResultRequestVersion: string;
    executionRetryPolicyRequestCreated: boolean;
    executionRetryPolicyRequestFingerprint: string;
    executionRetryPolicyRequestInputs: Array<string>;
    executionRetryPolicyRequestStatus: string;
    executionRetryPolicyRequestVersion: string;
    executionRollbackExecutorRequestCreated: boolean;
    executionRollbackExecutorRequestFingerprint: string;
    executionRollbackExecutorRequestInputs: Array<string>;
    executionRollbackExecutorRequestStatus: string;
    executionRollbackExecutorRequestVersion: string;
    executionRollbackOperationRequestCreated: boolean;
    executionRollbackOperationRequestFingerprint: string;
    executionRollbackOperationRequestInputs: Array<string>;
    executionRollbackOperationRequestStatus: string;
    executionRollbackOperationRequestVersion: string;
    executionRollbackOutcomeRequestCreated: boolean;
    executionRollbackOutcomeRequestFingerprint: string;
    executionRollbackOutcomeRequestInputs: Array<string>;
    executionRollbackOutcomeRequestStatus: string;
    executionRollbackOutcomeRequestVersion: string;
    executionRollbackTriggerRequestCreated: boolean;
    executionRollbackTriggerRequestFingerprint: string;
    executionRollbackTriggerRequestInputs: Array<string>;
    executionRollbackTriggerRequestStatus: string;
    executionRollbackTriggerRequestVersion: string;
    executionTraceRequestCreated: boolean;
    executionTraceRequestFingerprint: string;
    executionTraceRequestInputs: Array<string>;
    executionTraceRequestStatus: string;
    executionTraceRequestVersion: string;
    executionStateRequestCreated: boolean;
    executionStateRequestFingerprint: string;
    executionStateRequestInputs: Array<string>;
    executionStateRequestStatus: string;
    executionStateRequestVersion: string;
    executionRequested: boolean;
    idempotencyLockAcquired: boolean;
    idempotencyLockFingerprint: string;
    idempotencyLockInputs: Array<string>;
    idempotencyLockScope: string;
    idempotencyLockStatus: string;
    idempotencyLockVersion: string;
    matchedFields: Array<string>;
    mismatchedFields: Array<string>;
    mutationAvailable: boolean;
    readOnly: boolean;
    repairJobRequestCreated: boolean;
    repairJobRequestFingerprint: string;
    repairJobRequestInputs: Array<string>;
    repairJobRequestStatus: string;
    repairJobRequestVersion: string;
    rollbackPlanRequestCreated: boolean;
    rollbackPlanRequestFingerprint: string;
    rollbackPlanRequestInputs: Array<string>;
    rollbackPlanRequestStatus: string;
    rollbackPlanRequestVersion: string;
    requestFingerprint: string;
    requestInputs: Array<string>;
    requestStatus: string;
    requestVersion: string;
    supportBundleArtifactCreated: boolean;
    supportBundleArtifactFingerprint: string;
    supportBundleArtifactInputs: Array<string>;
    supportBundleArtifactRecordRequestCreated: boolean;
    supportBundleArtifactRecordRequestFingerprint: string;
    supportBundleArtifactRecordRequestInputs: Array<string>;
    supportBundleArtifactRecordRequestStatus: string;
    supportBundleArtifactRecordRequestVersion: string;
    supportBundleArtifactStatus: string;
    supportBundleArtifactVersion: string;
    supportBundleArchiveFormat: string;
    supportBundleArchiveRequestCreated: boolean;
    supportBundleArchiveRequestFingerprint: string;
    supportBundleArchiveRequestInputs: Array<string>;
    supportBundleArchiveRequestStatus: string;
    supportBundleArchiveRequestVersion: string;
    supportBundleArchiveScope: string;
    supportBundleArchiveSignaturePolicy: string;
    supportBundleArchiveSignatureRequestCreated: boolean;
    supportBundleArchiveSignatureRequestFingerprint: string;
    supportBundleArchiveSignatureRequestInputs: Array<string>;
    supportBundleArchiveSignatureRequestStatus: string;
    supportBundleArchiveSignatureRequestVersion: string;
    supportBundleAuditPersistenceRequestCreated: boolean;
    supportBundleAuditPersistenceRequestFingerprint: string;
    supportBundleAuditPersistenceRequestInputs: Array<string>;
    supportBundleAuditPersistenceRequestStatus: string;
    supportBundleAuditPersistenceRequestVersion: string;
    supportBundleAuditPersistenceStatus: string;
    supportBundleDownloadAuthorizationRequestCreated: boolean;
    supportBundleDownloadAuthorizationRequestFingerprint: string;
    supportBundleDownloadAuthorizationRequestInputs: Array<string>;
    supportBundleDownloadAuthorizationRequestStatus: string;
    supportBundleDownloadAuthorizationRequestVersion: string;
    supportBundleDownloadAuthorizationStatus: string;
    supportBundleDownloadResolverRequestCreated: boolean;
    supportBundleDownloadResolverRequestFingerprint: string;
    supportBundleDownloadResolverRequestInputs: Array<string>;
    supportBundleDownloadResolverRequestStatus: string;
    supportBundleDownloadResolverRequestVersion: string;
    supportBundleDownloadResolverRoute: string;
    supportBundleManifestFilename: string;
    supportBundleManifestFingerprint: string;
    supportBundleManifestMetadataFilename: string;
    supportBundleManifestMetadataFingerprint: string;
    supportBundlePackageCreated: boolean;
    supportBundlePackageFingerprint: string;
    supportBundlePackageInputs: Array<string>;
    supportBundlePackageStatus: string;
    supportBundlePackageVersion: string;
    supportBundleRetentionCleanupRequestCreated: boolean;
    supportBundleRetentionCleanupRequestFingerprint: string;
    supportBundleRetentionCleanupRequestInputs: Array<string>;
    supportBundleRetentionCleanupRequestStatus: string;
    supportBundleRetentionCleanupRequestVersion: string;
    supportBundleRetentionCleanupStatus: string;
    supportBundleSignedUrlPolicy: string;
    supportBundleSignedUrlRequestCreated: boolean;
    supportBundleSignedUrlRequestFingerprint: string;
    supportBundleSignedUrlRequestInputs: Array<string>;
    supportBundleSignedUrlRequestStatus: string;
    supportBundleSignedUrlRequestVersion: string;
    supportBundleSignedUrlScope: string;
    supportBundleStorageKeyRequestCreated: boolean;
    supportBundleStorageKeyRequestFingerprint: string;
    supportBundleStorageKeyRequestInputs: Array<string>;
    supportBundleStorageKeyRequestStatus: string;
    supportBundleStorageKeyRequestVersion: string;
    supportBundleStorageKeyScope: string;
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
    supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints: Array<string>;
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
    supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints: Array<string>;
    supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints: Array<string>;
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
    executionRecord: {
      __typename?: 'CopilotRepairExecutionRecordType';
      actorId: string;
      approvalRecordFingerprint: string;
      approvalState: string;
      auditEventCount: number;
      auditEventFingerprint: string;
      candidateEvidenceSetFingerprint: string;
      completedAt: string | null;
      createdAt: string;
      failureCode: string | null;
      failureMessage: string | null;
      id: string;
      idempotencyFingerprint: string;
      idempotencyKey: string;
      lastAttemptAt: string | null;
      permissionStatus: string;
      promptName: string;
      queuedAt: string | null;
      repairJobFingerprint: string;
      requestFingerprint: string;
      requestedAction: string;
      sideEffectCount: number;
      status: string;
      targetLocatorFingerprint: string;
      taskRouteEvidenceSetFingerprint: string;
      updatedAt: string;
      workerAttempt: number;
      workerLeaseExpiresAt: string | null;
      workerLeaseId: string | null;
      workerMaxAttempts: number;
      workspaceId: string;
      auditEvents: Array<{
        __typename?: 'CopilotRepairExecutionAuditEventType';
        actorId: string;
        createdAt: string;
        eventFingerprint: string;
        eventType: string;
        executionRequestId: string;
        id: string;
        metadata: unknown;
        workspaceId: string;
      }>;
      runtimeResult: {
        __typename?: 'CopilotRepairExecutionRuntimeResultType';
        executor: string;
        message: string;
        sideEffectsApplied: boolean;
        sideEffectFingerprint: string | null;
        sideEffectKind: string | null;
        sideEffectRecordId: string | null;
        sideEffectSummary: unknown | null;
        version: string;
      };
      sideEffects: Array<{
        __typename?: 'CopilotRepairExecutionSideEffectType';
        actorId: string;
        appliedAt: string;
        createdAt: string;
        executionRequestId: string;
        executorPayloadFingerprint: string;
        id: string;
        sideEffectFingerprint: string;
        sideEffectKind: string;
        sideEffectRecordId: string;
        sideEffectSummary: unknown;
        workerAttempt: number;
        workerLeaseId: string;
        workspaceId: string;
      }>;
      agentRun: {
        __typename?: 'CopilotAgentRunType';
        actorId: string;
        completedAt: string | null;
        createdAt: string;
        evidenceFingerprint: string;
        executionResultCount: number;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        lastAttemptAt: string | null;
        queuedAt: string | null;
        sourceId: string;
        sourceType: string;
        startedAt: string | null;
        status: string;
        targetFingerprint: string;
        timelineFingerprint: string;
        title: string | null;
        updatedAt: string;
        workerAttempt: number;
        workerLeaseExpiresAt: string | null;
        workerLeaseId: string | null;
        workerMaxAttempts: number;
        workflow: string;
        workspaceId: string;
        executionResults: Array<{
          __typename?: 'CopilotAgentRuntimeExecutionResultType';
          actorId: string;
          adapterWorkflow: string;
          completedAt: string;
          createdAt: string;
          executor: string;
          failureCode: string | null;
          failureMessage: string | null;
          id: string;
          resultFingerprint: string;
          resultPayload: unknown;
          resultStatus: string;
          runId: string;
          sideEffectMode: string;
          sideEffectsApplied: boolean;
          sourceId: string;
          sourceType: string;
          summary: string;
          workerAttempt: number;
          workerLeaseId: string;
          workflow: string;
          workspaceId: string;
        }>;
        steps: Array<{
          __typename?: 'CopilotAgentStepType';
          actorId: string;
          completedAt: string | null;
          createdAt: string;
          evidenceFingerprint: string;
          id: string;
          order: number;
          outputSummary: unknown;
          runId: string;
          startedAt: string | null;
          status: string;
          stepKey: string;
          stepType: string;
          title: string | null;
          updatedAt: string;
          workspaceId: string;
        }>;
        timelineEvents: Array<{
          __typename?: 'CopilotAgentTimelineEventType';
          actorId: string;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          id: string;
          ordinal: number;
          payload: unknown;
          runId: string;
          status: string;
          stepId: string | null;
          summary: string;
          workspaceId: string;
        }>;
      } | null;
    } | null;
    supportBundleTaskRouteEffectiveSourceEvidenceSetEntries: Array<{
      __typename?: 'CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntryType';
      candidateEvidenceCategoryCount: number;
      candidateEvidenceCategories: Array<string>;
      candidateEvidenceCount: number;
      candidateEvidenceReferenceSchemaArtifactFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStorageStatus: string;
      candidateEvidenceReferenceSchemaArtifactRecordStatus: string;
      candidateEvidenceReferenceSchemaArtifactStatus: string;
      candidateEvidenceReferenceSchemaFields: Array<string>;
      candidateEvidenceReferenceSchemaFingerprint: string;
      candidateEvidenceReferenceSchemaFingerprintInputs: Array<string>;
      candidateEvidenceReferenceSchemaRegistryStatus: string;
      candidateEvidenceReferenceSchemaVersion: string;
      candidateEvidenceFingerprint: string;
      candidateEvidenceFingerprints: Array<string>;
      candidateEvidenceKeys: Array<string>;
      candidateEvidenceProviderIds: Array<string>;
      candidateEvidenceScopes: Array<string>;
      diagnosticsFingerprint: string;
      operationFingerprint: string;
      taskRouteEffectiveSourceFingerprints: Array<string>;
      candidateEvidenceEntries: Array<{
        __typename?: 'CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType';
        candidateEvidenceCategory: string | null;
        candidateEvidenceFingerprint: string;
        candidateEvidenceKey: string | null;
        candidateEvidenceProviderId: string;
        candidateEvidenceScope: string;
        candidateIndex: number;
        preparedRouteOrderFingerprint: string | null;
        taskRouteEffectiveSourceFingerprint: string | null;
        taskRouteModelSourceSnapshotFingerprint: string | null;
        preparedRouteEntries: Array<{
          __typename?: 'CopilotPreparedTaskRouteDiagnosticsType';
          behaviorFlags: Array<string> | null;
          canonicalModelKey: string | null;
          dimensionMismatch: boolean | null;
          fallbackOrderIndex: number | null;
          modelBackendKind: string | null;
          modelEmbeddingDimensions: number | null;
          modelId: string;
          protocol: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerId: string;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          requestedDimensions: number | null;
          requestLayer: string | null;
          routeIndex: number;
        }> | null;
        policyCandidateEntries: Array<{
          __typename?: 'CopilotPromptRegistryPublishGatePolicyCandidateType';
          allowed: boolean;
          available: boolean;
          health: string;
          healthCheckedAt: string | null;
          privacy: string;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerId: string;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          registryAvailable: boolean | null;
          registryKind: string | null;
          registrySelected: boolean | null;
          reasons: Array<string>;
        }> | null;
        prepareCandidateEntries: Array<{
          __typename?: 'CopilotTaskRoutePrepareCandidateDiagnosticsType';
          candidateKey: string | null;
          candidateModelIds: Array<string> | null;
          costInputPer1M: number | null;
          costOutputPer1M: number | null;
          routeContextWindow: number | null;
          routeEmbeddingDimensions: number | null;
          routeMaxOutputTokens: number | null;
          routeAttachmentAllowRemoteUrls: boolean | null;
          routeAttachmentKinds: Array<string> | null;
          routeAttachmentSourceKinds: Array<string> | null;
          routeInputTypes: Array<string> | null;
          routeOutputTypes: Array<string> | null;
          routeStructuredAttachmentAllowRemoteUrls: boolean | null;
          routeStructuredAttachmentKinds: Array<string> | null;
          routeStructuredAttachmentSourceKinds: Array<string> | null;
          errorCategory: string | null;
          errorCode: string | null;
          health: string | null;
          healthCheckedAt: string | null;
          modelId: string | null;
          prepared: boolean;
          preparedModelId: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerId: string;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          privacy: string | null;
          reasons: Array<string>;
          routeModelAliasMatched: boolean | null;
          routeModelDefinitionAliases: Array<string> | null;
          routeModelDefinitionId: string | null;
          routeModelDefinitionSource: string | null;
          modelRegistryRevision: string | null;
          modelRegistryRevisionActorId: string | null;
          modelRegistryRevisionFingerprint: string | null;
          modelRegistryRevisionId: string | null;
          modelRegistryRevisionScope: string | null;
          modelRegistryRevisionSourceChainFingerprint: string | null;
          modelRegistryRevisionStatus: string | null;
          modelRegistryRevisionWorkspaceId: string | null;
          routeRawModelId: string | null;
          registryAvailable: boolean | null;
          registryKind: string | null;
          registrySelected: boolean | null;
          requestedModelId: string | null;
          modelRegistryRevisionSourceChain: Array<{
            __typename?: 'CopilotModelRegistrySourceChainEntryType';
            actorId: string | null;
            fingerprint: string | null;
            modelId: string | null;
            providerId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
        }> | null;
        routeCandidateEntries: Array<{
          __typename?: 'CopilotPromptRegistryPublishGateRouteCandidateType';
          candidateModelIds: Array<string> | null;
          costInputPer1M: number | null;
          costOutputPer1M: number | null;
          health: string | null;
          healthCheckedAt: string | null;
          matched: boolean;
          modelId: string | null;
          privacy: string | null;
          providerConfiguredModelCount: number | null;
          providerConfiguredModelIds: Array<string> | null;
          providerId: string;
          providerName: string | null;
          providerPriority: number | null;
          providerProfileConfigPath: string | null;
          providerProfileId: string | null;
          providerProfileSource: string | null;
          providerSource: string | null;
          providerType: string | null;
          reasons: Array<string>;
          registryAvailable: boolean | null;
          registryKind: string | null;
          registrySelected: boolean | null;
          requestedModelId: string | null;
          routeAttachmentAllowRemoteUrls: boolean | null;
          routeAttachmentKinds: Array<string> | null;
          routeAttachmentSourceKinds: Array<string> | null;
          routeContextWindow: number | null;
          routeEmbeddingDimensions: number | null;
          routeInputTypes: Array<string> | null;
          routeMaxOutputTokens: number | null;
          routeModelAliasMatched: boolean | null;
          routeModelDefinitionAliases: Array<string> | null;
          routeModelDefinitionId: string | null;
          routeModelDefinitionSource: string | null;
          modelRegistryRevision: string | null;
          modelRegistryRevisionActorId: string | null;
          modelRegistryRevisionFingerprint: string | null;
          modelRegistryRevisionId: string | null;
          modelRegistryRevisionScope: string | null;
          modelRegistryRevisionSourceChainFingerprint: string | null;
          modelRegistryRevisionStatus: string | null;
          modelRegistryRevisionWorkspaceId: string | null;
          routeOutputTypes: Array<string> | null;
          routeRawModelId: string | null;
          routeStructuredAttachmentAllowRemoteUrls: boolean | null;
          routeStructuredAttachmentKinds: Array<string> | null;
          routeStructuredAttachmentSourceKinds: Array<string> | null;
          modelRegistryRevisionSourceChain: Array<{
            __typename?: 'CopilotModelRegistrySourceChainEntryType';
            actorId: string | null;
            fingerprint: string | null;
            modelId: string | null;
            providerId: string | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
        }> | null;
        taskRouteModelSourceSnapshotEntries: Array<{
          __typename?: 'CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntryType';
          featureKind: string;
          requestedModelConfigKey: string | null;
          requestedModelConfigPath: string | null;
          requestedModelId: string | null;
          requestedModelSource: string | null;
        }> | null;
      }>;
    }>;
    preflight: {
      __typename?: 'CopilotPromptRegistryRepairPreflightType';
      approvalRecordFingerprint: string;
      approvalRequestFingerprint: string;
      auditEventFingerprint: string;
      candidateEvidenceSetFingerprint: string;
      taskRouteEffectiveSourceEvidenceSetFingerprint: string;
      taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
      taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
      embeddingIndexContractEvidenceSetFingerprint: string;
      rerankRuntimeContractEvidenceSetFingerprint: string;
      preparedRouteOrderEvidenceSetFingerprint: string;
      executionGateFingerprint: string;
      executionGateStatus: string;
      executionStateFingerprint: string;
      idempotencyFingerprint: string;
      policyBindingFingerprint: string;
      repairJobFingerprint: string;
      reviewBindingFingerprint: string;
      rollbackPlanFingerprint: string;
      status: string;
      expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
      expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
      expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
      expectedEmbeddingIndexContractEvidenceSetFingerprint: string;
      expectedRerankRuntimeContractEvidenceSetFingerprint: string;
      expectedPreparedRouteOrderEvidenceSetFingerprint: string;
      expectedTargetLocatorFingerprint: string;
      targetLocatorFingerprint: string;
      workspaceId: string | null;
    };
  };
};

export type GetCopilotPromptRegistryRepairPreflightQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  expectedVersion?: InputMaybe<CopilotPromptRegistryPublishGateExpectedVersionInput>;
  submission: CopilotPromptRegistryRepairSubmissionInput;
}>;

export type GetCopilotPromptRegistryRepairPreflightQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      promptRegistryRepairPreflight: {
        __typename?: 'CopilotPromptRegistryRepairPreflightType';
        accepted: boolean;
        actorFingerprint: string;
        actorSnapshotInputs: Array<string>;
        actorSnapshotStatus: string;
        actorSnapshotVersion: string;
        actorType: string;
        approvalCheckpoints: Array<string>;
        approvalModes: Array<string>;
        approvalRecordCreated: boolean;
        approvalRecordFingerprint: string;
        approvalRecordInputs: Array<string>;
        approvalRecordStatus: string;
        approvalRecordVersion: string;
        approvalRequestFingerprint: string;
        approvalRequestInputs: Array<string>;
        approvalRequestStatus: string;
        approvalRequestVersion: string;
        approvalRequired: boolean;
        auditBindingFingerprint: string;
        auditBindingInputs: Array<string>;
        auditBindingStatus: string;
        auditBindingVersion: string;
        auditEventCreated: boolean;
        auditEventFingerprint: string;
        auditEventInputs: Array<string>;
        auditEventStatus: string;
        auditEventVersion: string;
        authorizationStatus: string;
        candidateEvidenceSetFingerprint: string;
        taskRouteEffectiveSourceEvidenceSetFingerprint: string;
        taskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
        taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
        embeddingIndexContractEvidenceSetFingerprint: string;
        rerankRuntimeContractEvidenceSetFingerprint: string;
        preparedRouteOrderEvidenceSetFingerprint: string;
        capabilityCheckMode: string;
        capabilityFingerprint: string;
        capabilitySource: string;
        capabilityStatus: string;
        contractVersion: string;
        currentSubmissionFingerprint: string;
        expectedSubmissionFingerprint: string;
        executionGateFingerprint: string;
        executionGateInputs: Array<string>;
        executionGateStatus: string;
        executionGateVersion: string;
        executionStateCreated: boolean;
        executionStateFingerprint: string;
        executionStateInputs: Array<string>;
        executionStateStatus: string;
        executionStateVersion: string;
        expectedCandidateEvidenceSetFingerprint: string;
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: Array<string>;
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
        expectedEmbeddingIndexContractEvidenceSetFingerprint: string;
        expectedRerankRuntimeContractEvidenceSetFingerprint: string;
        expectedPreparedRouteOrderEvidenceSetFingerprint: string;
        expectedTargetLocatorFingerprint: string;
        idempotencyFingerprint: string;
        idempotencyKey: string;
        idempotencyLockAcquired: boolean;
        idempotencyScope: string;
        idempotencyStatus: string;
        idempotencyVersion: string;
        matchedFields: Array<string>;
        mismatchedFields: Array<string>;
        mutationAvailable: boolean;
        permissionCheckMode: string;
        permissionChecked: boolean;
        permissionFingerprint: string;
        permissionScope: string;
        permissionStatus: string;
        policyBindingFingerprint: string;
        policyBindingInputs: Array<string>;
        policyBindingStatus: string;
        policyBindingVersion: string;
        policySource: string;
        requiredCapabilities: Array<string>;
        requiredCapabilityCount: number;
        requiredPermission: string;
        repairJobCreated: boolean;
        repairJobFingerprint: string;
        repairJobInputs: Array<string>;
        repairJobStatus: string;
        repairJobVersion: string;
        reviewBindingFingerprint: string;
        reviewBindingInputs: Array<string>;
        reviewBindingStatus: string;
        reviewBindingVersion: string;
        rollbackPlanCreated: boolean;
        rollbackPlanFingerprint: string;
        rollbackPlanInputs: Array<string>;
        rollbackPlanStatus: string;
        rollbackPlanVersion: string;
        readOnly: boolean;
        status: string;
        targetLocatorFingerprint: string;
        workspaceId: string | null;
      } | null;
    };
  } | null;
};

export type GetCopilotPromptsQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetCopilotPromptsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      prompts: Array<{
        __typename?: 'CopilotPromptCatalogItemType';
        action: string | null;
        category: string;
        defaultPolicy: string | null;
        fingerprint: string;
        modelStrategyFingerprint: string;
        model: string;
        modelConfigPath: string | null;
        modelSource: string;
        name: string;
        optionalModelsConfigPath: string | null;
        optionalModelCount: number;
        optionalModels: Array<string>;
        optionalModelsSource: string;
        overrideApplied: boolean;
        paramCount: number;
        paramKeys: Array<string>;
        proModelsConfigPath: string | null;
        proModelCount: number;
        proModelsSource: string;
        registryFingerprint: string | null;
        registryId: number | null;
        registryMessageCount: number | null;
        registryModified: boolean | null;
        registryUpdatedAt: string | null;
        registryValidationBlockingCount: number | null;
        registryValidationDetail: string | null;
        registryValidationErrorCount: number | null;
        registryValidationIssueCount: number | null;
        registryValidationPublishStatus: string | null;
        registryValidationReason: string | null;
        registryValidationStatus: string | null;
        registryRecordSource: string | null;
        registryRevision: string | null;
        registryRevisionActorId: string | null;
        registryRevisionFingerprint: string | null;
        registryRevisionId: string | null;
        registryRevisionPublishEventCount: number | null;
        registryRevisionScope: string | null;
        registryRevisionStatus: string | null;
        registryRevisionWorkspaceId: string | null;
        registrySourceChainFingerprint: string | null;
        revision: string;
        source: string;
        templateFingerprint: string;
        registryValidationIssues: Array<{
          __typename?: 'CopilotPromptRegistryValidationIssueType';
          code: string;
          detail: string;
          fieldLabel: string;
          message: string | null;
          messageIndex: number | null;
          path: string;
          publishBlocking: boolean;
          reason: string;
          severity: string;
          source: string;
          sourceLocator: {
            __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
            field: string;
            messageIndex: number | null;
            path: string;
            registryFingerprint: string;
            registryId: number;
            registryUpdatedAt: string;
            table: string;
          };
        }> | null;
        registryValidationRemediations: Array<{
          __typename?: 'CopilotPromptRegistryValidationRemediationType';
          detail: string;
          kind: string;
          label: string;
          target: string;
          targetLocator: {
            __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
            field: string;
            messageIndex: number | null;
            path: string;
            registryFingerprint: string;
            registryId: number;
            registryUpdatedAt: string;
            table: string;
          };
        }> | null;
        registryRevisionPublishEvents: Array<{
          __typename?: 'CopilotRegistryRevisionPublishEventType';
          actorId: string | null;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          id: string;
          metadata: unknown;
          publishSource: string;
          registryFamily: string;
          registryKey: string;
          registryModelId: string | null;
          registryProviderId: string | null;
          revision: string;
          revisionFingerprint: string;
          revisionId: string;
          revisionStatus: string;
          scopeType: string;
          workspaceId: string | null;
        }> | null;
        registrySourceChain: Array<{
          __typename?: 'CopilotPromptRegistrySourceChainEntryType';
          actorId: string | null;
          configPath: string | null;
          fingerprint: string | null;
          registryId: number | null;
          revision: string | null;
          scope: string;
          source: string;
          status: string;
          updatedAt: string | null;
          workspaceId: string | null;
        }> | null;
        versionEvidence: {
          __typename?: 'CopilotPromptCatalogVersionEvidenceType';
          defaultPolicy: string | null;
          fingerprint: string;
          modelConfigPath: string | null;
          modelStrategyFingerprint: string;
          optionalModelsConfigPath: string | null;
          overrideApplied: boolean;
          proModelsConfigPath: string | null;
          registryFingerprint: string | null;
          registryId: number | null;
          registryMessageCount: number | null;
          registryModified: boolean | null;
          registryUpdatedAt: string | null;
          registryValidationBlockingCount: number | null;
          registryValidationDetail: string | null;
          registryValidationErrorCount: number | null;
          registryValidationIssueCount: number | null;
          registryValidationPublishStatus: string | null;
          registryValidationReason: string | null;
          registryValidationStatus: string | null;
          registryRecordSource: string | null;
          registryRevision: string | null;
          registryRevisionActorId: string | null;
          registryRevisionFingerprint: string | null;
          registryRevisionId: string | null;
          registryRevisionPublishEventCount: number | null;
          registryRevisionScope: string | null;
          registryRevisionStatus: string | null;
          registryRevisionWorkspaceId: string | null;
          registrySourceChainFingerprint: string | null;
          revision: string;
          templateFingerprint: string;
          registryValidationIssues: Array<{
            __typename?: 'CopilotPromptRegistryValidationIssueType';
            code: string;
            detail: string;
            fieldLabel: string;
            message: string | null;
            messageIndex: number | null;
            path: string;
            publishBlocking: boolean;
            reason: string;
            severity: string;
            source: string;
            sourceLocator: {
              __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
              field: string;
              messageIndex: number | null;
              path: string;
              registryFingerprint: string;
              registryId: number;
              registryUpdatedAt: string;
              table: string;
            };
          }> | null;
          registryValidationRemediations: Array<{
            __typename?: 'CopilotPromptRegistryValidationRemediationType';
            detail: string;
            kind: string;
            label: string;
            target: string;
            targetLocator: {
              __typename?: 'CopilotPromptRegistryValidationSourceLocatorType';
              field: string;
              messageIndex: number | null;
              path: string;
              registryFingerprint: string;
              registryId: number;
              registryUpdatedAt: string;
              table: string;
            };
          }> | null;
          registryRevisionPublishEvents: Array<{
            __typename?: 'CopilotRegistryRevisionPublishEventType';
            actorId: string | null;
            createdAt: string;
            eventFingerprint: string;
            eventType: string;
            id: string;
            metadata: unknown;
            publishSource: string;
            registryFamily: string;
            registryKey: string;
            registryModelId: string | null;
            registryProviderId: string | null;
            revision: string;
            revisionFingerprint: string;
            revisionId: string;
            revisionStatus: string;
            scopeType: string;
            workspaceId: string | null;
          }> | null;
          registrySourceChain: Array<{
            __typename?: 'CopilotPromptRegistrySourceChainEntryType';
            actorId: string | null;
            configPath: string | null;
            fingerprint: string | null;
            registryId: number | null;
            revision: string | null;
            scope: string;
            source: string;
            status: string;
            updatedAt: string | null;
            workspaceId: string | null;
          }> | null;
        };
      }>;
    };
  } | null;
};

export type RetryCopilotProviderHealthProbeAttemptMutationVariables = Exact<{
  input: CopilotProviderHealthProbeAttemptRetryInput;
}>;

export type RetryCopilotProviderHealthProbeAttemptMutation = {
  __typename?: 'Mutation';
  retryCopilotProviderHealthProbeAttempt: {
    __typename?: 'CopilotProviderHealthProbeAttemptType';
    id: string;
    providerId: string;
    providerType: string | null;
    scopeType: string;
    workspaceId: string;
    actorId: string;
    providerRegistryRevisionId: string;
    providerRegistryRevisionFingerprint: string;
    providerProfileSource: string | null;
    providerProfileFingerprint: string;
    providerProfileSnapshot: unknown;
    requestFingerprint: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    scheduledAt: string;
    workerLeaseId: string | null;
    workerLeaseExpiresAt: string | null;
    checkedAt: string | null;
    completedAt: string | null;
    deadLetteredAt: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    resultStatus: string | null;
    resultLastError: string | null;
    resultMetadata: unknown;
    resultFingerprint: string | null;
    providerHealthStateId: string | null;
    providerHealthStateFingerprint: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type GetCopilotProviderHealthProbeAttemptsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  filter?: InputMaybe<CopilotProviderHealthProbeAttemptFilterInput>;
}>;

export type GetCopilotProviderHealthProbeAttemptsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      providerHealthProbeAttempts: Array<{
        __typename?: 'CopilotProviderHealthProbeAttemptType';
        id: string;
        providerId: string;
        providerType: string | null;
        scopeType: string;
        workspaceId: string;
        actorId: string;
        providerRegistryRevisionId: string;
        providerRegistryRevisionFingerprint: string;
        providerProfileSource: string | null;
        providerProfileFingerprint: string;
        providerProfileSnapshot: unknown;
        requestFingerprint: string;
        status: string;
        attemptCount: number;
        maxAttempts: number;
        scheduledAt: string;
        workerLeaseId: string | null;
        workerLeaseExpiresAt: string | null;
        checkedAt: string | null;
        completedAt: string | null;
        deadLetteredAt: string | null;
        failureCode: string | null;
        failureMessage: string | null;
        resultStatus: string | null;
        resultLastError: string | null;
        resultMetadata: unknown;
        resultFingerprint: string | null;
        providerHealthStateId: string | null;
        providerHealthStateFingerprint: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    };
  } | null;
};

export type CopilotQuotaQueryVariables = Exact<{ [key: string]: never }>;

export type CopilotQuotaQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      quota: {
        __typename?: 'CopilotQuota';
        limit: number | null;
        used: number;
      };
    };
  } | null;
};

export type DecideCopilotRepairExecutionApprovalMutationVariables = Exact<{
  input: CopilotRepairExecutionApprovalDecisionInput;
}>;

export type DecideCopilotRepairExecutionApprovalMutation = {
  __typename?: 'Mutation';
  decideCopilotRepairExecutionApproval: {
    __typename?: 'CopilotRepairExecutionRecordType';
    actorId: string;
    approvalRecordFingerprint: string;
    approvalState: string;
    auditEventCount: number;
    auditEventFingerprint: string;
    candidateEvidenceSetFingerprint: string;
    completedAt: string | null;
    createdAt: string;
    failureCode: string | null;
    failureMessage: string | null;
    id: string;
    idempotencyFingerprint: string;
    idempotencyKey: string;
    lastAttemptAt: string | null;
    permissionStatus: string;
    promptName: string;
    queuedAt: string | null;
    repairJobFingerprint: string;
    requestFingerprint: string;
    requestedAction: string;
    sideEffectCount: number;
    status: string;
    targetLocatorFingerprint: string;
    taskRouteEvidenceSetFingerprint: string;
    updatedAt: string;
    workerAttempt: number;
    workerLeaseExpiresAt: string | null;
    workerLeaseId: string | null;
    workerMaxAttempts: number;
    workspaceId: string;
    auditEvents: Array<{
      __typename?: 'CopilotRepairExecutionAuditEventType';
      actorId: string;
      createdAt: string;
      eventFingerprint: string;
      eventType: string;
      executionRequestId: string;
      id: string;
      metadata: unknown;
      workspaceId: string;
    }>;
    runtimeResult: {
      __typename?: 'CopilotRepairExecutionRuntimeResultType';
      executor: string;
      message: string;
      sideEffectsApplied: boolean;
      sideEffectFingerprint: string | null;
      sideEffectKind: string | null;
      sideEffectRecordId: string | null;
      sideEffectSummary: unknown | null;
      version: string;
    };
    sideEffects: Array<{
      __typename?: 'CopilotRepairExecutionSideEffectType';
      actorId: string;
      appliedAt: string;
      createdAt: string;
      executionRequestId: string;
      executorPayloadFingerprint: string;
      id: string;
      sideEffectFingerprint: string;
      sideEffectKind: string;
      sideEffectRecordId: string;
      sideEffectSummary: unknown;
      workerAttempt: number;
      workerLeaseId: string;
      workspaceId: string;
    }>;
    agentRun: {
      __typename?: 'CopilotAgentRunType';
      actorId: string;
      completedAt: string | null;
      createdAt: string;
      evidenceFingerprint: string;
      executionResultCount: number;
      failureCode: string | null;
      failureMessage: string | null;
      id: string;
      lastAttemptAt: string | null;
      queuedAt: string | null;
      sourceId: string;
      sourceType: string;
      startedAt: string | null;
      status: string;
      targetFingerprint: string;
      timelineFingerprint: string;
      title: string | null;
      updatedAt: string;
      workerAttempt: number;
      workerLeaseExpiresAt: string | null;
      workerLeaseId: string | null;
      workerMaxAttempts: number;
      workflow: string;
      workspaceId: string;
      executionResults: Array<{
        __typename?: 'CopilotAgentRuntimeExecutionResultType';
        actorId: string;
        adapterWorkflow: string;
        completedAt: string;
        createdAt: string;
        executor: string;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        resultFingerprint: string;
        resultPayload: unknown;
        resultStatus: string;
        runId: string;
        sideEffectMode: string;
        sideEffectsApplied: boolean;
        sourceId: string;
        sourceType: string;
        summary: string;
        workerAttempt: number;
        workerLeaseId: string;
        workflow: string;
        workspaceId: string;
      }>;
      steps: Array<{
        __typename?: 'CopilotAgentStepType';
        actorId: string;
        completedAt: string | null;
        createdAt: string;
        evidenceFingerprint: string;
        id: string;
        order: number;
        outputSummary: unknown;
        runId: string;
        startedAt: string | null;
        status: string;
        stepKey: string;
        stepType: string;
        title: string | null;
        updatedAt: string;
        workspaceId: string;
      }>;
      timelineEvents: Array<{
        __typename?: 'CopilotAgentTimelineEventType';
        actorId: string;
        createdAt: string;
        eventFingerprint: string;
        eventType: string;
        id: string;
        ordinal: number;
        payload: unknown;
        runId: string;
        status: string;
        stepId: string | null;
        summary: string;
        workspaceId: string;
      }>;
    } | null;
  };
};

export type ControlCopilotRepairExecutionMutationVariables = Exact<{
  input: CopilotRepairExecutionControlInput;
}>;

export type ControlCopilotRepairExecutionMutation = {
  __typename?: 'Mutation';
  controlCopilotRepairExecution: {
    __typename?: 'CopilotRepairExecutionRecordType';
    actorId: string;
    approvalRecordFingerprint: string;
    approvalState: string;
    auditEventCount: number;
    auditEventFingerprint: string;
    candidateEvidenceSetFingerprint: string;
    completedAt: string | null;
    createdAt: string;
    failureCode: string | null;
    failureMessage: string | null;
    id: string;
    idempotencyFingerprint: string;
    idempotencyKey: string;
    lastAttemptAt: string | null;
    permissionStatus: string;
    promptName: string;
    queuedAt: string | null;
    repairJobFingerprint: string;
    requestFingerprint: string;
    requestedAction: string;
    sideEffectCount: number;
    status: string;
    targetLocatorFingerprint: string;
    taskRouteEvidenceSetFingerprint: string;
    updatedAt: string;
    workerAttempt: number;
    workerLeaseExpiresAt: string | null;
    workerLeaseId: string | null;
    workerMaxAttempts: number;
    workspaceId: string;
    auditEvents: Array<{
      __typename?: 'CopilotRepairExecutionAuditEventType';
      actorId: string;
      createdAt: string;
      eventFingerprint: string;
      eventType: string;
      executionRequestId: string;
      id: string;
      metadata: unknown;
      workspaceId: string;
    }>;
    runtimeResult: {
      __typename?: 'CopilotRepairExecutionRuntimeResultType';
      executor: string;
      message: string;
      sideEffectsApplied: boolean;
      sideEffectFingerprint: string | null;
      sideEffectKind: string | null;
      sideEffectRecordId: string | null;
      sideEffectSummary: unknown | null;
      version: string;
    };
    sideEffects: Array<{
      __typename?: 'CopilotRepairExecutionSideEffectType';
      actorId: string;
      appliedAt: string;
      createdAt: string;
      executionRequestId: string;
      executorPayloadFingerprint: string;
      id: string;
      sideEffectFingerprint: string;
      sideEffectKind: string;
      sideEffectRecordId: string;
      sideEffectSummary: unknown;
      workerAttempt: number;
      workerLeaseId: string;
      workspaceId: string;
    }>;
    agentRun: {
      __typename?: 'CopilotAgentRunType';
      actorId: string;
      completedAt: string | null;
      createdAt: string;
      evidenceFingerprint: string;
      executionResultCount: number;
      failureCode: string | null;
      failureMessage: string | null;
      id: string;
      lastAttemptAt: string | null;
      queuedAt: string | null;
      sourceId: string;
      sourceType: string;
      startedAt: string | null;
      status: string;
      targetFingerprint: string;
      timelineFingerprint: string;
      title: string | null;
      updatedAt: string;
      workerAttempt: number;
      workerLeaseExpiresAt: string | null;
      workerLeaseId: string | null;
      workerMaxAttempts: number;
      workflow: string;
      workspaceId: string;
      executionResults: Array<{
        __typename?: 'CopilotAgentRuntimeExecutionResultType';
        actorId: string;
        adapterWorkflow: string;
        completedAt: string;
        createdAt: string;
        executor: string;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        resultFingerprint: string;
        resultPayload: unknown;
        resultStatus: string;
        runId: string;
        sideEffectMode: string;
        sideEffectsApplied: boolean;
        sourceId: string;
        sourceType: string;
        summary: string;
        workerAttempt: number;
        workerLeaseId: string;
        workflow: string;
        workspaceId: string;
      }>;
      steps: Array<{
        __typename?: 'CopilotAgentStepType';
        actorId: string;
        completedAt: string | null;
        createdAt: string;
        evidenceFingerprint: string;
        id: string;
        order: number;
        outputSummary: unknown;
        runId: string;
        startedAt: string | null;
        status: string;
        stepKey: string;
        stepType: string;
        title: string | null;
        updatedAt: string;
        workspaceId: string;
      }>;
      timelineEvents: Array<{
        __typename?: 'CopilotAgentTimelineEventType';
        actorId: string;
        createdAt: string;
        eventFingerprint: string;
        eventType: string;
        id: string;
        ordinal: number;
        payload: unknown;
        runId: string;
        status: string;
        stepId: string | null;
        summary: string;
        workspaceId: string;
      }>;
    } | null;
  };
};

export type GetCopilotRepairExecutionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  filter?: InputMaybe<CopilotRepairExecutionListFilterInput>;
}>;

export type GetCopilotRepairExecutionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      repairExecutions: Array<{
        __typename?: 'CopilotRepairExecutionRecordType';
        actorId: string;
        approvalRecordFingerprint: string;
        approvalState: string;
        auditEventCount: number;
        auditEventFingerprint: string;
        candidateEvidenceSetFingerprint: string;
        completedAt: string | null;
        createdAt: string;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        idempotencyFingerprint: string;
        idempotencyKey: string;
        lastAttemptAt: string | null;
        permissionStatus: string;
        promptName: string;
        queuedAt: string | null;
        repairJobFingerprint: string;
        requestFingerprint: string;
        requestedAction: string;
        sideEffectCount: number;
        status: string;
        targetLocatorFingerprint: string;
        taskRouteEvidenceSetFingerprint: string;
        updatedAt: string;
        workerAttempt: number;
        workerLeaseExpiresAt: string | null;
        workerLeaseId: string | null;
        workerMaxAttempts: number;
        workspaceId: string;
        auditEvents: Array<{
          __typename?: 'CopilotRepairExecutionAuditEventType';
          actorId: string;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          executionRequestId: string;
          id: string;
          metadata: unknown;
          workspaceId: string;
        }>;
        runtimeResult: {
          __typename?: 'CopilotRepairExecutionRuntimeResultType';
          executor: string;
          message: string;
          sideEffectsApplied: boolean;
          sideEffectFingerprint: string | null;
          sideEffectKind: string | null;
          sideEffectRecordId: string | null;
          sideEffectSummary: unknown | null;
          version: string;
        };
        sideEffects: Array<{
          __typename?: 'CopilotRepairExecutionSideEffectType';
          actorId: string;
          appliedAt: string;
          createdAt: string;
          executionRequestId: string;
          executorPayloadFingerprint: string;
          id: string;
          sideEffectFingerprint: string;
          sideEffectKind: string;
          sideEffectRecordId: string;
          sideEffectSummary: unknown;
          workerAttempt: number;
          workerLeaseId: string;
          workspaceId: string;
        }>;
        agentRun: {
          __typename?: 'CopilotAgentRunType';
          actorId: string;
          completedAt: string | null;
          createdAt: string;
          evidenceFingerprint: string;
          executionResultCount: number;
          failureCode: string | null;
          failureMessage: string | null;
          id: string;
          lastAttemptAt: string | null;
          queuedAt: string | null;
          sourceId: string;
          sourceType: string;
          startedAt: string | null;
          status: string;
          targetFingerprint: string;
          timelineFingerprint: string;
          title: string | null;
          updatedAt: string;
          workerAttempt: number;
          workerLeaseExpiresAt: string | null;
          workerLeaseId: string | null;
          workerMaxAttempts: number;
          workflow: string;
          workspaceId: string;
          executionResults: Array<{
            __typename?: 'CopilotAgentRuntimeExecutionResultType';
            actorId: string;
            adapterWorkflow: string;
            completedAt: string;
            createdAt: string;
            executor: string;
            failureCode: string | null;
            failureMessage: string | null;
            id: string;
            resultFingerprint: string;
            resultPayload: unknown;
            resultStatus: string;
            runId: string;
            sideEffectMode: string;
            sideEffectsApplied: boolean;
            sourceId: string;
            sourceType: string;
            summary: string;
            workerAttempt: number;
            workerLeaseId: string;
            workflow: string;
            workspaceId: string;
          }>;
          steps: Array<{
            __typename?: 'CopilotAgentStepType';
            actorId: string;
            completedAt: string | null;
            createdAt: string;
            evidenceFingerprint: string;
            id: string;
            order: number;
            outputSummary: unknown;
            runId: string;
            startedAt: string | null;
            status: string;
            stepKey: string;
            stepType: string;
            title: string | null;
            updatedAt: string;
            workspaceId: string;
          }>;
          timelineEvents: Array<{
            __typename?: 'CopilotAgentTimelineEventType';
            actorId: string;
            createdAt: string;
            eventFingerprint: string;
            eventType: string;
            id: string;
            ordinal: number;
            payload: unknown;
            runId: string;
            status: string;
            stepId: string | null;
            summary: string;
            workspaceId: string;
          }>;
        } | null;
      }>;
    };
  } | null;
};

export type CleanupCopilotSessionMutationVariables = Exact<{
  input: DeleteSessionInput;
}>;

export type CleanupCopilotSessionMutation = {
  __typename?: 'Mutation';
  cleanupCopilotSession: Array<string>;
};

export type CreateCopilotSessionWithHistoryMutationVariables = Exact<{
  options: CreateChatSessionInput;
}>;

export type CreateCopilotSessionWithHistoryMutation = {
  __typename?: 'Mutation';
  createCopilotSessionWithHistory: {
    __typename?: 'CopilotHistories';
    sessionId: string;
    workspaceId: string;
    docId: string | null;
    selectedContextProjectId: string | null;
    parentSessionId: string | null;
    promptName: string;
    model: string;
    optionalModels: Array<string>;
    action: string | null;
    pinned: boolean;
    title: string | null;
    tokens: number;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      __typename?: 'ChatMessage';
      id: string | null;
      role: string;
      content: string;
      attachments: Array<string> | null;
      createdAt: string;
      streamObjects: Array<{
        __typename?: 'StreamObject';
        type: string;
        textDelta: string | null;
        toolCallId: string | null;
        toolName: string | null;
        args: unknown | null;
        result: unknown | null;
      }> | null;
    }>;
  };
};

export type CreateCopilotSessionMutationVariables = Exact<{
  options: CreateChatSessionInput;
}>;

export type CreateCopilotSessionMutation = {
  __typename?: 'Mutation';
  createCopilotSession: string;
};

export type ForkCopilotSessionMutationVariables = Exact<{
  options: ForkChatSessionInput;
}>;

export type ForkCopilotSessionMutation = {
  __typename?: 'Mutation';
  forkCopilotSession: string;
};

export type GetCopilotLatestDocSessionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetCopilotLatestDocSessionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotSessionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
}>;

export type GetCopilotSessionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type GetCopilotRecentSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;

export type GetCopilotRecentSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type UpdateCopilotSessionMutationVariables = Exact<{
  options: UpdateChatSessionInput;
}>;

export type UpdateCopilotSessionMutation = {
  __typename?: 'Mutation';
  updateCopilotSession: string;
};

export type GetCopilotSessionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
  docId?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<QueryChatHistoriesInput>;
}>;

export type GetCopilotSessionsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      chats: {
        __typename?: 'PaginatedCopilotHistoriesType';
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'CopilotHistoriesTypeEdge';
          cursor: string;
          node: {
            __typename?: 'CopilotHistories';
            sessionId: string;
            workspaceId: string;
            docId: string | null;
            selectedContextProjectId: string | null;
            parentSessionId: string | null;
            promptName: string;
            model: string;
            optionalModels: Array<string>;
            action: string | null;
            pinned: boolean;
            title: string | null;
            tokens: number;
            createdAt: string;
            updatedAt: string;
            messages: Array<{
              __typename?: 'ChatMessage';
              id: string | null;
              role: string;
              content: string;
              attachments: Array<string> | null;
              createdAt: string;
              streamObjects: Array<{
                __typename?: 'StreamObject';
                type: string;
                textDelta: string | null;
                toolCallId: string | null;
                toolName: string | null;
                args: unknown | null;
                result: unknown | null;
              }> | null;
            }>;
          };
        }>;
      };
    };
  } | null;
};

export type CreateCopilotSupportBundleMutationVariables = Exact<{
  input: CopilotSupportBundleCreateInput;
}>;

export type CreateCopilotSupportBundleMutation = {
  __typename?: 'Mutation';
  createCopilotSupportBundle: {
    __typename?: 'CopilotSupportBundleType';
    actorId: string;
    archiveByteSize: number | null;
    archiveFilename: string | null;
    archiveFingerprint: string | null;
    archiveMime: string | null;
    archiveStorageKey: string | null;
    auditEventCount: number;
    createdAt: string;
    expiresAt: string;
    failureCode: string | null;
    failureMessage: string | null;
    id: string;
    manifestByteSize: number | null;
    manifestFilename: string | null;
    manifestFingerprint: string;
    manifestMime: string | null;
    manifestStorageKey: string | null;
    retentionStatus: string;
    sourceEvidenceSetFingerprint: string;
    status: string;
    transferEventCount: number;
    transferForwardingEventCount: number;
    updatedAt: string;
    workspaceId: string;
    auditEvents: Array<{
      __typename?: 'CopilotSupportBundleAuditEventType';
      actorId: string;
      bundleId: string;
      createdAt: string;
      eventFingerprint: string;
      eventType: string;
      id: string;
      metadata: unknown;
      workspaceId: string;
    }>;
    manifestJson: {
      __typename?: 'CopilotSupportBundleManifestType';
      actorId: string;
      archive: unknown;
      bundleId: string;
      createdAt: string;
      expiresAt: string;
      sourceEvidenceSetFingerprint: string;
      version: string;
      workspaceId: string;
      retention: {
        __typename?: 'CopilotSupportBundleRetentionType';
        expiresAt: string;
        status: string;
      };
      sourceEvidenceSummary: {
        __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
        actionRunCount: number;
        includedSections: Array<string>;
        promptCatalogItemCount: number;
        source: string;
        taskRouteCount: number;
      };
    };
    sourceEvidenceSummary: {
      __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
      actionRunCount: number;
      includedSections: Array<string>;
      promptCatalogItemCount: number;
      source: string;
      taskRouteCount: number;
    };
    transferEvents: Array<{
      __typename?: 'CopilotSupportBundleTransferEventType';
      artifactFingerprint: string;
      artifactKind: string;
      authorizationFingerprint: string;
      authorizationId: string;
      createdAt: string;
      deliveryMethod: string;
      eventFingerprint: string;
      eventId: string | null;
      eventSource: string;
      id: string;
      manifestFingerprint: string;
      notificationAuthEvidenceFingerprint: string;
      storageByteSize: number;
      storageContentType: string;
      storageKey: string;
      transferredAt: string;
    }>;
    transferForwardingEvents: Array<{
      __typename?: 'CopilotSupportBundleTransferForwardingEventType';
      attemptCount: number;
      authorizationId: string;
      createdAt: string;
      deadLetteredAt: string | null;
      eventId: string | null;
      eventSource: string;
      failureCode: string | null;
      failureMessage: string | null;
      forwardedAt: string | null;
      forwardedTransferEventFingerprint: string | null;
      forwardingEventFingerprint: string;
      forwardingPayload: unknown;
      forwardingPayloadFingerprint: string;
      id: string;
      lastAttemptAt: string | null;
      maxAttempts: number;
      nextAttemptAt: string | null;
      providerSignatureEvidenceFingerprint: string | null;
      status: string;
      updatedAt: string;
      workerLeaseExpiresAt: string | null;
      workerLeaseId: string | null;
    }>;
  };
};

export type AcknowledgeCopilotSupportBundleDirectDownloadMutationVariables =
  Exact<{
    input: CopilotSupportBundleDirectDownloadAcknowledgeInput;
  }>;

export type AcknowledgeCopilotSupportBundleDirectDownloadMutation = {
  __typename?: 'Mutation';
  acknowledgeCopilotSupportBundleDirectDownload: {
    __typename?: 'CopilotSupportBundleDownloadAuthorizationType';
    actorId: string;
    artifactFingerprint: string;
    artifactFilename: string;
    artifactKind: string;
    artifactMime: string;
    authorizationFingerprint: string;
    bundleId: string;
    createdAt: string;
    deliveryMethod: string;
    directDownloadExpiresAt: string | null;
    directDownloadUrl: string | null;
    downloadedAt: string | null;
    downloadUrl: string;
    expiresAt: string;
    id: string;
    manifestFingerprint: string;
    status: string;
    updatedAt: string;
    workspaceId: string;
  };
};

export type AuthorizeCopilotSupportBundleDownloadMutationVariables = Exact<{
  input: CopilotSupportBundleDownloadAuthorizeInput;
}>;

export type AuthorizeCopilotSupportBundleDownloadMutation = {
  __typename?: 'Mutation';
  authorizeCopilotSupportBundleDownload: {
    __typename?: 'CopilotSupportBundleDownloadAuthorizationType';
    actorId: string;
    artifactFingerprint: string;
    artifactFilename: string;
    artifactKind: string;
    artifactMime: string;
    authorizationFingerprint: string;
    bundleId: string;
    createdAt: string;
    deliveryMethod: string;
    directDownloadExpiresAt: string | null;
    directDownloadUrl: string | null;
    downloadedAt: string | null;
    downloadUrl: string;
    expiresAt: string;
    id: string;
    manifestFingerprint: string;
    status: string;
    updatedAt: string;
    workspaceId: string;
  };
};

export type GetCopilotSupportBundleQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  id: Scalars['String']['input'];
}>;

export type GetCopilotSupportBundleQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      supportBundle: {
        __typename?: 'CopilotSupportBundleType';
        actorId: string;
        archiveByteSize: number | null;
        archiveFilename: string | null;
        archiveFingerprint: string | null;
        archiveMime: string | null;
        archiveStorageKey: string | null;
        auditEventCount: number;
        createdAt: string;
        expiresAt: string;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        manifestByteSize: number | null;
        manifestFilename: string | null;
        manifestFingerprint: string;
        manifestMime: string | null;
        manifestStorageKey: string | null;
        retentionStatus: string;
        sourceEvidenceSetFingerprint: string;
        status: string;
        transferEventCount: number;
        transferForwardingEventCount: number;
        updatedAt: string;
        workspaceId: string;
        auditEvents: Array<{
          __typename?: 'CopilotSupportBundleAuditEventType';
          actorId: string;
          bundleId: string;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          id: string;
          metadata: unknown;
          workspaceId: string;
        }>;
        manifestJson: {
          __typename?: 'CopilotSupportBundleManifestType';
          actorId: string;
          archive: unknown;
          bundleId: string;
          createdAt: string;
          expiresAt: string;
          sourceEvidenceSetFingerprint: string;
          version: string;
          workspaceId: string;
          retention: {
            __typename?: 'CopilotSupportBundleRetentionType';
            expiresAt: string;
            status: string;
          };
          sourceEvidenceSummary: {
            __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
            actionRunCount: number;
            includedSections: Array<string>;
            promptCatalogItemCount: number;
            source: string;
            taskRouteCount: number;
          };
        };
        sourceEvidenceSummary: {
          __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
          actionRunCount: number;
          includedSections: Array<string>;
          promptCatalogItemCount: number;
          source: string;
          taskRouteCount: number;
        };
        transferEvents: Array<{
          __typename?: 'CopilotSupportBundleTransferEventType';
          artifactFingerprint: string;
          artifactKind: string;
          authorizationFingerprint: string;
          authorizationId: string;
          createdAt: string;
          deliveryMethod: string;
          eventFingerprint: string;
          eventId: string | null;
          eventSource: string;
          id: string;
          manifestFingerprint: string;
          notificationAuthEvidenceFingerprint: string;
          storageByteSize: number;
          storageContentType: string;
          storageKey: string;
          transferredAt: string;
        }>;
        transferForwardingEvents: Array<{
          __typename?: 'CopilotSupportBundleTransferForwardingEventType';
          attemptCount: number;
          authorizationId: string;
          createdAt: string;
          deadLetteredAt: string | null;
          eventId: string | null;
          eventSource: string;
          failureCode: string | null;
          failureMessage: string | null;
          forwardedAt: string | null;
          forwardedTransferEventFingerprint: string | null;
          forwardingEventFingerprint: string;
          forwardingPayload: unknown;
          forwardingPayloadFingerprint: string;
          id: string;
          lastAttemptAt: string | null;
          maxAttempts: number;
          nextAttemptAt: string | null;
          providerSignatureEvidenceFingerprint: string | null;
          status: string;
          updatedAt: string;
          workerLeaseExpiresAt: string | null;
          workerLeaseId: string | null;
        }>;
      } | null;
    };
  } | null;
};

export type CleanupCopilotSupportBundleRetentionMutationVariables = Exact<{
  input: CopilotSupportBundleRetentionCleanupInput;
}>;

export type CleanupCopilotSupportBundleRetentionMutation = {
  __typename?: 'Mutation';
  cleanupCopilotSupportBundleRetention: {
    __typename?: 'CopilotSupportBundleRetentionCleanupType';
    archiveObjectCleanupFailedCount: number;
    archiveObjectCleanupRecoveredCount: number;
    archiveObjectCleanupRetryCount: number;
    actorId: string;
    cleanedAt: string;
    cleanupFingerprint: string;
    expiredAuthorizationCount: number;
    expiredBundleCount: number;
    manifestObjectRewriteFailedCount: number;
    manifestObjectRewriteRecoveredCount: number;
    manifestObjectRewriteRetryCount: number;
    workspaceId: string;
    expiredBundles: Array<{
      __typename?: 'CopilotSupportBundleType';
      actorId: string;
      archiveByteSize: number | null;
      archiveFilename: string | null;
      archiveFingerprint: string | null;
      archiveMime: string | null;
      archiveStorageKey: string | null;
      auditEventCount: number;
      createdAt: string;
      expiresAt: string;
      failureCode: string | null;
      failureMessage: string | null;
      id: string;
      manifestFingerprint: string;
      retentionStatus: string;
      sourceEvidenceSetFingerprint: string;
      status: string;
      updatedAt: string;
      workspaceId: string;
      auditEvents: Array<{
        __typename?: 'CopilotSupportBundleAuditEventType';
        actorId: string;
        bundleId: string;
        createdAt: string;
        eventFingerprint: string;
        eventType: string;
        id: string;
        metadata: unknown;
        workspaceId: string;
      }>;
      manifestJson: {
        __typename?: 'CopilotSupportBundleManifestType';
        actorId: string;
        archive: unknown;
        bundleId: string;
        createdAt: string;
        expiresAt: string;
        sourceEvidenceSetFingerprint: string;
        version: string;
        workspaceId: string;
        retention: {
          __typename?: 'CopilotSupportBundleRetentionType';
          expiresAt: string;
          status: string;
        };
        sourceEvidenceSummary: {
          __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
          actionRunCount: number;
          includedSections: Array<string>;
          promptCatalogItemCount: number;
          source: string;
          taskRouteCount: number;
        };
      };
      sourceEvidenceSummary: {
        __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
        actionRunCount: number;
        includedSections: Array<string>;
        promptCatalogItemCount: number;
        source: string;
        taskRouteCount: number;
      };
    }>;
  };
};

export type ReplayCopilotSupportBundleTransferForwardingEventMutationVariables =
  Exact<{
    input: CopilotSupportBundleTransferForwardingReplayInput;
  }>;

export type ReplayCopilotSupportBundleTransferForwardingEventMutation = {
  __typename?: 'Mutation';
  replayCopilotSupportBundleTransferForwardingEvent: {
    __typename?: 'CopilotSupportBundleTransferForwardingEventType';
    attemptCount: number;
    authorizationId: string;
    createdAt: string;
    deadLetteredAt: string | null;
    eventId: string | null;
    eventSource: string;
    failureCode: string | null;
    failureMessage: string | null;
    forwardedAt: string | null;
    forwardedTransferEventFingerprint: string | null;
    forwardingEventFingerprint: string;
    forwardingPayload: unknown;
    forwardingPayloadFingerprint: string;
    id: string;
    lastAttemptAt: string | null;
    maxAttempts: number;
    nextAttemptAt: string | null;
    providerSignatureEvidenceFingerprint: string | null;
    status: string;
    updatedAt: string;
    workerLeaseExpiresAt: string | null;
    workerLeaseId: string | null;
  };
};

export type GetCopilotSupportBundlesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  filter?: InputMaybe<CopilotSupportBundleListFilterInput>;
}>;

export type GetCopilotSupportBundlesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      supportBundles: Array<{
        __typename?: 'CopilotSupportBundleType';
        actorId: string;
        archiveByteSize: number | null;
        archiveFilename: string | null;
        archiveFingerprint: string | null;
        archiveMime: string | null;
        archiveStorageKey: string | null;
        auditEventCount: number;
        createdAt: string;
        expiresAt: string;
        failureCode: string | null;
        failureMessage: string | null;
        id: string;
        manifestByteSize: number | null;
        manifestFilename: string | null;
        manifestFingerprint: string;
        manifestMime: string | null;
        manifestStorageKey: string | null;
        retentionStatus: string;
        sourceEvidenceSetFingerprint: string;
        status: string;
        transferEventCount: number;
        transferForwardingEventCount: number;
        updatedAt: string;
        workspaceId: string;
        auditEvents: Array<{
          __typename?: 'CopilotSupportBundleAuditEventType';
          actorId: string;
          bundleId: string;
          createdAt: string;
          eventFingerprint: string;
          eventType: string;
          id: string;
          metadata: unknown;
          workspaceId: string;
        }>;
        manifestJson: {
          __typename?: 'CopilotSupportBundleManifestType';
          actorId: string;
          archive: unknown;
          bundleId: string;
          createdAt: string;
          expiresAt: string;
          sourceEvidenceSetFingerprint: string;
          version: string;
          workspaceId: string;
          retention: {
            __typename?: 'CopilotSupportBundleRetentionType';
            expiresAt: string;
            status: string;
          };
          sourceEvidenceSummary: {
            __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
            actionRunCount: number;
            includedSections: Array<string>;
            promptCatalogItemCount: number;
            source: string;
            taskRouteCount: number;
          };
        };
        sourceEvidenceSummary: {
          __typename?: 'CopilotSupportBundleSourceEvidenceSummaryType';
          actionRunCount: number;
          includedSections: Array<string>;
          promptCatalogItemCount: number;
          source: string;
          taskRouteCount: number;
        };
        transferEvents: Array<{
          __typename?: 'CopilotSupportBundleTransferEventType';
          artifactFingerprint: string;
          artifactKind: string;
          authorizationFingerprint: string;
          authorizationId: string;
          createdAt: string;
          deliveryMethod: string;
          eventFingerprint: string;
          eventId: string | null;
          eventSource: string;
          id: string;
          manifestFingerprint: string;
          notificationAuthEvidenceFingerprint: string;
          storageByteSize: number;
          storageContentType: string;
          storageKey: string;
          transferredAt: string;
        }>;
        transferForwardingEvents: Array<{
          __typename?: 'CopilotSupportBundleTransferForwardingEventType';
          attemptCount: number;
          authorizationId: string;
          createdAt: string;
          deadLetteredAt: string | null;
          eventId: string | null;
          eventSource: string;
          failureCode: string | null;
          failureMessage: string | null;
          forwardedAt: string | null;
          forwardedTransferEventFingerprint: string | null;
          forwardingEventFingerprint: string;
          forwardingPayload: unknown;
          forwardingPayloadFingerprint: string;
          id: string;
          lastAttemptAt: string | null;
          maxAttempts: number;
          nextAttemptAt: string | null;
          providerSignatureEvidenceFingerprint: string | null;
          status: string;
          updatedAt: string;
          workerLeaseExpiresAt: string | null;
          workerLeaseId: string | null;
        }>;
      }>;
    };
  } | null;
};

export type ControlCopilotTaskMutationVariables = Exact<{
  input: CopilotTaskControlInput;
}>;

export type ControlCopilotTaskMutation = {
  __typename?: 'Mutation';
  controlCopilotTask: {
    __typename?: 'CopilotTaskType';
    id: string;
    workspaceId: string;
    projectId: string | null;
    title: string | null;
    workflow: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    resultSummary: string | null;
    approvalSummary: unknown | null;
    resultEvidence: unknown | null;
    availableActions: Array<string>;
    abandoned: boolean;
    approval: {
      __typename?: 'CopilotTaskApprovalType';
      stepId: string;
      status: string;
      title: string | null;
      decidedAt: string | null;
    } | null;
    artifacts: Array<{
      __typename?: 'CopilotTaskArtifactType';
      kind: string;
      id: string;
      title: string | null;
    }>;
    steps: Array<{
      __typename?: 'CopilotTaskStepType';
      id: string;
      key: string;
      type: string;
      status: string;
      title: string | null;
      order: number;
      startedAt: string | null;
      completedAt: string | null;
    }>;
  };
};

export type CopilotTaskGetQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  taskId: Scalars['String']['input'];
}>;

export type CopilotTaskGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      copilotTask: {
        __typename?: 'CopilotTaskType';
        id: string;
        workspaceId: string;
        projectId: string | null;
        title: string | null;
        workflow: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        startedAt: string | null;
        completedAt: string | null;
        failureCode: string | null;
        failureMessage: string | null;
        resultSummary: string | null;
        approvalSummary: unknown | null;
        resultEvidence: unknown | null;
        availableActions: Array<string>;
        abandoned: boolean;
        approval: {
          __typename?: 'CopilotTaskApprovalType';
          stepId: string;
          status: string;
          title: string | null;
          decidedAt: string | null;
        } | null;
        artifacts: Array<{
          __typename?: 'CopilotTaskArtifactType';
          kind: string;
          id: string;
          title: string | null;
        }>;
        steps: Array<{
          __typename?: 'CopilotTaskStepType';
          id: string;
          key: string;
          type: string;
          status: string;
          title: string | null;
          order: number;
          startedAt: string | null;
          completedAt: string | null;
        }>;
      } | null;
    };
  } | null;
};

export type CopilotTasksGetQueryVariables = Exact<{
  workspaceId?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
  filter?: InputMaybe<CopilotTaskListFilterInput>;
}>;

export type CopilotTasksGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      copilotTasks: Array<{
        __typename?: 'CopilotTaskType';
        id: string;
        workspaceId: string;
        projectId: string | null;
        title: string | null;
        workflow: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        startedAt: string | null;
        completedAt: string | null;
        failureCode: string | null;
        failureMessage: string | null;
        resultSummary: string | null;
        approvalSummary: unknown | null;
        resultEvidence: unknown | null;
        availableActions: Array<string>;
        abandoned: boolean;
        approval: {
          __typename?: 'CopilotTaskApprovalType';
          stepId: string;
          status: string;
          title: string | null;
          decidedAt: string | null;
        } | null;
        artifacts: Array<{
          __typename?: 'CopilotTaskArtifactType';
          kind: string;
          id: string;
          title: string | null;
        }>;
        steps: Array<{
          __typename?: 'CopilotTaskStepType';
          id: string;
          key: string;
          type: string;
          status: string;
          title: string | null;
          order: number;
          startedAt: string | null;
          completedAt: string | null;
        }>;
      }>;
    };
  } | null;
};

export type GetTranscriptTaskQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  taskId?: InputMaybe<Scalars['String']['input']>;
  blobId?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetTranscriptTaskQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      transcriptTask: {
        __typename?: 'TranscriptionResultType';
        id: string;
        status: AiJobStatus;
        title: string | null;
        summary: string | null;
        normalizedTranscript: string | null;
        sourceAudio: {
          __typename?: 'TranscriptionSourceAudioType';
          blobId: string | null;
          mimeType: string | null;
          durationMs: number | null;
          sampleRate: number | null;
          channels: number | null;
        } | null;
        quality: {
          __typename?: 'TranscriptionQualityType';
          degraded: boolean | null;
          overflowCount: number | null;
        } | null;
        sliceManifest: Array<{
          __typename?: 'AudioSliceManifestItemType';
          index: number;
          fileName: string;
          mimeType: string;
          startSec: number;
          durationSec: number;
          byteSize: number | null;
        }> | null;
        normalizedSegments: Array<{
          __typename?: 'NormalizedTranscriptSegmentType';
          speaker: string;
          startSec: number;
          endSec: number;
          start: string;
          end: string;
          text: string;
        }> | null;
        summaryJson: {
          __typename?: 'MeetingSummaryV2Type';
          title: string;
          durationMinutes: number;
          attendees: Array<string>;
          keyPoints: Array<string>;
          decisions: Array<string>;
          openQuestions: Array<string>;
          blockers: Array<string>;
          actionItems: Array<{
            __typename?: 'MeetingActionItemType';
            description: string;
            owner: string | null;
            deadline: string | null;
          }>;
        } | null;
        transcription: Array<{
          __typename?: 'TranscriptionItemType';
          speaker: string;
          start: string;
          end: string;
          transcription: string;
        }> | null;
      } | null;
    };
  } | null;
};

export type RetryTranscriptTaskMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  taskId: Scalars['String']['input'];
}>;

export type RetryTranscriptTaskMutation = {
  __typename?: 'Mutation';
  retryTranscriptTask: {
    __typename?: 'TranscriptionResultType';
    id: string;
    status: AiJobStatus;
  } | null;
};

export type SettleTranscriptTaskMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  taskId: Scalars['String']['input'];
}>;

export type SettleTranscriptTaskMutation = {
  __typename?: 'Mutation';
  settleTranscriptTask: {
    __typename?: 'TranscriptionResultType';
    id: string;
    status: AiJobStatus;
    title: string | null;
    summary: string | null;
    actions: string | null;
    normalizedTranscript: string | null;
    sourceAudio: {
      __typename?: 'TranscriptionSourceAudioType';
      blobId: string | null;
      mimeType: string | null;
      durationMs: number | null;
      sampleRate: number | null;
      channels: number | null;
    } | null;
    quality: {
      __typename?: 'TranscriptionQualityType';
      degraded: boolean | null;
      overflowCount: number | null;
    } | null;
    sliceManifest: Array<{
      __typename?: 'AudioSliceManifestItemType';
      index: number;
      fileName: string;
      mimeType: string;
      startSec: number;
      durationSec: number;
      byteSize: number | null;
    }> | null;
    normalizedSegments: Array<{
      __typename?: 'NormalizedTranscriptSegmentType';
      speaker: string;
      startSec: number;
      endSec: number;
      start: string;
      end: string;
      text: string;
    }> | null;
    summaryJson: {
      __typename?: 'MeetingSummaryV2Type';
      title: string;
      durationMinutes: number;
      attendees: Array<string>;
      keyPoints: Array<string>;
      decisions: Array<string>;
      openQuestions: Array<string>;
      blockers: Array<string>;
      actionItems: Array<{
        __typename?: 'MeetingActionItemType';
        description: string;
        owner: string | null;
        deadline: string | null;
      }>;
    } | null;
    transcription: Array<{
      __typename?: 'TranscriptionItemType';
      speaker: string;
      start: string;
      end: string;
      transcription: string;
    }> | null;
  } | null;
};

export type SubmitTranscriptTaskMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  blobId: Scalars['String']['input'];
  blob?: InputMaybe<Scalars['Upload']['input']>;
  blobs?: InputMaybe<
    Array<Scalars['Upload']['input']> | Scalars['Upload']['input']
  >;
  input?: InputMaybe<SubmitAudioTranscriptionInput>;
}>;

export type SubmitTranscriptTaskMutation = {
  __typename?: 'Mutation';
  submitTranscriptTask: {
    __typename?: 'TranscriptionResultType';
    id: string;
    status: AiJobStatus;
  } | null;
};

export type CopilotWorkbenchBlockersGetQueryVariables = Exact<{
  projectId?: InputMaybe<Scalars['ID']['input']>;
  statuses?: InputMaybe<
    Array<Scalars['String']['input']> | Scalars['String']['input']
  >;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type CopilotWorkbenchBlockersGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      workbenchBlockers: Array<{
        __typename?: 'CopilotBlockerType';
        id: string;
        projectId: string;
        creatorUserId: string;
        title: string;
        type: string;
        waitingOn: string;
        dueAt: string | null;
        overdue: boolean;
        status: string;
        origin: string;
        resolutionActorUserId: string | null;
        resolvedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    };
  } | null;
};

export type CopilotWorkbenchProjectsGetQueryVariables = Exact<{
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type CopilotWorkbenchProjectsGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      contextProjects: Array<{
        __typename?: 'CopilotContextProjectType';
        id: string;
        createdByUserId: string | null;
        name: string;
        description: string;
        status: string;
        aiPolicy: string;
        role: string;
        documentCount: number;
        canManage: boolean;
        createdAt: string;
        updatedAt: string;
        members: Array<{
          __typename?: 'CopilotContextProjectMemberType';
          userId: string;
          name: string;
          email: string;
          avatarUrl: string | null;
          role: string;
          createdAt: string;
        }>;
        documents: Array<{
          __typename?: 'CopilotContextProjectDocumentType';
          workspaceId: string;
          docId: string | null;
          title: string | null;
          groupId: string | null;
          sortOrder: number;
          status: string;
          requestedLevel: string;
          accessRequestId: string | null;
          addedByMe: boolean;
          createdAt: string;
          updatedAt: string;
        }>;
      }>;
    };
  } | null;
};

export type CopilotWorkbenchSourceAuthorizationGetQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type CopilotWorkbenchSourceAuthorizationGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      workbenchAccessRequests: Array<{
        __typename?: 'CopilotAccessRequestType';
        id: string;
        workspaceId: string;
        docId: string | null;
        beneficiaryType: string;
        beneficiaryUserId: string | null;
        beneficiaryProjectId: string | null;
        requesterUserId: string;
        requestedLevel: string;
        requestedTitle: string | null;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
      workbenchProjectGrantsForSource: Array<{
        __typename?: 'CopilotProjectGrantType';
        id: string;
        projectId: string;
        projectName: string;
        workspaceId: string;
        docId: string;
        level: string;
        status: string;
        source: string;
        approvingSide: string;
        revocable: boolean;
        grantedByUserId: string | null;
        accessRequestId: string | null;
        grantedAt: string;
        createdAt: string;
        updatedAt: string;
      }>;
    };
  } | null;
};

export type CopilotWorkbenchTaskGetQueryVariables = Exact<{
  taskId: Scalars['String']['input'];
}>;

export type CopilotWorkbenchTaskGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      workbenchTask: {
        __typename?: 'CopilotWorkbenchTaskItemType';
        id: string;
        entityId: string;
        kind: string;
        segment: string;
        attention: string | null;
        workspaceId: string | null;
        projectId: string | null;
        title: string | null;
        status: string;
        requestedLevel: string | null;
        documentId: string | null;
        redacted: boolean;
        relatedUserId: string | null;
        createdAt: string;
        updatedAt: string;
        completedAt: string | null;
        availableActions: Array<string>;
        run: {
          __typename?: 'CopilotTaskType';
          id: string;
          sessionId: string | null;
          workspaceId: string;
          projectId: string | null;
          title: string | null;
          workflow: string;
          status: string;
          createdAt: string;
          updatedAt: string;
          startedAt: string | null;
          completedAt: string | null;
          failureCode: string | null;
          failureMessage: string | null;
          resultSummary: string | null;
          approvalSummary: unknown | null;
          approvalFingerprint: string | null;
          resultEvidence: unknown | null;
          availableActions: Array<string>;
          abandoned: boolean;
          documentUpdate: {
            __typename?: 'CopilotTaskDocumentUpdateType';
            workspaceId: string;
            docId: string;
            content: string;
            expectedVersion: string;
            needsReconfirmation: boolean;
            previousVersion: string | null;
          } | null;
          approval: {
            __typename?: 'CopilotTaskApprovalType';
            stepId: string;
            status: string;
            title: string | null;
            decidedAt: string | null;
          } | null;
          artifacts: Array<{
            __typename?: 'CopilotTaskArtifactType';
            workspaceId: string;
            kind: string;
            id: string;
            title: string | null;
          }>;
          steps: Array<{
            __typename?: 'CopilotTaskStepType';
            id: string;
            key: string;
            type: string;
            status: string;
            title: string | null;
            order: number;
            startedAt: string | null;
            completedAt: string | null;
          }>;
        } | null;
        blocker: {
          __typename?: 'CopilotWorkbenchBlockerTaskType';
          creatorUserId: string;
          type: string;
          waitingOn: string;
          dueAt: string | null;
          overdue: boolean;
          origin: string;
          resolutionActorUserId: string | null;
        } | null;
      } | null;
    };
  } | null;
};

export type CopilotWorkbenchTaskPanelGetQueryVariables = Exact<{
  projectId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type CopilotWorkbenchTaskPanelGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      workbenchTaskPanel: {
        __typename?: 'CopilotWorkbenchTaskPanelType';
        todo: {
          __typename?: 'CopilotWorkbenchTaskSegmentType';
          capped: boolean;
          items: Array<{
            __typename?: 'CopilotWorkbenchTaskItemType';
            id: string;
            entityId: string;
            kind: string;
            segment: string;
            attention: string | null;
            workspaceId: string | null;
            projectId: string | null;
            title: string | null;
            status: string;
            requestedLevel: string | null;
            documentId: string | null;
            redacted: boolean;
            relatedUserId: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            availableActions: Array<string>;
            blocker: {
              __typename?: 'CopilotWorkbenchBlockerTaskType';
              creatorUserId: string;
              type: string;
              waitingOn: string;
              dueAt: string | null;
              overdue: boolean;
              origin: string;
              resolutionActorUserId: string | null;
            } | null;
            run: {
              __typename?: 'CopilotTaskType';
              id: string;
              sessionId: string | null;
              workspaceId: string;
              projectId: string | null;
              title: string | null;
              workflow: string;
              status: string;
              createdAt: string;
              updatedAt: string;
              startedAt: string | null;
              completedAt: string | null;
              failureCode: string | null;
              failureMessage: string | null;
              resultSummary: string | null;
              approvalSummary: unknown | null;
              approvalFingerprint: string | null;
              resultEvidence: unknown | null;
              availableActions: Array<string>;
              abandoned: boolean;
              approval: {
                __typename?: 'CopilotTaskApprovalType';
                stepId: string;
                status: string;
                title: string | null;
                decidedAt: string | null;
              } | null;
              artifacts: Array<{
                __typename?: 'CopilotTaskArtifactType';
                workspaceId: string;
                kind: string;
                id: string;
                title: string | null;
              }>;
              steps: Array<{
                __typename?: 'CopilotTaskStepType';
                id: string;
                key: string;
                type: string;
                status: string;
                title: string | null;
                order: number;
                startedAt: string | null;
                completedAt: string | null;
              }>;
            } | null;
          }>;
        };
        inProgress: {
          __typename?: 'CopilotWorkbenchTaskSegmentType';
          capped: boolean;
          items: Array<{
            __typename?: 'CopilotWorkbenchTaskItemType';
            id: string;
            entityId: string;
            kind: string;
            segment: string;
            attention: string | null;
            workspaceId: string | null;
            projectId: string | null;
            title: string | null;
            status: string;
            requestedLevel: string | null;
            documentId: string | null;
            redacted: boolean;
            relatedUserId: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            availableActions: Array<string>;
            blocker: {
              __typename?: 'CopilotWorkbenchBlockerTaskType';
              creatorUserId: string;
              type: string;
              waitingOn: string;
              dueAt: string | null;
              overdue: boolean;
              origin: string;
              resolutionActorUserId: string | null;
            } | null;
            run: {
              __typename?: 'CopilotTaskType';
              id: string;
              sessionId: string | null;
              workspaceId: string;
              projectId: string | null;
              title: string | null;
              workflow: string;
              status: string;
              createdAt: string;
              updatedAt: string;
              startedAt: string | null;
              completedAt: string | null;
              failureCode: string | null;
              failureMessage: string | null;
              resultSummary: string | null;
              approvalSummary: unknown | null;
              approvalFingerprint: string | null;
              resultEvidence: unknown | null;
              availableActions: Array<string>;
              abandoned: boolean;
              approval: {
                __typename?: 'CopilotTaskApprovalType';
                stepId: string;
                status: string;
                title: string | null;
                decidedAt: string | null;
              } | null;
              artifacts: Array<{
                __typename?: 'CopilotTaskArtifactType';
                workspaceId: string;
                kind: string;
                id: string;
                title: string | null;
              }>;
              steps: Array<{
                __typename?: 'CopilotTaskStepType';
                id: string;
                key: string;
                type: string;
                status: string;
                title: string | null;
                order: number;
                startedAt: string | null;
                completedAt: string | null;
              }>;
            } | null;
          }>;
        };
        done: {
          __typename?: 'CopilotWorkbenchTaskSegmentType';
          capped: boolean;
          items: Array<{
            __typename?: 'CopilotWorkbenchTaskItemType';
            id: string;
            entityId: string;
            kind: string;
            segment: string;
            attention: string | null;
            workspaceId: string | null;
            projectId: string | null;
            title: string | null;
            status: string;
            requestedLevel: string | null;
            documentId: string | null;
            redacted: boolean;
            relatedUserId: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            availableActions: Array<string>;
            blocker: {
              __typename?: 'CopilotWorkbenchBlockerTaskType';
              creatorUserId: string;
              type: string;
              waitingOn: string;
              dueAt: string | null;
              overdue: boolean;
              origin: string;
              resolutionActorUserId: string | null;
            } | null;
            run: {
              __typename?: 'CopilotTaskType';
              id: string;
              sessionId: string | null;
              workspaceId: string;
              projectId: string | null;
              title: string | null;
              workflow: string;
              status: string;
              createdAt: string;
              updatedAt: string;
              startedAt: string | null;
              completedAt: string | null;
              failureCode: string | null;
              failureMessage: string | null;
              resultSummary: string | null;
              approvalSummary: unknown | null;
              approvalFingerprint: string | null;
              resultEvidence: unknown | null;
              availableActions: Array<string>;
              abandoned: boolean;
              approval: {
                __typename?: 'CopilotTaskApprovalType';
                stepId: string;
                status: string;
                title: string | null;
                decidedAt: string | null;
              } | null;
              artifacts: Array<{
                __typename?: 'CopilotTaskArtifactType';
                workspaceId: string;
                kind: string;
                id: string;
                title: string | null;
              }>;
              steps: Array<{
                __typename?: 'CopilotTaskStepType';
                id: string;
                key: string;
                type: string;
                status: string;
                title: string | null;
                order: number;
                startedAt: string | null;
                completedAt: string | null;
              }>;
            } | null;
          }>;
        };
      };
    };
  } | null;
};

export type CopilotWorkbenchTasksGetQueryVariables = Exact<{
  projectId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
}>;

export type CopilotWorkbenchTasksGetQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    copilot: {
      __typename?: 'Copilot';
      workbenchTasks: {
        __typename?: 'CopilotWorkbenchTaskListType';
        capped: boolean;
        nextCursor: string | null;
        items: Array<{
          __typename?: 'CopilotWorkbenchTaskItemType';
          id: string;
          entityId: string;
          kind: string;
          segment: string;
          attention: string | null;
          workspaceId: string | null;
          projectId: string | null;
          title: string | null;
          status: string;
          requestedLevel: string | null;
          documentId: string | null;
          redacted: boolean;
          relatedUserId: string | null;
          createdAt: string;
          updatedAt: string;
          completedAt: string | null;
          availableActions: Array<string>;
          blocker: {
            __typename?: 'CopilotWorkbenchBlockerTaskType';
            creatorUserId: string;
            type: string;
            waitingOn: string;
            dueAt: string | null;
            overdue: boolean;
            origin: string;
            resolutionActorUserId: string | null;
          } | null;
          run: {
            __typename?: 'CopilotTaskType';
            id: string;
            sessionId: string | null;
            workspaceId: string;
            projectId: string | null;
            title: string | null;
            workflow: string;
            status: string;
            createdAt: string;
            updatedAt: string;
            startedAt: string | null;
            completedAt: string | null;
            failureCode: string | null;
            failureMessage: string | null;
            resultSummary: string | null;
            approvalSummary: unknown | null;
            approvalFingerprint: string | null;
            resultEvidence: unknown | null;
            availableActions: Array<string>;
            abandoned: boolean;
            approval: {
              __typename?: 'CopilotTaskApprovalType';
              stepId: string;
              status: string;
              title: string | null;
              decidedAt: string | null;
            } | null;
            artifacts: Array<{
              __typename?: 'CopilotTaskArtifactType';
              workspaceId: string;
              kind: string;
              id: string;
              title: string | null;
            }>;
            steps: Array<{
              __typename?: 'CopilotTaskStepType';
              id: string;
              key: string;
              type: string;
              status: string;
              title: string | null;
              order: number;
              startedAt: string | null;
              completedAt: string | null;
            }>;
          } | null;
        }>;
      };
    };
  } | null;
};

export type AddWorkspaceEmbeddingFilesMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  blob: Scalars['Upload']['input'];
}>;

export type AddWorkspaceEmbeddingFilesMutation = {
  __typename?: 'Mutation';
  addWorkspaceEmbeddingFiles: {
    __typename?: 'CopilotWorkspaceFile';
    fileId: string;
    fileName: string;
    blobId: string;
    mimeType: string;
    size: number;
    createdAt: string;
  };
};

export type GetWorkspaceEmbeddingFilesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetWorkspaceEmbeddingFilesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    embedding: {
      __typename?: 'CopilotWorkspaceConfig';
      files: {
        __typename?: 'PaginatedCopilotWorkspaceFileType';
        totalCount: number;
        pageInfo: {
          __typename?: 'PageInfo';
          endCursor: string | null;
          hasNextPage: boolean;
        };
        edges: Array<{
          __typename?: 'CopilotWorkspaceFileTypeEdge';
          node: {
            __typename?: 'CopilotWorkspaceFile';
            fileId: string;
            fileName: string;
            blobId: string;
            mimeType: string;
            size: number;
            createdAt: string;
          };
        }>;
      };
    };
  };
};

export type RemoveWorkspaceEmbeddingFilesMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  fileId: Scalars['String']['input'];
}>;

export type RemoveWorkspaceEmbeddingFilesMutation = {
  __typename?: 'Mutation';
  removeWorkspaceEmbeddingFiles: boolean;
};

export type AddWorkspaceEmbeddingIgnoredDocsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  add: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type AddWorkspaceEmbeddingIgnoredDocsMutation = {
  __typename?: 'Mutation';
  updateWorkspaceEmbeddingIgnoredDocs: number;
};

export type GetAllWorkspaceEmbeddingIgnoredDocsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetAllWorkspaceEmbeddingIgnoredDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    embedding: {
      __typename?: 'CopilotWorkspaceConfig';
      allIgnoredDocs: Array<{
        __typename?: 'CopilotWorkspaceIgnoredDoc';
        docId: string;
        createdAt: string;
      }>;
    };
  };
};

export type GetWorkspaceEmbeddingIgnoredDocsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetWorkspaceEmbeddingIgnoredDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    embedding: {
      __typename?: 'CopilotWorkspaceConfig';
      ignoredDocs: {
        __typename?: 'PaginatedIgnoredDocsType';
        totalCount: number;
        pageInfo: {
          __typename?: 'PageInfo';
          endCursor: string | null;
          hasNextPage: boolean;
        };
        edges: Array<{
          __typename?: 'CopilotWorkspaceIgnoredDocTypeEdge';
          node: {
            __typename?: 'CopilotWorkspaceIgnoredDoc';
            docId: string;
            createdAt: string;
            docCreatedAt: string | null;
            docUpdatedAt: string | null;
            title: string | null;
            createdBy: string | null;
            createdByAvatar: string | null;
            updatedBy: string | null;
          };
        }>;
      };
    };
  };
};

export type RemoveWorkspaceEmbeddingIgnoredDocsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  remove: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type RemoveWorkspaceEmbeddingIgnoredDocsMutation = {
  __typename?: 'Mutation';
  updateWorkspaceEmbeddingIgnoredDocs: number;
};

export type CreateCheckoutSessionMutationVariables = Exact<{
  input: CreateCheckoutSessionInput;
}>;

export type CreateCheckoutSessionMutation = {
  __typename?: 'Mutation';
  createCheckoutSession: string;
};

export type CreateCustomerPortalMutationVariables = Exact<{
  [key: string]: never;
}>;

export type CreateCustomerPortalMutation = {
  __typename?: 'Mutation';
  createCustomerPortal: string;
};

export type CreateSelfhostCustomerPortalMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type CreateSelfhostCustomerPortalMutation = {
  __typename?: 'Mutation';
  createSelfhostWorkspaceCustomerPortal: string;
};

export type CreateWorkspaceMutationVariables = Exact<{ [key: string]: never }>;

export type CreateWorkspaceMutation = {
  __typename?: 'Mutation';
  createWorkspace: {
    __typename?: 'WorkspaceType';
    id: string;
    public: boolean;
    createdAt: string;
  };
};

export type DeleteAccountMutationVariables = Exact<{ [key: string]: never }>;

export type DeleteAccountMutation = {
  __typename?: 'Mutation';
  deleteAccount: { __typename?: 'DeleteAccount'; success: boolean };
};

export type DeleteWorkspaceMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteWorkspaceMutation = {
  __typename?: 'Mutation';
  deleteWorkspace: boolean;
};

export type DismissNotificationMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DismissNotificationMutation = {
  __typename?: 'Mutation';
  dismissNotification: boolean;
};

export type DismissReadNotificationsMutationVariables = Exact<{
  [key: string]: never;
}>;

export type DismissReadNotificationsMutation = {
  __typename?: 'Mutation';
  dismissReadNotifications: boolean;
};

export type GetDocRolePermissionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetDocRolePermissionsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      permissions: {
        __typename?: 'DocPermissions';
        Doc_Copy: boolean;
        Doc_Delete: boolean;
        Doc_Duplicate: boolean;
        Doc_Properties_Read: boolean;
        Doc_Properties_Update: boolean;
        Doc_Publish: boolean;
        Doc_Read: boolean;
        Doc_Restore: boolean;
        Doc_TransferOwner: boolean;
        Doc_Trash: boolean;
        Doc_Update: boolean;
        Doc_Users_Manage: boolean;
        Doc_Users_Read: boolean;
        Doc_Comments_Create: boolean;
        Doc_Comments_Delete: boolean;
        Doc_Comments_Read: boolean;
        Doc_Comments_Resolve: boolean;
      };
    };
  };
};

export type BeginEnterpriseAuthorizationMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  connectionId: Scalars['ID']['input'];
}>;

export type BeginEnterpriseAuthorizationMutation = {
  __typename?: 'Mutation';
  beginEnterpriseAuthorization: {
    __typename?: 'EnterpriseAuthorizationSessionType';
    id: string;
    connectionId: string;
    workspaceId: string;
    provider: EnterpriseProvider;
    status: EnterpriseAuthorizationStatus;
    authorizationUrl: string | null;
    userCode: string | null;
    qrCodeUrl: string | null;
    expiresAt: string;
    startedAt: string | null;
    completedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type CancelEnterpriseAuthorizationMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['ID']['input'];
}>;

export type CancelEnterpriseAuthorizationMutation = {
  __typename?: 'Mutation';
  cancelEnterpriseAuthorization: {
    __typename?: 'EnterpriseAuthorizationSessionType';
    id: string;
    connectionId: string;
    provider: EnterpriseProvider;
    status: EnterpriseAuthorizationStatus;
    expiresAt: string;
    completedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  };
};

export type LatestEnterpriseAuthorizationSessionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  connectionId: Scalars['ID']['input'];
}>;

export type LatestEnterpriseAuthorizationSessionQuery = {
  __typename?: 'Query';
  latestEnterpriseAuthorizationSession: {
    __typename?: 'EnterpriseAuthorizationSessionType';
    id: string;
    connectionId: string;
    workspaceId: string;
    provider: EnterpriseProvider;
    status: EnterpriseAuthorizationStatus;
    authorizationUrl: string | null;
    userCode: string | null;
    qrCodeUrl: string | null;
    expiresAt: string;
    startedAt: string | null;
    completedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type EnterpriseAuthorizationSessionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sessionId: Scalars['ID']['input'];
}>;

export type EnterpriseAuthorizationSessionQuery = {
  __typename?: 'Query';
  enterpriseAuthorizationSession: {
    __typename?: 'EnterpriseAuthorizationSessionType';
    id: string;
    connectionId: string;
    workspaceId: string;
    provider: EnterpriseProvider;
    status: EnterpriseAuthorizationStatus;
    authorizationUrl: string | null;
    userCode: string | null;
    qrCodeUrl: string | null;
    expiresAt: string;
    startedAt: string | null;
    completedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type EnterpriseConnectionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type EnterpriseConnectionsQuery = {
  __typename?: 'Query';
  enterpriseConnectionPolicy: {
    __typename?: 'EnterpriseConnectionPolicyType';
    enabled: boolean;
    allowedProviders: Array<EnterpriseProvider>;
  };
  enterpriseConnections: Array<{
    __typename?: 'EnterpriseConnectionType';
    id: string;
    workspaceId: string;
    provider: EnterpriseProvider;
    transport: EnterpriseConnectionTransport;
    name: string;
    status: EnterpriseConnectionStatus;
    externalTenantId: string | null;
    externalUserId: string | null;
    identityType: string | null;
    enabledToolNames: Array<string>;
    expiresAt: string | null;
    lastConnectedAt: string | null;
    lastCheckedAt: string | null;
    lastUsedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    tools: Array<{
      __typename?: 'EnterpriseToolType';
      name: string;
      description: string;
      inputSchema: unknown;
      risk: string;
      requiresConfirmation: boolean;
      supportsDryRun: boolean;
      enabled: boolean;
    }>;
  }>;
};

export type CreateEnterpriseConnectionMutationVariables = Exact<{
  input: CreateEnterpriseConnectionInput;
}>;

export type CreateEnterpriseConnectionMutation = {
  __typename?: 'Mutation';
  createEnterpriseConnection: {
    __typename?: 'EnterpriseConnectionType';
    id: string;
    workspaceId: string;
    provider: EnterpriseProvider;
    transport: EnterpriseConnectionTransport;
    name: string;
    status: EnterpriseConnectionStatus;
    createdAt: string;
    updatedAt: string;
  };
};

export type DeleteEnterpriseConnectionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  connectionId: Scalars['String']['input'];
}>;

export type DeleteEnterpriseConnectionMutation = {
  __typename?: 'Mutation';
  deleteEnterpriseConnection: boolean;
};

export type DisableEnterpriseConnectionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  connectionId: Scalars['String']['input'];
}>;

export type DisableEnterpriseConnectionMutation = {
  __typename?: 'Mutation';
  disableEnterpriseConnection: {
    __typename?: 'EnterpriseConnectionType';
    id: string;
    status: EnterpriseConnectionStatus;
    enabledToolNames: Array<string>;
    updatedAt: string;
  };
};

export type RefreshEnterpriseConnectionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  connectionId: Scalars['String']['input'];
}>;

export type RefreshEnterpriseConnectionMutation = {
  __typename?: 'Mutation';
  refreshEnterpriseConnection: {
    __typename?: 'EnterpriseConnectionType';
    id: string;
    status: EnterpriseConnectionStatus;
    enabledToolNames: Array<string>;
    lastConnectedAt: string | null;
    lastCheckedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  };
};

export type UpdateEnterpriseToolAllowlistMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  connectionId: Scalars['String']['input'];
  enabledToolNames:
    | Array<Scalars['String']['input']>
    | Scalars['String']['input'];
}>;

export type UpdateEnterpriseToolAllowlistMutation = {
  __typename?: 'Mutation';
  updateEnterpriseToolAllowlist: {
    __typename?: 'EnterpriseConnectionType';
    id: string;
    status: EnterpriseConnectionStatus;
    enabledToolNames: Array<string>;
    updatedAt: string;
  };
};

export type ConnectExternalMcpMutationVariables = Exact<{
  input: ConnectExternalMcpInput;
}>;

export type ConnectExternalMcpMutation = {
  __typename?: 'Mutation';
  connectExternalMcp: {
    __typename?: 'ExternalMcpConnectionType';
    id: string;
    status: ExternalMcpConnectionStatus;
    sessionFingerprint: string | null;
    serverName: string | null;
    serverVersion: string | null;
    lastConnectedAt: string | null;
  };
};

export type DeleteExternalMcpMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type DeleteExternalMcpMutation = {
  __typename?: 'Mutation';
  deleteExternalMcp: boolean;
};

export type DisableExternalMcpMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type DisableExternalMcpMutation = {
  __typename?: 'Mutation';
  disableExternalMcp: {
    __typename?: 'ExternalMcpConnectionType';
    id: string;
    status: ExternalMcpConnectionStatus;
  };
};

export type RefreshExternalMcpToolsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type RefreshExternalMcpToolsMutation = {
  __typename?: 'Mutation';
  refreshExternalMcpTools: {
    __typename?: 'ExternalMcpConnectionType';
    id: string;
    status: ExternalMcpConnectionStatus;
    toolCatalogFingerprint: string | null;
    lastCheckedAt: string | null;
  };
};

export type ExternalMcpSettingsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ExternalMcpSettingsQuery = {
  __typename?: 'Query';
  externalMcpSettings: {
    __typename?: 'ExternalMcpSettingsType';
    endpoint: string;
    protocolVersion: string;
    connection: {
      __typename?: 'ExternalMcpConnectionType';
      id: string;
      workspaceId: string;
      name: string;
      endpoint: string;
      protocolVersion: string;
      status: ExternalMcpConnectionStatus;
      sessionFingerprint: string | null;
      serverName: string | null;
      serverVersion: string | null;
      toolCatalogFingerprint: string | null;
      enabledToolNames: Array<string>;
      lastConnectedAt: string | null;
      lastCheckedAt: string | null;
      lastUsedAt: string | null;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
      createdAt: string;
      updatedAt: string;
      tools: Array<{
        __typename?: 'ExternalMcpToolType';
        name: string;
        title: string | null;
        description: string | null;
        inputSchema: unknown;
        enabled: boolean;
        risk: string;
        requiresExplicitUserRequest: boolean;
      }>;
    } | null;
  };
};

export type TestExternalMcpConversationMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  query: Scalars['String']['input'];
}>;

export type TestExternalMcpConversationMutation = {
  __typename?: 'Mutation';
  testExternalMcpConversation: {
    __typename?: 'ExternalMcpToolCallResultType';
    toolName: string;
    result: unknown;
  };
};

export type UpdateExternalMcpToolAllowlistMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  enabledToolNames:
    | Array<Scalars['String']['input']>
    | Scalars['String']['input'];
}>;

export type UpdateExternalMcpToolAllowlistMutation = {
  __typename?: 'Mutation';
  updateExternalMcpToolAllowlist: {
    __typename?: 'ExternalMcpConnectionType';
    id: string;
    status: ExternalMcpConnectionStatus;
    enabledToolNames: Array<string>;
  };
};

export type CopilotBlockerFieldsFragment = {
  __typename?: 'CopilotBlockerType';
  id: string;
  projectId: string;
  creatorUserId: string;
  title: string;
  type: string;
  waitingOn: string;
  dueAt: string | null;
  overdue: boolean;
  status: string;
  origin: string;
  resolutionActorUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CopilotChatHistoryFragment = {
  __typename?: 'CopilotHistories';
  sessionId: string;
  workspaceId: string;
  docId: string | null;
  selectedContextProjectId: string | null;
  parentSessionId: string | null;
  promptName: string;
  model: string;
  optionalModels: Array<string>;
  action: string | null;
  pinned: boolean;
  title: string | null;
  tokens: number;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    __typename?: 'ChatMessage';
    id: string | null;
    role: string;
    content: string;
    attachments: Array<string> | null;
    createdAt: string;
    streamObjects: Array<{
      __typename?: 'StreamObject';
      type: string;
      textDelta: string | null;
      toolCallId: string | null;
      toolName: string | null;
      args: unknown | null;
      result: unknown | null;
    }> | null;
  }>;
};

export type CopilotDocumentOperationFieldsFragment = {
  __typename?: 'CopilotDocumentOperationType';
  id: string;
  kind: string;
  sourceWorkspaceId: string | null;
  sourceDocumentId: string | null;
  title: string;
  status: string;
  projectStatus: string;
  documentId: string;
  destinationWorkspaceId: string | null;
  destinationFolderId: string | null;
  destinationRevision: number;
  locationExpiresAt: string;
  createdDocumentAt: string | null;
  placedDocumentAt: string | null;
  failureCode: string | null;
  accessRequestId: string | null;
};

export type CopilotWorkbenchTaskItemFieldsFragment = {
  __typename?: 'CopilotWorkbenchTaskItemType';
  id: string;
  entityId: string;
  kind: string;
  segment: string;
  attention: string | null;
  workspaceId: string | null;
  projectId: string | null;
  title: string | null;
  status: string;
  requestedLevel: string | null;
  documentId: string | null;
  redacted: boolean;
  relatedUserId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  availableActions: Array<string>;
  blocker: {
    __typename?: 'CopilotWorkbenchBlockerTaskType';
    creatorUserId: string;
    type: string;
    waitingOn: string;
    dueAt: string | null;
    overdue: boolean;
    origin: string;
    resolutionActorUserId: string | null;
  } | null;
  run: {
    __typename?: 'CopilotTaskType';
    id: string;
    sessionId: string | null;
    workspaceId: string;
    projectId: string | null;
    title: string | null;
    workflow: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    resultSummary: string | null;
    approvalSummary: unknown | null;
    approvalFingerprint: string | null;
    resultEvidence: unknown | null;
    availableActions: Array<string>;
    abandoned: boolean;
    approval: {
      __typename?: 'CopilotTaskApprovalType';
      stepId: string;
      status: string;
      title: string | null;
      decidedAt: string | null;
    } | null;
    artifacts: Array<{
      __typename?: 'CopilotTaskArtifactType';
      workspaceId: string;
      kind: string;
      id: string;
      title: string | null;
    }>;
    steps: Array<{
      __typename?: 'CopilotTaskStepType';
      id: string;
      key: string;
      type: string;
      status: string;
      title: string | null;
      order: number;
      startedAt: string | null;
      completedAt: string | null;
    }>;
  } | null;
};

export type CredentialsRequirementsFragment = {
  __typename?: 'CredentialsRequirementType';
  password: {
    __typename?: 'PasswordLimitsType';
    minLength: number;
    maxLength: number;
  };
};

export type OfficeCommentFieldsFragment = {
  __typename?: 'OfficeCommentType';
  id: string;
  content: any;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    __typename?: 'PublicUserType';
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  replies: Array<{
    __typename?: 'OfficeCommentReplyType';
    id: string;
    commentId: string;
    content: any;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  }>;
};

export type OfficeCommentReplyFieldsFragment = {
  __typename?: 'OfficeCommentReplyType';
  id: string;
  commentId: string;
  content: any;
  createdAt: string;
  updatedAt: string;
  user: {
    __typename?: 'PublicUserType';
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

export type PaginatedCopilotChatsFragment = {
  __typename?: 'PaginatedCopilotHistoriesType';
  pageInfo: {
    __typename?: 'PageInfo';
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: Array<{
    __typename?: 'CopilotHistoriesTypeEdge';
    cursor: string;
    node: {
      __typename?: 'CopilotHistories';
      sessionId: string;
      workspaceId: string;
      docId: string | null;
      selectedContextProjectId: string | null;
      parentSessionId: string | null;
      promptName: string;
      model: string;
      optionalModels: Array<string>;
      action: string | null;
      pinned: boolean;
      title: string | null;
      tokens: number;
      createdAt: string;
      updatedAt: string;
      messages: Array<{
        __typename?: 'ChatMessage';
        id: string | null;
        role: string;
        content: string;
        attachments: Array<string> | null;
        createdAt: string;
        streamObjects: Array<{
          __typename?: 'StreamObject';
          type: string;
          textDelta: string | null;
          toolCallId: string | null;
          toolName: string | null;
          args: unknown | null;
          result: unknown | null;
        }> | null;
      }>;
    };
  }>;
};

export type PasswordLimitsFragment = {
  __typename?: 'PasswordLimitsType';
  minLength: number;
  maxLength: number;
};

export type GenerateLicenseKeyMutationVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;

export type GenerateLicenseKeyMutation = {
  __typename?: 'Mutation';
  generateLicenseKey: string;
};

export type GetCurrentUserFeaturesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFeaturesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    features: Array<FeatureType>;
  } | null;
};

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetCurrentUserQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    hasPassword: boolean | null;
    features: Array<FeatureType>;
  } | null;
};

export type GetDocCreatedByUpdatedByListQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetDocCreatedByUpdatedByListQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    docs: {
      __typename?: 'PaginatedDocType';
      totalCount: number;
      pageInfo: {
        __typename?: 'PageInfo';
        endCursor: string | null;
        hasNextPage: boolean;
      };
      edges: Array<{
        __typename?: 'DocTypeEdge';
        node: {
          __typename?: 'DocType';
          id: string;
          creatorId: string | null;
          lastUpdaterId: string | null;
        };
      }>;
    };
  };
};

export type GetDocLastAccessedMembersQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  pagination: PaginationInput;
  query?: InputMaybe<Scalars['String']['input']>;
  includeTotal?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type GetDocLastAccessedMembersQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      lastAccessedMembers: {
        __typename?: 'PaginatedDocMemberLastAccess';
        totalCount: number | null;
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
        edges: Array<{
          __typename?: 'DocMemberLastAccessEdge';
          cursor: string;
          node: {
            __typename?: 'DocMemberLastAccess';
            lastAccessedAt: string;
            lastDocId: string | null;
            user: {
              __typename?: 'PublicUserType';
              id: string;
              name: string;
              avatarUrl: string | null;
            };
          };
        }>;
      };
    };
  };
};

export type GetDocPageAnalyticsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  input?: InputMaybe<DocPageAnalyticsInput>;
}>;

export type GetDocPageAnalyticsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      analytics: {
        __typename?: 'DocPageAnalytics';
        generatedAt: string;
        window: {
          __typename?: 'TimeWindow';
          from: string;
          to: string;
          timezone: string;
          bucket: TimeBucket;
          requestedSize: number;
          effectiveSize: number;
        };
        series: Array<{
          __typename?: 'DocPageAnalyticsPoint';
          date: string;
          totalViews: number;
          uniqueViews: number;
          guestViews: number;
        }>;
        summary: {
          __typename?: 'DocPageAnalyticsSummary';
          totalViews: number;
          uniqueViews: number;
          guestViews: number;
          lastAccessedAt: string | null;
        };
      };
    };
  };
};

export type GetDocSummaryQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
}>;

export type GetDocSummaryQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: { __typename?: 'DocType'; summary: string | null };
  };
};

export type GetInviteInfoQueryVariables = Exact<{
  inviteId: Scalars['String']['input'];
}>;

export type GetInviteInfoQuery = {
  __typename?: 'Query';
  getInviteInfo: {
    __typename?: 'InvitationType';
    status: WorkspaceMemberStatus | null;
    workspace: {
      __typename?: 'InvitationWorkspaceType';
      id: string;
      name: string;
      avatar: string;
    };
    user: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    invitee: {
      __typename?: 'WorkspaceUserType';
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  };
};

export type GetMemberCountByWorkspaceIdQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetMemberCountByWorkspaceIdQuery = {
  __typename?: 'Query';
  workspace: { __typename?: 'WorkspaceType'; memberCount: number };
};

export type OauthProvidersQueryVariables = Exact<{ [key: string]: never }>;

export type OauthProvidersQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    oauthProviders: Array<OAuthProviderType>;
  };
};

export type GetPublicUserByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetPublicUserByIdQuery = {
  __typename?: 'Query';
  publicUserById: {
    __typename?: 'PublicUserType';
    id: string;
    avatarUrl: string | null;
    name: string;
  } | null;
};

export type GetRecentlyUpdatedDocsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pagination: PaginationInput;
}>;

export type GetRecentlyUpdatedDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    recentlyUpdatedDocs: {
      __typename?: 'PaginatedDocType';
      totalCount: number;
      pageInfo: {
        __typename?: 'PageInfo';
        endCursor: string | null;
        hasNextPage: boolean;
      };
      edges: Array<{
        __typename?: 'DocTypeEdge';
        node: {
          __typename?: 'DocType';
          id: string;
          title: string | null;
          createdAt: string | null;
          updatedAt: string | null;
          creatorId: string | null;
          lastUpdaterId: string | null;
        };
      }>;
    };
  };
};

export type GetUserFeaturesQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserFeaturesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    features: Array<FeatureType>;
  } | null;
};

export type GetUserSettingsQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserSettingsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    settings: {
      __typename?: 'UserSettingsType';
      receiveInvitationEmail: boolean;
      receiveMentionEmail: boolean;
      receiveCommentEmail: boolean;
      receiveSparkClawNotifications: boolean;
    };
  } | null;
};

export type GetUserQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type GetUserQuery = {
  __typename?: 'Query';
  user:
    | {
        __typename: 'LimitedUserType';
        email: string;
        hasPassword: boolean | null;
      }
    | {
        __typename: 'UserType';
        id: string;
        name: string;
        avatarUrl: string | null;
        email: string;
        hasPassword: boolean | null;
      }
    | null;
};

export type GetWorkspacePageByIdQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
}>;

export type GetWorkspacePageByIdQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    doc: {
      __typename?: 'DocType';
      id: string;
      mode: PublicDocMode;
      defaultRole: DocRole;
      public: boolean;
      title: string | null;
      summary: string | null;
    };
  };
};

export type GetWorkspacePageMetaByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
}>;

export type GetWorkspacePageMetaByIdQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    pageMeta: {
      __typename?: 'WorkspaceDocMeta';
      createdAt: string;
      updatedAt: string;
      createdBy: {
        __typename?: 'EditorType';
        name: string;
        avatarUrl: string | null;
      } | null;
      updatedBy: {
        __typename?: 'EditorType';
        name: string;
        avatarUrl: string | null;
      } | null;
    };
  };
};

export type GetWorkspacePublicByIdQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspacePublicByIdQuery = {
  __typename?: 'Query';
  workspace: { __typename?: 'WorkspaceType'; public: boolean };
};

export type GetWorkspacePublicPagesQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetWorkspacePublicPagesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    publicDocs: Array<{
      __typename?: 'DocType';
      id: string;
      mode: PublicDocMode;
    }>;
  };
};

export type GetWorkspaceSubscriptionQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetWorkspaceSubscriptionQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    subscription: {
      __typename?: 'SubscriptionType';
      id: string | null;
      status: SubscriptionStatus;
      plan: SubscriptionPlan;
      recurring: SubscriptionRecurring;
      start: string;
      end: string | null;
      nextBillAt: string | null;
      canceledAt: string | null;
      variant: SubscriptionVariant | null;
    } | null;
  };
};

export type GetWorkspaceQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspaceQuery = {
  __typename?: 'Query';
  workspace: { __typename?: 'WorkspaceType'; id: string };
};

export type GetWorkspacesQueryVariables = Exact<{ [key: string]: never }>;

export type GetWorkspacesQuery = {
  __typename?: 'Query';
  workspaces: Array<{
    __typename?: 'WorkspaceType';
    enableAi: boolean;
    enableDocEmbedding: boolean;
    id: string;
    initialized: boolean;
    role: Permission;
    team: boolean;
    owner: { __typename?: 'UserType'; id: string };
  }>;
};

export type GrantDocUserRolesMutationVariables = Exact<{
  input: GrantDocUserRolesInput;
}>;

export type GrantDocUserRolesMutation = {
  __typename?: 'Mutation';
  grantDocUserRoles: boolean;
};

export type ListHistoryQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageDocId: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
  before?: InputMaybe<Scalars['DateTime']['input']>;
}>;

export type ListHistoryQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    histories: Array<{
      __typename?: 'DocHistoryType';
      id: string;
      timestamp: string;
      editor: {
        __typename?: 'EditorType';
        name: string;
        avatarUrl: string | null;
      } | null;
    }>;
  };
};

export type IndexerAggregateQueryVariables = Exact<{
  id: Scalars['String']['input'];
  input: AggregateInput;
}>;

export type IndexerAggregateQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    aggregate: {
      __typename?: 'AggregateResultObjectType';
      buckets: Array<{
        __typename?: 'AggregateBucketObjectType';
        key: string;
        count: number;
        hits: {
          __typename?: 'AggregateBucketHitsObjectType';
          nodes: Array<{
            __typename?: 'SearchNodeObjectType';
            fields: any;
            highlights: any | null;
          }>;
        };
      }>;
      pagination: {
        __typename?: 'SearchResultPagination';
        count: number;
        hasMore: boolean;
        nextCursor: string | null;
      };
    };
  };
};

export type IndexerSearchDocsQueryVariables = Exact<{
  id: Scalars['String']['input'];
  input: SearchDocsInput;
}>;

export type IndexerSearchDocsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    searchDocs: Array<{
      __typename?: 'SearchDocObjectType';
      docId: string;
      title: string;
      blockId: string;
      highlight: string;
      createdAt: string;
      updatedAt: string;
      createdByUser: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      } | null;
      updatedByUser: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      } | null;
    }>;
  };
};

export type IndexerSearchQueryVariables = Exact<{
  id: Scalars['String']['input'];
  input: SearchInput;
}>;

export type IndexerSearchQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    search: {
      __typename?: 'SearchResultObjectType';
      nodes: Array<{
        __typename?: 'SearchNodeObjectType';
        fields: any;
        highlights: any | null;
      }>;
      pagination: {
        __typename?: 'SearchResultPagination';
        count: number;
        hasMore: boolean;
        nextCursor: string | null;
      };
    };
  };
};

export type GetInvoicesCountQueryVariables = Exact<{ [key: string]: never }>;

export type GetInvoicesCountQuery = {
  __typename?: 'Query';
  currentUser: { __typename?: 'UserType'; invoiceCount: number } | null;
};

export type InvoicesQueryVariables = Exact<{
  take: Scalars['Int']['input'];
  skip: Scalars['Int']['input'];
}>;

export type InvoicesQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    invoiceCount: number;
    invoices: Array<{
      __typename?: 'InvoiceType';
      status: InvoiceStatus;
      currency: string;
      amount: number;
      reason: string;
      lastPaymentError: string | null;
      link: string | null;
      createdAt: string;
    }>;
  } | null;
};

export type CreateSparkClawPairingMutationVariables = Exact<{
  [key: string]: never;
}>;

export type CreateSparkClawPairingMutation = {
  __typename?: 'Mutation';
  createSparkClawPairing: {
    __typename?: 'SparkClawPairingType';
    command: string;
    expiresAt: string;
  };
};

export type DisconnectSparkClawEndpointMutationVariables = Exact<{
  endpointId: Scalars['ID']['input'];
}>;

export type DisconnectSparkClawEndpointMutation = {
  __typename?: 'Mutation';
  disconnectSparkClawEndpoint: boolean;
};

export type SparkClawEndpointsQueryVariables = Exact<{ [key: string]: never }>;

export type SparkClawEndpointsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    sparkClawEndpoints: Array<{
      __typename?: 'SparkClawEndpointType';
      id: string;
      deviceId: string;
      status: string;
      lastSeenAt: string | null;
      createdAt: string;
    }>;
  } | null;
};

export type LeaveWorkspaceMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  sendLeaveMail?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type LeaveWorkspaceMutation = {
  __typename?: 'Mutation';
  leaveWorkspace: boolean;
};

export type ActivateLicenseMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  license: Scalars['String']['input'];
}>;

export type ActivateLicenseMutation = {
  __typename?: 'Mutation';
  activateLicense: {
    __typename?: 'License';
    expiredAt: string | null;
    installedAt: string;
    quantity: number;
    recurring: SubscriptionRecurring;
    validatedAt: string;
    variant: SubscriptionVariant | null;
  };
};

export type DeactivateLicenseMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type DeactivateLicenseMutation = {
  __typename?: 'Mutation';
  deactivateLicense: boolean;
};

export type GetLicenseQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type GetLicenseQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    license: {
      __typename?: 'License';
      expiredAt: string | null;
      installedAt: string;
      quantity: number;
      recurring: SubscriptionRecurring;
      validatedAt: string;
      variant: SubscriptionVariant | null;
    } | null;
  };
};

export type InstallLicenseMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  license: Scalars['Upload']['input'];
}>;

export type InstallLicenseMutation = {
  __typename?: 'Mutation';
  installLicense: {
    __typename?: 'License';
    expiredAt: string | null;
    installedAt: string;
    quantity: number;
    recurring: SubscriptionRecurring;
    validatedAt: string;
    variant: SubscriptionVariant | null;
  };
};

export type LicenseBodyFragment = {
  __typename?: 'License';
  expiredAt: string | null;
  installedAt: string;
  quantity: number;
  recurring: SubscriptionRecurring;
  validatedAt: string;
  variant: SubscriptionVariant | null;
};

export type PreviewLicenseMutationVariables = Exact<{
  license: Scalars['Upload']['input'];
}>;

export type PreviewLicenseMutation = {
  __typename?: 'Mutation';
  previewLicense: {
    __typename?: 'AdminLicensePreview';
    id: string;
    workspaceId: string;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    quantity: number;
    issuedAt: string;
    expiresAt: string;
    endAt: string;
    entity: string;
    issuer: string;
    valid: boolean;
  };
};

export type ListNotificationsQueryVariables = Exact<{
  pagination: PaginationInput;
  includeRead?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type ListNotificationsQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    notifications: {
      __typename?: 'PaginatedNotificationObjectType';
      totalCount: number;
      edges: Array<{
        __typename?: 'NotificationObjectTypeEdge';
        cursor: string;
        node: {
          __typename?: 'NotificationObjectType';
          id: string;
          type: NotificationType;
          level: NotificationLevel;
          read: boolean;
          createdAt: string;
          updatedAt: string;
          body: any;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        startCursor: string | null;
        endCursor: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  } | null;
};

export type CreateMcpCredentialMutationVariables = Exact<{
  input: CreateMcpCredentialInput;
}>;

export type CreateMcpCredentialMutation = {
  __typename?: 'Mutation';
  createMcpCredential: {
    __typename?: 'RevealedMcpCredentialType';
    token: string;
    callbackSecret: string | null;
    credential: {
      __typename?: 'McpCredentialType';
      id: string;
      name: string;
      workspaceId: string;
      accessMode: McpAccessMode;
      capabilities: Array<string>;
      fingerprint: string;
      createdAt: string;
      expiresAt: string;
      lastUsedAt: string | null;
      revokedAt: string | null;
      graceEndsAt: string | null;
      status: McpCredentialStatus;
      callbackConfigured: boolean;
    };
  };
};

export type McpCredentialsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type McpCredentialsQuery = {
  __typename?: 'Query';
  mcpCredentialReadWriteAvailable: boolean;
  mcpCredentials: Array<{
    __typename?: 'McpCredentialType';
    id: string;
    name: string;
    workspaceId: string;
    accessMode: McpAccessMode;
    capabilities: Array<string>;
    fingerprint: string;
    createdAt: string;
    expiresAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    graceEndsAt: string | null;
    status: McpCredentialStatus;
    callbackConfigured: boolean;
  }>;
};

export type RevokeMcpCredentialMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
}>;

export type RevokeMcpCredentialMutation = {
  __typename?: 'Mutation';
  revokeMcpCredential: boolean;
};

export type RotateMcpCredentialMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  workspaceId: Scalars['String']['input'];
  expirationDays: Scalars['Int']['input'];
}>;

export type RotateMcpCredentialMutation = {
  __typename?: 'Mutation';
  rotateMcpCredential: {
    __typename?: 'RevealedMcpCredentialType';
    token: string;
    callbackSecret: string | null;
    credential: {
      __typename?: 'McpCredentialType';
      id: string;
      name: string;
      workspaceId: string;
      accessMode: McpAccessMode;
      capabilities: Array<string>;
      fingerprint: string;
      createdAt: string;
      expiresAt: string;
      lastUsedAt: string | null;
      revokedAt: string | null;
      graceEndsAt: string | null;
      status: McpCredentialStatus;
      callbackConfigured: boolean;
    };
  };
};

export type MentionUserMutationVariables = Exact<{
  input: MentionInput;
}>;

export type MentionUserMutation = {
  __typename?: 'Mutation';
  mentionUser: string;
};

export type OfficeArtifactQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  artifactId: Scalars['String']['input'];
}>;

export type OfficeArtifactQuery = {
  __typename?: 'Query';
  officeArtifact: {
    __typename?: 'OfficeArtifactType';
    id: string;
    workspaceId: string;
    kind: OfficeArtifactKind;
    title: string;
    sourceFileName: string;
    sourceMimeType: string;
    sourceByteSize: number;
    sourceFingerprint: string;
    revisionCounter: number;
    compatibility: any;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    currentRevision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      workspaceId: string;
      artifactId: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      parentRevisionId: string | null;
      packageMimeType: string;
      packageByteSize: number;
      packageFingerprint: string;
      stateByteSize: number | null;
      stateFingerprint: string | null;
      modelVersion: string;
      operationSummary: any;
      createdBy: string;
      createdAt: string;
      packageUrl: string;
      stateUrl: string | null;
    };
  } | null;
};

export type OfficeArtifactsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  kind?: InputMaybe<OfficeArtifactKind>;
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}>;

export type OfficeArtifactsQuery = {
  __typename?: 'Query';
  officeArtifacts: Array<{
    __typename?: 'OfficeArtifactType';
    id: string;
    workspaceId: string;
    kind: OfficeArtifactKind;
    title: string;
    sourceFileName: string;
    sourceMimeType: string;
    sourceByteSize: number;
    sourceFingerprint: string;
    revisionCounter: number;
    compatibility: any;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    currentRevision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      workspaceId: string;
      artifactId: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      parentRevisionId: string | null;
      packageMimeType: string;
      packageByteSize: number;
      packageFingerprint: string;
      stateByteSize: number | null;
      stateFingerprint: string | null;
      modelVersion: string;
      operationSummary: any;
      createdBy: string;
      createdAt: string;
      packageUrl: string;
      stateUrl: string | null;
    };
  }>;
};

export type OfficeCollaboratorsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  artifactId: Scalars['String']['input'];
}>;

export type OfficeCollaboratorsQuery = {
  __typename?: 'Query';
  officeCollaborators: Array<{
    __typename?: 'PublicUserType';
    id: string;
    name: string;
    avatarUrl: string | null;
  }>;
};

export type ExecuteOfficeCommandMutationVariables = Exact<{
  input: OfficeCommandInput;
}>;

export type ExecuteOfficeCommandMutation = {
  __typename?: 'Mutation';
  executeOfficeCommand: {
    __typename?: 'ExecuteOfficeCommandResultType';
    created: boolean;
    summary: any;
    artifact: {
      __typename?: 'OfficeArtifactType';
      id: string;
      workspaceId: string;
      kind: OfficeArtifactKind;
      title: string;
      sourceFileName: string;
      sourceMimeType: string;
      sourceByteSize: number;
      sourceFingerprint: string;
      revisionCounter: number;
      compatibility: any;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
      currentRevision: {
        __typename?: 'OfficeRevisionType';
        id: string;
        workspaceId: string;
        artifactId: string;
        sequence: number;
        origin: OfficeRevisionOrigin;
        parentRevisionId: string | null;
        packageMimeType: string;
        packageByteSize: number;
        packageFingerprint: string;
        stateByteSize: number | null;
        stateFingerprint: string | null;
        modelVersion: string;
        operationSummary: any;
        createdBy: string;
        createdAt: string;
        packageUrl: string;
        stateUrl: string | null;
      };
    };
    revision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      workspaceId: string;
      artifactId: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      parentRevisionId: string | null;
      packageMimeType: string;
      packageByteSize: number;
      packageFingerprint: string;
      stateByteSize: number | null;
      stateFingerprint: string | null;
      modelVersion: string;
      operationSummary: any;
      createdBy: string;
      createdAt: string;
      packageUrl: string;
      stateUrl: string | null;
    };
  };
};

export type PreviewOfficeCommandQueryVariables = Exact<{
  input: OfficeCommandInput;
}>;

export type PreviewOfficeCommandQuery = {
  __typename?: 'Query';
  previewOfficeCommand: {
    __typename?: 'OfficeCommandPreviewType';
    artifactId: string;
    expectedRevisionId: string;
    packageFingerprint: string;
    stateFingerprint: string;
    stats: any;
    summary: any;
  };
};

export type CreateOfficeCommentMutationVariables = Exact<{
  input: OfficeCommentCreateInput;
}>;

export type CreateOfficeCommentMutation = {
  __typename?: 'Mutation';
  createOfficeComment: {
    __typename?: 'OfficeCommentType';
    id: string;
    content: any;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    replies: Array<{
      __typename?: 'OfficeCommentReplyType';
      id: string;
      commentId: string;
      content: any;
      createdAt: string;
      updatedAt: string;
      user: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  };
};

export type DeleteOfficeCommentMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteOfficeCommentMutation = {
  __typename?: 'Mutation';
  deleteOfficeComment: boolean;
};

export type CreateOfficeCommentReplyMutationVariables = Exact<{
  input: OfficeCommentReplyCreateInput;
}>;

export type CreateOfficeCommentReplyMutation = {
  __typename?: 'Mutation';
  createOfficeCommentReply: {
    __typename?: 'OfficeCommentReplyType';
    id: string;
    commentId: string;
    content: any;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
};

export type DeleteOfficeCommentReplyMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type DeleteOfficeCommentReplyMutation = {
  __typename?: 'Mutation';
  deleteOfficeCommentReply: boolean;
};

export type UpdateOfficeCommentReplyMutationVariables = Exact<{
  input: OfficeCommentReplyUpdateInput;
}>;

export type UpdateOfficeCommentReplyMutation = {
  __typename?: 'Mutation';
  updateOfficeCommentReply: {
    __typename?: 'OfficeCommentReplyType';
    id: string;
    commentId: string;
    content: any;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
};

export type ResolveOfficeCommentMutationVariables = Exact<{
  input: OfficeCommentResolveInput;
}>;

export type ResolveOfficeCommentMutation = {
  __typename?: 'Mutation';
  resolveOfficeComment: {
    __typename?: 'OfficeCommentType';
    id: string;
    content: any;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    replies: Array<{
      __typename?: 'OfficeCommentReplyType';
      id: string;
      commentId: string;
      content: any;
      createdAt: string;
      updatedAt: string;
      user: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  };
};

export type UpdateOfficeCommentMutationVariables = Exact<{
  input: OfficeCommentUpdateInput;
}>;

export type UpdateOfficeCommentMutation = {
  __typename?: 'Mutation';
  updateOfficeComment: {
    __typename?: 'OfficeCommentType';
    id: string;
    content: any;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    replies: Array<{
      __typename?: 'OfficeCommentReplyType';
      id: string;
      commentId: string;
      content: any;
      createdAt: string;
      updatedAt: string;
      user: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  };
};

export type OfficeCommentsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  artifactId: Scalars['String']['input'];
}>;

export type OfficeCommentsQuery = {
  __typename?: 'Query';
  officeComments: Array<{
    __typename?: 'OfficeCommentType';
    id: string;
    content: any;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      __typename?: 'PublicUserType';
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    replies: Array<{
      __typename?: 'OfficeCommentReplyType';
      id: string;
      commentId: string;
      content: any;
      createdAt: string;
      updatedAt: string;
      user: {
        __typename?: 'PublicUserType';
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  }>;
};

export type ExecuteOfficeDocxCommandMutationVariables = Exact<{
  input: OfficeDocxCommandInput;
}>;

export type ExecuteOfficeDocxCommandMutation = {
  __typename?: 'Mutation';
  executeOfficeDocxCommand: {
    __typename?: 'ExecuteOfficeDocxCommandResultType';
    created: boolean;
    summary: any;
    artifact: {
      __typename?: 'OfficeArtifactType';
      id: string;
      workspaceId: string;
      kind: OfficeArtifactKind;
      title: string;
      revisionCounter: number;
      currentRevision: {
        __typename?: 'OfficeRevisionType';
        id: string;
        sequence: number;
        origin: OfficeRevisionOrigin;
        packageFingerprint: string;
        stateFingerprint: string | null;
        modelVersion: string;
        operationSummary: any;
        createdBy: string;
        createdAt: string;
        packageUrl: string;
        stateUrl: string | null;
      };
    };
    revision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      packageFingerprint: string;
      stateFingerprint: string | null;
      operationSummary: any;
      packageUrl: string;
      stateUrl: string | null;
    };
  };
};

export type PreviewOfficeDocxCommandQueryVariables = Exact<{
  input: OfficeDocxCommandInput;
}>;

export type PreviewOfficeDocxCommandQuery = {
  __typename?: 'Query';
  previewOfficeDocxCommand: {
    __typename?: 'OfficeDocxCommandPreviewType';
    artifactId: string;
    expectedRevisionId: string;
    packageFingerprint: string;
    stateFingerprint: string;
    stats: any;
    summary: any;
  };
};

export type ImportOfficeDocxMutationVariables = Exact<{
  input: ImportOfficeDocxRequestInput;
}>;

export type ImportOfficeDocxMutation = {
  __typename?: 'Mutation';
  importOfficeDocx: {
    __typename?: 'ImportOfficeDocxResultType';
    created: boolean;
    artifact: {
      __typename?: 'OfficeArtifactType';
      id: string;
      workspaceId: string;
      kind: OfficeArtifactKind;
      title: string;
      sourceFileName: string;
      sourceMimeType: string;
      sourceByteSize: number;
      sourceFingerprint: string;
      revisionCounter: number;
      compatibility: any;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
      currentRevision: {
        __typename?: 'OfficeRevisionType';
        id: string;
        sequence: number;
        origin: OfficeRevisionOrigin;
        packageMimeType: string;
        packageByteSize: number;
        packageFingerprint: string;
        stateByteSize: number | null;
        stateFingerprint: string | null;
        modelVersion: string;
        operationSummary: any;
        createdBy: string;
        createdAt: string;
        packageUrl: string;
        stateUrl: string | null;
      };
    };
    revision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      packageFingerprint: string;
      stateFingerprint: string | null;
      packageUrl: string;
      stateUrl: string | null;
    };
  };
};

export type ImportOfficeArtifactMutationVariables = Exact<{
  input: ImportOfficeArtifactRequestInput;
}>;

export type ImportOfficeArtifactMutation = {
  __typename?: 'Mutation';
  importOfficeArtifact: {
    __typename?: 'ImportOfficeArtifactResultType';
    created: boolean;
    artifact: {
      __typename?: 'OfficeArtifactType';
      id: string;
      workspaceId: string;
      kind: OfficeArtifactKind;
      title: string;
      sourceFileName: string;
      sourceMimeType: string;
      sourceByteSize: number;
      sourceFingerprint: string;
      revisionCounter: number;
      compatibility: any;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
      currentRevision: {
        __typename?: 'OfficeRevisionType';
        id: string;
        sequence: number;
        origin: OfficeRevisionOrigin;
        packageMimeType: string;
        packageByteSize: number;
        packageFingerprint: string;
        stateByteSize: number | null;
        stateFingerprint: string | null;
        modelVersion: string;
        operationSummary: any;
        createdBy: string;
        createdAt: string;
        packageUrl: string;
        stateUrl: string | null;
      };
    };
    revision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      packageFingerprint: string;
      stateFingerprint: string | null;
      packageUrl: string;
      stateUrl: string | null;
    };
  };
};

export type OfficeRevisionCompareQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  artifactId: Scalars['String']['input'];
  beforeRevisionId: Scalars['String']['input'];
  afterRevisionId: Scalars['String']['input'];
}>;

export type OfficeRevisionCompareQuery = {
  __typename?: 'Query';
  officeRevisionCompare: {
    __typename?: 'OfficeRevisionCompareType';
    artifactId: string;
    kind: OfficeArtifactKind;
    changed: boolean;
    truncated: boolean;
    summary: any;
    changes: unknown;
    beforeRevision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      createdAt: string;
      createdBy: string;
      operationSummary: any;
      packageFingerprint: string;
      stateFingerprint: string | null;
      packageUrl: string;
      stateUrl: string | null;
    };
    afterRevision: {
      __typename?: 'OfficeRevisionType';
      id: string;
      sequence: number;
      origin: OfficeRevisionOrigin;
      createdAt: string;
      createdBy: string;
      operationSummary: any;
      packageFingerprint: string;
      stateFingerprint: string | null;
      packageUrl: string;
      stateUrl: string | null;
    };
  };
};

export type OfficeRevisionsQueryVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  artifactId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['SafeInt']['input']>;
}>;

export type OfficeRevisionsQuery = {
  __typename?: 'Query';
  officeRevisions: Array<{
    __typename?: 'OfficeRevisionType';
    id: string;
    workspaceId: string;
    artifactId: string;
    sequence: number;
    origin: OfficeRevisionOrigin;
    parentRevisionId: string | null;
    packageMimeType: string;
    packageByteSize: number;
    packageFingerprint: string;
    stateByteSize: number | null;
    stateFingerprint: string | null;
    modelVersion: string;
    operationSummary: any;
    createdBy: string;
    createdAt: string;
    packageUrl: string;
    stateUrl: string | null;
  }>;
};

export type PricesQueryVariables = Exact<{ [key: string]: never }>;

export type PricesQuery = {
  __typename?: 'Query';
  prices: Array<{
    __typename?: 'SubscriptionPrice';
    type: string;
    plan: SubscriptionPlan;
    currency: string;
    amount: number | null;
    yearlyAmount: number | null;
    lifetimeAmount: number | null;
  }>;
};

export type PublishPageMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
  mode?: InputMaybe<PublicDocMode>;
}>;

export type PublishPageMutation = {
  __typename?: 'Mutation';
  publishDoc: { __typename?: 'DocType'; id: string; mode: PublicDocMode };
};

export type QuotaQueryVariables = Exact<{ [key: string]: never }>;

export type QuotaQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    quota: {
      __typename?: 'UserQuotaType';
      name: string;
      blobLimit: number;
      storageQuota: number;
      historyPeriod: number;
      memberLimit: number;
      humanReadable: {
        __typename?: 'UserQuotaHumanReadableType';
        name: string;
        blobLimit: string;
        storageQuota: string;
        historyPeriod: string;
        memberLimit: string;
      };
    };
    quotaUsage: { __typename?: 'UserQuotaUsageType'; storageQuota: number };
  } | null;
};

export type ReadAllNotificationsMutationVariables = Exact<{
  [key: string]: never;
}>;

export type ReadAllNotificationsMutation = {
  __typename?: 'Mutation';
  readAllNotifications: boolean;
};

export type ReadNotificationMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type ReadNotificationMutation = {
  __typename?: 'Mutation';
  readNotification: boolean;
};

export type RecoverDocMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  docId: Scalars['String']['input'];
  timestamp: Scalars['DateTime']['input'];
}>;

export type RecoverDocMutation = {
  __typename?: 'Mutation';
  recoverDoc: string;
};

export type RemoveAvatarMutationVariables = Exact<{ [key: string]: never }>;

export type RemoveAvatarMutation = {
  __typename?: 'Mutation';
  removeAvatar: { __typename?: 'RemoveAvatar'; success: boolean };
};

export type ResumeSubscriptionMutationVariables = Exact<{
  plan?: InputMaybe<SubscriptionPlan>;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type ResumeSubscriptionMutation = {
  __typename?: 'Mutation';
  resumeSubscription: {
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    nextBillAt: string | null;
    start: string;
    end: string | null;
  };
};

export type RevokeDocUserRolesMutationVariables = Exact<{
  input: RevokeDocUserRoleInput;
}>;

export type RevokeDocUserRolesMutation = {
  __typename?: 'Mutation';
  revokeDocUserRoles: boolean;
};

export type RevokeMemberPermissionMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;

export type RevokeMemberPermissionMutation = {
  __typename?: 'Mutation';
  revokeMember: boolean;
};

export type RevokePublicPageMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  pageId: Scalars['String']['input'];
}>;

export type RevokePublicPageMutation = {
  __typename?: 'Mutation';
  revokePublicDoc: {
    __typename?: 'DocType';
    id: string;
    mode: PublicDocMode;
    public: boolean;
  };
};

export type SendChangeEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendChangeEmailMutation = {
  __typename?: 'Mutation';
  sendChangeEmail: boolean;
};

export type SendChangePasswordEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendChangePasswordEmailMutation = {
  __typename?: 'Mutation';
  sendChangePasswordEmail: boolean;
};

export type SendSetPasswordEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendSetPasswordEmailMutation = {
  __typename?: 'Mutation';
  sendSetPasswordEmail: boolean;
};

export type SendVerifyChangeEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
  email: Scalars['String']['input'];
  callbackUrl: Scalars['String']['input'];
}>;

export type SendVerifyChangeEmailMutation = {
  __typename?: 'Mutation';
  sendVerifyChangeEmail: boolean;
};

export type SendVerifyEmailMutationVariables = Exact<{
  callbackUrl: Scalars['String']['input'];
}>;

export type SendVerifyEmailMutation = {
  __typename?: 'Mutation';
  sendVerifyEmail: boolean;
};

export type ServerConfigQueryVariables = Exact<{ [key: string]: never }>;

export type ServerConfigQuery = {
  __typename?: 'Query';
  serverConfig: {
    __typename?: 'ServerConfigType';
    version: string;
    baseUrl: string;
    name: string;
    features: Array<ServerFeature>;
    type: ServerDeploymentType;
    initialized: boolean;
    calendarProviders: Array<CalendarProviderType>;
    credentialsRequirement: {
      __typename?: 'CredentialsRequirementType';
      password: {
        __typename?: 'PasswordLimitsType';
        minLength: number;
        maxLength: number;
      };
    };
  };
};

export type SetWorkspacePublicByIdMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  public: Scalars['Boolean']['input'];
}>;

export type SetWorkspacePublicByIdMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type RefreshSubscriptionMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RefreshSubscriptionMutation = {
  __typename?: 'Mutation';
  refreshUserSubscriptions: Array<{
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    start: string;
    end: string | null;
    nextBillAt: string | null;
    canceledAt: string | null;
    variant: SubscriptionVariant | null;
  }>;
};

export type RequestApplySubscriptionMutationVariables = Exact<{
  transactionId: Scalars['String']['input'];
}>;

export type RequestApplySubscriptionMutation = {
  __typename?: 'Mutation';
  requestApplySubscription: Array<{
    __typename?: 'SubscriptionType';
    id: string | null;
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    start: string;
    end: string | null;
    nextBillAt: string | null;
    canceledAt: string | null;
    variant: SubscriptionVariant | null;
  }>;
};

export type SubscriptionQueryVariables = Exact<{ [key: string]: never }>;

export type SubscriptionQuery = {
  __typename?: 'Query';
  currentUser: {
    __typename?: 'UserType';
    id: string;
    subscriptions: Array<{
      __typename?: 'SubscriptionType';
      id: string | null;
      status: SubscriptionStatus;
      plan: SubscriptionPlan;
      recurring: SubscriptionRecurring;
      start: string;
      end: string | null;
      nextBillAt: string | null;
      canceledAt: string | null;
      variant: SubscriptionVariant | null;
    }>;
  } | null;
};

export type UpdateDocDefaultRoleMutationVariables = Exact<{
  input: UpdateDocDefaultRoleInput;
}>;

export type UpdateDocDefaultRoleMutation = {
  __typename?: 'Mutation';
  updateDocDefaultRole: boolean;
};

export type UpdateDocUserRoleMutationVariables = Exact<{
  input: UpdateDocUserRoleInput;
}>;

export type UpdateDocUserRoleMutation = {
  __typename?: 'Mutation';
  updateDocUserRole: boolean;
};

export type UpdateSubscriptionMutationVariables = Exact<{
  plan?: InputMaybe<SubscriptionPlan>;
  recurring: SubscriptionRecurring;
  workspaceId?: InputMaybe<Scalars['String']['input']>;
}>;

export type UpdateSubscriptionMutation = {
  __typename?: 'Mutation';
  updateSubscriptionRecurring: {
    __typename?: 'SubscriptionType';
    id: string | null;
    plan: SubscriptionPlan;
    recurring: SubscriptionRecurring;
    nextBillAt: string | null;
  };
};

export type UpdateUserProfileMutationVariables = Exact<{
  input: UpdateUserInput;
}>;

export type UpdateUserProfileMutation = {
  __typename?: 'Mutation';
  updateProfile: { __typename?: 'UserType'; id: string; name: string };
};

export type UpdateUserSettingsMutationVariables = Exact<{
  input: UpdateUserSettingsInput;
}>;

export type UpdateUserSettingsMutation = {
  __typename?: 'Mutation';
  updateSettings: boolean;
};

export type UploadAvatarMutationVariables = Exact<{
  avatar: Scalars['Upload']['input'];
}>;

export type UploadAvatarMutation = {
  __typename?: 'Mutation';
  uploadAvatar: {
    __typename?: 'UserType';
    id: string;
    name: string;
    avatarUrl: string | null;
    email: string;
  };
};

export type VerifyEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type VerifyEmailMutation = {
  __typename?: 'Mutation';
  verifyEmail: boolean;
};

export type WorkspaceBlobQuotaQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type WorkspaceBlobQuotaQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    quota: {
      __typename?: 'WorkspaceQuotaType';
      blobLimit: number;
      humanReadable: {
        __typename?: 'WorkspaceQuotaHumanReadableType';
        blobLimit: string;
      };
    };
  };
};

export type ClearWorkspaceByokConfigsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type ClearWorkspaceByokConfigsMutation = {
  __typename?: 'Mutation';
  clearWorkspaceByokConfigs: boolean;
};

export type DeleteWorkspaceByokConfigMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  id: Scalars['ID']['input'];
}>;

export type DeleteWorkspaceByokConfigMutation = {
  __typename?: 'Mutation';
  deleteWorkspaceByokConfig: boolean;
};

export type ReorderWorkspaceByokConfigsMutationVariables = Exact<{
  input: ReorderWorkspaceByokConfigsInput;
}>;

export type ReorderWorkspaceByokConfigsMutation = {
  __typename?: 'Mutation';
  reorderWorkspaceByokConfigs: Array<{
    __typename?: 'WorkspaceByokKeyConfigType';
    id: string;
    sortOrder: number;
  }>;
};

export type TestWorkspaceByokConfigMutationVariables = Exact<{
  input: TestWorkspaceByokConfigInput;
}>;

export type TestWorkspaceByokConfigMutation = {
  __typename?: 'Mutation';
  testWorkspaceByokConfig: {
    __typename?: 'TestWorkspaceByokConfigResultType';
    ok: boolean;
    status: ByokKeyTestStatus;
    message: string | null;
  };
};

export type UpsertWorkspaceByokConfigMutationVariables = Exact<{
  input: UpsertWorkspaceByokConfigInput;
}>;

export type UpsertWorkspaceByokConfigMutation = {
  __typename?: 'Mutation';
  upsertWorkspaceByokConfig: {
    __typename?: 'WorkspaceByokKeyConfigType';
    id: string;
  };
};

export type WorkspaceByokSettingsQueryVariables = Exact<{
  id: Scalars['String']['input'];
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
}>;

export type WorkspaceByokSettingsQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    id: string;
    byokSettings: {
      __typename?: 'WorkspaceByokSettingsType';
      workspaceId: string;
      entitled: boolean;
      serverEntitled: boolean;
      localEntitled: boolean;
      entitlementRequired: Array<string>;
      allowedProviders: Array<ByokProvider>;
      localStorageSupported: boolean;
      customEndpointSupported: boolean;
      privateEndpointSupported: boolean;
      hasAiPlan: boolean;
      keys: Array<{
        __typename?: 'WorkspaceByokKeyConfigType';
        id: string;
        provider: ByokProvider;
        name: string;
        description: string | null;
        storage: ByokKeyStorage;
        configured: boolean;
        enabled: boolean;
        endpoint: string | null;
        modelId: string | null;
        endpointEditable: boolean;
        sortOrder: number;
        capabilities: Array<string>;
        testStatus: ByokKeyTestStatus;
        disabledReason: string | null;
        lastTestedAt: string | null;
        lastTestError: string | null;
        lastUsedAt: string | null;
        lastErrorAt: string | null;
        lastError: string | null;
      }>;
      warnings: Array<{
        __typename?: 'WorkspaceByokCapabilityWarningType';
        featureKind: string;
        reason: string;
        requiredProviders: Array<ByokProvider>;
      }>;
    };
    byokUsage: Array<{
      __typename?: 'WorkspaceByokUsagePointType';
      date: string;
      featureKind: string;
      totalTokens: number;
    }>;
  };
};

export type WorkspaceDirectoryQueryVariables = Exact<{
  workspaceId: Scalars['ID']['input'];
  after?: InputMaybe<Scalars['String']['input']>;
}>;

export type WorkspaceDirectoryQuery = {
  __typename?: 'Query';
  workspaceDirectory: {
    __typename?: 'WorkspaceDirectoryPageType';
    revision: string;
    authorizationRevision: string;
    fullSyncAllowed: boolean;
    nextCursor: string | null;
    rootRights: {
      __typename?: 'WorkspaceDirectoryRightsType';
      canRead: boolean;
      canWrite: boolean;
      canOrganize: boolean;
      canCreateFolder: boolean;
    };
    items: Array<{
      __typename?: 'WorkspaceDirectoryEntryType';
      id: string;
      parentId: string | null;
      type: string;
      data: string;
      index: string;
      rights: {
        __typename?: 'WorkspaceDirectoryRightsType';
        canRead: boolean;
        canWrite: boolean;
        canOrganize: boolean;
        canCreateFolder: boolean;
      };
    }>;
  };
};

export type MutateWorkspaceDirectoryMutationVariables = Exact<{
  workspaceId: Scalars['ID']['input'];
  expectedRevision: Scalars['String']['input'];
  changes: Array<WorkspaceDirectoryChangeInput> | WorkspaceDirectoryChangeInput;
}>;

export type MutateWorkspaceDirectoryMutation = {
  __typename?: 'Mutation';
  mutateWorkspaceDirectory: {
    __typename?: 'WorkspaceDirectoryMutationType';
    revision: string;
  };
};

export type WorkspaceDirectoryAdministrationQueryVariables = Exact<{
  workspaceId: Scalars['ID']['input'];
  auditAfter?: InputMaybe<Scalars['String']['input']>;
}>;

export type WorkspaceDirectoryAdministrationQuery = {
  __typename?: 'Query';
  workspaceDirectoryAdministration: {
    __typename?: 'WorkspaceDirectoryAdministrationType';
    revision: string;
    auditNextCursor: string | null;
    directories: Array<{
      __typename?: 'WorkspaceDirectoryPolicyDirectoryType';
      id: string;
      parentId: string | null;
      name: string;
    }>;
    principals: Array<{
      __typename?: 'WorkspaceDirectoryPolicyPrincipalType';
      id: string;
      name: string | null;
      email: string | null;
      allMembers: boolean;
    }>;
    policies: Array<{
      __typename?: 'WorkspaceDirectoryPolicyType';
      directoryId: string;
      principalId: string;
      updatedAt: string;
      rights: {
        __typename?: 'WorkspaceDirectoryRightsType';
        canRead: boolean;
        canWrite: boolean;
        canOrganize: boolean;
        canCreateFolder: boolean;
      };
    }>;
    auditEvents: Array<{
      __typename?: 'WorkspaceDirectoryPolicyAuditType';
      id: string;
      actorId: string;
      directoryId: string;
      principalId: string;
      action: string;
      createdAt: string;
      before: {
        __typename?: 'WorkspaceDirectoryRightsType';
        canRead: boolean;
        canWrite: boolean;
        canOrganize: boolean;
        canCreateFolder: boolean;
      } | null;
      after: {
        __typename?: 'WorkspaceDirectoryRightsType';
        canRead: boolean;
        canWrite: boolean;
        canOrganize: boolean;
        canCreateFolder: boolean;
      } | null;
    }>;
  };
};

export type ChangeWorkspaceDirectoryPolicyMutationVariables = Exact<{
  workspaceId: Scalars['ID']['input'];
  expectedRevision: Scalars['String']['input'];
  directoryId: Scalars['ID']['input'];
  principalId: Scalars['ID']['input'];
  rights?: InputMaybe<WorkspaceDirectoryRightsInput>;
}>;

export type ChangeWorkspaceDirectoryPolicyMutation = {
  __typename?: 'Mutation';
  changeWorkspaceDirectoryPolicy: {
    __typename?: 'WorkspaceDirectoryPolicyMutationType';
    revision: string;
    policy: {
      __typename?: 'WorkspaceDirectoryPolicyType';
      directoryId: string;
      principalId: string;
      updatedAt: string;
      rights: {
        __typename?: 'WorkspaceDirectoryRightsType';
        canRead: boolean;
        canWrite: boolean;
        canOrganize: boolean;
        canCreateFolder: boolean;
      };
    } | null;
  };
};

export type SetEnableAiMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableAi: Scalars['Boolean']['input'];
}>;

export type SetEnableAiMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type SetEnableDocEmbeddingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableDocEmbedding: Scalars['Boolean']['input'];
}>;

export type SetEnableDocEmbeddingMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type SetEnableSharingMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableSharing: Scalars['Boolean']['input'];
}>;

export type SetEnableSharingMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type SetEnableUrlPreviewMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  enableUrlPreview: Scalars['Boolean']['input'];
}>;

export type SetEnableUrlPreviewMutation = {
  __typename?: 'Mutation';
  updateWorkspace: { __typename?: 'WorkspaceType'; id: string };
};

export type InviteByEmailsMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  emails: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;

export type InviteByEmailsMutation = {
  __typename?: 'Mutation';
  inviteMembers: Array<{
    __typename?: 'InviteResult';
    email: string;
    inviteId: string | null;
  }>;
};

export type AcceptInviteByInviteIdMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  inviteId: Scalars['String']['input'];
}>;

export type AcceptInviteByInviteIdMutation = {
  __typename?: 'Mutation';
  acceptInviteById: boolean;
};

export type CreateInviteLinkMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  expireTime: WorkspaceInviteLinkExpireTime;
}>;

export type CreateInviteLinkMutation = {
  __typename?: 'Mutation';
  createInviteLink: {
    __typename?: 'InviteLink';
    link: string;
    expireTime: string;
  };
};

export type RevokeInviteLinkMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
}>;

export type RevokeInviteLinkMutation = {
  __typename?: 'Mutation';
  revokeInviteLink: boolean;
};

export type WorkspaceInvoicesQueryVariables = Exact<{
  take: Scalars['Int']['input'];
  skip: Scalars['Int']['input'];
  workspaceId: Scalars['String']['input'];
}>;

export type WorkspaceInvoicesQuery = {
  __typename?: 'Query';
  workspace: {
    __typename?: 'WorkspaceType';
    invoiceCount: number;
    invoices: Array<{
      __typename?: 'InvoiceType';
      status: InvoiceStatus;
      currency: string;
      amount: number;
      reason: string;
      lastPaymentError: string | null;
      link: string | null;
      createdAt: string;
    }>;
  };
};

export type GetWorkspaceRolePermissionsQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;

export type GetWorkspaceRolePermissionsQuery = {
  __typename?: 'Query';
  workspaceRolePermissions: {
    __typename?: 'WorkspaceRolePermissions';
    permissions: {
      __typename?: 'WorkspacePermissions';
      Workspace_Administrators_Manage: boolean;
      Workspace_Blobs_List: boolean;
      Workspace_Blobs_Read: boolean;
      Workspace_Blobs_Write: boolean;
      Workspace_Copilot: boolean;
      Workspace_CreateDoc: boolean;
      Workspace_Delete: boolean;
      Workspace_Organize_Read: boolean;
      Workspace_Payment_Manage: boolean;
      Workspace_Properties_Create: boolean;
      Workspace_Properties_Delete: boolean;
      Workspace_Properties_Read: boolean;
      Workspace_Properties_Update: boolean;
      Workspace_Read: boolean;
      Workspace_Settings_Read: boolean;
      Workspace_Settings_Update: boolean;
      Workspace_Sync: boolean;
      Workspace_TransferOwner: boolean;
      Workspace_Users_Manage: boolean;
      Workspace_Users_Read: boolean;
    };
  };
};

export type ApproveWorkspaceTeamMemberMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
}>;

export type ApproveWorkspaceTeamMemberMutation = {
  __typename?: 'Mutation';
  approveMember: boolean;
};

export type GrantWorkspaceTeamMemberMutationVariables = Exact<{
  workspaceId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
  permission: Permission;
}>;

export type GrantWorkspaceTeamMemberMutation = {
  __typename?: 'Mutation';
  grantMember: boolean;
};

export type Queries =
  | {
      name: 'adminAiProfilesQuery';
      variables: AdminAiProfilesQueryVariables;
      response: AdminAiProfilesQuery;
    }
  | {
      name: 'adminAllSharedLinksQuery';
      variables: AdminAllSharedLinksQueryVariables;
      response: AdminAllSharedLinksQuery;
    }
  | {
      name: 'adminDashboardQuery';
      variables: AdminDashboardQueryVariables;
      response: AdminDashboardQuery;
    }
  | {
      name: 'adminMailDeliveriesQuery';
      variables: AdminMailDeliveriesQueryVariables;
      response: AdminMailDeliveriesQuery;
    }
  | {
      name: 'adminServerConfigQuery';
      variables: AdminServerConfigQueryVariables;
      response: AdminServerConfigQuery;
    }
  | {
      name: 'adminUserAiProfileAssignmentQuery';
      variables: AdminUserAiProfileAssignmentQueryVariables;
      response: AdminUserAiProfileAssignmentQuery;
    }
  | {
      name: 'adminWorkspaceByokScopesQuery';
      variables: AdminWorkspaceByokScopesQueryVariables;
      response: AdminWorkspaceByokScopesQuery;
    }
  | {
      name: 'adminWorkspaceByokSettingsQuery';
      variables: AdminWorkspaceByokSettingsQueryVariables;
      response: AdminWorkspaceByokSettingsQuery;
    }
  | {
      name: 'adminWorkspaceQuery';
      variables: AdminWorkspaceQueryVariables;
      response: AdminWorkspaceQuery;
    }
  | {
      name: 'adminWorkspacesQuery';
      variables: AdminWorkspacesQueryVariables;
      response: AdminWorkspacesQuery;
    }
  | {
      name: 'adminWorkspacesCountQuery';
      variables: AdminWorkspacesCountQueryVariables;
      response: AdminWorkspacesCountQuery;
    }
  | {
      name: 'authSigningKeysQuery';
      variables: AuthSigningKeysQueryVariables;
      response: AuthSigningKeysQuery;
    }
  | {
      name: 'appConfigQuery';
      variables: AppConfigQueryVariables;
      response: AppConfigQuery;
    }
  | {
      name: 'getUserByEmailQuery';
      variables: GetUserByEmailQueryVariables;
      response: GetUserByEmailQuery;
    }
  | {
      name: 'listUsersQuery';
      variables: ListUsersQueryVariables;
      response: ListUsersQuery;
    }
  | {
      name: 'validateConfigQuery';
      variables: ValidateConfigQueryVariables;
      response: ValidateConfigQuery;
    }
  | {
      name: 'listBlobsQuery';
      variables: ListBlobsQueryVariables;
      response: ListBlobsQuery;
    }
  | {
      name: 'getBlobUploadPartUrlQuery';
      variables: GetBlobUploadPartUrlQueryVariables;
      response: GetBlobUploadPartUrlQuery;
    }
  | {
      name: 'calendarAccountsQuery';
      variables: CalendarAccountsQueryVariables;
      response: CalendarAccountsQuery;
    }
  | {
      name: 'calendarEventsQuery';
      variables: CalendarEventsQueryVariables;
      response: CalendarEventsQuery;
    }
  | {
      name: 'calendarProvidersQuery';
      variables: CalendarProvidersQueryVariables;
      response: CalendarProvidersQuery;
    }
  | {
      name: 'workspaceCalendarsQuery';
      variables: WorkspaceCalendarsQueryVariables;
      response: WorkspaceCalendarsQuery;
    }
  | {
      name: 'listCommentChangesQuery';
      variables: ListCommentChangesQueryVariables;
      response: ListCommentChangesQuery;
    }
  | {
      name: 'listCommentsQuery';
      variables: ListCommentsQueryVariables;
      response: ListCommentsQuery;
    }
  | {
      name: 'getCopilotActionRunPreparedRouteTraceQuery';
      variables: GetCopilotActionRunPreparedRouteTraceQueryVariables;
      response: GetCopilotActionRunPreparedRouteTraceQuery;
    }
  | {
      name: 'getCopilotActionRunsQuery';
      variables: GetCopilotActionRunsQueryVariables;
      response: GetCopilotActionRunsQuery;
    }
  | {
      name: 'getCopilotAgentRunQuery';
      variables: GetCopilotAgentRunQueryVariables;
      response: GetCopilotAgentRunQuery;
    }
  | {
      name: 'getCopilotAgentRunsQuery';
      variables: GetCopilotAgentRunsQueryVariables;
      response: GetCopilotAgentRunsQuery;
    }
  | {
      name: 'copilotContextDashboardGetQuery';
      variables: CopilotContextDashboardGetQueryVariables;
      response: CopilotContextDashboardGetQuery;
    }
  | {
      name: 'listContextObjectQuery';
      variables: ListContextObjectQueryVariables;
      response: ListContextObjectQuery;
    }
  | {
      name: 'listContextQuery';
      variables: ListContextQueryVariables;
      response: ListContextQuery;
    }
  | {
      name: 'matchContextQuery';
      variables: MatchContextQueryVariables;
      response: MatchContextQuery;
    }
  | {
      name: 'matchWorkspaceDocsQuery';
      variables: MatchWorkspaceDocsQueryVariables;
      response: MatchWorkspaceDocsQuery;
    }
  | {
      name: 'matchFilesQuery';
      variables: MatchFilesQueryVariables;
      response: MatchFilesQuery;
    }
  | {
      name: 'copilotContextMemoriesGetQuery';
      variables: CopilotContextMemoriesGetQueryVariables;
      response: CopilotContextMemoriesGetQuery;
    }
  | {
      name: 'copilotContextSessionScopeQuery';
      variables: CopilotContextSessionScopeQueryVariables;
      response: CopilotContextSessionScopeQuery;
    }
  | {
      name: 'copilotDocumentDestinationWorkspacesQuery';
      variables: CopilotDocumentDestinationWorkspacesQueryVariables;
      response: CopilotDocumentDestinationWorkspacesQuery;
    }
  | {
      name: 'copilotDocumentDestinationFoldersQuery';
      variables: CopilotDocumentDestinationFoldersQueryVariables;
      response: CopilotDocumentDestinationFoldersQuery;
    }
  | {
      name: 'copilotDocumentOperationsQuery';
      variables: CopilotDocumentOperationsQueryVariables;
      response: CopilotDocumentOperationsQuery;
    }
  | {
      name: 'getCopilotHistoryIdsQuery';
      variables: GetCopilotHistoryIdsQueryVariables;
      response: GetCopilotHistoryIdsQuery;
    }
  | {
      name: 'getCopilotDocSessionsQuery';
      variables: GetCopilotDocSessionsQueryVariables;
      response: GetCopilotDocSessionsQuery;
    }
  | {
      name: 'getCopilotPinnedSessionsQuery';
      variables: GetCopilotPinnedSessionsQueryVariables;
      response: GetCopilotPinnedSessionsQuery;
    }
  | {
      name: 'getCopilotWorkspaceSessionsQuery';
      variables: GetCopilotWorkspaceSessionsQueryVariables;
      response: GetCopilotWorkspaceSessionsQuery;
    }
  | {
      name: 'getCopilotHistoriesQuery';
      variables: GetCopilotHistoriesQueryVariables;
      response: GetCopilotHistoriesQuery;
    }
  | {
      name: 'getPromptModelsQuery';
      variables: GetPromptModelsQueryVariables;
      response: GetPromptModelsQuery;
    }
  | {
      name: 'getCopilotPromptRegistryPublishGateQuery';
      variables: GetCopilotPromptRegistryPublishGateQueryVariables;
      response: GetCopilotPromptRegistryPublishGateQuery;
    }
  | {
      name: 'getCopilotPromptRegistryRepairPreflightQuery';
      variables: GetCopilotPromptRegistryRepairPreflightQueryVariables;
      response: GetCopilotPromptRegistryRepairPreflightQuery;
    }
  | {
      name: 'getCopilotPromptsQuery';
      variables: GetCopilotPromptsQueryVariables;
      response: GetCopilotPromptsQuery;
    }
  | {
      name: 'getCopilotProviderHealthProbeAttemptsQuery';
      variables: GetCopilotProviderHealthProbeAttemptsQueryVariables;
      response: GetCopilotProviderHealthProbeAttemptsQuery;
    }
  | {
      name: 'copilotQuotaQuery';
      variables: CopilotQuotaQueryVariables;
      response: CopilotQuotaQuery;
    }
  | {
      name: 'getCopilotRepairExecutionsQuery';
      variables: GetCopilotRepairExecutionsQueryVariables;
      response: GetCopilotRepairExecutionsQuery;
    }
  | {
      name: 'getCopilotLatestDocSessionQuery';
      variables: GetCopilotLatestDocSessionQueryVariables;
      response: GetCopilotLatestDocSessionQuery;
    }
  | {
      name: 'getCopilotSessionQuery';
      variables: GetCopilotSessionQueryVariables;
      response: GetCopilotSessionQuery;
    }
  | {
      name: 'getCopilotRecentSessionsQuery';
      variables: GetCopilotRecentSessionsQueryVariables;
      response: GetCopilotRecentSessionsQuery;
    }
  | {
      name: 'getCopilotSessionsQuery';
      variables: GetCopilotSessionsQueryVariables;
      response: GetCopilotSessionsQuery;
    }
  | {
      name: 'getCopilotSupportBundleQuery';
      variables: GetCopilotSupportBundleQueryVariables;
      response: GetCopilotSupportBundleQuery;
    }
  | {
      name: 'getCopilotSupportBundlesQuery';
      variables: GetCopilotSupportBundlesQueryVariables;
      response: GetCopilotSupportBundlesQuery;
    }
  | {
      name: 'copilotTaskGetQuery';
      variables: CopilotTaskGetQueryVariables;
      response: CopilotTaskGetQuery;
    }
  | {
      name: 'copilotTasksGetQuery';
      variables: CopilotTasksGetQueryVariables;
      response: CopilotTasksGetQuery;
    }
  | {
      name: 'getTranscriptTaskQuery';
      variables: GetTranscriptTaskQueryVariables;
      response: GetTranscriptTaskQuery;
    }
  | {
      name: 'copilotWorkbenchBlockersGetQuery';
      variables: CopilotWorkbenchBlockersGetQueryVariables;
      response: CopilotWorkbenchBlockersGetQuery;
    }
  | {
      name: 'copilotWorkbenchProjectsGetQuery';
      variables: CopilotWorkbenchProjectsGetQueryVariables;
      response: CopilotWorkbenchProjectsGetQuery;
    }
  | {
      name: 'copilotWorkbenchSourceAuthorizationGetQuery';
      variables: CopilotWorkbenchSourceAuthorizationGetQueryVariables;
      response: CopilotWorkbenchSourceAuthorizationGetQuery;
    }
  | {
      name: 'copilotWorkbenchTaskGetQuery';
      variables: CopilotWorkbenchTaskGetQueryVariables;
      response: CopilotWorkbenchTaskGetQuery;
    }
  | {
      name: 'copilotWorkbenchTaskPanelGetQuery';
      variables: CopilotWorkbenchTaskPanelGetQueryVariables;
      response: CopilotWorkbenchTaskPanelGetQuery;
    }
  | {
      name: 'copilotWorkbenchTasksGetQuery';
      variables: CopilotWorkbenchTasksGetQueryVariables;
      response: CopilotWorkbenchTasksGetQuery;
    }
  | {
      name: 'getWorkspaceEmbeddingFilesQuery';
      variables: GetWorkspaceEmbeddingFilesQueryVariables;
      response: GetWorkspaceEmbeddingFilesQuery;
    }
  | {
      name: 'getAllWorkspaceEmbeddingIgnoredDocsQuery';
      variables: GetAllWorkspaceEmbeddingIgnoredDocsQueryVariables;
      response: GetAllWorkspaceEmbeddingIgnoredDocsQuery;
    }
  | {
      name: 'getWorkspaceEmbeddingIgnoredDocsQuery';
      variables: GetWorkspaceEmbeddingIgnoredDocsQueryVariables;
      response: GetWorkspaceEmbeddingIgnoredDocsQuery;
    }
  | {
      name: 'getDocRolePermissionsQuery';
      variables: GetDocRolePermissionsQueryVariables;
      response: GetDocRolePermissionsQuery;
    }
  | {
      name: 'latestEnterpriseAuthorizationSessionQuery';
      variables: LatestEnterpriseAuthorizationSessionQueryVariables;
      response: LatestEnterpriseAuthorizationSessionQuery;
    }
  | {
      name: 'enterpriseAuthorizationSessionQuery';
      variables: EnterpriseAuthorizationSessionQueryVariables;
      response: EnterpriseAuthorizationSessionQuery;
    }
  | {
      name: 'enterpriseConnectionsQuery';
      variables: EnterpriseConnectionsQueryVariables;
      response: EnterpriseConnectionsQuery;
    }
  | {
      name: 'externalMcpSettingsQuery';
      variables: ExternalMcpSettingsQueryVariables;
      response: ExternalMcpSettingsQuery;
    }
  | {
      name: 'getCurrentUserFeaturesQuery';
      variables: GetCurrentUserFeaturesQueryVariables;
      response: GetCurrentUserFeaturesQuery;
    }
  | {
      name: 'getCurrentUserQuery';
      variables: GetCurrentUserQueryVariables;
      response: GetCurrentUserQuery;
    }
  | {
      name: 'getDocCreatedByUpdatedByListQuery';
      variables: GetDocCreatedByUpdatedByListQueryVariables;
      response: GetDocCreatedByUpdatedByListQuery;
    }
  | {
      name: 'getDocLastAccessedMembersQuery';
      variables: GetDocLastAccessedMembersQueryVariables;
      response: GetDocLastAccessedMembersQuery;
    }
  | {
      name: 'getDocPageAnalyticsQuery';
      variables: GetDocPageAnalyticsQueryVariables;
      response: GetDocPageAnalyticsQuery;
    }
  | {
      name: 'getDocSummaryQuery';
      variables: GetDocSummaryQueryVariables;
      response: GetDocSummaryQuery;
    }
  | {
      name: 'getInviteInfoQuery';
      variables: GetInviteInfoQueryVariables;
      response: GetInviteInfoQuery;
    }
  | {
      name: 'getMemberCountByWorkspaceIdQuery';
      variables: GetMemberCountByWorkspaceIdQueryVariables;
      response: GetMemberCountByWorkspaceIdQuery;
    }
  | {
      name: 'oauthProvidersQuery';
      variables: OauthProvidersQueryVariables;
      response: OauthProvidersQuery;
    }
  | {
      name: 'getPublicUserByIdQuery';
      variables: GetPublicUserByIdQueryVariables;
      response: GetPublicUserByIdQuery;
    }
  | {
      name: 'getRecentlyUpdatedDocsQuery';
      variables: GetRecentlyUpdatedDocsQueryVariables;
      response: GetRecentlyUpdatedDocsQuery;
    }
  | {
      name: 'getUserFeaturesQuery';
      variables: GetUserFeaturesQueryVariables;
      response: GetUserFeaturesQuery;
    }
  | {
      name: 'getUserSettingsQuery';
      variables: GetUserSettingsQueryVariables;
      response: GetUserSettingsQuery;
    }
  | {
      name: 'getUserQuery';
      variables: GetUserQueryVariables;
      response: GetUserQuery;
    }
  | {
      name: 'getWorkspacePageByIdQuery';
      variables: GetWorkspacePageByIdQueryVariables;
      response: GetWorkspacePageByIdQuery;
    }
  | {
      name: 'getWorkspacePageMetaByIdQuery';
      variables: GetWorkspacePageMetaByIdQueryVariables;
      response: GetWorkspacePageMetaByIdQuery;
    }
  | {
      name: 'getWorkspacePublicByIdQuery';
      variables: GetWorkspacePublicByIdQueryVariables;
      response: GetWorkspacePublicByIdQuery;
    }
  | {
      name: 'getWorkspacePublicPagesQuery';
      variables: GetWorkspacePublicPagesQueryVariables;
      response: GetWorkspacePublicPagesQuery;
    }
  | {
      name: 'getWorkspaceSubscriptionQuery';
      variables: GetWorkspaceSubscriptionQueryVariables;
      response: GetWorkspaceSubscriptionQuery;
    }
  | {
      name: 'getWorkspaceQuery';
      variables: GetWorkspaceQueryVariables;
      response: GetWorkspaceQuery;
    }
  | {
      name: 'getWorkspacesQuery';
      variables: GetWorkspacesQueryVariables;
      response: GetWorkspacesQuery;
    }
  | {
      name: 'listHistoryQuery';
      variables: ListHistoryQueryVariables;
      response: ListHistoryQuery;
    }
  | {
      name: 'indexerAggregateQuery';
      variables: IndexerAggregateQueryVariables;
      response: IndexerAggregateQuery;
    }
  | {
      name: 'indexerSearchDocsQuery';
      variables: IndexerSearchDocsQueryVariables;
      response: IndexerSearchDocsQuery;
    }
  | {
      name: 'indexerSearchQuery';
      variables: IndexerSearchQueryVariables;
      response: IndexerSearchQuery;
    }
  | {
      name: 'getInvoicesCountQuery';
      variables: GetInvoicesCountQueryVariables;
      response: GetInvoicesCountQuery;
    }
  | {
      name: 'invoicesQuery';
      variables: InvoicesQueryVariables;
      response: InvoicesQuery;
    }
  | {
      name: 'sparkClawEndpointsQuery';
      variables: SparkClawEndpointsQueryVariables;
      response: SparkClawEndpointsQuery;
    }
  | {
      name: 'getLicenseQuery';
      variables: GetLicenseQueryVariables;
      response: GetLicenseQuery;
    }
  | {
      name: 'listNotificationsQuery';
      variables: ListNotificationsQueryVariables;
      response: ListNotificationsQuery;
    }
  | {
      name: 'mcpCredentialsQuery';
      variables: McpCredentialsQueryVariables;
      response: McpCredentialsQuery;
    }
  | {
      name: 'officeArtifactQuery';
      variables: OfficeArtifactQueryVariables;
      response: OfficeArtifactQuery;
    }
  | {
      name: 'officeArtifactsQuery';
      variables: OfficeArtifactsQueryVariables;
      response: OfficeArtifactsQuery;
    }
  | {
      name: 'officeCollaboratorsQuery';
      variables: OfficeCollaboratorsQueryVariables;
      response: OfficeCollaboratorsQuery;
    }
  | {
      name: 'previewOfficeCommandQuery';
      variables: PreviewOfficeCommandQueryVariables;
      response: PreviewOfficeCommandQuery;
    }
  | {
      name: 'officeCommentsQuery';
      variables: OfficeCommentsQueryVariables;
      response: OfficeCommentsQuery;
    }
  | {
      name: 'previewOfficeDocxCommandQuery';
      variables: PreviewOfficeDocxCommandQueryVariables;
      response: PreviewOfficeDocxCommandQuery;
    }
  | {
      name: 'officeRevisionCompareQuery';
      variables: OfficeRevisionCompareQueryVariables;
      response: OfficeRevisionCompareQuery;
    }
  | {
      name: 'officeRevisionsQuery';
      variables: OfficeRevisionsQueryVariables;
      response: OfficeRevisionsQuery;
    }
  | {
      name: 'pricesQuery';
      variables: PricesQueryVariables;
      response: PricesQuery;
    }
  | {
      name: 'quotaQuery';
      variables: QuotaQueryVariables;
      response: QuotaQuery;
    }
  | {
      name: 'serverConfigQuery';
      variables: ServerConfigQueryVariables;
      response: ServerConfigQuery;
    }
  | {
      name: 'subscriptionQuery';
      variables: SubscriptionQueryVariables;
      response: SubscriptionQuery;
    }
  | {
      name: 'workspaceBlobQuotaQuery';
      variables: WorkspaceBlobQuotaQueryVariables;
      response: WorkspaceBlobQuotaQuery;
    }
  | {
      name: 'workspaceByokSettingsQuery';
      variables: WorkspaceByokSettingsQueryVariables;
      response: WorkspaceByokSettingsQuery;
    }
  | {
      name: 'workspaceDirectoryQuery';
      variables: WorkspaceDirectoryQueryVariables;
      response: WorkspaceDirectoryQuery;
    }
  | {
      name: 'workspaceDirectoryAdministrationQuery';
      variables: WorkspaceDirectoryAdministrationQueryVariables;
      response: WorkspaceDirectoryAdministrationQuery;
    }
  | {
      name: 'workspaceInvoicesQuery';
      variables: WorkspaceInvoicesQueryVariables;
      response: WorkspaceInvoicesQuery;
    }
  | {
      name: 'getWorkspaceRolePermissionsQuery';
      variables: GetWorkspaceRolePermissionsQueryVariables;
      response: GetWorkspaceRolePermissionsQuery;
    };

export type Mutations =
  | {
      name: 'adminUpdateWorkspaceMutation';
      variables: AdminUpdateWorkspaceMutationVariables;
      response: AdminUpdateWorkspaceMutation;
    }
  | {
      name: 'createChangePasswordUrlMutation';
      variables: CreateChangePasswordUrlMutationVariables;
      response: CreateChangePasswordUrlMutation;
    }
  | {
      name: 'createUserMutation';
      variables: CreateUserMutationVariables;
      response: CreateUserMutation;
    }
  | {
      name: 'deleteAdminAiProfileMutation';
      variables: DeleteAdminAiProfileMutationVariables;
      response: DeleteAdminAiProfileMutation;
    }
  | {
      name: 'deleteAuthSigningKeyMutation';
      variables: DeleteAuthSigningKeyMutationVariables;
      response: DeleteAuthSigningKeyMutation;
    }
  | {
      name: 'deleteUserMutation';
      variables: DeleteUserMutationVariables;
      response: DeleteUserMutation;
    }
  | {
      name: 'disableUserMutation';
      variables: DisableUserMutationVariables;
      response: DisableUserMutation;
    }
  | {
      name: 'enableUserMutation';
      variables: EnableUserMutationVariables;
      response: EnableUserMutation;
    }
  | {
      name: 'importUsersMutation';
      variables: ImportUsersMutationVariables;
      response: ImportUsersMutation;
    }
  | {
      name: 'rotateAuthSigningKeyMutation';
      variables: RotateAuthSigningKeyMutationVariables;
      response: RotateAuthSigningKeyMutation;
    }
  | {
      name: 'sendTestEmailMutation';
      variables: SendTestEmailMutationVariables;
      response: SendTestEmailMutation;
    }
  | {
      name: 'setAdminUserAiProfileAssignmentMutation';
      variables: SetAdminUserAiProfileAssignmentMutationVariables;
      response: SetAdminUserAiProfileAssignmentMutation;
    }
  | {
      name: 'updateAccountFeaturesMutation';
      variables: UpdateAccountFeaturesMutationVariables;
      response: UpdateAccountFeaturesMutation;
    }
  | {
      name: 'updateAccountMutation';
      variables: UpdateAccountMutationVariables;
      response: UpdateAccountMutation;
    }
  | {
      name: 'updateAppConfigMutation';
      variables: UpdateAppConfigMutationVariables;
      response: UpdateAppConfigMutation;
    }
  | {
      name: 'upsertAdminAiProfileMutation';
      variables: UpsertAdminAiProfileMutationVariables;
      response: UpsertAdminAiProfileMutation;
    }
  | {
      name: 'deleteBlobMutation';
      variables: DeleteBlobMutationVariables;
      response: DeleteBlobMutation;
    }
  | {
      name: 'releaseDeletedBlobsMutation';
      variables: ReleaseDeletedBlobsMutationVariables;
      response: ReleaseDeletedBlobsMutation;
    }
  | {
      name: 'setBlobMutation';
      variables: SetBlobMutationVariables;
      response: SetBlobMutation;
    }
  | {
      name: 'abortBlobUploadMutation';
      variables: AbortBlobUploadMutationVariables;
      response: AbortBlobUploadMutation;
    }
  | {
      name: 'completeBlobUploadMutation';
      variables: CompleteBlobUploadMutationVariables;
      response: CompleteBlobUploadMutation;
    }
  | {
      name: 'createBlobUploadMutation';
      variables: CreateBlobUploadMutationVariables;
      response: CreateBlobUploadMutation;
    }
  | {
      name: 'linkCalDavAccountMutation';
      variables: LinkCalDavAccountMutationVariables;
      response: LinkCalDavAccountMutation;
    }
  | {
      name: 'linkCalendarAccountMutation';
      variables: LinkCalendarAccountMutationVariables;
      response: LinkCalendarAccountMutation;
    }
  | {
      name: 'unlinkCalendarAccountMutation';
      variables: UnlinkCalendarAccountMutationVariables;
      response: UnlinkCalendarAccountMutation;
    }
  | {
      name: 'updateCalendarAccountMutation';
      variables: UpdateCalendarAccountMutationVariables;
      response: UpdateCalendarAccountMutation;
    }
  | {
      name: 'updateWorkspaceCalendarsMutation';
      variables: UpdateWorkspaceCalendarsMutationVariables;
      response: UpdateWorkspaceCalendarsMutation;
    }
  | {
      name: 'cancelSubscriptionMutation';
      variables: CancelSubscriptionMutationVariables;
      response: CancelSubscriptionMutation;
    }
  | {
      name: 'changeEmailMutation';
      variables: ChangeEmailMutationVariables;
      response: ChangeEmailMutation;
    }
  | {
      name: 'changePasswordMutation';
      variables: ChangePasswordMutationVariables;
      response: ChangePasswordMutation;
    }
  | {
      name: 'createCommentMutation';
      variables: CreateCommentMutationVariables;
      response: CreateCommentMutation;
    }
  | {
      name: 'deleteCommentMutation';
      variables: DeleteCommentMutationVariables;
      response: DeleteCommentMutation;
    }
  | {
      name: 'createReplyMutation';
      variables: CreateReplyMutationVariables;
      response: CreateReplyMutation;
    }
  | {
      name: 'deleteReplyMutation';
      variables: DeleteReplyMutationVariables;
      response: DeleteReplyMutation;
    }
  | {
      name: 'updateReplyMutation';
      variables: UpdateReplyMutationVariables;
      response: UpdateReplyMutation;
    }
  | {
      name: 'resolveCommentMutation';
      variables: ResolveCommentMutationVariables;
      response: ResolveCommentMutation;
    }
  | {
      name: 'updateCommentMutation';
      variables: UpdateCommentMutationVariables;
      response: UpdateCommentMutation;
    }
  | {
      name: 'uploadCommentAttachmentMutation';
      variables: UploadCommentAttachmentMutationVariables;
      response: UploadCommentAttachmentMutation;
    }
  | {
      name: 'approveCopilotAccessRequestMutation';
      variables: ApproveCopilotAccessRequestMutationVariables;
      response: ApproveCopilotAccessRequestMutation;
    }
  | {
      name: 'rejectCopilotAccessRequestMutation';
      variables: RejectCopilotAccessRequestMutationVariables;
      response: RejectCopilotAccessRequestMutation;
    }
  | {
      name: 'withdrawCopilotAccessRequestMutation';
      variables: WithdrawCopilotAccessRequestMutationVariables;
      response: WithdrawCopilotAccessRequestMutation;
    }
  | {
      name: 'controlCopilotAgentRuntimeRunMutation';
      variables: ControlCopilotAgentRuntimeRunMutationVariables;
      response: ControlCopilotAgentRuntimeRunMutation;
    }
  | {
      name: 'requestCopilotAgentRuntimeDocUpdateMutation';
      variables: RequestCopilotAgentRuntimeDocUpdateMutationVariables;
      response: RequestCopilotAgentRuntimeDocUpdateMutation;
    }
  | {
      name: 'requestCopilotAgentRuntimeOfficeCommandMutation';
      variables: RequestCopilotAgentRuntimeOfficeCommandMutationVariables;
      response: RequestCopilotAgentRuntimeOfficeCommandMutation;
    }
  | {
      name: 'abandonCopilotBlockerMutation';
      variables: AbandonCopilotBlockerMutationVariables;
      response: AbandonCopilotBlockerMutation;
    }
  | {
      name: 'createCopilotBlockerMutation';
      variables: CreateCopilotBlockerMutationVariables;
      response: CreateCopilotBlockerMutation;
    }
  | {
      name: 'resolveCopilotBlockerMutation';
      variables: ResolveCopilotBlockerMutationVariables;
      response: ResolveCopilotBlockerMutation;
    }
  | {
      name: 'confirmCopilotBlockerSuggestionMutation';
      variables: ConfirmCopilotBlockerSuggestionMutationVariables;
      response: ConfirmCopilotBlockerSuggestionMutation;
    }
  | {
      name: 'addContextBlobMutation';
      variables: AddContextBlobMutationVariables;
      response: AddContextBlobMutation;
    }
  | {
      name: 'removeContextBlobMutation';
      variables: RemoveContextBlobMutationVariables;
      response: RemoveContextBlobMutation;
    }
  | {
      name: 'addContextCategoryMutation';
      variables: AddContextCategoryMutationVariables;
      response: AddContextCategoryMutation;
    }
  | {
      name: 'removeContextCategoryMutation';
      variables: RemoveContextCategoryMutationVariables;
      response: RemoveContextCategoryMutation;
    }
  | {
      name: 'createCopilotContextMutation';
      variables: CreateCopilotContextMutationVariables;
      response: CreateCopilotContextMutation;
    }
  | {
      name: 'addContextDocMutation';
      variables: AddContextDocMutationVariables;
      response: AddContextDocMutation;
    }
  | {
      name: 'removeContextDocMutation';
      variables: RemoveContextDocMutationVariables;
      response: RemoveContextDocMutation;
    }
  | {
      name: 'addContextFileMutation';
      variables: AddContextFileMutationVariables;
      response: AddContextFileMutation;
    }
  | {
      name: 'removeContextFileMutation';
      variables: RemoveContextFileMutationVariables;
      response: RemoveContextFileMutation;
    }
  | {
      name: 'copilotContextMemoryCreateMutation';
      variables: CopilotContextMemoryCreateMutationVariables;
      response: CopilotContextMemoryCreateMutation;
    }
  | {
      name: 'copilotContextMemoryDeleteMutation';
      variables: CopilotContextMemoryDeleteMutationVariables;
      response: CopilotContextMemoryDeleteMutation;
    }
  | {
      name: 'copilotContextMemoryUpdateMutation';
      variables: CopilotContextMemoryUpdateMutationVariables;
      response: CopilotContextMemoryUpdateMutation;
    }
  | {
      name: 'setCopilotContextProjectAiPolicyMutation';
      variables: SetCopilotContextProjectAiPolicyMutationVariables;
      response: SetCopilotContextProjectAiPolicyMutation;
    }
  | {
      name: 'copilotContextProjectCreateMutation';
      variables: CopilotContextProjectCreateMutationVariables;
      response: CopilotContextProjectCreateMutation;
    }
  | {
      name: 'copilotContextProjectDeleteMutation';
      variables: CopilotContextProjectDeleteMutationVariables;
      response: CopilotContextProjectDeleteMutation;
    }
  | {
      name: 'copilotContextProjectDocumentAddMutation';
      variables: CopilotContextProjectDocumentAddMutationVariables;
      response: CopilotContextProjectDocumentAddMutation;
    }
  | {
      name: 'copilotContextProjectDocumentRemoveMutation';
      variables: CopilotContextProjectDocumentRemoveMutationVariables;
      response: CopilotContextProjectDocumentRemoveMutation;
    }
  | {
      name: 'copilotContextProjectDocumentUpdateMutation';
      variables: CopilotContextProjectDocumentUpdateMutationVariables;
      response: CopilotContextProjectDocumentUpdateMutation;
    }
  | {
      name: 'leaveCopilotContextProjectMutation';
      variables: LeaveCopilotContextProjectMutationVariables;
      response: LeaveCopilotContextProjectMutation;
    }
  | {
      name: 'removeCopilotContextProjectMemberMutation';
      variables: RemoveCopilotContextProjectMemberMutationVariables;
      response: RemoveCopilotContextProjectMemberMutation;
    }
  | {
      name: 'transferCopilotContextProjectOwnershipMutation';
      variables: TransferCopilotContextProjectOwnershipMutationVariables;
      response: TransferCopilotContextProjectOwnershipMutation;
    }
  | {
      name: 'copilotContextProjectUpdateMutation';
      variables: CopilotContextProjectUpdateMutationVariables;
      response: CopilotContextProjectUpdateMutation;
    }
  | {
      name: 'copilotContextSettingsUpdateMutation';
      variables: CopilotContextSettingsUpdateMutationVariables;
      response: CopilotContextSettingsUpdateMutation;
    }
  | {
      name: 'createCopilotContextRuleMutation';
      variables: CreateCopilotContextRuleMutationVariables;
      response: CreateCopilotContextRuleMutation;
    }
  | {
      name: 'updateCopilotContextRuleMutation';
      variables: UpdateCopilotContextRuleMutationVariables;
      response: UpdateCopilotContextRuleMutation;
    }
  | {
      name: 'rollbackCopilotContextRuleMutation';
      variables: RollbackCopilotContextRuleMutationVariables;
      response: RollbackCopilotContextRuleMutation;
    }
  | {
      name: 'deleteCopilotContextRuleMutation';
      variables: DeleteCopilotContextRuleMutationVariables;
      response: DeleteCopilotContextRuleMutation;
    }
  | {
      name: 'createCopilotContextPolicyMutation';
      variables: CreateCopilotContextPolicyMutationVariables;
      response: CreateCopilotContextPolicyMutation;
    }
  | {
      name: 'updateCopilotContextPolicyMutation';
      variables: UpdateCopilotContextPolicyMutationVariables;
      response: UpdateCopilotContextPolicyMutation;
    }
  | {
      name: 'rollbackCopilotContextPolicyMutation';
      variables: RollbackCopilotContextPolicyMutationVariables;
      response: RollbackCopilotContextPolicyMutation;
    }
  | {
      name: 'deleteCopilotContextPolicyMutation';
      variables: DeleteCopilotContextPolicyMutationVariables;
      response: DeleteCopilotContextPolicyMutation;
    }
  | {
      name: 'undoCopilotContextMemoryEventMutation';
      variables: UndoCopilotContextMemoryEventMutationVariables;
      response: UndoCopilotContextMemoryEventMutation;
    }
  | {
      name: 'queueWorkspaceEmbeddingMutation';
      variables: QueueWorkspaceEmbeddingMutationVariables;
      response: QueueWorkspaceEmbeddingMutation;
    }
  | {
      name: 'requestCopilotDocumentAccessMutation';
      variables: RequestCopilotDocumentAccessMutationVariables;
      response: RequestCopilotDocumentAccessMutation;
    }
  | {
      name: 'confirmCopilotDocumentDestinationMutation';
      variables: ConfirmCopilotDocumentDestinationMutationVariables;
      response: ConfirmCopilotDocumentDestinationMutation;
    }
  | {
      name: 'retryCopilotDocumentOperationMutation';
      variables: RetryCopilotDocumentOperationMutationVariables;
      response: RetryCopilotDocumentOperationMutation;
    }
  | {
      name: 'withdrawCopilotDocumentOperationMutation';
      variables: WithdrawCopilotDocumentOperationMutationVariables;
      response: WithdrawCopilotDocumentOperationMutation;
    }
  | {
      name: 'createCopilotMessageMutation';
      variables: CreateCopilotMessageMutationVariables;
      response: CreateCopilotMessageMutation;
    }
  | {
      name: 'reRequestCopilotProjectDocumentAccessMutation';
      variables: ReRequestCopilotProjectDocumentAccessMutationVariables;
      response: ReRequestCopilotProjectDocumentAccessMutation;
    }
  | {
      name: 'revokeCopilotProjectGrantMutation';
      variables: RevokeCopilotProjectGrantMutationVariables;
      response: RevokeCopilotProjectGrantMutation;
    }
  | {
      name: 'acceptCopilotProjectInvitationMutation';
      variables: AcceptCopilotProjectInvitationMutationVariables;
      response: AcceptCopilotProjectInvitationMutation;
    }
  | {
      name: 'declineCopilotProjectInvitationMutation';
      variables: DeclineCopilotProjectInvitationMutationVariables;
      response: DeclineCopilotProjectInvitationMutation;
    }
  | {
      name: 'sendCopilotProjectInvitationMutation';
      variables: SendCopilotProjectInvitationMutationVariables;
      response: SendCopilotProjectInvitationMutation;
    }
  | {
      name: 'withdrawCopilotProjectInvitationMutation';
      variables: WithdrawCopilotProjectInvitationMutationVariables;
      response: WithdrawCopilotProjectInvitationMutation;
    }
  | {
      name: 'requestCopilotPromptRegistryRepairExecutionMutation';
      variables: RequestCopilotPromptRegistryRepairExecutionMutationVariables;
      response: RequestCopilotPromptRegistryRepairExecutionMutation;
    }
  | {
      name: 'retryCopilotProviderHealthProbeAttemptMutation';
      variables: RetryCopilotProviderHealthProbeAttemptMutationVariables;
      response: RetryCopilotProviderHealthProbeAttemptMutation;
    }
  | {
      name: 'decideCopilotRepairExecutionApprovalMutation';
      variables: DecideCopilotRepairExecutionApprovalMutationVariables;
      response: DecideCopilotRepairExecutionApprovalMutation;
    }
  | {
      name: 'controlCopilotRepairExecutionMutation';
      variables: ControlCopilotRepairExecutionMutationVariables;
      response: ControlCopilotRepairExecutionMutation;
    }
  | {
      name: 'cleanupCopilotSessionMutation';
      variables: CleanupCopilotSessionMutationVariables;
      response: CleanupCopilotSessionMutation;
    }
  | {
      name: 'createCopilotSessionWithHistoryMutation';
      variables: CreateCopilotSessionWithHistoryMutationVariables;
      response: CreateCopilotSessionWithHistoryMutation;
    }
  | {
      name: 'createCopilotSessionMutation';
      variables: CreateCopilotSessionMutationVariables;
      response: CreateCopilotSessionMutation;
    }
  | {
      name: 'forkCopilotSessionMutation';
      variables: ForkCopilotSessionMutationVariables;
      response: ForkCopilotSessionMutation;
    }
  | {
      name: 'updateCopilotSessionMutation';
      variables: UpdateCopilotSessionMutationVariables;
      response: UpdateCopilotSessionMutation;
    }
  | {
      name: 'createCopilotSupportBundleMutation';
      variables: CreateCopilotSupportBundleMutationVariables;
      response: CreateCopilotSupportBundleMutation;
    }
  | {
      name: 'acknowledgeCopilotSupportBundleDirectDownloadMutation';
      variables: AcknowledgeCopilotSupportBundleDirectDownloadMutationVariables;
      response: AcknowledgeCopilotSupportBundleDirectDownloadMutation;
    }
  | {
      name: 'authorizeCopilotSupportBundleDownloadMutation';
      variables: AuthorizeCopilotSupportBundleDownloadMutationVariables;
      response: AuthorizeCopilotSupportBundleDownloadMutation;
    }
  | {
      name: 'cleanupCopilotSupportBundleRetentionMutation';
      variables: CleanupCopilotSupportBundleRetentionMutationVariables;
      response: CleanupCopilotSupportBundleRetentionMutation;
    }
  | {
      name: 'replayCopilotSupportBundleTransferForwardingEventMutation';
      variables: ReplayCopilotSupportBundleTransferForwardingEventMutationVariables;
      response: ReplayCopilotSupportBundleTransferForwardingEventMutation;
    }
  | {
      name: 'controlCopilotTaskMutation';
      variables: ControlCopilotTaskMutationVariables;
      response: ControlCopilotTaskMutation;
    }
  | {
      name: 'retryTranscriptTaskMutation';
      variables: RetryTranscriptTaskMutationVariables;
      response: RetryTranscriptTaskMutation;
    }
  | {
      name: 'settleTranscriptTaskMutation';
      variables: SettleTranscriptTaskMutationVariables;
      response: SettleTranscriptTaskMutation;
    }
  | {
      name: 'submitTranscriptTaskMutation';
      variables: SubmitTranscriptTaskMutationVariables;
      response: SubmitTranscriptTaskMutation;
    }
  | {
      name: 'addWorkspaceEmbeddingFilesMutation';
      variables: AddWorkspaceEmbeddingFilesMutationVariables;
      response: AddWorkspaceEmbeddingFilesMutation;
    }
  | {
      name: 'removeWorkspaceEmbeddingFilesMutation';
      variables: RemoveWorkspaceEmbeddingFilesMutationVariables;
      response: RemoveWorkspaceEmbeddingFilesMutation;
    }
  | {
      name: 'addWorkspaceEmbeddingIgnoredDocsMutation';
      variables: AddWorkspaceEmbeddingIgnoredDocsMutationVariables;
      response: AddWorkspaceEmbeddingIgnoredDocsMutation;
    }
  | {
      name: 'removeWorkspaceEmbeddingIgnoredDocsMutation';
      variables: RemoveWorkspaceEmbeddingIgnoredDocsMutationVariables;
      response: RemoveWorkspaceEmbeddingIgnoredDocsMutation;
    }
  | {
      name: 'createCheckoutSessionMutation';
      variables: CreateCheckoutSessionMutationVariables;
      response: CreateCheckoutSessionMutation;
    }
  | {
      name: 'createCustomerPortalMutation';
      variables: CreateCustomerPortalMutationVariables;
      response: CreateCustomerPortalMutation;
    }
  | {
      name: 'createSelfhostCustomerPortalMutation';
      variables: CreateSelfhostCustomerPortalMutationVariables;
      response: CreateSelfhostCustomerPortalMutation;
    }
  | {
      name: 'createWorkspaceMutation';
      variables: CreateWorkspaceMutationVariables;
      response: CreateWorkspaceMutation;
    }
  | {
      name: 'deleteAccountMutation';
      variables: DeleteAccountMutationVariables;
      response: DeleteAccountMutation;
    }
  | {
      name: 'deleteWorkspaceMutation';
      variables: DeleteWorkspaceMutationVariables;
      response: DeleteWorkspaceMutation;
    }
  | {
      name: 'dismissNotificationMutation';
      variables: DismissNotificationMutationVariables;
      response: DismissNotificationMutation;
    }
  | {
      name: 'dismissReadNotificationsMutation';
      variables: DismissReadNotificationsMutationVariables;
      response: DismissReadNotificationsMutation;
    }
  | {
      name: 'beginEnterpriseAuthorizationMutation';
      variables: BeginEnterpriseAuthorizationMutationVariables;
      response: BeginEnterpriseAuthorizationMutation;
    }
  | {
      name: 'cancelEnterpriseAuthorizationMutation';
      variables: CancelEnterpriseAuthorizationMutationVariables;
      response: CancelEnterpriseAuthorizationMutation;
    }
  | {
      name: 'createEnterpriseConnectionMutation';
      variables: CreateEnterpriseConnectionMutationVariables;
      response: CreateEnterpriseConnectionMutation;
    }
  | {
      name: 'deleteEnterpriseConnectionMutation';
      variables: DeleteEnterpriseConnectionMutationVariables;
      response: DeleteEnterpriseConnectionMutation;
    }
  | {
      name: 'disableEnterpriseConnectionMutation';
      variables: DisableEnterpriseConnectionMutationVariables;
      response: DisableEnterpriseConnectionMutation;
    }
  | {
      name: 'refreshEnterpriseConnectionMutation';
      variables: RefreshEnterpriseConnectionMutationVariables;
      response: RefreshEnterpriseConnectionMutation;
    }
  | {
      name: 'updateEnterpriseToolAllowlistMutation';
      variables: UpdateEnterpriseToolAllowlistMutationVariables;
      response: UpdateEnterpriseToolAllowlistMutation;
    }
  | {
      name: 'connectExternalMcpMutation';
      variables: ConnectExternalMcpMutationVariables;
      response: ConnectExternalMcpMutation;
    }
  | {
      name: 'deleteExternalMcpMutation';
      variables: DeleteExternalMcpMutationVariables;
      response: DeleteExternalMcpMutation;
    }
  | {
      name: 'disableExternalMcpMutation';
      variables: DisableExternalMcpMutationVariables;
      response: DisableExternalMcpMutation;
    }
  | {
      name: 'refreshExternalMcpToolsMutation';
      variables: RefreshExternalMcpToolsMutationVariables;
      response: RefreshExternalMcpToolsMutation;
    }
  | {
      name: 'testExternalMcpConversationMutation';
      variables: TestExternalMcpConversationMutationVariables;
      response: TestExternalMcpConversationMutation;
    }
  | {
      name: 'updateExternalMcpToolAllowlistMutation';
      variables: UpdateExternalMcpToolAllowlistMutationVariables;
      response: UpdateExternalMcpToolAllowlistMutation;
    }
  | {
      name: 'generateLicenseKeyMutation';
      variables: GenerateLicenseKeyMutationVariables;
      response: GenerateLicenseKeyMutation;
    }
  | {
      name: 'grantDocUserRolesMutation';
      variables: GrantDocUserRolesMutationVariables;
      response: GrantDocUserRolesMutation;
    }
  | {
      name: 'createSparkClawPairingMutation';
      variables: CreateSparkClawPairingMutationVariables;
      response: CreateSparkClawPairingMutation;
    }
  | {
      name: 'disconnectSparkClawEndpointMutation';
      variables: DisconnectSparkClawEndpointMutationVariables;
      response: DisconnectSparkClawEndpointMutation;
    }
  | {
      name: 'leaveWorkspaceMutation';
      variables: LeaveWorkspaceMutationVariables;
      response: LeaveWorkspaceMutation;
    }
  | {
      name: 'activateLicenseMutation';
      variables: ActivateLicenseMutationVariables;
      response: ActivateLicenseMutation;
    }
  | {
      name: 'deactivateLicenseMutation';
      variables: DeactivateLicenseMutationVariables;
      response: DeactivateLicenseMutation;
    }
  | {
      name: 'installLicenseMutation';
      variables: InstallLicenseMutationVariables;
      response: InstallLicenseMutation;
    }
  | {
      name: 'previewLicenseMutation';
      variables: PreviewLicenseMutationVariables;
      response: PreviewLicenseMutation;
    }
  | {
      name: 'createMcpCredentialMutation';
      variables: CreateMcpCredentialMutationVariables;
      response: CreateMcpCredentialMutation;
    }
  | {
      name: 'revokeMcpCredentialMutation';
      variables: RevokeMcpCredentialMutationVariables;
      response: RevokeMcpCredentialMutation;
    }
  | {
      name: 'rotateMcpCredentialMutation';
      variables: RotateMcpCredentialMutationVariables;
      response: RotateMcpCredentialMutation;
    }
  | {
      name: 'mentionUserMutation';
      variables: MentionUserMutationVariables;
      response: MentionUserMutation;
    }
  | {
      name: 'executeOfficeCommandMutation';
      variables: ExecuteOfficeCommandMutationVariables;
      response: ExecuteOfficeCommandMutation;
    }
  | {
      name: 'createOfficeCommentMutation';
      variables: CreateOfficeCommentMutationVariables;
      response: CreateOfficeCommentMutation;
    }
  | {
      name: 'deleteOfficeCommentMutation';
      variables: DeleteOfficeCommentMutationVariables;
      response: DeleteOfficeCommentMutation;
    }
  | {
      name: 'createOfficeCommentReplyMutation';
      variables: CreateOfficeCommentReplyMutationVariables;
      response: CreateOfficeCommentReplyMutation;
    }
  | {
      name: 'deleteOfficeCommentReplyMutation';
      variables: DeleteOfficeCommentReplyMutationVariables;
      response: DeleteOfficeCommentReplyMutation;
    }
  | {
      name: 'updateOfficeCommentReplyMutation';
      variables: UpdateOfficeCommentReplyMutationVariables;
      response: UpdateOfficeCommentReplyMutation;
    }
  | {
      name: 'resolveOfficeCommentMutation';
      variables: ResolveOfficeCommentMutationVariables;
      response: ResolveOfficeCommentMutation;
    }
  | {
      name: 'updateOfficeCommentMutation';
      variables: UpdateOfficeCommentMutationVariables;
      response: UpdateOfficeCommentMutation;
    }
  | {
      name: 'executeOfficeDocxCommandMutation';
      variables: ExecuteOfficeDocxCommandMutationVariables;
      response: ExecuteOfficeDocxCommandMutation;
    }
  | {
      name: 'importOfficeDocxMutation';
      variables: ImportOfficeDocxMutationVariables;
      response: ImportOfficeDocxMutation;
    }
  | {
      name: 'importOfficeArtifactMutation';
      variables: ImportOfficeArtifactMutationVariables;
      response: ImportOfficeArtifactMutation;
    }
  | {
      name: 'publishPageMutation';
      variables: PublishPageMutationVariables;
      response: PublishPageMutation;
    }
  | {
      name: 'readAllNotificationsMutation';
      variables: ReadAllNotificationsMutationVariables;
      response: ReadAllNotificationsMutation;
    }
  | {
      name: 'readNotificationMutation';
      variables: ReadNotificationMutationVariables;
      response: ReadNotificationMutation;
    }
  | {
      name: 'recoverDocMutation';
      variables: RecoverDocMutationVariables;
      response: RecoverDocMutation;
    }
  | {
      name: 'removeAvatarMutation';
      variables: RemoveAvatarMutationVariables;
      response: RemoveAvatarMutation;
    }
  | {
      name: 'resumeSubscriptionMutation';
      variables: ResumeSubscriptionMutationVariables;
      response: ResumeSubscriptionMutation;
    }
  | {
      name: 'revokeDocUserRolesMutation';
      variables: RevokeDocUserRolesMutationVariables;
      response: RevokeDocUserRolesMutation;
    }
  | {
      name: 'revokeMemberPermissionMutation';
      variables: RevokeMemberPermissionMutationVariables;
      response: RevokeMemberPermissionMutation;
    }
  | {
      name: 'revokePublicPageMutation';
      variables: RevokePublicPageMutationVariables;
      response: RevokePublicPageMutation;
    }
  | {
      name: 'sendChangeEmailMutation';
      variables: SendChangeEmailMutationVariables;
      response: SendChangeEmailMutation;
    }
  | {
      name: 'sendChangePasswordEmailMutation';
      variables: SendChangePasswordEmailMutationVariables;
      response: SendChangePasswordEmailMutation;
    }
  | {
      name: 'sendSetPasswordEmailMutation';
      variables: SendSetPasswordEmailMutationVariables;
      response: SendSetPasswordEmailMutation;
    }
  | {
      name: 'sendVerifyChangeEmailMutation';
      variables: SendVerifyChangeEmailMutationVariables;
      response: SendVerifyChangeEmailMutation;
    }
  | {
      name: 'sendVerifyEmailMutation';
      variables: SendVerifyEmailMutationVariables;
      response: SendVerifyEmailMutation;
    }
  | {
      name: 'setWorkspacePublicByIdMutation';
      variables: SetWorkspacePublicByIdMutationVariables;
      response: SetWorkspacePublicByIdMutation;
    }
  | {
      name: 'refreshSubscriptionMutation';
      variables: RefreshSubscriptionMutationVariables;
      response: RefreshSubscriptionMutation;
    }
  | {
      name: 'requestApplySubscriptionMutation';
      variables: RequestApplySubscriptionMutationVariables;
      response: RequestApplySubscriptionMutation;
    }
  | {
      name: 'updateDocDefaultRoleMutation';
      variables: UpdateDocDefaultRoleMutationVariables;
      response: UpdateDocDefaultRoleMutation;
    }
  | {
      name: 'updateDocUserRoleMutation';
      variables: UpdateDocUserRoleMutationVariables;
      response: UpdateDocUserRoleMutation;
    }
  | {
      name: 'updateSubscriptionMutation';
      variables: UpdateSubscriptionMutationVariables;
      response: UpdateSubscriptionMutation;
    }
  | {
      name: 'updateUserProfileMutation';
      variables: UpdateUserProfileMutationVariables;
      response: UpdateUserProfileMutation;
    }
  | {
      name: 'updateUserSettingsMutation';
      variables: UpdateUserSettingsMutationVariables;
      response: UpdateUserSettingsMutation;
    }
  | {
      name: 'uploadAvatarMutation';
      variables: UploadAvatarMutationVariables;
      response: UploadAvatarMutation;
    }
  | {
      name: 'verifyEmailMutation';
      variables: VerifyEmailMutationVariables;
      response: VerifyEmailMutation;
    }
  | {
      name: 'clearWorkspaceByokConfigsMutation';
      variables: ClearWorkspaceByokConfigsMutationVariables;
      response: ClearWorkspaceByokConfigsMutation;
    }
  | {
      name: 'deleteWorkspaceByokConfigMutation';
      variables: DeleteWorkspaceByokConfigMutationVariables;
      response: DeleteWorkspaceByokConfigMutation;
    }
  | {
      name: 'reorderWorkspaceByokConfigsMutation';
      variables: ReorderWorkspaceByokConfigsMutationVariables;
      response: ReorderWorkspaceByokConfigsMutation;
    }
  | {
      name: 'testWorkspaceByokConfigMutation';
      variables: TestWorkspaceByokConfigMutationVariables;
      response: TestWorkspaceByokConfigMutation;
    }
  | {
      name: 'upsertWorkspaceByokConfigMutation';
      variables: UpsertWorkspaceByokConfigMutationVariables;
      response: UpsertWorkspaceByokConfigMutation;
    }
  | {
      name: 'mutateWorkspaceDirectoryMutation';
      variables: MutateWorkspaceDirectoryMutationVariables;
      response: MutateWorkspaceDirectoryMutation;
    }
  | {
      name: 'changeWorkspaceDirectoryPolicyMutation';
      variables: ChangeWorkspaceDirectoryPolicyMutationVariables;
      response: ChangeWorkspaceDirectoryPolicyMutation;
    }
  | {
      name: 'setEnableAiMutation';
      variables: SetEnableAiMutationVariables;
      response: SetEnableAiMutation;
    }
  | {
      name: 'setEnableDocEmbeddingMutation';
      variables: SetEnableDocEmbeddingMutationVariables;
      response: SetEnableDocEmbeddingMutation;
    }
  | {
      name: 'setEnableSharingMutation';
      variables: SetEnableSharingMutationVariables;
      response: SetEnableSharingMutation;
    }
  | {
      name: 'setEnableUrlPreviewMutation';
      variables: SetEnableUrlPreviewMutationVariables;
      response: SetEnableUrlPreviewMutation;
    }
  | {
      name: 'inviteByEmailsMutation';
      variables: InviteByEmailsMutationVariables;
      response: InviteByEmailsMutation;
    }
  | {
      name: 'acceptInviteByInviteIdMutation';
      variables: AcceptInviteByInviteIdMutationVariables;
      response: AcceptInviteByInviteIdMutation;
    }
  | {
      name: 'createInviteLinkMutation';
      variables: CreateInviteLinkMutationVariables;
      response: CreateInviteLinkMutation;
    }
  | {
      name: 'revokeInviteLinkMutation';
      variables: RevokeInviteLinkMutationVariables;
      response: RevokeInviteLinkMutation;
    }
  | {
      name: 'approveWorkspaceTeamMemberMutation';
      variables: ApproveWorkspaceTeamMemberMutationVariables;
      response: ApproveWorkspaceTeamMemberMutation;
    }
  | {
      name: 'grantWorkspaceTeamMemberMutation';
      variables: GrantWorkspaceTeamMemberMutationVariables;
      response: GrantWorkspaceTeamMemberMutation;
    };
