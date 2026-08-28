/**
 * The free-viewport canvas: a dot-grid surface with wheel-anchored zoom,
 * background-drag panning, the zoom controls (− / level / + / fit / relayout
 * / reset / locate), a title filter, and the minimap, rendering the laid-out
 * graph inside one transformed content layer. Hovering emphasizes one
 * branch lineage (or one edge's endpoints) while the rest dims; a dwell
 * opens the node detail card; drags snap to sibling edges behind alignment
 * guides; programmatic jumps glide while gestures stay immediate. Every
 * gesture resolves through the pure viewport math module.
 */
import clsx from 'clsx'
import {
  useCallback, useEffect, useMemo, useRef, useState, type ReactElement,
} from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  applyCollapse, applyOffsets, CLUSTER_COLORS, clusterFrames, contentBounds,
} from './clusters.ts'
import type { ClusterInfo } from './graph-model.ts'
import { matchFilter, neighborhood } from './graph-model.ts'
import {
  applyPositions, CARD_H, NODE_W, type ContentBounds, type LaidOutGraph, type LaidOutNode,
} from './layout.ts'
import { type ClusterOffset, loadLayout, saveLayout, type NodePosition } from './layout-store.ts'
import type { SessionGraphKey } from './locales.ts'
import { snapPosition } from './snap.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { LaidOutFrame } from './clusters.ts'
import {
  fitViewport, initialViewport, minimapProjection, panBy, zoomAt,
} from './viewport.ts'
import styles from './GraphView.module.css'

/** Screen movement below this many px stays a click, not a drag. */
const DRAG_THRESHOLD = 3

/** Translation seat over the sessionGraph namespace. */
type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

/** Grid dot spacing in content px. */
const GRID = 24
/** Fit-view inset in screen px. */
const FIT_PADDING = 48
/** One control-button zoom step as a multiplicative factor. */
const CONTROL_STEP = 1.2
/** Below this scale the card text is unreadable; the LOD pass fades it. */
const LOD_SCALE = 0.45
/** Drag-alignment snap distance in screen px (scaled into content px). */
const SNAP_PX = 6
/** Hover dwell in ms before the node detail card opens. */
const PREVIEW_DELAY = 400
/** Node detail card width in screen px. */
const PREVIEW_W = 240

/** Restore one record key to its pre-gesture value, removing a previously absent key. */
function restoreEntry<T>(
  record: Readonly<Record<string, T>>,
  key: string,
  previous: T | undefined,
): Record<string, T> {
  if (previous !== undefined) return { ...record, [key]: previous }
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key))
}

/** Localized compact relative time, bucketed exactly like the sidebar rows. */
function timeLabel(updatedAt: number, now: number, t: Translate): string {
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  const diff = Math.max(0, now - updatedAt)
  if (diff < MIN) return t('time.now')
  if (diff < HOUR) return t('time.minutes', { n: Math.floor(diff / MIN) })
  if (diff < DAY) return t('time.hours', { n: Math.floor(diff / HOUR) })
  if (diff < 30 * DAY) return t('time.days', { n: Math.floor(diff / DAY) })
  if (diff < 365 * DAY) return t('time.months', { n: Math.floor(diff / (30 * DAY)) })
  return t('time.years', { n: Math.floor(diff / (365 * DAY)) })
}

/** Node pointer-gesture callbacks owned by the canvas (drag + click routing). */
interface NodeGestureHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
  onClick: () => void
  onDoubleClick: () => void
}

/** One node card button: time-first, selected state, title caption, badge. */
function NodeCard({
  laid, now, t, gestures, clusterColor, selected, onHoverBadge, badgeHovered,
  dimmed, onHoverNode,
}: {
  laid: LaidOutNode
  now: number
  t: Translate
  gestures: NodeGestureHandlers
  clusterColor: string
  selected: boolean
  onHoverBadge: (key: string | null) => void
  badgeHovered: boolean
  dimmed: boolean
  onHoverNode: (key: string | null) => void
}) {
  const { node, key, x, y } = laid
  const badge = node.subagentCount > 0
    ? `${t('node.subagents', { count: node.subagentCount })}${node.runningSubagents > 0 ? ` (${t('node.running', { count: node.runningSubagents })})` : ''}`
    : ''
  return (
    <button
      type="button"
      className={clsx(
        styles.node,
        styles.sessionNode,
        selected ? styles.nodeSelected : null,
        node.pending ? styles.nodePending : null,
        badgeHovered ? styles.badgeHovered : null,
        dimmed ? styles.dim : null,
      )}
      style={{ left: `${x}px`, top: `${y}px` }}
      data-node-id={key}
      aria-current={node.current ? 'true' : undefined}
      aria-selected={selected}
      onPointerDown={gestures.onPointerDown}
      onPointerMove={gestures.onPointerMove}
      onPointerUp={gestures.onPointerUp}
      onPointerCancel={gestures.onPointerCancel}
      onClick={gestures.onClick}
      onDoubleClick={gestures.onDoubleClick}
      onMouseEnter={() => { onHoverNode(key) }}
      onMouseLeave={() => { onHoverNode(null) }}
    >
      <span
        className={clsx(styles.dot, node.running ? styles.dotPulse : null)}
        style={{ background: `var(${clusterColor})` }}
      />
      <span className={styles.body}>
        <span className={styles.time}>{timeLabel(node.updatedAt, now, t)}</span>
        <span className={styles.title}>
          {node.blank ? t('node.newSession') : node.title}
        </span>
        {badge !== ''
          ? (
            <span
              className={styles.badge}
              onMouseEnter={() => { onHoverBadge(key) }}
              onMouseLeave={() => { onHoverBadge(null) }}
            >
              {badge}
            </span>
          )
          : null}
      </span>
    </button>
  )
}

