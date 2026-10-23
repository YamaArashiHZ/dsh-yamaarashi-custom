/**
 * Structural host contracts used by this component's Node half.
 *
 * Kept local (no `@deepseek-ai/dsh-*` imports) so the package only needs the
 * runtime services it actually injects: the web server for its same-origin
 * routes and the credential service for the two account secrets. The types are
 * deliberately structural — brands only exist at compile time in the host
 * packages, and a plugin that injected for real would tie this package to one
 * DSH checkout.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/host/context
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** One exact-path route registered on the harness web server. */
export interface HostRoute {
  kind: 'exact'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** Web server slice this component uses. */
export interface HostWebServer {
  register(route: HostRoute): () => void
}

/** One resolved credential value and its source layer. */
export interface ResolvedCredentialLike {
  value: string
  source: string
}

/** Credential service slice this component uses. */
export interface HostCredentials {
  resolve(ref: string): Promise<ResolvedCredentialLike | undefined>
  describe(ref: string): Promise<{ configured: boolean; writable: boolean }>
  set(ref: string, value: string): Promise<void>
  unset(ref: string): Promise<void>
}

/** Child context of the `settings` injection. */
export interface HostSettingsChild {
  effect(setup: () => void | (() => void)): void
  settings: {
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void
  }
}

/** Host plugin context this component needs. */
export interface HostContext {
  fiber: unknown
  effect(setup: () => void | (() => void), label?: string): void
  inject(names: string[], callback: (child: HostSettingsChild) => void): void
  webServer: HostWebServer
  credentials: HostCredentials
}
