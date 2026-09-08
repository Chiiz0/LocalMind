# Project 工作区导入闭环验证（2026-09-08）

契约：`tracks/project-native-resources.md` 与
`tracks/project-workbench-redesign.md`。

## 实现

- 文件区的“从工作区导入”打开工作区/文件两步选择器，目标是当前 Project 目录。
- 来源工作区须有 `Workspace.Read`；文件列表的 SQL 过滤、运行时复核、提交、
  执行与重试均使用个人文档权限 `projectScope(null)`，已有项目 grant 不代替个人读取权限。
- 文件标明直接导入、申请分享审批或策略禁止复制。现有复制服务继续校验来源
  复制/分享权限、版本、附件归属，并创建 Project 独立资源。
- 工作区存储中的元数据、不完整或不可复制快照不会使整个文件列表失败；列表
  跳过这些来源，伪造其 ID 提交时仍会被拒绝，不创建导入任务或审批请求。
- 复用持久化 Project Agent run/step/result 存储导入意图和回执，无数据库迁移。
  直接复制加入队列；审批经通知处理，数据库恢复任务会在批准后自动排队。
  请求拒绝、过期、撤回不复制；普通任务确认接口不能自批来源分享请求。
- 申请方保留一条“等待他人”Todo，避免访问申请和等待导入 run 重复计数。
  导入记录显示实际复制状态，失败后可复用同一任务重试，不抹除旧回执。
- 修复本地开发代理：仅将同一 loopback Host 的请求 Origin 转为 loopback 后端
  Origin；第三方 Origin、Host 不匹配和远端后端均保持原值，由服务端正常校验。

## 聚焦检查

前端：

```sh
yarn vitest run packages/frontend/core/src/desktop/pages/intelligence/project-workspace-import.spec.tsx packages/frontend/core/src/desktop/pages/intelligence/project-files.spec.tsx
yarn vitest run packages/common/graphql/src/__tests__/project-native-operations.spec.ts
yarn vitest run --config /tmp/localmind-workspace-import-proxy-vitest.config.mts
yarn workspace @affine/graphql build
yarn workspace @affine/i18n build
yarn tsc -b packages/common/graphql packages/frontend/i18n --pretty false
yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false
```

前端交互 12 项与开发代理 4 项通过；覆盖当前目录、两步选择、来源权限提示、
重复提交、网络失败重放、切换来源清除选择、加载失败、重试与打开独立副本。
实际生成的 Project GraphQL 请求 74 项校验通过。导入状态、提交和重试操作
按现有 codegen 约定显式声明 fragment import，避免运行时 Unknown fragment。
GraphQL schema 由完整 AppModule 在 Linux 测试容器中生成，共享类型和 i18n 按仓库流程生成。
前端 core 和后端聚焦测试类型检查通过。后端全量类型检查仍有本轮之前的
`plugins/copilot/mcp/task-query.ts:522` 错误：`waiting_lease` 不属于
`PublicTaskStatus`；本轮没有修改该处。

Linux 使用现有 `localmind_project_native_runner`（`localmind-affine:test`），
将本轮源码同步至 `/workspace`，不构建镜像。
数据库使用一次性 `localmind_workspace_import_20260908`，完整迁移成功。
测试命令（通过 Node 包装器将 `DATABASE_URL` pathname 改为上述隔离库，保留其他字段）：

```sh
NODE_OPTIONS=--import=/workspace/tools/cli/register.js yarn workspace @affine/server test --timeout=5m src/__tests__/copilot/project-workspace-import.e2e.ts
NODE_OPTIONS=--import=/workspace/tools/cli/register.js yarn workspace @affine/server test src/__tests__/copilot/project-import.e2e.ts
```

旧导入/刷新服务 6 项通过。新流程 9 个场景分组回归通过，覆盖来源发现拒绝、伪造 ID、目录目标、直接
导入、通知审批后自动执行、拒绝/撤回/过期零复制、个人权限漂移、失败重试、
共享策略变化、Project 成员移除与非文档快照。一次回归发现默认 ACL 包含 Project grant，
已改为显式个人 ACL；另一次测试在启动阶段触发 AVA 默认 1 分钟超时，改用
`--timeout=5m`，并暂停本轮开发编译降低并发资源占用。

撤回场景还发现运行状态的终态时间可能因时钟回退早于 `updatedAt`。现在取消
时间与状态更新时间使用同一单调下限，遵守数据库 timestamp coherence 约束。
用固定回退时钟重放撤回，连同拒绝、过期共 3 个终态场景通过。

