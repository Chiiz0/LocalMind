# Project 工作台体验重构：独立壳、旧模型退场、实时与编辑租约

## 1. 状态与权威

- 决策日期：2026-09-06。
- 状态：P1-P7 实现与 A01-A22 本次验收完成；3011 已同步 361 条迁移。类型检查
  基线例外、隔离验收边界及真实证据见[实施与验收记录](../project-workbench-redesign.execution.md)。
- 本文是 Project 用户体验层的 source of truth：页面外壳与路由、文件树与资源打开
  方式、旧引用模型退场、实时更新、独占编辑租约、审批双入口以及错误与文案规范。
- 执行指令见 [Project Workbench Redesign Goal](../project-workbench-redesign.goal.md)。
- 资源归属、独立副本、导入与显式发布仍以
  [Project Native Resources](project-native-resources.md) 为准；本文覆盖其第 8 章
  “旧数据与旧任务迁移”和 D11，因为旧引用模型将整体退场而不再迁移。
- 会话隔离、审批、审计与访问申请规则继续以
  [Project AI Boundaries](project-ai-boundaries.md) 为准；Office 编辑引擎以
  [Native Office](../../office-native/README.md) 为准。

本文覆盖以下旧规则：Project 以 Workspace 文档引用作为项目内容、Intelligence 页面
依赖宿主 Workspace 选择器、旧引用通过迁移桥接进入原生资源、项目内文档用轮询
同步、任务面板是唯一审批入口。讨论中提出的“把全局导航改造成同时列出 Workspace
与 Project”“Owner 强制解锁”“用 CRDT 合并多人同时编辑”均已被用户否定，不得作为
实现前提。

## 2. 审计结论摘要

本次重构源于对 `packages/frontend/core/src/desktop/pages/intelligence/` 的代码审计。
问题按根因归为五类，实现时以消除根因为目标，而不是逐条打补丁：

| 根因             | 典型表现                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 信息架构错位     | 唯一入口是侧边栏 Intelligence；项目和资源只存在于 `?project=&resource=` 查询参数且 `replace` 历史；页面顶部有与 Project 无关的 Workspace 选择器；264px 左栏同时承载账号、搜索、项目列表、历史导入、历史请求、文件树和回收站。 |
| 三套文档模型并存 | 树里同时出现旧 Workspace 引用（含 pending/revoked 占位）、迁移面板和原生文件；“添加文档（只读/可写）”仍打开 Workspace 文档选择器。                                                                                            |
| 交互原始         | 新建必须先命名；排序靠“上移/下移”菜单；移动靠弹窗逐级选目录；上传单文件且只能到根目录、无进度；一个全局 pending 锁住整棵树和整个任务面板；打开资源即隐藏聊天且无面包屑、无全屏。                                              |
| 轮询代替事件     | 项目列表与任务面板 5 秒、目录 15 秒、资源 10 秒两路、发布与迁移 3 秒、文档 10 秒；组件间用 `window.dispatchEvent` 互相通知；后端已 emit `project.resource.changed` 且有 socket 房间，但前端从未订阅。                         |
| 后端语义直出     | 审批确认框显示项目 UUID 与文档 ID；分享菜单“受益项目：{{id}}”；`error.message` 直接渲染或 `catch {}` 后统一“失败”；硬编码英文异常；批准 AI 写入、批准授权、来源刷新覆盖、历史恢复均无确认，而移除成员却有确认。               |

实现时以本文规则为准，不逐条对照审计时的行号；执行记录启动时再补充逐项对照。

## 3. 已确认的产品规则

