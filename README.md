---
description: "Installable dsh Web plugin for browsing, arranging, and branching related workspace sessions on a free canvas."
kind: "package-bundle"
---

# @benz-ai-x/dsh-client-ui-session-graph

English | [中文](README.zh.md)

This package adds a **Graph** tab to the DeepSeek Harness conversation view. It groups each ordinary-session derivation tree into a movable, collapsible cluster, draws fork relations as directed edges, and folds subagent descendants into status badges. The browser stores manual node positions, cluster offsets, and collapse state per workspace; the plugin does not change session logs or model requests.

## Install

After the package is published to npm, add it to the `web` profile:

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph
```

The package contains both the browser plugin and its `cordis.patch.yml` bundle patch. The dsh plugin manager inserts it after the Session, Workspace, locale, renderer, and conversation plugins already supplied by the `web` profile. No manual `cordis.yml` edit is required.

Remove it with:

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

The first release targets DeepSeek Harness `0.1.2-alpha.1`. The plugin intentionally does not install unpublished `@deepseek-ai/*` packages into its own dependency tree; those services and browser modules belong to the selected dsh profile.

## Use the graph

Open a non-blank session and choose **Graph** beside the standard conversation tabs. The view scopes itself to that session's workspace.

- A single click selects a node; the detail panel can open that session or create a branch.
- A double click opens the session in its last-used view.
- Drag nodes or complete cluster frames to arrange the canvas. Alignment guides snap nearby card edges.
- Use wheel zoom, background-drag panning, fit, 100%, relayout, reset, current-session location, or the minimap.
- Filter by title; Enter centers the first match and Escape clears the filter.
- Hover a node or edge to emphasize its related branch.

Keyboard shortcuts work while the canvas is focused: `+` and `-` zoom, `0` restores 100%, and `1` fits the graph.

## Develop

Requirements are Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install
pnpm run check
```

`pnpm run check` type-checks the standalone package, builds the host and browser entries, and runs 76 package-owned tests. To run the 51 full interaction tests against a prepared DeepSeek Harness checkout:

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness
```

Build an installable archive with:

```sh
pnpm pack
```

The package exports two host entries and one lazy browser module:

| Export | Purpose |
|---|---|
| `.` | Cordis browser-entry registration |
| `./invariant` | Runtime registration invariant |
| `./client` | Built dsh client module |
| `./cordis.patch.yml` | Profile bundle patch |

## Implementation

`GraphView` reads the selected Session, workspace membership, session summaries, and pending-interaction map. Pure helpers derive clusters, fork edges, layout, snapping, filtering, and viewport state before `GraphCanvas` renders the result. The package provides no Host service and accepts no configuration fields.

| File | Responsibility |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace scope, graph derivation, and view header |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | Canvas rendering, controls, gestures, hover state, and minimap |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | Session scope, derivation edges, subagent badges, filtering, and neighborhoods |
| [`src/client/layout.ts`](src/client/layout.ts) and [`src/client/clusters.ts`](src/client/clusters.ts) | Tree coordinates, frames, collapse, offsets, and edge paths |
| [`src/client/viewport.ts`](src/client/viewport.ts) and [`src/client/snap.ts`](src/client/snap.ts) | Zoom, pan, fit, minimap projection, and alignment guides |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | Per-workspace browser persistence and invalid-record recovery |

## Current limitations

- Graph is unavailable on the no-session home screen and in a fresh blank session because neither has a conversation view ring.
- The graph follows one workspace at a time and does not search message content or workspace paths.
- Pan and zoom reset on tab switch or reload; node positions, cluster offsets, and collapse state persist.
- A fork created inside a subagent has no ordinary-session parent edge and appears as a root.
- A rejected branch operation has no in-view error message.
- Touch uses pointer-event fallbacks and has no dedicated controls.

## License

[MIT](LICENSE)
