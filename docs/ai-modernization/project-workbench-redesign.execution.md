# Project 工作台重构实施与验收记录

本次执行遵守 [已确认设计](tracks/project-workbench-redesign.md)，直接按文档实施；
阶段完成不代表交付，A01-A22 全部通过后才完成整个目标。

## 当前入口：2026-09-07 13:11 UTC

本节及文末最新证据覆盖下方历史停点。P1-P7 实现与 A01-A22 本次验收完成；
构建式前端 typecheck 的 6 条 BlockSuite 基线错误单独保留，不宣称全量检查通过。
普通任务执行，未创建或使用 goal、子代理；原有未提交改动全部保留。

- 3011 已完成 `localmind:sync:all`，业务库与源码均为 361 条迁移，13 条旧引用
  已退场。本次最终同步无待执行迁移，后端和 Web/Admin 打包成功，没有重建镜像。
- 浏览器 A03-A21 已逐项验证；A13 真实断网关闭后等待 61,291 ms 成员接管，
  Owner 无强制解锁入口。1440px、1040px、760px 的浅深主题、文件树和 Slides
  已核对截图，无可见溢出，窄屏导航和资源/聊天切换可用。
- 浏览器发现并修复资源直链后退的 data router 双导航冲突、quicksearch 嵌套 scope、
  租约 fragment 缺少 import，以及原生复选框被全局 appearance 清空的问题。
- 手工 Project Summary 增加不可变内容来源记录，复用当前 Owner 管理语义与行锁，
  不放宽自动记忆的来源约束。成员不显示 Owner 专属管理入口。四格式 Office 上传
  在保存 Blob 前按既有格式表规范化 MIME，保留原始字节。移除窄屏重复导航按钮，
  新 Project/Office AI 任务采用实际资源标题。
- Linux Summary/context 6 项及 session/Office/context 组合 17 项通过；其中真实
  41.6 秒 Office 准备观察续约和取消，迟到结果未提交。前端四格式 MIME 4 项、
  文件树 6 项、Summary 1 项和壳 15 项通过。壳旧 mock 依赖已移除，复验通过。
- 后端 6 文件聚焦类型检查、前端直接 tsc、oxlint、git diff --check 通过。
  构建式前端 typecheck 的 6 条 BlockSuite 基线问题仍保留。
- 361 条空库全量和两份真实备份升级均通过，13 张原有内容/审计表全行指纹一致。
  旧备份 `20260907T110531Z/migration-evidence-361.json` 证明丢弃 13 条引用；当前
  备份 `20260907T115456Z/migration-evidence-361.json` 证明 360 到 361 升级。
- 最新有效一致备份目录：
  `/Users/dev2/Documents/Codex/backups/localmind-project-workbench-20260907T115456Z`。
  备份期间短暂停止并恢复服务；30 个原生资源、360 条迁移、旧表计数 0。
  dump SHA-256 `f49b26738533c319d7d5a9a28f5e6dd183c2ce8c7e09b899120de94ebbea9eaf`；
  files SHA-256 `b20cd15ae08a6d7705959766995315b141e3f0530bb031e0eabdb4c34bebfa05`。
- 同步命令：`LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_project_native_runner
LOCALMIND_DATABASE_BACKUP=/Users/dev2/Documents/Codex/backups/localmind-project-workbench-20260907T115456Z/database.dump
yarn localmind:sync:all` 已成功；前端最后两处布局修复再用 `localmind:sync:web`
  同步并复验成功。没有重建镜像或删除卷。
- A19 的真实 403/409/断网均显示中文可操作提示，草稿保留。A21 补齐 Slides 编辑
  容器布局和聊天浮动滚动按钮定位，窗口与容器宽度不一致时也无编辑控件重叠。
- 最新 Linux 前端 34 文件 205 项、后端 Office/资源 API/模型 22 项通过；普通文档
  结构化错误修复后追加 3 文件 19 项通过。前端直接 tsc、后端 7 文件聚焦类型检查
  和全改动 oxlint 通过。仍不宣称 monorepo 全量 typecheck 通过。

## 基线与备份

- 启动时已有改动：`AGENTS.md`、`README.md`、`document-map.md`，以及未跟踪的
  `project-workbench-redesign.goal.md` 和 track。继续保留这些改动。
- 2026-09-07 业务库备份目录：
  `/Users/dev2/Documents/Codex/backups/localmind-project-workbench-20260907T063841Z`。
- `node /tmp/localmind-project-workbench-backup.cjs` 已完成一致备份；备份期间短暂停止
  `localmind_affine_server`，随后恢复启动。目录 0700，文件 0600。
- `database.dump`：6,785,707 字节，SHA-256
  `a0414c760c9125506c1627d2f82e6254db0eb6d013ddc2f521654ef0084b3b91`。
- `files.tar.gz`：18,382,991 字节，SHA-256
  `d85d012b9325125f46ad0084c342153e8b200ae3ff3bb27b88a08a7454ac2133`。
  包含 Blob、配置、环境和企业 CLI 数据，不在仓库公开凭据。
