import { describe, expect, it } from 'vitest'
import {
  SESSION_MERGE_PROJECTION_DEFINITION,
  projectSessionMerge,
} from '../src/session-merge-projection.ts'

describe('Session Merge projection', () => {
  it('projects matching marker and referenced snapshots from one model step', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: { turn: 1, step: 1 } },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
          content: [{ type: 'text', text: 'Merge the selected Session snapshots.' }],
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Synthesize conclusions and open items.' }],
        },
      },
      {
        type: 'user/message', seq: 3,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
          content: [{ type: 'text', text: 'bounded snapshots' }],
        },
      },
      { type: 'step/end', seq: 4, data: { turn: 1, step: 1 } },
    ])

    expect(result).toEqual({
      operationId: 'operation-1',
      contextEventSeq: 3,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 7 },
        { sessionId: 'source-b', capturedThroughSeq: 11 },
      ],
    })
  })

  it('uses reference input order instead of event payload order', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
            ],
          },
        },
      },
    ])

    expect(result?.sources).toEqual([
      { sessionId: 'source-a', capturedThroughSeq: 7 },
      { sessionId: 'source-b', capturedThroughSeq: 11 },
    ])
  })

  it('does not treat ordinary multi-Session references as an explicit Merge', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('does not pair a Merge marker with reference context from a later model step', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      { type: 'step/end', seq: 2, data: {} },
      { type: 'step/start', seq: 3, data: {} },
      {
        type: 'user/message', seq: 4,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('does not project an unsupported Session-reference source version', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 2,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores a marker that repeats one source Session', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-a'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores a marker with fewer than two source Sessions', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores a marker with more than three source Sessions', () => {
    const sourceIds = ['source-a', 'source-b', 'source-c', 'source-d']
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds,
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: sourceIds.map((sessionId, inputIndex) => ({
              sessionId,
              capturedThroughSeq: inputIndex,
              inputIndex,
            })),
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores reference context with duplicate input indexes', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 0 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores reference context whose input indexes are not zero-based and contiguous', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 3 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 4 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores reference context with an invalid captured sequence', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: -1, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11.5, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores a marker without an operation identity', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: '   ', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('ignores a live marker containing a blank source identity', () => {
    const result = projectSessionMerge([
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', '   '],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: '   ', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
        },
      },
    ])

    expect(result).toBeNull()
  })

  it('exposes an incremental projection definition with a client wire value', () => {
    const events = [
      { type: 'step/start', seq: 0, data: {} },
      {
        type: 'user/message', seq: 1,
        data: {
          source: {
            kind: 'session-graph-merge', version: 1,
            operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
          },
        },
      },
      {
        type: 'user/message', seq: 2,
        data: {
          source: {
            kind: 'session-reference', version: 1,
            references: [
              { sessionId: 'source-a', capturedThroughSeq: 7, inputIndex: 0 },
              { sessionId: 'source-b', capturedThroughSeq: 11, inputIndex: 1 },
            ],
          },
        },
      },
    ]
    const state = events.reduce(
      SESSION_MERGE_PROJECTION_DEFINITION.apply,
      SESSION_MERGE_PROJECTION_DEFINITION.init({}),
    )

    expect(SESSION_MERGE_PROJECTION_DEFINITION.wire.view(state)).toEqual({
      operationId: 'operation-1',
      contextEventSeq: 2,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 7 },
        { sessionId: 'source-b', capturedThroughSeq: 11 },
      ],
    })
  })

  it('rejects malformed persisted projection state', () => {
    expect(() => SESSION_MERGE_PROJECTION_DEFINITION.stateSchema.parse({
      inStep: 'yes',
      marker: null,
      value: null,
    })).toThrow('Invalid Session Merge projection state')
  })
})
