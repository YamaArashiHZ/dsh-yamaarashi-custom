/**
 * Platform usage source: today's hourly spend, tokens and requests.
 *
 * The public DeepSeek API exposes no usage statistics, so the card reads the
 * same private dashboard endpoints the official usage page uses, authenticated
 * with the platform session's `userToken`:
 *
 * - `GET /api/v0/usage/by_api_key/amount?start&end&tz&bucket=3600`
 *   → `{ data: { biz_data: { series: [{ api_key, model, buckets: [{ time, usage }] }] } } }`
 * - `GET /api/v0/usage/by_api_key/cost?start&end&tz&bucket=3600`
 *   → `{ data: { biz_data: { data: [{ currency, series: [{ api_key, model, buckets: [{ time, cost }] }] }] } } }`
 *
 * `start`/`end` are Unix seconds on local-day boundaries and `tz` is the local
 * UTC offset in seconds (28800 for UTC+8). Buckets of 3600s therefore land on
 * local wall-clock hours. These are undocumented private endpoints and may
 * change; every failure is mapped to a stable code instead of leaking shape.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/host/usage
 */

import { HOURS_PER_DAY } from '../shared.js'
import type { DataErrorCode, UsageSnapshot } from '../shared.js'
import { DataError, readTextLimited } from './http.js'

const PLATFORM_ORIGIN = 'https://platform.deepseek.com'
const USAGE_AMOUNT_URL = `${PLATFORM_ORIGIN}/api/v0/usage/by_api_key/amount`
const USAGE_COST_URL = `${PLATFORM_ORIGIN}/api/v0/usage/by_api_key/cost`
const USER_SUMMARY_URL = `${PLATFORM_ORIGIN}/api/v0/users/get_user_summary`

const REQUEST_TIMEOUT_MS = 15_000
const MAX_BODY_BYTES = 2 * 1024 * 1024

/** Browser-like headers; the dashboard endpoints reject obviously non-browser calls. */
const PLATFORM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const PLATFORM_REFERER = `${PLATFORM_ORIGIN}/usage`

/** Platform business codes that mean the session is missing or expired. */
const AUTH_CODES = new Set([40002, 40003])

/** Result of one day's usage fetch; `amountError` marks a chart-only payload. */
export interface UsageFetchResult {
  usage: UsageSnapshot
  amountError?: DataErrorCode
}

/** Tolerant object read for a decoded JSON value. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Parse a numeric field that may arrive as a string. */
function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(n) ? n : 0
}

/** Whether a platform `code`/`biz_code` value means success. */
function isSuccessCode(value: unknown): boolean {
  return value === undefined || value === null || value === 0 || value === '0' || value === 200 || value === '200' || value === 'success'
}

/** Whether an envelope code is an expired/absent session. */
function isAuthCode(value: unknown): boolean {
  return AUTH_CODES.has(toNumber(value))
}

/** Local day window of `now`, aligned to the platform's day boundaries. */
export interface TodayWindow {
  start: number
  end: number
  tzOffset: number
}

/**
 * Compute today's `[start, end)` window in Unix seconds plus the local UTC
 * offset the platform expects. Asia/Shanghai has no DST, but using the noon
 * offset keeps other fixed-offset zones exact and a DST transition honest.
 * @param now - current time (injectable for tests).
 * @returns window boundaries and offset seconds.
 */
export function todayWindow(now: Date = new Date()): TodayWindow {
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()
  const startMs = new Date(year, month, day, 0, 0, 0, 0).getTime()
  const endMs = new Date(year, month, day + 1, 0, 0, 0, 0).getTime()
  const tzOffset = -new Date(year, month, day, 12, 0, 0, 0).getTimezoneOffset() * 60
  return {
    start: Math.floor(startMs / 1000),
    end: Math.floor(endMs / 1000),
    tzOffset,
  }
}

/**
 * Convert a bucket's Unix second timestamp to the local hour index.
 * @param timeSeconds - bucket timestamp (Unix seconds).
 * @param tzOffset - local UTC offset seconds.
 * @returns hour 0–23, or -1 when the bucket is malformed/out of this day.
 */