- 备份时：354 个已完成迁移，13 条旧引用，其中 4 条已复制；13 条迁移记录，27 个
  原生资源。删表后原生资源必须保留，旧引用 13 条退场，其中未复制 9 条。
- 现有 Linux runner：`localmind_project_native_runner`，镜像 `localmind-affine:test`，
  无宿主源码挂载，后续须同步验证源码。业务运行地址 `http://localhost:3011`。
- 初始 `docker system df`：镜像 54.88 GB，容器 10.24 GB，卷 1.15 GB，构建缓存
  2.913 GB。未重建或删除镜像、卷、业务数据。
- 前端类型检查复现 BlockSuite `conversion-preservation.unit.spec.ts` 的
  `DefaultViewDataType` 6 条基线错误；本次新增消费者错误已修复，待最终复跑。

## P1 迁移与验证证据

- `node /tmp/localmind-project-workbench-migrations.cjs`：通过。空库
  `localmind_project_workbench_empty_20260907065624` 与由真实备份恢复的
  `localmind_project_workbench_upgrade_20260907065624` 均完成 355 条迁移。
- 旧引用表及两张迁移桥接表已从这两个验证库删除。丢弃 13 条旧引用，其中 9 条
  未复制；27 个原生资源、38 个版本、72 个项目 Blob、Office 和来源授权审计的
  全行指纹保持一致。证据：备份目录下的 `migration-evidence.json`。
- Prisma generate 与 Nest AppModule schema 生成、`yarn workspace @affine/graphql build`
  已完成。schema 生成结束关闭应用时出现 seat allocation 的 P2028 日志，未影响
  生成产物；不能将其报告为无错误运行。
- Linux 行为测试使用独立库 `localmind_project_workbench_test_20260907`；测试清库
  不影响恢复库和业务库。授权 7 项、会话资源选择与撤权、Project 导入、context
  permission/planner 已通过；旧文档操作 fixture 修正后的组合回归仍在执行。
- 前端首轮 8 文件 95 通过、13 失败；失败来自测试 mock 缺少 Modal。
  修复 mock 后 `yarn vitest run packages/frontend/core/src/desktop/pages/intelligence/index.spec.tsx`
  13 项通过。最终聚焦组合与 lint/format 尚待执行。
- 业务库未执行删表，3011 尚未同步；没有重建镜像。

## P1 依赖盘点

- 旧引用模型被 Context Memory 的项目列表/创建/替换、授权审批占位逻辑、权限测试
  及 sync/blob 测试使用；AI scope 与 project-doc 工具仍通过 grant 列举旧内容。
- 迁移桥接覆盖模型、定时 worker、resolver、GraphQL operation、前端历史面板及测试。
- 旧 GraphQL documents 选择集还被项目工作台与 Workspace AI Context 设置消费。
- 导入来源授权、grant 与不可变审计保留；项目内容入口统一到 ProjectResource。
- 既有已应用 SQL 迁移保留其历史内容和校验和；通过新增迁移删除当前表及桥接约束。

## P2/P3 当前验证

- P2 使用事务发件箱 `project_realtime_outbox`，数据库触发器随业务事务提交作用域
  失效通知；`notification.projectRealtime` 队列每秒投递，每批 200 条，失败保留重试。
  项目与成员、任务与审批、文件请求、发布、资源和 Office 版本均接入。前端共享
  订阅资源房间与列表/任务 topic，保留一个 15 秒兜底时钟。租约 topic 已注册，
  实际租约写入与快照由 P5 实现。
- `20260907020000_project_realtime_outbox` 已应用到独立测试库
  `localmind_project_workbench_p2_20260907`（356 条迁移）。最终空库与真实备份升级
  仍须随 P5 新迁移一并重跑，不沿用 P1 的 355 条迁移证据。
- Linux 组合测试 15 项通过：`project-redirect.spec.ts`、`project-realtime.e2e.ts`、
  `project-resource-api.e2e.ts`、`intelligence-workbench.e2e.ts`。覆盖事务回滚、投递
  失败保留、重复消费者、成员移除、无关用户隔离、真实 resource/list/task socket、
  断连变更后的重连快照、HTTP 301 与原生 Project 会话权限。
- 命令：`docker exec -e REDIS_SERVER_HOST=localmind_project_native_final_redis
-e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace
localmind_project_native_runner node --input-type=module -e 'import {spawnSync}
from "node:child_process";const u=new URL(process.env.DATABASE_URL);
u.pathname="/localmind_project_workbench_p2_20260907";process.exit(spawnSync("yarn",
["workspace","@affine/server","test","src/__tests__/copilot/project-redirect.spec.ts",
"src/__tests__/copilot/project-realtime.e2e.ts","src/__tests__/copilot/project-resource-api.e2e.ts",
"src/__tests__/copilot/intelligence-workbench.e2e.ts","--timeout=3m"],
{env:{...process.env,DATABASE_URL:u.toString()},stdio:"inherit"}).status ?? 1);'`。
- `yarn vitest run packages/frontend/core/src/desktop/project-router.spec.ts
packages/frontend/core/src/desktop/pages/intelligence/index.spec.tsx
packages/frontend/core/src/desktop/pages/tasks/index.spec.tsx`：33 项通过。
  搜索与 realtime store 组合 8 项通过，包含分页重复点击、请求取消与 15 秒兜底。
