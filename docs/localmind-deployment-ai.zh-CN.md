# LocalMind `main` 部署协议：供配置 AI 使用

本文是给执行部署的 AI/Agent 的确定性操作协议，不是用户教程。人工操作说明见
[LocalMind `main` 部署指南](./localmind-deployment.zh-CN.md)。

## 目标和唯一入口

目标：从 `Infinimesh-ai/LocalMind` 的 `main` 构建并运行 LocalMind，同时保留已有数据、
配置和 LocalMind 定制功能。

唯一生产 Compose 文件：

```text
.docker/selfhost/compose.localmind.yml
```

不得用 `.docker/selfhost/compose.yml` 或 `ghcr.io/toeverything/affine:stable` 代替。它们是
AFFiNE 上游通用部署，不包含当前 LocalMind 源码产物。

## 必须先获得的输入

| 输入                  | 必需性         | 规则                                                  |
| --------------------- | -------------- | ----------------------------------------------------- |
| `repo_path`           | 必需           | LocalMind 仓库绝对路径                                |
| `deployment_kind`     | 必需           | `local` 或 `public_https`                             |
| `external_url`        | 必需           | 本机 HTTP URL 或实际公网 HTTPS URL                    |
| `port`                | 可默认         | 默认 `3011`                                           |
| `bind_address`        | 可默认         | 本机默认 `0.0.0.0`；同机反向代理建议 `127.0.0.1`      |
| `db_password`         | 生产必需       | 用户提供或本机安全生成，不得回显                      |
| 持久化目录            | 可默认         | 采用 `.env.example` 默认值前要告知用户                |
| embedding/rerank 地址 | AI 功能必需    | 不得猜测；基础部署可以使用模板值或明确保持现状        |
| `enable_iscp`         | 可默认 `false` | 启用时还必须取得 token、HTTPS URL、WSS URL 和代理方案 |
| 反向代理控制权        | 公网部署必需   | 不具备时只完成本机服务，并明确报告尚未开放公网        |

缺少会改变安全边界或公网行为的输入时必须询问，不得自造域名、token、API key、证书或模型
endpoint。

## 不变量

执行时必须遵守：

1. 目标分支是 `main`，部署提交必须在报告中记录。
2. 不丢弃 dirty worktree，不执行 `git reset --hard`、`git clean -fd` 或 checkout 覆盖。
3. 已存在的 `.docker/selfhost/.env` 只能最小修改，不得用模板覆盖。
4. 不读取或输出 secret 的值；只可检查 key 是否存在、值是否为空或是否仍为占位符。
5. 更新已有实例前必须先创建数据库 dump，并确认 dump 非空。
6. 不执行 `docker compose down -v`，不删除 bind mount、named volume 或数据库目录。
7. 不把 PostgreSQL、Redis、ISCP Controller/Relay 端口开放到公网。
8. 不把 AI provider key、MCP token、企业 CLI 凭据写入 Git、Compose 或对话输出。
9. 不在 migration 失败后自动清空数据库重试。
10. 不声明部署成功，除非 Compose、migration、HTTP 和日志四类验证都通过。

## 标准命令前缀

所有 Compose 操作复用以下参数，且工作目录必须是仓库根目录：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml
```

不要依赖调用 shell 当前是否已经 export `.env`。

## 执行流程

### A. 只读发现

先运行：

```sh
pwd
git status --short --branch
git remote -v
git rev-parse HEAD
git rev-parse main
docker version
docker compose version
docker system df
docker ps -a --filter name=localmind
```

判断：

- 仓库不正确：停止。
- worktree dirty：保留现场并向用户报告；除非改动与部署无关且用户已授权继续，否则停止。
- 当前不是 `main`：仅在 worktree 干净时执行 `git switch main`。
- Docker 不可用：停止并报告环境问题。
- 预计新增 Docker 数据超过 30 GB：停止并报告磁盘风险。

### B. 同步代码

只有用户要求部署远端最新 `main` 时才执行：

```sh
git fetch origin main
git pull --ff-only origin main
```

`--ff-only` 失败时停止，不得自动 merge、rebase 或 reset。若用户指定提交，则部署指定提交，
不得擅自更新到另一个版本。

### C. 准备 `.env`

仅当 `.docker/selfhost/.env` 不存在时：

```sh
cp .docker/selfhost/.env.example .docker/selfhost/.env
```

然后以结构化方式修改需要的 key。至少验证：

- `AFFINE_SERVER_EXTERNAL_URL` 与部署入口完全一致；
- `public_https` 时 URL 为 `https://` 且 `AFFINE_SERVER_HTTPS=true`；
- 同机反向代理时优先 `BIND_ADDRESS=127.0.0.1`；
- `DB_PASSWORD` 非空且不包含 `CHANGE_ME`；
- 四个持久化路径明确且没有指向临时目录；
- `LOCALMIND_AFFINE_IMAGE=localmind-affine:local`，除非用户明确提供版本化 registry
  镜像；
- 基础部署保持 `ISCP_ENABLED=false`；
- 扫描版 PDF OCR 仅在确认允许向配置的外部服务发送扫描页后设置
  `LOCALMIND_OCR_ENABLED=true`，并核对 HTTPS 地址与允许主机完全一致；
- 启用企业 CLI 只设置运行能力开关，凭据在部署后由用户通过产品授权流程写入
  受保护数据目录；实例管理员还必须在 Admin AI 页面配置允许的平台和工具。
  `allowedToolsByProvider` 默认不允许任何工具，只有显式工具名或管理员明确填写的
  `*` 才会进入用户连接、目录刷新和执行路径。

不要把完整 `.env` 打印到日志。允许只输出 key 名：

```sh
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' \
  .docker/selfhost/.env
```

### D. 可选 ISCP 分支

