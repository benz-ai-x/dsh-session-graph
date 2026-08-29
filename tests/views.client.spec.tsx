// @vitest-environment jsdom
/**
 * View registration acceptance on the real framework stack: the plugin fiber
 * registers the Graph tab into a real SlotRegistry view ring after chat,
 * tabs switch inside the ConversationSession skeleton, the derived forest
 * renders Branch edges and accessible Canvas Session buttons with folded Subagent
 * badges, selection stays local until explicit navigation, and fiber
 * disposal removes the tab.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FC, ReactNode } from 'react'
import { bindSnapshotSelector, stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  WorkspaceSnapshot, WorkspaceView,
} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { EMPTY_CONVERSATION_SNAPSHOT } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  ConvViewProps, InputActions, InputState, ViewTab,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  ConversationSession, ConversationSessionHeader,
  type ConversationSessionHeaderProps, type ConversationSessionProps,
} from '@deepseek-ai/dsh-client-ui-conversation/src/client/skeleton/ConversationSession.tsx'
import { createConversationStore } from '@deepseek-ai/dsh-client-ui-conversation/src/client/stores.ts'
import { zh as conversationZh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { apply as localeApply, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import type { LocaleKeysOf } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '@benz-ai-x/dsh-client-ui-session-graph/client'
import { zh, type SessionGraphKey } from '../src/client/locales.ts'

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

function workspacesState(items: readonly WorkspaceView[] = []): WorkspaceSnapshot {
  return {
    items, archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  }
}

interface RecordedResizeObserver {
  readonly callback: ResizeObserverCallback
  readonly targets: Element[]
}

const recordedResizeObservers: RecordedResizeObserver[] = []

function stubResizeObserver(): void {
  vi.stubGlobal('ResizeObserver', class {
    readonly record: RecordedResizeObserver

    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, targets: [] }
      recordedResizeObservers.push(this.record)
    }

    observe(target: Element): void { this.record.targets.push(target) }
    unobserve(): void {}
    disconnect(): void {}
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  localStorage.clear()
  recordedResizeObservers.length = 0
})

const tConversation: ConversationSessionHeaderProps['t'] =
  key => (conversationZh as Record<string, string>)[key] ?? key

/** Real-stack bench: root Context + real SlotRegistry ring + the plugin fiber. */
async function bench(byId: Record<string, SessionSummary>) {
  const ctx = new Context()
  const slots = new SlotRegistry(ctx)
  const sessionsStore = createSnapshotStore(listState(byId))
  const open = vi.fn()
  const fork = vi.fn(async () => id('branched'))
  ctx.provide('sessions', { open, fork })
  slots.register({
    name: 'root',
    children: { 'conversation.view': { kind: 'list', scope: 'session' } },
  }, (_p: { renderSlot?: unknown }) => null)
  const chatBody = vi.fn(() => <div data-testid="chat-body" />)
  slots.register(
    { name: 'conversation.view', id: 'chat', order: 0, label: 'Chat' } as never, chatBody as never)
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  ctx.plugin({ inject: [...localeInject], apply: localeApply })
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, fiber, sessionsStore, open, fork }
}

/** Tab projection twin of apply's viewTabs (the render-side consumption path). */
function tabsOf(slots: SlotRegistry): ViewTab[] {
  return slots.entries('conversation.view')
    .map(e => ({ id: e.options.id!, label: resolveSlotLabel(e.options.label) ?? e.options.id! }))
}

/**
 * Mount the strict Session header/body over the ring ledger with an
 * outlet-faithful render twin: standard kit + the entry's inject face and
 * locale seat.
 */
function mount(
  slots: SlotRegistry,
  sessionsStore: SnapshotStore<SessionListState>,
  viewed: string,
  workspaces: WorkspaceSnapshot = workspacesState(),
  pendingInteractions: SessionPendingInteractionSnapshot = new Map(),
) {
  const SID = id(viewed)
  const useSessions = bindSnapshotSelector(sessionsStore)
  const useSessionPendingInteraction = bindSnapshotSelector(
    createSnapshotStore<SessionPendingInteractionSnapshot>(pendingInteractions),
  )
  const useWorkspaces = bindSnapshotSelector(createSnapshotStore(workspaces))
  const useSession = bindSnapshotSelector(createSnapshotStore({ blank: false } as never))
  const useConversation = bindSnapshotSelector(createSnapshotStore(EMPTY_CONVERSATION_SNAPSHOT))
  const useConversationViews = bindSnapshotSelector(createSnapshotStore(tabsOf(slots)))
  const conversation = createConversationStore().create()
  const useInput = bindSnapshotSelector(createSnapshotStore<InputState>({
    draft: '', imageIds: [], draftRev: 0, phase: 'plain', occurrences: [], queue: [],
  }))
  const inputActions: InputActions = {
    setDraft: vi.fn(),
    addImages: vi.fn(() => false),
    removeImage: vi.fn(),
    pruneImages: vi.fn(),
    submit: vi.fn(),
  }
  const siblingViewStandardProps = {
    useChat: () => { throw new Error('graph bench does not render Chat consumers') },
    useTrajectory: () => { throw new Error('graph bench does not render Trajectory consumers') },
  }
  const t = (key: LocaleKeysOf<'sessionGraph'>, params?: Record<string, unknown>): string => {
    const value = (key: string, params?: Record<string, unknown>): string =>
      (zh[key as SessionGraphKey] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) => {
        const param = params?.[name]
        return typeof param === 'number' || typeof param === 'string' ? String(param) : `{${name}}`
      })
    return value(key, params)
  }
  const renderSlot = ((key: string, owner: object, opts?: { only?: string }): ReactNode => {
    const entry = slots.entries('conversation.view').find(e => e.options.id === opts?.only)
    if (entry === undefined) return null
    const View = entry.component as FC<ConvViewProps>
    const injectEntry = entry.inject as ((sessionId: SessionId) => object) | undefined
    const injected = injectEntry === undefined ? {} : injectEntry(SID)
    return (
      <View
        {...injected}
        {...({
          ...owner,
          sessionId: SID,
          useSession,
          useSessions,
          useSessionPendingInteraction,
          useWorkspaces,
          useConversation,
          useConversationViews,
          t,
        } as unknown as ConvViewProps)}
        key={key}
      />
    )
  }) as unknown as ConversationSessionProps['renderSlot']
  return render(
    <>
      <ConversationSessionHeader
        {...siblingViewStandardProps}
        sessionId={SID}
        SessionProvider={({ children }) => children}
        useSession={useSession}
        useSessions={useSessions}
        useSessionPendingInteraction={useSessionPendingInteraction}
        useWorkspaces={useWorkspaces}
        useConversation={useConversation}
        useConversationViews={useConversationViews}
        useProjection={(() => undefined)}
        useStore={bindSnapshotSelector(conversation)}
        actions={conversation.actions}
        renderSlot={() => null}
        useInput={useInput}
        inputActions={inputActions}
        open={vi.fn()}
        t={tConversation}
      />
      <ConversationSession
        {...siblingViewStandardProps}
        sessionId={SID}
        SessionProvider={({ children }) => children}
        useSession={useSession}
        useSessions={useSessions}
        useSessionPendingInteraction={useSessionPendingInteraction}
        useWorkspaces={useWorkspaces}
        useConversation={useConversation}
        useConversationViews={useConversationViews}
        useProjection={(() => undefined)}
        useStore={bindSnapshotSelector(conversation)}
        actions={conversation.actions}
        renderSlot={renderSlot}
        bindDraftMirror={() => () => {}}
        useInput={useInput}
        inputActions={inputActions}
      />
    </>,
  )
}