- `yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false`：通过。
  `yarn tsc -b packages/frontend/core/tsconfig.json --pretty false`：仍有上述 6 条
  BlockSuite 基线错误。误用后端聚焦脚本检查前端曾报 rootDir 错误，该无效检查
  不作为产品缺陷或通过证据。
- Blocker 快速状态转换曾偶发“resolution time cannot precede creation”，移除临时
  诊断后两次组合回归通过；未修改该时间规则，最终回归继续观察。新 socket 测试的
  最初 fixture 误设申请人与接收人相同，被数据库约束拒绝；修正为两个成员后通过。
- P3 已删除宿主选择器与 `host.ts`，新建真实 `/project` 路由、服务端与客户端旧地址
  重定向、默认 server scope 的 `/tasks`、项目与资源快速搜索及独立外观设置。
  真实浏览器及最终 Linux 前端检查待 P7。
- 业务库和 3011 未同步，未重建镜像。

## P4 当前验证

- 文件树已进入主区域，支持条目拖放与目录末尾放置、多文件上传到当前目录、最多
  3 个并发上传、逐文件进度/重试与卸载取消；新建无标题资源立即打开。
- 聊天文件选择复用只读文件树，16 项上下文预算扣除附件，选择按会话保存；未改变
  选择直接关闭，不写 mutation。普通文档、Office 与聊天保持共同布局。
- 普通文档和 DOCX/Sheets/Slides/PDF 登记草稿，关闭与历史切换共用保存/放弃/取消。
  DOCX 的失焦不保存，页面/对象/页眉页脚弹窗登记修改；Sheets/Slides/PDF 内部选区
  切换也接入确认，避免丢弃尚未保存的编辑。
- Linux 前端组合 11 文件 106 项通过；模型/API 组合
  `project-resource-api.e2e.ts`、`project-context.e2e.ts` 8 项通过，包含标题同步。
  最新 Office 草稿和文件树 Linux 5 文件 14 项通过；真实拖放和上传工作流留待 P7。
- `yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false` 通过。
  新增 DOCX fixture 缺少 fields/bookmarks/stats 的类型错误已补齐。局部 lint 发现
  import 排序、type import 与 dataset 规则问题，已修正，最终组合检查待 P7。
- 回收站已有独立视图；永久删除 API 与确认仍待实现，不记为通过。

## 阶段（当前）

| 阶段            | 状态                   | 当前证据                                                            |
| --------------- | ---------------------- | ------------------------------------------------------------------- |
| P1 旧模型退场   | 实现与验证通过         | 361 条空库全量及真实备份升级；旧引用与桥接源码检索无结果            |
| P2 实时接入     | 实现与验证通过         | 真实 socket、事务发件箱、284ms 资源事件与 14,125ms 断连兜底         |
| P3 壳与路由     | 实现与验证通过         | 独立壳、来源 Workspace 返回、资源直链后退与旧路由重定向             |
| P4 文件树与资源 | 实现与验证通过         | 真实拖放、上传失败重试、永久删除确认、四格式编辑与草稿保护          |
| P5 编辑租约     | 实现与验证通过         | 多标签页、61,291ms 过期接管、AI 等待与持锁、真实续约取消和 handoff  |
| P6 审批与文案   | 实现与验证通过         | 双入口一次执行、处理人、名称、BYOK、Summary；真实中文错误与权限提示 |
| P7 集成验收     | 验收完成，基线例外单列 | 361 条迁移、3011 同步、全部浏览器矩阵；未把聚焦 tsc 视为全量检查    |

## 验收矩阵

以下均为本次工作台验收，不沿用原生资源项目的同编号结果。
浏览器原始证据位于 `/tmp/localmind-project-workbench-qa/`，最终归档位置见文末。