/** Minimap box size in screen px. */
const MINIMAP_W = 180
const MINIMAP_H = 120
/** Minimap inner inset in px. */
const MINIMAP_PAD = 8

/**
 * The bottom-right minimap: a contain-fit projection of the whole canvas
 * (cluster frames, node cards, and the live viewport rectangle). Pointing
 * or dragging on the map recenters the main viewport on the mapped content
 * point.
 * @param props - the laid graph, frames, complete content bounds, viewport,
 *   view size, recenter verb, and translate seat.
 * @returns the minimap element.
 */
function Minimap({
  shown, frames, bounds, viewport, viewSize, onRecenter, t,
}: {
  shown: LaidOutGraph
  frames: readonly LaidOutFrame[]
  bounds: ContentBounds
  viewport: ReturnType<typeof initialViewport>
  viewSize: { width: number; height: number }
  onRecenter: (contentX: number, contentY: number) => void
  t: Translate
}): ReactElement {
  const roomWidth = MINIMAP_W - 2 * MINIMAP_PAD
  const roomHeight = MINIMAP_H - 2 * MINIMAP_PAD
  const projection = minimapProjection(bounds, roomWidth, roomHeight)
  const toMapX = (x: number): number => MINIMAP_PAD + projection.offsetX + x * projection.scale
  const toMapY = (y: number): number => MINIMAP_PAD + projection.offsetY + y * projection.scale
  // The visible content region, in content coordinates.
  const view = {
    x: -viewport.panX / viewport.scale,
    y: -viewport.panY / viewport.scale,
    width: viewSize.width / viewport.scale,
    height: viewSize.height / viewport.scale,
  }
  const recenterFromEvent = (event: React.PointerEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const mapX = event.clientX - rect.left
    const mapY = event.clientY - rect.top
    onRecenter(
      (mapX - MINIMAP_PAD - projection.offsetX) / projection.scale,
      (mapY - MINIMAP_PAD - projection.offsetY) / projection.scale,
    )
  }
  return (
    <svg
      className={styles.minimap}
      width={MINIMAP_W}
      height={MINIMAP_H}
      role="group"
      aria-label={t('canvas.minimap')}
      data-testid="session-graph-minimap"
      onPointerDown={(event) => {
        if (typeof event.currentTarget.setPointerCapture === 'function') {
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        recenterFromEvent(event)
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0) return
        recenterFromEvent(event)
      }}
    >
      {frames.map(frame => (
        <rect
          key={`f-${frame.clusterId}`}
          x={toMapX(frame.x)}
          y={toMapY(frame.y)}
          width={frame.width * projection.scale}
          height={frame.height * projection.scale}
          className={styles.minimapFrame}
        />
      ))}
      {shown.nodes.map(({ key, x, y }) => (
        <rect
          key={`n-${key}`}
          x={toMapX(x)}
          y={toMapY(y)}
          width={NODE_W_MAP}
          height={CARD_H_MAP}
          className={styles.minimapNode}
        />
      ))}
      {view.width * projection.scale < MINIMAP_W - 2 * MINIMAP_PAD - 2
        || view.height * projection.scale < MINIMAP_H - 2 * MINIMAP_PAD - 2
        ? (
          <rect
            x={toMapX(view.x)}
            y={toMapY(view.y)}
            width={view.width * projection.scale}
            height={view.height * projection.scale}
            className={styles.minimapView}
            data-testid="session-graph-minimap-viewport"
          />
        )
        : null}
    </svg>
  )
}

/** Minimap node rect size in px (scaled-down card footprint). */
const NODE_W_MAP = 10
const CARD_H_MAP = 4

