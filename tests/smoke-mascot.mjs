import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
Object.defineProperty(dom.window, 'innerWidth', { value: 1920, configurable: true })
Object.defineProperty(dom.window, 'innerHeight', { value: 1080, configurable: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const react = await import('react')
const jsxRuntime = await import('react/jsx-runtime')
const { flushSync } = await import('react-dom')
const { createRoot } = await import('react-dom/client')
const { renderToStaticMarkup } = await import('react-dom/server')

const rect = (left, top, width, height) => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
  toJSON() { return this },
})

// 1) Host schema.
const { Config } = await import('../lib/index.js')
const live = value => (value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value)
const defaults = Config({})
if (live(defaults.components.mascot.sizePx) !== 200) throw new Error('mascot.sizePx default')
if (defaults.components.background !== undefined) throw new Error('background section must not exist')
console.log('OK host schema: mascot only')

// 2) Bundle protocol.
const fs = await import('node:fs')
const vm = await import('node:vm')
const code = fs.readFileSync('./lib/client.js', 'utf8')
const registrations = []
globalThis.window.__ModuleLoader__ = { load: registration => registrations.push(registration) }
vm.runInThisContext(code, { filename: 'lib/client.js' })
const bundle = registrations[0]
if (bundle.id !== '@yamaarashihz/dsh-yamaarashi-dafeiyu') throw new Error('bundle id')
const primitives = {
  Button: props => react.createElement('button', { disabled: props.disabled, onClick: props.onClick }, props.children),
  Switch: props => react.createElement('button', { role: 'switch', 'aria-checked': String(props.checked), 'aria-label': props.label }),
  Input: react.forwardRef((props, ref) => react.createElement('input', { ...props, ref })),
}
const exports = bundle.factory(specifier => {
  if (specifier === 'react') return react
  if (specifier === 'react/jsx-runtime') return jsxRuntime
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error(`unexpected require: ${specifier}`)
})
console.log('OK bundle protocol')

// 3) Fake layout: frame > sidebar | centre | rightbar | bottom | overlay.
const frame = document.createElement('div')
const sidebar = document.createElement('div')
sidebar.getBoundingClientRect = () => rect(0, 0, 240, 1080)
const center = document.createElement('div')
let centerRect = rect(240, 0, 1360, 1080)
center.getBoundingClientRect = () => centerRect
const rightbar = document.createElement('div')
rightbar.setAttribute('data-rightbar-col', '')
rightbar.getBoundingClientRect = () => rect(1600, 0, 320, 1080)
const bottom = document.createElement('div')
bottom.setAttribute('data-shell-bottom', '')
bottom.getBoundingClientRect = () => rect(0, 1080, 1920, 0)
const overlay = document.createElement('div')
overlay.setAttribute('data-shell-overlay', '')
frame.append(sidebar, center, rightbar, bottom, overlay)
frame.getBoundingClientRect = () => rect(0, 0, 1920, 1080)
document.body.appendChild(frame)
center.innerHTML = '<div id="conversation-root"></div>'

// 4) Apply.
let configValue = {
  components: { mascot: { enabled: true, sizePx: 320, rightPx: 10, bottomPx: 20, opacity: 0.8, imagePath: '' } },
}
const listeners = new Set()
const form = {
  getSnapshot: () => ({ status: 'ready', value: configValue }),
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  mutate: async () => true,
}
const notify = () => { for (const listener of listeners) listener() }
const contributions = []
const ctx = {
  configForms: {
    get: () => form,
    whileServed: (namespaces, register) => { contributions.push({ watched: namespaces }); return register() },
  },
  slots: {
    inject: (name, setup) => { setup(); return () => {} },
    register: (options, component) => { contributions.push({ options, component }); return () => {} },
  },
}
exports.apply(ctx)
const mascot = contributions.find(entry => entry.options?.id === 'yamaarashi-custom-mascot')
const page = contributions.find(entry => entry.options?.name === 'plugins.row.config')
if (mascot === undefined || page === undefined) throw new Error('registrations missing')
if (page.options.key !== '@yamaarashihz/dsh-yamaarashi-custom#dafeiyu') throw new Error(`page key ${page.options.key}`)
const watched = contributions.find(entry => Array.isArray(entry.watched))
if (watched === undefined || !watched.watched.includes('dafeiyu')) throw new Error(`whileServed namespace ${JSON.stringify(watched?.watched)}`)
console.log('OK registrations')