| 编号 | 结果           | 本次证据                                                                                                                                      |
| ---- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | 通过           | 四个旧模型标识在 `packages/blocksuite/tools/scripts/tests` 源码检索无结果；361 条空库与两份真实备份恢复升级完成                               |
| A02  | 通过           | `browser-context.json`：真实模型读取两份原生文件；多选刷新恢复、新会话隔离、无变化不写入                                                      |
| A03  | 通过           | `browser-layout.json`：工作区侧边栏进入独立壳，返回准确的来源 Workspace                                                                       |
| A04  | 通过           | `browser-base.json`、`browser-layout.json`：资源直链打开与后退留在 Project 壳                                                                 |
| A05  | 通过           | 真实 HTTP 重定向测试与 `browser-base.json` 的旧 Intelligence 地址                                                                             |
| A06  | 通过           | `browser-realtime.json`：另一成员创建、重命名、删除收敛；创建 284ms，接收 5 个事件                                                            |
| A07  | 通过           | 同上：同时阻断 websocket 与长轮询后，14,125ms 兜底收敛，期间无资源事件                                                                        |
| A08  | 通过           | `browser-drag.json`：实际排序、拖入目录、多文件上传；一个网络失败单独重试成功                                                                 |
| A09  | 通过           | `browser-files.json`：直接创建 Untitled 并打开，无命名弹窗                                                                                    |
| A10  | 通过           | `browser-base.json`：资源旁聊天、面包屑和不改路由的全屏切换                                                                                   |
| A11  | 通过           | 同上及 `browser-office.json`：保存/放弃/取消；放弃无写入；四格式编辑后保存重开                                                                |
| A12  | 通过           | `browser-leases.json`：两成员只读持有者姓名与释放通知                                                                                         |
| A13  | 通过           | 同上：真实断网关闭后 61,291ms 接管；期间 Owner 没有强制解锁入口                                                                               |
| A14  | 通过           | 同上：同一用户第二标签页只读                                                                                                                  |
| A15  | 通过           | `browser-ai.json`：真实模型请求的 Sheets 修改等待用户租约，释放后重试一次并成功                                                               |
| A16  | 通过           | `browser-ai-held.json`：真实 Office worker 在准备后受控暂停，用户只读；完成后 15,077ms 重新可编辑，版本 2，执行结果仅 1 条                    |
| A17  | 通过           | `browser-ai.json`：聊天卡片与任务面板并发批准，同 mutation 一处 applied=true、一处 false，后到者显示处理人                                    |
| A18  | 通过           | `browser-access.json`：任务和分享菜单确认均展示名称/邮箱、无 UUID；最终重新查询两项均 approved                                                |
| A19  | 通过           | `browser-errors.json`：真实服务端 409 和非成员 403、真实请求断网；中文提示与草稿保留                                                          |
| A20  | 通过           | `browser-byok.json`：隔离实例真实无全局 BYOK，管理员链接、成员联系提示，SSE 明确失败无回退                                                    |
| A21  | 通过           | 文件树与 Slides 六档浅深截图人工核对；`browser-final-layout.json` 和脚本验证聊天浮动按钮位于聊天范围内                                        |
| A22  | 通过，基线例外 | Linux 34 文件 205 项、后端资源/Office 22 项及后续聚焦回归；全改动 oxlint/Prettier，前端直接 tsc、后端聚焦 tsc；BlockSuite 构建式 6 条基线保留 |

## 历史：2026-09-07 阶段性停点

按用户最新要求，本次直接按设计文档实施，完成阶段性收尾后暂停继续扩展。
P6/P7 未开始；未同步业务环境，不将当前工作区视为可交付版本。

### P5 已落地

- 新增 `20260907030000_project_resource_edit_leases`，租约唯一到资源，包含持有者、
  标签页、独立租约 ID、用户/AI 类型、任务引用、获取与过期时间。独立租约 ID
  防止同一标签页重新获取后被旧请求释放或续约。
- 获取/续约/释放执行条件写入；数据库触发器记录获取、释放和过期的不可变审计，
  并写 realtime outbox；续约拒绝单独记审计。没有 Owner 强制解锁能力。
- 新增租约 GraphQL 查询和三个 mutation、`project.lease.get` 快照，登记 required
  handlers；沿用 `project.lease.changed` 事件与既有发件箱投递。
- AI worker 获取 `ai_task` 租约；争用时任务持久化为 `waiting_lease`，释放事件
  恢复排队，数据库限制自动重试次数为 0 或 1。任务结束/失败的 finally 释放租约。
- 普通文档追加版本、Office command 的真实持久化路径接入租约校验；AI adapter
  传递自己的 worker 租约证明。内容版本/revision 检查保留。
- 前端租约 provider、只读提示、20 秒续约、关闭/pagehide 释放、通知复选框已接入
  文档和 Office；这些 UI 逻辑目前只有类型/静态检查，尚未通过完整行为验收。
- 文档会话不再在版本冲突后自动合并本地和远端 Yjs 修改；保留本地草稿等待处理。

### 本轮检查与证据

- 复用 `localmind_project_native_runner` / `localmind-affine:test`，没有构建镜像。
  `node /tmp/localmind-workbench-sync-runner.cjs` 最后同步 161 个源码文件并移除
  runner 中 32 个已退场源码文件；这不是运行环境同步，没有触碰 3011。
- 新迁移在 `localmind_project_workbench_p2_20260907` 和 schema 生成专用库
  `localmind_project_workbench_test_20260907` 应用成功，均为 357 条迁移。
  357 条的空库全量迁移与真实备份恢复升级尚未执行，P1 的 355 条证据不能代替。
- 真实 PostgreSQL 租约测试 4 项通过，两轮结果一致：两标签页/两用户只产生一个
  持有者；非持有者（包括 Owner）无法释放；过期替换后旧请求不能续约/释放；
  撤权拒绝；worker handoff 与等待恢复只自动排队一次。过期测试通过数据库时间
  fixture 模拟，尚未进行真实浏览器的 60 秒等待验收。
- 最后 Linux 前端 6 文件 21 项通过，覆盖 Office 草稿放弃/显式保存、选择取消、
  文件树基础交互和文档冲突保护。测试仍输出 Lit/KaTeX 开发模式、部分 fixture
  缺少 i18next instance 的警告；没有将这些日志描述为无警告执行。
