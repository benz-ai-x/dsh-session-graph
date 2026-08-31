---
description: "Visual DeepSeek Harness Web plugin for exploring session lineage, arranging branches, merging snapshots, and generating digests on an interactive graph canvas."
kind: "package-bundle"
---

# Session Graph for DeepSeek Harness

[![CI](https://github.com/benz-ai-x/dsh-session-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/benz-ai-x/dsh-session-graph/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40benz-ai-x%2Fdsh-client-ui-session-graph?logo=npm)](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

English | [中文](README.zh.md)

**Visualize, navigate, branch, merge, and summarize related AI agent sessions without leaving DeepSeek Harness.**

`@benz-ai-x/dsh-client-ui-session-graph` adds an interactive **Graph** tab to the DeepSeek Harness Web conversation view. It turns Session Lineage into a free canvas: Branch-connected Canvas Sessions form movable clusters, Merge Sessions retain snapshot provenance, Subagent Sessions fold into compact summaries, and on-demand Session Digests surface outcomes and open work. Browsing, arranging, and digesting never mutate a Session log.

<p align="center">
  <a href="docs/assets/session-graph-overview.png">
    <img src="https://raw.githubusercontent.com/benz-ai-x/dsh-session-graph/main/docs/assets/session-graph-overview.png" alt="Session Graph for DeepSeek Harness showing branches, merge relations, subagent summaries, filters, and canvas controls" width="100%" />
  </a>
</p>

<p align="center"><sub>Real Session Graph UI rendered with synthetic demo sessions.</sub></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph">npm</a> ·
  <a href="https://github.com/benz-ai-x/dsh-session-graph/releases">Releases</a> ·
  <a href="https://github.com/benz-ai-x/dsh-session-graph/issues">Issues</a> ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

## Quick start

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

Restart the `web` profile, open a non-blank Session, and choose **Graph**. The current release supports DeepSeek Harness `0.1.2-alpha.1` and `0.1.2-alpha.2`, and requires Node.js `^22.19.0 || >=24.0.0`.

## What it adds

| Capability | What you get |
|---|---|
| Visual Session Graph | Branch Lineage, Merge provenance, Session Clusters, and folded Subagent activity in one view |
| Interactive canvas | Drag, snap, collapse, filter, zoom, pan, fit, relayout, reset, locate, and minimap controls |
| Cross-session workflows | Open or branch any Canvas Session and merge immutable snapshots from two or three sources |
| Read-only Session Digests | Generate concise overviews, key outcomes, and open items on demand without changing Session logs |

## Install

Install the published npm package into the `web` profile:

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

To install the tagged source directly from GitHub:

```sh
dsh plugin --profile web add github:benz-ai-x/dsh-session-graph#v0.1.5
```

pnpm blocks a git dependency's `prepare` script until the profile explicitly permits it. The first GitHub install exits with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`; copy the exact key printed by dsh into `$DSH_HOME/profiles/web/pnpm-workspace.yaml` under `allowBuilds`, then rerun the command. This permission executes package code outside the agent sandbox, so inspect the source and pin a tag or commit.

The package contains both the browser plugin and its `cordis.patch.yml` bundle patch. The dsh plugin manager inserts it after the Session, Workspace, locale, renderer, and conversation plugins already supplied by the `web` profile. No manual `cordis.yml` edit is required.

Remove it with:

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

Restart the target `web` profile after installation or removal. A running process does not watch its profile dependency list.

The current `0.1.x` line supports DeepSeek Harness `0.1.2-alpha.1` and `0.1.2-alpha.2`. Its Host entry adapts to both Remote failure APIs exposed across that transition. The plugin intentionally does not install those Harness checkouts' unpublished `@deepseek-ai/*` packages into its own dependency tree; its Session persistence, LLM, Remote, and browser runtime services belong to the selected dsh profile.

## Use the graph

Open a non-blank session and choose **Graph** beside the standard conversation tabs. The Viewed Session resolves a named Workspace Scope when possible and otherwise falls back to a Directory Scope.

- A single click chooses the Selected Session and keeps its Branch Lineage emphasized; the closable detail inspector can open that session or create a Branch, and reports when Harness rejects the request. Click blank canvas space or press Escape to clear selection.
- A double click opens the session in its last-used view.
- Dwell on another Canvas Session for a compact preview without replacing the Selected Session inspector.
- Drag nodes or complete cluster frames to arrange the canvas. Alignment guides snap nearby card edges.
- Session Arrangement persistence fails soft. If browser storage is unavailable, denied, corrupt, or full, the live graph continues with automatic geometry instead of failing to render.
- Each Canvas Session exposes stable top input and bottom output terminals for later graph-editing features. Branches are neutral solid directed edges, Merge Relations are branded solid directed edges, and Subagent Derivations are dashed.
- Use wheel zoom, background-drag panning, fit, 100%, relayout, reset, Viewed Session location, or the minimap. The minimap appears only when content leaves the visible surface, and resizing preserves the current content center and scale.
- Filter by title; Enter centers the first match and Escape clears the filter.
- Hover a node or edge to emphasize its Branch Lineage.
- Read the header badge to identify the package version and exact local Build ID; hover it for the full package identity.

Keyboard shortcuts work while the canvas is focused: `+` and `-` zoom, `0` restores 100%, and `1` fits the graph.

## Merge Sessions

Choose **Merge sessions** in the canvas toolbar, then select two or three Canvas Sessions in the numbered order shown on their cards. Review or edit the Merge instruction and choose **Create Merge session**.

- Sources must be distinct, non-blank, non-Subagent Canvas Sessions in the same Workspace or working directory.
- Choose every source on the canvas. Merge instructions cannot contain `dsh-session:` references, because Harness reserves them for the exact source snapshot set.
- Harness creates one independent target Session, gives it a source-derived title, and captures each source at an immutable event boundary. The sources and their existing Branch lineages remain unchanged.
- At submission time the Host re-inspects the target and every source instead of trusting browser metadata. It accepts only non-archived, non-blank Canvas Session sources in the target directory, and only an unparented blank target or an exact same-source retry target.
- The target's normal agent loop receives the edited instruction plus canonical Harness Session references. This feature does not choose a separate summary model; the target uses its normal configured model route when it processes the queued request.
- A Merge Session remains its own Session Cluster. Branded Merge Relations show provenance from each source cluster without turning those sources into parents.
- The Session Inspector lists the source titles and capture boundaries for a selected Merge Session. Merge provenance is projected from the target log and checkpointed in Harness's durable Projection Cache, so it survives restart and cold log replay.
- If target creation succeeds but naming, snapshot submission, persistence, or opening fails, the target is preserved. **Try again** reuses that target instead of creating a duplicate; a late capture from the prior attempt is accepted only when its ordered source set matches exactly. Once the Host starts committing a matched capture to durable projection storage, closing the view no longer cancels that commit. **Open target session** remains available for recovery.

Source selection can be cancelled before submission. Once submission starts, the controls stay locked until it succeeds or produces a recoverable error; leaving the view still aborts its browser request. Host capture waiting is also bounded, and a timeout is reported as a retryable snapshot-submission failure.

## Generate a Session Digest

Select any non-blank Canvas Session and choose **Generate digest** in the Session Inspector. Generation is never automatic and never blocks **Open session** or **New branch**.

- The Host inspects the exact Selected Session, even when it is not the Viewed Session. It keeps direct user messages and final assistant text, but excludes reasoning, tool results, and plugin-injected context.
- Model input is capped at 32 KiB. Long sessions retain the initial user goal, latest compaction checkpoint, and as many recent turns as fit.
- The auxiliary request uses no tools and asks for structured output: a concise overview, key outcomes, and open items. It uses the Session's latest logged provider/model route; an optional configured route is only a fallback.
- A digest generated while the Session is running is labeled **Running snapshot**. New activity marks the visible digest **Session has new content** without hiding it; choose **Update digest** to replace it.
- Successful results are cached in Host memory by Session and source revision. **Regenerate** bypasses that cache. Empty or failed results are not cached as successful digests and can be retried.
- Concurrent requests for the same revision share one model call without sharing caller cancellation. Plugin shutdown stops new digest work, cancels owned work, and waits for admitted requests to settle before removing the service.

This is an additional model request and may incur the selected provider's normal cost. Digest text is a read-only projection: it is not a conversation message, does not enter the Session log, and does not change Session Lineage.

Most sessions need no configuration because their logs record the model route. For older imported sessions without one, overlay the installed plugin entry in the profile's `cordis.yml`:

```yaml
- id: ui-session-graph
  config:
    provider: deepseek-official
    model: deepseek-v4-flash
    maxOutputTokens: 800
    timeoutMs: 60000
```

`provider` and `model` must be supplied together and never override a route recorded by the Session. `maxOutputTokens` defaults to `800`; `timeoutMs` defaults to `60000`. Plugin activation validates this configuration through its exported Standard Schema and rejects blank routes, incomplete pairs, non-integers, and non-positive limits.

## Develop

Requirements are Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install
pnpm run check
```

`pnpm run check` type-checks the standalone package, builds the Host and browser entries, and runs the package-owned test suite. To run the Host and full-interaction integration suite against a prepared DeepSeek Harness checkout:

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

CI runs the standalone check on Node.js 22.19, 24, and 26. Its compatibility matrix checks out `deepseek-ai/deepseek-harness` at both `dsh-v0.1.2-alpha.1` and `dsh-v0.1.2-alpha.2`, runs the Harness integration suite, and verifies that the packed archive enters and leaves a scratch `web` profile cleanly.

Build an installable archive with:

```sh
pnpm pack
```

Local builds derive a stable `local-<hash>` Build ID from `package.json`, `tsdown.config.ts`, and `src/`. Release automation can replace it by setting `DSH_SESSION_GRAPH_BUILD_ID` while building.

### Release

The [Publish workflow](.github/workflows/publish.yml) accepts a published GitHub Release or a manually supplied existing tag. It requires the tag to equal `v` plus the package version, reruns `pnpm run check`, packs the archive, and publishes those verified bytes under npm tag `latest` for stable versions or `next` for prereleases.

The package uses an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for organization `benz-ai-x`, repository `dsh-session-graph`, workflow `publish.yml`, environment `npm-publish`, and the `npm publish` action. The workflow authenticates with GitHub OIDC and must not receive a long-lived `NPM_TOKEN`; keep the GitHub environment as the deployment boundary. When bootstrapping a different package or scope, use a narrowly scoped, short-lived token only for the first publication, configure trusted publishing immediately, and then revoke the token.

Every GitHub Release must first update `package.json`. Build and verify that the Graph header badge shows the same version, merge the change, create the matching immutable `v<version>` tag, and then publish the Release. To publish an existing tag such as `v0.1.2`, run the Publish workflow manually and pass that tag.

The package exports two Host entries and one lazy browser module. Every JavaScript entry ships a matching TypeScript declaration in the packed archive:

| Export | Purpose |
|---|---|
| `.` | Cordis Host services for Session Digest generation and durable Session Merge submission |
| `./invariant` | Runtime registration invariant |
| `./client` | Built dsh client module |
| `./cordis.patch.yml` | Profile bundle patch |

## Implementation

`GraphView` reads the Viewed Session, Workspace membership, session summaries, and pending-interaction map. Indexed pure helpers derive Session Clusters, Branch and Merge edges, Subagent Summaries, cross-cluster ordering, layout, snapping, Title Filter matches, and viewport state. A separate presentation pipeline applies node positions, collapse state, and cluster offsets before `GraphCanvas` renders the result. The Host exposes separate package-owned Remotes for read-only Session Digests and atomic Session Merge capture. Merge submission revalidates Host truth, queues an explicit marker and canonical references, waits for the matching projection, then writes the Projection Cache before reporting success.

| File | Responsibility |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope resolution, graph derivation, and view header |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | Canvas rendering, ports, inspector, controls, gestures, hover state, and minimap |
| [`src/config.ts`](src/config.ts) | Exported Standard Schema, defaults, and normalized Host configuration |
| [`src/index.ts`](src/index.ts) | Session Digest and Session Merge Host services, projection registration, configuration, and Remote errors |
| [`src/session-digest.ts`](src/session-digest.ts) and [`src/session-digest-harness.ts`](src/session-digest-harness.ts) | Event filtering, input budgeting, route reconstruction, output validation, revision cache, and concurrency control |
| [`src/session-merge.ts`](src/session-merge.ts), [`src/session-merge-host.ts`](src/session-merge-host.ts), and [`src/session-merge-harness.ts`](src/session-merge-harness.ts) | Browser workflow, Host validation, canonical reference submission, bounded capture, idempotent retry, and durability barrier |
| [`src/session-merge-projection.ts`](src/session-merge-projection.ts) | Versioned Merge marker/reference projection and strict persisted-state validation |
| [`src/client/session-digest-remote.ts`](src/client/session-digest-remote.ts) | Strict browser Remote request/result contract |
| [`src/client/session-merge-remote.ts`](src/client/session-merge-remote.ts) | Strict browser Session Merge Remote request/result contract |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | Graph Scope resolution, Branch and Merge edges, Session Cluster ordering, Subagent Summaries, Title Filter matches, and Branch Lineages |
| [`src/client/canvas-presentation.ts`](src/client/canvas-presentation.ts) | Ordered Session Arrangement projection and final/automatic content bounds |
| [`src/client/layout.ts`](src/client/layout.ts) and [`src/client/clusters.ts`](src/client/clusters.ts) | Tree coordinates, frames, collapse, offsets, and edge paths |
| [`src/client/viewport.ts`](src/client/viewport.ts), [`src/client/preview-placement.ts`](src/client/preview-placement.ts), and [`src/client/snap.ts`](src/client/snap.ts) | Zoom, pan, resize preservation, fit, minimap/preview placement, and alignment guides |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | Per-scope Session Arrangement persistence, migration, and fail-soft storage recovery |

## Current limitations

- Graph is unavailable on the no-session home screen and in a fresh blank session because neither has a conversation view ring.
- The graph follows one Workspace or Directory Scope at a time and does not search message content or working-directory paths.
- Pan and zoom reset on tab switch or reload; node positions, cluster offsets, and collapse state persist.
- Session Digests are generated only on demand and cached in Host memory, not persisted as durable artifacts. A Host restart clears the cache.
- A Session without a logged model route needs a configured fallback route before it can be digested.
- A Branch created from a Subagent Session has no Canvas Session parent edge and appears as a Root Session.
- One Merge accepts two or three sources, and all sources must resolve in the target's working directory. Cross-Workspace Merge is not supported.
- Merge captures immutable source snapshots; later source messages do not automatically refresh an existing Merge Session.
- Touch uses pointer-event fallbacks and has no dedicated controls.

## License

[MIT](LICENSE)