| 编号 | 确定规则                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1   | Project 与 Workspace 平级，是全局对象。Project 页面使用独立壳，不嵌入 Workspace 壳，也不改造 AFFiNE 全局导航。每个 Workspace 侧边栏提供“项目”入口跳转到 Project 壳；Project 壳左上角提供“返回工作区”。                               |
| R2   | 路由为真实路径：`/project` 是全部项目总览，`/project/:projectId` 是项目页，`/project/:projectId/resources/:resourceId` 是资源打开态。导航使用 push 历史，链接可分享、可后退。`/intelligence`、`/chat` 及旧变体 301 到新路径。        |
| R3   | 旧 Workspace 文档引用模型整体退场：产品、GraphQL、模型、Prisma 表与迁移桥接一并删除，不保留过渡兼容。开发阶段无存量用户，运行实例中未完成迁移的旧引用随之丢弃。                                                                      |
| R4   | 项目内容只有原生资源一种模型。AI 上下文、聊天中的文档选择、任务与审批都以 `ProjectResource` 为对象。                                                                                                                                 |
| R5   | 聊天中选择项目文档使用文件树多选，选择结果按会话持久化，切换会话不共享。                                                                                                                                                             |
| R6   | 实时更新替代轮询：前端订阅已有 `project.resource.changed` 通道；后端新增项目列表/成员、任务面板与编辑租约三个 realtime topic。保留 15 秒兜底快照，删除与之重复的手动刷新按钮。                                                       |
| R7   | 同一资源同一时间只允许一个编辑者。编辑权是按标签页持有的租约：20 秒续约，60 秒过期；关闭面板释放；掉线靠过期回收。同一用户的第二个标签页也是只读。                                                                                   |
| R8   | Owner 不能强制解锁，任何角色都不能。租约只能由持有者释放或自然过期。其他人看到只读态、持有者姓名，并可选择“编辑结束后通知我”。                                                                                                       |
| R9   | AI 写入同样必须持有租约。拿不到租约时任务进入等待并说明原因，不得绕过。现有 `expectedContentVersion` 检查保留为第二道防线。                                                                                                          |
| R10  | 审批既可在聊天消息内的卡片点击，也可在任务面板决策。任务记录是唯一真相源；两处调用同一 mutation，带幂等键与期望状态，后到者看到“已由某某处理”而非报错。                                                                              |
| R11  | 文件树在项目页主区域承载多级目录；左栏只保留项目列表与总览入口。支持拖拽移动与排序、多文件拖放上传到当前目录并显示进度、新建后立即创建无标题文档并打开、每个条目独立 pending 状态、回收站为独立视图。                                |
| R12  | 打开资源时聊天保持可见并与资源并排（窄屏可切换）；资源区有可见面包屑、全屏切换和关闭；关闭前检查未保存改动并提示。                                                                                                                   |
| R13  | 用户可见文本不出现 UUID、枚举原文、后端异常原文或硬编码英文。需要展示对象时由后端返回名称（项目名、文档标题、申请人姓名与邮箱）。错误统一走 `UserFriendlyError` 与 `notify`，不允许 `catch {}` 吞错或 `.catch(console.error)` 静默。 |
| R14  | 授予权限、批准 AI 写入、来源刷新覆盖、移除成员、转移所有权、退出项目、永久删除均需确认弹窗，且确认强度与风险方向一致。                                                                                                               |
| R15  | 全局 Project BYOK 未配置或停用时，项目聊天顶部显示可操作提示条；管理员看到直达 `/admin/ai/config` 的链接，普通用户看到“联系管理员”。不回退到其他模型。                                                                               |
| R16  | 侧边栏入口从 Intelligence 更名为“项目”；“加入 Project”更名为“复制到项目”；To do 计数包含“等待他人”；在项目页内新增 Project Summary 时默认选中当前项目。                                                                              |

## 4. 目标架构

### 4.1 壳与路由

```text
/project                                   全部项目总览：项目列表 + 全局任务面板
/project/:projectId                        项目页：左栏项目列表，主区域文件树 + 聊天
/project/:projectId/resources/:resourceId  资源打开态：主区域资源 + 聊天并排
/tasks                                     保持不变
/intelligence, /chat, /workspace/:id/chat  重定向到 /project
```

- 路由定义在 `packages/frontend/core/src/desktop/intelligence-router.ts` 演进为
  `project-router.ts`，与 `router.tsx` 的顶层路由列表同步。
- 删除 `pages/intelligence/host.ts` 的宿主 Workspace 概念与顶部 WorkspaceSelector。
  `/tasks` 页改用 `DefaultServerService` 取 server scope。
- Workspace 壳侧边栏 `components/root-app-sidebar/index.tsx` 的 AI 入口更名为
  “项目”，指向 `/project`。快速搜索加入项目与项目资源。

### 4.2 项目页布局

