// Node half of dsh-model-usage: hosts the usage query for the model the CURRENT
// CONVERSATION uses and exposes it to the browser half over loopback-only Web
// routes. The model route is resolved from the Session's `modelSelection`
// projection (the same fact the model picker shows), the provider's own
// credential reference is read from the live `llm-pi-ai` / `llm-deepseek`
// configuration, and the matching usage API is called with that very key.
// Secrets never leave the host process — the browser only ever receives the
// normalized payload plus the credential REFERENCE NAME (never a value).
//
// Query kinds, chosen from the resolved provider route and its configured
// `baseURL`:
// - commandcode: the Command Code private usage API (default origin
//   https://api.commandcode.ai): `/alpha/whoami?limits=1`,
//   `/alpha/billing/credits`, `/alpha/billing/subscriptions`,
//   `/alpha/usage/summary?since=`. This is exactly what `cmd /usage` renders.
// - deepseek: the official `GET https://api.deepseek.com/user/balance`.
// - deepseek-account: the signed-in DeepSeek platform wallet, read through
//   `ctx.deepseekAccount` (no API key involved).
// - opencode-go: the OpenCode Go / Go Plus subscription allowances at
//   `GET {origin}/zen/go/v1/usage` (undocumented; normalized defensively).
// - openrouter: `GET {origin}/api/v1/key`, plus `/api/v1/credits` when the key
//   carries no limit of its own.
// - moonshot: `GET {origin}/v1/users/me/balance`.
// - siliconflow: `GET {origin}/v1/user/info`.
// - newapi: any other configured OpenAI-compatible route — best effort against
//   the cc-switch New API convention `GET {origin}/api/user/self`.
//
// The routes follow the webServer contract (like the official webhook
// plugins): `ctx.effect(() => ctx.webServer.register({ kind: 'exact', ... }))`.
// node:http routes carry no global authentication, so every one of ours asks
// the composition's connection service for a rejection first and answers its
// 401/403 itself — the same fence the shipped browser-facing routes apply.
// No Config schema is declared: the plugin loads through a profile junction or
// an npm install, so everything is node builtins and validation happens at
// query time (fail loud in the panel).
// Only `webServer` is a hard dependency; `connection`, `credentials`, `llm`,
// `settings`, `sessions`, `sessionProjections`, `sessionController`,
// `agentDefaultModel` and `deepseekAccount` are read through `ctx.get()` on
// every use: the plugin still mounts — and says what is missing — in a
// composition that provides fewer services, and a service that activates later
// is picked up by the next query.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

export const inject = ['webServer']

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'
/** Provider routes that authenticate with the official DeepSeek API key. */
const DEEPSEEK_PROVIDERS = Object.freeze(['deepseek-official', 'deepseek'])
const NEW_API_USER_AGENT = 'cc-switch/1.0'
const NEW_API_QUOTA_SCALE = 500000
/** Deadline for one usage API call; a wedged provider must not block the next refresh. */
const QUERY_TIMEOUT_MS = 30000

const COMMAND_CODE_PROVIDER = 'commandcode'
const COMMAND_CODE_BASE = 'https://api.commandcode.ai'
/** Web host the human-facing usage page lives on (the API host is `api.`). */
const COMMAND_CODE_WEB_BASE = 'https://commandcode.ai'
/** Env var older builds of this plugin (and the cc tooling) used. */
const COMMAND_CODE_LEGACY_ENV_KEY = 'COMMAND_CODE_API_KEY'
const COMMAND_CODE_AUTH_FILE = '.commandcode/auth.json'

/** Plan id → display name (subset relevant to goat and neighbors). */
const COMMAND_CODE_PLANS = Object.freeze({
  'individual-go': 'Go',
  'individual-goat': 'GOAT',
  'individual-pro': 'Pro',
  'individual-pro-v1': 'Pro',
  'individual-provider': 'Provider',
  'individual-max': 'Max',
  'individual-ultra': 'Ultra',
  'teams-pro': 'Teams Pro',
})

/** Human labels for the panel's 说明 list, keyed by query kind. */
const KIND_LABELS = Object.freeze({
  commandcode: 'Command Code 用量（窗口 / 信用）',
  deepseek: 'DeepSeek 官方余额',
  'deepseek-account': 'DeepSeek 账户钱包余额',
  'opencode-go': 'OpenCode Go 订阅用量',
  openrouter: 'OpenRouter 额度',
  moonshot: 'Moonshot / Kimi 余额',
  siliconflow: 'SiliconFlow 余额',
  newapi: 'New API 兼容额度',
})

/** Reference names to fall back on when a setup declares no `apiKeyEnv`. */
const PROVIDER_KEY_REFS = Object.freeze({
  opencode: 'OPENCODE_API_KEY',
  'opencode-go': 'OPENCODE_API_KEY',
  moonshotai: 'MOONSHOT_API_KEY',
  'moonshotai-cn': 'MOONSHOT_API_KEY',
  'kimi-coding': 'KIMI_API_KEY',
})

/** Normalize a configured base URL: trim and strip trailing slashes. */
function baseUrlOf(raw) {
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : ''
}

/**
 * Path part of a configured base URL, lowercased — the same host can serve
 * several products (`opencode.ai/zen` vs `opencode.ai/zen/go`), so the path is
 * what separates a queryable subscription from one with no usage API at all.
 * @param raw - configured `baseURL`.
 * @returns the pathname (starting with `/`), or `""`.
 */
