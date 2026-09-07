# AGENTS.md

> 本文件是给在本仓库中工作的 AI 与自动化 agent 的根级导航文档。它说明
> LocalMind 的产品方向、AFFiNE 上游关系、主要代码边界、必读文档、验证方式
> 和交付约束。子目录中若存在更具体的 `AGENTS.md`，应同时遵守；冲突时以离
> 当前文件更近的规则为准。

---

## 1. 仓库总览

LocalMind 基于 AFFiNE 的 local-first 文档、画布、同步、桌面端和自托管基础，
在其上建设可审计、可持久化、可执行的 AI 办公工作区。它不是简单的 AFFiNE
换皮分支，也不应继续堆叠只有展示价值的只读诊断字段。

LocalMind 原生 Office 子系统与 BlockSuite Page/Edgeless 并列建设 Docs、Sheets、
Slides 和 PDF 资源类型；它们共享 LocalMind 平台能力，但不得把 OOXML/PDF 的
编辑状态强行转换或塞入普通 BlockSuite 页面模型。其 source of truth 是
`docs/office-native/README.md`。

Project 原生资源已实现，产品及验收契约的 source of truth 是
`docs/ai-modernization/tracks/project-native-resources.md`。Project 拥有独立文档
和文件树，默认内部保存不属于任何 Workspace；只有用户明确要求才发布或更新
指定 Workspace 的独立副本。成员默认内部读写，对外操作按目标 ACL，导入按
来源复制/分享权限。该契约覆盖旧的共享引用直接写回语义，不能用隐藏 Workspace
替代项目原生存储。

新增 LocalMind AI 能力通常至少应落到以下一项：

- 持久化的运行状态或业务状态；
- 可执行或可排队的行为；
- 明确的授权、审批与审计历史；
- Admin 或用户可操作的界面；
- 能在 Linux 容器中证明行为的聚焦验证。

顶层目录：

| 目录                                 | 职责                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `packages/backend/server/`           | NestJS 服务端、GraphQL/API、Copilot、队列、存储、Prisma 与数据迁移 |
| `packages/backend/native/`           | 服务端使用的 Rust/N-API 原生能力                                   |
| `packages/frontend/core/`            | Web/桌面主产品壳、工作区、编辑器集成与用户侧 AI 体验               |
| `packages/frontend/admin/`           | 自托管 Admin 与 LocalMind AI 运维界面                              |
| `packages/frontend/apps/`            | Web、Electron、Android、iOS 等应用入口                             |
| `packages/frontend/component/`       | 跨前端复用的组件与设计系统能力                                     |
| `packages/common/`                   | GraphQL、infra、auth、env、realtime、存储等共享包                  |
| `blocksuite/`                        | 文档编辑器、画布、数据视图和 BlockSuite 基础                       |
| `services/iscp-controller/`          | ISCP 控制器及相关 Go 服务代码                                      |
| `tests/`                             | 跨包、桌面、自托管、云端和 BlockSuite 集成测试                     |
| `tools/`, `scripts/`                 | Monorepo CLI、生成、构建、发布和开发辅助工具                       |
| `docs/`                              | AFFiNE 继承文档与 LocalMind 分支文档                               |
| `.agents/skills/`, `.claude/skills/` | 仓库内已有的专项 agent 工作流                                      |

核心技术栈包括 Node.js 22、Yarn 4、TypeScript、React 19、NestJS、GraphQL、
Prisma/PostgreSQL、Redis/BullMQ、Yjs/BlockSuite、Electron、Capacitor、Rust
原生模块和 Go 服务。

---

## 2. 上游与分支关系

- `origin`：`Infinimesh-ai/LocalMind`。
- `upstream`：`toeverything/AFFiNE`。
- LocalMind 主线：`main`。
- AFFiNE 默认上游分支：`upstream/canary`。

LocalMind 应尽量保持 AFFiNE 的包结构、GraphQL 生成方式、Admin 模块约定和后端
边界，但 LocalMind 的授权、持久化、运行时与审计语义优先于上游产品行为。

处理上游改动时：

1. 不因上游较新就默认吸收，也不要默认整体合并 `upstream/canary`。
2. 先检查补丁、传递依赖和本地等价实现；必要时使用 `git cherry`、稳定
   `patch-id`、提交历史和代码检索去重。
3. 对 AFFiNE 品牌、计费、私有云、内部发布、翻译、移动端专属和纯依赖升级
   默认降权，除非它们修复 LocalMind 的明确风险。
