/** Fixed-position orthogonal routing, shared by both canvas scopes after arrangement. */
import { CARD_H, NODE_W, nodeBounds } from './layout.ts'
import type { ContentBounds, LaidOutEdge, LaidOutGraph, LaidOutNode } from './layout.ts'
import { FRAME_TITLE_H } from './clusters.ts'
import type { LaidOutFrame } from './clusters.ts'

interface Point { readonly x: number; readonly y: number }
type Side = 'top' | 'bottom' | 'left' | 'right'
export interface ConnectionPort extends Point {
  readonly id: string
  readonly direction: 'input' | 'output'
}
export interface RoutedEdge extends LaidOutEdge {
  readonly points: readonly Point[]
  readonly arrowPath: string
  readonly label: { readonly text: string; readonly x: number; readonly y: number } | undefined
}
export interface RoutedGraph extends LaidOutGraph {
  readonly edges: readonly RoutedEdge[]
  readonly ports: ReadonlyMap<string, readonly ConnectionPort[]>
}
interface Box extends ContentBounds { readonly id: string }
interface Endpoint { readonly node: LaidOutNode; readonly other: LaidOutNode; side: Side; port: Point; escape: Point }
interface Route { readonly laid: LaidOutEdge; readonly from: Endpoint; readonly to: Endpoint }
const CLEARANCE = 6
const STUB = 12
const LANE = 10
const EPSILON = 0.01
const distance = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** Sparse bins keep ordinary short edges independent of the total graph size. */
class ObstacleIndex {
  private readonly bins = new Map<string, Box[]>()
  private readonly boxes: Box[] = []
  private readonly oversized: Box[] = []
  private cellCount(box: ContentBounds): number {
    return (Math.floor((box.x + box.width) / 256) - Math.floor(box.x / 256) + 1)
      * (Math.floor((box.y + box.height) / 256) - Math.floor(box.y / 256) + 1)
  }
  add(box: Box): void {
    this.boxes.push(box)
    // A dragged member can make its frame span a very large empty area.
    // Index real obstacles, never allocate bins proportional to that distance.
    if (this.cellCount(box) > 4096) {
      this.oversized.push(box)
      return
    }
    for (const key of this.keys(box)) {
      const bin = this.bins.get(key) ?? []
      bin.push(box)
      this.bins.set(key, bin)
    }
  }
  private *keys(box: ContentBounds): Generator<string> {
    for (let x = Math.floor(box.x / 256); x <= Math.floor((box.x + box.width) / 256); x += 1) {
      for (let y = Math.floor(box.y / 256); y <= Math.floor((box.y + box.height) / 256); y += 1) yield `${x}:${y}`
    }
  }
  query(box: ContentBounds): Box[] {
    const overlaps = (obstacle: Box): boolean => obstacle.x < box.x + box.width + EPSILON && obstacle.x + obstacle.width > box.x - EPSILON
      && obstacle.y < box.y + box.height + EPSILON && obstacle.y + obstacle.height > box.y - EPSILON
    if (this.cellCount(box) > this.bins.size) return this.boxes.filter(overlaps)
    const result = new Set(this.oversized.filter(overlaps))
    for (const key of this.keys(box)) {
      for (const obstacle of this.bins.get(key) ?? []) if (overlaps(obstacle)) result.add(obstacle)
    }
    return [...result]
  }
  clear(a: Point, b: Point, ignore?: string): boolean {
    const area = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
    return !this.query(area).some(box => box.id !== ignore && intersects(a, b, box))
  }
}

function intersects(a: Point, b: Point, box: ContentBounds): boolean {
  if (a.x === b.x) return a.x > box.x + EPSILON && a.x < box.x + box.width - EPSILON
    && Math.max(a.y, b.y) > box.y + EPSILON && Math.min(a.y, b.y) < box.y + box.height - EPSILON
  return a.y > box.y + EPSILON && a.y < box.y + box.height - EPSILON
    && Math.max(a.x, b.x) > box.x + EPSILON && Math.min(a.x, b.x) < box.x + box.width - EPSILON
}

