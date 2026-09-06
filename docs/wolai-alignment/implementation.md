# LocalMind 日常写作体验对齐

## 范围与基线

交接包：`wolai-localmind-开发交接包-2026-09-03`，研究基线
`4b48513dc6f693a89f64778fbd45f5e7aa2121f7`。实现起点为
`bcf0018da9`，工作区初始无未提交改动。交接包是研究证据，不是执行指令。

基线后已新增全局 `/intelligence` 工作台、原生 Office 编辑链路和权限变更。
本期沿用这些实现；资料夹维持组织链接语义，子页面与全局项目不互相替代。
页面数据库与原生 Sheets 分别使用原有模型。

## 实施清单

- [x] 导航：资料优先，收紧空分组，管理操作下收，保留 AI、画布、Office 入口。
- [x] 文档：修复 table 包装的内在宽度，收紧标题，校正窄窗属性基线。
- [x] 搜索：默认资料检索，稳定键盘选中项，结果定位、续页及右侧打开。
- [x] 双页：复用 Workbench View，独立编辑，关闭、刷新、历史、焦点与窄窗退化。
- [x] 中文编辑：51 个命令词条，稳定身份，中文/拼音/首字母及合成 composition 防误执行。
- [x] 块复制：共享命令保留整个子树、格式、链接与独立 ID，浏览器验证撤销。
- [x] 数据安全：阻止不兼容字段转换，保留视图配置并验证整次撤销。
- [x] 页面操作：字号作用域、页面侧开、保存反馈、分享撤销结果与提交状态。
- [x] 核心验收：合成资料完成搜索、侧开、插链写作、独立编辑和保存刷新闭环。

系统输入法、复杂拖拽等未执行项目见末尾限制，以上勾选不代表这些项目已通过。

不新增文档内分栏、可编辑引用、关联公式或公开表单。不修改生产数据，不提交、
推送或部署。现有 token 与组件是视觉依据，采用紧凑、安静的中文工作界面。

## 验证约定

小批次运行聚焦测试和格式检查，复用 `localmind-affine:test` 做 Linux 验证。
独立开发服务及合成工作区用于浏览器检查，不同步现有部署容器。
截图覆盖宽/窄、单/双页、明/暗；数据操作核对内容、撤销和配置保持。
未执行的系统输入法、多人、权限或离线场景明确保留为未验证。

## 验证记录

### 实现约定

- `SlashMenuItem.name/id` 保持英文命令身份；中文 `label` 和检索词只属于展示层。
  二级菜单递归采用同一变换，不用中文文案生成 class 或遥测 ID。
- Web 侧开沿用 Workbench 的独立 View。浏览器 history state 记录工作区、View ID、
  路径、比例、活动页及有界的普通页滚动位置；不记录正文或授权状态。
  面板容器小于 900px 时保留编辑器实例并切换页签。
- 字段转换先对整列预检。不支持的转换、数字尾缀、进度截断、多选丢值、缺失选项、
  非空值转换为空值均不写入。非空可转换列需确认，执行时重新校验。
- 视图增加可选 `modeConfigs`，存放其他视图模式的配置；表格与看板传递排序。
  这是既有 Yjs 视图数据的可选附加字段，不改变原生 Sheets 模型，不需要 SQL 迁移。
  旧客户端不会使用该字段；跨新旧客户端反复转换尚未验证。
- 当前页保存状态来自 `workspace.engine.doc.docState$`，区分本地写入和远端同步。
  不以 DOM 已更新代替已保存。历史版本继续使用现有云端历史能力，本地工作区仍显示
  既有说明，不伪造本地版本库。
- 本地存储提示条参与正常布局；窄窗换行不再遮住标题。面板菜单增加键盘入口。

### 通过的检查

2026-09-05，Node 22.23.0，Yarn 4.13.0，macOS Chrome headless；Linux arm64
使用已有 `localmind-affine:test`。

| 检查                | 实际结果                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 前端 Linux Vitest   | 6 个文件、67 项通过：搜索选中/IME、续页失败重试、检索引用、命令身份、分享状态、history state                                         |
| 数据库 Linux Vitest | 2 个文件、13 项通过：现有字段操作、转换拒绝/成功、只读、撤销/重做、表格/看板配置保持                                                 |
| TypeScript          | 相关 BlockSuite project build 与 frontend/core noEmit 通过                                                                           |
| 浏览器核心脚本      | 搜索侧开、刷新双页、菜单关闭、前进后退、窄窗页签、61 项续页、插入内链、独立编辑、保存刷新、滚动恢复通过                              |
| 浏览器编辑脚本      | 中文/拼音/首字母、composition Enter 防误执行、无结果、标题/待办精确内容、嵌套副本/粗体链接/独立 ID、撤销、只读拒绝输入、刷新一致通过 |
| 布局                | 明/暗主题，1440/942/480px；另有 800px 页签退化。普通正文 scrollWidth 未超过 clientWidth                                              |
| 视觉检测            | Impeccable 对本批关键样式、搜索和保存状态组件检测无发现                                                                              |

