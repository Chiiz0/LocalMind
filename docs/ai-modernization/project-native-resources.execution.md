# Project Native Resources 实施与验收记录

契约：[Project Native Resources](tracks/project-native-resources.md)。
P1-P6 实现与 A01-A22 验收已完成。本记录区分最终结果、授权例外和历史阶段快照。

## 最终结果（2026-09-06）

- 原生资源、文件树、无 Workspace 会话、Office AI、显式发布/更新、来源刷新、旧引用迁移和旧任务恢复均已实现。
- 复用 `localmind-affine:test` 完成 Linux 验证。当前 `localmind_affine_server` 通过仓库 `localmind:sync:all` 同步至 353 个迁移，地址 `http://localhost:3011`，未重建镜像。
- 最终真实备份恢复库和运行环境均发现 13 条旧引用：2 条合法复制完成，11 条保留 `waiting_for_authorization`，没有代授权复制。恢复库核验 14 个附件，中断重跑无重复，Workspace 指纹不变。
- 3 条真实旧请求：恢复演练中 2 条保持撤回、1 条恢复内部草稿；当前业务环境中 2 条保持撤回、1 条保留待原操作者恢复的 `pending` 状态，没有恢复外部写入。
- 当前业务全局 Project BYOK 未配置；迁移没有复制 Workspace 密钥。3011 真实发送验证明确报错且不回退。隔离实例使用正式全局配置与真实模型完成了原生创建和 Office 审批写入。
- 现有改动已保留，没有 commit、push、PR、远端发布、子代理或业务数据清理。

## 初始状态

- 2026-09-06 启动完整 P1-P6 / A01-A22 goal。
- 保留启动时的全局 Project BYOK、Prisma、GraphQL、Admin、Intelligence 和文档改动。
- 业务服务在 `http://localhost:3011`；既有测试镜像 `localmind-affine:test` 可用。
- 初始 Docker：镜像 53.71 GB、容器 9.062 GB、卷 1.15 GB、构建缓存 2.913 GB。
- 未重建镜像，未同步业务运行环境，未修改业务数据库。

## 修改前归属依赖

| 边界            | 现有入口与依赖                                                                                                                              | 实施方向                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Project 模型    | `AiContextProject`、`AiContextProjectMember`、`AiContextProjectDoc`，`CopilotContextMemoryModel`、`IntelligenceWorkbenchAuthorizationModel` | 独立项目资源、父子目录、成员授权；旧引用保留迁移身份      |
| 文档与版本      | `Snapshot`、`Update`、`SnapshotHistory`、`PgWorkspaceDocStorageAdapter`、`DocReader`、`DocWriter`                                           | 项目命名空间与不可变内部版本，复用 Yjs/BlockSuite         |
| Blob            | `Blob` 的 Workspace 复合主键，`WorkspaceBlobStorage`、`StorageRuntimeProvider`                                                              | 独立项目 Blob 记录与对象键，每次访问检查项目成员          |
| 编辑同步        | `SyncGateway`、`DocStorageAdapter`、`@affine/nbstore` 的 `SpaceType`                                                                        | 明确 project 类型及鉴权，不伪造 Workspace                 |
| API             | `CopilotType`、`IntelligenceWorkbenchResolver`、`CopilotDocumentOperationResolver`                                                          | 项目资源 API 与明确的所有者引用，保留旧 Workspace API     |
| 索引与上下文    | Workspace chunks、`CopilotContextModel`、来源 ledger、project grants                                                                        | 项目资源查询及来源证据独立授权，旧证据不改写              |
| Native Office   | `OfficeArtifact`、`OfficeRevision`、`OfficeCommandRequest` 的 Workspace/Blob 外键；`core/office/*`                                          | 正式扩展归属约束，复用四类原生编辑与命令引擎              |
| 会话            | `AiSession.workspaceId`、`WorkbenchConversation`、`useWorkbenchHost`、全局 Project BYOK                                                     | 项目会话不依赖 Workspace 成员资格，凭据继续由全局配置解析 |
| Worker 与副作用 | `AiAgentRun/Step/Timeline/ExecutionResult`、`CopilotDocumentOperationService`、MCP delegation                                               | 独立内部保存与显式外部操作，保留审批/租约/幂等/审计       |
| 外部目标        | `DocumentDestinationService`、`WorkspaceOrganizationService`、copy service                                                                  | 层级查询与目标实时 ACL，精确版本比较与独立复制            |

