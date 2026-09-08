# Project AI Permission And Document Workflow

## Authority

The 2026-09-06 [Project Native Resources](project-native-resources.md) contract
now owns resource identity, internal file trees, member content permissions,
source-copy authorization, explicit Workspace publication, and migration.
It supersedes conflicting rules below, including mandatory Workspace placement
before internal creation, direct edits to shared source documents, and an
additional Project/Owner gate for publishing. The native resource model,
internal editors, explicit publication and resumable migration are implemented;
current acceptance evidence is in the
[execution report](../project-native-resources.execution.md). Global Project BYOK, conversation
isolation and the prohibition on AI Project administration remain applicable.

The user-confirmed rules of 2026-09-05 supersede conflicting historical
Workbench, Context Memory, and user-guide descriptions. This document tracks
implementation separately from the product contract; a design is not evidence
that a capability is implemented.

## Earlier Product Contract

Resource creation, shared references and write-grant rules in this historical
section are superseded by Project Native Resources. Native internal operations
check active Project membership. Imports check source read/copy/share authority;
explicit publication checks target ACL and approval without an Owner gate.
Native sessions have `workspaceId = null` and use global Project BYOK. Old
sessions remain readable within their original actor scope but cannot resume
with their former Workspace write semantics.

- Only people create Projects, manage membership, change project policies, or
  approve/reject access requests. AI must explain that creating a Project
  requires user action. A folder is never a substitute. Existing mistakenly
  created folders are retained.
- Intelligence requires an explicitly selected active Project of which the
  actor is a member. The current project matches the sidebar. A conversation
  cannot change projects after its first message. Project changes select a
  corresponding conversation or a clean draft, including separate attachments,
  history, retrieval caches, and memory.
- All Project conversations use the single global Project BYOK configuration
  managed by instance administrators in `/admin`. Provider, endpoint, model and
  encrypted credentials are independent of Workspace and user AI Profiles.
  Missing or disabled global configuration fails closed without Workspace,
  local-lease or quota-backed fallback. The session Workspace remains execution,
  permission and audit context; every document reference independently identifies
  its storage Workspace. This 2026-09-06 decision supersedes historical references
  to the Project session Workspace as a BYOK host.
- Project reads use personal ACL union current-project grants. Document-side
  AI uses personal ACL only. Grants from other projects never contribute.
- Existing-document project writes require a current-project write grant,
  active project membership, read-write AI policy, and satisfied tool approval.
  Execution, approval, retry, and recovery recheck these conditions. Invalid
  context fails explicitly without a broader fallback.
- Personal content not granted to the project must not automatically enter
  shared documents or project memory.
- Creation requires an explicit destination workspace and location, including
  an explicit root selection. Missing or ambiguous destinations open a
  selection and create nothing until confirmed. Changed destinations or stale
  approval evidence require confirmation again.
- Creation checks workspace document creation and location read, write, and
  organization authority. Creating a folder additionally requires folder
  creation authority. Unsupported location authorization must be implemented,
  not assumed.
- Cross-workspace placement creates an independent new document ID, preserves
  the source, establishes no synchronization, copies no source grants, and
  checks source read/copy/share restrictions and destination authority.
- Document creation and project addition are separate durable outcomes. A
  failed addition or pending request cannot be reported as successful project
  authorization; retries must not create another document.
- Project members with source read/copy/share authority may create independent
  Project copies. Members without source sharing authority submit a copy
  request. Reading/editing is not sharing.
- Pending requests are redacted per viewer and copy no source content before
  approval. Approved copy permissions cannot be withdrawn by reviewers;
  subsequent source ACL changes do not invalidate existing Project copies.
  New imports and source refreshes recheck current source authority.
- Notifications go to eligible source document owners or workspace admins.
  They identify applicant, project, source document, and requested read/write
  level. Both decisions require a second human confirmation; approval states
  that all Project members can access the independent copy and approval cannot
  be withdrawn. Rejection accepts a reason. Reviewers receive notifications,
  with no task generated solely because they are reviewers. Applicants and
  target Project members retain waiting-on-others tasks, without approval
  actions; eligible applicants may still withdraw pending requests.
- Decisions recheck authority and conditionally transition pending requests,
  handling duplicates, expiry, withdrawal, and concurrency. Notifications,
  applicant results, sidebar refresh, and audit follow the durable outcome.

## Global Project BYOK Validation On 2026-09-06

The global configuration and audit tables are introduced by migration
`20260906040000_project_global_byok`. The Admin form, member-only Project model
query, persisted session resolution, stream preparation and auxiliary prompt
calls use the same global provider configuration. Workspace route policies and
stale client model preferences cannot select a different Project provider.

Validation reused `localmind-affine:test` in the isolated
`localmind_project_byok_runner` container. No image was rebuilt and no business
runtime synchronization was performed. The following backend regression run
passed 117 tests:

```sh
docker exec -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace localmind_project_byok_runner yarn workspace @affine/server test src/__tests__/copilot/project-global-byok.spec.ts src/__tests__/copilot/byok.spec.ts src/__tests__/copilot/host-services.spec.ts
```

The final Project suite rerun passed all 9 tests after extending coverage to
generated GraphQL requests and auxiliary prompt selection. Coverage includes
administrator restrictions, encryption, immutable audit, concurrent revision
updates, failed probes, missing/disabled config, key rotation, late failures,
multiple Projects/Workspaces, revoked membership and forged session context.
The generated connection-test operation is separate from the settings fragment
so it cannot contain an unused fragment rejected by GraphQL validation.

Frontend verification passed 9 focused tests and 3 configuration-page
integration tests:

```sh
docker exec -w /workspace localmind_project_byok_runner yarn vitest run packages/frontend/admin/src/modules/ai/project-byok.spec.tsx packages/frontend/admin/src/modules/ai/workspace-byok.spec.tsx packages/frontend/core/src/modules/ai-button/entities/project-model.spec.ts
docker exec -w /workspace localmind_project_byok_runner yarn vitest run packages/frontend/admin/src/modules/ai/index.spec.tsx -t 'renders complete AI configuration|saves administrator-owned Enterprise CLI|saves private endpoint policy'
```

The upgrade smoke script
`packages/backend/server/src/__tests__/copilot/project-global-byok-upgrade.smoke.ts`
passed against the isolated `localmind_project_byok_upgrade_20260906_v2`
database. It applied the 335 existing migrations, inserted old Workspace
credentials and a Project session, then applied migration 336 and verified that
both records were unchanged and global BYOK remained unconfigured. Its database
URL is supplied through `PROJECT_BYOK_UPGRADE_DATABASE_URL`:

```sh
docker exec -e PROJECT_BYOK_UPGRADE_DATABASE_URL -w /workspace localmind_project_byok_runner yarn r packages/backend/server/src/__tests__/copilot/project-global-byok-upgrade.smoke.ts
```

Backend TypeScript validation in the Linux container and direct Admin/Core
TypeScript checks passed. Scoped oxlint, ESLint, Prettier and `git diff --check`
passed. Prisma Client, server GraphQL schema, shared GraphQL operations and i18n
were generated through the existing tooling. The combined frontend reference
build remains blocked by pre-existing `DefaultViewDataType` column/sort errors
in `blocksuite/affine/all/src/__tests__/database/conversion-preservation.unit.spec.ts`;
that unrelated file was not changed.

Real Chrome acceptance used the isolated API on port 3012 and Admin preview on
port 8080. Invalid-key rejection, valid-key testing, save, reload persistence,
disable confirmation and re-enable passed. Screenshots at 1440x1000 and 390x844,
each in light/dark mode, showed no blank content or horizontal overflow. Provider
responses and credentials were synthetic; this does not establish connectivity
to a real provider. Existing Workspace credentials were not copied into the
global record and business credentials were not modified.

At verification, `docker system df` reported images 53.71 GB, containers 9.062 GB,
volumes 1.15 GB and build cache 2.913 GB; the host had 167 GiB available. No images,
volumes or existing data were deleted.

## Stage Two Progress On 2026-09-06

Stage two is accepted against the isolated Linux, real Chrome and encrypted
BYOK fixtures below. Business runtime synchronization has upgraded the running
backend from 331 to 335 migrations, with no pending migrations. This acceptance
does not claim a production soak or production latency percentiles.
All pre-existing worktree changes, failed samples and business data are retained.

Migration `20260906010000_shared_write_source_checks` extends the cumulative
ledger with Workspace and private-input classifications, bounded JSON evidence,
and immutable shared-write audit records. It conservatively marks all existing
sessions `unknown:legacy-input-lineage`, including sessions without messages,
because the previous ledger did not prove prompt or memory history. New user
text entered in a selected Project is scoped to that Project; ordinary personal
input, file attachments, private Rules and unverified tool results cannot be
used for a shared Project write. A message rewrite or attachment removal adds
evidence instead of erasing it. Forks retain the evidence and original grants.

Document evidence freezes the active Project grant ID when consumed. A source
without that grant remains unshared in that conversation. Revoking and granting
again creates a different grant and does not make the original source evidence
valid again. A new conversation may consume the newly authorized source.
Recalled Project memories include exact content fingerprints and their source
documents; execution checks active status, quarantine, expiry, content and the
original source grants. Workspace Policy revisions must remain current and
accessible to every Project member. Project/member and policy locks serialize
the checked authority with the write transaction.

