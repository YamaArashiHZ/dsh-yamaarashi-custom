/**
 * Row configuration page for the usage card.
 *
 * Registered into `plugins.row.config` under
 * `<shell package>#<row id>` and gated by `configForms.whileServed([ENTRY_ID])`,
 * so a deployment that never serves this namespace shows no trace of the page.
 * `view === 'summary'` returns null: the row's own description is the summary
 * and the Plugins page would otherwise nest a form inside a `<p>`.
 *
 * Two sections:
 * - 外观/行为 — the host schema fields, written through path-addressed
 *   `mutate()` calls so the sidebar card updates live. Numeric rows pair a
 *   native range input with the primitives' number input (DSH 0.2.1 has no
 *   slider atom), like the mascot component's page.
 * - 凭证 — API key / platform `userToken`. Values are written to the host's
 *   credentials route, which validates then stores them in the DSH credentials
 *   service; this page never reads a stored secret back and only shows
 *   configured / missing state. Status is fetched from `STATUS_PATH`.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/settings
 */

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  CREDENTIALS_PATH, ENTRY_ID, MAX_REFRESH_SECONDS, MIN_REFRESH_SECONDS, ROW_CONFIG_KEY, STATUS_PATH,
} from '../shared.js'
import type {
  BalanceCardConfig, CredentialField, CredentialWriteRequest, CredentialWriteResponse, StatusResponse,
} from '../shared.js'
import { readBalanceCardConfig } from './config.js'
import type { ClientContext, ConfigFormService } from './contract.js'

/** Request budget for the small credential/status calls. */
const CREDENTIAL_TIMEOUT_MS = 20_000
/** Interval slider granularity (the host accepts any whole second in range). */
const REFRESH_STEP_SECONDS = 5

/* ------------------------------------------------------------------ */
/* styles (same shape as the mascot component's page)                  */
/* ------------------------------------------------------------------ */

const pageStyle = { display: 'grid', gap: '14px', maxWidth: '680px' } as const
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
} as const
const titleStyle = { margin: 0, fontSize: '14px', fontWeight: 600 } as const
const hintStyle = { margin: '2px 0 0', fontSize: '12px', opacity: 0.7 } as const
const warnStyle = {
  margin: 0,
  fontSize: '12px',
  color: 'var(--dsw-alias-state-warn-label, #d7a35a)',
} as const
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
} as const
const fieldColumnStyle = { flex: '1 1 auto', minWidth: 0 } as const
const controlColumnStyle = { flex: '0 0 auto', paddingTop: '2px' } as const
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600 } as const
const controlGroupStyle = { display: 'flex', alignItems: 'center', gap: '10px' } as const
const numberInputStyle = { width: '88px', textAlign: 'right' } as const
const textInputStyle = { width: '260px' } as const
const rangeStyle: CSSProperties = {
  width: '150px',
  accentColor: 'var(--dsw-alias-state-business-primary, #4d6bfe)',
}
const sectionStyle = {
  display: 'grid',
  gap: '14px',
  paddingTop: '12px',
  borderTop: '1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.07))',
} as const
const sectionHeadStyle = { display: 'grid', gap: '2px' } as const
const sectionTitleStyle = { margin: 0, fontSize: '13px', fontWeight: 600 } as const
const secretCardStyle = {
  display: 'grid',
  gap: '8px',
  padding: '12px',
  border: '1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.07))',
  borderRadius: 'var(--dsw-radius-md, 12px)',
  background: 'var(--dsw-alias-bg-layer-1, transparent)',
} as const
const secretHeadStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
} as const
const secretInputRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
} as const
const secretInputStyle = { width: '300px', maxWidth: '100%' } as const
const instructionsStyle = {
  display: 'grid',
  gap: '3px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: '11px',
  lineHeight: 1.6,
  opacity: 0.72,
} as const
const codeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: '11px',
  padding: '1px 4px',
  borderRadius: '4px',
  background: 'var(--dsw-alias-bg-layer-2, rgba(148, 163, 184, 0.14))',
}