```text
┌──────────────┬──────────────────────────────────────────────────┐
│ 项目列表      │ 面包屑 / 项目名 / 成员 / 设置                      │
│ · 全部项目    ├───────────────────────┬──────────────────────────┤
│ · 项目 A ✓   │ 文件树 或 打开的资源    │ 聊天（会话 Tab + 消息）    │
│ · 项目 B     │                       │ 审批卡片内联在消息中        │
│              │                       │                          │
│ 返回工作区    ├───────────────────────┴──────────────────────────┤
│ 通知 / 设置   │ 任务栏（默认折叠为摘要行，可展开看板）               │
└──────────────┴──────────────────────────────────────────────────┘
```

- 任务面板在项目页默认折叠为一行摘要，总览页默认展开。
- 窄屏（≤760px）左栏抽屉化，主区域在“文件/资源”和“聊天”之间切换。
- “历史导入”“历史请求和会话”面板随旧模型一并删除；项目设置页只保留成员、AI
  策略、归档。

### 4.3 文件树与资源

- 文件树组件从 `project-tree.tsx` 内嵌拆出，成为主区域视图；`project-files.tsx`
  重写为支持拖拽、多选、拖放上传与逐条 pending 的资源浏览器。
- 新建文档/画布：立即调用 `createProjectResource` 生成无标题资源并打开，标题在
  编辑器内修改。新建文件夹仍可内联命名。
- 上传：多文件、拖放到当前目录、逐文件进度与失败重试；Office 类型沿用
  `importProjectOffice`。
- 资源打开态：面包屑来自 `projectResourcePath`，可点击跳回任一层；全屏切换只
  隐藏聊天，不改变路由。

### 4.4 AI 上下文与文档选择

- `plugins/copilot/context-scope-resolver.ts` 与 `plugins/copilot/tools/project-doc.ts`
  改为读取 `ProjectResource`，不再经过旧引用表。
- 聊天工具栏的“选择文档”打开文件树多选器（复用 4.3 的树组件，只读模式），
  选择结果写入当前会话的上下文，按会话持久化。
- `project-chat-config.ts` 的搜索菜单只作为多选器内的过滤，不再是独立入口。

## 5. 旧引用模型退场清单

以下按“删除”与“改造”分组；清单来自代码盘点，实现时以 `rg` 复核为准。

### 5.1 删除

- GraphQL operation：`copilot-context-project-document-add/remove/update.gql`、
  `copilot-project-grant-rerequest.gql`、`contextProjects.documents` 与
  `documentCount` 选择集及其生成产物。
- 后端类型与 mutation：`context-memory-resolver.ts` 中的
  `CopilotContextProjectDocumentType`、Document Input/Result 类型、三个 document
  mutation、项目视图中的 documents 组装；`intelligence-workbench-resolver.ts` 的
  `reRequestCopilotProjectDocumentAccess`。
- 模型方法：`copilot-context-memory.ts` 与 `intelligence-workbench-authorization.ts`
  中所有只服务于 `aiContextProjectDoc` 的列举、容量校验、按引用撤销/删除方法。
- Prisma：`AiContextProjectDoc` 表、`User.addedAiContextProjectDocuments`、
  `AiContextProject.documents`、`internalResourceId` 与 `project_migrated_reference`
  相关字段与索引。出一条删表迁移。
- 迁移桥接：`models/project-resource-migration.ts`、
  `core/project-transfer/migration-resolver.ts`、`project-resource-migrations.gql`、
  `discover/change/request-project-migration-*.gql`、前端 `project-migrations.tsx`、
  `project-legacy.tsx` 及其 gql 与测试。
- 前端：`index.tsx` 的 addDocuments/removeDocument 与“添加文档（只读/可写）”菜单、
  `project-tree.tsx` 的 documents 分组渲染、`project-document-title.tsx`、
  `source-document-peek.tsx`、`workbench-task-action.ts` 的 rerequest 分支、
  `dialogs/setting/workspace-setting/ai-context/` 的 ProjectDocumentNames、
  `host.ts`，以及对应 i18n 键。
- 文档：`project-native-resources.md` 第 8 章、D11、验收矩阵中的迁移条目；
  用户指南与部署文档中“历史导入”“历史请求和会话”段落。