## 阶段

| 阶段             | 状态 | 证据                                                                                                  |
| ---------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| P1 资源基础      | 完成 | Project/Yjs/Blob/Office 独立归属、不可变版本；HTTP/GraphQL/realtime 拒绝路径和零 Workspace 工作流通过 |
| P2 授权与目录    | 完成 | 两普通成员协作、64 层树、10000 目录、分页搜索、版本并发、回收恢复、来源复制审批通过                   |
| P3 原生界面与 AI | 完成 | 人工编辑、真实模型创建、持久上下文、原生 Agent Runtime、Office AI 撤回及批准、完成刷新通过            |
| P4 显式对外操作  | 完成 | 七类资源发布、两个 Workspace 独立副本、精确更新、逐级建目录、断网与重启恢复、冲突和实时 ACL 通过      |
| P5 升级兼容      | 完成 | 最新真实备份升级至 353 迁移，引用与旧任务对账、附件校验、中断重跑和来源刷新通过                       |
| P6 集成验收      | 完成 | Linux、桌面/窄屏浅深主题、最终备份恢复、现有脚本同步、3011 浏览器复验与文档同步完成                   |

## 验收矩阵

测试路径以下按 `packages/backend/server/src/__tests__/` 缩写。浏览器脚本与截图的
原始目录分别为 `/tmp/localmind-project-native-*.cjs` 与
`/tmp/localmind-project-native-qa/`，最终无凭据副本位于备份目录 `acceptance/`。

| 编号 | 结果 | 证据与边界                                                                                                                                                                 |
| ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | 通过 | `models/project-resource.spec.ts` 与 `copilot/project-session.e2e.ts`；零 Workspace 成员真实创建、保存、重开和模型生成，`model-reopened.png`                               |
| A02  | 通过 | `project-context.e2e.ts`、前端上下文/Intelligence 测试；`context-browser.cjs` 验证文档/附件跨项目隔离，viewport 与 3011 总览无聊天                                         |
| A03  | 通过 | 真实模型在项目 `5e001c8f-0a08-43b5-b172-76b9f93753a5` 创建 `test1/文档a`，返回真实 ID；`model-result.png`；模型测试断言 Workspace/snapshot/Blob 零新增                     |
| A04  | 通过 | `tree-browser.cjs`、`canvas-browser.cjs`、`external-browser.cjs`；目录新建/嵌套/重命名/移动/排序/回收/恢复与内容重开，外部副本独立；后端重启恢复及 3011 保存复验           |
| A05  | 通过 | `project-resource.spec.ts` 两普通成员顺序编辑并从全新 Yjs 实例重读；`project-resource-api.e2e.ts` 验证成员撤销后 GraphQL、HTTP、realtime、Blob 拒绝；搜索/归档拒绝同样覆盖 |
| A06  | 通过 | `project-publication.e2e.ts` 的目标 ACL/独立 ID/格式断言；普通成员真实发布以及 3011 回执 `94a0bd7c-03cf-46d4-abcd-f45a390141d4`                                            |
| A07  | 通过 | 真实发布 W1/W2 后仅更新 W1 精确 ID；`publication-browser.cjs` 与 `external-browser.cjs`；服务端验证原目标 grants 保持不变                                                  |
| A08  | 通过 | `external-browser.cjs` 真实编辑 W1，内部版本及 W2 不变；`project-import.e2e.ts` 显式刷新新增内部版本、保持 ID、来源权限/版本冲突拒绝及重放                                 |
| A09  | 通过 | 普通成员发布/更新，无 Owner 门槛；publication API/worker 验证无权限、成员/受众漂移和事务失败时零外部写入，既有 ACL 保留                                                    |
| A10  | 通过 | `project-import.e2e.ts` 仅可读及旧 read grant 均拒绝复制；明确审批后才复制正文/附件并保存来源审计                                                                          |
| A11  | 通过 | import 测试覆盖独立内部编辑、来源授权撤回后已合法副本保留、后续刷新/重新导入重新检查权限                                                                                   |
| A12  | 通过 | `project-destination.e2e.ts` 10000 目录、64 层和跨目录游标拒绝；模型树深度/分页测试；真实面包屑、当前目录、搜索和返回上级                                                  |
| A13  | 通过 | 真实逐级建目录、双击和取消后保留；publication 目录测试验证幂等、重名、独立审计和实时授权撤回                                                                               |
| A14  | 通过 | 过期/取消/失败测试；`final-browser.cjs` 断网后原确认仍等待，重启 runner 后以同一请求 `3a34fdd7-759d-4550-953d-fd7b68ae92ef` 完成，回执重开一致                             |
| A15  | 通过 | publication 测试覆盖预览后源变化、批准后目标变化、同名不同请求、准确目标 ID 和不可变审计；真实两目标更新预览 `publication-update-preview.png`                              |
| A16  | 通过 | 模型并发保存/移动/重命名版本检查，祖先循环、跨 Project parent/cursor 拒绝，数据库约束参与验证                                                                              |
| A17  | 通过 | 空库全部 353 迁移；最新业务备份在独立 `_upgrade_final_20260906` 恢复升级，13 引用/14 附件及旧任务对账，中断重跑和原 Workspace 指纹核验                                     |
| A18  | 通过 | import 测试同来源到两个 Project 得到独立 ID；legacy 测试同名请求保留身份、未知来源拒绝、冻结附件和历史会话隔离；真实旧 3 请求对账                                          |
| A19  | 通过 | 文档/画布、Docs/Sheets/Slides/PDF 和附件分别通过项目内打开保存重开与真实发布；四格式/附件导入和访问隔离经 Linux 原生引擎测试；PDF/画布像素检查非空                         |
| A20  | 通过 | `viewport-browser.cjs` 的 1440x1000 / 390x844 浅深主题、文件树/Office/选择器/确认及键盘检查；空名称 disabled、断网 error/recovery；截图人工检查无重叠与横向溢出            |
| A21  | 通过 | 全局 BYOK 9 项与 Host/Office 合计 80 项回归、335-to-353 凭据保留升级；普通 Workspace/跨 Workspace 独立复制回归；真实模型只用全局配置，3011 未配置拒绝且无回退              |
| A22  | 通过 | Project Agent Runtime 事务回执/租约交接/旧 worker 拒绝/取消/成员撤销；持久工具重放、来源 ledger 不可变，旧 MCP/Workspace 委托无法扩大 Project 能力或代确认                 |

