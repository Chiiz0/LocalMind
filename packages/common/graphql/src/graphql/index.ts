/* do not manipulate this file manually. */
export interface GraphQLQuery {
  id: string;
  op: string;
  query: string;
  file?: boolean;
  deprecations?: string[];
}
export const copilotBlockerFieldsFragment = `fragment CopilotBlockerFields on CopilotBlockerType {
  id
  projectId
  creatorUserId
  title
  type
  waitingOn
  dueAt
  overdue
  status
  origin
  resolutionActorUserId
  resolvedAt
  createdAt
  updatedAt
}`;
export const copilotChatHistoryFragment = `fragment CopilotChatHistory on CopilotHistories {
  sessionId
  workspaceId
  docId
  selectedContextProjectId
  parentSessionId
  promptName
  model
  optionalModels
  action
  pinned
  title
  tokens
  messages {
    id
    role
    content
    attachments
    streamObjects {
      type
      textDelta
      toolCallId
      toolName
      args
      result
    }
    createdAt
  }
  createdAt
  updatedAt
}`;
export const copilotDocumentOperationFieldsFragment = `fragment CopilotDocumentOperationFields on CopilotDocumentOperationType {
  id
  kind
  sourceWorkspaceId
  sourceDocumentId
  title
  status
  projectStatus
  documentId
  destinationWorkspaceId
  destinationFolderId
  destinationRevision
  locationExpiresAt
  createdDocumentAt
  placedDocumentAt
  failureCode
  accessRequestId
}`;
export const copilotWorkbenchTaskItemFieldsFragment = `fragment CopilotWorkbenchTaskItemFields on CopilotWorkbenchTaskItemType {
  projectTask {
    id
    projectId
    sessionId
    title
    workflow
    status
    targetFingerprint
    leaseHolderName
    leaseRetryCount
    workerAttempt
    createdAt
    updatedAt
    failureCode
    failureMessage
    receipt
    preview
  }
  id
  entityId
  kind
  segment
  attention
  workspaceId
  projectId
  projectName
  documentTitle
  relatedUserName
  relatedUserEmail
  title
  status
  requestedLevel
  documentId
  redacted
  relatedUserId
  createdAt
  updatedAt
  completedAt
  availableActions
  blocker {
    creatorUserId
    type
    waitingOn
    dueAt
    overdue
    origin
    resolutionActorUserId
  }
  run {
    id
    sessionId
    workspaceId
    projectId
    title
    workflow
    status
    createdAt
    updatedAt
    startedAt
    completedAt
    failureCode
    failureMessage
    resultSummary
    approvalSummary
    approvalFingerprint
    resultEvidence
    availableActions
    abandoned
    approval {
      stepId
      status
      title
      decidedAt
    }
    artifacts {
      workspaceId
      kind
      id
      title
    }
    steps {
      id
      key
      type
      status
      title
      order
      startedAt
      completedAt
    }
  }
}`;
export const credentialsRequirementsFragment = `fragment CredentialsRequirements on CredentialsRequirementType {
  password {
    ...PasswordLimits
  }
}`;
export const officeCommentFieldsFragment = `fragment OfficeCommentFields on OfficeCommentType {
  id
  content
  resolved
  user {
    id
    name
    avatarUrl
  }
  replies {
    id
    commentId
    content
    user {
      id
      name
      avatarUrl
    }
    createdAt
    updatedAt
  }
  createdAt
  updatedAt
}`;
export const officeCommentReplyFieldsFragment = `fragment OfficeCommentReplyFields on OfficeCommentReplyType {
  id
  commentId
  content
  user {
    id
    name
    avatarUrl
  }
  createdAt
  updatedAt
}`;
export const paginatedCopilotChatsFragment = `fragment PaginatedCopilotChats on PaginatedCopilotHistoriesType {
  pageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
  edges {
    cursor
    node {
      ...CopilotChatHistory
    }
  }
}${copilotChatHistoryFragment}`;
export const passwordLimitsFragment = `fragment PasswordLimits on PasswordLimitsType {
  minLength
  maxLength
}`;
export const projectAgentTaskFieldsFragment = `fragment ProjectAgentTaskFields on ProjectAgentTaskType {
  id
  projectId
  sessionId
  title
  workflow
  status
  targetFingerprint
  leaseHolderName
  leaseRetryCount
  workerAttempt
  createdAt
  updatedAt
  failureCode
  failureMessage
  receipt
  preview
}`;
export const projectByokSettingsFragment = `fragment ProjectByokSettings on ProjectByokSettingsType {
  configured
  revision
  provider
  endpoint
  modelId
  enabled
  lastValidatedAt
  lastUsedAt
  lastError
  updatedAt
  updatedBy
  allowedProviders
  customEndpointSupported
  auditEvents {
    revision
    actorId
    provider
    endpoint
    modelId
    enabled
    credentialChanged
    createdAt
  }
}`;
export const projectChatContextFieldsFragment = `fragment ProjectChatContextFields on ProjectChatContextType {
  projectId
  sessionId
  version
  items {
    kind
    title
    available
    resourceId
    sequence
    currentSequence
    resourceKind
    blobKey
    name
    mimeType
    byteSize
  }
}`;
export const projectEditLeaseFieldsFragment = `fragment ProjectEditLeaseFields on ProjectEditLeaseType {
  resourceId
  projectId
  kind
  holderId
  holderName
  owned
  leaseId
  acquiredAt
  expiresAt
}`;
export const projectFileRequestFieldsFragment = `fragment ProjectFileRequestFields on ProjectFileRequestType {
  id
  projectId
  projectName
  title
  requesterName
  recipientName
  status
  version
  isRecipient
  fileName
  resourceId
  updatedAt
}`;
export const projectOfficeArtifactFieldsFragment = `fragment ProjectOfficeArtifactFields on ProjectOfficeArtifactType {
  id
  projectId
  kind
  title
  sourceFileName
  sourceMimeType
  sourceByteSize
  sourceFingerprint
  revisionCounter
  compatibility
  createdBy
  createdAt
  updatedAt
  currentRevision {
    id
    projectId
    artifactId
    sequence
    origin
    parentRevisionId
    packageMimeType
    packageByteSize
    packageFingerprint
    stateByteSize
    stateFingerprint
    modelVersion
    operationSummary
    createdBy
    createdAt
    packageUrl
    stateUrl
  }
}`;
export const projectOfficeRevisionFieldsFragment = `fragment ProjectOfficeRevisionFields on ProjectOfficeRevisionType {
  id
  projectId
  artifactId
  sequence
  origin
  parentRevisionId
  packageMimeType
  packageByteSize
  packageFingerprint
  stateByteSize
  stateFingerprint
  modelVersion
  operationSummary
  createdBy
  createdAt
  packageUrl
  stateUrl
}`;
export const projectPublicationFieldsFragment = `fragment ProjectPublicationFields on ProjectPublicationType {
  id
  projectId
  resourceId
  runId
  revision
  kind
  title
  status
  sourceSequence
  createdAt
  expiresAt
  targetFingerprint
  failureCode
  target
  preview
  receipt
}`;
export const projectResourceFieldsFragment = `fragment ProjectResourceFields on ProjectResourceType {
  id
  projectId
  parentId
  kind
  title
  sortKey
  version
  contentVersion
  officeArtifactId
  trashedAt
  createdAt
  updatedAt
}`;
export const projectWorkspaceImportTaskFragment = `fragment ProjectWorkspaceImportTask on ProjectWorkspaceImportTaskType {
  id
  title
  status
  resourceId
  accessRequestId
  failureCode
}`;
export const licenseBodyFragment = `fragment licenseBody on License {
  expiredAt
  installedAt
  quantity
  recurring
  validatedAt
  variant
}`;
export const acquireProjectResourceEditLeaseMutation = {
  id: 'acquireProjectResourceEditLeaseMutation' as const,
  op: 'acquireProjectResourceEditLease',
  query: `mutation acquireProjectResourceEditLease($input: ProjectEditLeaseInput!) {
  acquireProjectResourceEditLease(input: $input) {
    acquired
    lease {
      ...ProjectEditLeaseFields
    }
  }
}
${projectEditLeaseFieldsFragment}`,
};

export const adminAiProfilesQuery = {
  id: 'adminAiProfilesQuery' as const,
  op: 'adminAiProfiles',
  query: `query adminAiProfiles($workspaceId: ID) {
  adminAiProfiles(workspaceId: $workspaceId) {
    id
    workspaceId
    workspaceName
    name
    description
    enabled
    isDefault
    credentialIds
    credentials {
      id
      provider
      name
      modelId
      enabled
    }
    createdAt
    updatedAt
  }
}`,
};

export const adminAllSharedLinksQuery = {
  id: 'adminAllSharedLinksQuery' as const,
  op: 'adminAllSharedLinks',
  query: `query adminAllSharedLinks($pagination: PaginationInput!, $filter: AdminAllSharedLinksFilterInput) {
  adminAllSharedLinks(pagination: $pagination, filter: $filter) {
    totalCount
    analyticsWindow {
      from
      to
      timezone
      bucket
      requestedSize
      effectiveSize
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      cursor
      node {
        workspaceId
        docId
        title
        publishedAt
        docUpdatedAt
        workspaceOwnerId
        lastUpdaterId
        shareUrl
        views
        uniqueViews
        guestViews
        lastAccessedAt
      }
    }
  }
}`,
};

export const adminDashboardQuery = {
  id: 'adminDashboardQuery' as const,
  op: 'adminDashboard',
  query: `query adminDashboard($input: AdminDashboardInput) {
  adminDashboard(input: $input) {
    syncActiveUsers
    syncActiveUsersTimeline {
      minute
      activeUsers
    }
    syncWindow {
      from
      to
      timezone
      bucket
      requestedSize
      effectiveSize
    }
    copilotConversations
    copilotWindow {
      from
      to
      timezone
      bucket
      requestedSize
      effectiveSize
    }
    workspaceStorageBytes
    blobStorageBytes
    workspaceStorageHistory {
      date
      value
    }
    blobStorageHistory {
      date
      value
    }
    storageWindow {
      from
      to
      timezone
      bucket
      requestedSize
      effectiveSize
    }
    topSharedLinks {
      workspaceId
      docId
      title
      shareUrl
      publishedAt
      views
      uniqueViews
      guestViews
      lastAccessedAt
    }
    topSharedLinksWindow {
      from
      to
      timezone
      bucket
      requestedSize
      effectiveSize
    }
    generatedAt
  }
}`,
};

export const adminMailDeliveriesQuery = {
  id: 'adminMailDeliveriesQuery' as const,
  op: 'adminMailDeliveries',
  query: `query adminMailDeliveries($input: AdminMailDeliveriesInput) {
  adminMailDeliveries(input: $input) {
    window {
      from
      to
      timezone
      bucket
      requestedSize
      effectiveSize
    }
    summary {
      total
      sent
      failed
      skipped
      canceled
      queued
      sending
      retryWait
      successRate
    }
    byStatus {
      key
      label
      total
      points {
        bucket
        count
      }
    }
    byType {
      key
      label
      total
      points {
        bucket
        count
      }
    }
    byOutcome {
      key
      label
      total
      points {
        bucket
        count
      }
    }
  }
}`,
};

export const adminServerConfigQuery = {
  id: 'adminServerConfigQuery' as const,
  op: 'adminServerConfig',
  query: `query adminServerConfig {
  serverConfig {
    version
    baseUrl
    name
    features
    type
    initialized
    credentialsRequirement {
      ...CredentialsRequirements
    }
    availableUpgrade {
      changelog
      version
      publishedAt
      url
    }
    availableUserFeatures
  }
}
${passwordLimitsFragment}
${credentialsRequirementsFragment}`,
};

export const adminUpdateWorkspaceMutation = {
  id: 'adminUpdateWorkspaceMutation' as const,
  op: 'adminUpdateWorkspace',
  query: `mutation adminUpdateWorkspace($input: AdminUpdateWorkspaceInput!) {
  adminUpdateWorkspace(input: $input) {
    id
    public
    createdAt
    name
    avatarKey
    enableAi
    enableSharing
    enableUrlPreview
    enableDocEmbedding
    owner {
      id
      name
      email
      avatarUrl
    }
    memberCount
    publicPageCount
    snapshotCount
    snapshotSize
    blobCount
    blobSize
  }
}`,
};

export const adminUserAiProfileAssignmentQuery = {
  id: 'adminUserAiProfileAssignmentQuery' as const,
  op: 'adminUserAiProfileAssignment',
  query: `query adminUserAiProfileAssignment($userId: ID!) {
  adminUserAiProfileAssignment(userId: $userId) {
    userId
    workspaceId
    profile {
      id
      workspaceId
      workspaceName
      name
      description
      enabled
      isDefault
      credentialIds
      credentials {
        id
        provider
        name
        modelId
        enabled
      }
      createdAt
      updatedAt
    }
    createdAt
    updatedAt
  }
}`,
};

export const adminWorkspaceByokScopesQuery = {
  id: 'adminWorkspaceByokScopesQuery' as const,
  op: 'adminWorkspaceByokScopes',
  query: `query adminWorkspaceByokScopes($keyword: String, $first: SafeInt) {
  adminWorkspaceByokScopes(keyword: $keyword, first: $first) {
    id
    name
    enableAi
    memberCount
  }
}`,
};

export const adminWorkspaceByokSettingsQuery = {
  id: 'adminWorkspaceByokSettingsQuery' as const,
  op: 'adminWorkspaceByokSettings',
  query: `query adminWorkspaceByokSettings($workspaceId: String!) {
  adminWorkspaceByokSettings(workspaceId: $workspaceId) {
    workspaceId
    entitled
    serverEntitled
    allowedProviders
    customEndpointSupported
    privateEndpointSupported
    keys {
      id
      provider
      name
      description
      storage
      configured
      enabled
      endpoint
      modelId
      endpointEditable
      sortOrder
      capabilities
      testStatus
      disabledReason
      lastTestedAt
      lastTestError
      lastUsedAt
      lastErrorAt
      lastError
    }
    warnings {
      featureKind
      reason
      requiredProviders
    }
  }
}`,
};

export const adminWorkspaceQuery = {
  id: 'adminWorkspaceQuery' as const,
  op: 'adminWorkspace',
  query: `query adminWorkspace($id: String!, $memberSkip: Int, $memberTake: Int, $memberQuery: String) {
  adminWorkspace(id: $id) {
    id
    public
    createdAt
    name
    avatarKey
    enableAi
    enableSharing
    enableUrlPreview
    enableDocEmbedding
    owner {
      id
      name
      email
      avatarUrl
    }
    memberCount
    publicPageCount
    snapshotCount
    snapshotSize
    blobCount
    blobSize
    sharedLinks {
      docId
      title
      publishedAt
    }
    members(skip: $memberSkip, take: $memberTake, query: $memberQuery) {
      id
      name
      email
      avatarUrl
      role
      status
    }
  }
}`,
};

export const adminWorkspacesQuery = {
  id: 'adminWorkspacesQuery' as const,
  op: 'adminWorkspaces',
  query: `query adminWorkspaces($filter: ListWorkspaceInput!) {
  adminWorkspaces(filter: $filter) {
    id
    public
    createdAt
    name
    avatarKey
    enableAi
    enableSharing
    enableUrlPreview
    enableDocEmbedding
    owner {
      id
      name
      email
      avatarUrl
    }
    memberCount
    publicPageCount
    snapshotCount
    snapshotSize
    blobCount
    blobSize
  }
}`,
};

export const adminWorkspacesCountQuery = {
  id: 'adminWorkspacesCountQuery' as const,
  op: 'adminWorkspacesCount',
  query: `query adminWorkspacesCount($filter: ListWorkspaceInput!) {
  adminWorkspacesCount(filter: $filter)
}`,
};

export const authSigningKeysQuery = {
  id: 'authSigningKeysQuery' as const,
  op: 'authSigningKeys',
  query: `query authSigningKeys {
  authSigningKeys {
    id
    status
    source
    createdAt
    retiredAt
    verifyUntil
    canDelete
  }
}`,
};

export const createChangePasswordUrlMutation = {
  id: 'createChangePasswordUrlMutation' as const,
  op: 'createChangePasswordUrl',
  query: `mutation createChangePasswordUrl($callbackUrl: String!, $userId: String!) {
  createChangePasswordUrl(callbackUrl: $callbackUrl, userId: $userId)
}`,
};

export const appConfigQuery = {
  id: 'appConfigQuery' as const,
  op: 'appConfig',
  query: `query appConfig {
  appConfig
}`,
};

export const createUserMutation = {
  id: 'createUserMutation' as const,
  op: 'createUser',
  query: `mutation createUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
  }
}`,
};

export const deleteAdminAiProfileMutation = {
  id: 'deleteAdminAiProfileMutation' as const,
  op: 'deleteAdminAiProfile',
  query: `mutation deleteAdminAiProfile($workspaceId: ID!, $id: ID!) {
  deleteAdminAiProfile(workspaceId: $workspaceId, id: $id)
}`,
};

export const deleteAuthSigningKeyMutation = {
  id: 'deleteAuthSigningKeyMutation' as const,
  op: 'deleteAuthSigningKey',
  query: `mutation deleteAuthSigningKey($id: String!) {
  deleteAuthSigningKey(id: $id) {
    id
    status
    source
    createdAt
    retiredAt
    verifyUntil
    canDelete
  }
}`,
};

export const deleteUserMutation = {
  id: 'deleteUserMutation' as const,
  op: 'deleteUser',
  query: `mutation deleteUser($id: String!) {
  deleteUser(id: $id) {
    success
  }
}`,
};

export const disableUserMutation = {
  id: 'disableUserMutation' as const,
  op: 'disableUser',
  query: `mutation disableUser($id: String!) {
  banUser(id: $id) {
    email
    disabled
  }
}`,
};

export const enableUserMutation = {
  id: 'enableUserMutation' as const,
  op: 'enableUser',
  query: `mutation enableUser($id: String!) {
  enableUser(id: $id) {
    email
    disabled
  }
}`,
};

export const getUserByEmailQuery = {
  id: 'getUserByEmailQuery' as const,
  op: 'getUserByEmail',
  query: `query getUserByEmail($email: String!) {
  userByEmail(email: $email) {
    id
    name
    email
    features
    hasPassword
    emailVerified
    avatarUrl
    disabled
  }
}`,
};

export const importUsersMutation = {
  id: 'importUsersMutation' as const,
  op: 'ImportUsers',
  query: `mutation ImportUsers($input: ImportUsersInput!) {
  importUsers(input: $input) {
    __typename
    ... on UserType {
      id
      name
      email
    }
    ... on UserImportFailedType {
      email
      error
    }
  }
}`,
};

export const listUsersQuery = {
  id: 'listUsersQuery' as const,
  op: 'listUsers',
  query: `query listUsers($filter: ListUserInput!) {
  users(filter: $filter) {
    id
    name
    email
    disabled
    features
    hasPassword
    emailVerified
    avatarUrl
  }
  usersCount(filter: $filter)
}`,
};

export const adminProjectByokSettingsQuery = {
  id: 'adminProjectByokSettingsQuery' as const,
  op: 'adminProjectByokSettings',
  query: `query adminProjectByokSettings {
  adminProjectByokSettings {
    ...ProjectByokSettings
  }
}
${projectByokSettingsFragment}`,
};

export const saveProjectByokConfigMutation = {
  id: 'saveProjectByokConfigMutation' as const,
  op: 'saveProjectByokConfig',
  query: `mutation saveProjectByokConfig($input: ProjectByokConfigInput!) {
  saveProjectByokConfig(input: $input) {
    ...ProjectByokSettings
  }
}
${projectByokSettingsFragment}`,
};

export const setProjectByokEnabledMutation = {
  id: 'setProjectByokEnabledMutation' as const,
  op: 'setProjectByokEnabled',
  query: `mutation setProjectByokEnabled($expectedRevision: SafeInt!, $enabled: Boolean!) {
  setProjectByokEnabled(expectedRevision: $expectedRevision, enabled: $enabled) {
    ...ProjectByokSettings
  }
}
${projectByokSettingsFragment}`,
};

export const rotateAuthSigningKeyMutation = {
  id: 'rotateAuthSigningKeyMutation' as const,
  op: 'rotateAuthSigningKey',
  query: `mutation rotateAuthSigningKey($expectedActiveKeyId: String!) {
  rotateAuthSigningKey(expectedActiveKeyId: $expectedActiveKeyId) {
    id
    status
    source
    createdAt
    retiredAt
    verifyUntil
    canDelete
  }
}`,
};

export const sendTestEmailMutation = {
  id: 'sendTestEmailMutation' as const,
  op: 'sendTestEmail',
  query: `mutation sendTestEmail($name: String!, $host: String!, $port: Int!, $sender: String!, $username: String!, $password: String!, $ignoreTLS: Boolean!) {
  sendTestEmail(
    config: {name: $name, host: $host, port: $port, sender: $sender, username: $username, password: $password, ignoreTLS: $ignoreTLS}
  )
}`,
};

export const setAdminUserAiProfileAssignmentMutation = {
  id: 'setAdminUserAiProfileAssignmentMutation' as const,
  op: 'setAdminUserAiProfileAssignment',
  query: `mutation setAdminUserAiProfileAssignment($userId: ID!, $profileId: ID) {
  setAdminUserAiProfileAssignment(userId: $userId, profileId: $profileId) {
    userId
    workspaceId
    profile {
      id
      workspaceId
      workspaceName
      name
      enabled
      isDefault
    }
    createdAt
    updatedAt
  }
}`,
};

export const testProjectByokConfigMutation = {
  id: 'testProjectByokConfigMutation' as const,
  op: 'testProjectByokConfig',
  query: `mutation testProjectByokConfig($input: ProjectByokConfigInput!) {
  testProjectByokConfig(input: $input) {
    ok
    message
  }
}`,
};

export const updateAccountFeaturesMutation = {
  id: 'updateAccountFeaturesMutation' as const,
  op: 'updateAccountFeatures',
  query: `mutation updateAccountFeatures($userId: String!, $features: [FeatureType!]!) {
  updateUserFeatures(id: $userId, features: $features)
}`,
};

export const updateAccountMutation = {
  id: 'updateAccountMutation' as const,
  op: 'updateAccount',
  query: `mutation updateAccount($id: String!, $input: ManageUserInput!) {
  updateUser(id: $id, input: $input) {
    id
    name
    email
  }
}`,
};

export const updateAppConfigMutation = {
  id: 'updateAppConfigMutation' as const,
  op: 'updateAppConfig',
  query: `mutation updateAppConfig($updates: [UpdateAppConfigInput!]!) {
  updateAppConfig(updates: $updates)
}`,
};

export const upsertAdminAiProfileMutation = {
  id: 'upsertAdminAiProfileMutation' as const,
  op: 'upsertAdminAiProfile',
  query: `mutation upsertAdminAiProfile($input: UpsertAdminAiProfileInput!) {
  upsertAdminAiProfile(input: $input) {
    id
    workspaceId
    workspaceName
    name
    description
    enabled
    isDefault
    credentialIds
    credentials {
      id
      provider
      name
      modelId
      enabled
    }
    createdAt
    updatedAt
  }
}`,
};

export const validateConfigQuery = {
  id: 'validateConfigQuery' as const,
  op: 'validateConfig',
  query: `query validateConfig($updates: [UpdateAppConfigInput!]!) {
  validateAppConfig(updates: $updates) {
    module
    key
    value
    valid
    error
  }
}`,
};

export const approveProjectAgentTaskMutation = {
  id: 'approveProjectAgentTaskMutation' as const,
  op: 'approveProjectAgentTask',
  query: `mutation approveProjectAgentTask($projectId: String!, $runId: String!, $targetFingerprint: String!) {
  approveProjectAgentTask(
    projectId: $projectId
    runId: $runId
    targetFingerprint: $targetFingerprint
  ) {
    ...ProjectAgentTaskFields
  }
}
${projectAgentTaskFieldsFragment}`,
};

export const deleteBlobMutation = {
  id: 'deleteBlobMutation' as const,
  op: 'deleteBlob',
  query: `mutation deleteBlob($workspaceId: String!, $key: String!, $permanently: Boolean) {
  deleteBlob(workspaceId: $workspaceId, key: $key, permanently: $permanently)
}`,
};

export const listBlobsQuery = {
  id: 'listBlobsQuery' as const,
  op: 'listBlobs',
  query: `query listBlobs($workspaceId: String!) {
  workspace(id: $workspaceId) {
    blobs {
      key
      size
      mime
      createdAt
    }
  }
}`,
};

export const releaseDeletedBlobsMutation = {
  id: 'releaseDeletedBlobsMutation' as const,
  op: 'releaseDeletedBlobs',
  query: `mutation releaseDeletedBlobs($workspaceId: String!) {
  releaseDeletedBlobs(workspaceId: $workspaceId)
}`,
};

export const setBlobMutation = {
  id: 'setBlobMutation' as const,
  op: 'setBlob',
  query: `mutation setBlob($workspaceId: String!, $blob: Upload!, $docScopeId: String) {
  setBlob(workspaceId: $workspaceId, blob: $blob, docScopeId: $docScopeId)
}`,
  file: true,
};

export const abortBlobUploadMutation = {
  id: 'abortBlobUploadMutation' as const,
  op: 'abortBlobUpload',
  query: `mutation abortBlobUpload($workspaceId: String!, $key: String!, $uploadId: String!, $docScopeId: String) {
  abortBlobUpload(
    workspaceId: $workspaceId
    key: $key
    uploadId: $uploadId
    docScopeId: $docScopeId
  )
}`,
};

export const completeBlobUploadMutation = {
  id: 'completeBlobUploadMutation' as const,
  op: 'completeBlobUpload',
  query: `mutation completeBlobUpload($workspaceId: String!, $key: String!, $uploadId: String, $parts: [BlobUploadPartInput!], $docScopeId: String) {
  completeBlobUpload(
    workspaceId: $workspaceId
    key: $key
    uploadId: $uploadId
    parts: $parts
    docScopeId: $docScopeId
  )
}`,
};

export const createBlobUploadMutation = {
  id: 'createBlobUploadMutation' as const,
  op: 'createBlobUpload',
  query: `mutation createBlobUpload($workspaceId: String!, $key: String!, $size: Int!, $mime: String!, $docScopeId: String) {
  createBlobUpload(
    workspaceId: $workspaceId
    key: $key
    size: $size
    mime: $mime
    docScopeId: $docScopeId
  ) {
    method
    blobKey
    alreadyUploaded
    uploadUrl
    headers
    expiresAt
    uploadId
    partSize
    uploadedParts {
      partNumber
      etag
    }
  }
}`,
};

export const getBlobUploadPartUrlQuery = {
  id: 'getBlobUploadPartUrlQuery' as const,
  op: 'getBlobUploadPartUrl',
  query: `query getBlobUploadPartUrl($workspaceId: String!, $key: String!, $uploadId: String!, $partNumber: Int!, $docScopeId: String) {
  workspace(id: $workspaceId) {
    blobUploadPartUrl(
      key: $key
      uploadId: $uploadId
      partNumber: $partNumber
      docScopeId: $docScopeId
    ) {
      uploadUrl
      headers
      expiresAt
    }
  }
}`,
};

export const calendarAccountsQuery = {
  id: 'calendarAccountsQuery' as const,
  op: 'calendarAccounts',
  query: `query calendarAccounts {
  currentUser {
    calendarAccounts {
      id
      provider
      providerAccountId
      displayName
      email
      status
      lastError
      refreshIntervalMinutes
      calendarsCount
      createdAt
      updatedAt
      calendars {
        id
        accountId
        provider
        externalCalendarId
        displayName
        timezone
        color
        enabled
        lastSyncAt
      }
    }
  }
}`,
};

export const calendarEventsQuery = {
  id: 'calendarEventsQuery' as const,
  op: 'calendarEvents',
  query: `query calendarEvents($workspaceId: String!, $from: DateTime!, $to: DateTime!) {
  workspace(id: $workspaceId) {
    calendars {
      id
      events(from: $from, to: $to) {
        id
        subscriptionId
        externalEventId
        recurrenceId
        status
        title
        description
        location
        startAtUtc
        endAtUtc
        originalTimezone
        allDay
      }
    }
  }
}`,
};

export const calendarProvidersQuery = {
  id: 'calendarProvidersQuery' as const,
  op: 'calendarProviders',
  query: `query calendarProviders {
  serverConfig {
    calendarCalDAVProviders {
      id
      label
      requiresAppPassword
      docsUrl
    }
    calendarProviders
  }
}`,
};

export const linkCalDavAccountMutation = {
  id: 'linkCalDavAccountMutation' as const,
  op: 'linkCalDavAccount',
  query: `mutation linkCalDavAccount($input: LinkCalDAVAccountInput!) {
  linkCalDAVAccount(input: $input) {
    id
    provider
    providerAccountId
    displayName
    email
    status
    lastError
    refreshIntervalMinutes
    calendarsCount
    createdAt
    updatedAt
  }
}`,
};

export const linkCalendarAccountMutation = {
  id: 'linkCalendarAccountMutation' as const,
  op: 'linkCalendarAccount',
  query: `mutation linkCalendarAccount($input: LinkCalendarAccountInput!) {
  linkCalendarAccount(input: $input)
}`,
};

export const unlinkCalendarAccountMutation = {
  id: 'unlinkCalendarAccountMutation' as const,
  op: 'unlinkCalendarAccount',
  query: `mutation unlinkCalendarAccount($accountId: String!) {
  unlinkCalendarAccount(accountId: $accountId)
}`,
};

export const updateCalendarAccountMutation = {
  id: 'updateCalendarAccountMutation' as const,
  op: 'updateCalendarAccount',
  query: `mutation updateCalendarAccount($accountId: String!, $refreshIntervalMinutes: Int!) {
  updateCalendarAccount(
    accountId: $accountId
    refreshIntervalMinutes: $refreshIntervalMinutes
  ) {
    id
    provider
    providerAccountId
    displayName
    email
    status
    lastError
    refreshIntervalMinutes
    calendarsCount
    createdAt
    updatedAt
  }
}`,
};

export const updateWorkspaceCalendarsMutation = {
  id: 'updateWorkspaceCalendarsMutation' as const,
  op: 'updateWorkspaceCalendars',
  query: `mutation updateWorkspaceCalendars($input: UpdateWorkspaceCalendarsInput!) {
  updateWorkspaceCalendars(input: $input) {
    id
    workspaceId
    createdByUserId
    displayNameOverride
    colorOverride
    enabled
    items {
      id
      subscriptionId
      sortOrder
      colorOverride
      enabled
    }
  }
}`,
};

export const workspaceCalendarsQuery = {
  id: 'workspaceCalendarsQuery' as const,
  op: 'workspaceCalendars',
  query: `query workspaceCalendars($workspaceId: String!) {
  workspace(id: $workspaceId) {
    calendars {
      id
      workspaceId
      createdByUserId
      displayNameOverride
      colorOverride
      enabled
      items {
        id
        subscriptionId
        sortOrder
        colorOverride
        enabled
      }
    }
  }
}`,
};

export const cancelProjectAgentTaskMutation = {
  id: 'cancelProjectAgentTaskMutation' as const,
  op: 'cancelProjectAgentTask',
  query: `mutation cancelProjectAgentTask($projectId: String!, $runId: String!) {
  cancelProjectAgentTask(projectId: $projectId, runId: $runId) {
    ...ProjectAgentTaskFields
  }
}
${projectAgentTaskFieldsFragment}`,
};

