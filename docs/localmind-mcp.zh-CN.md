# LocalMind MCP 中文指南

LocalMind 对外暴露绑定工作区的 AI 委托接口。调用方把完整的自然语言任务交给
`delegate_to_localmind`，LocalMind 内置 AI 负责规划，并通过 LocalMind 自己的
Agent Runtime 执行已支持的操作。本地文件与委托任务在同一次调用中提交，一个只读
工具用于在异步返回或回调后核对持久化任务状态，另一个控制工具用于取消尚未结束的
任务。

精确参数与回调协议见 [LocalMind MCP 工具参考](./localmind-mcp-tools.md)。

## 连接信息

| 配置项 | 值                                                       |
| ------ | -------------------------------------------------------- |
| 地址   | `<LOCALMIND_BASE_URL>/api/workspaces/<WORKSPACE_ID>/mcp` |
| 方法   | `POST`                                                   |
| 传输   | 无状态 Streamable HTTP，JSON 响应                        |
| 鉴权   | `Authorization: Bearer <MCP_TOKEN>`                      |
| 服务   | `localmind-ai` / `3.4.0`                                 |
| 工具   | 委托、任务查询和仅取消任务的控制工具                     |

Token 和地址绑定一个工作区，不能跨工作区使用。

## 创建凭据

1. 进入“工作区设置 > 集成 > MCP Server”。
2. 创建凭据并选择允许调用的三个 AI 工具：`delegate_to_localmind`、
   `get_localmind_task` 和 `control_localmind_task`。
3. 需要委托、核对和取消完整流程时，授予全部三个工具权限。
4. 可选填写调用方的结果通知地址，用于接收任务终态通知。
5. 把只显示一次的 MCP Token，以及配置通知时生成的回调签名密钥放进调用方的
   secret 存储。

公网回调必须使用 HTTPS。部署可以为受信任的本地 SparkClaw 精确允许一个私网或
HTTP origin；LocalMind 不跟随回调重定向。

## 通用配置

```json
{
  "mcpServers": {
    "localmind": {
      "type": "streamable-http",
      "url": "<LOCALMIND_BASE_URL>/api/workspaces/<WORKSPACE_ID>/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_TOKEN>"
      }
    }
  }
}
```

调用方在容器中运行时，应使用容器可访问的 LocalMind 服务名或主机名。不要把 Token
或回调密钥写进 URL、Prompt、聊天消息、Git 仓库或诊断包。

## 工具路由规则

这些工具只处理明确交给 LocalMind 的请求，不是宿主 Agent 的全局请求路由器。以下
情况才属于交给 LocalMind 的请求：用户明确要求 LocalMind 回答或执行操作，或者任务
必须访问 LocalMind 管理的文档、附件、工作区资源、任务、连接数据或其他 LocalMind
专属能力。仅提及、讨论、配置或排查 LocalMind，不会自动触发工具调用，除非用户明确
要求 LocalMind 执行工作。

这些工具不得拦截、改道、延迟或以其他方式影响 Codex、Claude 等宿主 Agent 或其他
MCP 客户端的普通对话与原生工作流。对于已经明确交给 LocalMind 的请求，调用方必须
按下面的顺序选择工具，并优先匹配最具体的意图：

1. 如果用户只查询已有任务的状态、进度或最终结果，并且已经从
   `delegate_to_localmind` 获得 `taskId`，直接调用 `get_localmind_task`。不要先委托，
   也不要新建或猜测任务 ID。
2. 如果用户明确要求停止或取消一个未完成的已有任务，使用已知 `taskId` 直接调用
   `control_localmind_task`。不要先调用委托工具。
3. 其余所有要求 LocalMind 回答或执行的请求都属于委托，包括要求继续完成实际工作的
   追问、补充修改、继续执行和重试。LocalMind 请求可以包括问答、文档读取/搜索/新建/
   更新/改名、总结、网页研究和多步骤工作。
4. 委托请求包含本地文件时，直接把文件放入 `delegate_to_localmind` 的
   `attachments`。`attachmentIds` 只用于复用同一凭据家族此前委托返回的附件。
5. 最后通过 `delegate_to_localmind` 提交完整请求。

