# dsh-model-usage（用量）

## English

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. It adds a **用量 / Usage**
entry to the right end of the session header (`conversation.session.header.utilities`) showing the
provider-account usage behind the model the current conversation runs on — read with that provider's
own credential reference, never with another provider's key.

- **Follows the conversation**: the model comes from the session's `modelSelection` projection, the
  key from that provider's own credential reference, the numbers from that provider's usage API.
- **Manual target**: pick any routable provider model in the panel without changing what the
  conversation runs on.
- **Warm in the background**: refreshes on an interval while the panel is closed.
- **Read-only directory**: lists the deployment's provider routes, their usage API kind, credential
  reference name, and whether that reference is configured — never a value.

Adapters: Command Code, DeepSeek (official balance and signed-in account wallet), OpenCode Go,
OpenRouter, Moonshot / Kimi, SiliconFlow, and the cc-switch New API convention for other
OpenAI-compatible routes. Everything else reports "usage query not supported" instead of guessing.

### Install

```sh
# npm (this package is published as a Harness bundle)
dsh plugin --profile <profile> add dsh-model-usage
```

Or, from a harness agent session, ask the plugin manager to install the bundle by name
(`install_bundle` with target `dsh-model-usage`). Either path installs the package into the profile,
mounts its `cordis.patch.yml` row, and enables the bundle (installation enables a new bundle by
default). With the profile's HMR enabled the change applies immediately; otherwise restart the host,
and hard-refresh the page for the browser half (it is served by `dsh-client-modules`).

Requirements: Harness `>=0.2.1-rc.2` (declared as `engines.dsh`) and its Web surface. No build step,
no runtime dependencies: the host half is Node builtins only, the browser half requires nothing but
the frozen `react` module. Nothing is uploaded anywhere; the host process calls the provider API with
the key it already holds and returns only normalized numbers plus the credential *reference name*.

License: MIT. This is an independent community plugin, not affiliated with or endorsed by DeepSeek.

## 中文

在会话页面头部最右侧的 utilities 区（`conversation.session.header.utilities`）加一个「用量」入口；
点开弹窗即可查看**当前对话所用模型**对应供应商账户的用量，也可以在面板里**手动切换**到别的
供应商模型查询。

插件做四件事：

- **跟随对话查询**：模型取自会话的 `modelSelection` 投影（与模型选择器同一份事实），
  密钥取自该供应商自己的凭据引用，用量来自该供应商的用量接口。
- **支持手动切换查询对象**：可查任意可路由的供应商模型，且不改变当前对话使用的模型。
- **后台自动刷新**：按间隔在后台保持数字新鲜，弹窗关着也照常刷新。
- **只读说明目录**：列出本部署声明的供应商路由、各自的用量接口类型、密钥引用名与是否已配置（永不返回值）。

## 原理

- **node 半**（`lib/index.js`）：通过 `ctx.webServer.register()` 注册 loopback Web 路由：
  - `POST /model-usage/balance`：按给定（或当前对话）的模型查询用量；
  - `GET /model-usage/providers`：只读列出本部署声明的供应商路由与密钥是否就绪；
  - `GET /model-usage/models`：可路由模型目录 + 每个供应商对应的用量接口类型（手动切换用）。
  三条路由都会先向 `connection` 服务要一次浏览器信任裁决（Host/Origin 栅栏），被拒即 401/403；
  密钥只在本机 host 进程内使用，浏览器只拿到归一化数据 + 凭据**引用名**（永不返回值）。
- **浏览器半**（`lib/client.js`）：注册 `conversation.session.header.utilities` slot，
  从会话的 `modelSelection` 投影读出当前模型（线格式 `{ lastUsed, next }`，`next` 已经含了
  尚未使用的这次选择），随请求发给 host；在后台按间隔刷新用量（弹窗关闭也生效），
  点开弹窗展示状态与用量。控件（按钮 / 弹窗）是本插件自写的，样式与文案分别来自主题 token
  与 Client locale 服务。

### 模型与密钥是怎么确定的

1. 浏览器读会话投影 `modelSelection` 的 `next ?? lastUsed`（与模型选择器同一份事实），
   POST `{ provider, model, reasoningEffort, sessionId }` 给 host。
   payload 里没有 provider/model 时，host 依次回退到「本进程的会话投影」→「部署默认模型」
   （`agentDefaultModel.currentSelection()`）。