- Prisma format/generate、Nest schema 生成、GraphQL codegen、i18n build 均通过。
  测试模式下 Nest schema 实际写入
  `/workspace/packages/backend/server/node_modules/.cache/schema.gql`，由该生成文件
  更新服务端 schema；首次误读旧 `src/schema.gql` 导致 codegen 失败，已修正。
- `yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false` 通过。
  GraphQL 和 i18n 的引用声明先用各自 `tsc -b` 更新；初次前端类型错误来自旧声明，
  重建后消失。前序记录的 6 条 BlockSuite 构建式 typecheck 基线错误仍保留。
- 后端本轮两组聚焦 typecheck（7 个和 10 个文件）通过；24 个本阶段 TS/TSX 文件
  oxlint 通过；这 24 个文件、5 个新 GraphQL 文件和执行记录的 Prettier 检查通过。
  最终 `git diff --check` 通过，本阶段 TS/TSX 文件没有残留冲突标记。
- 备份文件 SHA-256 复核与本记录开头一致。2026-09-07 09:41 UTC 磁盘：镜像
  54.89 GB、容器 10.24 GB、卷 1.15 GB、构建缓存 2.913 GB。未删除业务数据或卷。
- `curl -I --max-time 10 http://localhost:3011/project` 返回 200，仍是原有运行版本，
  不是新工作台验收。未 commit、push、创建 PR 或远端发布。

本轮 Linux 模型命令：

```sh
docker exec -e REDIS_SERVER_HOST=localmind_project_native_final_redis \
  -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js -w /workspace \
  localmind_project_native_runner node --input-type=module -e \
  'import {spawnSync} from "node:child_process";const u=new URL(process.env.DATABASE_URL);u.pathname="/localmind_project_workbench_p2_20260907";process.exit(spawnSync("yarn",["workspace","@affine/server","test","src/__tests__/copilot/project-edit-lease.e2e.ts","--timeout=3m"],{env:{...process.env,DATABASE_URL:u.toString()},stdio:"inherit"}).status ?? 1);'
```

本轮 Linux 前端命令：

```sh
docker exec -w /workspace localmind_project_native_runner yarn vitest run \
  packages/frontend/core/src/modules/project-resources/document-session.spec.ts \
  packages/frontend/core/src/desktop/pages/workspace/office/document-editor.spec.tsx \
  packages/frontend/core/src/desktop/pages/workspace/office/spreadsheet.spec.tsx \
  packages/frontend/core/src/desktop/pages/workspace/office/presentation.spec.tsx \
  packages/frontend/core/src/desktop/pages/workspace/office/pdf.spec.tsx \
  packages/frontend/core/src/desktop/pages/intelligence/project-files.spec.tsx
```

生成与类型检查命令：

```sh
yarn workspace @affine/server prisma format
yarn workspace @affine/server prisma generate
yarn workspace @affine/graphql build
yarn workspace @affine/i18n build
yarn tsc -b packages/common/realtime/tsconfig.json --pretty false
yarn tsc -b packages/common/graphql/tsconfig.json --pretty false
yarn tsc -b packages/frontend/i18n/tsconfig.json --pretty false
yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false
git diff --check
```

### 下一步顺序与已知缺口

1. 补齐 P4/P5 写入口：文件树重命名、来源刷新/覆盖仍未传入租约证明，当前后端会
   拒绝这些已有资源的写入。接通用户短操作与当前编辑会话证明；回收站永久删除 API
   和确认尚未实现。旧资源/Office 测试 fixture 也需补齐租约，先前无租约版本的
   API 测试结果不代表当前接口兼容。
2. 完成 P5：任务投影/状态文案仍未纳入 `waiting_lease`；AI 长执行的续约、取消
   与租约过期的组合行为仍需完善。验证同页重复挂载、pagehide/pageshow、迟到获取
   结果、连续续约失败、释放通知；检查新标签页标识对离线草稿恢复的影响。
   增加真实 API/Office/worker 保存及争用测试，证明成功与拒绝路径，而非仅模型。
3. 进入 P6：聊天与任务审批同一幂等 mutation、期望状态与处理人结果；名称字段、
   本地化错误、确认弹窗、BYOK 提示、计数与 Summary 默认项目。旧错误原文与
   `.catch(console.error)` 仍存在，尚未完成统一治理。
4. P7：最终源码下重跑空库与真实备份恢复升级、全套聚焦回归、事件断连收敛及
   编辑/审批并发；满足 Linux 检查后再用仓库 `localmind:sync` 同步 3011，完成
   桌面/1040px/760px 和浅深主题浏览器验收，逐项关闭 A01-A22。

## 2026-09-07 继续实施：P4-P6 收尾与 P7 验证

本节覆盖前述阶段性停点中的未完成状态。普通任务执行，未创建或使用 goal、子代理。
当前尚未同步业务环境；以下实现与验证证据分开记录。

### 本轮实现

- 文件树重命名、来源刷新和 Office 来源覆盖传递真实租约证明。前端共享租约 store
  采用引用计数与串行获取、续约、释放，短写复用编辑器证明。修复 15 秒快照不断
  推迟 20 秒续约计时的缺陷。
