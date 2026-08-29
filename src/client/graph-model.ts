/**
 * Pure derivation of the scope-bound Session Graph from the sessions-list
 * snapshot: graph-scope resolution, Session Cluster partitioning, Branch
 * edge rules, and Subagent Summary aggregation. Subagent Sessions
 * stay off the canvas — their presence folds into every canvas ancestor's
 * badge counts along the uninterrupted chain. React-free; the view memoizes
 * over these functions and the layout module consumes their output.
 * @module @benz-ai-x/dsh-client-ui-session-graph/src/client/graph-model
 */
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionMergeProjectionSource } from '../session-merge-projection.ts'
import type { SessionArrangementIdentity } from './layout-store.ts'

/**
 * The graph scope the view renders. Formal Workspace membership follows the
 * host's own rule — `sessionIds` accounting is authoritative — with two display-only
 * extensions: same-cwd rows join the member set (a directory's work shows
 * together even when the host accounts it separately), and an unaccounted
 * cwd yields a label-less bucket rather than no graph at all.
 */
interface GraphScopeBase {
  /** Workspace title, or undefined for a Directory Scope. */
  readonly label: string | undefined
  /** Canonical directory path of the scope. */
  readonly path: string
  /** Stable persistence identity for this scope's Session Arrangement. */
  readonly arrangement: SessionArrangementIdentity
  /** Member session ids (archived rows already excluded). */
  readonly members: ReadonlySet<SessionId>
}

/** A named graph scope resolved from Harness Workspace membership or path. */
export interface WorkspaceGraphScope extends GraphScopeBase {
  readonly kind: 'workspace'
  readonly label: string
  readonly workspaceId: string
}

/** An unnamed graph scope resolved only from the Viewed Session's directory. */
export interface DirectoryGraphScope extends GraphScopeBase {
  readonly kind: 'directory'
  readonly label: undefined
}

/** The Workspace Scope or Directory Scope rendered for one Viewed Session. */
export type GraphScope = WorkspaceGraphScope | DirectoryGraphScope

/** One canvas node: a visible session with its folded subagent badge totals. */
export interface GraphNode {
  readonly id: SessionId
  /** Owning cluster's root session id. */
  readonly clusterId: SessionId
  readonly title: string
  readonly blank: boolean
  readonly displayStatus: DisplayStatus | undefined
  readonly viewed: boolean
  readonly updatedAt: number
  /** Subagent descendants reachable through an uninterrupted subagent-origin chain. */
  readonly subagentCount: number
  readonly runningSubagents: number
  /** The parent Canvas Session id for an attached Branch. */
  readonly branchFrom: SessionId | undefined
  /** Captured source snapshots when this node is an explicit Merge Session. */
  readonly mergeSources: readonly SessionMergeProjectionSource[]
}

/** The one activity label presented when source activity facts overlap. */
export type DisplayStatus = 'running' | 'waiting-input' | 'completed'

/** One typed relationship between two Canvas Sessions. */
export interface GraphEdge {
  readonly id: string
  readonly kind: 'branch' | 'merge'
  readonly from: string
  readonly to: string
}

/**
 * One Session Cluster: a Root Session, its Branch descendants, and the
 * folded Subagent Session chains summarized under those Canvas Sessions.
 * Isolated Canvas Sessions form single-member clusters.
 */
export interface ClusterInfo {
  readonly rootId: SessionId
  readonly label: string
  readonly memberIds: readonly SessionId[]
}

/** The derived graph: cluster partitioning plus the canvas node forest. */
export interface SessionGraph {
  /** Clusters in display order (root recency descending, id tiebreak). */
  readonly clusters: readonly ClusterInfo[]
  /** Canvas node data keyed by session id. */
  readonly nodes: ReadonlyMap<string, GraphNode>
  /** Attached Branch children in display order (updatedAt descending, id tiebreak). */
  readonly children: ReadonlyMap<string, readonly string[]>
  readonly edges: readonly GraphEdge[]
  /** Count of Canvas Sessions in the graph scope. */
  readonly sessionCount: number
}

