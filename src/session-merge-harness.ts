/** Harness adapters for the package-owned Session Merge Host workflow. */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  createSessionMergeHostModule,
  type SessionMergeHostDependencies,
  type SessionMergeHostTarget,
} from './session-merge-host.ts'
import type {
  SessionMergeProjection,
  SessionMergeProjectionState,
} from './session-merge-projection.ts'

interface HarnessSession {
  readonly header: {
    readonly cwd?: string
    readonly parentSession?: SessionId
    readonly origin?: 'subagent'
  }
  readonly events: readonly {
    readonly type: string
    readonly data: unknown
  }[]
}

interface HarnessAgent {
  readonly id: SessionId
  readonly session: HarnessSession
  inject(message: Readonly<Record<string, unknown>>): void
  steer(message: Readonly<Record<string, unknown>>): void
}

/** Adapter policy for one bounded wait on the target Session's projection. */
export interface SessionMergeHarnessOptions {
  readonly captureTimeoutMs?: number
}

/** Stable internal timeout surfaced by the Host module as a capture failure. */
export class SessionMergeCaptureTimeoutError extends Error {
  readonly code = 'capture-timeout'

  constructor(timeoutMs: number) {
    super(`Session Merge capture timed out after ${String(timeoutMs)}ms`)
    this.name = 'SessionMergeCaptureTimeoutError'
  }
}

const DEFAULT_CAPTURE_TIMEOUT_MS = 120_000

function agentOf(target: SessionMergeHostTarget): HarnessAgent {
  return target.handle as HarnessAgent
}

function matchesCaptureSources(
  value: SessionMergeProjection | null,
  sourceIds: readonly string[],
): value is SessionMergeProjection {
  return value !== null
    && value.sources.length === sourceIds.length
    && value.sources.every((source, index) => source.sessionId === sourceIds[index])
}

/** Adapt public Harness services to the pure Host workflow boundaries. */
export function sessionMergeDependenciesFromHarness(
  ctx: Context,
  options: SessionMergeHarnessOptions = {},
): SessionMergeHostDependencies {
  const captureTimeoutMs = options.captureTimeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS
  if (!Number.isSafeInteger(captureTimeoutMs) || captureTimeoutMs <= 0) {
    throw new RangeError('Session Merge captureTimeoutMs must be a positive safe integer')
  }
  const currentCapture = (target: SessionMergeHostTarget): SessionMergeProjection | null => {
    const state = ctx.sessionProjections.stateOf(
      agentOf(target).session,
      'sessionGraphMerge',
    ) as SessionMergeProjectionState | undefined
    return state?.value ?? null
  }

  return {
    resolveTarget: async (targetSessionId) => {
      const resolved = await ctx.sessionController.resolveAgent(targetSessionId as SessionId)
      if ('error' in resolved) throw new Error(resolved.error.message)
      const agent = resolved.agent as HarnessAgent
      const cwd = agent.session.header.cwd
      if (cwd === undefined || cwd === '') {
        throw new Error(`target Session ${JSON.stringify(targetSessionId)} has no working directory`)
      }
      return {
        targetSessionId,
        cwd,
        ...(agent.session.header.parentSession === undefined
          ? {}
          : { parentSessionId: agent.session.header.parentSession }),
        ...(agent.session.header.origin === undefined
          ? {}
          : { origin: agent.session.header.origin }),
        archived: ctx.workspaceRegistry.archivedSessionIds.includes(targetSessionId as SessionId),
        events: [...agent.session.events],
        handle: agent,
      }
    },
    currentCapture,
    resolveSource: async (target, sourceId, signal) => {
      const [source, candidates] = await Promise.all([
        ctx.sessionController.inspect(sourceId as SessionId, signal),
        ctx.sessionReferenceResolver.remoteExportCandidates(
          agentOf(target),
          sourceId,
          signal,
        ),
      ])
      signal.throwIfAborted()
      const candidate = candidates.find(value => value.sessionId === sourceId)
      if (candidate === undefined) {
        throw new Error(`source Session ${JSON.stringify(sourceId)} is unavailable`)
      }
      return {
        sessionId: candidate.sessionId,
        ...(source.meta.cwd === undefined ? {} : { cwd: source.meta.cwd }),
        mention: candidate.mention,
        ...(source.meta.origin === undefined ? {} : { origin: source.meta.origin }),
        archived: ctx.workspaceRegistry.archivedSessionIds.includes(sourceId as SessionId),
        blank: !source.events.some(event => event.type === 'turn/start'),
      }
    },
    enqueue: (target, input) => {
      const agent = agentOf(target)
      const marker = createUserMessage({
        source: { ...input.marker, form: 'notice' },
        content: [{ type: 'text', text: 'Session Merge source snapshot request.' }],
      })
      const direct = createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: input.directText }],
      })
      agent.inject(marker)
      agent.steer(direct)
    },
    waitForCapture: async (target, _operationId, sourceIds, signal) => {
      const immediate = currentCapture(target)
      if (matchesCaptureSources(immediate, sourceIds)) return immediate
      const agent = agentOf(target)
      return await new Promise<SessionMergeProjection>((resolve, reject) => {
        let settled = false
        let disposeProjection = (): void => {}
        let disposeError = (): void => {}
        const timeout = setTimeout(() => {
          finish({ error: new SessionMergeCaptureTimeoutError(captureTimeoutMs) })
        }, captureTimeoutMs)
        const cleanup = (): void => {
          clearTimeout(timeout)
          signal.removeEventListener('abort', onAbort)
          disposeProjection()
          disposeError()
        }
        const finish = (
          result: { readonly value: SessionMergeProjection } | { readonly error: unknown },
        ): void => {
          if (settled) return
          settled = true
          cleanup()
          if ('value' in result) resolve(result.value)
          else reject(result.error)
        }
        const onAbort = (): void => {
          finish({ error: signal.reason ?? new Error('Session Merge capture cancelled') })
        }
        disposeProjection = ctx.sessionProjections.onChanged((session, key, value) => {
          if (session !== agent.session || key !== 'sessionGraphMerge') return
          const projection = value as SessionMergeProjection | null
          if (matchesCaptureSources(projection, sourceIds)) finish({ value: projection })
        })
        disposeError = ctx.on('agent/error', ((payload: {
          readonly agent: HarnessAgent
          readonly error: unknown
        }) => {
          if (payload.agent === agent) finish({ error: payload.error })
        }) as never)
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) {
          onAbort()
          return
        }
        const raced = currentCapture(target)
        if (matchesCaptureSources(raced, sourceIds)) finish({ value: raced })
      })
    },
    commitCapture: async target => {
      await ctx.sessionProjectionCache.write(agentOf(target).session)
    },
  }
}

/** Create the Host workflow with real Harness adapters. */
export function createSessionMergeHarnessModule(
  ctx: Context,
  options?: SessionMergeHarnessOptions,
) {
  return createSessionMergeHostModule(sessionMergeDependenciesFromHarness(ctx, options))
}
