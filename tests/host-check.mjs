/**
 * Host-half integration check for the DeepSeek usage card.
 *
 * Boots the compiled host module against a real local HTTP server, a fake
 * credential service, and a stubbed upstream fetch. Covers: route registration,
 * loopback/same-origin guard, official balance normalization, platform hourly
 * usage normalization, partial-source errors, credential validation (only
 * valid secrets are stored), and the short cache.
 *
 * Run: node tests/host-check.mjs   (after `npx tsc -p packages/deepseek-balance`)
 */
import http from 'node:http'
import assert from 'node:assert/strict'

const pkg = await import('../packages/deepseek-balance/lib/index.js')

// ---- schema defaults ----
const live = value => (value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value)
const defaults = pkg.Config({})
const card = live(defaults.components.balanceCard)
assert.equal(live(card.enabled), true, 'enabled default')
assert.equal(live(card.title), 'DeepSeek', 'title default')
assert.equal(live(card.refreshSeconds), 60, 'refresh default')
assert.equal(live(card.showBalance), true)
assert.equal(live(card.showTodayUsage), true)
console.log('OK host schema defaults')

// ---- fake credential service ----
const store = new Map([
  ['YAMAARASHI_DEEPSEEK_API_KEY', 'sk-test-key'],
  ['YAMAARASHI_DEEPSEEK_USER_TOKEN', 'test-user-token'],
])
const credentials = {
  async resolve(ref) {
    return store.has(ref) ? { value: store.get(ref), source: 'file' } : undefined
  },
  async describe(ref) {
    return { configured: store.has(ref), writable: true }
  },
  async set(ref, value) { store.set(ref, value) },
  async unset(ref) { store.delete(ref) },
}

// ---- upstream stub ----
const now = new Date()
const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
const atHour = hour => Math.floor(midnight) + hour * 3600
// The host sends the browser-local UTC offset; CI runs in UTC, so never hardcode UTC+8.
const tzOffset = -new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTimezoneOffset() * 60
const json = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
})
const calls = { balance: 0, amount: 0, cost: 0, summary: 0 }
let upstreamMode = 'ok'
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const text = String(url)
  if (text.startsWith('http://127.0.0.1:') && text.includes('/yamaarashi-deepseek-balance/')) {
    return realFetch(url, init)
  }
  if (text.startsWith('https://api.deepseek.com/user/balance')) {
    calls.balance += 1
    if (upstreamMode === 'bad-key') return new Response('{}', { status: 401 })
    return json({
      is_available: true,
      balance_infos: [{
        currency: 'CNY', total_balance: '12.34', granted_balance: '2.34', topped_up_balance: '10.00',
      }],
    })
  }
  if (text.startsWith('https://platform.deepseek.com/api/v0/usage/by_api_key/amount')) {
    calls.amount += 1
    if (upstreamMode === 'bad-token') return json({ code: '40002', data: { biz_code: 40002, biz_msg: 'expired' } })
    assert.match(text, /bucket=3600/)
    assert.match(text, new RegExp(`[?&]tz=${tzOffset}(?:&|$)`))
    return json({
      code: 0,
      data: {
        biz_code: 0,
        biz_data: {
          series: [
            {
              api_key: { name: 'default-key' },
              model: 'deepseek-chat',
              buckets: [
                { time: atHour(0), usage: { PROMPT_CACHE_HIT_TOKEN: 1000, PROMPT_CACHE_MISS_TOKEN: 2000, RESPONSE_TOKEN: 3000, REQUEST: 2 } },
                { time: atHour(9), usage: { PROMPT_CACHE_HIT_TOKEN: 10, PROMPT_CACHE_MISS_TOKEN: 20, RESPONSE_TOKEN: 30, REQUEST: 1 } },
              ],
            },
          ],
        },
      },
    })
  }
  if (text.startsWith('https://platform.deepseek.com/api/v0/usage/by_api_key/cost')) {
    calls.cost += 1
    if (upstreamMode === 'bad-token') return json({ code: '40002', data: { biz_code: 40002, biz_msg: 'expired' } })
    return json({
      code: 0,
      data: {
        biz_code: 0,
        biz_data: {
          data: [
            {
              currency: 'CNY',
              series: [
                {
                  api_key: { name: 'default-key' },
                  model: 'deepseek-chat',
                  buckets: [
                    { time: atHour(0), cost: '0.11' },
                    { time: atHour(9), cost: '0.40' },
                  ],
                },
              ],
            },
          ],
        },
      },
    })
  }
  if (text.startsWith('https://platform.deepseek.com/api/v0/users/get_user_summary')) {
    calls.summary += 1
    if (upstreamMode === 'bad-token') {
      return json({ code: '40002', data: { biz_code: 40002, biz_msg: 'expired' } })
    }
    return json({ code: 0, data: { biz_code: 0, biz_data: { balance: '1.00' } } })
  }
  throw new Error(`unexpected upstream fetch: ${text}`)
}