/**
 * Resolve the graph scope the graph of one Viewed Session renders.
 * Preference order: the workspace accounting the session in `sessionIds`,
 * then a workspace whose path equals the session cwd, then a cwd-only
 * bucket. Archived rows never join the member set. A session with neither
 * membership nor cwd has no scope (the view shows its empty state).
 * @param sessionId - the viewed session.
 * @param list - the sessions-list snapshot.
 * @param workspaces - the workspaces-list snapshot.
 * @returns the scope, or undefined when unresolvable.
 */
export function resolveGraphScope(
  sessionId: SessionId,
  list: SessionListState,
  workspaces: WorkspaceSnapshot,
): GraphScope | undefined {
  const viewed = list.byId[sessionId]
  const byAccounting = workspaces.items.find(workspace => workspace.sessionIds.includes(sessionId))
  const byCwd = viewed?.cwd !== undefined
    ? workspaces.items.find(workspace => workspace.path === viewed.cwd)
    : undefined
  const workspace = byAccounting ?? byCwd
  const path = workspace?.path ?? viewed?.cwd
  if (path === undefined) return undefined
  const archived = new Set(workspaces.archivedSessionIds)
  const members = new Set<SessionId>()
  for (const row of Object.values(list.byId)) {
    if (archived.has(row.id)) continue
    if (workspace !== undefined
      ? workspace.sessionIds.includes(row.id) || row.cwd === workspace.path
      : row.cwd === path) {
      members.add(row.id)
    }
  }
  if (workspace === undefined) {
    return {
      kind: 'directory',
      label: undefined,
      path,
      arrangement: { key: path, legacyKey: undefined },
      members,
    }
  }
  return {
    kind: 'workspace',
    label: workspace.title,
    workspaceId: workspace.workspaceId,
    path,
    arrangement: { key: `workspace:${workspace.workspaceId}`, legacyKey: path },
    members,
  }
}

/** Badge totals indexed under every canvas ancestor an uninterrupted subagent chain reaches. */
interface BadgeSummary {
  count: number
  runningCount: number
}

/**
 * Index subagent badge totals over the visible rows. Semantics match the
 * runtime's `indexSubagentDescendants`: a descendant credits every ancestor
 * it reaches through an uninterrupted Subagent Derivation chain, and a
 * Branch terminates propagation (a Branch child's subagents belong to that
 * Branch's own subtree). Cycles fail soft via the seen set.
 * @param visible - the visible session rows keyed by id.
 * @returns badge and running totals keyed by ancestor id.
 */
function indexBadges(
  visible: ReadonlyMap<SessionId, SessionSummary>,
): ReadonlyMap<SessionId, BadgeSummary> {
  const indexed = new Map<SessionId, BadgeSummary>()
  for (const descendant of visible.values()) {
    if (descendant.origin !== 'subagent') continue
    const seen = new Set<SessionId>()
    let current: SessionSummary | undefined = descendant
    /* jscpd:ignore-start — deliberate semantic twin of the runtime's
       indexSubagentDescendants walk: the client bundle purity gate forbids
       the cross-plugin value import, and the badge semantics must stay
       pinned to the runtime's chain-walk shape. */
    while (current?.origin === 'subagent' && current.parentId !== undefined
      && !seen.has(current.id)) {
      seen.add(current.id)
      const badge = indexed.get(current.parentId)
      if (badge === undefined) {
        indexed.set(current.parentId, { count: 1, runningCount: descendant.running ? 1 : 0 })
      } else {
        badge.count += 1
        if (descendant.running) badge.runningCount += 1
      }
      current = visible.get(current.parentId)
    }
    /* jscpd:ignore-end */
  }
  return indexed
}

/** Display order: updatedAt descending, then id ascending as the deterministic tiebreak. */
function byRecency(a: SessionSummary, b: SessionSummary): number {
  // Map-keyed ids are unique, so the tiebreak never sees equal ids.
  return b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : 1)
}