## 最终命令与运行证据

最新完整 Linux 集成为 62 项通过；之后 Office/全局 BYOK/Host 80 项、两普通成员
协作等资源模型 13 项均通过。各组存在重叠，不相加为独立测试总数。

```sh
docker exec -e REDIS_SERVER_HOST=localmind_project_native_final_redis -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace localmind_project_native_runner node --input-type=module -e 'import {spawnSync} from "node:child_process";const u=new URL(process.env.DATABASE_URL);u.pathname="/localmind_project_native_final_tests_20260906";const files=["models/project-resource.spec.ts","models/project-agent-runtime.spec.ts","copilot/project-resource-api.e2e.ts","copilot/project-import.e2e.ts","copilot/project-office.e2e.ts","copilot/project-context.e2e.ts","copilot/project-destination.e2e.ts","copilot/project-publication.e2e.ts","copilot/project-session.e2e.ts","copilot/project-legacy.e2e.ts","copilot/copilot-office-runtime.spec.ts"].map(f=>"src/__tests__/"+f);process.exit(spawnSync("yarn",["workspace","@affine/server","test",...files],{env:{...process.env,NODE_ENV:"test",DATABASE_URL:u.toString()},stdio:"inherit"}).status ?? 1);'
yarn tsc -b packages/backend/server/tsconfig.json --pretty false
yarn tsc -b packages/frontend/core/tsconfig.json --pretty false
yarn tsc -b packages/frontend/admin/tsconfig.json --pretty false
yarn vitest run packages/common/graphql/src/__tests__/project-native-operations.spec.ts packages/frontend/core/src/desktop/pages/intelligence/index.spec.tsx packages/frontend/core/src/desktop/pages/intelligence/project-chat-config.spec.tsx packages/frontend/core/src/desktop/pages/intelligence/project-publications.spec.tsx packages/frontend/core/src/desktop/pages/intelligence/project-tasks.spec.tsx packages/frontend/core/src/desktop/pages/intelligence/project-source-refresh.spec.tsx packages/frontend/core/src/desktop/pages/intelligence/project-legacy.spec.tsx packages/frontend/core/src/blocksuite/ai/components/ai-message-content/stream-objects.spec.ts packages/frontend/admin/src/modules/ai/project-byok.spec.tsx
yarn workspace @affine/server prisma format
docker exec -w /workspace localmind_project_native_runner yarn workspace @affine/server prisma generate
node /tmp/localmind-project-native-source-check.cjs
node /tmp/localmind-project-native-final-backup.cjs
node /tmp/localmind-project-native-final-restore.cjs
LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_project_native_runner LOCALMIND_DATABASE_BACKUP=/Users/dev2/Documents/Codex/backups/localmind-project-native-final-20260906T194609Z/database.dump yarn localmind:sync:all
docker exec localmind_affine_server node node_modules/prisma/build/index.js migrate status
node /tmp/localmind-project-native-runtime-browser.cjs
git diff --check
docker system df
```

