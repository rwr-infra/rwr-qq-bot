# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RWR Imba QQ Bot is a QQ chat bot for [Running with Rifles (RWR)](https://rwr.fandom.com/) server data queries. It receives commands via go-cqhttp HTTP API and responds with text/images.

## Dev Commands

```bash
pnpm dev        # Run in development mode with hot reload (tsx watch)
pnpm build      # Production build with Rollup
pnpm start      # Build and run production
pnpm test       # Run all tests (Vitest)
pnpm test:watch # Watch mode for tests
pnpm coverage   # Coverage report
pnpm test:image # Image regression tests (requires RUN_IMAGE_TESTS=1)
```

Single test: `npx vitest run src/path/to/file.test.ts`

## Architecture

### Entry Flow
1. [src/index.ts](src/index.ts) - Fastify server initialization
2. [src/routes.ts](src/routes.ts) - HTTP routes (`POST /in` receives events from go-cqhttp)
3. [src/eventHandler.ts](src/eventHandler.ts) - Routes events to message handler
4. [src/commands/index.ts](src/commands/index.ts) - `msgHandler()` dispatches to commands

### Commands Pattern
Each command lives in `src/commands/<name>/` with:
- `register.ts` - Exports `IRegister` object with `name`, `alias`, `exec()`, `init?()`
- `constants.ts` / `types.ts` / `utils.ts` - Supporting code

Commands are registered in [src/commands/index.ts](src/commands/index.ts) `allCommands` array and filtered by `ACTIVE_COMMANDS` env var.

### Key Services
- [RemoteService](src/services/remote.service.ts) - HTTP client for go-cqhttp API (sendGroupMsg, sendPrivateMsg)
- [CanvasImgService](src/services/canvasImg.service.ts) - Background image loader for canvas rendering
- [PostgreSQLService](src/services/postgresql.service.ts) - Command usage statistics
- [serverCommandCache.service.ts](src/services/serverCommandCache.service.ts) - Per-server command result caching

### Image Rendering
Uses `skia-canvas` (not `canvas`/node-canvas) for cross-platform image generation. Canvas implementations:
- `src/commands/tdoll/canvas/` - TDoll and skin rendering
- `src/commands/servers/canvas/` - Server maps, players, whereis rendering
- `src/services/canvas/base/baseCanvasRefactored.ts` - Base canvas infrastructure
- `src/services/imageRegression/` - Image regression testing with golden fixtures

### Environment Variables
Key configs in `GlobalEnv` ([src/types.ts](src/types.ts)):
- `REMOTE_URL` - go-cqhttp HTTP address (e.g., `http://127.0.0.1:5701`)
- `START_MATCH` - Command prefix (e.g., `#`)
- `LISTEN_GROUP` - QQ group to monitor
- `ADMIN_QQ_LIST` - Admin users with access to admin-only commands
- `ACTIVE_COMMANDS` - Enable/disable specific commands
- `PG_HOST/PG_PORT/PG_DB/PG_USER/PG_PASSWORD` - PostgreSQL for command stats
- `OUTPUT_BG_IMG` - Background image for canvas rendering

### Commands

Each command's README (`src/commands/<name>/README.md`) documents its specific env vars and usage.

**website** - Website list query
```
WEBSITE_DATA_FILE    # JSON file with [{name, website}]
#help website        # Returns all defined websites
```

**servers** - Server info with image output
```
SERVERS_MATCH_REGEX  # Regex to filter servers
SERVERS_FALLBACK_URL # Fallback URL when no servers match
OUTPUT_BG_IMG        # Add background layer to output image
#servers  or  #s     # List servers matching regex
#whereis or  #w      # Find player所在服务器
#analytics or #a [d|h]  # Player analytics (7 days or 24 hours)
#maps     or  #m      # Map list from MAPS_DATA_FILE
#players  or  #p      # Player list per server
```

**tdoll** - Girls' Frontline tactical doll data
```
TDOLL_DATA_FILE      # JSON doll data (from gfwiki.org DollsData)
TDOLL_SKIN_DATA_FILE # JSON skin data (keyed by doll id)
IMGPROXY_URL         # Image proxy for resizing
#tdoll <name>  or  #td <name>    # Query doll by name
#tdollskin <id> or  #ts <id>     # Query doll skins
```

**qa** - Custom Q&A with optional AI fallback
```
QA_DATA_FILE         # JSON with [{q, a}] pairs
DIFY_AI_TOKEN/URL    # AI fallback when no match
#qa <query>  or  #q <query>      # Query answer
#qadefine <Q> <A>   (admin)       # Define new QA pair
#qadelete <Q>       (admin)       # Delete QA pair
```