/** `已配置` / `未配置` / `状态未知` badge. */
function badgeStyle(configured: boolean | null): CSSProperties {
  if (configured === true) {
    return {
      flex: '0 0 auto',
      padding: '0 7px',
      fontSize: '11px',
      lineHeight: '18px',
      borderRadius: '9px',
      border: '1px solid rgba(34, 197, 94, 0.35)',
      background: 'rgba(34, 197, 94, 0.10)',
      color: 'var(--dsw-alias-state-success-primary, #22c55e)',
      whiteSpace: 'nowrap',
    }
  }
  if (configured === false) {
    return {
      flex: '0 0 auto',
      padding: '0 7px',
      fontSize: '11px',
      lineHeight: '18px',
      borderRadius: '9px',
      border: '1px solid rgba(215, 163, 90, 0.35)',
      background: 'rgba(215, 163, 90, 0.12)',
      color: 'var(--dsw-alias-state-warn-label, #d7a35a)',
      whiteSpace: 'nowrap',
    }
  }
  return {
    flex: '0 0 auto',
    padding: '0 7px',
    fontSize: '11px',
    lineHeight: '18px',
    borderRadius: '9px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    background: 'rgba(148, 163, 184, 0.12)',
    color: 'var(--dsw-alias-label-tertiary, #94a3b8)',
    whiteSpace: 'nowrap',
  }
}

/** Notice line under a credential row. */
function noticeStyle(tone: 'ok' | 'error'): CSSProperties {
  return {
    margin: 0,
    fontSize: '11px',
    lineHeight: 1.5,
    color: tone === 'ok'
      ? 'var(--dsw-alias-state-success-primary, #22c55e)'
      : 'var(--dsw-alias-state-error-primary, #ef4444)',
  }
}

/* ------------------------------------------------------------------ */
/* settings writes                                                     */
/* ------------------------------------------------------------------ */

/** Write one card field through the path-addressed settings document. */
function writeCard(form: ConfigFormService, field: keyof BalanceCardConfig, value: unknown): void {
  void form.mutate([{ op: 'set', path: ['components', 'balanceCard', field], value }])
}

/* ------------------------------------------------------------------ */
/* reusable rows                                                       */
/* ------------------------------------------------------------------ */

/** One label + hint + control row. */
function Row(props: { label: string; hint?: string; children: ReactNode }): ReactElement {
  return (
    <div style={rowStyle}>
      <div style={fieldColumnStyle}>
        <span style={labelStyle}>{props.label}</span>
        {props.hint === undefined ? null : <p style={hintStyle}>{props.hint}</p>}
      </div>
      <div style={controlColumnStyle}>{props.children}</div>
    </div>
  )
}

/** Boolean field as a token-styled switch. */
function BooleanRow(props: {
  label: string
  hint?: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}): ReactElement {
  return (
    <Row label={props.label} hint={props.hint}>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        label={props.label}
        onChange={props.onChange}
      />
    </Row>
  )
}

/**
 * Number field: a native range slider plus a numeric input, sharing one draft.
 * The UI stays local while typing/dragging; the write is committed on blur,
 * pointer release or key release, so a drag is one write, not one per step.
 */
