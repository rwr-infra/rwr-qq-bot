# rwr-imba-qq-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-21

## Project Overview

RWR Imba QQ Bot — 一个通过 go-cqhttp 接入的 QQ 机器人，用于查询《Running With Rifles》游戏服务器数据（服务器列表、玩家位置、地图信息、T-Doll 数据等），并以图片形式回复。

## Active Technologies

- TypeScript (strict) + Node.js >=22.12.0 + Fastify + skia-canvas@3.0.8 + pg (PostgreSQL) + tracer
- pnpm (package manager), Vitest (testing), Rollup (build)

## Project Structure

```text
src/
  commands/         # Bot command implementations (entry: register.ts per command)
  services/         # Business logic services
  utils/            # Utility functions
  types.ts          # Global type definitions
  index.ts          # Fastify server bootstrap
  routes.ts         # HTTP routes (/in for webhooks, /health, /query_cmd)
  eventHandler.ts   # Dispatches message/notice events
tests/              # Test files (co-located with source preferred)
out/                # Canvas image output directory (served as static /out/)
```

## Commands

> Use **pnpm**, not npm. The lockfile is `pnpm-lock.yaml`.

### Dev / Run

- `pnpm dev` - Start with tsx watch mode
- `pnpm start` - Build + run production output (`node dist/app.js`)

### Build

- `pnpm run build` - Production build via Rollup → `dist/app.js`
    - `postbuild.cjs` runs first: copies `package.json` → `src/info.json`, optionally updates version from `APP_VERSION` / `GITHUB_REF_NAME`, then cleans `dist/`

### Test

- `pnpm test` - Run all tests with Vitest
- `npx vitest run src/path/to/file.test.ts` - Run a single test file
- `npx vitest run -t "test name"` - Run tests matching a specific name
- `RUN_IMAGE_TESTS=1 pnpm test` - Run image regression tests (`src/services/imageRegression/imageRegression.test.ts`)
- `UPDATE_IMAGE_GOLDENS=1 RUN_IMAGE_TESTS=1 pnpm test` - Update image regression goldens
- `pnpm run test:watch` - Run tests in watch mode

### Coverage

- `pnpm run coverage` - Generate test coverage report (Istanbul provider, outputs text/json/cobertura/html/lcov + `sonar-report.xml`)

## Code Style

### TypeScript Configuration

- **Build**: `tsconfig.json` → moduleResolution `bundler`, module `ESNext`, target `esnext`
- **Dev**: `tsconfig.dev.json` → moduleResolution `node`, module `commonjs`
- Libs: `es2020`, `es2021`, `dom`
- Strict mode, source maps enabled, `skipLibCheck: true`

### Prettier

- Config in `.prettierrc`: `tabWidth: 4`, `singleQuote: true`
- **Note: There is no ESLint configured in this repository.**

### Imports and Exports

- ES modules (`import`/`export`)
- Prefer named exports for utilities
- Use absolute imports for cross-module dependencies
- Group imports: 1) external libraries, 2) internal modules, 3) types

### Naming Conventions

