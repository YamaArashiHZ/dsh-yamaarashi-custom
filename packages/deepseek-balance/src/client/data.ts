/**
 * Browser-side data access for the usage card.
 *
 * The card polls ONE same-origin host route ({@link DATA_PATH}); the host fans
 * out to the official balance endpoint and the platform's hourly usage
 * endpoints, so no secret ever reaches this bundle. Manual refreshes add
 * `?refresh=1` to bypass the host's short payload cache.
 *
 * Everything returned by the route is untrusted: {@link parseDataResponse}
 * rebuilds a fully typed {@link DataResponse} with defaults, so a host/plugin
 * version skew degrades to a partial card instead of a render crash. Failures
 * are localized to Chinese text here and never echo server bodies (a body
 * could contain request ids, and the card must not display anything secret).
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/data
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DATA_PATH, HOURS_PER_DAY, MIN_REFRESH_SECONDS,
} from '../shared.js'
import type {
  BalanceCurrencyInfo, BalanceSnapshot, DataErrorCode, DataResponse, UsageSnapshot,
} from '../shared.js'

/** Request budget. The host fans out to two upstream calls, so this is generous. */
const REQUEST_TIMEOUT_MS = 20_000

/** Query parameter that makes the host skip its short payload cache. */
const REFRESH_QUERY = '?refresh=1'

/** Poll floor; the host schema clamps too, this only guards a stale snapshot. */
const POLL_FLOOR_SECONDS = MIN_REFRESH_SECONDS

/** Stable codes the host route may report per source. */
const ERROR_CODES: readonly DataErrorCode[] = [
  'missing_api_key',
  'missing_user_token',
  'auth_failed',
  'invalid_response',
  'fetch_failed',
  'timeout',
  'invalid_param',
  'platform_error',
]

/** Hook state returned by {@link useUsageData}. */
export interface UsageDataState {
  /** Last accepted payload; kept while an automatic refresh is in flight. */
  data: DataResponse | null
  /** Localized transport-level failure; null once a request succeeds. */
  error: string | null
  /** True while a request is in flight (initial, polled or manual). */
  loading: boolean
  /** Force a refresh now (bypasses the host's short cache). */
  refresh: () => void
}

/** Classified failure of one browser-side request. */
export class UsageDataError extends Error {
  readonly kind: 'timeout' | 'forbidden' | 'unavailable' | 'server' | 'malformed' | 'network'
  readonly status: number | undefined

  /**
   * @param kind - failure class used to pick the Chinese hint.
   * @param status - optional HTTP status (never shown to the user).
   */
  constructor(kind: UsageDataError['kind'], status?: number) {
    super(kind)
    this.name = 'UsageDataError'
    this.kind = kind
    this.status = status
  }
}

/** Narrow an unknown JSON value to a plain object without trusting it. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Read a finite number, else the fallback. */
function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Read a non-empty string, else the fallback. */
function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** Read a stable error code, else undefined. */
function readErrorCode(value: unknown): DataErrorCode | undefined {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
    ? value as DataErrorCode
    : undefined
}

/** Read one currency row of the balance payload. */
function readCurrencyInfo(value: unknown): BalanceCurrencyInfo | null {
  const row = asRecord(value)
  if (row === undefined) return null
  return {
    currency: readString(row.currency, 'CNY'),
    total: readNumber(row.total, 0),
    granted: readNumber(row.granted, 0),
    toppedUp: readNumber(row.toppedUp, 0),
  }
}

/** Rebuild the balance block from untrusted JSON. */
function readBalanceSnapshot(value: unknown): BalanceSnapshot | null {
  const row = asRecord(value)
  if (row === undefined) return null
  const info = readCurrencyInfo(row.info)
  const infos = Array.isArray(row.infos)
    ? row.infos
      .map(readCurrencyInfo)
      .filter((entry): entry is BalanceCurrencyInfo => entry !== null)
    : []
  const chosen = info ?? infos[0]
  if (chosen === undefined) return null
  return {
    available: row.available === true,
    currency: readString(row.currency, chosen.currency),
    info: chosen,
    infos: infos.length > 0 ? infos : [chosen],
    fetchedAt: readNumber(row.fetchedAt, 0),
  }
}

/** Normalize an hourly series to exactly 24 non-negative finite numbers. */
function readHourlySeries(value: unknown): number[] {
  const list = Array.isArray(value) ? value : []
  const series = new Array<number>(HOURS_PER_DAY).fill(0)
  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    const entry = list[hour]
    series[hour] = typeof entry === 'number' && Number.isFinite(entry) ? Math.max(0, entry) : 0
  }
  return series
}

/** Rebuild the usage block from untrusted JSON. */
function readUsageSnapshot(value: unknown): UsageSnapshot | null {
  const row = asRecord(value)
  if (row === undefined) return null
  return {
    currency: readString(row.currency, 'CNY'),
    cost: Math.max(0, readNumber(row.cost, 0)),
    tokens: Math.max(0, readNumber(row.tokens, 0)),
    requests: Math.max(0, readNumber(row.requests, 0)),
    hourlyCost: readHourlySeries(row.hourlyCost),
    hourlyTokens: readHourlySeries(row.hourlyTokens),
    hourlyRequests: readHourlySeries(row.hourlyRequests),
    apiKeys: Array.isArray(row.apiKeys)
      ? row.apiKeys.filter((name): name is string => typeof name === 'string' && name.length > 0)
      : [],
    fetchedAt: readNumber(row.fetchedAt, 0),
  }
}

