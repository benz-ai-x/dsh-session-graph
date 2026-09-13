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
  useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionDigest } from '../session-digest.ts'
import { SessionTitleControl } from './SessionTitleControl.tsx'
import { ResearchMarkdown } from './ResearchMarkdown.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import { InspectorFrame } from './InspectorFrame.tsx'
import { useCanvasGeometry } from './reading-geometry.ts'
import { ActionMenu } from './ActionMenu.tsx'
import { containsSessionReferenceUri } from '../session-merge.ts'
import { CLUSTER_COLORS } from './clusters.ts'
import type { ClusterInfo, DisplayStatus, GraphNode, SessionGraphNode } from './graph-model.ts'
import { branchLineage, matchFilter } from './graph-model.ts'
import {
  CARD_H, NODE_W, type ContentBounds, type LaidOutGraph, type LaidOutNode,
} from './layout.ts'
import {
  type ClusterOffset, loadArrangement, saveLayout, type NodePosition,
  type SessionArrangementIdentity, type LayoutState,
} from './layout-store.ts'
import type { SessionGraphKey } from './locales.ts'
import { placePreview } from './preview-placement.ts'
import { snapPosition } from './snap.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { LaidOutFrame } from './clusters.ts'
import { deriveCanvasPresentation } from './canvas-presentation.ts'
import type { ConnectionPort } from './edge-routing.ts'
import {
  fitViewport, initialViewport, minimapProjection, panBy, resizeViewport, zoomAt,
} from './viewport.ts'
import styles from './GraphView.module.css'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'

/** Screen movement below this many px stays a click, not a drag. */
const DRAG_THRESHOLD = 3

/** Translation seat over the sessionGraph namespace. */
type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

interface MergeFailure {
  readonly code: string | undefined
  readonly stage: string | undefined
  readonly message: string
  readonly targetSessionId: SessionId | undefined
}

type MergeRunState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'submitting' }
  | { readonly phase: 'error'; readonly failure: MergeFailure }

/** Preserve only the stable, user-actionable fields exposed by SessionMergeError. */
function mergeFailureOf(error: unknown): MergeFailure {
  if (!(error instanceof Error)) {
    return { code: undefined, stage: undefined, message: String(error), targetSessionId: undefined }
  }
  const details = error as Error & {
    readonly code?: unknown
    readonly stage?: unknown
    readonly targetSessionId?: unknown
  }
  return {
    code: typeof details.code === 'string' ? details.code : undefined,
    stage: typeof details.stage === 'string' ? details.stage : undefined,
    message: error.message,
    targetSessionId: typeof details.targetSessionId === 'string'
      ? details.targetSessionId as SessionId
      : undefined,
  }
}

function mergeFailureKey(failure: MergeFailure): SessionGraphKey {
  if (failure.stage === 'validating') return 'merge.errorValidation'
  if (failure.stage === 'creating') return 'merge.errorCreating'
  if (failure.stage === 'naming') return 'merge.errorNaming'
  if (failure.stage === 'submitting') return 'merge.errorSubmitting'
  if (failure.stage === 'opening') return 'merge.errorOpening'
  return 'merge.errorUnknown'
}

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
/** Conservative detail-card height used for collision-free placement. */
const PREVIEW_H = 112
/** Screen inset occupied by the filter and canvas controls. */
const PREVIEW_TOP_INSET = 56

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

