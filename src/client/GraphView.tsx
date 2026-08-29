/**
 * The Session Graph tab body: a scope-bound lineage forest of Canvas Sessions
 * (Branch edges between attached nodes, Subagent Derivations folded into
 * Subagent Summary badges). Derives from the sessions/workspaces
 * standard feeds; selection stays in the graph while double-click and the
 * details panel navigate through the sessions verbs.
 */
import { useMemo, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionDigestResult } from '../session-digest.ts'
import { SESSION_GRAPH_BUILD_LABEL, SESSION_GRAPH_BUILD_TITLE } from './build-info.ts'
import { GraphCanvas } from './GraphCanvas.tsx'
import { deriveSessionGraph, resolveGraphScope } from './graph-model.ts'
import { layoutSessionGraph } from './layout.ts'
import styles from './GraphView.module.css'

/** Business face the browser entry injects into the view (navigation verbs). */
export interface GraphViewInjected {
  /** Open one session on its own last view (double-click and panel verb). */
  openSession: (id: SessionId) => void
  /** Create a Branch from one session (the panel's New-branch verb). */
  branchSession: (id: SessionId) => Promise<void>
  /** Explicitly generate or refresh one read-only Session Digest. */
  generateSessionDigest: (
    id: SessionId,
    options: { readonly refresh: boolean },
    signal: AbortSignal,
  ) => Promise<SessionDigestResult>
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
  openSession, branchSession, generateSessionDigest, t,
}: GraphViewProps): ReactElement {
  const sessions = useSessions(state => state)
  const pendingInteractions = useSessionPendingInteraction(state => state)
  const workspaces = useWorkspaces(state => state)

  const scope = useMemo(
    () => resolveGraphScope(sessionId, sessions, workspaces),
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
          {scope.kind === 'workspace'
            ? t('scope.workspaceCount', { name: scope.label, count: graph.sessionCount })
            : t('scope.directoryCount', { count: graph.sessionCount })}
        </span>
        <span className={styles.legend} aria-hidden="true">
          <span className={styles.legendLineDerivation} />
          {t('legend.derivation')}
          <span className={styles.legendLineBranch} />
          {t('legend.branch')}
        </span>
        <span className={styles.buildInfo} title={SESSION_GRAPH_BUILD_TITLE}>
          {SESSION_GRAPH_BUILD_LABEL}
        </span>
      </div>
      <GraphCanvas
        laid={laid}
        clusters={graph.clusters}
        arrangement={scope.arrangement}
        now={now}
        t={t}
        onOpen={openSession}
        onBranch={branchSession}
        onGenerateDigest={generateSessionDigest}
      />
    </div>
  )
}