Project document update requests and their worker, creation/copy confirmation,
execution/retry and completed no-op, and automatic Project Memory writes record
bounded source evidence and a SHA-256 fingerprint. Rejected checks use an
independent audit insert so rolling back the content write retains the denial.
These are authorization-check records, not claims that a side effect committed.
Project Memory writer decisions require an originating conversation. Unknown
sources count toward the same 4,096-source budget; duplicates at the limit do
not create a false overflow marker. An actual overflow adds a sticky marker.

Migration `20260906030000_shared_write_audience` adds bounded immutable target
audience evidence to each document source check, retaining legacy audits with
an empty audience object. Checks conservatively include all active Workspace
members, direct document grantees and members of other active Projects with a
grant on the destination. Public exposure, unknown Workspace policy, more than
4,096 readers or any reader outside the source Project denies the write. These
are potential readers: directory restrictions or explicit personal denials are
not used to broaden a source's sharing authority. This can reject destinations
whose effective ACL is narrower than that conservative audience. Permission and
Project locks cover the checked write transaction; realtime is not authority.

Ordinary conversation document creation, body/title updates, worker execution,
retry and conditional no-op now persist their cumulative sources and audience.
They currently permit only destinations whose potential readers are the actor.
Private/unknown input cannot become shared simply because the user confirmed a
location. Shared work requires a properly authorized Project conversation.
Ordinary prompt/Rule/memory/tool evidence is also retained. The delegated
planner creates its durable session before model consumption, records source
document IDs and a private context fingerprint, and binds both tool-agent and
direct document-update runs to that session. PromptRuntime also checks the
persisted actor/Workspace before recording auxiliary system-prompt fingerprints.
Office single/batch commands carry the frozen source session through preview
and execution and check before Blob/revision persistence. Directory/root/table
writes use the same transactional source gate. Document update broadcasts from
these transactional tool entries are deferred until commit, including rollback
of metadata/property updates; failed transactions retain their source audit.

The production MCP provider exposes only delegation, task query and cancellation.
The old direct document/context/comment/history factories are not registered
HTTP surfaces. Direct Markdown/title and structured block/whiteboard/database
factories additionally reject unproven shared writes, and their direct creation
factory returns the human-location requirement with zero creation. Re-enabling
other legacy factories requires auditing their sinks first.

| Source or sink                                      | Persistent evidence and enforcement                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| User messages, attachments and edits                | Session ledger accumulates Project-scoped input or private/attachment/unknown markers; removal never clears earlier evidence            |
| Prompt preparation and auxiliary prompt calls       | Owned session, immutable Project binding and prompt fingerprints; private Rules and unverified attachments remain private               |
| Document reads and both search tools                | Actual Workspace/document pairs and original active Project grants recorded before returning tool results                               |
| Tool outputs and delegated checkpoints              | Bounded result fingerprints; unverified results become unknown; completed checkpoint replay rechecks shared sinks                       |
| Recalled memories and history/forks                 | Exact memory fingerprints, original source grants, expiry/status and copied cumulative ledger; legacy histories remain unknown          |
| Document body/title, create/copy, conditional no-op | Target audience plus cumulative source audit at prepare/confirmation/execution/retry/no-op; actual storage callback holds authorization |
| Project Memory writer                               | Originating session and cumulative-source check in the writer transaction, including no-op and replay                                   |
| Office AI commands and batches                      | Frozen run session checked before application and inside Blob/revision persistence; denied writes create no Blob or revision            |
| Directory and shared Workspace data                 | Transactional source gate around mutation; personal favorites/settings are not shared content sinks                                     |

Human-authenticated manual editing is a separate product entry: selecting a
Project and submitting new text explicitly establishes that text's Project
scope. This does not grant automatic permission to copy previously consumed
private or revoked sources. Realtime payloads and caches are never source or
permission authority.

### Delegated Location Recovery

Migrations `20260906020000_delegated_document_location` and
`20260906021000_delegated_location_guards` add `waiting_for_location` to delegated
requests and Agent Runtime, immutable execution-session binding, operation
binding, confirmation actor/evidence, a 24-hour confirmation lifetime, and
durable tool checkpoints. Confirmation is an authenticated user mutation with
explicit Workspace plus root/folder selection. MCP exposes waiting state,
revision/expiry and final results, but no location-confirmation operation or
caller-selected user identity. The Linux HTTP fixture rejects both a forged
MCP tool and an MCP bearer token used against the human GraphQL mutation.

Each `doc_create` uses its real tool-call ID for operation idempotency. Multiple
documents may have the same title and still receive independent IDs. Checkpoints
freeze arguments and completed results, allow at most 20 calls, 1 MiB each of
input/result and 8 MiB cumulative runtime data; database fields are bounded to
2 MiB. An unfinished non-create call cannot be replayed automatically. A pending
location releases the worker lease, preserves the checkpoint and prevents
further tool calls. Recovery reconstructs history and revalidates completed
document operations. Creation, placement and Project addition retain separate
receipts. Artifacts returned through MCP use their actual storage Workspace.

Withdrawal and MCP cancellation close pending operations without confirming or
creating anything. Competing confirmations advance the revision once; expiry
and permission/target drift require new valid confirmation. Expiration is
bounded, indexed, skips locked operations and includes abandoned running
operations with expired leases. The periodic job resumes completed location
operations and re-enqueues queued runs after lost enqueue requests. Linux tests
cover these transitions, credential revocation, stale checkpoints, audience
expansion after confirmation, and two same-title documents. Full process
restart and browser location acceptance passed against the running backend.
A cancelled run is excluded from automatic location recovery. A
per-request conflict does not stop other recoverable requests; human task resume
updates run and delegation together and rejects withdrawn operations and inactive
credentials. Task/Workbench document artifacts use actual storage Workspaces,
bounded parsing and live read checks; revoked artifact results are redacted.

The retained upgrade fixture has verified 332-to-334 and 334-to-335 upgrades,
old content/unknown-lineage retention, actor/revision constraints, immutable
audience evidence and its size limit. Regression and upgrade databases have
335 migrations; business also has 335 and scale fixtures remain at 332. The real
331-migration backup was independently restored into
`localmind_project_ai_business_upgrade_v2_20260906` and upgraded to 335. Restore
required `search_path=pg_catalog,public` for non-extension public functions in
that isolated database because pg_restore's empty search path broke legacy
nested SQL function calls. The initial failed restore database was retained;
business functions were not modified for this workaround.

### Runtime And Notification Evidence

Backups are retained in `~/.codex/backups/project-ai-stage2-20260906.idwFOz/`
(directory mode 700, files 600), including the original 331-migration dump,
335-migration pre-lineage/pre-recovery dumps and the waiting-location snapshots.
`localmind:sync:backend`, `localmind:sync:web` and `localmind:sync:all` have used
`localmind_project_ai_runner` as the verified Linux runtime source. The latest
all-sync included Office/directory/MCP lineage checks, recovery state coupling,
multi-document task projection and notification polling, and restarted
`localmind_affine_server`. A subsequent all-sync included notification startup
and waiting-state labels. The final backend sync used
`affine-335-waiting-native-receipt.dump` and included provider-visible recovery
receipts. Synchronization changed the running container and static Web/Admin
bundles, not `localmind-affine:local`. It applied no additional migration beyond
the four stage-two migrations. Final Docker usage was images 53.38 GB,
containers 8.73 GB, volumes 1.15 GB and build cache 2.913 GB; no cleanup ran.

Chrome fixtures use only synthetic accounts and documents. Initial evidence at
`/tmp/localmind-project-ai-stage2-browser-f2635ced-1d15-459f-92d5-97bd7a54a23f/`
proves submission, reviewer notifications, approve/reject second confirmation,
cancelled confirmation, rejection reason and applicant terminal results.
The subsequent withdrawal case exposed a dropped realtime notification update.
Notification count snapshots now refresh projections every 15 seconds as well
as on focus/reconnection, including unchanged counts, and fall back to GraphQL
when realtime requests fail. Bounded periodic recipient reconciliation adds new
source owners/admins; stale recipients lose decision authority through live
notification projection. These changes passed 22 notification model/refresh
tests. The frontend now also starts snapshots from the actual authentication
state, covering restored sessions without a new login event. Its final six
count-service and five list-service tests passed.

The complete Chrome matrix at
`/tmp/localmind-project-ai-stage2-matrix-2afaab07-a080-41f4-9203-aead705890bb/`
proves duplicate decisions without another audit, withdrawal, expiry, offline
reconnection, new source-owner notifications, stale reviewer rejection after
revocation, and newly promoted/demoted Workspace administrators. The database
fixtures change only synthetic users and documents in Workspace
`74c3e500-4dd7-4f03-b836-366d988a3b43`. Decisions use authenticated synthetic
human accounts and the UI confirmation dialog; no AI tool receives decision
authority.

Linux `notification-transport.e2e.ts` uses the actual Socket.IO Redis adapter
with two endpoints and the existing isolated `localmind_project_ai_redis`.
During a three-second Redis WRITE pause, the approval and result notification
commit before publication completes. Unpausing delivers the event; a repeated
decision retains exactly two audit events (request and decision). The retained
passing request is `3b462e05-6fd8-42c9-b0fe-2a3c36b10859`. Business Redis was not
paused. Fault injection requires `LOCALMIND_TEST_REDIS_PUBLICATION_PAUSE=1`;
ordinary suite runs skip it. Both endpoints close and all Redis clients
disconnect after the fixture.

