# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RWR Imba QQ Bot — 一个通过 go-cqhttp 接入的 QQ 机器人，用于查询《Running With Rifles》游戏服务器数据（服务器列表、玩家位置、地图信息、T-Doll 数据等），并以图片形式回复。

## Commands

```bash
# 开发模式（热重载）
pnpm dev

# 构建生产包
pnpm build

# 运行所有测试
pnpm test

# 图像回归测试（需要 RUN_IMAGE_TESTS=1 环境变量）
pnpm test:image

# 监视模式
pnpm test:watch

# 覆盖率报告
pnpm coverage

# 单个测试文件
pnpm vitest -- src/services/asyncCache.service.test.ts
```

## Architecture

### 请求流程

```
go-cqhttp → POST /in → eventHandler → msgHandler / noticeHandler
```

1. **`src/index.ts`** — Fastify 服务启动，加载环境变量，注册路由，初始化命令
2. **`src/routes.ts`** — 路由定义：`POST /in`（接收 go-cqhttp 事件）、`GET /health`、`GET /query_cmd`
3. **`src/eventHandler.ts`** — 按 `post_type` 分发至 `msgHandler` 或 `noticeHandler`
4. **`src/commands/index.ts`** — 命令注册总表（`allCommands`）、消息分发、权限校验、CD 检查、PostgreSQL 命令日志写入

### 命令系统

所有命令实现 `IRegister` 接口（`src/types.ts`）：

```ts
interface IRegister {
    name: string;          // 触发词
    alias?: string;        // 别名
    description: string;
    hint?: string[];
    isAdmin: boolean;
    timesInterval?: number; // 单用户冷却（秒）
    exec(ctx: MsgExecCtx): Promise<void>;
    init?(env: GlobalEnv): Promise<void>; // 启动时初始化（加载数据文件等）
}
```

每个命令位于 `src/commands/<name>/`，标准文件布局：`register.ts` / `types.ts` / `constants.ts` / `utils.ts`。较复杂的命令（`servers`、`tdoll`）还包含 `canvas/`、`services/`、`charts/`、`tasks/` 子目录。

### Canvas 渲染层

- **`src/services/canvasBackend.ts`** — 封装 `skia-canvas` 的 `createCanvas` / `loadImageFrom` / `toPngBuffer`；整个项目唯一引入 `skia-canvas` 的地方
- **`src/services/baseCanvas.ts`** — 所有画布类的基类：文本宽度计算（中文字符 2× 宽度）、背景图渲染、页脚渲染、文件写出
- **`src/services/layeredCanvasRenderer.ts`** — 分层渲染基类：主内容与时间戳分离，支持主内容缓存后动态叠加时间戳

渲染产物写入 `out/` 目录，通过 `/out/<filename>` 静态路径提供给 go-cqhttp 以 `[CQ:image,...]` 格式发送。

### 缓存机制

- **`AsyncCacheService`**（`src/services/asyncCache.service.ts`）— TTL 缓存基类，子类实现 `fetchData()` 即可
- **`serverCommandCache.service.ts`** — 群级 CD + 并发请求合并 + 批量 AT
- **`tdollRenderCache.service.ts`**、**`serverHistoryCache.service.ts`** — 特定场景缓存

### 数据文件

通过环境变量指定路径，在命令 `init()` 时加载：

| 环境变量 | 用途 |
|----------|------|
| `TDOLL_DATA_FILE` | T-Doll JSON 数据 |
| `TDOLL_SKIN_DATA_FILE` | T-Doll 皮肤 JSON 数据 |
| `MAPS_DATA_FILE` | 地图 JSON 数据 |
| `MAP_IMAGE_CONFIG_FILE` | 地图图片路径配置（由 `scripts/syncMapImages.js` 生成） |
| `QA_DATA_FILE` | 自助问答 JSON 数据 |
| `WEBSITE_DATA_FILE` | 网站列表数据 |

## Key Conventions

- **ACTIVE_COMMANDS** — JSON 字符串数组，留空则启用所有命令。命令名需与 `IRegister.name` 完全一致
- **go-cqhttp 消息格式** — CQ 码，如 `[CQ:image,file=<url>,cache=0,c=8]`、`[CQ:at,qq=<qq>]`
- **图片输出** — 所有 canvas 渲染输出至 `out/` 目录；生产构建时由 `postbuild.cjs` 处理静态资源
- **`DIFY_AI_URL` / `DIFY_AI_TOKEN`** — README 中仍显示为 `OPENAI_*`，但代码实际使用 `DIFY_AI_*` 变量（`src/types.ts` 也使用 `OPENAI_*` 作为类型名），注意实际环境变量名以 `src/utils/env.ts` 为准

## Testing

- 测试框架：vitest，配置见 `vitest.config.ts`（pool 使用 `forks` 避免 skia-canvas 报错）
- 图像回归测试位于 `src/services/imageRegression/`，基准图片在 `fixtures/` 下，需 `RUN_IMAGE_TESTS=1` 才执行
- 覆盖率使用 istanbul，同时输出 SonarQube 报告（`sonar-report.xml`）

## Deployment

```sh
# Docker 示例
docker run --name my-rwr-qq-bot \
  -p 3000:3000 \
  -e "REMOTE_URL=<go-cqhttp地址>" \
  -e "START_MATCH=#" \
  -e "LISTEN_GROUP=<群号>" \
  -v ${PWD}/data:/app/data \
  zhaozisong0/rwr-imba-qq-bot:latest
```

参考 `docker-compose-example.yaml` 了解完整配置示例。