export function bucketHour(timeSeconds: unknown, tzOffset: number): number {
  const seconds = toNumber(timeSeconds)
  if (seconds <= 0) return -1
  const hour = new Date((seconds + tzOffset) * 1000).getUTCHours()
  return hour >= 0 && hour < HOURS_PER_DAY ? hour : -1
}

/** Read one platform JSON response and reject auth/business failures. */
async function platformRequest(url: string, userToken: string): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${userToken}`,
        referer: PLATFORM_REFERER,
        'user-agent': PLATFORM_UA,
        'x-client-platform': 'web',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new DataError('timeout', 'usage request timed out')
    }
    throw new DataError('fetch_failed', 'usage request failed')
  }

  if (response.status === 401 || response.status === 403) {
    throw new DataError('auth_failed', 'userToken rejected', response.status)
  }
  if (response.status !== 200) {
    throw new DataError('fetch_failed', `usage endpoint returned HTTP ${response.status}`, response.status)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await readTextLimited(response, MAX_BODY_BYTES))
  } catch (error) {
    if (error instanceof DataError) throw error
    throw new DataError('invalid_response', 'usage endpoint returned invalid JSON', response.status)
  }
  const root = asRecord(parsed)
  if (root === undefined) {
    throw new DataError('invalid_response', 'usage endpoint returned a non-object', response.status)
  }

  const rootCode = root.code
  if (!isSuccessCode(rootCode)) {
    if (isAuthCode(rootCode)) throw new DataError('auth_failed', 'userToken expired', response.status)
    throw new DataError('platform_error', `platform rejected the request (code ${String(rootCode)})`, response.status)
  }
  const data = asRecord(root.data)
  const bizCode = data?.biz_code ?? root.biz_code
  if (!isSuccessCode(bizCode)) {
    if (isAuthCode(bizCode)) throw new DataError('auth_failed', 'userToken expired', response.status)
    throw new DataError('platform_error', `platform rejected the request (biz_code ${String(bizCode)})`, response.status)
  }
  return root
}

/** Extract `biz_data` from a platform envelope. */
function businessData(root: Record<string, unknown>): Record<string, unknown> {
  const data = asRecord(root.data)
  const biz = asRecord(data?.biz_data) ?? asRecord(root.biz_data)
  if (biz === undefined) {
    throw new DataError('invalid_response', 'platform response omitted biz_data')
  }
  return biz
}

/** Series array of the amount response, tolerating both known wrappers. */
function amountSeries(biz: Record<string, unknown>): unknown[] {
  const direct = biz.series
  if (Array.isArray(direct)) return direct
  const nested = asRecord(biz.amount)?.series
  return Array.isArray(nested) ? nested : []
}

/** Currency entries of the cost response, tolerating both known wrappers. */
function costEntries(biz: Record<string, unknown>): unknown[] {
  const direct = biz.data
  if (Array.isArray(direct)) return direct
  const nested = asRecord(biz.cost)?.data
  return Array.isArray(nested) ? nested : []
}

/** The API key name of one series, when present. */
function seriesKeyName(series: Record<string, unknown>): string | undefined {
  const key = asRecord(series.api_key)
  const name = key?.name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

/** Accumulate hourly tokens and requests from the amount response. */
function addAmountBuckets(
  biz: Record<string, unknown>,
  tzOffset: number,
  daily: { tokens: number[]; requests: number[]; apiKeys: Set<string> },
): void {
  for (const rawSeries of amountSeries(biz)) {
    const series = asRecord(rawSeries)
    if (series === undefined) continue
    const keyName = seriesKeyName(series)
    if (keyName !== undefined) daily.apiKeys.add(keyName)
    const buckets = series.buckets
    if (!Array.isArray(buckets)) continue
    for (const rawBucket of buckets) {
      const bucket = asRecord(rawBucket)
      const hour = bucketHour(bucket?.time, tzOffset)
      if (bucket === undefined || hour < 0) continue
      const usage = asRecord(bucket.usage)
      if (usage === undefined) continue
      const tokens = toNumber(usage.PROMPT_CACHE_HIT_TOKEN)
        + toNumber(usage.PROMPT_CACHE_MISS_TOKEN)
        + toNumber(usage.RESPONSE_TOKEN)
      daily.tokens[hour] = (daily.tokens[hour] ?? 0) + tokens
      daily.requests[hour] = (daily.requests[hour] ?? 0) + toNumber(usage.REQUEST)
    }
  }
}

/** Accumulate the CNY (or first) currency's hourly cost from the cost response. */
function addCostBuckets(
  biz: Record<string, unknown>,
  tzOffset: number,
  daily: { cost: number[]; apiKeys: Set<string>; currency?: string },
): void {
  const entries = costEntries(biz).map(asRecord).filter((entry): entry is Record<string, unknown> => entry !== undefined)
  if (entries.length === 0) return
  const currencyOf = (entry: Record<string, unknown>): string => (
    typeof entry.currency === 'string' && entry.currency.length > 0 ? entry.currency : 'CNY'
  )
  const picked = entries.find(entry => currencyOf(entry).toUpperCase() === 'CNY') ?? (entries[0] as Record<string, unknown>)
  daily.currency = currencyOf(picked)
  const seriesList = picked.series
  if (!Array.isArray(seriesList)) return
  for (const rawSeries of seriesList) {
    const series = asRecord(rawSeries)
    if (series === undefined) continue
    const keyName = seriesKeyName(series)
    if (keyName !== undefined) daily.apiKeys.add(keyName)
    const buckets = series.buckets
    if (!Array.isArray(buckets)) continue
    for (const rawBucket of buckets) {
      const bucket = asRecord(rawBucket)
      const hour = bucketHour(bucket?.time, tzOffset)
      if (bucket === undefined || hour < 0) continue
      daily.cost[hour] = (daily.cost[hour] ?? 0) + toNumber(bucket.cost)
    }
  }
}

/** Round accumulated floating point money to six decimals for the wire. */
function roundMoney(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** Sum an hourly series. */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * Fetch today's hourly usage. The cost endpoint is the chart's source and a
 * failure there fails the block; an amount-endpoint failure degrades to zero
 * tokens/requests so the spend chart still renders.
 * @param userToken - platform session token (never logged).
 * @param now - injectable clock for tests.
 * @returns usage snapshot plus an optional amount-source error.
 * @throws DataError with the mapped platform failure.
 */
export async function fetchTodayUsage(userToken: string, now: Date = new Date()): Promise<UsageFetchResult> {
  const window = todayWindow(now)
  const query = new URLSearchParams({
    start: String(window.start),
    end: String(window.end),
    tz: String(window.tzOffset),
    bucket: '3600',
  })
  const amountUrl = `${USAGE_AMOUNT_URL}?${query.toString()}`
  const costUrl = `${USAGE_COST_URL}?${query.toString()}`

  const [amountResult, costResult] = await Promise.allSettled([
    platformRequest(amountUrl, userToken).then(businessData),
    platformRequest(costUrl, userToken).then(businessData),
  ])
  if (costResult.status === 'rejected') {
    throw costResult.reason
  }

  const daily = {
    cost: new Array<number>(HOURS_PER_DAY).fill(0),
    tokens: new Array<number>(HOURS_PER_DAY).fill(0),
    requests: new Array<number>(HOURS_PER_DAY).fill(0),
    apiKeys: new Set<string>(),
    currency: undefined as string | undefined,
  }
  addCostBuckets(costResult.value, window.tzOffset, daily)
  let amountError: DataErrorCode | undefined
  if (amountResult.status === 'fulfilled') {
    addAmountBuckets(amountResult.value, window.tzOffset, daily)
  } else {
    amountError = amountResult.reason instanceof DataError ? amountResult.reason.code : 'fetch_failed'
  }

  const usage: UsageSnapshot = {
    currency: daily.currency ?? 'CNY',
    cost: roundMoney(sum(daily.cost)),
    tokens: sum(daily.tokens),
    requests: sum(daily.requests),
    hourlyCost: daily.cost.map(roundMoney),
    hourlyTokens: daily.tokens,
    hourlyRequests: daily.requests,
    apiKeys: [...daily.apiKeys],
    fetchedAt: Date.now(),
  }
  return amountError === undefined ? { usage } : { usage, amountError }
}

/**
 * Validate a platform session token without storing it: any successful
 * envelope on the account summary endpoint proves the session works.
 * @param userToken - candidate token.
 * @throws DataError `auth_failed` / transport codes when it is not usable.
 */
export async function probeUserToken(userToken: string): Promise<void> {
  await platformRequest(USER_SUMMARY_URL, userToken)
}
