# Current State

## Project Native Resources

The 2026-09-06 user-confirmed design is recorded in
[Project Native Resources](tracks/project-native-resources.md), with a separate
[implementation goal prompt](project-native-resources.goal.md). Projects own
internal resources, immutable revisions, Blob storage and persistent file trees
without Workspace storage; internal changes do not update external copies.
Workspace publication/update requires an explicit user action and target ACL,
while import retains source copy/share checks. Members have default internal
read/write access, without an additional Owner-only publication gate.

This new contract supersedes conflicting historical creation, Project-grant
and shared-write descriptions below. Those sections remain evidence of the
earlier implementation. Native resource tests, real model and browser checks,
upgrade/backfill counts, backups and runtime synchronization are recorded in
[the execution report](project-native-resources.execution.md).
Global Project BYOK remains independent of Workspace.

P1-P6 and A01-A22 are accepted. The backed-up 3011 runtime has 353 migrations;
2 historical references were copied and 11 remain recoverable pending source
authorization. Workspace data fingerprints did not change during migration and
synchronization. The runtime global Project BYOK is unconfigured and correctly
rejects model calls; real model creation and Office approval were validated in
the isolated instance. No image was rebuilt.

BlockSuite documents/canvases and Docs/Sheets/Slides/PDF use their existing
editors with Project ownership. Project chat persists selected resources and
attachments, works without Workspace membership, and records Project source
evidence. Approval, cancellation, lease fencing and immutable receipts apply to
Office and publication tasks. Historical references retain recoverable
authorization failures; old conversations cannot resume as implicit Workspace
writes.

## Global Project BYOK

Project conversations now resolve one administrator-managed global BYOK record
independently of their execution Workspace. The `/admin/ai/config` form probes
the selected provider before saving encrypted credentials, compares the current
revision and records immutable, secret-free change events. Workspace/user
Profiles and local leases do not contribute to Project model selection.

Persisted session ownership and current active Project membership are checked
when resolving providers, including stream preparation, tool subcalls and
retries. Disabling or replacing the global record affects subsequent requests;
already dispatched provider requests can finish. The Project model menu uses a
separate member-authorized metadata query and does not read or change the user's
Workspace model preference. Migration `20260906040000_project_global_byok` adds
independent config and audit tables without copying existing Workspace secrets.