4. 未经用户明确要求，不执行 merge、rebase、cherry-pick、commit、push、
   force push 或创建远端分支。
5. 上游巡检的历史与决策文档约定放在 `docs/upstream-essence/`；自动巡检任务
   本身保持只读。

---

## 3. 架构边界

从用户入口到持久化层，大致按以下方向组织：

```text
packages/frontend/apps/*
  -> packages/frontend/core / packages/frontend/admin
  -> packages/common/graphql / packages/common/infra
  -> packages/backend/server/src/plugins / src/core
  -> packages/backend/server/src/models / src/base
  -> Prisma/PostgreSQL, Redis/BullMQ, blob storage, external providers

blocksuite/* -> editor/canvas/data-view foundation -> frontend/core
```

新增代码前先确定所有权边界，不要让前端绕过 GraphQL/API 直接依赖服务端实现，
不要让领域模型反向依赖 UI，也不要在多个包中复制同一份协议或状态机。

### 3.1 后端分层

- `src/base/`：配置、日志、GraphQL、Prisma、Redis、存储、任务和通用基础设施。
- `src/core/`：认证、权限、工作区、文档、同步、自托管、通知等核心产品域。
- `src/plugins/copilot/`：AI provider、prompt、context、conversation、runtime、
  tools、MCP、BYOK、企业连接与兼容层。
- `src/models/`：持久化领域模型与跨入口复用的状态转换。
- `src/__tests__/`：服务端单元、smoke、集成和 Copilot 专项测试。
- `schema.prisma` 与 `migrations/`：数据库模型和按时间排序的 Prisma 迁移。

HTTP、GraphQL、队列 worker 与 MCP 入口应复用同一领域模型和授权语义。不要在
resolver/controller 中复制一套较弱的业务规则。

### 3.2 前端边界

- 用户侧工作流与 AI Chat 位于 `packages/frontend/core/`，编辑器底座在
  `blocksuite/`。
- 运维、审计和管理员控制位于 `packages/frontend/admin/src/modules/`。
- 共享 GraphQL operation 放在 `packages/common/graphql/src/graphql/`，生成类型
  与 schema 由仓库既有生成流程维护。
- 优先复用 `@affine/component`、现有 Admin 组件、模块 service/store 和路由模式；
  不为单一页面另造设计系统或数据访问层。

### 3.3 LocalMind AI 运行时

LocalMind AI 的关键不变量：

1. Agent run、step、timeline、worker lease、execution result 与 cancel request
   应有可恢复的持久状态，不能只存在于内存或 UI。
2. 写操作必须经过资源所属 Project/Workspace 及用户权限检查；需要审批的工具
   不得绕过审批进入队列。
3. 外部 MCP/集成任务冻结凭据能力上限，同时在执行时重新检查委托用户的实时
   ACL；取消控制只允许取消，不扩展为隐式批准或重试。
4. 队列和 webhook 必须考虑幂等、重放、租约交接、并发状态漂移和条件终态写入。
5. 审计、side-effect ledger、fingerprint 与授权快照是行为证据，不应被后续
   状态更新静默覆盖。
6. Prompt、Model、Provider、Task Route Policy 与 Provider Health 使用 DB-backed
   registry/state；不要引入只在单进程内有效的第二套真相来源。
7. 上下文、Rule 与 Automatic Memory 必须遵守权限过滤、作用域隔离、信任边界、
   有界预算和隐私保护；不得为了召回率扩大到未授权 workspace/project/doc。
8. 日志、错误、support bundle 和模型证据必须有界并脱敏，不得暴露 token、API
   key、完整私密提示词或不必要的文档正文。
9. Project AI 权限、会话绑定、跨工作区文档位置确认和访问申请通知遵守
   `docs/ai-modernization/tracks/project-ai-boundaries.md`，资源归属、内部文件树、
   独立副本与显式发布以
   `docs/ai-modernization/tracks/project-native-resources.md` 的新契约为准。
   AI 不得创建 Project、管理成员、修改权限策略或批准/拒绝授权，也不得用
   文件夹代替 Project。
10. 所有 Project 会话统一使用实例管理员在 `/admin` 配置的全局 Project BYOK。
    该配置独立于 Workspace、Workspace 默认 Profile 和用户 Profile；会话中的
    `workspaceId` 仅保留执行、授权及审计上下文，不决定 Project 的模型凭据。
    全局配置缺失或停用时不得回退到 Workspace、设备本地凭据或平台额度模型。

