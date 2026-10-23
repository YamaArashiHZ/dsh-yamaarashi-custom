/**
 * DeepSeek usage card — host half.
 *
 * One component of the DSH customization suite. The suite shell
 * (`@yamaarashihz/dsh-yamaarashi-custom`) declares this package as one row of
 * its bundle, with the row id `deepseek-balance`; that id is this component's
 * settings namespace and its configuration page key.
 *
 * The host half owns the two credential-backed data sources:
 * - the official API-key balance endpoint, and
 * - the platform dashboard's hourly usage endpoints (session `userToken`).
 *
 * Both are proxied through loopback-guarded same-origin routes because the
 * browser half cannot call those hosts directly (CORS, and secrets must not
 * live in client code). Every leaf field is `.volatile()` so the configuration
 * page applies without a host restart; object nodes must NOT be volatile.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance
 */

import z from '@deepseek-ai/schemastery'
import {
  CARD_DEFAULTS, MAX_REFRESH_SECONDS, MIN_REFRESH_SECONDS,
} from './shared.js'
import type { BalanceCardConfig, CustomSettings } from './shared.js'
import type { HostContext } from './host/context.js'
import { createRoutes } from './host/routes.js'

export type {
  BalanceCardConfig, BalanceCurrencyInfo, BalanceSnapshot, CredentialField, CredentialWriteRequest,
  CredentialWriteResponse, CustomSettings, DataErrorCode, DataResponse, StatusResponse, UsageSnapshot,
} from './shared.js'

export { CARD_DEFAULTS } from './shared.js'

/** Bundle configuration. */
export interface Config {
  components: CustomSettings
}

/** Schema defaults, mirrored by the browser half for defensive fallback. */
const DEFAULTS: BalanceCardConfig = CARD_DEFAULTS

export const Config = z.object({
  components: z.object({
    balanceCard: z.object({
      enabled: z.boolean().default(DEFAULTS.enabled).volatile(),
      title: z.string().default(DEFAULTS.title).volatile(),
      refreshSeconds: z.number().step(1)
        .min(MIN_REFRESH_SECONDS).max(MAX_REFRESH_SECONDS)
        .default(DEFAULTS.refreshSeconds).volatile(),
      showBalance: z.boolean().default(DEFAULTS.showBalance).volatile(),
      showTodayUsage: z.boolean().default(DEFAULTS.showTodayUsage).volatile(),
    }).default({ ...DEFAULTS }),
  }).default({ balanceCard: { ...DEFAULTS } }),
})

export const name = 'deepseek-balance'

/** Services the routes need; the plugin does not load without them. */
export const inject = ['webServer', 'credentials']

/**
 * Host entry point: register the same-origin data/credential routes and say
 * "this instance does not need a generated settings page" (the component ships
 * its own in `plugins.row.config`).
 * @param ctx - host plugin context.
 */
export function apply(ctx: HostContext): void {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
  ctx.effect(() => {
    const disposers = createRoutes(ctx).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'deepseek-balance: routes')
}