调用方不应寻找 `doc_create`、`doc_read` 等低层公开工具：它们是 LocalMind AI 内部
使用的 AI Chat 工具。`taskId` 是任务标识，不是文档 ID；`documentIds` 只能填写已知
的现有文档 ID，不能填写文档标题。

## 权限模型

任务创建时会保存 MCP 凭据所选公开工具权限的快照。这个快照是任务固定的最大权限。轮换
会保留凭据家族、工具权限和回调配置；吊销整个家族、禁用用户或到期都会阻止已排队的
任务执行。旧资源 capability 模型签发的凭据会在迁移时统一吊销，必须重新创建。

工具 Agent 任务还会保存创建时实际可用的内部工具名称和输入 Schema fingerprint。
Enterprise 与 SparkClaw 聚合工具还会冻结具体连接、provider、工具、风险和确认要求。
Worker 执行时只暴露“任务冻结 capability”和“当前 registry capability”的交集，并在
真正执行动态工具前再次检查 catalog；选中的每个工具继续执行自己的实时工作区/文档
ACL。完成任务所必需的工具如果已不可用，任务会明确失败，不会静默扩大权限或换用其他
工具。

内联附件持久化要求实时 `Workspace.Copilot` 和 `Workspace.Blobs.Write`。LocalMind 还会在
规划和执行时实时检查被委托用户的真实 ACL。用户失去 `Workspace.Copilot`、
`Workspace.Blobs.Read`、`Workspace.CreateDoc`、`Doc.Read` 或 `Doc.Update` 后，对应
操作会立即失效。缺少真实 ACL 时只返回权限或资源错误，不会向调用方发起提权请求。

查询任务要求任务冻结的 `get_localmind_task` 权限，只能使用创建任务的同一个凭据
家族，并重新检查家族有效性、`Workspace.Copilot`、所有引用文档的 `Doc.Read` 和任务
附件的 `Workspace.Blobs.Read`。
轮换后仍可查询；其他凭据家族只会得到 `task_not_found`。实时 ACL 已丢失时不会返回
历史任务内容。

取消任务还会检查是否为创建任务的凭据家族、家族是否有效、任务冻结的
`control_localmind_task` 权限以及实时 `Workspace.Copilot`。取消不要求
`Doc.Update`，因此用户失去目标文档写权限后，调用方仍能停止尚未完成的任务。

## 当前支持范围

内置 AI 目前可以：

- 根据请求和显式提供且可读的文档快照返回只读答案；
- 通过优化的 Agent Runtime 路径完整替换一个已提供文档的 Markdown 正文；
- 读取最多八个任务绑定附件，并据此回答、整理或新建 LocalMind 文档；
- 对更复杂的任务调用与网页 AI Chat 相同的服务端工具集合，包括文档读取、新建、
  更新、改名、关键词/语义搜索、网页搜索/抓取、文档组合、章节编辑、代码产物生成、
  对话总结、工作区目录管理，以及任务范围内的附件读取。关键词搜索优先使用工作区索引；
  索引不可用时，按批次扫描最近更新且可读的最多 200 篇 Markdown 文档；parser 错误和
  无效二进制文档会被跳过，但其他读取错误仍会失败。
  `task_attachment_read` 只读取当前任务绑定附件，不依赖 AI Chat session，也不获得通用
  `blob_read` 权限。目录管理支持列出、新建、改名、移动、放入 Trash、恢复、永久删除，
  也支持把可读文档加入或移动到目录。普通“删除”会把目录树及其中引用的文档放入
  Trash。直接删除文档和每次文件夹 Trash 操作分别持久化 claim；恢复一个文件夹只移除
  自己的 claim，直接 claim 或其他文件夹 claim 仍会让文档保持在 Trash。永久删除必须
  来自用户明确意图，目标必须已在 Trash，并会递归删除受影响的文档正文和全部目录放置
  关系，同时重写其他受影响文件夹的 Trash manifest，确保它们之后仍可恢复。