- **Files**: camelCase for utilities (e.g., `cmdreq.ts`, `time.ts`)
- **Classes**: PascalCase (e.g., `RemoteService`, `BaseCanvas`)
- **Interfaces/Types**: PascalCase with descriptive names
- **Functions**: camelCase, verb-first for actions (e.g., `getReplyOutput`, `checkTimeIntervalValid`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Variables**: camelCase, descriptive names

### Type Definitions

- Define reusable types in `src/types.ts`
- Use explicit return types for public functions
- Prefer `interface` over `type` for object shapes
- Use `Nullable<T>` type for optional/nullable values

### Error Handling

- Use `try/catch` for async operations
- Log errors using the `logger` utility
- Return early on error conditions to avoid deep nesting
- Graceful shutdown on critical errors (see `shutdown.ts`)

## Testing Quirks

- **Pool**: `forks` (required for skia-canvas compatibility, see vitest.config.ts)
- **Image regression**: Goldens stored in `src/services/imageRegression/goldens/`. Mismatch artifacts written to `out/image-regression/`. Set `CANVAS_FOOTER_FIXED_TIME` to stabilize footer timestamps.
- **Coverage**: Istanbul provider with multiple output formats (`text`, `json`, `cobertura`, `html`, `lcov`)

## Architecture Notes

### Runtime

- Fastify HTTP server receives go-cqhttp webhooks at `POST /in`
- Request flow: `go-cqhttp → POST /in → eventHandler → msgHandler / noticeHandler`
- Static files served from `out/` at `/out/`
- Commands are registered in `src/commands/index.ts` and implemented per-command in `src/commands/<name>/register.ts`
- `src/commands/index.ts` also owns the command registry (`allCommands`), message dispatch, permission checks, cooldown (CD) checks, and PostgreSQL command-log writes
- `eventHandler.ts` dispatches `message` → `msgHandler` and `notice` → `noticeHandler`

### Command System

All commands implement the `IRegister` interface (`src/types.ts`):

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

Each command lives in `src/commands/<name>/` with a standard layout: `register.ts` / `types.ts` / `constants.ts` / `utils.ts`. More complex commands (`servers`, `tdoll`) also contain `canvas/` / `services/` / `charts/` / `tasks/` subdirectories.

### Canvas / Image Rendering

- Uses **skia-canvas** (not node-canvas) for image generation stability
- Output images go to `out/` directory, served to go-cqhttp via `/out/<filename>` and sent as `[CQ:image,...]`
- Optional background image via `OUTPUT_BG_IMG` env var
- Layering:
    - `src/services/canvasBackend.ts` — wraps skia-canvas `createCanvas` / `loadImageFrom` / `toPngBuffer`; the **only** place that imports skia-canvas
    - `src/services/baseCanvas.ts` — base class for all canvas classes: text-width measurement (CJK chars count 2×), background rendering, footer, file write-out
    - `src/services/canvasTheme.ts` — shared color constants (warm-brown base + translucent card design language), referenced by serverOverview / tdoll card canvases
    - `src/services/canvasHelpers.ts` — pure drawing primitives: rounded rects, multi-color segmented text, truncation, adaptive font size, pill layout
- Multi-user command outputs use `buildUserScopedPngName` (`src/utils/cmdreq.ts`), named per group/user to avoid concurrent overwrite; stale top-level PNGs in `out/` are cleaned on a timer by `outputCleanup.service.ts` (24h TTL)

### Caching

- `AsyncCacheService` (`src/services/asyncCache.service.ts`) — TTL cache base class; subclasses just implement `fetchData()`
- `serverCommandCache.service.ts` — group-level CD + concurrent-request coalescing + batch AT
- `serverHistoryCache.service.ts` — scenario-specific cache (tracks recently-disappeared servers)

### Database

- **PostgreSQL** is optional and used only for command analytics
- Service: `src/services/postgresql.service.ts`
- Table name: `cmd_access_table`
- Connection is gated by presence of `PG_DB` env var; missing DB config does not block bot operation

### Environment Variables

- Loaded via `dotenv` in `src/utils/env.ts`
- **Parsing quirks**: Values are stripped of surrounding quotes (`'` or `"`). Arrays are parsed as JSON (e.g., `ACTIVE_COMMANDS=["fuck","roll"]`)
- `START_MATCH` is parsed specially to extract the command prefix
- **Map image config**: `MAP_IMAGE_CONFIG_FILE` (path to `map_images.json`) is optional. When set, `MapImageService` loads a `{ images: [{ path, image }] }` config for map detail images. `MAP_IMAGE_BASE_URL` serves as fallback when no config match is found. Use `scripts/syncMapImages.js` to sync from a remote HTTP endpoint.
- **Data files**: loaded during a command's `init()` via these path env vars:

    | 环境变量 | 用途 |
    |----------|------|
    | `TDOLL_DATA_FILE` | T-Doll JSON 数据 |
    | `TDOLL_SKIN_DATA_FILE` | T-Doll 皮肤 JSON 数据 |
    | `MAPS_DATA_FILE` | 地图 JSON 数据 |
    | `MAP_IMAGE_CONFIG_FILE` | 地图图片路径配置（由 `scripts/syncMapImages.js` 生成） |
    | `QA_DATA_FILE` | 自助问答 JSON 数据 |
    | `WEBSITE_DATA_FILE` | 网站列表数据 |

- **`ACTIVE_COMMANDS`**: JSON string array; leave empty to enable all commands. Names must match `IRegister.name` exactly.
- **go-cqhttp message format**: CQ codes, e.g. `[CQ:image,file=<url>,cache=0,c=8]`, `[CQ:at,qq=<qq>]`.
- **`DIFY_AI_URL` / `DIFY_AI_TOKEN`**: README still shows these as `OPENAI_*`, and `src/types.ts` uses `OPENAI_*` as the type name, but the code reads `DIFY_AI_*`. Treat `src/utils/env.ts` as the source of truth for actual env var names.

## Logging

- Use the centralized `logger` from `src/utils/logger.ts`
- Log levels: `info`, `warn`, `error`, `debug`
- Structured JSON logging in production (via `tracer` dailyfile transport to `./logs/`)

## CI / Deploy

- GitHub Actions: `.github/workflows/ci.yml`
    - Uses pnpm 10, Node 24.15.0
    - Runs `pnpm run coverage`
    - Uploads to Codecov and SonarCloud
- Docker: multi-stage build, Node 24.15.0-alpine, pnpm 10.33.0
    - Healthcheck: `GET /health`

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

See `docker-compose-example.yaml` for a full config example.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
