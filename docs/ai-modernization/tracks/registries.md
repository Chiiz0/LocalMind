# Track: DB-backed Registries

## Intent

Move selected config-only AI registry concepts into DB-backed records with
revision, scope, actor, and audit metadata.

## Global Project BYOK

All Project conversations use the singleton `ai_project_byok_config`, managed
by instance administrators through `/admin/ai/config`. This configuration is
independent of Workspace credentials, defaults and user Profile assignments.
The server probes before saving, encrypts the API key, serializes revision
updates and appends immutable `ai_project_byok_audit_events` without credentials.
Provider IDs carry the config revision so rotation cannot reuse a previous
provider instance or let a late failure overwrite new configuration evidence.
Runtime routing reads the persisted conversation Project and rechecks active
membership. Missing/disabled configuration cannot fall back to another scope.
Workspace routes remain available to conversations outside Projects; embedding
and reranking retain their existing instance-managed task routes.

## Current Problem

Many registry-like concepts are still primarily config-driven:

- Prompt Registry compatibility records;
- Provider profile definitions;
- Model definitions and aliases;
- Task model route policy.

Diagnostics can explain the current source, but durable product behavior needs
DB-backed records and revisions.

## Implemented First Vertical Slice

Prompt Registry revision records now provide the first DB-backed registry read
path with compatibility fallback to the existing registry/config sources.

Implemented behavior:

1. `ai_prompt_registry_revisions` stores prompt name, scope, workspace, actor,
   revision, status, fingerprint, fallback source chain, and timestamps.
2. Prompt catalog reads the latest active revision by prompt name, preferring
   workspace scope before global scope.
3. Existing legacy registry and config defaults remain the fallback path.
4. GraphQL exposes registry source chain metadata for DB, legacy registry, and
   config fallback sources.
5. Admin shows read-only registry source, revision, status, and source-chain
   evidence.

## Implemented Repair-driven Write Slice

Approved prompt registry repair execution can now publish a workspace-scoped
Prompt Registry revision.

Implemented behavior:

1. Repair execution approval consumes a persisted executor payload instead of
   recomputing mutable intent.
2. A workspace-scoped `ai_prompt_registry_revisions` row is created with actor,
   revision, status, fingerprint, source-chain evidence, and repair execution
   metadata.
3. The existing catalog read path can resolve the new workspace revision before
   global DB revisions, legacy registry rows, and config fallback.
4. Repair execution audit/runtime/Admin output links to the published revision
   by side-effect kind, record id, and fingerprint.

Repair-driven registry writes now use the revision fingerprint as the durable
idempotency contract. Matching existing same-scope repair revisions are reused
when a worker retry observes a side effect written by an earlier attempt, while
same-scope revisions with a different fingerprint are rejected and leave the
repair execution in failure state.

## Implemented Constrained Prompt Registry Publish API Slice

Prompt Registry now has a direct, permission-checked write path for
workspace-scoped DB revisions.

Implemented behavior:

1. GraphQL publishes a workspace-scoped `ai_prompt_registry_revisions` row only
   after `Workspace.Copilot` permission checks.
2. The mutation requires the existing legacy registry publish gate to pass,
   including stale-version rejection and route-readiness review.
3. The write path records registry/version evidence, validation status,
   route-review fingerprints, fallback source-chain evidence, revision, status,
   fingerprint, and direct-publish review metadata.
4. Repeated publishes for the same workspace/prompt/revision return the
   existing row only when the persisted review fingerprint matches.
5. The direct publish path intentionally does not copy prompt body content or
   bypass the legacy prompt registry tables; the existing catalog read path can
   resolve the published workspace revision before legacy/config fallback.

## Implemented Task Route Policy Slice

Task Route Policy model selection now has a DB-backed revision read path for
embedding, workspace indexing, and rerank routes.

Implemented behavior:

1. `ai_task_route_policy_revisions` stores feature kind, scope, workspace,
   actor, revision, status, model id, config key/path, fingerprint,
   fallback source chain, metadata, and timestamps.
2. Task route model resolution prefers the latest active workspace revision,
   then global revision, then the existing config/provider-default fallback.
3. Workspace embedding/rerank execution paths call the DB-aware task policy
   resolver with workspace scope, so persisted route policy records affect
   runtime model selection rather than only diagnostics.
4. GraphQL and generated common operations expose Task Route Policy revision
   metadata and DB/config fallback source-chain evidence.
5. Admin shows DB-backed Task Route Policy source, revision, source-chain
   fingerprint, and source-chain entries alongside route diagnostics.

## Implemented Task Route Policy Repair-driven Write Slice

Approved `repair_task_model_route` repair execution can now publish a
workspace-scoped Task Route Policy revision.

Implemented behavior:

1. Repair execution approval queues a worker job with a persisted
   `task_route_policy_revision_publish` executor payload.
2. The worker validates the payload and creates an active
   `ai_task_route_policy_revisions` record with actor, revision, status,
   fingerprint, fallback source-chain evidence, and repair execution metadata.
3. Runtime result and audit output link to the published route policy revision
   by side-effect kind, record id, fingerprint, and summary.
4. The existing TaskPolicy read/runtime path can resolve the new workspace
   revision before config fallback.

## Implemented Constrained Task Route Policy Publish API Slice

Task Route Policy now has a direct, permission-checked write path for
workspace-scoped DB revisions.

Implemented behavior:

1. GraphQL publishes a workspace-scoped `ai_task_route_policy_revisions` row
   only after `Workspace.Copilot` permission checks.
2. The mutation only accepts supported task route feature kinds: `embedding`,
   `workspace_indexing`, and `rerank`.
3. The write path records model id, config key/path, fallback source-chain
   evidence, revision, status, fingerprint, and direct-publish metadata without
   changing provider runtimes.
4. Repeated publishes for the same workspace/feature/revision return the
   existing row only when the sanitized fingerprint matches.
5. The existing TaskPolicy read/runtime path can resolve the published
   workspace revision before config/provider-default fallback.

## Implemented Model Registry Slice

Model definitions and aliases now have a DB-backed revision read path with
compatibility fallback to configured provider profiles and the native registry.

Implemented behavior:

1. `ai_model_registry_revisions` stores provider id, model id, scope,
   workspace, actor, revision, status, fingerprint, model definition,
   fallback source chain, metadata, and timestamps.
2. Provider registry construction overlays active DB model definitions onto
   configured provider profiles, preferring workspace-scoped revisions before
   global revisions.
3. GraphQL/common/Admin model diagnostics expose model-definition source,
   DB revision metadata, source-chain fingerprint, and source-chain entries.
4. Existing provider profile and native registry fallback behavior remains
   unchanged when no active DB revision exists.

## Implemented Model Registry Repair-driven Write Slice

Approved `repair_default_model_route` repair execution can now publish a
workspace-scoped Model Registry revision.

Implemented behavior:

1. Repair execution approval queues a worker job with a persisted
   `model_registry_revision_publish` executor payload.
2. The worker validates the payload and creates an active
   `ai_model_registry_revisions` record with actor, provider id, model id,
   model definition alias, revision, status, fingerprint, fallback
   source-chain evidence, and repair execution metadata.
3. Runtime result and audit output link to the published model registry
   revision by side-effect kind, record id, fingerprint, and summary.
4. The existing provider registry overlay can resolve the new workspace
   revision before provider-profile/native fallback, allowing the publish gate
   to re-check the repaired default model route through the DB-backed registry
   path.

## Implemented Constrained Model Registry Publish API Slice

Model definitions now have a direct, permission-checked write path for
workspace-scoped DB revisions.

Implemented behavior:

1. GraphQL publishes a workspace-scoped `ai_model_registry_revisions` row only
   after `Workspace.Copilot` permission checks.
2. The mutation only targets provider ids that already exist in the configured
   provider registry, and the persisted revision reuses that provider runtime
   instead of creating arbitrary provider runtimes or credentials.
3. The model method sanitizes the persisted model definition to routeable model
   metadata and capabilities, forces the stored definition id to the requested
   model id, and drops arbitrary config fields.
4. Repeated publishes for the same workspace/provider/model/revision return
   the existing row only when the sanitized fingerprint matches.
5. The existing overlay path immediately resolves the published workspace model
   definition before provider-profile/native fallback.

## Implemented Provider Registry Read Overlay Slice

Provider profile metadata now has a DB-backed revision read path with
compatibility fallback to configured provider runtimes and credentials.

Implemented behavior:

1. `ai_provider_registry_revisions` stores provider id/type, scope, workspace,
   actor, revision, status, fingerprint, provider profile metadata, fallback
   source chain, metadata, and timestamps.
2. Provider registry construction overlays active DB provider profile metadata
   onto existing configured provider profiles, preferring workspace-scoped
   revisions before global revisions.
3. The overlay intentionally reuses the existing configured provider runtime
   and config credentials; it does not create arbitrary new provider runtimes
   or manage provider secrets.
4. Existing model and route diagnostics surface `db_revision` as the provider
   profile source and point the config path at `ai_provider_registry_revisions`.
5. DB-backed model definition revisions are applied after provider profile
   revisions, so both provider metadata and model aliases can compose in one
   workspace-scoped registry build.

## Implemented Constrained Provider Registry Publish API Slice

Provider profile metadata now has a direct, permission-checked write path for
workspace-scoped DB revisions.

Implemented behavior:

1. GraphQL publishes a workspace-scoped `ai_provider_registry_revisions` row
   only after `Workspace.Copilot` permission checks.
2. The mutation only targets provider ids that already exist in the configured
   provider registry, and the persisted provider type is taken from that
   configured profile.
3. The model method sanitizes the persisted provider profile to metadata,
   model ids, and model definitions; it stores `config: {}` and never treats
   mutation input as provider credentials.
4. Repeated publishes for the same workspace/provider/revision return the
   existing row only when the sanitized fingerprint matches.
5. The existing overlay path immediately resolves the published workspace
   provider metadata before global/config fallback.

## Implemented Provider Registry Repair-driven Write Slice

Approved provider registry repair execution can now publish a workspace-scoped
Provider Registry profile metadata revision.

Implemented behavior:

1. Repair execution approval queues a worker job with a persisted
   `provider_registry_revision_publish` executor payload.
2. The worker validates the payload and creates an active
   `ai_provider_registry_revisions` record with actor, provider id/type,
   revision, status, fingerprint, sanitized provider profile metadata,
   fallback source-chain evidence, and repair execution metadata.
3. Persisted provider profile metadata stores `config: {}` and reuses the
   existing configured provider runtime/credentials; the executor does not
   create arbitrary provider runtimes or write provider secrets.
4. Runtime result and audit output link to the published provider registry
   revision by side-effect kind, record id, fingerprint, and summary.
5. The existing provider registry overlay can resolve the new workspace
   provider metadata before global/config fallback.

## Implemented Workspace BYOK Exact-model Binding Slice

Workspace BYOK keys now declare the model they can actually serve instead of
acting as unrestricted provider-level credentials during route selection.

Implemented behavior:

1. `ai_workspace_byok_configs.model_id` persists one optional normalized model
   id per server-stored key; Electron-local key storage and short-lived local
   leases carry the same field without persisting local secrets on the server.
2. Server and local BYOK profiles expose `models=[modelId]` plus a generated
   model definition with the provider's runtime backend kind and bounded
   capabilities.
