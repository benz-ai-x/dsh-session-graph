declare module '@deepseek-ai/dsh-session/types' {
  const sessionIdBrand: unique symbol
  export type SessionId = string & { readonly [sessionIdBrand]: true }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  export interface SessionProjectionStateMap {}
  export interface SessionProjectionMap {}
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  export interface SessionSummary {
    readonly id: import('@deepseek-ai/dsh-session/types').SessionId
    readonly displayTitle: string
    readonly cwd?: string
    readonly parentId?: import('@deepseek-ai/dsh-session/types').SessionId
    readonly origin?: 'subagent'
    readonly running: boolean
    readonly completed?: boolean
    readonly blank: boolean
    readonly updatedAt: number
    readonly projectionValues?: Readonly<{
      readonly sessionGraphMerge?: import('../src/session-merge-projection.ts').SessionMergeProjection | null
    }>
  }

  export interface SessionListState {
    readonly ids: import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly byId: Record<import('@deepseek-ai/dsh-session/types').SessionId, SessionSummary>
    readonly current: import('@deepseek-ai/dsh-session/types').SessionId | undefined
    readonly phase: string
    readonly subagentsByParent: Readonly<Record<string, unknown>>
    readonly jobsBySession: Readonly<Record<string, unknown>>
    readonly currentAddress: unknown
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  export interface RemoteFailure {
    readonly code: string
    readonly message: string
    readonly details: object
  }
  export type RemoteResult<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: RemoteFailure }
  export interface TypertSchema<Output = unknown> {
    parse(value: unknown): Output
  }
  export interface TypertRemoteContribution {
    readonly package: string
    readonly descriptors: readonly Readonly<Record<string, unknown>>[]
  }
  export interface TypertRemoteMap {
    'sessionGraphDigest/generate': (
      request: import('../src/session-digest.ts').SessionDigestRequest,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<import('../src/session-digest.ts').SessionDigestResult>>
    'sessionGraphMerge/submit': (
      request: import('../src/session-merge.ts').SessionMergeSubmission,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<import('../src/session-merge-projection.ts').SessionMergeProjection>>
  }
  export interface TypertRemoteNamespaceMap {
    sessionGraphDigest: {
      generate: TypertRemoteMap['sessionGraphDigest/generate']
    }
    sessionGraphMerge: {
      submit: TypertRemoteMap['sessionGraphMerge/submit']
    }
  }
  export class TypertRemoteFailure extends Error {
    readonly failure: RemoteFailure
    constructor(failure: RemoteFailure)
  }
  export abstract class TypertRemoteService {
    protected constructor(ctx: import('@deepseek-ai/cordis').Context, serviceKey: string)
  }
  export function Remote(name: string): (
    method: (...args: never[]) => unknown,
    context: ClassMethodDecoratorContext,
  ) => void
}

declare module '@deepseek-ai/dsh-llm' {
  export interface DigestContentBlock {
    readonly type: string
    readonly text?: string
  }
  export class BlockAssembler {
    push(chunk: unknown): void
    readonly finish: { readonly kind: string }
    blocks(): DigestContentBlock[]
  }
  export function createUserMessage(input: {
    readonly content: readonly { readonly type: 'text'; readonly text: string }[]
    readonly source: Readonly<Record<string, unknown>>
  }): Readonly<Record<string, unknown>>
}

declare module '@deepseek-ai/dsh-api-remotes/client' {}

declare module '@deepseek-ai/dsh-api-workspace-controller/client' {
  export interface WorkspaceView {
    readonly workspaceId: string
    readonly path: string
    readonly title: string
    readonly sessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly createdAt: string
    readonly updatedAt: string
  }

  export interface WorkspaceSnapshot {
    readonly items: readonly WorkspaceView[]
    readonly archivedSessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly state: 'idle' | 'loading' | 'error'
    readonly phase: 'pending' | 'ready'
    readonly error: unknown
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  export interface LocaleNamespaceMap {}
  export type InjectFace<T extends object> = T
  export type PropsLocale<N extends keyof LocaleNamespaceMap & string> = {
    readonly t: (key: LocaleNamespaceMap[N] & string, params?: Record<string, unknown>) => string
  }
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId
  type SessionListState = import('@deepseek-ai/dsh-api-session-controller/client').SessionListState
  type WorkspaceSnapshot = import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceSnapshot

  export interface ConvViewProps {
    readonly sessionId: SessionId
    readonly useSessions: <T>(selector: (state: SessionListState) => T) => T
    readonly useSessionPendingInteraction: <T>(
      selector: (state: ReadonlyMap<SessionId, unknown>) => T,
    ) => T
    readonly useWorkspaces: <T>(selector: (state: WorkspaceSnapshot) => T) => T
  }
}

declare module '@deepseek-ai/dsh-client-locale/client' {}
declare module '@deepseek-ai/dsh-client-ui-renderer/client' {}
declare module '@deepseek-ai/dsh-client-ui-session/client' {}
declare module '@deepseek-ai/dsh-client-ui-workspace/client' {}

declare module '@deepseek-ai/cordis' {
  export interface Context {
    plugin(
      plugin: {
        readonly name?: string
        apply(ctx: Context): void | Promise<void>
      },
    ): Promise<void> & { dispose: () => Promise<void> }
    inject(
      services: readonly string[],
      apply: (ctx: Context) => void | Promise<void>,
    ): Promise<void> & { dispose: () => Promise<void> }
    readonly locale: {
      register: (namespace: string, dictionaries: Readonly<Record<string, object>>) => () => void
      bind: (namespace: string) => (key: string, params?: Record<string, unknown>) => string
    }
    readonly slots: {
      inject: (name: string, install: () => unknown) => void
      register: (
        definition: Readonly<Record<string, unknown>>,
        component: unknown,
      ) => () => void
    }
    readonly sessions: {
      readonly list: {
        getSnapshot: () => import('@deepseek-ai/dsh-api-session-controller/client').SessionListState
      }
      create: (options: { readonly workspaceId?: string; readonly cwd?: string }) => Promise<
        import('@deepseek-ai/dsh-session/types').SessionId
      >
      open: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => void
      fork: (request: {
        readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
        readonly increaseTitle: boolean
      }) => Promise<unknown>
      binding: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => {
        readonly session: {
          rename: (title: string) => Promise<
            | { readonly ok: true; readonly value: { readonly title: string; readonly seq: number } }
            | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
          >
        }
      } | undefined
    }
    readonly workspaces: {
      readonly list: {
        getSnapshot: () => import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceSnapshot
      }
    }
    readonly remote: {
      $mount: (
        contribution: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteContribution,
      ) => Promise<() => Promise<void>>
      sessionGraphDigest: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphDigest']
      sessionGraphMerge: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphMerge']
    }
    readonly invariants: {
      register: (packageName: string, installer: unknown) => () => void
    }
    readonly sessionPersistence: {
      inspect: (
        sessionId: import('@deepseek-ai/dsh-session/types').SessionId,
        signal?: AbortSignal,
      ) => Promise<import('../src/session-digest-harness.ts').HarnessSessionDigestSource>
    }
    readonly llm: {
      stream: (options: Readonly<Record<string, unknown>>) => AsyncIterable<unknown>
    }
    readonly sessionProjections: {
      register: (definition: unknown) => () => void
      stateOf: (session: unknown, key: string) => unknown
      onChanged: (listener: (
        session: unknown,
        key: string,
        value: unknown,
        seq: number,
      ) => void) => () => void
    }
    readonly sessionController: {
      resolveAgent: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => Promise<
        | { readonly agent: unknown }
        | { readonly error: { readonly message: string } }
      >
      inspect: (
        sessionId: import('@deepseek-ai/dsh-session/types').SessionId,
        signal?: AbortSignal,
      ) => Promise<{
        readonly meta: {
          readonly id: import('@deepseek-ai/dsh-session/types').SessionId
          readonly cwd?: string
          readonly origin?: 'subagent'
        }
        readonly events: readonly { readonly type: string; readonly data: unknown }[]
      }>
    }
    readonly sessionReferenceResolver: {
      remoteExportCandidates: (
        agent: unknown,
        query: string,
        signal: AbortSignal,
      ) => Promise<readonly {
        readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
        readonly cwd?: string
        readonly mention: string
      }[]>
    }
    readonly sessionProjectionCache: {
      write: (session: unknown) => Promise<void>
    }
    readonly workspaceRegistry: {
      readonly archivedSessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
    }
    effect: (install: () => unknown, label: string) => void
    on: (name: string, listener: (...args: never[]) => void) => () => void
  }
}

declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantInstaller = (ctx: import('@deepseek-ai/cordis').Context) => void
}