/** Switch the mounted tab ring to one view id. */
function switchTab(name: string): void {
  fireEvent.click(screen.getByRole('tab', { name }))
}

/** One graph node button by its data-node-id (titles also appear in the session header). */
function nodeButton(key: string): HTMLElement {
  const button = document.querySelector(`[data-node-id="${key}"]`)
  if (button === null) throw new Error(`node "${key}" not rendered`)
  return button as HTMLElement
}

/** The Branch action exposed by the Selected Session panel. */
function branchActionButton(): HTMLButtonElement {
  const panel = screen.getByTestId('session-graph-panel')
  const button = [...panel.querySelectorAll('button')]
    .find(candidate => candidate.textContent === '开新分支')
  if (button === undefined) throw new Error('Selected Session Branch action not rendered')
  return button
}

const FIXTURE: Record<string, SessionSummary> = {
  root: session('root', { updatedAt: 500 }),
  branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
  sub1: session('sub1', { parentId: id('root'), origin: 'subagent', updatedAt: 300, running: true }),
  deep: session('deep', { parentId: id('sub1'), origin: 'subagent', updatedAt: 200 }),
}

describe('plugin registration', () => {
  it('registers graph after chat on the ring and labels it in the active locale', async () => {
    const b = await bench(FIXTURE)
    expect(tabsOf(b.slots)).toEqual([
      { id: 'chat', label: 'Chat' },
      { id: 'graph', label: 'Graph' },
    ])
    const locale = b.ctx.get('locale') as { setLocale(id: string): void }
    locale.setLocale('zh')
    expect(tabsOf(b.slots).find(tab => tab.id === 'graph')?.label).toBe('图谱')
    locale.setLocale('en')
    expect(tabsOf(b.slots).find(tab => tab.id === 'graph')?.label).toBe('Graph')
  })

  it('fiber disposal removes the tab and leaves chat standing', async () => {
    const b = await bench(FIXTURE)
    await b.fiber.dispose()
    expect(tabsOf(b.slots).map(tab => tab.id)).toEqual(['chat'])
  })
})

describe('graph tab rendering and interaction', () => {
  it('shows the package version and Build ID in the Graph header', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    const badge = screen.getByText('Session Graph v0.1.0 · test-build')
    expect(badge.getAttribute('title')).toBe(
      '@benz-ai-x/dsh-client-ui-session-graph v0.1.0 · build test-build',
    )
  })

  it('renders the scope-bound forest with Viewed Session highlight, one Branch edge, and folded summaries', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(nodeButton('root').getAttribute('aria-current')).toBe('true')
    expect(nodeButton('branchChild').getAttribute('aria-current')).toBeNull()
    // Subagent rows stay off the canvas; the root card carries the chain badge.
    expect(document.querySelector('[data-node-id="sub1"]')).toBeNull()
    expect(document.querySelector('[data-node-id="deep"]')).toBeNull()
    expect(nodeButton('root').textContent).toContain('2 子代理')
    expect(nodeButton('root').textContent).toContain('1 运行中')
    // Exactly one solid Branch edge with an arrowhead between the Canvas Sessions:
    // an invisible hit path plus the visible solid path and the arrowhead.
    const edgeGroup = document.querySelectorAll('svg g')
    expect(edgeGroup).toHaveLength(1)
    const paths = document.querySelectorAll('svg path')
    expect(paths).toHaveLength(3)
    const branch = document.querySelector('[data-edge-kind="branch"]')
    expect(branch?.getAttribute('stroke-dasharray')).toBeNull()
    // Folded Subagent Derivation appears on badge hover and uses the dashed line.
    const subagentBadge = screen.getByText(/2 子代理/)
    fireEvent.mouseEnter(subagentBadge)
    const derivation = document.querySelector('[data-edge-kind="subagent-derivation"]')
    expect(derivation?.getAttribute('stroke-dasharray')).toBe('6 4')
    // Node dots take the cluster palette color, not a status color.
    const dot = nodeButton('root').querySelector('span')
    expect(dot?.getAttribute('style')).toContain('var(--dsw-alias-')
    // The legend names the two relation kinds.
    expect(document.body.textContent).toContain('派生')
    expect(document.body.textContent).toContain('分支')
  })

  it('renders stable input and output ports on every Canvas Session', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    for (const key of ['root', 'branchChild']) {
      const node = nodeButton(key)
      const input = document.querySelector(`[data-port-id="${key}:input"]`)
      const output = document.querySelector(`[data-port-id="${key}:output"]`)
      expect(input?.getAttribute('data-port-id')).toBe(`${key}:input`)
      expect(output?.getAttribute('data-port-id')).toBe(`${key}:output`)
      expect(input?.getAttribute('aria-hidden')).toBe('true')
      expect(output?.getAttribute('aria-hidden')).toBe('true')
      // Ports are siblings of the button so they can become independent
      // interactive terminals later without nesting controls.
      expect(input?.parentElement).toBe(node.parentElement)
      expect(output?.parentElement).toBe(node.parentElement)
      expect(input?.parentElement).not.toBe(node)
    }
  })

  it('presents each Canvas Session title before its secondary metadata', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    expect(nodeButton('branchChild').textContent?.startsWith('Session branchChild')).toBe(true)
    expect(nodeButton('root').textContent?.startsWith('Session root')).toBe(true)
  })

  it('connects Branches at the bottom terminal of the 56px Canvas Session card', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    expect(document.querySelector('[data-edge-kind="branch"]')?.getAttribute('d'))
      .toMatch(/^M 120 56 /)
  })

  it('selects on single click and opens the target session on double click', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    const child = nodeButton('branchChild')
    fireEvent.click(child, { detail: 1 })
    expect(child.getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()

    const root = nodeButton('root')
    fireEvent.click(root, { detail: 1 })
    fireEvent.click(root, { detail: 2 })
    fireEvent.doubleClick(root, { detail: 2 })
    expect(b.open).toHaveBeenCalledWith(id('root'))
    expect(b.open).toHaveBeenCalledTimes(1)
  })

  it('explains why an Unscoped Session has no Session Graph', async () => {
    const loose = { ...session('loose') }
    delete (loose as Partial<SessionSummary>).cwd
    const b = await bench({ loose })
    mount(b.slots, b.sessionsStore, 'loose')
    switchTab('Graph')
    expect(screen.getByText('无法确定当前查看会话的工作区或工作目录')).toBeTruthy()
  })

  it('labels a Directory Scope without presenting it as a Workspace', async () => {
    const b = await bench({ loose: session('loose', { cwd: '/loose' }) })
    mount(b.slots, b.sessionsStore, 'loose')
    switchTab('Graph')
    expect(document.body.textContent).toContain('目录范围 · 1 个会话')
    expect(document.body.textContent).not.toContain('当前目录')
  })
})

