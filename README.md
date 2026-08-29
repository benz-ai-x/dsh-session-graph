---
description: "Installable dsh Web plugin for browsing, arranging, and branching related workspace sessions on a free canvas."
kind: "package-bundle"
---

# @benz-ai-x/dsh-client-ui-session-graph

English | [中文](README.zh.md)

This package adds a **Graph** tab to the DeepSeek Harness conversation view. It groups Branch-connected Canvas Sessions into movable, collapsible Session Clusters, draws Branch relations as directed edges, and folds Subagent Sessions into Subagent Summaries. The browser stores each Session Arrangement by graph scope; the projection does not change session logs or model requests, while **New branch** delegates session creation to Harness.

## Install

After the package is published to npm, add it to the `web` profile:

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

To install the tagged source directly from GitHub:

```sh
dsh plugin --profile web add github:benz-ai-x/dsh-session-graph#v0.1.0
```

pnpm blocks a git dependency's `prepare` script until the profile explicitly permits it. The first GitHub install exits with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`; copy the exact key printed by dsh into `$DSH_HOME/profiles/web/pnpm-workspace.yaml` under `allowBuilds`, then rerun the command. This permission executes package code outside the agent sandbox, so inspect the source and pin a tag or commit.

The package contains both the browser plugin and its `cordis.patch.yml` bundle patch. The dsh plugin manager inserts it after the Session, Workspace, locale, renderer, and conversation plugins already supplied by the `web` profile. No manual `cordis.yml` edit is required.

Remove it with:

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

Restart the target `web` profile after installation or removal. A running process does not watch its profile dependency list.

The first release targets DeepSeek Harness `0.1.2-alpha.1`. The plugin intentionally does not install unpublished `@deepseek-ai/*` packages into its own dependency tree; those services and browser modules belong to the selected dsh profile.

## Use the graph

Open a non-blank session and choose **Graph** beside the standard conversation tabs. The Viewed Session resolves a named Workspace Scope when possible and otherwise falls back to a Directory Scope.

- A single click chooses the Selected Session and keeps its Branch Lineage emphasized; the closable detail inspector can open that session or create a Branch, and reports when Harness rejects the request. Click blank canvas space or press Escape to clear selection.
- A double click opens the session in its last-used view.
- Dwell on another Canvas Session for a compact preview without replacing the Selected Session inspector.
- Drag nodes or complete cluster frames to arrange the canvas. Alignment guides snap nearby card edges.
- Each Canvas Session exposes stable top input and bottom output terminals for later graph-editing features; Branches are solid directed edges and Subagent Derivations are dashed.
- Use wheel zoom, background-drag panning, fit, 100%, relayout, reset, Viewed Session location, or the minimap. The minimap appears only when content leaves the visible surface, and resizing preserves the current content center and scale.
- Filter by title; Enter centers the first match and Escape clears the filter.
- Hover a node or edge to emphasize its Branch Lineage.
- Read the header badge to identify the package version and exact local Build ID; hover it for the full package identity.

Keyboard shortcuts work while the canvas is focused: `+` and `-` zoom, `0` restores 100%, and `1` fits the graph.

## Develop

Requirements are Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install
pnpm run check
```

`pnpm run check` type-checks the standalone package, builds the host and browser entries, and runs 85 package-owned tests. To run the 73 full interaction tests against a prepared DeepSeek Harness checkout:

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

CI runs the standalone check on Node.js 22.19, 24, and 26. Its compatibility job checks out `deepseek-ai/deepseek-harness` at `dsh-v0.1.2-alpha.1`, runs the Harness integration suite, and verifies that the packed archive enters and leaves a scratch `web` profile cleanly.

Build an installable archive with:

```sh
pnpm pack
```

Local builds derive a stable `local-<hash>` Build ID from `package.json`, `tsdown.config.ts`, and `src/`. Release automation can replace it by setting `DSH_SESSION_GRAPH_BUILD_ID` while building.

### Release

The [Publish workflow](.github/workflows/publish.yml) accepts a published GitHub Release or a manually supplied existing tag. It requires the tag to equal `v` plus the package version, reruns `pnpm run check`, packs the archive, and publishes those verified bytes under npm tag `latest` for stable versions or `next` for prereleases.

Configure the GitHub environment `npm-publish` before publishing. If the package does not exist on npm yet, add a narrowly scoped `NPM_TOKEN` repository secret for the initial publication. Then configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for organization `benz-ai-x`, repository `dsh-session-graph`, workflow `publish.yml`, environment `npm-publish`, and the `npm publish` action; remove the long-lived secret after trusted publishing succeeds.

For a new version, update `package.json`, merge the change, create the matching immutable `v<version>` tag, and publish a GitHub Release. To publish an existing tag such as `v0.1.0`, run the Publish workflow manually and pass that tag.

The package exports two host entries and one lazy browser module:

| Export | Purpose |
|---|---|
| `.` | Cordis browser-entry registration |
| `./invariant` | Runtime registration invariant |
| `./client` | Built dsh client module |
| `./cordis.patch.yml` | Profile bundle patch |

## Implementation

`GraphView` reads the Viewed Session, Workspace membership, session summaries, and pending-interaction map. Pure helpers derive Session Clusters, Branch edges, Subagent Summaries, layout, snapping, Title Filter matches, and viewport state before `GraphCanvas` renders the result. The package provides no Host service and accepts no configuration fields.

| File | Responsibility |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope resolution, graph derivation, and view header |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | Canvas rendering, ports, inspector, controls, gestures, hover state, and minimap |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | Graph Scope resolution, Branch edges, Subagent Summaries, Title Filter matches, and Branch Lineages |
| [`src/client/layout.ts`](src/client/layout.ts) and [`src/client/clusters.ts`](src/client/clusters.ts) | Tree coordinates, frames, collapse, offsets, and edge paths |
| [`src/client/viewport.ts`](src/client/viewport.ts), [`src/client/preview-placement.ts`](src/client/preview-placement.ts), and [`src/client/snap.ts`](src/client/snap.ts) | Zoom, pan, resize preservation, fit, minimap/preview placement, and alignment guides |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | Per-scope Session Arrangement persistence, migration, and invalid-record recovery |

## Current limitations

- Graph is unavailable on the no-session home screen and in a fresh blank session because neither has a conversation view ring.
- The graph follows one Workspace or Directory Scope at a time and does not search message content or working-directory paths.
- Pan and zoom reset on tab switch or reload; node positions, cluster offsets, and collapse state persist.
- A Branch created from a Subagent Session has no Canvas Session parent edge and appears as a Root Session.
- Touch uses pointer-event fallbacks and has no dedicated controls.

## License

[MIT](LICENSE)