3. The effective provider split is authority-specific at runtime. Text,
   object, structured, and image generation resolve only to Workspace BYOK
   profiles, while embedding and rerank resolve only to the administrator's
   global Provider Registry. Global chat profiles remain unavailable for
   generation and Workspace BYOK profiles cannot override infrastructure
   routes.
4. OpenAI-compatible key validation uses a minimal `POST /responses` call with
   the exact model id and safe response handling; model id normalization rejects
   blank or overlong values before persistence or network testing.
5. The Admin AI credential form threads the model id through test/save/edit
   flows, displays it on the key row, and invalidates the previous successful
   test when the model changes.
6. Focused backend route coverage proves that a bound custom model selects the
   BYOK profile and that stale quota-route enablement signals cannot re-enable
   a global provider route.
7. Provider lifecycle startup registers built-in drivers independently from
   static provider profile ids, so a BYOK OpenAI route is executable even when
   the only configured global provider is OpenAI-compatible.
8. Native usage recording seeds model evidence from the prepared request or
   route when a provider response omits it or reports provider selection before
   stream model metadata.
9. Legacy quota-backed prefixed model requests keep an exact matching BYOK
   binding; when the requested model is not bound to BYOK, provider selection
   clears the model constraint and falls back to the workspace's bound BYOK
   model without changing the requested-model audit evidence.
10. User-generation execution requires an eligible BYOK profile for the
    requested workspace and feature. Missing coverage raises
    `COPILOT_BYOK_NOT_CONFIGURED`; platform quota is not checked, the
    compatibility quota API reports unlimited, and replayed turns cannot opt
    back into quota-backed chat routing. Chat and action error states tell
    members to contact the LocalMind instance administrator.
11. Embedding and rerank are instance-managed infrastructure. All workspaces
    share the same administrator-configured models while retaining separate
    documents, vectors, and ACLs. Missing embedding configuration leaves
    indexing unavailable; missing rerank configuration preserves the existing
    vector-distance fallback. Runtime resolution uses only global task-route,
    Provider Registry, Model Registry, health, and route-policy state;
    workspace-scoped revisions remain historical evidence but cannot override
    these routes.

## Workspace AI Credential Governance Migration

LocalMind self-hosted deployments use one instance per company and treat
workspaces as department boundaries. Workspace AI credentials therefore belong
to instance administration rather than to individual workspace members.

The first migration slice keeps `ai_workspace_byok_configs` as the runtime
credential source while changing its control plane:

1. Only instance administrators may list workspace AI credential scopes, read
   credential metadata and usage, test credentials, or create, update, reorder,
   disable, and delete server-stored BYOK entries.
2. The Admin AI configuration surface manages those entries by workspace even
   when the instance administrator is not a member of the target workspace.
3. The main product removes Workspace BYOK navigation and write flows. Missing
   AI coverage tells members to contact an instance administrator instead of
   directing them to a credential form.
4. Electron no longer creates new local BYOK leases. Previously issued leases
   remain bounded by their existing short TTL and expire without migration.
5. Enterprise CLI drivers such as WeCom, Lark, and DingTalk keep a split
   responsibility model: instance administrators own driver availability and
   tool admission, while users own authorization, refresh, and revocation for
   their external account.
6. `/admin/ai` owns all BYOK policy switches, including private-network
   endpoints. The duplicate `/admin/settings` group and unreachable main-product
   BYOK components, tests, and dedicated translations are removed.

The DB-backed AI Profile and assignment slice is now implemented:

1. `ai_workspace_profiles`, `ai_workspace_profile_credentials`, and
   `ai_user_ai_profile_assignments` persist workspace-owned routing profiles,
   their approved BYOK credentials, and one explicit user assignment.
2. Runtime resolution prefers an active member's explicit assignment, then the
   enabled workspace default. Legacy enabled BYOK credentials remain a
   compatibility fallback only while the workspace has no Profile records.
3. Composite foreign keys prevent cross-workspace credential and assignment
   references, and a partial unique index permits only one default Profile per
   workspace.
4. Admin can create, edit, disable, default, and delete Profiles, and can set or
   change the user's default AI Profile during account creation or later edits.
5. Assignments reference credentials and never copy API keys into user records.

Provider Profile secret round-tripping is also removed from the Admin JSON
editor. Admin reads and mutation responses replace `config.apiKey` with a fixed
redaction sentinel. Updates preserve an existing secret only when the same
Profile id returns that sentinel; a new Profile cannot use the sentinel as a
secret.

Enterprise CLI governance now enforces the responsibility split at runtime:

1. Instance configuration owns `enterpriseCli.allowedProviders` and
   `enterpriseCli.allowedToolsByProvider`; the Admin AI page edits both.
2. Creating or reauthorizing a connection checks the current provider policy.
3. Catalog refresh persists only admitted tools, and query/runtime execution
   recheck the live policy so a later restriction takes effect immediately.
4. Tool admission defaults to empty. Exact tool names are accepted, while `*`
   is an explicit administrator decision to allow the full discovered catalog.
5. Users retain personal authorization, refresh, disable, and delete controls,
   but the user-facing tool toggles are removed and the old GraphQL mutation is
   rejected.

## Implemented Provider Health State Persistence Slice

Provider health now has a DB-backed state overlay separate from static provider
profile metadata.

Implemented behavior:

1. `ai_provider_health_states` stores workspace-scoped provider health state
   for existing configured providers with actor, status, checked timestamp,
   last error, source, fingerprint, metadata, and timestamps.
2. GraphQL records health state only after `Workspace.Copilot` permission
   checks and configured-provider validation.
3. Effective provider registry construction overlays DB-backed health state
   after Provider Registry profile revisions and before Model Registry
   definition revisions.
4. Existing route selection treats a DB-backed `down` health state the same as
   config-driven `down`, so persisted health state affects runtime model
   availability rather than only diagnostics.
5. Workspace health writes use an atomic `INSERT ... ON CONFLICT DO UPDATE
RETURNING` path, so a concurrent insert between the old pre-read and write
   is overwritten with the current manual/probe state instead of returning a
   stale health overlay.

## Implemented Provider Health Snapshot Worker Slice

Configured provider profile health now has a scheduled DB persistence path
without introducing credential storage or external network probing.

Implemented behavior:

1. `copilot.providerHealth.persistConfiguredSnapshots` scans configured provider
   profiles that already expose health metadata.
2. The worker writes global `ai_provider_health_states` rows with
   `source=probe_result`, provider id/type, status, checked timestamp, last
   error, fingerprint, and source metadata.
3. Daily Copilot cron enqueues the snapshot persistence job.
4. The existing provider registry overlay can resolve these global DB-backed
   health states for workspace routes unless a workspace health state overrides
   them.
5. Re-running the worker updates the same global provider row instead of
   appending duplicate rows.
6. The worker clears stale global snapshot rows it previously wrote when a
   provider no longer has configured health metadata, replacing the old
   `down`/`degraded` result with `unknown` and cleanup metadata instead of
   letting stale DB state continue to drive routing.
7. Global configured snapshot writes use the same atomic upsert shape as
   workspace health writes, so insert races after a missed pre-read update the
   row to the current snapshot and append matching event history rather than
   preserving stale configured health.

## Implemented Provider Health Snapshot Cleanup Slice

Configured provider health snapshots now have a DB-backed stale-state cleanup
path.

Implemented behavior:

1. `CopilotProviderHealthStateModel` can find global `probe_result` rows whose
   metadata shows they were written by the configured health snapshot worker.
2. The snapshot worker passes the current configured providers that still expose
   health metadata as the active set.
3. Previously written configured snapshot rows outside that active set are
   updated in place to `status=unknown`, `lastError=null`, and a fresh
   fingerprint.
4. Cleanup metadata records the previous status, last error, fingerprint,
   checked timestamp, and cleanup reason
   `configured_provider_health_snapshot_missing`.
5. If the provider later exposes configured health again, the normal upsert
   path reuses the same global row and restores the configured snapshot source.

## Implemented Provider Health Probe Freshness Slice

DB-backed provider health probe overlays now have a freshness boundary so old
automatic probe results cannot keep changing route availability indefinitely.

Implemented behavior:

1. `probe_result` health states older than the configured freshness window are
   excluded when resolving effective provider health overlays.
2. Workspace `manual_override` rows remain durable and are not age-filtered by
   the probe freshness policy.
3. The provider health worker also clears stale automatic probe rows in place
   to `status=unknown`, `lastError=null`, and a fresh fingerprint.
4. Cleanup metadata records the previous status, last error, fingerprint,
   checked timestamp, previous publish source, and cleanup reason
   `provider_health_probe_result_stale`.
5. The cleanup applies to automatic probe-result rows across scopes while
   preserving operator-controlled manual override rows.

## Implemented Provider Health State Event-History Guard Slice

Provider Health state rows remain the current mutable routing overlay, but
direct SQL can no longer rewrite route-affecting health evidence without a
matching durable event row in the same transaction.

Implemented behavior:

1. `ai_provider_health_states` uses a deferred constraint trigger on inserts
   and on provider identity, actor, status, checked timestamp, last-error,
   source, fingerprint, and metadata updates.
2. True no-op state updates remain allowed for harmless maintenance writes.
3. Any inserted state row or real state transition must have a matching
   `ai_provider_health_events`
   row by commit time, with matching state id, provider/workspace/actor
   snapshot, status, checked timestamp, last-error, source, state fingerprint,
   and metadata.
4. The trigger is deferred so existing model-owned transactions can keep their
   state-update-then-event-write order.
5. Direct health overlay rewrites that would affect provider routing without
   append-only event evidence now fail on
   `ai_provider_health_states_event_history_required_check`.

## Implemented Provider Health State Row Constraint Slice

DB-backed provider health overlays now enforce the scalar and JSON shape used
by the overlay model before rows can affect routing.

Implemented behavior:

1. Provider health rows now require `status` to be one of `unknown`, `healthy`,
   `degraded`, or `down`.
2. Provider health rows now require `source` to be either `manual_override` or
   `probe_result`.
3. Provider health rows now require `scope_type` to be either `global` or
   `workspace`.
4. Global health rows must keep `workspace_id` null, while workspace health
   rows must carry `workspace_id`.
5. Provider health `metadata` must be a JSON object.
6. The constraints are added as `NOT VALID` so historical malformed rows can
   be cleaned up separately while PostgreSQL rejects new or updated malformed
   overlay rows.

## Implemented Provider Health Identity/Fingerprint Constraint Slice

DB-backed provider health overlays now enforce the common identity and
fingerprint string shape used by the overlay model before rows can affect
routing.

Implemented behavior:

1. Provider health rows require non-blank `provider_id` values within the
   current model-layer boundary.
2. Optional `provider_type` values may remain null, but present values must be
   non-blank and bounded so blank types cannot silently act like untyped
   overlays.
3. Provider health rows require non-blank bounded `fingerprint` values.
4. The constraints are added as `NOT VALID` so historical malformed rows remain
   upgrade-tolerant while PostgreSQL rejects new or updated malformed overlay
   identity and fingerprint evidence.

## Implemented Provider Health Last-error String Shape Slice

DB-backed provider health overlays now enforce usable string shape for present
diagnostic error evidence before rows can affect routing or diagnostics.

Implemented behavior:

1. Provider health `last_error` may remain null when no diagnostic error is
   available.
