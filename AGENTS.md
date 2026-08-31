# Repository Guidelines

## Project Structure & Module Organization

`src/index.ts` and `src/invariant.ts` are the Node-facing package entries. Browser behavior lives in `src/client/`: PascalCase files contain React views and canvas components, while lowercase modules implement graph derivation, layout, snapping, viewport state, persistence, and localization. Styles use `GraphView.module.css`. Tests live in `tests/` and generally mirror the client module they cover. `types/` supplies DeepSeek Harness declarations, `cordis.patch.yml` defines plugin wiring, and `.github/workflows/` contains CI and publishing automation. Treat generated `lib/`, `coverage/`, archives, and `.artifacts/` as disposable outputs; do not commit them.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile` installs the pnpm 11.7.0 dependency graph exactly as locked.
- `pnpm run build` bundles Node entries and the lazy browser module into `lib/` with tsdown.
- `pnpm run typecheck` runs strict TypeScript validation without emitting files.
- `pnpm test` builds first, then runs the standalone Vitest suite.
- `pnpm run check` runs type checking, building, and standalone tests; use it before every PR.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness` runs `views.client.spec.tsx` against a prepared Harness checkout.
- `pnpm pack` creates the installable package archive for smoke testing.

Use Node.js `^22.19.0 || >=24.0.0`.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, single quotes, no semicolons, and trailing commas in multiline structures. Keep ESM import extensions explicit and use `import type` for type-only dependencies. Prefer strict, readonly interfaces and explicit return types on exported APIs. Name React components and their files in PascalCase, functions and variables in camelCase, constants in `UPPER_SNAKE_CASE`, and utility modules in kebab-case. No formatter or linter is configured, so match adjacent code and rely on `pnpm run typecheck`.

## Testing Guidelines

Write Vitest tests as `tests/<module>.client.spec.ts` or `.tsx`; package-level checks use `*.spec.ts`. Favor deterministic tests of pure graph/layout helpers and descriptive `describe`/`it` text. Add Harness tests for host-service or rendered-view integration. There is no enforced coverage threshold; cover new branches and regressions directly.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit-style subjects such as `feat: ...` and `ci: ...`. Use an imperative `<type>: <summary>` subject and keep each commit focused. PRs should explain user-visible impact, list validation performed, link relevant issues, and include screenshots or recordings for canvas/UI changes. Update both `README.md` and `README.zh.md` when setup or behavior changes.

### Releases

Every GitHub Release must update the `version` field in `package.json` before tagging. The release tag must be `v<version>`, and the Graph header version badge must show the same version after `pnpm run build`. The badge reads the version from `package.json` at build time; never hard-code or maintain a second version string in source. Run `pnpm run check` before publishing the release.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `benz-ai-x/dsh-session-graph`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Handoffs

The repository root `HANDOFF.md` is the only canonical live handoff. Update it in place and do not create alternate handoff files. `docs/HANDOFF.md` is a historical snapshot and must not override the root handoff.
