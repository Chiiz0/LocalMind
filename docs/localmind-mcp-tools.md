# LocalMind MCP Tool Reference

This reference describes `localmind-ai` version `3.4.0`. `tools/list` is the
authoritative JSON Schema source.

## Tools

### Tool selection rules

The LocalMind tools are scoped to requests directed to LocalMind and must not be
used as a global request router. A request is directed to LocalMind when the
user explicitly asks LocalMind to answer or act, or when the operation requires
LocalMind-managed documents, attachments, workspace resources, tasks,
connected data, or another LocalMind-specific capability. Merely mentioning,
discussing, configuring, or troubleshooting LocalMind does not trigger a call
unless the user asks LocalMind to execute work.

The tools must not intercept, reroute, delay, or otherwise affect ordinary
conversations or native workflows in Codex, Claude, or other host agents. For
requests directed to LocalMind, MCP clients should apply the most specific
matching intent first:

1. If the user only asks for the status, progress, or final result of an
   existing task and its `taskId` is known from `delegate_to_localmind`, call
   `get_localmind_task` directly. Do not delegate first or create/guess an id.
2. If the user explicitly asks to stop or cancel an unfinished existing task,
   call `control_localmind_task` directly with its known `taskId`. Do not
   delegate first.
3. Treat every other request that asks LocalMind to answer or act as a
   delegation, including follow-ups that request additional work, revisions,
   continuations, and retries. LocalMind requests can include questions,
   summaries, document
   reads/searches/creates/updates/renames, web research, attachment processing,
   and multi-step workspace work.
4. If the delegated request includes local files, include them directly in
   `attachments`. Use `attachmentIds` only to reuse files returned by an
   earlier delegation in the same credential family.
5. Submit the complete request through `delegate_to_localmind`.

The caller must not search for low-level tools such as `doc_create` or
`doc_read`. Those tools are internal to LocalMind AI; the public caller submits
the complete task through `delegate_to_localmind`, and LocalMind chooses the
internal tools.

### `delegate_to_localmind`

Starts one complete natural-language task with LocalMind's built-in AI. This is
the only public MCP tool that submits requests asking LocalMind to answer or
act. Use it only for requests directed to LocalMind as defined above, never as
the host agent's global request router. Do not use it for existing-task status,
result, or cancellation requests; those route directly to
`get_localmind_task` or `control_localmind_task`. Follow-ups that request
additional work, revisions, continuations, and retries are submitted here.

Input:

| Field            | Type         | Required | Constraint                                      |
| ---------------- | ------------ | -------- | ----------------------------------------------- |
| `request`        | string       | yes      | Trimmed, 1 to 12,000 characters                 |
| `documentIds`    | string[]     | no       | At most 20 workspace document ids; default `[]` |
| `attachments`    | attachment[] | no       | At most 8 inline files; default `[]`            |
| `attachmentIds`  | string[]     | no       | Earlier delegated attachment ids; default `[]`  |
| `idempotencyKey` | string       | yes      | Trimmed, 1 to 256 characters                    |

Each inline attachment contains `fileName`, optional `mimeType`, and strict
base64 bytes. One decoded file may be at most 10 MiB, and all attachments used
by a task may be at most 20 MiB combined. The server stores inline bytes through
workspace Blob quota enforcement and persists immutable filename, MIME, size,
Blob key, and SHA-256 evidence before planning.

The same idempotency key in one workspace and credential family returns the
same persisted request and attachment ids only when the normalized request and
file evidence match. Reusing it for different input returns
`idempotency_conflict`.

Current planner results:

| Kind               | Behavior                                                        |
| ------------------ | --------------------------------------------------------------- |
| `answer`           | Persists a completed record-only AgentRun and returns text      |
| `document_update`  | Queues the optimized one-document replacement AgentRun          |
| `tool_agent`       | Queues LocalMind AI with the normal AI Chat server-side tools   |
| `unsupported_task` | Returns an honest unsupported result without claiming an effect |