// 5) Render: anchored to the main column, layer on <body>.
const host = document.createElement('div')
document.body.appendChild(host)
const root = createRoot(host)
flushSync(() => root.render(react.createElement(mascot.component)))
const tick = () => new Promise(resolve => setTimeout(resolve, 80))
await tick()

let image = document.querySelector('img[data-dsh-corner-mascot]')
let rules = document.querySelector('style[data-dsh-corner-mascot-rules]')
if (image === null || rules === null) throw new Error('background layer missing')
if (center.getAttribute('data-yamaarashi-center') === null) throw new Error('centre column not marked')
if (host.querySelector('img') !== null) throw new Error('mascot must not render inside the slot')
if (image.style.position !== 'fixed' || image.style.zIndex !== '-1') throw new Error('layer position/z-index')
if (image.style.pointerEvents !== 'none') throw new Error('layer click-through')
if (image.style.right !== '330px') throw new Error(`right ${image.style.right}`)     // (1920-1600)+10
if (image.style.bottom !== '20px') throw new Error(`bottom ${image.style.bottom}`)   // (1080-1080)+20
if (image.style.width !== '320px') throw new Error(`width ${image.style.width}`)
if (image.style.opacity !== '0.8') throw new Error(`opacity ${image.style.opacity}`)
for (const rule of [
  '*:has(> [data-shell-overlay])',
  '[data-yamaarashi-center] > *, [data-yamaarashi-center] > * > *',
  '[data-phase]:has([data-conversation-content])',
  '[data-shell-bottom]',
  '[data-composer-seat]',
]) {
  if (!rules.textContent.includes(rule)) throw new Error(`missing rule ${rule}`)
}
console.log('OK background layer: main-column anchor, z-index, all-page transparency rules')

// 6) Main view switch (conversation -> plugins page) keeps the wallpaper.
center.innerHTML = '<div id="plugin-manager-page"></div>'
dom.window.dispatchEvent(new dom.window.Event('resize'))
await tick()
if (document.querySelector('img[data-dsh-corner-mascot]') === null) throw new Error('wallpaper lost after view switch')
console.log('OK wallpaper persists across main views (plugins page)')

// 7) Right sidebar opens: column narrows, offsets follow.
centerRect = rect(240, 0, 1060, 1080)
rightbar.getBoundingClientRect = () => rect(1300, 0, 320, 1080)
dom.window.dispatchEvent(new dom.window.Event('resize'))
await tick()
image = document.querySelector('img[data-dsh-corner-mascot]')
if (image.style.right !== '630px') throw new Error(`narrowed right ${image.style.right}`) // (1920-1300)+10
console.log('OK geometry follows sidebar resize')

// 8) Column fully collapsed: layer goes away; restoring brings it back.
centerRect = rect(240, 0, 0, 1080)
dom.window.dispatchEvent(new dom.window.Event('resize'))
await tick()
if (document.querySelector('img[data-dsh-corner-mascot]') !== null) throw new Error('layer should hide on empty column')
centerRect = rect(240, 0, 1360, 1080)
rightbar.getBoundingClientRect = () => rect(1600, 0, 320, 1080)
dom.window.dispatchEvent(new dom.window.Event('resize'))
await tick()
if (document.querySelector('img[data-dsh-corner-mascot]') === null) throw new Error('layer should return')
console.log('OK collapsed column hides, restored column shows')

// 9) Live config: margins/opacity/size.
configValue = { components: { mascot: { enabled: true, sizePx: 200, rightPx: 0, bottomPx: 0, opacity: 0.5, imagePath: '' } } }
notify()
await tick()
image = document.querySelector('img[data-dsh-corner-mascot]')
if (image.style.right !== '320px' || image.style.bottom !== '0px') throw new Error('margins not updated')
if (image.style.width !== '200px' || image.style.opacity !== '0.5') throw new Error('size/opacity not updated')
console.log('OK size / margins / opacity update live')