2. Present `last_error` values must be non-blank and no longer than the
   current 512-character model boundary.
3. Provider health writer paths trim and bound `lastError` before persistence.
4. The constraint is added as `NOT VALID` so historical malformed rows remain
   upgrade-tolerant while PostgreSQL rejects new or updated blank diagnostic
   evidence.
5. This deliberately does not require degraded/down rows to carry
   `last_error`; it only protects the string shape when diagnostics are
   present.

## Implemented Registry Revision Uniqueness Slice

Registry revision writes now have database-backed same-scope uniqueness for all
four DB-backed registry families.

Implemented behavior:

1. Prompt Registry and Task Route Policy publishers use their existing
   workspace/global revision unique keys for conflict-safe writes.
2. Model Registry and Provider Registry add matching partial unique indexes for
   global and workspace revision scopes.
3. Direct publish and repair execution publish paths use `ON CONFLICT DO
NOTHING`, then reload and compare the persisted fingerprint.
4. Matching fingerprints are treated as idempotent reuse; mismatched
   fingerprints are rejected instead of overwriting or silently accepting a
   conflicting revision.

## Implemented Source-chain Provenance Hardening Slice

DB-backed registry revisions now reject unknown provenance source/scope values
and unknown provenance status values when normalizing fallback source chains.
They also sanitize optional provenance metadata fields on otherwise valid
source-chain entries.

Implemented behavior:

1. Prompt Registry source chains only keep known prompt registry provenance
   sources, `global`/`workspace` scopes, and known prompt publish/readiness
   statuses.
2. Task Route Policy source chains only keep DB/config/provider-default
   provenance sources, `global`/`workspace` scopes, and active/available
   statuses.
3. Model Registry source chains only keep DB/provider-profile/native/config
   provenance sources, `global`/`workspace` scopes, and known model
   availability statuses.
4. Provider Registry source chains only keep DB/provider-profile/legacy/config
   provenance sources, `global`/`workspace` scopes, and known provider
   availability statuses.
5. The same normalization is used for direct publish inputs, repair executor
   payloads, and DB row hydration, so durable diagnostics cannot retain
   arbitrary provenance strings.
6. Optional fields such as actor id, fingerprint, revision, workspace id,
   updated-at, config path, registry id, model id, provider id, provider type,
   task feature kind, and config key are copied only when their runtime type
   and family vocabulary are valid.
7. All four registry families cap normalized fallback source chains at the
   first 16 valid provenance entries, so malformed or oversized direct writes
   cannot persist unbounded provenance JSON.

## Implemented Repair Payload String-bound Hardening Slice

DB-backed registry repair executors now normalize and bound durable string
metadata before it is used for revision fingerprints, DB rows, provider/model
profiles, or repair metadata.

Implemented behavior:

1. Prompt Registry repair payload string fields are trimmed and bounded before
   expected registry fingerprints, timestamps, operation fingerprints, and
   operation kinds are persisted.
2. Task Route Policy repair payload fields such as model id, config path,
   operation fingerprints, source fingerprints, and candidate fingerprints are
   trimmed, deduplicated where list-shaped, and bounded.
3. Model Registry repair payloads now reuse the same model-definition
   sanitizer as direct publish, so aliases, behavior flags, raw model ids,
   display names, route overrides, capabilities, and metadata arrays are
   normalized before DB persistence.
4. Provider Registry repair payloads use the same provider-profile and nested
   model-definition sanitizer as direct publish, and list-shaped provider model
   metadata is trimmed, deduplicated, and bounded.
5. Overlong required repair payload strings fail before the revision row is
   written, so deterministic worker payload failures do not leave partial
   registry side effects.

## Implemented Direct Publish Input String-bound Hardening Slice

The constrained direct publish APIs now share the same bounded string policy
at the registry model boundary instead of relying on GraphQL callers to submit
already-normalized metadata.

Implemented behavior:

1. Prompt Registry direct publish trims and bounds prompt names, revision ids,
   expected registry metadata, validation status strings, idempotency keys,
   route fingerprints, and optional publish review metadata before computing
   fingerprints or writing rows.
2. Task Route Policy direct publish trims and bounds workspace/actor/model
   identifiers, config key/path metadata, revision ids, and idempotency keys.
3. Model Registry direct publish trims and bounds provider/model identifiers,
   revision ids, idempotency keys, and sanitized model definition strings.
4. Provider Registry direct publish trims and bounds provider identifiers,
   revision ids, idempotency keys, provider profile metadata, model lists, and
   nested model definition strings.
5. Overlong direct publish strings fail before DB writes, and whitespace-only
   optional strings are dropped rather than being persisted into metadata or
   fingerprints.

## Implemented Registry Persistence Boundary Hardening Slice

DB-backed registry revision writers now bound persisted metadata JSON and
normalize repair-wrapper identity fields before using them for revision ids,
fingerprints, DB rows, or audit metadata.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   metadata JSON is serialized and capped before row insertion, so future
   metadata expansion fails closed before durable side effects.
2. Repair execution wrapper fields such as workspace id, actor id, execution
   request id, request fingerprint, evidence-set fingerprints, repair job
   fingerprint, and approval fingerprint are trimmed and bounded at each
   registry model boundary.
3. Repair execution request ids are bounded with the `repair-` revision prefix
   included, preventing a valid wrapper id from producing an oversized
   persisted revision string.
4. Provider Registry direct publish now computes persisted
   `idempotencyKeyFingerprint` from normalized workspace id, provider id, and
   idempotency key values, matching the revision and row identity inputs.
5. Overlong wrapper fields fail before DB writes; whitespace-padded wrapper
   fields persist as normalized revision, row, and metadata values.
6. Provider Registry readback now bounds hydrated provider-profile JSON and
   sanitizes persisted `modelDefinitions`, dropping malformed legacy entries
   and clearing provider config before model/router consumers see the profile.
7. Model Registry readback now bounds hydrated `model_definition` JSON and
   reuses the publish sanitizer, falling back to a disabled definition when
   legacy rows are malformed or oversized.

## Implemented Registry Revision Row Constraint Slice

DB-backed Model Registry and Provider Registry revision rows now have the same
row-level scalar constraints as Prompt Registry and Task Route Policy revisions.

Implemented behavior:

1. `ai_model_registry_revisions` and `ai_provider_registry_revisions` now
   enforce `scope_type IN ('global', 'workspace')` and
   `status IN ('active', 'archived', 'disabled')` for new writes.
2. The constraints are added as `NOT VALID` so existing deployments with legacy
   malformed rows can migrate without failing the schema change, while new or
   updated malformed rows are rejected by PostgreSQL.
3. Model Registry and Provider Registry hydration no longer trusts raw DB
   scalar strings as typed revision values. Unknown persisted scope values are
   normalized from row shape, and unknown statuses hydrate as `disabled`.
4. The existing read paths still select only active global/workspace rows for
   effective routing, preserving runtime precedence while making direct row
   readback safer for historical data.

## Implemented Registry Revision Scope Workspace Invariant Slice

DB-backed registry revisions now enforce the relationship between revision
scope and workspace identity across all four registry families.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision rows now reject `scope_type='global'` with a non-null
   `workspace_id`.
2. The same tables reject `scope_type='workspace'` with a null `workspace_id`.
3. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated malformed scope/workspace pairs.
4. Existing read paths keep selecting only active rows with matching
   global/workspace predicates, while the database now prevents future rows
   that would bypass partial unique index semantics or confuse same-scope
   idempotency.

## Implemented Registry Revision JSON Shape Invariant Slice

DB-backed registry revisions now enforce the durable JSON shape used by all
read paths and writer models across the four registry families.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision rows now require `fallback_source_chain` to be a JSON array.
2. The same revision rows require `metadata` to be a JSON object.
3. Model Registry revision rows now require `model_definition` to be a JSON
   object, and Provider Registry revision rows now require `provider_profile`
   to be a JSON object.
4. The constraints are added as `NOT VALID` so deployments with historical
   malformed JSON rows can apply the schema change while PostgreSQL rejects new
   or updated malformed source-chain, metadata, or payload shapes.
5. Existing model read paths still normalize historical malformed rows, but new
   direct/manual writes can no longer rely on hydration repair to turn scalar or
   array/object-swapped JSON into safe registry evidence.

## Implemented Registry Revision String Shape Invariant Slice

DB-backed registry revisions now enforce the same durable revision string shape
that the writer models already sanitize before row insertion.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision rows now require non-empty `revision` values.
2. The same rows cap `revision` at 512 characters.
3. Revision values may only use `a-z`, `A-Z`, `0-9`, `.`, `_`, `:`, and `-`,
   matching the current model-level sanitizer.
4. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated malformed revision strings.
5. Existing writer paths keep generating deterministic direct-publish and
   `repair-<executionRequestId>` revisions, while direct/manual rows can no
   longer bypass the same shape boundary.

## Implemented Registry Identity String Shape Invariant Slice

DB-backed registry revisions now enforce the required scalar identity string
shape that writer models already trim and bound before row insertion.

Implemented behavior:

1. Prompt Registry rows require non-blank `prompt_name` values within the
   existing 32-character prompt name column boundary.
2. Task Route Policy rows allow `model_id` to stay null for legacy/fallback rows,
   but reject non-null blank model ids and cap non-null ids at 512 characters.
3. Model Registry rows require non-blank `provider_id` and `model_id` values
   within the current 512-character model-layer boundary.
4. Provider Registry rows require non-blank `provider_id` values within the
   current 512-character model-layer boundary.
5. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated malformed identity strings.
6. This slice deliberately does not constrain registry fingerprints to hex-only
   values; existing config, seed, and direct-publish evidence uses readable
   deterministic identifiers as well as hash-like values.

## Implemented Registry Fingerprint String Shape Invariant Slice

DB-backed registry revisions now enforce the common non-blank bounded
fingerprint shape without changing existing readable fingerprint semantics.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision rows now reject blank `fingerprint` values.
2. The same rows cap `fingerprint` at the current 512-character model-layer
   string boundary.
3. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated malformed fingerprint strings.
4. This deliberately does not constrain registry fingerprints to hex-only
   values; existing config, seed, and direct-publish evidence uses readable
   deterministic identifiers as well as hash-like values.

## Implemented Task Route Policy Config String Shape Slice

DB-backed Task Route Policy revisions now enforce optional persisted config
metadata string shape.

Implemented behavior:

1. Present `ai_task_route_policy_revisions.config_key` values must be
   non-blank and no longer than the existing 512-character model boundary.
2. Present `ai_task_route_policy_revisions.config_path` values must be
   non-blank and no longer than the existing 512-character model boundary.
3. Null config metadata remains allowed so route policy rows can omit config
   provenance when no config fallback participated.
4. The constraint is added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated blank config metadata.
5. This deliberately does not constrain config keys to the current model enum;
   the model/API path still validates supported publish keys, while the DB
   boundary preserves future route metadata extensibility.

## Implemented Provider Registry Provider Type String Shape Slice

DB-backed Provider Registry revisions now enforce optional persisted provider
type string shape before provider provenance reaches registry read paths.

Implemented behavior:

1. Present `ai_provider_registry_revisions.provider_type` values must be
   non-blank and no longer than the existing 512-character model boundary.
