/** Strict Client contribution for the package-owned Session Merge Remote. */

import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionMergeProjection } from '../session-merge-projection.ts'
import type { SessionMergeSubmission } from '../session-merge.ts'

const PACKAGE_NAME = '@benz-ai-x/dsh-client-ui-session-graph'

function recordOf(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Readonly<Record<string, unknown>>
}

function stringOf(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

function sourceIdsOf(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    throw new TypeError(`${label} must contain two or three Session identities`)
  }
  const sourceIds = value.map((item, index) => stringOf(item, `${label}[${String(index)}]`))
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new TypeError(`${label} must contain distinct Session identities`)
  }
  return sourceIds
}

function parseRequest(value: unknown): SessionMergeSubmission {
  const request = recordOf(value, 'Session Merge request')
  return {
    targetSessionId: stringOf(request.targetSessionId, 'Session Merge targetSessionId'),
    sourceIds: sourceIdsOf(request.sourceIds, 'Session Merge sourceIds'),
    instruction: stringOf(request.instruction, 'Session Merge instruction'),
    operationId: stringOf(request.operationId, 'Session Merge operationId'),
  }
}

function sequenceOf(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`)
  }
  return value as number
}

function parseResult(value: unknown): SessionMergeProjection {
  const result = recordOf(value, 'Session Merge result')
  if (!Array.isArray(result.sources) || result.sources.length < 2 || result.sources.length > 3) {
    throw new TypeError('Session Merge result.sources must contain two or three snapshots')
  }
  const sources = result.sources.map((value, index) => {
    const source = recordOf(value, `Session Merge result.sources[${String(index)}]`)
    const captured = source.capturedThroughSeq
    if (!(captured === null || (Number.isSafeInteger(captured) && (captured as number) >= 0))) {
      throw new TypeError('Session Merge capturedThroughSeq must be null or a non-negative integer')
    }
    return {
      sessionId: stringOf(source.sessionId, 'Session Merge source sessionId'),
      capturedThroughSeq: captured as number | null,
    }
  })
  if (new Set(sources.map(source => source.sessionId)).size !== sources.length) {
    throw new TypeError('Session Merge result sources must be distinct')
  }
  return {
    operationId: stringOf(result.operationId, 'Session Merge result.operationId'),
    contextEventSeq: sequenceOf(result.contextEventSeq, 'Session Merge contextEventSeq'),
    sources,
  }
}

/** Host-for-Client descriptor mounted with the package's other Remote. */
export const SESSION_MERGE_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphMerge/submit`,
    service: 'sessionGraphMerge',
    namespace: 'sessionGraphMerge',
    method: 'submit',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: `${PACKAGE_NAME}#SessionMergeSubmission`,
        schema: { parse: parseRequest },
      },
    }],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: `${PACKAGE_NAME}#SessionMergeProjection`,
      schema: { parse: parseResult },
    },
  }],
}