function stubSize(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}),
  })
}

describe('free viewport controls', () => {
  const surface = (): HTMLElement =>
    document.querySelector<HTMLElement>('[aria-label="会话关系图谱"]') as HTMLElement

  it('renders the zoom controls with a percentage readout', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    // The one-shot entry fit leaves the view at its fitted scale (clamped
    // at or below 100%); the readout reflects it truthfully.
    const readout = screen.getByRole('button', { name: '缩放至 100%' })
    expect(Number(readout.textContent?.replace('%', ''))).toBeLessThanOrEqual(100)
    expect(screen.getByRole('button', { name: '放大' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '缩小' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '适应' }).textContent).toBe('适应')
    // Clicking the readout returns to exactly 100%.
    fireEvent.click(readout)
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('names the canvas toolbar and distinguishes Relayout from Reset', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    expect(screen.getByRole('group', { name: '画布工具' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '重新布局' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '重置布局' })).toBeTruthy()
  })

  it('keeps the same content centered when the graph surface resizes', async () => {
    let size = { width: 1000, height: 600 }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      ...size,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      toJSON: () => ({}),
    }))
    stubResizeObserver()
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))

    const surface = document.querySelector('[aria-label="会话关系图谱"]')!
    const observer = recordedResizeObservers.find(record => record.targets.includes(surface))
    expect(observer).toBeDefined()
    const content = nodeButton('root').parentElement!
    const transform = (): number[] => content.style.transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const before = transform()

    size = { width: 480, height: 700 }
    act(() => { observer?.callback([], {} as ResizeObserver) })
    const after = transform()

    expect(after[2]).toBe(before[2])
    expect(after[0]).toBeCloseTo(before[0]! - 260)
    expect(after[1]).toBeCloseTo(before[1]! + 50)
  })

  it('zooms in and out from the controls and resets to 100% on the readout', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    // Anchor at 100% first: the entry fit may leave the view below identity.
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('120%')
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('83%')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('wheel zooms toward the cursor anchor', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    fireEvent.wheel(surface(), { deltaY: -100, clientX: 400, clientY: 300 })
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('120%')
  })

  it('pans on background drag without stealing node clicks', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    const beforeMatch = before.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\)/)!
    fireEvent.pointerDown(surface(), { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 160, clientY: 130 })
    fireEvent.pointerUp(surface(), { pointerId: 1 })
    const after = content().style.transform
    const afterMatch = after.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\)/)!
    expect(after).not.toBe(before)
    expect(Number(afterMatch[1]) - Number(beforeMatch[1])).toBeCloseTo(60)
    expect(Number(afterMatch[2]) - Number(beforeMatch[2])).toBeCloseTo(30)
    // Node clicks still select after the pan gesture.
    fireEvent.click(nodeButton('branchChild'))
    expect(nodeButton('branchChild').getAttribute('aria-selected')).toBe('true')
  })

  it('fits the content into the surface on the fit button', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    fireEvent.click(screen.getByRole('button', { name: '适应' }))
    // Content 520x44 fits inside 904x504 at 100%; fit caps at identity.
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
  })

  it('fits persisted negative positions after the entry surface settles', async () => {
    localStorage.setItem('dsh.session-graph.layout./w', JSON.stringify({
      v: 1,
      positions: { branchChild: { x: -1_000, y: -1_000 } },
      collapsed: [],
      offsets: {},
    }))
    let viewHeight = 480
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: 1000,
      height: viewHeight,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: viewHeight,
      toJSON: () => ({}),
    }))
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    viewHeight = 600

    expect(nodeButton('branchChild').style.left).toBe('-1000px')
    expect(nodeButton('branchChild').style.top).toBe('-1000px')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('45%')
    })
    const edgeLayer = document.querySelector('[data-edge-id="branch:root->branchChild"]')?.closest('svg')
    expect(edgeLayer?.getAttribute('viewBox')).toBe('-1000 -1000 1240 1056')
    expect(edgeLayer?.style.left).toBe('-1000px')
    expect(edgeLayer?.style.top).toBe('-1000px')
    // Fit hides the minimap while all content is visible; one zoom step
    // makes the tall manual arrangement exceed the surface again.
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    for (const mark of screen.getByTestId('session-graph-minimap').querySelectorAll('rect:not([data-testid])')) {
      const x = Number(mark.getAttribute('x'))
      const y = Number(mark.getAttribute('y'))
      const width = Number(mark.getAttribute('width'))
      const height = Number(mark.getAttribute('height'))
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + width).toBeLessThanOrEqual(180)
      expect(y + height).toBeLessThanOrEqual(120)
    }
  })
})