工具 Agent 的默认总时限为 300 秒，可由服务端配置，硬限制最多尝试 20 次工具执行，第 21 个 executor 不会被
调用；运行中持续检查取消、凭据和工作区权限，只持久化脱敏结果与文档产物证据。即使
provider 在超时中止后正常关闭流，任务也会返回可重试的 `tool_agent_timeout`，不会误报
完成。v3 完成契约会明确要求成功的内部工具，以及可选的文档、工作区操作、Enterprise
provider、SparkClaw 工具、执行顺序或副作用证据；只用文本声称“已创建/已更新”不能完成
文档或工作区操作。“仅在缺少时追加”等条件修改必须先调用 `doc_read`，再调用
`doc_update` 或 `conditional_noop_complete`；no-op 必须回传本次读取生成的精确
fingerprint。证据不足会返回可重试的 `required_tool_evidence_missing`。同一个委托任务用
相同标题重试新建文档时会复用稳定文档 ID，不会生成重复文档。目录读取、写入和文档放置
分别检查对应的工作区组织读取、同步与文档读取权限，只有非幂等重放的真实目录写入才记录
为副作用。

服务端可在 `copilot.mcpDelegation` 配置 `totalTimeoutMs`、`modelTimeoutMs` 和
`toolTimeoutMs`，默认分别为 300000、120000 和 60000 毫秒；对应环境变量为
`LOCALMIND_MCP_TOTAL_TIMEOUT_MS`、`LOCALMIND_MCP_MODEL_TIMEOUT_MS` 和
`LOCALMIND_MCP_TOOL_TIMEOUT_MS`。持续输出文字不会重置单轮预算。
`result.executionTiming` 返回每个模型等待/工具执行阶段的开始、结束、耗时及
`timeoutPhase`；这些耗时包含调度和等待，并非模型服务自身的纯计算耗时。

每个工具返回后先保存检查点，再做后续记账。运行中、失败或取消的任务仍可返回
`result.partial=true`、已确认的 `toolExecutions` 和文档 `artifacts`；
`pendingToolCalls` 中的 `unconfirmed` 表示尚不能确认操作结果。超时不等于未写入，
续做前先核对回执；未确认的非幂等操作不得盲目重试。查询继续检查所有引用文档的
实时 ACL，不输出原始工具参数或正文。同一任务、同一工具调用 ID 的已完成检查点
会被复用；不能把新任务的重试理解为同一次工具调用的幂等重放。

更新团队日志时传入已知文档 ID，要求一次读取、合并正文和简短回执；目录排序与
额外核验可单独委托。仅提高客户端 MCP 超时不会改变上述服务端预算。

单个附件上限为 10 MiB；一个任务最多绑定八个附件，合计不超过 20 MiB。上传记录不可
修改，并绑定工作区、被委托用户和凭据家族。规划与 worker 执行都会重新读取 Blob，
校验大小和 SHA-256 证据。可解析文档以有界文本提供给模型，模型原生支持的媒体以有界
字节提供；任务附件每次分段读取都会重新检查任务、用户、工作区、凭据家族绑定和实时
Blob ACL，再重新读取、校验证据并解析 Blob，最多返回 8,000 字符。原始上传仍是任务资源；
工作区中的生成结果通过正常文档工具创建或更新，并在任务产物中返回
`localmind_document` 引用。

白板、文档数据库/表格、任意工作区二进制资产写入、评论、协作、历史记录和外部系统操作目前返回
`unsupported_task`，在真实执行器落地前不得宣称已完成。

## 执行与结果通知

文档修改或工具 Agent 任务会返回 `queued`，并立即把同一个 AgentRun 交给 LocalMind
Agent Runtime。它不会创建审批步骤、发送审批请求或等待调用方决定。任务创建时冻结的
MCP capability 快照与被委托用户的实时 ACL 就是授权边界。

Worker 在执行期间会重复检查凭据家族状态、任务冻结的 capability、实时 ACL、附件
Blob/证据和取消状态；优化的单文档替换路径还会在写入前检查计划中的文档版本。若配置了结果通知地址，
LocalMind 只发送三种终态事件：`task_completed`、`task_failed` 或
`task_cancelled`。通知签名格式：

```text
X-LocalMind-Timestamp: <Unix 毫秒>
X-LocalMind-Signature: sha256=<HMAC-SHA256(secret, timestamp + "." + rawBody)>
```

