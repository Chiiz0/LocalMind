# 通知清理执行记录

日期：2026-09-06（America/Los_Angeles），运行同步完成于 2026-09-07 UTC。

范围按用户确认“先解决通知清理就行”。Active track 为
`tracks/intelligence-workbench.md`，资源和任务边界继续遵守
`tracks/project-native-resources.md`。

## 实现

- 通知列表统一提供单条标已读、删除操作，覆盖权限申请、申请结果、文件请求和
  普通通知。固定操作列支持键盘与触屏，错误会反馈。
- 顶部直接提供全部已读，更多菜单在未读和全部模式均提供删除已读、清空全部。
  清空全部需要确认，清理范围包含未加载的分页记录。
- 新增 `dismissAllNotifications` GraphQL mutation，服务端从当前会话获取用户，
  复用 `dismissedAt` 隐藏本人收件箱记录，不删除任务、请求或审计。无新增迁移。
- 清理期间禁止重复提交，取消旧分页请求，完成或失败后重新读取列表和计数。
  单条已读不再在服务端实时计数推送后重复扣减。
- 文件请求清理后，对方新的接单或交付会重新显示通知；本人操作不恢复本人已清理
  的通知。权限申请结果使用独立通知，保留原有幂等规则。
- 窄屏改为侧栏下方定位，通知面板与确认窗口按视口限制宽度。

## 验证

复用 `localmind_project_native_runner` / `localmind-affine:test`。AVA 专用数据库
为 `localmind_file_requests_20260907`；浏览器数据库为
`localmind_project_native_20260906`。没有在业务数据库执行测试清库。

Linux AVA 共 58 项通过，运行文件：

```sh
yarn workspace @affine/server test \
  src/__tests__/copilot/project-file-request.e2e.ts \
  src/models/__tests__/notification.spec.ts \
  src/core/notification/__tests__/service.spec.ts
```

测试环境设置 `NODE_ENV=test`、
`NODE_OPTIONS=--import=/workspace/tools/cli/register.js`、
`REDIS_SERVER_HOST=localmind_project_native_final_redis`，将 runner 的
`DATABASE_URL` 数据库路径替换为上述 AVA 专用数据库后执行。新增测试覆盖匿名拒绝、
跨用户拒绝、120 条分页外记录、幂等清空、任务和请求不变、新通知和交付重新提醒。

Linux Vitest 共 23 项通过：

```sh
yarn vitest run \
  packages/frontend/core/src/modules/notification/services/list.spec.ts \
  packages/frontend/core/src/modules/notification/services/count.spec.ts \
  packages/frontend/core/src/modules/notification/stores/notification.spec.ts \
  packages/frontend/core/src/components/notification/cleanup-actions.spec.tsx
```

正式 Nest schema、GraphQL client 和 i18n 按现有流程生成。
`yarn tsc --noEmit -p packages/backend/server/tsconfig.json`、core 对应命令、
`node packages/backend/server/scripts/typecheck-copilot-tests.mjs --file src/__tests__/copilot/project-file-request.e2e.ts`、
修改文件的 oxlint、Prettier 和 `git diff --check` 通过。

真实浏览器验证 1280×720 和 390×844、浅色和深色主题：

- 111 条未读显示 `99+`；删除权限通知、单条已读、全部已读正常。
- 取消清空保留全部记录；删除 122 条已读后保留 1 条新未读。
- 清空 121 条已读和未读后，数据库可见数量与未读数量均为 0。
- 对比清理前后，3 个文件请求完整记录一致，任务仍可见。
- 清空后新增通知正常显示为 1，不恢复历史通知。
- `3011` 新版本可见单条按钮和批量菜单，原有 2 条未读和“文件1”请求保留。

## 本地同步

已停止业务服务创建一致备份，随后恢复服务并执行 `yarn localmind:sync:all`。
备份目录：

`/Users/dev2/Documents/Codex/backups/localmind-project-native-final-20260907T060315Z/`

包含数据库 dump、存储及配置归档和 SHA-256 manifest；`pg_restore --list` 可读取
dump。浏览器截图位于备份目录的 `notification-cleanup-evidence/`。

同步检查 354 个既有迁移均已应用，backend/web/admin 打包通过，运行地址为
`http://localhost:3011`。未重建镜像，继续使用固定 `localmind-affine:local`。
Docker 磁盘检查：images 54.85 GB、containers 10.2 GB、volumes 1.15 GB、
build cache 2.913 GB；未执行 prune 或删除 volume。

保留全部既有源码改动，未提交或推送。构建仍提示既有静态资源体积和 Browserslist
数据过旧警告；本轮未改动依赖或全局构建配置。
