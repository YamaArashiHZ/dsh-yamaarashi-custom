/**
 * Bundle settings page — the bundle's own configuration surface.
 *
 * DSH 0.2.1 does not auto-generate plugin configuration pages, so the bundle
 * contributes one through the keyed `plugins.bundle.config` slot (keyed by the
 * package name) and registers it only while the Host serves the settings
 * namespace. Every edit is written through path-addressed `mutate()` calls, so
 * the mascot layer subscribed to the same namespace updates live.
 *
 * The page deliberately renders its own rows (the primitives' staged form model
 * addresses top-level fields only; this bundle's configuration is nested under
 * `components.mascot`). Numeric rows pair a native range input with the
 * primitives' number input; DSH 0.2.1 ships no slider atom.
 *
 * @module @yamaarashihz/dsh-yamaarashi-custom/client/components/settings
 */

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { ENTRY_ID, MASCOT_DEFAULTS, ROW_CONFIG_KEY, readMascot, type MascotConfig } from '../config.js'
import type { ClientContext, ConfigFormService } from '../contract.js'

const pageStyle = { display: 'grid', gap: '14px' } as const
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
} as const
const titleStyle = { margin: 0, fontSize: '14px', fontWeight: 600 } as const
const hintStyle = { margin: '2px 0 0', fontSize: '12px', opacity: 0.7 } as const
const warnStyle = { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-state-warn-label, #d7a35a)' } as const
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
/**
 * The primitives' `Input` wrapper shrinks to its native input, so the width
 * lives on the input itself (the wrapper's border/padding then hug it).
 */
const numberInputStyle = { width: '88px', textAlign: 'right' } as const
const textInputStyle = { width: '240px' } as const
/** Native range track, tinted with the theme's business color. */
const rangeStyle: CSSProperties = {
  width: '150px',
  accentColor: 'var(--dsw-alias-state-business-primary, #4d6bfe)',
}

/** Write one mascot field through the settings document. */
function writeMascot(form: ConfigFormService, field: keyof MascotConfig, value: unknown): void {
  void form.mutate([{ op: 'set', path: ['components', 'mascot', field], value }])
}

/** Write every mascot field back to the schema defaults in one atomic edit. */
function resetMascot(form: ConfigFormService): void {
  const ops = (Object.keys(MASCOT_DEFAULTS) as (keyof MascotConfig)[]).map(field => ({
    op: 'set' as const,
    path: ['components', 'mascot', field],
    value: MASCOT_DEFAULTS[field] as unknown,
  }))
  void form.mutate(ops)
}

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

/**
 * The bundle's configuration page.
 * @param props.form - live config form of the `dafeiyu` namespace.
 * @returns the mascot settings section shown on the plugin's page.
 */
export function MascotSettingsPage({ form }: { form: ConfigFormService }): ReactElement {
  const [snapshot, setSnapshot] = useState(() => form.getSnapshot())
  useEffect(() => form.subscribe(() => setSnapshot(form.getSnapshot())), [form])

  const ready = snapshot.status === 'ready'
  const config = readMascot(ready ? snapshot.value : undefined)

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={fieldColumnStyle}>
          <h3 style={titleStyle}>立绘（背景层）</h3>
          <p style={hintStyle}>所有主页面生效；修改立即生效，无需重启或刷新。</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!ready}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          onClick={() => { resetMascot(form) }}
        >
          恢复默认
        </Button>
      </header>

      {snapshot.status === 'unavailable'
        ? <p style={warnStyle}>{`Host 未提供 ${ENTRY_ID} 配置命名空间（插件行可能未启用），暂时无法编辑。`}</p>
        : null}
      {!ready && snapshot.status !== 'unavailable' ? <p style={hintStyle}>正在加载配置…</p> : null}

      <BooleanRow
        label="启用立绘"
        hint="关闭后不渲染"
        checked={config.enabled}
        disabled={!ready}
        onChange={next => { writeMascot(form, 'enabled', next) }}
      />
      <NumberRow
        label="大小"
        hint="64–512 px"
        value={config.sizePx}
        min={64}
        max={512}
        step={1}
        disabled={!ready}
        onCommit={next => { writeMascot(form, 'sizePx', next) }}
      />
      <NumberRow
        label="右边距"
        hint="相对主内容区右边缘"
        value={config.rightPx}
        min={0}
        max={400}
        step={1}
        disabled={!ready}
        onCommit={next => { writeMascot(form, 'rightPx', next) }}
      />
      <NumberRow
        label="底边距"
        hint="相对主内容区下边缘"
        value={config.bottomPx}
        min={0}
        max={400}
        step={1}
        disabled={!ready}
        onCommit={next => { writeMascot(form, 'bottomPx', next) }}
      />
      <NumberRow
        label="不透明度"
        hint="0.2–1"
        value={config.opacity}
        min={0.2}
        max={1}
        step={0.05}
        disabled={!ready}
        onCommit={next => { writeMascot(form, 'opacity', next) }}
      />
      <TextRow
        label="自定义图片路径"
        hint="本地绝对路径；留空使用内置图"
        placeholder="例如 D:\\pictures\\mascot.png"
        value={config.imagePath}
        disabled={!ready}
        onCommit={next => { writeMascot(form, 'imagePath', next) }}
      />
    </div>
  )
}

/**
 * The row page asks for a one-line summary and for the page itself; only the
 * page draws the form (the row's own description already serves as summary).
 */
function RowConfigEntry(props: { readonly view?: 'summary' | 'page' }, form: ConfigFormService): ReactElement | null {
  if (props.view === 'summary') return null
  return <MascotSettingsPage form={form} />
}

/**
 * Register the component's configuration page on its row in the Plugins page.
 * The key is `<bundle package name>#<row id>`, owned by the customization
 * suite shell — this component package only ships the page.
 * @param ctx - browser plugin context.
 * @param form - live config form of the `dafeiyu` namespace.
 * @returns disposer ending the while-served watch and the registration.
 */
export function installSettingsPage(ctx: ClientContext, form: ConfigFormService): (() => void) | void {
  return ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject('plugins.row.config', () => ctx.slots.register(
    { name: 'plugins.row.config', key: ROW_CONFIG_KEY },
    (props: { readonly view?: 'summary' | 'page' }) => RowConfigEntry(props, form),
  )))
}