2. Null provider types remain allowed for legacy or manually repaired rows; the
   read path continues to normalize missing/unknown types before provider
   profile hydration.
3. The constraint is added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated blank provider-type metadata.
4. This deliberately does not constrain provider types to the current enum;
   the model/API and repair executor paths still validate supported provider
   types, while the DB boundary preserves future provider extensibility.

## Implemented Revision Timestamp Coherence Slice

DB-backed registry revisions now enforce durable timestamp ordering across
Prompt Registry, Task Route Policy, Model Registry, and Provider Registry rows.

Implemented behavior:

1. `updated_at` must be greater than or equal to `created_at` for all four
   revision tables.
2. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated impossible timestamp ordering.
3. This deliberately does not add archive/disable lifecycle semantics or editor
   workflow assumptions; it only preserves coherent revision ordering evidence
   used by read overlays, diagnostics, and Admin displays.

## Implemented Source-chain Provenance Constraint Slice

DB-backed registry revisions now enforce current fallback source-chain
provenance vocabulary at the database boundary for Prompt Registry, Task Route
Policy, Model Registry, and Provider Registry rows.

Implemented behavior:

1. A shared immutable SQL helper validates that `fallback_source_chain` is a
   JSON array whose entries are JSON objects with string `source`, `scope`, and
   `status` fields.
2. Prompt Registry rows only accept the current Prompt Registry provenance
   sources and statuses used by DB revisions, legacy registry fallback,
   publish-gate review, direct publish, and repair execution.
3. Task Route Policy rows only accept the current task policy provenance
   sources and statuses used by DB revisions, config fallback, and provider
   default resolution.
4. Model Registry rows only accept the current model provenance sources and
   statuses used by DB revisions, provider profiles, native registry fallback,
   and config fallback.
5. Provider Registry rows only accept the current provider provenance sources
   and statuses used by DB revisions, provider profiles, legacy profiles, and
   config fallback.
6. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated rows that bypass model-layer source-chain sanitization.

## Implemented Source-chain Metadata Constraint Slice

DB-backed registry revisions now enforce optional fallback source-chain
metadata shape at the database boundary for Prompt Registry, Task Route Policy,
Model Registry, and Provider Registry rows.

Implemented behavior:

1. Shared immutable SQL helpers validate optional source-chain string metadata
   fields as non-blank, bounded strings when present.
2. Prompt Registry source-chain entries validate optional `registryId` as a
   non-negative safe integer, matching the model boundary used for persisted
   registry provenance.
3. Task Route Policy source-chain entries validate optional `configKey` and
   `featureKind` values against the current task route metadata vocabulary.
4. Model Registry source-chain entries validate optional provider/model
   identity, fingerprint, revision, workspace, actor, and update timestamp
   fields as bounded strings.
5. Provider Registry source-chain entries validate optional provider identity,
   fingerprint, revision, workspace, actor, update timestamp, and
   `providerType` fields against the current provider type vocabulary.
6. The constraints are added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated rows that bypass model-layer optional metadata sanitization.

## Implemented Provider Health Timestamp Coherence Slice

DB-backed Provider Health rows now enforce coherent probe/manual observation
timestamps before they can influence route overlays or stale cleanup.

Implemented behavior:

1. `ai_provider_health_states.updated_at` must be greater than or equal to
   `checked_at`, matching writer and cleanup paths that use the latest
   observation time as the row update time.
2. The constraint is added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated impossible health timestamp ordering.
3. This deliberately does not require errors for degraded/down rows and does
   not add provider-specific probe semantics; it only preserves timestamp
   evidence used by freshness overlays, stale cleanup, and diagnostics.

## Implemented Provider Health Metadata Contract Slice

DB-backed Provider Health rows now enforce the metadata contract used by
manual overrides, probe snapshots, and cleanup workers.

Implemented behavior:

1. Provider health writers preserve reserved metadata fields after caller
   extras are merged, so callers cannot override `version` or `publishSource`.
2. Provider health metadata must carry
   `version=provider-health-state-metadata/v1`.
3. Manual override rows must carry `publishSource=graphql_mutation`.
4. Probe-result rows must carry one of the current probe/cleanup publish
   sources:
   `workspace_provider_health_probe_result`,
   `configured_provider_health_snapshot_worker`,
   `configured_provider_health_snapshot_cleanup_worker`, or
   `provider_health_probe_result_stale_cleanup_worker`.
5. The constraint is added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated rows that would make freshness cleanup and diagnostics ambiguous.

## Implemented Provider Health Cleanup Metadata Contract Slice

DB-backed Provider Health rows now enforce the source-specific evidence used
by configured snapshot persistence and stale cleanup workers.

Implemented behavior:

1. Provider Health model writes normalize metadata before persistence, preserve
   reserved `version` and `publishSource`, and bound serialized metadata size.
2. Configured snapshot rows now require provider profile identity,
   snapshot-source evidence, and bounded optional config-path evidence.
3. Configured snapshot cleanup rows now require the cleanup reason, previous
   status, previous checked timestamp, previous fingerprint, previous
   publish-source, and previous last-error evidence when clearing a stale
   configured overlay to `unknown`.
4. Stale probe-result cleanup rows now require the cleanup reason, previous
   status/source/publish-source, previous checked timestamp, previous
   fingerprint, previous last-error evidence, and a positive
   `probeResultMaxAgeMs` freshness boundary.
5. The constraint is added as `NOT VALID` and is scoped to current
   `provider-health-state-metadata/v1` rows, with trimmed-version checks so
   whitespace-padded current-version metadata cannot bypass the cleanup
   contract.

## Implemented Provider Health Event History Slice

Provider Health overlays now keep append-only history rows for the existing
manual override, configured snapshot, workspace probe-result, and cleanup
writers instead of leaving history implicit in the latest overlay row.

Implemented behavior:

1. `ai_provider_health_events` records provider id/type, scope, workspace,
   actor, status, checked timestamp, last error, source, event type, state
   fingerprint, event fingerprint, and the same validated metadata used by the
   current overlay row.
2. Manual workspace overrides write `manual_override_recorded` events.
3. Workspace probe-result writes record `workspace_probe_result_recorded`
   events, while configured profile snapshots record
   `configured_snapshot_recorded` events.
4. Configured snapshot cleanup and stale probe-result cleanup record
   `configured_snapshot_cleared` and `stale_probe_result_cleared` events with
   the previous-state evidence already enforced by the cleanup metadata
   contract.
5. Event rows are DB-constrained for status/source/scope vocabulary,
   event-type/source/publish-source coherence, metadata shape and contract,
   identity/fingerprint strings, and workspace/scope coherence.
6. This is durable history for current writers; it does not add external
   network probe execution or provider credential handling.

## Implemented Provider Health Event State Integrity Slice

Provider Health event history now rejects new orphan events while preserving
the append-only historical event semantics.

Implemented behavior:

1. New `ai_provider_health_events` rows must carry a non-null `state_id`.
2. `state_id` must reference an existing `ai_provider_health_states` row, so
   direct SQL cannot create event history that cannot be joined back to its
   Provider Health overlay.
3. The state-id presence check and FK are `NOT VALID`, preserving upgrade
   tolerance for historical rows while rejecting new orphan events.
4. The constraint intentionally does not bind event status or
   `state_fingerprint` to the current state row, because event history records
   previous state snapshots and the state row is updated in place.
5. Focused coverage verifies direct SQL missing-state and orphan-state event
   inserts are rejected at the database boundary.

## Implemented Provider Health Event State Snapshot Coherence Slice

Provider Health event rows now preserve the immutable identity snapshot of the
state row they reference.

Implemented behavior:

1. `ai_provider_health_states` exposes composite snapshot keys on
   `(id, provider_id, scope_type)` and
   `(id, provider_id, scope_type, workspace_id)`.
2. `ai_provider_health_events` must match `state_id`, `provider_id`, and
   `scope_type` to the referenced state, so direct SQL cannot attach an event
   to a workspace state while presenting it as a global or different-provider
   event.
3. Workspace-scoped event rows must also match the state row workspace id, so
   direct SQL cannot move event evidence into another real workspace while
   keeping the same state id.
4. The constraints intentionally do not bind event status, actor,
   provider-type, or `state_fingerprint` to the current state row because
   Provider Health state rows are updated in place and events are historical
   snapshots of previous transitions.
5. Focused coverage verifies direct SQL scope and workspace snapshot drift is
   rejected at the database boundary.

## Implemented Provider Health Event Write Snapshot Coherence Slice

Provider Health event history now validates mutable state snapshots at the
event write boundary without turning historical events into live mirrors of the
current state row.

Implemented behavior:

1. `ai_provider_health_events` has a write-time trigger for insert and direct
   updates of `state_id` or `state_fingerprint`.
2. When the referenced state row exists, new or rewritten events must carry the
   current state fingerprint, so direct SQL cannot create a fresh event that
   claims a stale or fabricated state snapshot.
3. Event actor evidence must match the current state actor at the time the
   event is written, including both values being null for actorless global
   worker snapshots.
4. Direct actor rewrites on existing events are also checked, while database
   FK-driven actor cleanup can still clear user references without invalidating
   historical event rows.
5. Focused coverage verifies event fingerprint drift and write-time actor drift
   are rejected at the database boundary while configured snapshot worker
   events still persist with a null actor.

## Implemented Provider Health Event Content Update Restrict Slice

Provider Health event rows now preserve their own transition evidence as
append-only DB history after persistence.

Implemented behavior:

1. `ai_provider_health_events` rejects direct updates that change event identity,
   state linkage, provider/scope/workspace/actor evidence, status, checked time,
   last error, source, event type, event fingerprint, state fingerprint,
   metadata, or creation time.
2. The trigger permits true no-op updates and runs after the existing row-shape,
   metadata-contract, state-id, state-snapshot, and write-snapshot checks, so
   malformed writes still report the older specific constraints while coherent
   event rewrites hit the append-only boundary.
3. Focused coverage verifies no-op event updates pass while coherent metadata
   rewrites and event-fingerprint rewrites reject before Provider Health
   mutation responses, registry overlays, or Admin diagnostics can observe
   rewritten transition history.

## Implemented Provider Health Event Delete Restrict Slice

Provider Health event rows now preserve append-only transition history against
direct deletes.

Implemented behavior:

1. `ai_provider_health_events` has a deferred
   `ai_provider_health_events_delete_restrict_check` trigger.
2. Deleting an event row is rejected while the parent
   `ai_provider_health_states` row still exists, so direct SQL cannot erase
   manual override, probe result, configured snapshot, cleanup, or stale probe
   cleanup history from a live health overlay.
3. Parent state deletion used to cascade event rows, preserving normal
   ownership cleanup. The later Provider Health State Delete Restrict slice
   supersedes that behavior for direct state-row deletes while keeping
   workspace ownership cleanup compatible.
4. Focused Provider Health coverage verifies direct event deletion rejects.
   Disposable Postgres smoke verifies direct deletion rejection and
   parent-state cascade compatibility.

## Implemented Provider Health State Delete Restrict Slice

Provider Health state rows now preserve route-affecting overlay history against
direct state-row deletion.

Implemented behavior:

1. `ai_provider_health_states` has a `BEFORE DELETE`
   `ai_provider_health_states_delete_restrict_check` trigger.
