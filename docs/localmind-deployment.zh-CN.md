# LocalMind `main` 部署指南

这份指南面向直接操作服务器的人，不要求使用 AI 配置。命令以 Linux、Docker 和
Docker Compose 为准。

## 部署内容

LocalMind 从当前仓库的 `main` 源码构建，不使用 AFFiNE 上游的通用镜像。基础部署会
启动：

- LocalMind Web、Admin 和后端服务；
- PostgreSQL；
- Redis；
- LocalMind 数据迁移任务；
- SparkClaw embedding/rerank 协议适配器。

模型密钥不是启动必需项。即使暂时不配置 AI provider，文档、白板、同步和管理界面
仍可使用；AI 对话、embedding 和 rerank 等能力需要后续配置可用的模型服务。

ISCP 主动通知是可选功能，不属于基础部署。需要时再参考
[SparkClaw 主动通知指南](./sparkclaw-notifications.zh-CN.md)。

## 1. 准备服务器

需要：

- Linux 服务器；
- Git；
- Docker Engine；
- Docker Compose v2，即 `docker compose` 命令；
- 能访问 GitHub、Docker Hub、npm、Cargo 和 Go 依赖源的网络；
- 足够的构建空间。第一次从源码构建会下载 Node、Rust、Go 和前端依赖。

先检查环境：

```sh
git --version
docker version
docker compose version
docker system df
```

仓库约定一次完整构建不能无判断地增加超过 30 GB 的 Docker 数据。如果磁盘紧张，先
扩容或清理明确不再需要的构建缓存，不要删除 LocalMind 数据卷或数据目录。

## 2. 获取 `main` 代码

首次部署：

```sh
git clone git@github.com:Infinimesh-ai/LocalMind.git
cd LocalMind
git switch main
git pull --ff-only origin main
```

如果服务器不能使用 SSH key，可把 clone 地址换成仓库的 HTTPS 地址。

已有仓库先确认没有未保存的修改，再更新：

```sh
git status --short --branch
git switch main
git pull --ff-only origin main
```

不要用 `git reset --hard` 处理服务器上的配置或代码修改。

## 3. 创建部署配置

复制环境变量模板：

```sh
cp .docker/selfhost/.env.example .docker/selfhost/.env
```

如果 `.docker/selfhost/.env` 已经存在，不要执行复制命令，也不要用模板覆盖；直接检查并
补充缺少的配置项。

生成数据库密码：

```sh
openssl rand -hex 32
```

打开 `.docker/selfhost/.env`，至少检查下面这些值：

| 配置                           | 本机部署示例                    | 公网部署要求                         |
| ------------------------------ | ------------------------------- | ------------------------------------ |
| `AFFINE_SERVER_EXTERNAL_URL`   | `http://localhost:3011`         | 实际的 `https://` 域名               |
| `AFFINE_SERVER_HTTPS`          | `false`                         | HTTPS 反向代理后设为 `true`          |
| `BIND_ADDRESS`                 | `0.0.0.0`                       | 反向代理同机时建议 `127.0.0.1`       |
| `PORT`                         | `3011`                          | 未被占用的本机端口                   |
| `DB_PASSWORD`                  | 刚生成的随机值                  | 必须替换模板中的 `CHANGE_ME`         |
| `UPLOAD_LOCATION`              | `./data/localmind/storage`      | 需要持久化和备份                     |
| `CONFIG_LOCATION`              | `./data/localmind/config`       | 需要持久化和备份                     |
| `DB_DATA_LOCATION`             | `./data/localmind/postgres/...` | 需要持久化和备份，不要直接手工修改   |
| `ENTERPRISE_CLI_DATA_LOCATION` | 模板默认值                      | 使用企业连接器时需要持久化和严格保护 |

`.env` 已被 Git 忽略。不要把数据库密码、模型密钥、MCP token 或企业连接器凭据提交到
仓库。

### 模型服务

模板中的 `SPARKCLAW_EMBEDDING_ORIGIN` 和 `SPARKCLAW_RERANK_ORIGIN` 是协议适配器的
上游地址。使用自己的服务时再替换。服务不可达不会阻止 LocalMind 基础界面启动，但相关
embedding、索引和 rerank 请求会失败。

模型 API key 和 workspace BYOK 配置应在 LocalMind 启动后通过管理界面完成，不要写进
Compose 文件。

扫描版 PDF OCR 是独立的服务端集成，默认关闭。启用前应确认部署方允许把扫描页
图片发送到指定服务，然后在 `.env` 中设置：

```sh
LOCALMIND_OCR_ENABLED=true
LOCALMIND_OCR_BASE_URL=https://sparkclaw.infinimesh.cloud/ocr/v1
LOCALMIND_OCR_ALLOWED_HOST=sparkclaw.infinimesh.cloud
LOCALMIND_OCR_MODEL=sparkclaw-ocr
```

OCR 基础地址必须使用 HTTPS，且主机名必须与 `LOCALMIND_OCR_ALLOWED_HOST` 完全
一致。服务需要鉴权时只在服务端设置 `LOCALMIND_OCR_API_KEY`，不要写入前端、文档
或提交到 Git。可按容量调整 `LOCALMIND_OCR_TIMEOUT_MS`、上传/输出上限、token 上限
和并发数；默认分别为 120 秒、12 MiB、1 MiB、16384 tokens 和 2 个并发请求。