Chrome transport evidence at
`/tmp/localmind-project-ai-stage2-transport-25ecc71a-656e-4668-99af-a55b8a8d14ba/`
uses an ephemeral local HTTP proxy that rejects all realtime handshakes while
passing HTTP. Four realtime requests were rejected and eight notification HTTP
requests were observed. The result and rejection reason appeared after 9,193 ms;
exactly one persistent result notification existed. Returning to the normal
origin preserved the same result. The proxy was closed after the test.

Encrypted BYOK in host Workspace `091dff1f-69ba-4711-be7f-36cbbd7a2b8e`
completed isolated delegated task `fc65e3e2-005e-499d-bd05-340add3cf842` after a
backend restart. The external client also restarted and rotated its credential
through the authenticated user API, retaining the same credential family.
Before explicit Workspace/root selection, revision was zero and no target
document existed. Confirmation advanced revision once and persisted the human
actor. Operation `c1c88689-390f-4472-9590-d2baead53c73` created and placed only
document `735a8435-10af-4bb0-a243-b8c15bd94d15` in Workspace
`af44f3a9-5e55-4a9d-a359-10a14a2690fd`, with `projectStatus=not_requested`.
The recovered second worker attempt completed and MCP returned that exact
storage Workspace/artifact. The test credential was revoked after completion.
No BYOK key was read into output or stored in browser evidence.

Evidence is retained at
`/tmp/localmind-project-ai-stage2-runtime-dc29183b-a765-4f0f-bc87-35eef39e1f6e/`.
The earlier task `7095ec4c-3212-4849-a144-6115bc5ffada` exposed empty recovered
message content and native projection dropping UI-only tool traces. Recovered
receipts now have nonempty structured content that survives native projection;
the Linux two-document fixture asserts this provider-visible content. The old
task was cancelled with its already-created document retained and its second
unconfirmed operation never created. Failure samples and screenshots remain.

Task detail visual QA passed at 1600x1000 and 390x844 in both light and dark
themes, including long titles and Workspace IDs without horizontal overflow.
Screenshots are retained at
`/tmp/localmind-project-ai-stage2-visual-92aac803-2887-4ec3-a875-60ebb3c962d8/`.

### Directory Scale Evidence

The fixed `localmind_project_ai_runner` reused `localmind-affine:test`; no image
was rebuilt. Dedicated database `localmind_project_ai_scale_20260906` retains
every benchmark sample and is never reset by the benchmark. The latest sample
Workspace is `87da0b97-cd6c-428f-87a9-96626adf91af`, with 10,000 rows, 9,000 folder
policies, a 64-level chain and a 1,325,534-byte Yjs snapshot.

| Measurement                                          |      Elapsed | Prisma Calls |
| ---------------------------------------------------- | -----------: | -----------: |
| Previous per-row authorization baseline              |    13,863 ms |       24,003 |
| Latest directory first page                          |       329 ms |           15 |
| Latest destination-picker page                       |    129.36 ms |           16 |
| Remaining 100 directory pages                        | 13,858.33 ms |        1,514 |
| Administration read                                  |    188.92 ms |           16 |
| Two concurrent policy changes, exactly one committed |     258.9 ms |           19 |
| Read after policy revocation without realtime        |    148.95 ms |           15 |

The full traversal covers 101 pages, including its terminal empty page.
Prisma-call counts include background test-module activity. Peak process RSS
during the traversal was 1,132.47 MiB; it is not the cache's retained size. The
latest policy `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` used
`workspace_directory_grants_pkey`, returned 9,000 rows, hit 256 shared buffers,
performed zero disk reads, and completed in 2.443 ms. Earlier retained samples
also selected a sequential scan (3.536 ms); this is one local-container
measurement, not a production percentile or cold-disk result.

Directory reads decode once per snapshot and use one bounded policy snapshot
plus document ACL batches of 500. The destination picker shares that request's
tree and rights. Actual confirmation and execution reauthorize. The parsed-tree
cache holds at most 8 Workspaces and 16 MiB of serialized rows, with a 4 MiB
per-entry cap and 30-second lifetime. Each request reads actual storage and
hashes the complete merged snapshot bytes, including deletion sets. It does not
cache permission decisions or use realtime delivery as authority. Missing
storage, malformed/cyclic ancestry, excessive depth and policy overflow fail
closed; callers receive clones rather than mutable cached rows.

Focused validation at this checkpoint includes a successful 331-to-332 upgrade
smoke, 66 source/document-operation/Workbench regression tests, the scale
fixture, planner/tool boundary regression, and three memory lifecycle/quota
tests. The additional recalled-memory expiry test passed after correcting its
fixture to respect the existing valid-from/expiry constraint. Upgrade fixtures
remain in `localmind_project_ai_stage2_upgrade_20260906`, independently of the
resettable regression database. The browser decision/reconnection matrix,
Redis transport fault and final location recovery passed as recorded above.
Subsequent focused runs passed 96 Office/directory/runtime cases,
72 direct-MCP/document/delegation cases, and then 41 source/recovery/transaction
cases after the recovery and deferred-broadcast fixes. Backend TypeScript and
focused lint checks passed. The final MCP/delegation run passed 39 cases; after
the native-receipt correction, the focused location and real Redis cases both
passed. Counts describe separate runs and overlap; they are not a unique-test
total. Full monorepo frontend typechecking still has the previously recorded
unrelated BlockSuite conversion-preservation failures; this is not reported as
a passing full-repository typecheck.

```sh
docker exec -w /workspace localmind_project_ai_runner sh -c 'export DATABASE_URL="${DATABASE_URL%/*}/localmind_project_ai_stage2_20260906"; exec yarn workspace @affine/server test src/__tests__/models/copilot-context.spec.ts src/__tests__/copilot/document-operation.e2e.ts src/__tests__/copilot/intelligence-workbench.e2e.ts'
docker exec -w /workspace localmind_project_ai_runner sh -c 'export DATABASE_URL="${DATABASE_URL%/*}/localmind_project_ai_scale_20260906"; exec yarn workspace @affine/server test src/__tests__/copilot/directory-scale.e2e.ts'
docker exec -w /workspace localmind_project_ai_runner sh -lc 'DATABASE_URL="${DATABASE_URL%/*}/localmind_project_ai_stage2_20260906" yarn workspace @affine/server test src/__tests__/copilot/copilot-mcp-delegation.e2e.ts src/__tests__/copilot/mcp-tools.spec.ts'
docker exec -w /workspace localmind_project_ai_runner sh -lc 'DATABASE_URL="${DATABASE_URL%/*}/localmind_project_ai_stage2_20260906" LOCALMIND_TEST_REDIS_PUBLICATION_PAUSE=1 yarn workspace @affine/server test src/__tests__/copilot/notification-transport.e2e.ts'
docker exec -w /workspace localmind_project_ai_runner sh -lc 'DATABASE_URL="${DATABASE_URL%/*}/localmind_project_ai_stage2_20260906" yarn workspace @affine/server test src/__tests__/copilot/copilot-mcp-delegation.e2e.ts --match="*delegated location*"'
docker exec -w /workspace localmind_project_ai_runner yarn vitest run packages/frontend/core/src/modules/notification/services/count.spec.ts packages/frontend/core/src/modules/notification/services/list.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn tsc --project packages/backend/server/tsconfig.json --noEmit
LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_project_ai_runner LOCALMIND_DATABASE_BACKUP=/Users/dev2/.codex/backups/project-ai-stage2-20260906.idwFOz/affine-335-waiting-native-receipt.dump yarn localmind:sync:backend
```

### Changed Code Boundaries

Stage-two edits are concentrated in these existing ownership boundaries. This
list is not a claim that unrelated pre-existing worktree changes belong to this
stage.

- Source evidence: `packages/backend/server/schema.prisma`, the four
  `20260906*` migrations, `src/models/copilot-session.ts`,
  `copilot-context.ts`, `copilot-context-memory.ts`, and Copilot prompt,
  context, search/read tools and tool-runtime entries.
- Shared sinks: `src/plugins/copilot/document-operation-service.ts`,
  `document-copy-service.ts`, `context-memory-service.ts`, document-update
  adapters/tools, Office command entries, direct MCP document factories and
  `src/core/doc/writer.ts` / `workspace-organization.ts`.
- External recovery: `src/models/copilot-document-operation.ts`,
  `copilot-agent-runtime.ts`, `copilot-mcp-delegation.ts`,
  `src/plugins/copilot/agent-runtime-localmind-tool-agent-adapter.ts`,
  `document-operation-resolver.ts`, MCP delegation/query/control and task
  projections in `resolver.ts` / `intelligence-workbench-resolver.ts`.
- Directory scale: `src/core/doc/directory-resolver.ts`,
  `document-destination.ts`, `workspace-organization.ts`, document/permission
  models and `src/__tests__/copilot/directory-scale.e2e.ts`.
- Notifications: `src/models/notification.ts`, `src/core/notification/`,
  `packages/frontend/core/src/modules/notification/services/count.ts`,
  `list.ts` and their focused specs.
