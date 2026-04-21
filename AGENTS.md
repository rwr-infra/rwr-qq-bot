# rwr-imba-qq-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-27

## Active Technologies
- TypeScript (strict) + Node.js 22.14.0 + Fastify, tracer, pnpm, Vitest, (current) `canvas@3.2.1` → (target) `skia-canvas@3.0.8` (002-migrate-skia-canvas)
- Files (out/), optional ClickHouse (analytics) (002-migrate-skia-canvas)
- TypeScript 5.7.2 with Node.js 22.14.0 + pg (PostgreSQL client), Fastify (web framework) (001-migrate-postgresql)
- PostgreSQL (migrating from ClickHouse) (001-migrate-postgresql)

- TypeScript 5.7.2 with Node.js 22.14.0 (target: esnext) (001-dependency-upgrade-refactor)

## Project Structure

```text
src/
  commands/         # Bot command implementations
  services/         # Business logic services
  utils/            # Utility functions
  types.ts          # Global type definitions
  index.ts          # Application entry point
  routes.ts         # HTTP route definitions
  eventHandler.ts   # Event processing logic
tests/              # Test files
```

## Commands

### Build
- `npm run build` - Production build using Rollup

### Test
- `npm test` - Run all tests with Vitest
- `npm run test:image` - Run image regression tests
- `npm run test:watch` - Run tests in watch mode
- `npx vitest run src/path/to/file.test.ts` - Run a single test file
- `npx vitest run -t "test name"` - Run tests matching a specific name

### Coverage
- `npm run coverage` - Generate test coverage report

### Lint
- `npm run lint` - Run ESLint on the codebase

## Code Style

### TypeScript Configuration
- Target: ESNext with ES2020/ES2021/DOM libs
- Strict mode enabled
- Module: ESNext with bundler resolution
- Source maps enabled

### Imports and Exports
- Use ES modules (`import`/`export`)
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

### Testing
- Use Vitest with globals enabled
- Test files: co-located with source (e.g., `utils.test.ts`)
- Pool: forks (due to canvas compatibility)
- Coverage: Istanbul provider with multiple output formats

### Logging
- Use the centralized `logger` from `src/utils/logger.ts`
- Log levels: `info`, `warn`, `error`, `debug`
- Structured logging with JSON format in production

### Async Patterns
- Prefer `async/await` over raw promises
- Use `Promise.all()` for concurrent operations
- Implement proper cleanup in shutdown handlers

### Code Organization
- Keep functions small and focused (single responsibility)
- Group related functionality in services
- Use barrel exports (`index.ts`) for clean imports
- Document complex logic with inline comments

## Recent Changes
- 001-migrate-postgresql: Added TypeScript 5.7.2 with Node.js 22.14.0 + pg (PostgreSQL client), Fastify (web framework)
- 002-migrate-skia-canvas: Added TypeScript (strict) + Node.js 22.14.0 + Fastify, tracer, pnpm, Vitest, (current) `canvas@3.2.1` → (target) `skia-canvas@3.0.8`

- 001-dependency-upgrade-refactor: Added TypeScript 5.7.2 with Node.js 22.14.0 (target: esnext)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