当且仅当 `enable_iscp=true`：

- 设置 `ISCP_ENABLED=true`；
- `ISCP_CONTROLLER_TOKEN` 至少 32 个随机字符；
- `ISCP_RELAY_PUBLIC_BASE_URL` 必须是实际 `https://` URL；
- `ISCP_RELAY_PUBLIC_WS_URL` 必须是实际 `wss://` URL；
- 反向代理必须按
  [SparkClaw 主动通知指南](./sparkclaw-notifications.zh-CN.md) 配置路径和 WebSocket；
- 启动命令增加 `--profile iscp`。

Controller 在启动时会再次 fail-closed 校验这些值。基础部署不应为了通过 Compose 解析而
生成假的 ISCP 配置。

### E. 配置预检

基础部署：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  config --quiet
```

ISCP 部署：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  --profile iscp \
  config --quiet
```

失败则停止。不得绕过变量、YAML 或 profile 错误直接执行 `up`。

### F. 已有实例备份

如果 `localmind_affine_postgres` 已存在，先执行逻辑备份：

```sh
mkdir -p backups
LOCALMIND_BACKUP_FILE="backups/localmind-$(date -u +%Y%m%dT%H%M%SZ).sql"
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$LOCALMIND_BACKUP_FILE"
test -s "$LOCALMIND_BACKUP_FILE"
```

还要确认以下对象进入服务器自己的备份系统：

- `.docker/selfhost/.env`；
- `UPLOAD_LOCATION`；
- `CONFIG_LOCATION`；
- `DB_DATA_LOCATION`，用于灾难恢复但不能代替一致的 `pg_dump`；
- `ENTERPRISE_CLI_DATA_LOCATION`；
- 启用 ISCP 时的 `iscp_state` volume。

备份失败或 dump 为空时停止更新。

### G. 构建

构建源码对应的固定 runtime 角色：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  build affine
```

记录构建前后的 `git rev-parse HEAD` 和
`docker image inspect localmind-affine:local --format '{{.Id}}'`。构建失败时保留旧容器和数据，
不得执行清库或 volume 删除。

### H. 启动

基础部署：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  up -d
```

ISCP 部署在 `-f` 参数后加入 `--profile iscp`。Compose 会先运行
`affine_migration`，成功后再启动 `affine`。

### I. 必须完成的验证

1. Compose 状态：

   ```sh
   docker compose \
     --env-file .docker/selfhost/.env \
     -f .docker/selfhost/compose.localmind.yml \
     ps --all
   ```

   `affine`、PostgreSQL、Redis 和 adapter 必须运行；migration 必须退出码为 0。

2. HTTP：

   ```sh
   curl -fsS -o /dev/null http://127.0.0.1:3011/
   ```

   使用实际 `PORT`。公网部署还必须检查 `external_url`，TLS 证书和 Host 路由均应有效。

3. 日志：

   ```sh
   docker compose \
     --env-file .docker/selfhost/.env \
     -f .docker/selfhost/compose.localmind.yml \
     logs --tail=200 affine affine_migration postgres redis sparkclaw_adapter
   ```

   不得存在持续数据库/Redis 连接失败、migration error、panic 或 restart loop。

4. ISCP：启用时额外检查 Controller health、Relay WebSocket 代理和服务日志；不得只以
   容器已创建作为成功依据。

5. 产品初始化：首次部署告知用户打开 `external_url` 创建首个管理员。不得代替用户生成
   管理员密码，除非用户明确授权且提供安全交付方式。

## AI provider 配置边界

基础部署成功不等于 AI provider 已就绪。配置 AI 时：

- Project 对话使用 `/admin/ai/config` 中的 `Global Project BYOK`，由实例管理员
  统一验证并配置，适用于所有 Project，与 Workspace 无关；其他工作区 AI 入口
  保留原有 workspace BYOK 流程；
- 不猜测 provider、model ID、endpoint 或 API key；
- 自定义 endpoint 只有在服务端策略允许时才能使用；
- 私网 endpoint 需要显式的私网访问策略，不能通过关闭 SSRF 防护规避；
- embedding/rerank 服务不可达时，应报告对应能力不可用，不能把整个 LocalMind 误判为
  未部署；
- AI 配置后至少执行 provider probe 和一次最小文本请求；涉及索引时再测试 embedding 和
  rerank。

魔搭模型下载、本机模型目录发现、vLLM 生命周期和 OpenAI-compatible profile 自动配置
的计划边界见
[LocalMind 本地模型一键启动方案记录](./localmind-modelscope-vllm-bootstrap.zh-CN.md)。
该文档当前只记录需求、风险和分阶段实现建议，执行部署时不得假设相关脚本已经存在。

## 回退规则

- `up -d` 前构建失败：不影响旧 runtime，修复构建问题即可。
- migration 前启动失败：保留旧镜像和数据，检查配置。
- migration 已执行后应用异常：不得只把 Git 或镜像回退到旧版本后继续使用新 schema。
  应结合发布提交、migration 兼容性、数据库 dump 和文件数据制定一致回退。
- 任何回退都不得自动删除 volume 或 bind-mounted 数据。

## 完成报告格式

最终必须向用户报告：

```text
branch: main
commit: <full-or-short-sha>
compose_file: .docker/selfhost/compose.localmind.yml
image: localmind-affine:local (<image-id>)
deployment_kind: local | public_https
profiles: base | base+iscp
migration: passed | failed
containers: <state summary>
http_check: <checked URL and result>
backup: new-deployment | <backup path/identifier>
ai_provider: not-configured | configured-and-probed | partially-available
remaining_risks: <none or concrete list>
```

不得在报告中包含 secret、`.env` 内容、数据库连接串、API key、MCP token 或企业 CLI
凭据。
