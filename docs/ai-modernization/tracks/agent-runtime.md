# Track: Agent Runtime State

## Intent

Build the durable runtime state needed for office task execution.

The target is not a better chat transcript. The target is a task execution
system with runs, steps, approvals, resumability, tools, evidence, and audit.

## Current Problem

The [stage-two acceptance](project-ai-boundaries.md#stage-two-progress-on-2026-09-06)
adds immutable source checks to Project document workers, approval preparation,
creation/copy confirmation, retries and no-op paths. Checks retain original
document-grant identity and survive a rejected write transaction. Destination
audience evidence rejects broader sharing. External `waiting_for_location`,
session/operation bindings, immutable tool checkpoints and periodic recovery
are implemented with Linux lifecycle and queue-outage tests. Human confirmation
stores the selected revision, actor, permission evidence and expiry; MCP cannot
submit it. Automatic recovery skips cancelled runs and isolates per-request
conflicts; manual resume updates the external request in the run transaction
and rejects withdrawn operations or inactive credentials. Office and directory
AI writes now check cumulative sources through persistence, with document
broadcasts deferred until successful transaction commit. The business runtime
has been backed up and synchronized to 335 migrations. Encrypted-BYOK task
`fc65e3e2-005e-499d-bd05-340add3cf842` retained waiting/zero creation over a
backend restart and completed after explicit browser Workspace/root selection.
Revision advanced once, only one document was created, and MCP returned its
actual destination Workspace. Recovered tool receipts use structured nonempty
message content so native prompt projection retains prior execution results.
The real Redis and browser notification fault matrix also passed.

The [Project AI Boundaries](project-ai-boundaries.md) contract adds
durable document creation/copy operations with explicit storage destinations,
stable destination IDs, conditional leases and separate creation/project-add
receipts. Pending location selection is not an applied side effect or successful
task completion. Storage callbacks hold authorization through the actual update
insertion; completed creations and placement recover independently. Waiting
operations release worker leases and resume from durable tool-call identities.
These operations do not
grant AI authority to create Projects, manage membership or approve requests.

Action run diagnostics and prepared-route traces are available, but they are not
a general Agent Runtime. The first durable slice now adds real run/step/timeline
persistence for prompt registry repair execution. Later slices add a generic run
creation API, standalone cancel/resume control, and a DB-backed worker lease
path that consumes queued standalone runs. Broader task execution is still not
covered:

- the inbound MCP planner can now choose a direct answer, optimized document
  replacement, or the bounded LocalMind AI Chat tool-agent workflow, but there
  is still no generic planner for non-chat office domains;
- the first production model adapter
  (`agent_runtime_model_completion`) now executes persisted model steps
  through the DB-routed prompt/provider stack;
- the production document adapter (`agent_runtime_doc_update`) executes an
  approval-gated workspace document update with durable side-effect evidence,
  and the new `agent_runtime_localmind_tool_agent` adapter executes the full AI
  Chat server-side tool set for credential-authorized MCP delegation; broader
  Codex/MCP/handoff and non-chat-domain planner execution remains out of scope.

The adjacent AI Chat tool loop now preserves `appendMessages` when its runtime
wrapper adds provider route context. This fixes `doc_compose` losing the user's
document brief and generating unrelated content. The compose tool remains a
preview-only prompt tool; saved self-hosted chat writes use the existing
permission-checked `doc_create`, `doc_update`, and `doc_update_meta` tools. This
path does not create an AgentRun and must not be treated as durable Agent Runtime
execution evidence.

## First Vertical Slice

Status: implemented, with independent GraphQL/Admin observability added after
the initial repair-execution-linked runtime slice.

The first durable slice introduced a minimal persisted run/step/timeline model
and connected prompt registry repair execution. Repair execution approval
decisions now synchronize terminal Agent Runtime state, including the first
approved Prompt Registry revision side-effect summary.

Implemented behavior:

1. Create or reuse an agent run record for a persisted repair execution
   request.
2. Create a repair execution step record.
3. Persist `waiting_approval` or completed safe no-op status based on the
   repair execution state.
4. Persist sanitized timeline events.
5. Link target/evidence fingerprints to the run and step.
6. Return run detail through the repair execution mutation response.
7. Show run/step/timeline status in Admin.
8. Update linked run, step, and timeline records when a repair execution is
   approved or rejected.
9. Record approved side-effect kind, record id, and fingerprint in the linked
   step output and timeline payload when a Prompt Registry revision is
   published.
10. List recent persisted AgentRun records through workspace-scoped GraphQL
    outside the repair execution mutation response.
11. Read an AgentRun detail by id with steps and timeline events through
    workspace-scoped GraphQL.
12. Show recent persisted AgentRun/AgentStep/timeline state in Admin as a
    standalone Agent Runtime status card.
13. Create generic AgentRun records with persisted tool, Codex, MCP, handoff,
    model, or approval steps through an internal model API.
14. Reuse existing runs by workspace/source type/source id for idempotent
    adapter ingestion, including the insert-conflict path where concurrent
    callers both miss the pre-read and one loses the workspace/source unique
    key race.
15. Cancel or resume standalone AgentRun records through a permission-checked
    GraphQL/Admin control path without bypassing repair-execution state.
16. Persist standalone AgentRun queued/lease/attempt metadata.
17. Schedule and run a DB-leased standalone Agent Runtime worker.
18. Consume queued standalone runs into a durable `running` lease and explicit
    `failed` terminal state when no workflow adapter exists yet.
19. Requeue resumed standalone runs by adding a targeted worker job.
20. Keep repair-execution-linked AgentRun rows excluded from the standalone
    worker so repair execution remains the source of truth for approval,
    leases, retries, and audit.
21. Recover expired standalone worker leases through a scheduled system job.
22. Requeue recovered standalone runs with attempts remaining and fail them
    durably with `stale_worker_lease` when attempts are exhausted.
23. Record stale-lease recovery in Agent Runtime timeline payloads and active
    step output summaries.
24. Re-enqueue durable queued standalone AgentRun rows through a scheduled
    bounded worker so dropped targeted jobs do not leave queued runs stranded.
25. Complete explicit `agent_runtime_record_only` standalone workflows through
    a DB-leased worker adapter that records completion evidence without external
    tool, Codex, MCP, or model side effects.
26. Transition active standalone steps to `running` when the worker lease is
    acquired, append per-step worker lease timeline events, and persist lease
    evidence in step output summaries before adapter-specific completion or
    failure.
27. Dispatch standalone worker execution through a workflow adapter registry,
    with `agent_runtime_record_only` registered as the first durable adapter and
    unsupported workflows still failing through `unsupported_agent_runtime_adapter`.
28. Require workflow adapters to declare supported step types and side-effect
    mode, and fail leased runs with
    `unsupported_agent_runtime_adapter_contract` before adapter execution when
    the persisted steps exceed that contract.
29. Validate workflow adapter registration metadata up front, including the
    capability contract version, known side-effect mode, known step-type
    vocabulary, non-empty supported step list, and non-empty capability
    summary, with explicit runtime shape checks before trimming or iterating
    malformed adapter fields.
30. Project repair execution side-effect rollback contracts into linked Agent
    Runtime step output and timeline payloads as
    `sideEffectRollbackContract`, so run detail surfaces the same forward-only
    recovery contract persisted on the repair execution runtime result.
31. Persist structured standalone worker adapter-resolution metadata for both
    unsupported workflow and unsupported adapter-contract failures, including
    requested step types, unsupported step types when applicable, and sanitized
    registered adapter capability snapshots.
32. Catch registered workflow adapter execution exceptions after the run is
    leased, persist a terminal
    `agent_runtime_adapter_execution_failed` failure, clear the lease, and
    store structured `adapterResolution.status=execution_failed` metadata.
33. Normalize standalone worker failure messages before durable persistence, so
    blank messages use a deterministic fallback and overlong adapter exception
    messages are bounded in run rows, step output summaries, and timeline
    payloads.
34. After a registered adapter returns successfully, re-read the leased run and
    fail it immediately with `agent_runtime_adapter_incomplete_execution` when
    the adapter left the run `running` under the same worker lease.
35. When an adapter throws after it already released the lease by moving the
    run to a terminal state, preserve that terminal state instead of attempting
    to write a second worker failure against a cleared lease.
36. Normalize and bound generic standalone run creation inputs before durable
    persistence, including workflow/source ids, titles, step keys, step types,
    step statuses, step order, target/evidence JSON, and step output summary
    JSON.
37. Normalize manual standalone control reasons and record-only completion
    summaries before copying them into step output summaries and timeline
    payloads.
38. Bound standalone worker failure codes and adapter-resolution JSON before
    persisting failed run rows, step output summaries, and timeline payloads.
39. Bound workflow adapter registration names and summaries, require executable
    adapter functions, cap the registered adapter count, and freeze stored
    capability snapshots so later in-process mutation cannot change worker
    adapter-resolution evidence.
40. Hydrate persisted step output summaries and timeline payloads through a
    bounded JSON-object guard, and coerce malformed historical step summaries
    back to `{}` before appending worker/control metadata.
41. Fail registered adapters that return a non-promise executor result with a
    durable `agent_runtime_adapter_invalid_executor_result` failure and
    structured adapter-resolution metadata, keeping that separate from awaited
    adapters that simply leave the run leased.
42. Guard standalone manual cancel/resume, worker failure, and record-only
    completion with conditional updates so stale snapshots fail before writing
    step output summaries, timeline events, or resume worker jobs.
43. Store registered workflow adapters through an explicit allow-list shape
    (`workflow`, normalized `capabilities`, and `execute`) instead of spreading
    arbitrary adapter objects, so untrusted extra adapter or capability fields
    cannot leak into adapter-resolution diagnostics.
44. Validate Agent Runtime timeline status values at the model insert boundary
    and enforce the same vocabulary with a DB CHECK constraint on
    `ai_agent_timeline_events.status`.
45. Enforce standalone worker attempt counter shape in the database:
    non-negative `worker_attempt`, positive `worker_max_attempts`, and no
    attempt count greater than max attempts.
46. Enforce Agent Runtime run/step `completed_at` shape in model creation and
    database constraints: terminal statuses must carry completion timestamps
    and non-terminal statuses must not.
47. Enforce standalone worker lease evidence shape in the database: worker
    lease id and lease expiry must be populated together or absent together.
48. Enforce Agent Runtime run `queued_at` scheduler shape in the database:
    queued rows must carry queue ordering evidence, waiting-approval rows must
    not, and running/terminal rows may retain historical queue timestamps.
49. Enforce Agent Runtime run failure evidence pairing in the database:
    `failure_code` and `failure_message` must be absent together or present
    together, so direct writes cannot leave orphan failure diagnostics.
50. Enforce Agent Runtime run identity string shape in the database: workflow,
    source type, and source id must remain non-blank bounded strings, matching
    the model create boundary and protecting source-link idempotency.
51. Enforce Agent Runtime step identity string shape in the database: step keys
    must remain non-blank bounded strings, matching the model create boundary
    and protecting run-local step idempotency.
52. Enforce Agent Runtime step/timeline ordering shape in the database: step
    order must stay in the model-supported `0..10000` range and timeline
    ordinals must stay non-negative.
53. Enforce Agent Runtime persisted fingerprint string shape in the database:
    run target/evidence/timeline fingerprints, step evidence fingerprints, and
    timeline event fingerprints must remain non-blank bounded strings.
54. Enforce Agent Runtime display string shape in the database: optional run
    and step titles must be null or non-blank bounded strings, and timeline
    summaries must remain non-blank bounded strings.
55. Enforce Agent Runtime worker lease id string shape in the database:
    present lease ids must be non-blank bounded strings before scheduler,
    recovery, or compare-and-release paths depend on them.
56. Enforce Agent Runtime worker lease status shape in the database:
    non-running rows must keep lease fields null, while `running` rows may
    carry worker lease ownership evidence when controlled by the worker path.
57. Enforce Agent Runtime run/step timestamp coherence in the database:
    `updated_at` cannot precede `created_at`, and completed run/step rows
    cannot finish before their persisted start timestamp when both timestamps
    are present.
58. Enforce Agent Runtime source/workflow coherence in the model and database:
    `source_type=repair_execution_request` must use the repair execution
    workflow, and standalone workflows cannot masquerade as repair execution
    source rows.
59. Enforce standalone worker lease payload contracts in the database:
    compact step `workerLease` summaries must retain the worker executor,
    positive attempt count, lease id, and current step-lease version, while
    run/step timeline lease payloads must also retain workflow/source context,
    run-level lease expiry, and known step-type context for step events.
60. Enforce standalone record-only completion payload contracts in the
    database: step summaries and run/step timeline payloads must retain the
    current record-only version, executor, summary, worker attempt, lease id,
    `sideEffectsApplied=false`, and the expected run or step context.
61. Enforce standalone worker failure payload contracts in the database:
    failed step summaries and run/step timeline payloads must retain the
    current worker-failure version, bounded failure code/message, worker
    attempt, lease id, and the expected run or step context, while the nested
    adapter-resolution object remains covered by its dedicated contract.
62. Enforce standalone manual-control payload contracts in the database:
    manual step summaries must retain the current manual-control version,
    action, actor, and bounded reason, while cancel/resume timeline payloads
    must also retain matching action/status semantics, previous status,
    workflow/source context, and control timestamp.
63. Enforce standalone stale-lease recovery payload contracts in the database:
    step summaries and run timeline payloads must retain the current
    stale-recovery version, executor, reason, retry/next-status coherence,
    attempt counters, previous lease evidence, and timeline workflow/source
    context.
64. Enforce repair-execution-linked Agent Runtime payload contracts in the
    database: run timeline payloads must retain the current repair-run version,
    workflow/source/request context, request fingerprint, and repair-job
    fingerprint; repair step summaries and step timeline payloads must retain
    the current repair-step version, request id, approval state, granted
    permission status, runtime executor, side-effect mode, and the forward-only
    rollback contract including its reason when a side effect was applied.
65. Enforce Agent Runtime adapter-resolution capability contracts in the model
    and database: standalone failure metadata must retain registered adapter
    capability snapshots, registered-adapter failure payloads must retain the
    selected adapter snapshot, unsupported-contract payloads must retain
    unsupported step types, selected adapter snapshots must match a registered
    adapter, unsupported step types must be requested but not adapter-supported,
    and side-effect modes must stay in the current adapter capability
    vocabulary.
66. Persist standalone worker execution results in a dedicated DB ledger:
    terminal record-only completions, worker failures, and stale-lease terminal
    failures now write `ai_agent_runtime_execution_results` rows with
    run/workspace/actor snapshot coherence, workflow/source identity, adapter
    workflow, executor, result status, side-effect mode, side-effect-applied
    flag, summary, failure diagnostics when present, result payload/
    fingerprint, worker attempt, worker lease id, completion time, and
    workflow/source snapshot coherence with the parent run.
67. Expose standalone worker execution result ledger history through the
    existing AgentRun read surfaces: GraphQL AgentRun list/detail, repair
    execution mutation responses with linked AgentRun records, common GraphQL
    operations, and Admin now show `executionResultCount` plus recent terminal
    result rows with adapter, executor, status, fingerprint, attempt, lease,
    failure, and side-effect evidence.
68. Expose registered standalone workflow adapter capabilities through the
    existing Agent Runtime read surface: GraphQL now returns
    `agentRuntimeWorkflowAdapters` with workflow id, capability version,
    supported step types, side-effect mode, and summary from the same
    allow-listed registry snapshot used in durable worker failure metadata;
    common GraphQL operations and Admin show the registered capability set
    beside persisted AgentRun history.
69. Require step-level timeline history for Agent Runtime step inserts and
    lifecycle status/start/completion timestamp transitions at the DB boundary.
70. Add a generic leased worker completion primitive for registered standalone
    workflow adapters, backed by `adapterResolution.status=completed`, worker
    completion step/timeline payload contracts, and completed
    `agent_runtime_worker` execution-result ledger rows.
71. Register `agent_runtime_local_completion` as the first non-record-only
    no-side-effect adapter using that generic completion contract, so the
    worker can complete a local workflow without relying on the legacy
    record-only special case.
72. Change standalone `running` cancel semantics from immediate terminal
    mutation to a durable cooperative request: manual control appends a
    `run_cancellation` timeline event with `action=cancel_requested`, current
    worker lease id, and worker attempt while leaving the run `running`; the
    worker checks this request before adapter execution and then uses the
    existing terminal cancel path while it still owns the lease.
73. Re-lock standalone runs and confirm the same current non-expired worker
    lease before workflow adapter resolution or execution, so stale workers
    whose leases were recovered exit without invoking adapters or writing
    terminal worker failure/result evidence.
74. Consume standalone cancellation requests again after a workflow adapter
    returns but before the worker records an incomplete-adapter failure, so an
    adapter that cooperatively yields without writing a terminal result can be
    cancelled under the same worker lease/attempt instead of being misreported
    as `agent_runtime_adapter_incomplete_execution`.
75. Require standalone worker-owned adapter execution, record-only completion,
    generic completion, failure, and cooperative cancellation paths to carry
    the leased worker attempt explicitly and compare it with the current run
    row before terminal writes, so same-lease attempt drift cannot produce
    stale execution-result ledger, step-output, or timeline evidence.
76. Fence standalone manual cancel/resume step mutations against the child
    step status/completion snapshot read with the run, so step drift rolls the
    whole control transaction back before stale step summaries or step
    timeline events are persisted.
77. Fence standalone worker lease-acquisition evidence writes against the
    freshly hydrated run and active-step snapshots before appending worker
    lease timeline events, so run/step drift rolls the lease transaction back
    instead of persisting stale lease fingerprints or step summaries.
78. Fence standalone stale-lease recovery evidence writes against the hydrated
    expired run and active-step snapshots, and persist both run-level and
    step-level stale recovery timeline events so recovered/failed step state,
    timeline fingerprints, and durable history stay aligned.
79. Fence standalone running cancellation-request writes against the full
    originally read running run snapshot before appending `cancel_requested`
    timeline evidence, so same-lease run drift fails closed before a stale
    operator request mutates the timeline fingerprint or history.
80. Project standalone AgentRun records into an actor-scoped user Tasks API:
    `copilotTasks` and `copilotTask` derive the actor from the authenticated
    session, exclude repair-execution-owned runs, and expose bounded status,
    approval, step, result, artifact, failure, and available-action fields
    without returning raw runtime payloads.
81. Add the shared Web/Electron renderer Tasks workspace page with active,
    approval, and completed filters, five-second refresh, loading/empty/error
    states, task detail, steps, results, document artifacts, and
    approve/reject/cancel/resume controls. `controlCopilotTask` reuses the
    existing Agent Runtime approval/manual-control state transitions after the
    same workspace and actor checks; Electron adds only the shared-state icon
    contract and does not fork the product UI.

## State Model

Run statuses:

- `queued`;
- `running`;
- `waiting_approval`;
- `completed`;
- `failed`;
- `cancelled`.

Step statuses:

- `pending`;
- `running`;
- `waiting_approval`;
- `completed`;
- `failed`;
- `skipped`.

Add retry/rollback statuses only when real retry/rollback behavior is written.

## Tests

Backend:

- creates run and step records;
- applies status transitions;
- exposes sanitized timeline;
- links route evidence without leaking prompt/provider secrets.

Frontend/Admin if changed:

- renders run list or detail;
- renders step timeline;
- handles empty/error states.

Current focused coverage verifies that repair execution creates one AgentRun,
one AgentStep, and timeline events; idempotency reuse returns the same run; and
approval decisions update the run, step, and timeline to completed or cancelled
terminal states. Admin renders the durable run, step, timeline status, and
Prompt Registry revision side-effect summary. Additional focused coverage now
verifies independent AgentRun list/detail GraphQL access, workspace isolation,
authorization rejection, and Admin rendering for the standalone Agent Runtime
run list. User Tasks coverage verifies that two members of the same workspace
see only their own standalone runs, cross-actor detail reads return no task,
cross-actor controls are rejected, repair-execution runs remain excluded, and
approval, cancel, and resume actions reuse the persisted runtime state machine.
Frontend coverage verifies task filtering, control input construction, and
duplicate-action disabling; Web and Electron renderer builds consume the same
responsive Tasks page rather than separate client implementations. Backend
coverage also verifies generic Agent Runtime persistence for
tool, Codex, and MCP steps plus idempotent source reuse, including
insert-conflict source reuse after a pre-read miss, standalone run
cancel/resume control, repair-execution control-boundary rejection,
authorization rejection, standalone worker lease/failure persistence,
repair-execution worker isolation, and resume job enqueueing. Admin coverage
verifies standalone cancel controls, renders worker queue/lease metadata, and
keeps repair-execution-linked runs routed to repair execution controls.
Focused backend coverage also verifies scheduled stale-lease recovery for
standalone Agent Runtime runs, including requeue behavior, terminal stale lease
failure, targeted worker job enqueueing, timeline payloads, and active step
output summaries. Stale recovery coverage also verifies stale hydrated run or
step snapshots fail closed before recovery summaries, timeline events, or
execution-result ledger rows are written. Scheduled queued-run recovery
coverage verifies durable
queued standalone AgentRun rows get targeted worker jobs restored without
mutating run state. Record-only adapter coverage verifies a standalone queued
run can be leased, completed, have all active steps marked `completed`, clear
its lease, and persist `sideEffectsApplied=false` completion evidence. Generic
local-completion coverage verifies `agent_runtime_local_completion` flows
through the registered adapter path, writes worker completion step/timeline
payloads, persists a completed `agent_runtime_worker` result with
`adapterResolution.status=completed`, exposes that result through GraphQL, and
rejects completed adapter-resolution evidence inside failure payloads. Worker
lease coverage also verifies active standalone steps transition through
`running` with per-step lease metadata before unsupported-adapter failure or
adapter completion, and stale hydrated run or step snapshots now fail closed
before lease timeline events or step lease summaries are written.
Adapter-registry coverage verifies
`agent_runtime_local_completion` and `agent_runtime_record_only` are
registered, duplicate workflow adapters are rejected, malformed capability
metadata and runtime field shapes are rejected at registration, adapter
capability metadata is exposed, record-only execution flows through the
registered adapter path, and a registered adapter with an insufficient step
contract fails before its executor is called.
Repair-execution projection coverage now also verifies the forward-only
rollback contract is visible from the linked Agent Runtime step output and
completed model-step timeline payload. Standalone worker failure coverage now
verifies unsupported workflow and
unsupported-contract failures persist structured `adapterResolution` metadata
inside step failure output for follow-up UI and operator triage.
Repair-execution-linked sync coverage now verifies stale linked AgentRun or
repair step snapshots fail closed before the runtime mirror writes a new
timeline fingerprint, step output summary, or running timeline events.
Throwing-adapter coverage verifies registered adapter exceptions fail the run
and active step, clear the worker lease, persist
`adapterResolution.status=execution_failed`, and normalize blank or overlong
failure messages consistently across run state, step output, and timeline
payloads. It also verifies an adapter that throws after already failing and
releasing the run does not overwrite the existing terminal state. Cooperative
running cancel coverage verifies manual cancel on a leased standalone run
records `cancel_requested` timeline evidence, keeps the run leased until the
worker observes it, cancels before adapter execution, skips active steps, and
writes no terminal worker execution result. DB coverage also rejects malformed
running cancellation request payloads.
Adapter lease-fence coverage verifies that if a worker lease expires and is
recovered after the cancellation-request check but before adapter execution,
the stale worker does not call the registered adapter, write a terminal worker
execution result, or append completed-worker timeline evidence.
No-op adapter coverage verifies a registered adapter that returns without
completing, failing, cancelling, or releasing the leased run is converted into
an immediate terminal failure with
`adapterResolution.status=incomplete_execution`. Generic run creation coverage
now verifies trimmed workflow/source/step metadata, step-output version
hardening, idempotent reuse after normalization, and rejection of overlong,
unknown, or oversized durable inputs without writing run rows. Standalone
control coverage now verifies manual reason trimming and overlong reason
rejection, and record-only completion coverage verifies custom summaries are
bounded before persistence. Adapter registry hardening coverage now verifies
workflow and summary length caps, executable adapter requirements, registry
capacity limits, and immutable capability snapshots that cannot be mutated
through the original adapter object or through exposed capability metadata.
Hydration coverage now verifies legacy or manually malformed step
`output_summary` and timeline `payload` JSONB rows are normalized or preserved
only when they are object-shaped on readback, and worker lease updates append
metadata after first hydrating persisted step summaries through the bounded
object guard.
Timeline row-shape coverage now verifies invalid timeline status values are
rejected at the database boundary before they can enter run diagnostics.
Worker-attempt and worker-lease row-shape coverage now verifies malformed
attempt counters, orphan/blank lease evidence, and non-running lease ownership
evidence are rejected before they can affect standalone worker lease
eligibility.
Run/step timestamp-coherence coverage verifies direct AgentRun and AgentStep
writes cannot move `updated_at` before `created_at` or move terminal
`completed_at` before `started_at` before list/detail, worker recovery, or
timeline diagnostics observe impossible lifecycle history.
Completed-timestamp row-shape coverage now verifies run and step status drift
is rejected at the database boundary, and generic run creation sets step
completion timestamps from each normalized step status rather than the run
status alone. Queued-timestamp row-shape coverage verifies queued rows cannot
lose durable queue ordering evidence and waiting-approval rows cannot carry
queue evidence before standalone worker scheduling paths observe them.
Failure-field row-shape coverage verifies direct AgentRun writes cannot persist
orphan failure codes or orphan failure messages before diagnostics or worker
recovery paths observe them.
Failure-string row-shape coverage verifies direct AgentRun writes cannot
persist blank failure diagnostic strings before diagnostics or worker recovery
paths observe them.
Identity row-shape coverage verifies direct AgentRun writes cannot blank
workflow or source-link identity before list/detail, idempotency reuse, or
worker recovery paths observe them. Source/workflow coherence coverage now
verifies generic model creation and direct AgentRun writes cannot mix the
repair-execution source type with standalone workflows, or use the repair
execution workflow for standalone source rows, before standalone worker/control
routing observes malformed source-link evidence.
Step identity row-shape coverage verifies direct AgentStep writes cannot blank
run-local step keys before timeline, control, or worker recovery paths observe
malformed step identity evidence.
Ordering row-shape coverage verifies direct AgentStep order and AgentTimeline
ordinal writes cannot become negative before list/detail sorting, timeline
fingerprints, or worker recovery paths observe malformed ordering evidence.
Fingerprint row-shape coverage verifies direct AgentRun, AgentStep, and
AgentTimeline writes cannot blank persisted fingerprint evidence before
timeline integrity, diagnostics, or worker recovery paths observe malformed
rows.
Display-string row-shape coverage verifies direct AgentRun/AgentStep title
writes and AgentTimeline summary writes cannot become blank before detail
views, Admin diagnostics, timeline fingerprints, or worker recovery paths
observe malformed display evidence.
Step/timeline JSON-shape coverage now verifies non-object `output_summary` and
timeline `payload` writes are rejected at the database boundary before new rows
can depend on readback hydration to repair them.
Adapter executor-contract coverage now verifies a registered adapter that
returns a synchronous non-promise result fails closed with
`adapterResolution.status=invalid_executor_result`.
Standalone stale-update coverage now verifies manual cancel/resume, record-only
completion, and worker failure stop before writing manual-control,
record-only, worker-failure, or terminal timeline evidence when another
transition changes the run status after the initial read.
Adapter registry boundary coverage now also verifies untrusted extra fields on
registered adapter objects and capability objects are dropped before registry
storage or exposed capability snapshots can surface them.
Adapter-resolution contract coverage now verifies standalone worker failure
metadata must retain the current adapter-resolution version, known status
vocabulary, workflow identity, bounded requested step-type list, registered
adapter capability snapshots, selected adapter snapshots when applicable,
unsupported step types for contract failures, selected-adapter registration,
unsupported-step consistency, and known side-effect modes before it can be
persisted into failed step summaries or failure timeline payloads.
Worker-lease payload contract coverage now verifies real worker-generated
lease summaries and timeline payloads retain executor, attempt, lease id,
expiry, workflow/source, step key, and step type context, and direct writes
cannot persist malformed worker lease payloads before scheduler, diagnostics,
or recovery paths consume them.
Record-only payload contract coverage now verifies worker-generated completion
summaries and timeline payloads retain executor, summary, side-effect mode,
lease, run context, and step context, and direct writes cannot persist blank
summaries, side-effect drift, or unsupported step types in record-only
completion evidence.
Worker-failure payload contract coverage now verifies worker-generated failure
summaries and timeline payloads retain failure diagnostics, lease, run context,
and step context, and direct writes cannot persist missing failure messages,
missing run workflow context, or unsupported step types in worker failure
evidence.
Manual-control payload contract coverage now verifies standalone cancel/resume
step summaries and timeline payloads retain actor, action, reason, previous
status, workflow/source, and control timestamp context, and direct writes
cannot persist unsupported actions, missing previous status, or action/status
mismatches.
Stale-lease payload contract coverage now verifies scheduled recovery writes
retry and terminal-failure payloads with executor, reason, attempt counters,
previous lease evidence, workflow/source, and retry/next-status coherence, and
direct writes cannot persist retry/status drift, missing workflow context, or
timeline status mismatches.
Repair-execution-linked payload contract coverage now verifies queued and
completed repair runtime state emits dedicated repair versions, permission
status, repair-job fingerprint, side-effect identity, and the full
forward-only rollback contract into step summaries and timeline payloads.
Direct writes cannot drop permission status, use a trimmed repair-step version
to bypass required fields, remove repair-job fingerprint evidence, omit the
rollback contract, or remove the rollback reason.
Execution-result ledger coverage now verifies unsupported-adapter failures,
registered adapter exceptions, record-only completions, generic local
completions, and terminal stale-lease failures persist one terminal result row.
Completed generic worker results must retain
`adapterResolution.status=completed`, and failure result/step/timeline
payloads reject completed adapter-resolution evidence. Stale-lease recovery
requeues still write no ledger row because they are not terminal execution
outcomes, and direct writes cannot claim side effects on record-only or
failure rows, drift the ledger actor away from the run snapshot, or drift
workflow/source identity away from the parent run. AgentRun read-exposure
coverage now verifies model get/list, GraphQL AgentRun detail, GraphQL
AgentRun list, repair execution mutation linked AgentRun selections, and Admin
rendering include execution result counts plus recent result history.
Adapter-capability read-exposure coverage now verifies GraphQL AgentRun detail
and list responses expose the registered record-only adapter snapshot, and
Admin renders workflow, supported step types, side-effect mode, and summary
evidence beside the standalone run table.

## Execution Result Content Update Restrict Slice

Status: implemented.

Agent Runtime terminal execution-result ledger rows now preserve their own
content evidence after write.

Implemented behavior:

1. `ai_agent_runtime_execution_results` rejects direct updates to
   `adapter_workflow`, `executor`, `side_effect_mode`,
   `side_effects_applied`, `summary`, `result_payload`,
   `result_fingerprint`, and `worker_lease_id`.
2. Existing status/payload, run snapshot, terminal parent-run snapshot, and
   payload `completedAt` checks still own their more specific mismatch cases.
   The new trigger closes the remaining case where a direct SQL update kept
   those fields internally coherent while rewriting terminal result content
   evidence after the ledger row existed.
3. Focused coverage verifies record-only result summary/payload drift and
   result-fingerprint drift are rejected at the DB boundary, while terminal
   stale-lease result worker-lease drift is also rejected.

## Execution Result Full Content Update Restrict Slice

Status: implemented.

Agent Runtime terminal execution-result ledger rows now use the same full-row
append-only restriction as timeline, repair side-effect, transfer-event,
publish-event, and Provider Health event history.

Implemented behavior:

1. `ai_agent_runtime_execution_results_content_update_restrict_check` now
   rejects direct updates to any persisted result column, including result
   identity, run/workspace/actor snapshot columns, workflow/source snapshot
   columns, result status/failure evidence, worker attempt, completion time,
   and creation time.
2. The trigger permits true no-op updates and runs after existing
   status/payload, parent-run snapshot, terminal parent-run snapshot, and
   payload `completedAt` checks, preserving the more specific constraint names
   for malformed writes while closing coherent terminal-result rewrites.
3. Focused coverage verifies no-op result updates pass, while direct rewrites
   of result id and creation time now reject on the content update restriction
   alongside summary/payload, result-fingerprint, and worker-lease drift.

## Execution Result Delete Restrict Slice

Status: implemented.

Agent Runtime terminal execution-result ledger rows now preserve append-only
history even against direct deletes.

Implemented behavior:

1. `ai_agent_runtime_execution_results` has a deferred
   `ai_agent_runtime_execution_results_delete_restrict_check` trigger.
2. Deleting a terminal execution-result row is rejected while the parent
   `ai_agent_runs` row still exists, preventing direct SQL from erasing the
   terminal adapter outcome that run detail, Admin, worker diagnostics, and
   audit review use.
3. Parent run deletion used to cascade execution-result rows, so workspace
   cleanup and test teardown retained normal ownership semantics. The later
   Run Delete Restrict slice supersedes that behavior for direct run deletes
   while keeping workspace ownership cleanup compatible.
4. Focused coverage verifies direct result deletion rejects for a completed
   record-only run, while disposable Postgres smoke verifies direct delete
   rejection and workspace cascade compatibility.

## Execution Result Ledger Conflict Evidence Fence Slice

Status: implemented.

Agent Runtime terminal execution-result ledger writes now verify rows reused
after a `(run_id, worker_attempt)` insert conflict instead of silently
discarding the attempted result.

Implemented behavior:

1. `createWorkerExecutionResultLedgerEntry` inserts with
   `DO NOTHING RETURNING id` and re-reads the existing result by
   `(run_id, worker_attempt)` when the unique key conflicts.
2. The conflict row must match the parent run/workspace/actor/workflow/source
   snapshot, adapter workflow, executor, result status, side-effect mode,
   side-effect applied flag, summary, failure diagnostics, result fingerprint,
   payload, worker attempt, worker lease id, and completion timestamp.
3. Matching duplicate terminal result writes remain idempotent; mismatched
   same-attempt terminal evidence raises a deterministic ledger evidence error.
4. Focused Agent Runtime coverage verifies a drifted same-attempt execution
   result conflict is rejected while preserving the original ledger row.

## Execution Result Ledger Parent Run Snapshot CAS Slice

Status: implemented.

Agent Runtime terminal execution-result ledger writes now require the terminal
parent run snapshot that was just written by the worker/control path before a
result row can be inserted.

Implemented behavior:

1. `createWorkerExecutionResultLedgerEntry` now writes through
   `INSERT ... SELECT FROM ai_agent_runs ... RETURNING id` instead of a blind
   insert.
2. The parent run predicate compares run/workspace/actor identity,
   workflow/source identity, title, target/evidence fingerprints, timeline
   fingerprint, start/completion/failure timestamps, queue/lease/attempt
   evidence, creation time, and the terminal update time expected by the
   caller.
3. Record-only completion, generic worker completion, worker failure, and
   terminal stale-lease failure pass the terminal run snapshot they wrote
   immediately before ledger insertion; idempotent conflict readback still
   validates same-attempt result evidence.
4. If the terminal parent run row changes between terminal update and ledger
   insert, the ledger write fails closed and the surrounding transaction rolls
   back instead of leaving terminal run state without matching result history
   or appending result history from stale run evidence.
5. Focused coverage drifts the terminal run update timestamp before a direct
   ledger-helper insert and verifies the helper rejects without writing a
   second result row.

## Timeline Event Content Update Restrict Slice

Status: implemented.

Agent Runtime timeline event rows now preserve append-only content evidence
after write.

Implemented behavior:

1. `ai_agent_timeline_events` rejects direct updates to persisted timeline
   event identity, run/step linkage, workspace/actor snapshot, event type,
   status, ordinal, summary, payload, event fingerprint, or creation time.
2. The trigger permits true no-op updates while keeping existing status,
   payload-shape, payload-contract, run-snapshot, and step-snapshot checks in
   charge of their more specific malformed-write cases.
3. Legacy malformed timeline hydration coverage now seeds a direct historical
   row instead of mutating an existing row, preserving upgrade tolerance while
   future persisted rows become append-only.
4. Focused coverage verifies no-op timeline updates pass, while coherent
   summary/payload rewrites and event-fingerprint rewrites reject at the DB
   boundary before AgentRun detail, Admin, repair execution, or worker
   consumers can observe rewritten timeline history.

## Execution Result Snapshot Update Restrict Slice

Status: implemented.

Agent Runtime execution-result ledger rows now preserve their parent run
snapshot when parent run identity columns are directly edited.

Implemented behavior:

1. `ai_agent_runtime_execution_results_run_id_fkey` keeps result rows matched
   to the parent run/workspace/actor snapshot with `ON UPDATE RESTRICT`.
2. `ai_agent_runtime_execution_results_run_source_snapshot_fkey` keeps result
   rows matched to the parent run workflow/source snapshot with
   `ON UPDATE RESTRICT`.
3. Both recreated FKs are `NOT VALID`, preserving upgrade tolerance for
   historical rows while enforcing fail-closed behavior for future parent run
   snapshot edits.
4. Focused coverage inserts an isolated run/result pair and verifies direct SQL
   updates to the parent run actor and source id are rejected by the execution
   result snapshot FKs instead of silently cascading into terminal ledger
   evidence.

## Child Run Snapshot Coherence Constraint Slice

Status: implemented.

Agent Runtime step and timeline child rows now preserve the parent run
workspace/actor snapshot at the database boundary.

Implemented behavior:

1. `ai_agent_steps` must keep `(run_id, workspace_id, actor_id)` matched to the
   parent `ai_agent_runs` snapshot, reusing the existing execution-result
   snapshot key.
2. `ai_agent_timeline_events` must keep the same run/workspace/actor snapshot,
   so direct writes cannot move timeline evidence to another workspace or actor
   while retaining the run id.
3. The child foreign keys are `NOT VALID`, preserving upgrade tolerance for
   historical rows while rejecting new step/timeline snapshot drift.
4. Focused coverage verifies direct SQL actor drift is rejected for standalone
   Agent Runtime step and timeline rows while using a real actor id.

## Timeline Step Snapshot Coherence Constraint Slice

Status: implemented.

Agent Runtime step-level timeline rows now preserve the referenced step's run
snapshot at the database boundary.

Implemented behavior:

1. `ai_agent_steps` exposes a composite snapshot key on
   `(id, run_id, workspace_id, actor_id)` for timeline rows with a non-null
   `step_id`.
2. `ai_agent_timeline_events` must keep `(step_id, run_id, workspace_id,
actor_id)` matched to the referenced step snapshot, so direct writes cannot
   point a timeline row at a step from another run while keeping the original
   timeline run id.
3. The step snapshot FK is `NOT VALID`, preserving upgrade tolerance for
   historical rows while rejecting new step-link drift.
4. The FK uses column-specific `ON DELETE SET NULL ("step_id")`, preserving
   the existing run-level timeline behavior when a step is removed.
5. Focused coverage verifies direct SQL cannot retarget a record-only timeline
   event to a real step from another run.

Run and step rows now also preserve their creation-time evidence while leaving
runtime lifecycle state mutable:

1. `ai_agent_runs` rejects direct rewrites of run/workspace/actor identity,
   workflow/source identity, title, target fingerprint, evidence fingerprint,
   start time, and creation time after insert.
2. `ai_agent_steps` rejects direct rewrites of step identity, run/workspace/
   actor linkage, title, order, evidence fingerprint, start time, and creation
   time after insert.
3. The guards still allow legitimate lifecycle updates: run status, queue,
   lease, failure, attempts, timeline fingerprint, completion/update times, and
   step status, repair-sync step type, output summary, completion/update times.
4. Focused coverage verifies no-op run/step updates pass, valid-looking
   evidence drift rejects on the new guards, and malformed writes still report
   their older shape or timestamp constraints first.

## Run State Timeline History Required Slice

Status: implemented.

Agent Runtime run lifecycle changes now require matching run-level timeline
history at the database boundary.

Implemented behavior:

1. `ai_agent_runs` has a deferred
   `ai_agent_runs_state_timeline_required_check` constraint trigger covering
   insert plus route-affecting lifecycle fields: status, timeline fingerprint,
   completion/failure evidence, queue/lease fields, attempt counters, and
   last-attempt timestamp.
2. True no-op lifecycle updates still pass.
3. Any inserted run or real lifecycle transition must have a matching
   run-level `ai_agent_timeline_events` row by commit time, with the same run,
   workspace, actor, status, workflow/source payload, and update timestamp.
4. The trigger is deferred so the model-owned write order can keep updating the
   run first and inserting timeline events later in the same transaction.
5. Direct SQL can no longer insert orphan run state or move queued/running/
   terminal evidence without appending timeline history. Focused DB-boundary
   coverage verifies orphan insert rejection, bare state-update rejection, and
   a valid run update plus matching timeline event in one transaction.

## Step State Timeline History Required Slice

Status: implemented.

Agent Runtime step lifecycle changes now require matching step-level timeline
history at the database boundary.

Implemented behavior:

1. Standalone manual cancel/resume and stale-lease recovery now append
   step-level timeline events for the step status changes they already write
   into `ai_agent_steps`.
2. `ai_agent_steps` has a deferred
   `ai_agent_steps_state_timeline_required_check` constraint trigger covering
   insert plus lifecycle status/start/completion timestamp fields.
3. True no-op lifecycle updates still pass, and output-summary-only malformed
   writes remain owned by the existing JSON/payload CHECK constraints.
4. Any inserted step or real lifecycle transition must have a matching
   step-level `ai_agent_timeline_events` row by commit time, with the same run,
   step, workspace, actor, status, update timestamp, and step key/type payload
   when that payload is present.
5. Direct SQL can no longer insert orphan step state or move pending/running/
   terminal step lifecycle evidence without appending step timeline history.
   Focused DB-boundary coverage verifies orphan insert rejection, bare
   state-update rejection, a valid step update plus matching timeline event in
   one transaction, and no-op update compatibility.

## Timeline Delete Restrict Slice

Status: implemented.

Agent Runtime timeline rows now preserve full run/step lifecycle history while
their parent run exists.

Implemented behavior:

1. `ai_agent_timeline_events` has a deferred
   `ai_agent_timeline_events_delete_restrict_check` trigger.
2. Direct deletion of any run-level or step-level timeline row is rejected
   while the parent `ai_agent_runs` row still exists, so direct SQL cannot
   erase older lifecycle evidence after the run has advanced to a later state.
3. Workspace deletion still cascades workspace-scoped timeline history through
   the owning run, preserving ownership cleanup.
4. Focused DB-boundary coverage verifies direct deletes reject for older
   run-level, older step-level, and current run-level timeline rows. Disposable
   Postgres smoke verifies those rejects plus workspace cascade compatibility.

## Step Delete Restrict Slice

Status: implemented.

Agent Runtime step rows now preserve the step history attached to a live parent
run.

Implemented behavior:

1. `ai_agent_steps` has a deferred `ai_agent_steps_delete_restrict_check`
   trigger.
2. Direct deletion of a step row is rejected while the parent `ai_agent_runs`
   row still exists, so direct SQL cannot remove step state and force
   step-linked timeline evidence to degrade to run-only history through
   `ON DELETE SET NULL`.
3. Parent run deletion used to cascade step rows, preserving normal ownership
   cleanup. The later Run Delete Restrict slice supersedes that behavior for
   direct run deletes while keeping workspace ownership cleanup compatible.
4. Focused DB-boundary coverage verifies direct step deletion rejects and
   workspace deletion still cascades step cleanup through the owning run.

## Run Delete Restrict Slice

Status: implemented.

Agent Runtime run rows now preserve persisted run, step, timeline, and
terminal-result history against direct deletes while their owning workspace
remains live.

Implemented behavior:

1. `ai_agent_runs` has a `BEFORE DELETE`
   `ai_agent_runs_delete_restrict_check` trigger.
2. Deleting a run row is rejected while the owning workspace still exists, so
   direct SQL cannot erase an Agent Runtime root and cascade away step,
   timeline, or execution-result history.
3. Workspace deletion can still cascade workspace-scoped Agent Runtime runs and
   their child history, preserving ownership cleanup.
4. Focused Agent Runtime coverage verifies direct run deletion rejects and
   workspace deletion still cascades run plus step cleanup.

## Adapter Cooperative Cancellation Contract Slice

Status: implemented.

Standalone Agent Runtime workflow adapters now receive an explicit
lease-scoped cancellation checker instead of relying only on the worker to
check cancellation after adapter execution returns.

Implemented behavior:

1. `CopilotAgentRuntimeWorkflowAdapterInput` includes `workerAttempt` and
   `checkCancellationRequested()`.
2. The worker builds the checker from the leased run snapshot and calls the
   existing model-owned
   `cancelLeasedStandaloneRunIfCancellationRequested` path, preserving the
   same status, worker lease id, and worker attempt fence used before adapter
   execution and terminal writes.
3. Registered adapters can poll the checker during long execution and consume
   a durable running cancellation request before doing more external work.
4. If an adapter consumes cancellation through the checker, the worker's
   post-adapter failure/incomplete guard observes the released lease and does
   not write misleading failure, incomplete-execution, execution-result, or
   worker-failure evidence.
5. Focused Agent Runtime coverage verifies an adapter can trigger and consume
   cancellation during execution, leaves the run cancelled with skipped step
   state, and writes no worker failure or incomplete-execution evidence.

## Agent Run Filtered Visibility Slice

Status: implemented.

Persisted Agent Runtime runs are now locatable through bounded workspace list
filters instead of only through the most recent run list.

Implemented behavior:

1. `CopilotAgentRuntimeModel.list` accepts a constrained filter for run
   status, workflow, source type/id, and a bounded locator query over run id,
   workflow, source type/id, target/evidence/timeline fingerprints, failure
   code, and worker lease id.
2. GraphQL `Copilot.agentRuns(filter, limit)` exposes the filter after the
   normal workspace permission check while preserving the default unfiltered
   recent-list behavior.
3. Common GraphQL and Admin pass the filter through. Admin adds a run status
   selector plus locator input so queued/running/waiting/completed/failed/
   cancelled AgentRun rows can be located from the Agent Runtime card.
4. Focused Agent Runtime coverage verifies status, source, evidence
   fingerprint locator, and no-match filters.

## Model Completion Adapter Slice

Status: implemented.

The standalone Agent Runtime now has its first production workflow adapter
that performs real external model work through the existing DB-routed Copilot
prompt/provider stack instead of only recording local completion evidence.

Implemented behavior:

1. `agent_runtime_model_completion` is registered as a standalone workflow
   adapter with `supportedStepTypes=['model']` and `sideEffectMode='none'`
   through the existing capability-validated registry path.
2. The adapter requires exactly one active `model` step on the leased run and
   reads a versioned `modelRequest` object from that step's persisted output
   summary: `version='agent-runtime-model-request/v1'`, a required bounded
   `promptName`, an optional bounded `modelId`, and optional bounded
   string-only `params` (capped key/value lengths and entry count).
3. Execution goes through `PromptRuntime.runText`, so prompt resolution uses
   the DB-backed Prompt Registry fallback chain and model/provider routing
   uses the existing capability policy with `workspace`/`user` scope from the
   run row, without introducing a parallel provider invocation path.
4. The provider call carries an `AbortSignal`. The adapter polls the
   lease-scoped `checkCancellationRequested()` fence before the call, every
   second during generation, and again before the completion write; a consumed
   running cancellation aborts in-flight generation and returns without
   terminal worker writes, preserving the cooperative cancel contract.
5. Generation is bounded by a 120s timeout that aborts the provider call and
   fails the run through the existing worker exception path.
6. Model output is whitespace-normalized, redacted for obvious secrets/PII, and
   truncated to bounded evidence before persistence; the redacted bounded
   summary flows through the existing generic worker completion contract
   (`completeStandaloneWorkerExecution`), so step output, timeline payloads,
   and the execution-result ledger reuse the DB-constrained
   `agent-runtime-worker-completion/v1` shape with `sideEffectsApplied=false`
   and `adapterResolution.status=completed`.
7. Invalid model requests (missing/oversized/wrongly-typed `modelRequest`,
   unsupported version, non-string params, or an ambiguous active model step
   count) fail closed through the worker's
   `agent_runtime_adapter_execution_failed` path before any provider call.
8. Focused e2e coverage verifies the happy path (prompt name, params, model
   id, workspace/user scope, and abort signal reach `PromptRuntime.runText`;
   redacted bounded output evidence lands in step output, timeline, and the
   result ledger), oversized output truncation, invalid-request fail-closed
   behavior without provider calls, and cooperative cancellation consumed
   during generation with skipped steps and no terminal execution result.

## Office Task Document Update Adapter Slice

Status: implemented.

The standalone Agent Runtime now has its first production office-task adapter
with a real workspace side effect behind an approval gate.

Implemented behavior:

1. `agent_runtime_doc_update` is registered as a standalone workflow adapter
   with `supportedStepTypes=['approval', 'tool']` and
   `sideEffectMode='workspace_write'`.
2. GraphQL `requestCopilotAgentRuntimeDocUpdate` creates a workspace-scoped
   AgentRun in `waiting_approval` with an approval step and a tool step. The
   tool step persists a versioned
   `agent-runtime-doc-update-request/v1` payload with document id, requested
   content, and deterministic content fingerprint.
3. Standalone run control now supports `approve` and `reject` in addition to
   cancel/resume. Approval completes the approval step, moves the tool step to
   pending, queues the worker, and records `agent-runtime-approval-control/v1`
   control evidence without overloading the older cancel/resume
   `manualControl` contract.
4. The adapter requires a completed approval step, validates exactly one active
   tool step, checks `Doc.Update` through the existing permission controller,
   polls the lease-scoped cancellation checker before permission and before
   side effects, then updates the workspace document through `DocWriter`.
5. Side-effect evidence records `workspace_doc_update`, document id,
   content fingerprint, side-effect fingerprint, and deterministic idempotency
   mode in the worker completion summary and
   `ai_agent_runtime_execution_results` ledger.
6. The Agent Runtime worker completion DB contract now accepts side-effectful
   completions only when `sideEffectsApplied=true`, `sideEffectMode` is
   `workspace_write` or `external_tool`, and a JSON object side-effect summary
   is present; no-side-effect completions remain constrained to omit that
   summary.
7. Focused e2e coverage verifies request creation, approval, worker
   execution, workspace document mutation, step/timeline/ledger side-effect
   evidence, and markdown readback of the updated document.

## LocalMind MCP Tool Agent Adapter Slice

Status: implemented.

Inbound MCP delegation now has a durable production adapter that lets the
built-in LocalMind AI execute the same server-side tool categories as AI Chat
instead of stopping at read-only answers and one-document replacement.

Implemented behavior:

1. The delegation planner accepts `tool_agent` as an immutable plan kind and
   creates one queued `agent_runtime_localmind_tool_agent` AgentRun with one
   persisted tool step.
2. New v2/v3 steps snapshot the complete AI Chat tool-category allowlist:
   `blobRead`, `codeArtifact`, `conversationSummary`, `docRead`, `docCreate`,
   `docUpdate`, `docUpdateMeta`, `docKeywordSearch`, `docSemanticSearch`,
   `webSearch`, `docCompose`, `sectionEdit`, `workspaceOrganization`,
   `enterprise`, and `sparkClaw`. Upgrade-time v1 validation uses its frozen
   historical list ending at `enterprise` rather than the mutable current
   category list, and gives legacy tasks an empty SparkClaw snapshot.
3. Execution reuses `CapabilityRuntime.streamObject` and the existing
   `ToolRuntime`, so provider routing and each tool's current permission,
   self-hosting, indexer, web-provider, and context checks remain authoritative.
4. The adapter checks credential-family activity, the frozen
   `delegate_to_localmind` capability, live `Workspace.Copilot`, and readable
   caller-supplied documents before the loop. It polls cancellation and base
   authority every second while running and propagates one AbortSignal into the
   tool loop.
5. Execution is bounded to 120 seconds and 20 attempted tool executions. The
   twenty-first execution is rejected before its executor runs. A timeout
   remains terminal even when the native stream converts abort into a normal
   iterator close, and public task state reports retryable
   `tool_agent_timeout`. Native tool-result `is_error` survives the runtime
   projection, and an already aborted callback fails before a tool executor is
   invoked.
6. Completion persists the terminal AgentRun execution result and MCP
   delegation result in one transaction before optional callback delivery is
   queued.
7. Persisted/public evidence contains only a bounded final answer, tool names,
   success/failure status, argument fingerprints, referenced document ids, and
   created/updated document artifacts; raw tool arguments and generated
   document bodies are not returned by `get_localmind_task`.
8. Task queries recheck `Doc.Read` for caller-supplied, targeted, created,
   updated, searched, and read document references before returning historical
   task state.
9. Delegated `doc_create` derives a stable requested document id from task id
   and title. `DocWriter.createDoc` recognizes an existing requested id,
   repairs missing root registration, and returns idempotent replay evidence.
10. Focused E2E covers the full tool allowlist, document creation/readback,
    same-task replay, sanitized artifact projection, required document-update
    evidence, normal-close timeout handling, failed-tool projection, credential
    revocation before execution, and execution without a callback.
11. `workspaceOrganization` is shared by Web AI and delegation and expands to
    semantic document/folder Trash, restore, permanent delete, folder listing,
    creation, rename, move, document placement, and moving a document into one
    or no folder. Ordinary delete requests use Trash. Folder restore changes
    only the matching folder operation's persisted Trash claim; direct and
    overlapping folder claims keep the document in Trash. Legacy manifests
    without claim metadata preserve the original newly/already-trashed split.
    Permanent deletion requires explicit intent, matching current title/name,
    Trash state, real delete ACL, recursive document/placement cleanup, and a
    retryable manifest-preserving physical-delete sequence. Deleting one
    document or shared folder also validates and rewrites other affected Trash
    manifests so their later restore remains valid.
12. `sparkClaw` expands to only `sparkclaw_mcp_search` and
    `sparkclaw_mcp_execute`. Delegation creation freezes the complete sorted set
    of actually available internal tool names, each input-Schema fingerprint,
    concrete Enterprise and SparkClaw connection/provider/tool/risk/confirmation
    capabilities, destructive intent, and the task completion contract in
    `localmind-tool-agent-request/v5`; execution intersects those snapshots
    with current registries, rechecks dynamic catalogs before execution, and
    applies user ACL. Legacy v1-v4 requests remain executable without gaining
    newer authority or completion requirements. Snapshot acquisition failures
    persist terminal `tool_snapshot_failed` task state.
13. The public SparkClaw surface contains only
    `sparkclaw.conversation.send`; operation get/result/cancel remain internal.
    Direct and pending results persist in an encrypted idempotency ledger with
    fenced initial/poll leases, live delegated-user ACL rechecks, bounded
    retries and remote deadlines. Binary result bodies are removed before
    persistence. Agent Runtime records only tool name, risk, replay state,
    argument/result fingerprints, and side-effect state; raw arguments and
    external results are not copied into runtime evidence.
14. Delegated attachment reads use `task_attachment_read`, which accepts only
    ids from the current task context. Every chunk rechecks task/actor/workspace/
    credential-family binding and live Blob ACL, rereads and verifies immutable
    Blob evidence, reparses the source, and returns bounded extracted text.
    General `blob_read` remains tied to an AI Chat session and is not registered
    for sessionless delegated tasks.
15. Keyword search uses the workspace indexer when available and otherwise
    scans at most the 200 most recently updated readable Markdown documents in
    batches of 16, skips parser and invalid-binary content without suppressing
    other read failures, then ranks the full bounded candidate set before
    applying the caller's result limit.
16. `localmind-tool-agent-completion-contract/v3` persists concrete successful
    tool requirements plus optional document, workspace-operation, Enterprise
    provider, SparkClaw tool, ordering, and side-effect constraints. Text-only
    completion claims fail. Conditional updates require `doc_read` followed by
    `doc_update` or `conditional_noop_complete`, and the no-op must echo the
    exact read fingerprint. Missing evidence projects retryable
    `required_tool_evidence_missing` state.

## Agent Run Source Conflict Evidence Fence Slice

Status: implemented.

Generic Agent Runtime run creation now fails closed when a concurrent source
insert conflict returns a run whose create-time evidence does not match the
request that lost the insert race.

Implemented behavior:

1. `CopilotAgentRuntimeModel.createRun` keeps the existing pre-read
   idempotency behavior for already-visible `workspace/sourceType/sourceId`
   runs.
2. If the pre-read misses and `ON CONFLICT (workspace_id, source_type,
source_id) DO NOTHING` loses the insert race, the model validates the
   reused row against the computed actor/workflow/source/title,
   target/evidence fingerprints, and immutable step key/type/order/evidence
   fingerprints before returning it.
3. A drifted conflicting row now raises a deterministic mismatch error instead
   of silently returning a run created for different generic workflow evidence.
4. Focused Agent Runtime coverage verifies both the matching conflict reuse
   path and the mismatched conflict evidence rejection path.

## Remaining Risk

- repair execution and internal generic run creation can persist runtime state,
  and standalone runs now have DB-backed scheduling/lease plumbing, but no
  planner drives arbitrary workflows yet;
- Agent Runtime standalone cancellation/resume now requeues durable runs for a
  worker, and expired standalone worker leases now recover through a scheduled
  worker, and queued standalone rows have scheduled job re-enqueue recovery,
  and the explicit record-only workflow plus the generic local-completion
  workflow can now complete through the workflow adapter registry, and
  registered adapters now declare step/side-effect capability contracts that
  are validated at registration, but arbitrary workflows still record
  unsupported-adapter or unsupported-contract failure until real workflow
  adapters are registered with matching contracts;
- registered adapter exceptions and incomplete adapter returns now fail closed
  durably instead of waiting for stale-lease recovery, the
  `agent_runtime_model_completion` adapter now performs real model execution
  through the DB-routed prompt/provider stack, and
  `agent_runtime_doc_update` now performs one approval-gated workspace document
  update side effect. `agent_runtime_localmind_tool_agent` now performs the
  bounded AI Chat tool loop for inbound MCP tasks. Specialized non-chat tool,
  Codex, outbound MCP, handoff, and generic planner executors are still not
  implemented, and model output evidence remains bounded summary text rather
  than a richer executor-specific persisted result schema.
- generic standalone run creation and worker/control metadata are now bounded
  at the model persistence and hydration boundary, and timeline status
  vocabulary, worker attempt counters, worker lease pair and lease-id string
  evidence, worker lease status coherence, and terminal completion timestamps,
  run/step timestamp coherence, queued timestamp shape, failure field pairing,
  run identity string shape, step identity string shape,
  source/workflow coherence, step/timeline ordering shape, persisted
  fingerprint string shape, step/timeline JSON object shape, run/step evidence
  immutability after insert, run/step timeline-history requirements, worker
  lease payload shape, record-only completion payload shape, plus
  worker-failure payload, manual-control payload, stale-lease recovery payload,
  repair-execution-linked payload shape, adapter-resolution contract shape, and
  append-only timeline event content evidence, full timeline delete restriction
  while parent runs still exist, step delete restriction while parent runs
  still exist, and execution-result delete restriction
  for failure evidence including registered adapter capability snapshots are
  DB-constrained, but full external executor payload schemas will still need
  executor-specific validation when specialized tool/Codex/MCP/model adapters
  are added.
- Agent Runtime failure diagnostics now also reject present-but-blank failure
  code/message strings at the DB boundary, without requiring every generic
  `failed` row to carry diagnostics.
- workflow adapter registration metadata is now bounded and immutable before
  it can flow into worker adapter-resolution persistence. The model-completion
  and document-update adapters now have executor-specific payload schemas, but
  arbitrary workflows still need additional executor-specific schemas,
  side-effect idempotency contracts, and concrete implementations.
- workflow adapter registry storage now allow-lists adapter fields before they
  can flow into diagnostics, but production adapter implementations still need
  executor-specific payload/result schemas and redaction policies.
- registered adapter executor results now fail closed when they are non-promise
  values, but real production adapters still need explicit completion,
  side-effect, interruption, and rollback contracts.
- standalone terminal worker outcomes now persist in
  `ai_agent_runtime_execution_results`, including record-only completion,
  generic local-completion success, worker failure, and terminal stale-lease
  failure. Completed generic worker results must carry
  `adapterResolution.status=completed`, while failure result, step, and
  timeline payloads reject completed adapter-resolution evidence. Ledger rows
  now preserve parent-run workflow/source snapshot coherence, and result writes
  plus parent run terminal updates must keep result status, worker attempt,
  completed timestamp, failure diagnostics, and payload `completedAt` aligned
  with the terminal parent run snapshot. Terminal parent run rows now also
  reject direct same-terminal result/failure/completion/timeline rewrites while
  preserving failed or cancelled manual resume to queued. Manual resume can
  still requeue a failed prior attempt and preserve its result history before
  the next worker lease increments the attempt, and run lifecycle transitions
  now require matching run-level timeline evidence by commit time, but direct
  same-attempt running bypasses are rejected. Specialized tool/Codex/MCP/model
  adapters still need executor-specific result schemas and implementations.
- registered standalone workflow adapter capabilities now surface through
  GraphQL/common/Admin from the same allow-listed registry snapshot used by
  worker failure diagnostics, but this remains registry observability rather
  than concrete production adapter execution.
- standalone manual control, worker failure, record-only completion, and
  generic local completion now fail closed on stale run snapshots before
  writing execution-result ledger, timeline, or step evidence, including
  same-status running snapshot drift in timeline/evidence/failure/queue/lease/
  timestamp fields, and worker-owned terminal paths now compare each active
  step's originally read identity, status, output summary, evidence, order, and
  timestamp snapshot before terminal step updates. They also require the
  leased worker attempt to match the current run row. Standalone
  manual cancel/resume now compare the originally read run snapshot across
  workflow/source identity, target/evidence, timeline, failure,
  queue/lease/attempt, completion, creation, and update-time evidence, and
  fence each child step mutation against the full originally read step
  identity/status/output/evidence/order/timestamp snapshot, so run- or
  step-level drift rolls the control operation back before stale step
  summaries or timeline events are persisted. Running cancel records a durable
  cooperative request tied to the current worker lease/attempt only after
  comparing the full originally read running run snapshot, and the worker
  revalidates a current non-expired lease plus the original attempt before adapter
  resolution/execution and before post-adapter failure/cancel handling;
  adapters also receive a lease-scoped cancellation checker that uses the same
  model-owned status/lease/attempt fence so long-running adapters can poll and
  consume cancellation during execution. Non-null timeline step links now
  preserve the referenced step's run snapshot before later readers hydrate
  step-level evidence. This remains a cooperative cancellation boundary, not
  true preemptive interruption while a production executor is still performing
  external work.
- broader step status transitions outside the current worker/control paths
  still need executor-specific user-facing summary contracts as additional
  specialized tool/Codex/MCP/model adapters are added.
- Agent Runtime display strings are now DB-constrained for blank/title/summary
  drift, but production adapters still need domain-specific user-facing
  summary contracts and redaction policies.

## Inbound MCP Delegation

The inbound workspace MCP surface now exposes `delegate_to_localmind`, the
read-only `get_localmind_task`, and cancel-only `control_localmind_task`.
Local files are submitted directly through the delegation's `attachments`
field, while returned `attachmentIds` support later same-family reuse. An
optimized delegated document replacement creates a queued
`agent_runtime_doc_update` run, while broader AI Chat work creates a queued
`agent_runtime_localmind_tool_agent` run with the complete server-side AI Chat
tool-category snapshot. Both use one durable `mcp_ai_delegation` request. The
credential's fixed capability snapshot and the delegated user's live ACL
authorize execution; no approval step, approval callback, or caller decision
is required. An optional result notification URL receives only terminal
completion, failure, or cancellation events. The normal Agent Runtime worker
lease, cancellation, completion, execution-result, and side-effect evidence
paths remain authoritative.

The advertised `localmind-ai` v3.4.0 discovery metadata gives external models
an explicit LocalMind-scoped routing decision table. Only work explicitly
directed to LocalMind or requiring LocalMind-managed resources enters this
public tool surface; it is not a global router and must not affect ordinary
Codex, Claude, or other host-agent workflows. Existing-task status/result
queries route directly to `get_localmind_task`, explicit cancellation routes
directly to `control_localmind_task`, and every remaining request asking
LocalMind to answer or act uses `delegate_to_localmind`, including follow-ups
that request additional work, revisions, continuations, and retries.
Field-level JSON Schema descriptions distinguish task ids, document ids,
document titles, and idempotency keys, and tell callers that
`doc_create`, `doc_read`, and the other AI Chat tools are internal to the
delegated LocalMind agent rather than public MCP tools.

The planner's OpenAI-compatible structured-output wire contract is a single
strict object with a `kind` discriminator and fixed fields, rather than a nested
object union. The service normalizes that wire result into the narrower answer,
document-update, tool-agent, or unsupported domain schemas before persisting a
plan. This avoids provider constrained-decoding drift where the generated
reason describes a valid read-only answer but the decoder selects the
unsupported union branch.

The task query uses the delegation request id as stable `taskId` and projects a
bounded `localmind.task.v1` view over delegation, AgentRun, AgentStep, and
execution-result state. Plans are stored separately from mutable task results as
schema-validated fingerprinted snapshots and become immutable after first
write. Query projection allowlists step/result fields instead of returning raw
step output, supports version-based waits up to 30 seconds, and does not invoke
AI or mutate runtime state.

The delegated task's credential capability snapshot is fixed when the task is
created. Execution cannot gain capability through a later credential change,
while credential-family activity and the actor's real workspace/document ACL
are checked live. Permission loss is a direct failure, not a request for
elevation.

Uploaded MCP attachments are immutable workspace Blob references bound to the
actor and credential family. One file is limited to 10 MiB; delegation accepts
at most eight and 20 MiB combined. Planning and tool-agent worker execution
independently recheck live `Workspace.Blobs.Read`, reread the Blob, and verify
persisted size/SHA-256 evidence before providing bounded extracted text or
provider attachment bytes. Storage reconciliation also treats the immutable
attachment row as a live Blob reference. This task context does not create or
depend on an AI Chat session.

Task query access is restricted to the creating credential family, survives
rotation, and rechecks family activity, frozen `get_localmind_task`, live
`Workspace.Copilot`, `Doc.Read` for every referenced document, and Blob read
access plus attachment binding for attachment-backed tasks. A different family
receives `task_not_found`; lost ACL receives no historical task output.

Task control persists a fingerprinted idempotency record per task, credential
family, and key. It uses the task creation-time `control_localmind_task` permission
and live `Workspace.Copilot`; it does not require `Doc.Update`, because losing
side-effect permission must not prevent cancellation. Queued runs become
terminal immediately. A leased running run receives the existing
cooperative Agent Runtime cancellation request and projects `cancelling` until
the worker owns the terminal write. Final reconciliation queues a signed
`task_cancelled` notification when an endpoint is configured.

Document version is checked while planning and immediately before `DocWriter`,
but the current CRDT writer has no expected-version compare-and-write operation.
There remains a narrow race where a concurrent edit can arrive after the final
check and before the update is persisted. Close this with a storage-level CAS
before treating the preview/version fence as atomic.

The tool-agent path has its own bounded execution contract: 120 seconds, 20
attempted tool executions, one AbortSignal, one-second cancellation/authority
polling, transactional AgentRun/delegation completion, and sanitized tool plus
artifact evidence. New v5 requests persist actual available tool names, exact
input-Schema fingerprints, concrete Enterprise/SparkClaw capabilities, and an
explicit v3 completion contract. Required creates, updates, workspace
operations, and external-provider actions must produce matching successful tool
evidence instead of text-only claims. Conditional mutations must record a
successful `doc_read`, then either `doc_update` or
`conditional_noop_complete` with the exact read fingerprint. Missing evidence
fails with retryable `required_tool_evidence_missing`; the twenty-first tool
execution fails with retryable `tool_execution_limit_exceeded`. Timeout aborts
that close the stream normally fail with retryable `tool_agent_timeout`.
Tool-level ACL remains inside the existing AI Chat tools.
The shared workspace-organization category adds safe folder operations and
records successful non-replay mutations as workspace side effects. Delegated
document creation is stable by task id and title so worker retries do not
create duplicate documents.

## Non-goals For First Slice

Whiteboard, document database/table, asset, comment, collaboration, history,
external-system, and arbitrary MCP operations remain unsupported until each has
an executor-specific planner schema, permission map, preview, idempotency,
side-effect evidence, and tests. Direct legacy workspace tools must not be
reintroduced to bypass this delegation boundary.

The workspace-managed outbound SparkClaw MCP connection remains separate from
inbound MCP credential authority, but its allowlisted tools are now available
inside this durable tool-agent workflow. New requests freeze tool names,
input-Schema fingerprints, concrete dynamic tool capabilities, and the
completion contract in `localmind-tool-agent-request/v5`; workers use only the
intersection with the current registry/live allowlist, recheck dynamic
catalogs, and recheck the delegated user ACL. Legacy v1-v4 requests keep their
historical completion and tool semantics. The
tool execution ledger provides encrypted replay, stable task idempotency,
fenced initial and remote-poll leases, cancellation/failure terminals, live ACL
rechecks, binary-result redaction, and bounded audit evidence.
This does not create arbitrary MCP steps or bypass Agent Runtime worker leases;
any future generic MCP-step adapter still requires its own versioned input,
result, authorization, cancellation, redaction, and side-effect contracts.

- full planner;
- parallel tool scheduler;
- Codex adapter execution;
- MCP tool marketplace;
- cross-device recovery;
- billing/usage aggregation.