2. host 用 `llm.listConfigurableProviders()` 找到该 provider 的配置地址
   （`settingsNs` + `settingsPath`），再用 `settings.describe()` 读实时配置，得到
   `apiKeyEnv`（凭据引用）、`baseURL`、`api`、自定义 headers。
3. 用 `ctx.credentials.resolve(apiKeyEnv)` 取到**当前对话正在用的那把 key**：
   该引用没配置时回退到同名环境变量；Command Code 再回退 `~/.commandcode/auth.json`。
   解析是逐次调用进行的，在 设置 → 模型 里新填的 key 下一次查询即可用，不需要重启。
4. 按 provider / baseURL 选择对应的用量接口（见下表）。

provider 没声明 `apiKeyEnv` 时按约定推导引用名 `${PROVIDER}_API_KEY`
（如 `commandcode` → `COMMANDCODE_API_KEY`，与 设置 → 模型 里存 key 的名字一致）；
`deepseek-official` 固定用 `DEEPSEEK_API_KEY`。

### 手动切换查询对象

面板顶部有一行「查询对象」，显示这次查询用的是谁：

- 默认 `自动 · 供应商 / 模型`，跟随当前对话的模型选择（对话里换模型，插件跟着换）。
- 点它打开「选择模型」：可选 `自动（跟随当前对话）`，或**任意可路由的供应商模型**
  （来自 `sessionController.modelCatalog()`，每条路由标注它对应的用量接口类型；不支持的会写明
  `不支持用量查询`）。
- 选中后只改变**插件查询的对象**，不会切换当前对话使用的模型；密钥也随之变成那个供应商自己的
  凭据引用。选择存在浏览器 localStorage（`dsh-model-usage:model`），弹窗里「改回自动」可恢复。
- 注意：用量是**账户级**的，同一把 key 下的模型共享同一份额度，所以切换模型实际是在切换
  「用哪个供应商的 key 去查哪份额度」；卡片下方「模型 / 密钥」两行会如实显示这次用的是谁。

### 用量接口

| provider / baseURL | 用量来源 |
| --- | --- |
| `commandcode`（或 baseURL 落在 `*.commandcode.ai`） | Command Code 私有 API：`GET /alpha/whoami?limits=1`、`/alpha/billing/credits`、`/alpha/billing/subscriptions`、`/alpha/usage/summary?since=`，即官方 CLI `/usage` 的同一组端点；显示套餐、5 小时 / 7 天窗口用量条、信用余额、请求数 |
| `deepseek-official`、`deepseek`（或 baseURL 落在 `*.deepseek.com`） | `GET https://api.deepseek.com/user/balance`，按币种显示余额 |
| `deepseek-account` | `ctx.deepseekAccount.getBalance()`：读已登录 DeepSeek 账户的钱包余额（不涉及 API Key） |
| `opencode-go`（或 baseURL 落在 `opencode.ai/zen/go`） | `GET {origin}/zen/go/v1/usage`（OpenCode Go / Go Plus 订阅额度：5 小时 / 周 / 月，按模型各自的月额度计）。**该端点未公开文档化**，字段按常见写法归一化，识别不了的会原样显示在「原始返回」里 |
| `openrouter`（或 baseURL 落在 `*.openrouter.ai`） | `GET /api/v1/key`（已用 / 额度 / 剩余）；key 没有独立额度时再查 `GET /api/v1/credits` 补充账户总额度与已用 |
| `moonshotai`、`moonshotai-cn`、`kimi-coding`（或 baseURL 落在 `*.moonshot.cn` / `*.moonshot.ai`） | `GET /v1/users/me/balance`（可用余额 / 现金余额 / 代金券） |
| `siliconflow`（或 baseURL 落在 `*.siliconflow.cn` / `*.siliconflow.com`） | `GET /v1/user/info`（总余额 / 充值余额 / 赠送余额） |
| 其它已配置 `baseURL` 的 OpenAI 兼容路由 | 尽力而为：按 cc-switch 的 New API 约定查 `GET {origin}/api/user/self`（`Authorization: Bearer <key>`、`User-Agent: cc-switch/1.0`），按 `quota / 500000` 归一化为 USD |

