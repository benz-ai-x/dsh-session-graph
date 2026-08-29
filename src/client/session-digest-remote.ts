/** Strict Client contribution for the package-owned Session Digest Remote. */

import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SessionDigest,
  SessionDigestRequest,
  SessionDigestResult,
} from '../session-digest.ts'

const PACKAGE_NAME = '@benz-ai-x/dsh-client-ui-session-graph'

function recordOf(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Readonly<Record<string, unknown>>
}

function stringOf(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`)
  }
  return value
}

function numberOf(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
  return value
}

function stringListOf(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`)
  return value.map((item, index) => stringOf(item, `${label}[${String(index)}]`, true))
}

function parseRequest(value: unknown): SessionDigestRequest {
  const record = recordOf(value, 'Session Digest request')
  if (typeof record.refresh !== 'boolean') {
    throw new TypeError('Session Digest request.refresh must be a boolean')
  }
  return {
    sessionId: stringOf(record.sessionId, 'Session Digest request.sessionId'),
    refresh: record.refresh,
  }
}

function parseDigest(value: unknown): SessionDigest {
  const record = recordOf(value, 'Session Digest')
  if (typeof record.generatedWhileRunning !== 'boolean') {
    throw new TypeError('Session Digest generatedWhileRunning must be a boolean')
  }
  return {
    sessionId: stringOf(record.sessionId, 'Session Digest sessionId'),
    sourceRevision: stringOf(record.sourceRevision, 'Session Digest sourceRevision', true),
    sourceTurnCount: numberOf(record.sourceTurnCount, 'Session Digest sourceTurnCount'),
    generatedAt: numberOf(record.generatedAt, 'Session Digest generatedAt'),
    generatedWhileRunning: record.generatedWhileRunning,
    overview: stringOf(record.overview, 'Session Digest overview'),
    keyOutcomes: stringListOf(record.keyOutcomes, 'Session Digest keyOutcomes'),
    openItems: stringListOf(record.openItems, 'Session Digest openItems'),
  }
}

function parseResult(value: unknown): SessionDigestResult {
  const record = recordOf(value, 'Session Digest result')
  if (record.kind === 'empty') return { kind: 'empty' }
  if (record.kind !== 'ready' || typeof record.cached !== 'boolean') {
    throw new TypeError('Session Digest result has an invalid kind or cached flag')
  }
  return { kind: 'ready', cached: record.cached, digest: parseDigest(record.digest) }
}

const requestSchema = { parse: parseRequest }
const resultSchema = { parse: parseResult }

/** Host-for-Client descriptor mounted explicitly by this package's browser entry. */
export const SESSION_DIGEST_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphDigest/generate`,
    service: 'sessionGraphDigest',
    namespace: 'sessionGraphDigest',
    method: 'generate',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: `${PACKAGE_NAME}#SessionDigestRequest`,
        schema: requestSchema,
      },
    }],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: `${PACKAGE_NAME}#SessionDigestResult`,
      schema: resultSchema,
    },
  }],
}