describe('node drag and position persistence', () => {
  const drag = (key: string, dx: number, dy: number): void => {
    const node = nodeButton(key)
    const start = { clientX: 200, clientY: 200 }
    fireEvent.pointerDown(node, { pointerId: 7, ...start })
    fireEvent.pointerMove(node, { pointerId: 7, clientX: start.clientX + dx, clientY: start.clientY + dy })
    fireEvent.pointerUp(node, { pointerId: 7 })
  }

  it('drags a node, persists its position, and suppresses the click', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const before = nodeButton('branchChild').style.left
    drag('branchChild', 120, 80)
    const after = nodeButton('branchChild').style.left
    expect(after).not.toBe(before)
    // The drag landed in the Directory Scope's Session Arrangement.
    const stored = localStorage.getItem('dsh.session-graph.layout./w')
    expect(stored).toBeTruthy()
    expect(stored).toContain('branchChild')
    // The drag gesture did not select or navigate.
    expect(nodeButton('branchChild').getAttribute('aria-selected')).toBe('false')
    expect(b.open).not.toHaveBeenCalled()
  })

  it('accepts the first deliberate click after a completed drag', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    drag('branchChild', 120, 80)

    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 8, clientX: 240, clientY: 240 })
    fireEvent.pointerUp(node, { pointerId: 8, clientX: 240, clientY: 240 })
    fireEvent.click(node)
    expect(node.getAttribute('aria-selected')).toBe('true')
  })

  it('restores persisted positions on remount and falls back on corruption', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    drag('branchChild', 120, 80)
    const moved = nodeButton('branchChild').style.left
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(nodeButton('branchChild').style.left).toBe(moved)
    cleanup()
    localStorage.setItem('dsh.session-graph.layout./w', '{corrupt')
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    // Corrupt storage falls back to the auto layout's depth row.
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(nodeButton('branchChild').style.top).toBe('120px')
  })

  it('keeps sub-threshold pointer movement a click', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 9, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 9, clientX: 202, clientY: 201 })
    fireEvent.pointerUp(node, { pointerId: 9 })
    fireEvent.click(node)
    expect(node.getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()
    expect(localStorage.getItem('dsh.session-graph.layout./w')).toBeNull()
  })

  it('rolls back a node drag when the pointer sequence is canceled', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')
    const before = { left: node.style.left, top: node.style.top }
    fireEvent.pointerDown(node, { pointerId: 10, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 10, clientX: 320, clientY: 280 })
    expect(nodeButton('branchChild').style.left).not.toBe(before.left)
    fireEvent.pointerCancel(node, { pointerId: 10 })
    expect(nodeButton('branchChild').style.left).toBe(before.left)
    expect(nodeButton('branchChild').style.top).toBe(before.top)
    expect(document.querySelector('[data-testid^="session-graph-guide-"]')).toBeNull()
    expect(localStorage.getItem('dsh.session-graph.layout./w')).toBeNull()
  })

  it('keeps Session Arrangements separate for Workspaces that share a directory', async () => {
    const b = await bench(FIXTURE)
    mount(
      b.slots,
      b.sessionsStore,
      'root',
      workspacesState([workspace('first', '/w', ['root'])]),
    )
    switchTab('Graph')
    drag('branchChild', 120, 80)
    expect(nodeButton('branchChild').style.left).not.toBe('0px')

    cleanup()
    mount(
      b.slots,
      b.sessionsStore,
      'root',
      workspacesState([workspace('second', '/w', ['root'])]),
    )
    switchTab('Graph')
    expect(nodeButton('branchChild').style.left).toBe('0px')
  })

  it('migrates a legacy path Arrangement into its Workspace identity', async () => {
    localStorage.setItem('dsh.session-graph.layout./w', JSON.stringify({
      v: 1,
      positions: { branchChild: { x: 160, y: 200 } },
      collapsed: [],
      offsets: {},
    }))
    const b = await bench(FIXTURE)
    const namedScope = workspacesState([workspace('stable', '/w', ['root'])])
    mount(b.slots, b.sessionsStore, 'root', namedScope)
    switchTab('Graph')
    expect(nodeButton('branchChild').style.left).toBe('160px')

    cleanup()
    localStorage.removeItem('dsh.session-graph.layout./w')
    mount(b.slots, b.sessionsStore, 'root', namedScope)
    switchTab('Graph')
    expect(nodeButton('branchChild').style.left).toBe('160px')
  })
})

