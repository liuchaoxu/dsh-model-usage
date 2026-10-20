#!/usr/bin/env node
/**
 * Publish-time check for dsh-model-usage. Run by `npm run check` and by
 * `prepublishOnly`, so a tarball that would break a user's install cannot be
 * published. It checks the package manifest, the shipped files, the browser
 * half's module requests and copy, and the host half's imports.
 *
 * No dependencies: plain Node ESM, run with the Node that publishes the package.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const notes = []

const fail = (message) => { problems.push(message) }
const read = (relative) => readFileSync(join(root, relative), 'utf8')
const exists = (relative) => existsSync(join(root, relative))

/** Module ids the frozen platform table answers, so a bundle may require them. */
const BASELINE_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
])

const manifest = JSON.parse(read('package.json'))
const name = manifest.name
const dsh = manifest.dsh ?? {}

// --- manifest ---------------------------------------------------------------
if (typeof name !== 'string' || name === '' || name.includes(' ')) fail('package.json: name must be a non-empty npm name')
if (manifest.private === true) fail('package.json: "private": true blocks npm publish')
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(manifest.version))) fail(`package.json: version "${manifest.version}" is not a release semver`)
if (manifest.license !== 'MIT') fail('package.json: license should stay MIT (the harness itself is MIT)')
if (typeof manifest.description !== 'string' || manifest.description.length < 40 || manifest.description.length > 250) {
  fail('package.json: description should be 40-250 characters (npm search renders it on one line)')
}
if (dsh.manifestVersion !== 1) fail('package.json: dsh.manifestVersion must be 1')
if (typeof dsh.bundle?.patch !== 'string') fail('package.json: dsh.bundle.patch is what makes this an installable bundle')
if (dsh.client?.platform !== 'web') fail('package.json: dsh.client.platform must be "web"')
if (typeof manifest.engines?.dsh !== 'string' || !manifest.engines.dsh.startsWith('>=')) fail('package.json: engines.dsh should be a ">=" range of the harness versions the plugin was verified against')

// npm search ranks on name, description and keywords; the registry page links
// to repository, homepage and bugs. Keep those fields strict so the package is
// indexable and every registry link resolves.
if (!/^[a-z0-9][a-z0-9._-]*$/.test(name) || name.length > 214) {
  fail('package.json: name must be a lowercase npm name of at most 214 characters')
}
if (!Array.isArray(manifest.keywords) || manifest.keywords.length < 5) {
  fail('package.json: keywords need at least five entries (npm search indexes them)')
} else {
  const seen = new Set()
  for (const keyword of manifest.keywords) {
    if (typeof keyword !== 'string' || keyword === '' || keyword !== keyword.trim()) {
      fail(`package.json: keyword ${JSON.stringify(keyword)} must be a non-empty string without surrounding spaces`)
      continue
    }
    if (keyword !== keyword.toLowerCase()) fail(`package.json: keyword "${keyword}" must be lowercase`)
    if (keyword.length > 32) fail(`package.json: keyword "${keyword}" is longer than 32 characters`)
    if (seen.has(keyword)) fail(`package.json: duplicate keyword "${keyword}"`)
    seen.add(keyword)
  }
}
if (typeof manifest.repository?.url !== 'string' || !manifest.repository.url.startsWith('git+https://')) {
  fail('package.json: repository.url should be a git+https URL (the registry page links to it)')
}
if (typeof manifest.homepage !== 'string' || !/^https:\/\//.test(manifest.homepage)) {
  fail('package.json: homepage should be an https URL')
}
if (typeof manifest.bugs?.url !== 'string' || !/^https:\/\//.test(manifest.bugs.url)) {
  fail('package.json: bugs.url should be an https URL')
}
if (manifest.publishConfig?.access !== 'public') {
  fail('package.json: publishConfig.access should be "public"')
}
if (typeof manifest.scripts?.test !== 'string') {
  fail('package.json: add an npm test script (CI runs it by default)')
}

const requiredExports = ['.', './client', './cordis.patch.yml', './locale/*.json', './icon']
for (const key of requiredExports) {
  if (typeof manifest.exports?.[key] !== 'string') fail(`package.json: exports["${key}"] is required (locale and icon are read from exports)`)
}

// --- shipped files ----------------------------------------------------------
const shipped = [
  'lib/index.js',
  'lib/client.js',
  'cordis.patch.yml',
  'locale/zh.json',
  'locale/en.json',
  'icon.svg',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
]
for (const file of shipped) {
  if (!exists(file)) fail(`missing shipped file: ${file}`)
}