/**
 * Derive the session graph for one scope.
 *
 * Rules: blank rows are excluded except the Viewed Session; subagent-origin
 * rows never render as canvas nodes (they fold into ancestor badges); a
 * Branch edge requires the parent to be a visible Canvas Session (a Branch
 * taken inside a Subagent Session renders as a new Root Session); every
 * canvas node carries the badge totals of its own uninterrupted subagent
 * chain. Session Clusters partition Canvas Sessions by Root Session.
 * @param list - the sessions-list snapshot.
 * @param scope - the resolved graph scope, or undefined for the empty state.
 * @param viewedId - the Viewed Session (kept when blank, highlighted).
 * @param pendingInteractions - pending UI interactions keyed by Session id.
 * @returns the derived graph.
 */
export function deriveSessionGraph(
  list: SessionListState,
  scope: GraphScope | undefined,
  viewedId: SessionId | undefined,
  pendingInteractions: ReadonlyMap<SessionId, unknown>,
): SessionGraph {
  const visible = new Map<SessionId, SessionSummary>()
  if (scope !== undefined) {
    for (const row of Object.values(list.byId)) {
      if (!scope.members.has(row.id)) continue
      if (row.blank && row.id !== viewedId) continue
      visible.set(row.id, row)
    }
  }

  const badges = indexBadges(visible)
  const nodes = new Map<string, GraphNode>()
  const children = new Map<string, string[]>()
  const edges: GraphEdge[] = []
  const clusters: ClusterInfo[] = []

  const hasVisibleSessionParent = (row: SessionSummary): boolean => {
    const parent = row.parentId !== undefined ? visible.get(row.parentId) : undefined
    return parent !== undefined && parent.origin !== 'subagent'
  }

  const branchChildrenOf = (row: SessionSummary): SessionSummary[] =>
    [...visible.values()].filter(child =>
      child.parentId === row.id && child.origin !== 'subagent',
    ).sort(byRecency)

  /** Recursively place one cluster member and collect the member ids beneath it. */
  const placeMember = (row: SessionSummary, clusterRootId: SessionId, members: SessionId[]): void => {
    const badge = badges.get(row.id)
    const pending = pendingInteractions.has(row.id)
    nodes.set(row.id, {
      id: row.id,
      clusterId: clusterRootId,
      title: row.displayTitle,
      blank: row.blank,
      displayStatus: row.running ? 'running'
        : pending ? 'waiting-input'
          : row.completed === true ? 'completed' : undefined,
      viewed: row.id === viewedId,
      updatedAt: row.updatedAt,
      subagentCount: badge?.count ?? 0,
      runningSubagents: badge?.runningCount ?? 0,
      branchFrom: row.parentId !== undefined && visible.get(row.parentId)?.origin !== 'subagent'
        ? row.parentId
        : undefined,
      mergeSources: row.projectionValues?.sessionGraphMerge?.sources ?? [],
    })
    members.push(row.id)
    const childKeys: string[] = []
    for (const child of branchChildrenOf(row)) {
      childKeys.push(child.id)
      edges.push({
        id: `branch:${row.id}->${child.id}`,
        kind: 'branch',
        from: row.id,
        to: child.id,
      })
    }
    if (childKeys.length > 0) children.set(row.id, childKeys)
    for (const child of branchChildrenOf(row)) placeMember(child, clusterRootId, members)
  }

  const roots = [...visible.values()]
    .filter(row => row.origin !== 'subagent' && !hasVisibleSessionParent(row))
    .sort(byRecency)
  for (const root of roots) {
    const members: SessionId[] = []
    placeMember(root, root.id, members)
    clusters.push({ rootId: root.id, label: root.displayTitle, memberIds: members })
  }

  for (const target of nodes.values()) {
    for (const source of target.mergeSources) {
      if (!nodes.has(source.sessionId)) continue
      edges.push({
        id: `merge:${source.sessionId}->${target.id}`,
        kind: 'merge',
        from: source.sessionId,
        to: target.id,
      })
    }
  }

  const orderedClusters = orderClustersByMerge(clusters, nodes, edges)

  return {
    clusters: orderedClusters,
    nodes,
    children,
    edges,
    sessionCount: nodes.size,
  }
}