export const cancelSubscriptionMutation = {
  id: 'cancelSubscriptionMutation' as const,
  op: 'cancelSubscription',
  query: `mutation cancelSubscription($plan: SubscriptionPlan = Pro, $workspaceId: String) {
  cancelSubscription(plan: $plan, workspaceId: $workspaceId) {
    id
    status
    nextBillAt
    canceledAt
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const changeEmailMutation = {
  id: 'changeEmailMutation' as const,
  op: 'changeEmail',
  query: `mutation changeEmail($token: String!, $email: String!) {
  changeEmail(token: $token, email: $email) {
    id
    email
  }
}`,
};

export const changePasswordMutation = {
  id: 'changePasswordMutation' as const,
  op: 'changePassword',
  query: `mutation changePassword($token: String!, $userId: String!, $newPassword: String!) {
  changePassword(token: $token, userId: $userId, newPassword: $newPassword)
}`,
};

export const changeProjectFileRequestMutation = {
  id: 'changeProjectFileRequestMutation' as const,
  op: 'changeProjectFileRequest',
  query: `mutation changeProjectFileRequest($requestId: String!, $expectedVersion: Int!, $action: String!) {
  changeProjectFileRequest(
    requestId: $requestId
    expectedVersion: $expectedVersion
    action: $action
  ) {
    ...ProjectFileRequestFields
  }
}
${projectFileRequestFieldsFragment}`,
};

export const changeProjectPublicationMutation = {
  id: 'changeProjectPublicationMutation' as const,
  op: 'changeProjectPublication',
  query: `mutation changeProjectPublication($projectId: String!, $publicationId: String!, $expectedRevision: Int!, $action: String!) {
  changeProjectPublication(
    projectId: $projectId
    publicationId: $publicationId
    expectedRevision: $expectedRevision
    action: $action
  ) {
    ...ProjectPublicationFields
  }
}
${projectPublicationFieldsFragment}`,
};

export const changeProjectResourceMutation = {
  id: 'changeProjectResourceMutation' as const,
  op: 'changeProjectResource',
  query: `mutation changeProjectResource($input: ChangeProjectResourceInput!) {
  changeProjectResource(input: $input) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const cleanupProjectCopilotSessionsMutation = {
  id: 'cleanupProjectCopilotSessionsMutation' as const,
  op: 'cleanupProjectCopilotSessions',
  query: `mutation cleanupProjectCopilotSessions($projectId: String!, $sessionIds: [String!]!) {
  cleanupProjectCopilotSessions(projectId: $projectId, sessionIds: $sessionIds)
}`,
};

export const listCommentChangesQuery = {
  id: 'listCommentChangesQuery' as const,
  op: 'listCommentChanges',
  query: `query listCommentChanges($workspaceId: String!, $docId: String!, $pagination: PaginationInput!) {
  workspace(id: $workspaceId) {
    commentChanges(docId: $docId, pagination: $pagination) {
      totalCount
      edges {
        cursor
        node {
          action
          id
          commentId
          item
        }
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
}`,
};

export const createCommentMutation = {
  id: 'createCommentMutation' as const,
  op: 'createComment',
  query: `mutation createComment($input: CommentCreateInput!) {
  createComment(input: $input) {
    id
    content
    resolved
    createdAt
    updatedAt
    user {
      id
      name
      avatarUrl
    }
    replies {
      commentId
      id
      content
      createdAt
      updatedAt
      user {
        id
        name
        avatarUrl
      }
    }
  }
}`,
};

export const deleteCommentMutation = {
  id: 'deleteCommentMutation' as const,
  op: 'deleteComment',
  query: `mutation deleteComment($id: String!) {
  deleteComment(id: $id)
}`,
};

export const listCommentsQuery = {
  id: 'listCommentsQuery' as const,
  op: 'listComments',
  query: `query listComments($workspaceId: String!, $docId: String!, $pagination: PaginationInput) {
  workspace(id: $workspaceId) {
    comments(docId: $docId, pagination: $pagination) {
      totalCount
      edges {
        cursor
        node {
          id
          content
          resolved
          createdAt
          updatedAt
          user {
            id
            name
            avatarUrl
          }
          replies {
            commentId
            id
            content
            createdAt
            updatedAt
            user {
              id
              name
              avatarUrl
            }
          }
        }
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
}`,
};

export const createReplyMutation = {
  id: 'createReplyMutation' as const,
  op: 'createReply',
  query: `mutation createReply($input: ReplyCreateInput!) {
  createReply(input: $input) {
    commentId
    id
    content
    createdAt
    updatedAt
    user {
      id
      name
      avatarUrl
    }
  }
}`,
};

export const deleteReplyMutation = {
  id: 'deleteReplyMutation' as const,
  op: 'deleteReply',
  query: `mutation deleteReply($id: String!) {
  deleteReply(id: $id)
}`,
};

export const updateReplyMutation = {
  id: 'updateReplyMutation' as const,
  op: 'updateReply',
  query: `mutation updateReply($input: ReplyUpdateInput!) {
  updateReply(input: $input)
}`,
};

export const resolveCommentMutation = {
  id: 'resolveCommentMutation' as const,
  op: 'resolveComment',
  query: `mutation resolveComment($input: CommentResolveInput!) {
  resolveComment(input: $input)
}`,
};

export const updateCommentMutation = {
  id: 'updateCommentMutation' as const,
  op: 'updateComment',
  query: `mutation updateComment($input: CommentUpdateInput!) {
  updateComment(input: $input)
}`,
};

export const uploadCommentAttachmentMutation = {
  id: 'uploadCommentAttachmentMutation' as const,
  op: 'uploadCommentAttachment',
  query: `mutation uploadCommentAttachment($workspaceId: String!, $docId: String!, $attachment: Upload!) {
  uploadCommentAttachment(
    workspaceId: $workspaceId
    docId: $docId
    attachment: $attachment
  )
}`,
  file: true,
};

export const confirmProjectPublicationMutation = {
  id: 'confirmProjectPublicationMutation' as const,
  op: 'confirmProjectPublication',
  query: `mutation confirmProjectPublication($projectId: String!, $publicationId: String!, $expectedRevision: Int!, $targetFingerprint: String!) {
  confirmProjectPublication(
    projectId: $projectId
    publicationId: $publicationId
    expectedRevision: $expectedRevision
    targetFingerprint: $targetFingerprint
  ) {
    ...ProjectPublicationFields
  }
}
${projectPublicationFieldsFragment}`,
};

export const approveCopilotAccessRequestMutation = {
  id: 'approveCopilotAccessRequestMutation' as const,
  op: 'approveCopilotAccessRequest',
  query: `mutation approveCopilotAccessRequest($input: ResolveCopilotAccessRequestInput!) {
  approveCopilotAccessRequest(input: $input) {
    id
    status
    resolvedByUserId
    resolutionReason
    resolvedAt
    updatedAt
  }
}`,
};

export const rejectCopilotAccessRequestMutation = {
  id: 'rejectCopilotAccessRequestMutation' as const,
  op: 'rejectCopilotAccessRequest',
  query: `mutation rejectCopilotAccessRequest($input: ResolveCopilotAccessRequestInput!) {
  rejectCopilotAccessRequest(input: $input) {
    id
    status
    resolvedByUserId
    resolutionReason
    resolvedAt
    updatedAt
  }
}`,
};

export const withdrawCopilotAccessRequestMutation = {
  id: 'withdrawCopilotAccessRequestMutation' as const,
  op: 'withdrawCopilotAccessRequest',
  query: `mutation withdrawCopilotAccessRequest($input: ResolveCopilotAccessRequestInput!) {
  withdrawCopilotAccessRequest(input: $input) {
    id
    status
    resolvedByUserId
    resolutionReason
    resolvedAt
    updatedAt
  }
}`,
};

export const getCopilotActionRunPreparedRouteTraceQuery = {
  id: 'getCopilotActionRunPreparedRouteTraceQuery' as const,
  op: 'getCopilotActionRunPreparedRouteTrace',
  query: `query getCopilotActionRunPreparedRouteTrace($runId: String!, $workspaceId: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      actionRunPreparedRouteTrace(runId: $runId) {
        status
        type
        steps {
          actualRouteCount
          fallbackProviderIds
          kind
          requestedModelId
          requestedModelSource
          routeCount
          routeCountMismatch
          routes {
            behaviorFlags
            canonicalModelKey
            dimensionMismatch
            fallbackOrderIndex
            modelId
            modelBackendKind
            modelEmbeddingDimensions
            protocol
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerHealth
            providerHealthCheckedAt
            providerHealthLastError
            providerId
            providerName
            providerPrivacy
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            requestLayer
            requestedDimensions
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            routeRawModelId
            routeIndex
          }
          stepId
        }
      }
    }
  }
}`,
};

export const getCopilotActionRunsQuery = {
  id: 'getCopilotActionRunsQuery' as const,
  op: 'getCopilotActionRuns',
  query: `query getCopilotActionRuns($workspaceId: String!, $limit: SafeInt) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      actionRuns(limit: $limit) {
        actionId
        actionVersion
        agentRuntimeDiagnosticsFingerprint
        agentRuntimeDiagnosticsManifest {
          actionId
          actionVersion
          fingerprint
          hasPreparedRouteTrace
          nativeTraceEventTypes
          preparedRouteActualCount
          preparedRouteCount
          preparedRouteStepCount
          projectionContractFingerprint
          projectionGapCount
          projectionSource
          runStatus
          schemaReadiness
          schemaReadinessGapCount
          timelineEventTypes
          timelineGapCount
          timelineItemCount
          timelineRouteEvidenceSetFingerprint
          version
        }
        agentRuntimeDiagnosticsManifestExportMetadata {
          actionId
          actionVersion
          artifact
          auditEventCreated
          auditEventFingerprint
          auditEventStatus
          auditEventVersion
          boundary
          exportPolicyFingerprint
          exportPolicyStatus
          exportPolicyVersion
          filename
          manifestFingerprint
          manifestVersion
          metadataFilename
          mime
          projectionSource
          retentionPolicyFingerprint
          retentionPolicyStatus
          retentionPolicyVersion
          runId
          runStatus
          schemaReadiness
          version
        }
        agentRuntimeNativeTraceEventTypes
        agentRuntimeProjectedSchemaComponents
        agentRuntimeProjectedRunStatuses
        agentRuntimeProjectedStepStatuses
        agentRuntimeProjectedStepTypes
        agentRuntimeProjectedTimelineEventTypes
        agentRuntimeProjectionContractFingerprint
        agentRuntimeProjectionSource
        agentRuntimeProjectionGaps
        agentRuntimeRunStatusGaps
        agentRuntimeRunId
        agentRuntimeRunStatus
        agentRuntimeSchemaReadiness
        agentRuntimeSchemaReadinessGaps
        agentRuntimeStepCount
        agentRuntimeStepStatusGaps
        agentRuntimeStepIds
        agentRuntimeStepKinds
        agentRuntimeStepStatuses
        agentRuntimeStepTypes
        agentRuntimeTimelineEntries
        agentRuntimeTimelineEventTypes
        agentRuntimeTimelineGaps
        agentRuntimeTimelineItems {
          actualRouteCount
          eventKey
          eventType
          fallbackProviderIds
          id
          kind
          label
          routeBehaviorFlags
          routeCanonicalModelKeys
          routeCount
          routeCountMismatch
          routeDimensionEvidence
          routeEvidenceFingerprint
          routeModelBackendKinds
          routeTargets
          runId
          sequence
          status
          stepId
          stepType
        }
        agentRuntimeTimelineRouteEvidenceSetFingerprint
        agentRuntimeTargetRunStatuses
        agentRuntimeTargetSchemaComponents
        agentRuntimeTargetStepStatuses
        agentRuntimeTargetStepTypes
        agentRuntimeTargetTimelineEventTypes
        agentRuntimeUnsupportedRunStatuses
        agentRuntimeUnsupportedStepStatuses
        agentRuntimeUnsupportedStepTypes
        agentRuntimeUnsupportedTimelineEventTypes
        attempt
        createdAt
        docId
        errorCode
        hasPreparedRouteTrace
        id
        preparedRouteActualCount
        preparedRouteCount
        preparedRouteBehaviorFlags
        preparedRouteCanonicalModelKeys
        preparedRouteDimensionEvidence
        preparedRouteFallbackProviderIds
        preparedRouteFallbackOrder
        preparedRouteModelBackendKinds
        preparedRouteStepFallbackProviderIds
        preparedRouteStepIds
        preparedRouteKinds
        preparedRouteModelIds
        preparedRouteOrder
        preparedRouteProtocols
        preparedRouteProviderIds
        preparedRouteRequestedModelIds
        preparedRouteRequestedModelSources
        preparedRouteStepRequestedModelSources
        preparedRouteRequestLayers
        preparedRouteStepFallbackOrder
        preparedRouteStepBehaviorFlags
        preparedRouteStepCanonicalModelKeys
        preparedRouteStepDimensionEvidence
        preparedRouteStepModelBackendKinds
        preparedRouteStepOrder
        preparedRouteStepRouteCountMismatches
        preparedRouteStepRouteCounts
        preparedRouteStepProtocols
        preparedRouteStepRequestLayers
        preparedRouteStepCount
        preparedRouteTargets
        preparedRouteStepTargets
        preparedRouteRequestedTargets
        preparedRouteStepRequestedTargets
        retryOf
        sessionId
        status
        updatedAt
      }
    }
  }
}`,
};

export const getCopilotAgentRunQuery = {
  id: 'getCopilotAgentRunQuery' as const,
  op: 'getCopilotAgentRun',
  query: `query getCopilotAgentRun($workspaceId: String!, $id: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      agentRuntimeWorkflowAdapters {
        workflow
        capabilities {
          version
          supportedStepTypes
          sideEffectMode
          summary
        }
      }
      agentRun(id: $id) {
        actorId
        completedAt
        createdAt
        evidenceFingerprint
        executionResultCount
        executionResults {
          actorId
          adapterWorkflow
          completedAt
          createdAt
          executor
          failureCode
          failureMessage
          id
          resultFingerprint
          resultPayload
          resultStatus
          runId
          sideEffectMode
          sideEffectsApplied
          sourceId
          sourceType
          summary
          workerAttempt
          workerLeaseId
          workflow
          workspaceId
        }
        failureCode
        failureMessage
        id
        lastAttemptAt
        queuedAt
        sourceId
        sourceType
        startedAt
        status
        targetFingerprint
        timelineFingerprint
        title
        updatedAt
        workerAttempt
        workerLeaseExpiresAt
        workerLeaseId
        workerMaxAttempts
        workflow
        workspaceId
        steps {
          actorId
          completedAt
          createdAt
          evidenceFingerprint
          id
          order
          outputSummary
          runId
          startedAt
          status
          stepKey
          stepType
          title
          updatedAt
          workspaceId
        }
        timelineEvents {
          actorId
          createdAt
          eventFingerprint
          eventType
          id
          ordinal
          payload
          runId
          status
          stepId
          summary
          workspaceId
        }
      }
    }
  }
}`,
};

export const getCopilotAgentRunsQuery = {
  id: 'getCopilotAgentRunsQuery' as const,
  op: 'getCopilotAgentRuns',
  query: `query getCopilotAgentRuns($workspaceId: String!, $limit: SafeInt, $filter: CopilotAgentRunListFilterInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      agentRuntimeWorkflowAdapters {
        workflow
        capabilities {
          version
          supportedStepTypes
          sideEffectMode
          summary
        }
      }
      agentRuns(filter: $filter, limit: $limit) {
        actorId
        completedAt
        createdAt
        evidenceFingerprint
        executionResultCount
        executionResults {
          actorId
          adapterWorkflow
          completedAt
          createdAt
          executor
          failureCode
          failureMessage
          id
          resultFingerprint
          resultPayload
          resultStatus
          runId
          sideEffectMode
          sideEffectsApplied
          sourceId
          sourceType
          summary
          workerAttempt
          workerLeaseId
          workflow
          workspaceId
        }
        failureCode
        failureMessage
        id
        lastAttemptAt
        queuedAt
        sourceId
        sourceType
        startedAt
        status
        targetFingerprint
        timelineFingerprint
        title
        updatedAt
        workerAttempt
        workerLeaseExpiresAt
        workerLeaseId
        workerMaxAttempts
        workflow
        workspaceId
        steps {
          actorId
          completedAt
          createdAt
          evidenceFingerprint
          id
          order
          outputSummary
          runId
          startedAt
          status
          stepKey
          stepType
          title
          updatedAt
          workspaceId
        }
        timelineEvents {
          actorId
          createdAt
          eventFingerprint
          eventType
          id
          ordinal
          payload
          runId
          status
          stepId
          summary
          workspaceId
        }
      }
    }
  }
}`,
};

export const controlCopilotAgentRuntimeRunMutation = {
  id: 'controlCopilotAgentRuntimeRunMutation' as const,
  op: 'controlCopilotAgentRuntimeRun',
  query: `mutation controlCopilotAgentRuntimeRun($input: CopilotAgentRuntimeControlInput!) {
  controlCopilotAgentRuntimeRun(input: $input) {
    actorId
    completedAt
    createdAt
    evidenceFingerprint
    executionResultCount
    executionResults {
      actorId
      adapterWorkflow
      completedAt
      createdAt
      executor
      failureCode
      failureMessage
      id
      resultFingerprint
      resultPayload
      resultStatus
      runId
      sideEffectMode
      sideEffectsApplied
      sourceId
      sourceType
      summary
      workerAttempt
      workerLeaseId
      workflow
      workspaceId
    }
    failureCode
    failureMessage
    id
    lastAttemptAt
    queuedAt
    sourceId
    sourceType
    startedAt
    status
    targetFingerprint
    timelineFingerprint
    title
    updatedAt
    workerAttempt
    workerLeaseExpiresAt
    workerLeaseId
    workerMaxAttempts
    workflow
    workspaceId
    steps {
      actorId
      completedAt
      createdAt
      evidenceFingerprint
      id
      order
      outputSummary
      runId
      startedAt
      status
      stepKey
      stepType
      title
      updatedAt
      workspaceId
    }
    timelineEvents {
      actorId
      createdAt
      eventFingerprint
      eventType
      id
      ordinal
      payload
      runId
      status
      stepId
      summary
      workspaceId
    }
  }
}`,
};

export const requestCopilotAgentRuntimeDocUpdateMutation = {
  id: 'requestCopilotAgentRuntimeDocUpdateMutation' as const,
  op: 'requestCopilotAgentRuntimeDocUpdate',
  query: `mutation requestCopilotAgentRuntimeDocUpdate($input: CopilotAgentRuntimeDocUpdateRequestInput!) {
  requestCopilotAgentRuntimeDocUpdate(input: $input) {
    id
    workspaceId
    actorId
    workflow
    sourceType
    sourceId
    status
    title
    targetFingerprint
    evidenceFingerprint
    timelineFingerprint
    workerAttempt
    workerMaxAttempts
    createdAt
    updatedAt
    steps {
      id
      stepKey
      stepType
      status
      title
      order
      evidenceFingerprint
      outputSummary
    }
  }
}`,
};

export const requestCopilotAgentRuntimeOfficeCommandMutation = {
  id: 'requestCopilotAgentRuntimeOfficeCommandMutation' as const,
  op: 'requestCopilotAgentRuntimeOfficeCommand',
  query: `mutation requestCopilotAgentRuntimeOfficeCommand($input: CopilotAgentRuntimeOfficeCommandRequestInput!) {
  requestCopilotAgentRuntimeOfficeCommand(input: $input) {
    id
    workspaceId
    actorId
    workflow
    sourceType
    sourceId
    status
    title
    targetFingerprint
    evidenceFingerprint
    timelineFingerprint
    workerAttempt
    workerMaxAttempts
    createdAt
    updatedAt
    steps {
      id
      stepKey
      stepType
      status
      title
      order
      evidenceFingerprint
      outputSummary
    }
  }
}`,
};

export const abandonCopilotBlockerMutation = {
  id: 'abandonCopilotBlockerMutation' as const,
  op: 'abandonCopilotBlocker',
  query: `mutation abandonCopilotBlocker($blockerId: ID!) {
  abandonCopilotBlocker(blockerId: $blockerId) {
    ...CopilotBlockerFields
  }
}
${copilotBlockerFieldsFragment}`,
};

export const createCopilotBlockerMutation = {
  id: 'createCopilotBlockerMutation' as const,
  op: 'createCopilotBlocker',
  query: `mutation createCopilotBlocker($input: CreateCopilotBlockerInput!) {
  createCopilotBlocker(input: $input) {
    ...CopilotBlockerFields
  }
}
${copilotBlockerFieldsFragment}`,
};

export const resolveCopilotBlockerMutation = {
  id: 'resolveCopilotBlockerMutation' as const,
  op: 'resolveCopilotBlocker',
  query: `mutation resolveCopilotBlocker($blockerId: ID!) {
  resolveCopilotBlocker(blockerId: $blockerId) {
    ...CopilotBlockerFields
  }
}
${copilotBlockerFieldsFragment}`,
};

export const confirmCopilotBlockerSuggestionMutation = {
  id: 'confirmCopilotBlockerSuggestionMutation' as const,
  op: 'confirmCopilotBlockerSuggestion',
  query: `mutation confirmCopilotBlockerSuggestion($input: ConfirmCopilotBlockerSuggestionInput!) {
  confirmCopilotBlockerSuggestion(input: $input) {
    ...CopilotBlockerFields
  }
}
${copilotBlockerFieldsFragment}`,
};

export const addContextBlobMutation = {
  id: 'addContextBlobMutation' as const,
  op: 'addContextBlob',
  query: `mutation addContextBlob($options: AddContextBlobInput!) {
  addContextBlob(options: $options) {
    id
    createdAt
    status
  }
}`,
};

export const removeContextBlobMutation = {
  id: 'removeContextBlobMutation' as const,
  op: 'removeContextBlob',
  query: `mutation removeContextBlob($options: RemoveContextBlobInput!) {
  removeContextBlob(options: $options)
}`,
};

export const addContextCategoryMutation = {
  id: 'addContextCategoryMutation' as const,
  op: 'addContextCategory',
  query: `mutation addContextCategory($options: AddContextCategoryInput!) {
  addContextCategory(options: $options) {
    id
    createdAt
    type
    docs {
      id
      createdAt
      status
      snapshotUpdatedAt
      updatedAt
      isModified
    }
  }
}`,
};

export const removeContextCategoryMutation = {
  id: 'removeContextCategoryMutation' as const,
  op: 'removeContextCategory',
  query: `mutation removeContextCategory($options: RemoveContextCategoryInput!) {
  removeContextCategory(options: $options)
}`,
};

export const createCopilotContextMutation = {
  id: 'createCopilotContextMutation' as const,
  op: 'createCopilotContext',
  query: `mutation createCopilotContext($workspaceId: String!, $sessionId: String!) {
  createCopilotContext(workspaceId: $workspaceId, sessionId: $sessionId)
}`,
};

export const copilotContextDashboardGetQuery = {
  id: 'copilotContextDashboardGetQuery' as const,
  op: 'copilotContextDashboardGet',
  query: `query copilotContextDashboardGet($workspaceId: String!, $includeDisabled: Boolean) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contextSettings {
        autoMemoryEnabled
      }
      contextPlannerStrategies {
        version
        fingerprint
        status
        checkpointCount
        lastCheckpointAt
        traceCount
        lastTraceAt
        createdAt
      }
      contextProjects(includeArchived: true) {
        id
        createdByUserId
        name
        description
        status
        role
        canManage
        createdAt
        updatedAt
      }
      contextMemories(includeDisabled: $includeDisabled) {
        id
        ownerUserId
        workspaceId
        docId
        projectId
        sourceSessionId
        scope
        kind
        status
        content
        factKey
        confidence
        importance
        sensitivity
        captureMode
        writerVersion
        validFrom
        validUntil
        expiresAt
        supersedesId
        lastUsedAt
        useCount
        createdAt
        updatedAt
      }
      contextMemoryEvents(limit: 100) {
        id
        sourceSessionId
        sourceTurnId
        operation
        memoryId
        previousMemoryId
        targetEventId
        factKey
        explicit
        reasonCode
        writerVersion
        undoneAt
        canUndo
        createdAt
      }
      contextRules(includeDisabled: $includeDisabled) {
        id
        ownerUserId
        workspaceId
        projectId
        scope
        name
        description
        applicationMode
        priority
        conditions
        status
        activeRevision
        revisions {
          id
          revision
          content
          fingerprint
          createdByUserId
          source
          createdAt
        }
        hits {
          id
          sessionId
          sourceTurnId
          matchReason
          score
          createdAt
        }
        createdAt
        updatedAt
      }
      contextPolicies(includeDisabled: $includeDisabled) {
        id
        workspaceId
        name
        description
        applicationMode
        priority
        conditions
        status
        activeRevision
        revisions {
          id
          revision
          content
          fingerprint
          createdByUserId
          source
          createdAt
        }
        hits {
          id
          sessionId
          sourceTurnId
          matchReason
          score
          createdAt
        }
        canManage
        createdAt
        updatedAt
      }
    }
  }
}`,
};

export const addContextDocMutation = {
  id: 'addContextDocMutation' as const,
  op: 'addContextDoc',
  query: `mutation addContextDoc($options: AddContextDocInput!) {
  addContextDoc(options: $options) {
    id
    createdAt
    status
    snapshotUpdatedAt
    updatedAt
    isModified
  }
}`,
};

export const removeContextDocMutation = {
  id: 'removeContextDocMutation' as const,
  op: 'removeContextDoc',
  query: `mutation removeContextDoc($options: RemoveContextDocInput!) {
  removeContextDoc(options: $options)
}`,
};

export const addContextFileMutation = {
  id: 'addContextFileMutation' as const,
  op: 'addContextFile',
  query: `mutation addContextFile($content: Upload!, $options: AddContextFileInput!) {
  addContextFile(content: $content, options: $options) {
    id
    createdAt
    name
    mimeType
    chunkSize
    error
    status
    blobId
  }
}`,
  file: true,
};

export const removeContextFileMutation = {
  id: 'removeContextFileMutation' as const,
  op: 'removeContextFile',
  query: `mutation removeContextFile($options: RemoveContextFileInput!) {
  removeContextFile(options: $options)
}`,
};

export const listContextObjectQuery = {
  id: 'listContextObjectQuery' as const,
  op: 'listContextObject',
  query: `query listContextObject($workspaceId: String!, $sessionId: String!, $contextId: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contexts(sessionId: $sessionId, contextId: $contextId) {
        blobs {
          id
          status
          createdAt
        }
        docs {
          id
          status
          createdAt
          snapshotUpdatedAt
          updatedAt
          isModified
        }
        files {
          id
          name
          mimeType
          blobId
          chunkSize
          error
          status
          createdAt
        }
        tags {
          type
          id
          docs {
            id
            status
            createdAt
            snapshotUpdatedAt
            updatedAt
            isModified
          }
          createdAt
        }
        collections {
          type
          id
          docs {
            id
            status
            createdAt
            snapshotUpdatedAt
            updatedAt
            isModified
          }
          createdAt
        }
      }
    }
  }
}`,
};

export const listContextQuery = {
  id: 'listContextQuery' as const,
  op: 'listContext',
  query: `query listContext($workspaceId: String!, $sessionId: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contexts(sessionId: $sessionId) {
        id
        workspaceId
      }
    }
  }
}`,
};

export const matchContextQuery = {
  id: 'matchContextQuery' as const,
  op: 'matchContext',
  query: `query matchContext($contextId: String, $workspaceId: String, $content: String!, $limit: SafeInt, $scopedThreshold: Float, $threshold: Float) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contexts(contextId: $contextId) {
        matchFiles(
          content: $content
          limit: $limit
          scopedThreshold: $scopedThreshold
          threshold: $threshold
        ) {
          fileId
          blobId
          name
          mimeType
          chunk
          content
          distance
        }
        matchWorkspaceDocs(
          content: $content
          limit: $limit
          scopedThreshold: $scopedThreshold
          threshold: $threshold
        ) {
          docId
          chunk
          content
          distance
        }
      }
    }
  }
}`,
};

export const matchWorkspaceDocsQuery = {
  id: 'matchWorkspaceDocsQuery' as const,
  op: 'matchWorkspaceDocs',
  query: `query matchWorkspaceDocs($contextId: String, $workspaceId: String, $content: String!, $limit: SafeInt, $scopedThreshold: Float, $threshold: Float) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contexts(contextId: $contextId) {
        matchWorkspaceDocs(
          content: $content
          limit: $limit
          scopedThreshold: $scopedThreshold
          threshold: $threshold
        ) {
          docId
          chunk
          content
          distance
        }
      }
    }
  }
}`,
};

export const matchFilesQuery = {
  id: 'matchFilesQuery' as const,
  op: 'matchFiles',
  query: `query matchFiles($contextId: String, $workspaceId: String, $content: String!, $limit: SafeInt, $scopedThreshold: Float, $threshold: Float) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contexts(contextId: $contextId) {
        matchFiles(
          content: $content
          limit: $limit
          scopedThreshold: $scopedThreshold
          threshold: $threshold
        ) {
          fileId
          blobId
          chunk
          content
          distance
        }
      }
    }
  }
}`,
};

export const copilotContextMemoriesGetQuery = {
  id: 'copilotContextMemoriesGetQuery' as const,
  op: 'copilotContextMemoriesGet',
  query: `query copilotContextMemoriesGet($workspaceId: String, $docId: String, $includeDisabled: Boolean) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contextMemories(docId: $docId, includeDisabled: $includeDisabled) {
        id
        ownerUserId
        workspaceId
        docId
        projectId
        sourceSessionId
        scope
        kind
        status
        content
        createdAt
        updatedAt
      }
    }
  }
}`,
};

export const copilotContextMemoryCreateMutation = {
  id: 'copilotContextMemoryCreateMutation' as const,
  op: 'copilotContextMemoryCreate',
  query: `mutation copilotContextMemoryCreate($input: CreateCopilotContextMemoryInput!) {
  createCopilotContextMemory(input: $input) {
    id
    ownerUserId
    workspaceId
    docId
    projectId
    sourceSessionId
    scope
    kind
    status
    content
    createdAt
    updatedAt
  }
}`,
};

export const copilotContextMemoryDeleteMutation = {
  id: 'copilotContextMemoryDeleteMutation' as const,
  op: 'copilotContextMemoryDelete',
  query: `mutation copilotContextMemoryDelete($id: ID!) {
  deleteCopilotContextMemory(id: $id)
}`,
};

export const copilotContextMemoryUpdateMutation = {
  id: 'copilotContextMemoryUpdateMutation' as const,
  op: 'copilotContextMemoryUpdate',
  query: `mutation copilotContextMemoryUpdate($input: UpdateCopilotContextMemoryInput!) {
  updateCopilotContextMemory(input: $input) {
    id
    ownerUserId
    workspaceId
    docId
    projectId
    sourceSessionId
    scope
    kind
    status
    content
    createdAt
    updatedAt
  }
}`,
};

export const setCopilotContextProjectAiPolicyMutation = {
  id: 'setCopilotContextProjectAiPolicyMutation' as const,
  op: 'setCopilotContextProjectAiPolicy',
  query: `mutation setCopilotContextProjectAiPolicy($input: SetCopilotProjectAiPolicyInput!) {
  setCopilotContextProjectAiPolicy(input: $input) {
    projectId
    policy
    updatedByUserId
    updatedAt
  }
}`,
};

export const copilotContextProjectCreateMutation = {
  id: 'copilotContextProjectCreateMutation' as const,
  op: 'copilotContextProjectCreate',
  query: `mutation copilotContextProjectCreate($input: CreateCopilotContextProjectInput!) {
  createCopilotContextProject(input: $input) {
    id
    createdByUserId
    name
    description
    status
    aiPolicy
    role
    members {
      userId
      name
      email
      avatarUrl
      role
      createdAt
    }
    canManage
    createdAt
    updatedAt
  }
}`,
};

export const copilotContextProjectDeleteMutation = {
  id: 'copilotContextProjectDeleteMutation' as const,
  op: 'copilotContextProjectDelete',
  query: `mutation copilotContextProjectDelete($id: ID!) {
  deleteCopilotContextProject(id: $id)
}`,
};

export const leaveCopilotContextProjectMutation = {
  id: 'leaveCopilotContextProjectMutation' as const,
  op: 'leaveCopilotContextProject',
  query: `mutation leaveCopilotContextProject($projectId: ID!) {
  leaveCopilotContextProject(projectId: $projectId)
}`,
};

export const removeCopilotContextProjectMemberMutation = {
  id: 'removeCopilotContextProjectMemberMutation' as const,
  op: 'removeCopilotContextProjectMember',
  query: `mutation removeCopilotContextProjectMember($input: RemoveCopilotProjectMemberInput!) {
  removeCopilotContextProjectMember(input: $input)
}`,
};

export const transferCopilotContextProjectOwnershipMutation = {
  id: 'transferCopilotContextProjectOwnershipMutation' as const,
  op: 'transferCopilotContextProjectOwnership',
  query: `mutation transferCopilotContextProjectOwnership($input: TransferCopilotProjectOwnershipInput!) {
  transferCopilotContextProjectOwnership(input: $input)
}`,
};

export const copilotContextProjectUpdateMutation = {
  id: 'copilotContextProjectUpdateMutation' as const,
  op: 'copilotContextProjectUpdate',
  query: `mutation copilotContextProjectUpdate($input: UpdateCopilotContextProjectInput!) {
  updateCopilotContextProject(input: $input) {
    id
    createdByUserId
    name
    description
    status
    aiPolicy
    role
    members {
      userId
      name
      email
      avatarUrl
      role
      createdAt
    }
    canManage
    createdAt
    updatedAt
  }
}`,
};

export const copilotContextSettingsUpdateMutation = {
  id: 'copilotContextSettingsUpdateMutation' as const,
  op: 'copilotContextSettingsUpdate',
  query: `mutation copilotContextSettingsUpdate($input: UpdateCopilotContextSettingsInput!) {
  updateCopilotContextSettings(input: $input) {
    autoMemoryEnabled
  }
}`,
};

export const copilotContextSessionScopeQuery = {
  id: 'copilotContextSessionScopeQuery' as const,
  op: 'copilotContextSessionScope',
  query: `query copilotContextSessionScope($workspaceId: String!, $sessionId: ID!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      contextSessionScope(sessionId: $sessionId) {
        sessionId
        primaryDocId
        readableDocIds
        readableDocumentRefs {
          workspaceId
          docId
        }
        candidateProjectIds
        projectIds
        selectedProjectId
        projectResolution
        candidateProjects {
          id
          name
        }
      }
    }
  }
}`,
};

export const createCopilotContextRuleMutation = {
  id: 'createCopilotContextRuleMutation' as const,
  op: 'createCopilotContextRule',
  query: `mutation createCopilotContextRule($input: CreateCopilotContextRuleInput!) {
  createCopilotContextRule(input: $input) {
    id
  }
}`,
};

export const updateCopilotContextRuleMutation = {
  id: 'updateCopilotContextRuleMutation' as const,
  op: 'updateCopilotContextRule',
  query: `mutation updateCopilotContextRule($input: UpdateCopilotContextRuleInput!) {
  updateCopilotContextRule(input: $input) {
    id
  }
}`,
};

export const rollbackCopilotContextRuleMutation = {
  id: 'rollbackCopilotContextRuleMutation' as const,
  op: 'rollbackCopilotContextRule',
  query: `mutation rollbackCopilotContextRule($id: ID!, $revision: Int!) {
  rollbackCopilotContextRule(id: $id, revision: $revision) {
    id
  }
}`,
};

export const deleteCopilotContextRuleMutation = {
  id: 'deleteCopilotContextRuleMutation' as const,
  op: 'deleteCopilotContextRule',
  query: `mutation deleteCopilotContextRule($id: ID!) {
  deleteCopilotContextRule(id: $id)
}`,
};

export const createCopilotContextPolicyMutation = {
  id: 'createCopilotContextPolicyMutation' as const,
  op: 'createCopilotContextPolicy',
  query: `mutation createCopilotContextPolicy($input: CreateCopilotContextPolicyInput!) {
  createCopilotContextPolicy(input: $input) {
    id
  }
}`,
};

export const updateCopilotContextPolicyMutation = {
  id: 'updateCopilotContextPolicyMutation' as const,
  op: 'updateCopilotContextPolicy',
  query: `mutation updateCopilotContextPolicy($input: UpdateCopilotContextPolicyInput!) {
  updateCopilotContextPolicy(input: $input) {
    id
  }
}`,
};

export const rollbackCopilotContextPolicyMutation = {
  id: 'rollbackCopilotContextPolicyMutation' as const,
  op: 'rollbackCopilotContextPolicy',
  query: `mutation rollbackCopilotContextPolicy($id: ID!, $workspaceId: String!, $revision: Int!) {
  rollbackCopilotContextPolicy(
    id: $id
    workspaceId: $workspaceId
    revision: $revision
  ) {
    id
  }
}`,
};

export const deleteCopilotContextPolicyMutation = {
  id: 'deleteCopilotContextPolicyMutation' as const,
  op: 'deleteCopilotContextPolicy',
  query: `mutation deleteCopilotContextPolicy($id: ID!, $workspaceId: String!) {
  deleteCopilotContextPolicy(id: $id, workspaceId: $workspaceId)
}`,
};

export const undoCopilotContextMemoryEventMutation = {
  id: 'undoCopilotContextMemoryEventMutation' as const,
  op: 'undoCopilotContextMemoryEvent',
  query: `mutation undoCopilotContextMemoryEvent($workspaceId: String!, $eventId: ID!) {
  undoCopilotContextMemoryEvent(workspaceId: $workspaceId, eventId: $eventId) {
    id
    operation
    targetEventId
  }
}`,
};

export const queueWorkspaceEmbeddingMutation = {
  id: 'queueWorkspaceEmbeddingMutation' as const,
  op: 'queueWorkspaceEmbedding',
  query: `mutation queueWorkspaceEmbedding($workspaceId: String!, $docId: [String!]!) {
  queueWorkspaceEmbedding(workspaceId: $workspaceId, docId: $docId)
}`,
};

export const requestCopilotDocumentAccessMutation = {
  id: 'requestCopilotDocumentAccessMutation' as const,
  op: 'requestCopilotDocumentAccess',
  query: `mutation requestCopilotDocumentAccess($input: RequestCopilotDocumentAccessInput!) {
  requestCopilotDocumentAccess(input: $input) {
    id
    workspaceId
    docId
    beneficiaryType
    beneficiaryUserId
    beneficiaryProjectId
    requesterUserId
    requestedLevel
    requestedTitle
    status
    resolvedByUserId
    resolutionReason
    resolvedAt
    expiresAt
    createdAt
    updatedAt
  }
}`,
};

export const copilotDocumentDestinationWorkspacesQuery = {
  id: 'copilotDocumentDestinationWorkspacesQuery' as const,
  op: 'copilotDocumentDestinationWorkspaces',
  query: `query copilotDocumentDestinationWorkspaces {
  currentUser {
    copilot {
      documentDestinationWorkspaces {
        id
        name
      }
    }
  }
}`,
};

export const copilotDocumentDestinationFoldersQuery = {
  id: 'copilotDocumentDestinationFoldersQuery' as const,
  op: 'copilotDocumentDestinationFolders',
  query: `query copilotDocumentDestinationFolders($workspaceId: ID!, $after: String) {
  currentUser {
    copilot {
      documentDestinationFolders(workspaceId: $workspaceId, after: $after) {
        items {
          id
          name
        }
        nextCursor
      }
    }
  }
}`,
};

export const copilotDocumentOperationsQuery = {
  id: 'copilotDocumentOperationsQuery' as const,
  op: 'copilotDocumentOperations',
  query: `query copilotDocumentOperations($sessionId: ID!, $after: ID) {
  currentUser {
    copilot {
      documentOperations(sessionId: $sessionId, after: $after) {
        ...CopilotDocumentOperationFields
      }
    }
  }
}
${copilotDocumentOperationFieldsFragment}`,
};

export const confirmCopilotDocumentDestinationMutation = {
  id: 'confirmCopilotDocumentDestinationMutation' as const,
  op: 'confirmCopilotDocumentDestination',
  query: `mutation confirmCopilotDocumentDestination($input: ConfirmCopilotDocumentDestinationInput!) {
  confirmCopilotDocumentDestination(input: $input) {
    ...CopilotDocumentOperationFields
  }
}
${copilotDocumentOperationFieldsFragment}`,
};

export const retryCopilotDocumentOperationMutation = {
  id: 'retryCopilotDocumentOperationMutation' as const,
  op: 'retryCopilotDocumentOperation',
  query: `mutation retryCopilotDocumentOperation($operationId: ID!, $expectedRevision: Int!) {
  retryCopilotDocumentOperation(
    operationId: $operationId
    expectedRevision: $expectedRevision
  ) {
    ...CopilotDocumentOperationFields
  }
}
${copilotDocumentOperationFieldsFragment}`,
};

export const withdrawCopilotDocumentOperationMutation = {
  id: 'withdrawCopilotDocumentOperationMutation' as const,
  op: 'withdrawCopilotDocumentOperation',
  query: `mutation withdrawCopilotDocumentOperation($operationId: ID!, $expectedRevision: Int!) {
  withdrawCopilotDocumentOperation(
    operationId: $operationId
    expectedRevision: $expectedRevision
  ) {
    ...CopilotDocumentOperationFields
  }
}
${copilotDocumentOperationFieldsFragment}`,
};

export const getCopilotHistoryIdsQuery = {
  id: 'getCopilotHistoryIdsQuery' as const,
  op: 'getCopilotHistoryIds',
  query: `query getCopilotHistoryIds($workspaceId: String!, $pagination: PaginationInput!, $docId: String, $options: QueryChatHistoriesInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(pagination: $pagination, docId: $docId, options: $options) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
            sessionId
            pinned
            messages {
              id
              role
              createdAt
            }
          }
        }
      }
    }
  }
}`,
};

export const getCopilotDocSessionsQuery = {
  id: 'getCopilotDocSessionsQuery' as const,
  op: 'getCopilotDocSessions',
  query: `query getCopilotDocSessions($workspaceId: String!, $docId: String!, $pagination: PaginationInput!, $options: QueryChatHistoriesInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(pagination: $pagination, docId: $docId, options: $options) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const getCopilotPinnedSessionsQuery = {
  id: 'getCopilotPinnedSessionsQuery' as const,
  op: 'getCopilotPinnedSessions',
  query: `query getCopilotPinnedSessions($workspaceId: String!, $docId: String, $messageOrder: ChatHistoryOrder, $withPrompt: Boolean) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(
        pagination: {first: 1}
        docId: $docId
        options: {pinned: true, messageOrder: $messageOrder, withPrompt: $withPrompt}
      ) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const getCopilotWorkspaceSessionsQuery = {
  id: 'getCopilotWorkspaceSessionsQuery' as const,
  op: 'getCopilotWorkspaceSessions',
  query: `query getCopilotWorkspaceSessions($workspaceId: String!, $pagination: PaginationInput!, $options: QueryChatHistoriesInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(pagination: $pagination, docId: null, options: $options) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const getCopilotHistoriesQuery = {
  id: 'getCopilotHistoriesQuery' as const,
  op: 'getCopilotHistories',
  query: `query getCopilotHistories($workspaceId: String!, $pagination: PaginationInput!, $docId: String, $options: QueryChatHistoriesInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(pagination: $pagination, docId: $docId, options: $options) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const createCopilotMessageMutation = {
  id: 'createCopilotMessageMutation' as const,
  op: 'createCopilotMessage',
  query: `mutation createCopilotMessage($options: CreateChatMessageInput!) {
  createCopilotMessage(options: $options)
}`,
  file: true,
};

export const getPromptModelsQuery = {
  id: 'getPromptModelsQuery' as const,
  op: 'getPromptModels',
  query: `query getPromptModels($promptName: String!, $workspaceId: String) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      models(promptName: $promptName) {
        defaultModel
        defaultModelFallbackReason
        defaultModelSource
        promptDefaultModel
        embeddingRoute {
          behaviorFlags
          candidateCount
          canonicalModelKey
          configured
          diagnosticsErrors {
            code
            message
            stage
          }
          dimensionMismatch
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          embeddingIndexContractDimensions
          embeddingIndexContractFingerprint
          embeddingIndexContractStatus
          embeddingIndexContractVersion
          errorCode
          errorMessage
          fallbackProviderIds
          featureKind
          modelBackendKind
          modelEmbeddingDimensions
          modelId
          policyAllowedPrivacy
          policyAllowedProviderIds
          policyBlockedProviderIds
          policyEnabled
          policyFeatureKind
          policyPreferredPrivacy
          policyWorkspaceId
          policyCandidates {
            allowed
            available
            candidateFingerprint
            candidateKey
            health
            healthCheckedAt
            privacy
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerPriority
            providerType
            reasons
          }
          routeCandidates {
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            routeContextWindow
            routeEmbeddingDimensions
            routeMaxOutputTokens
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeInputTypes
            routeOutputTypes
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            matched
            modelId
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            providerPriority
            privacy
            health
            healthCheckedAt
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            modelRegistryRevisionPublishEventCount
            modelRegistryRevisionPublishEvents {
              actorId
              createdAt
              eventFingerprint
              eventType
              id
              metadata
              publishSource
              registryFamily
              registryKey
              registryModelId
              registryProviderId
              revision
              revisionFingerprint
              revisionId
              revisionStatus
              scopeType
              workspaceId
            }
            routeRawModelId
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
          }
          routeTrace {
            availableCount
            blockedCount
            candidateCount
            matchedCount
            phase
            preparedCount
            reasons
            selectedCount
          }
          prepareCandidates {
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            routeContextWindow
            routeEmbeddingDimensions
            routeMaxOutputTokens
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeInputTypes
            routeOutputTypes
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            errorCategory
            errorCode
            health
            healthCheckedAt
            modelId
            prepared
            preparedModelId
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            privacy
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            modelRegistryRevisionPublishEventCount
            modelRegistryRevisionPublishEvents {
              actorId
              createdAt
              eventFingerprint
              eventType
              id
              metadata
              publishSource
              registryFamily
              registryKey
              registryModelId
              registryProviderId
              revision
              revisionFingerprint
              revisionId
              revisionStatus
              scopeType
              workspaceId
            }
            routeRawModelId
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
          }
          preparedProviderCount
          preparedRouteTargets
          preparedRouteTargetFingerprint
          preparedRoutes {
            behaviorFlags
            canonicalModelKey
            dimensionMismatch
            fallbackOrderIndex
            modelBackendKind
            modelEmbeddingDimensions
            modelId
            protocol
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerId
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            requestedDimensions
            requestLayer
            routeIndex
          }
          providerId
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          protocol
          rerankRuntimeContractFingerprint
          rerankRuntimeContractStatus
          rerankRuntimeContractTopK
          rerankRuntimeContractVersion
          requestedModelConfigKey
          requestedModelConfigPath
          requestedModelId
          requestedModelSource
          taskRoutePolicyRevision
          taskRoutePolicyRevisionActorId
          taskRoutePolicyRevisionFingerprint
          taskRoutePolicyRevisionId
          taskRoutePolicyRevisionScope
          taskRoutePolicyRevisionSourceChain {
            actorId
            configKey
            configPath
            featureKind
            fingerprint
            modelId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          taskRoutePolicyRevisionSourceChainFingerprint
          taskRoutePolicyRevisionStatus
          taskRoutePolicyRevisionWorkspaceId
          taskRoutePolicyRevisionPublishEventCount
          taskRoutePolicyRevisionPublishEvents {
            actorId
            createdAt
            eventFingerprint
            eventType
            id
            metadata
            publishSource
            registryFamily
            registryKey
            registryModelId
            registryProviderId
            revision
            revisionFingerprint
            revisionId
            revisionStatus
            scopeType
            workspaceId
          }
          requestedDimensions
          requestLayer
          topK
        }
        optionalModels {
          contextWindow
          costInputPer1M
          costOutputPer1M
          embeddingDimensions
          id
          maxOutputTokens
          name
          promptAction
          promptCategory
          promptDefaultPolicy
          promptModelConfigPath
          promptModelSource
          promptModelSources {
            candidateSource
            modelConfigPath
            modelSource
          }
          promptName
          promptOverrideApplied
          promptSource
          providerId
          providerName
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          routeModelId
          providerType
          providerPrivacy
          providerHealth
          providerHealthCheckedAt
          providerHealthLastError
          providerPriority
          registryAvailable
          registryKind
          registrySelected
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          routeBackendKind
          routeBehaviorFlags
          routeCanonicalModelKey
          routeFallbackProviderIds
          routeInputTypes
          routeAttachmentAllowRemoteUrls
          routeAttachmentKinds
          routeAttachmentSourceKinds
          routeModelAliasMatched
          routeModelDefinitionAliases
          routeModelDefinitionId
          routeModelDefinitionSource
          modelRegistryRevision
          modelRegistryRevisionActorId
          modelRegistryRevisionFingerprint
          modelRegistryRevisionId
          modelRegistryRevisionScope
          modelRegistryRevisionSourceChain {
            actorId
            fingerprint
            modelId
            providerId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          modelRegistryRevisionSourceChainFingerprint
          modelRegistryRevisionStatus
          modelRegistryRevisionWorkspaceId
          modelRegistryRevisionPublishEventCount
          modelRegistryRevisionPublishEvents {
            actorId
            createdAt
            eventFingerprint
            eventType
            id
            metadata
            publishSource
            registryFamily
            registryKey
            registryModelId
            registryProviderId
            revision
            revisionFingerprint
            revisionId
            revisionStatus
            scopeType
            workspaceId
          }
          routeOutputTypes
          routeStructuredAttachmentAllowRemoteUrls
          routeStructuredAttachmentKinds
          routeStructuredAttachmentSourceKinds
          routeProtocol
          routeRawModelId
          routeRequestLayer
          routePolicyAllowedPrivacy
          routePolicyAllowedProviderIds
          routePolicyBlockedProviderIds
          routePolicyEnabled
          routePolicyFeatureKind
          routePolicyPreferredPrivacy
          routePolicyWorkspaceId
          sources
        }
        proModels {
          contextWindow
          costInputPer1M
          costOutputPer1M
          embeddingDimensions
          id
          maxOutputTokens
          name
          promptAction
          promptCategory
          promptDefaultPolicy
          promptModelConfigPath
          promptModelSource
          promptModelSources {
            candidateSource
            modelConfigPath
            modelSource
          }
          promptName
          promptOverrideApplied
          promptSource
          providerId
          providerName
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          routeModelId
          providerType
          providerPrivacy
          providerHealth
          providerHealthCheckedAt
          providerHealthLastError
          providerPriority
          registryAvailable
          registryKind
          registrySelected
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          routeBackendKind
          routeBehaviorFlags
          routeCanonicalModelKey
          routeFallbackProviderIds
          routeInputTypes
          routeAttachmentAllowRemoteUrls
          routeAttachmentKinds
          routeAttachmentSourceKinds
          routeModelAliasMatched
          routeModelDefinitionAliases
          routeModelDefinitionId
          routeModelDefinitionSource
          modelRegistryRevision
          modelRegistryRevisionActorId
          modelRegistryRevisionFingerprint
          modelRegistryRevisionId
          modelRegistryRevisionScope
          modelRegistryRevisionSourceChain {
            actorId
            fingerprint
            modelId
            providerId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          modelRegistryRevisionSourceChainFingerprint
          modelRegistryRevisionStatus
          modelRegistryRevisionWorkspaceId
          modelRegistryRevisionPublishEventCount
          modelRegistryRevisionPublishEvents {
            actorId
            createdAt
            eventFingerprint
            eventType
            id
            metadata
            publishSource
            registryFamily
            registryKey
            registryModelId
            registryProviderId
            revision
            revisionFingerprint
            revisionId
            revisionStatus
            scopeType
            workspaceId
          }
          routeOutputTypes
          routeStructuredAttachmentAllowRemoteUrls
          routeStructuredAttachmentKinds
          routeStructuredAttachmentSourceKinds
          routeProtocol
          routeRawModelId
          routeRequestLayer
          routePolicyAllowedPrivacy
          routePolicyAllowedProviderIds
          routePolicyBlockedProviderIds
          routePolicyEnabled
          routePolicyFeatureKind
          routePolicyPreferredPrivacy
          routePolicyWorkspaceId
          sources
        }
        rerankRoute {
          behaviorFlags
          candidateCount
          canonicalModelKey
          configured
          diagnosticsErrors {
            code
            message
            stage
          }
          dimensionMismatch
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          embeddingIndexContractDimensions
          embeddingIndexContractFingerprint
          embeddingIndexContractStatus
          embeddingIndexContractVersion
          errorCode
          errorMessage
          fallbackProviderIds
          featureKind
          modelBackendKind
          modelEmbeddingDimensions
          modelId
          policyAllowedPrivacy
          policyAllowedProviderIds
          policyBlockedProviderIds
          policyEnabled
          policyFeatureKind
          policyPreferredPrivacy
          policyWorkspaceId
          policyCandidates {
            allowed
            available
            candidateFingerprint
            candidateKey
            health
            healthCheckedAt
            privacy
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerPriority
            providerType
            reasons
          }
          routeCandidates {
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            routeContextWindow
            routeEmbeddingDimensions
            routeMaxOutputTokens
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeInputTypes
            routeOutputTypes
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            matched
            modelId
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            providerPriority
            privacy
            health
            healthCheckedAt
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            modelRegistryRevisionPublishEventCount
            modelRegistryRevisionPublishEvents {
              actorId
              createdAt
              eventFingerprint
              eventType
              id
              metadata
              publishSource
              registryFamily
              registryKey
              registryModelId
              registryProviderId
              revision
              revisionFingerprint
              revisionId
              revisionStatus
              scopeType
              workspaceId
            }
            routeRawModelId
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
          }
          routeTrace {
            availableCount
            blockedCount
            candidateCount
            matchedCount
            phase
            preparedCount
            reasons
            selectedCount
          }
          prepareCandidates {
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            routeContextWindow
            routeEmbeddingDimensions
            routeMaxOutputTokens
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeInputTypes
            routeOutputTypes
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            errorCategory
            errorCode
            health
            healthCheckedAt
            modelId
            prepared
            preparedModelId
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            privacy
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            modelRegistryRevisionPublishEventCount
            modelRegistryRevisionPublishEvents {
              actorId
              createdAt
              eventFingerprint
              eventType
              id
              metadata
              publishSource
              registryFamily
              registryKey
              registryModelId
              registryProviderId
              revision
              revisionFingerprint
              revisionId
              revisionStatus
              scopeType
              workspaceId
            }
            routeRawModelId
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
          }
          preparedProviderCount
          preparedRouteTargets
          preparedRouteTargetFingerprint
          preparedRoutes {
            behaviorFlags
            canonicalModelKey
            dimensionMismatch
            fallbackOrderIndex
            modelBackendKind
            modelEmbeddingDimensions
            modelId
            protocol
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerId
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            requestedDimensions
            requestLayer
            routeIndex
          }
          providerId
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          protocol
          rerankRuntimeContractFingerprint
          rerankRuntimeContractStatus
          rerankRuntimeContractTopK
          rerankRuntimeContractVersion
          requestedModelConfigKey
          requestedModelConfigPath
          requestedModelId
          requestedModelSource
          taskRoutePolicyRevision
          taskRoutePolicyRevisionActorId
          taskRoutePolicyRevisionFingerprint
          taskRoutePolicyRevisionId
          taskRoutePolicyRevisionScope
          taskRoutePolicyRevisionSourceChain {
            actorId
            configKey
            configPath
            featureKind
            fingerprint
            modelId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          taskRoutePolicyRevisionSourceChainFingerprint
          taskRoutePolicyRevisionStatus
          taskRoutePolicyRevisionWorkspaceId
          taskRoutePolicyRevisionPublishEventCount
          taskRoutePolicyRevisionPublishEvents {
            actorId
            createdAt
            eventFingerprint
            eventType
            id
            metadata
            publishSource
            registryFamily
            registryKey
            registryModelId
            registryProviderId
            revision
            revisionFingerprint
            revisionId
            revisionStatus
            scopeType
            workspaceId
          }
          requestedDimensions
          requestLayer
          topK
        }
      }
    }
  }
}`,
};

export const acceptCopilotProjectInvitationMutation = {
  id: 'acceptCopilotProjectInvitationMutation' as const,
  op: 'acceptCopilotProjectInvitation',
  query: `mutation acceptCopilotProjectInvitation($invitationId: ID!) {
  acceptCopilotProjectInvitation(invitationId: $invitationId) {
    id
    projectId
    status
    acceptedAt
    updatedAt
  }
}`,
};

export const declineCopilotProjectInvitationMutation = {
  id: 'declineCopilotProjectInvitationMutation' as const,
  op: 'declineCopilotProjectInvitation',
  query: `mutation declineCopilotProjectInvitation($invitationId: ID!) {
  declineCopilotProjectInvitation(invitationId: $invitationId) {
    id
    projectId
    status
    declinedAt
    updatedAt
  }
}`,
};

export const sendCopilotProjectInvitationMutation = {
  id: 'sendCopilotProjectInvitationMutation' as const,
  op: 'sendCopilotProjectInvitation',
  query: `mutation sendCopilotProjectInvitation($input: SendCopilotProjectInvitationInput!) {
  sendCopilotProjectInvitation(input: $input) {
    id
    projectId
    inviteeUserId
    inviterUserId
    status
    acceptedAt
    declinedAt
    withdrawnAt
    createdAt
    updatedAt
  }
}`,
};

export const withdrawCopilotProjectInvitationMutation = {
  id: 'withdrawCopilotProjectInvitationMutation' as const,
  op: 'withdrawCopilotProjectInvitation',
  query: `mutation withdrawCopilotProjectInvitation($invitationId: ID!) {
  withdrawCopilotProjectInvitation(invitationId: $invitationId) {
    id
    projectId
    status
    withdrawnAt
    updatedAt
  }
}`,
};

export const getCopilotPromptRegistryPublishGateQuery = {
  id: 'getCopilotPromptRegistryPublishGateQuery' as const,
  op: 'getCopilotPromptRegistryPublishGate',
  query: `query getCopilotPromptRegistryPublishGate($workspaceId: String, $name: String!, $expectedVersion: CopilotPromptRegistryPublishGateExpectedVersionInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      promptRegistryPublishGate(name: $name, expectedVersion: $expectedVersion) {
        actionRouteDryRun {
          actionId
          actualRouteCount
          diagnosticsErrorCode
          diagnosticsErrorMessage
          diagnosticsErrorStage
          errorCode
          errorMessage
          expectedRouteCount
          featureKind
          missingRouteCount
          routeCountMismatch
          routeCountMismatchStepIds
          status
          steps {
            actualRouteCount
            fallbackProviderIds
            kind
            requestedModelId
            requestedModelSource
            routeCount
            routeCountMismatch
            routes {
              fallbackOrderIndex
              modelId
              protocol
              providerConfiguredModelCount
              providerConfiguredModelIds
              providerHealth
              providerHealthCheckedAt
              providerHealthLastError
              providerId
              providerName
              providerPrivacy
              providerPriority
              providerProfileConfigPath
              providerProfileId
              providerProfileSource
              providerSource
              providerType
              requestLayer
              routeIndex
              routeModelAliasMatched
              routeModelDefinitionAliases
              routeModelDefinitionId
              routeModelDefinitionSource
              routeRawModelId
            }
            stepId
          }
        }
        allowed
        blockingCount
        errorCount
        issueCount
        issues {
          code
          detail
          fieldLabel
          message
          messageIndex
          path
          publishBlocking
          reason
          severity
          source
          sourceLocator {
            field
            messageIndex
            path
            registryFingerprint
            registryId
            registryUpdatedAt
            table
          }
        }
        modelRoute {
          available
          behaviorFlags
          candidateCount
          candidateConfigPath
          candidateIndex
          candidateKind
          canonicalModelKey
          checked
          configured
          diagnosticsErrorCode
          diagnosticsErrorMessage
          diagnosticsErrorStage
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          fallbackProviderIds
          featureKind
          matchedCandidateCount
          modelBackendKind
          modelId
          outputType
          policyAllowedPrivacy
          policyAllowedProviderIds
          policyBlockedProviderIds
          policyEnabled
          policyFeatureKind
          policyPreferredPrivacy
          policyWorkspaceId
          policyCandidates {
            allowed
            available
            candidateFingerprint
            candidateKey
            health
            healthCheckedAt
            privacy
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            reasons
          }
          protocol
          providerId
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerHealth
          providerHealthCheckedAt
          providerHealthLastError
          providerName
          providerPrivacy
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          reasons
          requestedModelId
          requestedModelSource
          requestLayer
          routeModelAliasMatched
          routeModelDefinitionAliases
          routeModelDefinitionId
          routeModelDefinitionSource
          modelRegistryRevision
          modelRegistryRevisionActorId
          modelRegistryRevisionFingerprint
          modelRegistryRevisionId
          modelRegistryRevisionScope
          modelRegistryRevisionSourceChain {
            actorId
            fingerprint
            modelId
            providerId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          modelRegistryRevisionSourceChainFingerprint
          modelRegistryRevisionStatus
          modelRegistryRevisionWorkspaceId
          routeRawModelId
          routeCandidates {
            candidateModelIds
            health
            healthCheckedAt
            matched
            modelId
            privacy
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerId
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            routeRawModelId
          }
          routeTrace {
            availableCount
            blockedCount
            candidateCount
            matchedCount
            phase
            preparedCount
            reasons
            selectedCount
          }
        }
        modelRoutes {
          available
          behaviorFlags
          candidateCount
          candidateConfigPath
          candidateIndex
          candidateKind
          canonicalModelKey
          checked
          configured
          diagnosticsErrorCode
          diagnosticsErrorMessage
          diagnosticsErrorStage
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          fallbackProviderIds
          featureKind
          matchedCandidateCount
          modelBackendKind
          modelId
          outputType
          policyAllowedPrivacy
          policyAllowedProviderIds
          policyBlockedProviderIds
          policyEnabled
          policyFeatureKind
          policyPreferredPrivacy
          policyWorkspaceId
          policyCandidates {
            allowed
            available
            candidateFingerprint
            candidateKey
            health
            healthCheckedAt
            privacy
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            reasons
          }
          protocol
          providerId
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerHealth
          providerHealthCheckedAt
          providerHealthLastError
          providerName
          providerPrivacy
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          reasons
          requestedModelId
          requestedModelSource
          requestLayer
          routeModelAliasMatched
          routeModelDefinitionAliases
          routeModelDefinitionId
          routeModelDefinitionSource
          modelRegistryRevision
          modelRegistryRevisionActorId
          modelRegistryRevisionFingerprint
          modelRegistryRevisionId
          modelRegistryRevisionScope
          modelRegistryRevisionSourceChain {
            actorId
            fingerprint
            modelId
            providerId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          modelRegistryRevisionSourceChainFingerprint
          modelRegistryRevisionStatus
          modelRegistryRevisionWorkspaceId
          routeRawModelId
          routeCandidates {
            candidateModelIds
            health
            healthCheckedAt
            matched
            modelId
            privacy
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerId
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            routeRawModelId
          }
          routeTrace {
            availableCount
            blockedCount
            candidateCount
            matchedCount
            phase
            preparedCount
            reasons
            selectedCount
          }
        }
        taskRoutes {
          behaviorFlags
          candidateCount
          canonicalModelKey
          configured
          diagnosticsErrors {
            code
            message
            stage
          }
          dimensionMismatch
          effectiveSourceFingerprint
          effectiveSourceFingerprintInputs
          effectiveSourceFingerprintVersion
          embeddingIndexContractDimensions
          embeddingIndexContractFingerprint
          embeddingIndexContractStatus
          embeddingIndexContractVersion
          errorCode
          errorMessage
          fallbackProviderIds
          featureKind
          modelBackendKind
          modelEmbeddingDimensions
          modelId
          policyAllowedPrivacy
          policyAllowedProviderIds
          policyBlockedProviderIds
          policyEnabled
          policyFeatureKind
          policyPreferredPrivacy
          policyWorkspaceId
          policyCandidates {
            allowed
            available
            health
            healthCheckedAt
            privacy
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerSource
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerType
            reasons
          }
          routeCandidates {
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            routeContextWindow
            routeEmbeddingDimensions
            routeMaxOutputTokens
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeInputTypes
            routeOutputTypes
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            matched
            modelId
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            providerPriority
            privacy
            health
            healthCheckedAt
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            routeRawModelId
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
          }
          routeTrace {
            availableCount
            blockedCount
            candidateCount
            matchedCount
            phase
            preparedCount
            reasons
            selectedCount
          }
          prepareCandidates {
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            routeContextWindow
            routeEmbeddingDimensions
            routeMaxOutputTokens
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeInputTypes
            routeOutputTypes
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            errorCategory
            errorCode
            health
            healthCheckedAt
            modelId
            prepared
            preparedModelId
            providerId
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            privacy
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            routeRawModelId
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelId
          }
          preparedProviderCount
          preparedRouteTargets
          preparedRouteTargetFingerprint
          preparedRoutes {
            behaviorFlags
            canonicalModelKey
            dimensionMismatch
            fallbackOrderIndex
            modelBackendKind
            modelEmbeddingDimensions
            modelId
            protocol
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerId
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            requestedDimensions
            requestLayer
            routeIndex
          }
          providerId
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          protocol
          rerankRuntimeContractFingerprint
          rerankRuntimeContractStatus
          rerankRuntimeContractTopK
          rerankRuntimeContractVersion
          requestedModelConfigKey
          requestedModelConfigPath
          requestedModelId
          requestedModelSource
          requestedDimensions
          requestLayer
          topK
        }
        name
        publishStatus
        reason
        registryFingerprint
        registryId
        registryUpdatedAt
        repairActionCatalog {
          actionKind
          catalogVersion
          inputSchema
          recommendationCount
          requiredCapabilities
          safety
        }
        repairActionCatalogFingerprint
        repairActionMutationGuard {
          auditSummary
          auditSummaryFingerprint
          catalogFingerprint
          catalogVersion
          expectedRegistryFingerprint
          expectedRegistryId
          expectedRegistryUpdatedAt
          guardFingerprint
          intentFingerprint
          inputSchemaFingerprint
          recommendationCategories
          recommendationCount
          recommendationCodes
          recommendationFingerprints
          requiredCapabilities
          requiredReviewModes
          required
          safetyLevels
          suggestedActionKinds
          targetLocatorCount
          targetLocatorFingerprint
          targetLocatorKinds
        }
        repairActionPreview {
          approvalCheckpoints
          approvalModes
          approvalPolicyFingerprint
          approvalPolicyVersion
          approvalRequired
          auditSummaryFingerprint
          authorizationFingerprint
          authorizationStatus
          candidateCount
          candidateEvidenceSetFingerprint
          taskRouteEffectiveSourceEvidenceSetFingerprint
          taskRouteEffectiveSourceEvidenceSetFingerprintInputs
          taskRouteEffectiveSourceEvidenceSetFingerprintVersion
          embeddingIndexContractEvidenceSetFingerprint
          rerankRuntimeContractEvidenceSetFingerprint
          preparedRouteOrderEvidenceSetFingerprint
          catalogFingerprint
          catalogVersion
          guardFingerprint
          operationFingerprints
          operationSetFingerprint
          operations {
            actionKind
            candidateEvidenceCount
            candidateEvidenceFingerprint
            candidateEvidenceFingerprints
            candidateEvidenceKeys
            category
            code
            diagnosticsFingerprint
            embeddingIndexContractEvidenceFingerprints
            rerankRuntimeContractEvidenceFingerprints
            taskRouteEffectiveSourceFingerprints
            inputSchema
            instanceKey
            operationFingerprint
            preparedRouteOrderFingerprints
            previewStatus
            requiredCapabilities
            reviewMode
            safety
            target
            targetLocator {
              actionId
              candidateIndex
              candidateKind
              fallbackOrderIndex
              featureKind
              kind
              outputType
              path
              providerId
              providerProfileConfigPath
              providerProfileId
              providerProfileSource
              registryFingerprint
              registryId
              registryUpdatedAt
              requestedModelConfigKey
              requestedModelConfigPath
              requestedModelId
              requestedModelSource
              routeIndex
              status
              stepId
            }
            targetLocatorFingerprint
          }
          previewFingerprint
          readOnly
          requiredCapabilities
          status
          submissionContract {
            approvalPolicyFingerprint
            authorizationFingerprint
            candidateEvidenceSetFingerprint
            taskRouteEffectiveSourceEvidenceSetFingerprint
            taskRouteEffectiveSourceEvidenceSetFingerprintInputs
            taskRouteEffectiveSourceEvidenceSetFingerprintVersion
            embeddingIndexContractEvidenceSetFingerprint
            rerankRuntimeContractEvidenceSetFingerprint
            preparedRouteOrderEvidenceSetFingerprint
            catalogFingerprint
            contractVersion
            expectedRegistryFingerprint
            expectedRegistryId
            expectedRegistryUpdatedAt
            guardFingerprint
            idempotencyKey
            mutationAvailable
            operationSetFingerprint
            previewFingerprint
            readOnly
            requiredInputs
            status
            submissionFingerprint
            targetLocatorFingerprint
          }
        }
        repairGateManifest {
          version
          boundary
          fingerprint
          registryFingerprint
          registryId
          registryUpdatedAt
          gateStatus
          publishStatus
          reason
          issueCount
          blockingCount
          recommendationCount
          operationCount
          guardFingerprint
          previewFingerprint
          submissionFingerprint
          candidateEvidenceSetFingerprint
          taskRouteEffectiveSourceEvidenceSetFingerprint
          taskRouteEffectiveSourceEvidenceSetFingerprintInputs
          taskRouteEffectiveSourceEvidenceSetFingerprintVersion
          embeddingIndexContractEvidenceSetFingerprint
          rerankRuntimeContractEvidenceSetFingerprint
          preparedRouteOrderEvidenceSetFingerprint
          operationSetFingerprint
          targetLocatorFingerprint
          approvalPolicyFingerprint
          authorizationFingerprint
          catalogFingerprint
          catalogVersion
          readOnly
          mutationAvailable
          requiredCapabilities
          requiredReviewModes
          safetyLevels
          operationFingerprints
          recommendationFingerprints
        }
        repairGateManifestExportMetadata {
          version
          artifact
          filename
          mime
          metadataFilename
          manifestVersion
          manifestFingerprint
          registryFingerprint
          registryId
          registryUpdatedAt
          gateStatus
          publishStatus
          boundary
          redactionPolicyVersion
          redactionPolicyStatus
          redactionPolicyFingerprint
          exportPolicyVersion
          exportPolicyStatus
          exportPolicyFingerprint
          auditEventVersion
          auditEventStatus
          auditEventCreated
          auditEventFingerprint
          retentionPolicyVersion
          retentionPolicyStatus
          retentionPolicyFingerprint
        }
        remediations {
          detail
          kind
          label
          target
          targetLocator {
            field
            messageIndex
            path
            registryFingerprint
            registryId
            registryUpdatedAt
            table
          }
        }
        repairRecommendations {
          candidateEvidence {
            allowed
            available
            candidateFingerprint
            candidateIndex
            candidateKey
            candidateModelIds
            costInputPer1M
            costOutputPer1M
            dimensionMismatch
            embeddingIndexContractDimensions
            embeddingIndexContractFingerprint
            embeddingIndexContractStatus
            embeddingIndexContractVersion
            diagnosticsErrors {
              code
              message
              stage
            }
            diagnosticsErrorSnapshotFingerprint
            errorCategory
            errorCode
            fallbackProviderIds
            health
            healthCheckedAt
            matched
            modelEmbeddingDimensions
            modelId
            prepared
            preparedModelId
            prepareCandidateSnapshotFingerprint
            preparedRouteOrderFingerprint
            preparedRouteSnapshotFingerprint
            preparedRoutes {
              behaviorFlags
              canonicalModelKey
              dimensionMismatch
              fallbackOrderIndex
              modelBackendKind
              modelEmbeddingDimensions
              modelId
              protocol
              providerConfiguredModelCount
              providerConfiguredModelIds
              providerId
              providerName
              providerPriority
              providerProfileConfigPath
              providerProfileId
              providerProfileSource
              providerSource
              providerType
              requestedDimensions
              requestLayer
              routeIndex
            }
            providerCapabilitySnapshotFingerprint
            providerCostSnapshotFingerprint
            providerHealthSnapshotFingerprint
            providerLimitSnapshotFingerprint
            rerankRuntimeContractFingerprint
            rerankRuntimeContractStatus
            rerankRuntimeContractTopK
            rerankRuntimeContractVersion
            taskRouteEmbeddingIndexContractSnapshotFingerprint
            taskRouteRerankRuntimeContractSnapshotFingerprint
            taskRouteDimensionSnapshotFingerprint
            taskRouteEffectiveSourceFingerprint
            taskRouteEffectiveSourceFingerprintInputs
            taskRouteEffectiveSourceFingerprintVersion
            taskRouteModelSourceSnapshotFingerprint
            preparedRouteTargets
            preparedRouteTargetFingerprint
            policyCandidates {
              allowed
              available
              health
              healthCheckedAt
              privacy
              providerConfiguredModelCount
              providerConfiguredModelIds
              providerId
              providerName
              providerPriority
              providerProfileConfigPath
              providerProfileId
              providerProfileSource
              providerSource
              providerType
              reasons
            }
            policyCandidateSnapshotFingerprint
            privacy
            providerConfiguredModelCount
            providerConfiguredModelIds
            providerId
            providerName
            providerPriority
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            providerSource
            providerType
            reasons
            registryAvailable
            registryKind
            registrySelected
            requestedModelConfigKey
            requestedModelConfigPath
            requestedDimensions
            requestedModelId
            requestedModelSource
            routeAttachmentAllowRemoteUrls
            routeAttachmentKinds
            routeAttachmentSourceKinds
            routeCandidateSnapshotFingerprint
            routeContextWindow
            routeEmbeddingDimensions
            routeInputTypes
            routeMaxOutputTokens
            routeModelAliasMatched
            routeModelDefinitionAliases
            routeModelDefinitionId
            routeModelDefinitionSource
            modelRegistryRevision
            modelRegistryRevisionActorId
            modelRegistryRevisionFingerprint
            modelRegistryRevisionId
            modelRegistryRevisionScope
            modelRegistryRevisionSourceChain {
              actorId
              fingerprint
              modelId
              providerId
              revision
              scope
              source
              status
              updatedAt
              workspaceId
            }
            modelRegistryRevisionSourceChainFingerprint
            modelRegistryRevisionStatus
            modelRegistryRevisionWorkspaceId
            routeOutputTypes
            routeRawModelId
            routeStructuredAttachmentAllowRemoteUrls
            routeStructuredAttachmentKinds
            routeStructuredAttachmentSourceKinds
            routeTrace {
              availableCount
              blockedCount
              candidateCount
              matchedCount
              phase
              preparedCount
              reasons
              selectedCount
            }
            routeTracePhases
            routeTraceSnapshotFingerprint
            scope
          }
          category
          code
          detail
          diagnosticsFingerprint
          evidence
          instanceKey
          severity
          suggestedAction
          suggestedActionCatalogVersion
          suggestedActionInputSchema
          suggestedActionKind
          suggestedActionRequiredCapabilities
          suggestedActionSafety
          target
          targetLocator {
            actionId
            candidateIndex
            candidateKind
            fallbackOrderIndex
            featureKind
            kind
            outputType
            path
            providerId
            providerProfileConfigPath
            providerProfileId
            providerProfileSource
            registryFingerprint
            registryId
            registryUpdatedAt
            requestedModelConfigKey
            requestedModelConfigPath
            requestedModelId
            requestedModelSource
            routeIndex
            status
            stepId
          }
          title
        }
        stale
        staleReasons
        status
      }
    }
  }
}`,
};

export const requestCopilotPromptRegistryRepairExecutionMutation = {
  id: 'requestCopilotPromptRegistryRepairExecutionMutation' as const,
  op: 'requestCopilotPromptRegistryRepairExecution',
  query: `mutation requestCopilotPromptRegistryRepairExecution($input: CopilotPromptRegistryRepairExecutionRequestInput!) {
  requestCopilotPromptRegistryRepairExecution(input: $input) {
    accepted
    approvalRecordRequestCreated
    approvalRecordRequestFingerprint
    approvalRecordRequestInputs
    approvalRecordRequestStatus
    approvalRecordRequestVersion
    auditEventRequestCreated
    auditEventRequestFingerprint
    auditEventRequestInputs
    auditEventRequestStatus
    auditEventRequestVersion
    expectedCandidateEvidenceSetFingerprint
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprint
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion
    expectedEmbeddingIndexContractEvidenceSetFingerprint
    expectedRerankRuntimeContractEvidenceSetFingerprint
    expectedPreparedRouteOrderEvidenceSetFingerprint
    expectedTargetLocatorFingerprint
    expectedRepairGateManifestFingerprint
    expectedRepairGateManifestExportPolicyFingerprint
    expectedRepairGateManifestRetentionPolicyFingerprint
    executionCompletionEventRequestCreated
    executionCompletionEventRequestFingerprint
    executionCompletionEventRequestInputs
    executionCompletionEventRequestStatus
    executionCompletionEventRequestVersion
    executionCompletionRequestCreated
    executionCompletionRequestFingerprint
    executionCompletionRequestInputs
    executionCompletionRequestStatus
    executionCompletionRequestVersion
    executionFinalizationEventRequestCreated
    executionFinalizationEventRequestFingerprint
    executionFinalizationEventRequestInputs
    executionFinalizationEventRequestStatus
    executionFinalizationEventRequestVersion
    executionFinalizationRequestCreated
    executionFinalizationRequestFingerprint
    executionFinalizationRequestInputs
    executionFinalizationRequestStatus
    executionFinalizationRequestVersion
    executionStatusPollRequestCreated
    executionStatusPollRequestFingerprint
    executionStatusPollRequestInputs
    executionStatusPollRequestStatus
    executionStatusPollRequestVersion
    executionOperationEntryRequestCreated
    executionOperationEntryRequestFingerprint
    executionOperationEntryRequestInputs
    executionOperationEntryRequestStatus
    executionOperationEntryRequestVersion
    executionApprovalUiRequestCreated
    executionApprovalUiRequestFingerprint
    executionApprovalUiRequestInputs
    executionApprovalUiRequestStatus
    executionApprovalUiRequestVersion
    executionDiffPreviewRequestCreated
    executionDiffPreviewRequestFingerprint
    executionDiffPreviewRequestInputs
    executionDiffPreviewRequestStatus
    executionDiffPreviewRequestVersion
    executionApprovalDecisionRequestCreated
    executionApprovalDecisionRequestFingerprint
    executionApprovalDecisionRequestInputs
    executionApprovalDecisionRequestStatus
    executionApprovalDecisionRequestVersion
    executionStartRequestCreated
    executionStartRequestFingerprint
    executionStartRequestInputs
    executionStartRequestStatus
    executionStartRequestVersion
    executionQueueRequestCreated
    executionQueueRequestFingerprint
    executionQueueRequestInputs
    executionQueueRequestStatus
    executionQueueRequestVersion
    executionWorkerLeaseRequestCreated
    executionWorkerLeaseRequestFingerprint
    executionWorkerLeaseRequestInputs
    executionWorkerLeaseRequestStatus
    executionWorkerLeaseRequestVersion
    executionJobRunRequestCreated
    executionJobRunRequestFingerprint
    executionJobRunRequestInputs
    executionJobRunRequestStatus
    executionJobRunRequestVersion
    executionRunStepRequestCreated
    executionRunStepRequestFingerprint
    executionRunStepRequestInputs
    executionRunStepRequestStatus
    executionRunStepRequestVersion
    executionRunStepTraceRequestCreated
    executionRunStepTraceRequestFingerprint
    executionRunStepTraceRequestInputs
    executionRunStepTraceRequestStatus
    executionRunStepTraceRequestVersion
    executionRunStepResultRequestCreated
    executionRunStepResultRequestFingerprint
    executionRunStepResultRequestInputs
    executionRunStepResultRequestStatus
    executionRunStepResultRequestVersion
    executionRunStepCompletionRequestCreated
    executionRunStepCompletionRequestFingerprint
    executionRunStepCompletionRequestInputs
    executionRunStepCompletionRequestStatus
    executionRunStepCompletionRequestVersion
    executionRunStepStatusEventRequestCreated
    executionRunStepStatusEventRequestFingerprint
    executionRunStepStatusEventRequestInputs
    executionRunStepStatusEventRequestStatus
    executionRunStepStatusEventRequestVersion
    executionRunStepRetryRequestCreated
    executionRunStepRetryRequestFingerprint
    executionRunStepRetryRequestInputs
    executionRunStepRetryRequestStatus
    executionRunStepRetryRequestVersion
    executionRunStepRetryAttemptRequestCreated
    executionRunStepRetryAttemptRequestFingerprint
    executionRunStepRetryAttemptRequestInputs
    executionRunStepRetryAttemptRequestStatus
    executionRunStepRetryAttemptRequestVersion
    executionRunStepRetryAttemptStatusEventRequestCreated
    executionRunStepRetryAttemptStatusEventRequestFingerprint
    executionRunStepRetryAttemptStatusEventRequestInputs
    executionRunStepRetryAttemptStatusEventRequestStatus
    executionRunStepRetryAttemptStatusEventRequestVersion
    executionRunStepRetryAttemptTraceRequestCreated
    executionRunStepRetryAttemptTraceRequestFingerprint
    executionRunStepRetryAttemptTraceRequestInputs
    executionRunStepRetryAttemptTraceRequestStatus
    executionRunStepRetryAttemptTraceRequestVersion
    executionRunStepRetryAttemptResultRequestCreated
    executionRunStepRetryAttemptResultRequestFingerprint
    executionRunStepRetryAttemptResultRequestInputs
    executionRunStepRetryAttemptResultRequestStatus
    executionRunStepRetryAttemptResultRequestVersion
    executionRunStepRetryAttemptCompletionRequestCreated
    executionRunStepRetryAttemptCompletionRequestFingerprint
    executionRunStepRetryAttemptCompletionRequestInputs
    executionRunStepRetryAttemptCompletionRequestStatus
    executionRunStepRetryAttemptCompletionRequestVersion
    executionRunStepRetryAttemptCompletionStatusEventRequestCreated
    executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint
    executionRunStepRetryAttemptCompletionStatusEventRequestInputs
    executionRunStepRetryAttemptCompletionStatusEventRequestStatus
    executionRunStepRetryAttemptCompletionStatusEventRequestVersion
    executionRunStepRetryAttemptFinalizationRequestCreated
    executionRunStepRetryAttemptFinalizationRequestFingerprint
    executionRunStepRetryAttemptFinalizationRequestInputs
    executionRunStepRetryAttemptFinalizationRequestStatus
    executionRunStepRetryAttemptFinalizationRequestVersion
    executionRunStepRetryAttemptFinalizationStatusEventRequestCreated
    executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint
    executionRunStepRetryAttemptFinalizationStatusEventRequestInputs
    executionRunStepRetryAttemptFinalizationStatusEventRequestStatus
    executionRunStepRetryAttemptFinalizationStatusEventRequestVersion
    executionRunStepRetryAttemptCloseRequestCreated
    executionRunStepRetryAttemptCloseRequestFingerprint
    executionRunStepRetryAttemptCloseRequestInputs
    executionRunStepRetryAttemptCloseRequestStatus
    executionRunStepRetryAttemptCloseRequestVersion
    executionRunStepRetryAttemptCloseStatusEventRequestCreated
    executionRunStepRetryAttemptCloseStatusEventRequestFingerprint
    executionRunStepRetryAttemptCloseStatusEventRequestInputs
    executionRunStepRetryAttemptCloseStatusEventRequestStatus
    executionRunStepRetryAttemptCloseStatusEventRequestVersion
    executionRunStepRetryAttemptRetentionPolicyRequestCreated
    executionRunStepRetryAttemptRetentionPolicyRequestFingerprint
    executionRunStepRetryAttemptRetentionPolicyRequestInputs
    executionRunStepRetryAttemptRetentionPolicyRequestStatus
    executionRunStepRetryAttemptRetentionPolicyRequestVersion
    executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated
    executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint
    executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs
    executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus
    executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion
    executionRunStepRetryAttemptRetentionLeaseRequestCreated
    executionRunStepRetryAttemptRetentionLeaseRequestFingerprint
    executionRunStepRetryAttemptRetentionLeaseRequestInputs
    executionRunStepRetryAttemptRetentionLeaseRequestStatus
    executionRunStepRetryAttemptRetentionLeaseRequestVersion
    executionRunStepRetryAttemptArchiveRequestCreated
    executionRunStepRetryAttemptArchiveRequestFingerprint
    executionRunStepRetryAttemptArchiveRequestInputs
    executionRunStepRetryAttemptArchiveRequestStatus
    executionRunStepRetryAttemptArchiveRequestVersion
    executionFailureEventRequestCreated
    executionFailureEventRequestFingerprint
    executionFailureEventRequestInputs
    executionFailureEventRequestStatus
    executionFailureEventRequestVersion
    executionProviderResponseRequestCreated
    executionProviderResponseRequestFingerprint
    executionProviderResponseRequestInputs
    executionProviderResponseRequestStatus
    executionProviderResponseRequestVersion
    executionResultRequestCreated
    executionResultRequestFingerprint
    executionResultRequestInputs
    executionResultRequestStatus
    executionResultRequestVersion
    executionRetryPolicyRequestCreated
    executionRetryPolicyRequestFingerprint
    executionRetryPolicyRequestInputs
    executionRetryPolicyRequestStatus
    executionRetryPolicyRequestVersion
    executionRollbackExecutorRequestCreated
    executionRollbackExecutorRequestFingerprint
    executionRollbackExecutorRequestInputs
    executionRollbackExecutorRequestStatus
    executionRollbackExecutorRequestVersion
    executionRollbackOperationRequestCreated
    executionRollbackOperationRequestFingerprint
    executionRollbackOperationRequestInputs
    executionRollbackOperationRequestStatus
    executionRollbackOperationRequestVersion
    executionRollbackOutcomeRequestCreated
    executionRollbackOutcomeRequestFingerprint
    executionRollbackOutcomeRequestInputs
    executionRollbackOutcomeRequestStatus
    executionRollbackOutcomeRequestVersion
    executionRollbackTriggerRequestCreated
    executionRollbackTriggerRequestFingerprint
    executionRollbackTriggerRequestInputs
    executionRollbackTriggerRequestStatus
    executionRollbackTriggerRequestVersion
    executionTraceRequestCreated
    executionTraceRequestFingerprint
    executionTraceRequestInputs
    executionTraceRequestStatus
    executionTraceRequestVersion
    executionStateRequestCreated
    executionStateRequestFingerprint
    executionStateRequestInputs
    executionStateRequestStatus
    executionStateRequestVersion
    executionRequested
    executionRecord {
      actorId
      approvalRecordFingerprint
      approvalState
      auditEventCount
      auditEvents {
        actorId
        createdAt
        eventFingerprint
        eventType
        executionRequestId
        id
        metadata
        workspaceId
      }
      auditEventFingerprint
      candidateEvidenceSetFingerprint
      completedAt
      createdAt
      failureCode
      failureMessage
      id
      idempotencyFingerprint
      idempotencyKey
      lastAttemptAt
      permissionStatus
      promptName
      queuedAt
      repairJobFingerprint
      requestFingerprint
      requestedAction
      runtimeResult {
        executor
        message
        sideEffectsApplied
        sideEffectFingerprint
        sideEffectKind
        sideEffectRecordId
        sideEffectSummary
        version
      }
      sideEffectCount
      sideEffects {
        actorId
        appliedAt
        createdAt
        executionRequestId
        executorPayloadFingerprint
        id
        sideEffectFingerprint
        sideEffectKind
        sideEffectRecordId
        sideEffectSummary
        workerAttempt
        workerLeaseId
        workspaceId
      }
      status
      targetLocatorFingerprint
      taskRouteEvidenceSetFingerprint
      updatedAt
      workerAttempt
      workerLeaseExpiresAt
      workerLeaseId
      workerMaxAttempts
      workspaceId
      agentRun {
        actorId
        completedAt
        createdAt
        evidenceFingerprint
        executionResultCount
        executionResults {
          actorId
          adapterWorkflow
          completedAt
          createdAt
          executor
          failureCode
          failureMessage
          id
          resultFingerprint
          resultPayload
          resultStatus
          runId
          sideEffectMode
          sideEffectsApplied
          sourceId
          sourceType
          summary
          workerAttempt
          workerLeaseId
          workflow
          workspaceId
        }
        failureCode
        failureMessage
        id
        lastAttemptAt
        queuedAt
        sourceId
        sourceType
        startedAt
        status
        targetFingerprint
        timelineFingerprint
        title
        updatedAt
        workerAttempt
        workerLeaseExpiresAt
        workerLeaseId
        workerMaxAttempts
        workflow
        workspaceId
        steps {
          actorId
          completedAt
          createdAt
          evidenceFingerprint
          id
          order
          outputSummary
          runId
          startedAt
          status
          stepKey
          stepType
          title
          updatedAt
          workspaceId
        }
        timelineEvents {
          actorId
          createdAt
          eventFingerprint
          eventType
          id
          ordinal
          payload
          runId
          status
          stepId
          summary
          workspaceId
        }
      }
    }
    idempotencyLockAcquired
    idempotencyLockFingerprint
    idempotencyLockInputs
    idempotencyLockScope
    idempotencyLockStatus
    idempotencyLockVersion
    matchedFields
    mismatchedFields
    mutationAvailable
    readOnly
    repairJobRequestCreated
    repairJobRequestFingerprint
    repairJobRequestInputs
    repairJobRequestStatus
    repairJobRequestVersion
    rollbackPlanRequestCreated
    rollbackPlanRequestFingerprint
    rollbackPlanRequestInputs
    rollbackPlanRequestStatus
    rollbackPlanRequestVersion
    requestFingerprint
    requestInputs
    requestStatus
    requestVersion
    supportBundleArtifactCreated
    supportBundleArtifactFingerprint
    supportBundleArtifactInputs
    supportBundleArtifactRecordRequestCreated
    supportBundleArtifactRecordRequestFingerprint
    supportBundleArtifactRecordRequestInputs
    supportBundleArtifactRecordRequestStatus
    supportBundleArtifactRecordRequestVersion
    supportBundleArtifactStatus
    supportBundleArtifactVersion
    supportBundleArchiveFormat
    supportBundleArchiveRequestCreated
    supportBundleArchiveRequestFingerprint
    supportBundleArchiveRequestInputs
    supportBundleArchiveRequestStatus
    supportBundleArchiveRequestVersion
    supportBundleArchiveScope
    supportBundleArchiveSignaturePolicy
    supportBundleArchiveSignatureRequestCreated
    supportBundleArchiveSignatureRequestFingerprint
    supportBundleArchiveSignatureRequestInputs
    supportBundleArchiveSignatureRequestStatus
    supportBundleArchiveSignatureRequestVersion
    supportBundleAuditPersistenceRequestCreated
    supportBundleAuditPersistenceRequestFingerprint
    supportBundleAuditPersistenceRequestInputs
    supportBundleAuditPersistenceRequestStatus
    supportBundleAuditPersistenceRequestVersion
    supportBundleAuditPersistenceStatus
    supportBundleDownloadAuthorizationRequestCreated
    supportBundleDownloadAuthorizationRequestFingerprint
    supportBundleDownloadAuthorizationRequestInputs
    supportBundleDownloadAuthorizationRequestStatus
    supportBundleDownloadAuthorizationRequestVersion
    supportBundleDownloadAuthorizationStatus
    supportBundleDownloadResolverRequestCreated
    supportBundleDownloadResolverRequestFingerprint
    supportBundleDownloadResolverRequestInputs
    supportBundleDownloadResolverRequestStatus
    supportBundleDownloadResolverRequestVersion
    supportBundleDownloadResolverRoute
    supportBundleManifestFilename
    supportBundleManifestFingerprint
    supportBundleManifestMetadataFilename
    supportBundleManifestMetadataFingerprint
    supportBundlePackageCreated
    supportBundlePackageFingerprint
    supportBundlePackageInputs
    supportBundlePackageStatus
    supportBundlePackageVersion
    supportBundleRetentionCleanupRequestCreated
    supportBundleRetentionCleanupRequestFingerprint
    supportBundleRetentionCleanupRequestInputs
    supportBundleRetentionCleanupRequestStatus
    supportBundleRetentionCleanupRequestVersion
    supportBundleRetentionCleanupStatus
    supportBundleSignedUrlPolicy
    supportBundleSignedUrlRequestCreated
    supportBundleSignedUrlRequestFingerprint
    supportBundleSignedUrlRequestInputs
    supportBundleSignedUrlRequestStatus
    supportBundleSignedUrlRequestVersion
    supportBundleSignedUrlScope
    supportBundleStorageKeyRequestCreated
    supportBundleStorageKeyRequestFingerprint
    supportBundleStorageKeyRequestInputs
    supportBundleStorageKeyRequestStatus
    supportBundleStorageKeyRequestVersion
    supportBundleStorageKeyScope
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint
    supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints
    supportBundleTaskRouteEffectiveSourceEvidenceSetEntries {
      candidateEvidenceCategoryCount
      candidateEvidenceCategories
      candidateEvidenceCount
      candidateEvidenceReferenceSchemaArtifactFingerprint
      candidateEvidenceReferenceSchemaArtifactFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs
      candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus
      candidateEvidenceReferenceSchemaArtifactRecordStorageStatus
      candidateEvidenceReferenceSchemaArtifactRecordStatus
      candidateEvidenceReferenceSchemaArtifactStatus
      candidateEvidenceReferenceSchemaFields
      candidateEvidenceReferenceSchemaFingerprint
      candidateEvidenceReferenceSchemaFingerprintInputs
      candidateEvidenceReferenceSchemaRegistryStatus
      candidateEvidenceReferenceSchemaVersion
      candidateEvidenceEntries {
        candidateEvidenceCategory
        candidateEvidenceFingerprint
        candidateEvidenceKey
        candidateEvidenceProviderId
        candidateEvidenceScope
        candidateIndex
        preparedRouteOrderFingerprint
        preparedRouteEntries {
          behaviorFlags
          canonicalModelKey
          dimensionMismatch
          fallbackOrderIndex
          modelBackendKind
          modelEmbeddingDimensions
          modelId
          protocol
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerId
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          requestedDimensions
          requestLayer
          routeIndex
        }
        policyCandidateEntries {
          allowed
          available
          health
          healthCheckedAt
          privacy
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerId
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          registryAvailable
          registryKind
          registrySelected
          reasons
        }
        prepareCandidateEntries {
          candidateKey
          candidateModelIds
          costInputPer1M
          costOutputPer1M
          routeContextWindow
          routeEmbeddingDimensions
          routeMaxOutputTokens
          routeAttachmentAllowRemoteUrls
          routeAttachmentKinds
          routeAttachmentSourceKinds
          routeInputTypes
          routeOutputTypes
          routeStructuredAttachmentAllowRemoteUrls
          routeStructuredAttachmentKinds
          routeStructuredAttachmentSourceKinds
          errorCategory
          errorCode
          health
          healthCheckedAt
          modelId
          prepared
          preparedModelId
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerId
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          privacy
          reasons
          routeModelAliasMatched
          routeModelDefinitionAliases
          routeModelDefinitionId
          routeModelDefinitionSource
          modelRegistryRevision
          modelRegistryRevisionActorId
          modelRegistryRevisionFingerprint
          modelRegistryRevisionId
          modelRegistryRevisionScope
          modelRegistryRevisionSourceChain {
            actorId
            fingerprint
            modelId
            providerId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          modelRegistryRevisionSourceChainFingerprint
          modelRegistryRevisionStatus
          modelRegistryRevisionWorkspaceId
          routeRawModelId
          registryAvailable
          registryKind
          registrySelected
          requestedModelId
        }
        routeCandidateEntries {
          candidateModelIds
          costInputPer1M
          costOutputPer1M
          health
          healthCheckedAt
          matched
          modelId
          privacy
          providerConfiguredModelCount
          providerConfiguredModelIds
          providerId
          providerName
          providerPriority
          providerProfileConfigPath
          providerProfileId
          providerProfileSource
          providerSource
          providerType
          reasons
          registryAvailable
          registryKind
          registrySelected
          requestedModelId
          routeAttachmentAllowRemoteUrls
          routeAttachmentKinds
          routeAttachmentSourceKinds
          routeContextWindow
          routeEmbeddingDimensions
          routeInputTypes
          routeMaxOutputTokens
          routeModelAliasMatched
          routeModelDefinitionAliases
          routeModelDefinitionId
          routeModelDefinitionSource
          modelRegistryRevision
          modelRegistryRevisionActorId
          modelRegistryRevisionFingerprint
          modelRegistryRevisionId
          modelRegistryRevisionScope
          modelRegistryRevisionSourceChain {
            actorId
            fingerprint
            modelId
            providerId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          modelRegistryRevisionSourceChainFingerprint
          modelRegistryRevisionStatus
          modelRegistryRevisionWorkspaceId
          routeOutputTypes
          routeRawModelId
          routeStructuredAttachmentAllowRemoteUrls
          routeStructuredAttachmentKinds
          routeStructuredAttachmentSourceKinds
        }
        taskRouteEffectiveSourceFingerprint
        taskRouteModelSourceSnapshotEntries {
          featureKind
          requestedModelConfigKey
          requestedModelConfigPath
          requestedModelId
          requestedModelSource
        }
        taskRouteModelSourceSnapshotFingerprint
      }
      candidateEvidenceFingerprint
      candidateEvidenceFingerprints
      candidateEvidenceKeys
      candidateEvidenceProviderIds
      candidateEvidenceScopes
      diagnosticsFingerprint
      operationFingerprint
      taskRouteEffectiveSourceFingerprints
    }
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs
    supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints
    supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion
    preflight {
      approvalRecordFingerprint
      approvalRequestFingerprint
      auditEventFingerprint
      candidateEvidenceSetFingerprint
      taskRouteEffectiveSourceEvidenceSetFingerprint
      taskRouteEffectiveSourceEvidenceSetFingerprintInputs
      taskRouteEffectiveSourceEvidenceSetFingerprintVersion
      embeddingIndexContractEvidenceSetFingerprint
      rerankRuntimeContractEvidenceSetFingerprint
      preparedRouteOrderEvidenceSetFingerprint
      executionGateFingerprint
      executionGateStatus
      executionStateFingerprint
      idempotencyFingerprint
      policyBindingFingerprint
      repairJobFingerprint
      reviewBindingFingerprint
      rollbackPlanFingerprint
      status
      expectedTaskRouteEffectiveSourceEvidenceSetFingerprint
      expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs
      expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion
      expectedEmbeddingIndexContractEvidenceSetFingerprint
      expectedRerankRuntimeContractEvidenceSetFingerprint
      expectedPreparedRouteOrderEvidenceSetFingerprint
      expectedTargetLocatorFingerprint
      targetLocatorFingerprint
      workspaceId
    }
  }
}`,
};

export const getCopilotPromptRegistryRepairPreflightQuery = {
  id: 'getCopilotPromptRegistryRepairPreflightQuery' as const,
  op: 'getCopilotPromptRegistryRepairPreflight',
  query: `query getCopilotPromptRegistryRepairPreflight($workspaceId: String, $name: String!, $expectedVersion: CopilotPromptRegistryPublishGateExpectedVersionInput, $submission: CopilotPromptRegistryRepairSubmissionInput!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      promptRegistryRepairPreflight(
        name: $name
        expectedVersion: $expectedVersion
        submission: $submission
      ) {
        accepted
        actorFingerprint
        actorSnapshotInputs
        actorSnapshotStatus
        actorSnapshotVersion
        actorType
        approvalCheckpoints
        approvalModes
        approvalRecordCreated
        approvalRecordFingerprint
        approvalRecordInputs
        approvalRecordStatus
        approvalRecordVersion
        approvalRequestFingerprint
        approvalRequestInputs
        approvalRequestStatus
        approvalRequestVersion
        approvalRequired
        auditBindingFingerprint
        auditBindingInputs
        auditBindingStatus
        auditBindingVersion
        auditEventCreated
        auditEventFingerprint
        auditEventInputs
        auditEventStatus
        auditEventVersion
        authorizationStatus
        candidateEvidenceSetFingerprint
        taskRouteEffectiveSourceEvidenceSetFingerprint
        taskRouteEffectiveSourceEvidenceSetFingerprintInputs
        taskRouteEffectiveSourceEvidenceSetFingerprintVersion
        embeddingIndexContractEvidenceSetFingerprint
        rerankRuntimeContractEvidenceSetFingerprint
        preparedRouteOrderEvidenceSetFingerprint
        capabilityCheckMode
        capabilityFingerprint
        capabilitySource
        capabilityStatus
        contractVersion
        currentSubmissionFingerprint
        expectedSubmissionFingerprint
        executionGateFingerprint
        executionGateInputs
        executionGateStatus
        executionGateVersion
        executionStateCreated
        executionStateFingerprint
        executionStateInputs
        executionStateStatus
        executionStateVersion
        expectedCandidateEvidenceSetFingerprint
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprint
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion
        expectedEmbeddingIndexContractEvidenceSetFingerprint
        expectedRerankRuntimeContractEvidenceSetFingerprint
        expectedPreparedRouteOrderEvidenceSetFingerprint
        expectedTargetLocatorFingerprint
        idempotencyFingerprint
        idempotencyKey
        idempotencyLockAcquired
        idempotencyScope
        idempotencyStatus
        idempotencyVersion
        matchedFields
        mismatchedFields
        mutationAvailable
        permissionCheckMode
        permissionChecked
        permissionFingerprint
        permissionScope
        permissionStatus
        policyBindingFingerprint
        policyBindingInputs
        policyBindingStatus
        policyBindingVersion
        policySource
        requiredCapabilities
        requiredCapabilityCount
        requiredPermission
        repairJobCreated
        repairJobFingerprint
        repairJobInputs
        repairJobStatus
        repairJobVersion
        reviewBindingFingerprint
        reviewBindingInputs
        reviewBindingStatus
        reviewBindingVersion
        rollbackPlanCreated
        rollbackPlanFingerprint
        rollbackPlanInputs
        rollbackPlanStatus
        rollbackPlanVersion
        readOnly
        status
        targetLocatorFingerprint
        workspaceId
      }
    }
  }
}`,
};

export const getCopilotPromptsQuery = {
  id: 'getCopilotPromptsQuery' as const,
  op: 'getCopilotPrompts',
  query: `query getCopilotPrompts($workspaceId: String) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      prompts {
        action
        category
        defaultPolicy
        fingerprint
        modelStrategyFingerprint
        model
        modelConfigPath
        modelSource
        name
        optionalModelsConfigPath
        optionalModelCount
        optionalModels
        optionalModelsSource
        overrideApplied
        paramCount
        paramKeys
        proModelsConfigPath
        proModelCount
        proModelsSource
        registryFingerprint
        registryId
        registryMessageCount
        registryModified
        registryUpdatedAt
        registryValidationBlockingCount
        registryValidationDetail
        registryValidationErrorCount
        registryValidationIssueCount
        registryValidationIssues {
          code
          detail
          fieldLabel
          message
          messageIndex
          path
          publishBlocking
          reason
          severity
          source
          sourceLocator {
            field
            messageIndex
            path
            registryFingerprint
            registryId
            registryUpdatedAt
            table
          }
        }
        registryValidationPublishStatus
        registryValidationRemediations {
          detail
          kind
          label
          target
          targetLocator {
            field
            messageIndex
            path
            registryFingerprint
            registryId
            registryUpdatedAt
            table
          }
        }
        registryValidationReason
        registryValidationStatus
        registryRecordSource
        registryRevision
        registryRevisionActorId
        registryRevisionFingerprint
        registryRevisionId
        registryRevisionPublishEventCount
        registryRevisionPublishEvents {
          actorId
          createdAt
          eventFingerprint
          eventType
          id
          metadata
          publishSource
          registryFamily
          registryKey
          registryModelId
          registryProviderId
          revision
          revisionFingerprint
          revisionId
          revisionStatus
          scopeType
          workspaceId
        }
        registryRevisionScope
        registryRevisionStatus
        registryRevisionWorkspaceId
        registrySourceChain {
          actorId
          configPath
          fingerprint
          registryId
          revision
          scope
          source
          status
          updatedAt
          workspaceId
        }
        registrySourceChainFingerprint
        revision
        source
        templateFingerprint
        versionEvidence {
          defaultPolicy
          fingerprint
          modelConfigPath
          modelStrategyFingerprint
          optionalModelsConfigPath
          overrideApplied
          proModelsConfigPath
          registryFingerprint
          registryId
          registryMessageCount
          registryModified
          registryUpdatedAt
          registryValidationBlockingCount
          registryValidationDetail
          registryValidationErrorCount
          registryValidationIssueCount
          registryValidationIssues {
            code
            detail
            fieldLabel
            message
            messageIndex
            path
            publishBlocking
            reason
            severity
            source
            sourceLocator {
              field
              messageIndex
              path
              registryFingerprint
              registryId
              registryUpdatedAt
              table
            }
          }
          registryValidationPublishStatus
          registryValidationRemediations {
            detail
            kind
            label
            target
            targetLocator {
              field
              messageIndex
              path
              registryFingerprint
              registryId
              registryUpdatedAt
              table
            }
          }
          registryValidationReason
          registryValidationStatus
          registryRecordSource
          registryRevision
          registryRevisionActorId
          registryRevisionFingerprint
          registryRevisionId
          registryRevisionPublishEventCount
          registryRevisionPublishEvents {
            actorId
            createdAt
            eventFingerprint
            eventType
            id
            metadata
            publishSource
            registryFamily
            registryKey
            registryModelId
            registryProviderId
            revision
            revisionFingerprint
            revisionId
            revisionStatus
            scopeType
            workspaceId
          }
          registryRevisionScope
          registryRevisionStatus
          registryRevisionWorkspaceId
          registrySourceChain {
            actorId
            configPath
            fingerprint
            registryId
            revision
            scope
            source
            status
            updatedAt
            workspaceId
          }
          registrySourceChainFingerprint
          revision
          templateFingerprint
        }
      }
    }
  }
}`,
};

export const retryCopilotProviderHealthProbeAttemptMutation = {
  id: 'retryCopilotProviderHealthProbeAttemptMutation' as const,
  op: 'retryCopilotProviderHealthProbeAttempt',
  query: `mutation retryCopilotProviderHealthProbeAttempt($input: CopilotProviderHealthProbeAttemptRetryInput!) {
  retryCopilotProviderHealthProbeAttempt(input: $input) {
    id
    providerId
    providerType
    scopeType
    workspaceId
    actorId
    providerRegistryRevisionId
    providerRegistryRevisionFingerprint
    providerProfileSource
    providerProfileFingerprint
    providerProfileSnapshot
    requestFingerprint
    status
    attemptCount
    maxAttempts
    scheduledAt
    workerLeaseId
    workerLeaseExpiresAt
    checkedAt
    completedAt
    deadLetteredAt
    failureCode
    failureMessage
    resultStatus
    resultLastError
    resultMetadata
    resultFingerprint
    providerHealthStateId
    providerHealthStateFingerprint
    createdAt
    updatedAt
  }
}`,
};

export const getCopilotProviderHealthProbeAttemptsQuery = {
  id: 'getCopilotProviderHealthProbeAttemptsQuery' as const,
  op: 'getCopilotProviderHealthProbeAttempts',
  query: `query getCopilotProviderHealthProbeAttempts($workspaceId: String!, $limit: SafeInt, $filter: CopilotProviderHealthProbeAttemptFilterInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      providerHealthProbeAttempts(filter: $filter, limit: $limit) {
        id
        providerId
        providerType
        scopeType
        workspaceId
        actorId
        providerRegistryRevisionId
        providerRegistryRevisionFingerprint
        providerProfileSource
        providerProfileFingerprint
        providerProfileSnapshot
        requestFingerprint
        status
        attemptCount
        maxAttempts
        scheduledAt
        workerLeaseId
        workerLeaseExpiresAt
        checkedAt
        completedAt
        deadLetteredAt
        failureCode
        failureMessage
        resultStatus
        resultLastError
        resultMetadata
        resultFingerprint
        providerHealthStateId
        providerHealthStateFingerprint
        createdAt
        updatedAt
      }
    }
  }
}`,
};

export const copilotQuotaQuery = {
  id: 'copilotQuotaQuery' as const,
  op: 'copilotQuota',
  query: `query copilotQuota {
  currentUser {
    copilot {
      quota {
        limit
        used
      }
    }
  }
}`,
};

export const decideCopilotRepairExecutionApprovalMutation = {
  id: 'decideCopilotRepairExecutionApprovalMutation' as const,
  op: 'decideCopilotRepairExecutionApproval',
  query: `mutation decideCopilotRepairExecutionApproval($input: CopilotRepairExecutionApprovalDecisionInput!) {
  decideCopilotRepairExecutionApproval(input: $input) {
    actorId
    approvalRecordFingerprint
    approvalState
    auditEventCount
    auditEvents {
      actorId
      createdAt
      eventFingerprint
      eventType
      executionRequestId
      id
      metadata
      workspaceId
    }
    auditEventFingerprint
    candidateEvidenceSetFingerprint
    completedAt
    createdAt
    failureCode
    failureMessage
    id
    idempotencyFingerprint
    idempotencyKey
    lastAttemptAt
    permissionStatus
    promptName
    queuedAt
    repairJobFingerprint
    requestFingerprint
    requestedAction
    runtimeResult {
      executor
      message
      sideEffectsApplied
      sideEffectFingerprint
      sideEffectKind
      sideEffectRecordId
      sideEffectSummary
      version
    }
    sideEffectCount
    sideEffects {
      actorId
      appliedAt
      createdAt
      executionRequestId
      executorPayloadFingerprint
      id
      sideEffectFingerprint
      sideEffectKind
      sideEffectRecordId
      sideEffectSummary
      workerAttempt
      workerLeaseId
      workspaceId
    }
    status
    targetLocatorFingerprint
    taskRouteEvidenceSetFingerprint
    updatedAt
    workerAttempt
    workerLeaseExpiresAt
    workerLeaseId
    workerMaxAttempts
    workspaceId
    agentRun {
      actorId
      completedAt
      createdAt
      evidenceFingerprint
      executionResultCount
      executionResults {
        actorId
        adapterWorkflow
        completedAt
        createdAt
        executor
        failureCode
        failureMessage
        id
        resultFingerprint
        resultPayload
        resultStatus
        runId
        sideEffectMode
        sideEffectsApplied
        sourceId
        sourceType
        summary
        workerAttempt
        workerLeaseId
        workflow
        workspaceId
      }
      failureCode
      failureMessage
      id
      lastAttemptAt
      queuedAt
      sourceId
      sourceType
      startedAt
      status
      targetFingerprint
      timelineFingerprint
      title
      updatedAt
      workerAttempt
      workerLeaseExpiresAt
      workerLeaseId
      workerMaxAttempts
      workflow
      workspaceId
      steps {
        actorId
        completedAt
        createdAt
        evidenceFingerprint
        id
        order
        outputSummary
        runId
        startedAt
        status
        stepKey
        stepType
        title
        updatedAt
        workspaceId
      }
      timelineEvents {
        actorId
        createdAt
        eventFingerprint
        eventType
        id
        ordinal
        payload
        runId
        status
        stepId
        summary
        workspaceId
      }
    }
  }
}`,
};

export const controlCopilotRepairExecutionMutation = {
  id: 'controlCopilotRepairExecutionMutation' as const,
  op: 'controlCopilotRepairExecution',
  query: `mutation controlCopilotRepairExecution($input: CopilotRepairExecutionControlInput!) {
  controlCopilotRepairExecution(input: $input) {
    actorId
    approvalRecordFingerprint
    approvalState
    auditEventCount
    auditEvents {
      actorId
      createdAt
      eventFingerprint
      eventType
      executionRequestId
      id
      metadata
      workspaceId
    }
    auditEventFingerprint
    candidateEvidenceSetFingerprint
    completedAt
    createdAt
    failureCode
    failureMessage
    id
    idempotencyFingerprint
    idempotencyKey
    lastAttemptAt
    permissionStatus
    promptName
    queuedAt
    repairJobFingerprint
    requestFingerprint
    requestedAction
    runtimeResult {
      executor
      message
      sideEffectsApplied
      sideEffectFingerprint
      sideEffectKind
      sideEffectRecordId
      sideEffectSummary
      version
    }
    sideEffectCount
    sideEffects {
      actorId
      appliedAt
      createdAt
      executionRequestId
      executorPayloadFingerprint
      id
      sideEffectFingerprint
      sideEffectKind
      sideEffectRecordId
      sideEffectSummary
      workerAttempt
      workerLeaseId
      workspaceId
    }
    status
    targetLocatorFingerprint
    taskRouteEvidenceSetFingerprint
    updatedAt
    workerAttempt
    workerLeaseExpiresAt
    workerLeaseId
    workerMaxAttempts
    workspaceId
    agentRun {
      actorId
      completedAt
      createdAt
      evidenceFingerprint
      executionResultCount
      executionResults {
        actorId
        adapterWorkflow
        completedAt
        createdAt
        executor
        failureCode
        failureMessage
        id
        resultFingerprint
        resultPayload
        resultStatus
        runId
        sideEffectMode
        sideEffectsApplied
        sourceId
        sourceType
        summary
        workerAttempt
        workerLeaseId
        workflow
        workspaceId
      }
      failureCode
      failureMessage
      id
      lastAttemptAt
      queuedAt
      sourceId
      sourceType
      startedAt
      status
      targetFingerprint
      timelineFingerprint
      title
      updatedAt
      workerAttempt
      workerLeaseExpiresAt
      workerLeaseId
      workerMaxAttempts
      workflow
      workspaceId
      steps {
        actorId
        completedAt
        createdAt
        evidenceFingerprint
        id
        order
        outputSummary
        runId
        startedAt
        status
        stepKey
        stepType
        title
        updatedAt
        workspaceId
      }
      timelineEvents {
        actorId
        createdAt
        eventFingerprint
        eventType
        id
        ordinal
        payload
        runId
        status
        stepId
        summary
        workspaceId
      }
    }
  }
}`,
};

export const getCopilotRepairExecutionsQuery = {
  id: 'getCopilotRepairExecutionsQuery' as const,
  op: 'getCopilotRepairExecutions',
  query: `query getCopilotRepairExecutions($workspaceId: String!, $limit: SafeInt, $filter: CopilotRepairExecutionListFilterInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      repairExecutions(filter: $filter, limit: $limit) {
        actorId
        approvalRecordFingerprint
        approvalState
        auditEventCount
        auditEvents {
          actorId
          createdAt
          eventFingerprint
          eventType
          executionRequestId
          id
          metadata
          workspaceId
        }
        auditEventFingerprint
        candidateEvidenceSetFingerprint
        completedAt
        createdAt
        failureCode
        failureMessage
        id
        idempotencyFingerprint
        idempotencyKey
        lastAttemptAt
        permissionStatus
        promptName
        queuedAt
        repairJobFingerprint
        requestFingerprint
        requestedAction
        runtimeResult {
          executor
          message
          sideEffectsApplied
          sideEffectFingerprint
          sideEffectKind
          sideEffectRecordId
          sideEffectSummary
          version
        }
        sideEffectCount
        sideEffects {
          actorId
          appliedAt
          createdAt
          executionRequestId
          executorPayloadFingerprint
          id
          sideEffectFingerprint
          sideEffectKind
          sideEffectRecordId
          sideEffectSummary
          workerAttempt
          workerLeaseId
          workspaceId
        }
        status
        targetLocatorFingerprint
        taskRouteEvidenceSetFingerprint
        updatedAt
        workerAttempt
        workerLeaseExpiresAt
        workerLeaseId
        workerMaxAttempts
        workspaceId
        agentRun {
          actorId
          completedAt
          createdAt
          evidenceFingerprint
          executionResultCount
          executionResults {
            actorId
            adapterWorkflow
            completedAt
            createdAt
            executor
            failureCode
            failureMessage
            id
            resultFingerprint
            resultPayload
            resultStatus
            runId
            sideEffectMode
            sideEffectsApplied
            sourceId
            sourceType
            summary
            workerAttempt
            workerLeaseId
            workflow
            workspaceId
          }
          failureCode
          failureMessage
          id
          lastAttemptAt
          queuedAt
          sourceId
          sourceType
          startedAt
          status
          targetFingerprint
          timelineFingerprint
          title
          updatedAt
          workerAttempt
          workerLeaseExpiresAt
          workerLeaseId
          workerMaxAttempts
          workflow
          workspaceId
          steps {
            actorId
            completedAt
            createdAt
            evidenceFingerprint
            id
            order
            outputSummary
            runId
            startedAt
            status
            stepKey
            stepType
            title
            updatedAt
            workspaceId
          }
          timelineEvents {
            actorId
            createdAt
            eventFingerprint
            eventType
            id
            ordinal
            payload
            runId
            status
            stepId
            summary
            workspaceId
          }
        }
      }
    }
  }
}`,
};

export const cleanupCopilotSessionMutation = {
  id: 'cleanupCopilotSessionMutation' as const,
  op: 'cleanupCopilotSession',
  query: `mutation cleanupCopilotSession($input: DeleteSessionInput!) {
  cleanupCopilotSession(options: $input)
}`,
};

export const createCopilotSessionWithHistoryMutation = {
  id: 'createCopilotSessionWithHistoryMutation' as const,
  op: 'createCopilotSessionWithHistory',
  query: `mutation createCopilotSessionWithHistory($options: CreateChatSessionInput!) {
  createCopilotSessionWithHistory(options: $options) {
    ...CopilotChatHistory
  }
}
${copilotChatHistoryFragment}`,
};

export const createCopilotSessionMutation = {
  id: 'createCopilotSessionMutation' as const,
  op: 'createCopilotSession',
  query: `mutation createCopilotSession($options: CreateChatSessionInput!) {
  createCopilotSession(options: $options)
}`,
  deprecations: ["'createCopilotSession' is deprecated: use `createCopilotSessionWithHistory` instead"],
};

export const forkCopilotSessionMutation = {
  id: 'forkCopilotSessionMutation' as const,
  op: 'forkCopilotSession',
  query: `mutation forkCopilotSession($options: ForkChatSessionInput!) {
  forkCopilotSession(options: $options)
}`,
};

export const getCopilotLatestDocSessionQuery = {
  id: 'getCopilotLatestDocSessionQuery' as const,
  op: 'getCopilotLatestDocSession',
  query: `query getCopilotLatestDocSession($workspaceId: String!, $docId: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(
        pagination: {first: 1}
        docId: $docId
        options: {sessionOrder: desc, action: false, fork: false, withMessages: true}
      ) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const getCopilotSessionQuery = {
  id: 'getCopilotSessionQuery' as const,
  op: 'getCopilotSession',
  query: `query getCopilotSession($workspaceId: String!, $sessionId: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(pagination: {first: 1}, options: {sessionId: $sessionId}) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const getCopilotRecentSessionsQuery = {
  id: 'getCopilotRecentSessionsQuery' as const,
  op: 'getCopilotRecentSessions',
  query: `query getCopilotRecentSessions($workspaceId: String!, $limit: Int = 10, $offset: Int = 0) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(
        pagination: {first: $limit, offset: $offset}
        options: {action: false, fork: false, sessionOrder: desc, withMessages: false}
      ) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const updateCopilotSessionMutation = {
  id: 'updateCopilotSessionMutation' as const,
  op: 'updateCopilotSession',
  query: `mutation updateCopilotSession($options: UpdateChatSessionInput!) {
  updateCopilotSession(options: $options)
}`,
};

export const getCopilotSessionsQuery = {
  id: 'getCopilotSessionsQuery' as const,
  op: 'getCopilotSessions',
  query: `query getCopilotSessions($workspaceId: String!, $pagination: PaginationInput!, $docId: String, $options: QueryChatHistoriesInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      chats(pagination: $pagination, docId: $docId, options: $options) {
        ...PaginatedCopilotChats
      }
    }
  }
}
${paginatedCopilotChatsFragment}`,
};

export const createCopilotSupportBundleMutation = {
  id: 'createCopilotSupportBundleMutation' as const,
  op: 'createCopilotSupportBundle',
  query: `mutation createCopilotSupportBundle($input: CopilotSupportBundleCreateInput!) {
  createCopilotSupportBundle(input: $input) {
    actorId
    archiveByteSize
    archiveFilename
    archiveFingerprint
    archiveMime
    archiveStorageKey
    auditEventCount
    auditEvents {
      actorId
      bundleId
      createdAt
      eventFingerprint
      eventType
      id
      metadata
      workspaceId
    }
    createdAt
    expiresAt
    failureCode
    failureMessage
    id
    manifestByteSize
    manifestFilename
    manifestFingerprint
    manifestMime
    manifestStorageKey
    manifestJson {
      actorId
      archive
      bundleId
      createdAt
      expiresAt
      retention {
        expiresAt
        status
      }
      sourceEvidenceSetFingerprint
      sourceEvidenceSummary {
        actionRunCount
        includedSections
        promptCatalogItemCount
        source
        taskRouteCount
      }
      version
      workspaceId
    }
    retentionStatus
    sourceEvidenceSetFingerprint
    sourceEvidenceSummary {
      actionRunCount
      includedSections
      promptCatalogItemCount
      source
      taskRouteCount
    }
    status
    transferEventCount
    transferEvents {
      artifactFingerprint
      artifactKind
      authorizationFingerprint
      authorizationId
      createdAt
      deliveryMethod
      eventFingerprint
      eventId
      eventSource
      id
      manifestFingerprint
      notificationAuthEvidenceFingerprint
      storageByteSize
      storageContentType
      storageKey
      transferredAt
    }
    transferForwardingEventCount
    transferForwardingEvents {
      attemptCount
      authorizationId
      createdAt
      deadLetteredAt
      eventId
      eventSource
      failureCode
      failureMessage
      forwardedAt
      forwardedTransferEventFingerprint
      forwardingEventFingerprint
      forwardingPayload
      forwardingPayloadFingerprint
      id
      lastAttemptAt
      maxAttempts
      nextAttemptAt
      providerSignatureEvidenceFingerprint
      status
      updatedAt
      workerLeaseExpiresAt
      workerLeaseId
    }
    updatedAt
    workspaceId
  }
}`,
};

export const acknowledgeCopilotSupportBundleDirectDownloadMutation = {
  id: 'acknowledgeCopilotSupportBundleDirectDownloadMutation' as const,
  op: 'acknowledgeCopilotSupportBundleDirectDownload',
  query: `mutation acknowledgeCopilotSupportBundleDirectDownload($input: CopilotSupportBundleDirectDownloadAcknowledgeInput!) {
  acknowledgeCopilotSupportBundleDirectDownload(input: $input) {
    actorId
    artifactFingerprint
    artifactFilename
    artifactKind
    artifactMime
    authorizationFingerprint
    bundleId
    createdAt
    deliveryMethod
    directDownloadExpiresAt
    directDownloadUrl
    downloadedAt
    downloadUrl
    expiresAt
    id
    manifestFingerprint
    status
    updatedAt
    workspaceId
  }
}`,
};

export const authorizeCopilotSupportBundleDownloadMutation = {
  id: 'authorizeCopilotSupportBundleDownloadMutation' as const,
  op: 'authorizeCopilotSupportBundleDownload',
  query: `mutation authorizeCopilotSupportBundleDownload($input: CopilotSupportBundleDownloadAuthorizeInput!) {
  authorizeCopilotSupportBundleDownload(input: $input) {
    actorId
    artifactFingerprint
    artifactFilename
    artifactKind
    artifactMime
    authorizationFingerprint
    bundleId
    createdAt
    deliveryMethod
    directDownloadExpiresAt
    directDownloadUrl
    downloadedAt
    downloadUrl
    expiresAt
    id
    manifestFingerprint
    status
    updatedAt
    workspaceId
  }
}`,
};

export const getCopilotSupportBundleQuery = {
  id: 'getCopilotSupportBundleQuery' as const,
  op: 'getCopilotSupportBundle',
  query: `query getCopilotSupportBundle($workspaceId: String!, $id: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      supportBundle(id: $id) {
        actorId
        archiveByteSize
        archiveFilename
        archiveFingerprint
        archiveMime
        archiveStorageKey
        auditEventCount
        auditEvents {
          actorId
          bundleId
          createdAt
          eventFingerprint
          eventType
          id
          metadata
          workspaceId
        }
        createdAt
        expiresAt
        failureCode
        failureMessage
        id
        manifestByteSize
        manifestFilename
        manifestFingerprint
        manifestMime
        manifestStorageKey
        manifestJson {
          actorId
          archive
          bundleId
          createdAt
          expiresAt
          retention {
            expiresAt
            status
          }
          sourceEvidenceSetFingerprint
          sourceEvidenceSummary {
            actionRunCount
            includedSections
            promptCatalogItemCount
            source
            taskRouteCount
          }
          version
          workspaceId
        }
        retentionStatus
        sourceEvidenceSetFingerprint
        sourceEvidenceSummary {
          actionRunCount
          includedSections
          promptCatalogItemCount
          source
          taskRouteCount
        }
        status
        transferEventCount
        transferEvents {
          artifactFingerprint
          artifactKind
          authorizationFingerprint
          authorizationId
          createdAt
          deliveryMethod
          eventFingerprint
          eventId
          eventSource
          id
          manifestFingerprint
          notificationAuthEvidenceFingerprint
          storageByteSize
          storageContentType
          storageKey
          transferredAt
        }
        transferForwardingEventCount
        transferForwardingEvents {
          attemptCount
          authorizationId
          createdAt
          deadLetteredAt
          eventId
          eventSource
          failureCode
          failureMessage
          forwardedAt
          forwardedTransferEventFingerprint
          forwardingEventFingerprint
          forwardingPayload
          forwardingPayloadFingerprint
          id
          lastAttemptAt
          maxAttempts
          nextAttemptAt
          providerSignatureEvidenceFingerprint
          status
          updatedAt
          workerLeaseExpiresAt
          workerLeaseId
        }
        updatedAt
        workspaceId
      }
    }
  }
}`,
};

export const cleanupCopilotSupportBundleRetentionMutation = {
  id: 'cleanupCopilotSupportBundleRetentionMutation' as const,
  op: 'cleanupCopilotSupportBundleRetention',
  query: `mutation cleanupCopilotSupportBundleRetention($input: CopilotSupportBundleRetentionCleanupInput!) {
  cleanupCopilotSupportBundleRetention(input: $input) {
    archiveObjectCleanupFailedCount
    archiveObjectCleanupRecoveredCount
    archiveObjectCleanupRetryCount
    actorId
    cleanedAt
    cleanupFingerprint
    expiredAuthorizationCount
    expiredBundleCount
    expiredBundles {
      actorId
      archiveByteSize
      archiveFilename
      archiveFingerprint
      archiveMime
      archiveStorageKey
      auditEventCount
      auditEvents {
        actorId
        bundleId
        createdAt
        eventFingerprint
        eventType
        id
        metadata
        workspaceId
      }
      createdAt
      expiresAt
      failureCode
      failureMessage
      id
      manifestFingerprint
      manifestJson {
        actorId
        archive
        bundleId
        createdAt
        expiresAt
        retention {
          expiresAt
          status
        }
        sourceEvidenceSetFingerprint
        sourceEvidenceSummary {
          actionRunCount
          includedSections
          promptCatalogItemCount
          source
          taskRouteCount
        }
        version
        workspaceId
      }
      retentionStatus
      sourceEvidenceSetFingerprint
      sourceEvidenceSummary {
        actionRunCount
        includedSections
        promptCatalogItemCount
        source
        taskRouteCount
      }
      status
      updatedAt
      workspaceId
    }
    manifestObjectRewriteFailedCount
    manifestObjectRewriteRecoveredCount
    manifestObjectRewriteRetryCount
    workspaceId
  }
}`,
};

export const replayCopilotSupportBundleTransferForwardingEventMutation = {
  id: 'replayCopilotSupportBundleTransferForwardingEventMutation' as const,
  op: 'replayCopilotSupportBundleTransferForwardingEvent',
  query: `mutation replayCopilotSupportBundleTransferForwardingEvent($input: CopilotSupportBundleTransferForwardingReplayInput!) {
  replayCopilotSupportBundleTransferForwardingEvent(input: $input) {
    attemptCount
    authorizationId
    createdAt
    deadLetteredAt
    eventId
    eventSource
    failureCode
    failureMessage
    forwardedAt
    forwardedTransferEventFingerprint
    forwardingEventFingerprint
    forwardingPayload
    forwardingPayloadFingerprint
    id
    lastAttemptAt
    maxAttempts
    nextAttemptAt
    providerSignatureEvidenceFingerprint
    status
    updatedAt
    workerLeaseExpiresAt
    workerLeaseId
  }
}`,
};

export const getCopilotSupportBundlesQuery = {
  id: 'getCopilotSupportBundlesQuery' as const,
  op: 'getCopilotSupportBundles',
  query: `query getCopilotSupportBundles($workspaceId: String!, $limit: SafeInt, $filter: CopilotSupportBundleListFilterInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      supportBundles(filter: $filter, limit: $limit) {
        actorId
        archiveByteSize
        archiveFilename
        archiveFingerprint
        archiveMime
        archiveStorageKey
        auditEventCount
        auditEvents {
          actorId
          bundleId
          createdAt
          eventFingerprint
          eventType
          id
          metadata
          workspaceId
        }
        createdAt
        expiresAt
        failureCode
        failureMessage
        id
        manifestByteSize
        manifestFilename
        manifestFingerprint
        manifestMime
        manifestStorageKey
        manifestJson {
          actorId
          archive
          bundleId
          createdAt
          expiresAt
          retention {
            expiresAt
            status
          }
          sourceEvidenceSetFingerprint
          sourceEvidenceSummary {
            actionRunCount
            includedSections
            promptCatalogItemCount
            source
            taskRouteCount
          }
          version
          workspaceId
        }
        retentionStatus
        sourceEvidenceSetFingerprint
        sourceEvidenceSummary {
          actionRunCount
          includedSections
          promptCatalogItemCount
          source
          taskRouteCount
        }
        status
        transferEventCount
        transferEvents {
          artifactFingerprint
          artifactKind
          authorizationFingerprint
          authorizationId
          createdAt
          deliveryMethod
          eventFingerprint
          eventId
          eventSource
          id
          manifestFingerprint
          notificationAuthEvidenceFingerprint
          storageByteSize
          storageContentType
          storageKey
          transferredAt
        }
        transferForwardingEventCount
        transferForwardingEvents {
          attemptCount
          authorizationId
          createdAt
          deadLetteredAt
          eventId
          eventSource
          failureCode
          failureMessage
          forwardedAt
          forwardedTransferEventFingerprint
          forwardingEventFingerprint
          forwardingPayload
          forwardingPayloadFingerprint
          id
          lastAttemptAt
          maxAttempts
          nextAttemptAt
          providerSignatureEvidenceFingerprint
          status
          updatedAt
          workerLeaseExpiresAt
          workerLeaseId
        }
        updatedAt
        workspaceId
      }
    }
  }
}`,
};

export const controlCopilotTaskMutation = {
  id: 'controlCopilotTaskMutation' as const,
  op: 'controlCopilotTask',
  query: `mutation controlCopilotTask($input: CopilotTaskControlInput!) {
  controlCopilotTask(input: $input) {
    id
    workspaceId
    projectId
    title
    workflow
    status
    createdAt
    updatedAt
    startedAt
    completedAt
    failureCode
    failureMessage
    resultSummary
    approvalSummary
    resultEvidence
    availableActions
    abandoned
    approval {
      stepId
      status
      title
      decidedAt
    }
    artifacts {
      kind
      id
      title
    }
    steps {
      id
      key
      type
      status
      title
      order
      startedAt
      completedAt
    }
  }
}`,
};

export const copilotTaskGetQuery = {
  id: 'copilotTaskGetQuery' as const,
  op: 'copilotTaskGet',
  query: `query copilotTaskGet($workspaceId: String!, $taskId: String!) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      copilotTask(id: $taskId) {
        id
        workspaceId
        projectId
        title
        workflow
        status
        createdAt
        updatedAt
        startedAt
        completedAt
        failureCode
        failureMessage
        resultSummary
        approvalSummary
        resultEvidence
        availableActions
        abandoned
        approval {
          stepId
          status
          title
          decidedAt
        }
        artifacts {
          kind
          id
          title
        }
        steps {
          id
          key
          type
          status
          title
          order
          startedAt
          completedAt
        }
      }
    }
  }
}`,
};

export const copilotTasksGetQuery = {
  id: 'copilotTasksGetQuery' as const,
  op: 'copilotTasksGet',
  query: `query copilotTasksGet($workspaceId: String, $limit: SafeInt, $filter: CopilotTaskListFilterInput) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      copilotTasks(filter: $filter, limit: $limit) {
        id
        workspaceId
        projectId
        title
        workflow
        status
        createdAt
        updatedAt
        startedAt
        completedAt
        failureCode
        failureMessage
        resultSummary
        approvalSummary
        resultEvidence
        availableActions
        abandoned
        approval {
          stepId
          status
          title
          decidedAt
        }
        artifacts {
          kind
          id
          title
        }
        steps {
          id
          key
          type
          status
          title
          order
          startedAt
          completedAt
        }
      }
    }
  }
}`,
};

export const getTranscriptTaskQuery = {
  id: 'getTranscriptTaskQuery' as const,
  op: 'getTranscriptTask',
  query: `query getTranscriptTask($workspaceId: String!, $taskId: String, $blobId: String) {
  currentUser {
    copilot(workspaceId: $workspaceId) {
      transcriptTask(taskId: $taskId, blobId: $blobId) {
        id
        status
        title
        summary
        sourceAudio {
          blobId
          mimeType
          durationMs
          sampleRate
          channels
        }
        quality {
          degraded
          overflowCount
        }
        sliceManifest {
          index
          fileName
          mimeType
          startSec
          durationSec
          byteSize
        }
        normalizedSegments {
          speaker
          startSec
          endSec
          start
          end
          text
        }
        normalizedTranscript
        summaryJson {
          title
          durationMinutes
          attendees
          keyPoints
          actionItems {
            description
            owner
            deadline
          }
          decisions
          openQuestions
          blockers
        }
        transcription {
          speaker
          start
          end
          transcription
        }
      }
    }
  }
}`,
  deprecations: ["'transcriptTask' is deprecated: Use realtime subscription \"copilot.transcript.task.changed\" instead."],
};

export const retryTranscriptTaskMutation = {
  id: 'retryTranscriptTaskMutation' as const,
  op: 'retryTranscriptTask',
  query: `mutation retryTranscriptTask($workspaceId: String!, $taskId: String!) {
  retryTranscriptTask(workspaceId: $workspaceId, taskId: $taskId) {
    id
    status
  }
}`,
};

export const settleTranscriptTaskMutation = {
  id: 'settleTranscriptTaskMutation' as const,
  op: 'settleTranscriptTask',
  query: `mutation settleTranscriptTask($workspaceId: String!, $taskId: String!) {
  settleTranscriptTask(workspaceId: $workspaceId, taskId: $taskId) {
    id
    status
    title
    summary
    actions
    sourceAudio {
      blobId
      mimeType
      durationMs
      sampleRate
      channels
    }
    quality {
      degraded
      overflowCount
    }
    sliceManifest {
      index
      fileName
      mimeType
      startSec
      durationSec
      byteSize
    }
    normalizedSegments {
      speaker
      startSec
      endSec
      start
      end
      text
    }
    normalizedTranscript
    summaryJson {
      title
      durationMinutes
      attendees
      keyPoints
      actionItems {
        description
        owner
        deadline
      }
      decisions
      openQuestions
      blockers
    }
    transcription {
      speaker
      start
      end
      transcription
    }
  }
}`,
};

export const submitTranscriptTaskMutation = {
  id: 'submitTranscriptTaskMutation' as const,
  op: 'submitTranscriptTask',
  query: `mutation submitTranscriptTask($workspaceId: String!, $blobId: String!, $blob: Upload, $blobs: [Upload!], $input: SubmitAudioTranscriptionInput) {
  submitTranscriptTask(
    blob: $blob
    blobs: $blobs
    blobId: $blobId
    workspaceId: $workspaceId
    input: $input
  ) {
    id
    status
  }
}`,
  file: true,
};

export const copilotWorkbenchBlockersGetQuery = {
  id: 'copilotWorkbenchBlockersGetQuery' as const,
  op: 'copilotWorkbenchBlockersGet',
  query: `query copilotWorkbenchBlockersGet($projectId: ID, $statuses: [String!], $limit: Int) {
  currentUser {
    copilot {
      workbenchBlockers(projectId: $projectId, statuses: $statuses, limit: $limit) {
        ...CopilotBlockerFields
      }
    }
  }
}
${copilotBlockerFieldsFragment}`,
};

export const copilotWorkbenchProjectsGetQuery = {
  id: 'copilotWorkbenchProjectsGetQuery' as const,
  op: 'copilotWorkbenchProjectsGet',
  query: `query copilotWorkbenchProjectsGet($includeArchived: Boolean = false) {
  currentUser {
    copilot {
      contextProjects(includeArchived: $includeArchived) {
        id
        createdByUserId
        name
        description
        status
        aiPolicy
        role
        members {
          userId
          name
          email
          avatarUrl
          role
          createdAt
        }
        canManage
        createdAt
        updatedAt
      }
    }
  }
}`,
};

export const copilotWorkbenchSourceAuthorizationGetQuery = {
  id: 'copilotWorkbenchSourceAuthorizationGetQuery' as const,
  op: 'copilotWorkbenchSourceAuthorizationGet',
  query: `query copilotWorkbenchSourceAuthorizationGet($workspaceId: String!, $docId: String!) {
  currentUser {
    copilot {
      workbenchAccessRequests(
        view: "source"
        workspaceId: $workspaceId
        docId: $docId
        statuses: ["pending"]
        limit: 50
      ) {
        id
        workspaceId
        docId
        beneficiaryType
        beneficiaryUserId
        beneficiaryProjectId
        requesterUserId
        projectName
        requesterName
        requesterEmail
        beneficiaryName
        requestedLevel
        requestedTitle
        status
        createdAt
        updatedAt
      }
      workbenchProjectGrantsForSource(
        workspaceId: $workspaceId
        docId: $docId
        statuses: ["active"]
        limit: 100
      ) {
        id
        projectId
        projectName
        workspaceId
        docId
        level
        status
        source
        approvingSide
        grantedByUserId
        grantedByName
        accessRequestId
        grantedAt
        createdAt
        updatedAt
      }
    }
  }
}`,
};

export const copilotWorkbenchTaskGetQuery = {
  id: 'copilotWorkbenchTaskGetQuery' as const,
  op: 'copilotWorkbenchTaskGet',
  query: `query copilotWorkbenchTaskGet($taskId: String!) {
  currentUser {
    copilot {
      workbenchTask(taskId: $taskId) {
        ...CopilotWorkbenchTaskItemFields
        run {
          documentUpdate {
            workspaceId
            docId
            content
            expectedVersion
            needsReconfirmation
            previousVersion
          }
        }
      }
    }
  }
}
${copilotWorkbenchTaskItemFieldsFragment}`,
};

export const copilotWorkbenchTaskPanelGetQuery = {
  id: 'copilotWorkbenchTaskPanelGetQuery' as const,
  op: 'copilotWorkbenchTaskPanelGet',
  query: `query copilotWorkbenchTaskPanelGet($projectId: ID) {
  currentUser {
    copilot {
      workbenchTaskPanel(projectId: $projectId) {
        todo {
          capped
          items {
            ...CopilotWorkbenchTaskItemFields
          }
        }
        inProgress {
          capped
          items {
            ...CopilotWorkbenchTaskItemFields
          }
        }
        done {
          capped
          items {
            ...CopilotWorkbenchTaskItemFields
          }
        }
      }
    }
  }
}
${copilotWorkbenchTaskItemFieldsFragment}`,
};

export const copilotWorkbenchTasksGetQuery = {
  id: 'copilotWorkbenchTasksGetQuery' as const,
  op: 'copilotWorkbenchTasksGet',
  query: `query copilotWorkbenchTasksGet($projectId: ID, $limit: Int, $cursor: String, $filter: String) {
  currentUser {
    copilot {
      workbenchTasks(
        projectId: $projectId
        limit: $limit
        cursor: $cursor
        filter: $filter
      ) {
        capped
        nextCursor
        items {
          ...CopilotWorkbenchTaskItemFields
        }
      }
    }
  }
}
${copilotWorkbenchTaskItemFieldsFragment}`,
};

export const addWorkspaceEmbeddingFilesMutation = {
  id: 'addWorkspaceEmbeddingFilesMutation' as const,
  op: 'addWorkspaceEmbeddingFiles',
  query: `mutation addWorkspaceEmbeddingFiles($workspaceId: String!, $blob: Upload!) {
  addWorkspaceEmbeddingFiles(workspaceId: $workspaceId, blob: $blob) {
    fileId
    fileName
    blobId
    mimeType
    size
    createdAt
  }
}`,
  file: true,
};

export const getWorkspaceEmbeddingFilesQuery = {
  id: 'getWorkspaceEmbeddingFilesQuery' as const,
  op: 'getWorkspaceEmbeddingFiles',
  query: `query getWorkspaceEmbeddingFiles($workspaceId: String!, $pagination: PaginationInput!) {
  workspace(id: $workspaceId) {
    embedding {
      files(pagination: $pagination) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            fileId
            fileName
            blobId
            mimeType
            size
            createdAt
          }
        }
      }
    }
  }
}`,
};

export const removeWorkspaceEmbeddingFilesMutation = {
  id: 'removeWorkspaceEmbeddingFilesMutation' as const,
  op: 'removeWorkspaceEmbeddingFiles',
  query: `mutation removeWorkspaceEmbeddingFiles($workspaceId: String!, $fileId: String!) {
  removeWorkspaceEmbeddingFiles(workspaceId: $workspaceId, fileId: $fileId)
}`,
};

export const addWorkspaceEmbeddingIgnoredDocsMutation = {
  id: 'addWorkspaceEmbeddingIgnoredDocsMutation' as const,
  op: 'addWorkspaceEmbeddingIgnoredDocs',
  query: `mutation addWorkspaceEmbeddingIgnoredDocs($workspaceId: String!, $add: [String!]!) {
  updateWorkspaceEmbeddingIgnoredDocs(workspaceId: $workspaceId, add: $add)
}`,
};

export const getAllWorkspaceEmbeddingIgnoredDocsQuery = {
  id: 'getAllWorkspaceEmbeddingIgnoredDocsQuery' as const,
  op: 'getAllWorkspaceEmbeddingIgnoredDocs',
  query: `query getAllWorkspaceEmbeddingIgnoredDocs($workspaceId: String!) {
  workspace(id: $workspaceId) {
    embedding {
      allIgnoredDocs {
        docId
        createdAt
      }
    }
  }
}`,
};

export const getWorkspaceEmbeddingIgnoredDocsQuery = {
  id: 'getWorkspaceEmbeddingIgnoredDocsQuery' as const,
  op: 'getWorkspaceEmbeddingIgnoredDocs',
  query: `query getWorkspaceEmbeddingIgnoredDocs($workspaceId: String!, $pagination: PaginationInput!) {
  workspace(id: $workspaceId) {
    embedding {
      ignoredDocs(pagination: $pagination) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            docId
            createdAt
            docCreatedAt
            docUpdatedAt
            title
            createdBy
            createdByAvatar
            updatedBy
          }
        }
      }
    }
  }
}`,
};

export const removeWorkspaceEmbeddingIgnoredDocsMutation = {
  id: 'removeWorkspaceEmbeddingIgnoredDocsMutation' as const,
  op: 'removeWorkspaceEmbeddingIgnoredDocs',
  query: `mutation removeWorkspaceEmbeddingIgnoredDocs($workspaceId: String!, $remove: [String!]!) {
  updateWorkspaceEmbeddingIgnoredDocs(workspaceId: $workspaceId, remove: $remove)
}`,
};

export const createCheckoutSessionMutation = {
  id: 'createCheckoutSessionMutation' as const,
  op: 'createCheckoutSession',
  query: `mutation createCheckoutSession($input: CreateCheckoutSessionInput!) {
  createCheckoutSession(input: $input)
}`,
};

export const createCustomerPortalMutation = {
  id: 'createCustomerPortalMutation' as const,
  op: 'createCustomerPortal',
  query: `mutation createCustomerPortal {
  createCustomerPortal
}`,
};

export const createProjectDestinationFolderMutation = {
  id: 'createProjectDestinationFolderMutation' as const,
  op: 'createProjectDestinationFolder',
  query: `mutation createProjectDestinationFolder($projectId: String!, $publicationId: String!, $workspaceId: String!, $parentId: String, $title: String!, $expectedDirectoryRevision: String!, $requestKey: String!) {
  createProjectDestinationFolder(
    projectId: $projectId
    publicationId: $publicationId
    workspaceId: $workspaceId
    parentId: $parentId
    title: $title
    expectedDirectoryRevision: $expectedDirectoryRevision
    requestKey: $requestKey
  ) {
    runId
    status
    folderId
    failureCode
  }
}`,
};

export const createProjectFileRequestMutation = {
  id: 'createProjectFileRequestMutation' as const,
  op: 'createProjectFileRequest',
  query: `mutation createProjectFileRequest($input: CreateFileRequestInput!) {
  createProjectFileRequest(input: $input) {
    ...ProjectFileRequestFields
  }
}
${projectFileRequestFieldsFragment}`,
};

export const createProjectFileMutation = {
  id: 'createProjectFileMutation' as const,
  op: 'createProjectFile',
  query: `mutation createProjectFile($input: CreateProjectFileInput!) {
  createProjectFile(input: $input) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const createProjectResourceMutation = {
  id: 'createProjectResourceMutation' as const,
  op: 'createProjectResource',
  query: `mutation createProjectResource($input: CreateProjectResourceInput!) {
  createProjectResource(input: $input) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const createSelfhostCustomerPortalMutation = {
  id: 'createSelfhostCustomerPortalMutation' as const,
  op: 'createSelfhostCustomerPortal',
  query: `mutation createSelfhostCustomerPortal($workspaceId: String!) {
  createSelfhostWorkspaceCustomerPortal(workspaceId: $workspaceId)
}`,
};

export const createWorkspaceMutation = {
  id: 'createWorkspaceMutation' as const,
  op: 'createWorkspace',
  query: `mutation createWorkspace {
  createWorkspace {
    id
    public
    createdAt
  }
}`,
};

export const decideProjectAgentTaskMutation = {
  id: 'decideProjectAgentTaskMutation' as const,
  op: 'decideProjectAgentTask',
  query: `mutation decideProjectAgentTask($input: ProjectTaskDecisionInput!) {
  decideProjectAgentTask(input: $input) {
    applied
    decision
    processedByName
    processedAt
    task {
      ...ProjectAgentTaskFields
    }
  }
}
${projectAgentTaskFieldsFragment}`,
};

export const deleteAccountMutation = {
  id: 'deleteAccountMutation' as const,
  op: 'deleteAccount',
  query: `mutation deleteAccount {
  deleteAccount {
    success
  }
}`,
};

export const deleteWorkspaceMutation = {
  id: 'deleteWorkspaceMutation' as const,
  op: 'deleteWorkspace',
  query: `mutation deleteWorkspace($id: String!) {
  deleteWorkspace(id: $id)
}`,
};

export const dismissAllNotificationsMutation = {
  id: 'dismissAllNotificationsMutation' as const,
  op: 'dismissAllNotifications',
  query: `mutation dismissAllNotifications {
  dismissAllNotifications
}`,
};

export const dismissNotificationMutation = {
  id: 'dismissNotificationMutation' as const,
  op: 'dismissNotification',
  query: `mutation dismissNotification($id: String!) {
  dismissNotification(id: $id)
}`,
};

export const dismissReadNotificationsMutation = {
  id: 'dismissReadNotificationsMutation' as const,
  op: 'dismissReadNotifications',
  query: `mutation dismissReadNotifications {
  dismissReadNotifications
}`,
};

export const getDocRolePermissionsQuery = {
  id: 'getDocRolePermissionsQuery' as const,
  op: 'getDocRolePermissions',
  query: `query getDocRolePermissions($workspaceId: String!, $docId: String!) {
  workspace(id: $workspaceId) {
    doc(docId: $docId) {
      permissions {
        Doc_Copy
        Doc_Delete
        Doc_Duplicate
        Doc_Properties_Read
        Doc_Properties_Update
        Doc_Publish
        Doc_Read
        Doc_Restore
        Doc_TransferOwner
        Doc_Trash
        Doc_Update
        Doc_Users_Manage
        Doc_Users_Read
        Doc_Comments_Create
        Doc_Comments_Delete
        Doc_Comments_Read
        Doc_Comments_Resolve
      }
    }
  }
}`,
};

export const beginEnterpriseAuthorizationMutation = {
  id: 'beginEnterpriseAuthorizationMutation' as const,
  op: 'beginEnterpriseAuthorization',
  query: `mutation beginEnterpriseAuthorization($workspaceId: String!, $connectionId: ID!) {
  beginEnterpriseAuthorization(
    workspaceId: $workspaceId
    connectionId: $connectionId
  ) {
    id
    connectionId
    workspaceId
    provider
    status
    authorizationUrl
    userCode
    qrCodeUrl
    expiresAt
    startedAt
    completedAt
    lastErrorCode
    lastErrorMessage
    createdAt
    updatedAt
  }
}`,
};

export const cancelEnterpriseAuthorizationMutation = {
  id: 'cancelEnterpriseAuthorizationMutation' as const,
  op: 'cancelEnterpriseAuthorization',
  query: `mutation cancelEnterpriseAuthorization($workspaceId: String!, $sessionId: ID!) {
  cancelEnterpriseAuthorization(workspaceId: $workspaceId, sessionId: $sessionId) {
    id
    connectionId
    provider
    status
    expiresAt
    completedAt
    lastErrorCode
    lastErrorMessage
  }
}`,
};

export const latestEnterpriseAuthorizationSessionQuery = {
  id: 'latestEnterpriseAuthorizationSessionQuery' as const,
  op: 'latestEnterpriseAuthorizationSession',
  query: `query latestEnterpriseAuthorizationSession($workspaceId: String!, $connectionId: ID!) {
  latestEnterpriseAuthorizationSession(
    workspaceId: $workspaceId
    connectionId: $connectionId
  ) {
    id
    connectionId
    workspaceId
    provider
    status
    authorizationUrl
    userCode
    qrCodeUrl
    expiresAt
    startedAt
    completedAt
    lastErrorCode
    lastErrorMessage
    createdAt
    updatedAt
  }
}`,
};

export const enterpriseAuthorizationSessionQuery = {
  id: 'enterpriseAuthorizationSessionQuery' as const,
  op: 'enterpriseAuthorizationSession',
  query: `query enterpriseAuthorizationSession($workspaceId: String!, $sessionId: ID!) {
  enterpriseAuthorizationSession(workspaceId: $workspaceId, sessionId: $sessionId) {
    id
    connectionId
    workspaceId
    provider
    status
    authorizationUrl
    userCode
    qrCodeUrl
    expiresAt
    startedAt
    completedAt
    lastErrorCode
    lastErrorMessage
    createdAt
    updatedAt
  }
}`,
};

export const enterpriseConnectionsQuery = {
  id: 'enterpriseConnectionsQuery' as const,
  op: 'enterpriseConnections',
  query: `query enterpriseConnections($workspaceId: String!) {
  enterpriseConnectionPolicy(workspaceId: $workspaceId) {
    enabled
    allowedProviders
  }
  enterpriseConnections(workspaceId: $workspaceId) {
    id
    workspaceId
    provider
    transport
    name
    status
    externalTenantId
    externalUserId
    identityType
    enabledToolNames
    expiresAt
    lastConnectedAt
    lastCheckedAt
    lastUsedAt
    lastErrorCode
    lastErrorMessage
    createdAt
    updatedAt
    tools {
      name
      description
      inputSchema
      risk
      requiresConfirmation
      supportsDryRun
      enabled
    }
  }
}`,
};

export const createEnterpriseConnectionMutation = {
  id: 'createEnterpriseConnectionMutation' as const,
  op: 'createEnterpriseConnection',
  query: `mutation createEnterpriseConnection($input: CreateEnterpriseConnectionInput!) {
  createEnterpriseConnection(input: $input) {
    id
    workspaceId
    provider
    transport
    name
    status
    createdAt
    updatedAt
  }
}`,
};

export const deleteEnterpriseConnectionMutation = {
  id: 'deleteEnterpriseConnectionMutation' as const,
  op: 'deleteEnterpriseConnection',
  query: `mutation deleteEnterpriseConnection($workspaceId: String!, $connectionId: String!) {
  deleteEnterpriseConnection(
    workspaceId: $workspaceId
    connectionId: $connectionId
  )
}`,
};

export const disableEnterpriseConnectionMutation = {
  id: 'disableEnterpriseConnectionMutation' as const,
  op: 'disableEnterpriseConnection',
  query: `mutation disableEnterpriseConnection($workspaceId: String!, $connectionId: String!) {
  disableEnterpriseConnection(
    workspaceId: $workspaceId
    connectionId: $connectionId
  ) {
    id
    status
    enabledToolNames
    updatedAt
  }
}`,
};

export const refreshEnterpriseConnectionMutation = {
  id: 'refreshEnterpriseConnectionMutation' as const,
  op: 'refreshEnterpriseConnection',
  query: `mutation refreshEnterpriseConnection($workspaceId: String!, $connectionId: String!) {
  refreshEnterpriseConnection(
    workspaceId: $workspaceId
    connectionId: $connectionId
  ) {
    id
    status
    enabledToolNames
    lastConnectedAt
    lastCheckedAt
    lastErrorCode
    lastErrorMessage
  }
}`,
};

export const updateEnterpriseToolAllowlistMutation = {
  id: 'updateEnterpriseToolAllowlistMutation' as const,
  op: 'updateEnterpriseToolAllowlist',
  query: `mutation updateEnterpriseToolAllowlist($workspaceId: String!, $connectionId: String!, $enabledToolNames: [String!]!) {
  updateEnterpriseToolAllowlist(
    workspaceId: $workspaceId
    connectionId: $connectionId
    enabledToolNames: $enabledToolNames
  ) {
    id
    status
    enabledToolNames
    updatedAt
  }
}`,
};

export const executeProjectOfficeCommandMutation = {
  id: 'executeProjectOfficeCommandMutation' as const,
  op: 'executeProjectOfficeCommand',
  query: `mutation executeProjectOfficeCommand($input: ProjectOfficeCommandInput!) {
  executeProjectOfficeCommand(input: $input) {
    created
    artifact {
      ...ProjectOfficeArtifactFields
    }
    revision {
      ...ProjectOfficeRevisionFields
    }
    summary
  }
}
${projectOfficeArtifactFieldsFragment}
${projectOfficeRevisionFieldsFragment}`,
};

export const connectExternalMcpMutation = {
  id: 'connectExternalMcpMutation' as const,
  op: 'connectExternalMcp',
  query: `mutation connectExternalMcp($input: ConnectExternalMcpInput!) {
  connectExternalMcp(input: $input) {
    id
    status
    sessionFingerprint
    serverName
    serverVersion
    lastConnectedAt
  }
}`,
};

export const deleteExternalMcpMutation = {
  id: 'deleteExternalMcpMutation' as const,
  op: 'deleteExternalMcp',
  query: `mutation deleteExternalMcp($workspaceId: String!) {
  deleteExternalMcp(workspaceId: $workspaceId)
}`,
};

export const disableExternalMcpMutation = {
  id: 'disableExternalMcpMutation' as const,
  op: 'disableExternalMcp',
  query: `mutation disableExternalMcp($workspaceId: String!) {
  disableExternalMcp(workspaceId: $workspaceId) {
    id
    status
  }
}`,
};

export const refreshExternalMcpToolsMutation = {
  id: 'refreshExternalMcpToolsMutation' as const,
  op: 'refreshExternalMcpTools',
  query: `mutation refreshExternalMcpTools($workspaceId: String!) {
  refreshExternalMcpTools(workspaceId: $workspaceId) {
    id
    status
    toolCatalogFingerprint
    lastCheckedAt
  }
}`,
};

export const externalMcpSettingsQuery = {
  id: 'externalMcpSettingsQuery' as const,
  op: 'externalMcpSettings',
  query: `query externalMcpSettings($workspaceId: String!) {
  externalMcpSettings(workspaceId: $workspaceId) {
    endpoint
    protocolVersion
    connection {
      id
      workspaceId
      name
      endpoint
      protocolVersion
      status
      sessionFingerprint
      serverName
      serverVersion
      toolCatalogFingerprint
      enabledToolNames
      lastConnectedAt
      lastCheckedAt
      lastUsedAt
      lastErrorCode
      lastErrorMessage
      createdAt
      updatedAt
      tools {
        name
        title
        description
        inputSchema
        enabled
        risk
        requiresExplicitUserRequest
      }
    }
  }
}`,
};

export const testExternalMcpConversationMutation = {
  id: 'testExternalMcpConversationMutation' as const,
  op: 'testExternalMcpConversation',
  query: `mutation testExternalMcpConversation($workspaceId: String!, $query: String!) {
  testExternalMcpConversation(workspaceId: $workspaceId, query: $query) {
    toolName
    result
  }
}`,
};

export const updateExternalMcpToolAllowlistMutation = {
  id: 'updateExternalMcpToolAllowlistMutation' as const,
  op: 'updateExternalMcpToolAllowlist',
  query: `mutation updateExternalMcpToolAllowlist($workspaceId: String!, $enabledToolNames: [String!]!) {
  updateExternalMcpToolAllowlist(
    workspaceId: $workspaceId
    enabledToolNames: $enabledToolNames
  ) {
    id
    status
    enabledToolNames
  }
}`,
};

export const generateLicenseKeyMutation = {
  id: 'generateLicenseKeyMutation' as const,
  op: 'generateLicenseKey',
  query: `mutation generateLicenseKey($sessionId: String!) {
  generateLicenseKey(sessionId: $sessionId)
}`,
};

export const getCurrentUserFeaturesQuery = {
  id: 'getCurrentUserFeaturesQuery' as const,
  op: 'getCurrentUserFeatures',
  query: `query getCurrentUserFeatures {
  currentUser {
    id
    name
    email
    emailVerified
    avatarUrl
    features
  }
}`,
};

export const getCurrentUserQuery = {
  id: 'getCurrentUserQuery' as const,
  op: 'getCurrentUser',
  query: `query getCurrentUser {
  currentUser {
    id
    name
    email
    emailVerified
    avatarUrl
    hasPassword
    features
  }
}`,
};

export const getDocCreatedByUpdatedByListQuery = {
  id: 'getDocCreatedByUpdatedByListQuery' as const,
  op: 'getDocCreatedByUpdatedByList',
  query: `query getDocCreatedByUpdatedByList($workspaceId: String!, $pagination: PaginationInput!) {
  workspace(id: $workspaceId) {
    docs(pagination: $pagination) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
          creatorId
          lastUpdaterId
        }
      }
    }
  }
}`,
};

export const getDocLastAccessedMembersQuery = {
  id: 'getDocLastAccessedMembersQuery' as const,
  op: 'getDocLastAccessedMembers',
  query: `query getDocLastAccessedMembers($workspaceId: String!, $docId: String!, $pagination: PaginationInput!, $query: String, $includeTotal: Boolean) {
  workspace(id: $workspaceId) {
    doc(docId: $docId) {
      lastAccessedMembers(
        pagination: $pagination
        query: $query
        includeTotal: $includeTotal
      ) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
            user {
              id
              name
              avatarUrl
            }
            lastAccessedAt
            lastDocId
          }
        }
      }
    }
  }
}`,
};

export const getDocPageAnalyticsQuery = {
  id: 'getDocPageAnalyticsQuery' as const,
  op: 'getDocPageAnalytics',
  query: `query getDocPageAnalytics($workspaceId: String!, $docId: String!, $input: DocPageAnalyticsInput) {
  workspace(id: $workspaceId) {
    doc(docId: $docId) {
      analytics(input: $input) {
        window {
          from
          to
          timezone
          bucket
          requestedSize
          effectiveSize
        }
        series {
          date
          totalViews
          uniqueViews
          guestViews
        }
        summary {
          totalViews
          uniqueViews
          guestViews
          lastAccessedAt
        }
        generatedAt
      }
    }
  }
}`,
};

export const getDocSummaryQuery = {
  id: 'getDocSummaryQuery' as const,
  op: 'getDocSummary',
  query: `query getDocSummary($workspaceId: String!, $docId: String!) {
  workspace(id: $workspaceId) {
    doc(docId: $docId) {
      summary
    }
  }
}`,
};

export const getInviteInfoQuery = {
  id: 'getInviteInfoQuery' as const,
  op: 'getInviteInfo',
  query: `query getInviteInfo($inviteId: String!) {
  getInviteInfo(inviteId: $inviteId) {
    workspace {
      id
      name
      avatar
    }
    user {
      id
      name
      avatarUrl
    }
    status
    invitee {
      id
      name
      email
      avatarUrl
    }
  }
}`,
};

export const getMemberCountByWorkspaceIdQuery = {
  id: 'getMemberCountByWorkspaceIdQuery' as const,
  op: 'getMemberCountByWorkspaceId',
  query: `query getMemberCountByWorkspaceId($workspaceId: String!) {
  workspace(id: $workspaceId) {
    memberCount
  }
}`,
};

export const oauthProvidersQuery = {
  id: 'oauthProvidersQuery' as const,
  op: 'oauthProviders',
  query: `query oauthProviders {
  serverConfig {
    oauthProviders
  }
}`,
};

export const getPublicUserByIdQuery = {
  id: 'getPublicUserByIdQuery' as const,
  op: 'getPublicUserById',
  query: `query getPublicUserById($id: String!) {
  publicUserById(id: $id) {
    id
    avatarUrl
    name
  }
}`,
};

export const getRecentlyUpdatedDocsQuery = {
  id: 'getRecentlyUpdatedDocsQuery' as const,
  op: 'getRecentlyUpdatedDocs',
  query: `query getRecentlyUpdatedDocs($workspaceId: String!, $pagination: PaginationInput!) {
  workspace(id: $workspaceId) {
    recentlyUpdatedDocs(pagination: $pagination) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
          title
          createdAt
          updatedAt
          creatorId
          lastUpdaterId
        }
      }
    }
  }
}`,
};

export const getUserFeaturesQuery = {
  id: 'getUserFeaturesQuery' as const,
  op: 'getUserFeatures',
  query: `query getUserFeatures {
  currentUser {
    id
    features
  }
}`,
};

export const getUserSettingsQuery = {
  id: 'getUserSettingsQuery' as const,
  op: 'getUserSettings',
  query: `query getUserSettings {
  currentUser {
    settings {
      receiveInvitationEmail
      receiveMentionEmail
      receiveCommentEmail
      receiveSparkClawNotifications
    }
  }
}`,
};

export const getUserQuery = {
  id: 'getUserQuery' as const,
  op: 'getUser',
  query: `query getUser($email: String!) {
  user(email: $email) {
    __typename
    ... on UserType {
      id
      name
      avatarUrl
      email
      hasPassword
    }
    ... on LimitedUserType {
      email
      hasPassword
    }
  }
}`,
};

export const getWorkspacePageByIdQuery = {
  id: 'getWorkspacePageByIdQuery' as const,
  op: 'getWorkspacePageById',
  query: `query getWorkspacePageById($workspaceId: String!, $pageId: String!) {
  workspace(id: $workspaceId) {
    doc(docId: $pageId) {
      id
      mode
      defaultRole
      public
      title
      summary
    }
  }
}`,
};

export const getWorkspacePageMetaByIdQuery = {
  id: 'getWorkspacePageMetaByIdQuery' as const,
  op: 'getWorkspacePageMetaById',
  query: `query getWorkspacePageMetaById($id: String!, $pageId: String!) {
  workspace(id: $id) {
    pageMeta(pageId: $pageId) {
      createdAt
      updatedAt
      createdBy {
        name
        avatarUrl
      }
      updatedBy {
        name
        avatarUrl
      }
    }
  }
}`,
  deprecations: ["'pageMeta' is deprecated: use [WorkspaceType.doc] instead"],
};

export const getWorkspacePublicByIdQuery = {
  id: 'getWorkspacePublicByIdQuery' as const,
  op: 'getWorkspacePublicById',
  query: `query getWorkspacePublicById($id: String!) {
  workspace(id: $id) {
    public
  }
}`,
};

export const getWorkspacePublicPagesQuery = {
  id: 'getWorkspacePublicPagesQuery' as const,
  op: 'getWorkspacePublicPages',
  query: `query getWorkspacePublicPages($workspaceId: String!) {
  workspace(id: $workspaceId) {
    publicDocs {
      id
      mode
    }
  }
}`,
};

export const getWorkspaceSubscriptionQuery = {
  id: 'getWorkspaceSubscriptionQuery' as const,
  op: 'getWorkspaceSubscription',
  query: `query getWorkspaceSubscription($workspaceId: String!) {
  workspace(id: $workspaceId) {
    subscription {
      id
      status
      plan
      recurring
      start
      end
      nextBillAt
      canceledAt
      variant
    }
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const getWorkspaceQuery = {
  id: 'getWorkspaceQuery' as const,
  op: 'getWorkspace',
  query: `query getWorkspace($id: String!) {
  workspace(id: $id) {
    id
  }
}`,
};

export const getWorkspacesQuery = {
  id: 'getWorkspacesQuery' as const,
  op: 'getWorkspaces',
  query: `query getWorkspaces {
  workspaces {
    enableAi
    enableDocEmbedding
    id
    initialized
    role
    team
    owner {
      id
    }
  }
}`,
};

export const grantDocUserRolesMutation = {
  id: 'grantDocUserRolesMutation' as const,
  op: 'grantDocUserRoles',
  query: `mutation grantDocUserRoles($input: GrantDocUserRolesInput!) {
  grantDocUserRoles(input: $input)
}`,
};

export const listHistoryQuery = {
  id: 'listHistoryQuery' as const,
  op: 'listHistory',
  query: `query listHistory($workspaceId: String!, $pageDocId: String!, $take: Int, $before: DateTime) {
  workspace(id: $workspaceId) {
    histories(guid: $pageDocId, take: $take, before: $before) {
      id
      timestamp
      editor {
        name
        avatarUrl
      }
    }
  }
}`,
};

export const importProjectOfficeMutation = {
  id: 'importProjectOfficeMutation' as const,
  op: 'importProjectOffice',
  query: `mutation importProjectOffice($input: ImportProjectOfficeInput!) {
  importProjectOffice(input: $input) {
    created
    artifact {
      ...ProjectOfficeArtifactFields
    }
    revision {
      ...ProjectOfficeRevisionFields
    }
    summary
  }
}
${projectOfficeArtifactFieldsFragment}
${projectOfficeRevisionFieldsFragment}`,
};

export const importWorkspaceResourceToProjectMutation = {
  id: 'importWorkspaceResourceToProjectMutation' as const,
  op: 'importWorkspaceResourceToProject',
  query: `mutation importWorkspaceResourceToProject($input: ImportWorkspaceResourceToProjectInput!) {
  importWorkspaceResourceToProject(input: $input) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const indexerAggregateQuery = {
  id: 'indexerAggregateQuery' as const,
  op: 'indexerAggregate',
  query: `query indexerAggregate($id: String!, $input: AggregateInput!) {
  workspace(id: $id) {
    aggregate(input: $input) {
      buckets {
        key
        count
        hits {
          nodes {
            fields
            highlights
          }
        }
      }
      pagination {
        count
        hasMore
        nextCursor
      }
    }
  }
}`,
};

export const indexerSearchDocsQuery = {
  id: 'indexerSearchDocsQuery' as const,
  op: 'indexerSearchDocs',
  query: `query indexerSearchDocs($id: String!, $input: SearchDocsInput!) {
  workspace(id: $id) {
    searchDocs(input: $input) {
      docId
      title
      blockId
      highlight
      createdAt
      updatedAt
      createdByUser {
        id
        name
        avatarUrl
      }
      updatedByUser {
        id
        name
        avatarUrl
      }
    }
  }
}`,
};

export const indexerSearchQuery = {
  id: 'indexerSearchQuery' as const,
  op: 'indexerSearch',
  query: `query indexerSearch($id: String!, $input: SearchInput!) {
  workspace(id: $id) {
    search(input: $input) {
      nodes {
        fields
        highlights
      }
      pagination {
        count
        hasMore
        nextCursor
      }
    }
  }
}`,
};

export const getInvoicesCountQuery = {
  id: 'getInvoicesCountQuery' as const,
  op: 'getInvoicesCount',
  query: `query getInvoicesCount {
  currentUser {
    invoiceCount
  }
}`,
};

export const invoicesQuery = {
  id: 'invoicesQuery' as const,
  op: 'invoices',
  query: `query invoices($take: Int!, $skip: Int!) {
  currentUser {
    invoiceCount
    invoices(take: $take, skip: $skip) {
      status
      currency
      amount
      reason
      lastPaymentError
      link
      createdAt
    }
  }
}`,
};

export const createSparkClawPairingMutation = {
  id: 'createSparkClawPairingMutation' as const,
  op: 'createSparkClawPairing',
  query: `mutation createSparkClawPairing {
  createSparkClawPairing {
    command
    expiresAt
  }
}`,
};

export const disconnectSparkClawEndpointMutation = {
  id: 'disconnectSparkClawEndpointMutation' as const,
  op: 'disconnectSparkClawEndpoint',
  query: `mutation disconnectSparkClawEndpoint($endpointId: ID!) {
  disconnectSparkClawEndpoint(endpointId: $endpointId)
}`,
};

export const sparkClawEndpointsQuery = {
  id: 'sparkClawEndpointsQuery' as const,
  op: 'sparkClawEndpoints',
  query: `query sparkClawEndpoints {
  currentUser {
    sparkClawEndpoints {
      id
      deviceId
      status
      lastSeenAt
      createdAt
    }
  }
}`,
};

export const leaveWorkspaceMutation = {
  id: 'leaveWorkspaceMutation' as const,
  op: 'leaveWorkspace',
  query: `mutation leaveWorkspace($workspaceId: String!, $sendLeaveMail: Boolean) {
  leaveWorkspace(workspaceId: $workspaceId, sendLeaveMail: $sendLeaveMail)
}`,
};

export const activateLicenseMutation = {
  id: 'activateLicenseMutation' as const,
  op: 'activateLicense',
  query: `mutation activateLicense($workspaceId: String!, $license: String!) {
  activateLicense(workspaceId: $workspaceId, license: $license) {
    ...licenseBody
  }
}
${licenseBodyFragment}`,
};

export const deactivateLicenseMutation = {
  id: 'deactivateLicenseMutation' as const,
  op: 'deactivateLicense',
  query: `mutation deactivateLicense($workspaceId: String!) {
  deactivateLicense(workspaceId: $workspaceId)
}`,
};

export const getLicenseQuery = {
  id: 'getLicenseQuery' as const,
  op: 'getLicense',
  query: `query getLicense($workspaceId: String!) {
  workspace(id: $workspaceId) {
    license {
      ...licenseBody
    }
  }
}
${licenseBodyFragment}`,
};

export const installLicenseMutation = {
  id: 'installLicenseMutation' as const,
  op: 'installLicense',
  query: `mutation installLicense($workspaceId: String!, $license: Upload!) {
  installLicense(workspaceId: $workspaceId, license: $license) {
    ...licenseBody
  }
}
${licenseBodyFragment}`,
  file: true,
};

export const previewLicenseMutation = {
  id: 'previewLicenseMutation' as const,
  op: 'previewLicense',
  query: `mutation previewLicense($license: Upload!) {
  previewLicense(license: $license) {
    id
    workspaceId
    plan
    recurring
    quantity
    issuedAt
    expiresAt
    endAt
    entity
    issuer
    valid
  }
}`,
  file: true,
};

export const listNotificationsQuery = {
  id: 'listNotificationsQuery' as const,
  op: 'listNotifications',
  query: `query listNotifications($pagination: PaginationInput!, $includeRead: Boolean = false) {
  currentUser {
    notifications(pagination: $pagination, includeRead: $includeRead) {
      totalCount
      edges {
        cursor
        node {
          id
          type
          level
          read
          createdAt
          updatedAt
          body
        }
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
}`,
};

export const createMcpCredentialMutation = {
  id: 'createMcpCredentialMutation' as const,
  op: 'createMcpCredential',
  query: `mutation createMcpCredential($input: CreateMcpCredentialInput!) {
  createMcpCredential(input: $input) {
    credential {
      id
      name
      workspaceId
      accessMode
      capabilities
      fingerprint
      createdAt
      expiresAt
      lastUsedAt
      revokedAt
      graceEndsAt
      status
      callbackConfigured
    }
    token
    callbackSecret
  }
}`,
};

export const mcpCredentialsQuery = {
  id: 'mcpCredentialsQuery' as const,
  op: 'mcpCredentials',
  query: `query mcpCredentials($workspaceId: String!) {
  mcpCredentialReadWriteAvailable
  mcpCredentials(workspaceId: $workspaceId) {
    id
    name
    workspaceId
    accessMode
    capabilities
    fingerprint
    createdAt
    expiresAt
    lastUsedAt
    revokedAt
    graceEndsAt
    status
    callbackConfigured
  }
}`,
};

export const revokeMcpCredentialMutation = {
  id: 'revokeMcpCredentialMutation' as const,
  op: 'revokeMcpCredential',
  query: `mutation revokeMcpCredential($id: ID!, $workspaceId: String!) {
  revokeMcpCredential(id: $id, workspaceId: $workspaceId)
}`,
};

export const rotateMcpCredentialMutation = {
  id: 'rotateMcpCredentialMutation' as const,
  op: 'rotateMcpCredential',
  query: `mutation rotateMcpCredential($id: ID!, $workspaceId: String!, $expirationDays: Int!) {
  rotateMcpCredential(
    id: $id
    workspaceId: $workspaceId
    expirationDays: $expirationDays
  ) {
    credential {
      id
      name
      workspaceId
      accessMode
      capabilities
      fingerprint
      createdAt
      expiresAt
      lastUsedAt
      revokedAt
      graceEndsAt
      status
      callbackConfigured
    }
    token
    callbackSecret
  }
}`,
};

export const mentionUserMutation = {
  id: 'mentionUserMutation' as const,
  op: 'mentionUser',
  query: `mutation mentionUser($input: MentionInput!) {
  mentionUser(input: $input)
}`,
};

export const officeArtifactQuery = {
  id: 'officeArtifactQuery' as const,
  op: 'officeArtifact',
  query: `query officeArtifact($workspaceId: String!, $artifactId: String!) {
  officeArtifact(workspaceId: $workspaceId, artifactId: $artifactId) {
    id
    workspaceId
    kind
    title
    sourceFileName
    sourceMimeType
    sourceByteSize
    sourceFingerprint
    revisionCounter
    compatibility
    createdBy
    createdAt
    updatedAt
    currentRevision {
      id
      workspaceId
      artifactId
      sequence
      origin
      parentRevisionId
      packageMimeType
      packageByteSize
      packageFingerprint
      stateByteSize
      stateFingerprint
      modelVersion
      operationSummary
      createdBy
      createdAt
      packageUrl
      stateUrl
    }
  }
}`,
};

export const officeArtifactsQuery = {
  id: 'officeArtifactsQuery' as const,
  op: 'officeArtifacts',
  query: `query officeArtifacts($workspaceId: String!, $kind: OfficeArtifactKind, $limit: SafeInt = 50) {
  officeArtifacts(workspaceId: $workspaceId, kind: $kind, limit: $limit) {
    id
    workspaceId
    kind
    title
    sourceFileName
    sourceMimeType
    sourceByteSize
    sourceFingerprint
    revisionCounter
    compatibility
    createdBy
    createdAt
    updatedAt
    currentRevision {
      id
      workspaceId
      artifactId
      sequence
      origin
      parentRevisionId
      packageMimeType
      packageByteSize
      packageFingerprint
      stateByteSize
      stateFingerprint
      modelVersion
      operationSummary
      createdBy
      createdAt
      packageUrl
      stateUrl
    }
  }
}`,
};

export const officeCollaboratorsQuery = {
  id: 'officeCollaboratorsQuery' as const,
  op: 'officeCollaborators',
  query: `query officeCollaborators($workspaceId: String!, $artifactId: String!) {
  officeCollaborators(workspaceId: $workspaceId, artifactId: $artifactId) {
    id
    name
    avatarUrl
  }
}`,
};

export const executeOfficeCommandMutation = {
  id: 'executeOfficeCommandMutation' as const,
  op: 'executeOfficeCommand',
  query: `mutation executeOfficeCommand($input: OfficeCommandInput!) {
  executeOfficeCommand(input: $input) {
    created
    artifact {
      id
      workspaceId
      kind
      title
      sourceFileName
      sourceMimeType
      sourceByteSize
      sourceFingerprint
      revisionCounter
      compatibility
      createdBy
      createdAt
      updatedAt
      currentRevision {
        id
        workspaceId
        artifactId
        sequence
        origin
        parentRevisionId
        packageMimeType
        packageByteSize
        packageFingerprint
        stateByteSize
        stateFingerprint
        modelVersion
        operationSummary
        createdBy
        createdAt
        packageUrl
        stateUrl
      }
    }
    revision {
      id
      workspaceId
      artifactId
      sequence
      origin
      parentRevisionId
      packageMimeType
      packageByteSize
      packageFingerprint
      stateByteSize
      stateFingerprint
      modelVersion
      operationSummary
      createdBy
      createdAt
      packageUrl
      stateUrl
    }
    summary
  }
}`,
};

export const previewOfficeCommandQuery = {
  id: 'previewOfficeCommandQuery' as const,
  op: 'previewOfficeCommand',
  query: `query previewOfficeCommand($input: OfficeCommandInput!) {
  previewOfficeCommand(input: $input) {
    artifactId
    expectedRevisionId
    packageFingerprint
    stateFingerprint
    stats
    summary
  }
}`,
};

export const createOfficeCommentMutation = {
  id: 'createOfficeCommentMutation' as const,
  op: 'createOfficeComment',
  query: `mutation createOfficeComment($input: OfficeCommentCreateInput!) {
  createOfficeComment(input: $input) {
    ...OfficeCommentFields
  }
}
${officeCommentFieldsFragment}`,
};

export const deleteOfficeCommentMutation = {
  id: 'deleteOfficeCommentMutation' as const,
  op: 'deleteOfficeComment',
  query: `mutation deleteOfficeComment($id: String!) {
  deleteOfficeComment(id: $id)
}`,
};

export const createOfficeCommentReplyMutation = {
  id: 'createOfficeCommentReplyMutation' as const,
  op: 'createOfficeCommentReply',
  query: `mutation createOfficeCommentReply($input: OfficeCommentReplyCreateInput!) {
  createOfficeCommentReply(input: $input) {
    ...OfficeCommentReplyFields
  }
}
${officeCommentReplyFieldsFragment}`,
};

export const deleteOfficeCommentReplyMutation = {
  id: 'deleteOfficeCommentReplyMutation' as const,
  op: 'deleteOfficeCommentReply',
  query: `mutation deleteOfficeCommentReply($id: String!) {
  deleteOfficeCommentReply(id: $id)
}`,
};

export const updateOfficeCommentReplyMutation = {
  id: 'updateOfficeCommentReplyMutation' as const,
  op: 'updateOfficeCommentReply',
  query: `mutation updateOfficeCommentReply($input: OfficeCommentReplyUpdateInput!) {
  updateOfficeCommentReply(input: $input) {
    ...OfficeCommentReplyFields
  }
}
${officeCommentReplyFieldsFragment}`,
};

export const resolveOfficeCommentMutation = {
  id: 'resolveOfficeCommentMutation' as const,
  op: 'resolveOfficeComment',
  query: `mutation resolveOfficeComment($input: OfficeCommentResolveInput!) {
  resolveOfficeComment(input: $input) {
    ...OfficeCommentFields
  }
}
${officeCommentFieldsFragment}`,
};

export const updateOfficeCommentMutation = {
  id: 'updateOfficeCommentMutation' as const,
  op: 'updateOfficeComment',
  query: `mutation updateOfficeComment($input: OfficeCommentUpdateInput!) {
  updateOfficeComment(input: $input) {
    ...OfficeCommentFields
  }
}
${officeCommentFieldsFragment}`,
};

export const officeCommentsQuery = {
  id: 'officeCommentsQuery' as const,
  op: 'officeComments',
  query: `query officeComments($workspaceId: String!, $artifactId: String!) {
  officeComments(workspaceId: $workspaceId, artifactId: $artifactId) {
    ...OfficeCommentFields
  }
}
${officeCommentFieldsFragment}`,
};

export const executeOfficeDocxCommandMutation = {
  id: 'executeOfficeDocxCommandMutation' as const,
  op: 'executeOfficeDocxCommand',
  query: `mutation executeOfficeDocxCommand($input: OfficeDocxCommandInput!) {
  executeOfficeDocxCommand(input: $input) {
    created
    artifact {
      id
      workspaceId
      kind
      title
      revisionCounter
      currentRevision {
        id
        sequence
        origin
        packageFingerprint
        stateFingerprint
        modelVersion
        operationSummary
        createdBy
        createdAt
        packageUrl
        stateUrl
      }
    }
    revision {
      id
      sequence
      origin
      packageFingerprint
      stateFingerprint
      operationSummary
      packageUrl
      stateUrl
    }
    summary
  }
}`,
};

export const previewOfficeDocxCommandQuery = {
  id: 'previewOfficeDocxCommandQuery' as const,
  op: 'previewOfficeDocxCommand',
  query: `query previewOfficeDocxCommand($input: OfficeDocxCommandInput!) {
  previewOfficeDocxCommand(input: $input) {
    artifactId
    expectedRevisionId
    packageFingerprint
    stateFingerprint
    stats
    summary
  }
}`,
};

export const importOfficeDocxMutation = {
  id: 'importOfficeDocxMutation' as const,
  op: 'importOfficeDocx',
  query: `mutation importOfficeDocx($input: ImportOfficeDocxRequestInput!) {
  importOfficeDocx(input: $input) {
    created
    artifact {
      id
      workspaceId
      kind
      title
      sourceFileName
      sourceMimeType
      sourceByteSize
      sourceFingerprint
      revisionCounter
      compatibility
      createdBy
      createdAt
      updatedAt
      currentRevision {
        id
        sequence
        origin
        packageMimeType
        packageByteSize
        packageFingerprint
        stateByteSize
        stateFingerprint
        modelVersion
        operationSummary
        createdBy
        createdAt
        packageUrl
        stateUrl
      }
    }
    revision {
      id
      sequence
      origin
      packageFingerprint
      stateFingerprint
      packageUrl
      stateUrl
    }
  }
}`,
};

export const importOfficeArtifactMutation = {
  id: 'importOfficeArtifactMutation' as const,
  op: 'importOfficeArtifact',
  query: `mutation importOfficeArtifact($input: ImportOfficeArtifactRequestInput!) {
  importOfficeArtifact(input: $input) {
    created
    artifact {
      id
      workspaceId
      kind
      title
      sourceFileName
      sourceMimeType
      sourceByteSize
      sourceFingerprint
      revisionCounter
      compatibility
      createdBy
      createdAt
      updatedAt
      currentRevision {
        id
        sequence
        origin
        packageMimeType
        packageByteSize
        packageFingerprint
        stateByteSize
        stateFingerprint
        modelVersion
        operationSummary
        createdBy
        createdAt
        packageUrl
        stateUrl
      }
    }
    revision {
      id
      sequence
      origin
      packageFingerprint
      stateFingerprint
      packageUrl
      stateUrl
    }
  }
}`,
};

export const officeRevisionCompareQuery = {
  id: 'officeRevisionCompareQuery' as const,
  op: 'officeRevisionCompare',
  query: `query officeRevisionCompare($workspaceId: String!, $artifactId: String!, $beforeRevisionId: String!, $afterRevisionId: String!) {
  officeRevisionCompare(
    workspaceId: $workspaceId
    artifactId: $artifactId
    beforeRevisionId: $beforeRevisionId
    afterRevisionId: $afterRevisionId
  ) {
    artifactId
    kind
    changed
    truncated
    summary
    changes
    beforeRevision {
      id
      sequence
      origin
      createdAt
      createdBy
      operationSummary
      packageFingerprint
      stateFingerprint
      packageUrl
      stateUrl
    }
    afterRevision {
      id
      sequence
      origin
      createdAt
      createdBy
      operationSummary
      packageFingerprint
      stateFingerprint
      packageUrl
      stateUrl
    }
  }
}`,
};

export const officeRevisionsQuery = {
  id: 'officeRevisionsQuery' as const,
  op: 'officeRevisions',
  query: `query officeRevisions($workspaceId: String!, $artifactId: String!, $limit: SafeInt = 50) {
  officeRevisions(
    workspaceId: $workspaceId
    artifactId: $artifactId
    limit: $limit
  ) {
    id
    workspaceId
    artifactId
    sequence
    origin
    parentRevisionId
    packageMimeType
    packageByteSize
    packageFingerprint
    stateByteSize
    stateFingerprint
    modelVersion
    operationSummary
    createdBy
    createdAt
    packageUrl
    stateUrl
  }
}`,
};

export const permanentlyDeleteProjectResourceMutation = {
  id: 'permanentlyDeleteProjectResourceMutation' as const,
  op: 'permanentlyDeleteProjectResource',
  query: `mutation permanentlyDeleteProjectResource($input: PermanentlyDeleteProjectResourceInput!) {
  permanentlyDeleteProjectResource(input: $input)
}`,
};

export const prepareProjectPublicationMutation = {
  id: 'prepareProjectPublicationMutation' as const,
  op: 'prepareProjectPublication',
  query: `mutation prepareProjectPublication($projectId: String!, $resourceId: String!, $kind: String!, $requestKey: String!, $sessionId: String) {
  prepareProjectPublication(
    projectId: $projectId
    resourceId: $resourceId
    kind: $kind
    requestKey: $requestKey
    sessionId: $sessionId
  ) {
    ...ProjectPublicationFields
  }
}
${projectPublicationFieldsFragment}`,
};

export const previewProjectOfficeCommandQuery = {
  id: 'previewProjectOfficeCommandQuery' as const,
  op: 'previewProjectOfficeCommand',
  query: `query previewProjectOfficeCommand($input: ProjectOfficeCommandInput!) {
  previewProjectOfficeCommand(input: $input) {
    artifactId
    expectedRevisionId
    packageFingerprint
    stateFingerprint
    stats
    summary
  }
}`,
};

export const previewProjectPublicationMutation = {
  id: 'previewProjectPublicationMutation' as const,
  op: 'previewProjectPublication',
  query: `mutation previewProjectPublication($projectId: String!, $publicationId: String!, $expectedRevision: Int!, $workspaceId: String!, $folderId: String, $targetResourceId: String) {
  previewProjectPublication(
    projectId: $projectId
    publicationId: $publicationId
    expectedRevision: $expectedRevision
    workspaceId: $workspaceId
    folderId: $folderId
    targetResourceId: $targetResourceId
  ) {
    ...ProjectPublicationFields
  }
}
${projectPublicationFieldsFragment}`,
};

export const pricesQuery = {
  id: 'pricesQuery' as const,
  op: 'prices',
  query: `query prices {
  prices {
    type
    plan
    currency
    amount
    yearlyAmount
    lifetimeAmount
  }
}`,
};

export const projectAgentTaskQuery = {
  id: 'projectAgentTaskQuery' as const,
  op: 'projectAgentTask',
  query: `query projectAgentTask($projectId: String!, $runId: String!) {
  projectAgentTask(projectId: $projectId, runId: $runId) {
    ...ProjectAgentTaskFields
  }
}
${projectAgentTaskFieldsFragment}`,
};

export const projectAgentTasksQuery = {
  id: 'projectAgentTasksQuery' as const,
  op: 'projectAgentTasks',
  query: `query projectAgentTasks($projectId: String!, $sessionId: String, $cursor: String, $limit: Int) {
  projectAgentTasks(
    projectId: $projectId
    sessionId: $sessionId
    cursor: $cursor
    limit: $limit
  ) {
    items {
      ...ProjectAgentTaskFields
    }
    nextCursor
  }
}
${projectAgentTaskFieldsFragment}`,
};

export const projectAiModelQuery = {
  id: 'projectAiModelQuery' as const,
  op: 'projectAiModel',
  query: `query projectAiModel($projectId: String!) {
  projectAiModel(projectId: $projectId) {
    configured
    modelId
    provider
  }
}`,
};

export const projectChatContextQuery = {
  id: 'projectChatContextQuery' as const,
  op: 'projectChatContext',
  query: `query projectChatContext($projectId: String!, $sessionId: String!) {
  projectChatContext(projectId: $projectId, sessionId: $sessionId) {
    ...ProjectChatContextFields
  }
}
${projectChatContextFieldsFragment}`,
};

export const projectCopilotChatQuery = {
  id: 'projectCopilotChatQuery' as const,
  op: 'projectCopilotChat',
  query: `query projectCopilotChat($projectId: String!, $sessionId: String!) {
  currentUser {
    copilot {
      projectChat(projectId: $projectId, sessionId: $sessionId) {
        ...CopilotChatHistory
      }
    }
  }
}
${copilotChatHistoryFragment}`,
};

export const projectCopilotChatsQuery = {
  id: 'projectCopilotChatsQuery' as const,
  op: 'projectCopilotChats',
  query: `query projectCopilotChats($projectId: String!, $pagination: PaginationInput!, $options: QueryChatHistoriesInput) {
  currentUser {
    copilot {
      projectChats(projectId: $projectId, pagination: $pagination, options: $options) {
        totalCount
        edges {
          cursor
          node {
            ...CopilotChatHistory
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
${copilotChatHistoryFragment}`,
};

export const projectDestinationFoldersQuery = {
  id: 'projectDestinationFoldersQuery' as const,
  op: 'projectDestinationFolders',
  query: `query projectDestinationFolders($projectId: String!, $workspaceId: String!, $parentId: String, $query: String, $cursor: String, $limit: Int) {
  projectDestinationFolders(
    projectId: $projectId
    workspaceId: $workspaceId
    parentId: $parentId
    query: $query
    cursor: $cursor
    limit: $limit
  ) {
    current {
      workspaceId
      folderId
      path {
        id
        name
      }
      fingerprint
      canSave
      canCreateFolder
    }
    revision
    items {
      workspaceId
      folderId
      path {
        id
        name
      }
      fingerprint
      canSave
      canCreateFolder
    }
    nextCursor
  }
}`,
};

export const projectDestinationWorkspacesQuery = {
  id: 'projectDestinationWorkspacesQuery' as const,
  op: 'projectDestinationWorkspaces',
  query: `query projectDestinationWorkspaces($projectId: String!) {
  projectDestinationWorkspaces(projectId: $projectId) {
    id
    name
  }
}`,
};

export const projectFileRequestRecipientsQuery = {
  id: 'projectFileRequestRecipientsQuery' as const,
  op: 'projectFileRequestRecipients',
  query: `query projectFileRequestRecipients($projectId: String!, $query: String!) {
  projectFileRequestRecipients(projectId: $projectId, query: $query) {
    id
    name
  }
}`,
};

export const projectFileRequestQuery = {
  id: 'projectFileRequestQuery' as const,
  op: 'projectFileRequest',
  query: `query projectFileRequest($requestId: String!) {
  projectFileRequest(requestId: $requestId) {
    ...ProjectFileRequestFields
  }
}
${projectFileRequestFieldsFragment}`,
};

export const projectImportSourcesQuery = {
  id: 'projectImportSourcesQuery' as const,
  op: 'projectImportSources',
  query: `query projectImportSources($projectId: String!, $workspaceId: String!, $query: String, $cursor: String) {
  projectImportSources(
    projectId: $projectId
    workspaceId: $workspaceId
    query: $query
    cursor: $cursor
  ) {
    items {
      id
      title
      kind
      permission
    }
    nextCursor
  }
}`,
};

export const projectImportWorkspacesQuery = {
  id: 'projectImportWorkspacesQuery' as const,
  op: 'projectImportWorkspaces',
  query: `query projectImportWorkspaces($projectId: String!, $cursor: String) {
  projectImportWorkspaces(projectId: $projectId, cursor: $cursor) {
    items {
      id
      name
    }
    nextCursor
  }
}`,
};

export const projectOfficeArtifactQuery = {
  id: 'projectOfficeArtifactQuery' as const,
  op: 'projectOfficeArtifact',
  query: `query projectOfficeArtifact($projectId: String!, $artifactId: String!) {
  projectOfficeArtifact(projectId: $projectId, artifactId: $artifactId) {
    ...ProjectOfficeArtifactFields
  }
}
${projectOfficeArtifactFieldsFragment}`,
};

export const projectOfficeRevisionCompareQuery = {
  id: 'projectOfficeRevisionCompareQuery' as const,
  op: 'projectOfficeRevisionCompare',
  query: `query projectOfficeRevisionCompare($projectId: String!, $artifactId: String!, $beforeRevisionId: String!, $afterRevisionId: String!) {
  projectOfficeRevisionCompare(
    projectId: $projectId
    artifactId: $artifactId
    beforeRevisionId: $beforeRevisionId
    afterRevisionId: $afterRevisionId
  ) {
    artifactId
    kind
    beforeRevision {
      ...ProjectOfficeRevisionFields
    }
    afterRevision {
      ...ProjectOfficeRevisionFields
    }
    changed
    truncated
    summary
    changes
  }
}
${projectOfficeRevisionFieldsFragment}`,
};

export const projectOfficeRevisionsQuery = {
  id: 'projectOfficeRevisionsQuery' as const,
  op: 'projectOfficeRevisions',
  query: `query projectOfficeRevisions($projectId: String!, $artifactId: String!, $limit: SafeInt) {
  projectOfficeRevisions(
    projectId: $projectId
    artifactId: $artifactId
    limit: $limit
  ) {
    ...ProjectOfficeRevisionFields
  }
}
${projectOfficeRevisionFieldsFragment}`,
};

export const projectPublicationCandidatesQuery = {
  id: 'projectPublicationCandidatesQuery' as const,
  op: 'projectPublicationCandidates',
  query: `query projectPublicationCandidates($projectId: String!, $resourceId: String!, $workspaceId: String!, $parentId: String, $query: String, $cursor: String) {
  projectPublicationCandidates(
    projectId: $projectId
    resourceId: $resourceId
    workspaceId: $workspaceId
    parentId: $parentId
    query: $query
    cursor: $cursor
  ) {
    items {
      resourceId
      title
      kind
      folderId
      path {
        id
        name
      }
      canUpdate
    }
    nextCursor
  }
}`,
};

export const projectPublicationQuery = {
  id: 'projectPublicationQuery' as const,
  op: 'projectPublication',
  query: `query projectPublication($projectId: String!, $publicationId: String!) {
  projectPublication(projectId: $projectId, publicationId: $publicationId) {
    ...ProjectPublicationFields
  }
}
${projectPublicationFieldsFragment}`,
};

export const projectPublicationsQuery = {
  id: 'projectPublicationsQuery' as const,
  op: 'projectPublications',
  query: `query projectPublications($projectId: String!, $resourceId: String, $cursor: String, $limit: Int) {
  projectPublications(
    projectId: $projectId
    resourceId: $resourceId
    cursor: $cursor
    limit: $limit
  ) {
    items {
      ...ProjectPublicationFields
    }
    nextCursor
  }
}
${projectPublicationFieldsFragment}`,
};

export const projectResourceEditLeaseQuery = {
  id: 'projectResourceEditLeaseQuery' as const,
  op: 'projectResourceEditLease',
  query: `query projectResourceEditLease($input: ProjectEditLeaseInput!) {
  projectResourceEditLease(input: $input) {
    ...ProjectEditLeaseFields
  }
}
${projectEditLeaseFieldsFragment}`,
};

export const projectResourcePathQuery = {
  id: 'projectResourcePathQuery' as const,
  op: 'projectResourcePath',
  query: `query projectResourcePath($projectId: String!, $resourceId: String!) {
  projectResourcePath(projectId: $projectId, resourceId: $resourceId) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const projectResourceRevisionQuery = {
  id: 'projectResourceRevisionQuery' as const,
  op: 'projectResourceRevision',
  query: `query projectResourceRevision($projectId: String!, $resourceId: String!, $sequence: Int) {
  projectResourceRevision(
    projectId: $projectId
    resourceId: $resourceId
    sequence: $sequence
  ) {
    id
    projectId
    resourceId
    sequence
    parentId
    fingerprint
    origin
    createdAt
  }
}`,
};

export const projectResourceSourcesQuery = {
  id: 'projectResourceSourcesQuery' as const,
  op: 'projectResourceSources',
  query: `query projectResourceSources($projectId: String!, $resourceId: String!) {
  projectResourceSources(projectId: $projectId, resourceId: $resourceId) {
    workspaceId
    sourceResourceId
    title
    workspaceName
    sourceVersion
    projectVersion
  }
}`,
};

export const projectResourceQuery = {
  id: 'projectResourceQuery' as const,
  op: 'projectResource',
  query: `query projectResource($projectId: String!, $resourceId: String!) {
  projectResource(projectId: $projectId, resourceId: $resourceId) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const projectResourcesQuery = {
  id: 'projectResourcesQuery' as const,
  op: 'projectResources',
  query: `query projectResources($projectId: String!, $parentId: String, $cursor: String, $limit: Int, $trash: Boolean, $search: String) {
  projectResources(
    projectId: $projectId
    parentId: $parentId
    cursor: $cursor
    limit: $limit
    trash: $trash
    search: $search
  ) {
    items {
      ...ProjectResourceFields
    }
    nextCursor
  }
}
${projectResourceFieldsFragment}`,
};

export const projectSummariesQuery = {
  id: 'projectSummariesQuery' as const,
  op: 'projectSummaries',
  query: `query projectSummaries {
  currentUser {
    copilot {
      contextMemories {
        id
        projectId
        kind
        content
        updatedAt
      }
    }
  }
}`,
};

export const projectWorkspaceImportsQuery = {
  id: 'projectWorkspaceImportsQuery' as const,
  op: 'projectWorkspaceImports',
  query: `query projectWorkspaceImports($projectId: String!, $parentId: ID, $cursor: String) {
  projectWorkspaceImports(
    projectId: $projectId
    parentId: $parentId
    cursor: $cursor
  ) {
    items {
      ...ProjectWorkspaceImportTask
    }
    nextCursor
  }
}
${projectWorkspaceImportTaskFragment}`,
};

export const publishPageMutation = {
  id: 'publishPageMutation' as const,
  op: 'publishPage',
  query: `mutation publishPage($workspaceId: String!, $pageId: String!, $mode: PublicDocMode = Page) {
  publishDoc(workspaceId: $workspaceId, docId: $pageId, mode: $mode) {
    id
    mode
  }
}`,
};

export const quotaQuery = {
  id: 'quotaQuery' as const,
  op: 'quota',
  query: `query quota {
  currentUser {
    id
    quota {
      name
      blobLimit
      storageQuota
      historyPeriod
      memberLimit
      humanReadable {
        name
        blobLimit
        storageQuota
        historyPeriod
        memberLimit
      }
    }
    quotaUsage {
      storageQuota
    }
  }
}`,
  deprecations: ["'storageQuota' is deprecated: use `UserQuotaType['usedStorageQuota']` instead"],
};

export const readAllNotificationsMutation = {
  id: 'readAllNotificationsMutation' as const,
  op: 'readAllNotifications',
  query: `mutation readAllNotifications {
  readAllNotifications
}`,
};

export const readNotificationMutation = {
  id: 'readNotificationMutation' as const,
  op: 'readNotification',
  query: `mutation readNotification($id: String!) {
  readNotification(id: $id)
}`,
};

export const recoverDocMutation = {
  id: 'recoverDocMutation' as const,
  op: 'recoverDoc',
  query: `mutation recoverDoc($workspaceId: String!, $docId: String!, $timestamp: DateTime!) {
  recoverDoc(workspaceId: $workspaceId, guid: $docId, timestamp: $timestamp)
}`,
};

export const refreshProjectResourceSourceMutation = {
  id: 'refreshProjectResourceSourceMutation' as const,
  op: 'refreshProjectResourceSource',
  query: `mutation refreshProjectResourceSource($projectId: String!, $resourceId: String!, $workspaceId: String!, $sourceResourceId: String!, $expectedContentVersion: Int!, $expectedSourceVersion: String!, $requestKey: String!, $editLease: ProjectEditLeaseProofInput!) {
  refreshProjectResourceSource(
    projectId: $projectId
    resourceId: $resourceId
    workspaceId: $workspaceId
    sourceResourceId: $sourceResourceId
    expectedContentVersion: $expectedContentVersion
    expectedSourceVersion: $expectedSourceVersion
    requestKey: $requestKey
    editLease: $editLease
  ) {
    ...ProjectResourceFields
  }
}
${projectResourceFieldsFragment}`,
};

export const releaseProjectResourceEditLeaseMutation = {
  id: 'releaseProjectResourceEditLeaseMutation' as const,
  op: 'releaseProjectResourceEditLease',
  query: `mutation releaseProjectResourceEditLease($input: ProjectEditLeaseChangeInput!) {
  releaseProjectResourceEditLease(input: $input)
}`,
};

export const removeAvatarMutation = {
  id: 'removeAvatarMutation' as const,
  op: 'removeAvatar',
  query: `mutation removeAvatar {
  removeAvatar {
    success
  }
}`,
};

export const renewProjectResourceEditLeaseMutation = {
  id: 'renewProjectResourceEditLeaseMutation' as const,
  op: 'renewProjectResourceEditLease',
  query: `mutation renewProjectResourceEditLease($input: ProjectEditLeaseChangeInput!) {
  renewProjectResourceEditLease(input: $input) {
    acquired
    lease {
      ...ProjectEditLeaseFields
    }
  }
}
${projectEditLeaseFieldsFragment}`,
};

export const requestProjectImportPermissionMutation = {
  id: 'requestProjectImportPermissionMutation' as const,
  op: 'requestProjectImportPermission',
  query: `mutation requestProjectImportPermission($projectId: String!, $workspaceId: String!, $resourceId: String!, $requestKey: String!) {
  requestProjectImportPermission(
    projectId: $projectId
    workspaceId: $workspaceId
    resourceId: $resourceId
    requestKey: $requestKey
  ) {
    id
    status
    purpose
  }
}`,
};

export const resumeSubscriptionMutation = {
  id: 'resumeSubscriptionMutation' as const,
  op: 'resumeSubscription',
  query: `mutation resumeSubscription($plan: SubscriptionPlan = Pro, $workspaceId: String) {
  resumeSubscription(plan: $plan, workspaceId: $workspaceId) {
    id
    status
    nextBillAt
    start
    end
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const retryProjectWorkspaceImportMutation = {
  id: 'retryProjectWorkspaceImportMutation' as const,
  op: 'retryProjectWorkspaceImport',
  query: `mutation retryProjectWorkspaceImport($projectId: String!, $runId: String!) {
  retryProjectWorkspaceImport(projectId: $projectId, runId: $runId) {
    ...ProjectWorkspaceImportTask
  }
}
${projectWorkspaceImportTaskFragment}`,
};

export const revokeDocUserRolesMutation = {
  id: 'revokeDocUserRolesMutation' as const,
  op: 'revokeDocUserRoles',
  query: `mutation revokeDocUserRoles($input: RevokeDocUserRoleInput!) {
  revokeDocUserRoles(input: $input)
}`,
};

export const revokeMemberPermissionMutation = {
  id: 'revokeMemberPermissionMutation' as const,
  op: 'revokeMemberPermission',
  query: `mutation revokeMemberPermission($workspaceId: String!, $userId: String!) {
  revokeMember(workspaceId: $workspaceId, userId: $userId)
}`,
};

export const revokePublicPageMutation = {
  id: 'revokePublicPageMutation' as const,
  op: 'revokePublicPage',
  query: `mutation revokePublicPage($workspaceId: String!, $pageId: String!) {
  revokePublicDoc(workspaceId: $workspaceId, docId: $pageId) {
    id
    mode
    public
  }
}`,
};

export const saveProjectDocumentMutation = {
  id: 'saveProjectDocumentMutation' as const,
  op: 'saveProjectDocument',
  query: `mutation saveProjectDocument($input: SaveProjectDocumentInput!) {
  saveProjectDocument(input: $input) {
    id
    projectId
    resourceId
    sequence
    parentId
    fingerprint
    origin
    createdAt
  }
}`,
};

export const searchProjectResourcesQuery = {
  id: 'searchProjectResourcesQuery' as const,
  op: 'searchProjectResources',
  query: `query searchProjectResources($projectId: String!, $query: String!, $cursor: String, $limit: Int) {
  searchProjectResources(
    projectId: $projectId
    query: $query
    cursor: $cursor
    limit: $limit
  ) {
    items {
      id
      projectId
      title
      kind
      contentVersion
      snippet
      path {
        id
        title
      }
    }
    nextCursor
  }
}`,
};

export const sendChangeEmailMutation = {
  id: 'sendChangeEmailMutation' as const,
  op: 'sendChangeEmail',
  query: `mutation sendChangeEmail($callbackUrl: String!) {
  sendChangeEmail(callbackUrl: $callbackUrl)
}`,
};

export const sendChangePasswordEmailMutation = {
  id: 'sendChangePasswordEmailMutation' as const,
  op: 'sendChangePasswordEmail',
  query: `mutation sendChangePasswordEmail($callbackUrl: String!) {
  sendChangePasswordEmail(callbackUrl: $callbackUrl)
}`,
};

export const sendSetPasswordEmailMutation = {
  id: 'sendSetPasswordEmailMutation' as const,
  op: 'sendSetPasswordEmail',
  query: `mutation sendSetPasswordEmail($callbackUrl: String!) {
  sendSetPasswordEmail(callbackUrl: $callbackUrl)
}`,
};

export const sendVerifyChangeEmailMutation = {
  id: 'sendVerifyChangeEmailMutation' as const,
  op: 'sendVerifyChangeEmail',
  query: `mutation sendVerifyChangeEmail($token: String!, $email: String!, $callbackUrl: String!) {
  sendVerifyChangeEmail(token: $token, email: $email, callbackUrl: $callbackUrl)
}`,
};

export const sendVerifyEmailMutation = {
  id: 'sendVerifyEmailMutation' as const,
  op: 'sendVerifyEmail',
  query: `mutation sendVerifyEmail($callbackUrl: String!) {
  sendVerifyEmail(callbackUrl: $callbackUrl)
}`,
};

export const serverConfigQuery = {
  id: 'serverConfigQuery' as const,
  op: 'serverConfig',
  query: `query serverConfig {
  serverConfig {
    version
    baseUrl
    name
    features
    type
    initialized
    calendarProviders
    credentialsRequirement {
      ...CredentialsRequirements
    }
  }
}
${passwordLimitsFragment}
${credentialsRequirementsFragment}`,
};

export const setWorkspacePublicByIdMutation = {
  id: 'setWorkspacePublicByIdMutation' as const,
  op: 'setWorkspacePublicById',
  query: `mutation setWorkspacePublicById($id: ID!, $public: Boolean!) {
  updateWorkspace(input: {id: $id, public: $public}) {
    id
  }
}`,
};

export const submitProjectFileRequestMutation = {
  id: 'submitProjectFileRequestMutation' as const,
  op: 'submitProjectFileRequest',
  query: `mutation submitProjectFileRequest($requestId: String!, $expectedVersion: Int!, $shareWithProject: Boolean!, $file: Upload!) {
  submitProjectFileRequest(
    requestId: $requestId
    expectedVersion: $expectedVersion
    shareWithProject: $shareWithProject
    file: $file
  ) {
    ...ProjectFileRequestFields
  }
}
${projectFileRequestFieldsFragment}`,
  file: true,
};

export const submitProjectWorkspaceImportMutation = {
  id: 'submitProjectWorkspaceImportMutation' as const,
  op: 'submitProjectWorkspaceImport',
  query: `mutation submitProjectWorkspaceImport($input: SubmitProjectWorkspaceImportInput!) {
  submitProjectWorkspaceImport(input: $input) {
    ...ProjectWorkspaceImportTask
  }
}
${projectWorkspaceImportTaskFragment}`,
};

export const refreshSubscriptionMutation = {
  id: 'refreshSubscriptionMutation' as const,
  op: 'refreshSubscription',
  query: `mutation refreshSubscription {
  refreshUserSubscriptions {
    id
    status
    plan
    recurring
    start
    end
    nextBillAt
    canceledAt
    variant
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const requestApplySubscriptionMutation = {
  id: 'requestApplySubscriptionMutation' as const,
  op: 'requestApplySubscription',
  query: `mutation requestApplySubscription($transactionId: String!) {
  requestApplySubscription(transactionId: $transactionId) {
    id
    status
    plan
    recurring
    start
    end
    nextBillAt
    canceledAt
    variant
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const subscriptionQuery = {
  id: 'subscriptionQuery' as const,
  op: 'subscription',
  query: `query subscription {
  currentUser {
    id
    subscriptions {
      id
      status
      plan
      recurring
      start
      end
      nextBillAt
      canceledAt
      variant
    }
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const updateDocDefaultRoleMutation = {
  id: 'updateDocDefaultRoleMutation' as const,
  op: 'updateDocDefaultRole',
  query: `mutation updateDocDefaultRole($input: UpdateDocDefaultRoleInput!) {
  updateDocDefaultRole(input: $input)
}`,
};

export const updateDocUserRoleMutation = {
  id: 'updateDocUserRoleMutation' as const,
  op: 'updateDocUserRole',
  query: `mutation updateDocUserRole($input: UpdateDocUserRoleInput!) {
  updateDocUserRole(input: $input)
}`,
};

export const updateProjectChatContextMutation = {
  id: 'updateProjectChatContextMutation' as const,
  op: 'updateProjectChatContext',
  query: `mutation updateProjectChatContext($projectId: String!, $sessionId: String!, $expectedVersion: Int!, $items: [ProjectChatContextItemInput!]!) {
  updateProjectChatContext(
    projectId: $projectId
    sessionId: $sessionId
    expectedVersion: $expectedVersion
    items: $items
  ) {
    ...ProjectChatContextFields
  }
}
${projectChatContextFieldsFragment}`,
};

export const updateSubscriptionMutation = {
  id: 'updateSubscriptionMutation' as const,
  op: 'updateSubscription',
  query: `mutation updateSubscription($plan: SubscriptionPlan = Pro, $recurring: SubscriptionRecurring!, $workspaceId: String) {
  updateSubscriptionRecurring(
    plan: $plan
    recurring: $recurring
    workspaceId: $workspaceId
  ) {
    id
    plan
    recurring
    nextBillAt
  }
}`,
  deprecations: ["'id' is deprecated: removed"],
};

export const updateUserProfileMutation = {
  id: 'updateUserProfileMutation' as const,
  op: 'updateUserProfile',
  query: `mutation updateUserProfile($input: UpdateUserInput!) {
  updateProfile(input: $input) {
    id
    name
  }
}`,
};

export const updateUserSettingsMutation = {
  id: 'updateUserSettingsMutation' as const,
  op: 'updateUserSettings',
  query: `mutation updateUserSettings($input: UpdateUserSettingsInput!) {
  updateSettings(input: $input)
}`,
};

export const uploadAvatarMutation = {
  id: 'uploadAvatarMutation' as const,
  op: 'uploadAvatar',
  query: `mutation uploadAvatar($avatar: Upload!) {
  uploadAvatar(avatar: $avatar) {
    id
    name
    avatarUrl
    email
  }
}`,
  file: true,
};

export const uploadProjectBlobMutation = {
  id: 'uploadProjectBlobMutation' as const,
  op: 'uploadProjectBlob',
  query: `mutation uploadProjectBlob($projectId: String!, $file: Upload!) {
  uploadProjectBlob(projectId: $projectId, file: $file)
}`,
  file: true,
};

export const uploadProjectChatContextFileMutation = {
  id: 'uploadProjectChatContextFileMutation' as const,
  op: 'uploadProjectChatContextFile',
  query: `mutation uploadProjectChatContextFile($projectId: String!, $sessionId: String!, $expectedVersion: Int!, $file: Upload!) {
  uploadProjectChatContextFile(
    projectId: $projectId
    sessionId: $sessionId
    expectedVersion: $expectedVersion
    file: $file
  ) {
    ...ProjectChatContextFields
  }
}
${projectChatContextFieldsFragment}`,
  file: true,
};

export const verifyEmailMutation = {
  id: 'verifyEmailMutation' as const,
  op: 'verifyEmail',
  query: `mutation verifyEmail($token: String!) {
  verifyEmail(token: $token)
}`,
};

export const workspaceBlobQuotaQuery = {
  id: 'workspaceBlobQuotaQuery' as const,
  op: 'workspaceBlobQuota',
  query: `query workspaceBlobQuota($id: String!) {
  workspace(id: $id) {
    quota {
      blobLimit
      humanReadable {
        blobLimit
      }
    }
  }
}`,
};

export const clearWorkspaceByokConfigsMutation = {
  id: 'clearWorkspaceByokConfigsMutation' as const,
  op: 'clearWorkspaceByokConfigs',
  query: `mutation clearWorkspaceByokConfigs($workspaceId: String!) {
  clearWorkspaceByokConfigs(workspaceId: $workspaceId)
}`,
};

export const deleteWorkspaceByokConfigMutation = {
  id: 'deleteWorkspaceByokConfigMutation' as const,
  op: 'deleteWorkspaceByokConfig',
  query: `mutation deleteWorkspaceByokConfig($workspaceId: String!, $id: ID!) {
  deleteWorkspaceByokConfig(workspaceId: $workspaceId, id: $id)
}`,
};

export const reorderWorkspaceByokConfigsMutation = {
  id: 'reorderWorkspaceByokConfigsMutation' as const,
  op: 'reorderWorkspaceByokConfigs',
  query: `mutation reorderWorkspaceByokConfigs($input: ReorderWorkspaceByokConfigsInput!) {
  reorderWorkspaceByokConfigs(input: $input) {
    id
    sortOrder
  }
}`,
};

export const testWorkspaceByokConfigMutation = {
  id: 'testWorkspaceByokConfigMutation' as const,
  op: 'testWorkspaceByokConfig',
  query: `mutation testWorkspaceByokConfig($input: TestWorkspaceByokConfigInput!) {
  testWorkspaceByokConfig(input: $input) {
    ok
    status
    message
  }
}`,
};

export const upsertWorkspaceByokConfigMutation = {
  id: 'upsertWorkspaceByokConfigMutation' as const,
  op: 'upsertWorkspaceByokConfig',
  query: `mutation upsertWorkspaceByokConfig($input: UpsertWorkspaceByokConfigInput!) {
  upsertWorkspaceByokConfig(input: $input) {
    id
  }
}`,
};

export const workspaceByokSettingsQuery = {
  id: 'workspaceByokSettingsQuery' as const,
  op: 'workspaceByokSettings',
  query: `query workspaceByokSettings($id: String!, $from: DateTime!, $to: DateTime!) {
  workspace(id: $id) {
    id
    byokSettings {
      workspaceId
      entitled
      serverEntitled
      localEntitled
      entitlementRequired
      allowedProviders
      localStorageSupported
      customEndpointSupported
      privateEndpointSupported
      hasAiPlan
      keys {
        id
        provider
        name
        description
        storage
        configured
        enabled
        endpoint
        modelId
        endpointEditable
        sortOrder
        capabilities
        testStatus
        disabledReason
        lastTestedAt
        lastTestError
        lastUsedAt
        lastErrorAt
        lastError
      }
      warnings {
        featureKind
        reason
        requiredProviders
      }
    }
    byokUsage(from: $from, to: $to) {
      date
      featureKind
      totalTokens
    }
  }
}`,
};

export const workspaceDirectoryQuery = {
  id: 'workspaceDirectoryQuery' as const,
  op: 'workspaceDirectory',
  query: `query workspaceDirectory($workspaceId: ID!, $after: String) {
  workspaceDirectory(workspaceId: $workspaceId, after: $after) {
    revision
    authorizationRevision
    fullSyncAllowed
    nextCursor
    rootRights {
      canRead
      canWrite
      canOrganize
      canCreateFolder
    }
    items {
      id
      parentId
      type
      data
      index
      rights {
        canRead
        canWrite
        canOrganize
        canCreateFolder
      }
    }
  }
}`,
};

export const mutateWorkspaceDirectoryMutation = {
  id: 'mutateWorkspaceDirectoryMutation' as const,
  op: 'mutateWorkspaceDirectory',
  query: `mutation mutateWorkspaceDirectory($workspaceId: ID!, $expectedRevision: String!, $changes: [WorkspaceDirectoryChangeInput!]!) {
  mutateWorkspaceDirectory(
    workspaceId: $workspaceId
    expectedRevision: $expectedRevision
    changes: $changes
  ) {
    revision
  }
}`,
};

export const workspaceDirectoryAdministrationQuery = {
  id: 'workspaceDirectoryAdministrationQuery' as const,
  op: 'workspaceDirectoryAdministration',
  query: `query workspaceDirectoryAdministration($workspaceId: ID!, $auditAfter: String) {
  workspaceDirectoryAdministration(
    workspaceId: $workspaceId
    auditAfter: $auditAfter
  ) {
    revision
    directories {
      id
      parentId
      name
    }
    principals {
      id
      name
      email
      allMembers
    }
    policies {
      directoryId
      principalId
      updatedAt
      rights {
        canRead
        canWrite
        canOrganize
        canCreateFolder
      }
    }
    auditEvents {
      id
      actorId
      directoryId
      principalId
      action
      createdAt
      before {
        canRead
        canWrite
        canOrganize
        canCreateFolder
      }
      after {
        canRead
        canWrite
        canOrganize
        canCreateFolder
      }
    }
    auditNextCursor
  }
}`,
};

export const changeWorkspaceDirectoryPolicyMutation = {
  id: 'changeWorkspaceDirectoryPolicyMutation' as const,
  op: 'changeWorkspaceDirectoryPolicy',
  query: `mutation changeWorkspaceDirectoryPolicy($workspaceId: ID!, $expectedRevision: String!, $directoryId: ID!, $principalId: ID!, $rights: WorkspaceDirectoryRightsInput) {
  changeWorkspaceDirectoryPolicy(
    workspaceId: $workspaceId
    expectedRevision: $expectedRevision
    directoryId: $directoryId
    principalId: $principalId
    rights: $rights
  ) {
    revision
    policy {
      directoryId
      principalId
      updatedAt
      rights {
        canRead
        canWrite
        canOrganize
        canCreateFolder
      }
    }
  }
}`,
};

export const setEnableAiMutation = {
  id: 'setEnableAiMutation' as const,
  op: 'setEnableAi',
  query: `mutation setEnableAi($id: ID!, $enableAi: Boolean!) {
  updateWorkspace(input: {id: $id, enableAi: $enableAi}) {
    id
  }
}`,
};

export const setEnableDocEmbeddingMutation = {
  id: 'setEnableDocEmbeddingMutation' as const,
  op: 'setEnableDocEmbedding',
  query: `mutation setEnableDocEmbedding($id: ID!, $enableDocEmbedding: Boolean!) {
  updateWorkspace(input: {id: $id, enableDocEmbedding: $enableDocEmbedding}) {
    id
  }
}`,
};

export const setEnableSharingMutation = {
  id: 'setEnableSharingMutation' as const,
  op: 'setEnableSharing',
  query: `mutation setEnableSharing($id: ID!, $enableSharing: Boolean!) {
  updateWorkspace(input: {id: $id, enableSharing: $enableSharing}) {
    id
  }
}`,
};

export const setEnableUrlPreviewMutation = {
  id: 'setEnableUrlPreviewMutation' as const,
  op: 'setEnableUrlPreview',
  query: `mutation setEnableUrlPreview($id: ID!, $enableUrlPreview: Boolean!) {
  updateWorkspace(input: {id: $id, enableUrlPreview: $enableUrlPreview}) {
    id
  }
}`,
};

export const inviteByEmailsMutation = {
  id: 'inviteByEmailsMutation' as const,
  op: 'inviteByEmails',
  query: `mutation inviteByEmails($workspaceId: String!, $emails: [String!]!) {
  inviteMembers(workspaceId: $workspaceId, emails: $emails) {
    email
    inviteId
  }
}`,
};

export const acceptInviteByInviteIdMutation = {
  id: 'acceptInviteByInviteIdMutation' as const,
  op: 'acceptInviteByInviteId',
  query: `mutation acceptInviteByInviteId($workspaceId: String!, $inviteId: String!) {
  acceptInviteById(workspaceId: $workspaceId, inviteId: $inviteId)
}`,
};

export const createInviteLinkMutation = {
  id: 'createInviteLinkMutation' as const,
  op: 'createInviteLink',
  query: `mutation createInviteLink($workspaceId: String!, $expireTime: WorkspaceInviteLinkExpireTime!) {
  createInviteLink(workspaceId: $workspaceId, expireTime: $expireTime) {
    link
    expireTime
  }
}`,
};

export const revokeInviteLinkMutation = {
  id: 'revokeInviteLinkMutation' as const,
  op: 'revokeInviteLink',
  query: `mutation revokeInviteLink($workspaceId: String!) {
  revokeInviteLink(workspaceId: $workspaceId)
}`,
};

export const workspaceInvoicesQuery = {
  id: 'workspaceInvoicesQuery' as const,
  op: 'workspaceInvoices',
  query: `query workspaceInvoices($take: Int!, $skip: Int!, $workspaceId: String!) {
  workspace(id: $workspaceId) {
    invoiceCount
    invoices(take: $take, skip: $skip) {
      status
      currency
      amount
      reason
      lastPaymentError
      link
      createdAt
    }
  }
}`,
};

export const getWorkspaceRolePermissionsQuery = {
  id: 'getWorkspaceRolePermissionsQuery' as const,
  op: 'getWorkspaceRolePermissions',
  query: `query getWorkspaceRolePermissions($id: String!) {
  workspaceRolePermissions(id: $id) {
    permissions {
      Workspace_Administrators_Manage
      Workspace_Blobs_List
      Workspace_Blobs_Read
      Workspace_Blobs_Write
      Workspace_Copilot
      Workspace_CreateDoc
      Workspace_Delete
      Workspace_Organize_Read
      Workspace_Payment_Manage
      Workspace_Properties_Create
      Workspace_Properties_Delete
      Workspace_Properties_Read
      Workspace_Properties_Update
      Workspace_Read
      Workspace_Settings_Read
      Workspace_Settings_Update
      Workspace_Sync
      Workspace_TransferOwner
      Workspace_Users_Manage
      Workspace_Users_Read
    }
  }
}`,
  deprecations: ["'workspaceRolePermissions' is deprecated: use WorkspaceType[permissions] instead"],
};

export const approveWorkspaceTeamMemberMutation = {
  id: 'approveWorkspaceTeamMemberMutation' as const,
  op: 'approveWorkspaceTeamMember',
  query: `mutation approveWorkspaceTeamMember($workspaceId: String!, $userId: String!) {
  approveMember(workspaceId: $workspaceId, userId: $userId)
}`,
};

export const grantWorkspaceTeamMemberMutation = {
  id: 'grantWorkspaceTeamMemberMutation' as const,
  op: 'grantWorkspaceTeamMember',
  query: `mutation grantWorkspaceTeamMember($workspaceId: String!, $userId: String!, $permission: Permission!) {
  grantMember(workspaceId: $workspaceId, userId: $userId, permission: $permission)
}`,
};