**OpenCode Zen（按量付费余额）没有用量接口**：`/zen/v1/usage`、`/me`、`/credits` 全是 404，官方只能在 console 网页看，
所以 `opencode`（baseURL `https://opencode.ai/zen`）在面板里会显示「不支持用量查询」——同一个域名下的 `/zen/go` 才走 Go 适配器。

既没有 `baseURL`、也不是已知供应商的路由会明确报错（“无法查询用量”），不会去猜接口。

新增一个适配器大约 20 行：在 `kindOf()` 里按 host / provider 认领，写一个 `queryXxx()` 归一到 `{ rows }` 或 `{ windows, models }`，
客户端会自动用通用卡片渲染（`rows` 出标签值行，`windows` 出用量条，`raw` 收在「原始返回」按钮里）。

### 刷新与状态

刷新是后台行为，不是点击行为：这个 cell 随会话视图挂载，所以它在**挂载时、切换模型时**各查询一次，
之后只要「自动刷新」是开着的就按间隔在后台自己刷新 —— 弹窗关着也照样刷新，打开时直接就是最近一次的结果。

- **状态行**（弹窗顶部）显示本次刷新的新鲜度：`刷新时间：刚刚` / `刷新时间：12 分钟前`，
  查询进行中显示 `刷新中… · 当前显示 3 分钟前数据`，从未查询过显示 `尚未刷新`；
  数据超过刷新间隔时会在状态行补一句提示。
- **自动刷新开关**：状态行右侧的 `自动刷新：开/关` chip，点一下即切换（设置弹窗里也有「开启/关闭」）。
  关闭后不再有后台定时刷新，打开弹窗且数据过期时才查询。
- **刷新间隔**：`刷新设置` 里可选 1 / 5 / 15 / 30 / 60 分钟，也可以直接填 1–1440 之间的分钟数；
  默认开启自动刷新、间隔 5 分钟。策略存在浏览器 localStorage（`dsh-model-usage:refresh`）。
- **上次刷新超过间隔时**：打开弹窗不会清空内容 —— 先显示上次查询到的用量，并标记 `刷新中…`，
  用量接口返回后再替换内容，状态变为 `刷新时间：刚刚`。
- 数据在间隔内时打开弹窗**不会**发请求（直接用缓存），要强制刷新就点卡片里的「刷新」。
- 刷新失败（例如接口 5xx / 网络不通）时保留上次数据，并在卡片下方追加 `上次刷新失败：…`；
  从未成功过才显示整屏错误 + 「重试」。标题按钮在后台刷新时带一个呼吸小圆点，
  鼠标悬停显示刷新策略。
- host 侧每次用量接口调用有 30 秒超时，浏览器侧另有一道 45 秒的外层兜底，
  避免一次卡住的请求把后续自动刷新一直挡在门外。

### 弹窗内容

- 顶部状态行 + 自动刷新 chip + `刷新设置`。
- 卡片：按上面的接口类型渲染（窗口用量条 / 余额 / 钱包）。
- 卡片下方「模型 · 密钥 · 用量页」：本次查询用的 provider/model（含推理档位）与**凭据引用名 + 来源**
  （例如 `COMMANDCODE_API_KEY · 凭据 COMMANDCODE_API_KEY（store）`），确认用的是当前对话那把 key。
- 底部「说明」：列出本部署声明的供应商路由 —— 用量接口类型、密钥引用名、是否已配置、接口地址。
  默认只列出**有用量接口或已配置密钥**的路由（有些部署自带的目录有数十个路由），
  其余收在「显示其余 N 个未配置路由」按钮后面；每个弹窗都自带上限高度 + 内部滚动
  （Modal 原语把高度留给调用方，不设上限时内容会顶出屏幕）。

### 与当前 Harness 的适配

- manifest：`dsh.bundle.patch`、`dsh.client`（`platform: web`）、`dsh.manifestVersion: 1`，
  以及 `engines.dsh: ">=0.2.1-rc.2"`（本插件逐项核对过的版本，只挡更旧的宿主）。
- 展示元数据：`locale/zh.json` + `locale/en.json`（`meta.title` / `meta.description`）与
  `icon.svg` 都已从 `exports` / `files` 导出，插件列表与 bundle 详情直接读取。
- 浏览器半只 require `react`（loader 的冻结模块表），不 require 任何 Harness Client 包；
  数据面走本插件自己的 `webServer` 路由 + 同源 `fetch`（官方浏览器插件同款做法）。
