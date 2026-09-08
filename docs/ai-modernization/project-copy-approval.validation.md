# Project 复制审批调整验证（2026-09-07）

本轮移除已批准来源复制授权的人工撤回接口、GraphQL operation 和分享菜单按钮。
审批人通过通知处理申请，不因审批身份生成任务；申请方和目标 Project 成员保留
“等待他人”任务，未决申请仍可撤回。批准确认说明独立副本及不可撤回的含义。

契约使用 `tracks/project-native-resources.md`、
`tracks/project-workbench-redesign.md` 与 `tracks/project-ai-boundaries.md`。
同步更新了根 `AGENTS.md` 和中文用户指南。本轮没有修改 Prisma schema 或新增迁移；
遗留存储列和系统删除来源文档时的清理逻辑继续用于历史兼容，人工撤回不再对外开放。

## 验证

复用 `localmind_project_native_runner`（`localmind-affine:test`）。所有后端行为测试
使用新建的 `localmind_copy_approval_20260908` 临时数据库，未清空已有验收数据库。
临时数据库执行了现有迁移的全量应用。

实际后端测试通过以下包装命令运行，复用容器环境中的连接凭据并仅替换数据库名：

```sh
docker exec -w /workspace localmind_project_native_runner node -e '
const {spawnSync}=require("node:child_process");
const u=new URL(process.env.DATABASE_URL);
u.pathname="/localmind_copy_approval_20260908";
const r=spawnSync("yarn",["workspace","@affine/server","test",...process.argv.slice(1)],{
  env:{...process.env,DATABASE_URL:u.href,NODE_OPTIONS:"--import=/workspace/tools/cli/register.js"},
  stdio:"inherit"
});
process.exit(r.status ?? 1);
' src/__tests__/models/intelligence-workbench-authorization.spec.ts
```

测试入口与结果：

| 入口                                                                                                    | 结果                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/__tests__/models/intelligence-workbench-authorization.spec.ts`                                     | 首轮 8 项通过；新增的 pending 撤回测试使用 `--match='applicants can withdraw*'` 单独通过，共 9 项          |
| `src/__tests__/copilot/project-import.e2e.ts`                                                           | 6 项覆盖：首轮 5 项通过；修正来源权限变化的测试条件后，`--match='read access and historical grants*'` 通过 |
| `src/__tests__/copilot/document-operation.e2e.ts --match='retired Project document operations*'`        | 1 项通过                                                                                                   |
| `yarn vitest run packages/frontend/core/src/modules/share-menu/view/share-menu/project-access.spec.tsx` | 最终 4 项通过                                                                                              |

导入测试原本删除申请人的个人读取 grant，但仍存在已批准的 Project 复制授权，因而
新导入仍合法。最终测试改为关闭来源 Workspace 的分享策略，确认新导入被拒绝，
已创建的 Project 副本继续可读且未新增资源。

通知验证包含来源 Workspace owner 和文档 owner 的通知、决策资格、无额外 Todo、
审批人同时是 Project 成员时仍无任务审批按钮，以及对无源权限项目成员隐藏文档标题。
终态验证包含并发批准、重复决定、批准后撤回不改变终态、未决撤回及过期处理。

生成和静态检查：

- 用完整 Nest AppModule 生成 schema，未包含测试 MockResolver；仅改写临时生成输出
  路径。与生成前 schema 比较，差异仅是删除撤回 mutation、输入/结果类型及
  `revocable` 字段。生成使用独立的 `localmind_copy_schema_20260908` 临时数据库。
- `yarn workspace @affine/graphql build`、`yarn workspace @affine/i18n build` 通过。
- `yarn tsc -b packages/common/graphql/tsconfig.json --pretty false` 与
  `yarn tsc -b packages/frontend/i18n/tsconfig.json --pretty false` 通过。
- `yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false` 通过。
- `node packages/backend/server/scripts/typecheck-copilot-tests.mjs --file <test>`
  分别检查 model 授权测试及 Project 导入测试，通过。
- 本轮改动文件的 `yarn lint:ox`、`yarn prettier --check`、`git diff --check` 通过。
- 后端全量 `yarn tsc -p packages/backend/server/tsconfig.json --noEmit --pretty false`
  存在一条与本轮无关的已有错误：
  `src/plugins/copilot/mcp/task-query.ts:522` 的 `PublicTaskStatus` 缺少
  `waiting_lease`。本轮未修改该文件，不能宣称后端全量类型检查通过。

## 运行环境

运行同步命令为 `yarn localmind:sync:all`，目标为
`localmind_affine_server`（`localmind-affine:local`）、`http://localhost:3011`。
该命令更新后端与 Web 并重启服务容器，未重建镜像。

同步已成功，运行服务的 GraphQL introspection 确认批准、拒绝和未决撤回仍存在，
已批准复制授权的撤回 mutation 与 `revocable` 字段均不存在。浏览器重新加载来源
文档，分享面板显示“项目复制授权”“已批准的项目”及正确空态，未显示撤回入口。
本次浏览器只检查已有文档界面，没有向真实用户发送审批申请或更改文档权限。
两个本轮新建的临时测试数据库均已清理，验收用临时浏览器标签页已关闭。

本轮 `docker system df`：Images 55.13 GB、Containers 10.48 GB、Local Volumes
1.15 GB、Build Cache 2.913 GB。没有删除 volume、业务数据库或无关镜像。

本轮仅调整现有授权和通知流程；Workspace/文件选择器及批准后自动执行导入仍待接入。
