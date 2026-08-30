import { describe, expect, it } from 'vitest'
import type { ClusterInfo, GraphNode } from '../src/client/graph-model.ts'
import type { LaidOutGraph } from '../src/client/layout.ts'
import { deriveCanvasPresentation } from '../src/client/canvas-presentation.ts'

describe('Canvas presentation derivation', () => {
  it('applies positions, collapse, and offsets in domain order and preserves automatic bounds', () => {
    const node = (id: string): GraphNode => ({ id, clusterId: 'root' } as GraphNode)
    const laid: LaidOutGraph = {
      nodes: [
        { node: node('root'), key: 'root', x: 100, y: 0 },
        { node: node('child'), key: 'child', x: 100, y: 120 },
      ],
      edges: [{
        edge: { id: 'branch:root->child', kind: 'branch', from: 'root', to: 'child' },
        path: 'automatic',
      }],
      x: 100,
      y: 0,
      width: 240,
      height: 176,
    }
    const clusters: readonly ClusterInfo[] = [{
      rootId: 'root',
      label: 'Root',
      memberIds: ['root', 'child'],
    }]

    const presentation = deriveCanvasPresentation({
      laid,
      clusters,
      positions: { child: { x: 500, y: 500 } },
      collapsed: new Set(['root']),
      offsets: { root: { dx: 50, dy: 30 } },
    })

    expect(presentation.shown.nodes.map(({ key, x, y }) => ({ key, x, y }))).toEqual([
      { key: 'root', x: 150, y: 30 },
      { key: 'child', x: 150, y: 94 },
    ])
    expect(presentation.frames[0]).toMatchObject({
      clusterId: 'root',
      collapsed: true,
      x: 134,
      y: -18,
    })
    expect(presentation.bounds).toEqual({ x: 134, y: -18, width: 272, height: 184 })
    expect(presentation.automaticBounds).toEqual({ x: 84, y: -48, width: 272, height: 240 })
  })
})
