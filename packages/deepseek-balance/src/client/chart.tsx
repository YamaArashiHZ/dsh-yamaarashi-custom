/**
 * Compact hourly-spend chart, drawn as inline SVG.
 *
 * The card shows the same story as the official DeepSeek usage dashboard: 24
 * hourly bars with a blue→indigo gradient, dashed horizontal grid lines, tiny
 * axis labels, and rounded bar tops. Nothing here imports a chart library, an
 * image or a stylesheet: the geometry is pure, the colours live in the injected
 * card stylesheet (`.ybc-*` classes), and the icon set is inline SVG.
 *
 * All-zero data is a normal state (a fresh day): it renders a flat baseline
 * instead of dividing by a zero max.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/chart
 */

import { useId } from 'react'
import type { ReactElement } from 'react'
import { HOURS_PER_DAY } from '../shared.js'

/** Intrinsic chart size; the card scales it with `width: 100%`. */
const VIEW_WIDTH = 240
const VIEW_HEIGHT = 96
/** Room for the tiny y-axis labels on the left and the hour labels at the bottom. */
const PAD_LEFT = 22
const PAD_RIGHT = 4
const PAD_TOP = 6
const PAD_BOTTOM = 14
const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM
const BASELINE_Y = PAD_TOP + PLOT_HEIGHT
const SLOT_WIDTH = PLOT_WIDTH / HOURS_PER_DAY
const BAR_WIDTH = SLOT_WIDTH * 0.62
const BAR_RADIUS = Math.min(2, BAR_WIDTH / 2)
/** Hours whose labels the official compact chart shows. */
const X_LABEL_HOURS = [0, 8, 15, 23] as const
/** Smallest painted bar height, so a tiny-but-nonzero hour stays visible. */
const MIN_BAR_HEIGHT = 1.2

/** Keep generated path coordinates short. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Normalize an untrusted hourly series to exactly 24 non-negative numbers. */
function normalizeHours(hours: readonly number[]): number[] {
  const values = new Array<number>(HOURS_PER_DAY).fill(0)
  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    const value = hours[hour]
    values[hour] = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
  }
  return values
}

/** Format an axis amount compactly (0 / mid / max of the day). */
function axisLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 0.01) return '<0.01'
  if (value >= 100) return value.toFixed(0)
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

/** Hour label `HH:00`. */
function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** A bar with rounded top corners and a square baseline. */
function barPath(x: number, height: number): string {
  const top = BASELINE_Y - height
  const right = x + BAR_WIDTH
  const radius = Math.min(BAR_RADIUS, BAR_WIDTH / 2, height)
  if (radius <= 0.01) {
    return `M${round(x)} ${round(BASELINE_Y)}V${round(top)}H${round(right)}V${round(BASELINE_Y)}Z`
  }
  return [
    `M${round(x)} ${round(BASELINE_Y)}`,
    `V${round(top + radius)}`,
    `Q${round(x)} ${round(top)} ${round(x + radius)} ${round(top)}`,
    `H${round(right - radius)}`,
    `Q${round(right)} ${round(top)} ${round(right)} ${round(top + radius)}`,
    `V${round(BASELINE_Y)}`,
    'Z',
  ].join(' ')
}

/**
 * Compact hourly-spend chart.
 * @param props.hours - 24 hourly cost values, index 0 = 00:00 (untrusted shape allowed).
 * @returns inline SVG; a flat baseline when every hour is zero.
 */
