import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveSessionGraph, matchFilter, neighborhood, resolveWorkspaceScope } from '../src/client/graph-model.ts'
import type { GraphNode } from '../src/client/graph-model.ts'

const id = (value: string): SessionId => value as SessionId

function session(value: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    displayTitle: over.displayTitle ?? `Session ${value}`,
    running: over.running ?? false,
    blank: over.blank ?? false,
    updatedAt: over.updatedAt ?? 1_000,
    cwd: '/w',
    ...over,
  }
}

function listState(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function workspace(value: string, path: string, sessionIds: string[]): WorkspaceView {
  return {
    workspaceId: value as never,
    path,
    title: `Workspace ${value}`,
    sessionIds: sessionIds.map(id),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function workspacesState(items: WorkspaceView[], archived: string[] = []): WorkspaceSnapshot {
  return {
    items,
    archivedSessionIds: archived.map(id),
    state: 'idle',
    phase: 'ready',
    error: null,
  }
}

function graphFor(
  byId: Record<string, SessionSummary>,
  currentId?: SessionId,
) {
  const list = listState(byId)
  const scope = resolveWorkspaceScope(
    currentId ?? id(Object.keys(byId)[0] ?? ''), list, workspacesState([]),
  )
  return deriveSessionGraph(list, scope, currentId, new Map())
}

describe('resolveWorkspaceScope', () => {
  it('resolves by sessionIds membership first and unions same-cwd rows into members', () => {
    const list = listState({
      a: session('a'),
      b: session('b', { cwd: '/w' }),
      c: session('c', { cwd: '/other' }),
    })
    const scope = resolveWorkspaceScope(id('a'), list, workspacesState([workspace('w1', '/w', ['a'])]))
    expect(scope?.label).toBe('Workspace w1')
    expect(scope?.path).toBe('/w')
    expect(scope?.members.has(id('a'))).toBe(true)
    expect(scope?.members.has(id('b'))).toBe(true)
    expect(scope?.members.has(id('c'))).toBe(false)
  })

  it('falls back to a path match on the viewed session cwd when unaccounted', () => {
    const list = listState({ a: session('a', { cwd: '/w' }) })
    const scope = resolveWorkspaceScope(id('a'), list, workspacesState([workspace('w1', '/w', [])]))
    expect(scope?.label).toBe('Workspace w1')
    expect(scope?.members.has(id('a'))).toBe(true)
  })

  it('builds a label-less cwd-only bucket when no workspace matches', () => {
    const list = listState({
      a: session('a', { cwd: '/loose' }),
      b: session('b', { cwd: '/loose' }),
      c: session('c', { cwd: '/elsewhere' }),
    })
    const scope = resolveWorkspaceScope(id('a'), list, workspacesState([]))
    expect(scope?.label).toBeUndefined()
    expect(scope?.path).toBe('/loose')
    expect(scope?.members.has(id('a'))).toBe(true)
    expect(scope?.members.has(id('b'))).toBe(true)
    expect(scope?.members.has(id('c'))).toBe(false)
  })

  it('returns undefined when the viewed session has neither membership nor cwd', () => {
    const loose = { ...session('a') }
    delete (loose as Partial<SessionSummary>).cwd
    const list = listState({ a: loose })
    expect(resolveWorkspaceScope(id('a'), list, workspacesState([]))).toBeUndefined()
  })

  it('excludes archived sessions from members', () => {
    const list = listState({ a: session('a'), gone: session('gone') })
    const scope = resolveWorkspaceScope(
      id('a'), list, workspacesState([workspace('w1', '/w', ['a', 'gone'])], ['gone']),
    )
    expect(scope?.members.has(id('gone'))).toBe(false)
  })
})

describe('deriveSessionGraph clusters', () => {
  it('groups one derivation tree into a single cluster and isolates unattached sessions', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      forkChild: session('forkChild', { parentId: id('root'), updatedAt: 400 }),
      grandchild: session('grandchild', { parentId: id('forkChild'), updatedAt: 300 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['root', 'lone'])
    expect(graph.clusters[0]).toMatchObject({
      rootId: id('root'), label: 'Session root', memberIds: [id('root'), id('forkChild'), id('grandchild')],
    })
    expect(graph.clusters[1]).toMatchObject({ rootId: id('lone'), memberIds: [id('lone')] })
    expect(graph.nodes.get('forkChild')?.clusterId).toBe(id('root'))
    expect(graph.sessionCount).toBe(4)
  })

  it('orders clusters by root recency with an id tiebreak', () => {
    const graph = graphFor({
      old: session('old', { updatedAt: 100 }),
      fresh: session('fresh', { updatedAt: 300 }),
      tieA: session('tieA', { updatedAt: 300 }),
      bB: session('bB', { updatedAt: 300 }),
      aA: session('aA', { updatedAt: 300 }),
    })
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['aA', 'bB', 'fresh', 'tieA', 'old'])
  })
})

describe('deriveSessionGraph subagent folding', () => {
  it('keeps subagent sessions off the canvas and badges every ancestor along the chain', () => {
    const graph = graphFor({
      root: session('root'),
      sub1: session('sub1', { parentId: id('root'), origin: 'subagent', running: true }),
      sub2: session('sub2', { parentId: id('root'), origin: 'subagent' }),
      deep: session('deep', { parentId: id('sub1'), origin: 'subagent', running: true }),
    })
    expect(graph.nodes.has('sub1')).toBe(false)
    expect(graph.nodes.has('sub2')).toBe(false)
    expect(graph.nodes.has('deep')).toBe(false)
    expect(graph.nodes.get('root')).toMatchObject({ subagentCount: 3, runningSubagents: 2 })
    expect(graph.clusters[0]?.memberIds).toEqual([id('root')])
  })

  it('terminates badge propagation at an ordinary fork: a fork child owns its own subtree', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      forkChild: session('forkChild', { parentId: id('root'), updatedAt: 400 }),
      forkSub: session('forkSub', { parentId: id('forkChild'), origin: 'subagent' }),
    })
    expect(graph.nodes.get('root')?.subagentCount).toBe(0)
    expect(graph.nodes.get('forkChild')).toMatchObject({ subagentCount: 1, runningSubagents: 0 })
  })
})