前端/GraphQL 上述组合为 9 文件、120 项通过。改动文件的 `yarn lint:ox` 和
`yarn prettier --ignore-unknown --check` 通过。Prisma、GraphQL、i18n 均使用
正式生成流程；70 项 operation 测试验证实际发送文本含全部依赖 fragment。

备份路径：`/Users/dev2/Documents/Codex/backups/localmind-project-native-final-20260906T194609Z/`。
备份时短暂停止本地服务，完成后立即恢复；目录 0700、文件 0600。

| 文件            | 字节     | SHA-256                                                            |
| --------------- | -------- | ------------------------------------------------------------------ |
| `database.dump` | 6463533  | `33bcb2ef36a88df627c49334c774413d7dd165d39093220616137afa59670357` |
| `files.tar.gz`  | 15198023 | `877cc74375c251f9522d27e46d3ad0e3799997970eab6c076cfe633ed3d55b44` |

文件归档包含 `.docker/selfhost/.env`、`storage`、`config` 和 `enterprise-cli`，
不以活数据库目录替代 `pg_dump -Fc`。旧备份恢复使用 pre-data、固定校验函数
search_path、data/post-data 的顺序，再执行正式迁移和回填；macOS 扩展属性
被 Linux tar 忽略的提示不影响文件字节核验。

同步首次被 Prisma Client 来源 hash 保护拦截，未写业务容器。原因是 Prisma
生成器规范化了 schema 排版与索引声明顺序；正式 `prisma format`、生成并核对后，
源码与 Client 的 schema SHA-256 均为
`891426d183346489cbb0e069e067238091ce97ddd1692cfe4e2abfc60c9f92b9`。
保留了来源校验，没有绕过脚本保护或手工改写 Client。

同步与自动回填前后，15 Workspace、20 成员、186 snapshots、0 updates、142 Blob
数量一致，snapshot 指纹 `7a2ac65c9b7d4479ed62361e664d07b4`、Blob 指纹
`b42ee0dc3d24745d8164995050196a86` 不变。随后 3011 验收仅向独立验收项目及既有
QA Workspace 新增测试资源，没有修改既有业务正文。

3011 真实浏览器验收项目为 `082864c8-51fc-4894-9dfb-0fff2961ed74`，内部文档
`e29ce9a0-fbe5-49b5-b958-eb8f37cfa00d`，发布为外部独立文档
`660ac11f-4ca8-4ff0-98fc-c903e28e6ddd`。Docs 编辑保存重开，PDF 535x692
canvas 检测到 862 个深色像素，窄屏深色无横向溢出，pageerror 数量为 0。

## 例外与限制