/**
 * Render the free-viewport canvas over the laid-out graph.
 * @param laid - the auto-laid-out graph.
 * @param scopeKey - the workspace scope key for position persistence.
 * @param now - current epoch ms for relative-time labels.
 * @param t - the namespace translate seat.
 * @param onOpen - open one session node (navigation verb).
 * @returns the canvas element.
 */
export function GraphCanvas({
  laid, clusters, scopeKey, now, t, onOpen, onBranch,
}: {
  laid: LaidOutGraph
  clusters: readonly ClusterInfo[]
  scopeKey: string
  now: number
  t: Translate
  onOpen: GraphViewInjected['openSession']
  onBranch: GraphViewInjected['branchSession']
}): ReactElement {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(initialViewport)
  // Read per render: every pan/zoom re-renders, keeping the viewport rect in
  // step with the surface (a mid-gesture window resize lags one frame).
  const surfaceRect = surfaceRef.current?.getBoundingClientRect()
  const viewSize = {
    width: surfaceRect?.width ?? 0,
    height: surfaceRect?.height ?? 0,
  }
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  const [positions, setPositions] = useState<Record<string, NodePosition>>({})
  const [collapsed, setCollapsed] = useState<readonly string[]>([])
  const [offsets, setOffsets] = useState<Record<string, ClusterOffset>>({})
  const [restoredScope, setRestoredScope] = useState<string | null>(null)
  const positionsRef = useRef(positions)
  positionsRef.current = positions
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed
  const offsetsRef = useRef(offsets)
  offsetsRef.current = offsets
  const nodeDragRef = useRef<{
    pointerId: number
    key: string
    cluster: string
    grabX: number
    grabY: number
    startX: number
    startY: number
    moved: boolean
    previous: NodePosition | undefined
  } | null>(null)
  const clusterDragRef = useRef<{
    pointerId: number
    clusterId: string
    lastX: number
    lastY: number
    startX: number
    startY: number
    moved: boolean
    previous: ClusterOffset | undefined
  } | null>(null)
  const suppressClickRef = useRef(false)
  const [selected, setSelected] = useState<SessionId | null>(null)
  const [badgeHover, setBadgeHover] = useState<string | null>(null)
  // Alignment guides of the in-flight node drag (content px), null at rest.
  const [guides, setGuides] = useState<{ x: number | null; y: number | null } | null>(null)
  // The last cluster whose title band was grabbed: its frame paints above
  // overlapping frames (bring-to-front, the canvas convention).
  const [raisedCluster, setRaisedCluster] = useState<string | null>(null)
  // The node whose hover dwell elapsed: its detail card is showing.
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const previewTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
  }, [])

  /** Cancel a pending preview and hide the visible one, if any. */
  const hidePreview = (): void => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
    previewTimer.current = null
    setPreviewKey(null)
  }

  /** Node hover enter: emphasize the lineage now, arm the detail card. */
  const nodeEnter = (key: string): void => {
    setHoverNode(key)
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => { setPreviewKey(key) }, PREVIEW_DELAY)
  }

  /** Node hover leave: drop the emphasis and the detail card together. */
  const nodeLeave = (): void => {
    setHoverNode(null)
    hidePreview()
  }
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const [hoverEdge, setHoverEdge] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Set for the duration of one programmatic viewport jump (fit, locate,
  // 100%): the content layer CSS-transitions the transform. Gestures
  // (wheel, drags, minimap) never set it — they must stay immediate.
  const [animating, setAnimating] = useState(false)
  const animationTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
  }, [])

  /** Mark the viewport jump that follows for a smooth CSS transition. */
  const glide = (): void => {
    setAnimating(true)
    if (animationTimer.current !== null) window.clearTimeout(animationTimer.current)
    animationTimer.current = window.setTimeout(() => { setAnimating(false) }, 280)
  }

  // Restore the workspace's manual layout on scope entry; a corrupt or
  // absent record leaves the auto layout in place.
  useEffect(() => {
    const stored = loadLayout(scopeKey)
    setPositions(stored?.positions ?? {})
    setCollapsed(stored?.collapsed ?? [])
    setOffsets(stored?.offsets ?? {})
    setRestoredScope(scopeKey)
  }, [scopeKey])

  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed])
  // Fit once on scope entry so the whole graph is visible (manual layouts
  // fit the manual bounds, the auto grid fits its own).
  const fittedRef = useRef(false)
  useEffect(() => {
    fittedRef.current = false
  }, [scopeKey])

  // Arrow-key navigation: move focus to the geometrically nearest node in
  // the pressed direction, following the layout as it stands.
  const moveFocus = (direction: 'left' | 'right' | 'up' | 'down'): void => {
    const active = document.activeElement?.closest('[data-node-id]') as HTMLElement | null
    const from = active !== null
      ? shown.nodes.find(entry => entry.key === active.dataset.nodeId)
      : shown.nodes.find(entry => entry.node.current) ?? shown.nodes[0]
    if (from === undefined) return
    let best: { key: string; distance: number } | undefined
    for (const entry of shown.nodes) {
      if (entry.key === from.key) continue
      const dx = entry.x - from.x
      const dy = entry.y - from.y
      const aligned = direction === 'left' ? dx < -4
        : direction === 'right' ? dx > 4
          : direction === 'up' ? dy < -4
            : dy > 4
      if (!aligned) continue
      const distance = Math.hypot(dx, dy)
      if (best === undefined || distance < best.distance) best = { key: entry.key, distance }
    }
    if (best === undefined) return
    document.querySelector<HTMLElement>(`[data-node-id="${best.key}"]`)?.focus()
  }
  const shown = useMemo(
    () => applyOffsets(applyCollapse(applyPositions(laid, positions), clusters, collapsedSet), offsets),
    [laid, positions, clusters, collapsedSet, offsets],
  )
  const frames = useMemo(
    () => clusterFrames(shown, clusters, collapsedSet),
    [shown, clusters, collapsedSet],
  )
  const bounds = useMemo(() => contentBounds(shown, frames), [shown, frames])
  const automaticBounds = useMemo(() => {
    const automaticFrames = clusterFrames(laid, clusters)
    return contentBounds(laid, automaticFrames)
  }, [laid, clusters])
  useEffect(() => {
    if (restoredScope !== scopeKey || fittedRef.current) return
    // The conversation shell measures its composer after the first paint.
    // Read the resulting graph surface on the following settled frame.
    let settledFrame: number | undefined
    const layoutFrame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => {
        const rect = surfaceRef.current?.getBoundingClientRect()
        if (rect === undefined) return
        fittedRef.current = true
        setViewport(fitViewport(bounds, rect.width, rect.height, FIT_PADDING))
      })
    })
    return () => {
      window.cancelAnimationFrame(layoutFrame)
      if (settledFrame !== undefined) window.cancelAnimationFrame(settledFrame)
    }
  // bounds must not retrigger the one-shot fit after the scope changed (the
  // fittedRef guard above owns that).
  }, [bounds, scopeKey, restoredScope])
  // One palette slot per cluster, by cluster order — the single source for
  // node dots and frame accents alike.
  const colorOfCluster = useMemo(() => {
    const map = new Map<string, string>()
    clusters.forEach((cluster, index) => {
      map.set(cluster.rootId, CLUSTER_COLORS[index % CLUSTER_COLORS.length] ?? '--dsw-alias-border-l')
    })
    return map
  }, [clusters])
  // The incoming fork edge names each member's branch source.
  const branchSource = useMemo(() => {
    const titleOf = new Map(shown.nodes.map(entry => [entry.key, entry.node.title]))
    const map = new Map<string, string>()
    for (const { edge } of shown.edges) {
      const title = titleOf.get(edge.from)
      if (title !== undefined) map.set(edge.to, title)
    }
    return map
  }, [shown])

  // The title filter's match set (null while the query is blank).
  const filterMatches = useMemo(
    () => matchFilter(shown.nodes.map(entry => entry.node), query),
    [shown, query],
  )

  // Neighborhood emphasis: an active filter wins; otherwise hovering an
  // edge emphasizes its endpoints and hovering a node its branch lineage.
  const emphasis = useMemo((): ReadonlySet<string> | null => {
    if (filterMatches !== null) return filterMatches
    if (hoverEdge !== null) {
      const found = shown.edges.find(entry => entry.edge.id === hoverEdge)
      return found === undefined ? null : new Set([found.edge.from, found.edge.to])
    }
    if (hoverNode === null) return null
    const set = neighborhood(shown.nodes.map(entry => entry.node), hoverNode)
    return set.size === 0 ? null : set
  }, [filterMatches, hoverEdge, hoverNode, shown])
  const dimmed = (key: string): boolean => emphasis !== null && !emphasis.has(key)
  const edgeDimmed = (from: string, to: string): boolean =>
    emphasis !== null && !(emphasis.has(from) && emphasis.has(to))
  const frameDimmed = (clusterId: string): boolean =>
    emphasis !== null
    && !shown.nodes.some(entry => entry.node.clusterId === clusterId && emphasis.has(entry.key))

  /** Persist one layout revision, pruned to the live node and cluster ids. */
  const persist = (
    nextPositions: Record<string, NodePosition>,
    nextCollapsed: readonly string[],
    nextOffsets: Record<string, ClusterOffset>,
  ): void => {
    const knownNodes = new Set(shown.nodes.map(node => node.key))
    const knownClusters = new Set<string>(clusters.map(cluster => cluster.rootId))
    saveLayout(scopeKey, {
      positions: Object.fromEntries(
        Object.entries(nextPositions).filter(([key]) => knownNodes.has(key)),
      ),
      collapsed: nextCollapsed.filter(rootId => knownClusters.has(rootId)),
      offsets: Object.fromEntries(
        Object.entries(nextOffsets).filter(([key]) => knownClusters.has(key)),
      ),
    })
  }

  const toContent = (screenX: number, screenY: number): { x: number; y: number } => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect === undefined) return { x: screenX, y: screenY }
    return {
      x: (screenX - rect.left - viewport.panX) / viewport.scale,
      y: (screenY - rect.top - viewport.panY) / viewport.scale,
    }
  }

  const nodeGestures = (id: SessionId, clusterId: SessionId, originX: number, originY: number): NodeGestureHandlers => ({
    onPointerDown: (event) => {
      hidePreview()
      // A new pointer sequence cannot be the prior drag's trailing click.
      // Clear a suppression token that no browser click consumed.
      suppressClickRef.current = false
      // Collapsed members are pinned to the compact column; they click but
      // never drag.
      if (collapsedSet.has(clusterId)) return
      const point = toContent(event.clientX, event.clientY)
      nodeDragRef.current = {
        pointerId: event.pointerId,
        key: id,
        cluster: clusterId,
        grabX: point.x - originX,
        grabY: point.y - originY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        previous: positionsRef.current[id],
      }
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    },
    onPointerMove: (event) => {
      const drag = nodeDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      if (!drag.moved
        && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) {
        return
      }
      drag.moved = true
      const point = toContent(event.clientX, event.clientY)
      // Snap the raw landing spot to nearby node edges and show the guides.
      const snapped = snapPosition(
        { x: point.x - drag.grabX, y: point.y - drag.grabY },
        shown.nodes.filter(entry => entry.key !== drag.key),
        SNAP_PX / viewport.scale,
      )
      setGuides({ x: snapped.guideX, y: snapped.guideY })
      // The positions record lives in the cluster's local frame: the whole
      //-cluster offset applies on top at render time, so it comes off here.
      const offset = offsetsRef.current[drag.cluster]
      setPositions(current => ({
        ...current,
        [drag.key]: {
          x: snapped.x - (offset?.dx ?? 0),
          y: snapped.y - (offset?.dy ?? 0),
        },
      }))
    },
    onPointerUp: (event) => {
      const drag = nodeDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      nodeDragRef.current = null
      setGuides(null)
      if (!drag.moved) return
      suppressClickRef.current = true
      persist(positionsRef.current, collapsedRef.current, offsetsRef.current)
    },
    onPointerCancel: (event) => {
      const drag = nodeDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      nodeDragRef.current = null
      suppressClickRef.current = false
      setGuides(null)
      setPositions(current => restoreEntry(current, drag.key, drag.previous))
    },
    onClick: () => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      setSelected(id)
    },
    onDoubleClick: () => {
      onOpen(id)
    },
  })

  // Wheel is non-passive so the canvas can swallow the gesture before the
  // page scrolls; React's synthetic listener cannot opt out.
  useEffect(() => {
    const surface = surfaceRef.current
    if (surface === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = surface.getBoundingClientRect()
      setViewport(current => zoomAt(
        current,
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY < 0 ? CONTROL_STEP : 1 / CONTROL_STEP,
      ))
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => { surface.removeEventListener('wheel', onWheel) }
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    // Nodes, cluster title bands, form controls, and the minimap own their
    // own pointer gestures; the background pans and takes focus so the zoom
    // keys keep working. The guard must name every draggable: whoever does
    // not match gets its pointer capture stolen by the surface.
    if ((event.target as HTMLElement).closest('[data-node-id], [data-cluster-title], input, button, select, textarea, svg') !== null) return
    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY }
    event.currentTarget.focus()
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    // Deltas are computed eagerly: the state updater runs after this
    // handler completes, past the lastX/lastY mutation below.
    const dx = event.clientX - drag.lastX
    const dy = event.clientY - drag.lastY
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    setViewport(current => panBy(current, dx, dy))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }, [])

  const zoomFromCenter = (factor: number): void => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    setViewport(current => zoomAt(current, rect.width / 2, rect.height / 2, factor))
  }

  /** Fit one complete content box into the current surface. */
  const fitBounds = (target: ContentBounds): void => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    glide()
    setViewport(fitViewport(target, rect.width, rect.height, FIT_PADDING))
  }

  const fit = (): void => { fitBounds(bounds) }

  /** Re-run the auto layout: manual positions and cluster offsets clear, collapsed clusters keep. */
  const relayout = (): void => {
    setPositions({})
    setOffsets({})
    persist({}, collapsedRef.current, {})
  }

  /** Back to the initial state: manual layout and collapse cleared, then fit. */
  const reset = (): void => {
    setPositions({})
    setCollapsed([])
    setOffsets({})
    saveLayout(scopeKey, { positions: {}, collapsed: [], offsets: {} })
    fitBounds(automaticBounds)
  }

  /** Center the viewport on one content point (the minimap verb). */
  const recenter = (contentX: number, contentY: number): void => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    setViewport(current => ({
      ...current,
      panX: rect.width / 2 - contentX * current.scale,
      panY: rect.height / 2 - contentY * current.scale,
    }))
  }

  /** Center the viewport on one node's card (filter Enter, locate button). */
  const locateNode = (key: string): void => {
    const found = shown.nodes.find(entry => entry.key === key)
    if (found === undefined) return
    glide()
    recenter(found.x + NODE_W / 2, found.y + CARD_H / 2)
  }

  /** The selected node's summary panel actions. */
  const selectedNode = selected !== null
    ? shown.nodes.find(entry => entry.node.id === selected)?.node
    : undefined

  const toggleCluster = (rootId: string): void => {
    const next = collapsedSet.has(rootId)
      ? collapsed.filter(entry => entry !== rootId)
      : [...collapsed, rootId]
    setCollapsed(next)
    persist(positionsRef.current, next, offsetsRef.current)
  }

  /** Frame title-band gestures: drag the whole cluster by its title band. */
  const clusterGestures = (clusterId: string): {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
  } => ({
    onPointerDown: (event) => {
      // The collapse toggle owns its own click; it never starts a drag.
      if ((event.target as HTMLElement).closest('button') !== null) return
      setRaisedCluster(clusterId)
      clusterDragRef.current = {
        pointerId: event.pointerId,
        clusterId,
        lastX: event.clientX,
        lastY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        previous: offsetsRef.current[clusterId],
      }
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    },
    onPointerMove: (event) => {
      const drag = clusterDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      if (!drag.moved
        && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) {
        return
      }
      drag.moved = true
      // Deltas eagerly before setState, then the ref catches up (same
      // updater-ordering rule as the background pan).
      const dx = (event.clientX - drag.lastX) / viewport.scale
      const dy = (event.clientY - drag.lastY) / viewport.scale
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      setOffsets((current) => {
        const base = current[drag.clusterId] ?? { dx: 0, dy: 0 }
        return {
          ...current,
          [drag.clusterId]: { dx: base.dx + dx, dy: base.dy + dy },
        }
      })
    },
    onPointerUp: (event) => {
      const drag = clusterDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      clusterDragRef.current = null
      if (!drag.moved) return
      persist(positionsRef.current, collapsedRef.current, offsetsRef.current)
    },
    onPointerCancel: (event) => {
      const drag = clusterDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      clusterDragRef.current = null
      setOffsets(current => restoreEntry(current, drag.clusterId, drag.previous))
    },
  })

  /** Back to exactly 100%, animated (the readout button and the 0 key). */
  const zoomToIdentity = (): void => {
    glide()
    zoomFromCenter(1 / viewport.scale)
  }

  return (
    <div
      ref={surfaceRef}
      className={styles.viewport}
      role="group"
      aria-label={t('canvas.description')}
      tabIndex={-1}
      style={{
        backgroundImage: 'radial-gradient(var(--dsw-alias-border-l) 1px, transparent 1px)',
        backgroundSize: `${GRID * viewport.scale}px ${GRID * viewport.scale}px`,
        backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        // Text fields own their keys (typing, caret moves, Escape).
        if ((event.target as HTMLElement).closest('input, textarea, select') !== null) return
        const direction = event.key === 'ArrowLeft' ? 'left'
          : event.key === 'ArrowRight' ? 'right'
            : event.key === 'ArrowUp' ? 'up'
              : event.key === 'ArrowDown' ? 'down'
                : undefined
        if (direction !== undefined) {
          event.preventDefault()
          moveFocus(direction)
          return
        }
        // Canvas-app zoom family: +/− step, 0 back to 100%, 1 fit.
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          zoomFromCenter(CONTROL_STEP)
          return
        }
        if (event.key === '-' || event.key === '_') {
          event.preventDefault()
          zoomFromCenter(1 / CONTROL_STEP)
          return
        }
        if (event.key === '0') {
          event.preventDefault()
          zoomToIdentity()
          return
        }
        if (event.key === '1') {
          event.preventDefault()
          fit()
        }
      }}
    >
      <div
        className={clsx(
          styles.content,
          viewport.scale < LOD_SCALE ? styles.lowZoom : null,
          animating ? styles.animated : null,
        )}
        style={{
          width: `${shown.width}px`,
          height: `${shown.height}px`,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`,
        }}
      >
        {frames.map(frame => (
          <div
            key={frame.clusterId}
            className={clsx(
              styles.frame,
              frameDimmed(frame.clusterId) ? styles.dim : null,
              raisedCluster === frame.clusterId ? styles.frameRaised : null,
            )}
            data-cluster-id={frame.clusterId}
            style={{
              left: `${frame.x}px`,
              top: `${frame.y}px`,
              width: `${frame.width}px`,
              height: `${frame.height}px`,
            }}
          >
            <div
              className={styles.frameTitle}
              data-cluster-title={frame.clusterId}
              {...clusterGestures(frame.clusterId)}
            >
              <button
                type="button"
                className={styles.frameToggle}
                aria-expanded={!frame.collapsed}
                aria-label={t(frame.collapsed ? 'cluster.expand' : 'cluster.collapse')}
                onClick={() => { toggleCluster(frame.clusterId) }}
              >
                {frame.collapsed ? '▸' : '▾'}
              </button>
              <span
                className={styles.frameSwatch}
                style={{ background: `var(${CLUSTER_COLORS[frame.colorIndex]})` }}
              />
              <span className={styles.frameLabel}>{frame.label}</span>
            </div>
          </div>
        ))}
        <svg
          className={styles.edges}
          width={shown.width}
          height={shown.height}
          viewBox={`${shown.x} ${shown.y} ${shown.width} ${shown.height}`}
          style={{ left: `${shown.x}px`, top: `${shown.y}px` }}
          aria-hidden="true"
        >
          {shown.edges.map(({ edge, path }) => {
            const to = shown.nodes.find(entry => entry.key === edge.to)
            if (to === undefined) return null
            const cx = to.x + NODE_W / 2
            return (
              <g
                key={edge.id}
                className={clsx(
                  styles.edgeGroup,
                  edgeDimmed(edge.from, edge.to) ? styles.dim : null,
                  hoverEdge === edge.id ? styles.edgeHot : null,
                )}
              >
                <path
                  className={styles.edgeHit}
                  d={path}
                  data-edge-id={edge.id}
                  onMouseEnter={() => { setHoverEdge(edge.id) }}
                  onMouseLeave={() => { setHoverEdge(null) }}
                />
                <path className={styles.edgeFork} strokeDasharray="8 5" d={path} />
                <path
                  className={styles.edgeForkArrow}
                  d={`M ${cx - 6} ${to.y - 9} L ${cx} ${to.y} L ${cx + 6} ${to.y - 9} Z`}
                />
              </g>
            )
          })}
          {badgeHover !== null ? (() => {
            const hovered = shown.nodes.find(entry => entry.key === badgeHover)
            if (hovered === undefined) return null
            const cx = hovered.x + NODE_W / 2
            return (
              <line
                className={styles.edgeDerivation}
                x1={cx} y1={hovered.y + CARD_H}
                x2={cx} y2={hovered.y + CARD_H + 24}
              />
            )
          })() : null}
        </svg>
        {guides?.x != null
          ? (
            <div
              className={styles.guideX}
              style={{ left: `${guides.x}px` }}
              data-testid="session-graph-guide-x"
            />
          )
          : null}
        {guides?.y != null
          ? (
            <div
              className={styles.guideY}
              style={{ top: `${guides.y}px` }}
              data-testid="session-graph-guide-y"
            />
          )
          : null}
        {shown.nodes.map(laidNode => (
          <NodeCard
            key={laidNode.key}
            laid={laidNode}
            now={now}
            t={t}
            gestures={nodeGestures(laidNode.node.id, laidNode.node.clusterId, laidNode.x, laidNode.y)}
            selected={selected === laidNode.node.id}
            onHoverBadge={setBadgeHover}
            badgeHovered={badgeHover === laidNode.key}
            dimmed={dimmed(laidNode.key)}
            onHoverNode={(key) => {
              if (key === null) nodeLeave()
              else nodeEnter(key)
            }}
            clusterColor={colorOfCluster.get(laidNode.node.clusterId)
              ?? (laidNode.node.clusterId === laidNode.node.id ? '--dsw-alias-label-dimmed' : '--dsw-alias-border-l')}
          />
        ))}
      </div>
      <div className={styles.filterBox}>
        <input
          className={styles.filterInput}
          value={query}
          placeholder={t('filter.placeholder')}
          aria-label={t('filter.placeholder')}
          aria-describedby={filterMatches === null ? undefined : 'session-graph-filter-status'}
          onChange={(event) => { setQuery(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filterMatches !== null) {
              const first = shown.nodes.find(entry => filterMatches.has(entry.key))
              if (first !== undefined) locateNode(first.key)
            }
            if (event.key === 'Escape') {
              setQuery('')
              event.currentTarget.blur()
            }
          }}
        />
        {query !== ''
          ? (
            <button type="button" aria-label={t('filter.clear')} onClick={() => { setQuery('') }}>
              ×
            </button>
          )
          : null}
        {filterMatches !== null
          ? (
            <span
              id="session-graph-filter-status"
              className={styles.filterStatus}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {filterMatches.size === 0
                ? t('filter.none')
                : t('filter.matches', { count: filterMatches.size })}
            </span>
          )
          : null}
      </div>
      <div className={styles.controls} role="group" aria-label={t('canvas.description')}>
        <button type="button" aria-label={t('toolbar.zoomOut')} onClick={() => { zoomFromCenter(1 / CONTROL_STEP) }}>−</button>
        <button type="button" aria-label={t('toolbar.zoomLevel')} onClick={zoomToIdentity}>
          {`${Math.round(viewport.scale * 100)}%`}
        </button>
        <button type="button" aria-label={t('toolbar.zoomIn')} onClick={() => { zoomFromCenter(CONTROL_STEP) }}>+</button>
        <button type="button" aria-label={t('toolbar.fit')} onClick={fit}>{t('toolbar.fit')}</button>
        <button type="button" aria-label={t('toolbar.relayout')} onClick={relayout}>{t('toolbar.relayout')}</button>
        <button type="button" aria-label={t('toolbar.reset')} onClick={reset}>{t('toolbar.reset')}</button>
        <button
          type="button"
          aria-label={t('toolbar.locate')}
          onClick={() => {
            const current = shown.nodes.find(entry => entry.node.current)
            if (current !== undefined) locateNode(current.key)
          }}
        >
          {t('toolbar.locate')}
        </button>
      </div>
      {selectedNode !== undefined
        ? (
          <div className={styles.panel} role="complementary" data-testid="session-graph-panel">
            <div className={styles.panelTitle}>{selectedNode.blank ? t('node.newSession') : selectedNode.title}</div>
            <div className={styles.panelMeta}>
              {timeLabel(selectedNode.updatedAt, now, t)}
              {selectedNode.subagentCount > 0
                ? ` · ${t('panel.subagents', { count: selectedNode.subagentCount })}`
                : ''}
            </div>
            <div className={styles.panelActions}>
              <button type="button" onClick={() => { onOpen(selectedNode.id) }}>{t('panel.open')}</button>
              <button type="button" onClick={() => { onBranch(selectedNode.id) }}>{t('panel.branch')}</button>
            </div>
          </div>
        )
        : null}
      <Minimap
        shown={shown}
        frames={frames}
        bounds={bounds}
        viewport={viewport}
        viewSize={viewSize}
        onRecenter={recenter}
        t={t}
      />
      {(() => {
        // The hover detail card lives in screen space, glued to its node's
        // right edge (flipping left when that would overflow the surface).
        if (previewKey === null) return null
        const entry = shown.nodes.find(item => item.key === previewKey)
        if (entry === undefined) return null
        let px = viewport.panX + (entry.x + NODE_W) * viewport.scale + 8
        const py = viewport.panY + entry.y * viewport.scale
        if (viewSize.width > 0 && px + PREVIEW_W > viewSize.width) {
          px = viewport.panX + entry.x * viewport.scale - PREVIEW_W - 8
        }
        const status = entry.node.running ? t('preview.status.running')
          : entry.node.pending ? t('preview.status.pending')
            : entry.node.completed ? t('preview.status.completed') : ''
        const branched = branchSource.get(entry.key)
        return (
          <div
            className={styles.preview}
            style={{ left: `${px}px`, top: `${py}px` }}
            data-testid="session-graph-preview"
            aria-hidden="true"
          >
            <div className={styles.previewTitle}>
              {entry.node.blank ? t('node.newSession') : entry.node.title}
            </div>
            {status !== '' ? <div className={styles.previewStatus}>{status}</div> : null}
            <div className={styles.previewMeta}>
              {timeLabel(entry.node.updatedAt, now, t)}
              {entry.node.subagentCount > 0
                ? ` · ${t('panel.subagents', { count: entry.node.subagentCount })}`
                : ''}
            </div>
            {branched !== undefined
              ? <div className={styles.previewMeta}>{t('node.branchedFrom', { name: branched })}</div>
              : null}
            <div className={styles.previewHint}>{t('preview.hint')}</div>
          </div>
        )
      })()}
    </div>
  )
}
