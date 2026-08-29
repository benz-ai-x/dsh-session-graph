/** Host-side Session Merge application interface and orchestration. */

/** Stable workflow stages exposed to retryable browser errors. */
export type SessionMergeStage = 'validating' | 'creating' | 'naming' | 'submitting' | 'opening'

/** Stable failure categories consumed by the browser UI. */
export type SessionMergeErrorCode =
  | 'invalid-source-count'
  | 'duplicate-source'
  | 'invalid-instruction'
  | 'invalid-source'
  | 'cross-workspace-source'
  | 'target-create-failed'
  | 'target-name-failed'
  | 'snapshot-submit-failed'
  | 'target-open-failed'

/** Domain error whose fields are safe to transport across the Remote boundary. */
export class SessionMergeError extends Error {
  constructor(
    readonly code: SessionMergeErrorCode,
    message: string,
    readonly stage: SessionMergeStage,
    readonly targetSessionId?: string,
  ) {
    super(message)
    this.name = 'SessionMergeError'
  }
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== '' ? error.message : fallback
}

const SESSION_REFERENCE_URI = /dsh-session:[^\s)]+/iu

/** Whether free-form text would be parsed as an additional Harness Session reference. */
export function containsSessionReferenceUri(value: string): boolean {
  return SESSION_REFERENCE_URI.test(value)
}

/** Harness system boundaries accepted by the Session Merge module. */
export interface SessionMergeSource {
  readonly sessionId: string
  readonly title: string
  readonly cwd: string
  readonly workspaceId?: string
  readonly canvas: boolean
}

/** Location inherited by a newly created Merge Session. */
export interface SessionMergeTargetLocation {
  readonly cwd: string
  readonly workspaceId?: string
}

/** Request submitted to the Host after the target is created and named. */
export interface SessionMergeSubmission {
  readonly targetSessionId: string
  readonly sourceIds: readonly string[]
  readonly instruction: string
  readonly operationId: string
}

/** Harness system boundaries accepted by the Session Merge module. */
export interface SessionMergeDependencies {
  readonly inspectSource: (
    sessionId: string,
    signal: AbortSignal,
  ) => Promise<SessionMergeSource>
  readonly createTarget: (
    location: SessionMergeTargetLocation,
    signal: AbortSignal,
  ) => Promise<string>
  readonly renameTarget: (
    targetSessionId: string,
    title: string,
    signal: AbortSignal,
  ) => Promise<void>
  readonly submitMerge: (
    request: SessionMergeSubmission,
    signal: AbortSignal,
  ) => Promise<void>
  readonly openTarget: (targetSessionId: string) => void
  readonly createOperationId: () => string
}

/** Public application seam exercised by the Host Remote and tests alike. */
export interface SessionMergeModule {
  mergeSessions(
    sourceIds: readonly string[],
    instruction: string,
    signal: AbortSignal,
  ): Promise<string>
  retryMerge(
    targetSessionId: string,
    sourceIds: readonly string[],
    instruction: string,
    signal: AbortSignal,
  ): Promise<string>
}

interface ValidatedMergeRequest {
  readonly sources: readonly SessionMergeSource[]
  readonly sourceIds: readonly string[]
  readonly instruction: string
  readonly location: SessionMergeTargetLocation
}

