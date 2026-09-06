# Track: Context Memory

## Intent

Make Rule, Automatic Memory, rolling conversation summaries, and cross-session
recall scope-correct, permission-aware, trust-separated, and auditable before
adding more sophisticated extraction or retrieval.

## Implemented Foundation

The [stage-two acceptance](project-ai-boundaries.md#stage-two-progress-on-2026-09-06)
extends the session ledger to prompt, user-message, tool and recalled-memory
sources, exact original Project grants, content fingerprints and immutable
shared-write authorization audits. Legacy empty sessions also fail closed.
Regrant does not revive old conversation sources. Automatic Project Memory
decisions require a source session and recheck cumulative evidence even for
replay and no-op. Document checks now include the destination's potential
Workspace/direct-grant/other-Project audience. Ordinary conversation writes
cannot share their private inputs: they require an actor-only destination;
location confirmation does not upgrade source authority. Ordinary messages,
prompts, Rules, recalled memories and tool outputs accumulate source evidence.
Delegated planners retain source IDs and a private context fingerprint in their
bound execution session, including direct document-update plans. Auxiliary
PromptRuntime calls record their owned-session prompt fingerprint. Office
single/batch commands and shared directory writes hold source authority through
persistence; their rejected transactions retain source audits. The production
MCP surface exposes delegation/query/cancellation only; inactive legacy
factories must be audited before re-exposure. Business now runs 335 migrations
after backed-up synchronization. Stage-two browser/transport acceptance passed;
see the authority document's source/sink inventory. Recovered delegated tool
receipts carry their revalidated results in structured message content because
native prompt projection does not consume UI-only stream objects. No recovered
receipt changes its original session source authority.

Current project selection rules are defined in
[Project AI Boundaries](project-ai-boundaries.md) and supersede the historical
v5 inference rules below. Project conversations use an explicitly selected,
active Project with current membership. Document-side conversations do not
inherit project grants or infer project memory from attached documents.
Generic semantic retrieval limits SQL candidates to personal ACL before
reranking; explicit project retrieval uses the server-resolved Project and
authorized source document IDs, then rechecks the scope before returning.
Conversation forks cannot transfer private or project history between users,
execution Workspaces, or Projects. Context GraphQL reads and mutations verify
live ownership, session deletion, Project membership/status and document-side
personal read permission before using cached attachment configuration.
Prompt preparation and personal semantic attachment search use the same owned
session lookup; attachment tools refresh that authorization and context on each
execution, including after attachments are removed.
Automatic project-memory capture also excludes private file/blob attachments,
invalid context configuration and any attached document outside current Project
grants, even if the actor can no longer read that document. Append-only session
source rows retain document references and private-attachment markers after
context clearing/removal and across forks. Legacy message history and source
overflow retain an unknown-source marker. The stage-two inventory above
supersedes the earlier partial message/tool provenance checkpoint; browser and
transport recovery evidence remains separately tracked from source enforcement.

LocalMind already persists private user-owned context records with user,
workspace, document, or project scope. Users can manage these records and the
Automatic Memory preference under **Workspace settings > AI context**.

The `context-planner/v5` slice adds the first production hardening layer:

- a single scope resolver combines the conversation's primary document with
  documents attached through AI Context;
- every candidate document is rechecked with `Doc.Read` before it can affect
  document or project memory visibility;
- active project membership is derived only from those readable documents;
- project context is enabled only when every readable document resolves to the
  same single active project;
- mixed, multi-project, and otherwise ambiguous document sets load no project
  memory;
- Automatic Memory writes to one unique project, one readable document, or the
  workspace only when no document is in scope;
- Automatic Memory capture is skipped when multiple readable documents do not
  resolve to one project, instead of copying into multiple projects or widening
  the record to workspace scope;
- the same resolved scope snapshot is used for recall and capture in a turn.

Planner v5 renders Rule, Automatic Memory, project summaries, and rolling
conversation summaries as a bounded synthetic `user` message immediately before
the latest user turn. This context is explicitly labeled untrusted and is no
longer coalesced into the primary system message. The immutable v1-v4 strategy
versions and fingerprints remain available for replay.

Every planned text turn now appends an `ai_context_plan_traces` record when the
session saves. A trace contains:

- strategy version and fingerprint;
- input, retained, omitted, candidate, and selected counts;
- selected memory ids, scope/kind, score, and rank;
- context character budget and usage;
- resolved document/project scope evidence;
- input and rendered-output fingerprints.

The trace intentionally excludes message, Rule, Memory, project summary, and
rolling summary text. AI Context strategy diagnostics expose aggregate trace
count and latest trace time without exposing per-turn private context.

The `context-planner/v6` slice builds the commercial-memory foundation on that
trust and scope boundary:

- the Memory Writer produces explicit `ADD`, `UPDATE`, `DELETE`, and `NOOP`
  decisions, with deterministic handling for direct remember/forget requests;
- memory rows carry fact keys, confidence, importance, validity and expiry,
  sensitivity, supersession, embedding, use count, and last-used evidence;
- each owner/scope retains at most 200 active Automatic Memory rows, evicting
  the least recently used rows when a write would exceed the quota;
- a disabled memory can be reactivated without violating the active-fact
  uniqueness contract or leaving conflicting active versions;
- authorized candidates are ranked with keyword and embedding similarity,
  temporal/confidence features, reranking, and MMR diversity;
- durable memory embeddings share the instance-wide 4096-dimensional
  embedding contract; the dimension migration retains memory text and scope
  while invalidating only incompatible legacy vectors, and the bounded
  embedding backfill restores eligible workspace-scoped memories;
- Rule is modeled independently with `always`, `relevant`, and `manual`
  application modes, priorities, conditions, immutable revisions, rollback,
  and hit records;
- workspace-enforced Policy is a separate layer from private user Rule and
  Automatic Memory;
- ambiguous document sets support an explicit project selection that is
  validated against the readable resolved scope;
- users can inspect, edit, disable, delete, undo, revise, and roll back the
  relevant context records from **Workspace settings > AI context**;
- the v6 evaluation smoke records extraction, DLP, retrieval, scope leakage,
  Rule interference, conflict priority, and latency metrics.

## Scope Contract

| Readable context                          | Project result | Recall/capture behavior                                                                           |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| No document                               | `none`         | User Rule plus workspace memory; new Automatic Memory may use workspace scope                     |
| One unassigned document                   | `none`         | User Rule, workspace memory, and that document's memory; new Automatic Memory uses document scope |
| One or more documents, all in one project | `single`       | User, workspace, document, and that one project scope; new Automatic Memory uses project scope    |
| Project and unassigned documents mixed    | `mixed`        | No project memory; multi-document Automatic Memory capture is skipped                             |
| Documents span multiple projects          | `ambiguous`    | No project memory; multi-document Automatic Memory capture is skipped                             |
| Document fails `Doc.Read`                 | excluded       | It cannot contribute document/project recall or capture scope                                     |

Without an explicit project selection, ambiguous cases still fail closed.
Selections are accepted only when the project is represented by the current
readable document set; an invalid or stale selection cannot widen visibility.

## Current Limits

The v6 foundation still has follow-up work before broad production rollout:

- implicit Automatic Memory extraction remains heuristic when no configured
  structured model extractor is available;
- DLP is intentionally fail-closed for known sensitive forms but is not a full
  enterprise classifier;
- local deterministic embeddings and reranking provide a stable fallback, but
  production Sparkclaw embedding/reranker quality and cost still require online
  evaluation;
- rolling summaries are heuristic rather than model-generated structured
  summaries;
- traces support replay diagnostics but do not yet join answer-quality,
  user-feedback, and online experiment outcomes;
- scheduled expiry cleanup and large-corpus query performance still need
  production load validation beyond the write-time per-scope LRU quota.
- existing memories whose legacy vectors were invalidated continue to use
  lexical recall while the bounded 4096-dimensional backfill is pending or the
  configured embedding provider is unavailable.

## Next Vertical Slices

1. Replace heuristic implicit extraction with a configured structured model
   extractor while preserving the deterministic explicit-command path.
2. Add scheduled lifecycle cleanup and production-scale retrieval/load
   benchmarks around the existing per-owner/scope quota.
3. Connect Sparkclaw embedding/reranker providers behind the existing hybrid
   retrieval interfaces and add shadow evaluation before rollout.
4. Join planner traces with explicit user correction/undo and answer-quality
   outcomes without persisting sensitive prompt content.
5. Add model-generated structured rolling summaries with provenance and
   conflict-safe refresh.
6. Add strategy shadowing, staged rollout, and online A/B controls after offline
   baselines are representative and benchmark-specific production rules are
   prohibited.

Do not introduce a knowledge graph before fact keys, temporal versioning, and
the evaluation suite show that multi-entity or multi-hop relations require it.

## Validation

Project tool reads and search results record cumulative source Workspace/document
pairs before content is returned to the model. Existing-document project writes
check that ledger both when requested and inside worker execution. Project
memory writer decisions with a source session recheck the ledger in the memory
transaction, including active owned project conversation membership. Private
attachments, unknown evidence and ungranted document sources reject the write.
The transaction also merges cumulative document sources into memory source
associations, so later grant revocation quarantines memories derived from sources
discovered after initial scope resolution. Empty or rejected scope never falls
back to a broader project-memory scope. Generated-document operations that
request addition to the current Project also recheck this ledger during location
confirmation and each execution revalidation. Independent snapshot copies use
their separate source copying/sharing authorization checks. This does not yet
establish complete provenance for all prompt inputs or all shared destinations;
document storage writes still lack an atomic authorization fence.

The inbound MCP surface no longer exposes direct AI Context tools. A future
LocalMind AI Context executor must use this track's DLP, scope authorization,
revision, rollback, and undo behavior instead of creating a parallel mutation
path.

The focused contract must cover:

- an attached project document resolving project memory outside a
  document-bound chat;
- revoked document permission excluding that document and its project;
- mixed and multi-project inputs loading no project memory;
- ambiguous multi-document inputs producing no Automatic Memory write unless a
  valid explicit project is selected;
- Planner v5 placing private context in `user`, not primary `system`;
- v4 replay preserving the previous system-context behavior and fingerprint;
- v6 fact-key conflict updates, expiry, supersession, reactivation, and undo;
- v6 Rule/Policy application modes, condition matching, priority, revisions,
  rollback, and hit traces;
- v6 authorized hybrid retrieval, MMR diversity, and scope leakage of zero;
- plan traces containing ids, scores, budgets, scope, and fingerprints without
  private context text;
- native-renderer baselines using natural durable cues for short retention,
  early/recent fact retention, rolling-summary creation, and cross-session
  recall under tight budgets.

Run the isolated Copilot typecheck, GraphQL generation, format/lint checks,
host scope/v6 smokes, Docker-focused Copilot tests, native v6/v5/v4 baselines,
and a disposable PostgreSQL migration check for changes to this track.