/**
 * Rebuild a typed data payload from an untrusted response body.
 * @param value - parsed JSON (or anything).
 * @returns the typed payload, or null when the body is not an object at all.
 */
export function parseDataResponse(value: unknown): DataResponse | null {
  const row = asRecord(value)
  if (row === undefined) return null
  const balance = readBalanceSnapshot(row.balance)
  const usage = readUsageSnapshot(row.usage)
  const rawErrors = asRecord(row.errors)
  const configured = asRecord(row.configured)
  const errors: DataResponse['errors'] = {}
  const balanceError = readErrorCode(rawErrors?.balance)
  if (balanceError !== undefined) errors.balance = balanceError
  const usageError = readErrorCode(rawErrors?.usage)
  if (usageError !== undefined) errors.usage = usageError
  return {
    ok: row.ok === true || balance !== null || usage !== null,
    configured: {
      apiKey: configured?.apiKey === true,
      userToken: configured?.userToken === true,
    },
    balance,
    usage,
    errors,
    fetchedAt: readNumber(row.fetchedAt, Date.now()),
    stale: row.stale === true,
  }
}

/**
 * Fetch one combined payload from the host route.
 * @param force - true for a manual refresh (bypasses the host's short cache).
 * @param signal - cancellation signal owned by the caller.
 * @returns the typed payload.
 * @throws UsageDataError with a stable kind.
 */
export async function requestUsageData(force: boolean, signal: AbortSignal): Promise<DataResponse> {
  let response: Response
  try {
    response = await fetch(force ? `${DATA_PATH}${REFRESH_QUERY}` : DATA_PATH, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw new UsageDataError('timeout')
    if (error instanceof Error && error.name === 'AbortError') throw new UsageDataError('timeout')
    throw new UsageDataError('network')
  }
  if (response.status === 403) throw new UsageDataError('forbidden', response.status)
  if (response.status === 404 || response.status === 405) {
    throw new UsageDataError('unavailable', response.status)
  }
  if (!response.ok) throw new UsageDataError('server', response.status)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new UsageDataError('malformed', response.status)
  }
  const parsed = parseDataResponse(body)
  if (parsed === null) throw new UsageDataError('malformed', response.status)
  return parsed
}

/**
 * Localize a transport-level failure. Never includes a server body or secret.
 * @param error - anything thrown by {@link requestUsageData}.
 * @returns Chinese hint shown inside the card.
 */
export function dataErrorMessage(error: unknown): string {
  if (error instanceof UsageDataError) {
    switch (error.kind) {
      case 'timeout':
        return '请求超时，请检查网络后重试'
      case 'forbidden':
        return '数据接口拒绝访问，请确认使用本机浏览器打开'
      case 'unavailable':
        return '插件数据接口未就绪，请重启 DSH 后重试'
      case 'server':
        return '获取数据失败（服务端错误），稍后会自动重试'
      case 'malformed':
        return '数据格式异常，请确认插件版本匹配'
      case 'network':
      default:
        return '网络异常，无法获取用量数据'
    }
  }
  if (error instanceof Error && error.name === 'AbortError') return '请求超时，请检查网络后重试'
  return '网络异常，无法获取用量数据'
}

/**
 * Poll the host payload for the card.
 *
 * Behaviour: fetch on mount, poll every `refreshSeconds` (floored at the host's
 * minimum), refresh when the tab becomes visible again, and abort any in-flight
 * request on unmount or supersession. A failed refresh keeps the last accepted
 * payload; the localized error is exposed alongside it.
 *
 * @param enabled - false stops all polling (the card is hidden anyway).
 * @param refreshSeconds - configured poll interval.
 * @returns data, localized error, in-flight flag and a manual refresh trigger.
 */
export function useUsageData(enabled: boolean, refreshSeconds: number): UsageDataState {
  const [data, setData] = useState<DataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [nonce, setNonce] = useState(0)
  const forcedRef = useRef(false)

  const refresh = useCallback(() => {
    forcedRef.current = true
    setNonce(value => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      setLoading(false)
      return undefined
    }

    const force = forcedRef.current
    forcedRef.current = false
    let disposed = false
    let active: AbortController | null = null

    const load = (forceRefresh: boolean): void => {
      active?.abort()
      const controller = new AbortController()
      active = controller
      let timedOut = false
      const timeout = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, REQUEST_TIMEOUT_MS)
      setLoading(true)
      void requestUsageData(forceRefresh, controller.signal)
        .then((next) => {
          if (disposed || controller !== active) return
          setData(next)
          setError(null)
        })
        .catch((cause: unknown) => {
          if (disposed || controller !== active) return
          setError(timedOut ? '请求超时，请检查网络后重试' : dataErrorMessage(cause))
        })
        .finally(() => {
          window.clearTimeout(timeout)
          if (!disposed && controller === active) setLoading(false)
        })
    }

    load(force)
    const intervalSeconds = Math.max(POLL_FLOOR_SECONDS, Math.round(refreshSeconds))
    const poll = window.setInterval(() => { load(false) }, intervalSeconds * 1000)
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') load(false)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      disposed = true
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      active?.abort()
    }
  }, [enabled, refreshSeconds, nonce])

  return { data, error, loading, refresh }
}
