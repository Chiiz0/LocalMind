# Project Native Resources Goal 指令

以下指令供后续启动实现任务使用。本文件本身不启动 goal。

```text
请创建并执行一个 goal：完整实现 LocalMind 的 Project 原生文档、文件树、独立内部副本，以及显式发布/更新到 Workspace 的工作流。

先检查 git status，读取 AGENTS.md 和 docs/ai-modernization/README.md 指定的必读文档。以 docs/ai-modernization/tracks/project-native-resources.md 为本次已确认的产品与验收契约，并结合 project-ai-boundaries.md、intelligence-workbench.md、docs/office-native/README.md 和 Docker 约束。产品分歧已经讨论完毕，不再重新引入被否定的方案；实现细节按现有代码和本文不变量保守决定。

必须实现：
1. Project 真正拥有内部资源和持久化文件树。默认新建、编辑、保存不属于任何 Workspace，不弹 Workspace 位置选择器；只有 Project 身份而无 Workspace 成员资格的用户也能完成内部人工和 AI 工作流。不得用隐藏 Workspace、假 workspaceId 或仅改 UI 规避原生归属。
2. 项目内部与 Workspace 文档都是独立副本，使用不同 ID 和版本历史。内部编辑不影响外部，外部编辑不自动回流。只有明确指令才发布、更新指定外部目标或读取源文档新版。
3. 所有有效 Project 成员默认可读写内部文档和目录；不新增 Project 发布权限、Owner 专属门槛。对外操作检查目标 Workspace/目录/文档实时 ACL；Workspace 导入项目沿用来源读取、复制和分享权限检查。
4. 用户明确要求保存到 Workspace 时，先在 Project 创建真实文档，再单独执行发布。取消、失败和过期保留内部文档。新外部文档使用目标权限，更新已有外部文档保留原 ACL；准确绑定目标 ID，比较版本和差异，禁止隐式同步或覆盖冲突。
5. Project 文件树支持新建、嵌套、编辑、重命名、移动、排序、回收与恢复。Workspace 位置选择器按层浏览，支持面包屑、上一级、有界搜索、分页、当前目录保存和新建文件夹；不得展平全部后代目录。
6. 旧 Project 引用迁移为合法授权的内部副本，保留来源、类型、附件和审计，Workspace 原文档不变。迁移可中断、重试和对账。权限不足保留可恢复条目，不越权复制；旧会话/排队任务不得恢复为意外的 Workspace 写回。
7. 内部创建、外部发布、目录创建、审批、取消、冲突、幂等、租约、失败和恢复有持久状态及真实回执；修复等待状态显示 Created、位置选择器提示与实际能力不符、同名等待请求无法区分等问题。
8. 复用现有 BlockSuite、Native Office、API、存储和 Agent Runtime，保留原生 Docs/Sheets/Slides/PDF 类型、共享权限与审计边界、全局 Project BYOK、All projects 不聊天和既有跨 Workspace 独立复制行为。

按设计文档 P1-P6 顺序推进，逐阶段记录完成情况，但以整个验收矩阵 A01-A22 通过作为完成标准。完成后端、前端、共享协议、生成文件、数据库迁移、数据回填和实际工作流，不停在计划、脚手架、只读字段、部分阶段或 mock 测试。

验证必须包括聚焦模型/权限/API/worker/frontend 测试、相关 typecheck/lint/format、Prisma 与 GraphQL 生成、空库全量迁移、从当前真实旧版本备份恢复后的升级与幂等回填、权限拒绝、失败/取消/冲突/重放/租约交接，以及真实浏览器桌面和窄屏浅深主题验收。记录基线已有错误，修复本次引入的错误，不把未完成检查写成通过。

复用 localmind-affine:test 和已有 Linux 容器；遵守固定镜像、磁盘和不删除业务数据的约束。完成数据库备份与同平台 Linux 验证后，用仓库现有 localmind:sync 脚本同步当前本地运行环境，再在 http://localhost:3011 验收。不得通过直接写生产表、手工拼接容器文件或隐藏 Workspace 达成结果。

保留用户和其他任务已有改动，尤其全局 Project BYOK 与正在变化的 schema/GraphQL。遇到可解决的工程问题继续推进，不重新询问已确认的产品选择；确有外部阻塞时准确说明阻塞和可恢复状态，不宣称完成。没有明确授权不要创建子代理，不 commit、push、创建 PR、远端发布或删除持久化数据。

最终提供实现与文档变更、验收矩阵结果、精确验证命令、迁移/回填和例外、备份及浏览器证据、镜像/磁盘状态、运行地址和剩余风险。仅在整个目标实际完成后标记 goal 完成。
```
