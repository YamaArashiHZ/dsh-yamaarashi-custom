/** Shell bundle metadata check: two rows, bumped version, locale titles, icons. */
import { readFileSync, existsSync, statSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const patch = read('bundle/cordis.patch.yml')
for (const [id, name] of [
  ['dafeiyu', '@yamaarashihz/dsh-yamaarashi-dafeiyu'],
  ['deepseek-balance', '@yamaarashihz/dsh-yamaarashi-deepseek-balance'],
]) {
  if (!patch.includes(`id: ${id}`) || !patch.includes(`name: '${name}'`)) {
    throw new Error(`shell patch missing row ${id} -> ${name}`)
  }
}
const bundle = JSON.parse(read('bundle/package.json'))
if (bundle.version !== '0.9.2') throw new Error('shell version should be 0.9.2')
if (bundle.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('shell has no bundle patch')

const component = JSON.parse(read('packages/deepseek-balance/package.json'))
if (component.version !== '0.3.0') throw new Error('component version should be 0.3.0')
if (component.dsh?.bundle !== undefined) throw new Error('component must not declare dsh.bundle')
if (component.dsh?.client?.platform !== 'web') throw new Error('component must declare dsh.client.platform=web')
for (const key of ['./client', './package.json', './locale/*.json']) {
  if (component.exports?.[key] === undefined) throw new Error(`component exports missing ${key}`)
}
for (const file of ['assets/deepseek-balance.svg', 'locale/zh.json', 'locale/en.json']) {
  const path = `packages/deepseek-balance/${file}`
  if (!existsSync(path)) throw new Error(`missing ${path}`)
  if (file.endsWith('.svg') && statSync(path).size > 256 * 1024) throw new Error('icon over 256 KiB')
}
const zh = JSON.parse(read('packages/deepseek-balance/locale/zh.json'))
const en = JSON.parse(read('packages/deepseek-balance/locale/en.json'))
if (zh.meta.title !== 'DeepSeek 用量卡片') throw new Error('zh title')
if (typeof en.meta.title !== 'string' || en.meta.title.length === 0) throw new Error('en title')

// Existing component metadata must not regress.
const dafeiyu = JSON.parse(read('package.json'))
if (dafeiyu.name !== '@yamaarashihz/dsh-yamaarashi-dafeiyu') throw new Error('root package name')
const bundleZh = JSON.parse(read('bundle/locale/zh.json'))
if (bundleZh.meta.title !== 'DSH 个性化定制') throw new Error('bundle zh title')

console.log('shell-check PASS')