describe('cluster frames', () => {
  it('renders a titled frame around the Session Cluster', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const frame = document.querySelector('[data-cluster-id="root"]')
    expect(frame).not.toBeNull()
    expect(frame?.querySelector('[class*="frameLabel"]')?.textContent).toBe('Session root')
    expect(frame?.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelectorAll('[data-cluster-id]')).toHaveLength(1)
  })

  it('frames the isolated singleton too: every session sits inside a cluster box', async () => {
    const b = await bench({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(document.querySelectorAll('[data-cluster-id]')).toHaveLength(2)
    const lone = document.querySelector('[data-cluster-id="lone"]')
    expect(lone?.querySelector('[class*="frameLabel"]')?.textContent).toBe('Session lone')
  })

  it('collapses a cluster into its compact column, drops its edge, and persists', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(document.querySelectorAll('svg path')).toHaveLength(3)
    fireEvent.click(document.querySelector('[data-cluster-id="root"] button')!)
    const toggle = document.querySelector('[data-cluster-id="root"] button')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // The Branch edge vanished with the Collapsed Cluster.
    expect(document.querySelectorAll('svg g')).toHaveLength(0)
    // Members stack into one compact column.
    const root = nodeButton('root')
    const branchChild = nodeButton('branchChild')
    expect(root.style.left).toBe('0px')
    expect(branchChild.style.left).toBe('0px')
    expect(parseFloat(branchChild.style.top) - parseFloat(root.style.top)).toBe(64)
    const stored = localStorage.getItem('dsh.session-graph.layout./w')
    expect(stored).toContain('"collapsed":["root"]')
    // A collapsed member still selects normally.
    fireEvent.click(branchChild)
    expect(branchChild.getAttribute('aria-selected')).toBe('true')
    expect(b.open).not.toHaveBeenCalled()
  })

  it('restores the collapsed state from storage on remount', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    fireEvent.click(document.querySelector('[data-cluster-id="root"] button')!)
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(document.querySelector('[data-cluster-id="root"] button')?.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('cluster drag', () => {
  const frameTitle = (clusterId: string): HTMLElement =>
    document.querySelector(`[data-cluster-title="${clusterId}"]`) as HTMLElement

  it('drags a whole cluster by its frame title and persists the offset', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const transformBefore = content().style.transform
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 21, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 21, clientX: 360, clientY: 140 })
    fireEvent.pointerUp(title, { pointerId: 21 })
    // Every member moved by the same (60, 40) delta.
    expect(nodeButton('root').style.left).toBe('60px')
    expect(nodeButton('root').style.top).toBe('40px')
    expect(nodeButton('branchChild').style.left).toBe('60px')
    expect(nodeButton('branchChild').style.top).toBe('160px')
    // The title-band gesture never falls through to a background pan: in
    // the real browser the surface would steal the pointer capture and the
    // cluster drag would arrive dead (jsdom has no setPointerCapture, so
    // the no-pan assertion is the regression's proxy).
    expect(content().style.transform).toBe(transformBefore)
    expect(localStorage.getItem('dsh.session-graph.layout./w'))
      .toContain('"offsets":{"root":{"dx":60,"dy":40}}')
    expect(b.open).not.toHaveBeenCalled()
  })

  it('restores the cluster offset on remount', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 22, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 22, clientX: 340, clientY: 130 })
    fireEvent.pointerUp(title, { pointerId: 22 })
    cleanup()
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(nodeButton('root').style.left).toBe('40px')
    expect(nodeButton('root').style.top).toBe('30px')
  })

  it('stores node drags in the cluster-local frame so offsets never double-apply', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 23, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 23, clientX: 360, clientY: 140 })
    fireEvent.pointerUp(title, { pointerId: 23 })
    // The cluster sits at +60/+40; dragging the child 10px right stores the
    // cluster-relative (10, 120), not the shown (70, 160).
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 24, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 24, clientX: 210, clientY: 200 })
    fireEvent.pointerUp(node, { pointerId: 24 })
    const stored = JSON.parse(localStorage.getItem('dsh.session-graph.layout./w')!) as {
      positions: Record<string, { x: number; y: number }>
    }
    expect(stored.positions['branchChild']).toEqual({ x: 10, y: 120 })
  })

  it('never starts a cluster drag from the collapse toggle', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const toggle = document.querySelector('[data-cluster-id="root"] button')!
    fireEvent.pointerDown(toggle, { pointerId: 25, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(toggle, { pointerId: 25, clientX: 360, clientY: 140 })
    fireEvent.pointerUp(toggle, { pointerId: 25 })
    expect(nodeButton('root').style.left).toBe('0px')
    expect(localStorage.getItem('dsh.session-graph.layout./w')).toBeNull()
  })

  it('rolls back a cluster drag when the pointer sequence is canceled', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const title = frameTitle('root')
    fireEvent.pointerDown(title, { pointerId: 28, clientX: 300, clientY: 100 })
    fireEvent.pointerMove(title, { pointerId: 28, clientX: 360, clientY: 140 })
    expect(nodeButton('root').style.left).toBe('60px')
    fireEvent.pointerCancel(title, { pointerId: 28 })
    expect(nodeButton('root').style.left).toBe('0px')
    expect(nodeButton('root').style.top).toBe('0px')
    expect(localStorage.getItem('dsh.session-graph.layout./w')).toBeNull()
  })

  it('raises the grabbed cluster frame above overlapping frames', async () => {
    const b = await bench({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(document.querySelector('[data-cluster-id="root"]')?.className).not.toContain('Raised')
    fireEvent.pointerDown(frameTitle('root'), { pointerId: 26, clientX: 300, clientY: 100 })
    expect(document.querySelector('[data-cluster-id="root"]')?.className).toContain('Raised')
    fireEvent.pointerUp(frameTitle('root'), { pointerId: 26 })
    // Bring-to-front survives the drop, until another cluster is grabbed.
    expect(document.querySelector('[data-cluster-id="root"]')?.className).toContain('Raised')
    fireEvent.pointerDown(frameTitle('lone'), { pointerId: 27, clientX: 300, clientY: 400 })
    expect(document.querySelector('[data-cluster-id="root"]')?.className).not.toContain('Raised')
    expect(document.querySelector('[data-cluster-id="lone"]')?.className).toContain('Raised')
    fireEvent.pointerUp(frameTitle('lone'), { pointerId: 27 })
  })
})

describe('relayout button', () => {
  it('clears manual positions and returns nodes to the auto layout', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 5, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 5, clientX: 340, clientY: 260 })
    fireEvent.pointerUp(node, { pointerId: 5 })
    expect(nodeButton('branchChild').style.left).not.toBe('0px')
    fireEvent.click(screen.getByRole('button', { name: '重新布局' }))
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(localStorage.getItem('dsh.session-graph.layout./w')).toContain('"positions":{}')
    // Collapsed clusters survive the relayout.
    fireEvent.click(document.querySelector('[data-cluster-id="root"] button')!)
    expect(localStorage.getItem('dsh.session-graph.layout./w')).toContain('"collapsed":["root"]')
  })
})

describe('reset and minimap', () => {
  it('reset clears manual layout and collapse, then fits the view', async () => {
    localStorage.setItem('dsh.session-graph.layout./w', JSON.stringify({
      v: 1,
      positions: {},
      collapsed: ['root'],
      offsets: { lone: { dx: 0, dy: 2_000 } },
    }))
    stubSize(1000, 600)
    const b = await bench({
      ...FIXTURE,
      lone: session('lone', { updatedAt: 100 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).not.toBe('100%')
    })
    expect(nodeButton('lone').style.top).toBe('2248px')
    fireEvent.click(screen.getByRole('button', { name: '重置布局' }))
    // Manual position and collapse both cleared; node returns to the auto grid.
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(nodeButton('branchChild').style.top).toBe('120px')
    const stored = localStorage.getItem('dsh.session-graph.layout./w')
    expect(stored).toContain('"positions":{}')
    expect(stored).toContain('"collapsed":[]')
    // The cleared graph, rather than the previous far-away graph, owns Fit.
    expect(screen.getByRole('button', { name: '缩放至 100%' }).textContent).toBe('100%')
    expect(nodeButton('root').parentElement?.style.transform).toBe('translate(380px, 164px) scale(1)')
  })

  it('renders the minimap with node marks and the live viewport rectangle', async () => {
    // A wide tree (four Branch children spread over 1080px) lets the zoomed-in
    // viewport cover less than the full map, so the rectangle appears.
    const b = await bench({
      root: session('root', { updatedAt: 500 }),
      c1: session('c1', { parentId: id('root'), updatedAt: 400 }),
      c2: session('c2', { parentId: id('root'), updatedAt: 300 }),
      c3: session('c3', { parentId: id('root'), updatedAt: 200 }),
      c4: session('c4', { parentId: id('root'), updatedAt: 100 }),
    })
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const minimap = screen.getByTestId('session-graph-minimap')
    expect(minimap).toBeTruthy()
    // Five canvas nodes project to five node marks plus the cluster frame.
    expect(minimap.querySelectorAll('rect').length).toBeGreaterThanOrEqual(6)
    // At a fitted viewport below identity the rect hides (it would cover
    // the whole minimap); zoom in past identity so the visible region
    // shrinks below the content and the rect appears, then pan and assert
    // it tracks.
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: '放大' }))
    const view = screen.getByTestId('session-graph-minimap-viewport')
    expect(view).toBeTruthy()
    // Panning the surface moves the projected viewport rectangle.
    const before = view.getAttribute('x')
    const surface = document.querySelector('[role="group"][aria-label="会话关系图谱"]') as HTMLElement
    fireEvent.pointerDown(surface, { pointerId: 4, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { pointerId: 4, clientX: 220, clientY: 160 })
    fireEvent.pointerUp(surface, { pointerId: 4 })
    expect(view.getAttribute('x')).not.toBe(before)
  })

  it('hides the minimap while the whole graph fits and restores it when content leaves the view', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)

    fireEvent.click(screen.getByRole('button', { name: '适应' }))
    expect(screen.queryByTestId('session-graph-minimap')).toBeNull()

    const surface = document.querySelector('[role="group"][aria-label="会话关系图谱"]') as HTMLElement
    fireEvent.pointerDown(surface, { pointerId: 31, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(surface, { pointerId: 31, clientX: 900, clientY: 50 })
    fireEvent.pointerUp(surface, { pointerId: 31 })
    expect(screen.getByTestId('session-graph-minimap')).toBeTruthy()
  })

  it('pointing the minimap recenters the surface', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    const minimap = screen.getByTestId('session-graph-minimap')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 180, height: 120, x: 0, y: 0, top: 0, left: 0, right: 180, bottom: 120, toJSON: () => ({}),
    })
    fireEvent.pointerDown(minimap, { pointerId: 8, clientX: 30, clientY: 30 })
    expect(content().style.transform).not.toBe(before)
  })
})