/** Translate the single Display Status derived from overlapping activity facts. */
function displayStatusLabel(status: DisplayStatus | undefined, t: Translate): string {
  if (status === 'running') return t('preview.status.running')
  if (status === 'waiting-input') return t('preview.status.pending')
  if (status === 'completed') return t('preview.status.completed')
  return ''
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

/** One Canvas Session card: title-first hierarchy, state, metadata, and terminals. */
function NodeCard({
  laid, now, t, gestures, clusterColor, selected, onHoverBadge, badgeHovered,
  dimClass, onHoverNode, mergeOrder, ports,
}: {
  laid: LaidOutNode
  ports: readonly ConnectionPort[]
  now: number
  t: Translate
  gestures: NodeGestureHandlers
  clusterColor: string
  selected: boolean
  mergeOrder: number | undefined
  onHoverBadge: (key: string | null) => void
  badgeHovered: boolean
  dimClass: string | null | undefined
  onHoverNode: (key: string | null) => void
}) {
  const { node, key, x, y } = laid
  const session = node.kind === 'knowledge' ? undefined : node
  const source = session?.topicSource
  const badge = session !== undefined && session.subagentCount > 0
    ? `${t('node.subagents', { count: session.subagentCount })}${session.runningSubagents > 0 ? ` (${t('node.running', { count: session.runningSubagents })})` : ''}`
    : ''
  return (
    <>
      <button
        type="button"
        className={clsx(
          styles.node,
          styles.sessionNode,
          node.kind === 'knowledge' ? styles.knowledgeNode : null,
          selected ? styles.nodeSelected : null,
          mergeOrder === undefined ? null : styles.nodeMergeSelected,
          session?.displayStatus === 'waiting-input' ? styles.nodePending : null,
          badgeHovered ? styles.badgeHovered : null,
          dimClass,
        )}
        style={{ left: `${x}px`, top: `${y}px` }}
        data-node-id={key}
        data-node-kind={node.kind ?? 'session'}
        data-display-status={session?.displayStatus}
        data-merge-selected={mergeOrder}
        aria-current={session?.viewed ? 'true' : undefined}
        aria-selected={selected || mergeOrder !== undefined}
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
          className={clsx(styles.dot, session?.displayStatus === 'running' ? styles.dotPulse : null)}
          style={{ background: `var(${clusterColor})` }}
        />
        <span className={styles.body}>
          <span className={styles.title} title={node.title}>
            {session?.blank ? t('node.newSession') : node.title}
          </span>
          <span className={styles.nodeMeta}>
            {node.kind === 'knowledge' ? <span>{t('knowledge.title')} · {t(`knowledge.status.${node.card.revisions.at(-1)!.content.status}`)}</span> : null}
            <span className={clsx(styles.time, source === undefined ? null : styles.topicSourceLabel)}
              title={source?.workspace?.title || source?.cwd}>{source === undefined ? timeLabel(node.updatedAt, now, t)
              : source.workspace?.title || source.cwd || t('topic.noWorkspace')}</span>
            {source?.archived ? <span className={styles.badge}>{t('search.archived')}</span> : null}
            {source?.status === 'unavailable' ? <span className={styles.badge}>{t('topic.unavailable')}</span> : null}
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
        </span>
        {mergeOrder === undefined
          ? null
          : <span className={styles.mergeSelectionOrder} aria-hidden="true">{mergeOrder}</span>}
      </button>
      {ports.map(port => <span
        key={port.id}
        className={clsx(styles.nodePort, dimClass)}
        style={{ left: `${port.x}px`, top: `${port.y}px` }}
        data-session-port={node.kind === 'knowledge' ? undefined : port.direction}
        data-port-id={`${key}:${port.id}`}
        aria-hidden="true"
      />)}
    </>
  )
}

/** The Selected Session summary and its explicit navigation/Branch actions. */
interface ReadyDigestEntry {
  readonly digest: SessionDigest
  readonly sourceUpdatedAt: number
}


type DigestEntry =
  | { readonly phase: 'generating'; readonly requestId: number; readonly previous?: ReadyDigestEntry }
  | { readonly phase: 'ready'; readonly value: ReadyDigestEntry }
  | { readonly phase: 'empty'; readonly sourceUpdatedAt: number }
  | {
    readonly phase: 'error'
    readonly code?: string
    readonly message?: string
    readonly previous?: ReadyDigestEntry
  }

function priorReady(entry: DigestEntry | undefined): ReadyDigestEntry | undefined {
  if (entry?.phase === 'ready') return entry.value
  if (entry?.phase === 'generating' || entry?.phase === 'error') return entry.previous
  return undefined
}

function safeDigestFailure(error: unknown): { readonly code?: string; readonly message?: string } {
  if (!(error instanceof Error)) return {}
  const code = typeof (error as Error & { code?: unknown }).code === 'string'
    ? (error as Error & { code: string }).code
    : undefined
  const message = code === 'model-route-unavailable' || code === 'invalid-model-output'
    ? error.message
    : undefined
  return {
    ...(code === undefined ? {} : { code }),
    ...(message === undefined ? {} : { message }),
  }
}

function digestErrorLabel(code: string | undefined, t: Translate): string {
  if (code === 'model-route-unavailable') return t('digest.errorRoute')
  if (code === 'invalid-model-output') return t('digest.errorOutput')
  if (code === 'output-limit') return t('digest.errorLimit')
  return t('digest.error')
}

/** The structured, explicitly generated digest inside the Selected Session inspector. */
function DigestSection({
  node, entry, now, t, onGenerate,
}: {
  node: SessionGraphNode
  entry: DigestEntry | undefined
  now: number
  t: Translate
  onGenerate: (refresh: boolean) => void
}): ReactElement {
  const ready = priorReady(entry)
  const emptyStale = entry?.phase === 'empty' && node.updatedAt > entry.sourceUpdatedAt
  const stale = (ready !== undefined && node.updatedAt > ready.sourceUpdatedAt) || emptyStale
  const renderReady = ready === undefined
    ? null
    : (
      <div
        className={styles.digestBody}
        data-testid="session-digest-scroll"
      >
        <div className={styles.digestOverview}><ResearchMarkdown text={ready.digest.overview} t={t} /></div>
        {ready.digest.keyOutcomes.length === 0
          ? null
          : (
            <div className={styles.digestGroup}>
              <div className={styles.digestGroupTitle}>{t('digest.outcomes')}</div>
              <ul>{ready.digest.keyOutcomes.map((item, index) => <li key={`${String(index)}:${item}`}><ResearchMarkdown text={item} t={t} /></li>)}</ul>
            </div>
          )}
        {ready.digest.openItems.length === 0
          ? null
          : (
            <div className={styles.digestGroup}>
              <div className={styles.digestGroupTitle}>{t('digest.openItems')}</div>
              <ul>{ready.digest.openItems.map((item, index) => <li key={`${String(index)}:${item}`}><ResearchMarkdown text={item} t={t} /></li>)}</ul>
            </div>
          )}
        <div className={styles.digestMeta}>
          <span>{t('digest.turns', { count: ready.digest.sourceTurnCount })}</span>
          <span>·</span>
          <span>{timeLabel(ready.digest.generatedAt, now, t)}</span>
        </div>
      </div>
    )

  return (
    <section
      className={styles.digestSection}
      aria-label={t('digest.title')}
      data-testid="session-digest-section"
    >
      <div className={styles.digestHeader}>
        <h3 className={styles.digestTitle}>{t('digest.title')}</h3>
        <div className={styles.digestBadges}>
          {ready?.digest.generatedWhileRunning === true
            ? <span className={styles.digestSnapshot}>{t('digest.snapshot')}</span>
            : null}
          {stale ? <span className={styles.digestStale}>{t('digest.stale')}</span> : null}
        </div>
      </div>
      {entry === undefined && !node.blank
        ? (
          <div className={styles.digestEmptyState}>
            <p>{t('digest.intro')}</p>
            <button type="button" className={styles.digestAction} onClick={() => { onGenerate(false) }}>
              {t('digest.generate')}
            </button>
          </div>
        )
        : null}
      {node.blank || entry?.phase === 'empty'
        ? <p className={styles.digestQuiet}>{t('digest.empty')}</p>
        : null}
      {emptyStale
        ? (
          <button type="button" className={styles.digestAction} onClick={() => { onGenerate(false) }}>
            {t('digest.generate')}
          </button>
        )
        : null}
      {entry?.phase === 'generating'
        ? (
          <div className={styles.digestGenerating} role="status" aria-live="polite">
            <span className={styles.digestSpinner} aria-hidden="true" />
            <span>{ready === undefined ? t('digest.generating') : t('digest.refreshing')}</span>
          </div>
        )
        : null}
      {renderReady}
      {entry?.phase === 'ready'
        ? (
          <button type="button" className={styles.digestAction} onClick={() => { onGenerate(true) }}>
            {stale ? t('digest.refresh') : t('digest.regenerate')}
          </button>
        )
        : null}
      {entry?.phase === 'error'
        ? (
          <div
            className={styles.digestFailure}
            role="alert"
            data-error-code={entry.code}
            title={entry.message}
          >
            <span>{digestErrorLabel(entry.code, t)}</span>
            <button type="button" className={styles.digestAction} onClick={() => { onGenerate(ready !== undefined) }}>
              {t('digest.retry')}
            </button>
          </div>
        )
        : null}
    </section>
  )
}

function SelectedSessionPanel({
  node, branchedFrom, mergeSourceTitles, now, t, onOpen, onBranch, onGenerateDigest, onGenerateTitle, onRenameTitle, onReadHistory, onClose, onAddToTopic, workingKey, onUnavailable,
}: {
  node: SessionGraphNode | undefined
  branchedFrom: string | undefined
  mergeSourceTitles: ReadonlyMap<string, string>
  now: number
  t: Translate
  onOpen: GraphViewInjected['openSession']
  onBranch: GraphViewInjected['branchSession']
  onGenerateTitle: GraphViewInjected['generateSessionTitle']
  onRenameTitle: GraphViewInjected['renameSessionTitle']
  onGenerateDigest: GraphViewInjected['generateSessionDigest']
  onReadHistory: GraphViewInjected['readSessionHistory']
  onClose: () => void
  onAddToTopic: ((id: SessionId) => void) | undefined
  workingKey: string | undefined
  onUnavailable: () => void
}): ReactElement | null {
  const [tab, setTab] = useState<'digest' | 'history'>(() => loadWorkingPosition(workingKey).tab ?? 'digest')
  useEffect(() => { saveWorkingPosition(workingKey, { tab }) }, [workingKey, tab])
  const tabId = useId()
  const digestTab = useRef<HTMLButtonElement>(null)
  const historyTab = useRef<HTMLButtonElement>(null)
  const [branchErrorFor, setBranchErrorFor] = useState<SessionId | null>(null)
  const [digestBySession, setDigestBySession] = useState<Record<string, DigestEntry>>({})
  const activeDigestRequests = useRef(new Map<string, {
    readonly requestId: number
    readonly controller: AbortController
  }>())
  const nextDigestRequestId = useRef(0)
  const previousSelectedId = useRef<SessionId | undefined>(undefined)

  useEffect(() => {
    const previous = previousSelectedId.current
    const current = node?.id
    previousSelectedId.current = current
    if (previous === undefined || previous === current) return
    const active = activeDigestRequests.current.get(previous)
    if (active === undefined) return
    active.controller.abort()
    activeDigestRequests.current.delete(previous)
    setDigestBySession(entries => {
      const entry = entries[previous]
      if (entry?.phase !== 'generating' || entry.requestId !== active.requestId) return entries
      const next = { ...entries }
      if (entry.previous === undefined) delete next[previous]
      else next[previous] = { phase: 'ready', value: entry.previous }
      return next
    })
  }, [node?.id])

  useEffect(() => () => {
    for (const active of activeDigestRequests.current.values()) active.controller.abort()
    activeDigestRequests.current.clear()
  }, [])

  const generateDigest = useCallback((refresh: boolean): void => {
    if (node === undefined || node.blank) return
    const sessionId = node.id
    const existing = activeDigestRequests.current.get(sessionId)
    existing?.controller.abort()
    const requestId = nextDigestRequestId.current + 1
    nextDigestRequestId.current = requestId
    const controller = new AbortController()
    activeDigestRequests.current.set(sessionId, { requestId, controller })
    let previous: ReadyDigestEntry | undefined
    setDigestBySession(entries => {
      previous = priorReady(entries[sessionId])
      return {
        ...entries,
        [sessionId]: {
          phase: 'generating',
          requestId,
          ...(previous === undefined ? {} : { previous }),
        },
      }
    })
    void onGenerateDigest(sessionId, { refresh }, controller.signal)
      .then(result => {
        if (activeDigestRequests.current.get(sessionId)?.requestId !== requestId) return
        setDigestBySession(entries => ({
          ...entries,
          [sessionId]: result.kind === 'empty'
            ? { phase: 'empty', sourceUpdatedAt: node.updatedAt }
            : {
              phase: 'ready',
              value: { digest: result.digest, sourceUpdatedAt: node.updatedAt },
            },
        }))
      })
      .catch(error => {
        if (controller.signal.aborted
          || activeDigestRequests.current.get(sessionId)?.requestId !== requestId) return
        const failure = safeDigestFailure(error)
        setDigestBySession(entries => ({
          ...entries,
          [sessionId]: {
            phase: 'error',
            ...failure,
            ...(previous === undefined ? {} : { previous }),
          },
        }))
      })
      .finally(() => {
        if (activeDigestRequests.current.get(sessionId)?.requestId === requestId) {
          activeDigestRequests.current.delete(sessionId)
        }
      })
  }, [node, onGenerateDigest])

  if (node === undefined) return null
  const status = displayStatusLabel(node.displayStatus, t)
  return (
    <InspectorFrame label={t('panel.title')} title={node.blank ? t('node.newSession') : node.title}
      workingKey={workingKey} testId="session-graph-panel" onClose={onClose} t={t}
      meta={<div className={styles.sessionMeta}><div className={styles.panelMeta}>
        <span>{timeLabel(node.updatedAt, now, t)}</span>
        {status === ''
          ? null
          : <span className={styles.panelStatus} data-display-status={node.displayStatus}>{status}</span>}
        {node.subagentCount > 0
          ? <span>{t('panel.subagents', { count: node.subagentCount })}</span>
          : null}
      </div>{node.blank ? null : <SessionTitleControl key={node.id} sessionId={node.id} title={node.title}
        generate={onGenerateTitle} rename={onRenameTitle} t={t} />}</div>}
      tabs={<div
        role="tablist"
        aria-label={t('panel.title')}
        className={styles.historyTabs}
        onKeyDown={event => {
          let next: typeof tab
          if (event.key === 'Home') next = 'digest'
          else if (event.key === 'End') next = 'history'
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            next = tab === 'digest' ? 'history' : 'digest'
          } else return
          event.preventDefault()
          event.stopPropagation()
          setTab(next)
          const nextTab = next === 'digest' ? digestTab : historyTab
          nextTab.current?.focus()
        }}
      >
        <button
          ref={digestTab}
          id={`${tabId}-digest`}
          type="button"
          role="tab"
          aria-selected={tab === 'digest'}
          aria-controls={`${tabId}-content`}
          tabIndex={tab === 'digest' ? 0 : -1}
          onClick={() => { setTab('digest') }}
        >
          {t('digest.title')}
        </button>
        <button
          ref={historyTab}
          id={`${tabId}-history`}
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          aria-controls={`${tabId}-content`}
          tabIndex={tab === 'history' ? 0 : -1}
          onClick={() => { setTab('history') }}
        >
          {t('history.tab')}
        </button>
      </div>}
      actions={<><div className={styles.panelActions}>
        {onAddToTopic === undefined ? null : <button type="button" className={styles.panelSecondaryAction}
          onClick={() => { onAddToTopic(node.id) }}>{t('topic.add')}</button>}
        <button
          type="button"
          className={styles.panelPrimaryAction}
          onClick={() => { onOpen(node.id) }}
        >
          {t('panel.open')}
        </button>
        <button
          type="button"
          className={styles.panelSecondaryAction}
          onClick={() => {
            void onBranch(node.id)
              .then(() => {
                setBranchErrorFor(failedId => failedId === node.id ? null : failedId)
              })
              .catch(() => { setBranchErrorFor(node.id) })
          }}
        >
          {t('panel.branch')}
        </button>
      </div>
      {branchErrorFor === node.id
        ? <div className={styles.panelError} role="alert">{t('panel.branchError')}</div>
        : null}</>}
    >
      {branchedFrom === undefined
        ? null
        : <div className={styles.panelRelation}>{t('node.branchedFrom', { name: branchedFrom })}</div>}
      {node.mergeSources.length === 0
        ? null
        : (
          <section className={styles.mergeRelations} aria-labelledby="session-graph-merge-sources">
            <div id="session-graph-merge-sources" className={styles.mergeRelationsTitle}>
              {t('panel.mergeSources')}
            </div>
            <ol>
              {node.mergeSources.map((source, index) => (
                <li key={source.sessionId}>
                  <span className={styles.mergeSourceOrder}>{index + 1}</span>
                  <span className={styles.mergeRelationSource}>
                    {mergeSourceTitles.get(source.sessionId)
                      ?? t('panel.mergeUnavailable', { id: source.sessionId })}
                  </span>
                  <span className={styles.mergeRelationSnapshot}>
                    {source.capturedThroughSeq === null
                      ? t('panel.mergeCompleteSnapshot')
                      : t('panel.mergeCapturedThrough', { seq: source.capturedThroughSeq })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      <div id={`${tabId}-content`} role="tabpanel" aria-labelledby={`${tabId}-${tab}`}>
        {tab === 'history'
          ? <SessionHistory key={node.id} sourceTitle={node.title} showSourceTitle={false} sessionId={node.id} workingKey={workingKey} onUnavailable={onUnavailable} read={onReadHistory} t={t} />
          : <DigestSection
            node={node}
            entry={digestBySession[node.id]}
            now={now}
            t={t}
            onGenerate={generateDigest}
          />}
      </div>
    </InspectorFrame>
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
 * @param arrangement - the graph scope identity for Session Arrangement persistence.
 * @param now - current epoch ms for relative-time labels.
 * @param t - the namespace translate seat.
 * @param onOpen - open one session node (navigation verb).
 * @returns the canvas element.
 */
export function GraphCanvas({
  laid, clusters, arrangement, now, t, onOpen, onBranch, onGenerateDigest, onGenerateTitle, onRenameTitle, onReadHistory,
  onMerge, onRetryMerge, topic, onAddToTopic, workingKey, toolbarTarget,
}: {
  laid: LaidOutGraph
  clusters: readonly ClusterInfo[]
  arrangement: SessionArrangementIdentity
  now: number
  t: Translate
  onOpen: GraphViewInjected['openSession']
  onBranch: GraphViewInjected['branchSession']
  onGenerateTitle: GraphViewInjected['generateSessionTitle']
  onRenameTitle: GraphViewInjected['renameSessionTitle']
  onGenerateDigest: GraphViewInjected['generateSessionDigest']
  onReadHistory: GraphViewInjected['readSessionHistory']
  onMerge: GraphViewInjected['mergeSessions']
  onRetryMerge: GraphViewInjected['retrySessionMerge']
  onAddToTopic?: (id: SessionId) => void
  topic?: {
    readonly actions?: ReactElement
    readonly arrangement: LayoutState
    readonly onArrange: (state: LayoutState) => void
    readonly renderInspector: (node: GraphNode | undefined, onClose: () => void, onUnavailable: () => void) => ReactElement | null
    readonly openCard?: (cardId: string) => void
  }
  workingKey?: string
  readonly toolbarTarget: HTMLElement | null
}): ReactElement {
  const [restored] = useState(() => loadWorkingPosition(workingKey))
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(() => restored.viewport ?? initialViewport())
  const geometry = useCanvasGeometry(surfaceRef, (previous, next) => {
    setViewport(current => resizeViewport(current, previous, next))
  })
  const viewSize = geometry.room.surface
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  const [positions, setPositions] = useState<Record<string, NodePosition>>({})
  const [collapsed, setCollapsed] = useState<readonly string[]>([])
  const [offsets, setOffsets] = useState<Record<string, ClusterOffset>>({})
  const [relayoutUndo, setRelayoutUndo] = useState<LayoutState | null>(null)
  const [restoredArrangementKey, setRestoredArrangementKey] = useState<string | null>(null)
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
    position: NodePosition | undefined
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
    offset: ClusterOffset
  } | null>(null)
  const suppressClickRef = useRef(false)
  const [selected, setSelected] = useState<string | null>(restored.selected ?? null)
  const restoringSelection = useRef(restored.selected)
  const [unavailableSelection, setUnavailableSelection] = useState(false)
  useEffect(() => {
    if (selected === null) return
    const node = laid.nodes.find(entry => entry.key === selected)?.node
    const restoring = restoringSelection.current === selected
    restoringSelection.current = undefined
    if (node !== undefined && !(restoring && node.kind !== 'knowledge' && node.topicSource?.status === 'unavailable' && node.retainedSource === undefined)) return
    setSelected(null)
    setUnavailableSelection(true)
  }, [selected, laid])
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSources, setMergeSources] = useState<readonly SessionId[]>([])
  const [mergeInstruction, setMergeInstruction] = useState('')
  const [mergeRun, setMergeRun] = useState<MergeRunState>({ phase: 'idle' })
  const mergeRequestRef = useRef<AbortController | null>(null)
  useEffect(() => () => { mergeRequestRef.current?.abort() }, [])
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
    if (selected === key) {
      hidePreview()
      return
    }
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
  const [query, setQuery] = useState(restored.query ?? '')
  useEffect(() => { saveWorkingPosition(workingKey, { viewport, selected, query }) }, [workingKey, viewport, selected, query])
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

  // Restore the Session Arrangement on scope entry; a corrupt or absent
  // record leaves the automatic arrangement in place.
  useEffect(() => {
    const stored = topic?.arrangement ?? loadArrangement(arrangement)
    setRelayoutUndo(null)
    setPositions(stored?.positions ?? {})
    setCollapsed(stored?.collapsed ?? [])
    setOffsets(stored?.offsets ?? {})
    setRestoredArrangementKey(arrangement.key)
  }, [arrangement.key, arrangement.legacyKey])

  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed])
  // Fit once on scope entry so the whole graph is visible (manual layouts
  // fit the manual bounds, the auto grid fits its own).
  const fittedRef = useRef(false)
  useEffect(() => {
    fittedRef.current = restored.viewport !== undefined
  }, [arrangement.key])

  // Arrow-key navigation: move focus to the geometrically nearest node in
  // the pressed direction, following the layout as it stands.
  const moveFocus = (direction: 'left' | 'right' | 'up' | 'down'): void => {
    const active = document.activeElement?.closest('[data-node-id]') as HTMLElement | null
    const from = active !== null
      ? shown.nodes.find(entry => entry.key === active.dataset.nodeId)
      : shown.nodes.find(entry => entry.node.kind !== 'knowledge' && entry.node.viewed) ?? shown.nodes[0]
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
  const edgeLabels = useMemo(() => {
    const labels = new Map<string, { readonly edgeId: string; readonly count: number }>()
    for (const { edge } of laid.edges) {
      if (edge.kind !== 'synthesis') continue
      const previous = labels.get(edge.to)
      labels.set(edge.to, { edgeId: previous?.edgeId ?? edge.id, count: (previous?.count ?? 0) + 1 })
    }
    return new Map([...labels.values()].map(label => [label.edgeId, t('synthesis.relationCount', { count: label.count })]))
  }, [laid, t])
  const { shown, frames, bounds, automaticBounds } = useMemo(
    () => deriveCanvasPresentation({
      laid,
      clusters,
      positions,
      collapsed: collapsedSet,
      offsets,
      labels: edgeLabels,
    }),
    [laid, positions, clusters, collapsedSet, offsets, edgeLabels],
  )
  const shownByKey = useMemo(() => new Map(shown.nodes.map(node => [node.key, node])), [shown])
  useEffect(() => {
    if (restoredArrangementKey !== arrangement.key || fittedRef.current) return
    // The conversation shell measures its composer after the first paint.
    // Read the resulting graph surface on the following settled frame.
    let settledFrame: number | undefined
    const layoutFrame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => {
        const room = geometry.read()?.command
        if (room === undefined) return
        fittedRef.current = true
        setViewport(fitViewport(bounds, room.width, room.height, FIT_PADDING))
      })
    })
    return () => {
      window.cancelAnimationFrame(layoutFrame)
      if (settledFrame !== undefined) window.cancelAnimationFrame(settledFrame)
    }
  // bounds must not retrigger the one-shot fit after the scope changed (the
  // fittedRef guard above owns that).
  }, [arrangement.key, bounds, restoredArrangementKey])
  // One palette slot per cluster, by cluster order — the single source for
  // node dots and frame accents alike.
  const singletonClusters = useMemo(() => new Set(clusters
    .filter(cluster => cluster.memberIds.length === 1).map(cluster => cluster.rootId)), [clusters])
  const colorOfCluster = useMemo(() => {
    const map = new Map<string, string>()
    clusters.forEach((cluster, index) => {
      map.set(cluster.rootId, CLUSTER_COLORS[index % CLUSTER_COLORS.length] ?? '--dsw-alias-border-l2')
    })
    return map
  }, [clusters])
  // The incoming Branch edge names each member's Branch source.
  const branchSource = useMemo(() => {
    const titleOf = new Map(shown.nodes.map(entry => [entry.key, entry.node.title]))
    const map = new Map<string, string>()
    for (const { edge } of shown.edges) {
      if (edge.kind !== 'branch') continue
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

  // Branch Lineage emphasis: an active filter wins, followed by transient
  // edge/node hover. Selection remains as the stable fallback when the
  // pointer leaves so the inspector and canvas tell the same story.
  const emphasis = useMemo((): {
    keys: ReadonlySet<string>
    mode: 'filter' | 'context'
  } | null => {
    if (filterMatches !== null) return { keys: filterMatches, mode: 'filter' }
    if (hoverEdge !== null) {
      const found = shown.edges.find(entry => entry.edge.id === hoverEdge)
      return found === undefined
        ? null
        : { keys: new Set([found.edge.from, found.edge.to]), mode: 'context' }
    }
    const focusKey = hoverNode ?? selected
    if (focusKey === null) return null
    const set = new Set(branchLineage(shown.nodes.map(entry => entry.node), focusKey))
    if (topic !== undefined) {
      for (const { edge } of shown.edges) {
        if (edge.from === focusKey || edge.to === focusKey) { set.add(edge.from); set.add(edge.to) }
      }
    }
    return set.size === 0 ? null : { keys: set, mode: 'context' }
  }, [filterMatches, hoverEdge, hoverNode, selected, shown, topic !== undefined])
  const dimStyle = emphasis?.mode === 'filter' ? styles.dimFilter : styles.dimContext
  const emphasizedClusters = useMemo(() => new Set(shown.nodes
    .filter(entry => emphasis?.keys.has(entry.key))
    .map(entry => entry.node.clusterId)), [shown, emphasis])
  const dimmed = (key: string): boolean => emphasis !== null && !emphasis.keys.has(key)
  const edgeDimmed = (from: string, to: string): boolean =>
    emphasis !== null && !(emphasis.keys.has(from) && emphasis.keys.has(to))
  const frameDimmed = (clusterId: string): boolean =>
    emphasis !== null && !emphasizedClusters.has(clusterId as SessionId)

  /** Persist one layout revision, pruned to the live node and cluster ids. */
  const persist = (
    nextPositions: Record<string, NodePosition>,
    nextCollapsed: readonly string[],
    nextOffsets: Record<string, ClusterOffset>,
  ): void => {
    setRelayoutUndo(null)
    const knownNodes = new Set(shown.nodes.map(node => node.key))
    const knownClusters = new Set<string>(clusters.map(cluster => cluster.rootId))
    const state: LayoutState = {
      positions: Object.fromEntries(
        Object.entries(nextPositions).filter(([key]) => knownNodes.has(key)),
      ),
      collapsed: nextCollapsed.filter(rootId => knownClusters.has(rootId)),
      offsets: Object.fromEntries(
        Object.entries(nextOffsets).filter(([key]) => knownClusters.has(key)),
      ),
    }
    if (topic === undefined) saveLayout(arrangement.key, state)
    else topic.onArrange(state)
  }

  const toContent = (screenX: number, screenY: number): { x: number; y: number } => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect === undefined) return { x: screenX, y: screenY }
    return {
      x: (screenX - rect.left - viewport.panX) / viewport.scale,
      y: (screenY - rect.top - viewport.panY) / viewport.scale,
    }
  }

  const nodeGestures = (id: string, clusterId: string, originX: number, originY: number): NodeGestureHandlers => ({
    onPointerDown: (event) => {
      hidePreview()
      // A new pointer sequence cannot be the prior drag's trailing click.
      // Clear a suppression token that no browser click consumed.
      suppressClickRef.current = false
      if (mergeMode) return
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
        position: undefined,
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
      const position = {
        x: snapped.x - (offset?.dx ?? 0),
        y: snapped.y - (offset?.dy ?? 0),
      }
      drag.position = position
      setPositions(current => ({
        ...current,
        [drag.key]: position,
      }))
    },
    onPointerUp: (event) => {
      const drag = nodeDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      nodeDragRef.current = null
      setGuides(null)
      if (!drag.moved || drag.position === undefined) return
      suppressClickRef.current = true
      // Release can precede React's next render, so commit the gesture's final sample.
      persist({ ...positionsRef.current, [drag.key]: drag.position }, collapsedRef.current, offsetsRef.current)
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
      hidePreview()
      if (mergeMode) {
        if (mergeRun.phase === 'submitting'
          || (mergeRun.phase === 'error' && mergeRun.failure.targetSessionId !== undefined)) return
        const node = shownByKey.get(id)?.node
        if (node === undefined || node.kind === 'knowledge') return
        setMergeSources(current => current.includes(node.id)
          ? current.filter(sourceId => sourceId !== node.id)
          : current.length < 3 ? [...current, node.id] : current)
        setMergeRun({ phase: 'idle' })
        return
      }
      setSelected(id)
    },
    onDoubleClick: () => {
      if (mergeMode) return
      const node = shownByKey.get(id)?.node
      if (node?.kind === 'knowledge') topic?.openCard?.(node.card.cardId)
      else if (node !== undefined) onOpen(node.id)
    },
  })

  const closeInspector = (): void => {
    const node = [...(surfaceRef.current?.querySelectorAll<HTMLElement>('[data-node-id]') ?? [])]
      .find(element => element.dataset.nodeId === selected)
    setSelected(null)
    queueMicrotask(() => { (node ?? surfaceRef.current)?.focus({ preventScroll: true }) })
  }

  // Wheel is non-passive so the canvas can swallow the gesture before the
  // page scrolls; React's synthetic listener cannot opt out.
  useEffect(() => {
    const surface = surfaceRef.current
    if (surface === null) return
    const onWheel = (event: WheelEvent): void => {
      if (event.target instanceof Element
        && event.target.closest('[data-canvas-overlay]') !== null) return
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
    if ((event.target as HTMLElement).closest('[data-canvas-overlay], [data-node-id], [data-cluster-title], input, button, select, textarea, svg') !== null) return
    hidePreview()
    setSelected(null)
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
    const room = geometry.read()?.command
    if (room === undefined) return
    setViewport(current => zoomAt(current, room.width / 2, room.height / 2, factor))
  }

  /** Fit one complete content box into the current surface. */
  const fitBounds = (target: ContentBounds): void => {
    const room = geometry.read()?.command
    if (room === undefined) return
    glide()
    setViewport(fitViewport(target, room.width, room.height, FIT_PADDING))
  }

  const fit = (): void => { fitBounds(bounds) }

  /** Re-run the auto layout: manual positions and cluster offsets clear, collapsed clusters keep. */
  const relayout = (): void => {
    // A repeated click must retain the last useful undo, not replace it with
    // the already automatic arrangement.
    const previous = Object.keys(positionsRef.current).length || Object.keys(offsetsRef.current).length
      ? { positions: positionsRef.current, collapsed: collapsedRef.current, offsets: offsetsRef.current }
      : relayoutUndo
    setPositions({})
    setOffsets({})
    persist({}, collapsedRef.current, {})
    setRelayoutUndo(previous)
  }

  const undoRelayout = (): void => {
    if (relayoutUndo === null) return
    setPositions({ ...relayoutUndo.positions })
    setOffsets({ ...relayoutUndo.offsets })
    persist(relayoutUndo.positions, collapsedRef.current, relayoutUndo.offsets)
  }

  /** Back to the initial state: manual layout and collapse cleared, then fit. */
  const reset = (): void => {
    setPositions({})
    setCollapsed([])
    setOffsets({})
    persist({}, [], {})
    fitBounds(automaticBounds)
  }

  /** Center the viewport on one content point (the minimap verb). */
  const recenter = (contentX: number, contentY: number): void => {
    const room = geometry.read()?.command
    if (room === undefined) return
    setViewport(current => ({
      ...current,
      panX: room.width / 2 - contentX * current.scale,
      panY: room.height / 2 - contentY * current.scale,
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

  // The map earns its space only when some graph content is outside the
  // visible surface. Keep it during the unmeasured first paint, then let
  // fit/recenter/gesture renders decide from the live viewport geometry.
  const screenBounds = {
    left: viewport.panX + bounds.x * viewport.scale,
    top: viewport.panY + bounds.y * viewport.scale,
    right: viewport.panX + (bounds.x + bounds.width) * viewport.scale,
    bottom: viewport.panY + (bounds.y + bounds.height) * viewport.scale,
  }
  const showMinimap = viewSize.width <= 0 || viewSize.height <= 0
    || screenBounds.left < -1
    || screenBounds.top < -1
    || screenBounds.right > viewSize.width + 1
    || screenBounds.bottom > viewSize.height + 1

  const toggleCluster = (rootId: string): void => {
    const next = collapsedSet.has(rootId)
      ? collapsed.filter(entry => entry !== rootId)
      : [...collapsed, rootId]
    setCollapsed(next)
    persist(positionsRef.current, next, offsetsRef.current)
  }

  const closeMerge = (): void => {
    if (mergeRun.phase === 'submitting') return
    mergeRequestRef.current?.abort()
    mergeRequestRef.current = null
    setMergeMode(false)
    setMergeSources([])
    setMergeRun({ phase: 'idle' })
  }

  const submitMerge = (): void => {
    if (mergeSources.length < 2 || mergeSources.length > 3
      || mergeInstruction.trim() === '' || containsSessionReferenceUri(mergeInstruction)
      || mergeRun.phase === 'submitting') return
    const controller = new AbortController()
    mergeRequestRef.current?.abort()
    mergeRequestRef.current = controller
    const failedTarget = mergeRun.phase === 'error'
      ? mergeRun.failure.targetSessionId
      : undefined
    setMergeRun({ phase: 'submitting' })
    const request = failedTarget === undefined
      ? onMerge(mergeSources, mergeInstruction, controller.signal)
      : onRetryMerge(failedTarget, mergeSources, mergeInstruction, controller.signal)
    void request
      .then(() => {
        if (mergeRequestRef.current !== controller || controller.signal.aborted) return
        mergeRequestRef.current = null
        setMergeMode(false)
        setMergeSources([])
        setMergeRun({ phase: 'idle' })
      })
      .catch(error => {
        if (mergeRequestRef.current !== controller || controller.signal.aborted) return
        mergeRequestRef.current = null
        setMergeRun({ phase: 'error', failure: mergeFailureOf(error) })
      })
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
        offset: offsetsRef.current[clusterId] ?? { dx: 0, dy: 0 },
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
      // Accumulate samples on the gesture even when React batches several moves.
      const dx = (event.clientX - drag.lastX) / viewport.scale
      const dy = (event.clientY - drag.lastY) / viewport.scale
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      const offset = { dx: drag.offset.dx + dx, dy: drag.offset.dy + dy }
      drag.offset = offset
      setOffsets(current => ({ ...current, [drag.clusterId]: offset }))
    },
    onPointerUp: (event) => {
      const drag = clusterDragRef.current
      if (drag === null || drag.pointerId !== event.pointerId) return
      clusterDragRef.current = null
      if (!drag.moved) return
      persist(positionsRef.current, collapsedRef.current, { ...offsetsRef.current, [drag.clusterId]: drag.offset })
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
      data-reader-open={geometry.room.readerOpen}
      role="group"
      aria-label={t('canvas.description')}
      tabIndex={-1}
      style={{
        backgroundImage: 'radial-gradient(var(--dsw-alias-border-l2) 1px, transparent 1px)',
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
        if (event.key === 'Escape') {
          hidePreview()
          setSelected(null)
          return
        }
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
        {frames.filter(frame => !singletonClusters.has(frame.clusterId)).map(frame => (
          <div
            key={frame.clusterId}
            className={clsx(
              styles.frame,
              frameDimmed(frame.clusterId) ? dimStyle : null,
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
          {shown.edges.map(({ edge, path, arrowPath, label }) => {
            const merge = edge.kind === 'merge'
            return (
              <g
                key={edge.id}
                data-relation-id={edge.reuse?.operationId}
                className={clsx(
                  styles.edgeGroup,
                  edgeDimmed(edge.from, edge.to) ? dimStyle : null,
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
                <path
                  className={edge.kind === 'synthesis' ? styles.edgeSynthesis : edge.kind === 'reuse' ? styles.edgeReuse : edge.kind === 'source' ? styles.edgeSource : merge ? styles.edgeMerge : styles.edgeBranch}
                  data-edge-kind={edge.kind}
                  d={path}
                />
                {edge.kind === 'reuse' ? <title>{t('workbench.reuseEdge')}{edge.reuse?.revisionNumber === undefined ? '' : ` · ${t('knowledge.versionNumber', { number: edge.reuse.revisionNumber })}`}</title> : null}
                {edge.kind === 'synthesis' ? <title>{t('synthesis.relation')} · {t('knowledge.versionNumber', { number: edge.synthesis?.revisionNumber })}</title> : null}
                {label ? <text className={styles.edgeLabel} textAnchor="middle" dominantBaseline="central"
                  x={label.x} y={label.y}>{label.text}</text> : null}
                <path
                  className={merge ? styles.edgeMergeArrow : styles.edgeBranchArrow}
                  d={arrowPath}
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
                data-edge-kind="subagent-derivation"
                strokeDasharray="6 4"
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
            ports={shown.ports.get(laidNode.key) ?? []}
            now={now}
            t={t}
            gestures={nodeGestures(laidNode.node.id, laidNode.node.clusterId, laidNode.x, laidNode.y)}
            selected={selected === laidNode.node.id}
            mergeOrder={laidNode.node.kind !== 'knowledge' && mergeSources.includes(laidNode.node.id)
              ? mergeSources.indexOf(laidNode.node.id) + 1
              : undefined}
            onHoverBadge={setBadgeHover}
            badgeHovered={badgeHover === laidNode.key}
            dimClass={dimmed(laidNode.key) ? dimStyle : null}
            onHoverNode={(key) => {
              if (key === null) nodeLeave()
              else nodeEnter(key)
            }}
            clusterColor={colorOfCluster.get(laidNode.node.clusterId)
              ?? (laidNode.node.clusterId === laidNode.node.id ? '--dsw-alias-label-dimmed' : '--dsw-alias-border-l2')}
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
      {toolbarTarget === null ? null : createPortal(<div className={styles.controls} data-canvas-overlay="" role="group" aria-label={t('toolbar.label')}
        onPointerDown={event => { event.stopPropagation() }} onKeyDown={event => { event.stopPropagation() }}>
        <div className={styles.canvasZoom}>
          <button type="button" aria-label={t('toolbar.zoomOut')} onClick={() => { zoomFromCenter(1 / CONTROL_STEP) }}>−</button>
          <button type="button" aria-label={t('toolbar.zoomLevel')} onClick={zoomToIdentity}>
            {`${Math.round(viewport.scale * 100)}%`}
          </button>
          <button type="button" aria-label={t('toolbar.zoomIn')} onClick={() => { zoomFromCenter(CONTROL_STEP) }}>+</button>
        </div>
        <div className={styles.canvasNavigation}>
          <span className={styles.controlDivider} aria-hidden="true" />
          <button type="button" aria-label={t('toolbar.fit')} onClick={fit}>{t('toolbar.fit')}</button>
          <button
            type="button"
            aria-label={t('toolbar.locate')}
            onClick={() => {
              const viewed = shown.nodes.find(entry => entry.node.kind !== 'knowledge' && entry.node.viewed)
              if (viewed !== undefined) locateNode(viewed.key)
            }}
          >
            {t('toolbar.locate')}
          </button>
        </div>
        <span className={styles.controlDivider} aria-hidden="true" />
        <ActionMenu label={t('reading.canvasOptions')}>
          <div className={styles.canvasMenuZoom} data-menu-keep-open="" role="group" aria-label={t('reading.zoom')}>
            <button type="button" aria-label={t('toolbar.zoomOut')} onClick={() => { zoomFromCenter(1 / CONTROL_STEP) }}>−</button>
            <button type="button" aria-label={t('toolbar.zoomLevel')} onClick={zoomToIdentity}>{`${Math.round(viewport.scale * 100)}%`}</button>
            <button type="button" aria-label={t('toolbar.zoomIn')} onClick={() => { zoomFromCenter(CONTROL_STEP) }}>+</button>
          </div>
          <div className={styles.canvasMenuNavigation}>
            <button type="button" onClick={fit}>{t('toolbar.fit')}</button>
            <button type="button" onClick={() => {
              const viewed = shown.nodes.find(entry => entry.node.kind !== 'knowledge' && entry.node.viewed)
              if (viewed !== undefined) locateNode(viewed.key)
            }}>{t('toolbar.locate')}</button>
          </div>
          <button type="button" onClick={relayout}>{t('toolbar.relayout')}</button>
          {relayoutUndo === null ? null : <button type="button" onClick={undoRelayout}>{t('toolbar.undoRelayout')}</button>}
          <button type="button" onClick={reset}>{t('toolbar.reset')}</button>
          {topic?.actions}
          {topic === undefined ? <button
            type="button"
            className={styles.mergeToolbarAction}
            aria-label={t('toolbar.merge')}
            aria-pressed={mergeMode}
            disabled={mergeRun.phase === 'submitting'}
            onClick={() => {
              if (mergeMode) {
                closeMerge()
                return
              }
              hidePreview()
              setSelected(null)
              setMergeSources([])
              setMergeInstruction(t('merge.defaultInstruction'))
              setMergeRun({ phase: 'idle' })
              setMergeMode(true)
            }}
          >
            {t('toolbar.merge')}
          </button> : null}
          <div className={styles.canvasLegend} aria-label={t('reading.legend')}>
            <span><i className={styles.legendLineDerivation} />{t('legend.derivation')}</span>
            <span><i className={styles.legendLineBranch} />{t('legend.branch')}</span>
            <span><i className={styles.legendLineMerge} />{t('legend.merge')}</span>
            {topic === undefined ? null : <><span><i className={styles.legendSource} />{t('knowledge.sourceRelation')}</span>
              <span><i className={styles.legendReuse} />{t('workbench.reuseEdge')}</span></>}
          </div>
        </ActionMenu>
      </div>, toolbarTarget)}
      {mergeMode
        ? (
          <div
            className={clsx(styles.panel, styles.mergePanel)}
            role="dialog"
            aria-label={t('merge.title')}
            data-canvas-overlay=""
          >
            <div className={styles.panelHeader}>
              <div className={styles.panelHeading}>{t('merge.title')}</div>
              <button
                type="button"
                className={styles.panelClose}
                aria-label={t('merge.close')}
                disabled={mergeRun.phase === 'submitting'}
                onClick={closeMerge}
              >
                ×
              </button>
            </div>
            <p className={styles.mergeIntro}>{t('merge.intro')}</p>
            {mergeRun.phase === 'submitting'
              ? (
                <div className={styles.mergeProgress} role="status" aria-live="polite">
                  <span className={styles.digestSpinner} aria-hidden="true" />
                  <span>{t('merge.submitting')}</span>
                </div>
              )
              : (
                <div className={styles.mergeCount} role="status" aria-live="polite">
                  {t('merge.selectedCount', { count: mergeSources.length })}
                </div>
              )}
            {mergeRun.phase === 'error'
              ? (
                <div
                  className={styles.mergeFailure}
                  role="alert"
                  data-error-code={mergeRun.failure.code}
                  data-error-stage={mergeRun.failure.stage}
                  title={mergeRun.failure.message}
                >
                  <span>{t(mergeFailureKey(mergeRun.failure))}</span>
                  {mergeRun.failure.targetSessionId === undefined
                    ? null
                    : <span>{t('merge.targetKept')}</span>}
                </div>
              )
              : null}
            <ol className={styles.mergeSourceList}>
              {mergeSources.map((sourceId, index) => {
                const source = shown.nodes.find(entry => entry.node.id === sourceId)?.node
                return (
                  <li key={sourceId}>
                    <span className={styles.mergeSourceOrder}>{index + 1}</span>
                    <span>{source?.title ?? sourceId}</span>
                    <button
                      type="button"
                      disabled={mergeRun.phase === 'submitting'
                        || (mergeRun.phase === 'error'
                          && mergeRun.failure.targetSessionId !== undefined)}
                      aria-label={t('merge.remove', { name: source?.title ?? sourceId })}
                      onClick={() => {
                        setMergeSources(current => current.filter(id => id !== sourceId))
                        if (mergeRun.phase === 'error') setMergeRun({ phase: 'idle' })
                      }}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ol>
            <label className={styles.mergeInstructionLabel}>
              <span>{t('merge.instruction')}</span>
              <textarea
                value={mergeInstruction}
                aria-label={t('merge.instruction')}
                rows={4}
                disabled={mergeRun.phase === 'submitting'
                  || (mergeRun.phase === 'error'
                    && mergeRun.failure.targetSessionId !== undefined)}
                onChange={(event) => {
                  setMergeInstruction(event.target.value)
                  if (mergeRun.phase === 'error') setMergeRun({ phase: 'idle' })
                }}
              />
              {containsSessionReferenceUri(mergeInstruction)
                ? (
                  <span className={styles.mergeInstructionError} role="alert">
                    {t('merge.referenceInstruction')}
                  </span>
                )
                : null}
            </label>
            {mergeRun.phase === 'error' && mergeRun.failure.targetSessionId !== undefined
              ? (
                <button
                  type="button"
                  className={styles.mergeOpenTarget}
                  onClick={() => { onOpen(mergeRun.failure.targetSessionId!) }}
                >
                  {t('merge.openTarget')}
                </button>
              )
              : null}
            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.panelSecondaryAction}
                disabled={mergeRun.phase === 'submitting'}
                onClick={closeMerge}
              >
                {t('merge.cancel')}
              </button>
              <button
                type="button"
                className={styles.panelPrimaryAction}
                disabled={mergeSources.length < 2 || mergeInstruction.trim() === ''
                  || containsSessionReferenceUri(mergeInstruction)
                  || mergeRun.phase === 'submitting'}
                onClick={submitMerge}
              >
                {mergeRun.phase === 'error' ? t('merge.retry') : t('merge.submit')}
              </button>
            </div>
          </div>
        )
        : null}
      {topic === undefined ? <SelectedSessionPanel
        workingKey={workingKey}
        onUnavailable={() => { setSelected(null); setUnavailableSelection(true) }}
        onAddToTopic={onAddToTopic}
        node={mergeMode || selectedNode?.kind === 'knowledge' ? undefined : selectedNode}
        branchedFrom={selected === null ? undefined : branchSource.get(selected)}
        mergeSourceTitles={new Map(shown.nodes.map(entry => [entry.key, entry.node.title]))}
        now={now}
        t={t}
        onOpen={onOpen}
        onBranch={onBranch}
        onGenerateTitle={onGenerateTitle}
        onRenameTitle={onRenameTitle}
        onGenerateDigest={onGenerateDigest}
        onReadHistory={onReadHistory}
        onClose={closeInspector}
      /> : topic.renderInspector(selectedNode, closeInspector, () => { setSelected(null); setUnavailableSelection(true) })}
      {topic === undefined && shown.nodes.length === 1 && selectedNode === undefined && !mergeMode ? <div className={styles.firstDiscovery} data-canvas-overlay="">
        <span className={styles.workbenchEyebrow}>{t('reading.discussionCount', { count: 1 })}</span>
        <h2>{t('reading.firstTitle')}</h2><p>{t('reading.firstHint')}</p>
        <button type="button" onClick={() => { setSelected(shown.nodes[0]!.node.id) }}>{t('reading.openDiscussion')} <span aria-hidden="true">→</span></button>
      </div> : null}
      {unavailableSelection ? <div className={styles.reuseNotice} data-canvas-overlay="" role="status">{t('position.unavailable')}
        <button type="button" onClick={() => { setUnavailableSelection(false) }}>{t('panel.close')}</button></div> : null}
      {showMinimap
        ? (
          <Minimap
            shown={shown}
            frames={frames}
            bounds={bounds}
            viewport={viewport}
            viewSize={viewSize}
            onRecenter={recenter}
            t={t}
          />
        )
        : null}
      {(() => {
        // The hover detail card lives in screen space and chooses a free side
        // around its node while respecting canvas chrome and the inspector.
        if (previewKey === null) return null
        const entry = shown.nodes.find(item => item.key === previewKey)
        if (entry === undefined) return null
        const placement = placePreview({
          anchor: {
            x: viewport.panX + entry.x * viewport.scale,
            y: viewport.panY + entry.y * viewport.scale,
            width: NODE_W * viewport.scale,
            height: CARD_H * viewport.scale,
          },
          preview: { width: PREVIEW_W, height: PREVIEW_H },
          surface: viewSize,
          insets: {
            top: PREVIEW_TOP_INSET,
            right: geometry.read()?.previewRight ?? 12,
          },
        })
        const session = entry.node.kind === 'knowledge' ? undefined : entry.node
        const status = displayStatusLabel(session?.displayStatus, t)
        const branched = branchSource.get(entry.key)
        return (
          <div
            className={styles.preview}
            style={{ left: `${placement.x}px`, top: `${placement.y}px` }}
            data-testid="session-graph-preview"
            data-placement={placement.side}
            aria-hidden="true"
          >
            <div className={styles.previewTitle}>
              {session?.blank ? t('node.newSession') : entry.node.title}
            </div>
            {status !== '' ? <div className={styles.previewStatus}>{status}</div> : null}
            <div className={styles.previewMeta}>
              {timeLabel(entry.node.updatedAt, now, t)}
              {session !== undefined && session.subagentCount > 0
                ? ` · ${t('panel.subagents', { count: session.subagentCount })}`
                : ''}
            </div>
            {branched !== undefined
              ? <div className={styles.previewMeta}>{t('node.branchedFrom', { name: branched })}</div>
              : null}
          </div>
        )
      })()}
    </div>
  )
}