文件列表错误在业务备份恢复出的独立诊断库中复现，异常为
`A document copy requires a structured document snapshot`。修复后同一来源
工作区正常返回 3 个可直接导入的文档。诊断只读列表，队列和邮件使用 mock，
没有对真实用户文件执行导入或发送审批通知。测试库和诊断库验证后已删除。

## 本地运行

业务数据库备份：
`/Users/dev2/Documents/Codex/backups/localmind-workspace-import-20260908/database.dump`。
通过既有 `yarn localmind:sync:backend` 同步后端，8081 使用当前源码开发服务器，
代理后端 3011。静态 3011 Web 不作为本轮前端交付入口。

浏览器前一轮已确认文件区入口可打开，并列出 9 个可见工作区。最终桌面与窄屏
视觉复核未完成：电脑控制工具报告 Mac 已锁定且自动解锁失败，已请求手动解锁。
文件列表修复由隔离数据复现、Linux 行为测试、前端组件与实际 GraphQL 请求
校验覆盖；没有将这些检查宣称为最终浏览器端到端或截图验收。

未 commit、push、创建 PR 或重建镜像。磁盘检查：Images 55.16 GB，Containers
10.52 GB，Volumes 1.15 GB，Build Cache 2.913 GB；未清理业务数据或其他镜像。

## 文件列表加载性能修复（2026-09-08）

2 个可见文件的工作区包含 3 个存储候选项。旧列表逐个解析候选项，反复加载
文档权限、文档元数据和 Office 元数据，并调用带授权写锁的复制检查。
同一备份恢复到隔离库后，三次调用耗时分别为 1904、1946、1218 ms；每次
调用有 12 次单文档权限加载、3 次文档元数据查询、3 次 Office 查询和 2 次
带锁复制权限检查。浏览器通过 8081 代理访问时，测得一次请求为 1269 ms。

修复复用候选查询已经返回的类型和标题，将个人文档 ACL 改为读取前、返回前
各一次批量校验，每批至多并行读取 4 个文档。列表的复制权限预览复用同一
授权判断，但不取得写操作需要的事务锁；提交和实际复制继续使用原有带锁检查。
不增加 ACL 缓存，不放宽读取、分享或审批要求。

修复后同一隔离库三次调用为 618、291、184 ms，中位数从 1904 ms 降至
291 ms。文档权限加载固定为两次批量查询，列表不再执行逐文档元数据查询和
授权写锁。以上为本机当时负载下的样本，文档数量、内容大小及机器负载仍会
影响实际耗时，不作为固定延迟承诺。

经 `yarn localmind:sync:backend` 同步后，8081 页面同一查询的三次实测为
1418、643、683 ms；第一笔发生在后端重启后。后两笔比优化前的 1269 ms
降低约一半，重启后首请求的额外延迟仍存在。临时请求计时仅记录毫秒数，
验证后已移除。浏览器确认原有 2 个文件和权限提示正常显示。

Linux `localmind_project_native_runner`（`localmind-affine:test`）验证命令：

```sh
NODE_OPTIONS=--import=/workspace/tools/cli/register.js yarn workspace @affine/server test --timeout=5m src/__tests__/copilot/project-workspace-import.e2e.ts src/__tests__/copilot/project-import.e2e.ts
```

使用 Node 包装器把 `DATABASE_URL` pathname 改为专用
`localmind_import_perf_tests_20260908`，完整迁移后执行，17 项全部通过。
新增覆盖读取途中撤销个人权限和无授权写锁的已批准副本预览；分享关闭后仍
禁止导入。聚焦类型检查、oxlint、Prettier 与 `git diff --check` 通过。
性能诊断使用独立 `localmind_import_perf_20260908`；两个临时数据库均已删除。
未新增迁移、重建镜像或提交代码。

## 导入结果反馈与 PDF 本地预览修复（2026-09-08）

运行入口为 `http://localhost:8081`，实际开发源码位于
`/Users/dev2/Documents/Codex/2026-07-26/b/LocalMind`。当前任务 worktree
`/Users/dev2/.codex/worktrees/36a8/LocalMind` 不含这版工作区导入功能，
因此本节修复直接落在实际运行源码，未覆盖或搬移另一 checkout 的现有改动。

### 已确认的问题与恢复结果

- Word 导入任务实际已完成，原状态列表默认过滤掉所有完成项，使“已加入队列”
  之后没有直接可见的完成回执。现在显示最新三条任务中的完成项，并可直接打开副本；
  更早记录仍可从导入记录查看。排队与执行中分别显示，幂等提交重放已完成任务时
  也不会再提示“已加入队列”。
