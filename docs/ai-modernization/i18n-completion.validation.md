# 中英文 i18n 补全验证记录

验证日期：2026-09-08。范围是 LocalMind 用户界面与管理后台的中英文资源和语言切换行为。
其他语言保留真实完成度，不用英文占位填充翻译覆盖率。

关联契约：[Project 工作台 R13 / A19](tracks/project-workbench-redesign.md)、
[Office 原生资源](../office-native/README.md)。本次没有修改资源归属、审批或模型凭据语义。

## 实现范围

- 英文和简体中文各 4,798 个键，键集合一致且无空条目；本轮新增英文基准键
  1,538 个，简中新增 1,559 个（包括此前缺失的 21 个键）。
- 接入设置、共享组件、Project 相关入口、Office Docs / Sheets / Slides / PDF、
  AI 菜单与聊天、账户与成员、Admin 配置及运维页面的界面文案。
- 翻译覆盖率只计算英文基准中实际存在且非空的译文，排除过期键；区域语言可继承
  已支持的基础语言。不计英文回退，向下取整避免不完整语言显示 100%。
- 语言菜单提供翻译覆盖率的 tooltip 和无障碍说明；后台新增语言选择器。
- React 的 memo 文案、Lit AI 菜单和同源标签页响应语言变化；避免重置表单草稿。
- 修复复数键存在性检查遗漏 count 参数；Office 页数、数量与提示采用完整插值句子。
- 表格双击聚焦使用输入框 ref，避免依赖英文 aria-label。
- 文档正文、用户输入、模型 ID、API 协议名称及诊断证据保留原始内容。

主要边界在 `packages/frontend/i18n`、`packages/frontend/core`、
`packages/frontend/component` 和 `packages/frontend/admin`，共 239 个实现与资源文件。

## 自动化验证

本机和既有 Linux 容器均通过 15 个测试文件、68 项测试。最终浏览器补漏后，
对受影响的 6 个测试文件、46 项测试在两种环境再次验证通过。

Linux 容器为 `localmind_project_native_runner`，固定镜像
`localmind-affine:test`，无数据卷挂载。源码增量复制到 `/workspace` 后运行：

```sh
docker exec -w /workspace localmind_project_native_runner yarn vitest run \
  packages/frontend/i18n/src/coverage.spec.ts \
  packages/frontend/i18n/src/react.spec.tsx \
  packages/frontend/i18n/src/resources.spec.ts \
  packages/frontend/core/src/desktop/pages/workspace/office/document-editor.spec.tsx \
  packages/frontend/core/src/desktop/pages/workspace/office/spreadsheet.spec.tsx \
  packages/frontend/core/src/desktop/pages/workspace/office/presentation.spec.tsx \
  packages/frontend/core/src/desktop/pages/workspace/office/pdf.spec.tsx \
  packages/frontend/admin/src/modules/ai/project-byok.spec.tsx \
  packages/frontend/admin/src/modules/ai/workspace-ai-profiles.spec.tsx \
  packages/frontend/admin/src/modules/ai/workspace-byok.spec.tsx \
  packages/frontend/admin/src/modules/ai/index.spec.tsx \
  packages/frontend/admin/src/modules/accounts/components/user-form.spec.tsx \
  packages/frontend/admin/src/modules/dashboard/index.spec.tsx \
  packages/frontend/admin/src/modules/settings/index.spec.tsx \
  packages/frontend/admin/src/modules/settings/operations/auth-signing-keys.spec.tsx
```

最终补漏的 6 个文件为上述 react、resources、dashboard、project-byok、
workspace-byok 和 AI index 测试。本机使用相同文件列表运行 `yarn vitest run`。

对本轮改动文件执行 `yarn oxlint --deny-warnings`、
`yarn eslint --report-unused-disable-directives-severity=off`、
`yarn prettier --ignore-unknown --check`，并执行 `git diff --check`。
生成文件通过 `yarn workspace @affine/i18n build` 生成；不手写生成类型。

覆盖率、键一致性、Office/Admin 插值参数、复数零/单/多数、语言切换时保留草稿，
以及编辑器和后台既有交互均有测试覆盖。

## 浏览器验证与本地同步

