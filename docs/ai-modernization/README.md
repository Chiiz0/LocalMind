# LocalMind AI Modernization

This directory is the active planning entrypoint for LocalMind AI
modernization.

LocalMind is an AFFiNE-based branch with a separate AI modernization direction.
The branch differences are summarized in `branch-differences.md`, and the full
planning document map is in `document-map.md`.

The historical plan has been split into `/docs/ai-modernization/archive/`. The
archive is still useful for traceability, but it is no longer the default
execution entrypoint for future goal tasks.

## Read First

1. `branch-differences.md`
2. `document-map.md`
3. `current-state.md`
4. `next-goals.md`
5. `validation.md`
6. The relevant file under `tracks/`

Read `archive/README.md` only for historical context or for a specific
referenced section.

## Goal

Move LocalMind from an AI chat and diagnostics layer toward an office task
execution system with durable runtime state, auditable repair flows, persisted
support bundles, DB-backed registries, and scope-correct auditable context
memory.

## Working Rule

Do not continue the old pattern of adding deeper read-only diagnostic fields
under support-bundle source evidence unless the user explicitly requests that
exact field.

Future work should prefer vertical slices that create real behavior:

- persistence;
- executable or queued runtime state;
- authorization and audit;
- Admin or user-facing operation surfaces;
- focused container validation.

Native DOCX/XLSX/PPTX/PDF editing is tracked separately in
`docs/office-native/README.md`. Office AI tools must still use the durable Agent
Runtime, authorization, approval, audit, and cancellation semantics defined by
this modernization plan.

## Track Documents

The implemented [Project Native Resources](tracks/project-native-resources.md)
owns Project storage, file trees, independent copies, explicit Workspace
publishing, and migration, superseding older reference-only Project rules.
Its [goal instruction](project-native-resources.goal.md) defines the execution
scope. [Execution and acceptance evidence](project-native-resources.execution.md)
records P1-P6, A01-A22, migration exceptions, backups and runtime verification.

- `tracks/support-bundle.md`
- `tracks/repair-execution.md`
- `tracks/agent-runtime.md`
- `tracks/registries.md`
- `tracks/context-memory.md`
- `tracks/intelligence-workbench.md`
- `tracks/project-native-resources.md`

## Local Documentation Policy

Planning and branch-positioning documents in this directory are local branch
documentation. Updating them does not publish anything to GitHub. Commit, push,
or pull request work must be requested separately.

## Historical Anchors

Use these archive sections as context only:

- section 3.8: Agent Runtime gap;
- section 8.2: Agent Runtime data model sketch;
- P3 office Agent Runtime goal;
- sections around 244+: repair preview/preflight/execution request contracts;
- sections around 450+: support bundle lifecycle/source evidence;
- sections 540-554: latest completed read-only source-evidence placeholders.