describe('node selection, double-click, and keyboard navigation', () => {
  it('pressing Escape clears the Selected Session and closes its inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')

    fireEvent.click(node)
    expect(node.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()

    fireEvent.keyDown(document.querySelector('[aria-label="会话关系图谱"]')!, { key: 'Escape' })
    expect(node.getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
  })

  it('clicking the canvas background clears the Selected Session', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')
    const surface = document.querySelector('[aria-label="会话关系图谱"]')!

    fireEvent.click(node)
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()

    fireEvent.pointerDown(surface, { pointerId: 21, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(surface, { pointerId: 21, clientX: 40, clientY: 40 })
    expect(node.getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
  })

  it('keeps selection through the browser double-click sequence and opens exactly once', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')
    fireEvent.click(node, { detail: 1 })
    fireEvent.click(node, { detail: 2 })
    fireEvent.doubleClick(node, { detail: 2 })
    expect(node.getAttribute('aria-selected')).toBe('true')
    expect(b.open).toHaveBeenCalledWith(id('branchChild'))
    expect(b.open).toHaveBeenCalledTimes(1)
  })

  it('selecting a node opens the summary panel with open and branch actions', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    expect(screen.queryByTestId('session-graph-panel')).toBeNull()
    fireEvent.click(nodeButton('root'))
    const panel = screen.getByTestId('session-graph-panel')
    expect(panel.textContent).toContain('Session root')
    expect(panel.textContent).toContain('2 子代理')
    const openButton = [...panel.querySelectorAll('button')].find(btn => btn.textContent === '打开会话')!
    fireEvent.click(openButton)
    expect(b.open).toHaveBeenCalledWith(id('root'))
    fireEvent.click(branchActionButton())
    expect(b.fork).toHaveBeenCalledWith({ sessionId: id('root'), increaseTitle: true })
    expect(panel.isConnected).toBe(true)
  })

  it('exposes a named Selected Session inspector that can be closed explicitly', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const node = nodeButton('branchChild')

    fireEvent.click(node)
    const inspector = screen.getByRole('complementary', { name: '会话详情' })
    expect(inspector.textContent).toContain('Session branchChild')

    fireEvent.click(screen.getByRole('button', { name: '关闭会话详情' }))
    expect(node.getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByRole('complementary', { name: '会话详情' })).toBeNull()
  })

  it('explains the Selected Session Branch source in the inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    fireEvent.click(nodeButton('branchChild'))
    expect(screen.getByRole('complementary', { name: '会话详情' }).textContent)
      .toContain('分支自：Session root')
  })

  it('shows one Display Status on the Selected Session using the agreed priority', async () => {
    const b = await bench({
      running: session('running', { running: true, completed: true }),
      waiting: session('waiting', { completed: true }),
      completed: session('completed', { completed: true }),
    })
    mount(
      b.slots,
      b.sessionsStore,
      'running',
      workspacesState(),
      new Map([[id('running'), {}], [id('waiting'), {}]]) as SessionPendingInteractionSnapshot,
    )
    switchTab('Graph')

    expect(nodeButton('running').dataset.displayStatus).toBe('running')
    expect(nodeButton('running').className).not.toContain('nodePending')
    expect(nodeButton('waiting').dataset.displayStatus).toBe('waiting-input')
    expect(nodeButton('completed').dataset.displayStatus).toBe('completed')

    fireEvent.click(nodeButton('running'))
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('运行中')
    expect(screen.getByTestId('session-graph-panel').textContent).not.toContain('等待输入')
    expect(screen.getByTestId('session-graph-panel').textContent).not.toContain('已完成')

    fireEvent.click(nodeButton('waiting'))
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('等待输入')
    expect(screen.getByTestId('session-graph-panel').textContent).not.toContain('已完成')
  })

  it('shows an error when Harness rejects creating a Branch', async () => {
    const b = await bench(FIXTURE)
    b.fork.mockRejectedValueOnce(new Error('branch rejected'))
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    fireEvent.click(nodeButton('root'))
    fireEvent.click(branchActionButton())

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('无法创建分支，请重试')
    })
  })

  it('clears a previous Branch error when retry succeeds', async () => {
    const b = await bench(FIXTURE)
    b.fork.mockRejectedValueOnce(new Error('branch rejected'))
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    fireEvent.click(nodeButton('root'))
    const branchButton = branchActionButton()
    fireEvent.click(branchButton)
    await waitFor(() => { expect(screen.getByRole('alert')).toBeTruthy() })

    fireEvent.click(branchButton)
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull() })
    expect(nodeButton('root').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('session-graph-panel').textContent).toContain('Session root')
  })

  it('arrow keys move focus between nodes by layout geometry', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    nodeButton('root').focus()
    // The tree grows top to bottom: the Branch child sits one row below.
    fireEvent.keyDown(document.querySelector('[aria-label="会话关系图谱"]')!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(nodeButton('branchChild'))
    fireEvent.keyDown(document.querySelector('[aria-label="会话关系图谱"]')!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(nodeButton('root'))
  })
})

