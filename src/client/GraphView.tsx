/**
 * The session-graph view tab body: a workspace-scoped lineage forest of
 * session nodes (fork edges between attached rows, subagent derivation
 * folded into per-node badges). Derives from the sessions/workspaces
 * standard feeds; selection stays in the graph while double-click and the
 * details panel navigate through the sessions verbs.
 */
import { useMemo, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { GraphCanvas } from './GraphCanvas.tsx'
import { deriveSessionGraph, resolveWorkspaceScope } from './graph-model.ts'
import { layoutSessionGraph } from './layout.ts'
import styles from './GraphView.module.css'

/** Business face the browser entry injects into the view (navigation verbs). */
export interface GraphViewInjected {
  /** Open one session on its own last view (double-click and panel verb). */
  openSession: (id: SessionId) => void
  /** Fork a new branch from one session (the panel's New-branch verb). */
  branchSession: (id: SessionId) => void
}

/** The graph view tab's composed props: runtime share + inject face + locale. */
export type GraphViewProps =
  ConvViewProps
  & InjectFace<GraphViewInjected>
  & PropsLocale<'sessionGraph'>

/**
 * Render the session graph tab body.
 * @param props - the composed view props (standard kit, inject face, locale seat).
 * @returns the tab body element.
 */
export function GraphView({
  sessionId, useSessions, useSessionPendingInteraction, useWorkspaces,
  openSession, branchSession, t,
}: GraphViewProps): ReactElement {
  const sessions = useSessions(state => state)
  const pendingInteractions = useSessionPendingInteraction(state => state)
  const workspaces = useWorkspaces(state => state)

  const scope = useMemo(
    () => resolveWorkspaceScope(sessionId, sessions, workspaces),
    [sessionId, sessions, workspaces],
  )
  const graph = useMemo(
    () => deriveSessionGraph(sessions, scope, sessionId, pendingInteractions),
    [sessions, scope, sessionId, pendingInteractions],
  )
  const laid = useMemo(() => layoutSessionGraph(graph), [graph])

  const now = Date.now()

  if (scope === undefined) {
    return <div className={styles.root}><div className={styles.empty}>{t('empty.outside')}</div></div>
  }
  if (graph.nodes.size === 0) {
    return <div className={styles.root}><div className={styles.empty}>{t('empty.none')}</div></div>
  }

  return (
    // The free canvas owns its viewport. Extend the view behind the floating
    // composer so GraphCanvas's live clearance reserves the seat exactly once.
    <div className={styles.root} data-conversation-composer-overlay="">
      <div className={styles.header}>
        <span className={styles.count}>
          {t('workspace.count', {
            name: scope.label ?? t('workspace.untitled'),
            count: graph.sessionCount,
          })}
        </span>
        <span className={styles.legend} aria-hidden="true">
          <span className={styles.legendLineArrow} />
          {t('legend.derivation')}
          <span className={styles.legendLineDashed} />
          {t('legend.branch')}
        </span>
      </div>
      <GraphCanvas
        laid={laid}
        clusters={graph.clusters}
        scopeKey={scope.path}
        now={now}
        t={t}
        onOpen={openSession}
        onBranch={branchSession}
      />
    </div>
  )
}
