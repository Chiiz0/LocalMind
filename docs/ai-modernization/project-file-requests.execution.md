# Project 文件请求执行记录

日期：2026-09-07 UTC。基于已交付的
[Project 原生资源 P1-P6 / A01-A22](project-native-resources.execution.md)，完成本轮
“成员识别、发送文件请求、对方交付、任务更新”和 `blocker_suggest` 修复。

## 根因与实现

1. 业务实例的 `Chat With LocalMind AI` 兼容 Prompt 未提供 `config.tools`。
   `selectChat` 沿用空配置，`ToolRuntime` 提前返回，Project 工具未进入模型请求。
   现在原生 Project 明确提供协作工具组，保留 Office 独立工具范围和实时授权。
2. native 请求构建器只保留第一条 system 消息。Project/Office 后追加的执行规则
   被丢弃，真实模型把操作请求当成代写。规则现在合入第一条 system 消息，并用
   实际 `llmBuildCanonicalRequest` 回归测试验证。不修改 native addon。
3. `blocker_suggest` 原本是待确认提醒，不负责联系成员。新增
   `project_file_request_recipients` 和 `project_file_request_create`，返回真实请求
   ID、通知与任务回执。提醒工具允许 `due_at:null`，模型不再要求必须设置时间。
4. 新增 `ProjectFileRequest`、不可变事件、通知 outbox、GraphQL 上传/状态 API、
   原始交付版本下载和任务投影。待处理、准备中、已收到、拒绝、撤回均持久化。
5. 前端提供索取文件表单、通知入口、任务详情、接单、分享确认、上传、拒绝、撤回
   和下载。修复漏 fragment import 导致的真实 GraphQL 请求失败，以及浏览器全局
   input 样式导致分享复选框零高度。窄屏弹窗采用显式响应宽度。

## 权限与状态

- 接收人仅在当前 Project 或双方共享的有效 Workspace 中查找，最多 20 个结果。
- 请求双方关系、Project 存续和发起方成员资格在创建、查看、状态更新、交付、下载
  与任务投影时重新检查。外部接收方不会获得 Project 成员身份。
- 上传需要本人操作并明确同意向项目分享，最多 32 MB；审计保留实际上传者。
- 下载只提供 sequence 1 的交付版本，并校验交付 fingerprint。后续项目编辑不
  扩大接收方可读范围；权限撤销后下载拒绝。
- 创建/上传重放不重复通知或资源；不同负载复用 key、陈旧版本和终态修改拒绝。
  取消与交付竞争仅一方成功，保存失败回滚请求状态和审计事务。
- 请求发送后发起方为 Waiting on others，接收方为 Needs my action；开始准备后
  双方 In progress；交付、拒绝或撤回后双方 Done。To do 数字仍仅统计本人操作。

## 验证命令

复用 `localmind_project_native_runner` / `localmind-affine:test`，不重建镜像。
AVA 使用专用数据库 `localmind_file_requests_20260907`，不在业务库或浏览器库运行
会清空数据的 `TestingApp.initTestingDB`。

```sh
docker exec -e REDIS_SERVER_HOST=localmind_project_native_final_redis \
  -e NODE_OPTIONS=--import=/workspace/tools/cli/register.js \
  -w /workspace localmind_project_native_runner node --input-type=module -e '
import {spawnSync} from "node:child_process";
const u = new URL(process.env.DATABASE_URL);
u.pathname = "/localmind_file_requests_20260907";
process.exit(spawnSync("yarn", ["workspace", "@affine/server", "test",
  "src/__tests__/copilot/project-file-request.e2e.ts",
  "src/__tests__/copilot/copilot-office-runtime.spec.ts",
  "src/__tests__/models/intelligence-workbench-blocker.spec.ts",
  "src/__tests__/copilot/host-services.spec.ts"],
  {env: {...process.env, NODE_ENV: "test", DATABASE_URL: u.toString()},
   stdio: "inherit"}).status ?? 1);'

docker exec -w /workspace localmind_project_native_runner yarn vitest run \
  packages/frontend/core/src/components/project-file-request/detail.spec.tsx \
  packages/frontend/core/src/desktop/pages/intelligence/task-panel.spec.tsx \
  packages/common/graphql/src/__tests__/project-native-operations.spec.ts

yarn tsc --noEmit -p packages/backend/server/tsconfig.json
yarn tsc --noEmit -p packages/frontend/core/tsconfig.json
node packages/backend/server/scripts/typecheck-copilot-tests.mjs \
  --file src/__tests__/copilot/project-file-request.e2e.ts \
  --file src/__tests__/copilot/copilot-office-runtime.spec.ts
```

上述后端文件分批通过 85 项测试；前端 14 项与生成 operation 75 项通过。Prisma
Client、正式 Nest schema、GraphQL client 和 i18n 均按仓库生成流程更新。聚焦
oxlint、Prettier、服务端与 core 类型检查通过。