2. Deleting a workspace-scoped state row is rejected while the owning workspace
   still exists, so direct SQL cannot erase the current Provider Health overlay
   and cascade away its manual override, probe result, configured snapshot,
   cleanup, or stale probe cleanup history.
3. Deleting a global Provider Health state row is rejected because it has no
   workspace ownership cascade path.
4. `ai_provider_health_events` also has an immediate delete guard in addition
   to the existing deferred guard, so a transaction cannot delete event rows
   first and then delete the state row before deferred checks run.
5. Workspace deletion can still cascade workspace-scoped Provider Health
   states and events, preserving ownership cleanup.
6. Focused Provider Health coverage verifies direct state deletion rejects,
   event-then-state bypass attempts reject, and workspace deletion still
   cascades Provider Health state and event cleanup.

## Implemented Provider Health Event History Read Exposure Slice

DB-backed Provider Health event rows now surface through the existing manual
state mutation response instead of remaining SQL-only evidence.

Implemented behavior:

1. `CopilotProviderHealthStateType` exposes `eventCount` and recent `events`.
2. Recent Provider Health events include state id, provider id/type,
   scope/workspace/actor, status, checked timestamp, last error, source, event
   type, event fingerprint, state fingerprint, metadata, and creation time.
3. Provider Health model write paths hydrate a bounded latest-first event
   history after writing manual overrides, workspace probe results, and global
   configured snapshots.
4. Base Provider Health state hydration now defaults event history to an empty
   list with count zero so future lightweight state readers stay GraphQL-safe.
5. The existing manual provider health mutation can show the first
   `manual_override_recorded` event and later newest-first health transition
   history without requiring direct SQL inspection.
6. This exposes recent durable history for existing write responses; it does
   not add a full Provider Health timeline UI, external probe execution,
   provider credential workflows, or bulk migration.

## Implemented Registry Revision Publish Event History Slice

DB-backed registry revision publishers now append durable event rows for both
new revision publications and idempotent matching-revision reuse attempts.

Implemented behavior:

1. `ai_registry_revision_publish_events` records registry family, revision id,
   scope, workspace, actor, registry key, revision, revision fingerprint,
   revision status, event type, publish source, event fingerprint, and
   versioned metadata.
2. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   direct publish paths write `revision_published` for new rows and
   `revision_reused` when a matching fingerprint already exists.
3. The constrained repair-execution publishers for the same four registry
   families write the same event stream with `publish_source` set to
   `repair_execution_worker`.
4. Event rows use family-specific revision foreign keys plus registry identity
   columns for provider/model families, so queries can inspect all registry
   publication history from one table without losing family-specific
   integrity.
5. The event table is DB-constrained for family/scope/status/event/source
   vocabulary, metadata/column coherence, metadata key presence, event
   fingerprint shape, family-specific FK coherence, and revision snapshot
   coherence against the parent revision row.
6. New publication events write an explicit application-owned `created_at`
   matching the parent revision row creation timestamp, keeping deferred
   publish-history proof and newest-first diagnostics independent of database
   default transaction-time ordering.
7. Revision-row inserts now use `INSERT ... DO NOTHING RETURNING id` so a
   publisher that loses the unique-key race after its pre-read records
   `revision_reused` instead of a second `revision_published` event.
8. This is durable publish/reuse history for current writers; it does not add
   full registry editor timelines, history UI, or bulk migration workflows.

## Implemented Registry Publish Event Parent Revision Snapshot CAS Slice

DB-backed registry publish/reuse event writers now require the parent revision
row version read by the publisher before appending publish history. This closes
the stale-read gap where a model-owned writer could publish or reuse a revision
after another actor had already changed the revision row or its family-specific
content evidence.

Implemented behavior:

1. The shared registry publish-event model now requires the hydrated parent
   revision's content, fallback source-chain, metadata, fingerprint, status,
   and `updated_at` snapshot from Prompt Registry, Task Route Policy, Model
   Registry, or Provider Registry writers.
2. `revision_published` and `revision_reused` events are inserted through a
   family-specific `INSERT ... SELECT` against the parent revision table, with
   revision identity, workspace/actor scope, registry identity, fingerprint,
   status, `updated_at`, and family-specific content evidence all matching the
   publisher's snapshot.
3. If the parent row is missing, has drifted, or no longer matches the
   publisher's hydrated snapshot, event insertion fails closed with a
   state-changed error before appending publish history.
4. Prompt Registry writers fence fallback source-chain and metadata snapshots;
   Task Route Policy writers fence model id, config key/path, fallback
   source-chain, and metadata; Model Registry writers fence model definition,
   fallback source-chain, and metadata; Provider Registry writers fence
   provider profile, fallback source-chain, and metadata.
5. Direct publish paths pass the newly created row snapshot; idempotent reuse
   paths pass the existing row snapshot, so both new publication and reuse
   history share the same CAS boundary.
6. Focused coverage stubs stale Prompt Registry and Provider Registry reuse
   reads and verifies stale publish-event appends are rejected while existing
   publish history stays unchanged. Cross-family coverage keeps direct publish
   and reuse history valid across Prompt Registry, Task Route Policy, Model
   Registry, and Provider Registry.

## Implemented Registry Publish Event Conflict Evidence Fence Slice

DB-backed registry publish/reuse event writers now validate rows reused after
an `event_fingerprint` insert conflict instead of treating every conflict as a
generic parent revision state change.

Implemented behavior:

1. The shared publish-event helper keeps the existing family-specific
   parent-revision `INSERT ... SELECT` CAS boundary.
2. If `ON CONFLICT (event_fingerprint) DO NOTHING` reports a conflict, the
   helper re-reads the event row by fingerprint.
3. The conflict row must match registry family, revision id, provider/model
   identity, workspace/actor, scope, registry key, revision, revision
   fingerprint/status, event type, publish source, event fingerprint, and
   metadata fingerprint before it is considered idempotent.
4. A missing or mismatched conflict row raises a deterministic publish-event
   conflict evidence error.
5. Focused coverage uses a mocked DB conflict readback to verify mismatched
   event evidence is rejected, and cross-family E2E coverage verifies normal
   direct publish/reuse history still persists.

## Implemented Registry Publish Event Global Snapshot Coherence Slice

DB-backed registry publish events now preserve parent revision identity even
when the event is global and therefore carries no workspace/actor snapshot.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision tables expose publish-event identity keys that exclude nullable
   workspace and actor columns.
2. `ai_registry_revision_publish_events` adds `NOT VALID` composite foreign
   keys from each family-specific revision id, scope, registry identity,
   revision, revision fingerprint, and revision status back to those parent
   identity snapshots.
3. The new foreign keys use `ON UPDATE RESTRICT`, so direct SQL cannot mutate
   parent revision identity columns out from under persisted publish events.
4. The earlier workspace/actor snapshot FKs still cover workspace-scoped event
   rows when those non-null columns are present; the new identity FKs close the
   global-row gap caused by PostgreSQL composite FK `MATCH SIMPLE` semantics.
5. Focused coverage inserts a global Prompt Registry publish event directly and
   verifies revision fingerprint drift is rejected at the database boundary.

## Implemented Registry Publish Event Actor Snapshot Coherence Slice

DB-backed registry publish events now preserve present actor evidence even when
the event has no workspace snapshot.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision tables expose publish-event actor snapshot keys that exclude
   nullable workspace columns while retaining nullable actor columns.
2. `ai_registry_revision_publish_events` adds `NOT VALID` family-specific
   composite FKs from revision id, scope, actor, registry identity, revision,
   revision fingerprint, and revision status back to those parent actor
   snapshots.
3. The new FKs use `ON UPDATE RESTRICT`, so direct SQL cannot drift an event's
   present actor evidence or mutate a parent revision actor underneath an event
   that captured actor evidence.
4. Nullable actor rows remain upgrade-compatible and continue to rely on the
   existing global identity FKs; workspace rows still require actor evidence
   through the workspace actor check.
5. Focused coverage inserts a global Prompt Registry publish event with actor
   evidence and verifies both child actor drift and parent revision actor drift
   are rejected at the database boundary.

## Implemented Registry Revision Content Update Restrict Slice

DB-backed registry revisions now preserve content evidence immediately after
the row is inserted, even before publish/reuse event history exists.

Implemented behavior:

1. Prompt Registry revision rows cannot directly update
   `fallback_source_chain` or `metadata`.
2. Task Route Policy revision rows cannot directly update
   `model_id`, `config_key`, `config_path`, `fallback_source_chain`, or
   `metadata`.
3. Model Registry revision rows cannot directly update
   `model_definition`, `fallback_source_chain`, or `metadata`.
4. Provider Registry revision rows cannot directly update
   `provider_type`, `provider_profile`, `fallback_source_chain`, or
   `metadata`.
5. The trigger permits true no-op updates, preserving harmless ORM or migration
   writes that set content columns to their existing value, but no-event
   diagnostic rows can no longer mutate content in place after insert.
6. Focused coverage verifies unpublished Prompt Registry metadata drift, Task
   Route Policy model drift, Model Registry definition drift, and Provider
   Registry profile drift are rejected before publish events exist, and keeps
   the published-row drift checks active at the database boundary.
7. Focused coverage also verifies published Prompt Registry metadata drift, Task
   Route Policy model drift, Model Registry definition drift, and Provider
   Registry profile drift remain rejected at the database boundary.

## Implemented Registry Publish Event Content Update Restrict Slice

DB-backed registry publish events now preserve their own event evidence as
append-only history after the row is written.

Implemented behavior:

1. `ai_registry_revision_publish_events` rejects direct updates that change
   event identity, registry family linkage, revision snapshot columns,
   workspace/actor evidence, event/source fields, event fingerprint, metadata,
   or creation time.
2. The trigger permits true no-op updates, preserving compatibility with
   harmless ORM or migration writes that set a column to its existing value.
3. The trigger runs after the existing row-shape, metadata, family coherence,
   workspace actor, and snapshot constraints, so malformed writes still report
   the older specific DB-boundary failure while coherent rewrites hit the new
   append-only publish-event boundary.
4. Focused coverage verifies a persisted publish event permits a no-op update,
   rejects coherent publish-source/metadata rewrites, rejects event-fingerprint
   rewrites, and keeps existing malformed metadata, family, workspace actor,
   and parent snapshot drift checks active.

## Implemented Registry Revision Publish History Required Slice

DB-backed registry revisions now require publish history for current writer
metadata at commit time. Direct and repair-worker publish paths already append
`ai_registry_revision_publish_events`; the database boundary now closes the
reverse gap where direct SQL could create an active workspace revision with
current publish-source metadata but no `revision_published` event, or create
`revision_reused` evidence without an original publish anchor.

Implemented behavior:

1. `ai_prompt_registry_revisions`,
   `ai_task_route_policy_revisions`, `ai_model_registry_revisions`, and
   `ai_provider_registry_revisions` have deferred
   `*_publish_history_required_check` triggers for current active workspace
   direct-publish rows and real repair-worker rows using the model-owned
   `repair-${executionRequestId}` revision contract.
2. The check remains compatible with legacy/config/test rows whose metadata
   does not claim a current publish source.
3. `ai_registry_revision_publish_events` rejects `revision_reused` rows unless
   a matching `revision_published` event exists by commit time.
4. Deleting a `revision_published` anchor is rejected while the parent revision
   or reuse evidence would be left behind, while parent revision deletion can
   still cascade event rows.