已检查中文 Project 与设置、英文即时切换、同源标签页同步、中文 DOCX 工具栏，
以及 Admin 登录、概览、AI 配置和语言选择。设置在桌面浅色和 961 像素宽深色下
检查；后台在桌面及 961 像素宽下检查。检查结束恢复简体中文、跟随系统主题和
默认视口，关闭临时后台验证标签页。

后台验证使用浏览器已自动填充的管理员账户登录，当前浏览器服务端会话因此切换到
该管理员；没有保存后台配置或更改凭据。项目列表按当前账户的权限重新加载。

8081 的实际热启动目录为
`/Users/dev2/Documents/Codex/2026-07-26/b/LocalMind`。通过本轮初始基线和
上次同步基线生成增量补丁，先 `git apply --check` 再应用；资源逐键合并，保留该目录
已有额外键和用户改动。随后在该目录正式生成 i18n，并运行：

```sh
yarn workspace @affine/i18n build
SELF_HOSTED=true yarn localmind:sync:web
```

Web 和 Admin 生产构建成功。同步更新 `localmind_affine_server` 的静态资源，
3011 Web 与 `/admin` 使用新产物；初次同步与最终补漏各重启业务服务一次。
8081 继续使用热启动源码。没有重建镜像、修改数据库或删除持久化数据。

## 验证限制

- 未完成全量 TypeScript 检查。Admin 和 Core 的独立 `tsc --noEmit` 主要被
  monorepo 引用包尚未构建的 `.d.ts`（TS6305）阻塞，也存在基线类型错误。
  已据输出修复本轮发现的 hook 前默认参数引用问题；构建与聚焦测试通过不能
  替代全量 typecheck。
- Web 和 Admin 构建仍有 bundle / entrypoint 体积警告；本轮不做打包性能重构。
- 100% 表示当前英文基准资源的有效翻译覆盖率，并不代表逐个穷举所有界面状态，
  也不代表自动翻译用户文档或外部服务返回的任意文本。
- 本轮未构建 `dev-base`、`test` 或 `local` 镜像。验证后宿主磁盘剩余约 168 GiB；
  复用测试容器完成后停止，不删除容器或数据。

## 远程 main 提交前复验（2026-09-08）

提交范围包含本次会话累积的 Project 工作台、导入审批、复制反馈、PDF 本地预览
与中英文 i18n 实现。提交在 8081 实际运行源码目录进行，基于与远程 main
一致的 `6f9f31107f`，不覆盖另一个 worktree 的工作区改动。

复验修正了生成 i18n 类型要求 string 而调用方传入 number 的 38 处参数；
表格名称输入框使用独立标签键，避免误用需要 name 插值的表格标题。
后端 MCP 的公开任务状态将内部 `waiting_lease` 归为 queued，取消请求仍优先
返回 cancelling，保持公开协议兼容。

Core、Admin、后端三个包的独立类型检查均通过：

```sh
yarn workspace @affine/i18n build
yarn tsc -b packages/frontend/i18n --pretty false
yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --pretty false
yarn tsc -p packages/frontend/admin/tsconfig.json --noEmit --pretty false
yarn tsc -p packages/backend/server/tsconfig.json --noEmit --pretty false
```

原先 15 文件 i18n/Office/Admin 测试，加上 PDF 工具与工作区导入组件，
本机和 `localmind_project_native_runner`（`localmind-affine:test`）均为
17 文件、77 项通过。Linux 命令使用上述测试列表，并加入：

```sh
packages/frontend/core/src/desktop/pages/workspace/office/pdf-tools.spec.ts
packages/frontend/core/src/desktop/pages/intelligence/project-workspace-import.spec.tsx
```

Linux 运行使用 `yarn vitest run --maxWorkers=2`。复用容器，无镜像重建、
无业务数据库或运行容器同步；验证结束停止本轮启动的测试容器。
该复验覆盖前文独立包类型检查的历史停点，不等同于整个 monorepo 的全量检查。

提交钩子还发现实时订阅测试的 Observable 命名和 CLI 测试依赖声明遗漏。
已按既有 RxJS 规则补 `$` 命名，为 CLI 声明现有 Vitest 开发依赖，并将 CLI 测试
纳入根级测试发现；对应实时订阅与本地代理 8 项回归通过。