- Shared protocol/UI: server `src/schema.gql`,
  `packages/common/graphql/src/`, frontend document-creation panels and
  Intelligence/Tasks views, including
  `desktop/pages/workspace/tasks/global-workbench-tasks.tsx` and `index.tsx`.
- Regression/upgrade fixtures: backend `src/__tests__/copilot/` source,
  audience and delegated-location upgrade smokes; document/delegation,
  direct-MCP, Office and notification tests; corresponding model tests and
  frontend notification/task tests. `notification-transport.e2e.ts` is the
  explicitly enabled real Redis fault fixture.
- Authority/handoff: this document, `current-state.md`, `context-memory.md`,
  `agent-runtime.md` and `intelligence-workbench.md`.

Backend `src/` paths above are relative to `packages/backend/server/`.

Residual limits: audience checks deliberately overapproximate readers; legacy
conversations and unknown provenance remain fail-closed; the directory snapshot
limit remains 10,000 rows. The measurements do not establish sustained
production capacity or cold-disk percentiles. Recreating the runtime container
requires the normal fixed-image packaging flow because source synchronization
does not update the image. Other historical checkpoint gaps below are
superseded by the stage-two acceptance record where explicitly covered.

## Stage One Acceptance On 2026-09-05

This phase is implemented and stage-accepted. Older checkpoint paragraphs below
record the state at the time each increment landed; their statements that the
business runtime or browser acceptance had not yet occurred are superseded by
this section.

- The server and model-visible tool set both exclude Project creation, member
  administration, permission-policy changes, and access decisions. Requests to
  create a Project direct the person to the human Project surface and never
  substitute a folder.
- Intelligence sessions bind to an authenticated, active Project on first send.
  Sidebar changes select that Project's conversation or a clean draft. Session
  history, attachments, cached retrieval, memory, and tool execution recheck the
  persisted actor/project binding. The user-facing field is **Current project**;
  execution/BYOK Workspace and document storage Workspace are distinct values.
- Personal document-side AI uses personal ACL only. Project reads use personal
  ACL union only the server-resolved current Project's active grants. Existing
  document writes, creation, approval continuation, retries, and recovered
  queue work recheck live membership, Project state, grants, policy, cumulative
  sources, destination rights, and tool approval. Denial fails closed without a
  broader scope.
- Creation persists a frozen operation and creates nothing before the person
  confirms both Workspace and root/folder. Creation, placement, and Project
  addition are separate durable outcomes. Directory policy can express root,
  ancestor, folder, member, and all-member rights; its human administration
  surface uses conditional revisions, immutable audit, and realtime
  invalidation.
- Cross-Workspace copy reads a frozen structured snapshot, allocates a new
  document ID, preserves the source, remaps managed attachments, copies no
  grants, and creates no implicit synchronization. The snapshot's internal
  document title is rewritten before persistence so editor, sidebar, and
  receipt agree.
- Project document addition reuses the authorization domain model. A Project
  Owner with source sharing authority may grant no more than their own level;
  other cases create an access request. Eligible source owners/admins receive a
  durable notification. Approve and reject remain human-confirmed actions,
  recheck authority, use conditional transitions, refresh the applicant and
  Project sidebar, and retain audit. Revocation removes current visibility and
  quarantines derived Project memory.
- Root registration handles pre-existing native/Yjs client-history conflicts.
  A normal root keeps the incremental path. A conflicting root is rebuilt as a
  canonical snapshot from Yjs-visible page metadata and subdocument references,
  assigned a higher client ID than the prior state, and verified through both
  Yjs and the native reader before persistence. The storage adapter merges
  pending root updates under the content lock and repeats authorization before
  and after acquiring that lock.

Focused verification completed with these final aggregates:

- the document-operation suite passed 29/29 tests;
- six frontend session, notification, directory-settings, and directory-store
  files passed 92/92 tests;
- backend directory authorization, realtime, notification refresh, and access
  request suites passed 47/47 tests;
- host and fixed Linux-container backend TypeScript, relevant oxlint,
  Prettier, and `git diff --check` passed;
- the existing `localmind_project_ai_runner` reused
  `localmind-affine:test`; no image was rebuilt;
- `yarn localmind:sync:backend` synchronized the backend business runtime after
  backup `/tmp/localmind-affine-pre-canonical-root-sync-20260906T054321Z.dump`.
  The runtime reports 331 applied migrations and zero pending migrations.

Live browser acceptance used isolated data. Operation
`3c9340a3-c95b-44a0-b046-3b8967958089` copied source document
`8tfFKejzU0kJ-iS45_111` from Workspace
`b4e75109-13fc-473d-b2d6-224e75a8e348` to independent document
`4eb7a324-6f28-4922-84a8-0d095e92c07f` in Workspace
`3c0aed56-6178-43e0-b8a9-97673876f977`. The operation completed with Project
state `not_requested` and eight audit events. Root pending updates were zero;
the root and document were readable by Yjs and the native reader. The requested
title persisted after refresh. Editing either source or copy left the other
unchanged, and the browser reported no errors.

Directory-policy browser acceptance used folder `H24AbqrdL7iBmMGeoEltY`.
Removing the member read override hid it without a refresh; clearing the
override restored it without a refresh, and both changes appeared in audit.
The failed rename dialog left isolated folders `H24AbqrdL7iBmMGeoEltY` and
`MhpgCEYXiUJcmcXvjEZpr`; they are deliberately retained. Failed copy operations
`85e436b7-f059-4ed3-b463-46b7a8474bb1` and
`2c0149c2-0cca-40fc-91f7-89c35397dc3d`, with their created documents, are also
retained as failure evidence.

Residual risks are broader prompt/tool-result lineage at all shared write sinks,
external delegated-task destination selection and waiting/resumption, bounded
10,000-row directory snapshot recomputation on large Workspaces, production
realtime/notification transport soak, and unrelated existing BlockSuite
conversion-preservation typecheck failures. The final browser pass exercised
copy and directory realtime; notification decisions and refresh were covered by
the focused backend/frontend suites rather than replaying every expiry,
withdrawal, duplicate, and concurrency outcome manually.

## Initial Audit

Inspected entry points:

