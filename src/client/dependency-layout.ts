/** Dependency rows for intact Branch frames, with disconnected components packed separately. */

interface Frame {
  readonly id: string
  readonly width: number
  readonly height: number
}
interface Position { readonly x: number; readonly y: number }
/** Clear distance between neighboring dependency frames or component rows. */
export const CLUSTER_GAP = 72
const PACK_WIDTH = 1200

/**
 * Keep connected sources on one rank; only disconnected components may wrap.
 * Cycles get a stable internal order, leaving their return edges for the router.
 * Traversals are iterative so long research chains do not exhaust the stack.
 */
export function placeDependencyFrames(
  frames: readonly Frame[],
  links: readonly { readonly from: string; readonly to: string }[],
): ReadonlyMap<string, Position> {
  const byId = new Map(frames.map(frame => [frame.id, frame]))
  const outgoing = new Map(frames.map(frame => [frame.id, new Set<string>()]))
  const incoming = new Map(frames.map(frame => [frame.id, new Set<string>()]))
  for (const { from, to } of links) {
    if (from === to || !byId.has(from) || !byId.has(to)) continue
    outgoing.get(from)!.add(to)
    incoming.get(to)!.add(from)
  }
  const order = new Map(frames.map((frame, index) => [frame.id, index]))
  const seen = new Set<string>()
  const finished: string[] = []
  for (const frame of frames) {
    if (seen.has(frame.id)) continue
    seen.add(frame.id)
    const stack = [{ id: frame.id, children: outgoing.get(frame.id)!.values() }]
    while (stack.length) {
      const top = stack.at(-1)!
      const next = top.children.next()
      if (next.done) {
        finished.push(top.id)
        stack.pop()
      } else if (!seen.has(next.value)) {
        seen.add(next.value)
        stack.push({ id: next.value, children: outgoing.get(next.value)!.values() })
      }
    }
  }
  const groupOf = new Map<string, number>()
  const groups: string[][] = []
  for (const id of finished.reverse()) {
    if (groupOf.has(id)) continue
    const group: string[] = []
    const stack = [id]
    groupOf.set(id, groups.length)
    while (stack.length) {
      const key = stack.pop()!
      group.push(key)
      for (const parent of incoming.get(key)!) {
        if (groupOf.has(parent)) continue
        groupOf.set(parent, groups.length)
        stack.push(parent)
      }
    }
    group.sort((a, b) => order.get(a)! - order.get(b)!)
    groups.push(group)
  }
  const successors = groups.map(() => new Set<number>())
  const pending = groups.map(() => 0)
  for (const [from, targets] of outgoing) {
    const source = groupOf.get(from)!
    for (const target of targets) {
      const destination = groupOf.get(target)!
      if (source === destination || successors[source]!.has(destination)) continue
      successors[source]!.add(destination)
      pending[destination]! += 1
    }
  }
  const depths = groups.map(() => 0)
  const queue = groups.flatMap((_, index) => pending[index] === 0 ? [index] : [])
  for (let index = 0; index < queue.length; index += 1) {
    const group = queue[index]!
    for (const target of successors[group]!) {
      depths[target] = Math.max(depths[target]!, depths[group]! + groups[group]!.length)
      pending[target]! -= 1
      if (pending[target] === 0) queue.push(target)
    }
  }
  const ranks = new Map<string, number>()
  groups.forEach((group, index) => group.forEach((id, offset) => ranks.set(id, depths[index]! + offset)))

  seen.clear()
  const components: { positions: Map<string, Position>; width: number; height: number }[] = []
  for (const frame of frames) {
    if (seen.has(frame.id)) continue
    const members = [frame.id]
    seen.add(frame.id)
    for (let index = 0; index < members.length; index += 1) {
      const id = members[index]!
      for (const neighbor of [...incoming.get(id)!, ...outgoing.get(id)!]) {
        if (seen.has(neighbor)) continue
        seen.add(neighbor)
        members.push(neighbor)
      }
    }
    members.sort((a, b) => order.get(a)! - order.get(b)!)
    const layers = new Map<number, string[]>()
    for (const id of members) {
      const rank = ranks.get(id)!
      const layer = layers.get(rank) ?? []
      layer.push(id)
      layers.set(rank, layer)
    }
    const rows = [...layers].sort(([a], [b]) => a - b).map(([, row]) => row)
    const centers = new Map<string, number>()
    const rowWidth = (row: readonly string[]): number => row.reduce((sum, id) => sum + byId.get(id)!.width + CLUSTER_GAP, -CLUSTER_GAP)
    const width = Math.max(...rows.map(rowWidth))
    const measure = (row: readonly string[]): void => {
      let x = (width - rowWidth(row)) / 2
      for (const id of row) {
        centers.set(id, x + byId.get(id)!.width / 2)
        x += byId.get(id)!.width + CLUSTER_GAP
      }
    }
    rows.forEach(measure)
    // Alternating barycenter sweeps reduce avoidable crossings while stable
    // ties retain display order. Limit passes, not the number of sources.
    for (let pass = 0; pass < 4; pass += 1) {
      const adjacent = pass % 2 === 0 ? incoming : outgoing
      const traversal = pass % 2 === 0 ? rows : [...rows].reverse()
      for (const row of traversal) {
        const score = (id: string): number => {
          const neighbors = [...adjacent.get(id)!].filter(other => ranks.get(other) !== ranks.get(id))
          return neighbors.length ? neighbors.reduce((sum, other) => sum + centers.get(other)!, 0) / neighbors.length : centers.get(id)!
        }
        const scores = new Map(row.map(id => [id, score(id)]))
        row.sort((a, b) => scores.get(a)! - scores.get(b)! || order.get(a)! - order.get(b)!)
        measure(row)
      }
    }
    const positions = new Map<string, Position>()
    let y = 0
    for (const row of rows) {
      for (const id of row) positions.set(id, { x: centers.get(id)! - byId.get(id)!.width / 2, y })
      y += Math.max(...row.map(id => byId.get(id)!.height)) + CLUSTER_GAP
    }
    components.push({ positions, width, height: y - CLUSTER_GAP })
  }
  const positions = new Map<string, Position>()
  const wrapAt = Math.max(PACK_WIDTH, ...components.map(component => component.width))
  let x = 0
  let y = 0
  let rowHeight = 0
  for (const component of components) {
    if (x > 0 && x + component.width > wrapAt) {
      x = 0
      y += rowHeight + CLUSTER_GAP
      rowHeight = 0
    }
    for (const [id, local] of component.positions) positions.set(id, { x: x + local.x, y: y + local.y })
    x += component.width + CLUSTER_GAP
    rowHeight = Math.max(rowHeight, component.height)
  }
  return positions
}