- 11 条历史引用须获得合法来源复制/分享授权后恢复；不能把该受控状态记为复制失败或绕过授权完成。
- 业务环境 1 条旧等待请求仍由原操作者决定恢复或撤回，原稿和旧状态保留；恢复演练已证明合法内部草稿可幂等恢复。
- 业务全局 Project BYOK 为空，管理员需在 `/admin/ai/config` 明确配置后才能使用 Project AI；隔离真实模型验收已完成，没有复制或回退使用 Workspace 凭据。
- Core 和 Admin 的前端引用类型检查均报告未改动的 `blocksuite/affine/all/src/__tests__/database/conversion-preservation.unit.spec.ts` 同一组 6 条 `DefaultViewDataType` 基线错误。后端检查通过。
- Web/Admin bundle 成功，保留资源体积和 Browserslist 数据陈旧警告；没有为消除警告升级依赖。原生 Office 格式保真限制沿用 Office track。
- 早期组合回归出现一次 session 取消接口错误；后续单项和最新完整回归通过，未据此宣称已定位原因。早期 Redis 关闭阶段出现过 `EPIPE`，最新 62 项退出码为 0。
- 本次只同步现有容器，未重建 `localmind-affine:local`；重新创建部署仍需按固定镜像流程构建当前源码。没有删除镜像、缓存、volume 或业务数据。
- 最终 `docker system df`：Images 54.79 GB、Containers 10.15 GB、Local Volumes 1.15 GB、Build Cache 2.913 GB。没有执行 Docker build 或 prune。
- 无凭据验收归档位于最终备份目录的 `acceptance/`：39 张截图、58 个证据/脚本文件及逐文件 SHA-256 清单。最终 216 个后端/common 相关文件与 runner 一致，301 个变更文本文件未发现冲突标记，3011 HTTP 返回 200。

## 历史过程记录

以下为各阶段当时的执行快照，其中“尚未同步”“待完成”等只描述当时状态，最终
结论以本文件上方的阶段表、验收矩阵和运行证据为准。

## 已执行的聚焦验证

- 独立库 `localmind_project_native_20260906` 已应用 342 个迁移，包含 Office 归属、请求/附件证据、来源复制审批、无 Workspace 会话及备份恢复校验函数修复。
- 容器 `localmind_project_native_runner` 复用固定 `localmind-affine:test`，Redis 使用独立 `localmind_project_native_redis`。
- 四种 Office 原生格式均已验证真实对象存储、导入、编辑、重开、命令重放、历史不可变、回收站与成员撤销；未使用 Workspace 所有者替代项目归属。
- 以下命令通过 14 项测试（模型/API/Office），不等于 A01-A22 完整验收：

```sh
docker exec -e REDIS_SERVER_HOST=localmind_project_native_redis -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace localmind_project_native_runner yarn workspace @affine/server test src/__tests__/models/project-resource.spec.ts src/__tests__/copilot/project-resource-api.e2e.ts src/__tests__/copilot/project-office.e2e.ts
```

- Workspace Office 的 API、服务、批量命令共 17 项回归及四格式原生 AI 引擎 4 项回归已通过。
- `yarn tsc -b packages/backend/server/tsconfig.json --pretty false` 通过；后续变更仍需重跑。
- 来源导入、原生会话、成员撤销、附件证据、内部工具创建/重放/冲突和来源并发写锁共 8 项 Linux 测试通过：

```sh
docker exec -e REDIS_SERVER_HOST=localmind_project_native_redis -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace localmind_project_native_runner yarn workspace @affine/server test src/__tests__/copilot/project-session.e2e.ts src/__tests__/copilot/project-import.e2e.ts
```

- 旧 ConversationHost 授权测试已补齐测试替身；Host Services 和全局 Project BYOK 回归通过。
- 原生工具的平台写入开关、无本地 read proof 的持久写回执重放，以及改变请求内容的拒绝均已验证。
- 前端聊天运行时、消息传输和 Intelligence 共 80 项测试通过，包括原生会话 API、跨项目草稿/附件隔离及 Office 附件字节/MIME 保留：

```sh
yarn vitest run packages/frontend/core/src/blocksuite/ai/runtime/chat/runtime.spec.ts packages/frontend/core/src/blocksuite/ai/runtime/request/service.spec.ts packages/frontend/core/src/desktop/pages/intelligence/index.spec.tsx
```

- 后端 TypeScript 检查通过。前端引用构建仍报告未改动文件 `blocksuite/affine/all/src/__tests__/database/conversion-preservation.unit.spec.ts` 的 6 条 `DefaultViewDataType` 相关基线错误；本次引入的类型错误已修复。
- GraphQL/Prisma/i18n 使用正式生成流程；新增 Project 会话历史、删除 API 和会话显式 Project 归属。

## 浏览器阶段证据

## P3 后续实现记录