const patterns = manifest.files ?? []
// npm's files[] entries are globs relative to the package root: `*` stays within
// one directory, `**` spans directories, and an entry ending in `/` includes the
// whole directory. A pattern that matches too broadly would silently ship (or
// hide) files, so the matching here mirrors those rules instead of comparing
// prefix/suffix.
const covered = (file) => patterns.some((pattern) => {
  if (pattern === file) return true
  if (pattern.endsWith('/')) return file.startsWith(pattern)
  const escaped = pattern
    .split('**')
    .map((part) => part
      .split('*')
      .map((chunk) => chunk.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*'))
    .join('.*')
  return new RegExp(`^${escaped}$`).test(file)
})
for (const file of shipped) {
  if (!covered(file)) fail(`files[] does not cover ${file}`)
}

// --- README screenshots -----------------------------------------------------
// Screenshots are referenced with repository-relative paths (GitHub renders
// them as-is; npm resolves them against the repository) and shipped in
// files[] so a checkout and the package page show the same image. A missing
// or unshipped image is a broken README, so catch it here.
if (exists('README.md')) {
  const readme = read('README.md')
  const images = [...readme.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map((match) => ({ alt: match[1].trim(), src: match[2] }))
  const seen = new Set()
  for (const { alt, src } of images) {
    if (alt === '') fail(`README.md: image "${src}" needs alt text`)
    if (seen.has(src)) continue
    seen.add(src)
    if (/^(?:[a-z]+:)?\/\//i.test(src)) continue
    if (!exists(src)) {
      fail(`README.md: image "${src}" does not exist`)
      continue
    }
    if (!covered(src)) fail(`README.md: image "${src}" is not shipped (add it to files[])`)
    const bytes = statSync(join(root, src)).size
    if (bytes > 2 * 1024 * 1024) fail(`README.md: image "${src}" is ${bytes} bytes (keep screenshots under 2 MiB)`)
    notes.push(`readme image: ${src} (${bytes} bytes)`)
  }
}

// --- patch row --------------------------------------------------------------
if (exists('cordis.patch.yml')) {
  const patch = read('cordis.patch.yml')
  if (!/insert:/.test(patch)) fail('cordis.patch.yml: bundle patch must insert the plugin row')
  if (!patch.includes(`name: '${name}'`) && !patch.includes(`name: "${name}"`)) {
    fail(`cordis.patch.yml: the inserted row must name this package (${name})`)
  }
}

// --- locale metadata --------------------------------------------------------
for (const locale of ['locale/zh.json', 'locale/en.json']) {
  if (!exists(locale)) continue
  let meta
  try {
    meta = JSON.parse(read(locale)).meta
  } catch (error) {
    fail(`${locale}: not valid JSON (${error.message})`)
    continue
  }
  if (typeof meta?.title !== 'string' || meta.title === '') fail(`${locale}: meta.title is required (plugin list title)`)
  if (typeof meta?.description !== 'string' || meta.description === '') fail(`${locale}: meta.description is required (bundle description)`)
}

// --- icon -------------------------------------------------------------------
if (exists('icon.svg')) {
  const bytes = statSync(join(root, 'icon.svg')).size
  if (bytes > 256 * 1024) fail(`icon.svg: ${bytes} bytes exceeds the 256 KiB icon limit`)
  const head = read('icon.svg').trimStart()
  if (!head.startsWith('<svg') && !head.startsWith('<?xml')) fail('icon.svg: not an SVG document')
  notes.push(`icon.svg: ${bytes} bytes`)
}

// --- dictionaries and client half ------------------------------------------
if (exists('lib/client.js')) {
  const client = read('lib/client.js')

  const loadId = client.match(/__ModuleLoader__\.load\(\{[\s\S]{0,200}?id:\s*"([^"]+)"/)?.[1]
  if (loadId !== name) fail(`lib/client.js: loader id "${loadId}" must equal the package name "${name}" (client-modules keys the bundle by it)`)

  const requires = [...client.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1])
  for (const id of new Set(requires)) {
    if (!BASELINE_MODULES.has(id)) {
      fail(`lib/client.js: require("${id}") is not a platform baseline module; bundle it or declare it in dsh.client.external`)
    }
  }
  for (const forbidden of ['document.head', 'document.body', 'document.write']) {
    if (client.includes(forbidden)) fail(`lib/client.js: writes DOM outside its component (${forbidden}); render styles/portals from inside the cell`)
  }

  const dictOf = (variable) => {
    const start = client.indexOf(`const ${variable} = {`)
    if (start < 0) return undefined
    const end = client.indexOf('\n    };', start)
    if (end < 0) return undefined
    return new Set([...client.slice(start, end).matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]))
  }
  const zh = dictOf('zh')
  const en = dictOf('en')
  if (zh === undefined || en === undefined) {
    fail('lib/client.js: both dictionaries (zh, en) must be plain object literals')
  } else {
    const used = new Set([...client.matchAll(/(?:\bt|fill\(\s*t)\(\s*"([^"]+)"/g)].map((match) => match[1]))
    // `kind.<id>` is looked up dynamically from the host's adapter id.
    for (const key of zh) if (key.startsWith('kind.')) used.add(key)
    for (const key of used) {
      if (!zh.has(key)) fail(`lib/client.js: t("${key}") is missing from the zh dictionary`)
      if (!en.has(key)) fail(`lib/client.js: t("${key}") is missing from the en dictionary`)
    }
    for (const key of zh) if (!en.has(key)) fail(`lib/client.js: key "${key}" has no English translation`)
    for (const key of en) if (!zh.has(key)) fail(`lib/client.js: key "${key}" has no Chinese source text`)
    for (const key of zh) if (!used.has(key)) fail(`lib/client.js: dictionary key "${key}" is never used`)
    notes.push(`copy: ${zh.size} keys, zh/en symmetric`)
  }
}

// --- host half --------------------------------------------------------------
if (exists('lib/index.js')) {
  const host = read('lib/index.js')
  const imports = [...host.matchAll(/^\s*import[^'"]*from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1])
  for (const id of imports) {
    if (!id.startsWith('node:')) {
      fail(`lib/index.js: imports "${id}"; the host half must resolve with node builtins and injected services only (no node_modules)`)
    }
  }
  if (!/export const inject\s*=/.test(host)) fail('lib/index.js: export the inject list so the loader orders activation')
  if (!/export function apply\(/.test(host)) fail('lib/index.js: export function apply(ctx) is the host entry the loader calls')
  if (!host.includes("ctx.effect(() => ctx.webServer.register(")) fail('lib/index.js: web routes must be registered as effects')
  notes.push(`host: ${imports.length} builtin import(s), routes registered as effects`)
}

// --- report -----------------------------------------------------------------
if (problems.length > 0) {
  console.error(`dsh-model-usage ${manifest.version}: ${problems.length} problem(s)\n`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(`dsh-model-usage ${manifest.version}: publish check passed`)
for (const note of notes) console.log(`  · ${note}`)
