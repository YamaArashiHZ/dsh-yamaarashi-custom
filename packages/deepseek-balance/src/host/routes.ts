/**
 * Host routes of the usage card: credential status/write and the combined
 * balance+daily-usage payload the sidebar renders.
 *
 * The card polls one endpoint; the host fans out to both sources concurrently
 * and caches the combined result briefly, so a 60s browser refresh never turns
 * into two platform calls per card. Credential writes validate before storing:
 * a rejected key/token is reported and never persisted.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/host/routes
 */

import {
  API_KEY_REF, CREDENTIALS_PATH, DATA_PATH, STATUS_PATH, USER_TOKEN_REF,
} from '../shared.js'
import type {
  BalanceSnapshot, CredentialWriteResponse, DataResponse, StatusResponse, UsageSnapshot,
} from '../shared.js'
import type { HostContext, HostRoute } from './context.js'
import { isTrustedRequest } from './guard.js'
import { DataError, errorCode, methodNotAllowed, readJsonBody, sendJson } from './http.js'
import { fetchBalance } from './balance.js'
import { fetchTodayUsage, probeUserToken } from './usage.js'

/** Combined payload cache: dedupes a manual refresh right after a poll. */
const CACHE_TTL_MS = 15_000
/** Conservative secret length caps (a platform userToken is a long JWT). */
const MAX_API_KEY_LENGTH = 512
const MAX_USER_TOKEN_LENGTH = 8192
/** Query parameter that bypasses the short payload cache. */
const REFRESH_PARAM = 'refresh'

/** Cached combined payload. */
interface CacheEntry {
  at: number
  data: DataResponse
}

/** Parse a credential field name from user input. */
function parseField(value: unknown): 'apiKey' | 'userToken' | undefined {
  return value === 'apiKey' || value === 'userToken' ? value : undefined
}

/** Read a field name from the request query string. */
function queryField(req: { url?: string | undefined }): 'apiKey' | 'userToken' | undefined {
  try {
    return parseField(new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('field'))
  } catch {
    return undefined
  }
}

/** Whether the request asks to skip the short cache. */
function wantsRefresh(req: { url?: string | undefined }): boolean {
  try {
    return new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get(REFRESH_PARAM) === '1'
  } catch {
    return false
  }
}

/**
 * Build every route this component registers.
 * @param ctx - host context carrying the web server and credential service.
 * @returns exact-path route definitions.
 */