5. Focused registry coverage and disposable Postgres smoke verify bare
   publish-source revision inserts reject, parent-plus-publish-event
   transactions commit, reuse-only events reject, and published-anchor deletes
   reject.

## Implemented Registry Publish Event Delete Restrict Slice

DB-backed registry publish/reuse event rows are now append-only while their
parent revision remains live. The publish-history-required slice already
prevented removing a `revision_published` anchor when that would invalidate
parent or reuse evidence, but a standalone `revision_reused` row could still be
deleted without making the remaining parent revision invalid.

Implemented behavior:

1. `ai_registry_revision_publish_events` has a deferred
   `ai_registry_revision_publish_events_delete_restrict_check` trigger.
2. Direct deletes reject for both `revision_published` and `revision_reused`
   rows while the referenced Prompt Registry, Task Route Policy, Model
   Registry, or Provider Registry revision still exists.
3. Parent revision deletion used to cascade publish/reuse event rows through
   the existing family-specific foreign keys. The later Registry Revision
   Delete Restrict slice supersedes that behavior for direct revision deletes
   while keeping workspace ownership cleanup compatible.
4. Focused registry coverage verifies direct deletion rejects for both publish
   and reuse event rows, and verifies workspace deletion still cascades
   revision plus publish-event cleanup.

## Implemented Registry Revision Delete Restrict Slice

DB-backed registry revision rows now preserve revision and publish/reuse event
history against direct deletes.

Implemented behavior:

1. `ai_prompt_registry_revisions`,
   `ai_task_route_policy_revisions`, `ai_model_registry_revisions`, and
   `ai_provider_registry_revisions` each have a `BEFORE DELETE`
   `*_delete_restrict_check` trigger.
2. Deleting a workspace-scoped revision row is rejected while the owning
   workspace still exists, so direct SQL cannot erase a DB-backed registry
   revision and cascade away publish/reuse events.
3. Deleting a global revision row is rejected because it has no workspace
   ownership cascade path.
4. Workspace deletion can still cascade workspace-scoped registry revisions and
   their publish/reuse events, preserving ownership cleanup.
5. Focused registry coverage verifies direct prompt revision deletion rejects
   and workspace deletion cascades prompt revision plus publish-event cleanup.
   Disposable Postgres smoke covers all four registry families.

## Implemented Registry Revision Metadata Contract Slice

DB-backed registry revisions now enforce publish-source provenance for the
current direct-publish and repair-executor metadata versions.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   direct-publish metadata must pair the current direct-publish version with
   `publishSource=graphql_mutation`.
2. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   repair-executor metadata must pair the current repair-executor version with
   `publishSource=repair_execution_worker`.
3. Prompt, Task Route Policy, and Model Registry repair publishers now write
   the reserved `publishSource` field that Provider Registry repair publishers
   already emitted.
4. The constraint is scoped to the known current metadata versions, so older
   test/legacy metadata versions remain object-shaped but are not forced into a
   provenance vocabulary they did not claim.
5. The constraint is added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated current-version rows with source/version drift.

## Implemented Registry Repair Metadata Evidence Constraint Slice

DB-backed registry repair revisions now enforce the stable repair provenance
metadata emitted by the constrained repair executors.

Implemented behavior:

1. Current repair-executor metadata for Prompt Registry, Task Route Policy,
   Model Registry, and Provider Registry revisions must retain
   `publishSource=repair_execution_worker`.
2. All current repair metadata versions must retain execution request id,
   request fingerprint, candidate evidence set fingerprint, task-route
   evidence set fingerprint, repair job fingerprint, approval record
   fingerprint, operation set fingerprint, preview fingerprint, and catalog
   fingerprint.
3. Prompt Registry repair metadata must also retain expected registry
   fingerprint/id/update evidence plus non-empty operation fingerprint and
   operation kind lists.
4. Task Route Policy, Model Registry, and Provider Registry repair metadata
   must retain operation fingerprint, target locator fingerprint, and any
   present candidate/task-route evidence fingerprint arrays as non-empty
   bounded string lists.
5. The constraint is scoped to known current repair-executor metadata versions,
   so older test/legacy metadata remains object-shaped but is not forced into
   the new repair evidence vocabulary.
6. The constraint is added as `NOT VALID` so deployments with historical
   malformed rows can apply the schema change while PostgreSQL rejects new or
   updated current-version repair metadata whose durable evidence drifts.

## Implemented Registry Publish Event History Read Exposure Slice

DB-backed registry publish/reuse events now surface through the existing
revision response types instead of remaining SQL-only evidence.

Implemented behavior:

1. Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
   revision GraphQL types expose `publishEventCount` and recent
   `publishEvents`.
2. Recent publish events include registry family, revision id, provider/model
   identity where applicable, workspace/actor, scope, registry key, revision
   fingerprint/status, event type, publish source, event fingerprint, metadata,
   and creation time.
3. The shared registry publish-event model hydrates event history for a
   revision with a bounded latest-first limit.
4. Direct and repair-driven registry publisher model methods return the
   created or reused revision with publish-event history attached.
5. Direct GraphQL publish mutation responses for all four registry families
   can show the first `revision_published` event and later idempotent
   `revision_reused` events without requiring direct SQL inspection.

## Implemented Prompt Catalog Publish Event Read Exposure Slice

Prompt Registry publish/reuse events now also surface through the existing
prompt catalog diagnostics path, not only through direct publish mutation
responses.

Implemented behavior:

1. Prompt catalog DB-backed revision hydration uses the shared publish-event
   history reader when it resolves latest active Prompt Registry revisions.
2. `CopilotPromptCatalogItemType` and
   `CopilotPromptCatalogVersionEvidenceType` expose
   `registryRevisionPublishEventCount` plus recent
   `registryRevisionPublishEvents`.
3. Common prompt catalog GraphQL operations select the bounded recent event
   history, and Admin renders publish/reuse event type, source, fingerprint,
   actor, and creation time in the prompt catalog diagnostics panel.
4. Catalog fingerprints remain stable because publish-event history is
   observability metadata rather than prompt/model selection identity.

## Implemented Model And Task Route Diagnostics Publish Event Read Exposure Slice

Model Registry and Task Route Policy publish/reuse events now surface through
the normal model/task-route diagnostics path, not only through direct publish
mutation responses or prompt catalog revision evidence.

Implemented behavior:

1. Latest active Model Registry, Provider Registry, and Task Route Policy
   revision hydration attaches bounded publish-event history before provider
   registry construction, model route diagnostics, and task policy resolution
   build their read models.
2. `getPromptModels` now exposes model registry publish-event counts/events on
   model candidates, task-route route/prepare candidates, and task-route
   candidate traces, plus Task Route Policy publish-event counts/events on
   task-route diagnostics.
3. Admin model candidate diagnostics render recent model revision publish/reuse
   event type, source, fingerprint, actor, and creation time. Task-route
   diagnostics render Task Route Policy event history and candidate model
   registry event history beside existing revision/source-chain evidence.
4. Source fingerprints remain stable because publish-event history is
   diagnostic evidence, not route/model selection identity.

## Implemented Provider Registry Publish-time Probe Attempt Slice

Provider Registry publish paths now create durable Provider Health probe
evidence at publish time, instead of relying only on the daily enqueue scan.

Implemented behavior:

1. `publishWorkspaceRevisionRecord` enqueues a workspace
   `ai_provider_health_probe_attempts` row after both newly published and
   idempotently reused Provider Registry revisions.
2. The immediate attempt uses the same sanitized provider-profile snapshot,
   revision id/fingerprint binding, request fingerprint, and uniqueness bucket
   as the existing automatic no-network probe ledger.
3. The direct GraphQL publish response exposes the queued probe attempt
   id/status/fingerprints so operators can inspect that durable probe work was
   scheduled without direct SQL.
4. Repair-execution provider registry side effects use the same model path, so
   approved repairs also leave a queued Provider Health probe attempt before
   the worker executes external-free local profile/runtime checks.

## Implemented Provider Health Probe Enqueue Conflict Evidence Fence Slice

Provider Health probe enqueue now fails closed when a unique-key conflict
returns a row whose immutable request evidence does not match the enqueue
request.

Implemented behavior:

1. `enqueueWorkspaceProviderHealthProbeAttempt` still uses the existing
   request-fingerprint idempotency bucket, but after `ON CONFLICT DO NOTHING`
   it validates the hydrated row against the revision id/fingerprint,
   provider identity, workspace/actor scope, profile source, profile
   fingerprint, request fingerprint, and sanitized profile snapshot it just
   computed.
2. If a conflicting row reuses the request fingerprint while carrying drifted
   provider-profile evidence, the model raises a deterministic mismatch error
   instead of silently returning the wrong queued attempt.
3. The normal idempotent path stays compatible for queued, processing,
   completed, or dead-lettered attempts whose request evidence still matches
   the original enqueue request.

## Implemented Provider Health Probe Enqueue Parent Revision Snapshot CAS Slice

Provider Health probe enqueue now requires the active Provider Registry
revision row to still match the snapshot used to compute the probe request
before writing queued probe evidence.

Implemented behavior:

1. `enqueueWorkspaceProviderHealthProbeAttempt` writes through an
   `INSERT ... SELECT FROM ai_provider_registry_revisions ... RETURNING id`
   instead of a blind probe-attempt insert.
2. The parent Provider Registry revision predicate compares revision id,
   provider id/type, workspace/actor scope, revision, status, fingerprint,
   raw provider profile JSON, raw fallback source-chain JSON, metadata,
   creation time, and update time.
3. If the parent revision row changed between provider target readback and
   enqueue, the insert returns no row and enqueue fails closed before writing
   probe attempt evidence.
4. The fence uses the raw persisted provider profile and source-chain JSON
   snapshots rather than only normalized runtime objects, so historical or
   extra persisted fields cannot be silently discarded during the CAS check.
5. Focused coverage passes a stale provider revision snapshot to enqueue and
   verifies no probe attempt row is written when the persisted parent revision
   no longer matches.

## Implemented Provider Health Event Conflict Evidence Fence Slice

Provider Health event inserts now fail closed when the deterministic event id
conflicts with a row whose persisted event evidence differs from the event that
the current state writer is trying to append.

Implemented behavior:

1. Provider Health event history still uses a deterministic event id derived
   from the event fingerprint, but `insertHealthEvent` now inserts with
   `DO NOTHING RETURNING id` and reads back the conflicted event row before
   treating the write as idempotent.
2. The readback fence compares state id, provider identity, scope,
   workspace/actor snapshot, status, checked time, last-error text, source,
   event type, state fingerprint, event fingerprint, and metadata fingerprint.
3. A conflicting event row with drifted metadata or event evidence now raises a
   deterministic mismatch error instead of silently preserving the wrong
   append-only history row.

## Implemented Registry Revision Row Conflict Evidence Fence Slice

Prompt Registry, Task Route Policy, Model Registry, and Provider Registry
publish paths now validate the full row evidence when their workspace unique
keys are reused.

Implemented behavior:

1. Direct and repair-driven registry publish paths build an expected row
   evidence snapshot before insert, including row id, family-specific identity
   fields, workspace/actor scope, revision/status/fingerprint, fallback
   source-chain fingerprint, publish metadata fingerprint, and persisted
   content fingerprints for Prompt metadata, Task Route Policy route content,
   Model Registry definitions, or Provider Registry profiles.