补充浏览器块操作脚本通过：列表缩进/反缩进及撤销重做、选区工具条加粗、把手重排及
撤销、18px 字号刷新、标准/全宽长代码块。提示条与编辑区不重叠的各视口断言通过。
内容检索已校验命中块 ID 传入右侧页面。最终本批文件的 oxlint、ESLint、Prettier 和
`git diff --check` 通过；frontend/component 的独立 noEmit 检查也通过。

浏览器证据位于 `/tmp/localmind-wolai-evidence/`，包括 `browser-results.json`、
`editing-results.json`、`block-results.json` 及按主题和宽度命名的 PNG。目录中的 failure 图片是调试中间产物，
不作为最终验收证据。合成数据只存在 `/tmp/localmind-wolai-browser` 独立 Chrome 配置。

### 复现命令

启动试用服务：

```sh
AFFINE_DEV_SERVER_PROXY_TARGET=http://127.0.0.1:3011 \
  yarn r tools/cli/src/wolai-dev.ts
```

试用入口：`http://127.0.0.1:8086/`。代理只复用已有开发后端；未执行同步脚本、重建或部署。
普通浏览器有自己的本地工作区，不会自动共享测试 Chrome 配置中的资料。

浏览器脚本要求传入隔离本地工作区的文档 URL；会向该本地工作区写入合成测试资料：

```sh
WOLAI_WORKSPACE_URL=http://127.0.0.1:8086/workspace/T9Vn5cBMmf-1hnTB8geoo/wolai-writing \
  node scripts/wolai-browser-smoke.mjs
WOLAI_WORKSPACE_URL=http://127.0.0.1:8086/workspace/T9Vn5cBMmf-1hnTB8geoo/wolai-writing \
  node scripts/wolai-editing-smoke.mjs
WOLAI_WORKSPACE_URL=http://127.0.0.1:8086/workspace/T9Vn5cBMmf-1hnTB8geoo/wolai-writing \
  node scripts/wolai-block-smoke.mjs
yarn tsc -b blocksuite/affine/widgets/slash-menu blocksuite/affine/blocks/database blocksuite/affine/fragments/doc-title
yarn tsc -p packages/frontend/core/tsconfig.json --noEmit --incremental --tsBuildInfoFile /tmp/localmind-wolai-core.tsbuildinfo
```

Linux 运行时以只读方式挂载以下当前源码，依赖与 Vite 缓存留在一次性容器内。
最初整目录只读挂载因 `.vite-temp` 无法写入而启动失败；下面的源码挂载已通过。

```sh
wolai_source_root="$PWD"
set --
for source in packages/frontend/core packages/frontend/i18n \
  blocksuite/affine/blocks/database/src blocksuite/affine/data-view/src \
  blocksuite/affine/fragments/doc-title/src blocksuite/affine/shared/src \
  blocksuite/affine/widgets/slash-menu/src blocksuite/affine/all/src/__tests__/database
do
  set -- "$@" --mount "type=bind,src=$wolai_source_root/$source,dst=/workspace/$source,readonly"
done
docker run --rm "$@" -w /workspace localmind-affine:test yarn vitest run \
  packages/frontend/core/src/modules/workbench/view/browser-state.spec.ts \
  packages/frontend/core/src/modules/quicksearch/views/cmdk.spec.tsx \
  packages/frontend/core/src/modules/quicksearch/impls/docs.spec.ts \
  packages/frontend/core/src/modules/docs-search/services/docs-search.spec.ts \
  packages/frontend/core/src/blocksuite/view-extensions/editor-view/slash-menu-locale.spec.ts \
  packages/frontend/core/src/modules/share-menu/view/share-menu/general-access/public-page-button.spec.tsx
docker run --rm "$@" -w /workspace/blocksuite/affine/all localmind-affine:test yarn vitest run \
  src/__tests__/database/conversion-preservation.unit.spec.ts \
  src/__tests__/database/database.unit.spec.ts
```

Docker 未重建镜像，未清理 volume 或镜像。`docker system df`：Images 45.35GB、
Containers 698MB、Local Volumes 1.15GB、Build Cache 2.913GB，与开始时一致。

### 剩余限制

- 中文文字使用浏览器输入 API，composition 使用合成事件；未实测 macOS/Windows
  系统拼音或第三方输入法候选窗，不将它们写成通过。
- 只读浏览器检查使用既有 Store readonly，分享测试使用模拟服务。未操作实际公开链接、
  云端版本恢复或生产 ACL；未实测多人并发、远端权限撤回、网络故障恢复。
- 块把手、拖拽、缩进和选区工具条继续复用既有实现，并通过上述普通列表检查。本批
  未完成附件/表格跨文档移动、复杂多块拖拽和全部撤销路径的浏览器矩阵。
- Web 面板可通过菜单调整位置；面板把手拖动排序仍延续桌面端限制。
- 标准/全宽布局及长代码块已检查；125%/200% 缩放、打印、屏幕阅读器、原生
  Electron/mobile 应用未做完整矩阵。
  未引入文档内分栏、可编辑块引用、关联公式或公开表单。