// ---- fake host ctx + real HTTP server ----
const routes = []
const ctx = {
  fiber: {},
  effect(setup) { const dispose = setup(); this._dispose = dispose },
  inject(names, callback) {
    assert.deepEqual(names, ['settings'])
    callback({
      effect(setup) { this._dispose = setup() },
      settings: { configure() { return () => {} } },
    })
  },
  webServer: {
    register(route) {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  },
  credentials,
}

pkg.apply(ctx)
assert.equal(routes.length, 3, 'three routes registered')
assert.deepEqual(
  routes.map(route => route.path).sort(),
  [
    '/yamaarashi-deepseek-balance/credentials',
    '/yamaarashi-deepseek-balance/data',
    '/yamaarashi-deepseek-balance/status',
  ].sort(),
  'route paths',
)
console.log('OK route registration')

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname
  const route = routes.find(candidate => candidate.path === path)
  if (route === undefined) { res.writeHead(404).end(); return }
  try {
    await route.handler(req, res)
  } catch (error) {
    res.writeHead(500).end(String(error))
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const base = `http://127.0.0.1:${port}`
const headers = { origin: base }

try {
  // status
  const status = await (await fetch(`${base}/yamaarashi-deepseek-balance/status`)).json()
  assert.equal(status.apiKey.configured, true)
  assert.equal(status.userToken.configured, true)
  console.log('OK status route')

  // combined data
  const dataResponse = await fetch(`${base}/yamaarashi-deepseek-balance/data`)
  const data = await dataResponse.json()
  assert.equal(data.ok, true)
  assert.equal(data.balance.info.total, 12.34)
  assert.equal(data.balance.currency, 'CNY')
  assert.equal(data.balance.info.granted, 2.34)
  assert.equal(data.usage.cost, 0.51)
  assert.equal(data.usage.tokens, 6060)
  assert.equal(data.usage.requests, 3)
  assert.equal(data.usage.hourlyCost[0], 0.11)
  assert.equal(data.usage.hourlyCost[9], 0.4)
  assert.equal(data.usage.hourlyCost[1], 0)
  assert.deepEqual(data.usage.apiKeys, ['default-key'])
  assert.equal(data.usage.currency, 'CNY')
  console.log('OK combined data normalization (cost/tokens/hour buckets)')

  // short cache: a second poll reuses the payload
  const before = calls.balance
  await (await fetch(`${base}/yamaarashi-deepseek-balance/data`)).json()
  assert.equal(calls.balance, before, 'cached payload must not refetch upstream')
  // manual refresh bypasses it
  await (await fetch(`${base}/yamaarashi-deepseek-balance/data?refresh=1`)).json()
  assert.equal(calls.balance, before + 1, 'refresh=1 must refetch upstream')
  console.log('OK payload cache + refresh bypass')

  // missing userToken degrades only the usage block
  store.delete('YAMAARASHI_DEEPSEEK_USER_TOKEN')
  const partial = await (await fetch(`${base}/yamaarashi-deepseek-balance/data?refresh=1`)).json()
  assert.equal(partial.balance.info.total, 12.34)
  assert.equal(partial.usage, null)
  assert.equal(partial.errors.usage, 'missing_user_token')
  assert.equal(partial.configured.userToken, false)
  console.log('OK partial data (missing userToken)')

  // credential writes require a same-origin Origin
  const forbidden = await fetch(`${base}/yamaarashi-deepseek-balance/credentials`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ field: 'apiKey', value: 'sk-new' }),
  })
  assert.equal(forbidden.status, 403)
  console.log('OK write guard (missing Origin)')

  // invalid API key is rejected and not stored
  upstreamMode = 'bad-key'
  const rejected = await fetch(`${base}/yamaarashi-deepseek-balance/credentials`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ field: 'apiKey', value: 'sk-invalid' }),
  })
  assert.equal(rejected.status, 400)
  assert.equal(store.get('YAMAARASHI_DEEPSEEK_API_KEY'), 'sk-test-key', 'invalid key must not be stored')
  console.log('OK invalid API key rejected, not stored')

  // valid API key is validated then stored
  upstreamMode = 'ok'
  const saved = await fetch(`${base}/yamaarashi-deepseek-balance/credentials`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ field: 'apiKey', value: 'sk-new-valid' }),
  })
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).ok, true)
  assert.equal(store.get('YAMAARASHI_DEEPSEEK_API_KEY'), 'sk-new-valid')
  console.log('OK valid API key validated + stored')

  // invalid userToken rejected
  upstreamMode = 'bad-token'
  const badToken = await fetch(`${base}/yamaarashi-deepseek-balance/credentials`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ field: 'userToken', value: 'expired' }),
  })
  assert.equal(badToken.status, 400)
  assert.equal(store.has('YAMAARASHI_DEEPSEEK_USER_TOKEN'), false)
  console.log('OK invalid userToken rejected')

  // valid userToken stored
  upstreamMode = 'ok'
  const tokenSaved = await fetch(`${base}/yamaarashi-deepseek-balance/credentials`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ field: 'userToken', value: 'fresh-token' }),
  })
  assert.equal(tokenSaved.status, 200)
  assert.equal(store.get('YAMAARASHI_DEEPSEEK_USER_TOKEN'), 'fresh-token')
  console.log('OK valid userToken validated + stored')

  // DELETE clears a credential
  const cleared = await fetch(`${base}/yamaarashi-deepseek-balance/credentials?field=userToken`, {
    method: 'DELETE',
    headers,
  })
  assert.equal(cleared.status, 200)
  assert.equal(store.has('YAMAARASHI_DEEPSEEK_USER_TOKEN'), false)
  assert.equal((await cleared.json()).status.userToken.configured, false)
  console.log('OK DELETE credential')

  // method guard
  const wrongMethod = await fetch(`${base}/yamaarashi-deepseek-balance/data`, { method: 'POST' })
  assert.equal(wrongMethod.status, 405)
  console.log('OK method guard')

  // restore creds and assert upstream errors map to auth_failed in the data block
  store.set('YAMAARASHI_DEEPSEEK_API_KEY', 'sk-test-key')
  store.set('YAMAARASHI_DEEPSEEK_USER_TOKEN', 'test-user-token')
  upstreamMode = 'bad-token'
  const authData = await (await fetch(`${base}/yamaarashi-deepseek-balance/data?refresh=1`)).json()
  assert.equal(authData.errors.usage, 'auth_failed')
  console.log('OK upstream auth error mapping')
} finally {
  server.close()
  globalThis.fetch = realFetch
}

console.log('\nhost-check PASS')