全量依赖构建 `yarn tsc -b packages/backend/server/tsconfig.json
packages/frontend/core/tsconfig.json` 仍报告既有
`blocksuite/affine/all/src/__tests__/database/conversion-preservation.unit.spec.ts`
的 6 个类型错误。全量 Copilot 测试类型检查仍有既有 MCP、document-operation、
project-office、project-session 等错误；本轮两个后端测试文件的隔离检查通过。

## 真实浏览器

隔离站点 `http://127.0.0.1:8081` 代理 Linux runner。测试 Project：
`c7596131-ddfb-4615-bcf0-a6bb9127b16c`，接收方 `member-01` 仅为共享 Workspace
成员。使用已配置的真实全局 Project BYOK 模型 `gpt-5.6-sol`。

- 原句“帮我问member-01要一个文件a”实际调用两个文件请求工具，产生请求
  `23edabd1-aadd-4527-b0bd-acc06bb17156`，显示在 Waiting on others。
- “记录等待回复，不设截止时间，不发消息”生成 Blocker 确认卡；确认后持久化，
  请求数量不变。“只起草文件b的话”只返回草稿，未调用发送工具。
- 接收方登录后看到 Needs my action 和站内通知；从通知打开详情，点击开始准备，
  任务进入 In progress。选择真实文件、勾选分享、提交后 Done，下载入口可用。
- 发起方重新登录并刷新后看到 Done 和项目文件
  `localmind-file-request-a.txt`，资源 ID `2493fe46-3ee6-4586-a673-2b2605c6321d`。
- 桌面 1366x900、窄屏 390x844，浅色和深色均检查。窄屏无横向溢出，分享确认和
  上传按钮可操作，任务列表可进入交付详情。

截图保存在备份目录的 `file-request-evidence/`（临时副本为
`/tmp/localmind-file-request-qa/`）：`waiting-on-others.png`、
`blocker-confirmation.png`、`mobile-recipient-light.png`、
`mobile-recipient-completed.png`、`tasks-desktop-dark.png`、
`tasks-mobile-dark.png`、`sender-done-project-file.png`。

## 备份与升级

业务停机一致性备份：
`/Users/dev2/Documents/Codex/backups/localmind-project-native-final-20260907T051801Z/`。
目录 0700，文件 0600，包含 `manifest.json`、数据库、配置、存储及 enterprise-cli。

| 文件          |   字节数 | SHA-256                                                          |
| ------------- | -------: | ---------------------------------------------------------------- |
| database.dump |  6765330 | fb99dcb29d0da254f6d46148ebedc6546956ffeafd97f73325dc3a19245d9275 |
| files.tar.gz  | 18076327 | ccd39c00108ba4e3fd751e0dcde05117a4ba6eaef251e6726f685991a91ca91a |

`node /tmp/localmind-file-request-upgrade.cjs` 将真实备份恢复到
`localmind_file_requests_restore_20260907`，升级 353→354，比较 14 张既有表的
计数与内容 fingerprint 均一致；再次 deploy 幂等，文件请求/事件为 0，未补发
历史请求或通知。新空库也已完整应用 354 条迁移。

正式同步命令：

```sh
LOCALMIND_RUNTIME_SOURCE_CONTAINER=localmind_project_native_runner \
LOCALMIND_DATABASE_BACKUP=/Users/dev2/Documents/Codex/backups/localmind-project-native-final-20260907T051801Z/database.dump \
yarn localmind:sync:all
```

同步成功，后端、Web 和 Admin bundle 通过；业务库现有 354 条迁移。
最终两处前端 import 排序修正后，再执行 `yarn localmind:sync:web` 更新运行包。
`/intelligence` 返回 HTTP 200，文件请求和事件表仍为 0，未重放用户历史指令。
运行来源证据时间为 `2026-09-07T05:20:47.281Z`。

业务浏览器使用已有 `Project AI Browser Owner` 验收账号正常登录，在
`Native Runtime Acceptance 20260906` 的 `Request file` 表单成功查询到
`Project AI Browser Member`，截图为 `business-request-form.png`。浏览器原登录
状态已失效；按用户“直接找到或者注册，登陆”的指示复用既有账号，没有修改账号
配置或授予新 Project 权限。该验收账号并非原业务 Project 的成员。

同步后的真实模型随后实际调用 `project_file_request_recipients`，正确返回
`Project AI Browser Member` 的准确 ID，并遵守“只查找、不发送或创建任务”的
指令。证据为 `business-model-recipient-query.png`。

额外只读检查：业务库按姓名及精确邮箱前缀未找到 `member-01`；原 Project
`e329159d-abbe-431f-b40d-6b5328e306d2` 的可联系范围也无此候选。实现会返回未找到，
不会猜测身份或邀请用户。全流程中的 `member-01` 是隔离验收库的测试身份。

同步更新现有容器，不更新 `localmind-affine:local` 镜像。最终 Docker 磁盘：
images 54.85 GB，containers 10.2 GB，volumes 1.15 GB，build cache 2.913 GB。
没有重建镜像、提交、推送、删除 volume 或修改外部系统。
