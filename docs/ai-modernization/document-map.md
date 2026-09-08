# AI Modernization Document Map

Use this map to decide which LocalMind AI planning document to read or update.

## Read Order

For a new AI modernization task, read in this order:

1. [AI Modernization README](./README.md)
2. [Branch Differences](./branch-differences.md)
3. [Current State](./current-state.md)
4. [Next Goals](./next-goals.md)
5. [Validation](./validation.md)
6. The relevant track document under [tracks](./tracks/)

Read the long historical plan only when a task needs a specific historical
section or landing record.

## Source Of Truth

| Document                                                                      | Role                                                                                                                                                                                  | Update When                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [README](./README.md)                                                         | Active entrypoint and working rules                                                                                                                                                   | The active direction or reading order changes                                                    |
| [branch-differences](./branch-differences.md)                                 | High-level difference from upstream AFFiNE                                                                                                                                            | The branch positioning or major AI capability set changes                                        |
| [current-state](./current-state.md)                                           | Implemented AI state summary                                                                                                                                                          | A meaningful vertical slice lands                                                                |
| [next-goals](./next-goals.md)                                                 | Ordered backlog and remaining follow-up                                                                                                                                               | Priority or remaining work changes                                                               |
| [validation](./validation.md)                                                 | Required validation workflow                                                                                                                                                          | Docker/test validation expectations change                                                       |
| [tracks/support-bundle](./tracks/support-bundle.md)                           | Support bundle persistence lifecycle                                                                                                                                                  | Support bundle request/artifact/download/retention behavior changes                              |
| [tracks/repair-execution](./tracks/repair-execution.md)                       | Repair execution lifecycle                                                                                                                                                            | Repair request, approval, worker, side-effect, or manual-control behavior changes                |
| [tracks/agent-runtime](./tracks/agent-runtime.md)                             | Durable agent runtime                                                                                                                                                                 | Run/step/timeline/worker/adapter behavior changes                                                |
| [tracks/registries](./tracks/registries.md)                                   | DB-backed AI registries                                                                                                                                                               | Prompt/model/provider/task policy/health registry behavior changes                               |
| [tracks/context-memory](./tracks/context-memory.md)                           | Rule, Automatic Memory, scope resolution, recall, planner trust boundary, and plan traces                                                                                             | Context capture, scope, retrieval, rendering, strategy, or evaluation behavior changes           |
| [tracks/intelligence-workbench](./tracks/intelligence-workbench.md)           | Global project workbench: Intelligence page, task panel, project grants, access requests, Blockers                                                                                    | Workbench layout, project entity/membership/grant, access request, or Blocker behavior changes   |
| [tracks/project-native-resources](./tracks/project-native-resources.md)       | Settled Project native storage, file trees, independent copies and explicit Workspace publishing; legacy-reference retirement is owned by Project Workbench Redesign                  | Project resource ownership, internal editing, import or external publication changes             |
| [project-native-resources.goal](./project-native-resources.goal.md)           | Implementation goal prompt for the settled native Project resource design                                                                                                             | Execution scope or acceptance contract changes                                                   |
| [project-native-resources.execution](./project-native-resources.execution.md) | P1-P6 implementation, A01-A22 evidence, backups, upgrade/backfill and runtime synchronization                                                                                         | Native Project acceptance status and operational exceptions                                      |
| [tracks/project-workbench-redesign](./tracks/project-workbench-redesign.md)   | Confirmed Project UX redesign: standalone shell and routes, main-area file tree, old reference model retirement, realtime, exclusive edit leases, dual approval, error and copy rules | Project shell, routing, file tree interaction, lease, approval entry or user-facing copy changes |
| [project-workbench-redesign.goal](./project-workbench-redesign.goal.md)       | Implementation goal prompt for the Project workbench redesign                                                                                                                         | Execution scope or acceptance contract changes                                                   |
| [archive](./archive/README.md)                                                | Split historical audit log                                                                                                                                                            | A concise landing record is required for traceability                                            |

## Historical Plan Rule

The [AI capability modernization archive](./archive/README.md) replaces the
former root-level long plan and should not be the default task entrypoint.
Prefer targeted lookups by archive volume and section heading when historical
context is needed.

Do not continue the old pattern of extending nested read-only support-bundle
source-evidence fields unless the user explicitly asks for a specific field.

## Documentation-only Changes

Documentation-only changes should stay local unless commit or publish work is
explicitly requested. For docs-only updates, a markdown/prettier check is enough
when available; Docker validation is reserved for code, runtime, packaging, or
container behavior changes.