2. Existing rows found by the pre-read and rows reused after
   `ON CONFLICT DO NOTHING` must match that evidence before publish/reuse
   history proceeds; Provider Registry additionally requires the same evidence
   before immediate Provider Health probe enqueue.
3. A same-key row whose revision fingerprint matches but whose row metadata,
   fallback source chain, route/model/profile content, or family identity
   evidence drifts now raises a deterministic mismatch error instead of being
   reused as the source for registry overlays, diagnostics, routing, or probe
   scheduling.

## Implemented Provider Health Probe Lease Completion Fence Slice

Provider Health probe workers now revalidate lease ownership before committing
route-affecting results.

Implemented behavior:

1. Probe completion locks the attempt row and verifies the same non-expired
   worker lease before writing workspace `probe_result` health state/event
   history or terminal attempt evidence.
2. Probe failure uses the same lock/lease fence before scheduling retry or
   dead-letter evidence.
3. If a stale worker tries to complete or fail after another worker has
   re-acquired the expired attempt, the model returns the current attempt row
   without mutating Provider Health overlays, retry state, or failure evidence.

## Implemented Provider Health Probe Attempt Counter Fence Slice

Provider Health probe workers now also compare the attempt counter they leased
before committing terminal or retry evidence.

Implemented behavior:

1. Probe completion treats a row as current only when status, lease id,
   non-expired lease time, and attempt count still match the worker snapshot.
2. Probe failure uses the same attempt-aware fence before scheduling retry or
   dead-letter evidence.
3. The conditional terminal updates include `attempt_count`, so an in-memory
   worker whose attempt snapshot drifted under the same lease id fails closed
   before writing Provider Health state, retry state, failure diagnostics, or
   terminal probe evidence.
4. Focused coverage simulates same-lease attempt counter drift and verifies the
   stale completion/failure paths return the current processing row without
   publishing health or failure evidence.

## Implemented Provider Health Probe Terminal Snapshot Fence Slice

Provider Health probe terminal and retry writes now compare the full locked
attempt row snapshot instead of only the lease id and attempt counter.

Implemented behavior:

1. Probe completion requires the locked attempt's provider/revision identity,
   workspace/actor scope, provider-profile snapshot/fingerprint, request
   fingerprint, status, attempt/max-attempt counters, scheduled time,
   worker-lease timestamps, result/failure fields, health-state linkage,
   creation time, and update time to still match before writing `completed`
   evidence.
2. Probe failure uses the same full-row predicate before clearing the lease and
   writing retry-scheduled or dead-lettered failure evidence.
3. If any attempt-row evidence changes under the same live lease and attempt
   counter after the worker lock/read, terminal writes fail closed with the
   existing lease-changed error instead of overwriting the newer row state.
4. Focused coverage mutates `updated_at` under the same lock/lease/attempt
   snapshot and verifies both completion and failure leave the attempt
   processing without health-state, result, retry, or failure evidence.

## Implemented Provider Health Probe Attempt Visibility Slice

Provider Health probe attempts are now inspectable without direct SQL.

Implemented behavior:

1. `CopilotProviderHealthStateModel.listProviderHealthProbeAttempts` returns
   recent workspace-scoped `ai_provider_health_probe_attempts` rows with the
   same hydrated revision/profile/request/result/lease evidence as the single
   attempt lookup.
2. `Copilot.providerHealthProbeAttempts(limit)` exposes the bounded recent
   history after the normal workspace `Workspace.Copilot` permission check.
3. Common GraphQL adds a dedicated workspace query for recent probe attempts,
   and Admin renders status, provider/revision/profile/request fingerprints,
   actor, attempt counters, timestamps, result/state fingerprints, failures,
   and lease evidence beside model route diagnostics.

## Implemented Provider Health Probe Dead-letter Retry Slice

Provider Health dead-lettered probe attempts can now be retried without
rewriting terminal evidence.

Implemented behavior:

1. The retry model path accepts a dead-lettered workspace attempt, resolves the
   original active Provider Registry revision, verifies the revision id and
   fingerprint still match the terminal attempt, and enqueues a fresh probe
   attempt in a new short retry bucket.
2. The previous dead-lettered row stays immutable under the existing terminal
   content guard; retry creates a new queued row with a new request fingerprint
   and the same active revision/profile snapshot boundary.
3. GraphQL/common/Admin expose a retry mutation/control from the recent probe
   attempt list, so operators can replay dead-lettered no-network probes
   without direct SQL.

## Implemented Provider Health Probe Attempt Filtered Visibility Slice

Provider Health probe attempts are now searchable through the bounded
workspace read path instead of only through an unfiltered recent list.

Implemented behavior:

1. `CopilotProviderHealthStateModel.listProviderHealthProbeAttempts` accepts a
   constrained filter for status, provider id, provider registry revision id,
   revision/profile/request/result fingerprints, plus one bounded locator query
   that matches those same durable identity fields.
2. `Copilot.providerHealthProbeAttempts(filter, limit)` exposes the filter
   after the normal workspace `Workspace.Copilot` permission check while
   keeping the existing default `limit`-only behavior compatible.
3. Common GraphQL and Admin pass the filter through; Admin adds a status
   selector plus a provider/revision/fingerprint locator input so operators can
   locate completed, queued, retry-scheduled, processing, or dead-lettered
   attempts without direct SQL.
4. The filter stays exact-field and workspace-scoped; it is not a broad
   free-text scan or alerting workflow.

## Implemented Repair Source-chain Status Compatibility Slice

Registry repair preparation now preserves its pending-approval provenance
through the same model and database boundaries used by durable revision
publication.

Implemented behavior:

1. Task Route Policy and Model Registry repair payloads retain
   `prepared_for_approval` fallback source-chain entries instead of dropping
   them during model-layer normalization.
2. The matching PostgreSQL source-chain provenance constraints accept the same
   status through a forward migration, keeping direct SQL validation aligned
   with the model vocabulary.
3. Successful publish-gate model-route resolution carries the selected
   candidate's Model Registry revision and source-chain metadata, matching the
   existing unavailable/error result paths.
4. Focused repair and Registry coverage verifies the persisted source chain and
   resolver source-chain smoke verifies the successful route projection.

## Implemented Provider Health Optional Network Probe Slice

Provider Health probe attempts now support an opt-in real provider runtime
probe without changing the default no-network contract probe.

Implemented behavior:

1. `CopilotProviderHealthWorker` continues to run the local provider
   profile/runtime contract probe by default.
2. Setting `LOCALMIND_PROVIDER_HEALTH_NETWORK_PROBE=1` or
   `COPILOT_PROVIDER_HEALTH_NETWORK_PROBE=1` switches leased probe attempts to
   a real text-completion probe through the existing provider runtime host.
3. The network probe first reuses the local contract probe and skips external
   calls when the provider profile/runtime contract is already down or
   degraded.
4. Healthy contract probes execute a minimal text completion with workspace,
   actor, `featureKind='action'`, low token bound, zero temperature, and an
   abortable timeout.
5. Probe result metadata records `probeMode`, whether network probing was
   enabled, timeout evidence, error code, and diagnostics before publishing
   the same workspace `probe_result` Provider Health state/event history.

## Implemented Prompt Registry Body Edit API Slice

Prompt Registry now has a constrained body-edit preview/publish path layered
on the existing direct publish and publish-gate evidence.

Implemented behavior:

1. `previewCopilotPromptRegistryBodyEdit` resolves the current prompt registry
   record after workspace permission and publish-gate version checks, accepts
   a bounded message index and next content, and returns current/next content
   fingerprints, a bounded line diff, diff fingerprint, and preview
   fingerprint.
2. `publishCopilotPromptRegistryBodyEdit` requires the matching preview
   fingerprint before writing, so stale previews fail closed instead of
   mutating prompt body content.
3. Publishing updates the selected `ai_prompts_messages.content`, marks prompt
   metadata as modified, refreshes prompt timestamps, and writes a
   workspace-scoped Prompt Registry revision with editable-body metadata.
4. The mutation reuses the existing direct publish source-chain and event
   history path, so catalog diagnostics resolve the edited workspace revision
   before legacy/config fallback.

## Implemented MCP Search Runtime Compatibility Repair

Public MCP search now preserves its advertised document-search behavior when
task routes use provider-default model selection or the optional full-text
indexer is disabled.

Implemented behavior:

1. Serializable embedding and rerank execution-plan requests now materialize
   the native contract's required `modelId` from the selected prepared provider
   route when Task Policy leaves provider selection implicit, keeping the plan
   contract aligned with the route that will execute.
2. Embedding route context such as `featureKind=embedding` and
   `featureKind=workspace_indexing` can therefore reach the existing native
   dispatch path instead of failing execution-plan JSON Schema validation
   before the provider call.
3. MCP `keyword_search` catches only the explicit no-search-provider condition
   and falls back to bounded-batch Markdown matching over the credential
   actor's permission-filtered readable document ids.
4. Workspace root/property documents that are readable but do not contain a
   Markdown block map are skipped during fallback scanning, while unexpected
   reader failures still fail closed.
5. The normal indexer path and its block-level ranking/highlights remain
   unchanged when a search provider is configured; unexpected indexer errors
   still fail closed.
6. The self-host Compose stack includes an internal-only Sparkclaw protocol
   adapter so embedding dimension compatibility and rerank score translation
   survive container and host restarts without exposing another public port.
7. Focused backend coverage reproduces the provider-default embedding/rerank
   contract and the no-indexer MCP keyword-search path.

## Remaining Work

- add Prompt Registry full audit/history views, richer diff/eval, and review
  UI around the constrained direct publish/body-edit path;
- add bulk migration from existing registry/config defaults where needed;
- add full editable Provider Registry workflows, credential management,
  credential rotation/validation UX, probe attempt alerting/advanced search
  workflows, and bulk migration where needed;
- add full editable Model Registry workflows, model diff/review UI, and bulk
  migration from provider profile/native registry defaults where needed;
- add full editable Task Route Policy workflows and bulk migration from config
  defaults where needed.
- add multi-model BYOK bindings or selectable OpenAI-compatible protocol
  families only when real provider contracts require them; the current slice
  deliberately keeps one tested model per key.

## Tests

Backend:

- resolves a workspace DB record before global/config fallback;
- preserves current behavior when DB record is missing;
- records revision/fingerprint/source-chain evidence deterministically;
- verifies repair approval creates a workspace revision through the constrained
  executor;
- verifies direct Prompt Registry publish writes reviewed workspace revisions,
  rejects stale or blocked publish gates without writing rows, reuses matching
  revisions idempotently, drives catalog diagnostics from the published
  revision, and enforces workspace access;
- verifies workspace Task Route Policy revisions override config fallback for
  route diagnostics and runtime resolution;
- verifies approved repair execution creates a workspace Task Route Policy
  revision through the constrained queued executor;
- verifies Task Route Policy revisions stay workspace-scoped;
- verifies direct Task Route Policy publish writes workspace revisions, reuses
  matching revisions idempotently, drives route diagnostics from the published
  revision, and enforces workspace access;
- verifies Model Registry workspace revisions override global/provider fallback
  for model diagnostics;
- verifies approved repair execution creates a workspace Model Registry
  revision through the constrained queued executor;