`document_update` can target only one id supplied in `documentIds`. LocalMind
reads only documents allowed by the delegated user's current ACL and treats all
document content as untrusted data.

`tool_agent` can use the same server-side tool categories registered for AI
Chat: attachment read, code artifact generation, conversation summary,
document read/create/update/title update, keyword and semantic document search,
web search/crawl, document composition, section editing, and workspace folder
organization. Folder organization includes list/create/rename/move/delete and
adding or moving readable documents. Lists require `Workspace.Organize.Read`,
mutations require `Workspace.Sync`, and document placement also requires
`Doc.Read`. Recursive folder deletion removes folder records and placements,
not document content. Each underlying tool keeps its normal LocalMind
permission and deployment checks. For example, document creation requires
`Workspace.CreateDoc`, keyword search requires the indexer, and web tools
require their configured provider. Task attachments are materialized without
creating an AI Chat session. Parseable documents contribute at most 24,000
extracted characters across the task; provider-native media and unsupported
parser formats are supplied as bounded bytes. A task accepts at most eight
attachments and 20 MiB combined. Planning and worker execution both reread the
Blob and verify its size and SHA-256 evidence before use.

The tool loop is bounded to 20 attempted executions and a configurable 300-second total deadline. It polls
durable cancellation and credential/workspace authority while running, and
persists only sanitized summaries, argument fingerprints, referenced document
ids, created/updated document artifacts, and allowlisted workspace-folder
effects. A timeout is exposed as retryable `tool_agent_timeout` even if abort
causes the provider stream to close normally. For one supplied document, an
explicit body mutation carries a v3 completion contract and must record both a
successful `doc_update` and a matching updated artifact; otherwise the task
fails with retryable `required_side_effect_missing`. A document created by a
delegated task uses a stable id derived from the task and title, making a
same-task replay idempotent instead of creating duplicate documents.
Idempotent folder replays are not recorded as new side effects.

Successful MCP tool calls contain readable text and the same logical object in
`structuredContent.result`. A permission or unsupported result is a normal
structured task outcome. Invalid arguments set `isError: true`; unexpected
internal failures are redacted.

Every delegation result includes `taskId`. It is the durable delegation request
id and remains stable before planning, during execution, and after completion.
`requestId` remains as a backward-compatible alias. `attachmentIds` contains
the normalized immutable attachment ids and can be passed to a later delegation
in the same credential family without resending the bytes.

### `get_localmind_task`

Reads one persisted task after `delegate_to_localmind` has returned its
`taskId`, without invoking the LocalMind AI or changing task state. Use it when
the user asks for that task's status, progress, or final result. It must not be
used for follow-ups that request additional work, revisions, continuations, or
retries, and its `taskId` is not a document id. Never create or guess a task id.

Input:

| Field               | Type    | Required | Constraint                               |
| ------------------- | ------- | -------- | ---------------------------------------- |
| `taskId`            | string  | yes      | Trimmed, 1 to 512 characters             |
| `knownStateVersion` | string  | no       | Previously returned version, at most 128 |
| `waitMs`            | integer | no       | `0` to `30000`; default `0`              |

When `knownStateVersion` matches and `waitMs` is positive, LocalMind waits for
a state change or timeout. `changed=false` means the task was unchanged at the
end of that wait. Nonterminal responses include `pollAfterMs`.

The success projection uses `protocolVersion=localmind.task.v1` and returns:

- lifecycle `status`, `terminal`, `phase`, timestamps, and `stateVersion`;
- the immutable sanitized plan snapshot;
- current allowlisted step summaries, never raw AgentStep output;
- legacy approval state when reading an older persisted task; new tasks return
  `approval=null`;
- an allowlisted final result and LocalMind artifact references;
- a bounded public error for terminal failures.

