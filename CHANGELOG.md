# Changelog
## 0.8.1
public

## 0.8.0

First release prepared for npm (`dsh plugin --profile <profile> add dsh-model-usage`).

- Host half: only `webServer` is a hard dependency. `connection` (browser trust fence),
  `credentials` (key lookup), `llm` / `settings` / `sessions` / `sessionProjections` /
  `sessionController` / `agentDefaultModel` / `deepseekAccount` are read through `ctx.get()` per use,
  so the plugin mounts in more compositions and picks up a service that activates later.
- Browser half: `locale` is read through `ctx.get()` too; without it the panel falls back to the
  Chinese source copy instead of not rendering.
- Publish metadata and docs: `engines.dsh` / `engines.node`, repository, homepage, bugs, keywords,
  a bilingual README, and `scripts/check.mjs` wired to `prepublishOnly`.
- `private` removed so the package can be published.

## 0.7.0

- The browser half no longer imports any Harness Client package: the button and the four dialogs are
  this plugin's own controls, styled only with the theme tokens the running build lists.
- All interface copy moved into the Client locale service (namespace `dsh-model-usage`, zh + en);
  the panel follows the interface language live.
- The stylesheet renders as part of the cell (no orphan `<style>` in `document.head`).
- Host routes apply the composition's browser trust fence and answer 401/403 themselves; the browser
  half addresses them with document-relative URLs.
- Display metadata: `locale/zh.json`, `locale/en.json`, `icon.svg`, plus `dsh.manifestVersion: 1`
  and `engines.dsh`.
- `modelSelection` is read through its wire view (`{ lastUsed, next }`).

## 0.6.0

- Usage for the current conversation's model, manual target override, background auto-refresh,
  read-only provider directory.