/** Stable topological order: source clusters precede their Merge targets. */
function orderClustersByMerge(
  clusters: readonly ClusterInfo[],
  nodes: ReadonlyMap<string, GraphNode>,
  edges: readonly GraphEdge[],
): readonly ClusterInfo[] {
  const index = new Map(clusters.map((cluster, position) => [cluster.rootId, position]))
  const byId = new Map(clusters.map(cluster => [cluster.rootId, cluster]))
  const outgoing = new Map<SessionId, Set<SessionId>>()
  const indegree = new Map(clusters.map(cluster => [cluster.rootId, 0]))
  for (const edge of edges) {
    if (edge.kind !== 'merge') continue
    const from = nodes.get(edge.from)?.clusterId
    const to = nodes.get(edge.to)?.clusterId
    if (from === undefined || to === undefined || from === to) continue
    const targets = outgoing.get(from) ?? new Set<SessionId>()
    if (targets.has(to)) continue
    targets.add(to)
    outgoing.set(from, targets)
    indegree.set(to, (indegree.get(to) ?? 0) + 1)
  }
  const ready = clusters
    .filter(cluster => indegree.get(cluster.rootId) === 0)
    .map(cluster => cluster.rootId)
  const ordered: ClusterInfo[] = []
  while (ready.length > 0) {
    const next = ready.shift()
    /* v8 ignore next -- ready is non-empty */
    if (next === undefined) break
    const cluster = byId.get(next)
    /* v8 ignore next -- ready ids come from clusters */
    if (cluster === undefined) continue
    ordered.push(cluster)
    for (const target of outgoing.get(next) ?? []) {
      const remaining = (indegree.get(target) ?? 0) - 1
      indegree.set(target, remaining)
      if (remaining !== 0) continue
      ready.push(target)
      ready.sort((left, right) => (index.get(left) ?? 0) - (index.get(right) ?? 0))
    }
  }
  return ordered.length === clusters.length ? ordered : clusters
}

/**
 * The Branch Lineage of one Canvas Session: itself, its Branch ancestors
 * up the {@link GraphNode.branchFrom} chain, and its Branch descendants down
 * the tree — never siblings. The canvas emphasizes this lineage while
 * dimming the rest. Cycles fail soft via the seen set; an unknown key
 * yields an empty set.
 * @param nodes - the canvas nodes.
 * @param key - the node id to center on.
 * @returns the Branch Lineage ids.
 */
export function branchLineage(nodes: Iterable<GraphNode>, key: string): ReadonlySet<string> {
  const byId = new Map<string, GraphNode>()
  const childrenOf = new Map<string, string[]>()
  for (const node of nodes) {
    byId.set(node.id, node)
    if (node.branchFrom === undefined) continue
    const list = childrenOf.get(node.branchFrom)
    if (list === undefined) childrenOf.set(node.branchFrom, [node.id])
    else list.push(node.id)
  }
  const seen = new Set<string>()
  let current = byId.get(key)
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id)
    current = current.branchFrom === undefined ? undefined : byId.get(current.branchFrom)
  }
  const stack = [key]
  let next = stack.pop()
  while (next !== undefined) {
    for (const child of childrenOf.get(next) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      stack.push(child)
    }
    next = stack.pop()
  }
  return seen
}

/**
 * The title-filter match set: ids of nodes whose title contains the query
 * (case-insensitive, surrounding whitespace ignored). A blank query yields
 * null — the filter is inactive and nothing dims; a non-blank query with
 * no hits yields an empty set (the whole canvas dims).
 * @param nodes - the canvas nodes.
 * @param query - the raw filter input.
 * @returns the matching ids, or null when the filter is inactive.
 */
export function matchFilter(nodes: Iterable<GraphNode>, query: string): ReadonlySet<string> | null {
  const needle = query.trim().toLowerCase()
  if (needle === '') return null
  const matched = new Set<string>()
  for (const node of nodes) {
    if (node.title.toLowerCase().includes(needle)) matched.add(node.id)
  }
  return matched
}