describe('hover preview card', () => {
  afterEach(() => { vi.useRealTimers() })

  it('replaces a Canvas Session preview with the Selected Session inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    const node = nodeButton('branchChild')

    fireEvent.mouseEnter(node)
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByTestId('session-graph-preview')).toBeTruthy()

    fireEvent.click(node)
    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('does not preview the Selected Session again on hover', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    const node = nodeButton('branchChild')

    fireEvent.click(node)
    fireEvent.mouseEnter(node)
    act(() => { vi.advanceTimersByTime(400) })

    expect(screen.getByTestId('session-graph-panel')).toBeTruthy()
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('previews another Canvas Session without replacing the Selected Session inspector', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()

    fireEvent.click(nodeButton('branchChild'))
    fireEvent.mouseEnter(nodeButton('root'))
    act(() => { vi.advanceTimersByTime(400) })

    expect(screen.getByTestId('session-graph-panel').textContent).toContain('Session branchChild')
    expect(screen.getByTestId('session-graph-preview').textContent).toContain('Session root')
  })

  it('shows the detail card after the hover delay and hides it on leave', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    fireEvent.mouseEnter(nodeButton('branchChild'))
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
    act(() => { vi.advanceTimersByTime(400) })
    const preview = screen.getByTestId('session-graph-preview')
    expect(preview.textContent).toContain('Session branchChild')
    expect(preview.textContent).toContain('分支自：Session root')
    expect(preview.textContent).not.toContain('单击选择 · 双击打开')
    fireEvent.mouseLeave(nodeButton('branchChild'))
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('never opens on a quick pass-through hover', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    fireEvent.mouseEnter(nodeButton('branchChild'))
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.mouseLeave(nodeButton('branchChild'))
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
  })

  it('hides when the node drag starts', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    vi.useFakeTimers()
    fireEvent.mouseEnter(nodeButton('branchChild'))
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByTestId('session-graph-preview')).toBeTruthy()
    fireEvent.pointerDown(nodeButton('branchChild'), { pointerId: 15, clientX: 200, clientY: 200 })
    expect(screen.queryByTestId('session-graph-preview')).toBeNull()
    fireEvent.pointerUp(nodeButton('branchChild'), { pointerId: 15 })
  })
})

describe('drag alignment snapping', () => {
  it('snaps the dragged node to a sibling edge, shows the guide, and clears it on release', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 13, clientX: 200, clientY: 200 })
    // 6px shy of root's top-left corner (0, 0): inside the snap threshold
    // on both axes.
    fireEvent.pointerMove(node, { pointerId: 13, clientX: 206, clientY: 86 })
    expect(nodeButton('branchChild').style.left).toBe('0px')
    expect(nodeButton('branchChild').style.top).toBe('0px')
    expect(screen.getByTestId('session-graph-guide-x')).toBeTruthy()
    expect(screen.getByTestId('session-graph-guide-y')).toBeTruthy()
    fireEvent.pointerUp(node, { pointerId: 13 })
    expect(screen.queryByTestId('session-graph-guide-x')).toBeNull()
  })

  it('leaves the position untouched beyond the snap threshold', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const node = nodeButton('branchChild')
    fireEvent.pointerDown(node, { pointerId: 14, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(node, { pointerId: 14, clientX: 280, clientY: 200 })
    expect(nodeButton('branchChild').style.left).toBe('80px')
    expect(screen.queryByTestId('session-graph-guide-x')).toBeNull()
    fireEvent.pointerUp(node, { pointerId: 14 })
  })
})

describe('programmatic viewport transitions', () => {
  it('marks fit and 100% jumps with the animated class but not step zooms', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(content().className).not.toContain('animated')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(content().className).toContain('animated')
  })
})

describe('locate Viewed Session button', () => {
  it('centers the viewport on the Viewed Session after panning away', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    const surface = document.querySelector('[aria-label="会话关系图谱"]')!
    fireEvent.pointerDown(surface, { pointerId: 12, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { pointerId: 12, clientX: 500, clientY: 400 })
    fireEvent.pointerUp(surface, { pointerId: 12 })
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    fireEvent.click(screen.getByRole('button', { name: '定位' }))
    const transform = content().style.transform
    expect(transform).not.toBe(before)
    // The root Canvas Session sits at (0, 0); its card center (120, 28)
    // lands on the surface center (500, 300) at 100%.
    const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\) scale\((\d+(?:\.\d+)?)\)/)!
    const [, panX, panY, scale] = match.map(Number)
    expect(panX! + 120 * scale!).toBeCloseTo(500)
    expect(panY! + 28 * scale!).toBeCloseTo(300)
  })
})

describe('low-zoom level of detail', () => {
  it('fades node card text below the zoom threshold and restores it above', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(content().className).not.toContain('lowZoom')
    // Five 1/1.2 steps land at ≈40%: below the 45% detail threshold.
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(content().className).toContain('lowZoom')
    fireEvent.click(screen.getByRole('button', { name: '缩放至 100%' }))
    expect(content().className).not.toContain('lowZoom')
  })
})

describe('canvas keyboard shortcuts', () => {
  const surface = (): HTMLElement =>
    document.querySelector<HTMLElement>('[aria-label="会话关系图谱"]') as HTMLElement
  const readout = (): HTMLElement => screen.getByRole('button', { name: '缩放至 100%' })
  // Four Branch children spread the content 1080px wide: the fit scale lands
  // below 100%, so the fit key is distinguishable from the zoom-step keys.
  const WIDE: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    c1: session('c1', { parentId: id('root'), updatedAt: 400 }),
    c2: session('c2', { parentId: id('root'), updatedAt: 300 }),
    c3: session('c3', { parentId: id('root'), updatedAt: 200 }),
    c4: session('c4', { parentId: id('root'), updatedAt: 100 }),
  }

  it('zooms with + and -, returns to 100% with 0, and fits with 1', async () => {
    const b = await bench(WIDE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.keyDown(surface(), { key: '0' })
    expect(readout().textContent).toBe('100%')
    fireEvent.keyDown(surface(), { key: '+' })
    expect(readout().textContent).toBe('120%')
    fireEvent.keyDown(surface(), { key: '-' })
    expect(readout().textContent).toBe('100%')
    fireEvent.keyDown(surface(), { key: '1' })
    expect(readout().textContent).toBe('81%')
    fireEvent.keyDown(surface(), { key: '=' })
    expect(readout().textContent).toBe('98%')
    fireEvent.keyDown(surface(), { key: '0' })
    expect(readout().textContent).toBe('100%')
  })

  it('focuses the canvas on background pointer down so keys work without a node focused', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    fireEvent.pointerDown(surface(), { pointerId: 11, clientX: 50, clientY: 50 })
    fireEvent.pointerUp(surface(), { pointerId: 11 })
    expect(document.activeElement).toBe(surface())
    fireEvent.keyDown(surface(), { key: '0' })
    expect(readout().textContent).toBe('100%')
  })

  it('ignores shortcut keys coming from the filter input', async () => {
    const b = await bench(FIXTURE)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const before = readout().textContent
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })
    input.focus()
    fireEvent.keyDown(input, { key: '1' })
    fireEvent.keyDown(input, { key: '0' })
    fireEvent.keyDown(input, { key: '+' })
    expect(readout().textContent).toBe(before)
  })
})