计划在 Spark GX10 上通过魔搭下载或发现本地模型、用 vLLM 启动并自动配置 LocalMind
时，先参考 [LocalMind 本地模型一键启动方案记录](./localmind-modelscope-vllm-bootstrap.zh-CN.md)。
该方案目前是实现设计，不代表仓库已经提供可运行的一键脚本。

## 4. 检查配置

以下命令只解析配置，不启动服务：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  config --quiet
```

没有输出且退出码为 0，表示 Compose 配置可以解析。如果此处失败，先修正错误，不要
继续启动。

## 5. 构建并启动

第一次部署或 `main` 代码更新后构建固定 runtime 镜像：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  build affine
```

启动基础服务：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  up -d
```

`affine_migration` 会先执行数据库 schema 和数据迁移。只有它成功退出后，LocalMind
主服务才会启动。

Project 工作台重构包含 `20260907010000_project_reference_retirement` 删表迁移。
升级前先备份当前数据库、Blob 与配置，并在同平台 Linux 的一次性数据库中验证
空库全量迁移及真实备份恢复后的升级。该迁移会丢弃旧 Workspace 引用与迁移桥接
记录，应记录旧引用总数及尚未复制的数量；原生资源、版本、文件和来源授权审计
必须保留。旧引用没有过渡兼容或在线恢复入口，备份用于恢复升级前的完整状态。
具体证据见 [工作台实施记录](ai-modernization/project-workbench-redesign.execution.md)。

## 6. 验证部署

查看服务：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  ps --all
```

正常状态应满足：

- `localmind_affine_server` 为运行中；
- PostgreSQL、Redis 和 SparkClaw adapter 为运行中或 healthy；
- `localmind_affine_migration_job` 退出码为 0。

检查网页：

```sh
curl -fsS -o /dev/null http://127.0.0.1:3011/
```

如果修改了 `PORT`，同步替换命令中的端口。然后在浏览器打开
`AFFINE_SERVER_EXTERNAL_URL`。首次打开会进入初始化流程，创建的第一个账号是管理员。

查看最近日志：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  logs --tail=200 affine affine_migration postgres redis sparkclaw_adapter
```

日志中不能持续出现数据库连接失败、Redis 连接失败、migration 失败或容器重启循环。

## 7. 配置 HTTPS

公网部署必须在 LocalMind 前面放置 Caddy、Nginx 或其他可信反向代理，并使用有效 TLS
证书。以 Caddy 为例：

```caddyfile
localmind.example.com {
  reverse_proxy 127.0.0.1:3011
}
```

同时在 `.env` 中设置：

```dotenv
AFFINE_SERVER_EXTERNAL_URL=https://localmind.example.com
AFFINE_SERVER_HTTPS=true
BIND_ADDRESS=127.0.0.1
```

修改后重新执行配置检查和 `docker compose up -d`。不要把 PostgreSQL、Redis、ISCP
Controller 或 Relay 的内部端口直接暴露到公网。

### 7.1 原生客户端云端地址

LocalMind 桌面端和移动端的正式构建默认连接
`https://localmind.infinimesh.cloud`，不会回退到 AFFiNE 的云端。为私有部署构建原生
客户端时，通过构建环境变量覆盖默认地址：

```sh
LOCALMIND_CLOUD_URL=https://localmind.example.com yarn build
```

该值必须是没有凭据、查询参数和 URL fragment 的 HTTP(S) 基础地址。Web 与自托管 Web
构建仍使用当前页面的 origin，不受此变量影响。

## 8. 更新 `main`

更新前先备份数据库：

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

还需要备份 `.docker/selfhost/.env`、`UPLOAD_LOCATION`、`CONFIG_LOCATION` 和
`ENTERPRISE_CLI_DATA_LOCATION` 对应目录。`DB_DATA_LOCATION` 可以进入整机灾备，但不能
代替一致的 `pg_dump`。数据库 dump 成功且文件非空后再更新：

```sh
git status --short --branch
git switch main
git pull --ff-only origin main
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  config --quiet
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  build affine
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  up -d
```

最后重复“验证部署”中的状态、网页和日志检查。

## 9. 停止和故障处理

停止服务但保留数据：

```sh
docker compose \
  --env-file .docker/selfhost/.env \
  -f .docker/selfhost/compose.localmind.yml \
  down
```

不要执行 `docker compose down -v`，不要删除 `.docker/selfhost/data`，除非已经确认备份
并明确要永久删除数据。

常见问题：

- `config` 阶段报变量错误：检查 `.env` 的拼写和空值。
- migration 失败：先看 `affine_migration` 日志，不要反复删除数据库重试。
- 页面打不开：确认 `PORT`、`BIND_ADDRESS`、防火墙和反向代理配置一致。
- 登录后反复跳转：HTTPS 部署应同时设置正确的 `AFFINE_SERVER_EXTERNAL_URL` 和
  `AFFINE_SERVER_HTTPS=true`。
- AI 不可用但页面正常：检查 provider/BYOK、模型 endpoint、embedding 和 rerank
  服务；这通常不是数据库或基础部署故障。
- 新版本异常：保留当前数据库和数据目录，不要只回退代码后强行启动旧 schema。先根据
  备份制定数据库与文件数据一致的回退方案。
