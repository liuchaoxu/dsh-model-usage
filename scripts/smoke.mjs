#!/usr/bin/env node
/**
 * Dependency-free smoke test for the host half. It imports `lib/index.js` in
 * plain Node, mounts it on a stub context, and drives every route once, so a
 * change that breaks the manifest shape, the effect-registered routes, the
 * response envelope, or the browser trust fence fails before publishing.
 *
 * It needs no Harness: run it with `npm run smoke` (also part of
 * `prepublishOnly`). Nothing here is published.
 */
import assert from 'node:assert/strict'
import { apply, inject } from '../lib/index.js'

const routes = []
const effects = []
const makeCtx = (connection) => ({
  get: (name) => (name === 'connection' ? connection : undefined),
  effect: (callback, label) => { effects.push(label); return callback() },
  webServer: { register: (route) => { routes.push(route); return () => {} } },
})

const makeReq = (method, body) => ({
  method,
  once() {},
  on() {},
  async *[Symbol.asyncIterator]() {
    if (body !== undefined) yield Buffer.from(body)
  },
})
const makeRes = () => {
  const res = { statusCode: 0, headers: undefined, body: undefined, once() {}, on() {} }
  res.writeHead = (status, headers) => { res.statusCode = status; res.headers = headers }
  res.end = (text) => { res.body = text }
  return res
}

// --- mount ------------------------------------------------------------------
apply(makeCtx(undefined))

assert.deepEqual(inject, ['webServer'], 'only webServer is a hard dependency')
assert.equal(routes.length, 3, 'the plugin registers three routes')
assert.deepEqual(
  routes.map((route) => [route.kind, route.path]),
  [
    ['exact', '/model-usage/balance'],
    ['exact', '/model-usage/providers'],
    ['exact', '/model-usage/models'],
  ],
  'route kinds and paths',
)
assert.equal(effects.length, 3, 'every route is registered as an effect')

// --- routes without session/LLM services ------------------------------------
const balance = makeRes()
await routes[0].handler(makeReq('POST', '{}'), balance)
assert.equal(balance.statusCode, 200, 'the balance route answers 200 with an envelope')
const envelope = JSON.parse(balance.body)
assert.equal(envelope.ok, false, 'no session selection yields ok:false')
assert.equal(typeof envelope.error.message, 'string', 'the failure carries a readable message')
assert.notEqual(envelope.error.message, '', 'the failure message is not empty')

const providers = makeRes()
await routes[1].handler(makeReq('GET'), providers)
assert.deepEqual(JSON.parse(providers.body), { ok: true, value: [] }, 'empty provider directory')

const models = makeRes()
await routes[2].handler(makeReq('GET'), models)
assert.deepEqual(
  JSON.parse(models.body),
  { ok: true, value: { groups: [], default: null } },
  'empty model catalog',
)

// --- browser trust fence ----------------------------------------------------
apply(makeCtx({ requestRejection: () => 403 }))
const refused = []
for (const route of routes.slice(3)) {
  const res = makeRes()
  await route.handler(makeReq('GET'), res)
  refused.push(res.statusCode)
}
assert.deepEqual(refused, [403, 403, 403], 'a refused request is answered on every route')

console.log('dsh-model-usage: host smoke test passed (3 routes, envelopes, trust fence)')