---

## 4. AI 任务必读文档

AI 现代化任务按以下顺序读取：

1. `docs/ai-modernization/README.md`
2. `docs/ai-modernization/branch-differences.md`
3. `docs/ai-modernization/document-map.md`
4. `docs/ai-modernization/current-state.md`
5. `docs/ai-modernization/next-goals.md`
6. `docs/ai-modernization/validation.md`
7. `docs/ai-modernization/tracks/` 下与任务相关的 track

当前 track：

| Track                    | 文档                                 | 关注点                                                    |
| ------------------------ | ------------------------------------ | --------------------------------------------------------- |
| Support Bundle           | `tracks/support-bundle.md`           | 请求、归档、下载授权、保留清理、转发与重放                |
| Repair Execution         | `tracks/repair-execution.md`         | 预览、预检、审批、worker、side effect 与人工控制          |
| Agent Runtime            | `tracks/agent-runtime.md`            | run/step/timeline、租约、adapter、执行结果与取消          |
| Registries               | `tracks/registries.md`               | prompt/model/provider/task route/health 的 DB-backed 状态 |
| Context Memory           | `tracks/context-memory.md`           | Rule、Automatic Memory、scope、检索、信任边界与评测       |
| Project Native Resources | `tracks/project-native-resources.md` | Project 原生文档/文件树、独立副本、显式发布与旧引用迁移   |

`docs/ai-modernization/archive/` 是历史审计记录，不是默认执行入口。只有当前文档
引用了具体历史章节，或任务需要追溯旧决策时才读取。不要继续旧的“不断加深
support-bundle 只读 source-evidence 字段”模式，除非用户明确要求该字段。

部署、MCP 或用户行为相关任务还应读取：

- `docs/localmind-user-guide.zh-CN.md`
- `docs/localmind-usage-tips.zh-CN.md`
- `docs/localmind-deployment.zh-CN.md`
- `docs/localmind-deployment-ai.zh-CN.md`
- `docs/localmind-mcp.md`
- `docs/localmind-docker-development-constraints.md`

---

## 5. 工程纪律

### 5.1 协作与范围

- 对用户的回复、进度和交付报告使用简体中文。
- 代码标识符、API 字段和代码注释遵循所在文件的既有语言与风格；不要为了翻译
  而改写无关注释。
- 每一处修改都应能对应用户请求。不要顺手格式化、重命名或重构无关代码。
- 优先使用仓库现有抽象和依赖；仅在确实减少复杂度或重复时增加新抽象。
- 搜索文件和文本优先使用 `rg --files` 与 `rg -n`。
- 先检查 `git status`，保留用户已有改动；未经明确要求不得丢弃、覆盖或提交它们。
- 若改动实质改变产品方向、顶层目录职责、关键命令、分支关系或强制验证规则，
  在同一任务中同步更新本文件和对应 source-of-truth 文档；普通实现细节不为此
  制造无意义的文档改动。
- 默认直接完成简单任务。只有用户明确要求代理并行工作时，才拆分为写入范围不
  重叠的子任务；信息收集可以并行。

### 5.2 TypeScript 与模块约定

- 遵循项目 TypeScript strict、ESLint、oxlint 和 Prettier 配置，不另设局部风格。
- 保持 import 边界，优先使用 workspace package 的公开导出，避免跨包深层私有
  路径和循环依赖。
- 复用 NestJS module/provider、`@toeverything/infra` service/store 和现有错误
  类型；不要在调用点手写重复容器或服务定位逻辑。
- 对外协议使用明确类型与 schema；不要用无界 `any`、松散 JSON 或字符串拼接
  代替结构化解析。
- 错误信息应可操作但不泄密；面向用户、运维和审计的错误证据要区分清楚。

### 5.3 数据库与迁移

- Prisma schema 位于 `packages/backend/server/schema.prisma`，迁移位于
  `packages/backend/server/migrations/`。
- 数据结构变化必须新增迁移并验证从旧状态升级；不要只改 schema 或直接改生产库。
- 不手工编辑 Prisma Client 等生成产物。
- 涉及授权、审计、租约、幂等或不可变证据时，在应用层检查之外评估数据库约束、
  外键、唯一键、条件更新和事务边界。
- 新 worker/队列状态机必须定义合法状态、重试/终态、租约过期和并发更新行为。

### 5.4 GraphQL 与生成文件