- 永久删除通过不可恢复 tombstone 隐藏资源及其后代，阻止读取、下载、恢复、租约
  获取和创建重放；校验成员、期望版本与活动租约，保留幂等结果和不可变审计。
  历史版本、字节和发布证据保留，不是物理擦除历史数据。
- Office worker 在事务外准备，20 秒续约，最长 5 分钟，取消、续约失败或超时立即
  停止等待；迟到准备闭包不提交。续约通过有 timeline 证据的状态转换更新 worker
  和资源期限，旧 worker 无法续约、提交或释放新 worker 的租约。
- 聊天工具直接执行也获取资源租约，争用进入持久化 `waiting_lease`，执行函数复用
  后台 worker 的命令恢复入口，finally 释放。补齐旧模型、发布、context、文件请求
  和会话 fixture 的真实租约，保留版本冲突拒绝断言。
- `waiting_lease` 纳入任务、To do、等待他人和历史投影，返回持有者姓名与重试次数。
  聊天、项目任务和全局任务共用 `decideProjectAgentTask`：幂等键、期望状态、目标
  fingerprint、批准/拒绝/取消 decision、处理人及时间；运行中重复取消只应用一次。
- 访问申请、授权、任务补充名称字段；审批确认展示对象与权限。Project 错误统一
  映射到本地化权限、冲突、网络、不可用和失败提示。全局任务页移除两处 5 秒轮询，
  使用共享任务事件与 15 秒兜底快照。
- 聊天顶部显示全局 Project BYOK 配置提示，管理员进入 `/admin/ai/config`，成员
  联系管理员；Summary 入口固定当前项目。展开面板和切换视图不写 mutation。
- 标签页租约 identity 与草稿 identity 分离；刷新/历史恢复复用草稿 identity，复制
  标签页创建新的 identity。其他标签页遗留草稿可显式恢复到当前标签页，校验
  server/account/project/resource 作用域，不自动合并远端内容、不删除原始草稿。

### 迁移证据

- 最终源码共有 360 条迁移。新增 `0400` 永久删除、`0410` 幂等身份与 `0600` 文件
  请求实时触发器。空库发现既有 `0500` 才创建 `project_file_requests`，因此本次
  未发布 `0200` 改为有表时安装触发器，`0600` 在建表后补装；未改既有 `0500`。
- `node /tmp/localmind-project-workbench-migrations.cjs` 通过：空库
  `localmind_project_workbench_empty_20260907103752`、备份升级库
  `localmind_project_workbench_upgrade_20260907103752` 均完成 360 条迁移。
  13 条旧引用退场，13 张原有内容/审计表全行指纹一致，包含 27 资源、38 版本、
  81 资源审计、72 项目 Blob、6 Office artifact、9 Office revision。
- `20260907T063841Z` 备份两文件 SHA-256 复核与本记录开头一致；证据在该备份
  目录的 `migration-evidence.json`。首次失败的隔离空库保留，未清理数据。
- 两个行为/schema 专用库已应用 `0600`。原隔离库曾应用早期 `0200`，其校验和
  不伪造为当前源码；最终空库及备份升级结果作为完整迁移链证据。

### 已完成的行为检查

- Linux 租约和四格式 Office 组合 11 项通过；真实长执行测试 1 项通过：准备
  挂起 42.5 秒，观察真实 20 秒续约，取消后 worker 结束且迟到闭包不提交，版本仍 1。
- 前端新增释放通知、AI 释放后重新获取编辑权和 Summary 当前项目/重复提交保护，
  与发布面板回归合计 3 文件 11 项通过。文件树 6 项、草稿会话 8 项、tab identity
  2 项及共享 store 的重复挂载、迟到响应、连续失败、pagehide/pageshow 检查通过。
- 真实 Nest schema 重新生成，GraphQL codegen 和声明生成通过。构建式前端
  typecheck 的 6 条 BlockSuite 基线错误仍单独保留，不把聚焦检查称为全量通过。
- 最终 Linux 组合、全部改动的静态检查、最新业务备份、3011 同步和 A01-A22
  浏览器矩阵正在继续；在最终结果追加前，不将本节视为完整交付证明。

### 同步前最终检查与最新备份

- Linux 前端：`node /tmp/localmind-workbench-front-tests.cjs`，31 文件 190 项通过。
  精确文件列表和完整日志在 `/tmp/localmind-project-workbench-qa/frontend-command.json`
  与 `frontend-tests.log`。仍有 Lit/KaTeX 开发模式和 fixture 警告。
- Linux 后端：模型资源、发布、文件请求、context、session、lease 共 6 文件 53 项
  通过；审批 API 兼容旧取消入口的最后修复后，session/lease 2 文件 15 项复验通过。
- 后端全部改动的 67 个 TS 文件聚焦 typecheck 通过；前端直接 `tsc -p ... --noEmit`
  通过。不是 monorepo 全量 typecheck。全部改动的 oxlint、Prettier、`git diff --check`
  通过，Impeccable 静态扫描无失败项。