/** Create one Session Merge application module. */
export function createSessionMergeModule(
  dependencies: SessionMergeDependencies,
): SessionMergeModule {
  async function validate(
    sourceIds: readonly string[],
    instruction: string,
    signal: AbortSignal,
  ): Promise<ValidatedMergeRequest> {
    signal.throwIfAborted()
    if (sourceIds.length < 2 || sourceIds.length > 3) {
      throw new SessionMergeError(
        'invalid-source-count',
        'Session Merge requires two or three source Sessions',
        'validating',
      )
    }
    if (new Set(sourceIds).size !== sourceIds.length) {
      throw new SessionMergeError(
        'duplicate-source',
        'Session Merge sources must be distinct',
        'validating',
      )
    }
    const normalizedInstruction = instruction.trim()
    if (normalizedInstruction === '') {
      throw new SessionMergeError(
        'invalid-instruction',
        'Session Merge instruction must not be blank',
        'validating',
      )
    }
    if (containsSessionReferenceUri(normalizedInstruction)) {
      throw new SessionMergeError(
        'invalid-instruction',
        'Session Merge instruction must not contain dsh-session references',
        'validating',
      )
    }
    const sources = await Promise.all(sourceIds.map(async sourceId =>
      await dependencies.inspectSource(sourceId, signal)))
    signal.throwIfAborted()
    const invalid = sources.find(source => !source.canvas)
    if (invalid !== undefined) {
      throw new SessionMergeError(
        'invalid-source',
        `Session ${JSON.stringify(invalid.sessionId)} is not a Canvas Session`,
        'validating',
      )
    }
    const cwdSet = new Set(sources.map(source => source.cwd))
    const workspaceIds = [...new Set(sources.flatMap(source =>
      source.workspaceId === undefined ? [] : [source.workspaceId]))]
    if (cwdSet.size !== 1 || workspaceIds.length > 1) {
      throw new SessionMergeError(
        'cross-workspace-source',
        'Session Merge sources must belong to one Workspace or working directory',
        'validating',
      )
    }
    const first = sources[0]
    /* v8 ignore next -- source-count validation above guarantees an entry */
    if (first === undefined) throw new Error('Session Merge lost its validated sources')
    return {
      sources,
      sourceIds,
      instruction: normalizedInstruction,
      location: {
        cwd: first.cwd,
        ...(workspaceIds[0] === undefined ? {} : { workspaceId: workspaceIds[0] }),
      },
    }
  }

  async function complete(
    targetSessionId: string,
    request: ValidatedMergeRequest,
    signal: AbortSignal,
  ): Promise<string> {
    const title = `Merge: ${request.sources.map(source => source.title).join(' + ')}`
    try {
      await dependencies.renameTarget(targetSessionId, title, signal)
    } catch (error) {
      if (signal.aborted) throw error
      throw new SessionMergeError(
        'target-name-failed',
        failureMessage(error, 'Failed to name the Merge Session'),
        'naming',
        targetSessionId,
      )
    }
    signal.throwIfAborted()
    try {
      await dependencies.submitMerge({
        targetSessionId,
        sourceIds: request.sourceIds,
        instruction: request.instruction,
        operationId: dependencies.createOperationId(),
      }, signal)
    } catch (error) {
      if (signal.aborted) throw error
      throw new SessionMergeError(
        'snapshot-submit-failed',
        failureMessage(error, 'Failed to capture source Session snapshots'),
        'submitting',
        targetSessionId,
      )
    }
    signal.throwIfAborted()
    try {
      dependencies.openTarget(targetSessionId)
    } catch (error) {
      throw new SessionMergeError(
        'target-open-failed',
        failureMessage(error, 'Failed to open the Merge Session'),
        'opening',
        targetSessionId,
      )
    }
    return targetSessionId
  }

  return {
    async mergeSessions(sourceIds, instruction, signal) {
      const request = await validate(sourceIds, instruction, signal)
      let targetSessionId: string
      try {
        targetSessionId = await dependencies.createTarget(request.location, signal)
      } catch (error) {
        if (signal.aborted) throw error
        throw new SessionMergeError(
          'target-create-failed',
          failureMessage(error, 'Failed to create the Merge Session'),
          'creating',
        )
      }
      signal.throwIfAborted()
      return await complete(targetSessionId, request, signal)
    },
    async retryMerge(targetSessionId, sourceIds, instruction, signal) {
      const request = await validate(sourceIds, instruction, signal)
      return await complete(targetSessionId, request, signal)
    },
  }
}
