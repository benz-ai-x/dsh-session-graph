/**
 * Package-owned invariant companion for `@benz-ai-x/dsh-client-ui-session-graph`.
 * @module @benz-ai-x/dsh-client-ui-session-graph/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@benz-ai-x/dsh-client-ui-session-graph'

/** Cordis companion plugin name. */
export const name = 'client-ui-session-graph-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure-consumer plugin — it derives its graph from
 * the sessions-list snapshot without emitting cordis events or owning
 * mutable cross-plugin state; its view-slot registration is a plain effect
 * whose disposal this package's behavior specs observe directly.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