| Surface                                   | Finding                                                                                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intelligence-workbench-authorization.ts` | Existing owner/share-gated addition, generic requests, transactional decisions, expiration, revocation, and memory quarantine are reusable. Notifications are absent from this model.                    |
| `runtime/tool-runtime.ts`                 | Selected-project reads replace personal search. The final project allowlist already filters ordinary metadata and organization writes; execution still needs a live session boundary on every tool call. |
| `core/permission/context-loader.ts`       | Generic permission evaluation includes grants from all active projects. AI needs an explicit narrower grant scope.                                                                                       |
| `context-scope-resolver.ts`               | Inferred project memory and generic ACL can introduce project authority into document chat.                                                                                                              |
| `models/copilot-session.ts`, chat runtime | Existing session project selection is mutable; workbench selection rewrites it.                                                                                                                          |
| `tools/doc-write.ts`                      | Creation implicitly targets the execution workspace root; no confirmed location or independent copy contract.                                                                                            |
| Workbench track and user guide            | Some sections still describe the older workspace project model or report implemented Workbench work as unimplemented.                                                                                    |

## Delivery State

### Conversation Fork Boundaries

Model-level session creation validates any parent conversation before creating
a descendant. Parent and child must retain the same execution Workspace and
project binding. A project conversation cannot become a document-side fork,
and personal history cannot be adopted into a project through a parent link.
Project forks require the same actor and active membership. Other users may
only fork an existing ordinary document fork in the same document; another
user's root/private or project conversation is rejected. The document fork
GraphQL entry point checks personal target-document ACL, and the service checks
parent scope before loading message history.

Cross-user shared-history queries require an explicit document and exclude
project conversations. Own project history listings and counts filter archived
projects and departed membership, including with the non-action/fork filters.
Focused fixtures cover direct model bypass attempts and legacy shared-document
fork compatibility. The GraphQL fixture uses stored messages so provider
availability does not mask authorization results; this does not prove live AI
generation or browser behavior.

### Independent Copy Design

Copies must use the structured BlockSuite snapshot rather than a Markdown
round-trip, preserving databases, canvas properties, and rich-text metadata.
The destination receives a new document ID and its own attachment objects;
source grants and project membership are not copied. The copy operation must
freeze source workspace/document identity, snapshot fingerprint, and attachment
checksums, alongside the existing destination confirmation revision. Execution
and retry recheck source read/copy restrictions, sharing policy, destination
authority, and any requested project addition.

The writer now has a bounded, validated snapshot entry point sharing the
existing idempotent registration path. A Linux fixture proves structured
database properties are preserved, source and copy edits remain independent,
and replay does not overwrite an edited copy. Invalid snapshots fail before
destination registration. Snapshot inspection collects image/attachment and
rich-text footnote blob references, with bounded structure and reference counts.
Copy operations now persist their source snapshot and attachment bytes in
separate source/asset tables, bounded to 16 MiB per snapshot or attachment,
256 attachments, and 64 MiB total per operation at the model boundary. A
fingerprint covers source identity, snapshot bytes, attachment keys, content
types, and attachment bytes. Same-request replays must match this evidence.
Database constraints require an independent source for copy operations;
source/asset updates and standalone deletion are rejected. Deleting the
operation cascades its evidence. Audit records only source IDs, fingerprint,
and attachment count, never snapshot or attachment contents.

Migrations `20260905050000_document_copy_sources` and
`20260905051000_document_copy_audit` have been applied in the isolated Linux
database. `CopilotDocumentCopyService` captures authorized source snapshots and
attachments, then prepares the existing location-confirmed operation. Execution
transfers frozen attachment bytes and writes the structured snapshot under the
new document ID before recording placement and optional project addition.
Source session/project policy, read/copy/duplicate permissions, personal source
sharing-management authority, and the source Workspace sharing switch are
rechecked before preparation and execution effects. Cross-Workspace copies
require sharing authority because the independent destination can expose the
content under different grants. Destination blob writes reuse existing quota
checks. Destination attachment keys include the independent document ID and a
content hash; the copied snapshot remaps block attachments, nested metadata,
and rich-text footnotes to those keys. An existing object for that copy must
match bytes and MIME type; corrupted
or inconsistent target objects are rejected without overwrite. Ordinary source
filenames no longer collide with unrelated destination attachments.

Linux execution fixtures prove an actual copied document with independent
attachment storage, no inherited project grant, and denied execution/retry
after source sharing revocation. Conversation `doc_copy` now prepares the
operation, exposing no write result before authenticated location selection.
The shared confirmation panel identifies a document copy and links to its source
Workspace/document. GraphQL source-reference fields use real generated schema
and client types. The copy tool is approval-gated in project conversations and
is included in the frozen write-capability classification.

The Linux copy/execution and tool-host regression at this checkpoint passed 78
tests; the snapshot/remapping suite also passed its 3 tests. Richer
source/content confirmation and external-task destination selection were still
open. The later stage acceptance above records the completed browser copy flow.

### Creation Execution Design

A document operation owns a frozen content fingerprint and a newly allocated
document ID. Preparing it has no document side effects. Its initial state is
`waiting_location`; only an authenticated user destination selection may move
it to `ready`. The selected workspace and explicit root/folder are separate
from the execution workspace. Destination changes increment a revision and
invalidate previous confirmations. The execution service must check live
workspace/location authority before confirming and before every effect.

Execution leases use opaque tokens and conditional writes. Retrying a failed
attempt keeps the document ID, frozen content, and recorded creation outcome.
Execution renews leases every 20 seconds while work is pending, stops renewal
on completion/failure, and waits for any outstanding renewal to settle. The
writer invokes the operation's live permission/lease check before root
registration, document-body storage, and metadata storage, including after
metadata reads. A handoff between writes prevents the old writer from applying
the next effect or recording success; it cannot clear the successor's lease.
Linux fixtures cover handoff after root registration and slow-write renewal
with timer cleanup. The earlier pre-call callback could not protect storage
calls already in flight; the insertion-time checks described below now cover
database update batches.
After a document exists, destination/content changes require another operation
instead of moving the existing document implicitly. A changed ancestor path
or directory name can be reconfirmed for the same workspace/directory IDs;
this increments the confirmation revision and preserves the previous audit
event without allocating another document. Project addition is a
separate outcome (`not_requested`, `pending`, `granted`, `requested`, or
`failed`); pending access never implies project authorization. This state
machine is exposed through conversation creation requests and a shared location
picker in Intelligence, document-side chat, and Office chat. External/MCP
destination selection and task resumption still need integration.

The delivery record below describes incremental checkpoints. The stage
acceptance above records the later combined Linux, runtime, and browser evidence.
Required regression coverage continues to include denied authority, no-location
zero creation, copy independence, session isolation, request
decisions/concurrency, and revoked-memory exclusion.

### Focused Validation Checkpoint

- Document-side memory capture no longer infers project authority. An invalid
  selection or a selected project excluded by the resolved scope produces no
  memory writes, including no document/workspace fallback. Linux context
  planner suite: 38 tests passed.
- `project_doc_add` uses the persisted session identity and the existing
  authorization model, rejects explicit negative requests, and distinguishes a
  pending request from a grant. Linux tool and host suites: 70 tests passed.
  The natural-language intent filter is conservative; it is not a substitute
  for the domain permission checks or a destination confirmation protocol.
- Existing Intelligence and global Tasks access decisions now open the shared
  human confirmation dialog. The action dispatcher rejects missing or
  mismatched request/action confirmations and preserves rejection reasons.
  Page and dispatcher suites: 20 tests passed, including cancellation without
  a mutation. These are component checks, not browser acceptance evidence.
- Session creation checks active project membership; reuse queries match the
  selected project, and project sessions cannot acquire a document-side host.
- `CopilotDocumentOperationModel` and migration
  `20260905030000_document_operations` now persist frozen create requests,
  explicit destination revisions, execution leases, a stable new document ID,
  and separate creation/project-addition outcomes. Linux model tests passed
  three scenarios spanning concurrent preparation/acquisition, missing location,
  stale confirmation, immutable content/destination, lease takeover/renewal,
  retry after creation, pending project access, and archived-project rejection.
  These prove state transitions only. The external direct creation helper is
  not yet compliant.
- `DocumentDestinationService` intersects Workspace creation/organization/sync
  permissions with explicit root, target-directory, and ancestor grants.
  `workspace_directory_grants` defaults to inherited Workspace authority;
  wildcard member grants and specific user grants can restrict read, write,
  organization, and folder creation. A specific grant replaces the wildcard at
  that directory but cannot override a denial at an ancestor. Administration
  is restricted to active Workspace owners/admins and is not an AI tool. The
  generic organization/sync paths and the human policy UI are integrated as
  described in the latest directory-policy checkpoint below.
- `CopilotDocumentOperationService` now calls the real writer in the selected
  storage Workspace, records creation before placement, retries placement with
  a stable record key, and uses the existing project authorization model for
  addition. It checks current session/project policy and destination authority
  before effects. Operation auditing stores bounded state/confirmation evidence
  without document bodies or lease secrets; previous events reject updates.
- Migrations `20260905040000_directory_grants`,
  `20260905041000_document_placement`, and
  `20260905042000_document_operation_audit` applied in the isolated Linux DB.
  Six model/storage scenarios passed, including real cross-Workspace creation,
  missing-location zero writer calls, placement failure/retry, same-target
  reconfirmation after directory rename, and live directory denial.
- Conversation `doc_create` now prepares a durable operation without calling
  the writer. Authenticated GraphQL selection requires an explicit Workspace
  and either root or directory. The shared picker has duplicate
  submission protection, retry/reconfirmation, and separate creation/placement/
  project outcomes. GraphQL schema/client and i18n use the real generators.
- `doc_creation_status` reads the current actor/session's receipt. It rejects
  foreign sessions and actors, and reports a document ID only after recorded
  creation. Receipt projection rechecks current project grants and request
  state; revocation does not rewrite the original execution evidence and
  cannot continue to appear as current project access. The UI distinguishes
  revoked, rejected, withdrawn, expired, and pending authorization.
- Operation history uses bounded cursor pages; cursors must belong to the
  actor/session. The picker exposes older pending requests and resets page
  state when changing sessions. At this checkpoint, workspace picker pagination,
  explicit textual location resolution, independent copy, and browser
  acceptance had not yet landed; later sections and the stage acceptance above
  record their disposition.
- Latest creation checkpoint: 10 Linux model/execution tests and 6 frontend
  picker tests passed, including paginated pending requests, session reset,
  cross-session receipt denial, and live revoked-grant presentation. The
  schema-generating Workbench fixture also passed. These are focused checks,
  not complete browser acceptance.
- Document and Office chat mount the same shared picker using their active
  session IDs. A Linux document-side execution fixture proves zero creation
  before location selection, actual cross-Workspace creation afterward, no
  inherited project addition, and rejection of project addition without a
  project conversation. The 7-test execution suite and 6-test shared picker
  suite passed. Full frontend typechecking remains blocked by the existing
  BlockSuite conversion-preservation fixture errors.
- External tool-agent completion now requires a confirmed creation result
  with a document ID. A pending location operation cannot produce a created
  artifact, count as an applied document side effect, or satisfy the creation
  completion contract. External tasks still need a proper waiting-for-user
  destination/resumption workflow; evidence rejection alone is not that flow.
- Access notification creation and resolution enqueue a durable per-user
  refresh revision in the same transaction. A bounded worker publishes after
  commit, retries failures, and conditionally acknowledges that exact revision.
  Older workers cannot clear newer changes. Failed rows move behind other
  pending recipients. Realtime delivery uses the existing best-effort transport;
  durable notification rows remain authoritative when clients reconnect.
- Notification lists refresh on realtime revisions even if the unread count
  stays equal. Intelligence refreshes its project sidebar and task projection
  on the same signal, with its existing periodic queries as a fallback.
- Migration `20260905020000_notification_refresh` adds the refresh queue;
  `20260905021000_access_request_notifications_backfill` fills missing eligible
  notifications for unexpired pending requests. Both applied successfully to
  the isolated database. The focused migration fixture removes a notification,
  runs the backfill twice, and proves a single notification and queued refresh.
- Linux authorization/refresh suites passed 21 tests; notification list tests
  passed 5 tests. Backend TypeScript build passed. Full frontend checking still
  reports pre-existing BlockSuite conversion fixture type errors.
- Notification jobs and realtime registry regression: 32 tests passed. Redis
  `EPIPE` messages occurred during test teardown with exit code 0; this does not
  establish production transport reliability or browser delivery acceptance.
- These checks used `localmind_project_ai_runner` with
  `localmind-affine:test`, an isolated database and Redis. This checkpoint
  predated the later backend runtime synchronization and browser validation
  recorded in the stage acceptance above. No image rebuild occurred.

At this earlier checkpoint, explicit textual destination resolution, external
creation entry points, directory authorization integration, copy and
notification acceptance, lease safety, and broader source provenance were still
open. Later sections and the stage acceptance above record the completed items
and current residual risks.

### Retrieval And Fork Audit Checkpoint

Project-memory source resolution now reads a structured projection of the
persisted context configuration, including file/blob presence and parse validity.
Private attachments and invalid configuration exclude automatic project-memory
capture. Every attached document must be covered by a current Project grant,
including documents filtered out of the actor's current readable set; an
unreadable source is not evidence that no private source exists. Selection is
retained and the excluded memory target never falls back to a broader scope.
The model/source and resolver checks passed 12 focused Linux tests; the full
context-planner suite passed 39 tests, with backend type, lint and format checks.

Migration `20260905060000_session_context_sources` adds append-only session
attachment provenance. Database triggers capture context document Workspace/ID
pairs and a private-attachment marker on configuration changes or removal.
They retain evidence after clearing/deleting a context and copy existing
evidence into a fork. Updates and standalone deletes are rejected; deleting
the owning session may cascade its evidence. A 4096-source budget records an
unknown-source marker on overflow, so truncation cannot authorize project memory.
No attachment bodies or filenames are copied to the provenance table.

The scope resolver consumes the cumulative projection. Fixing invalid config
or removing attachments cannot erase its previous private/unknown sources.
Existing sessions with messages receive a `legacy-history` marker because the
absence of current attachments cannot prove that history contains no private
content. This conservatively disables their automatic project-memory target.
New conversations can establish fresh provenance. Tool-result and other message
content lineage, and enforcement at shared-document writes, remain required.

The source projection/immutability/budget/fork checks and scope resolver passed
14 focused Linux tests. An isolated database
`localmind_project_ai_sources_upgrade_20260905` applied the first 329 migrations,
seeded a historical fixture, then applied migration 330. The upgrade smoke
verified document/private/legacy backfill, no marker on an empty session, and
preservation after context clearing. The fixture database was retained. Prisma
Client was regenerated locally and in `localmind_project_ai_runner`; the business
runtime was not synchronized and no image was rebuilt.
The complete context-planner and session-model regression passed 55 tests after
the migration. TypeScript, oxlint, formatting and diff checks passed.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/copilot-context-planner.spec.ts src/__tests__/models/copilot-context.spec.ts --match='project memory excludes*' --match='session source projection*' --match='ContextScopeResolver*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/copilot-context-planner.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/models/copilot-context.spec.ts src/__tests__/copilot/copilot-context-planner.spec.ts --match='session source projection*' --match='context source evidence*' --match='project memory excludes*' --match='ContextScopeResolver*'
```