- 原生 Agent Runtime 已支持 Project 所有者、冻结执行输入、审批步骤、租约交接、取消、条件终态和不可变执行回执。新增 Project task 查询、批准与取消 API，并通过正式 GraphQL 生成流程更新客户端。
- Project Office 复用四类原生编辑引擎，工具已接入无 Workspace 会话；读取版本后准备审批，worker 执行时重新验证成员、来源、命令 Blob、版本和预览指纹。
- `20260906110000` 至 `20260906150000` 已应用于隔离库，累计 347 个迁移。包含运行时归属/回执约束、全文搜索、Office 来源证据和 Office 索引版本。
- 原生 Office 单命令、原子批量命令、等待审批、取消、冲突、成员撤销和重放回执已通过 Linux 验证。已知原生工具的拒绝结果不再错误污染会话来源审计。
- Office 导入/编辑同步更新有界正文索引；旧资源通过 `indexer.projectResources.index` 队列分页回填，重查成员并比较版本，旧版本不会覆盖新索引。PDF 索引目前覆盖原生语义模型的标题、主题、注释和表单值。
- 以下命令通过 16 项测试，包括四格式 Office、真实批量写入、索引回填与项目目录模型：

```sh
docker exec -e REDIS_SERVER_HOST=localmind_project_native_redis -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace localmind_project_native_runner yarn workspace @affine/server test src/__tests__/copilot/project-office.e2e.ts src/__tests__/models/project-resource.spec.ts
```

- 前端新增项目任务状态/审批/取消列表和 Office 聊天、选区及完成回执刷新；尚未完成本批界面的真实浏览器验收。原有聊天/消息传输/Intelligence 80 项回归通过。
- 后端曾在 Office 工具接入后通过 TypeScript 检查。最新索引与上下文变化需继续验证。前端本批引入的类型错误已修复，仍有已记录的 6 条 BlockSuite 基线错误。
- 正在建设 `ProjectChatContext` 的持久文档选择与附件上下文；`20260906160000_project_chat_context` 已新增但尚未在 Linux 应用或测试。
- P4、P5、完整 A01-A22、真实模型生成及最终备份同步仍未完成，3011 业务运行环境未同步。

## 浏览器阶段证据（此前）

- 独立预览 `http://localhost:8081`，隔离 API 映射 `http://localhost:3013`，未同步 3011 业务环境。
- 零 Workspace 成员账户真实登录、新建 Project、目录及文档，输入正文、自动保存、刷新重开通过。
- 无 Workspace 聊天入口已显示；真实发送创建的会话 `workspaceId = null`，绑定所选 Project。
- 隔离实例未配置全局 Project BYOK，因此实际模型生成被拒绝。不得据此宣称 A01/A03 的真实 AI 生成已通过。
- 1440x1000 和 390x844 浅/深主题的聊天页无运行错误或横向溢出；文件树全部交互、Office/画布、位置选择器、发布回执仍需完整视觉验收。
- 截图保留在 `/tmp/localmind-project-native-qa/`；脚本 `/tmp/localmind-project-native-browser.cjs` 和 `/tmp/localmind-project-native-chat-browser.cjs`。
- 后端测试会清理隔离测试库；恢复浏览器验证前须重新运行 `/tmp/localmind-project-native-seed.ts`，不能复用已被清库的测试账户。

## 2026-09-06 续接记录

- P4 界面完成项目切换隔离、迟到目录响应防护、目录任务回执轮询与失败恢复，发布和任务界面 11 项测试通过。
- 发布预览显示目标、版本与有界内容差异，普通文件以独立 Blob 和 Workspace 附件载体发布。更新不会覆盖含普通正文的目标。
- PDF 正文提取复用 PDF.js，限制 64 MB、500 页、250000 字符和 15 秒；已接入导入、索引回填、编辑和聊天上下文。超限保留元数据索引，真实 PDF 测试通过。
- P5 新增迁移模型、逐次不可变审计、原操作者及当前重试操作者、租约、恢复/取消/申请权限 API 与界面。`doc.projectResources.migrate` 每批发现 50 条、排队 20 条，按原操作者实时来源复制权限回填。
- 导入、版本、证据和旧引用切换使用同一事务。完成迁移必须关联真实导入审计；旧 Project 外部 sink 已拒绝并记录拒绝证据。
- 隔离测试库和真实恢复库均已升级至 352 个迁移。恢复库尚未执行真实回填，不能据此标记 A17 通过。
- 最近 Linux 验证：发布/目录/运行时 14 项、发布/Office/上下文 14 项、发布 8 项、PDF 1 项、迁移和来源导入 7 项通过；测试清库逻辑修正为仅保留 `_prisma_migrations` 和 `_data_migrations`。
- 最新后端类型检查通过；前端仅有此前记录的 6 条 BlockSuite 基线错误。后续修改仍需复查，P3/P5/P6 和完整 A01-A22 未完成。
- 3011 仍未同步，未重建镜像，未直接写业务表。最终备份、运行同步及 3011 复验仍必须执行。

