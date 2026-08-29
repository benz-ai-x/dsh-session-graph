import { describe, expect, it } from 'vitest'
import {
  createSessionMergeModule,
  SessionMergeError,
  type SessionMergeDependencies,
} from '../src/session-merge.ts'

function dependencies(): SessionMergeDependencies {
  return {
    inspectSource: async sessionId => ({
      sessionId,
      title: `Session ${sessionId}`,
      cwd: '/workspace',
      workspaceId: 'workspace-1',
      canvas: true,
    }),
    createTarget: async () => 'target-session',
    renameTarget: async () => {},
    submitMerge: async () => {},
    openTarget: () => {},
    createOperationId: () => 'operation-1',
  }
}

describe('Session Merge application interface', () => {
  it('rejects fewer than two source Sessions before creating a target', async () => {
    let targetCreated = false
    const mergeDependencies = dependencies()
    const merges = createSessionMergeModule({
      ...mergeDependencies,
      createTarget: async (location, signal) => {
        targetCreated = true
        return await mergeDependencies.createTarget(location, signal)
      },
    })

    const result = merges.mergeSessions(
      ['source-a'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toEqual(new SessionMergeError(
      'invalid-source-count',
      'Session Merge requires two or three source Sessions',
      'validating',
    ))
    expect(targetCreated).toBe(false)
  })

  it('rejects more than three source Sessions before inspecting them', async () => {
    let inspected = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      inspectSource: async (sessionId, signal) => {
        inspected = true
        return await dependencies().inspectSource(sessionId, signal)
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b', 'source-c', 'source-d'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toMatchObject({ code: 'invalid-source-count' })
    expect(inspected).toBe(false)
  })

  it('rejects duplicate source Sessions before creating a target', async () => {
    let targetCreated = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      createTarget: async () => {
        targetCreated = true
        return 'target-session'
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-a'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toEqual(new SessionMergeError(
      'duplicate-source',
      'Session Merge sources must be distinct',
      'validating',
    ))
    expect(targetCreated).toBe(false)
  })

  it('rejects a blank Merge instruction before creating a target', async () => {
    let targetCreated = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      createTarget: async () => {
        targetCreated = true
        return 'target-session'
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      '   ',
      new AbortController().signal,
    )

    await expect(result).rejects.toEqual(new SessionMergeError(
      'invalid-instruction',
      'Session Merge instruction must not be blank',
      'validating',
    ))
    expect(targetCreated).toBe(false)
  })

  it('rejects reserved Session reference URIs inside the instruction', async () => {
    let targetCreated = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      createTarget: async () => {
        targetCreated = true
        return 'target-session'
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      'Compare with dsh-session:source-c as well.',
      new AbortController().signal,
    )

    await expect(result).rejects.toEqual(new SessionMergeError(
      'invalid-instruction',
      'Session Merge instruction must not contain dsh-session references',
      'validating',
    ))
    expect(targetCreated).toBe(false)
  })

  it('creates the target in the Workspace shared by two Canvas Sessions', async () => {
    const targets: { readonly workspaceId?: string; readonly cwd: string }[] = []
    const merges = createSessionMergeModule({
      ...dependencies(),
      inspectSource: async sessionId => ({
        sessionId,
        title: sessionId === 'source-a' ? 'Architecture' : 'Testing',
        cwd: '/workspace',
        workspaceId: 'workspace-1',
        canvas: true,
      }),
      createTarget: async (location) => {
        targets.push(location)
        return 'target-session'
      },
    })

    const result = await merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    expect({ result, targets }).toEqual({
      result: 'target-session',
      targets: [{ workspaceId: 'workspace-1', cwd: '/workspace' }],
    })
  })

  it('rejects a source that is not a Canvas Session', async () => {
    let targetCreated = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      inspectSource: async sessionId => ({
        sessionId,
        title: `Session ${sessionId}`,
        cwd: '/workspace',
        workspaceId: 'workspace-1',
        canvas: sessionId !== 'subagent',
      }),
      createTarget: async () => {
        targetCreated = true
        return 'target-session'
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'subagent'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toEqual(new SessionMergeError(
      'invalid-source',
      'Session "subagent" is not a Canvas Session',
      'validating',
    ))
    expect(targetCreated).toBe(false)
  })

  it('rejects Canvas Sessions from different Workspaces before creating a target', async () => {
    let targetCreated = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      inspectSource: async sessionId => ({
        sessionId,
        title: `Session ${sessionId}`,
        cwd: sessionId === 'source-a' ? '/workspace-a' : '/workspace-b',
        workspaceId: sessionId === 'source-a' ? 'workspace-a' : 'workspace-b',
        canvas: true,
      }),
      createTarget: async () => {
        targetCreated = true
        return 'target-session'
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toEqual(new SessionMergeError(
      'cross-workspace-source',
      'Session Merge sources must belong to one Workspace or working directory',
      'validating',
    ))
    expect(targetCreated).toBe(false)
  })

  it('names, submits, and opens one created Merge Session in workflow order', async () => {
    const calls: string[] = []
    const merges = createSessionMergeModule({
      inspectSource: async sessionId => ({
        sessionId,
        title: sessionId === 'source-a' ? 'Architecture' : 'Testing',
        cwd: '/workspace',
        workspaceId: 'workspace-1',
        canvas: true,
      }),
      createTarget: async () => {
        calls.push('create')
        return 'target-session'
      },
      renameTarget: async (targetSessionId: string, title: string) => {
        calls.push(`rename:${targetSessionId}:${title}`)
      },
      submitMerge: async (request: {
        readonly targetSessionId: string
        readonly sourceIds: readonly string[]
        readonly instruction: string
        readonly operationId: string
      }) => {
        calls.push(`submit:${request.targetSessionId}:${request.operationId}`)
      },
      openTarget: (targetSessionId: string) => {
        calls.push(`open:${targetSessionId}`)
      },
      createOperationId: () => 'operation-1',
    })

    const result = await merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    expect({ result, calls }).toEqual({
      result: 'target-session',
      calls: [
        'create',
        'rename:target-session:Merge: Architecture + Testing',
        'submit:target-session:operation-1',
        'open:target-session',
      ],
    })
  })

  it('preserves the created target when naming fails', async () => {
    let submitted = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      renameTarget: async () => {
        throw new Error('title service unavailable')
      },
      submitMerge: async () => {
        submitted = true
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toMatchObject({
      name: 'SessionMergeError',
      code: 'target-name-failed',
      stage: 'naming',
      targetSessionId: 'target-session',
      message: 'title service unavailable',
    })
    expect(submitted).toBe(false)
  })

  it('reports target creation failure without inventing a target identity', async () => {
    const merges = createSessionMergeModule({
      ...dependencies(),
      createTarget: async () => {
        throw new Error('workspace is read-only')
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toMatchObject({
      code: 'target-create-failed',
      stage: 'creating',
      targetSessionId: undefined,
      message: 'workspace is read-only',
    })
  })

  it('preserves the named target when snapshot submission fails', async () => {
    let opened = false
    const merges = createSessionMergeModule({
      ...dependencies(),
      submitMerge: async () => {
        throw new Error('source snapshot unavailable')
      },
      openTarget: () => {
        opened = true
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toMatchObject({
      code: 'snapshot-submit-failed',
      stage: 'submitting',
      targetSessionId: 'target-session',
      message: 'source snapshot unavailable',
    })
    expect(opened).toBe(false)
  })

  it('reports navigation failure without losing the completed target', async () => {
    const merges = createSessionMergeModule({
      ...dependencies(),
      openTarget: () => {
        throw new Error('target is not in the local list yet')
      },
    })

    const result = merges.mergeSessions(
      ['source-a', 'source-b'],
      'Synthesize the conclusions and open items.',
      new AbortController().signal,
    )

    await expect(result).rejects.toMatchObject({
      code: 'target-open-failed',
      stage: 'opening',
      targetSessionId: 'target-session',
      message: 'target is not in the local list yet',
    })
  })

  it('retries a failed target without creating a duplicate Session', async () => {
    let creates = 0
    let submits = 0
    let opens = 0
    const merges = createSessionMergeModule({
      ...dependencies(),
      createTarget: async () => {
        creates += 1
        return 'target-session'
      },
      submitMerge: async () => {
        submits += 1
        if (submits === 1) throw new Error('temporary capture failure')
      },
      openTarget: () => {
        opens += 1
      },
    })
    const sourceIds = ['source-a', 'source-b']
    const instruction = 'Synthesize the conclusions and open items.'

    await expect(merges.mergeSessions(
      sourceIds,
      instruction,
      new AbortController().signal,
    )).rejects.toMatchObject({ targetSessionId: 'target-session' })
    const result = await merges.retryMerge(
      'target-session',
      sourceIds,
      instruction,
      new AbortController().signal,
    )

    expect({ result, creates, submits, opens }).toEqual({
      result: 'target-session',
      creates: 1,
      submits: 2,
      opens: 1,
    })
  })
})
