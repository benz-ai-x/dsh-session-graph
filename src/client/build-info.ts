/** Build metadata injected into the browser bundle by tsdown. */
declare const __SESSION_GRAPH_VERSION__: string
declare const __SESSION_GRAPH_BUILD_ID__: string

/** Published package identity shown in the Graph header tooltip. */
export const SESSION_GRAPH_PACKAGE_NAME = '@benz-ai-x/dsh-client-ui-session-graph'

/** Package version from package.json at build time. */
export const SESSION_GRAPH_VERSION = __SESSION_GRAPH_VERSION__

/** Content-derived identifier for the exact local browser build. */
export const SESSION_GRAPH_BUILD_ID = __SESSION_GRAPH_BUILD_ID__

/** Compact user-visible version badge. */
export const SESSION_GRAPH_BUILD_LABEL =
  `Session Graph v${SESSION_GRAPH_VERSION} · ${SESSION_GRAPH_BUILD_ID}`

/** Complete native-tooltip text for the version badge. */
export const SESSION_GRAPH_BUILD_TITLE =
  `${SESSION_GRAPH_PACKAGE_NAME} v${SESSION_GRAPH_VERSION} · build ${SESSION_GRAPH_BUILD_ID}`