export function createRoutes(ctx: HostContext): HostRoute[] {
  let cache: CacheEntry | null = null
  let inflight: Promise<DataResponse> | null = null

  /** Resolve one credential reference; an absent or failed read means "not configured". */
  async function resolveCredential(ref: string): Promise<string | undefined> {
    try {
      const resolved = await ctx.credentials.resolve(ref)
      const value = resolved?.value.trim()
      return value !== undefined && value.length > 0 ? value : undefined
    } catch {
      return undefined
    }
  }

  /** Build the credential status body. */
  async function status(): Promise<StatusResponse> {
    const [apiKey, userToken] = await Promise.all([
      resolveCredential(API_KEY_REF),
      resolveCredential(USER_TOKEN_REF),
    ])
    return {
      ok: true,
      apiKey: { configured: apiKey !== undefined },
      userToken: { configured: userToken !== undefined },
    }
  }

  /** Fetch both sources concurrently; each failure stays local to its block. */
  async function loadData(): Promise<DataResponse> {
    const [apiKey, userToken] = await Promise.all([
      resolveCredential(API_KEY_REF),
      resolveCredential(USER_TOKEN_REF),
    ])
    const errors: DataResponse['errors'] = {}
    const [balanceResult, usageResult] = await Promise.allSettled([
      apiKey === undefined
        ? Promise.reject(new DataError('missing_api_key', 'no API key configured'))
        : fetchBalance(apiKey),
      userToken === undefined
        ? Promise.reject(new DataError('missing_user_token', 'no userToken configured'))
        : fetchTodayUsage(userToken),
    ])

    let balance: BalanceSnapshot | null = null
    if (balanceResult.status === 'fulfilled') {
      balance = balanceResult.value
    } else {
      errors.balance = errorCode(balanceResult.reason)
    }

    let usage: UsageSnapshot | null = null
    if (usageResult.status === 'fulfilled') {
      usage = usageResult.value.usage
      const amountError = usageResult.value.amountError
      if (amountError !== undefined) errors.usage = amountError
    } else {
      errors.usage = errorCode(usageResult.reason)
    }

    return {
      ok: balance !== null || usage !== null,
      configured: { apiKey: apiKey !== undefined, userToken: userToken !== undefined },
      balance,
      usage,
      errors,
      fetchedAt: Date.now(),
    }
  }

  /** Serve the combined payload, honouring the short cache and in-flight dedupe. */
  async function data(force: boolean): Promise<DataResponse> {
    if (force) cache = null
    if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) return cache.data
    if (inflight !== null) return inflight
    inflight = loadData().then((next) => {
      cache = { at: Date.now(), data: next }
      return next
    }).finally(() => { inflight = null })
    return inflight
  }

  /** Validate then store one credential; the value never leaves this closure. */
  async function writeCredential(field: 'apiKey' | 'userToken', value: string): Promise<CredentialWriteResponse> {
    const trimmed = value.trim()
    if (field === 'apiKey') {
      if (trimmed.length === 0 || trimmed.length > MAX_API_KEY_LENGTH) {
        return { ok: false, field, error: 'invalid_response', message: 'API Key 长度不合法' }
      }
      await fetchBalance(trimmed)
      await ctx.credentials.set(API_KEY_REF, trimmed)
    } else {
      if (trimmed.length === 0 || trimmed.length > MAX_USER_TOKEN_LENGTH) {
        return { ok: false, field, error: 'invalid_response', message: 'userToken 长度不合法' }
      }
      await probeUserToken(trimmed)
      await ctx.credentials.set(USER_TOKEN_REF, trimmed)
    }
    cache = null
    return { ok: true, field, status: await status() }
  }

  return [
    {
      kind: 'exact',
      path: STATUS_PATH,
      handler: async (req, res) => {
        if (!isTrustedRequest(req)) { sendJson(res, 403, { ok: false, error: 'forbidden' }); return }
        if (req.method !== 'GET') { methodNotAllowed(res); return }
        sendJson(res, 200, await status())
      },
    },
    {
      kind: 'exact',
      path: DATA_PATH,
      handler: async (req, res) => {
        if (!isTrustedRequest(req)) { sendJson(res, 403, { ok: false, error: 'forbidden' }); return }
        if (req.method !== 'GET') { methodNotAllowed(res); return }
        try {
          sendJson(res, 200, await data(wantsRefresh(req)))
        } catch (error) {
          console.error('[deepseek-balance] data route failed:', errorCode(error))
          sendJson(res, 500, { ok: false, error: 'fetch_failed' })
        }
      },
    },
    {
      kind: 'exact',
      path: CREDENTIALS_PATH,
      handler: async (req, res) => {
        if (req.method === 'PUT') {
          if (!isTrustedRequest(req, true)) { sendJson(res, 403, { ok: false, error: 'forbidden' }); return }
          const body = await readJsonBody(req)
          const field = parseField(body?.field)
          const value = typeof body?.value === 'string' ? body.value : ''
          if (field === undefined || value.trim().length === 0) {
            sendJson(res, 400, { ok: false, error: 'invalid_response', message: '缺少 field 或 value' })
            return
          }
          try {
            sendJson(res, 200, await writeCredential(field, value))
          } catch (error) {
            const code = errorCode(error)
            const status = error instanceof DataError && error.status !== undefined ? error.status : 502
            console.error('[deepseek-balance] credential validation failed:', code)
            sendJson(res, code === 'auth_failed' ? 400 : 502, {
              ok: false, field, error: code,
            } satisfies CredentialWriteResponse)
          }
          return
        }
        if (req.method === 'DELETE') {
          if (!isTrustedRequest(req, true)) { sendJson(res, 403, { ok: false, error: 'forbidden' }); return }
          const field = queryField(req)
          if (field === undefined) {
            sendJson(res, 400, { ok: false, error: 'invalid_response', message: '缺少 field' })
            return
          }
          try {
            await ctx.credentials.unset(field === 'apiKey' ? API_KEY_REF : USER_TOKEN_REF)
            cache = null
            sendJson(res, 200, { ok: true, field, status: await status() } satisfies CredentialWriteResponse)
          } catch {
            sendJson(res, 502, { ok: false, error: 'fetch_failed' } satisfies CredentialWriteResponse)
          }
          return
        }
        methodNotAllowed(res)
      },
    },
  ]
}
