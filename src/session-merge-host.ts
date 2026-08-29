/** Host-side atomic submission of one explicit Session Merge capture. */

import type { SessionMergeProjection } from './session-merge-projection.ts'
import {
  containsSessionReferenceUri,
  type SessionMergeSubmission,
} from './session-merge.ts'

/** Stable Host capture stages transported across the Remote. */
export type SessionMergeHostStage = 'resolving' | 'queueing' | 'capturing' | 'persisting'

/** Stable Host failure consumed by the browser workflow. */
export class SessionMergeHostError extends Error {
  constructor(
    readonly code:
      | 'invalid-source-count'
      | 'duplicate-source'
      | 'cross-workspace-source'
      | 'source-resolution-mismatch'
      | 'invalid-instruction'
      | 'invalid-operation'
      | 'capture-mismatch'
      | 'persistence-failed'
      | 'queue-failed'
      | 'capture-failed'
      | 'source-resolution-failed'
      | 'target-resolution-failed'
      | 'target-already-merged',
    message: string,
    readonly stage: SessionMergeHostStage,
  ) {
    super(message)
    this.name = 'SessionMergeHostError'
  }
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== '' ? error.message : fallback
}

/** Live target resolved by the Harness Session Controller. */
export interface SessionMergeHostTarget {
  readonly targetSessionId: string
  readonly cwd: string
  readonly handle: unknown
}

/** Canonical Host-owned reference candidate. */
export interface SessionMergeHostSource {
  readonly sessionId: string
  readonly cwd?: string
  readonly mention: string
}

/** Durable plugin marker paired with the resolver's reference context. */
export interface SessionMergeMarkerSource {
  readonly kind: 'session-graph-merge'
  readonly version: 1
  readonly operationId: string
  readonly sourceIds: readonly string[]
}

/** Both messages that must enter the same next-step inbox without an await gap. */
export interface SessionMergeHostEnqueueInput {
  readonly marker: SessionMergeMarkerSource
  readonly directText: string
}

/** Harness boundaries used by the Host submit application service. */
export interface SessionMergeHostDependencies {
  readonly resolveTarget: (
    targetSessionId: string,
    signal: AbortSignal,
  ) => Promise<SessionMergeHostTarget>
  readonly currentCapture: (
    target: SessionMergeHostTarget,
  ) => SessionMergeProjection | null
  readonly resolveSource: (
    target: SessionMergeHostTarget,
    sourceId: string,
    signal: AbortSignal,
  ) => Promise<SessionMergeHostSource>
  readonly enqueue: (
    target: SessionMergeHostTarget,
    input: SessionMergeHostEnqueueInput,
  ) => void
  readonly waitForCapture: (
    target: SessionMergeHostTarget,
    operationId: string,
    sourceIds: readonly string[],
    signal: AbortSignal,
  ) => Promise<SessionMergeProjection>
  readonly persist: (target: SessionMergeHostTarget) => Promise<void>
}

/** Public Host seam installed behind the package-owned Remote. */
export interface SessionMergeHostModule {
  submit(
    request: SessionMergeSubmission,
    signal: AbortSignal,
  ): Promise<SessionMergeProjection>
}

