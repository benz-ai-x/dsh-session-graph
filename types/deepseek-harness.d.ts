declare module '@deepseek-ai/dsh-session/types' {
  const sessionIdBrand: unique symbol
  export type SessionId = string & { readonly [sessionIdBrand]: true }
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
      open: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => void
      fork: (request: {
        readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
        readonly increaseTitle: boolean
      }) => Promise<unknown>
    }
    readonly invariants: {
      register: (packageName: string, installer: unknown) => () => void
    }
    effect: (install: () => unknown, label: string) => void
  }
}

declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantInstaller = (ctx: import('@deepseek-ai/cordis').Context) => void
}