- 原 PDF 导入确实在约 11 秒后失败，但旧 worker 既没有记录原异常，也只持久化
  通用 `project_operation_failed`。不能据此确定首次失败的具体原因。
  7,134,795 字节、52 页的原 PDF 可正常解析；在备份恢复出的隔离数据库中，
  同一来源完整复制成功（约 6.85 秒）。本地服务同步后，通过页面重试原任务
  `8fde61d5-69ae-4698-bfec-4cece1719d70` 成功完成，worker attempt 为 2，
  项目副本为 `685da8b1-751f-4d54-8e3f-f715e28f546d`。
  原文没有修改，也没有重新发起审批申请。
- 打开该副本时复现 PDF 预览的 `Failed to fetch`：PDF 工具直接请求后端 3011
  返回的绝对 package URL，没有像 Office state、下载和图片一样使用 8081 开发代理。
  现在 PDF 渲染、搜索、遮盖读取及打印复用现有 `officeAssetUrl`，保持同源鉴权。
  未修改 CORS 或放宽资源权限。浏览器 957 × 906 的当前浅色视口已确认封面、
  缩略图、52 页信息与已保存状态正常显示。
- Worker 现在记录有界、脱敏的异常类型、数据库错误码、调用位置和任务标识；
  不记录异常正文（包括多行正文）。可识别的超时、权限变化、来源失效及事务冲突
  通过现有 `failureCode` 返回，中英文界面给出相应恢复提示。历史通用错误不能倒推
  恢复为真实原因，未知异常仍使用通用错误提示。

### 验证

复用 `localmind_project_native_runner`（`localmind-affine:test`）。使用专用
`localmind_import_repair_20260908` 数据库，与业务库隔离；包装器强制替换
DATABASE_URL 的数据库名，测试初始化和清表仅作用于专用库。

```sh
NODE_OPTIONS=--import=/workspace/tools/cli/register.js yarn workspace @affine/server test --serial --timeout=5m src/__tests__/copilot/project-workspace-import.e2e.ts src/__tests__/copilot/project-import.e2e.ts
NODE_OPTIONS=--import=/workspace/tools/cli/register.js yarn workspace @affine/server test src/__tests__/copilot/project-agent-runtime-error.spec.ts src/__tests__/storage/office-pdf-search.spec.ts
yarn vitest run packages/frontend/core/src/desktop/pages/intelligence/project-workspace-import.spec.tsx
yarn vitest run packages/frontend/core/src/desktop/pages/workspace/office/pdf-tools.spec.ts packages/frontend/core/src/desktop/pages/workspace/office/pdf.spec.tsx packages/frontend/core/src/modules/office/client.spec.ts
yarn workspace @affine/i18n build
yarn tsc -b packages/frontend/i18n --pretty false
```

后端 19 项、前端 13 项，共 32 项通过。覆盖实际队列复制、审批通知、权限漂移、
失败重试、重复任务不重复复制、完成项直接打开、排队/执行/失败状态、PDF 代理 URL、
鉴权请求失败时不启动解析 worker，以及异常多行正文不进入诊断日志。
更改文件的 oxlint、Prettier 与 `git diff --check` 通过。

全量类型检查尚未通过：后端仍有本轮未改的
`plugins/copilot/mcp/task-query.ts:522` 的 `waiting_lease` 类型错误；
前端仍有本轮未改的 26 处错误，主要是 language-menu、Office chat/comments/document
的 i18n 数字参数与生成的 string 参数类型不匹配，以及 spreadsheet 参数缺失。
本轮修改的导入状态与 PDF 文件没有剩余类型错误；不将全量检查报告为通过。

### 本地同步与清理

业务库已备份至
`/Users/dev2/Documents/Codex/backups/localmind-import-repair-20260908/database.dump`
（6,928,412 字节、权限 600）。通过实际运行目录的 `yarn localmind:sync:backend`
完成后端同步和重启，361 条迁移状态一致，无 schema/native 变化；8081 前端由热更新
生效。3011 静态前端不作为本轮前端交付入口。

没有重建镜像、提交、推送或创建 PR。遵循 Project Native Resources、Project
Workbench Redesign 和 Native Office 契约；未改变来源复制审批和独立副本语义。

本次专用诊断库已删除，本次启动的 runner 和测试 Redis 已停止；临时数据库
连接文件和 PDF 测试副本已清理，业务备份保留。结束时 Docker 磁盘状态为
Images 55.27 GB、Containers 10.62 GB、Volumes 1.15 GB、Build Cache 2.913 GB。
