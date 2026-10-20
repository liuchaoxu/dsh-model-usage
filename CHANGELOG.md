# Changelog

All notable changes to this package are documented in this file. Versions follow Semantic Versioning.

## 0.8.2

- Documentation: README restructured for the npm package page and the repository; usage panel
  screenshot added under `docs/screenshots/` and shipped with the package.
- Package metadata: shorter description, expanded keyword set for npm search, `npm test` alias,
  normalized JSON layout.
- `scripts/check.mjs` validates npm metadata, README image references and `files[]` glob semantics.

## 0.8.1

- Published with `publishConfig.access` set for public access.

## 0.8.0

Published to npm as `dsh-model-usage`.

- Host half: `webServer` is the only hard dependency. `connection`, `credentials`, `llm`, `settings`,
  `sessions`, `sessionProjections`, `sessionController`, `agentDefaultModel` and `deepseekAccount`
  are resolved per call through `ctx.get()`.
- Browser half: locale is resolved lazily; without a locale service the panel renders the Chinese
  source copy.
- Publish metadata: `engines`, `repository`, `homepage`, `bugs`, `keywords`; `prepublishOnly` runs the
  verification scripts.

## 0.7.0

- The browser half no longer imports Harness Client packages; the button and dialogs use the plugin's
  own controls and the theme tokens exposed by the running build.
- Interface copy moved to the Client locale service (namespace `dsh-model-usage`, Chinese and
  English), following the interface language.
- Styles render as part of the cell rather than `document.head`.
- Host routes apply the browser trust fence and answer 401/403; the browser addresses them with
  document-relative URLs.
- Display metadata: `locale/zh.json`, `locale/en.json`, `icon.svg`, `dsh.manifestVersion: 1` and
  `engines.dsh`.
- `modelSelection` is read through its wire view (`{ lastUsed, next }`).

## 0.6.0

- Usage query for the current conversation's model, manual target override, background auto-refresh
  and a read-only provider directory.