/** Charge for shared line segments, so distinct relations do not masquerade as a single edge. */
class Channels {
  private readonly segments = new Map<string, [number, number][]>()
  private key(a: Point, b: Point): string { return a.x === b.x ? `x:${a.x.toFixed(2)}` : `y:${a.y.toFixed(2)}` }
  penalty(a: Point, b: Point): number {
    const [low, high] = a.x === b.x ? [Math.min(a.y, b.y), Math.max(a.y, b.y)] : [Math.min(a.x, b.x), Math.max(a.x, b.x)]
    return (this.segments.get(this.key(a, b)) ?? []).reduce((sum, [start, end]) => sum + Math.max(0, Math.min(high, end) - Math.max(low, start)) * 24, 0)
  }
  reserve(points: readonly Point[]): void {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]!, b = points[i]!
      const key = this.key(a, b)
      const list = this.segments.get(key) ?? []
      list.push(a.x === b.x ? [Math.min(a.y, b.y), Math.max(a.y, b.y)] : [Math.min(a.x, b.x), Math.max(a.x, b.x)])
      this.segments.set(key, list)
    }
  }
}

function portAt(node: LaidOutNode, side: Side, fraction: number): Point {
  if (side === 'top' || side === 'bottom') return { x: node.x + 20 + (NODE_W - 40) * fraction, y: node.y + (side === 'bottom' ? CARD_H : 0) }
  return { x: node.x + (side === 'right' ? NODE_W : 0), y: node.y + 8 + (CARD_H - 16) * fraction }
}
function escapeAt(port: Point, side: Side): Point {
  return { x: port.x + (side === 'left' ? -STUB : side === 'right' ? STUB : 0),
    y: port.y + (side === 'top' ? -STUB : side === 'bottom' ? STUB : 0) }
}
function endpoint(node: LaidOutNode, other: LaidOutNode, side: Side, obstacles: ObstacleIndex): Endpoint {
  const choices: Side[] = [side, 'right', 'left', 'bottom', 'top']
  const chosen = choices.find(candidate => obstacles.clear(portAt(node, candidate, 0.5), escapeAt(portAt(node, candidate, 0.5), candidate), node.key)) ?? side
  const port = portAt(node, chosen, 0.5)
  return { node, other, side: chosen, port, escape: escapeAt(port, chosen) }
}
function simplify(points: readonly Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    if (result.length && distance(result.at(-1)!, point) < EPSILON) continue
    const a = result.at(-2), b = result.at(-1)
    if (a && b && ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))
      && distance(a, point) >= distance(a, b)) result.pop()
    result.push(point)
  }
  return result
}
function roundedPath(points: readonly Point[]): string {
  let path = `M ${points[0]!.x} ${points[0]!.y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!
    const radius = Math.min(4, distance(a, b) / 2, distance(b, c) / 2)
    const before = { x: b.x + Math.sign(a.x - b.x) * radius, y: b.y + Math.sign(a.y - b.y) * radius }
    const after = { x: b.x + Math.sign(c.x - b.x) * radius, y: b.y + Math.sign(c.y - b.y) * radius }
    path += ` L ${before.x} ${before.y} Q ${b.x} ${b.y} ${after.x} ${after.y}`
  }
  return `${path} L ${points.at(-1)!.x} ${points.at(-1)!.y}`
}

interface SearchEntry { readonly state: number; readonly cost: number; readonly priority: number }
class SearchQueue {
  private readonly heap: SearchEntry[] = []
  push(entry: SearchEntry): void {
    let index = this.heap.length
    this.heap.push(entry)
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (this.heap[parent]!.priority <= entry.priority) break
      this.heap[index] = this.heap[parent]!
      index = parent
    }
    this.heap[index] = entry
  }
  pop(): SearchEntry | undefined {
    const first = this.heap[0], last = this.heap.pop()
    if (!this.heap.length || !last) return first
    let index = 0
    while (index * 2 + 1 < this.heap.length) {
      let child = index * 2 + 1
      if (child + 1 < this.heap.length && this.heap[child + 1]!.priority < this.heap[child]!.priority) child += 1
      if (this.heap[child]!.priority >= last.priority) break
      this.heap[index] = this.heap[child]!
      index = child
    }
    this.heap[index] = last
    return first
  }
}

/** Search a rectilinear visibility grid only when the usual short channels are blocked. */
function searchRoute(start: Point, end: Point, obstacles: ObstacleIndex, channels: Channels, area: ContentBounds): Point[] | undefined {
  const nearby = obstacles.query(area)
  const xs = [...new Set([start.x, end.x, area.x, area.x + area.width, ...nearby.flatMap(box => [box.x - LANE, box.x, box.x + box.width, box.x + box.width + LANE])])].sort((a, b) => a - b)
  const ys = [...new Set([start.y, end.y, area.y, area.y + area.height, ...nearby.flatMap(box => [box.y - LANE, box.y, box.y + box.height, box.y + box.height + LANE])])].sort((a, b) => a - b)
  const width = xs.length
  const startIndex = ys.indexOf(start.y) * width + xs.indexOf(start.x)
  const endIndex = ys.indexOf(end.y) * width + xs.indexOf(end.x)
  const best = new Map<number, number>()
  const previous = new Map<number, number>()
  const queue = new SearchQueue()
  for (const direction of [0, 1]) {
    best.set(startIndex * 2 + direction, 0)
    queue.push({ state: startIndex * 2 + direction, cost: 0, priority: distance(start, end) })
  }
  let current = queue.pop()
  // A bounded search prevents malformed overlapping arrangements from locking
  // pointer movement. The caller retries with the complete content envelope.
  let visited = 0
  while (current && visited < 30000) {
    if (current.cost !== best.get(current.state)) {
      current = queue.pop()
      continue
    }
    visited += 1
    const index = Math.floor(current.state / 2), direction = current.state % 2
    const x = index % width, y = Math.floor(index / width)
    const point = { x: xs[x]!, y: ys[y]! }
    if (index === endIndex) {
      const path: Point[] = []
      let state: number | undefined = current.state
      while (state !== undefined) {
        const cursor = Math.floor(state / 2)
        path.push({ x: xs[cursor % width]!, y: ys[Math.floor(cursor / width)]! })
        state = previous.get(state)
      }
      return simplify(path.reverse())
    }
    const neighbors = [[x - 1, y, 0], [x + 1, y, 0], [x, y - 1, 1], [x, y + 1, 1]] as const
    for (const [nx, ny, nextDirection] of neighbors) {
      if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length) continue
      const next = { x: xs[nx]!, y: ys[ny]! }
      if (!obstacles.clear(point, next)) continue
      const cost = current.cost + distance(point, next) + channels.penalty(point, next) + (direction === nextDirection ? 0 : 16)
      const state = (ny * width + nx) * 2 + nextDirection
      if (cost >= (best.get(state) ?? Infinity)) continue
      best.set(state, cost)
      previous.set(state, current.state)
      queue.push({ state, cost, priority: cost + distance(next, end) })
    }
    current = queue.pop()
  }
  return undefined
}

function routeBetween(start: Point, end: Point, obstacles: ObstacleIndex, channels: Channels, bounds: ContentBounds): Point[] {
  if ((start.x === end.x || start.y === end.y) && obstacles.clear(start, end) && channels.penalty(start, end) === 0) return [start, end]
  const candidates: Point[][] = []
  const middle = (start.y + end.y) / 2
  for (const delta of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
    const y = middle + delta * LANE
    candidates.push([start, { x: start.x, y }, { x: end.x, y }, end])
  }
  for (const x of [start.x, end.x, Math.min(start.x, end.x) - NODE_W / 2 - 2 * LANE,
    Math.max(start.x, end.x) + NODE_W / 2 + 2 * LANE]) {
    for (const delta of [0, -LANE, LANE]) {
      const lane = x + delta
      candidates.push([start, { x: lane, y: start.y }, { x: lane, y: end.y }, end])
      // Separate the final horizontal approach as well as the outer vertical
      // lane; otherwise several fan-in edges still share the target's stub row.
      for (const step of [-1, 1, -2, 2, -3, 3, -4, 4]) {
        const y = end.y + step * LANE
        candidates.push([start, { x: lane, y: start.y }, { x: lane, y }, { x: end.x, y }, end])
      }
    }
  }
  let best: Point[] | undefined
  let bestCost = Infinity
  for (const candidate of candidates) {
    let cost = 0
    for (let i = 1; i < candidate.length; i += 1) {
      const a = candidate[i - 1]!, b = candidate[i]!
      if (!obstacles.clear(a, b)) {
        cost = Infinity
        break
      }
      cost += distance(a, b) + channels.penalty(a, b)
    }
    if (cost < bestCost) {
      best = candidate
      bestCost = cost
    }
  }
  if (best) return simplify(best)
  const area = { x: Math.min(start.x, end.x) - NODE_W, y: Math.min(start.y, end.y) - 120,
    width: Math.abs(start.x - end.x) + 2 * NODE_W, height: Math.abs(start.y - end.y) + 240 }
  const local = searchRoute(start, end, obstacles, channels, area)
  if (local) return local
  const full = { x: Math.min(bounds.x, area.x) - 40, y: Math.min(bounds.y, area.y) - 40,
    width: Math.max(bounds.x + bounds.width, area.x + area.width) - Math.min(bounds.x, area.x) + 80,
    height: Math.max(bounds.y + bounds.height, area.y + area.height) - Math.min(bounds.y, area.y) + 80 }
  // If cards physically overlap there may be no free terminal. Preserve the
  // relationship rather than dropping it; Relayout restores routable spacing.
  return searchRoute(start, end, obstacles, channels, full) ?? candidates[0]!
}

/** Route all relations after final positions; paths, terminals, arrows, labels and bounds agree. */
export function routeGraph(laid: LaidOutGraph, frames: readonly LaidOutFrame[], labels: ReadonlyMap<string, string> = new Map()): RoutedGraph {
  const obstacles = new ObstacleIndex()
  for (const node of laid.nodes) obstacles.add({ id: node.key, x: node.x - CLEARANCE, y: node.y - CLEARANCE,
    width: NODE_W + 2 * CLEARANCE, height: CARD_H + 2 * CLEARANCE })
  for (const frame of frames) obstacles.add({ id: `header:${frame.clusterId}`, x: frame.x - 4, y: frame.y - 4, width: frame.width + 8, height: FRAME_TITLE_H + 8 })
  const byKey = new Map(laid.nodes.map(node => [node.key, node]))
  const groups = new Map<string, { readonly endpoint: Endpoint; readonly edgeId: string; readonly direction: 'input' | 'output' }[]>()
  const routes: Route[] = []
  for (const edge of laid.edges) {
    const from = byKey.get(edge.edge.from), to = byKey.get(edge.edge.to)
    if (!from || !to) throw new Error(`session-graph routing: edge "${edge.edge.id}" endpoint not laid out`)
    const downward = to.y >= from.y + CARD_H + 2 * STUB
    const sideways = Math.abs(from.x - to.x) >= NODE_W
    const fromSide = downward ? 'bottom' : sideways && to.x < from.x ? 'left' : 'right'
    const toSide = downward ? 'top' : sideways && to.x > from.x ? 'left' : 'right'
    const route = { laid: edge, from: endpoint(from, to, fromSide, obstacles), to: endpoint(to, from, toSide, obstacles) }
    routes.push(route)
    for (const [value, direction] of [[route.from, 'output'], [route.to, 'input']] as const) {
      const key = `${value.node.key}:${value.side}`
      const group = groups.get(key) ?? []
      group.push({ endpoint: value, edgeId: edge.edge.id, direction })
      groups.set(key, group)
    }
  }
  const ports = new Map<string, ConnectionPort[]>()
  for (const group of groups.values()) {
    group.sort((a, b) => (a.endpoint.side === 'top' || a.endpoint.side === 'bottom'
      ? a.endpoint.other.x - b.endpoint.other.x : a.endpoint.other.y - b.endpoint.other.y) || a.edgeId.localeCompare(b.edgeId))
    group.forEach(({ endpoint: value, edgeId, direction }, index) => {
      value.port = portAt(value.node, value.side, (index + 1) / (group.length + 1))
      value.escape = escapeAt(value.port, value.side)
      const list = ports.get(value.node.key) ?? []
      list.push({ ...value.port, id: `${edgeId}:${direction}`, direction })
      ports.set(value.node.key, list)
    })
  }
  for (const node of laid.nodes) {
    const list = ports.get(node.key) ?? []
    for (const direction of ['input', 'output'] as const) {
      if (!list.some(port => port.direction === direction)) list.push({ id: direction, direction,
        x: node.x + NODE_W / 2, y: node.y + (direction === 'input' ? 0 : CARD_H) })
    }
    ports.set(node.key, list)
  }
  const channels = new Channels()
  const routed = new Map<string, RoutedEdge>()
  // Short connections reserve their channels first; long edges go around them.
  routes.sort((a, b) => distance(a.from.port, a.to.port) - distance(b.from.port, b.to.port) || a.laid.edge.id.localeCompare(b.laid.edge.id))
  let left = laid.x, top = laid.y, right = laid.x + laid.width, bottom = laid.y + laid.height
  const include = (box: ContentBounds): void => {
    left = Math.min(left, box.x)
    top = Math.min(top, box.y)
    right = Math.max(right, box.x + box.width)
    bottom = Math.max(bottom, box.y + box.height)
  }
  for (const route of routes) {
    const { from, to } = route
    const middle = routeBetween(from.escape, to.escape, obstacles, channels, laid)
    const points = simplify([from.port, from.escape, ...middle, to.escape, to.port])
    channels.reserve(points)
    const dx = Math.sign(to.port.x - to.escape.x), dy = Math.sign(to.port.y - to.escape.y)
    const rear = { x: to.port.x - dx * 9, y: to.port.y - dy * 9 }
    const arrowPath = `M ${rear.x - dy * 4} ${rear.y + dx * 4} L ${to.port.x} ${to.port.y} L ${rear.x + dy * 4} ${rear.y - dx * 4} Z`
    for (const point of points) include({ x: point.x - 6, y: point.y - 6, width: 12, height: 12 })
    routed.set(route.laid.edge.id, { edge: route.laid.edge, points, path: roundedPath(points), arrowPath, label: undefined })
  }
  for (const [id, text] of labels) {
    const edge = routed.get(id)
    if (!edge) continue
    const width = [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 11 : 6.5), 12)
    const height = 20
    const candidates: Point[] = []
    for (let i = edge.points.length - 1; i > 0; i -= 1) {
      const a = edge.points[i - 1]!, b = edge.points[i]!
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      candidates.push({ x: center.x + (a.x === b.x ? width / 2 + 10 : 0), y: center.y - 14 })
      candidates.push({ x: center.x - (a.x === b.x ? width / 2 + 10 : 0), y: center.y + 14 })
    }
    const free = (point: Point): boolean => {
      const box = { x: point.x - width / 2, y: point.y - height / 2, width, height }
      if (obstacles.query(box).length) return false
      for (const other of routed.values()) {
        for (let i = 1; i < other.points.length; i += 1) if (intersects(other.points[i - 1]!, other.points[i]!, box)) return false
      }
      return true
    }
    const point = candidates.find(free) ?? { x: right + width / 2 + 12, y: edge.points.at(-1)!.y - 16 }
    const box = { x: point.x - width / 2, y: point.y - height / 2, width, height }
    obstacles.add({ id: `label:${id}`, ...box })
    include(box)
    routed.set(id, { ...edge, label: { text, x: point.x, y: point.y } })
  }
  return { nodes: laid.nodes, edges: laid.edges.map(edge => routed.get(edge.edge.id)!), ports,
    ...(laid.edges.length ? { x: left, y: top, width: right - left, height: bottom - top } : nodeBounds(laid.nodes)) }
}