- verifies publish-gate model route diagnostics resolve from the published
  Model Registry revision;
- verifies direct Model Registry publish writes sanitized model definitions,
  rejects unknown providers, reuses matching revisions idempotently, and drives
  route/model diagnostics from the published workspace revision;
- verifies Provider Registry workspace revisions override global/config
  provider metadata for model diagnostics;
- verifies Provider Registry revisions stay scoped to the selected workspace
  and fall back to global revisions elsewhere;
- verifies Provider Health State row constraints reject unknown status/source
  values, contradictory scope/workspace pairs, non-object metadata, blank
  provider identity strings, blank provider last-error diagnostics, and blank
  fingerprint evidence at the database boundary;
- verifies Provider Health State row constraints reject impossible
  `updated_at < checked_at` timestamp ordering before freshness overlays or
  stale cleanup consume malformed health evidence;
- verifies Provider Health State metadata constraints reject missing metadata
  versions and source/publish-source drift at the database boundary, while
  model writes preserve reserved metadata fields over caller-supplied extras;
- verifies Provider Health cleanup metadata constraints reject configured
  snapshot rows without provider profile evidence, configured snapshot cleanup
  rows without previous fingerprint evidence, stale probe cleanup rows with
  source drift, stale probe cleanup rows without `probeResultMaxAgeMs`, and
  whitespace-padded current-version metadata that omits required cleanup
  evidence;
- verifies Provider Health event history records manual overrides, configured
  snapshots, workspace probe results, configured snapshot cleanup, and stale
  probe cleanup, and rejects event rows whose event type drifts from source or
  publish-source evidence, missing state id, orphan state id, or state identity
  snapshot;
- verifies Provider Health event insert conflicts are read back and rejected
  when the deterministic event id is reused with drifted event metadata or
  event evidence;
- verifies Provider Health mutation responses expose `eventCount` plus recent
  event evidence for manual health transitions in newest-first order;
- verifies registry revision publish events record direct publish and
  idempotent reuse history across Prompt Registry, Task Route Policy, Model
  Registry, and Provider Registry writers, and reject malformed metadata,
  coherent publish-event content/fingerprint rewrites, child revision snapshot
  drift, nullable workspace actor drift, or parent revision snapshot edits at
  the database boundary;
- verifies stale Prompt Registry and Provider Registry publish-event writers
  fail closed before appending new history when the hydrated parent revision
  snapshot no longer matches persisted content, fallback source-chain,
  metadata, or update-time evidence;
- verifies direct Prompt Registry publish events use the parent revision
  creation timestamp for `revision_published` history while later
  `revision_reused` history remains ordered after the published anchor;
- verifies a Prompt Registry publisher whose pre-read misses an already
  inserted matching revision records insert-conflict reuse as
  `revision_reused`, leaving a single `revision_published` anchor;
- verifies direct publish GraphQL responses and direct model publish/reuse
  returns expose `publishEventCount` plus recent publish/reuse event evidence
  across Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry revisions;
- verifies prompt catalog/Admin diagnostics expose bounded Prompt Registry
  publish/reuse event history on DB-backed prompt revisions;
- verifies Admin model/task-route diagnostics expose bounded Model Registry and
  Task Route Policy publish/reuse event history while keeping source
  fingerprints unchanged;
- verifies direct Provider Registry publish writes sanitized profile metadata,
  rejects unknown providers, reuses matching revisions idempotently,
  immediately enqueues a durable Provider Health probe attempt, and drives
  route/model diagnostics from the published workspace revision;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry revision row conflicts are read back and rejected when a same-scope
  unique key reuses a row with drifted metadata or content evidence in direct
  or repair-driven publish paths before publish history, route overlay, or
  Provider Health probe enqueue can proceed;
- verifies active workspace registry revisions with current publish-source
  metadata require matching durable `revision_published` history at commit
  time, idempotent `revision_reused` events require an existing publish anchor,
  and published anchors cannot be deleted while parent/reuse evidence remains;
- verifies approved repair execution creates a workspace Provider Registry
  revision through the constrained queued executor, immediately enqueues a
  durable Provider Health probe attempt, and drives model diagnostics from the
  published sanitized provider profile;
- verifies persisted Provider Health State overlays route health, removes `down`
  providers from available model routes, restores routes when state returns to
  `healthy`, and enforces workspace access;
- verifies configured provider health snapshots are persisted as global
  DB-backed probe results and drive route diagnostics through the existing
  provider registry overlay;
- verifies stale configured provider health snapshot rows are cleared to
  `unknown` when the worker no longer sees configured health metadata for that
  provider;
- verifies stale automatic provider health probe results are ignored by the
  route overlay freshness guard, then durably cleared to `unknown` by the
  provider health worker without changing manual overrides;
- verifies Provider Health state updates require matching durable event
  history at commit time, so direct SQL cannot insert or rewrite
  route-affecting overlay status/fingerprint evidence without an append-only
  event row;
- verifies Provider Health workspace and global configured-snapshot upserts
  overwrite rows inserted after a missed pre-read, keep the existing state id,
  and append matching current-state event history instead of returning stale
  health evidence;
- verifies repair execution worker retries can complete after a matching
  durable registry side effect already exists and fail when an existing
  same-scope side-effect revision has a different fingerprint;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry fallback source-chain normalization drops unknown provenance
  source/scope/status values before persistence;
- verifies malformed optional source-chain metadata on otherwise trusted
  provenance entries is dropped before persistence;
- verifies oversized fallback source-chain lists are bounded to the first 16
  valid provenance entries before persistence;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry repair executor payload strings are trimmed, deduplicated where
  list-shaped, bounded before persistence, and rejected without writing a row
  when required durable fields are overlong;
- verifies direct publish inputs for all four registry families are normalized
  at the model boundary, and overlong direct publish fields are rejected
  without writing rows;
- verifies persisted registry metadata is size-checked before insertion,
  repair-wrapper identity fields are normalized before row/fingerprint writes,
  and provider direct-publish idempotency fingerprints use normalized identity
  inputs;
- verifies current-version Prompt Registry, Task Route Policy, Model Registry,
  and Provider Registry metadata cannot pair direct-publish versions with
  repair worker sources at the database boundary;
- verifies current-version Prompt Registry, Task Route Policy, Model Registry,
  and Provider Registry repair-executor metadata cannot drop repair request,
  approval, operation, target locator, or candidate evidence fields at the
  database boundary;
- verifies malformed persisted Provider Registry profile JSON hydrates through
  a bounded safe profile, strips config, restores trusted provider identity,
  and filters invalid persisted model definitions;
- verifies malformed persisted Model Registry definition JSON hydrates through
  the bounded sanitizer, restores trusted row model identity, and drops
  unknown fields before route/model consumers see it;
- verifies automatic Provider Health probe attempts are queued from active
  workspace Provider Registry revisions into `ai_provider_health_probe_attempts`,
  bind the revision id/fingerprint plus sanitized provider-profile snapshot,
  lease through a worker, run a no-network local provider profile/runtime
  contract probe, and publish the result through existing workspace
  `probe_result` Provider Health state/event history;
- verifies Provider Health probe enqueue rejects a request-fingerprint
  conflict row whose provider-profile evidence does not match the computed
  enqueue request;
- verifies Provider Health probe enqueue fails closed before writing queued
  probe evidence when the active parent Provider Registry revision row no
  longer matches the raw provider profile, fallback source-chain, metadata, or
  timestamp snapshot used by the enqueue request;
- verifies stale Provider Health probe workers cannot publish route-affecting
  health state or retry evidence after a later worker re-acquires the attempt
  lease;
- verifies completed Provider Health probe attempts retain result metadata,
  provider health state fingerprint, worker attempt evidence, and immutable
  terminal evidence, while malformed SQL writes with revision snapshot drift,
  invalid state shape, or terminal result mutation are rejected at the
  database boundary;
- verifies GraphQL exposes recent Provider Health probe attempts with
  revision/profile/request/result/state fingerprints, profile snapshot,
  actor, attempt counters, terminal timestamps, and lease evidence;
- verifies GraphQL filters Provider Health probe attempts by terminal status,
  registry revision id, and bounded provider/revision/fingerprint locator
  query without leaving the workspace-scoped read path;
- verifies retrying a dead-lettered Provider Health probe attempt creates a
  fresh queued attempt while preserving the original terminal row evidence;
- verifies optional Provider Health network probing is disabled by default,
  can be enabled through the documented environment flags, calls the provider
  runtime network probe path with workspace/actor/timeout evidence, and
  persists `probeMode=network_text_completion` metadata on completed attempts;
- verifies Prompt Registry body edit preview returns bounded diff and
  fingerprint evidence, publish requires the matching preview fingerprint,
  updates the selected prompt message body, records modified metadata, and
  writes an editable-body DB-backed prompt registry revision;
- verifies Model Registry and Provider Registry row constraints reject unknown
  revision `scope_type` and `status` values at the database boundary;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject global revisions with workspace ids and
  workspace revisions without workspace ids at the database boundary;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject malformed `fallback_source_chain` and
  `metadata` JSON shapes at the database boundary;
- verifies Model Registry and Provider Registry row constraints reject
  malformed `model_definition` and `provider_profile` JSON payload shapes at
  the database boundary;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject malformed revision strings at the database
  boundary;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject blank required identity strings at the
  database boundary without constraining readable fingerprint values;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject blank revision fingerprints at the database
  boundary without constraining readable fingerprint values;
- verifies Task Route Policy row constraints reject blank persisted config
  key/path metadata at the database boundary while preserving null config
  metadata for rows without config provenance;
- verifies Provider Registry row constraints reject blank present provider
  type metadata at the database boundary without freezing provider type
  semantics in SQL;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject impossible `updated_at < created_at`
  timestamp ordering at the database boundary;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject malformed fallback source-chain provenance
  entries at the database boundary;
- verifies Prompt Registry, Task Route Policy, Model Registry, and Provider
  Registry row constraints reject malformed fallback source-chain optional
  metadata fields at the database boundary;
- verifies prompt-registry repair execution payloads persist a valid
  `legacy_registry` fallback source-chain entry using the publish-gate
  `publishStatus`, so blocked repair flows do not lose legacy provenance when a
  workspace-scoped DB revision is written;
- enforces workspace access.

Frontend/Admin if changed:

- displays registry source;
- displays revision and status;
- distinguishes DB-backed records from legacy registry and config fallback;
- displays DB-backed Task Route Policy source-chain evidence.
- displays DB-backed Model Registry source-chain evidence.
- displays DB-backed Provider Registry source-chain evidence.
- displays recent Provider Health probe attempt evidence.
- filters recent Provider Health probe attempt evidence by status and
  provider/revision/fingerprint locator.
- displays a Provider Health probe dead-letter retry control and the fresh
  queued retry attempt evidence.

## Non-goals For First Slice

The inbound MCP surface no longer exposes direct registry tools. A future
LocalMind AI registry executor must use the existing preview, approval,
revision, publish-event, and Provider Health model paths; it must not accept raw
provider credentials, BYOK secret writes, or arbitrary registry mutation.

- full registry editor;
- bulk migration UI;
- richer prompt body eval/review UI beyond the backend preview/publish API;
- provider secret management;
- provider credential testing and operational alerting beyond the optional
  runtime network health probe path.