- 服务端 schema/resolver、共享 `.gql` operation、生成 schema/types 和消费端必须
  同步变化。
- 使用仓库既有生成命令更新生成文件，不手工伪造 generated diff。
- 新增写 mutation 时必须验证 workspace scope、actor permission、输入边界、错误
  映射和审计结果。
- 保持向后兼容；删除或改变既有字段语义前先检查所有 Web、Admin、Electron、
  mobile 和测试消费者。

### 5.5 前端与 Admin

- 先复用已有组件、token、图标和交互模式，保持 LocalMind/AFFiNE 现有界面一致。
- 所有异步界面必须覆盖 loading、empty、error、success、disabled 和重复提交状态。
- 危险或不可逆操作需要清晰确认与结果反馈；不得只靠按钮禁用代替服务端授权。
- Admin 视图优先支持扫描、筛选、比较和重复操作，避免无必要的营销式布局。
- 用户可见行为变化应补充聚焦测试；布局或交互变化应在相关视口和主题下检查。

---

## 6. 标准环境与常用命令

标准环境：

- Node.js `>=22.12.0 <23.0.0`
- Yarn `4.13.0`，通过 Corepack 使用
- Rust toolchain 以 `rust-toolchain.toml` 为准
- Docker 与 Docker Compose
- Linux/Linux 容器是默认开发和验证基线；命令示例使用 POSIX shell

初始化与日常命令：

```sh
corepack enable
yarn install --immutable
yarn dev
yarn build
yarn lint:ox
yarn lint:eslint
yarn lint:prettier
yarn typecheck
yarn test
```

开发容器与本地运行环境需要同步当前源码时，使用已有脚本，不手工复制散落文件：

```sh
yarn localmind:sync:backend
yarn localmind:sync:web
yarn localmind:sync:all
```

只有任务确实涉及运行中的 LocalMind 环境时才执行同步脚本，并在交付中说明影响。

后端同步会核对 schema、迁移和 native 源码的运行版本证据；缺少证据或发生漂移时，
不会只复制 JavaScript。涉及这些变化时，先备份数据库并验证同平台 Linux 容器，
再设置 `LOCALMIND_RUNTIME_SOURCE_CONTAINER`（源码位于 `/workspace` 的已验证容器）
和 `LOCALMIND_DATABASE_BACKUP`（非空本地备份文件）执行同步。该路径一并同步迁移、
Prisma Client 和 native addon。同步只更新容器，不更新镜像；重建部署仍走固定
`localmind-affine:local` 镜像流程。

---

## 7. 验证策略

验证强度按风险和影响面扩展。优先运行能证明改动的最小检查，再根据共享协议、
状态机、数据库或用户工作流的影响增加覆盖。

### 7.1 文档变更

文档改动不需要构建 Docker 镜像：

```sh
yarn prettier --ignore-unknown --check <changed-doc-files>
git diff --check
```

### 7.2 TypeScript、后端与前端

常见聚焦检查：

```sh
yarn lint:ox <changed-files>
yarn prettier --ignore-unknown --check <changed-files>
yarn r packages/backend/server/src/__tests__/copilot/<smoke-file>.ts
yarn vitest run packages/frontend/admin/src/modules/ai/<test-file>.tsx
yarn typecheck
```

服务端普通 AVA 测试使用 `@affine/server` 的现有脚本。位于 AVA glob 之外的后端
TypeScript smoke 文件使用 `yarn r <file>`，不要假设 plain `ava` 会执行它。

### 7.3 数据库、GraphQL 与跨模块改动

按影响范围补充：

- Prisma Client、GraphQL schema/client 和 i18n 生成；
- 新迁移在一次性 PostgreSQL 数据库上的全量应用；
- 从受影响旧版本 fixture 到新 schema 的升级验证；
- resolver/model/worker 的聚焦测试；
- Admin 或用户侧 GraphQL 消费测试；
- 授权拒绝、重复请求、重试、取消、租约交接和并发漂移测试。

不要把“生成成功”当成行为测试，也不要只测成功路径。

### 7.4 Docker 约束

任何 AI 现代化代码任务都必须遵守
`docs/localmind-docker-development-constraints.md`。固定镜像角色只有：

```text
localmind-affine:dev-base
localmind-affine:test
localmind-affine:local
```

规则：