### 5.2 改造

- `AccessRequest.purpose` 只保留 `project_copy`；
  `intelligence-workbench-authorization.ts` 审批与创建路径去掉占位文档 upsert 与
  `purpose !== 'project_copy'` 分支。
- `AiContextProjectGrant`、`AiContextProjectCopyAuthorization`、
  `AccessRequestAuditEvent`、通知枚举、分享菜单 `project-access.tsx`、
  `components/notification/access-request.tsx`、404 页申请入口：保留，语义改为
  “复制到项目”的来源授权。
- 来源复制申请由审批人从通知处理，不因审批身份生成任务。申请方和目标项目成员
  的 Todo 显示“等待他人”，可撤回未决申请的人保留撤回按钮；任务面板不提供来源
  复制审批按钮。已批准的复制授权不再提供撤回能力，项目独立副本不受来源权限变化
  影响。第 8 节的聊天与任务双入口仍适用于 AI 写入审批。
- `use-access-request-confirmation.tsx`：保留并按 R13 改为展示项目名与文档标题。
- `ensureProjectDocumentCapacity` 的配额概念迁移到 `ProjectResource`，或在确认
  无需求后删除，二选一并记录。

## 6. 实时通道

### 6.1 已存在、需前端接入

- `core/project/gateway.ts` 提供 `project:join`、`project:leave`、
  `project:resource-changed` 与 `project:load-document`；资源服务、导入、文件请求
  已 emit `project.resource.changed`。
- 前端新增 `modules/project-resources/realtime.ts`（或等价 store）：进入项目页时
  `project:join`，离开时 `project:leave`；收到 `project:resource-changed` 后失效
  对应目录、资源、路径与文档查询。删除 `project-files-data.ts` 的
  `window.dispatchEvent` 机制与全部 `refreshInterval`。

### 6.2 需后端新增

按 `core/notification/realtime.ts` 的 `registerRealtimeLiveQuery` 模式注册：

| Topic                   | 触发                                      | 房间 | 消费者                 |
| ----------------------- | ----------------------------------------- | ---- | ---------------------- |
| `project.list.changed`  | 项目创建/更名/归档、成员增删、AI 策略变化 | 用户 | 左栏项目列表、成员面板 |
| `project.task.changed`  | 任务/审批/阻塞项/文件请求状态变化         | 用户 | 任务面板、聊天审批卡片 |
| `project.lease.changed` | 编辑租约获取、续约失败、释放、过期        | 项目 | 资源只读横幅、编辑器   |

- 三个 topic 加入 `core/realtime/required-handlers.ts`。
- 前端保留 15 秒兜底快照，与 `notification/services/count.ts` 一致。

## 7. 编辑租约

### 7.1 模型

新增 `project_resource_edit_leases`：

| 字段         | 说明                                     |
| ------------ | ---------------------------------------- |
| `resourceId` | 唯一键，一资源一租约                     |
| `projectId`  | 用于房间与权限检查                       |
| `holderId`   | 用户 ID                                  |
| `tabId`      | 标签页标识，同一用户第二个标签页视为他人 |
| `kind`       | `user` 或 `ai_task`                      |
| `taskId`     | `kind = ai_task` 时关联的任务            |
| `acquiredAt` | 获取时间                                 |
| `expiresAt`  | 过期时间，续约时更新                     |

- 获取与续约使用条件更新：只有 `resourceId` 无记录、记录已过期、或持有者与
  `tabId` 匹配时成功；否则返回当前持有者信息。
- 释放使用条件删除：只有持有者与 `tabId` 匹配才删除。
- 过期记录由下一次获取覆盖，不依赖定时清理；可选后台清理只做整理。
- 每次获取、续约失败、释放、过期覆盖写审计事件并发布 `project.lease.changed`。

### 7.2 前端行为

- 打开资源默认尝试获取租约；成功进入编辑态，失败进入只读态并显示持有者姓名与
  “编辑结束后通知我”。
- 编辑态每 20 秒续约；续约连续失败或收到他人持有事件时降级为只读并提示。
- 关闭面板、切换资源、路由离开、`pagehide` 时释放；未保存改动先提示。
- 只读态仍实时刷新内容，看到持有者的最新保存。
- Office 资源沿用同一租约模型；实现前核对 `project-office.tsx` 现有 revision
  ownership 逻辑，合并为一套而不是两套。