/** Build the atomic Host capture workflow around Harness capabilities. */
export function createSessionMergeHostModule(
  dependencies: SessionMergeHostDependencies,
): SessionMergeHostModule {
  return {
    async submit(request, signal) {
      signal.throwIfAborted()
      if (request.sourceIds.length < 2 || request.sourceIds.length > 3) {
        throw new SessionMergeHostError(
          'invalid-source-count',
          'Session Merge requires two or three source Sessions',
          'resolving',
        )
      }
      if (new Set(request.sourceIds).size !== request.sourceIds.length) {
        throw new SessionMergeHostError(
          'duplicate-source',
          'Session Merge sources must be distinct',
          'resolving',
        )
      }
      if (request.instruction.trim() === '') {
        throw new SessionMergeHostError(
          'invalid-instruction',
          'Session Merge instruction must not be blank',
          'resolving',
        )
      }
      if (containsSessionReferenceUri(request.instruction)) {
        throw new SessionMergeHostError(
          'invalid-instruction',
          'Session Merge instruction must not contain dsh-session references',
          'resolving',
        )
      }
      if (request.operationId.trim() === '') {
        throw new SessionMergeHostError(
          'invalid-operation',
          'Session Merge operation identity must not be blank',
          'resolving',
        )
      }
      let target: SessionMergeHostTarget
      try {
        target = await dependencies.resolveTarget(request.targetSessionId, signal)
      } catch (error) {
        if (signal.aborted) throw error
        throw new SessionMergeHostError(
          'target-resolution-failed',
          failureMessage(error, 'Failed to resolve the Merge Session target'),
          'resolving',
        )
      }
      const existing = dependencies.currentCapture(target)
      if (existing !== null) {
        if (existing.sources.length !== request.sourceIds.length
          || existing.sources.some((source, index) =>
            source.sessionId !== request.sourceIds[index])) {
          throw new SessionMergeHostError(
            'target-already-merged',
            'The target Session already contains a different Merge capture',
            'resolving',
          )
        }
        try {
          await dependencies.persist(target)
        } catch (error) {
          if (signal.aborted) throw error
          throw new SessionMergeHostError(
            'persistence-failed',
            failureMessage(error, 'Failed to persist Session Merge capture'),
            'persisting',
          )
        }
        return existing
      }
      let sources: SessionMergeHostSource[]
      try {
        sources = await Promise.all(request.sourceIds.map(async sourceId =>
          await dependencies.resolveSource(target, sourceId, signal)))
      } catch (error) {
        if (signal.aborted) throw error
        throw new SessionMergeHostError(
          'source-resolution-failed',
          failureMessage(error, 'Failed to resolve a Session Merge source'),
          'resolving',
        )
      }
      signal.throwIfAborted()
      if (sources.some((source, index) => source.sessionId !== request.sourceIds[index])) {
        throw new SessionMergeHostError(
          'source-resolution-mismatch',
          'Session Merge source resolution did not return the exact requested Session',
          'resolving',
        )
      }
      if (sources.some(source => source.cwd !== target.cwd)) {
        throw new SessionMergeHostError(
          'cross-workspace-source',
          'Session Merge sources must share the target working directory',
          'resolving',
        )
      }
      try {
        dependencies.enqueue(target, {
          marker: {
            kind: 'session-graph-merge',
            version: 1,
            operationId: request.operationId,
            sourceIds: request.sourceIds,
          },
          directText: `${request.instruction.trim()}\n\n${sources
            .map(source => source.mention)
            .join('\n')}`,
        })
      } catch (error) {
        throw new SessionMergeHostError(
          'queue-failed',
          failureMessage(error, 'Failed to queue the Session Merge request'),
          'queueing',
        )
      }
      let projection: SessionMergeProjection
      try {
        projection = await dependencies.waitForCapture(
          target,
          request.operationId,
          request.sourceIds,
          signal,
        )
      } catch (error) {
        if (signal.aborted) throw error
        throw new SessionMergeHostError(
          'capture-failed',
          failureMessage(error, 'Failed to capture source Session snapshots'),
          'capturing',
        )
      }
      signal.throwIfAborted()
      if (projection.sources.length !== request.sourceIds.length
        || projection.sources.some((source, index) =>
          source.sessionId !== request.sourceIds[index])) {
        throw new SessionMergeHostError(
          'capture-mismatch',
          'Captured Session snapshots did not match the Merge request',
          'capturing',
        )
      }
      try {
        await dependencies.persist(target)
      } catch (error) {
        if (signal.aborted) throw error
        throw new SessionMergeHostError(
          'persistence-failed',
          failureMessage(error, 'Failed to persist Session Merge capture'),
          'persisting',
        )
      }
      return projection
    },
  }
}