1. 普通源码变化优先在现有 `localmind-affine:test` 或复用容器中做聚焦验证。
2. 只有 Dockerfile、系统依赖、lockfile 策略或工具链变化才考虑重建 `dev-base`。
3. 只有运行时、打包、native build 或里程碑验证才考虑构建 `local`。
4. 不创建里程碑专属 tag，不把完整镜像重建当成日常循环。
5. 重建前先运行 `docker system df`，预估新增超过 30 GB 时停止并报告。
6. 未经用户明确允许，不删除 volume、持久化服务数据或无关项目镜像。
7. 执行过重型验证时，报告精确命令、固定 tag、是否重建、磁盘状态与剩余风险。

---

## 8. 常用入口速查

| 任务                              | 首选入口                                                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent Runtime / worker / cancel   | `packages/backend/server/src/models/copilot-agent-runtime*.ts`、`packages/backend/server/src/plugins/copilot/runtime/`、`docs/ai-modernization/tracks/agent-runtime.md`                             |
| MCP / 外部委托                    | `packages/backend/server/src/plugins/copilot/mcp/`、`packages/backend/server/src/plugins/copilot/external-mcp/`、`packages/backend/server/src/plugins/copilot/enterprise/`、`docs/localmind-mcp.md` |
| Context / Rule / Automatic Memory | `packages/backend/server/src/plugins/copilot/context/`、`packages/backend/server/src/models/copilot-context-*.ts`、`docs/ai-modernization/tracks/context-memory.md`                                 |
| Provider / Model / Prompt / Route | `packages/backend/server/src/plugins/copilot/providers/`、`packages/backend/server/src/plugins/copilot/prompt/`、相关 registry models、`docs/ai-modernization/tracks/registries.md`                 |
| Repair Execution                  | `packages/backend/server/src/models/copilot-repair-execution.ts`、Copilot resolver/worker、`docs/ai-modernization/tracks/repair-execution.md`                                                       |
| Support Bundle                    | `packages/backend/server/src/models/copilot-support-bundle.ts`、storage/worker/API、`docs/ai-modernization/tracks/support-bundle.md`                                                                |
| Admin AI 运维界面                 | `packages/frontend/admin/src/modules/ai/`                                                                                                                                                           |
| 用户侧 AI Chat                    | `packages/frontend/core/src/blocksuite/ai/` 与相关 frontend modules                                                                                                                                 |
| GraphQL operation/type            | `packages/common/graphql/src/graphql/`、`packages/common/graphql/src/schema.ts`                                                                                                                     |
| 数据模型/迁移                     | `packages/backend/server/schema.prisma`、`packages/backend/server/migrations/`                                                                                                                      |
| 文档编辑器/画布                   | `blocksuite/` 与 `packages/frontend/core/src/blocksuite/`                                                                                                                                           |
| Web/Electron/mobile 入口          | `packages/frontend/apps/`                                                                                                                                                                           |
| Docker 开发规则                   | `docs/localmind-docker-development-constraints.md`                                                                                                                                                  |
| 上游 AFFiNE 巡检                  | `docs/upstream-essence/`、`upstream/canary`                                                                                                                                                         |

`packages/frontend/apps/ios/` 下有更具体的 `AGENTS.md`；处理 iOS 代码时必须一并
读取。

---

## 9. 修改前与交付前清单

修改前：

1. 任务属于哪个产品域、package、model 或 UI module？
2. 是否已经读取对应 active track 和当前状态文档？
3. 是否存在可复用的本地实现、上游补丁或 workspace 依赖？
4. 是否涉及 workspace scope、权限、审批、审计、敏感数据或凭据？
5. 是否需要 migration、GraphQL operation、生成类型和兼容处理？
6. 是否涉及队列、租约、重试、幂等、取消、webhook 重放或并发漂移？
7. 是否误把本应持久化的状态留在内存、日志或 UI？
8. 当前工作区是否已有用户改动需要保留？

交付前：

1. 检查 `git diff`、`git diff --check` 和残留冲突标记。
2. 运行最小充分的 lint、format、typecheck 与聚焦测试。
3. 数据/协议变化验证 migration、生成文件、授权拒绝和至少一个失败路径。
4. UI 变化检查关键状态、主题与目标视口。
5. AI 代码变化按 Docker 约束做容器验证；若未运行，明确原因和剩余风险。
6. 报告改动文件、验证命令与结果、是否重建镜像、使用的 active track 和剩余风险。
7. 只有用户明确要求时才 commit、push、创建 PR、触发发布或修改远端状态。