## 恢复库实际回填结果

- 已将原备份内的 Blob 恢复至 runner 独立路径 `/tmp/localmind-project-native-restore/.docker/selfhost/data/localmind/storage`，只在 `localmind_project_native_upgrade_20260906` 执行回填。
- 13 条真实旧引用全部发现：2 条完成，11 条 `waiting_for_authorization`。沿用原操作者且没有管理员代授权；异常条目继续保留原身份与恢复入口。
- 成功副本逐一核验内部版本、原来源指纹、导入审计和 14 个附件。一次处理一项后中断扫描再继续，以及完成任务重放，均未新增副本或改变已完成记录。
- 回填前后 Workspace snapshots、updates、Blob 和 Office 记录的数量及有序指纹完全一致。
- 精确命令：

```sh
docker exec -e PROJECT_RESTORE_STORAGE=/tmp/localmind-project-native-restore/.docker/selfhost/data/localmind/storage -e REDIS_SERVER_HOST=localmind_project_native_redis -e NODE_ENV=test -w /workspace localmind_project_native_runner node --import ./tools/cli/register.js --input-type=module -e 'const u=new URL(process.env.DATABASE_URL);u.pathname="/localmind_project_native_upgrade_20260906";process.env.DATABASE_URL=u.toString();await import("./packages/backend/server/src/__tests__/copilot/project-resource-backfill-restore.smoke.ts");'
```

- 本批新增显式来源刷新 API/界面，保留内部 ID 和历史，同时冻结项目/来源版本。文档、画布、普通文件和原生 Office 复用现有引擎；冲突、来源复制拒绝和重复响应测试通过。
- `project-import.e2e.ts` 与 `project-publication.e2e.ts` 共 17 项 Linux 测试通过。空画布包装结构与含元素画布的文件覆盖保护已验证。
- A17 仍需最终 schema 下的升级复核与完整旧任务对账；A01-A22 尚未全部通过，3011 未同步。

## 最新集成与模型证据

- 独立空库 `localmind_project_native_final_tests_20260906` 已应用全部 353 个迁移；使用独立 Redis 的模型、资源 API、导入、Office、上下文、目录、发布、会话与旧任务恢复共 58 项 Linux 测试通过。退出阶段有 ioredis `EPIPE` 关闭警告，退出码 0。
- 真实浏览器发现新增 GraphQL operation 缺少 fragment 导入；17 个 operation 已补齐 `#import` 并通过正式生成。实际发送 operation 文本的 70 项验证通过。
- 修复工具完成回调将 task 作为 SWR 项目缓存、导致退出当前项目的问题；未解析查询保留当前 URL，Intelligence 17 项测试通过。历史任务界面 5 项通过。
- 隔离实例已通过正式配置服务加载全局 Project BYOK，并执行真实模型 probe。零 Workspace 成员账户调用真实 `gpt-5.6-sol` 模型创建 `test1/文档a`，返回真实目录及文档 ID，刷新重开正文可见；会话 `workspaceId=null`，来源为 `byok_project_global`。没有运行时凭据回退。
- 真实创建 Project `5e001c8f-0a08-43b5-b172-76b9f93753a5`，目录 `3c759efb-d40b-44b1-bbcd-150fed8b46cb`，文档 `8e53c3dd-4a75-45db-87da-c3915e75189c`。截图 `/tmp/localmind-project-native-qa/model-result.png` 与 `model-reopened.png`。
- 四种原生 Office 均通过真实上传、人工编辑、保存与刷新重开。PDF canvas 像素检查通过，截图 `office-docs-reopened.png`、`office-slides-reopened.png`、`office-pdf-reopened.png`。
- 原生资源打开后占满工作区，Office 编辑与 AI 聊天保持可用宽度。真实 Sheets AI 请求撤回 `35c0bb12-6a4c-4d14-96ad-f21a709359e7` 后未写入；批准 `dee0e770-a71f-4864-b686-571a34fe76ca` 后生成 v5、编辑器自动刷新，重开值为 `Project approved AI value`。截图 `office-ai-cancelled.png`、`office-ai-approved.png`。
- Office AI 读取支持显式 `selector:null`，避免严格工具 schema 中无 ID 时无法开始读取；历史参数错误缺少版本证据时不再显示读取成功。最新源码的 Office runtime 4 项 Linux 测试通过，前端结果与上下文 10 项通过。
- 上下文搜索的 StrictMode effect 重放中止问题已修复，真实文档选择、附件上传、重开、跨项目隔离及移除全部通过。`project-chat-config.spec.tsx` 与 Intelligence 共 19 项通过。
- 普通项目成员 `d5162525-976a-48f1-baef-d8ae964136d3` 已通过逐级创建文件夹、双击提交、取消后保留目录、重新选择与搜索；发布到两个独立 Workspace，再按准确目标 ID 更新 Workspace1。全部四种 Office 也已真实发布，回执保留于 `/tmp/localmind-project-native-publisher.json`（含验收凭据，不应公开）。连续快速写入触发限流时内部内容与待确认状态保留，后续发布成功。
- 文件树真实浏览器通过新建、嵌套、重命名、移动、排序、回收、恢复及重开；画布绘制笔迹保存至 v3，重开像素检查通过；普通附件上传下载字节一致。
- 最新后端 tsc 通过；前端仍仅有 6 条 BlockSuite `DefaultViewDataType` 基线错误。GraphQL operation 测试的类型收窄已修复，70 项通过。
- runner 采用复制源码；已逐文件核对 216 个相关后端/Office/GraphQL 改动与工作区 SHA-256 完全一致。
- P6、完整 A01-A22、最终备份同步仍未完成。3011 尚未同步，未重建镜像。

