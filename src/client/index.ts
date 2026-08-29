/**
 * Browser session-graph plugin contributing one entry to the conversation
 * view slot without defining a service.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the Session Controller's Context merge (ctx.sessions).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row (declared by the slot's
// owning package) must be in the program for the register calls to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the slot service and global Session/Workspace standard props.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { GraphView, type GraphViewInjected } from './GraphView.tsx'
import { NS, en, zh } from './locales.ts'

export type { GraphViewInjected, GraphViewProps } from './GraphView.tsx'

/** Required services: the conversation view slot, the sessions list, and the locale service. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Client plugin body: register the session-graph view tab. The registration
 * rides the slot service's effect wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-graph: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'graph',
    order: 20,
    locale: NS,
    label: () => t('view.graph'),
    inject: (): GraphViewInjected => ({
      // Canvas Sessions exclude Subagent Sessions by construction, so
      // navigation is a plain open.
      openSession: (id: SessionId) => {
        ctx.sessions.open(id)
      },
      branchSession: async (id: SessionId) => {
        await ctx.sessions.fork({ sessionId: id, increaseTitle: true })
      },
    }),
  }, GraphView))
}
