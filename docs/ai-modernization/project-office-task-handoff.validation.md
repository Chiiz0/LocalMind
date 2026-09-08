# Project Office 审批编辑权交接验证

日期：2026-09-08。Active track：`tracks/project-workbench-redesign.md` §7.2 / A15。

## 修复范围

当前持锁页批准 Office/PDF 修改时，先释放本标签页的精确租约，再提交审批；
交接期间保持只读，任务完成、失败或取消后重新向服务端申请编辑权。
有未保存修改时只保存并要求重新生成预览，审批前核对当前 revision。
响应丢失时继续跟踪原任务，其他页面和成员持锁时显示持有者及保存关闭提示。
实现位于前端 Project resource 的 edit guard、edit lease store、task handoff
以及统一任务审批 hook；聊天任务与 Todo 共享该入口，新增文案包含中英文。

## 自动验证

复用 Linux 容器 `localmind_project_native_runner`，固定镜像 `localmind-affine:test`。
在容器 `/workspace` 执行：

```sh
yarn vitest run \
  packages/frontend/core/src/modules/project-resources/edit-lease-store.spec.ts \
  packages/frontend/core/src/modules/project-resources/edit-lease.spec.tsx \
  packages/frontend/core/src/modules/project-resources/edit-guard.spec.tsx \
  packages/frontend/core/src/modules/project-resources/task-handoff.spec.ts \
  packages/frontend/core/src/desktop/pages/intelligence/use-project-task-decision.spec.tsx \
  packages/frontend/core/src/desktop/pages/intelligence/project-tasks.spec.tsx \
  packages/frontend/core/src/desktop/pages/intelligence/task-panel.spec.tsx \
  --maxWorkers=2
```

结果：7 个文件、41 项测试通过。覆盖审批取消、重复点击、草稿保存成功与失败、
版本变化、租约释放失败、其他标签页与服务器作用域隔离、审批响应丢失、
断线恢复、任务终态重新获取编辑权，以及聊天和 Todo 的原有行为。

本机 i18n build、i18n 声明生成、Core TypeScript 检查通过；本轮源文件的
`yarn lint:ox`、`yarn eslint`、`yarn prettier --ignore-unknown --check` 通过。

## 运行环境与限制

8081 使用实际运行源码目录的热更新。未同步后端或 3011 静态资源，未更改
数据库、后端协议或业务 PDF；没有重复执行之前已完成的删除任务。
浏览器检查用于确认页面加载和运行错误，新的审批控制流由聚焦测试验证，
不宣称已对真实业务文件重新完成一次删除审批的端到端测试。

未重建镜像、未删除容器或持久数据。验证后主机可用空间 168 GiB；
`docker system df`：镜像 55.43 GB、容器 10.78 GB、volume 1.15 GB、
build cache 2.913 GB。未运行完整生产 Web/Admin 构建。