function pathOf(raw) {
  const base = baseUrlOf(raw)
  if (base === '') return ''
  try {
    return new URL(base).pathname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Reduce a configured base URL to its origin (`https://host[:port]`), which is
 * what the billing endpoints hang off — a provider base URL carries the
 * protocol path (`https://api.commandcode.ai/provider/v1`) that usage APIs do
 * not serve.
 * @param raw - configured `baseURL`.
 * @returns the origin, or null when the value is not an absolute http(s) URL.
 */
function originOf(raw) {
  const base = baseUrlOf(raw)
  if (base === '') return null
  try {
    const url = new URL(base)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin
  } catch {
    return null
  }
}

/** Lowercased hostname of an origin, or `""`. */
function hostOf(origin) {
  if (origin === null) return ''
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Derive the conventional credential reference for a provider route — the same
 * name the Models settings page stores a typed key under when the profile does
 * not declare `apiKeyEnv` (`commandcode` → `COMMANDCODE_API_KEY`).
 * @param provider - provider route id.
 * @returns the derived reference name.
 */
function deriveKeyRef(provider) {
  return `${String(provider).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/**
 * Read a nested value by path, tolerating every intermediate being absent.
 * @param root - container value (a settings namespace `value`, usually).
 * @param path - key path such as `['providers', 'commandcode']`.
 * @returns the value at the path, or undefined.
 */
function atPath(root, path) {
  let node = root
  for (const key of Array.isArray(path) ? path : []) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[key]
  }
  return node
}

/**
 * Apply the cc-switch New API extractor to a `/api/user/self` response body.
 * @param body - parsed JSON response.
 * @returns the normalized balance, or a readable failure.
 */
function extractNewApi(body) {
  if (body === null || typeof body !== 'object' || body.success !== true || body.data == null) {
    return { ok: false, message: typeof body?.message === 'string' && body.message !== '' ? body.message : '查询失败' }
  }
  const quota = Number(body.data.quota)
  const used = Number(body.data.used_quota)
  if (!Number.isFinite(quota) || !Number.isFinite(used)) {
    return { ok: false, message: '返回数据缺少 quota / used_quota 字段' }
  }
  return {
    ok: true,
    value: {
      planName: typeof body.data.group === 'string' && body.data.group !== '' ? body.data.group : '默认套餐',
      remaining: quota / NEW_API_QUOTA_SCALE,
      used: used / NEW_API_QUOTA_SCALE,
      total: (quota + used) / NEW_API_QUOTA_SCALE,
      unit: 'USD',
    },
  }
}

/**
 * Read a Command Code login file (never logged) — the fallback source for the
 * key when the provider's credential reference is not configured.
 * @returns the parsed file, or undefined.
 */
function readCommandCodeAuthFile() {
  // auth.json lives in the OS user home (`command-code login` writes it there),
  // never under DSH_HOME.
  const home = homedir()
  if (home === undefined || home === '') return undefined
  try {
    const raw = readFileSync(`${home.replace(/[\\/]+$/, '')}/${COMMAND_CODE_AUTH_FILE}`, 'utf8')
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Resolve one credential reference to its value plus a readable source name.
 * Resolution is per call, exactly like the LLM adapters: a key stored from the
 * Models page reaches the next query without a restart.
 * @param ctx - host context, with the optional `credentials` service.
 * @param ref - reference name (`COMMANDCODE_API_KEY`).
 * @param provider - provider route, used for the provider-specific fallbacks.
 * @returns `{ value, source }`, or undefined while unconfigured.
 */
async function resolveKey(ctx, ref, provider) {
  try {
    const hit = await ctx.get('credentials')?.resolve?.(ref)
    if (hit !== undefined && hit.value !== '') {
      return { value: hit.value, source: `凭据 ${ref}（${hit.source}）` }
    }
  } catch {
    // An unusable credential store falls through to the environment probes.
  }
  const fromEnv = process.env[ref]
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return { value: fromEnv.trim(), source: `环境变量 ${ref}` }
  }
  if (provider === COMMAND_CODE_PROVIDER) {
    const legacy = process.env[COMMAND_CODE_LEGACY_ENV_KEY]
    if (legacy !== undefined && legacy.trim() !== '') {
      return { value: legacy.trim(), source: `环境变量 ${COMMAND_CODE_LEGACY_ENV_KEY}` }
    }
    const parsed = readCommandCodeAuthFile()
    if (typeof parsed?.apiKey === 'string' && parsed.apiKey !== '') {
      return {
        value: parsed.apiKey,
        source: `~/.commandcode/auth.json${typeof parsed.userName === 'string' ? `（${parsed.userName}）` : ''}`,
      }
    }
  }
  return undefined
}

/**
 * Build a per-request provider-profile lookup: the credential reference,
 * endpoint, and display name the LLM adapter itself uses. The directory
 * supplies the settings address, so a hand-declared route in the profile
 * (`llm-pi-ai.providers.commandcode`) and a shipped one
 * (`llm-deepseek.apiKeyEnv`) both resolve the same way.
 *
 * `settings.describe()` projects every active plugin's configuration and is not
 * cheap, so it is read once per lookup and shared by every provider the request
 * touches.
 * @param ctx - host context carrying optional `llm` and `settings`.
 * @returns `(provider) => { displayName, apiKeyEnv, baseURL, api, headers }`,
 *   with fields absent from the configuration left undefined.
 */
function createProfileLookup(ctx) {
  let entries
  let descriptors
  let loaded = false
  const load = () => {
    if (loaded) return
    loaded = true
    try {
      const rows = ctx.get('llm')?.listConfigurableProviders?.() ?? []
      entries = Array.isArray(rows) ? rows : []
    } catch {
      entries = []
    }
    try {
      const rows = ctx.get('settings')?.describe?.() ?? []
      descriptors = Array.isArray(rows) ? rows : []
    } catch {
      descriptors = []
    }
  }
  return (provider) => {
    const profile = { displayName: undefined, apiKeyEnv: undefined, baseURL: undefined, api: undefined, headers: undefined }
    load()
    const entry = entries.find((row) => row?.provider === provider)
    if (entry === undefined) return profile
    profile.displayName = typeof entry.displayName === 'string' && entry.displayName !== '' ? entry.displayName : undefined
    const namespace = descriptors.find((row) => row?.ns === entry.settingsNs)
    const configured = atPath(namespace?.value, entry.settingsPath ?? [])
    if (configured === null || typeof configured !== 'object') return profile
    if (typeof configured.displayName === 'string' && configured.displayName !== '') profile.displayName = configured.displayName
    if (typeof configured.apiKeyEnv === 'string' && configured.apiKeyEnv !== '') profile.apiKeyEnv = configured.apiKeyEnv
    if (typeof configured.baseURL === 'string' && configured.baseURL !== '') profile.baseURL = configured.baseURL
    if (typeof configured.api === 'string' && configured.api !== '') profile.api = configured.api
    if (configured.headers !== null && typeof configured.headers === 'object') profile.headers = configured.headers
    return profile
  }
}

/**
 * The credential reference a route resolves its key from: what the profile
 * declares, else the conventional name — with the official DeepSeek route
 * pinned to its own long-standing variable.
 * @param provider - provider route id.
 * @param profile - resolved provider profile.
 * @returns the reference name, or undefined when the route needs no API key.
 */
function keyRefOf(provider, profile) {
  if (profile.apiKeyEnv !== undefined) return profile.apiKeyEnv
  if (provider === 'deepseek-account') return undefined
  if (DEEPSEEK_PROVIDERS.includes(provider)) return 'DEEPSEEK_API_KEY'
  if (PROVIDER_KEY_REFS[provider] !== undefined) return PROVIDER_KEY_REFS[provider]
  return deriveKeyRef(provider)
}

/**
 * Choose the usage API for one route. The configured endpoint wins over the
 * route name, so a renamed deployment still reaches the right service.
 *
 * `opencode.ai` serves two products on one host: Zen (pay-as-you-go, no usage
 * API at all) and Go/Go Plus (a subscription whose `/zen/go/v1/usage` endpoint
 * exists and validates the API key), so the path decides.
 * @param provider - provider route id.
 * @param profile - resolved provider profile.
 * @returns the query kind, or null when no usage API is known for the route.
 */
function kindOf(provider, profile) {
  if (provider === 'deepseek-account') return 'deepseek-account'
  const origin = originOf(profile.baseURL)
  const host = hostOf(origin)
  const path = pathOf(profile.baseURL)
  if (host !== '' && (host === 'commandcode.ai' || host.endsWith('.commandcode.ai'))) return 'commandcode'
  if (host !== '' && (host === 'opencode.ai' || host.endsWith('.opencode.ai'))) {
    return path.includes('/zen/go') ? 'opencode-go' : null
  }
  if (host !== '' && (host === 'openrouter.ai' || host.endsWith('.openrouter.ai'))) return 'openrouter'
  if (host !== '' && (host.endsWith('moonshot.cn') || host.endsWith('moonshot.ai'))) return 'moonshot'
  if (host !== '' && (host.endsWith('siliconflow.cn') || host.endsWith('siliconflow.com'))) return 'siliconflow'
  if (host !== '' && (host === 'deepseek.com' || host.endsWith('.deepseek.com'))) return 'deepseek'
  if (provider === COMMAND_CODE_PROVIDER) return 'commandcode'
  if (provider === 'opencode-go') return 'opencode-go'
  if (provider === 'openrouter') return 'openrouter'
  if (provider === 'moonshotai' || provider === 'moonshotai-cn' || provider === 'kimi-coding') return 'moonshot'
  if (provider === 'siliconflow') return 'siliconflow'
  if (DEEPSEEK_PROVIDERS.includes(provider)) return 'deepseek'
  return origin !== null ? 'newapi' : null
}

/** Fetch one Command Code API endpoint with the shared bearer header. */
async function commandCodeFetch(base, endpoint, key, signal) {
  const res = await fetch(`${base}${endpoint}`, {
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    signal,
  })
  if (!res.ok) {
    throw new Error(`Command Code 接口返回 HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Build a query string skipping null / undefined / empty values — the API
 * rejects an empty `orgId` (personal accounts have no org), and the CLI's
 * own `buildUsageEndpoint` skips them the same way.
 * @param params - key → value map; falsy scalars are omitted.
 * @returns `?a=1&b=2` or `""`.
 */
function queryOf(params) {
  const parts = []
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

/**
 * Query the Command Code private usage API — the same four calls the CLI's
 * `/usage` command makes. Returns the normalized usage view.
 * @param base - API origin.
 * @param key - the provider key the conversation itself is using.
 * @param signal - abort signal.
 */
async function queryCommandCode(base, key, signal) {
  let whoami
  try {
    whoami = await commandCodeFetch(base, '/alpha/whoami?limits=1', key, signal)
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
  const orgId = whoami?.org?.id ?? null
  let credits = null
  let subscription = null
  let summary = null
  try {
    ;[credits, subscription] = await Promise.all([
      commandCodeFetch(base, `/alpha/billing/credits${queryOf({ orgId })}`, key, signal),
      commandCodeFetch(base, `/alpha/billing/subscriptions${queryOf({ orgId })}`, key, signal),
    ])
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
  const sub = subscription?.data ?? null
  const periodStart = typeof sub?.currentPeriodStart === 'string' ? sub.currentPeriodStart : null
  const periodEnd = typeof sub?.currentPeriodEnd === 'string' ? Date.parse(sub.currentPeriodEnd) : NaN
  if (periodStart !== null) {
    try {
      summary = await commandCodeFetch(base, `/alpha/usage/summary${queryOf({ orgId, since: periodStart })}`, key, signal)
    } catch {
      // Summary is best-effort; the windows and credits still render.
      summary = null
    }
  }
  const creditInfo = credits?.credits ?? null
  const monthly = Number(creditInfo?.monthlyCredits ?? 0)
  const purchased = Number(creditInfo?.purchasedCredits ?? 0)
  const free = Number(creditInfo?.freeCredits ?? 0)
  const totalCost = Number(summary?.totalCost ?? 0)
  const totalCount = Number(summary?.totalCount ?? 0)
  const planId = typeof sub?.planId === 'string' ? sub.planId : null
  // windowLimits sits at the credits response top level, beside `credits`.
  const windows = credits?.windowLimits ?? null
  const account = typeof whoami?.user?.userName === 'string' && whoami.user.userName !== ''
    ? whoami.user.userName
    : typeof whoami?.user?.name === 'string' ? whoami.user.name : null
  return {
    ok: true,
    value: {
      planName: planId !== null && COMMAND_CODE_PLANS[planId] !== undefined ? COMMAND_CODE_PLANS[planId] : (planId ?? '未知套餐'),
      account,
      status: typeof sub?.status === 'string' ? sub.status : null,
      cycleEnd: Number.isFinite(periodEnd) ? periodEnd : null,
      credits: {
        monthlyRemaining: monthly,
        purchasedRemaining: purchased,
        freeRemaining: free,
        totalRemaining: monthly + purchased + free,
        totalSpent: totalCost,
        totalCount,
      },
      windows: windows === null ? null : {
        limited: windows.limited === true,
        fiveHour: windows.fiveHour != null ? {
          used: Number(windows.fiveHour.used ?? 0),
          cap: Number(windows.fiveHour.cap ?? 0),
          resetAt: Number(windows.fiveHour.resetAt ?? 0),
        } : null,
        weekly: windows.weekly != null ? {
          used: Number(windows.weekly.used ?? 0),
          cap: Number(windows.weekly.cap ?? 0),
          resetAt: Number(windows.weekly.resetAt ?? 0),
        } : null,
      },
      now: Date.now(),
      usageUrl: `${COMMAND_CODE_WEB_BASE}/usage`,
    },
  }
}

/**
 * Query the official DeepSeek balance endpoint with the route's own key.
 * @param url - balance endpoint (the configured origin when it is DeepSeek's).
 * @param key - the key the conversation is using.
 * @param signal - abort signal.
 */
async function queryDeepSeek(url, key, signal) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal,
  })
  if (!res.ok) {
    return { ok: false, message: `DeepSeek 余额接口返回 HTTP ${res.status}` }
  }
  return { ok: true, value: await res.json() }
}

/**
 * Query a New API deployment's `/api/user/self` (best effort for any other
 * OpenAI-compatible route), carrying the route's configured headers.
 * @param origin - the route's origin.
 * @param key - the key the conversation is using.
 * @param headers - extra headers the profile declares.
 * @param signal - abort signal.
 */
async function queryNewApi(origin, key, headers, signal) {
  const res = await fetch(`${origin}/api/user/self`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'User-Agent': NEW_API_USER_AGENT,
      ...(headers ?? {}),
    },
    signal,
  })
  if (!res.ok) {
    return { ok: false, message: `New API 余额接口返回 HTTP ${res.status}` }
  }
  const extracted = extractNewApi(await res.json())
  return extracted.ok ? { ok: true, value: extracted.value } : { ok: false, message: extracted.message }
}

// ---------------------------------------------------------------------------
// Per-provider usage adapters. Each one answers the same question in the
// provider's own vocabulary and normalizes to the panel's two building blocks:
// `windows` (used / limit / resetsAt meters) and `rows` (label → value lines).
// Whatever the endpoint actually returned rides along as `raw`, so an endpoint
// whose shape drifts still shows something readable — and reportable.

/** Parse a numeric field that may arrive as a number or a numeric string. */
function numberOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Parse a reset instant that may arrive as epoch milliseconds or an ISO string. */
function dateOf(value) {
  const numeric = numberOf(value)
  if (numeric !== null) return numeric < 1e11 ? Math.round(numeric * 1000) : numeric
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** Round a money value for display without inventing precision. */
function moneyOf(value) {
  const numeric = numberOf(value)
  return numeric === null ? null : numeric
}

/** Take the first present value among several candidate field names. */
function firstOf(node, keys) {
  for (const key of keys) {
    if (node[key] !== undefined && node[key] !== null) return node[key]
  }
  return undefined
}

/** Fetch one JSON endpoint with the provider's own key. */
async function fetchUsageJson(url, key, headers, signal, label) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${key}`,
      ...(headers ?? {}),
    },
    signal,
  })
  if (!res.ok) {
    return { ok: false, message: `${label} 接口返回 HTTP ${res.status}` }
  }
  try {
    return { ok: true, value: await res.json() }
  } catch {
    return { ok: false, message: `${label} 返回的不是 JSON` }
  }
}

/** One window meter from a node that names its own used / limit / reset. */
function windowOf(label, node) {
  if (node === null || typeof node !== 'object') return null
  const used = moneyOf(firstOf(node, ['used', 'usage', 'spent', 'cost', 'usedUsd', 'used_usd']))
  const limit = moneyOf(firstOf(node, ['limit', 'cap', 'quota', 'max', 'total', 'monthlyLimit', 'monthly_limit']))
  if (used === null && limit === null) return null
  return {
    label,
    used: used ?? 0,
    limit: limit ?? 0,
    resetsAt: dateOf(firstOf(node, ['resetsAt', 'resetAt', 'reset', 'resets_at', 'reset_at', 'renewsAt', 'periodEnd'])),
  }
}

/**
 * Normalize the OpenCode Go usage payload. Its exact shape is not documented
 * (verified only as far as `401` without a key), so the candidate field names
 * cover the plausible spellings and anything unrecognized stays visible in
 * `raw`.
 */
function normalizeOpenCodeGo(body) {
  const root = body !== null && typeof body === 'object' ? (body.data ?? body) : {}
  const windows = []
  const windowsNode = root.windows ?? root.limits ?? root.usageWindows ?? root.usage_windows ?? root
  for (const [keys, label] of [
    [['fiveHour', 'five_hour', 'fivehour', '5h', 'five_hours'], '5 小时窗口'],
    [['weekly', 'week', '7d', 'sevenDay', 'seven_day'], '7 天窗口'],
    [['monthly', 'month', 'monthlyUsage', 'monthly_usage', '30d'], '月额度'],
  ]) {
    const node = firstOf(windowsNode, keys)
    const window = windowOf(label, node)
    if (window !== null) windows.push(window)
  }
  const rows = []
  const plan = firstOf(root, ['plan', 'planName', 'plan_name', 'tier', 'subscription'])
  if (typeof plan === 'string' && plan !== '') rows.push({ label: '套餐', value: plan })
  const status = firstOf(root, ['status', 'state'])
  if (typeof status === 'string' && status !== '') rows.push({ label: '状态', value: status })
  const used = moneyOf(firstOf(root, ['used', 'usage', 'spent', 'cost', 'totalUsed', 'total_used']))
  if (used !== null) rows.push({ label: '已用', value: `$${used.toFixed(2)}` })
  const limit = moneyOf(firstOf(root, ['limit', 'cap', 'quota', 'totalLimit', 'total_limit']))
  if (limit !== null) rows.push({ label: '额度', value: `$${limit.toFixed(2)}` })
  const balance = moneyOf(firstOf(root, ['balance', 'credit', 'credits', 'remaining']))
  if (balance !== null) rows.push({ label: '余额', value: `$${balance.toFixed(2)}` })
  // A per-model breakdown, if this endpoint carries one.
  const modelsNode = firstOf(root, ['models', 'byModel', 'by_model', 'perModel', 'per_model'])
  const models = []
  if (Array.isArray(modelsNode)) {
    for (const entry of modelsNode) {
      if (entry === null || typeof entry !== 'object') continue
      const id = firstOf(entry, ['model', 'id', 'name', 'modelId', 'model_id'])
      const entryUsed = moneyOf(firstOf(entry, ['used', 'usage', 'spent', 'cost']))
      const entryLimit = moneyOf(firstOf(entry, ['limit', 'cap', 'quota', 'max']))
      if (id === undefined && entryUsed === null) continue
      models.push({ model: String(id ?? '未知模型'), used: entryUsed, limit: entryLimit })
    }
  } else if (modelsNode !== null && typeof modelsNode === 'object') {
    for (const [id, entry] of Object.entries(modelsNode)) {
      if (entry === null || typeof entry !== 'object') continue
      models.push({
        model: id,
        used: moneyOf(firstOf(entry, ['used', 'usage', 'spent', 'cost'])),
        limit: moneyOf(firstOf(entry, ['limit', 'cap', 'quota', 'max'])),
      })
    }
  }
  return { windows, models, rows, raw: body }
}

/** OpenCode Go / Go Plus subscription usage (`/zen/go/v1/usage`). */
async function queryOpenCodeGo(origin, key, headers, signal) {
  const res = await fetchUsageJson(`${origin}/zen/go/v1/usage`, key, headers, signal, 'OpenCode Go')
  if (!res.ok) return res
  return { ok: true, value: normalizeOpenCodeGo(res.value) }
}

/** OpenRouter credits: `/api/v1/key` carries the limit, `/api/v1/credits` the pool. */
async function queryOpenRouter(origin, key, headers, signal) {
  const res = await fetchUsageJson(`${origin}/api/v1/key`, key, headers, signal, 'OpenRouter')
  if (!res.ok) return res
  const data = res.value?.data ?? {}
  const usage = moneyOf(data.usage) ?? 0
  const limit = moneyOf(data.limit)
  const remaining = moneyOf(data.limit_remaining)
  const rows = [{ label: '已用', value: `$${usage.toFixed(2)}` }]
  if (limit !== null) rows.push({ label: '额度', value: `$${limit.toFixed(2)}` })
  rows.push({ label: '剩余', value: `$${(remaining ?? (limit === null ? 0 : Math.max(0, limit - usage))).toFixed(2)}` })
  if (typeof data.label === 'string' && data.label !== '') rows.push({ label: 'Key', value: data.label })
  if (data.is_free_tier === true) rows.push({ label: '套餐', value: '免费层' })
  const raw = { key: res.value }
  if (limit === null) {
    // A key without its own limit spends from the account credit pool.
    const credits = await fetchUsageJson(`${origin}/api/v1/credits`, key, headers, signal, 'OpenRouter')
    if (credits.ok) {
      const total = moneyOf(credits.value?.data?.total_credits)
      const spent = moneyOf(credits.value?.data?.total_usage)
      if (total !== null) rows.push({ label: '账户总额度', value: `$${total.toFixed(2)}` })
      if (spent !== null) rows.push({ label: '账户已用', value: `$${spent.toFixed(2)}` })
      if (total !== null && spent !== null) rows.push({ label: '账户剩余', value: `$${Math.max(0, total - spent).toFixed(2)}` })
      raw.credits = credits.value
    }
  }
  return { ok: true, value: { rows, raw } }
}

/** Moonshot / Kimi balance: `GET /v1/users/me/balance`. */
async function queryMoonshot(origin, key, headers, signal) {
  const res = await fetchUsageJson(`${origin}/v1/users/me/balance`, key, headers, signal, 'Moonshot')
  if (!res.ok) return res
  const data = res.value?.data ?? {}
  const rows = []
  const available = moneyOf(data.available_balance ?? data.availableBalance)
  const voucher = moneyOf(data.voucher_balance ?? data.voucherBalance)
  const cash = moneyOf(data.cash_balance ?? data.cashBalance)
  if (available !== null) rows.push({ label: '可用余额', value: `¥${available.toFixed(2)}` })
  if (cash !== null) rows.push({ label: '现金余额', value: `¥${cash.toFixed(2)}` })
  if (voucher !== null) rows.push({ label: '代金券', value: `¥${voucher.toFixed(2)}` })
  if (rows.length === 0) return { ok: false, message: 'Moonshot 接口未返回可识别的余额字段' }
  return { ok: true, value: { rows, raw: res.value } }
}

/** SiliconFlow balance: `GET /v1/user/info`. */
async function querySiliconFlow(origin, key, headers, signal) {
  const res = await fetchUsageJson(`${origin}/v1/user/info`, key, headers, signal, 'SiliconFlow')
  if (!res.ok) return res
  const data = res.value?.data ?? {}
  const rows = []
  const total = moneyOf(data.totalBalance ?? data.total_balance)
  const charge = moneyOf(data.chargeBalance ?? data.charge_balance)
  const gift = moneyOf(data.balance)
  if (total !== null) rows.push({ label: '总余额', value: `¥${total.toFixed(2)}` })
  if (charge !== null) rows.push({ label: '充值余额', value: `¥${charge.toFixed(2)}` })
  if (gift !== null) rows.push({ label: '赠送余额', value: `¥${gift.toFixed(2)}` })
  if (typeof data.name === 'string' && data.name !== '') rows.push({ label: '账户', value: data.name })
  if (rows.length === 0) return { ok: false, message: 'SiliconFlow 接口未返回可识别的余额字段' }
  return { ok: true, value: { rows, raw: res.value } }
}

/**
 * Read the signed-in DeepSeek platform wallet through the account service —
 * the `deepseek-account` route holds no API key at all.
 * @param ctx - host context carrying optional `deepseekAccount`.
 * @returns the normalized wallet view, or a readable failure.
 */
async function queryDeepSeekAccount(ctx) {
  const account = ctx.get('deepseekAccount')
  if (account === undefined) {
    return { ok: false, message: '当前部署没有挂载 deepseek-account 服务，无法读取账户钱包' }
  }
  const client = {
    version: '1.0.0',
    locale: 'zh-CN',
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
  const balance = await account.getBalance(client)
  if (balance === null || balance === undefined) {
    return { ok: false, message: '尚未登录 DeepSeek 账户（设置 → 账户里登录后再试）' }
  }
  if (balance.status !== 'ready') {
    return { ok: false, message: 'DeepSeek 账户余额查询失败' }
  }
  const wallets = [...(balance.value ?? []), ...(balance.bonusWallets ?? [])]
    .map((wallet) => ({ currency: wallet.currency, balance: wallet.balance }))
  return { ok: true, value: { wallets } }
}

/**
 * The model selection the current conversation runs on: the browser's copy of
 * the Session's own projection first, then this Host's live projection, then
 * the deployment default.
 * @param ctx - host context carrying optional session services.
 * @param payload - browser payload; `provider` + `model` win when both exist.
 * @returns `{ provider, model, reasoningEffort? }`, or null while unknown.
 */
function resolveSelection(ctx, payload) {
  if (typeof payload?.provider === 'string' && payload.provider !== ''
      && typeof payload?.model === 'string' && payload.model !== '') {
    return {
      provider: payload.provider,
      model: payload.model,
      ...(typeof payload?.reasoningEffort === 'string' ? { reasoningEffort: payload.reasoningEffort } : {}),
    }
  }
  try {
    const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : ''
    const session = sessionId === '' ? undefined : ctx.get('sessions')?.get?.(sessionId)
    const state = session === undefined ? undefined : ctx.get('sessionProjections')?.stateOf?.(session, 'modelSelection')
    const selected = state?.pending ?? state?.lastUsed
    if (selected !== null && selected !== undefined && typeof selected.provider === 'string') return selected
  } catch {
    // A missing or cold Session simply falls through to the deployment default.
  }
  const fallback = ctx.get('agentDefaultModel')?.currentSelection?.()
  return fallback !== null && fallback !== undefined && typeof fallback.provider === 'string' ? fallback : null
}

/**
 * Run the usage query that belongs to one conversation model.
 * @param ctx - host context.
 * @param signal - abort signal for every outbound call.
 * @param payload - browser payload (model selection and/or session id).
 * @returns the normalized `{ ok, value | error }` envelope.
 */
async function queryUsage(ctx, signal, payload) {
  const selection = resolveSelection(ctx, payload)
  if (selection === null) {
    return {
      ok: false,
      error: {
        code: 'internal',
        message: '无法确定当前对话使用的模型：会话还没有过模型选择，请先在对话里选一次模型',
        details: {},
      },
    }
  }
  const { provider } = selection
  const profileOf = createProfileLookup(ctx)
  const profile = profileOf(provider)
  const kind = kindOf(provider, profile)
  const providerName = profile.displayName ?? provider
  const shared = { provider, providerName, model: selection.model, reasoningEffort: selection.reasoningEffort }
  if (kind === null) {
    const configured = originOf(profile.baseURL) !== null
    return {
      ok: false,
      error: {
        code: 'internal',
        message: configured
          ? `供应商「${providerName}」没有已适配的用量接口：${profile.baseURL} 不对应任何已知的用量 API`
          : `供应商「${providerName}」既没有配置 baseURL，也不是已知的用量接口，无法查询用量`,
        details: {},
      },
    }
  }
  const ref = keyRefOf(provider, profile)
  let key
  if (kind !== 'deepseek-account') {
    if (ref === undefined) {
      return {
        ok: false,
        error: { code: 'internal', message: `供应商「${providerName}」没有可用的凭据引用`, details: {} },
      }
    }
    const resolved = await resolveKey(ctx, ref, provider)
    if (resolved === undefined) {
      return {
        ok: false,
        error: {
          code: 'internal',
          message: `未找到供应商「${providerName}」的 API Key：当前对话用的是 ${ref}，请在 设置 → 模型 里填写`,
          details: {},
        },
      }
    }
    key = resolved
  }
  const credential = ref === undefined
    ? null
    : { ref, source: key?.source ?? null }
  let result
  const deadline = withTimeout(signal, QUERY_TIMEOUT_MS)
  try {
    if (kind === 'commandcode') {
      result = await queryCommandCode(originOf(profile.baseURL) ?? COMMAND_CODE_BASE, key.value, deadline)
    } else if (kind === 'deepseek') {
      const origin = originOf(profile.baseURL)
      const host = hostOf(origin)
      const url = host === 'deepseek.com' || host.endsWith('.deepseek.com')
        ? `${origin}/user/balance`
        : DEEPSEEK_BALANCE_URL
      result = await queryDeepSeek(url, key.value, deadline)
    } else if (kind === 'deepseek-account') {
      result = await queryDeepSeekAccount(ctx)
    } else if (kind === 'opencode-go') {
      result = await queryOpenCodeGo(originOf(profile.baseURL), key.value, profile.headers, deadline)
    } else if (kind === 'openrouter') {
      result = await queryOpenRouter(originOf(profile.baseURL), key.value, profile.headers, deadline)
    } else if (kind === 'moonshot') {
      result = await queryMoonshot(originOf(profile.baseURL), key.value, profile.headers, deadline)
    } else if (kind === 'siliconflow') {
      result = await querySiliconFlow(originOf(profile.baseURL), key.value, profile.headers, deadline)
    } else {
      result = await queryNewApi(originOf(profile.baseURL), key.value, profile.headers, deadline)
    }
  } catch (err) {
    return {
      ok: false,
      error: { code: 'internal', message: queryFailureMessage(err), details: {} },
    }
  }
  if (!result.ok) {
    return { ok: false, error: { code: 'internal', message: result.message, details: {} } }
  }
  return { ok: true, value: { mode: kind, ...shared, credential, data: result.value } }
}

/**
 * The read-only provider directory for the panel's 说明 dialog: which routes
 * exist, which credential reference each resolves, and whether that reference
 * is configured. No value ever crosses this boundary.
 * @param ctx - host context.
 * @returns one row per declared provider route.
 */
async function providerRows(ctx) {
  const profileOf = createProfileLookup(ctx)
  let rows = []
  try {
    rows = ctx.get('llm')?.listConfigurableProviders?.() ?? []
  } catch {
    rows = []
  }
  if (!Array.isArray(rows)) return []
  const out = []
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || typeof row.provider !== 'string') continue
    const profile = profileOf(row.provider)
    const ref = keyRefOf(row.provider, profile)
    const kind = kindOf(row.provider, profile)
    let configured = false
    let source = null
    if (ref !== undefined) {
      try {
        const info = await ctx.get('credentials')?.describe?.(ref)
        configured = info?.configured === true
        source = typeof info?.source === 'string' ? info.source : null
      } catch {
        configured = false
      }
    } else {
      configured = true
      source = '账户登录'
    }
    out.push({
      provider: row.provider,
      displayName: profile.displayName ?? row.displayName ?? row.provider,
      kind,
      kindLabel: kind === null ? '不支持用量查询' : KIND_LABELS[kind] ?? kind,
      baseUrl: profile.baseURL ?? null,
      credentialRef: ref ?? null,
      configured,
      source,
    })
  }
  return out
}

/**
 * Bound one outbound call. The panel now refreshes on a timer, so a provider
 * that never answers must not hold the one in-flight slot forever — the caller
 * aborts on close, and this adds a deadline of its own.
 * @param signal - caller cancellation, when there is one.
 * @param ms - deadline in milliseconds.
 * @returns a signal that aborts on either cause.
 */
function withTimeout(signal, ms) {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return signal
  const deadline = AbortSignal.timeout(ms)
  if (signal === undefined || typeof AbortSignal.any !== 'function') return deadline
  return AbortSignal.any([signal, deadline])
}

/** Turn one adapter failure into a readable message; a deadline reads as a timeout. */
function queryFailureMessage(err) {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return `用量接口超时（${Math.round(QUERY_TIMEOUT_MS / 1000)} 秒未返回）`
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * The routable model catalog, annotated with the usage API each provider route
 * resolves — the data behind the panel's manual model picker. Providers come
 * from the same catalog the model switch uses, so a manual choice is always a
 * route the deployment can actually serve.
 * @param ctx - host context carrying optional `sessionController`.
 * @returns `{ groups, default }`, each group `{ provider, name, kind, kindLabel, models }`.
 */
async function modelCatalogRows(ctx) {
  let catalog
  try {
    catalog = await ctx.get('sessionController')?.modelCatalog?.()
  } catch {
    catalog = undefined
  }
  const profileOf = createProfileLookup(ctx)
  const groups = []
  for (const group of Array.isArray(catalog?.groups) ? catalog.groups : []) {
    if (group === null || typeof group !== 'object' || typeof group.id !== 'string' || group.id === '') continue
    const kind = kindOf(group.id, profileOf(group.id))
    groups.push({
      provider: group.id,
      name: typeof group.name === 'string' && group.name !== '' ? group.name : group.id,
      kind,
      kindLabel: kind === null ? '不支持用量查询' : KIND_LABELS[kind] ?? kind,
      models: (Array.isArray(group.models) ? group.models : []).flatMap((model) => (
        model !== null && typeof model === 'object' && typeof model.id === 'string' && model.id !== ''
          ? [{ id: model.id, name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id }]
          : []
      )),
    })
  }
  const selected = catalog?.default
  return {
    groups,
    default: selected !== null && typeof selected === 'object' && typeof selected.provider === 'string'
      ? { provider: selected.provider, model: typeof selected.model === 'string' ? selected.model : '' }
      : null,
  }
}

/** Read the entirety of a node:http request body as a UTF-8 string. */
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/** Write a JSON response with a normalized `{ ok, value | error }` envelope. */
function writeJson(res, statusCode, value) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

/**
 * Apply the composition's own browser-trust fence to one request. `node:http`
 * routes are unauthenticated by construction (the web server has no global
 * policy — every route owner decides), so each of ours asks the connection
 * service first and answers its 401/403 itself when the request is not from an
 * accepted authority. A deployment without the service keeps the plugin usable.
 * @param ctx - host context carrying the optional `connection` service.
 * @param req - the incoming request.
 * @param res - the response to answer on when the request is rejected.
 * @returns true when the request was already rejected and answered.
 */
function rejected(ctx, req, res) {
  let rejection
  try {
    rejection = ctx.get('connection')?.requestRejection?.(req)
  } catch {
    rejection = undefined
  }
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.end()
  return true
}

/**
 * Register the /model-usage/* exact Web routes: the usage query for one
 * conversation model, the read-only provider directory, and the routable model
 * catalog behind the manual picker.
 * @param ctx - host context with webServer, credentials, and the session/LLM
 *   services read through `ctx.get()`.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/model-usage/balance',
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      const controller = new AbortController()
      res.once('close', () => controller.abort())
      try {
        const payload = req.method === 'POST'
          ? JSON.parse((await readBody(req)) || '{}')
          : {}
        writeJson(res, 200, await queryUsage(ctx, controller.signal, payload))
      } catch (err) {
        writeJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: `查询失败：${err instanceof Error ? err.message : String(err)}`, details: {} },
        })
      }
    },
  }), 'model-usage: /model-usage/balance')
  // Read-only provider/key directory (never a key value), for the 说明 dialog.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/model-usage/providers',
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      try {
        writeJson(res, 200, { ok: true, value: await providerRows(ctx) })
      } catch (err) {
        writeJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: err instanceof Error ? err.message : String(err), details: {} },
        })
      }
    },
  }), 'model-usage: /model-usage/providers')
  // Routable models (with the usage API each route resolves) for the manual picker.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/model-usage/models',
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      try {
        writeJson(res, 200, { ok: true, value: await modelCatalogRows(ctx) })
      } catch (err) {
        writeJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: err instanceof Error ? err.message : String(err), details: {} },
        })
      }
    },
  }), 'model-usage: /model-usage/models')
}