Public lifecycle statuses are `planning`, `waiting_approval`, `queued`,
`running`, `cancelling`, `completed`, `failed`, `rejected`, and `cancelled`.
Specific causes such as `unsupported_task`, `permission_denied`,
`resource_version_conflict`, `tool_agent_timeout`, or
`required_side_effect_missing` appear under `error.code` rather than becoming
new lifecycle states. `availableControls` contains `cancel` only while the task
can accept a new cancellation request.

Only the credential family that created a task can query it. Rotation preserves
family access; another family receives `task_not_found`. LocalMind rechecks
credential-family activity, the task's frozen `get_localmind_task` permission,
`Workspace.Copilot`, `Doc.Read` for every referenced document, and
`Workspace.Blobs.Read` plus family/actor/workspace binding for every task
attachment. Lost ACL returns a direct query error and does not expose historical
results.

### `control_localmind_task`

Cancels one unfinished delegated task only when the user explicitly requests
cancellation. This tool cannot start, approve, reject, retry, resume, query,
create, or edit work.

Input:

| Field            | Type   | Required | Constraint                   |
| ---------------- | ------ | -------- | ---------------------------- |
| `taskId`         | string | yes      | Trimmed, 1 to 512 characters |
| `action`         | string | yes      | Must be `cancel`             |
| `idempotencyKey` | string | yes      | Trimmed, 1 to 256 characters |
| `reason`         | string | no       | Trimmed, 1 to 500 characters |

Queued AgentRuns are cancelled immediately. A leased running AgentRun records
a cooperative cancellation request and returns
`outcome=cancellation_requested`, `taskStatus=cancelling`, and a non-null
`pollAfterMs`; use `get_localmind_task` until the worker records terminal
`cancelled` state. Already terminal work returns `outcome=not_cancellable`.

Control requests are persisted. Replaying the same idempotency key with the
same normalized request returns the original result with
`idempotentReplay=true`; different request evidence returns
`idempotency_conflict`. Only the task's creating credential family can control
it. LocalMind rechecks family activity, the task's frozen
`control_localmind_task` permission, and live `Workspace.Copilot`. Cancellation does
not require `Doc.Update`, so a task can still be stopped after its target write
permission is lost.

Immediate and cooperative terminal cancellation queues a signed
`task_cancelled` notification when the credential family has a result
notification endpoint.

## Result Notifications

When the credential family has a result notification URL, LocalMind sends an
HTTP `POST` after an asynchronous task reaches a terminal state. The URL is
optional and never gates task execution.

Headers:

| Header                    | Value                                                |
| ------------------------- | ---------------------------------------------------- |
| `Content-Type`            | `application/json`                                   |
| `X-LocalMind-Event`       | `task_completed`, `task_failed`, or `task_cancelled` |
| `X-LocalMind-Delivery-Id` | Durable outbox delivery id                           |
| `X-LocalMind-Timestamp`   | Unix time in milliseconds                            |
| `X-LocalMind-Signature`   | `sha256=<hex HMAC>`                                  |

The signature input is `<timestamp>.<exact raw JSON body>`. The callback
receiver should validate the HMAC with the one-time callback secret and reject
stale timestamps and replayed delivery ids.

Each body uses `version=localmind-mcp-callback/v1` and includes `event`,
`requestId`, terminal `status`, and the allowlisted task `result`. Delivery is
backed by a durable outbox with worker leases and bounded retries. Without a
notification URL, callers use `get_localmind_task` to observe completion.

## Protocol Methods

| Method       | Result                                      |
| ------------ | ------------------------------------------- |
| `initialize` | Protocol version and tools capability       |
| `ping`       | Empty success object                        |
| `tools/list` | The four attachment/delegation/task schemas |
| `tools/call` | Text plus the structured tool result        |

MCP Resources are not advertised. Protocol versions `2024-10-07`,
`2024-11-05`, `2025-03-26`, `2025-06-18`, and `2025-11-25` are accepted.
JSON-RPC batching is rejected for post-2025-03 versions; notifications return
HTTP 202 when there is no response message.