## 真实旧库备份与恢复

- 恢复库已继续升级至 353 个迁移，包含旧 Project 操作恢复约束。真实 3 条旧请求对账：2 条已撤回保持撤回，1 条等待请求恢复为项目内部草稿；原正文、操作者、原状态不变，Workspace 数据指纹不变，重复恢复无新副本。
- 新增历史任务恢复/撤回、独立旧会话历史界面与 GraphQL；`project-legacy.e2e.ts` 4 项 Linux 测试通过，覆盖冻结附件、未知来源拒绝及历史会话隔离。
- 一次组合回归中 Project session 取消接口出现内部错误，随后单项和完整 7 项 session 测试通过；尚未定位偶发失败，最终回归继续关注，不能视为已修复。

- 业务库只读备份：`/Users/dev2/Documents/Codex/backups/localmind-project-native-20260906T1435Z/database.dump`，约 6.2 MB，权限 0600。
- Blob、配置、`.env` 和企业 CLI 数据备份：同目录 `files.tar.gz`，约 14 MB，权限 0600；目录权限 0700。
- SHA-256：数据库 `897b8308c32c5d02096144af6a78667156c27482fbba803c30ae594a2265da30`；文件归档 `d85f897fc9e0f499f2785c2ff7e5819763e358f12a1b661aaa28f7bef2632f1c`。
- `pg_dump -Fc` 从业务库生成，业务库仍为 335 个迁移；没有直接写业务表、修改业务配置或同步业务容器。
- 首次恢复到 `localmind_project_native_restore_20260906` 时，旧 Agent Runtime SQL 校验函数在 `pg_restore` 清空 `search_path` 后无法解析其嵌套函数。失败副本保留，未覆盖业务数据。
- 新增迁移 `20260906100000_restore_validator_search_path`，为相关 5 个互调校验函数固定 `pg_catalog, public`。旧备份采用 pre-data -> 应用该函数修复 -> data/post-data 的分段恢复。
- 恢复库 `localmind_project_native_upgrade_20260906` 完整恢复成功，并通过 `yarn workspace @affine/server prisma migrate deploy` 从 335 升至 342 个迁移。
- 升级后保留 6 个项目、13 条旧引用、1,755 条 Agent Run，尚未进行来源回填，内部资源数为 0。已合法复制、权限不足、旧队列阻断及全文/附件对账仍待 P5 完成。
- 备份恢复尚未等同 A17 通过；最终同步前需基于最终 schema 重新演练，并取得最新业务备份。
- 当前 Docker：镜像 53.94 GB、容器 9.295 GB、卷 1.15 GB、构建缓存 2.913 GB。未重建镜像，未删除 volume 或业务数据。
