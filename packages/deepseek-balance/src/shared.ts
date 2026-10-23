/**
 * Vocabulary shared by the host half and the browser half of the DeepSeek
 * usage card.
 *
 * The browser bundle inlines this module, so it must stay dependency-free and
 * runtime-neutral: plain interfaces, constants and the schema defaults. The
 * host half builds its schemastery schema from the same defaults, which keeps
 * the "render correctly before the first settings snapshot arrives" fallbacks
 * in sync with what the host actually projects.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/shared
 */

/** Component settings section name under `components`. */
export const SECTION = 'balanceCard'

/** Loader row id == settings namespace == row config page key suffix. */
export const ENTRY_ID = 'deepseek-balance'

/** The shell (bundle) package that declares this component's row. */
export const SHELL_PACKAGE = '@yamaarashihz/dsh-yamaarashi-custom'

/** `plugins.row.config` key used by the Plugins page for this component row. */
export const ROW_CONFIG_KEY = `${SHELL_PACKAGE}#${ENTRY_ID}`

/** Credential reference names, resolved through the DSH credentials service (env fallback included). */
export const API_KEY_REF = 'YAMAARASHI_DEEPSEEK_API_KEY'
export const USER_TOKEN_REF = 'YAMAARASHI_DEEPSEEK_USER_TOKEN'

/** Host route prefix; the browser half fetches same-origin paths under it. */
export const ROUTE_PREFIX = '/yamaarashi-deepseek-balance'
export const STATUS_PATH = `${ROUTE_PREFIX}/status`
export const DATA_PATH = `${ROUTE_PREFIX}/data`
export const CREDENTIALS_PATH = `${ROUTE_PREFIX}/credentials`

/** Refresh interval bounds (seconds) exposed on the row configuration page. */
export const DEFAULT_REFRESH_SECONDS = 60
export const MIN_REFRESH_SECONDS = 30
export const MAX_REFRESH_SECONDS = 600

/** Number of hourly buckets in one local day. */
export const HOURS_PER_DAY = 24

/** Card settings; mirrors the host schema defaults one-for-one. */
export interface BalanceCardConfig {
  /** Master switch for the card. */
  enabled: boolean
  /** Card heading; a blank value falls back to "DeepSeek". */
  title: string
  /** Auto refresh interval in seconds. */
  refreshSeconds: number
  /** Show the balance block. */
  showBalance: boolean
  /** Show today's hourly spend chart. */
  showTodayUsage: boolean
}

/** One component's settings section; add a sibling section per future component. */
export interface CustomSettings {
  balanceCard: BalanceCardConfig
}

/** Schema defaults, mirrored by the browser half for defensive fallback. */
export const CARD_DEFAULTS: BalanceCardConfig = {
  enabled: true,
  title: 'DeepSeek',
  refreshSeconds: DEFAULT_REFRESH_SECONDS,
  showBalance: true,
  showTodayUsage: true,
}

/** One currency row of the official balance endpoint. */
export interface BalanceCurrencyInfo {
  currency: string
  /** `total_balance` from the official endpoint. */
  total: number
  /** `granted_balance` from the official endpoint. */
  granted: number
  /** `topped_up_balance` from the official endpoint. */
  toppedUp: number
}

/** Balance block of the data response. */
export interface BalanceSnapshot {
  /** `is_available` of the official endpoint. */
  available: boolean
  /** Currency picked for display (CNY when present, else the first row). */
  currency: string
  /** The picked currency row. */
  info: BalanceCurrencyInfo
  /** Every currency row returned by the endpoint. */
  infos: BalanceCurrencyInfo[]
  /** Epoch milliseconds when this snapshot was fetched. */
  fetchedAt: number
}

/** Today's usage block of the data response. */
export interface UsageSnapshot {
  /** Display currency of the cost series. */
  currency: string
  /** Total cost today. */
  cost: number
  /** Total tokens today (cache-hit + cache-miss + output). */
  tokens: number
  /** Total API requests today. */
  requests: number
  /** Cost per local hour, index 0 = 00:00. */
  hourlyCost: number[]
  /** Tokens per local hour. */
  hourlyTokens: number[]
  /** Requests per local hour. */
  hourlyRequests: number[]
  /** API key names observed in today's series (for the card's key hint). */
  apiKeys: string[]
  /** Epoch milliseconds when this snapshot was fetched. */
  fetchedAt: number
}

/** Stable error codes the browser half maps to localized hints. */
export type DataErrorCode =
  | 'missing_api_key'
  | 'missing_user_token'
  | 'auth_failed'
  | 'invalid_response'
  | 'fetch_failed'
  | 'timeout'
  | 'invalid_param'
  | 'platform_error'

/** Combined data response; both blocks are optional so one failed source never hides the other. */
export interface DataResponse {
  ok: boolean
  /** Which credentials are currently configured. */
  configured: { apiKey: boolean; userToken: boolean }
  balance: BalanceSnapshot | null
  usage: UsageSnapshot | null
  /** Per-source error codes. */
  errors: { balance?: DataErrorCode; usage?: DataErrorCode }
  /** Epoch milliseconds of the response. */
  fetchedAt: number
  /** True when a cached payload is served because the live refresh failed. */
  stale?: boolean
}

/** Credential status response. */
export interface StatusResponse {
  ok: boolean
  apiKey: { configured: boolean }
  userToken: { configured: boolean }
}

/** Credential fields the configuration page can write. */
export type CredentialField = 'apiKey' | 'userToken'

/** Body of `PUT /credentials`. */
export interface CredentialWriteRequest {
  field: CredentialField
  value: string
}

/** Response of `PUT/DELETE /credentials`. */
export interface CredentialWriteResponse {
  ok: boolean
  field?: CredentialField
  error?: string
  message?: string
  status?: StatusResponse
}