### 7.3 AI 任务

- Agent 写入资源前以 `kind = ai_task` 获取租约；拿不到则任务进入 `waiting_lease`，
  说明持有者，并在收到 `project.lease.changed` 释放事件后自动重试一次。
- AI 持有期间用户打开该资源为只读，横幅显示“AI 任务正在写入”。
- 任务完成、失败或取消都必须释放租约；worker 租约过期时编辑租约随之过期。

## 8. 审批双入口

- 审批对象是任务记录；聊天卡片从当前会话关联的任务列表渲染，不自行保存状态。
- 卡片与任务面板调用同一 mutation，输入包含任务 ID、期望的当前状态与幂等键。
  状态不匹配时返回结构化结果（已批准/已拒绝/已取消，处理人，时间），前端显示
  “已由某某处理”。
- 批准 AI 写入需要确认弹窗，弹窗显示目标资源标题、操作摘要与受影响范围。
- 两处都订阅 `project.task.changed`，任一处操作后另一处即时更新。

## 9. 错误、文案与确认规范

- 后端为面向用户的对象返回名称字段：访问申请与任务返回项目名、资源标题、申请人
  姓名与邮箱；发布目标返回 Workspace 名与目录标题。
- 前端统一使用 `UserFriendlyError.fromAny(caught).message` 与 `notify.error`；
  表单内错误用组件内 alert 区域，同样经过 `UserFriendlyError`。
- 硬编码英文异常改为带 i18n 键的 `UserFriendlyError` 子类或错误码映射。
- 确认弹窗使用 `useConfirmModal`，破坏性操作 `variant: 'error'`，授权类操作在
  描述中写明授予对象与级别。
- 时间显示不带毫秒；版本显示为“版本 N”而非裸序号；任务标识不显示 ID 片段。
- 展开折叠、切换 Tab 等纯 UI 动作不得触发写 mutation。

## 10. 实现边界与顺序

| 阶段            | 涉及边界                                                      | 完成标志                                                                      |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| P1 旧模型退场   | GraphQL、resolver、模型、Prisma 迁移、AI 上下文、前端、文档   | 仓库内无旧引用与迁移桥接代码；AI 上下文只读 ProjectResource；空库全量迁移通过 |
| P2 实时接入     | 前端 realtime store、后端三个 topic、required-handlers        | 全部 `refreshInterval`/`setInterval` 轮询删除；事件驱动刷新可证明             |
| P3 壳与路由     | project-router、侧边栏入口、总览页、项目页布局、重定向        | 三级路由可分享可后退；宿主 Workspace 概念消失；窄屏与主题通过                 |
| P4 文件树与资源 | 资源浏览器、拖拽、多文件上传、面包屑、全屏、未保存保护        | R11、R12 全部可操作；逐条 pending                                             |
| P5 编辑租约     | Prisma、模型、GraphQL、worker、编辑器、Office、审计           | R7、R8、R9 在多标签页与 AI 任务并发下可证明                                   |
| P6 审批与文案   | 聊天卡片、任务面板、后端名称字段、错误规范、i18n、BYOK 提示条 | R10、R13、R14、R15、R16 全部通过                                              |
| P7 集成验收     | Linux 容器、真实浏览器、运行同步、文档                        | 验收矩阵通过，备份后同步当前本地环境并复验                                    |

首次修改前用 `rg` 复核第 5 章清单并列出实际依赖。复用既有 `@affine/component`、
`@toeverything/infra` store、realtime registry、`useConfirmModal` 与 `notify`。
GraphQL 与 Prisma 生成通过仓库工具完成。完成情况逐阶段记录；单个阶段完成不等于
整个功能已交付。

## 11. 必须通过的验收矩阵

