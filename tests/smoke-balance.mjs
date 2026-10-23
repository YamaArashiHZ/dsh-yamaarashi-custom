/**
 * jsdom regression for the DeepSeek usage card component.
 *
 * Covers: host schema defaults, client bundle protocol + allowed externals,
 * slot registrations (`shell.overlay` id, `plugins.row.config` key), sidebar DOM
 * insertion (after the global panel nav / before the workspace region), the
 * card's rendered content + hourly chart, the collapsed-sidebar rule, cleanup on
 * disable, and the row configuration page (summary empty / page populated).
 *
 * Run: node tests/smoke-balance.mjs   (after building packages/deepseek-balance)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://127.0.0.1:3080/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.IS_REACT_ACT_ENVIRONMENT = false
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })

const react = await import('react')
const jsxRuntime = await import('react/jsx-runtime')
const reactDom = await import('react-dom')
const { createRoot } = await import('react-dom/client')
const { flushSync } = await import('react-dom')

// ---- 1) Host schema defaults + routes ----
const host = await import('../packages/deepseek-balance/lib/index.js')
const live = value => (value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value)
const defaults = host.Config({}).components.balanceCard
assert.equal(live(defaults.enabled), true)
assert.equal(live(defaults.title), 'DeepSeek')
assert.equal(live(defaults.refreshSeconds), 60)
assert.equal(live(defaults.showBalance), true)
assert.equal(live(defaults.showTodayUsage), true)
assert.deepEqual(host.inject, ['webServer', 'credentials'])
console.log('OK host schema + inject')

const routes = []
host.apply({
  fiber: {},
  effect(setup) { setup() },
  inject(_names, callback) { callback({ effect(setup) { setup() }, settings: { configure() { return () => {} } } }) },
  webServer: { register(route) { routes.push(route); return () => {} } },
  credentials: {
    async resolve() { return undefined },
    async describe() { return { configured: false, writable: true } },
    async set() {},
    async unset() {},
  },
})
assert.equal(routes.length, 3)
assert.ok(routes.some(route => route.path === '/yamaarashi-deepseek-balance/data'))
console.log('OK host routes')

// ---- 2) Bundle protocol ----
const source = readFileSync(new URL('../packages/deepseek-balance/lib/client.js', import.meta.url), 'utf8')
const registrations = []
globalThis.window.__ModuleLoader__ = { load: registration => registrations.push(registration) }
vm.runInThisContext(source, { filename: 'packages/deepseek-balance/lib/client.js' })
const bundle = registrations[0]
assert.equal(bundle.id, '@yamaarashihz/dsh-yamaarashi-deepseek-balance')

const primitives = {
  Button: (props) => react.createElement('button', { type: 'button', disabled: props.disabled, onClick: props.onClick }, props.children),
  Switch: (props) => react.createElement('button', {
    type: 'button', role: 'switch', 'aria-checked': String(props.checked), 'aria-label': props.label, onClick: () => props.onChange(!props.checked),
  }),
  Input: react.forwardRef((props, ref) => react.createElement('input', { ...props, ref })),
}
const required = new Set()
const exports = bundle.factory((specifier) => {
  required.add(specifier)
  if (specifier === 'react') return react
  if (specifier === 'react/jsx-runtime') return jsxRuntime
  if (specifier === 'react-dom') return reactDom
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error(`unexpected require: ${specifier}`)
})
assert.deepEqual([...required].sort(), [
  '@deepseek-ai/dsh-client-ui-primitives', 'react', 'react-dom', 'react/jsx-runtime',
].sort())
assert.equal(typeof exports.apply, 'function')
console.log('OK bundle protocol + allowed externals')

// ---- 3) Fake layout DOM ----
const frame = document.createElement('div')
const sidebarCol = document.createElement('div')
const sidebarRoot = document.createElement('div')
const logoRow = document.createElement('div')
const newSession = document.createElement('button')
const nav = document.createElement('nav')
const regionArea = document.createElement('div')
const footArea = document.createElement('div')
const panel = document.createElement('button')
panel.textContent = '自动化任务'
nav.appendChild(panel)
sidebarRoot.append(logoRow, newSession, nav, regionArea, footArea)
// The real shell wraps the sidebar occupant in a display:contents slot anchor.
const sidebarSlot = document.createElement('div')
sidebarSlot.setAttribute('data-slot', 'sidebar')
sidebarSlot.setAttribute('style', 'display: contents')
sidebarSlot.appendChild(sidebarRoot)
sidebarCol.appendChild(sidebarSlot)
const centre = document.createElement('div')
const rightbar = document.createElement('div')
rightbar.setAttribute('data-rightbar-col', '')
const bottom = document.createElement('div')
bottom.setAttribute('data-shell-bottom', '')
const overlay = document.createElement('div')
overlay.setAttribute('data-shell-overlay', '')
frame.append(sidebarCol, centre, rightbar, bottom, overlay)
frame.setAttribute('data-sidebar-collapsed', '')
document.body.appendChild(frame)

// ---- 4) Fake services ----
let configValue = {
  components: {
    balanceCard: { enabled: true, title: 'DeepSeek', refreshSeconds: 60, showBalance: true, showTodayUsage: true },
  },
}
const listeners = new Set()
const form = {
  getSnapshot: () => ({ status: 'ready', value: configValue }),
  subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
  mutate: async () => true,
}
const slotRegistrations = []
const ctx = {
  slots: {
    inject(name, setup) { const dispose = setup(); return dispose },
    register(options, component) {
      const entry = { name: options.name, options, component }
      slotRegistrations.push(entry)
      return () => { const index = slotRegistrations.indexOf(entry); if (index >= 0) slotRegistrations.splice(index, 1) }
    },
  },
  configForms: {
    get: () => form,
    whileServed(_namespaces, register) { return register() },
  },
}
exports.apply(ctx)

const overlayReg = slotRegistrations.find(entry => entry.options.name === 'shell.overlay')
const configReg = slotRegistrations.find(entry => entry.options.name === 'plugins.row.config')
assert.ok(overlayReg, 'shell.overlay registration')
assert.equal(overlayReg.options.id, 'deepseek-balance-card')
assert.ok(configReg, 'plugins.row.config registration')
assert.equal(configReg.options.key, '@yamaarashihz/dsh-yamaarashi-custom#deepseek-balance')
console.log('OK slot registrations')

// ---- 5) Stubbed same-origin data ----
const dataBody = {
  ok: true,
  configured: { apiKey: true, userToken: true },
  balance: {
    available: true,
    currency: 'CNY',
    info: { currency: 'CNY', total: 12.34, granted: 2.34, toppedUp: 10 },
    infos: [{ currency: 'CNY', total: 12.34, granted: 2.34, toppedUp: 10 }],
    fetchedAt: Date.now(),
  },
  usage: {
    currency: 'CNY',
    cost: 0.51,
    tokens: 6060,
    requests: 8,
    hourlyCost: Array.from({ length: 24 }, (_, hour) => (hour === 0 ? 0.11 : hour === 9 ? 0.4 : 0)),
    hourlyTokens: Array.from({ length: 24 }, (_, hour) => (hour === 0 ? 6000 : hour === 9 ? 60 : 0)),
    hourlyRequests: Array.from({ length: 24 }, (_, hour) => (hour === 0 ? 5 : hour === 9 ? 3 : 0)),
    apiKeys: ['default-key'],
    fetchedAt: Date.now(),
  },
  errors: {},
  fetchedAt: Date.now(),
}
let fetchCount = 0
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => {
  const text = String(url)
  if (text.includes('/yamaarashi-deepseek-balance/data')) {
    fetchCount += 1
    return new Response(JSON.stringify(dataBody), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (text.includes('/yamaarashi-deepseek-balance/status')) {
    return new Response(JSON.stringify({
      ok: true, apiKey: { configured: true }, userToken: { configured: false },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  throw new Error(`unexpected fetch ${text}`)
}

// ---- 6) Render seat, verify sidebar insertion + card content ----
const seatHost = document.createElement('div')
document.body.appendChild(seatHost)
const seatRoot = createRoot(seatHost)
flushSync(() => { seatRoot.render(react.createElement(overlayReg.component)) })
await new Promise(resolve => setTimeout(resolve, 120))

const card = sidebarRoot.querySelector('[data-yamaarashi-balance-card]')
assert.ok(card, 'card container inserted into the sidebar')
assert.equal(card.previousElementSibling, nav, 'card sits after the global panel nav')
assert.equal(card.nextElementSibling, regionArea, 'card sits before the workspace region')
assert.equal(sidebarRoot.children.length, 6, 'one injected card node')
const style = document.head.querySelector('[data-yamaarashi-balance-rules]')
assert.ok(style, 'stylesheet injected')
assert.match(style.textContent, /\[data-sidebar-collapsed\][\s\S]*display: none/)
const text = card.textContent
for (const expected of ['DeepSeek', '12.34', '0.51', 'API Key', '8 次调用', '6.1K tokens', '00:00', '08:00', '15:00', '23:00']) {
  assert.ok(text.includes(expected), `card text missing ${expected}`)
}
assert.equal(card.querySelector('.ybc-brand-mark'), null, 'card header has no brand icon')
const bars = card.querySelectorAll('path.ybc-bar')
assert.equal(bars.length, 2, 'two non-zero hourly bars')
assert.match(card.innerHTML, /url\(#ybc-bar-[A-Za-z0-9_-]+\)/)
assert.ok(fetchCount >= 1, 'data fetched')
console.log('OK card DOM insertion + render + chart')

// ---- 7) Disable removes the card and stylesheet ----
configValue = { components: { balanceCard: { enabled: false, title: 'DeepSeek', refreshSeconds: 60, showBalance: true, showTodayUsage: true } } }
for (const listener of listeners) listener()
await new Promise(resolve => setTimeout(resolve, 80))
assert.equal(sidebarRoot.querySelector('[data-yamaarashi-balance-card]'), null, 'card removed when disabled')
assert.equal(document.head.querySelector('[data-yamaarashi-balance-rules]'), null, 'stylesheet removed when disabled')
console.log('OK disable cleanup')

// Re-enable for further checks.
configValue = { components: { balanceCard: { enabled: true, title: 'DeepSeek', refreshSeconds: 60, showBalance: true, showTodayUsage: true } } }
for (const listener of listeners) listener()
await new Promise(resolve => setTimeout(resolve, 120))
assert.ok(sidebarRoot.querySelector('[data-yamaarashi-balance-card]'), 'card returns when re-enabled')

// ---- 8) Settings page: summary is empty, page renders both sections ----
const settingsHost = document.createElement('div')
document.body.appendChild(settingsHost)
const settingsRoot = createRoot(settingsHost)
const SettingsPage = configReg.component

flushSync(() => { settingsRoot.render(react.createElement(SettingsPage, { view: 'summary' })) })
await new Promise(resolve => setTimeout(resolve, 50))
assert.equal(settingsHost.textContent.trim(), '', 'summary view renders nothing')

flushSync(() => { settingsRoot.render(react.createElement(SettingsPage, { view: 'page' })) })
await new Promise(resolve => setTimeout(resolve, 150))
const settingsText = settingsHost.textContent
for (const expected of ['卡片', 'API Key', 'userToken', 'platform.deepseek.com', '凭据']) {
  assert.ok(settingsText.includes(expected), `settings page missing ${expected}`)
}
assert.ok(settingsText.includes('已配置'), 'credential status from host route')
assert.ok(settingsHost.querySelectorAll('input[type="password"]').length >= 2, 'two secret inputs')
console.log('OK row config page (summary empty, page rendered, credential status)')

// ---- 8b) Misplaced node is re-seated by the observer ----
const cardNode = sidebarRoot.querySelector('[data-yamaarashi-balance-card]')
assert.ok(cardNode)
sidebarRoot.appendChild(cardNode) // simulate React inserting a node that pushes us to the end
await new Promise(resolve => setTimeout(resolve, 80))
assert.equal(cardNode.previousElementSibling, nav, 'observer re-seats a misplaced card after the nav')
assert.equal(cardNode.nextElementSibling, regionArea)

// ---- 9) Cleanup ----
flushSync(() => { seatRoot.unmount() })
flushSync(() => { settingsRoot.unmount() })
await new Promise(resolve => setTimeout(resolve, 30))
assert.equal(sidebarRoot.querySelector('[data-yamaarashi-balance-card]'), null, 'seat cleanup')
assert.equal(document.head.querySelector('[data-yamaarashi-balance-rules]'), null, 'style cleanup')
globalThis.fetch = realFetch
delete globalThis.window.__ModuleLoader__

console.log('\nsmoke-balance PASS')