Upgrade fixture commands use `DATABASE_URL` pointing only to the isolated
`localmind_project_ai_sources_upgrade_*` database. Run `seed` after migration
329 and `verify` after migration 330:

```sh
yarn r packages/backend/server/src/__tests__/copilot/context-source-upgrade.smoke.ts seed
yarn r packages/backend/server/src/__tests__/copilot/context-source-upgrade.smoke.ts verify
```

Context lookup now checks the live session owner, deletion state, active Project
and membership before reading cached configuration. Project contexts cannot
use a document-side session. Document-side contexts also recheck personal
`Doc.Read` before returning cached attachments. GraphQL context creation,
session-ID lookup and attachment/category fields use the same checks instead
of relying on a previously resolved parent or cached chat session.

Focused Linux checks cover another user's context, departure, archive,
soft-deleted sessions, mismatched execution Workspace/session IDs and lost
personal document access. They prove denial before cached attachment access
and rejection of further attachment uploads after departure. Background
consumers, individual attached-document provenance and broader cache
revocation remain separate audit work; this is not complete provenance closure.

This context checkpoint passed 3 model/service tests, 2 GraphQL isolation tests
and 3 normal context-management/search regressions in the existing Linux runner.
Backend TypeScript, focused oxlint, Prettier and `git diff --check` passed.
Only test-container source was synchronized; there was no image rebuild or
business runtime synchronization in this checkpoint.

