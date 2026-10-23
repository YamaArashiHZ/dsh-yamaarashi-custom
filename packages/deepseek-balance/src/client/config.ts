/**
 * Browser-side configuration vocabulary for the usage card.
 *
 * Mirrors the host schema defaults (`CARD_DEFAULTS` in `../shared.ts`, the same
 * module the host builds its schema from) and adds the defensive reader used
 * before the first settings snapshot arrives or when the namespace is not
 * served. No host import: the browser bundle must not pull Node-only code.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/config
 */

import {
  CARD_DEFAULTS, MAX_REFRESH_SECONDS, MIN_REFRESH_SECONDS,
} from '../shared.js'
import type { BalanceCardConfig } from '../shared.js'

/** Narrow an unknown settings value to a plain object without trusting it. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Take a typed field from the snapshot, falling back to the schema default. */
function readField<T>(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback: T,
): T {
  const value = source?.[key]
  return typeof value === typeof fallback ? value as T : fallback
}

/** Clamp a refresh interval into the range the host schema accepts. */
function clampRefreshSeconds(value: number): number {
  if (!Number.isFinite(value)) return CARD_DEFAULTS.refreshSeconds
  return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Math.round(value)))
}

/**
 * Read the `components.balanceCard` section from a settings snapshot value.
 * @param value - `snapshot.value` of the `deepseek-balance` namespace (or
 * any untrusted value, including `undefined`).
 * @returns the card settings, never partially undefined.
 */
export function readBalanceCardConfig(value: unknown): BalanceCardConfig {
  const root = asRecord(value)
  const components = asRecord(root?.components)
  const section = asRecord(components?.balanceCard)
  const title = readField(section, 'title', CARD_DEFAULTS.title).trim()
  return {
    enabled: readField(section, 'enabled', CARD_DEFAULTS.enabled),
    title: title.length > 0 ? title : CARD_DEFAULTS.title,
    refreshSeconds: clampRefreshSeconds(
      readField(section, 'refreshSeconds', CARD_DEFAULTS.refreshSeconds),
    ),
    showBalance: readField(section, 'showBalance', CARD_DEFAULTS.showBalance),
    showTodayUsage: readField(section, 'showTodayUsage', CARD_DEFAULTS.showTodayUsage),
  }
}