| 编号 | 场景                                                                                                      | 期望                                                                |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A01  | 代码库中搜索 `aiContextProjectDoc`、`copilotContextProjectDocument`、`ProjectLegacy`、`ProjectMigrations` | 无结果；Prisma 迁移在空库与从当前真实备份恢复的库上均成功           |
| A02  | 项目聊天中 AI 引用项目文件                                                                                | 上下文来自 `ProjectResource`；文件树多选结果按会话持久化            |
| A03  | 从 Workspace 侧边栏点击“项目”                                                                             | 进入 `/project` 独立壳；“返回工作区”回到来源 Workspace              |
| A04  | 直接打开 `/project/:projectId/resources/:resourceId` 链接并按浏览器后退                                   | 正确打开资源；后退回到项目页而不是离开壳                            |
| A05  | 访问 `/intelligence?project=X`                                                                            | 重定向到 `/project/X`                                               |
| A06  | 另一成员新建、重命名、删除资源                                                                            | 当前用户文件树在事件到达后更新，无轮询请求                          |
| A07  | 断开 socket 后恢复                                                                                        | 15 秒兜底快照收敛，不丢失变化                                       |
| A08  | 拖拽移动与排序、多文件拖放上传到子目录                                                                    | 结构与顺序正确；逐文件进度与失败重试；其他条目不被禁用              |
| A09  | 新建文档                                                                                                  | 立即创建无标题资源并打开编辑器，无命名弹窗                          |
| A10  | 打开资源                                                                                                  | 聊天仍可见并可发送；面包屑可跳回父目录；全屏切换不改路由            |
| A11  | 有未保存改动时关闭资源面板                                                                                | 提示保存/放弃/取消；放弃后不写入                                    |
| A12  | 用户甲编辑中，用户乙打开同一资源                                                                          | 乙为只读并显示甲姓名；乙订阅通知后甲释放时收到通知                  |
| A13  | 甲关闭标签页不释放                                                                                        | 60 秒后乙可获取租约；期间 Owner 无任何强制解锁入口                  |
| A14  | 同一用户第二个标签页打开同一资源                                                                          | 第二个标签页只读                                                    |
| A15  | 用户编辑中批准 AI 写入任务                                                                                | 任务进入 `waiting_lease` 并说明持有者；用户释放后自动重试并成功     |
| A16  | AI 任务持锁期间用户打开资源                                                                               | 只读并显示“AI 任务正在写入”；任务结束后恢复可编辑                   |
| A17  | 聊天卡片与任务面板同时批准同一任务                                                                        | 一处成功，另一处显示“已由某某处理”，无重复执行                      |
| A18  | 审批访问申请与分享菜单授权                                                                                | 显示项目名、文档标题、申请人姓名与邮箱；无 UUID；批准前有确认弹窗   |
| A19  | 后端返回权限拒绝、版本冲突、网络错误                                                                      | 用户看到本地化可操作提示；无 `[object Object]`、无英文异常原文      |
| A20  | 全局 Project BYOK 未配置                                                                                  | 聊天顶部提示条；管理员链接到 `/admin/ai/config`；发送明确失败不回退 |
| A21  | 桌面宽屏、1040px、760px 三档，浅色与深色                                                                  | 布局无溢出；窄屏左栏抽屉与主区域切换可用                            |
| A22  | 全部改动的 lint、typecheck、聚焦测试与 Prettier                                                           | 通过；基线已有错误单独记录                                          |

## 12. Docker、运行同步与交付

- 复用 `localmind-affine:test` 与已有 Linux 容器做聚焦验证；只有运行时、打包或
  里程碑验证才构建 `localmind-affine:local`。重建前运行 `docker system df`。
- P1 的删表迁移执行前必须备份当前业务数据库；从备份恢复的库上验证迁移成功，
  记录被丢弃的旧引用数量。
- 完成 Linux 验证后用 `yarn localmind:sync:all` 同步 `http://localhost:3011`，
  在真实浏览器完成 A03 到 A21。
- 交付报告包含：改动文件、验证命令与结果、迁移与备份证据、事件通道证据、租约
  并发测试证据、浏览器截图、镜像与磁盘状态、剩余风险。
- 不 commit、push、创建 PR、远端发布或删除持久化数据，除非用户明确要求。

### 工作区导入入口补齐（2026-09-08）

文件区新增“从工作区导入”及导入状态/记录。两步选择器遵循个人可读范围，当前
目录作为目标；缺少分享权限时由通知审批并由后台自动执行独立复制。持久化、
审批与幂等语义见 `project-native-resources.md` 的 Workspace 导入章节。
