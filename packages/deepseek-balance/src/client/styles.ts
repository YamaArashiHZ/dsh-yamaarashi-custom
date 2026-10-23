/**
 * Card stylesheet, injected once per page.
 *
 * Every selector is scoped under the card container's data attribute, so the
 * rules cannot leak into the rest of the shell. Colours come from DSH theme
 * tokens (with literal fallbacks) and therefore follow both the light and the
 * dark theme; the dark card gets an explicit surface override because the
 * official dashboard look is a deep panel with a subtle border and a soft
 * shadow, not the lighter `bg-layer-1` fill.
 *
 * @module @yamaarashihz/dsh-yamaarashi-deepseek-balance/client/styles
 */

/** `data-*` marker of the sidebar card container (also the test anchor). */
export const CARD_ATTR = 'data-yamaarashi-balance-card'

/** `data-*` marker of the injected stylesheet. */
export const RULES_ATTR = 'data-yamaarashi-balance-rules'

/** Stylesheet text; all selectors live under `[data-yamaarashi-balance-card]`. */
export const BALANCE_CSS = `
/* ---- placement ------------------------------------------------------- */
[${CARD_ATTR}] {
  flex: 0 0 auto;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 2px 0 10px;
}
/* The collapsed sidebar is a 56px rail: the card has no room there. */
[data-sidebar-collapsed] [${CARD_ATTR}] {
  display: none !important;
}

/* ---- card surface ---------------------------------------------------- */
[${CARD_ATTR}] .ybc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 9px;
  box-sizing: border-box;
  width: 100%;
  /* Inner gutter follows the sidebar's own inline padding token, so the card's
     content column stays ~236px in the default 280px sidebar. */
  padding: 10px calc(var(--dsh-sidebar-inline-padding, 12px) - 2px) 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 6px 18px rgba(15, 23, 42, 0.08);
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 11px;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
}
body[data-ds-dark-theme] [${CARD_ATTR}] .ybc-card {
  background: linear-gradient(180deg, rgba(42, 43, 48, 0.95) 0%, rgba(27, 27, 30, 0.98) 100%);
  border-color: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 10px 24px rgba(0, 0, 0, 0.34);
}

/* ---- header ---------------------------------------------------------- */
[${CARD_ATTR}] .ybc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
  min-width: 0;
}
[${CARD_ATTR}] .ybc-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
[${CARD_ATTR}] .ybc-brand-name {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
}
[${CARD_ATTR}] .ybc-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}
[${CARD_ATTR}] .ybc-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
[${CARD_ATTR}] .ybc-status[data-tone='ok'] {
  color: var(--dsw-alias-state-success-primary, #22c55e);
  filter: drop-shadow(0 0 3px rgba(34, 197, 94, 0.45));
}
[${CARD_ATTR}] .ybc-status[data-tone='bad'] {
  color: var(--dsw-alias-state-error-primary, #ef4444);
  filter: drop-shadow(0 0 3px rgba(239, 68, 68, 0.4));
}
[${CARD_ATTR}] .ybc-status[data-tone='unknown'] {
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
[${CARD_ATTR}] .ybc-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  cursor: pointer;
}
[${CARD_ATTR}] .ybc-refresh:hover {
  background: var(--dsw-alias-bg-layer-2, rgba(148, 163, 184, 0.16));
  color: var(--dsw-alias-label-secondary, #64748b);
}
[${CARD_ATTR}] .ybc-refresh:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe);
  outline-offset: 1px;
}
[${CARD_ATTR}] .ybc-refresh:disabled {
  cursor: default;
  opacity: 0.55;
}
[${CARD_ATTR}] .ybc-spin {
  animation: ybc-spin 0.9s linear infinite;
}

/* ---- balance --------------------------------------------------------- */
[${CARD_ATTR}] .ybc-balance {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
[${CARD_ATTR}] .ybc-balance-total {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
[${CARD_ATTR}] .ybc-currency {
  margin-right: 1px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, #64748b);
}
[${CARD_ATTR}] .ybc-balance-sub {
  overflow: hidden;
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}

/* ---- today ----------------------------------------------------------- */
[${CARD_ATTR}] .ybc-today {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
[${CARD_ATTR}] .ybc-today-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
[${CARD_ATTR}] .ybc-today-label {
  overflow: hidden;
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-secondary, #64748b);
}
[${CARD_ATTR}] .ybc-today-right {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
}
[${CARD_ATTR}] .ybc-pill {
  display: inline-flex;
  align-items: center;
  height: 14px;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(148, 163, 184, 0.16));
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2, rgba(148, 163, 184, 0.12));
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
  cursor: default;
  user-select: none;
}
[${CARD_ATTR}] .ybc-today-amount {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, inherit);
}
[${CARD_ATTR}] .ybc-chart-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
[${CARD_ATTR}] .ybc-grid {
  stroke: var(--dsw-alias-border-l2, rgba(148, 163, 184, 0.22));
  stroke-width: 1;
  stroke-dasharray: 2 3;
}
[${CARD_ATTR}] .ybc-baseline {
  stroke: var(--dsw-alias-border-l2, rgba(148, 163, 184, 0.3));
  stroke-width: 1;
}
[${CARD_ATTR}] .ybc-axis {
  fill: var(--dsw-alias-label-tertiary, #94a3b8);
  font-size: 8px;
}
[${CARD_ATTR}] .ybc-bar {
  opacity: 0.96;
}
[${CARD_ATTR}] .ybc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary, #94a3b8);
}
[${CARD_ATTR}] .ybc-foot > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---- hints / errors / skeleton --------------------------------------- */
[${CARD_ATTR}] .ybc-hint {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 8px;
  border: 1px dashed var(--dsw-alias-border-l2, rgba(148, 163, 184, 0.28));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, rgba(148, 163, 184, 0.06));
  font-size: 10px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary, #64748b);
}
[${CARD_ATTR}] .ybc-hint[data-tone='warn'] {
  border-color: rgba(215, 163, 90, 0.35);
  color: var(--dsw-alias-state-warn-label, #d7a35a);
}
[${CARD_ATTR}] .ybc-error {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 8px;
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  font-size: 10px;
  line-height: 1.4;
  color: var(--dsw-alias-state-error-primary, #ef4444);
}
[${CARD_ATTR}] .ybc-error-retry {
  opacity: 0.82;
  font-size: 9px;
}
[${CARD_ATTR}] .ybc-skeleton {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}
[${CARD_ATTR}] .ybc-skel {
  border-radius: 4px;
  background: var(--dsw-alias-bg-skeleton, rgba(148, 163, 184, 0.16));
  animation: ybc-pulse 1.6s ease-in-out infinite;
}
[${CARD_ATTR}] .ybc-skel-line {
  height: 9px;
}
[${CARD_ATTR}] .ybc-skel-block {
  height: 86px;
  border-radius: 8px;
}

@keyframes ybc-spin {
  to { transform: rotate(360deg); }
}
@keyframes ybc-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  [${CARD_ATTR}] .ybc-spin,
  [${CARD_ATTR}] .ybc-skel { animation: none; }
}
`

/**
 * Inject the card stylesheet once.
 * @param doc - target document (defaults to the page document).
 * @returns the existing or newly created `<style>` element.
 */
export function installBalanceRules(doc: Document = document): HTMLStyleElement {
  const existing = doc.querySelector<HTMLStyleElement>(`style[${RULES_ATTR}]`)
  if (existing !== null) return existing
  const style = doc.createElement('style')
  style.setAttribute(RULES_ATTR, '')
  style.textContent = BALANCE_CSS
  doc.head.appendChild(style)
  return style
}

/**
 * Remove every card stylesheet from the document.
 * @param doc - target document (defaults to the page document).
 */
export function removeBalanceRules(doc: Document = document): void {
  for (const node of Array.from(doc.querySelectorAll(`style[${RULES_ATTR}]`))) {
    node.remove()
  }
}