- 最新一致备份：
  `/Users/dev2/Documents/Codex/backups/localmind-project-workbench-20260907T110531Z`。
  备份时短暂停止并恢复本地服务，354 条已应用迁移，13 条旧引用，27 个原生资源。
  `database.dump` 6,788,315 字节，SHA-256
  `e7fc1af318d4a7a90759983feb4192145134ec8bc775f561ff63dee5eb398dcd`；
  `files.tar.gz` 18,382,991 字节，SHA-256
  `eebd5241243c3941a07e625f40f0c20c36e9b120e2abc7b0c1832014a1ba5a73`。
- 从最新备份恢复的 `localmind_project_workbench_upgrade_20260907110612` 和全新
  `localmind_project_workbench_empty_20260907110612` 均完成 360 条迁移。
  13 张表全行指纹保持一致，最新证据在备份目录 `migration-evidence.json`。
- 开始同步：`LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_project_native_runner
LOCALMIND_DATABASE_BACKUP=/Users/dev2/Documents/Codex/backups/localmind-project-workbench-20260907T110531Z/database.dump
yarn localmind:sync:all`。完成结果及浏览器证据在后续章节记录。

## 2026-09-07 最终收敛证据

### 最终实现

- P4/P5 的所有已列缺口已落地：短操作租约、永久删除 API/确认、等待投影计数、
  worker 续约和取消、过期及 handoff、一次自动重试、前端共享租约生命周期与
  标签页草稿恢复。永久删除保留审计和历史字节，不提供恢复入口。
- P6 双入口审批共用 `decideProjectAgentTask`。Office 工具卡片采用本地化修改数量、
  版本和批准状态，不展示任务 UUID、原始枚举或服务端异常；i18n 使用真实生成产物。
- A19 真实测试发现 Office 普通 Error 被序列化为 500。增加既有错误体系的
  `ResourceConflict`（409），接入单命令、批量命令、最终持久化与 Project 内容/树
  版本检查。四格式 API 冲突均不增加版本，错误不包含 revision ID。
- 普通文档会话保留 `UserFriendlyError` 对象，避免字符串化丢失状态；恢复旧草稿
  遇到远端新版时返回结构化冲突并保留原草稿。非成员直链跳回总览前显示权限通知。
- Office 当前/历史版本统一显示“版本 N”；常驻重复刷新删除，保留历史或冲突时
  显式读取当前版本与错误重试。来源刷新仍是需要确认的外部版本复制操作。
- Slides 按编辑容器宽度布局，窄区域缩略图横排、属性面板下移，避免窗口较宽但
  资源区域较窄时画布被挤压；字体随实际页面比例缩放。聊天滚动悬浮按钮限定在
  聊天内容包含块内，避免覆盖旁边的资源操作。

### Linux 与静态检查

复用 `localmind_project_native_runner` / `localmind-affine:test`；同步 runner
206 个源码文件并移除 32 个退场源码文件。测试库与业务库分离，未删业务数据或卷。

```sh
node /tmp/localmind-workbench-sync-runner.cjs
node /tmp/localmind-workbench-front-tests.cjs
node /tmp/localmind-workbench-check.cjs localmind_project_workbench_p2_20260907 \
  yarn workspace @affine/server test \
  src/__tests__/copilot/project-office.e2e.ts \
  src/__tests__/copilot/project-resource-api.e2e.ts \
  src/__tests__/models/project-resource.spec.ts --timeout=3m
node /tmp/localmind-workbench-format.cjs lint
node /tmp/localmind-workbench-format.cjs
yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false
git diff --check
```

- 前端改动测试组合 34 文件 205 项通过，命令清单与日志分别在
  `frontend-command.json` / `frontend-tests.log`。普通文档错误修复后 3 文件 19 项，
  Slides/壳 2 文件 18 项、聊天滚动/壳 2 文件 21 项追加回归通过，不累加成独立用例数。
- 上述后端组合 22 项通过，包括四格式真实写入/重放/冲突/撤权、租约拒绝、永久删除
  API、并发版本、实时收敛及 40.7 秒准备续约后取消，迟到准备结果不提交。
- 前序后端 6 文件 53 项和 session/lease 15 项仍适用于未再改动的对应路径；前序
  67 文件后端聚焦 tsc，加本轮 7 文件聚焦 tsc 通过，不宣称后端全量类型检查通过。
- 全部现存改动共 218 个文件的 Prettier 检查包含生成产物和文档；初次仅 AGENTS
  与 document-map 的表格格式失败，格式化后复核。没有残留冲突标记。
- 构建式前端 `tsc -b` 的 BlockSuite `conversion-preservation.unit.spec.ts`
  `DefaultViewDataType` 六条基线错误保留。测试仍有 Lit、KaTeX、React Router 和
  i18next fixture 警告；打包有既有 Browserslist 与资源体积警告。

### 真实浏览器与测试边界

3011 验证使用真实 GraphQL、HTTP、socket、Blob 和已配置模型；四格式实际修改、
重开读取与 PDF 非空画布像素已验证。A15/A17 使用真实模型提交的 Office 请求与
真实队列执行，未以 mock 成功结果替代。A18 初始脚本在点击后立即切页，任务请求
尚 pending；保留原记录并完成 UI 批准，最终 API 确认两项均 approved。

