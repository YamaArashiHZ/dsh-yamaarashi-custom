/**
 * The compact card rendered inside the sidebar.
 *
 * Visual target: the official DeepSeek usage dashboard, squeezed into a
 * ~236px-wide sidebar column — a small brand row (name + availability dot +
 * refresh), the account balance, and today's spend with an hourly bar chart.
 * All styling comes from the injected `.ybc-*` rules (`styles.ts`); this file
 * only decides content and states.
 *
 * States are independent per block: a missing API key hides the balance, a
 * missing `userToken` hides the chart hint-style, and an amount-endpoint error
 * still renders the spend chart. Transport failures (host unreachable) replace
 * both blocks with one retry hint.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/card
 */

import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import type { BalanceCardConfig, DataResponse, UsageSnapshot } from '../shared.js'
import { DotIcon, RefreshIcon, UsageChart } from './chart.js'
import { useUsageData } from './data.js'

/** Heading when the configured title is blank. */
const FALLBACK_TITLE = 'DeepSeek'

/** Official usage dashboard opened by a middle-click on the card (web UI only). */
const OFFICIAL_USAGE_URL = 'https://platform.deepseek.com/usage'

/** Elements inside the card that own their middle-click gesture. */
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"], [role="switch"]'

/**
 * Whether a middle-click landed on an interactive element that keeps its own
 * behavior (the refresh button today).
 * @param target - event target of the pointer event.
 * @returns true when the card must not claim the gesture.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = target as Element | null
  return element !== null
    && typeof element.closest === 'function'
    && element.closest(INTERACTIVE_SELECTOR) !== null
}

/**
 * Cancel Chromium's middle-click autoscroll on the card surface so the
 * `auxclick` that follows can open the dashboard instead of starting scroll.
 * @param event - native mousedown inside the card.
 */
function suppressMiddleAutoscroll(event: MouseEvent): void {
  if (event.button !== 1 || isInteractiveTarget(event.target)) return
  event.preventDefault()
}

/**
 * Middle-click the card (web UI only) opens the official usage dashboard in a
 * new tab. Inner controls keep their own gesture; left click stays inert.
 * @param event - native auxclick inside the card.
 */
function openOfficialUsage(event: MouseEvent): void {
  if (event.button !== 1 || isInteractiveTarget(event.target)) return
  event.preventDefault()
  window.open(OFFICIAL_USAGE_URL, '_blank', 'noopener,noreferrer')
}

/** Availability dot state. */
interface Availability {
  tone: 'ok' | 'bad' | 'unknown'
  label: string
}

/** Derive the header dot from the balance block (the account's own answer). */
function describeAvailability(data: DataResponse | null): Availability {
  if (data === null) return { tone: 'unknown', label: '状态未知' }
  if (data.balance === null) {
    return { tone: 'unknown', label: data.configured.apiKey ? '状态未知' : '未配置 API Key' }
  }
  return data.balance.available
    ? { tone: 'ok', label: '账户可用' }
    : { tone: 'bad', label: '账户不可用' }
}

