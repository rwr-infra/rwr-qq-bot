# ADR-0001: Abandon and delete the DI canvas-base rewrite and the shadow server-command factory

- Status: Accepted
- Date: 2026-07-07

## Context

An architecture review found three abandoned refactors that shipped nothing yet
carried passing tests, giving a false coverage signal, and introduced two
same-named implementations that made it impossible to tell which one was live
without grepping consumers:

- `src/services/canvas/base/*` — a full dependency-injection / SOLID rewrite of
  `src/services/baseCanvas.ts` (`BaseCanvasRefactored`, `FileWriter`,
  `FooterRenderer`, `TextWidthCalculator`, `DependencyFactory`, plus a barrel
  `index.ts` and six test files). All 13 production canvases still extend the
  original `src/services/baseCanvas.ts`; the rewrite had **zero production
  consumers**. Last touched 2026-01-30.
- `src/commands/servers/core/serverCommandFactory.ts` — a `createServerCommand`
  factory documented as "eliminates duplicate code across server commands",
  shadowed by a second, differently-shaped `createServerCommand` defined inline
  at `src/commands/servers/register.ts:47` which is the one actually wired.
  **Zero production consumers.** Last touched 2026-02-23.
- `readTdollData` / `readTdollSkinData` in `src/commands/tdoll/utils/utils.ts` —
  orphaned after the card/skin-grid pipeline refactor; the tdoll services now
  read data files directly. No production or test references.

The common cause: shared infrastructure was built but the call sites were never
cut over. The abstractions sat unused for 4–5 months.

## Decision

Delete all three. The 13 live canvases keep extending `src/services/baseCanvas.ts`,
and the inline `createServerCommand` in `servers/register.ts` remains the wired
one. This is a no-behavior-change cleanup: it shrinks the surface a reader (human
or AI) must hold and removes the false-coverage trap.

## Salvage — what to reuse when deepening `BaseCanvas` (future Candidate B)

The design intent behind the deleted rewrite is worth preserving even though the
code is gone. When `BaseCanvas` is later deepened with a `render()` template
method, revive the **constructor-injected dependency seam**:

- `FileWriter` — an injectable writer owning `fs` I/O, returning a `WriteResult`
  and wrapping failures via `asImageRenderError` / `logImageRenderError`. This is
  the exact seam that would let canvases be unit-tested without touching the real
  filesystem — the single biggest testability win available in the render layer.
- `TextWidthCalculator` and `FooterRenderer` — the other two injected
  collaborators, splitting CJK width math and footer rendering out of the base.

## Flaws not to copy

Even this "clean" rewrite still leaked, and a revival must not repeat these:

- `baseCanvasRefactored.ts` read the background-image path from
  `process.env.OUTPUT_BG_IMG` directly (via a `getBackgroundImagePathFromEnv`
  helper). Env and the background-image path must be passed as **explicit
  config**, not read from `process.env`, or the testability benefit is lost.
- `DependencyFactory` kept a static singleton and called
  `CanvasImgService.getInstance()`, re-introducing the hidden global state the DI
  approach was meant to remove.

## Consequences

- ~1,100 LOC and 8 test files removed. Total test count drops by those suites;
  no remaining behavior is affected.
- Future architecture reviews should not re-suggest a parallel DI canvas base —
  this ADR records that it was tried, never adopted, and deliberately removed.
- The salvageable `FileWriter` seam is documented here so it can be reintroduced
  intentionally as part of deepening `BaseCanvas`, rather than rediscovered.