Prompt attachment preparation and personal semantic attachment search now use
the owned-session context lookup too. `blob_read` reauthorizes and reloads its
context on every execution rather than retaining the context instance captured
when tools were created. Its regression verifies attachment removal and access
loss without another content read. Keyword search regression now explicitly
expects a fresh readable-document scan on each invocation. The combined host,
tool-loop, Office runtime and context-permission suites passed 109 tests in the
Linux runner. This does not yet prove attached-content provenance at shared
document or project-memory write sinks.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/models/copilot-context.spec.ts src/__tests__/copilot/copilot-context-permission.spec.ts --match='context access requires*' --match='*context*cache*' --match='document context checks*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/copilot.e2e.ts --match='context GraphQL rejects cached*' --match='should reject context reads*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/copilot.e2e.ts --match='should be able to manage context' --match='should skip unauthorized docs*' --match='global context search*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/host-services.spec.ts src/__tests__/copilot/tool-call-loop.spec.ts src/__tests__/copilot/copilot-office-runtime.spec.ts src/__tests__/copilot/copilot-context-permission.spec.ts
```

The raw SQL predicate now accepts the same three scope modes as the Prisma
predicate: undefined retains general product ACL, null permits only personal
ACL, and a Project ID adds only that active Project's grants. Generic semantic
search explicitly uses null before embedding candidates reach reranking.
Project semantic search passes the Project resolved by the server together
with authorized source document IDs; the tool rechecks authorization on return.
Neither scope is taken from model-supplied project identity.

The member-departure fork fixture retains another Project Owner before removing
the original owner, respecting the database's last-owner invariant. It proves
that departure hides history and rejects subsequent forks. This checkpoint
predated the combined runtime/browser acceptance; no image was rebuilt.

The runner's previous native addon returned a reader where current Rust source
combines an applicable personal editor grant with a Project grant. Compiling
the current source in the existing test container resolved that mismatch.
The combined permission, context-permission and session suites then passed
54 tests. Backend TypeScript, focused oxlint, Prettier and diff checks passed.
The native build disabled debug symbols and incremental compilation; no image
was rebuilt. Docker available space after the build was 5.6 GiB (91% used).
Do not run concurrent independent AVA commands against this isolated database:
their test application setup can reset each other's fixtures.

Three Workbench regression tests also passed: cross-Workspace document-pair
search, membership-departure rejection, and revocation for a member without
source ACL. Revoking a Project grant does not remove a source owner's personal
ACL, so the owner's search can retain that document. The fixture uses the
bounded Markdown fallback because its keyword index is not configured, and
stubs semantic embeddings; this is not live provider or browser acceptance.

```sh
docker exec -e CARGO_PROFILE_DEV_DEBUG=0 -e CARGO_INCREMENTAL=0 -w /workspace localmind_project_ai_runner yarn workspace @affine/server-native build:debug
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/core/permission/__tests__/docs.spec.ts src/core/permission/__tests__/service.spec.ts src/__tests__/copilot/copilot-context-permission.spec.ts src/__tests__/models/copilot-session.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/intelligence-workbench.e2e.ts --match='project search*' --match='project grants authorize member reads*'
```

Notification checkpoint commands:

Directory mutation checkpoint: `WorkspaceOrganizationService.applyDataOperations`
now checks effective directory rights on both the original and resulting paths
before saving a folder-table update. Changes to an ancestor also check affected
descendants, preventing a parent move from carrying a restricted subtree into a
new location. New folder nodes additionally require `canCreateFolder`. The
Trash, restore and permanent-folder-delete entry points check directory rights
before document callbacks or storage mutations. These checks use the actual
editor identity and the existing inherited directory-grant model.

The organization service, folder tool and document-operation suites passed
30 Linux tests. An extended focused regression additionally proved zero writer
calls for denied Trash, restore and permanent-delete operations, along with
source-path, target-path, descendant and folder-creation denials. Backend
TypeScript, focused oxlint, Prettier and diff checks passed. Only existing test
container source was synchronized; no image rebuild or business runtime sync.

The Workspace WebSocket sync adapter now validates folder-table updates before
storage. It merges the incoming update with current state, rejects unresolved
Yjs dependencies and invalid record identities, and checks changed paths and
descendants, including trashed records. Personal `Doc.Update` is rechecked
before persistence. Raw sync validation/persistence, structured folder-table
mutations and directory policy setters share a transactional advisory lock.

The three Linux suites passed 31 tests after adding sync enforcement. A further
focused test passed through the actual sync adapter and proved denied updates
never call storage, authorized updates persist, incomplete updates are rejected,
and restricted trashed records cannot be silently rewritten.

The subsequent listing/concurrency checkpoint makes `readFolders` and the
folder portion of `readOrganization` filter rows through their complete ancestor
read rights. An explicit child allow does not override an ancestor denial;
restoring the parent permission immediately restores visibility. Invalid paths
are omitted. Trash, restore and permanent folder deletion now also hold the
directory mutation lock for their entire operation. The combined Linux suites
passed 33 tests, including a test that observes the policy setter waiting in
PostgreSQL's advisory-lock table until the active mutation transaction releases
its lock. Backend TypeScript, focused lint, format and diff checks passed.

The complete-table sync protocol now fails closed when the recipient has any
effective directory read denial. Normal folder-table loads return
`SPACE_ACCESS_DENIED`, and folder tables cannot be opened through the single-doc
scope route. Both 0.25 and 0.26 broadcasts enumerate authenticated recipients,
recheck personal document ACL and whole-table directory authority, and omit
unauthorized or unidentified sockets. Recipient checks run under the directory
transaction lock; no room-wide raw folder payload is sent by these paths.
The combined Linux suites passed 34 tests, including denied full-table load,
single-doc-scope bypass refusal, both broadcast protocols and immediate broadcast
suppression after revocation. Backend TypeScript and focused lint passed.

Whole-table denial is the confidentiality fallback. The filtered read/write
client described below now provides partial-directory navigation without using
obsolete raw rows. At this checkpoint, other directory transports/writers,
policy administration UI/audit, runtime synchronization, and browser acceptance
had not yet landed. No image was rebuilt.

The new `workspaceDirectory(workspaceId, after)` GraphQL query is the typed,
filtered read path for that frontend adaptation. It returns up to 100 directory
entries per page, per-entry effective rights, root rights and an explicit
`fullSyncAllowed` flag. Workspace organization-read permission is rechecked
under the directory lock. Document links additionally require personal
`Doc.Read`; malformed or incomplete ancestry is omitted instead of widening
reported rights. This endpoint does not grant AI project-management authority.

The server schema and shared `workspace-directory.gql` client were generated
through the existing schema/codegen flow. The focused API fixture proves page
boundaries, hidden directory exclusion and non-member rejection. The three
Linux suites passed 35 tests; backend TypeScript, focused lint, format and diff
checks passed after fixing import ordering and a non-null assertion. The frontend
FolderStore now selects between the local ORM table (local workspaces or verified
whole-table authority) and the filtered server result. DirectoryAccessStore loads
all bounded pages before publishing a restricted tree, aborts obsolete requests,
and uses an account/server generation to discard late responses. Account changes
and failed revalidation clear displayed remote rows without deleting local
business data. Background revalidation runs every 15 seconds and does not cancel
an already running request. Partial results and pagination loops fail closed.

Desktop and mobile organize sections expose loading/error/retry state. Restricted
mode reads never fall back to cached raw rows; direct local mutation calls are
rejected in that mode. Authorized restricted edits now use
`mutateWorkspaceDirectory` with the complete loaded directory revision. Under
the directory transaction lock, the server checks personal organization and
folder-table permissions, document-link read ACL, old/new paths and affected
descendants before storage. Hidden existing records cannot be overwritten as
new records. The revision hashes the complete Yjs state, including deletion
sets, so deletion-only updates invalidate stale submissions.

The frontend rejects concurrent saves, waits for the real mutation response and
reloads the permitted tree after success or denial. FolderNode consumers in the
desktop/mobile sidebar, virtual navigation, import and onboarding now await
these operations; bulk link changes execute sequentially and failures are shown
without a success notification. Node-specific rights control restricted editing.
The directory Store subscribes to the existing `workspace.access.changed`
channel. Member/role events and subscription readiness immediately clear the
old displayed rows and revalidate; logout unsubscribes. Request invalidation
and account identity generations are separate, so a same-account access event
during a save does not discard the real write result. Directory-policy changes
still need publication from the human administration path, and document-level
grant changes need their own invalidation coverage. Cache removal is currently
display isolation rather than deleting previously downloaded data. Each page now also carries an `authorizationRevision` computed
from the complete visible entry/right set, root rights, whole-table permission
and actor/Workspace scope. The client rejects pages with different authorization
versions even when directory content is unchanged. Visible lists are bounded to
10,000 entries; every page currently recomputes the complete visible snapshot,
which needs performance measurement on larger workspaces. Browser acceptance
and UI localization remain outstanding.

The subsequent mutation checkpoint passed 36 Linux backend tests and 27 frontend
store tests both locally and in the Linux runner. These add stale-revision,
hidden-node overwrite, write revocation, deletion-only revision, duplicate-submit,
failed-write refresh and server-only restricted mutation coverage. Backend
TypeScript passed. Sources were synchronized only to the existing test runner;
no image rebuild or business runtime sync was performed. An additional policy-only
revision test passed through the real Linux resolver after that combined run.
The import suite adds asynchronous authorization denial feedback while preserving
already created documents; it passed 11 tests locally.

The immediate Workspace-access invalidation checkpoint passed 30 store tests
both locally and in the existing Linux runner. New coverage proves clearing rows
before a pending access recheck, membership denial, logout unsubscription, and
same-account event/write interleaving. Focused lint, format and diff checks
passed; frontend TypeScript still has only the six preexisting BlockSuite test
errors. No backend schema, migration, image or business runtime was changed in
this checkpoint.

After authorization-version generation, the Linux directory store suites passed
28 tests. The combined directory/import run passed 39 assertions, but existing
import fixtures emitted BlockSuite schema initialization errors in that runner;
this is not clean end-to-end import evidence. The new asynchronous directory
authorization-denial test was rerun alone in Linux and passed without those
schema errors (10 unrelated cases skipped). The local import suite passed all
11 tests. Focused lint and format/diff checks passed; final frontend TypeScript
still reports only the six preexisting BlockSuite conversion-test errors.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn vitest run packages/frontend/core/src/desktop/dialogs/import/commit-service.spec.ts -t 'waits for folder authorization'
yarn workspace @affine/graphql build
yarn tsc -p packages/backend/server/tsconfig.json --noEmit
```

The earlier 22 frontend store tests passed in the existing Linux runner and cover
local-workspace behavior, complete pagination, account
switches with a late response, access loss and recovery, pagination loops, raw
cache non-fallback and slow active requests. Full frontend TypeScript currently
reports only the six existing errors in the unrelated BlockSuite conversion
preservation test; it is not a clean whole-project typecheck. Test-container
frontend sources were updated; business runtime code and images were not changed.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn vitest run packages/frontend/core/src/modules/organize/stores/directory-access.spec.ts packages/frontend/core/src/modules/organize/stores/folder.spec.ts
yarn tsc -b packages/frontend/core/tsconfig.json --pretty false
```

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/core/doc/__tests__/workspace-organization.spec.ts src/__tests__/copilot/copilot-workspace-folder-tools.spec.ts src/__tests__/copilot/document-operation.e2e.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts --match='generic folder mutations*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts --match='raw folder sync*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts --match='raw directory loads*' --match='raw folder sync*'
```

The subsequent source enforcement checkpoint records `project_doc_read`,
keyword search and semantic search results before returning their content.
Project existing-document write requests and transactional worker execution
reject private, unknown or no-longer-granted cumulative sources. Source identity
includes both Workspace and document ID. Five focused Workbench tests passed,
including approval followed by source revocation, zero side effects on denial,
restored authorization and successful retry. Twenty-five focused context,
scope-resolver and tool-runtime tests and backend TypeScript also passed.

Project automatic-memory persistence now rechecks the same ledger inside its
write transaction instead of trusting the earlier scope result. The complete
session source set is merged into memory-source associations. A new Linux test
proves late private-source rejection with zero memories, authorized persistence,
two retained source associations and quarantine after source grant revocation.
The document-write regression and structured memory lifecycle regression also
passed. The broader `context memories should stay private to their owner and
scope` test failed at its earlier document-list expectation (`copilot.spec.ts`,
line 1324), before reaching the changed writer entry point; that fixture/product
mismatch remains unresolved. These results are not full regression acceptance.

Generated-document operations requesting addition to the current Project now
check cumulative sources at destination confirmation and every execution
revalidation. The complete document-operation E2E file passed 14 tests, including
private-source rejection, grant revocation after destination confirmation with
zero creation, restoration and successful creation plus Project grant. Existing
independent-copy, attachment, lease and directory denial regressions passed too.
Snapshot copies retain their separate source copying/sharing checks. Storage
writes now use the per-batch transactional authorization check described below.
This does not yet prove complete protection for all shared destinations,
attachment writes or prompt inputs.

At this checkpoint, other shared sinks and prompt-source categories, directory
policy completion, business runtime synchronization, and browser acceptance had
not yet landed. Only the existing `localmind_project_ai_runner` received source
updates, and no image was rebuilt. The stage acceptance above records the later
runtime and browser results; broader shared-sink provenance remains a residual
risk.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/intelligence-workbench.e2e.ts --match='project writes reject private*' --match='project search*' --match='formal project writes freeze*' --match='authorization committed before*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/models/copilot-context.spec.ts src/__tests__/copilot/copilot-context-planner.spec.ts src/__tests__/copilot/host-services.spec.ts --match='session source projection*' --match='context source evidence*' --match='project memory excludes*' --match='ContextScopeResolver*' --match='ToolRuntime*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/intelligence-workbench.e2e.ts src/__tests__/copilot/copilot.spec.ts --match='project memory rechecks*' --match='project writes reject private*' --match='context memories should stay*' --match='structured context memory lifecycle*'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts
```

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server prisma migrate deploy
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/notification-refresh.spec.ts src/__tests__/models/intelligence-workbench-authorization.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/notification-refresh.spec.ts src/core/notification/__tests__/job.spec.ts src/core/realtime/__tests__/registry.spec.ts
yarn vitest run packages/frontend/core/src/modules/notification/services/list.spec.ts
yarn tsc -b packages/backend/server/tsconfig.json --pretty false
git diff --check
```

