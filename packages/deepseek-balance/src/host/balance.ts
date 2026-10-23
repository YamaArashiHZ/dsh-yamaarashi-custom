/**
 * Official DeepSeek balance source.
 *
 * `GET https://api.deepseek.com/user/balance` is the one public endpoint this
 * card uses for money. It returns one row per currency; the card shows CNY when
 * present (the platform's default) and keeps every row available to the browser
 * half for the breakdown line.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/host/balance
 */

import type { BalanceCurrencyInfo, BalanceSnapshot } from '../shared.js'
import { DataError, readTextLimited } from './http.js'

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const REQUEST_TIMEOUT_MS = 12_000
const MAX_BODY_BYTES = 256 * 1024

/** Tolerant object read for a decoded JSON value. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Parse a money string from the official endpoint; blank or malformed reads as 0. */
function toAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(n) ? n : 0
}

/** Convert one `balance_infos` row. */
function toCurrencyInfo(value: unknown): BalanceCurrencyInfo | undefined {
  const row = asRecord(value)
  const currency = typeof row?.currency === 'string' ? row.currency : undefined
  if (row === undefined || currency === undefined) return undefined
  return {
    currency,
    total: toAmount(row.total_balance),
    granted: toAmount(row.granted_balance),
    toppedUp: toAmount(row.topped_up_balance),
  }
}

/**
 * Fetch and normalize the official balance payload.
 * @param apiKey - DeepSeek API key (never logged).
 * @returns balance snapshot.
 * @throws DataError with `auth_failed`, `fetch_failed`, `timeout`, or `invalid_response`.
 */
export async function fetchBalance(apiKey: string): Promise<BalanceSnapshot> {
  let response: Response
  try {
    response = await fetch(BALANCE_URL, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new DataError('timeout', 'balance request timed out')
    }
    throw new DataError('fetch_failed', 'balance request failed')
  }

  if (response.status === 401 || response.status === 403) {
    throw new DataError('auth_failed', 'API key rejected', response.status)
  }
  if (response.status !== 200) {
    throw new DataError('fetch_failed', `balance endpoint returned HTTP ${response.status}`, response.status)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await readTextLimited(response, MAX_BODY_BYTES))
  } catch (error) {
    if (error instanceof DataError) throw error
    throw new DataError('invalid_response', 'balance endpoint returned invalid JSON', response.status)
  }

  const body = asRecord(parsed)
  const rows = body?.balance_infos
  if (!Array.isArray(rows)) {
    throw new DataError('invalid_response', 'balance endpoint omitted balance_infos', response.status)
  }
  const infos = rows
    .map(toCurrencyInfo)
    .filter((info): info is BalanceCurrencyInfo => info !== undefined)
  if (infos.length === 0) {
    throw new DataError('invalid_response', 'balance endpoint returned no currencies', response.status)
  }
  const picked = infos.find(info => info.currency.toUpperCase() === 'CNY') ?? (infos[0] as BalanceCurrencyInfo)
  return {
    available: body?.is_available === true,
    currency: picked.currency,
    info: picked,
    infos,
    fetchedAt: Date.now(),
  }
}