The authority is [Project AI Boundaries](tracks/project-ai-boundaries.md).
[Validation evidence](tracks/project-ai-boundaries.md#global-project-byok-validation-on-2026-09-06)
covers Linux regression tests, upgrade preservation and the isolated Admin
browser workflow. Current runtime status is tracked in the native resource
execution report above.

## Project AI Stage Two Accepted

Stage two passed isolated Linux, real Chrome and encrypted-BYOK acceptance.
Its current authority is
[Project AI Boundaries](tracks/project-ai-boundaries.md#stage-two-progress-on-2026-09-06).
The isolated Linux regression and upgrade databases now have 335 migrations;
the retained scale database remains at 332. The business runtime has also been
upgraded to 335 migrations through the existing synchronization scripts after
database backups. A restored business backup independently passed 331-to-335
upgrade validation. No image was rebuilt.

The source ledger now records prompt/message, attachment, tool and recalled
memory evidence, freezes the original document grant, and persists immutable
shared-write checks outside a failed write transaction. Legacy sessions retain
an unknown marker, including empty sessions. Project creation/copy, document
updates and memory writes reject private, unknown, over-budget and revoked
sources; regrant does not revive the original conversation evidence. Document
checks also persist the destination audience and reject exposure beyond the
Project. Ordinary conversation writes currently require a destination whose
potential readers are limited to the actor; private or unproven personal input
does not acquire shared authority from location confirmation. User messages,
tool outputs, Rules and recalled memories now accumulate evidence in ordinary
sessions as well. Delegated planners bind a durable session before consuming
document/attachment context, including direct document-update plans.

External tool tasks now persist `waiting_for_location`, a session/operation
binding, confirmed destination revision, actor, permission evidence and expiry.
Bounded tool checkpoints recover completed calls; location recovery rechecks
authority and does not recreate completed documents. Linux fixtures cover
withdrawal, expiry, stale leases, queue outage, forged MCP confirmation, audience
drift and multiple same-title documents. Cancelled runs cannot block another
location recovery; manual resume updates the delegated request transactionally
and rejects withdrawn operations or revoked credentials. Office command/batch
writes and directory mutations enforce the source check through persistence;
transactional tool writes defer document broadcasts until commit.

Real Chrome verified human approve/reject second confirmation, rejection reason,
duplicate handling, withdrawal, expiry, offline reconnection, reviewer/admin
changes, revocation and applicant results using isolated documents. Notification
snapshots start from authentication state and reconcile every 15 seconds,
including unchanged counts. An HTTP-only browser proxy blocked realtime while
the persistent result appeared within 9,193 ms and survived reconnection. A
real isolated Redis WRITE pause also preserved the committed decision and
notification before publication resumed.

Encrypted-BYOK task `fc65e3e2-005e-499d-bd05-340add3cf842` survived a backend
restart while waiting with zero creation. Explicit Workspace/root confirmation
then created exactly one document with revision 1 and separate placement and
Project-addition receipts. The recovered worker completed, and MCP returned the
actual destination Workspace. Recovered tool receipts now survive native prompt
projection; the earlier failed task and its document remain as evidence. The
final backend sync used a fresh waiting-state database backup and did not
rebuild the image. Desktop/narrow-screen light/dark visual checks passed.

The 10,000-row directory fixture passed pagination, 64-level ancestry,
concurrent policy revision and missed-realtime revocation checks. The latest
sample measured a 329 ms directory first page, a 129.36 ms destination-picker
page, and 13,858.33 ms for the remaining 100 directory pages. Parsing cache
entries are bounded and validated against freshly read storage bytes; actor
permissions are not cached across requests. Detailed measurements and retained
fixture IDs are in the authority document.

## Project AI Boundaries Stage Accepted

The current product contract, implementation record, and residual risks are
maintained in [Project AI Boundaries](tracks/project-ai-boundaries.md). Explicit
conversation project selection supersedes inference from attached documents.
AI cannot create or administer Projects. Document creation requires a confirmed
storage Workspace and location; execution Workspace and storage Workspace are
separate.

The 2026-09-05 stage includes server and tool capability enforcement, immutable
conversation/project binding, cumulative source provenance checks, durable
creation and independent-copy operations, directory grants and administration,
project access requests, human decision notifications, audit, and realtime
refresh. Conflicting native root histories are repaired through a canonical
snapshot that remains readable by both Yjs and the native reader; copied
snapshots rewrite their internal title before persistence.

The backend business runtime was synchronized with
`yarn localmind:sync:backend` after a database backup. All 331 migrations were
applied with zero pending migrations; no Docker image was rebuilt. The fixed
`localmind-affine:test` runner passed the focused backend, frontend, lint,
format, and TypeScript checks. Browser acceptance proved a real cross-Workspace
copy with a new document ID, persistent title, and bidirectional edit
independence, plus immediate directory-policy hide/restore behavior without a
page refresh.

The broader provenance, external location recovery and large-directory work
listed at this earlier stage is covered by stage two above. Production transport
soak and sustained capacity measurement remain outside the local acceptance.
Two intentionally retained failed copy samples and two isolated test folders
remain as audit evidence; they were not deleted or converted.

## Native Office And AI Editing

The LocalMind Native Office vertical slice and its AI editing loop are
implemented for DOCX, XLSX, PPTX, and PDF:

- `OfficeArtifact` and immutable, linearly linked `OfficeRevision` records own
  native Office identity, source/package/state Blob evidence, origin,
  idempotency, bounded operation summaries, and monotonic revision history
  outside the BlockSuite page schema;
- PostgreSQL constraints and deferred triggers bind Office evidence to one
  workspace, guard initial and parent revisions, serialize revision counters,
  protect referenced Blobs, and prevent Revision or command-request rewrites;
- `@localmind/office` owns strict semantic readers/writers for all four formats,
  47 `localmind-office-command/v1` schemas, stable resource-specific targets,
  bounded semantic diffing, and the 64-command/32 MiB
  `localmind-office-command-batch/v1` contract;
- workspace-scoped GraphQL and authorized HTTP endpoints support native import,
  open, preview, execute, history, compare, comments, collaborators, package/
  state/part delivery, and DOCX PDF export without converting the file into a
  BlockSuite page;
- the native Docs, Sheets, Slides, and PDF surfaces share the command bus,
  immutable save path, import routing, workspace navigation, download/print,
  comments, history, and per-format editing engines;
- every Office page reuses the existing LocalMind AI Chat and sends a strict
  `localmind-office-ai-context/v1` value containing the current Artifact,
  Revision, resource kind, and optional stable selection captured at send time;
- Office user-generation requests are BYOK-only, expose only bounded
  `office_read`, `office_command_request`, and
  `office_command_batch_request` tools, require a successful read before a
  write, and cannot fall back to quota-backed/global chat providers or replace
  raw OOXML/PDF bytes;
- single commands and atomic batches persist preview and command evidence,
  enter an approval-gated Agent Runtime run, and are rechecked by the worker for
  current ACL, cancellation, command fingerprint, expected Revision, preview
  drift, idempotency, and existing side-effect evidence;
- reject, cancel, permission loss, stale Revision, invalid stable target, and
  preview drift produce no Office Revision, while success produces exactly one
  `origin=ai` Revision and immutable execution-result evidence;
- the Office task panel shows approval and execution states, and completion
  refreshes only the current Artifact to the new Revision without page
  navigation, restoring or explicitly clearing the stable selection;
- PDF remains fixed-layout across tool policy, planner instructions, and UI;
  AI can use supported annotations, forms, page operations, signature
  appearances, and redaction but cannot disguise document reflow as PDF editing.

The implementation and compatibility source of truth is
`docs/office-native/README.md`. Remaining Native Office work is fidelity,
collaboration depth, performance, accessibility expansion, and broader format
compatibility rather than completion of the AI editing control loop.

## Completed

The project has implemented many P1 read-only diagnostics and compatibility
bridges:

- provider, model, prompt, task route, and policy diagnostics;
- prompt registry publish-gate evidence;
- action run prepared-route trace summaries;
- repair preview, preflight, and execution request contract snapshots;
- support bundle lifecycle and source guard metadata;
- support bundle source-evidence candidate reference entries;
- nested placeholder statuses and fingerprints for support bundle source
  evidence.

The AI Chat document snapshot freshness slice is implemented:

- context documents persist the saved document timestamp captured when they
  are attached, including documents added through tags and collections;
- context GraphQL reads compare that baseline with the latest saved snapshot or
  pending update timestamp without replacing the conversation snapshot;
- active document conversations continue a restrained freshness poll after
  embedding completes and expose deduplicated modified-document state;
- AI Chat shows a dismissible update warning above the composer, offers
  `New chat`, persists dismissal per workspace/session/document version, and
  shows the warning again after a later save;
- new drafts and session switches clear stale composer context before the
  selected session reloads its own context.

The scanned PDF OCR import extension is implemented:

- PDF.js continues to extract native text in the browser and rasterizes only
  pages without a text layer;
- a permission-checked, rate-limited LocalMind REST endpoint forwards bounded
  JPEG/PNG page images to an exact allowlisted HTTPS SparkClaw OCR base URL;
- the server keeps the optional OCR credential private, disables the feature
  by default, rejects redirects, bounds request/response sizes, and returns
  sanitized error codes without logging page images or recognized text;
- native text and OCR Markdown are merged into an editable LocalMind page,
  with a 100 scanned-page import cap and user-visible review/failure warnings.

The self-hosted AI Chat document-tool runtime repair is implemented:

- prompt-backed tool wrappers preserve appended prompt messages while adding
  workspace/user route context, so `doc_compose` receives the user's actual
  document brief instead of running the guarded article prompt without input;
- `doc_compose` is explicitly a generated Markdown preview and directs saved
  document work to `doc_create` or `doc_update`;
- self-hosted deployments expose the existing permission-checked
  `doc_create`, `doc_update`, and `doc_update_meta` tools, while hosted
  production exposure remains unchanged;
- focused ToolRuntime coverage verifies both appended-message forwarding and
  the self-hosted document-write exposure policy.

The original four-step AI modernization vertical plan is now implemented:

- `agent_runtime_model_completion` is registered as a production Agent Runtime
  workflow adapter and executes persisted model steps through the existing
  DB-routed PromptRuntime/provider stack with timeout, cooperative
  cancellation, redacted bounded evidence, timeline output, and
  `ai_agent_runtime_execution_results` ledger rows;
- `agent_runtime_doc_update` provides the first approval-gated office-task
  tool adapter: a user request creates a waiting-approval AgentRun, approval
  queues the worker, the worker updates a workspace document through
  `DocWriter`, and side-effect evidence is persisted in step output, timeline,
  and execution-result ledger rows;
- Provider Health probe attempts now keep the no-network local provider
  profile/runtime contract as the default, and can optionally run a real text
  completion probe through the existing provider runtime when
  `LOCALMIND_PROVIDER_HEALTH_NETWORK_PROBE=1` or
  `COPILOT_PROVIDER_HEALTH_NETWORK_PROBE=1`;
- Prompt Registry now has editable body preview/publish GraphQL APIs for
  workspace-scoped direct publish: preview returns bounded line diff and
  fingerprints, publish requires the matching preview fingerprint, updates the
  underlying prompt message body, and records a DB-backed prompt registry
  revision with editable-body metadata.

The workspace BYOK exact-model binding slice is now implemented:

- server-stored and Electron-local BYOK keys carry one optional persisted
  `modelId`, including encrypted local lease transport and generated GraphQL
  types;
- a configured key contributes only its bound model and a generated runtime
  model definition; user-generation runtime selection is BYOK-only and never
  dispatches through quota-backed/global chat providers;
- embedding and rerank are instance-managed infrastructure exceptions: their
  routes use only the administrator-configured global Provider Registry, are
  shared by every workspace, never query or select Workspace BYOK profiles,
  and ignore workspace-scoped registry, task-model, health, and route-policy
  overrides;
- provider lifecycle startup registers each built-in driver independently from
  statically configured provider profiles, so a BYOK OpenAI key remains
  executable when the global route uses only an OpenAI-compatible profile;
- BYOK usage recording falls back to the prepared route/request model when a
  provider response omits it or reports provider selection before stream model
  metadata, preserving the bound model in audit rows;
- OpenAI-compatible key testing sends a minimal `POST /responses` request with
  the exact configured model instead of treating a provider-level
  `GET /models` response as proof that the requested model is usable;
- legacy quota-backed prefixed model requests preserve an exact matching BYOK
  binding; when no BYOK profile supports the requested model, route selection
  removes that model constraint and falls back to the workspace's bound BYOK
  model without enabling the legacy platform route;
- every user-generation execution requires an eligible BYOK profile for the
  requested workspace and feature; missing coverage raises
  `COPILOT_BYOK_NOT_CONFIGURED`, while the compatibility quota API reports an
  unlimited limit and is not consulted by routing; the AI error state tells
  members to contact the LocalMind instance administrator;
- the Admin AI credential form requires the model id before test/save,
  invalidates a successful test when the model changes, and displays the bound
  model beside the key without exposing the secret;
- existing rows remain migration-compatible with a nullable model id, while
  new UI-managed keys must bind and test a concrete model before use.

The 4096-dimensional embedding index contract is now implemented locally:

- embedding generation, write, query, route diagnostics, and five pgvector
  columns use one fixed 4096-dimensional contract;
- writes and searches reject non-4096 or non-finite vectors before PostgreSQL
  execution;
- the four large derived embedding tables use binary-quantized 4096-bit HNSW
  candidate retrieval, followed by full-vector cosine reranking and threshold
  evaluation;
- the index diagnostics version is `workspace-embedding-index/v2`;
- the upgrade migration preserves document, context-file, workspace-file, and
  Blob chunk text while replacing incompatible vectors with pending nulls;
- a bounded, idempotent queue job retries pending chunks every minute and
  rebuilds them through the effective workspace embedding route without
  requiring source-file re-upload;
- durable Memory rows retain their ids, text, scope, lifecycle, and audit
  relationships, while only their incompatible 1024-dimensional embedding is
  cleared and queued for 4096-dimensional regeneration.

The latest confirmed slice is main-plan section 554:

- the source-evidence field
  `candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint`
  is exposed through backend resolver, GraphQL schema/query/types, Admin
  diagnostics text, and focused tests.

The first durable support bundle slice is now implemented:

- `ai_support_bundle_requests` and `ai_support_bundle_audit_events` persist
  workspace, actor, status, source evidence summary, source evidence
  fingerprint, manifest fingerprint, manifest JSON, retention status,
  expiration, and create/read audit events;
- GraphQL can create, list, and read DB-backed support bundle requests with
  workspace permission checks;
- Admin can create and inspect recent support bundle requests for a selected
  workspace, including manifest/source fingerprints, retention state, and audit
  counts;
- focused backend and Admin tests cover creation, persistence, read/list access,
  and authorization rejection.

The support bundle download authorization slice is now implemented:

- `ai_support_bundle_download_authorizations` persists workspace, actor,
  bundle id, status, artifact kind, filename, mime type, manifest fingerprint,
  authorization fingerprint, token fingerprint, expiration, and downloaded time;
- support bundle download authorization rows are lifecycle-mutable but issued
  artifact/token/delivery/expiry evidence is DB-guarded against direct rewrites;
- GraphQL can authorize a short-lived manifest artifact download after
  workspace permission checks;
- `/api/copilot/support-bundles/:authorizationId/manifest` validates the
  short-lived token against the persisted token fingerprint, consumes the
  authorization, records a `downloaded` audit event, and returns the minimal
  manifest JSON as an attachment;
- download authorization and download consumption write
  `download_authorized`/`downloaded` audit events;
- Admin can request a manifest download for a persisted bundle and observe the
  latest authorization state.

The support bundle retention cleanup slice is now implemented:

- GraphQL can run a workspace-scoped retention cleanup after the same workspace
  permission check used by create/read/download operations;
- cleanup expires due active support bundles by setting request status and
  retention status to `expired`, updating the stored manifest retention status,
  recalculating the manifest fingerprint, and writing a `retention_expired`
  audit event;
- outstanding authorized manifest downloads for expired bundles are marked
  `expired`, and the HTTP manifest endpoint no longer serves them;
- `retention_expired` audit metadata is DB-constrained to retain cleanup
  identity, fingerprint, scope, expired authorization count, expired retention
  status, and known archive/manifest cleanup status vocabulary before retry or
  escalation scans consume it;
- `download_authorized` audit metadata is DB-constrained to retain the current
  authorization/expiration audit versions, authorization identity, artifact
  evidence, delivery method, expiry, and cleanup fingerprint evidence before
  audit or cleanup consumers observe it;
- Admin can trigger cleanup for the selected workspace and observe the cleaned
  bundle/authorization counts and cleanup fingerprint;
- focused backend and Admin tests cover cleanup execution, authorization
  invalidation, audit metadata, idempotent no-op reruns, and authorization
  rejection.

The support bundle archive artifact slice is now implemented:

- support bundle creation writes a minimal `localmind-support-bundle-archive/v1`
  JSON payload to the configured blob storage provider;
- `ai_support_bundle_requests` persists archive storage key, byte size,
  fingerprint, MIME type, and filename alongside the DB-backed request and
  manifest;
- the stored manifest includes archive metadata that binds the downloadable
  artifact to the request row;
- download authorization supports both `manifest_json` and `archive_json`, with
  a persisted artifact fingerprint;
- `/api/copilot/support-bundles/:authorizationId/artifact` validates and
  consumes the short-lived authorization before returning the selected manifest
  or archive bytes;
- audit events include `archive_created`, `download_authorized`, and
  `downloaded`;
- creation and archive-created audit metadata is model-validated and
  DB-constrained to retain manifest/archive artifact identity, positive byte
  sizes, storage keys, fingerprints, MIME values, filenames, and active
  retention evidence before lifecycle consumers observe it;
- support bundle creation now best-effort deletes just-written manifest/archive
  storage objects if DB persistence or creation audit history fails after the
  object writes, so failed creates do not leave orphan support-bundle artifacts;
- Admin displays archive metadata and requests the archive artifact by default;
- focused backend and Admin tests cover archive persistence, artifact
  authorization, one-time download consumption, audit metadata, and UI
  visibility.

The support bundle scheduled retention cleanup slice is now implemented:

- the daily Copilot cron path enqueues
  `copilot.supportBundle.cleanupRetention` with a fixed job id;
- the BullMQ job handler runs system-scoped retention cleanup across due support
  bundles, reusing the same persisted request/authorization/audit state as the
  Admin cleanup path;
- cleanup runs in bounded batches and returns `Repeat` while a full batch is
  expired, allowing the queue worker to continue until no due bundles remain;
- `retention_expired` audit metadata records `cleanupScope=scheduled_worker`
  and `cleanupActorId=system_retention_worker`, while preserving the bundle
  actor foreign-key relationship on the audit row;
- focused backend tests cover queued worker cleanup, cross-workspace expiration,
  authorization revocation, repeat/done signals, and audit metadata.

The support bundle packaged archive contents slice is now implemented:

- support bundle creation writes a packaged
  `localmind-support-bundle-archive/v1` JSON artifact instead of only a minimal
  outer summary;
- support bundle request rows are lifecycle-mutable but creation/source/archive
  evidence is DB-guarded against direct rewrites after persistence;
- the archive contains a deterministic file index and embedded JSON files for
  `manifest.json`, `source-evidence-summary.json`,
  `prompt-catalog-summary.json`, `actor-action-runs.json`, and
  `task-route-summary.json`;
- every archive file has a persisted path, media type, byte size, and
  fingerprint, and the archive has a deterministic index fingerprint;
- the prompt catalog snapshot is workspace-scoped, action runs are scoped to
  the bundle actor/workspace, and task route snapshots include sanitized route
  policy/model/provider/fingerprint evidence;
- the existing archive storage metadata, download authorization, token
  consumption, and API artifact endpoint now serve and validate the packaged
  archive bytes;
- focused backend tests cover the archive file index, embedded section
  contents, per-file fingerprints, archive index fingerprint, download
  authorization, and one-time consumption.

The support bundle object-storage signed URL slice is now implemented:

- `ai_support_bundle_download_authorizations` persists delivery method,
  direct object-storage URL, and direct URL expiration metadata;
- archive download authorization attempts object-storage signed URL delivery
  when the configured storage provider returns a signed redirect URL and object
  metadata matching the persisted archive byte size;
- GraphQL returns `deliveryMethod`, `directDownloadUrl`, and
  `directDownloadExpiresAt`; `downloadUrl` remains backward compatible and
  points at the direct URL when one was issued, otherwise at the API proxy;
- API-proxied artifact consumption rejects direct-delivery authorizations so a
  direct signed URL is not double-consumed through the proxy endpoint;
- Admin shows whether the latest artifact authorization is API-proxied or
  object-storage signed URL delivery;
- focused backend tests cover signed URL issuance, DB persistence, audit
  metadata, and API proxy rejection for direct-delivery authorizations.

The support bundle direct download acknowledgement slice is now implemented:

- GraphQL exposes `acknowledgeCopilotSupportBundleDirectDownload` behind the
  existing workspace Copilot permission check;
- the model accepts only active `object_storage_signed_url` authorizations in
  the same workspace and rejects API-proxy, expired, missing-direct-URL, or
  already-final rows;
- acknowledgement revalidates the ready/active support bundle plus
  manifest/archive fingerprint evidence before mutating state;
- acknowledgement uses a conditional terminal update over the originally read
  authorization evidence and parent bundle snapshot, so stale readbacks roll
  back before downloaded audit evidence is written;
- `ai_support_bundle_download_authorizations` transitions to `downloaded` and
  sets `downloaded_at`;
- `ai_support_bundle_audit_events` records a `downloaded` event with delivery
  method, artifact evidence, direct URL expiration, `authorizationActorId`, and
  `clientAcknowledged=true`;
- focused backend coverage checks direct acknowledgement persistence, audit
  metadata, replay rejection, and API-proxy rejection.

The support bundle archive object cleanup slice is now implemented:

- retention cleanup attempts to delete the stored archive object after a bundle
  row successfully transitions to expired;
- `retention_expired` audit metadata records `archiveObjectCleanupStatus`,
  archive storage key, and delete error code/message when cleanup fails;
- DB retention expiry still completes when object deletion fails, leaving a
  durable audit trail for operational retry/follow-up instead of rolling back
  the bundle state;
- focused backend coverage checks successful object deletion and failure audit
  metadata.

The support bundle retention retry and manifest storage slices are now
implemented:

- manual and scheduled retention cleanup retry failed archive object deletion
  for expired bundles, write retry/recovered/failed audit metadata, and
  escalate persistent scheduled failures with a durable skip marker;
- manifest JSON is persisted to blob storage during bundle creation, manifest
  downloads can use signed URL delivery, and retention cleanup rewrites the
  stored manifest after DB expiry;
- failed manifest object rewrites are retried through the same cleanup entry
  points and persistent scheduled failures are escalated while remaining
  manually recoverable;
- short-lived download authorizations expire through an independent scheduled
  cleanup job;
- retention retry/escalation audit metadata is model-validated and
  DB-constrained to retain previous cleanup fingerprints, retry failure counts,
  storage keys, bounded error evidence, and scheduled escalation coherence
  before cleanup scans or Admin summaries consume it;
- retention retry audit insertion now compares the expired bundle snapshot and
  latest failed cleanup audit source id/fingerprint/metadata/timestamp before
  appending retry/recovered/escalated evidence, so stale cleanup workers cannot
  record audit history after newer cleanup evidence appears.

The support bundle provider-transfer evidence slice is now implemented:

- the internal transfer endpoint accepts canonical events only with internal
  `x-access-token` auth evidence and rejects canonical self-reported provider
  signature evidence;
- S3/R2-compatible object-created wrappers must carry upstream
  `verified_by_upstream` provider signature evidence with verifier, policy,
  and signature fingerprint before the controller/model path can mark a
  direct-delivery authorization downloaded;
- `ai_support_bundle_audit_events` rejects provider-origin downloaded audit
  rows that lose the upstream verifier/policy/fingerprint evidence;
- verified direct-transfer notifications now persist into
  `ai_support_bundle_transfer_events` with authorization snapshot, provider
  event id/source, storage evidence, notification auth evidence, and
  deterministic transfer event fingerprints;
- direct transfer-event terminal writes also compare the read authorization and
  parent bundle snapshots before marking the authorization downloaded, so stale
  provider callbacks cannot append transfer events or downloaded audit rows
  from outdated evidence;
- API-proxy download consumption now compares the read authorization and
  parent bundle snapshots after artifact readback but before marking the
  authorization downloaded, so stale bundle drift cannot append downloaded
  audit rows from outdated evidence;
- production transfer forwarding now persists parsed notifications into
  `ai_support_bundle_transfer_forwarding_events` before ingestion, with
  canonical payload fingerprints, upstream signature-evidence fingerprints
  when present, worker lease/attempt evidence, retry scheduling,
  dead-lettered terminal failures, and forwarded transfer-event fingerprint
  linkage;
- production object-storage webhook ingress now accepts configured S3/R2-style
  notifications through a public HMAC-SHA256 boundary, rejects body-injected
  provider signature evidence, derives server-owned `verified_by_upstream`
  evidence, and appends the verified payload into the same durable transfer
  forwarding queue before worker ingestion;
- expired direct signed-URL acknowledgements and transfer notifications now
  persist the authorization `expired` transition plus matching
  `download_authorized(authorizationExpired=true)` audit history before
  returning the client/provider error, so failed delivery callbacks no longer
  lose expiry evidence to transaction rollback;
- direct signed-URL expiration writes now use the same authorization snapshot
  compare-and-swap discipline as downloaded terminal writes, so stale
  acknowledgement or transfer-event reads fail before writing
  `authorizationExpired=true` audit history;
- retention cleanup expiration writes now compare the originally read support
  bundle request identity, manifest, archive, source-evidence, retention,
  failure, and timestamp snapshot before rewriting the expired manifest,
  revoking authorizations, or appending cleanup audit evidence;
- the `copilot.supportBundle.processTransferForwardingEvents` worker replays
  queued/retryable forwarding rows through the same storage/auth verifier used
  by the internal endpoint, while deterministic malformed transfer evidence is
  dead-lettered instead of retried forever;
- transfer forwarding processing now re-locks the row and verifies the same
  current non-expired worker lease before storage verification, forwarded
  terminal writes, or retry/dead-letter writes, so stale workers cannot mark a
  direct download or mutate forwarding state after another worker re-acquires
  the lease;
- transfer forwarding processing now also requires the same attempt counter
  snapshot before storage verification or terminal forwarding writes, so stale
  in-memory workers cannot append transfer events, mark authorizations
  downloaded, or write retry/dead-letter evidence after attempt metadata
  changes under the same lease id;
- transfer forwarding forwarded and retry/dead-letter terminal writes now
  compare the full locked forwarding row snapshot, including immutable
  forwarding payload/fingerprints, lease timestamps, terminal/failure fields,
  and update time, so same-lease row drift fails before terminal mutation;
- transfer forwarding processing now wraps transfer ingestion, authorization
  download mutation, downloaded audit history, and the final forwarded row
  update in one transaction, so a forwarded terminal snapshot failure rolls
  back transfer/download evidence instead of leaving a downloaded
  authorization behind a still-processing forwarding row;
- transfer forwarding enqueue conflicts now re-read the existing row by
  authorization/fingerprint and validate provider event id/source, forwarding
  payload fingerprint, and provider-signature evidence fingerprint before
  treating the row as idempotent;
- forwarding rows are DB-constrained for payload identity/source coherence,
  queued/processing/retry/forwarded/dead-letter state shape, immutable
  forwarding evidence after insertion, and delete restriction while the parent
  authorization still exists;
- transfer event authorization snapshots use update-restricted composite
  foreign keys, so direct SQL cannot mutate parent authorization snapshot
  columns and silently cascade changed evidence into historical transfer rows;
- transfer event storage evidence is checked at write time against the parent
  bundle manifest/archive artifact metadata, so direct SQL cannot persist
  transfer rows with fabricated storage key, byte size, content type, or
  artifact fingerprint evidence;
- direct transfer event insert conflicts re-read the existing row and validate
  provider event id/source, transfer timestamp, auth-evidence fingerprint, and
  storage evidence before treating a duplicate event fingerprint as
  idempotent;
- transfer event rows reject direct content-evidence rewrites after persistence,
  so authorization linkage, provider event/source, notification auth evidence,
  storage evidence, event fingerprint, and creation-time history remain
  append-only while true no-op updates stay compatible;
- matching transfer-event replays remain downloaded-audit-idempotent but append
  their own durable transfer event rows after storage validation;
- support bundle GraphQL create/get/list responses now expose
  `transferEventCount` plus recent transfer event storage/auth/provider
  notification evidence, and Admin renders that evidence in the support bundle
  list;
- support bundle GraphQL create/get/list responses now also expose
  `transferForwardingEventCount` plus recent transfer forwarding retry,
  forwarded, dead-letter, payload fingerprint, provider-signature, and worker
  lease evidence, and Admin renders that queue history in the support bundle
  list;
- dead-lettered support bundle transfer forwarding rows can now be replayed
  through GraphQL/Admin by appending a fresh queued forwarding event whose
  immutable payload records replay metadata and source dead-letter evidence,
  while the original terminal row keeps its failure code, payload fingerprint,
  attempt count, and dead-letter timestamp unchanged; replay insertion now
  compares the full source dead-letter row snapshot before inserting, so stale
  operator replay cannot create queued work after the source row changes;
- support bundle GraphQL create/get/list and retention-cleanup responses expose
  recent lifecycle `auditEvents`, and the detail read response includes the
  newly persisted `read` audit row after rehydration;
- focused backend coverage checks malformed wrapper evidence, direct SQL
  tampering of persisted provider-transfer audit metadata, and direct SQL
  drift against the transfer-event authorization snapshot, child workspace
  snapshot drift for audit/download authorization rows, manifest identity
  drift inside the persisted manifest JSON, download authorization manifest
  snapshot drift at write time, archive authorization artifact snapshot drift
  at write time, transfer event storage snapshot drift at write time,
  transfer-event content/fingerprint rewrites after persistence, support bundle
  audit event content-evidence rewrites after persistence, retention retry
  source cleanup evidence drift, transfer-forwarding replay source-row snapshot
  drift, plus GraphQL/Admin transfer-event, transfer-forwarding,
  transfer-forwarding replay, and audit-event history visibility.
- support bundle request rows now reject direct lifecycle rewrites after
  creation: `expires_at` drift, ready-to-failed status/failure drift, and
  premature ready-to-expired rewrites fail at the DB boundary, while the
  implemented retention cleanup transition is still allowed only after the
  persisted retention window has elapsed and only for the manifest retention
  snapshot/fingerprint/byte-size changes it owns.
- support bundle request inserts and real retention lifecycle transitions now
  require matching append-only audit history by commit time: `created` audit
  rows bind manifest/source/retention evidence, packaged archive rows also
  require `archive_created` evidence, and expired rows require
  `retention_expired` metadata with the resulting and previous manifest
  fingerprints plus cleanup identity evidence.
- support bundle download authorization rows now reject direct lifecycle
  rewrites after issuance: premature expiry, revoked drift, late downloaded
  timestamps, and terminal replay fail at the DB boundary, while API-proxy
  consumption, direct-download acknowledgement, provider transfer-event
  ingestion, scheduled authorization cleanup, and parent retention cleanup keep
  their implemented transition shapes.
- support bundle download authorization inserts and real status transitions
  now require matching append-only audit history by commit time: issuance binds
  `download_authorized` authorization/artifact/delivery evidence, downloaded
  terminal state binds `downloaded` evidence, and expired terminal state binds
  the existing `download_authorized(authorizationExpired=true)` cleanup
  metadata.
- support bundle download authorization rows reject direct deletion while the
  parent bundle still exists, preserving issued/downloaded/expired
  authorization history after audit and transfer child histories are protected.
- support bundle request rows reject direct deletion while the owning workspace
  still exists, preserving the persisted bundle root plus audit,
  authorization, and transfer history; workspace deletion remains the
  ownership cleanup path.

The first durable repair execution slice is now implemented:

- `ai_repair_execution_requests` and
  `ai_repair_execution_audit_events` persist workspace, actor, prompt target,
  requested action, status, approval state, permission status, idempotency key,
  evidence fingerprints, runtime result, completion/failure fields, and audit
  events;
- the repair execution mutation still preserves the legacy request projection,
  but now creates or reuses a DB-backed execution request for workspace-scoped
  calls after the existing workspace permission/preflight checks;
- create/reuse handles idempotency unique-key races by re-reading the existing
  request, validating the create-time prompt/action/permission, fingerprint,
  runtime-result, and executor-payload evidence, then appending `reused` audit
  history, so matching concurrent callers do not surface raw unique constraint
  failures after both miss the pre-read while drifted conflicts fail closed
  before misleading audit evidence is written;
- approval-required requests persist as `waiting_approval`, while non-approval
  requests can complete through the first safe no-op runtime path with
  `sideEffectsApplied: false`;
- Admin can see the durable execution record id, status, approval state,
  idempotency key, audit count, and side-effect status;
- focused backend and Admin tests cover persistence, idempotency reuse, audit
  events, authorization rejection, and Admin visibility.

The repair execution approval decision slice is now implemented:

- GraphQL can approve or reject a persisted repair execution request that is
  still `waiting_approval`, after the same workspace permission checks;
- approval writes `approval_approved`, `running`,
  `side_effect_applied`, and terminal `completed` audit events when the
  approved request carries the Prompt Registry revision executor payload;
- approval stores a `prompt_registry_revision_publish_worker` runtime result
  with `sideEffectsApplied: true`, the side-effect fingerprint, side-effect
  kind, side-effect record id, and a sanitized summary for the published
  workspace revision;
- rejection writes `approval_rejected` and terminal `cancelled` audit events,
  stores a rejected runtime result, and does not apply side effects;
- duplicate or stale approval decisions are rejected unless the request is still
  `waiting_approval` with `approvalState=waiting`;
- approval decisions now compare the full waiting request snapshot before
  writing approval/rejection state or audit history, so same-state drift in
  request evidence, payload, lease/attempt fields, failure fields, or
  timestamps fails closed;
- approved/rejected approval-state changes now require the matching
  `approval_approved` or `approval_rejected` audit event by commit time, so a
  direct SQL lifecycle update cannot rely only on queued/cancelled audit
  history while omitting the actual decision event;
- Agent Runtime run, step, and timeline state is synchronized after approval or
  rejection, and Admin can trigger and observe the decision result.

The first repair execution mutating executor slice is now implemented:

- `ai_repair_execution_requests.executor_payload` stores the approved executor
  payload captured from the permission/preflight-checked repair request;
- approving a prompt registry repair execution publishes a workspace-scoped
  `ai_prompt_registry_revisions` record with revision, actor, fingerprint,
  source-chain evidence, and repair execution metadata;
- the side effect is gated by the existing workspace permission check,
  `waiting_approval`/`approvalState=waiting` state check, and idempotency key;
- Admin can observe that the approved execution applied a Prompt Registry
  revision side effect rather than a safe no-op.

The repair execution worker lease and retry slice is now implemented:

- `ai_repair_execution_requests` persists queued time, worker lease id, lease
  expiration, attempt count, max attempts, and last attempt time;
- approving a waiting repair execution no longer runs side effects inside the
  GraphQL resolver; it transitions the request to `queued`, writes
  `approval_approved` and `queued` audit events, and enqueues
  `copilot.repairExecution.run`;
- the repair execution worker acquires a persisted lease, transitions the
  request to `running`, applies the Prompt Registry revision publisher, and
  writes `side_effect_applied` plus terminal `completed` audit events;
- applied repair side-effect runtime results are DB-constrained to retain
  side-effect kind, record id, fingerprint, and object summary evidence before
  Agent Runtime/Admin/support-bundle consumers read them;
- applied repair side-effect runtime results are also DB-constrained to retain
  the explicit forward-only rollback contract already emitted by constrained
  registry publishers;
- applied repair side-effect runtime results are DB-constrained to match the
  persisted executor payload publisher kind, so a prompt-registry executor
  payload cannot claim a model-registry side effect;
- completed constrained repair side effects now persist
  `ai_repair_execution_side_effects` ledger rows with request/workspace/actor
  snapshot coherence, executor payload fingerprint, worker lease evidence, and
  the same forward-only rollback contract, and parent request snapshot edits
  cannot cascade changed actor/workspace evidence into historical side-effect
  ledger rows;
- repair side-effect ledger rows are now also checked against the completed
  parent request result at write time, and parent result/executor-payload
  updates are blocked once a ledger row exists, so side-effect kind, record id,
  fingerprint, summary, worker attempt, completed timestamp, failure/lease
  absence, actor evidence, and executor-payload provenance cannot drift between
  the terminal request row and durable side-effect history;
- repair side-effect ledger inserts now also fence the terminal parent request
  snapshot with an `INSERT ... SELECT` over request identity, approval,
  permission, durable fingerprints, runtime result, executor payload,
  queue/lease/attempt, completion, and timestamp evidence, so request drift
  between completion update and ledger insertion rolls the transaction back
  before stale side-effect evidence persists;
- completed applied repair execution request rows now require matching
  `ai_repair_execution_side_effects` history by commit time, so direct SQL
  cannot claim `sideEffectsApplied=true` on a terminal request without the
  durable side-effect ledger snapshot;
- repair side-effect ledger rows reject direct content-evidence rewrites after
  persistence, so request linkage, side-effect identity, summary,
  executor-payload fingerprint, worker lease evidence, applied time, and
  creation-time history remain append-only while true no-op updates stay
  compatible;
- repair side-effect ledger rows also reject direct deletion while the completed
  parent request still requires that ledger snapshot, closing the child-removal
  gap left by parent-side required-history checks while preserving parent
  deletion cascades;
- repair request rows now reject direct rewrites of original request evidence,
  idempotency/permission evidence, executor payload, source/repair
  fingerprints, workspace/actor linkage, and creation time after insert, while
  preserving queue, approval, lease, failure, result, and timestamp lifecycle
  updates. Deterministic unsupported or invalid executor-payload failures fail
  closed on manual retry unless a future audited payload-correction workflow is
  added;
- repair execution GraphQL/common/Admin read paths now expose
  `sideEffectCount` plus recent side-effect ledger rows on the durable
  execution record, so completed side-effect history is visible without direct
  SQL access;
- repair execution GraphQL/common/Admin read paths now expose recent
  lifecycle `auditEvents`, so requested/approval/queued/running/completed or
  retry/control transitions can be inspected without direct SQL access;
- repair execution audit rows preserve the parent request workspace snapshot at
  the DB boundary, so direct SQL cannot move lifecycle evidence into another
  real workspace while keeping the same execution request id;
- repair execution audit rows now reject direct content-evidence rewrites after
  persistence, so execution request id, actor, event type, fingerprint,
  metadata, and creation-time evidence remain append-only lifecycle history;
- repair execution request inserts and lifecycle transitions now require
  matching audit history by commit time, so direct SQL cannot create orphan
  request state or move queued/running/terminal lifecycle evidence without an
  append-only audit event for the same request/workspace/actor and resulting
  status; approval-state transitions into approved/rejected now also require
  the corresponding approval decision audit event;
- current worker/control repair audit metadata is DB-constrained for stable
  lease, failure, retry, manual cancel/retry, and stale-recovery evidence, so
  direct/manual audit rows cannot drop the fields used by diagnostics,
  recovery, or operator review;
- worker failures store failure code/message and attempt metadata. Retryable
  failures return the request to `queued` with `retry_scheduled`, while
  exhausted attempts end as terminal `failed`;
- Agent Runtime run/step/timeline state now records queued, running, completed,
  and failed repair execution states;
- repair-execution-linked Agent Runtime step summaries and timeline payloads
  now use dedicated repair-run/repair-step versions and are DB-constrained to
  retain request/repair-job fingerprints, granted permission status,
  side-effect identity, and the full forward-only rollback contract before
  Admin, run detail, or audit review consumes them;
- repair execution request rows reject direct deletion while the owning
  workspace still exists, preserving the request root plus audit and
  side-effect history; workspace deletion remains the ownership cleanup path;
- GraphQL/common/Admin expose queued/attempt/lease metadata, and focused
  backend tests cover approval queueing, worker completion, retryable failure,
  terminal failure, and authorization.

The Task Route Policy repair executor slice is now implemented:

- approved `repair_task_model_route` requests can carry a persisted
  `task_route_policy_revision_publish` executor payload into the queued repair
  execution worker;
- the worker validates the payload and creates a workspace-scoped
  `ai_task_route_policy_revisions` row with actor, feature kind, model id,
  config key/path, revision, fingerprint, fallback source chain, and repair
  execution metadata;
- runtime result and audit metadata record side-effect kind
  `task_route_policy_revision`, side-effect record id, fingerprint, and
  sanitized summary;
- TaskPolicy immediately resolves the published workspace revision before
  config fallback, so the approved repair changes route model selection through
  the DB-backed runtime path;
- focused backend tests cover approval queueing, worker publication, persisted
  route-policy revision metadata, audit events, and diagnostics resolution from
  the published DB revision.

The Model Registry repair executor slice is now implemented:

- approved `repair_default_model_route` requests can carry a persisted
  `model_registry_revision_publish` executor payload into the queued repair
  execution worker;
- the worker validates the payload and creates a workspace-scoped
  `ai_model_registry_revisions` row with actor, provider id, model id,
  model definition alias, revision, fingerprint, fallback source chain, and
  repair execution metadata;
- runtime result and audit metadata record side-effect kind
  `model_registry_revision`, side-effect record id, fingerprint, and sanitized
  summary;
- the provider registry overlay immediately resolves the published workspace
  revision before provider-profile/native fallback, so the approved repair can
  make a previously missing default prompt model routable through the DB-backed
  model registry path;
- focused backend tests cover approval queueing, worker publication, persisted
  model-registry revision metadata, and publish-gate route resolution from the
  published DB revision.

The repair execution manual control slice is now implemented:

- GraphQL can manually `cancel`, `retry`, or `recover_stale` a persisted repair
  execution request after the same workspace permission checks used by request
  and approval flows;
- cancel transitions `waiting_approval`, `queued`, or `failed` requests to
  terminal `cancelled`, clears worker lease/failure fields, writes a control
  audit event, and synchronizes the linked Agent Runtime run/step/timeline to
  cancelled/skipped state;
- cancel on a `running` request records a durable `cancel_requested` audit
  event tied to the current worker lease id and attempt, keeps the request
  running until the leased worker observes it, and compares the full originally
  read running request snapshot before writing the audit event; the worker then
  cooperatively cancels before side effects and synchronizes Agent Runtime to
  cancelled/skipped state;
- retry transitions failed requests with executable approval state back to
  `queued`, clears failure/completion fields, extends worker max attempts when
  the failure exhausted attempts, writes `manual_retry_requested` plus `queued`
  audit events, and enqueues a fresh worker job id;
- retried requests still execute through the queued worker lease path and the
  existing constrained executors, so approval/preflight-gated side effects are
  preserved;
- stale recovery accepts only `running` requests whose persisted worker lease
  has expired, clears stale lease metadata, writes `stale_recovered` audit
  metadata, requeues when attempts remain, fails when attempts are exhausted,
  and synchronizes Agent Runtime state;
- Admin shows cancel/retry controls for eligible persisted requests and
  displays the resulting durable record and Agent Runtime timeline state;
- focused backend tests cover cooperative running cancellation before side
  effects, while existing backend and Admin tests cover manual cancellation,
  manual retry, stale running lease recovery, audit persistence, Agent Runtime
  synchronization, real worker re-execution, and authorization rejection.

The first durable Agent Runtime slice is now implemented:

- `ai_agent_runs`, `ai_agent_steps`, and `ai_agent_timeline_events` persist a
  generic run/step/timeline model with workspace, actor, workflow, source
  linkage, statuses, evidence fingerprints, sanitized timeline payloads, and
  timestamps;
- the prompt registry repair execution workflow now creates or reuses an
  AgentRun linked to the persisted repair execution request;
- approval-gated repair requests create a `waiting_approval` run with an
  approval step and timeline events, while safe no-op completions can map to a
  completed runtime run;
- repair execution approval and worker execution synchronize the linked run,
  step, and timeline records to queued, running, completed, failed, or
  cancelled state;
- the Agent Runtime model can now create generic persisted runs with tool,
  Codex, MCP, handoff, model, or approval steps through an internal model API,
  reusing existing runs by workspace/source identity for idempotent adapter
  ingestion, including source unique-key races after concurrent callers both
  miss the pre-read;
- source/workflow coherence is enforced at the generic model boundary and
  database boundary, keeping repair-execution-linked rows out of standalone
  worker/control routing unless they use the dedicated repair execution
  workflow/source pair;
- standalone worker adapter-resolution failure evidence is model-validated and
  DB-constrained before failed step summaries or failure timeline payloads can
  persist malformed resolution version/status/workflow evidence, registered
  adapter capability snapshots, selected adapter snapshots, unsupported
  contract step evidence, selected-adapter registration drift, unsupported-step
  consistency drift, or side-effect modes;
- standalone worker lease summaries and run/step timeline lease payloads are
  DB-constrained to retain the current worker lease versions, executor,
  positive attempt count, lease id, workflow/source context, run-level lease
  expiry, and known step-type context where required;
- standalone record-only completion summaries and run/step timeline payloads
  are DB-constrained to retain the current record-only version, executor,
  bounded summary, lease evidence, `sideEffectsApplied=false`, and the
  expected run or step context;
- standalone generic worker completion summaries and run/step timeline payloads
  are DB-constrained to retain the current worker-completion version,
  `agent_runtime_worker` executor, adapter workflow, side-effect mode,
  `sideEffectsApplied=false`, bounded summary, lease evidence, expected run or
  step context, and `adapterResolution.status=completed`;
- standalone worker failure summaries and run/step timeline payloads are
  DB-constrained to retain the current worker-failure version, bounded failure
  diagnostics, lease evidence, and the expected run or step context, while
  nested adapter-resolution metadata remains covered by its dedicated contract
  and rejects completed adapter-resolution evidence in failure payloads;
- standalone terminal worker outcomes now persist
  `ai_agent_runtime_execution_results` ledger rows with run/workspace/actor
  snapshot coherence, workflow/source identity, adapter workflow, executor,
  result status, side-effect mode, side-effect-applied flag, summary, failure
  diagnostics when present, result fingerprint, worker attempt, and worker
  lease id, including generic local-completion success and terminal stale-lease
  failures while requeue recoveries remain non-terminal and do not write
  ledger rows; the ledger now also
  enforces workflow/source snapshot coherence with the parent run, and parent
  run snapshot edits cannot cascade changed actor/source evidence into terminal
  execution-result rows; direct writes now also require result status, worker
  attempt, completed timestamp, failure diagnostics, and payload `completedAt`
  to match the terminal parent run snapshot for the current attempt, while
  allowing manual resume to preserve prior-attempt result history before a new
  worker attempt is leased; terminal parent run rows now reject direct
  same-terminal result/failure/completion/timeline rewrites, and terminal
  result rows now also reject direct content-evidence updates to
  adapter/executor, side-effect, summary, payload, result fingerprint, and
  worker lease fields after write;
- Agent Runtime timeline event rows now reject direct content-evidence updates
  after write, so payload, summary, status, ordinal, fingerprint, identity,
  actor, and step-link evidence cannot be rewritten after timeline consumers
  have durable history. Timeline rows now also reject direct deletion while the
  parent run exists, preserving older run/step lifecycle evidence as well as
  the current state evidence;
- Agent Runtime step and timeline rows preserve the parent run workspace/actor
  snapshot at the DB boundary, and non-null timeline step links preserve the
  referenced step's run snapshot, so direct SQL cannot move child evidence away
  from the run or retarget step-level timeline evidence to another run's step;
- Agent Runtime run rows now reject direct rewrites of run/source/workflow
  identity, title, target/evidence fingerprints, start time, and creation time
  after insert, while preserving status, queue/lease/failure/result,
  timeline-fingerprint, and update-time lifecycle changes. Agent Runtime step
  rows similarly reject direct rewrites of run/workspace/actor linkage, step
  key/title/order, evidence fingerprint, start time, and creation time while
  allowing lifecycle status, repair-sync step type, output summary, completion
  time, and update-time changes;
- Agent Runtime run inserts and lifecycle transitions now require matching
  run-level timeline history by commit time, so direct SQL cannot insert orphan
  run state or move queued/running/terminal lifecycle evidence without an
  append-only timeline event carrying the same run/workspace/actor/status and
  workflow/source payload;
- Agent Runtime step inserts and lifecycle transitions now require matching
  step-level timeline history by commit time, so direct SQL cannot insert
  orphan step state or move pending/running/terminal lifecycle evidence without
  an append-only timeline event carrying the same run/step/workspace/actor
  status and step key/type evidence;
- Agent Runtime step rows now reject direct deletion while the parent run still
  exists, preserving live run step history and preventing step-linked timeline
  evidence from being degraded to run-only history by direct child removal;
- AgentRun GraphQL list/detail responses, repair execution mutation responses
  with linked AgentRun records, common GraphQL operations, and Admin now expose
  `executionResultCount` plus recent `executionResults` so terminal standalone
  worker outcomes are visible without direct SQL access;
- GraphQL/common/Admin now expose registered standalone Agent Runtime workflow
  adapter capabilities via `agentRuntimeWorkflowAdapters`, including workflow
  id, capability version, supported step types, side-effect mode, and summary
  from the same allow-listed registry snapshot used in durable worker failure
  diagnostics;
- standalone manual-control summaries and cancel/resume timeline payloads are
  DB-constrained to retain the current manual-control version, actor, action,
  bounded reason, previous status, workflow/source context, control timestamp,
  and action/status coherence, including cooperative `cancel_requested`
  evidence for leased running runs before adapter execution;
- standalone stale-lease recovery summaries and run timeline payloads are
  DB-constrained to retain the current stale-recovery version, executor,
  reason, retry/next-status coherence, attempt counters, previous lease
  evidence, and workflow/source context;
- standalone worker-owned adapter execution, generic completion, record-only
  completion, failure, and cooperative cancellation paths require the same
  leased worker attempt as the current run row before terminal writes, so
  same-lease attempt drift cannot persist stale execution-result ledger rows,
  step output summaries, or terminal timeline evidence;
- repair-execution-linked run and step payloads are DB-constrained to retain
  the current repair runtime versions, workflow/source/request context,
  repair-job fingerprint, granted permission status, side-effect identity, and
  forward-only rollback contract evidence;
- repair-execution-linked Agent Runtime synchronization now compare-and-swaps
  the originally read linked run and repair step snapshots before updating run
  lifecycle state, step output summaries, timeline fingerprints, or timeline
  events, so stale repair sync cannot overwrite a newer runtime mirror;
- GraphQL can independently list recent workspace-scoped AgentRun records and
  read AgentRun detail by id with steps and timeline events, outside the repair
  execution mutation response;
- user-facing `copilotTasks` and `copilotTask` GraphQL fields now project only
  the authenticated actor's standalone AgentRun records, exclude
  `repair_execution_request` runs, and return bounded task status, approval,
  step, result, artifact, failure, and available-action data instead of raw
  runtime payloads;
- `controlCopilotTask` applies the existing approve, reject, cancel, and resume
  transitions only after workspace permission and actor ownership checks, so a
  member cannot read or control another member's task even inside the same
  workspace;
- the shared frontend core now provides a workspace Tasks page for both Web and
  Electron renderer, including active/approval/completed filters, five-second
  refresh, loading/empty/error states, task detail, steps, results, document
  artifacts, responsive narrow layouts, and guarded control actions; Electron
  adds only the `tasks` sidebar icon contract and does not maintain a second
  task UI implementation;
- Admin can view recent persisted AgentRun, AgentStep, timeline state, and
  registered workflow adapter capabilities in a standalone Agent Runtime status
  card, while still showing the linked run in repair execution results;
- Agent Runtime terminal execution-result rows are full-row append-only at the
  DB boundary, so direct SQL cannot rewrite result identity, run/source
  snapshots, status/failure evidence, payload, fingerprints, worker attempt,
  completion time, or creation time after ledger persistence;
- Agent Runtime execution-result insert conflicts on `(run_id, worker_attempt)`
  now re-read the existing ledger row and validate run/source/result/payload/
  lease/completion evidence before treating duplicate terminal writes as
  idempotent;
- Agent Runtime execution-result ledger inserts now also fence the terminal
  parent run snapshot with an `INSERT ... SELECT` over run identity,
  workflow/source, target/evidence, timeline, failure/completion,
  queue/lease/attempt, and timestamp evidence, so parent run drift between a
  terminal update and result-history insert rolls the transaction back before
  stale ledger evidence persists;
- Agent Runtime run rows reject direct deletion while the owning workspace
  still exists, preserving the run root plus step, timeline, and terminal
  execution-result history; workspace deletion remains the ownership cleanup
  path;
- generic Agent Runtime run creation validates rows reused after
  source-unique insert conflicts against the computed create-time
  workflow/source/target/evidence and step evidence, while preserving the
  existing pre-read idempotent reuse behavior;
- the first production workflow adapter, `agent_runtime_model_completion`,
  executes exactly one active persisted `model` step through
  `PromptRuntime.runText`, so prompt resolution uses the DB-backed Prompt
  Registry fallback chain and model/provider routing uses the existing
  workspace/user-scoped capability policy; the step carries a versioned
  bounded `modelRequest` input contract
  (`agent-runtime-model-request/v1` with bounded prompt name, optional model
  id, and bounded string-only params), the provider call is abortable and
  bounded by a 120s timeout, cooperative cancellation is polled before,
  during, and after generation through the lease-scoped fence, redacted and
  bounded model output evidence flows through the existing DB-constrained
  generic worker completion contract, and invalid model requests fail closed
  before any provider call;
- focused backend and Admin tests cover run/step/timeline persistence,
  idempotency reuse, generic tool/Codex/MCP step persistence, independent
  read/list authorization, workspace isolation, Admin observability,
  generic local-completion execution, model completion adapter execution with
  redacted bounded output evidence, invalid model request fail-closed behavior,
  cooperative cancellation consumed during model generation, terminal
  stale-lease execution result persistence, cooperative running cancellation
  before adapter execution, same-lease worker-attempt drift rejection, and
  execution result ledger read exposure.

The first DB-backed registry slice is now implemented:

- `ai_prompt_registry_revisions` persists Prompt Registry revision records with
  prompt name, scope, workspace, actor, revision, status, fingerprint, fallback
  source chain, and timestamps;
- prompt catalog resolution reads the latest active DB revision, preferring a
  workspace-scoped revision over a global revision, while preserving legacy
  registry and config fallback behavior;
- GraphQL and generated common operations expose registry record source,
  revision metadata, and DB/legacy/config source-chain evidence;
- Admin can distinguish `db_revision`, `legacy_registry`, and
  `config_fallback` sources and search by revision/source-chain metadata;
- approved prompt registry repair executions can now create workspace-scoped
  DB-backed revision records that the catalog read path can resolve before
  global/config fallback;
- GraphQL can directly publish workspace-scoped Prompt Registry revisions after
  `Workspace.Copilot` permission checks, legacy registry publish-gate
  validation, stale-version checks, and route-readiness review;
- direct Prompt Registry publish records review metadata, registry/version
  evidence, route-review fingerprints, source-chain evidence, and idempotent
  matching revision reuse without copying prompt body content or bypassing the
  legacy registry prompt tables;
- focused backend and Admin tests cover workspace precedence, fallback behavior,
  deterministic source-chain evidence, and unauthorized workspace rejection.

The Task Route Policy registry slice is now implemented:

- `ai_task_route_policy_revisions` persists feature kind, scope, workspace,
  actor, revision, status, model id, config key/path, fingerprint, fallback
  source chain, metadata, and timestamps;
- task policy resolution reads the latest active workspace revision before
  global revisions and existing config/provider-default fallbacks for
  embedding, workspace indexing, and rerank routes;
- workspace embedding and rerank execution paths call the DB-aware resolver
  with workspace scope, so DB-backed route policy records affect runtime model
  selection rather than only GraphQL diagnostics;
- GraphQL/common/Admin expose Task Route Policy revision metadata, source-chain
  fingerprints, and DB/config fallback source-chain evidence;
- approved task-route repair executions can now create workspace-scoped
  DB-backed Task Route Policy revision records that the TaskPolicy runtime path
  resolves before config fallback;
- GraphQL can directly publish workspace-scoped Task Route Policy revisions for
  embedding, workspace indexing, or rerank model selection after
  `Workspace.Copilot` permission checks, with idempotent matching revision
  reuse and config/provider-default fallback source-chain evidence;
- focused backend and Admin tests cover workspace precedence, config fallback,
  source-chain evidence, direct publication, and unauthorized workspace
  rejection.

The Model Registry slice is now implemented for read plus constrained
direct/repair-driven write:

- `ai_model_registry_revisions` persists provider id, model id, scope,
  workspace, actor, revision, status, fingerprint, model definition, fallback
  source chain, metadata, and timestamps;
- provider registry construction overlays the latest active DB model
  definitions before native/provider fallback, preferring workspace revisions
  over global revisions;
- GraphQL/common/Admin model diagnostics expose DB revision metadata,
  model-definition source, and source-chain evidence for model candidates;
- approved default-model route repair executions can now create
  workspace-scoped DB-backed Model Registry revision records that the publish
  gate and model routing diagnostics resolve before config/native fallback;
- GraphQL can directly publish a workspace-scoped Model Registry definition
  revision for an existing configured provider after `Workspace.Copilot`
  permission checks, while reusing the existing provider runtime and avoiding
  provider secret/runtime creation;
- the direct publish path sanitizes model definitions to routeable model
  metadata/capabilities, forces the persisted definition id to the requested
  model id, drops arbitrary config fields, and reuses matching revisions
  idempotently only when the sanitized fingerprint matches;
- focused backend tests cover workspace precedence, global fallback,
  repair-driven publication, direct publication, metadata sanitization, and
  route resolution from the published revision.

The Provider Registry read overlay slice is now implemented:

- `ai_provider_registry_revisions` persists provider id, provider type, scope,
  workspace, actor, revision, status, fingerprint, provider profile metadata,
  fallback source chain, metadata, and timestamps;
- quota-backed provider registry construction overlays the latest active DB
  provider profile revision before applying DB-backed model definition
  revisions, preferring workspace revisions over global revisions;
- DB-backed provider profile revisions are intentionally constrained to
  existing provider runtimes and reuse the configured provider credentials,
  so this slice does not introduce arbitrary provider secret management;
- existing model and route diagnostics can surface `providerProfileSource` and
  `providerProfileConfigPath` as `db_revision` /
  `ai_provider_registry_revisions[...]`;
- focused backend coverage verifies workspace precedence, global fallback,
  route/model metadata from the DB-backed provider profile, and unauthorized
  workspace rejection.

The constrained Provider Registry publish API slice is now implemented:

- GraphQL can publish a workspace-scoped Provider Registry profile metadata
  revision for an existing configured provider after `Workspace.Copilot`
  permission checks;
- the publish path validates that the target provider id exists in the current
  configured registry and reuses that provider runtime/type instead of creating
  arbitrary provider runtimes;
- the model write path sanitizes provider profile metadata before persistence,
  stores `config: {}`, drops unexpected model-definition fields, and treats
  DB revisions as metadata overlays rather than credential/secret records;
- repeated publishes for the same workspace/provider/revision are idempotent
  only when the sanitized fingerprint matches, preventing silent overwrite of
  a different revision payload;
- focused backend coverage verifies mutation publication, DB sanitization,
  idempotent reuse, unknown-provider rejection, workspace authorization, and
  model routing from the published DB-backed provider profile.
- Provider Health state rows now require matching durable event history for
  route-affecting overlay inserts and updates at commit time, so direct SQL
  cannot create or rewrite status, source, checked timestamp, last-error,
  fingerprint, metadata, or actor/provider snapshot evidence without an
  append-only health event.

The Provider Registry repair executor slice is now implemented:

- approved provider registry repair executions can carry a persisted
  `provider_registry_revision_publish` executor payload into the queued repair
  execution worker;
- the worker validates the payload and creates a workspace-scoped
  `ai_provider_registry_revisions` row with actor, provider id/type, revision,
  sanitized provider profile metadata, fallback source chain, and repair
  execution metadata;
- persisted provider profile metadata still stores `config: {}` and reuses the
  existing configured provider runtime/credentials, so the executor does not
  introduce arbitrary provider secret writes;
- runtime result and audit metadata record side-effect kind
  `provider_registry_revision`, side-effect record id, fingerprint, and
  sanitized summary;
- the provider registry overlay immediately resolves the published workspace
  provider profile before global/config fallback;
- focused backend coverage verifies approval queueing, worker publication,
  persisted metadata sanitization, and model diagnostics resolution from the
  published DB-backed provider profile.

The DB-backed registry row-constraint slice is now implemented:

- Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
  revision tables reject malformed row scope/status, scope/workspace pairs,
  JSON shapes, identity strings, revision strings, fingerprints, timestamp
  ordering, and fallback source-chain provenance vocabulary at the database
  boundary;
- the latest provenance constraint keeps `fallback_source_chain` entries
  aligned with the current model-layer sanitizer by rejecting unknown
  `source`, `scope`, or `status` values before registry overlays, diagnostics,
  or Admin read paths can observe direct/manual malformed rows;
- the latest optional metadata constraint rejects malformed source-chain
  metadata fields such as non-string fingerprints/model/provider ids, invalid
  Prompt Registry `registryId`, invalid Task Route Policy feature/config keys,
  and invalid Provider Registry provider types before direct/manual rows can
  bypass model-layer sanitization;
- current-version registry revision metadata must pair direct-publish versions
  with `publishSource=graphql_mutation` and repair-executor versions with
  `publishSource=repair_execution_worker`, while older object-shaped metadata
  versions remain compatible;
- current-version repair-executor registry metadata must retain repair request,
  approval, operation, target locator, and candidate evidence fields before
  direct/manual rows can weaken repair provenance consumed by diagnostics or
  audit review;
- direct and repair-driven publish paths for Prompt Registry, Task Route
  Policy, Model Registry, and Provider Registry now append
  `ai_registry_revision_publish_events` rows for both `revision_published` and
  idempotent `revision_reused` outcomes, with DB constraints tying event
  metadata and revision snapshots back to the parent revision rows, rejecting
  parent workspace revision snapshot edits, requiring workspace publish events
  to keep actor evidence so nullable actor columns cannot bypass workspace
  snapshot checks, and including global publish events whose nullable
  workspace/actor columns would otherwise bypass workspace-scoped composite
  snapshot checks, plus actor-present global events whose actor evidence now
  stays bound to the parent revision actor snapshot, and append-only event-row
  restrictions that reject coherent post-write event evidence rewrites while
  still permitting true no-op updates; publish/reuse event rows now also reject
  direct deletion while their parent registry revision exists, and registry
  revision rows reject direct deletion while their owning workspace still
  exists, with global revision deletion always rejected because it has no
  workspace ownership cascade path;
- model-owned registry publish/reuse event inserts now CAS against the full
  parent revision snapshot from the publisher's hydrated row, including
  family-specific content evidence, fallback source-chain, metadata, and
  `updated_at`, so stale Prompt Registry, Task Route Policy, Model Registry,
  or Provider Registry reuse/publication reads fail before appending new
  publish history;
- registry publish-event insert conflicts now re-read the existing event by
  fingerprint and validate family, revision, provider/model identity,
  workspace/actor, revision status/fingerprint, event type/source, and metadata
  fingerprint before treating the event as idempotent;
- registry `revision_published` event rows now carry the same
  application-owned timestamp as the parent revision creation, keeping
  publish-history-required checks and newest-first diagnostics independent of
  database default transaction-time ordering;
- Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
  revision inserts now use `RETURNING id` to classify unique-key race losers as
  `revision_reused` instead of misreporting a second `revision_published`
  event;
- registry revisions now reject direct content-evidence updates immediately
  after insert, so Prompt metadata/source chains, Task Route Policy route
  content, Model Registry definitions, Provider Registry profiles, and shared
  source-chain/metadata evidence cannot drift before or after publish/reuse
  event history exists;
- active workspace registry revisions with current direct-publish metadata, and
  real repair-worker revisions using the model-owned
  `repair-${executionRequestId}` contract, now require matching durable
  `revision_published` history by commit time; idempotent `revision_reused`
  events also require an existing publish anchor, and deleting that anchor is
  rejected while parent/reuse evidence remains; deleting either
  `revision_published` or `revision_reused` event rows is rejected while the
  parent revision still exists;
- existing registry revision GraphQL response types and direct publish model
  returns now expose `publishEventCount` plus recent publish/reuse events so
  operators can inspect current revision history without direct SQL access;
- prompt catalog DB-backed revision reads now expose
  `registryRevisionPublishEventCount` and recent
  `registryRevisionPublishEvents`, and Admin renders publish/reuse history on
  the normal prompt catalog diagnostics panel;
- model/task-route diagnostics now expose bounded Model Registry and Task Route
  Policy publish/reuse event history through `getPromptModels` and Admin,
  while keeping publish-event history out of source fingerprint inputs;
- focused backend coverage verifies direct writes fail for the new provenance
  and optional metadata constraints across all four DB-backed registry
  families, plus current-version source/version drift, repair metadata evidence
  drift, publish-event content/fingerprint drift, and missing/reuse-only
  publish-history drift.

The Provider Health State persistence slice is now implemented:

- `ai_provider_health_states` persists workspace-scoped provider health state
  for existing configured providers, including actor, status, checked time,
  last error, source, fingerprint, and metadata;
- GraphQL can record a provider health state after the same `Workspace.Copilot`
  permission check and configured-provider validation used by Provider Registry
  direct publish;
- effective provider registry construction overlays DB-backed health state
  after provider profile revisions and before model definition revisions, so
  existing route selection and diagnostics consume durable health state instead
  of only static config metadata;
- Provider Health metadata now preserves reserved writer fields at the model
  boundary and is DB-constrained to retain the expected metadata version plus
  source-specific publish-source vocabulary;
- Provider Health cleanup metadata is also DB-constrained for configured
  snapshot profile evidence, stale configured-snapshot cleanup provenance, and
  stale probe-result cleanup freshness evidence;
- Provider Health writes now append durable event-history rows for manual
  overrides, workspace probe results, configured snapshots, configured snapshot
  cleanup, and stale probe cleanup, with DB constraints on event/source/
  publish-source coherence, metadata shape, non-orphan state-id integrity,
  state identity/workspace snapshot coherence, and write-time state
  fingerprint plus actor snapshot coherence for newly written event rows;
- Provider Health event rows reject direct content-evidence rewrites after
  persistence, so state linkage, provider/scope/workspace/actor evidence,
  status, timestamps, source/event type, fingerprints, metadata, and
  creation-time history remain append-only while true no-op updates stay
  compatible;
- Provider Health workspace and global configured-snapshot writers now use
  atomic `INSERT ... ON CONFLICT DO UPDATE RETURNING` upserts, so an insert
  race after a missed pre-read overwrites the row with the current
  route-affecting health evidence and appends matching event history instead
  of returning stale state;
- `ai_provider_health_probe_attempts` now persists automatic workspace
  Provider Health probe attempts for active workspace Provider Registry
  revisions. Attempts bind revision id/fingerprint, sanitized provider-profile
  snapshot evidence, request fingerprint, worker lease/attempt state, terminal
  result metadata, and the resulting Provider Health state fingerprint;
- Provider Registry direct and repair-driven publish paths now enqueue the
  same durable no-network Provider Health probe attempt immediately when a
  workspace provider revision is published or idempotently reused, and the
  publish mutation response exposes the queued attempt evidence;
- Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
  direct and repair-driven publish paths now validate revision row conflicts
  against expected row id, family identity, workspace/actor scope,
  revision/status/fingerprint, fallback source chain, publish metadata, and
  family-specific persisted content evidence before recording publish history,
  route/model/profile overlays, or Provider Health probes;
- Provider Health probe enqueue now validates rows reused through
  request-fingerprint conflicts against the computed revision/profile/request
  evidence, so a drifted conflicting row cannot be silently returned as the
  durable attempt;
- Provider Health probe enqueue now writes through a parent Provider Registry
  revision `INSERT ... SELECT` fence that compares revision identity,
  workspace/actor scope, fingerprint, raw provider profile, raw fallback
  source-chain, metadata, creation time, and update time before any queued
  attempt evidence is inserted, so stale provider revision snapshots fail
  closed instead of producing probe work from outdated registry evidence;
- Provider Health event insertion now validates deterministic event-id
  conflicts against the current state/event evidence, including provider
  identity, workspace/actor snapshot, timestamps, source/type, state/event
  fingerprints, last-error text, and metadata fingerprint, before treating the
  event write as idempotent;
- `copilot.providerHealth.enqueueWorkspaceProbeAttempts` and
  `copilot.providerHealth.processProbeAttempts` provide the first durable
  automatic probe worker path. The current probe is explicitly no-network: it
  checks that the DB revision still resolves to a configured provider runtime
  and text-capable model contract, then publishes healthy/degraded/down through
  existing workspace `probe_result` state/event history;
- Provider Health probe completion/failure now locks and revalidates the
  current non-expired worker lease before writing route-affecting health state
  or retry/dead-letter evidence, so stale workers whose leases were re-acquired
  cannot publish outdated probe results;
- Provider Health probe completion/failure now also requires the same attempt
  counter snapshot before terminal or retry writes, so stale in-memory workers
  cannot publish health state or failure evidence after attempt metadata drifts
  under the same lease id;
- Provider Health probe completion/failure terminal updates now compare the
  full locked attempt row snapshot, including provider-profile evidence,
  request/result/failure fields, lease timestamps, health-state linkage, and
  update time, so same-lease row drift fails before route-affecting mutation;
- repair execution workers now re-lock the request row and confirm the same
  current non-expired worker lease immediately before applying constrained
  registry side effects, so stale workers whose leases were recovered cannot
  publish registry revisions or write side-effect evidence;
- repair execution worker failure persistence now also requires the same
  worker attempt snapshot as the leased worker read, so stale failure/retry
  handling cannot write terminal or retry audit evidence onto a newer attempt
  under the same lease id;
- repair execution worker terminal completion/failure updates now compare the
  originally read running request snapshot, including runtime result, executor
  payload, queue/lease/attempt, failure, completion, creation, and update-time
  evidence, before writing terminal audit or side-effect ledger rows;
- repair execution side-effect ledger writes now independently compare the
  completed parent request snapshot written by the worker path before inserting
  side-effect history, so request drift after the completion update but before
  ledger insertion fails closed and rolls back the terminal transaction;
- repair execution side-effect preflight, completion, and cooperative
  cancellation now require the same worker attempt snapshot as the leased
  worker read, so stale same-lease attempt drift cannot consume cancellation
  or write side-effect ledger/completed audit evidence onto a newer attempt;
- repair execution worker-owned cooperative cancellation terminal writes now
  also compare the full originally read running request snapshot before
  clearing the lease or appending cancelled audit evidence, so same-lease
  request drift fails closed before stale worker consumption persists;
- repair execution running `cancel_requested` audit writes now compare the full
  originally read running request snapshot before appending cooperative
  cancellation history, so same-lease request drift fails closed before stale
  operator evidence is persisted;
- repair execution waiting/queued/failed manual cancellation now compares the
  originally read request identity, approval, runtime, executor-payload,
  failure, queue/lease/attempt, completion, creation, and update-time evidence
  before terminalizing, so stale cancellable-row evidence cannot produce
  misleading cancellation audit history;
- repair execution manual retry and corrected-payload resume now compare the
  originally read failed request snapshot against persisted approval, runtime,
  executor-payload, failure, queue/lease/attempt, completion, and update-time
  evidence before requeueing, so stale failed-row evidence cannot produce
  misleading manual-control or queued audit history;
- repair execution stale-lease recovery now compares the originally read
  expired running request snapshot against persisted identity, runtime,
  executor-payload, failure, queue/lease/attempt, completion, creation, and
  update-time evidence before recovering, so stale running-row evidence cannot
  write recovered queued/failed audit history;
- repair-execution-linked Agent Runtime sync now also compares the linked run
  and repair step snapshots it read before writing mirror state, so stale
  runtime synchronization cannot append timeline evidence or output summaries
  derived from an outdated repair execution projection;
- standalone Agent Runtime workers now re-lock the run row and confirm the
  same current non-expired worker lease before workflow adapter resolution or
  execution, so stale workers whose leases were recovered cannot invoke
  registered adapters or write unsupported-adapter failure evidence;
- standalone Agent Runtime worker-owned adapter execution, generic completion,
  record-only completion, failure, and cooperative cancellation paths now also
  require the same worker attempt snapshot as the leased worker read, so stale
  same-lease attempt drift cannot write terminal execution results, step
  summaries, or timeline evidence onto a newer attempt;
- standalone Agent Runtime worker-owned failure, record-only completion, and
  generic completion terminal run updates now compare the full originally read
  running run snapshot, including workflow/source identity, target/evidence,
  timeline fingerprint, failure, queue/lease/attempt, completion, creation,
  and update-time evidence, before writing execution-result ledger, step, or
  timeline history;
- standalone Agent Runtime execution-result ledger writes now independently
  compare the terminal parent run snapshot written by the worker path before
  inserting result history, so terminal run drift after the run update but
  before ledger insertion fails closed and rolls back the terminal transaction;
- standalone Agent Runtime worker-owned failure, record-only completion, and
  generic completion terminal step updates now compare each active step's
  originally read identity, status, output summary, evidence, order, and
  timestamp snapshot before writing terminal step summaries or timeline
  evidence;
- standalone Agent Runtime lease acquisition now also compares the hydrated
  run and active-step snapshots before writing lease timeline fingerprints,
  step `workerLease` summaries, or lease timeline rows, so stale hydration
  rolls the entire lease transaction back;
- standalone Agent Runtime stale-lease recovery now compares the hydrated
  expired run and active-step snapshots before clearing leases, updating step
  summaries, writing execution-result ledger rows, or appending run/step stale
  recovery timeline events;
- standalone Agent Runtime manual cancel/resume now compare the full
  originally read run snapshot, including workflow/source identity,
  target/evidence, timeline fingerprint, failure, queue/lease/attempt,
  completion, creation, and update-time evidence, before writing control
  timeline or step evidence;
- standalone Agent Runtime running `cancel_requested` writes now also compare
  the full originally read running run snapshot before mutating the timeline
  fingerprint or appending cooperative cancellation history, so same-lease
  run drift fails closed before stale operator evidence is persisted;
- standalone Agent Runtime manual cancel/resume child step updates now compare
  each originally read step's identity, status, output summary, evidence,
  order, and timestamp snapshot before writing manual-control summaries;
- standalone Agent Runtime workers now also consume matching cooperative
  cancellation requests after an adapter returns without terminal state and
  before incomplete-adapter failure persistence, so post-start adapter yield
  cancellations become terminal `cancelled` evidence instead of false worker
  failures;
- Provider Health mutation responses now expose `eventCount` and recent
  event-history rows so manual health transitions can be inspected without
  direct SQL access;
- Provider Health probe attempts now have a workspace-scoped GraphQL/Admin
  read path for recent `ai_provider_health_probe_attempts` rows, including
  revision/profile/request/result/state fingerprints, sanitized profile
  snapshot evidence, actor, attempt counters, terminal timestamps, failure
  diagnostics, and worker lease evidence;
- Provider Health dead-lettered probe attempts can now be retried through
  GraphQL/Admin by creating a fresh queued attempt for the same active
  Provider Registry revision/fingerprint, while the original terminal
  dead-letter evidence remains immutable;
- focused backend coverage verifies DB persistence, workspace authorization,
  route exclusion when health is `down`, and restoration when health returns to
  `healthy`.

The latest DB-history hardening slices are now implemented:

- repair execution side-effect ledger rows reject direct deletion while the
  completed parent request still requires them, repair audit events reject
  direct deletion while the parent request still exists, and repair request
  rows reject direct deletion while the owning workspace still exists;
- Agent Runtime run/step timeline rows reject direct deletion while the parent
  run still exists, and terminal execution-result ledger rows reject direct
  deletion while the parent run still exists; Agent Runtime step rows reject
  direct deletion while the parent run still exists, and Agent Runtime run rows
  reject direct deletion while the owning workspace still exists;
- DB-backed registry publish/reuse event rows reject direct deletion while the
  parent revision still exists, and Prompt, Task Route Policy, Model, and
  Provider Registry revision rows reject direct deletion while their owning
  workspace still exists;
- support bundle audit events reject direct deletion while the parent bundle
  still exists, download authorization rows reject direct deletion while the
  parent bundle still exists, support bundle request rows reject direct
  deletion while the owning workspace still exists, and support bundle
  transfer events reject direct deletion while the parent download
  authorization still exists;
- Provider Health event rows reject direct deletion while the parent health
  state still exists, and Provider Health state rows reject direct deletion
  while their owning workspace exists; global Provider Health state deletion is
  rejected outright because there is no workspace cascade owner;
- all of these delete restrictions preserve ownership cleanup where applicable,
  with Agent Runtime roots, repair execution roots, support bundle roots,
  workspace-scoped registry revisions, and Provider Health state cleanup
  preserved through workspace deletion, and disposable Postgres smoke verifies
  direct-delete rejection plus cascade compatibility.

The Context Memory scope, trust-boundary, and planning trace slice is now
implemented:

- the session scope resolver combines the primary conversation document with AI
  Context attached documents and revalidates `Doc.Read` before using any
  document or project scope;
- project scope is enabled only when all readable documents resolve to the same
  active context project; mixed and multi-project sets fail closed without
  loading project memories;
- recall and Automatic Memory capture use the same resolved scope, and capture
  writes to one unique project, one readable document, or workspace only when
  no document is in scope;
- ambiguous multi-document capture is skipped instead of copying into multiple
  projects or widening to workspace scope;
- active `context-planner/v5` renders Rule, Automatic Memory, project summary,
  and rolling summary text in a bounded untrusted `user` message rather than
  merging it into the primary system message;
- immutable v1-v4 strategy registrations remain archived and replayable with
  their original fingerprints and rendering behavior;
- `ai_context_plan_traces` appends the strategy, counts, selected ids/scores,
  character budget, resolved scope, and source/output fingerprints for every
  saved text plan without persisting Rule, Memory, summary, or message text;
- AI Context strategy diagnostics expose aggregate trace count and latest trace
  time, and focused scope/planner/session/DB tests plus host and Docker smoke
  cover the new contract.

The active `context-planner/v6` commercial-memory foundation is now
implemented:

- Automatic Memory writes use structured `ADD`, `UPDATE`, `DELETE`, and
  `NOOP` decisions, with a deterministic path for explicit remember/forget
  commands and a bounded heuristic fallback when no structured extractor is
  configured;
- memory rows persist fact keys, confidence, importance, validity/expiry,
  sensitivity, supersession, embedding, use-count, and last-used evidence;
- conflicting facts update or supersede the active version, disabled facts can
  be reactivated safely, and the user can undo or delete captured memory;
- permission-prefiltered retrieval combines keyword and embedding similarity,
  temporal/confidence/importance features, reranking, and MMR diversity;
- each owner/scope is bounded to 200 active Automatic Memory rows with
  least-recently-used eviction, preventing unbounded per-scope growth;
- Rule has independent application modes, conditions, priority, immutable
  revisions, rollback, and hit history, while workspace-enforced Policy is a
  separate higher-trust layer;
- ambiguous readable document sets can use an explicit project selection, but
  stale or unauthorized selections fail closed;
- AI Context settings expose the corresponding inspect, edit, disable, delete,
  undo, revision, and rollback controls;
- the v6 renderer preserves private Rule, Memory, and project context as an
  explicitly untrusted `user` message, while workspace Policy can occupy the
  policy layer without promoting private content into `system`;
- the v6 evaluation smoke covers extraction, sensitive-data rejection,
  retrieval, scope leakage, Rule interference/conflict priority, and latency.

The latest compatibility and verification repair is now implemented:

- automatic memory extraction treats English durable-memory directives
  case-insensitively, so sentence-initial forms such as `Remember ...` follow
  the same private owner/workspace capture path as lowercase directives;
- AI Chat derives context chips and reference-document state before Lit
  renders, eliminating update-cycle warnings without changing persisted
  context or document-freshness polling behavior;
- image execution plans deduplicate identical attachments across prompt
  messages before native preparation, and serialize the N-API image request
  DTO into the snake-case transport contract expected by the Rust execution
  plan compiler, restoring single-image edit requests without changing text or
  multimodal chat planning;
- stale repair workers that no longer own the current lease/attempt treat
  cooperative cancellation as a no-op instead of surfacing a false worker
  error;
- deterministic malformed or conflicting repair executor payloads terminate
  with stable failure codes instead of entering automatic retry;
- support bundle download authorization compares the original persisted JSONB
  snapshot and nullable artifact metadata, so safe hydration of legacy rows
  does not create a false stale-snapshot conflict;
- GraphQL manual-control mutations translate expected repair/Agent Runtime
  domain validation failures into user-facing bad requests;
- task-route diagnostics carry policy-candidate identity fingerprints,
  embedding-index and rerank-runtime contracts, provider provenance, and
  effective-source evidence through generated GraphQL types and Admin/model
  consumers;
- generated GraphQL `JSON` values use an `unknown` client boundary instead of
  a string-only record or global `any`, and the Registry publish-event
  metadata consumer keeps that value opaque until a concrete use site narrows
  it;
- the root typecheck now includes isolated per-file Copilot AVA/e2e/spec test
  typechecking, preventing those suites from being silently excluded after the
  production project was narrowed; the legacy 12,000-line resolver smoke stays
  on its documented `yarn r` runtime path because it exceeds TypeScript's
  control-flow analysis limit.

The GitHub issues #2-#8 stabilization pass is now implemented:

- production and baseline memory extraction no longer contain benchmark-only
  marker patterns; natural durable cues drive the v6/v5/v4 baseline;
- sentence parsing preserves decimal versions and rejects questions,
  one-request-only phrasing, and common sensitive forms before persistence;
- GraphQL memory operations are throttled, workspace/document/project access is
  rechecked, enum inputs are schema-backed, and expected Prisma conflicts are
  translated into bounded user-facing errors;
- the database limits Automatic Memory content length through a new forward
  migration, while the v1-to-project transition cleans legacy user-scope
  workspace ids before enforcing the current scope contract;
- context refresh polling uses independent request sequencing, pauses while the
  page is hidden, applies bounded exponential backoff, and reauthorizes cached
  MCP/keyword-search results before returning them;
- the workspace MCP endpoint now advertises the `localmind-ai` v3 identity and
  the `delegate_to_localmind`, `get_localmind_task`, and
  `control_localmind_task` tools, with
  protocol-version validation,
  post-2025-03 batch rejection, notification response semantics, strict task
  argument validation, redacted unexpected failures, and workspace-bound
  credential rotation/revocation behavior;
- AI Context, Help, sidebar, and document-update alert copy is localized; the
  alert uses theme tokens, bounded TTL/count storage, and covered light/dark
  contrast behavior;
- registry source-chain, repair-control, support-bundle snapshot, readable-doc,
  and realtime publication regressions are covered by focused tests, including
  double-user/double-workspace GraphQL isolation and persisted approval state;
- provider/model fixtures and the oversized resolver smoke are aligned with the
  current upstream model registry and isolated typecheck/runtime contracts.

The inbound workspace MCP AI delegation slice is now implemented:

- the Streamable HTTP server exposes `delegate_to_localmind`, the read-only
  `get_localmind_task`, and cancel-only
  `control_localmind_task`; the built-in
  LocalMind AI can produce a read-only answer, plan one optimized complete
  Markdown document replacement, or queue a durable tool-agent run with the
  same server-side tool categories as AI Chat; work outside those executors
  still returns `unsupported_task`;
- the advertised `localmind-ai` v3.4.0 instructions, tool descriptions, and
  input-schema field descriptions now encode one unambiguous LocalMind-scoped
  routing contract: only work explicitly directed to LocalMind or requiring
  LocalMind-managed resources enters the public tool surface; existing-task
  status/result queries route directly to `get_localmind_task`, explicit
  cancellation routes directly to `control_localmind_task`, and all remaining
  requests asking LocalMind to answer or act use `delegate_to_localmind`;
  ordinary Codex, Claude, and other host-agent conversations remain unaffected;
  task reads require the returned `taskId`; cancellation is the only control
  action; task ids are not document ids; and callers must not search for
  LocalMind's internal `doc_create`/`doc_read` tools;
- inline delegation attachments are persisted as immutable workspace Blobs
  bound to the delegated actor and credential family, limited to 10 MiB each,
  eight per task, and 20 MiB combined; `attachmentIds` remain available only
  for later same-family reuse, and planning and worker execution reread the
  bytes under live Blob ACL and
  verify persisted size/SHA-256 evidence before providing bounded extracted
  text or bytes to the model, while storage reconciliation treats active MCP
  attachment rows as Blob references rather than cleanup candidates;
- `agent_runtime_localmind_tool_agent` exposes task-scoped attachment read,
  code artifact, conversation summary, document read/create/update/title
  update, keyword and semantic search, web search/crawl, document composition,
  and section editing through the existing `ToolRuntime`; it now also exposes
  semantic workspace document/folder Trash, restore, permanent delete, folder
  list/create/rename/move, and document placement/move operations
  from the same canonical tool-category registry used by Web AI, preserving
  each tool's normal permission and deployment checks instead of adding direct
  MCP resource tools;
- task creation persists the sorted names and exact input-Schema fingerprints
  of tools actually available through `ToolRuntime` in
  `localmind-tool-agent-request/v5`; Enterprise and SparkClaw aggregate tools
  additionally freeze their concrete connection/provider/tool/risk/confirmation
  capability catalogs. Execution exposes only capabilities present in both the
  task snapshot and current registries, rechecks dynamic catalogs immediately
  before execution, and then relies on each tool's live ACL. Missing required
  completion tools fail with `required_tool_unavailable`, while snapshot
  acquisition failure persists terminal `tool_snapshot_failed` state;
- delegated attachments use `task_attachment_read`, which can read only the
  attachment ids frozen on the current task. Each chunk request rechecks the
  task/actor/workspace/credential-family binding and live Blob ACL, rereads and
  verifies the immutable Blob evidence, reparses the source, and returns at
  most 8,000 extracted-text characters; `blob_read` is not registered without
  an AI Chat session;
- keyword search uses the indexer when available and otherwise scans the most
  recently updated 200 readable Markdown documents in batches of 16 before
  globally ranking and limiting matches; parser failures and invalid binary
  documents are skipped without hiding other read failures;
- workspace folder tools require `Workspace.Organize.Read` for lists,
  `Workspace.Sync` for mutations, the corresponding `Doc.Trash`, `Doc.Restore`,
  or `Doc.Delete` permission for document lifecycle changes, and `Doc.Read`
  before placing a document. Ordinary document/folder deletion moves targets
  to Trash. Document metadata stores a direct claim plus one claim per folder
  Trash operation, so overlapping folder restores remove only their own claim;
  legacy manifests without claims retain their original newly/already-trashed
  semantics. Permanent deletion is exposed only for explicit permanent intent,
  requires Trash state and matching title/name, recursively deletes affected
  documents and all placements, validates and rewrites every other affected
  folder Trash manifest, preserves the target fingerprinted manifest until
  physical deletion succeeds, and remains retryable after partial failure;
- delegated tool-agent runs have a 120-second timeout, poll durable
  cancellation and credential/workspace authority during execution, propagate
  the abort signal into the tool loop, enforce a hard maximum of 20 tool
  executions, and now fail with `tool_agent_timeout`
  even when the native stream converts abort into a normal iterator close;
  v5 requests persist a v3 completion contract naming required tools and any
  document, workspace operation, Enterprise provider, SparkClaw tool, ordering,
  or side-effect constraints. Text-only claims cannot complete create/update or
  organization tasks. Conditional mutations require a successful `doc_read`
  followed by either `doc_update` or `conditional_noop_complete`; the no-op tool
  must return the exact fingerprint from that read. Unsatisfied contracts fail
  with retryable `required_tool_evidence_missing`;
  native tool failures remain in sanitized execution summaries, while only
  bounded answers, argument fingerprints, referenced document ids, and
  created/updated artifacts are persisted;
  successful folder mutations additionally persist a sanitized
  `workspace_organization` effect in Agent Runtime side-effect evidence and
  task projection, while idempotent replays are not counted as new effects;
- delegated document creation derives a stable document id from task id and
  title. `DocWriter.createDoc` accepts that requested id, repairs a missing root
  registration on replay, and returns the existing document id instead of
  creating duplicates;
- each planned task persists a schema-validated plan snapshot and fingerprint;
  database constraints reject malformed snapshots and prevent a written plan
  from being replaced, while the query projector never exposes raw AgentStep
  output that can contain complete document replacement content;
- `get_localmind_task` uses the delegation request id as stable `taskId`, maps
  delegation plus AgentRun state into the bounded `localmind.task.v1` contract,
  supports version-based waits up to 30 seconds, and returns sanitized plans,
  steps, final results, and artifact references without invoking AI or
  advancing the task; new MCP tasks have no approval state;
- task reads are isolated to the creating credential family, survive rotation,
  recheck family activity and the task's frozen `get_localmind_task`
  permission, and recheck live `Workspace.Copilot` plus `Doc.Read` for every
  referenced document. Other
  credential families receive `task_not_found`, while ACL loss returns a direct
  query error without historical output;
- cancel controls are durable and idempotent, remain isolated to the creating
  credential family, use the task's frozen `control_localmind_task` permission, and
  recheck live `Workspace.Copilot` without requiring `Doc.Update`. Queued runs
  cancel immediately; leased running runs expose `cancelling` until
  the Agent Runtime worker cooperatively records terminal cancellation;
- credentials persist only a selected subset of the three public AI tool
  permissions; the migration
  revokes legacy resource-capability credentials rather than silently widening
  them, and the normalized permission set is frozen on each delegation request
  as its maximum authority;
- real `Workspace.Copilot` plus each tool's `Workspace.CreateDoc`, `Doc.Read`,
  or `Doc.Update` ACL is checked live at planning and execution boundaries.
  Missing ACL is returned directly as a terminal permission/resource or tool
  failure and never creates an elevation request;
- document and tool-agent side effects create one durable `mcp_ai_delegation`
  request and one queued `AgentRun`; the task executes without an approval step
  or caller decision, including when no callback endpoint exists;
- an optional result notification URL and encrypted per-credential-family HMAC
  secret are configured when the MCP credential is created. HTTPS is required
  unless the exact origin is deployment-allowlisted, and terminal notification
  delivery uses bounded no-redirect SSRF-safe HTTP, durable outbox rows, worker
  leases, retries, and signed payloads;
- the Agent Runtime worker rechecks credential-family activity, frozen scope,
  live ACL, and cancellation during execution; the optimized replacement path
  also checks document version immediately before `DocWriter`. AgentRun and
  delegation completion are committed together before optional signed terminal
  notifications are queued. Focused Docker E2E covers callback URL policy, ACL
  denial before planning, task-bound attachment upload/isolation/evidence,
  tool-agent document creation and idempotent replay,
  tool failure projection, automatic execution, stale ACL, resource-version
  conflict, execution without a callback, immediate/cooperative cancellation,
  query state transitions, and terminal notification delivery.

The first workspace-managed outbound SparkClaw MCP connection slice is now
implemented separately from the inbound LocalMind workspace MCP surface:

- Workspace Settings owners and admins can submit a one-time SparkClaw Access
  Ticket without supplying an endpoint; the server-controlled endpoint defaults
  to `http://192.168.20.252:18790/mcp` and protocol `2025-06-18`;
- Streamable HTTP initialization requires the `sparkclaw-conversation-mcp`
  server
  identity, sends the Ticket only on `initialize`, handles JSON, SSE, and `202`
  responses, then uses the issued `Mcp-Session-Id` for later requests;
- the Ticket is never persisted or returned, while the Session is AES-GCM
  encrypted with the existing server crypto helper and represented to clients
  only by a short fingerprint; Session rotation is encrypted immediately;
- persisted endpoint/protocol values are audit snapshots only: every outbound
  request and GraphQL projection uses the fixed server configuration, so row
  drift cannot redirect requests to another target;
- one durable connection per workspace stores bounded sanitized tool catalog,
  explicit enabled-tool allowlist, connection/error timestamps and soft-delete
  state. It requires the fixed conversation-v2 business/control catalog, but
  only `sparkclaw.conversation.send` is exposed and enabled automatically;
- enabled tools are exposed to both normal LocalMind AI Chat and the durable
  inbound MCP tool-agent workflow through two bounded aggregate tools,
  `sparkclaw_mcp_search` and `sparkclaw_mcp_execute`; raw catalog entries never
  become unconstrained model-visible tools;
- `sparkclaw.conversation.send` is treated as a write operation. Execution
  requires the latest user message to directly name SparkClaw, reject a
  negative request, and contain every forwarded text or workspace-media locator;
  `sparkclaw.operation.get`, `.result`, and `.cancel` remain internal controls
  and never enter the model/UI allowlist;
- SparkClaw tool calls use stable task-scoped idempotency keys, one encrypted
  durable result ledger, a 45-second initial fenced lease, bounded three-attempt
  initial recovery, cancellation/failure terminal states, and workspace Redis
  serialization. Remote `running` and `approval_required` operations persist
  their operation ID, state, deadline, next poll, and poll-attempt count;
  a minute cron claims 30-second poll leases, calls the internal result tool at
  15-second intervals, rechecks live delegated-user ACL, and converges remote
  success/failure/cancel/revoke, deadline, and 20-attempt exhaustion. Binary
  `data`/`blob` payloads are removed before encrypted result persistence;
- the execution ledger has database-enforced status/lease/result coherence and
  a composite connection/workspace foreign key, preventing cross-workspace
  evidence drift;
- MCP delegation freezes the complete actually available tool-name set, each
  input-Schema fingerprint, the concrete Enterprise and SparkClaw capability
  catalogs, and the completion contract in
  `localmind-tool-agent-request/v5`; workers intersect every frozen maximum with
  current registries, recheck dynamic catalogs before execution, and recheck
  delegated-user ACL. Existing v1-v4 queued tasks retain their historical tool
  and completion semantics, so an upgrade cannot widen their authority;
- `401`, invalid Session, and Session decryption failures move the connection
  to `REAUTH_REQUIRED`, clear the unusable encrypted Session and fingerprint,
  and cannot reuse the old Session;
- reads require `Workspace.Settings.Read`; connect, refresh, allowlist, test,
  disable, and delete require `Workspace.Settings.Update`; audit events record
  lifecycle metadata without Ticket, Session, or test query/result contents;
- focused backend model/service/runtime, resolver-permission, frontend-store,
  integration-visibility, cross-workspace UI isolation, MCP delegation E2E, and
  disposable PostgreSQL full-migration checks cover the slice.

## Workspace AI Profile And Enterprise CLI Governance

The company-instance and department-workspace control model now has a durable
AI Profile and enterprise connector policy path:

- workspace AI Profiles, Profile credential membership, and user assignments
  are DB-backed with cross-workspace foreign keys, one-default-per-workspace,
  and cascade cleanup;
- Admin account create/edit flows set or change a user's Profile assignment;
- runtime routing resolves explicit active-member assignment, workspace
  default, then legacy BYOK only when the workspace has no Profile records;
- Provider Profile API keys are redacted on Admin reads and mutation responses,
  while same-id updates can preserve the stored secret without returning it;
- instance administrators configure Enterprise CLI provider and tool
  allowlists in Admin AI; creation, authorization, refresh, projection, search,
  and execution use the live policy;
- Admin AI owns all BYOK policy switches, including private-network endpoint
  access; the duplicate generic Settings group and unreachable main-product
  BYOK implementation and translations are removed;
- users manage their own enterprise account authorization lifecycle, but no
  longer edit the tool allowlist.

## Not Completed

Remaining production gaps include:

- production-model evaluation and tuning for implicit structured memory
  extraction beyond the deterministic explicit-command and heuristic fallback
  paths;
- enterprise-grade DLP/classification beyond the current fail-closed known
  sensitive-form filters;
- real Sparkclaw embedding/reranker shadow evaluation, quality/cost thresholds,
  and large-corpus production load validation;
- model-generated structured rolling summaries with provenance and
  conflict-safe refresh;
- planner trace joins to answer quality, correction/undo feedback, staged
  rollout, and online A/B outcomes without storing sensitive context text;
- mutating repair executors beyond the constrained Prompt Registry, Task Route
  Policy, Model Registry, and Provider Registry workspace revision publishers;
- rollback behavior written by a real runtime;
- rollback contract execution is still not implemented; the current runtime
  only enforces the forward-only recovery contract and executor-payload /
  side-effect-kind mapping on applied constrained registry side effects, the
  durable side-effect ledger and its parent result snapshot, the current
  worker/control repair audit metadata contracts, and the current non-expired
  repair worker lease before applying constrained registry side effects;
- broader Agent Runtime Codex/MCP/handoff adapters and specialized tool
  executors beyond the LocalMind AI Chat tool loop, model completion, document
  update, record-only, and repair execution workflows;
- the user Tasks page currently observes and controls existing standalone
  AgentRun records; a general user task composer/planner that creates arbitrary
  office workflows from this page is not implemented;
- atomic expected-version compare-and-write for CRDT document replacement. The
  delegation path checks the saved version at approval and again immediately
  before `DocWriter.updateDoc`, but the current document storage API has no
  expected-version CAS, so a concurrent edit can still land between the final
  check and write;
- whiteboard, database/table, asset mutation, comment, collaboration, history,
  and other inbound MCP AI delegation executors beyond the current AI Chat
  server-side tool set;
- live LAN conformance against the real SparkClaw host, multi-connection support,
  and production operational monitoring for the outbound SparkClaw MCP
  connector beyond the current one-connection-per-workspace slice;
- provider-specific object-storage signature adapters, alerting, and rollout
  wiring beyond the generic HMAC webhook ingress before every deployment can
  forward `verified_by_upstream` evidence into the durable forwarding queue;
- automatic retry/escalation for failed archive object cleanup audit events is
  durable, and retention audit metadata is DB-constrained for cleanup
  identity/status evidence, but external operational alerting/escalation
  rollout remains separate deployment work;
- true preemptive live running task interruption while a production executor is
  still doing external work, plus broader non-registry operator-provided
  manual resume controls beyond the current corrected-payload workflow;
- full Provider Registry editor workflows, bulk migration, credential
  management, provider credential rotation, and probe-attempt alert workflows
  beyond the current local and optional real-network Provider Health probe
  ledger/read/retry surface;
- Prompt Registry bulk migration UI, richer diff/eval UX, and full
  audit/history views beyond the current read/direct publish/repair-driven
  revision paths and editable body preview/publish API;
- full Model Registry editor workflows, model diff/review UX, and bulk
  migration UI beyond the current constrained direct/repair-driven publish
  paths.
- full Task Route Policy editor workflows and bulk migration UI beyond the
  current constrained direct/repair-driven publish paths.

## Risk In Current Plan

The old main plan is useful as an audit log but too large for reliable execution.
Future tasks can accidentally continue the read-only placeholder chain instead
of building the actual runtime and persistence layer.

The active direction is now in this directory.
