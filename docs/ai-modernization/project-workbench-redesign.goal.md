# Project Workbench Redesign Goal 指令

以下指令供后续启动实现任务使用。本文件本身不启动 goal。

```text
请创建并执行一个 goal：按已确认的设计完成 LocalMind Project 工作台体验重构，包括旧 Workspace 引用模型整体退场、独立壳与真实路由、主区域文件树、实时更新替代轮询、独占编辑租约、聊天与任务面板双入口审批，以及错误与文案规范。

先检查 git status，读取 AGENTS.md 和 docs/ai-modernization/README.md 指定的必读文档。以 docs/ai-modernization/tracks/project-workbench-redesign.md 为本次已确认的产品与验收契约；资源归属、导入与发布仍遵守 tracks/project-native-resources.md，会话与审批边界遵守 tracks/project-ai-boundaries.md，Office 遵守 docs/office-native/README.md，并遵守 Docker 约束。产品分歧已经讨论完毕：Project 使用独立壳而不改造全局导航，旧引用模型直接删除不做过渡兼容，多人编辑用独占租约而不是 CRDT 合并，Owner 不能强制解锁，聊天选择文档用文件树多选。不再重新引入被否定的方案；实现细节按现有代码和契约不变量保守决定。

必须实现：
1. 旧引用模型整体退场。删除 copilotContextProjectDocument 系列 GraphQL、resolver、模型方法、AiContextProjectDoc 表及迁移桥接（project-resource-migration、project-migrations、project-legacy 及其 gql）；AccessRequest 只保留 project_copy 路径。AI 上下文与 project-doc 工具改为读取 ProjectResource。出一条删表 Prisma 迁移，在空库与从当前真实备份恢复的库上验证，记录被丢弃的旧引用数量。
2. 独立壳与真实路由。/project 总览、/project/:projectId 项目页、/project/:projectId/resources/:resourceId 资源态，push 历史，可分享可后退；/intelligence、/chat 及旧变体重定向。删除宿主 Workspace 选择器与 host.ts；Workspace 侧边栏入口更名为“项目”并跳转到 /project；项目壳提供“返回工作区”。
3. 实时替代轮询。前端接入已有 core/project/gateway.ts 的 project:join/leave 与 project:resource-changed；后端按 registerRealtimeLiveQuery 模式新增 project.list.changed、project.task.changed、project.lease.changed 三个 topic 并登记 required-handlers。删除 intelligence 页面下全部 refreshInterval/setInterval 轮询与 window.dispatchEvent 通知，保留 15 秒兜底快照。
4. 主区域文件树与资源打开态。文件树移出左栏；拖拽移动与排序、多文件拖放上传到当前目录并显示逐文件进度、新建立即生成无标题资源并打开、每个条目独立 pending、回收站独立视图。资源打开时聊天并排可见，有面包屑、全屏切换、关闭前未保存提示。任务面板在项目页默认折叠为摘要行。
5. 独占编辑租约。新增 project_resource_edit_leases 表，按标签页持有，20 秒续约、60 秒过期，条件更新获取/续约、条件删除释放，写审计并发布事件。其他人与同一用户的其他标签页只读并显示持有者，可订阅释放通知。任何角色不能强制解锁。AI 写入任务必须以 ai_task 持锁，拿不到进入 waiting_lease 并在释放后自动重试一次；保留 expectedContentVersion 检查。Office 资源与普通文档共用同一套租约。
6. 审批双入口。任务记录是唯一真相源；聊天消息内卡片与任务面板调用同一 mutation，带幂等键与期望状态，后到者显示“已由某某处理”。批准 AI 写入前有确认弹窗。
7. 错误、文案与确认规范。后端为访问申请、任务、发布目标返回项目名、资源标题、申请人姓名与邮箱；前端不显示 UUID、枚举原文、后端异常原文或硬编码英文；统一 UserFriendlyError + notify，禁止 catch {} 吞错与 .catch(console.error) 静默；授权、批准写入、来源刷新、移除成员、转移所有权、退出、永久删除均有确认弹窗；纯 UI 动作不触发写 mutation。BYOK 未配置时显示可操作提示条。侧边栏“项目”、“复制到项目”、To do 计数含等待他人、Project Summary 默认当前项目。
8. 文档同步。更新 project-native-resources.md（删除第 8 章与 D11，标注被本 track 覆盖）、README、document-map、AGENTS.md 表格、用户指南与部署文档中的相关段落。

按设计文档 P1-P7 顺序推进，逐阶段记录完成情况，但以整个验收矩阵 A01-A22 通过作为完成标准。完成后端、前端、共享协议、生成文件、数据库迁移和实际工作流，不停在计划、脚手架、部分阶段或 mock 测试。

验证必须包括聚焦模型/权限/API/worker/frontend 测试、相关 typecheck/lint/format、Prisma 与 GraphQL 生成、空库全量迁移、从当前真实备份恢复后的升级、权限拒绝、租约并发（两标签页、两用户、AI 任务与用户争用、过期回收）、审批双入口并发、事件断连后的兜底收敛，以及真实浏览器桌面、1040px、760px 与浅深主题验收。记录基线已有错误，修复本次引入的错误，不把未完成检查写成通过。

复用 localmind-affine:test 和已有 Linux 容器；遵守固定镜像、磁盘和不删除业务数据的约束。执行删表迁移前备份当前业务数据库。完成同平台 Linux 验证后，用仓库现有 localmind:sync 脚本同步当前本地运行环境，再在 http://localhost:3011 验收。

保留用户和其他任务已有改动。遇到可解决的工程问题继续推进，不重新询问已确认的产品选择；确有外部阻塞时准确说明阻塞和可恢复状态，不宣称完成。没有明确授权不要创建子代理，不 commit、push、创建 PR、远端发布或删除持久化数据。

最终提供实现与文档变更、验收矩阵结果、精确验证命令、迁移与备份证据、事件通道与租约并发证据、浏览器证据、镜像/磁盘状态、运行地址和剩余风险。仅在整个目标实际完成后标记 goal 完成。
```