/** Money text with two decimals and thousands separators (`0.00`, `1,234.56`). */
function money(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const fixed = Math.abs(safe).toFixed(2)
  const [whole, fraction] = fixed.split('.')
  const grouped = whole === undefined ? '0' : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${safe < 0 ? '-' : ''}${grouped}.${fraction ?? '00'}`
}

/** Currency glyph for the two currencies the card normally sees. */
function currencySymbol(currency: string): string {
  const upper = currency.trim().toUpperCase()
  if (upper === 'CNY' || upper === 'RMB') return '¥'
  if (upper === 'USD') return '$'
  return upper.length > 0 ? `${upper} ` : '¥'
}

/** Compact integer for call counts. */
function formatCalls(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  return String(Math.round(value))
}

/** Compact token count (`1.2K`, `3.4M`). */
function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  const scaled = (divisor: number, suffix: string): string => {
    const next = value / divisor
    const text = next >= 100 ? String(Math.round(next)) : next.toFixed(1).replace(/\.0$/, '')
    return `${text}${suffix}`
  }
  if (value >= 1_000_000_000) return scaled(1_000_000_000, 'B')
  if (value >= 1_000_000) return scaled(1_000_000, 'M')
  if (value >= 1_000) return scaled(1_000, 'K')
  return String(Math.round(value))
}

/** Local `HH:MM` of an epoch-millisecond timestamp. */
function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime()) || timestamp <= 0) return '--:--'
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Small muted hint block. */
function Hint({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'warn' }): ReactElement {
  return <div className="ybc-hint" data-tone={tone} role="status">{text}</div>
}

/** Transport-level failure with a retry affordance. */
function ErrorBlock({ text }: { text: string }): ReactElement {
  return (
    <div className="ybc-error" role="status">
      <span>{text}</span>
      <span className="ybc-error-retry">可点击右上角刷新按钮重试</span>
    </div>
  )
}

/** First-load placeholder. */
function SkeletonBody(): ReactElement {
  return (
    <div className="ybc-skeleton" aria-hidden="true">
      <span className="ybc-skel ybc-skel-line" style={{ width: '58%', height: '16px' }} />
      <span className="ybc-skel ybc-skel-line" style={{ width: '42%' }} />
      <span className="ybc-skel ybc-skel-block" />
    </div>
  )
}

/** Balance block: big total plus the topped-up/granted split. */
function BalanceBlock({ data }: { data: DataResponse }): ReactElement {
  const balance = data.balance
  const error = data.errors.balance
  if (balance === null) {
    if (error === 'missing_api_key' || !data.configured.apiKey) {
      return <Hint text="未配置 API Key" />
    }
    if (error === 'auth_failed') {
      return <Hint tone="warn" text="凭证无效，请到插件配置页更新" />
    }
    return <Hint tone="warn" text="余额获取失败，可点击刷新重试" />
  }
  const symbol = currencySymbol(balance.info.currency)
  return (
    <section className="ybc-balance">
      <div className="ybc-balance-total">
        <span className="ybc-currency">{symbol}</span>
        {money(balance.info.total)}
      </div>
      <div className="ybc-balance-sub">
        充值 {symbol}{money(balance.info.toppedUp)} · 赠送 {symbol}{money(balance.info.granted)}
      </div>
    </section>
  )
}

/** Footer line of the today block: call/token totals and the snapshot time. */
function usageFooter(usage: UsageSnapshot, amountFailed: boolean): string {
  if (amountFailed) return '调用量暂不可用'
  return `${formatCalls(usage.requests)} 次调用 · ${formatTokens(usage.tokens)} tokens`
}

/** Today block: amount row, hourly chart, footer. */
function TodayBlock({ data }: { data: DataResponse }): ReactElement {
  const usage = data.usage
  const error = data.errors.usage
  if (usage === null) {
    if (error === 'missing_user_token' || !data.configured.userToken) {
      return <Hint text="未配置 userToken，无法获取今日用量" />
    }
    if (error === 'auth_failed') {
      return <Hint tone="warn" text="凭证无效，请到插件配置页更新" />
    }
    return <Hint tone="warn" text="今日用量获取失败，可点击刷新重试" />
  }
  const symbol = currencySymbol(usage.currency)
  const amountFailed = error !== undefined
  const updatedAt = usage.fetchedAt > 0 ? usage.fetchedAt : data.fetchedAt
  return (
    <section className="ybc-today">
      <div className="ybc-today-head">
        <span className="ybc-today-label">消费金额 ({usage.currency})</span>
        <span className="ybc-today-right">
          <span className="ybc-pill" aria-hidden="true">API Key</span>
          <span className="ybc-today-amount">{symbol}{money(usage.cost)}</span>
        </span>
      </div>
      <UsageChart hours={usage.hourlyCost} />
      <div className="ybc-foot">
        <span>{usageFooter(usage, amountFailed)}</span>
        <span>更新 {formatClock(updatedAt)}</span>
      </div>
    </section>
  )
}

/**
 * The sidebar card.
 * @param props.config - resolved card settings (already defensively read).
 * @returns the card, or null when the component is disabled.
 */
export function UsageCard({ config }: { config: BalanceCardConfig }): ReactElement | null {
  // Hooks run before the disabled return: the card unmounts when disabled, but
  // keeping the order unconditional makes the component safe to reuse.
  const { data, error, loading, refresh } = useUsageData(config.enabled, config.refreshSeconds)
  const cardRef = useRef<HTMLDivElement>(null)

  // Native listeners (not React's synthetic pair) keep the middle-click gesture
  // attached to the card surface through the sidebar portal, and the mousedown
  // cancel is what suppresses Chromium's autoscroll before `auxclick` arrives.
  useEffect(() => {
    const element = cardRef.current
    if (element === null) return undefined
    element.addEventListener('mousedown', suppressMiddleAutoscroll)
    element.addEventListener('auxclick', openOfficialUsage)
    return () => {
      element.removeEventListener('mousedown', suppressMiddleAutoscroll)
      element.removeEventListener('auxclick', openOfficialUsage)
    }
  }, [])
  if (!config.enabled) return null

  const title = config.title.trim().length > 0 ? config.title.trim() : FALLBACK_TITLE
  const availability = describeAvailability(data)
  const body = data === null
    ? (loading ? <SkeletonBody /> : <ErrorBlock text={error ?? '暂无用量数据，可点击刷新重试'} />)
    : (
      <>
        {config.showBalance ? <BalanceBlock data={data} /> : null}
        {config.showTodayUsage ? <TodayBlock data={data} /> : null}
      </>
    )

  return (
    <div className="ybc-card" ref={cardRef}>
      <header className="ybc-head">
        <span className="ybc-brand">
          <span className="ybc-brand-name">{title}</span>
        </span>
        <span className="ybc-actions">
          <span
            className="ybc-status"
            data-tone={availability.tone}
            role="img"
            aria-label={availability.label}
            title={availability.label}
          >
            <DotIcon size={7} />
          </span>
          <button
            type="button"
            className="ybc-refresh"
            aria-label="刷新用量数据"
            title="刷新用量数据"
            disabled={loading}
            onClick={() => { refresh() }}
          >
            <RefreshIcon size={12} className={loading ? 'ybc-spin' : undefined} />
          </button>
        </span>
      </header>
      {body}
    </div>
  )
}