签名覆盖 `<timestamp>.<原始 JSON body>`。通知通过持久化 outbox、worker lease 和
有限重试投递。执行不要求配置回调；没有结果通知地址时，通过
`get_localmind_task` 查询终态结果。

## 查询任务

`delegate_to_localmind` 返回稳定的 `taskId`，并暂时保留 `requestId` 作为兼容别名。
调用 `get_localmind_task` 可以读取脱敏后的计划、当前步骤、最终结果和产物引用；新建
MCP 任务的 `approval` 为 `null`。这个查询不会调用 AI，也不会推进任务。

需要有限长轮询时，把上一次返回的 `stateVersion` 作为 `knownStateVersion`，并把
`waitMs` 设为不超过 `30000`。配置结果通知地址后，查询工具可用于处理回调延迟、重复
或丢失并核对状态；未配置通知地址时，这个查询就是常规的完成状态通道。

## 取消任务

调用 `control_localmind_task` 时传入稳定的 `taskId`、`action=cancel` 和幂等 key。
排队中的任务会立即进入 `cancelled`。正在运行的任务先返回
`cancellation_requested`，查询时显示为 `cancelling`；Agent Runtime worker 协作完成
取消后才进入最终 `cancelled`，期间使用 `get_localmind_task` 轮询即可。

这个控制工具只接受 `cancel`，没有审批或拒绝操作。任务最终取消时，若配置了结果通知
地址，会发送签名 `task_cancelled` 通知。

## 自检

```shell
export LOCALMIND_MCP_URL='https://localmind.example/api/workspaces/<WORKSPACE_ID>/mcp'
read -r -s LOCALMIND_MCP_TOKEN

curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${LOCALMIND_MCP_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"localmind-check","version":"1.0.0"}}}' \
  "${LOCALMIND_MCP_URL}"

curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${LOCALMIND_MCP_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  "${LOCALMIND_MCP_URL}"

curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${LOCALMIND_MCP_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"delegate_to_localmind","arguments":{"request":"总结附件并新建一篇 LocalMind 文档。","documentIds":[],"attachments":[{"fileName":"notes.txt","mimeType":"text/plain","base64":"Tm90ZXMgdG8gc3VtbWFyaXplLg=="}],"idempotencyKey":"summary-001"}}}' \
  "${LOCALMIND_MCP_URL}"

curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${LOCALMIND_MCP_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_localmind_task","arguments":{"taskId":"<TASK_ID>","waitMs":0}}}' \
  "${LOCALMIND_MCP_URL}"

curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${LOCALMIND_MCP_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"control_localmind_task","arguments":{"taskId":"<TASK_ID>","action":"cancel","idempotencyKey":"cancel-001"}}}' \
  "${LOCALMIND_MCP_URL}"
```

初始化结果应为 `serverInfo.name=localmind-ai`，`tools/list` 包含
`delegate_to_localmind`、`get_localmind_task` 和 `control_localmind_task`。

## 状态与排错

- MCP `401`：Token 缺失、格式错误、过期、吊销、用户禁用或工作区不匹配。
- `credential_scope_denied`：任务固定 capability 快照不够。
- `permission_denied` / `resource_not_accessible`：用户实时 ACL 不够，不会请求提权。
- `attachment_evidence_mismatch`：保存的附件与不可变上传证据不一致，执行会失败关闭。
- `required_tool_unavailable`：任务快照中的工具在执行时已不再注册或不可用，模型工具
  循环不会启动。
- `required_tool_evidence_missing`：工具循环没有产出完成契约要求的全部具体工具证据。
- `tool_execution_limit_exceeded`：任务尝试执行第 21 个工具，该 executor 未被调用。
- `tool_snapshot_failed`：LocalMind 无法在执行前冻结任务实际可用的工具 capability。
- 未配置回调：任务仍会执行；通过 `get_localmind_task` 查询终态结果。
- 未收到终态通知：先查询任务，再检查接收端 HMAC 校验、重放防护和 LocalMind 的有限
  重试记录。
- MCP `405`：无状态 MCP 地址只接受 `POST`。