A16/A20 使用独立服务 3013，专用库
`localmind_project_workbench_browser_final_v2_20260907`。测试 app 的 Mailer/JobQueue
沿用仓库测试替身；A16 手动调用真实 worker，在真实 Office prepare 完成后插入
受控等待，浏览器确认只读后解除等待，真实持久化产生 1 条执行结果、版本 2。
这证明持锁界面和最终写入，不将它称为业务队列调度证明；业务队列由 A15 覆盖。
A20 没有停用业务 BYOK，真实 SSE 返回 `COPILOT_BYOK_NOT_CONFIGURED`。

### 迁移、备份与同步

- 最终 361 条空库：`localmind_project_workbench_empty_20260907115426`、
  `localmind_project_workbench_empty_20260907115527`；真实恢复升级库使用相同时间戳
  的 `upgrade` 名称。13 张表的全行指纹一致。旧备份升级丢弃 13 条旧引用，已同步后
  的备份从 360 到 361 升级丢弃 0 条。两份 `migration-evidence-361.json` 均 complete。
- 最终后端同步前再次核对 `20260907T115456Z` 备份中的 dump/files 大小和 SHA-256，
  与该目录 manifest 一致，且对应真实恢复升级证据存在。
- 已执行以下仓库脚本，3011 查询确认 361 条已完成迁移；最后后端同步无新迁移。

```sh
LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_project_native_runner \
LOCALMIND_DATABASE_BACKUP=/Users/dev2/Documents/Codex/backups/localmind-project-workbench-20260907T115456Z/database.dump \
  yarn localmind:sync:all
yarn localmind:sync:web
```

- 同步只更新运行容器，镜像未重建；后续重建部署仍须使用固定 `localmind-affine:local`
  镜像流程，不能把本次容器同步当成镜像已更新。
- 2026-09-07 13:02 UTC `docker system df`：镜像 55.09GB、容器 10.44GB、卷 1.15GB、
  构建缓存 2.913GB。未删除 volume、持久化数据、无关镜像或缓存。
- 未 commit、push、创建 PR、远端发布；本次业务变化限于已授权的旧引用退场、
  工作台同步及明确记录的本地验收资源和审批。

### 最终证据归档与剩余边界

- 本次截图、浏览器 JSON、Linux 前端日志、格式日志及浏览器脚本归档到
  `/Users/dev2/Documents/Codex/backups/localmind-project-workbench-qa-20260907`，
  附逐文件大小与 SHA-256 manifest。目录只对当前用户开放，不包含登录 cookie、
  模型凭据或临时测试账号密码。失败尝试截图仍保留，验收以本节矩阵指向的最终 JSON
  和无 failure 的最终脚本结果为准。
- `browser-layout.json` 的 760px 原始扫描包含屏幕左侧负坐标的隐藏抽屉按钮；它们
  不与可见区域相交。body/html 宽度与视口一致，浅深截图和抽屉交互均已人工核对。
- A16/A20 的 3013 隔离验收服务已关闭；保留隔离数据库。3011 保持运行，最终
  `/project` HTTP 返回 200，数据库 361 条迁移，所有同步命令已退出成功。
- 本次验收覆盖 Project 工作台流程与编辑/任务错误，不扩展原生 Office 引擎的
  格式保真、完整工具栏翻译或全部浏览器平台矩阵。原有 Office 引擎仍有英文工具栏，
  模型历史回复正文不做自动重写；本次新增工具卡片、审批与错误文案已本地化。
- monorepo 全量 typecheck 未通过的已知边界是前述 BlockSuite 六条构建基线。
  A16 的受控准备暂停及测试队列替身已明确列出，业务队列真实执行另由 A15 证明。
  镜像未重建、没有远端交付动作，后续从镜像重建不能直接沿用本次容器内同步状态。

## 2026-09-07：Project 搜索结果卡片修复

`doc_semantic_search` 和 `doc_keyword_search` 在 Project 会话中返回原生资源分页
对象 `{ items, nextCursor, retrievalMode }`。旧卡片直接按 Workspace 数组渲染，
恢复历史聊天时触发 `result.map is not a function` 或显示 `undefined` 数量。

- 新增共享结果解析，兼容 Project 分页对象和原有 Workspace 数组；未知或损坏数据
  显示失败卡片，合法空结果正常显示 0。项目搜索提示提供中英文翻译。
- Project 结果使用返回的资源标题与摘要，点击调用当前 Project 的资源打开入口；
  Workspace 结果继续使用文档预览入口。
- 聚焦命令：`yarn vitest run packages/frontend/core/src/blocksuite/ai/components/ai-tools/doc-search-result.spec.ts`，
  本机 22 项通过；加前缀 `docker exec -w /workspace localmind_project_native_runner`
  在 `localmind-affine:test` 中运行同一命令，22 项通过。
- i18n 生成、本轮文件的 oxlint、Prettier 和 `git diff --check` 通过。
- `yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false` 通过。
- 8081 开发服务热更新已生效。浏览器重新加载原报错 Project，关键词和语义搜索历史
  卡片均显示正确的 0 条结果，`rspack-dev-server-client-overlay` 不存在。
- 本轮为前端修复，未重建镜像、未修改数据库，3011 静态 Web 包未重新同步。
