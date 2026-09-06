# Track: Intelligence Workbench

## Project AI Stage Two

The stage-two acceptance record is in
[Project AI Boundaries](project-ai-boundaries.md#stage-two-progress-on-2026-09-06).
Shared Project writes now retain original source grants and immutable source
check audits. A conversation that consumed a private or revoked source cannot
resume shared writes after regrant; a newly authorized source requires a fresh
conversation. Directory enumeration and destination selection use a bounded
storage-validated parse cache with fresh per-request permissions, measured with
10,000 rows and 64-level ancestry. External waiting tasks now appear in the
action list and reuse the explicit Workspace/root/folder confirmation panel,
with expiry, withdrawal and revision-change handling. Server checks persist
the actor and target authority and reject MCP attempts to impersonate that
confirmation. Destination audience evidence also prevents Project content from
spreading to additional Workspace or other-Project readers. Delegated task
results expose bounded document artifacts with actual storage Workspaces and
live read checks. Notification snapshots start from authentication state and
reconcile every 15 seconds and on
focus/reconnection, including unchanged counts, so a missed push cannot leave
the applicant/reviewer list stale indefinitely. Persistent recipient
reconciliation covers changed source owners/admins. These changes have reached
the backed-up 335-migration business runtime. Real Chrome passed second
confirmation, rejection reasons, duplicates, withdrawal, expiry, reviewer/admin
changes, revocation and applicant refresh. With realtime blocked, HTTP delivered
the persistent result within 9,193 ms; reconnect retained it. Encrypted-BYOK
location confirmation and worker recovery completed over a backend restart.
Task details passed 1600x1000 and 390x844 light/dark visual checks. Exact fixture
IDs, commands and remaining production-soak limits are in the authority record.

## Intent

Turn the existing workspace-level Intelligence chat page into a global,
Codex-style AI workbench: a project tree on the left, a task/status panel on
top, and the existing conversation surface below.

The target is not another chat skin. The target is a durable collaboration
surface where a user sees, per project, what the AI is doing, what needs their
decision, and what the project is waiting on from other people, with every
panel item backed by persisted server state.

This track was designed in an interactive alignment session; the decisions
below are settled product decisions, not open suggestions. An executing agent
must not silently re-litigate them.

## Concept Model

These definitions are binding for the whole track:

- **Workspace** stays the organizational boundary (for example one department
  per workspace). Workspace ACL semantics are unchanged.
- **Project** is a global entity that belongs to one or more users, not to any
  workspace. A project aggregates documents from multiple workspaces by
  reference and acts as a **permission principal** (shared-drive semantics):
  documents are granted to the project itself, and members access those
  documents through project membership. Grants survive individual members
  leaving the project.
- **Intelligence workbench** is the global page where projects, tasks, and AI
  conversation meet. It is not scoped to the currently open workspace.
- The document-attached AI chat panel and the standalone Tasks page both
  remain. They share data with the workbench and must never fork into a second
  source of truth.

A project never widens anyone's workspace ACL by itself. All effective access
flows either from the member's own ACL or from an explicit, audited,
revocable project grant approved on the source side.

## Current Problem

Today the pieces exist but do not compose into a workbench:

- the sidebar `Intelligence` entry (`/chat`,
  `packages/frontend/core/src/desktop/pages/workspace/chat/index.tsx`) is a
  workspace-scoped chat page with session tabs; it has no project navigation
  and no task visibility;
- the sidebar `Tasks` entry (`/tasks`,
  `packages/frontend/core/src/desktop/pages/workspace/tasks/index.tsx`)
  lists copilot tasks with active/approval/completed filters, but it is a
  separate page and is queried per workspace
  (`copilotTasksGet` under `currentUser.copilot(workspaceId)`);
- `AiContextProject` (`packages/backend/server/schema.prisma`) already exists
  with name/description/status, a flat `AiContextProjectDoc` membership table,
  project-scoped memories and rules, and session project selection
  (`selectedContextProjectId` on `AiSession`), but it is workspace-scoped, has
  no member model, no sharing, no cross-workspace references, and no
  project-level AI policy;
- document-level user roles exist (grant/update doc user role mutations), but
  there is **no** access-request flow: an unauthorized user cannot ask a doc
  owner for access, neither personally nor on behalf of a project;
- there is no durable representation of "waiting on a person outside the
  system" (for example waiting for an email reply), so such state lives only
  in people's heads or chat transcripts.

## Settled Design Decisions

The [2026-09-05 Project AI boundary contract](./project-ai-boundaries.md)
supersedes conflicting older rules below, including AI management prohibitions,
explicit conversation binding, personal/current-project read scope, destination
confirmation, independent copies, and notification decisions.

### D1. Entry and layout

1. The Intelligence page becomes the workbench, mounted on a **true top-level
   global route** that is not nested under a workspace path. It is not a
   workspace sub-page: the project tree lists the current user's projects
   regardless of which workspace is open, and the page is reachable without
   any workspace being active. The existing workspace-scoped `/chat` route
   is replaced by this route (redirect legacy links; do not keep two
   workbench entrypoints).
2. Because the workbench leaves the workspace shell, it must supply the shell
   affordances it still needs, in its own left-rail header: account/profile
   entry, settings entry, server/sync status, notification entry, global
   search, and a return-to-workspace affordance that goes back to the last
   active workspace. Reuse the existing components behind these entries; do
   not fork a second implementation of any of them.
3. Immersive mode: the global app sidebar is not rendered on this route; the
   project tree is the only left rail. Leaving the route restores the normal
   workspace shell and its sidebar state.
4. Document opening from the tree must not require leaving the conversation.
   The workbench hosts its own in-page document surface (peek/preview) for
   reading and light interaction, so clicking a tree item opens the document
   beside the conversation. A separate explicit "open in workspace" action
   navigates into that document's workspace route for full editing. Both
   paths must respect the reader's effective permission on that document.
5. Layout: project tree left; task panel above the conversation; conversation
   and composer below. The task panel has a collapsed summary state (one line
   with counts) and an expanded board state.
6. The document-attached chat panel is unchanged. The standalone Tasks page is
   retained as the full list/history view; the workbench panel is the
   attention view.
7. A workbench conversation keeps `AiSession.workspaceId` as its explicit
   execution and billing host. The workbench selects an accessible host from
   the user's last active workspace, displays it, and lets the user switch it;
   this does not bind the selected Project to that workspace. Project context
   continues to resolve each `(workspaceId, docId)` reference against its own
   source workspace and current permission. The global route therefore works
   without a workspace route being active while preserving the existing
   provider, quota, and session contracts.

### D2. Task panel

1. Segments with count badges: **To do**, **In progress**, **Done**.
   - **To do** contains two ordered groups: _needs my action_ (AI write
     approvals from run approval steps; access requests awaiting my decision
     as doc owner/workspace admin; project invites awaiting my acceptance)
     above _waiting on others_ (project access requests pending on the other
     side; outgoing invites pending acceptance; Blockers). The badge counts
     only _needs my action_.
   - **In progress**: running/queued AI runs, projected from existing
     run/step/timeline state, with cancel.
   - **Done**: recently completed runs, approved grants, joined members,
     resolved Blockers; bounded (recent window / capped count) with a
     "view all" link to the Tasks page. Items do not silently vanish on
     completion; they move to Done.
   - **Failed runs go to To do**, not Done, until the user retries or
     abandons them; abandoning moves them to Done marked as abandoned.
2. Every card links to its operable detail (approval detail, request detail,
   run timeline). The panel is a pure projection of DB state and produces no
   state of its own.
3. Scope follows the tree: no project selected shows the user's aggregate;
   selecting a project filters to it. Run-to-project association reuses the
   session `selectedContextProjectId` chain; the projection query must expose
   it for filtering.
4. Backend: add a user-level cross-workspace aggregation query for panel
   items, permission-filtered server-side. The frontend must not loop over
   workspaces and stitch results.
5. Data freshness: reuse the existing polling approach first. Realtime push is
   a non-goal for this track.
6. Bounds (server-enforced defaults, tunable but never unbounded): To do and
   In progress return at most 50 items per segment; Done defaults to a 7-day
   window capped at 20 items. Any segment hitting its cap renders a
   "view all in Tasks" affordance instead of growing. The aggregation query
   must be backed by indexes on the user/status access path; full scans over
   all workspaces are not acceptable.

### D3. Project entity (evolve `AiContextProject`)

1. Evolve `AiContextProject` into the global product Project via migration; do
   not create a parallel project entity. Existing rows whose creator still
   exists: the creator becomes the sole owner. A legacy row whose creator was
   deleted and whose `createdByUserId` is therefore null is assigned to every
   active Owner of its source workspace; the migration fails closed if that
   workspace has no active Owner. Existing doc references gain their source
   workspace id.
2. Membership: an explicit member table with exactly two roles in this track.
   - **Owner** (one or more): invite/remove members, add/remove documents,
     set project AI policy, archive, transfer ownership.
   - **Member**: view the project, chat, use AI within project grant levels,
     create Blockers, initiate project access requests.
     The role column must be extensible, but no finer roles are added now.
3. Document references become `(workspaceId, docId)` pairs plus tree
   ordering/grouping fields. Office artifacts in projects are a non-goal for
   this track; keep the reference shape extensible.
4. Project memory, rules, and session project selection stay attached to this
   entity. Context Memory scope logic that assumes "project inside one
   workspace" must be reworked as part of this track, not bypassed.

### D4. Project grants and access requests

1. **Project grant**: a document is granted to a project with a level
   (read/write), provenance (grantor, time, approving side), and revocability.
   Grants belong to the project: a member leaving, or the original adder
   losing their own access later, does not remove the grant.
2. **Add-document two-branch rule** (security-critical):
   - if the adder holds sharing rights on the document (doc owner/manager
     semantics), adding it creates the project grant directly; the grant
     level is `min(adder's own level, requested level)`, audited;
   - otherwise the add becomes a **project access request** to the doc owner;
     until approved the document appears in the tree as a pending placeholder
     and as a _waiting on others_ card. Mere read access is NOT sharing
     authority; this branch closes the re-share escalation hole where any
     reader could leak documents through a project.
3. **Pending placeholders are redacted per viewer** (security-critical). Until
   the source side approves, the document's metadata must not be broadcast to
   the project:
   - the request initiator sees the identifying information they themselves
     supplied (they already know the document);
   - every other project member sees a redacted placeholder only — request
     state, source workspace, requested level, and timing, with no document
     title, no document id, and no content preview;
   - approval flips the placeholder to the real reference for all members.
     Revocation reverts it to the redacted form.
     Redaction is enforced server-side in the resolver/projection layer, not by
     hiding fields in the client.
4. **AccessRequest** is one generic state machine
   (request/approve/reject/expire/withdraw, fully audited) with two
   beneficiary kinds: **user** (the new standalone personal doc access
   request, independent of projects) and **project**. Any project member may
   initiate a project request; the initiator is recorded; withdraw is allowed
   to the initiator and project owners; decisions belong to the doc owner or
   workspace admin on the source side.
5. **Source-side visibility and revocation**: doc owners and workspace admins
   can list which projects hold grants on their documents and revoke at any
   time. On revoke: the document reverts to a placeholder, a
   "authorization lost, re-request" card is created, and project memories
   derived from that document are immediately quarantined/invalidated so the
   AI cannot keep answering from residue.
6. Memory trust boundary: project memory may only derive from
   project-granted documents. Because every project document carries a
   project grant, all members see the same project and the same project
   memory; no per-member memory partitioning is needed inside a project.
   Memory rows keep source provenance to make revocation-invalidation
   possible.

### D5. AI operation permissions and ordering

1. Every AI operation in a project executes as the delegated requesting user
   and passes a three-layer intersection at execution time:
   `project grant level on the target doc` ∩ `project AI policy` ∩
   `tool approval requirements`. Any layer denying denies. Real-time recheck
   at execution; never a creation-time snapshot.
2. Project AI policy is set by owners; the minimum viable policy is
   read-only vs read-write for AI operations in the project.
3. Reads are concurrent and unordered, subject only to permission filtering.
4. Writes are serialized per document through the approval queue. Office
   artifacts already provide monotonic revisions with stale-parent rejection;
   ordinary docs use existing lease semantics. Approval order is queue order.
   If the document changed while queued so that the approved preview no
   longer matches execution-time state, the task returns to a
   "needs re-confirmation" state instead of executing (conditional terminal
   writes, no drift-blind execution).

### D6. Blocker

1. Blocker is a reminder-only entity for human-world waits ("waiting for
   Wang's email reply"). Fields: project, creator, title, type (wait-reply /
   wait-file / wait-decision / custom), who it waits on (free text/contact),
   due date, status (waiting / resolved / abandoned), origin (user-created or
   AI-suggested), resolution actor and time.
2. Creation: manual from the panel, or AI-suggested from conversation — an AI
   suggestion is only persisted after explicit user confirmation. The AI must
   never create Blockers silently.
3. Resolution in this track is manual only (resolve / abandon). Overdue
   Blockers are highlighted in To do. External-signal auto-resolution (email
   integration, webhooks) is a non-goal here.
4. Blockers carry no permission or execution effects. Waits that have a real
   state machine (access requests, invites, approvals) must use their own
   entities, never a Blocker.

## Phases

Each phase must prove behavior, not just land code. Follow
`docs/ai-modernization/validation.md` and
`docs/localmind-docker-development-constraints.md` for how to run validation.
GraphQL changes follow the repo generation flow (server schema, shared `.gql`
operations, generated types, consumers in sync). Schema changes require Prisma
migrations validated from the prior state.

### Phase 1: Workbench skeleton and global Project

Scope:

- migrate `AiContextProject` to the global model: ownership/member table
  (owner/member), `(workspaceId, docId)` references, tree ordering, creator
  backfilled as owner;
- rework Context Memory scope resolution that assumed workspace-scoped
  projects, with focused tests proving no cross-boundary widening;
- move the workbench to a true top-level global route: new route outside the
  workspace path, legacy `/chat` redirected, left-rail header re-hosting the
  account/settings/status/notification/search/return affordances by reusing
  existing components, in-page document peek plus an explicit
  "open in workspace" action;
- Intelligence page becomes the global workbench: immersive mode, project
  tree (create/rename/archive project, add own-shareable docs only in this
  phase), task panel segments with server-enforced bounds, conversation
  reuse;
- user-level aggregation query for panel items projecting existing copilot
  tasks/approvals across workspaces, polling, project filtering via the
  session chain.

Acceptance (prove at least):

- migration applies onto a database with existing workspace-scoped projects,
  including a project whose creator was deleted; prior projects keep their
  memories/rules, projects with a creator gain that creator as sole owner, and
  orphaned projects gain the active Owner(s) of their source workspace;
- the panel shows a run created in workspace X and an approval in workspace Y
  for the same user in one aggregate, and a user without access to a run's
  workspace never sees its card (authorization denial test);
- failed run appears in To do; completing a run moves it to Done rather than
  disappearing;
- project tree filtered per member; a non-member cannot query the project;
- the workbench route loads with no active workspace and after a cold deep
  link, in both the web and Electron shells, and the legacy `/chat` link
  redirects to it;
- clicking a tree document opens it in-page without ending the conversation,
  and a document the viewer cannot read is not openable from the tree.

### Phase 2: Collaboration and authorization

Scope:

- project grant entity with level/provenance/revocation;
- add-document two-branch rule;
- generic AccessRequest state machine with user and project beneficiaries,
  including the standalone personal doc access request;
- project invites (send/accept/decline/withdraw);
- source-side grant listing and revocation, memory
  quarantine/invalidation on revoke;
- panel cards for all of the above in both directions.

Acceptance (prove at least):

- a member with read-only access adding a doc produces a pending request and
  placeholder, never a direct grant (denial test);
- a non-initiator member querying a pending placeholder receives no document
  title or id from the server, and receives them after approval (redaction
  asserted against the resolver response, not the rendered UI);
- a grant created by a sharer records grantor/level and is capped at the
  adder's own level;
- after the grantor leaves the project, other members still access the doc;
- after source-side revocation, member access fails closed, the re-request
  card exists, and project-memory retrieval no longer surfaces content
  derived from the revoked doc;
- duplicate/expired/withdrawn requests behave idempotently.

### Phase 3: Blocker

Scope: Blocker entity, manual create/resolve/abandon, overdue highlighting,
AI-suggested-with-confirmation creation, panel and Done integration.

Acceptance (prove at least):

- an AI suggestion without user confirmation persists nothing;
- resolve/abandon transitions are the only exits from waiting; resolved items
  appear in Done;
- Blockers are visible only to project members.

## Non-Goals

Explicitly out of scope for this track (do not implement opportunistically):

- realtime push replacing panel polling;
- email or other external-signal automatic Blocker resolution;
- project roles beyond owner/member;
- Office artifacts as project members;
- deprecating or reworking the document-attached chat panel;
- marketing-style redesign of the Tasks page (it remains the full list view).

## Risks

There are no open product questions in this track; the decisions above are
settled. These are execution risks to manage, not choices to reopen.

- **Planner v6 scope rework** is the highest-risk part of Phase 1. Global
  projects invalidate the assumption that a project lives inside one
  workspace. The rework is only complete when the existing v6
  scope-leakage and fail-closed smoke still passes; a regression there blocks
  the phase regardless of feature completeness.
- **Leaving the workspace shell** (top-level route) means the workbench no
  longer inherits shell services. The risk is silently forking duplicates of
  account, settings, sync status, notification, or search surfaces, or
  breaking deep links and Electron navigation. Re-host existing components
  and verify cold deep links in both the web and Electron shells.
- **In-page document opening** across workspaces is the subtlest permission
  surface in Phase 1: the peek surface must resolve permission against the
  document's own workspace, not the viewer's last active workspace.
- **Cross-workspace aggregation cost** grows with a user's workspace and
  project count. The bounds in D2.6 are mandatory, and the access path must
  be indexed before this ships to users with many workspaces.
- **Revocation completeness**: a revoked grant must invalidate derived
  project memory and re-redact placeholders in the same transaction boundary
  as the grant change. Partial revocation that leaves memory residue is a
  trust-boundary failure, not a cosmetic bug.

## Repair Verification (2026-09-04)

A completion audit found that the running development container had only the
Phase 1 migration and an older native addon. It also found a truncated Tasks
history, unstable old-task deep links, document result links using the execution
host instead of the source workspace, and incomplete approval details. These
were implementation gaps, not changes to D1-D6.

The repair adds:

- server-filtered, bounded seek pagination across all five task kinds and an
  independently permission-checked `workbenchTask` detail query; pagination
  cursors are bound to the viewer, project and filter, and exact details use
  entity/workspace predicates instead of scanning a concatenated display id;
- source `workspaceId` on task artifacts, with document-scope navigation
  through the existing source-workspace permission gate;
- approval reasons, Office operation/impact metadata and document update
  content/version previews in Tasks; Workbench run approvals first open this
  detail, and a drift-invalidated preview requires the current approval
  fingerprint before it can be confirmed again;
- explicit repository `#import` declarations for all eight Workbench/Blocker
  operations that use shared fragments. Previously the type generator could
  succeed while exported runtime query strings omitted their fragments;
- runtime-provenance checks in `tools/localmind-dev-sync.mjs`, with a deliberate
  database-backup and validated-Linux-container path for synchronizing
  migrations, Prisma Client and native addons together. Ordinary JavaScript
  sync fails before copying if schema/native provenance is missing or changed.

### Verification Evidence

The fixed `localmind-affine:test` image was reused in the disposable
`localmind_iw_fix_runner`. Current source was copied into `/workspace`; native
code was compiled with `yarn workspace @affine/server-native build`,
`CARGO_BUILD_JOBS=2`, `CARGO_PROFILE_RELEASE_LTO=false` and
`CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16`. No image was rebuilt.

Validation used the separate `localmind_iw_fix_validation` database on
`localmind_affine_test_postgres`, never the runtime database for AVA reset
helpers. Direct AVA commands loaded
`NODE_OPTIONS=--import=/workspace/tools/cli/register.js`; Redis used the
test-only service `localmind_phase2_auth_redis`, database 9.

- Phase 1: `yarn r scripts/intelligence-workbench-phase1-migration.smoke.ts`
  passed the populated 317-migration upgrade, retained project evidence,
  creator/fallback ownership, and fail-closed orphan checks.
- Phase 2: `yarn r scripts/intelligence-workbench-phase2-migration.smoke.ts`
  passed Phase 1 upgrade/fresh install, least-privilege grant backfill, memory
  quarantine, indexed projections, uniqueness and transactional guards.
- Phase 3: `yarn r scripts/intelligence-workbench-phase3-migration.smoke.ts`
  passed 319-to-320 upgrade/fresh install, lifecycle/origin constraints and
  confirmation uniqueness. All migration smokes used `NODE_ENV=test`.
- `yarn r scripts/context-memory-v6.smoke.ts` passed: scope leakage 0,
  sensitive-write rate 0, extraction F1/Recall@5/MRR/nDCG@5 all 1.
- `yarn ava --serial` over `intelligence-workbench.e2e.ts`,
  `intelligence-workbench-authorization.spec.ts`,
  `intelligence-workbench-blocker.spec.ts`,
  `intelligence-workbench-permission.spec.ts`, and core permission
  `docs.spec.ts` passed 52 tests. Coverage includes history beyond 100 rows,
  equal-time pagination, old detail links, live ACL denial, source artifact
  identity, stale/missing approval fingerprints, revocation, write ordering,
  authorization redaction and zero-write Blocker suggestions.
- The focused `prompt-service.spec.ts --match='*Blocker*'` test passed against
  the newly compiled native addon.
- Host and Linux Vitest passed 36 Tasks/Workbench UI tests plus eight checks
  validating the actual generated operation strings against the server schema.
  The latter reproduced eight unknown-fragment failures before the repair.
- Electron deep-link/navigation and document-scope route regression tests
  passed another 21 tests; this is unit coverage, not a packaged Electron
  launch check.
- Nest generated `src/schema.gql` during container integration tests;
  `yarn workspace @affine/graphql build` and
  `yarn workspace @affine/i18n build` regenerated clients and translations.
  `yarn typecheck` passed, including the isolated 42-file Copilot test check.
- The running `localmind_affine_server` was updated with
  `LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_iw_fix_runner`
  `LOCALMIND_DATABASE_BACKUP=/private/tmp/localmind-iw-recovery.hxzQHH/affine-before-runtime-fix.dump`
  `yarn localmind:sync:all`, followed by a normal `yarn localmind:sync:all`
  after the final generated-query repair. The database now has 320 applied
  migrations and all three authorization/Blocker tables. The runtime addon
  exposes the Blocker tool and passes the sharing-disabled personal/project
  union check without granting document management.
- The authenticated browser at `http://localhost:3011/tasks?filter=all`
  displayed real history, Office approval details and an unchanged inaccessible
  task deep link. Tasks was inspected at 1366x900 and 390x844 without horizontal
  overflow; the Intelligence route and panel use the repaired operations.
- Final `yarn typecheck`, scoped oxlint/Prettier and `git diff --check` passed.
  A final runtime check confirmed 320 applied migrations and the mapped tables
  `access_requests`, `ai_context_project_grants` and
  `ai_context_project_blockers`; `/intelligence` returned HTTP 200.

After validation, `docker stop localmind_iw_fix_runner` and
`docker rm localmind_iw_fix_runner` removed only the disposable runner.
`docker exec localmind_affine_test_postgres dropdb -U affine --if-exists localmind_iw_fix_validation`
removed the 25 MB disposable test database; its fixtures can be recreated by
the tests. No business database, shared Redis service, image or volume was
removed. The retained pre-upgrade backup is nonempty, readable by `pg_restore`
and restricted to its owner (directory mode 700, file mode 600).

Final `docker system df`: images 45.34 GB, containers 689.8 MB, local volumes
1.15 GB, build cache 2.913 GB (0 B reclaimable). No image rebuild or cache prune
was performed in this repair.

### Remaining Validation Limits

The full existing PromptService suite still has five unrelated expectation
failures: legacy hard-coded model/default-policy values and registry source-chain
metadata no longer match the current built-in catalog. This repair does not
change those product defaults to make old assertions pass. The targeted Blocker
test and all 52 Workbench/authorization tests pass independently.

Runtime synchronization updates the current development container, not the
`localmind-affine:local` image. Recreating that container requires the normal
fixed-tag image build or repeating the explicit validated runtime-sync process.
The pre-upgrade database backup is retained at the path above. Browser checks
in this repair covered the light theme; no new Electron package was built.