Creation checkpoint commands:

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/models/copilot-document-operation.spec.ts src/__tests__/copilot/document-operation.e2e.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/intelligence-workbench.e2e.ts --match='aggregates accessible workspaces*'
yarn workspace @affine/graphql build
yarn workspace @affine/i18n build
yarn vitest run packages/frontend/core/src/components/ai-document-creation/document-creation-panel.spec.tsx
```

### Storage authorization at insertion

Document creation and snapshot-copy writers now pass their execution guard into
`PgWorkspaceDocStorageAdapter.pushDocUpdates` and `DocModel.createUpdates`.
The guard runs inside the real update transaction both before and after waiting
for the content lock. It acquires the relevant host/destination/source Workspace
permission locks, copy-source document permission lock, destination directory
lock, Project membership/grant row locks and session row lock. Current policy,
cumulative sources and lease ownership are then rechecked. These locks stay held
until that batch is inserted and committed. Guard denial retains the original
bounded failure rather than being mapped to a generic storage failure; automatic
storage retries do not resume a previously denied guard.

The actual database tests prove that a lease expiring while waiting for the
content lock causes zero inserted updates, and that directory revocation waits
for an authorized batch to commit before denying the following batch. The three
organization/folder/document-operation Linux suites passed 38 tests, including
creation, copying, placement recovery and lease heartbeat regressions. Backend
TypeScript and focused lint passed. Only test-runner sources were synchronized;
no image rebuild or business runtime sync was performed.

This is a per-batch boundary. Attachment publication uses the separate staging
and authorization mechanism described below. Root registration, body and
property writes are separate committed batches. Creation receipts now commit
with body updates, and initialization completion is tracked separately as
described below. At this checkpoint, directory policy administration, remaining
transport coverage, and browser/runtime acceptance had not yet landed; their
later disposition is recorded above.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts --match='storage *'
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/core/doc/__tests__/workspace-organization.spec.ts src/__tests__/copilot/copilot-workspace-folder-tools.spec.ts src/__tests__/copilot/document-operation.e2e.ts
yarn tsc -p packages/backend/server/tsconfig.json --noEmit
```

### Body creation receipts and initialization recovery

The document writer can record body creation inside `DocModel.createUpdates`'s
transaction after insertion. The operation service uses this callback to persist
`createdDocumentAt`; failure to record that evidence rolls back the body too.
`recordCreated` rejects claims when neither a snapshot nor pending body update
exists. Replays of an existing body retain the original creation timestamp.

Successful writer initialization appends an immutable
`initialization_completed` event using the existing operation audit table. Lease
renewal serializes that event, and repeated completion does not add duplicates.
A created body with no initialization event resumes the idempotent writer at
the same document ID. A fully initialized document skips that writer when
retrying directory placement or Project addition. No new schema field or
migration is required for this existing durable event log.

The frontend refreshes dependent views after failed submissions too: a later
step may have failed after a real document was committed. The refreshed receipt
can display both “created” and the failure/retry state without claiming project
authorization success.

Four Linux backend suites passed 46 tests, including body/receipt atomicity,
post-body initialization failure, same-ID recovery, and placement retries that
avoid another writer call. The creation panel passed 8 tests locally and in Linux. Backend
TypeScript and focused lint passed; frontend TypeScript still reports only the
six preexisting BlockSuite conversion-test errors. Only the fixed test runner received source
updates; no image rebuild, business runtime sync, commit or publication occurred.
The attachment publication boundary is described below. This checkpoint
predated the combined runtime/browser acceptance recorded above.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/core/doc/__tests__/workspace-organization.spec.ts src/__tests__/copilot/copilot-workspace-folder-tools.spec.ts src/__tests__/copilot/document-operation.e2e.ts src/__tests__/models/copilot-document-operation.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn vitest run packages/frontend/core/src/components/ai-document-creation/document-creation-panel.spec.tsx
```

### Independent attachment staging and publication

New copy attachments use reserved `ai-copy-<documentId>-<contentHash>` keys.
The server verifies the hash against the frozen bytes. Each independent copy
has its own keys, and ordinary upload/complete/multipart paths cannot overwrite
or publish this namespace.

Before uploading bytes, the server commits a pending blob reservation bound to
the operation ID, MIME type and size. Upload I/O occurs without holding a long
permission transaction. Final publication rechecks the current operation,
source/destination permissions and lease inside the same database transaction
that changes the reservation to `completed`. A rejected or stale uploader leaves
its reservation pending. A successor can retry the same frozen bytes and key.

Managed blob reads and signed-download URL creation require a live completed
record for this namespace; pending, deleted and missing records expose neither
bytes nor signed URLs even if an object is present in storage. Public HTTP
requests for this namespace additionally infer the independent document ID and
require that document's current read ACL and a current attachment reference;
Workspace-read permission alone is insufficient. They use the scoped private
response path. The association is encoded in the key, so deleting an old
conversation does not invalidate a surviving document's attachment.

Copy preparation and execution also recheck read/copy/sharing restrictions for
any referenced attachment owned by another copied document. Those owner
permission/grant locks are retained during publication. A user cannot bypass
this check by placing a private attachment key into a document they own.

Thus storage I/O that cannot be interrupted does not itself publish an attachment. These checks
apply to LocalMind's managed read paths, not direct access granted separately
by an object-storage administrator. Pending failed objects are retained for
recovery; no new cleanup/deletion behavior was introduced.

The document-operation, operation-model and Workspace blob suites passed 50
Linux tests. New cases cover upload-before-publication invisibility, permission
revocation during upload, restoration/retry, stale lease refusal and successor
publication. Existing scoped/public-document blob, ordinary upload, multipart
interface and quota regressions passed. Follow-up resolver fixtures additionally
prove refusal of ordinary upload/finalization for reserved keys, Workspace-only
download denial, mismatched document scope and nested private-attachment copying
with zero prepared operations. Backend TypeScript, focused lint and
format/diff checks passed. Only the fixed Linux test runner received source
updates; no image rebuild or business runtime synchronization occurred.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts src/__tests__/models/copilot-document-operation.spec.ts src/__tests__/workspace/blobs.e2e.ts
```

### Directory policy administration and realtime invalidation

`workspaceDirectoryAdministration` is the human owner/admin read model for the
root and active folder tree, active member principals, explicit overrides,
administration revision and immutable audit history. The matching
`changeWorkspaceDirectoryPolicy` mutation requires that exact revision. It
holds both the Workspace permission lock and directory authorization lock,
rechecks active administrator membership, rejects a removed folder when setting
an override, and conditionally writes the override and audit event in one
transaction. Clearing a stale departed-member or deleted-folder override remains
possible; clearing a nonexistent override is a no-op and produces no false
audit. Two administrators using the same revision cannot both commit.

Migration `20260905070000_directory_policy_audit` adds the bounded policy-event
table and a database trigger that rejects updates and deletes. Actor and
Workspace identifiers are deliberately evidence fields rather than cascading
relations, so later live-record deletion does not erase the audit trail. The
revision hashes the current directory revision and normalized policy semantics;
display-only timestamps do not create conflicts.

The Workspace Settings **Directory permissions** page is available only for
synced Workspaces to active owners/admins. It selects root/folder and all-members
or one active member, edits the four explicit rights, clears an override, blocks
duplicate submission, reloads on stale/denied writes, lists current overrides,
and pages immutable audit events. It covers loading, empty, error, success and
disabled states. This is an ordinary human product surface; no AI tool exposes
policy administration.

Successful mutation publishes `workspace.directory-policy.changed` to a
Workspace-scoped room. Both the policy page and `DirectoryAccessStore` subscribe.
The navigation store clears old rows before revalidation and retains its
15-second fail-closed fallback; membership/access changes continue through the
separate `workspace.access.changed` topic. GraphQL schema/client and i18n files
come from the repository generators.

The fixed Linux test runner passed 5 directory-policy model tests, 21 realtime
registry tests, 28 document-operation/directory tests and 36 frontend setting/
store tests. These cover non-admin denial, active-member validation, stale and
concurrent revisions, idempotent set/clear, departed-member cleanup, immutable
audit, realtime registration, transaction lock ordering and UI refresh. Backend
and frontend package TypeScript checks passed. No image was rebuilt. The later
stage acceptance records backend runtime synchronization and browser results;
directory enumeration still recomputes a bounded 10,000-row snapshot and needs
performance measurement on large Workspaces.

```sh
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/models/workspace-directory-grant.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/core/realtime/__tests__/registry.spec.ts
docker exec -w /workspace localmind_project_ai_runner yarn workspace @affine/server test src/__tests__/copilot/document-operation.e2e.ts
docker exec -w /workspace localmind_project_ai_runner yarn vitest run packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/directory-permissions/index.spec.tsx packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/index.spec.tsx packages/frontend/core/src/modules/organize/stores/directory-access.spec.ts packages/frontend/core/src/modules/organize/stores/folder.spec.ts
```
