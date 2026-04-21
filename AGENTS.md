# rwr-imba-qq-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-21

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
- Static files served from `out/` at `/out/`
- Commands are registered in `src/commands/index.ts` and implemented per-command in `src/commands/<name>/register.ts`
- `eventHandler.ts` dispatches `message` → `msgHandler` and `notice` → `noticeHandler`

### Canvas / Image Rendering

- Uses **skia-canvas** (not node-canvas) for image generation stability
- Output images go to `out/` directory
- Optional background image via `OUTPUT_BG_IMG` env var

### Database

- **PostgreSQL** is optional and used only for command analytics
- Service: `src/services/postgresql.service.ts`
- Table name: `cmd_access_table`
- Connection is gated by presence of `PG_DB` env var; missing DB config does not block bot operation

### Environment Variables

- Loaded via `dotenv` in `src/utils/env.ts`
- **Parsing quirks**: Values are stripped of surrounding quotes (`'` or `"`). Arrays are parsed as JSON (e.g., `ACTIVE_COMMANDS=["fuck","roll"]`)
- `START_MATCH` is parsed specially to extract the command prefix

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

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