describe('Branch Lineage highlight', () => {
  const RELATED: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
    branchChild2: session('branchChild2', { parentId: id('root'), updatedAt: 350 }),
    lone: session('lone', { updatedAt: 200 }),
  }

  it('hovering a node dims everyone outside its branch lineage and clears on leave', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    fireEvent.mouseEnter(nodeButton('branchChild'))
    expect(nodeButton('lone').className).toContain('dim')
    expect(nodeButton('branchChild2').className).toContain('dim')
    expect(nodeButton('branchChild').className).not.toContain('dim')
    expect(nodeButton('root').className).not.toContain('dim')
    // The sibling edge dims while the lineage edge stays bright.
    expect(document.querySelectorAll('svg g[class*="dim"]')).toHaveLength(1)
    fireEvent.mouseLeave(nodeButton('branchChild'))
    expect(nodeButton('lone').className).not.toContain('dim')
  })

  it('keeps the Selected Session Branch Lineage emphasized after the pointer leaves', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    fireEvent.click(nodeButton('branchChild'))

    expect(nodeButton('branchChild').className).not.toContain('dim')
    expect(nodeButton('root').className).not.toContain('dim')
    expect(nodeButton('branchChild2').className).toContain('dim')
    expect(nodeButton('lone').className).toContain('dim')
  })

  it('distinguishes contextual emphasis from Title Filter suppression', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')

    fireEvent.mouseEnter(nodeButton('branchChild'))
    expect(nodeButton('lone').className).toContain('dimContext')
    expect(document.querySelector('[data-port-id="lone:input"]')?.className).toContain('dimContext')

    fireEvent.mouseLeave(nodeButton('branchChild'))
    fireEvent.change(screen.getByRole('textbox', { name: '过滤会话标题' }), {
      target: { value: 'branchChild' },
    })
    expect(nodeButton('root').className).toContain('dimFilter')
    expect(nodeButton('root').className).not.toContain('dimContext')
  })

  it('hovering an edge dims everything except its endpoints', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const hit = document.querySelector('[data-edge-id="branch:root->branchChild"]')
    expect(hit).not.toBeNull()
    fireEvent.mouseEnter(hit!)
    expect(nodeButton('lone').className).toContain('dim')
    expect(nodeButton('branchChild2').className).toContain('dim')
    expect(nodeButton('root').className).not.toContain('dim')
    expect(nodeButton('branchChild').className).not.toContain('dim')
    fireEvent.mouseLeave(hit!)
    expect(nodeButton('lone').className).not.toContain('dim')
  })

  it('dims a cluster frame when none of its members are emphasized', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const frame = document.querySelector('[data-cluster-id="root"]')
    expect(frame?.className).not.toContain('dim')
    fireEvent.mouseEnter(nodeButton('lone'))
    expect(document.querySelector('[data-cluster-id="root"]')?.className).toContain('dim')
    fireEvent.mouseLeave(nodeButton('lone'))
    expect(document.querySelector('[data-cluster-id="root"]')?.className).not.toContain('dim')
  })
})

describe('title filter', () => {
  const RELATED: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
    branchChild2: session('branchChild2', { parentId: id('root'), updatedAt: 350 }),
    lone: session('lone', { updatedAt: 200 }),
  }

  it('announces the match count and the no-match state', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })

    fireEvent.change(input, { target: { value: 'branchChild' } })
    expect(screen.getByRole('status').textContent).toBe('2 个匹配')
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByRole('status').textContent).toBe('无匹配会话')
    fireEvent.click(screen.getByRole('button', { name: '清除过滤' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('dims non-matching nodes as the query types and restores on clear', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })
    fireEvent.change(input, { target: { value: 'branchChild' } })
    expect(nodeButton('lone').className).toContain('dim')
    expect(nodeButton('branchChild').className).not.toContain('dim')
    expect(nodeButton('branchChild2').className).not.toContain('dim')
    expect(nodeButton('root').className).toContain('dim')
    // A query with no hits dims the whole canvas.
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(nodeButton('branchChild').className).toContain('dim')
    fireEvent.click(screen.getByRole('button', { name: '清除过滤' }))
    expect(nodeButton('lone').className).not.toContain('dim')
  })

  it('locates the first match on Enter, centered in the surface', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    stubSize(1000, 600)
    const input = screen.getByRole('textbox', { name: '过滤会话标题' })
    fireEvent.change(input, { target: { value: 'lone' } })
    const content = (): HTMLElement => document.querySelector('[data-node-id="root"]')!.parentElement!
    const before = content().style.transform
    fireEvent.keyDown(input, { key: 'Enter' })
    const transform = content().style.transform
    expect(transform).not.toBe(before)
    // The lone node sits at (0, 256) in the vertical cluster stack; its
    // center (120, 284) lands on the surface center (500, 300).
    const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px\) scale\((\d+(?:\.\d+)?)\)/)!
    const [, panX, panY, scale] = match.map(Number)
    expect(panX! + 120 * scale!).toBeCloseTo(500)
    expect(panY! + 284 * scale!).toBeCloseTo(300)
  })

  it('keeps typing focus in the input: arrow keys never leave for the canvas', async () => {
    const b = await bench(RELATED)
    mount(b.slots, b.sessionsStore, 'root')
    switchTab('Graph')
    const input = screen.getByRole('textbox', { name: '过滤会话标题' }) as HTMLInputElement
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(input)
    // Escape clears the query and releases focus.
    fireEvent.change(input, { target: { value: 'lone' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(document.activeElement).not.toBe(input)
  })
})