export function UsageChart({ hours }: { hours: readonly number[] }): ReactElement {
  const rawId = useId()
  // `useId` contains colons, which are legal in HTML ids but awkward inside
  // `url(#…)`; strip them so the gradient reference is always plain.
  const gradientId = `ybc-bar-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const values = normalizeHours(hours)
  const max = Math.max(...values, 0)
  const hasBars = max > 0
  const maxLabel = axisLabel(max)
  const midLabel = axisLabel(max / 2)
  // Drop the mid label when it would repeat the max or the zero label.
  const showMidLabel = hasBars && midLabel !== '0' && midLabel !== maxLabel
  const yOf = (value: number): number => (
    hasBars ? BASELINE_Y - (value / max) * PLOT_HEIGHT : BASELINE_Y
  )

  return (
    <svg
      className="ybc-chart-svg"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={hasBars
        ? `今日分时消费，峰值 ${axisLabel(max)}，共 ${HOURS_PER_DAY} 个小时`
        : '今日分时消费，暂无消费'}
    >
      <title>{hasBars ? '今日分时消费' : '今日暂无消费'}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b9dff" />
          <stop offset="58%" stopColor="#4d7cff" />
          <stop offset="100%" stopColor="#6a5cff" />
        </linearGradient>
      </defs>

      {/* Dashed grid at max and mid, solid baseline at 0. */}
      {hasBars ? (
        <>
          <line className="ybc-grid" x1={PAD_LEFT} y1={round(yOf(max))} x2={PAD_LEFT + PLOT_WIDTH} y2={round(yOf(max))} />
          <line className="ybc-grid" x1={PAD_LEFT} y1={round(yOf(max / 2))} x2={PAD_LEFT + PLOT_WIDTH} y2={round(yOf(max / 2))} />
        </>
      ) : null}
      <line className="ybc-baseline" x1={PAD_LEFT} y1={BASELINE_Y} x2={PAD_LEFT + PLOT_WIDTH} y2={BASELINE_Y} />

      {/* Hourly bars. */}
      {hasBars ? values.map((value, index) => {
        if (value <= 0) return null
        const height = Math.max(MIN_BAR_HEIGHT, (value / max) * PLOT_HEIGHT)
        const x = PAD_LEFT + index * SLOT_WIDTH + (SLOT_WIDTH - BAR_WIDTH) / 2
        return (
          <path
            key={index}
            className="ybc-bar"
            d={barPath(x, height)}
            fill={`url(#${gradientId})`}
          />
        )
      }) : null}

      {/* Y-axis labels: 0 / mid / max (only 0 when the day is empty). The mid
          label is dropped when it would repeat the max or the zero label. */}
      {hasBars ? (
        <>
          <text className="ybc-axis" x={PAD_LEFT - 3} y={round(yOf(max) + 2.6)} textAnchor="end">{maxLabel}</text>
          {showMidLabel ? (
            <text className="ybc-axis" x={PAD_LEFT - 3} y={round(yOf(max / 2) + 2.6)} textAnchor="end">{midLabel}</text>
          ) : null}
        </>
      ) : null}
      <text className="ybc-axis" x={PAD_LEFT - 3} y={BASELINE_Y + 2.6} textAnchor="end">0</text>

      {/* X-axis labels at the four hour marks. */}
      {X_LABEL_HOURS.map((hour) => {
        const isFirst = hour === X_LABEL_HOURS[0]
        const isLast = hour === X_LABEL_HOURS[X_LABEL_HOURS.length - 1]
        const x = isFirst
          ? PAD_LEFT
          : isLast
            ? PAD_LEFT + PLOT_WIDTH
            : PAD_LEFT + (hour + 0.5) * SLOT_WIDTH
        return (
          <text
            key={hour}
            className="ybc-axis ybc-axis-x"
            x={round(x)}
            y={VIEW_HEIGHT - 2}
            textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
          >
            {hourLabel(hour)}
          </text>
        )
      })}
    </svg>
  )
}

/** Shared props of the inline icon set. */
interface IconProps {
  size?: number
  className?: string | undefined
}

/**
 * Refresh glyph; the card adds `.ybc-spin` while a request is in flight.
 * @param props.size - edge length in px.
 * @param props.className - extra class (spin animation).
 */
export function RefreshIcon({ size = 12, className }: IconProps): ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M20.6 4.6v5.6h-5.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Plain dot glyph (availability state).
 * @param props.size - edge length in px.
 * @param props.className - extra class for colour.
 */
export function DotIcon({ size = 7, className }: IconProps): ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="6" />
    </svg>
  )
}