function NumberRow(props: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  disabled: boolean
  onCommit: (value: number) => void
}): ReactElement {
  const [draft, setDraft] = useState(() => String(props.value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(String(props.value))
  }, [focused, props.value])

  const parsed = Number(draft)
  const sliderValue = Number.isFinite(parsed)
    ? Math.min(props.max, Math.max(props.min, parsed))
    : props.value

  /** Clamp one raw value, keep the draft aligned, and write only real changes. */
  const commitValue = (raw: number): void => {
    if (!Number.isFinite(raw)) {
      setDraft(String(props.value))
      return
    }
    const next = Math.min(props.max, Math.max(props.min, raw))
    setDraft(String(next))
    if (next !== props.value) props.onCommit(next)
  }

  return (
    <Row label={props.label} hint={props.hint}>
      <div style={controlGroupStyle}>
        <input
          type="range"
          aria-label={`${props.label}滑条`}
          min={props.min}
          max={props.max}
          step={props.step}
          value={sliderValue}
          disabled={props.disabled}
          style={rangeStyle}
          onChange={event => setDraft(event.currentTarget.value)}
          onPointerUp={event => { commitValue(Number(event.currentTarget.value)) }}
          onKeyUp={event => { commitValue(Number(event.currentTarget.value)) }}
        />
        <Input
          type="number"
          aria-label={props.label}
          style={numberInputStyle}
          value={draft}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          onChange={event => setDraft(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={event => { setFocused(false); commitValue(Number(event.currentTarget.value)) }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
        />
      </div>
    </Row>
  )
}

/** Text field: local draft, committed on blur/Enter. */
function TextRow(props: {
  label: string
  hint?: string
  placeholder?: string
  value: string
  disabled: boolean
  onCommit: (value: string) => void
}): ReactElement {
  const [draft, setDraft] = useState(props.value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(props.value)
  }, [focused, props.value])

  const commit = (): void => {
    const next = draft.trim()
    setDraft(next)
    if (next !== props.value) props.onCommit(next)
  }

  return (
    <Row label={props.label} hint={props.hint}>
      <Input
        type="text"
        aria-label={props.label}
        style={textInputStyle}
        placeholder={props.placeholder}
        value={draft}
        disabled={props.disabled}
        onChange={event => setDraft(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commit() }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
    </Row>
  )
}

/* ------------------------------------------------------------------ */
/* credential transport                                                */
/* ------------------------------------------------------------------ */

/** Narrow an unknown JSON value to a plain object without trusting it. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Rebuild a status payload from untrusted JSON. */
function readStatusResponse(value: unknown): StatusResponse | null {
  const row = asRecord(value)
  if (row === undefined) return null
  const apiKey = asRecord(row.apiKey)
  const userToken = asRecord(row.userToken)
  return {
    ok: row.ok === true,
    apiKey: { configured: apiKey?.configured === true },
    userToken: { configured: userToken?.configured === true },
  }
}

/** `fetch` with a hard timeout; the caller keeps no controller of its own. */
async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CREDENTIAL_TIMEOUT_MS)
  try {
    return await fetch(path, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Read a response body as JSON, tolerating an empty/non-JSON body. */
async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** Fetch credential status; throws on transport/malformed failures. */
async function requestStatus(): Promise<StatusResponse> {
  const response = await fetchWithTimeout(STATUS_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  const status = readStatusResponse(await readJsonBody(response))
  if (!response.ok || status === null) throw new Error('credential status unavailable')
  return status
}

/** Normalize one credential write response. */
async function readWriteResponse(response: Response): Promise<CredentialWriteResponse> {
  const row = asRecord(await readJsonBody(response))
  const field = row?.field === 'apiKey' || row?.field === 'userToken' ? row.field : undefined
  const error = typeof row?.error === 'string' ? row.error : undefined
  const message = typeof row?.message === 'string' ? row.message : undefined
  const status = readStatusResponse(row?.status)
  return {
    ok: response.ok && row?.ok === true,
    ...(field === undefined ? {} : { field }),
    ...(error === undefined ? {} : { error }),
    ...(message === undefined ? {} : { message }),
    ...(status === null ? {} : { status }),
  }
}

/** Validate then store one credential through the host route. */
async function saveCredential(field: CredentialField, value: string): Promise<CredentialWriteResponse> {
  const payload: CredentialWriteRequest = { field, value }
  const response = await fetchWithTimeout(CREDENTIALS_PATH, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  })
  return readWriteResponse(response)
}

/** Delete one stored credential through the host route. */
async function clearCredential(field: CredentialField): Promise<CredentialWriteResponse> {
  const response = await fetchWithTimeout(
    `${CREDENTIALS_PATH}?field=${encodeURIComponent(field)}`,
    { method: 'DELETE', headers: { accept: 'application/json' }, cache: 'no-store' },
  )
  return readWriteResponse(response)
}

/** Chinese hint for a rejected write; server text is only used when already localized. */
function credentialErrorMessage(response: CredentialWriteResponse): string {
  switch (response.error) {
    case 'auth_failed':
      return '凭证无效或已过期，请检查后重试'
    case 'invalid_response':
      return response.message ?? '凭证格式不合法'
    case 'invalid_param':
      return '凭证参数不合法'
    case 'timeout':
      return '验证请求超时，请稍后重试'
    case 'platform_error':
      return '平台拒绝了该凭证，请稍后重试'
    default:
      return response.message ?? '保存失败，请稍后重试'
  }
}

/** Chinese hint for a thrown transport failure. */
function credentialRequestError(cause: unknown): string {
  if (cause instanceof Error && cause.name === 'AbortError') return '请求超时，请稍后重试'
  return '无法连接 DSH 服务，请稍后重试'
}

/* ------------------------------------------------------------------ */
/* credential rows                                                     */
/* ------------------------------------------------------------------ */

/** One secret field: status badge, password input, save/clear, instructions. */
function SecretRow(props: {
  label: string
  hint: string
  field: CredentialField
  configured: boolean | null
  instructions: ReactNode
  onWriteResult: (response: CredentialWriteResponse) => void
}): ReactElement {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const save = async (): Promise<void> => {
    const value = draft.trim()
    if (value.length === 0) {
      setNotice({ tone: 'error', text: '请先输入要保存的值' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const response = await saveCredential(props.field, value)
      if (response.ok) {
        setDraft('')
        setNotice({ tone: 'ok', text: '已保存，凭证验证通过' })
        props.onWriteResult(response)
      } else {
        setNotice({ tone: 'error', text: credentialErrorMessage(response) })
      }
    } catch (cause) {
      setNotice({ tone: 'error', text: credentialRequestError(cause) })
    } finally {
      setBusy(false)
    }
  }

  const clear = async (): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      const response = await clearCredential(props.field)
      if (response.ok) {
        setDraft('')
        setNotice({ tone: 'ok', text: '已清除' })
        props.onWriteResult(response)
      } else {
        setNotice({ tone: 'error', text: '清除失败，请稍后重试' })
      }
    } catch (cause) {
      setNotice({ tone: 'error', text: credentialRequestError(cause) })
    } finally {
      setBusy(false)
    }
  }

  const badgeText = props.configured === null
    ? '状态未知'
    : props.configured ? '已配置' : '未配置'

  return (
    <div style={secretCardStyle}>
      <div style={secretHeadStyle}>
        <span style={labelStyle}>{props.label}</span>
        <span style={badgeStyle(props.configured)}>{badgeText}</span>
      </div>
      <p style={hintStyle}>{props.hint}</p>
      <div style={secretInputRowStyle}>
        <Input
          type="password"
          aria-label={`${props.label}输入框`}
          style={secretInputStyle}
          placeholder={props.configured === true ? '已配置，输入新值可覆盖' : '粘贴新的凭证'}
          value={draft}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          onChange={event => setDraft(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            void save()
          }}
        />
        <Button
          size="sm"
          variant="primary"
          disabled={busy || draft.trim().length === 0}
          onClick={() => { void save() }}
        >
          {busy ? '保存中…' : '保存'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || props.configured !== true}
          onClick={() => { void clear() }}
        >
          清除
        </Button>
      </div>
      {notice === null ? null : <p style={noticeStyle(notice.tone)}>{notice.text}</p>}
      <ul style={instructionsStyle}>{props.instructions}</ul>
    </div>
  )
}

/** Instructions for the platform session token. */
function UserTokenInstructions(): ReactElement {
  return (
    <>
      <li>1. 登录 platform.deepseek.com（与使用 API Key 同一个账号）。</li>
      <li>2. 按 F12 打开开发者工具，切到 Console。</li>
      <li>3. 执行 <code style={codeStyle}>localStorage.getItem(&quot;userToken&quot;)</code>，复制返回值（去掉首尾引号）。</li>
      <li>4. 粘贴到上方输入框保存；会话过期后需要重新获取。</li>
    </>
  )
}

/** Instructions for the official API key. */
function ApiKeyInstructions(): ReactElement {
  return (
    <>
      <li>1. 登录 platform.deepseek.com → API Keys 页面创建密钥（形如 sk-…）。</li>
      <li>2. 粘贴到上方输入框保存；该密钥用于读取官方余额接口。</li>
    </>
  )
}

/** Credentials section: status on mount, two secret rows. */
function CredentialsSection(): ReactElement {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let disposed = false
    void requestStatus()
      .then((next) => {
        if (disposed) return
        setStatus(next)
        setStatusError(null)
      })
      .catch(() => {
        if (disposed) return
        setStatusError('无法读取凭证状态，请刷新页面重试')
      })
    return () => { disposed = true }
  }, [reloadToken])

  const applyWriteResult = (response: CredentialWriteResponse): void => {
    if (response.status !== undefined) setStatus(response.status)
    else setReloadToken(value => value + 1)
  }

  return (
    <section style={sectionStyle}>
      <div style={sectionHeadStyle}>
        <h4 style={sectionTitleStyle}>凭证</h4>
        <p style={hintStyle}>
          密钥保存在本机 DSH 凭据服务中，不会写入插件配置文件；本页只显示是否已配置，不会回显已保存的值。
        </p>
      </div>
      {statusError === null ? null : <p style={warnStyle}>{statusError}</p>}
      <SecretRow
        label="API Key"
        hint="读取账户余额（api.deepseek.com）。"
        field="apiKey"
        configured={status === null ? null : status.apiKey.configured}
        instructions={<ApiKeyInstructions />}
        onWriteResult={applyWriteResult}
      />
      <SecretRow
        label="userToken"
        hint="读取今日分时用量（platform.deepseek.com 平台会话凭证）。"
        field="userToken"
        configured={status === null ? null : status.userToken.configured}
        instructions={<UserTokenInstructions />}
        onWriteResult={applyWriteResult}
      />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

/**
 * The card's configuration page.
 * @param props.form - live config form of the `deepseek-balance` namespace.
 * @returns the appearance/behaviour section plus the credentials section.
 */
export function BalanceSettingsPage({ form }: { form: ConfigFormService }): ReactElement {
  const [snapshot, setSnapshot] = useState(() => form.getSnapshot())
  useEffect(() => form.subscribe(() => setSnapshot(form.getSnapshot())), [form])

  const ready = snapshot.status === 'ready'
  const config = readBalanceCardConfig(ready ? snapshot.value : undefined)

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={fieldColumnStyle}>
          <h3 style={titleStyle}>DeepSeek 用量卡片</h3>
          <p style={hintStyle}>侧栏卡片显示账户余额与今日分时消费；修改立即生效，无需重启或刷新。</p>
        </div>
      </header>

      {snapshot.status === 'unavailable'
        ? <p style={warnStyle}>Host 未提供 deepseek-balance 配置命名空间（插件行可能未启用），暂时无法编辑。</p>
        : null}
      {!ready && snapshot.status !== 'unavailable' ? <p style={hintStyle}>正在加载配置…</p> : null}

      <BooleanRow
        label="显示侧栏卡片"
        hint="关闭后侧栏不渲染该卡片"
        checked={config.enabled}
        disabled={!ready}
        onChange={next => { writeCard(form, 'enabled', next) }}
      />
      <TextRow
        label="卡片标题"
        hint="留空使用默认标题 DeepSeek"
        placeholder="DeepSeek"
        value={config.title}
        disabled={!ready}
        onCommit={next => { writeCard(form, 'title', next) }}
      />
      <NumberRow
        label="自动刷新间隔"
        hint={`${MIN_REFRESH_SECONDS}–${MAX_REFRESH_SECONDS} 秒`}
        value={config.refreshSeconds}
        min={MIN_REFRESH_SECONDS}
        max={MAX_REFRESH_SECONDS}
        step={REFRESH_STEP_SECONDS}
        disabled={!ready}
        onCommit={next => { writeCard(form, 'refreshSeconds', next) }}
      />
      <BooleanRow
        label="显示账户余额"
        hint="总额、充值金额与赠送金额"
        checked={config.showBalance}
        disabled={!ready}
        onChange={next => { writeCard(form, 'showBalance', next) }}
      />
      <BooleanRow
        label="显示今日用量"
        hint="消费金额、分时柱状图、调用次数与 tokens"
        checked={config.showTodayUsage}
        disabled={!ready}
        onChange={next => { writeCard(form, 'showTodayUsage', next) }}
      />

      <CredentialsSection />
    </div>
  )
}

/**
 * The row page asks for a one-line summary and for the page itself; only the
 * page draws the form (the row's own description already serves as summary).
 */
function RowConfigEntry(
  props: { readonly view?: 'summary' | 'page' },
  form: ConfigFormService,
): ReactElement | null {
  if (props.view === 'summary') return null
  return <BalanceSettingsPage form={form} />
}

/**
 * Register the component's configuration page on its row in the Plugins page.
 * @param ctx - browser plugin context.
 * @param form - live config form of the `deepseek-balance` namespace.
 * @returns disposer ending the while-served watch and the registration.
 */
export function installSettingsPage(ctx: ClientContext, form: ConfigFormService): (() => void) | void {
  return ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject('plugins.row.config', () => ctx.slots.register(
    { name: 'plugins.row.config', key: ROW_CONFIG_KEY },
    (props: { readonly view?: 'summary' | 'page' }) => RowConfigEntry(props, form),
  )))
}