describe('deriveSessionGraph edges', () => {
  it('keeps fork edges inside the cluster between attached rows', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      child: session('child', { parentId: id('root'), updatedAt: 400 }),
    })
    expect(graph.children.get('root')).toEqual(['child'])
    expect(graph.edges).toContainEqual({ id: 'fork:root->child', from: 'root', to: 'child' })
  })

  it('renders a fork of a subagent as a new root in its own cluster without an edge', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      sub: session('sub', { parentId: id('root'), origin: 'subagent', updatedAt: 400 }),
      forkOfSub: session('forkOfSub', { parentId: id('sub'), updatedAt: 300 }),
    })
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['root', 'forkOfSub'])
    expect(graph.edges.some(edge => edge.to === 'forkOfSub')).toBe(false)
  })

  it('excludes sessions outside the workspace scope', () => {
    const list = listState({
      inside: session('inside'),
      outside: session('outside', { cwd: '/elsewhere' }),
    })
    const scope = resolveWorkspaceScope(id('inside'), list, workspacesState([workspace('w1', '/w', ['inside'])]))
    const graph = deriveSessionGraph(list, scope, undefined, new Map())
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['inside'])
  })
})

describe('deriveSessionGraph visibility rules', () => {
  it('excludes blank sessions except the current one', () => {
    const graph = graphFor({
      real: session('real', { updatedAt: 100 }),
      blankOther: session('blankOther', { blank: true }),
      blankMine: session('blankMine', { blank: true, updatedAt: 500 }),
    }, id('blankMine'))
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['blankMine', 'real'])
  })

  it('marks the current session', () => {
    const graph = graphFor({
      a: session('a'),
      b: session('b'),
    }, id('b'))
    expect(graph.nodes.get('a')?.current).toBe(false)
    expect(graph.nodes.get('b')?.current).toBe(true)
  })
})

describe('neighborhood', () => {
  it('collects the branch ancestors, self, and fork descendants — never siblings', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      forkChild: session('forkChild', { parentId: id('root'), updatedAt: 400 }),
      forkChild2: session('forkChild2', { parentId: id('root'), updatedAt: 350 }),
      grandchild: session('grandchild', { parentId: id('forkChild'), updatedAt: 300 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    const around = neighborhood(graph.nodes.values(), 'forkChild')
    expect([...around].sort()).toEqual(['forkChild', 'grandchild', 'root'])
    expect(neighborhood(graph.nodes.values(), 'forkChild2')).toEqual(new Set(['forkChild2', 'root']))
    expect(neighborhood(graph.nodes.values(), 'lone')).toEqual(new Set(['lone']))
  })

  it('returns an empty set for an unknown key and survives branch cycles', () => {
    const graph = graphFor({ solo: session('solo') })
    expect(neighborhood(graph.nodes.values(), 'ghost').size).toBe(0)
    const cyclic = [
      { id: 'a', branchFrom: 'b' },
      { id: 'b', branchFrom: 'a' },
    ] as unknown as GraphNode[]
    expect([...neighborhood(cyclic, 'a')].sort()).toEqual(['a', 'b'])
  })
})

describe('matchFilter', () => {
  it('matches titles case-insensitively, empty-handed queries dim all, blank stays inactive', () => {
    const graph = graphFor({
      alpha: session('alpha', { displayTitle: 'Fix login bug' }),
      beta: session('beta', { displayTitle: 'Add LOGIN page' }),
      gamma: session('gamma', { displayTitle: 'Refactor graph' }),
    })
    expect(matchFilter(graph.nodes.values(), 'login')).toEqual(new Set(['alpha', 'beta']))
    expect(matchFilter(graph.nodes.values(), ' graph ')).toEqual(new Set(['gamma']))
    expect(matchFilter(graph.nodes.values(), 'zzz')?.size).toBe(0)
    expect(matchFilter(graph.nodes.values(), '')).toBeNull()
    expect(matchFilter(graph.nodes.values(), '   ')).toBeNull()
  })
})