// 10) enabled=false removes layer + rules; unmount removes the marker.
configValue = { components: { mascot: { enabled: false, sizePx: 200, rightPx: 0, bottomPx: 0, opacity: 0.5, imagePath: '' } } }
notify()
await tick()
if (document.querySelector('img[data-dsh-corner-mascot]') !== null) throw new Error('disabled layer present')
if (document.querySelector('style[data-dsh-corner-mascot-rules]') !== null) throw new Error('disabled rules present')
configValue = { components: { mascot: { enabled: true, sizePx: 200, rightPx: 0, bottomPx: 0, opacity: 0.5, imagePath: '' } } }
notify()
await tick()
if (document.querySelector('img[data-dsh-corner-mascot]') === null) throw new Error('re-enable failed')
root.unmount()
if (document.querySelector('style[data-dsh-corner-mascot-rules]') !== null) throw new Error('unmount left rules')
console.log('OK enable/disable + unmount cleanup')

// 11) Settings page: one section, sliders, updated hints.
const summaryHtml = renderToStaticMarkup(react.createElement(page.component, { view: 'summary' }))
if (summaryHtml !== '') throw new Error('row summary must render nothing')
const pageHtml = renderToStaticMarkup(react.createElement(page.component, { view: 'page' }))
for (const needle of [
  '立绘（背景层）', '启用立绘', '大小', '右边距', '底边距', '不透明度', '自定义图片路径', '恢复默认',
  '所有主页面生效', 'type="range"', 'aria-label="大小滑条"',
]) {
  if (!pageHtml.includes(needle)) throw new Error(`settings page missing "${needle}"`)
}
console.log('OK settings page: single section with sliders + updated hints')
// 12) Two-package layout: shell bundle + component package.
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const bundleJson = JSON.parse(fs.readFileSync('bundle/package.json', 'utf8'))
if (packageJson.name !== '@yamaarashihz/dsh-yamaarashi-dafeiyu') throw new Error(`component name ${packageJson.name}`)
if (packageJson.dsh?.bundle !== undefined) throw new Error('component must not declare dsh.bundle')
if (packageJson.dsh?.client?.platform !== 'web') throw new Error('component dsh.client missing')
if (packageJson.icon !== 'assets/mascot-512.webp' || !fs.existsSync(packageJson.icon)) throw new Error('component icon missing')
if (packageJson.version !== '0.3.1') throw new Error(`component version ${packageJson.version}`)
const componentZh = JSON.parse(fs.readFileSync('locale/zh.json', 'utf8'))
if (componentZh.meta?.title !== '大肥鱼探头') throw new Error(`component zh title ${componentZh.meta?.title}`)
if (bundleJson.name !== '@yamaarashihz/dsh-yamaarashi-custom') throw new Error('shell name')
if (bundleJson.version !== '0.9.1') throw new Error(`shell version ${bundleJson.version}`)
if (bundleJson.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('shell patch missing')
if (!bundleJson.files.includes('locale/*.json') || !bundleJson.files.includes('assets/mascot-512.webp')) throw new Error('shell files')
const shellZh = JSON.parse(fs.readFileSync('bundle/locale/zh.json', 'utf8'))
if (shellZh.meta?.title !== 'DSH 个性化定制') throw new Error(`shell zh title ${shellZh.meta?.title}`)
const patch = fs.readFileSync('bundle/cordis.patch.yml', 'utf8')
if (!patch.includes("id: dafeiyu")) throw new Error('shell patch row id')
if (!patch.includes("name: '@yamaarashihz/dsh-yamaarashi-dafeiyu'")) throw new Error('shell patch row name')
if (!patch.includes('id: deepseek-balance')) throw new Error('shell patch missing second row id')
if (!patch.includes("name: '@yamaarashihz/dsh-yamaarashi-deepseek-balance'")) throw new Error('shell patch missing second row name')
const balanceJson = JSON.parse(fs.readFileSync('packages/deepseek-balance/package.json', 'utf8'))
if (balanceJson.name !== '@yamaarashihz/dsh-yamaarashi-deepseek-balance') throw new Error('second component name')
if (balanceJson.version !== '0.2.1') throw new Error('second component version')
if (balanceJson.dsh?.bundle !== undefined) throw new Error('second component must not declare dsh.bundle')
if (balanceJson.dsh?.client?.platform !== 'web') throw new Error('second component dsh.client missing')
console.log('OK package layout: shell bundle + two component packages')

console.log('OK all 0.9.1 checks passed')