- host 半只用 Node 原生模块（`node:fs` / `node:os`）；只有 `webServer` 是硬依赖，
  `connection`（信任栅栏）、`credentials`（取键）、`llm` / `settings` / `sessions` /
  `sessionProjections` / `sessionController` / `agentDefaultModel` / `deepseekAccount`
  都在每次使用时通过 `ctx.get()` 读取 —— 少挂服务时插件照常挂载并在面板里说明缺什么，
  后激活的服务下一次查询就能用上。
- 浏览器半只有 `slots` 是硬依赖，`locale` 同样按需读取：没有 locale 服务时面板降级显示中文原文，
  而不是整格消失。

## 安装

包已发布为 npm bundle，安装入口是"把 bundle 装进 profile"：

```sh
# CLI（推荐）
dsh plugin --profile <profile> add dsh-model-usage
```

或者在 harness 的 agent 会话里让插件管理器装：`install_bundle`，target 传 `dsh-model-usage`
（本机开发时传本目录的绝对路径）。两条路都会把包装进 profile、把 `dsh.bundle.patch` 指向的
row（id `model-usage`）挂进 patch 层并激活——**不要**手写 profile 的 `cordis.patch.yml`，
也不要往 `$DSH_HOME/profiles/<profile>/node_modules` 手工复制。

安装后：

- host 半改动/升级包后需要重启宿主（`dsh web` 或桌面版）；
- 浏览器半（`lib/client.js`）改动后硬刷新页面即可（开发时 `pnpm run dev:web` 会推送重建）。

## 发布（维护者）

```sh
npm run verify    # check + smoke；prepublishOnly 会自动跑同一组检查
npm publish       # 公开包，无需 --access
```

`scripts/check.mjs` 会在发布前拦住会导致"装完不可用"的问题：缺 `dsh.bundle.patch`、
`private: true`、exports/files 漏掉 locale 或图标、`lib/client.js` 的 loader id 与包名不一致、
require 了非基线模块、往 `document.head`/`document.body` 写东西、字典缺键或中英不对称、
host 半 import 了 node_modules 依赖、路由没用 `ctx.effect` 注册等。
`scripts/smoke.mjs` 则在纯 Node 里把 host 半挂到桩 ctx 上跑一遍：三条路由的 kind/path、
无会话服务时的错误信封、以及信任栅栏的 403。两个脚本都不随包发布。

版本约定：面向用户的可见行为变化 → minor；修 bug → patch。`engines.dsh` 只挡比"已核对版本"更旧的宿主。

## 说明

- 浏览器半**只从 loader 的模块表取 `react`**，不 require 任何 Harness Client 包：
  面板里的按钮与弹窗是本插件自己的控件，只用当前主题列出的 `--dsw-alias-*` token 上色
  （唯一例外是弹窗遮罩，主题没有对应的 scrim token）。
- 浏览器半的文案全部走 Client locale 服务（`ctx.locale`，命名空间 `dsh-model-usage`，
  中英双语），跟随界面语言切换；host 返回的**接口诊断信息**（供应商报错原文）按原样显示。
- 样式表随 cell 渲染（`<style>` 是 cell 输出的一部分），slot 条目卸载时一起消失，
  不往 `document.head` 之外留东西。
- 三条 host 路由在应答前都会先问 composition 的 connection 服务要一次浏览器信任裁决
  （本机 Host/Origin 栅栏），与官方浏览器插件同款；被拒时直接回 401/403。
- 浏览器半用**文档相对路径**（`model-usage/...`）访问这三条路由，因此 GUI 挂在子目录下也能用。
- 用量只能查到**供应商账户级**的数据（余额 / 套餐窗口 / 请求数）；同一把 key 下的模型共享这些额度。
- Command Code 模式的数字与官方 CLI 的 `/usage` 一致（同一组私有端点）。
- 密钥只在本机 host 进程内使用，不写入日志、不返回给浏览器。
- 本插件以 [MIT 许可](LICENSE)发布；DeepSeek Harness 本身同为 MIT，二者许可一致、可双向复用代码。
  本项目是独立社区插件，与深度求索公司无隶属或背书关系。
- 浏览器半是**手写的闭包工厂 bundle**，改动后硬刷新浏览器生效；host 半改动需重启 `dsh web`。
