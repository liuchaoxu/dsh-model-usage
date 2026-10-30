// Browser half of dsh-model-usage — a hand-built client bundle in the
// closure-factory format client-modules expects. It registers one entry into
// the session header's right-aligned utilities slot ('用量') and renders a
// modal with the usage of the model THIS CONVERSATION is running on: the model
// comes from the Session's `modelSelection` projection (the same fact the model
// picker shows; the wire view is `{ lastUsed, next }`), the key comes from that
// provider's own credential reference on the host, and the numbers come from
// the matching usage API. The host resolves and holds every secret; this half
// only ever sees the normalized payload plus the credential REFERENCE NAME.
//
// Everything shared with the host is carried by ids and tokens only:
// - React comes from the loader's module table, and nothing else is imported:
//   the controls below are this plugin's own, styled exclusively with the
//   theme tokens the running build lists.
// - Copy lives in the Client locale service (`ctx.locale`), so the panel
//   follows the active language and switches live.
// - The stylesheet renders as a React element inside the cell, so it appears
//   and disappears with this slot entry instead of leaking a <style> tag.
//
// Refreshing is a background concern, not a click handler: this cell mounts
// with the session view, so it queries once on mount (and on every model
// switch) and then keeps the numbers warm on its own timer while 自动刷新 is on.
// Interval and toggle live in localStorage (`dsh-model-usage:refresh`).
window.__ModuleLoader__.load({
  id: "dsh-model-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    /** Locale namespace every user-visible string of this plugin belongs to. */
    const NS = "dsh-model-usage";
    // Host routes are document-relative (like every shipped client plugin's own
    // routes) so the panel also works when the GUI is served under a directory
    // mount instead of the site root.
    const ROUTE_BALANCE = "model-usage/balance";
    const ROUTE_PROVIDERS = "model-usage/providers";
    const ROUTE_MODELS = "model-usage/models";

    // -----------------------------------------------------------------------
    // Copy. Keys are shared by both dictionaries; `t` reads the active locale
    // at call time and the slot system re-renders this cell on a switch.
    // Provider errors and endpoint field names stay as the host reports them —
    // they are data about a third-party service, not interface copy.
    const zh = {
      "button.label": "用量",
      "button.titleAuto": "用量（每 {interval}自动刷新）",
      "button.titleManual": "用量（自动刷新已关闭）",
      "action.refresh": "刷新",
      "action.retry": "重试",
      "action.save": "保存",
      "action.close": "关闭",
      "action.cancel": "取消",
      "action.info": "说明",
      "action.auto": "改回自动",
      "age.now": "刚刚",
      "age.minutes": "{count} 分钟前",
      "age.hours": "{count} 小时前",
      "age.days": "{count} 天前",
      "minutes.value": "{count} 分钟",
      "status.refreshing": "刷新中…",
      "status.refreshingAge": "刷新中… · 当前显示{age}数据",
      "status.never": "尚未刷新",
      "status.updated": "刷新时间：{age}",
      "status.stale": " · 已超过刷新间隔（{interval}）",
      "status.autoOn": "自动刷新：开",
      "status.autoOff": "自动刷新：关",
      "status.autoTooltipOn": "每 {interval}在后台刷新（关闭弹窗也生效）",
      "status.autoTooltipOff": "后台自动刷新已关闭，仅在打开弹窗且数据过期时查询",
      "status.settings": "刷新设置",
      "state.loading": "读取中…",
      "state.querying": "查询中…",
      "state.empty": "暂无数据",
      "error.lastRefresh": "上次刷新失败：{error}",
      "providers.none": "当前部署没有声明任何模型供应商",
      "providers.summary": "共 {total} 个供应商路由 · {configured} 个密钥已配置 · {supported} 个支持用量查询",
      "providers.keyConfigured": "密钥已配置",
      "providers.keyMissing": "密钥未配置",
      "providers.configuredUnsupported": "密钥已配置 · 不支持用量查询",
      "providers.collapse": "只看已配置 / 支持用量的",
      "providers.expand": "显示其余 {count} 个未配置路由",
      "modelbar.label": "查询对象",
      "modelbar.auto": "自动 · 跟随当前对话",
      "modelbar.autoRoute": "自动 · {route}",
      "modelbar.titleAuto": "当前跟随对话使用的模型，点击可手动切换",
      "modelbar.titleManual": "手动指定的模型，点击可切换或改回自动",
      "picker.title": "选择模型",
      "picker.auto": "自动（跟随当前对话）",
      "picker.default": "部署默认：{route}",
      "picker.empty": "当前没有可路由的模型（检查 设置 → 模型）",
      "picker.hint": "选一个供应商的模型来查询它的用量；这不改变当前对话使用的模型，只改变插件查询的对象。",
      "settings.title": "刷新设置",
      "settings.autoLabel": "后台自动刷新",
      "settings.on": "开启",
      "settings.off": "关闭",
      "settings.autoHint": "开启后，即使用量弹窗没打开，也会按下面的间隔在后台查询并更新；打开弹窗时直接显示最近一次结果。",
      "settings.interval": "刷新间隔",
      "settings.customHint": "也可以直接填写分钟数（1–1440）。",
      "settings.customInvalid": "请填写 1–1440 之间的分钟数。",
      "settings.staleHint": "上次刷新超过刷新间隔时，打开弹窗会先显示上次的用量并标记「刷新中…」，查询完成后自动更新为「刷新时间：刚刚」。",
      "info.title": "用量说明",
      "info.hint": "用量按「当前对话使用的模型」查询：模型来自会话的模型选择，密钥来自该供应商自己的凭据引用（设置 → 模型 里填写），不会使用其它供应商的 key。",
      "card.subscribed": "订阅中",
      "card.windowLimit": "窗口限制",
      "card.notApplicable": "不适用",
      "card.credits": "信用余额",
      "card.monthlyRemaining": "月度剩余",
      "card.spent": "已花费",
      "card.requests": "请求数",
      "card.account": "账户",
      "card.cycleEnd": "本期截止",
      "card.balance": "余额",
      "card.balanceEmpty": "接口未返回 balance_infos",
      "card.available": "账户可用",
      "card.unavailable": "账户不可用",
      "card.deepseekAccount": "DeepSeek 账户",
      "card.noWallet": "账户没有可用钱包",
      "card.windowFallback": "窗口",
      "card.raw": "原始返回",
      "card.hideRaw": "隐藏原始返回",
      "card.unrecognized": "接口返回的字段还没被识别，下面是原始返回（可以发给我做校准）",
      "history.title": "余额消耗趋势",
      "history.range.today": "今天",
      "history.range.yesterday": "昨天",
      "history.range.week": "近一周",
      "history.range.month": "近一月",
      "history.range.custom": "自定义",
      "history.start": "开始日期",
      "history.end": "结束日期",
      "history.apply": "应用时间段",
      "history.empty": "该时间段暂无足够的余额记录",
      "history.amount": "消耗",
      "history.clearMonth": "清除所选月份",
      "history.confirmClearMonth": "确定清除 {month} 的余额记录吗？",
      "history.reset": "重置当前记录",
      "history.month": "数据月份",
      "history.noMonths": "暂无可清理的月份",
      "history.confirmReset": "确定清除当前账户的全部余额记录吗？",
      "card.used": "已用",
      "card.total": "总额",
      "window.fiveHour": "5 小时窗口",
      "window.weekly": "7 天窗口",
      "window.usedReset": "已用 {percent}% · 重置还有 {duration}",
      "window.reset": "窗口已重置",
      "duration.reset": "已重置",
      "currency.CNY": "人民币（CNY）",
      "meta.model": "模型",
      "meta.credential": "密钥",
      "meta.accountLogin": "账户登录（无 API Key）",
      "meta.usageUrl": "用量页",
      "kind.commandcode": "Command Code 用量（窗口 / 信用）",
      "kind.deepseek": "DeepSeek 官方余额",
      "kind.deepseek-account": "DeepSeek 账户钱包余额",
      "kind.opencode-go": "OpenCode Go 订阅用量",
      "kind.openrouter": "OpenRouter 额度",
      "kind.moonshot": "Moonshot / Kimi 余额",
      "kind.siliconflow": "SiliconFlow 余额",
      "kind.newapi": "New API 兼容额度",
      "kind.none": "不支持用量查询",
      "state.noHost": "无法连接本机宿主路由：插件可能没有正确挂载（查看 设置 → 插件）",
    };

    const en = {
      "button.label": "Usage",
      "button.titleAuto": "Usage (refreshes every {interval})",
      "button.titleManual": "Usage (auto refresh off)",
      "action.refresh": "Refresh",
      "action.retry": "Retry",
      "action.save": "Save",
      "action.close": "Close",
      "action.cancel": "Cancel",
      "action.info": "About",
      "action.auto": "Follow the conversation",
      "age.now": "just now",
      "age.minutes": "{count} min ago",
      "age.hours": "{count} h ago",
      "age.days": "{count} d ago",
      "minutes.value": "{count} min",
      "status.refreshing": "Refreshing…",
      "status.refreshingAge": "Refreshing… · showing data from {age}",
      "status.never": "Not refreshed yet",
      "status.updated": "Updated {age}",
      "status.stale": " · older than the refresh interval ({interval})",
      "status.autoOn": "Auto refresh: on",
      "status.autoOff": "Auto refresh: off",
      "status.autoTooltipOn": "Refreshing in the background every {interval} (works with the panel closed)",
      "status.autoTooltipOff": "Background auto refresh is off; a query runs only when the panel opens with stale numbers",
      "status.settings": "Refresh settings",
      "state.loading": "Loading…",
      "state.querying": "Querying…",
      "state.empty": "No data yet",
      "error.lastRefresh": "Last refresh failed: {error}",
      "providers.none": "This deployment declares no model providers",
      "providers.summary": "{total} provider routes · {configured} with a configured key · {supported} support usage queries",
      "providers.keyConfigured": "Key configured",
      "providers.keyMissing": "Key not configured",
      "providers.configuredUnsupported": "Key configured · usage query not supported",
      "providers.collapse": "Show only configured / supported routes",
      "providers.expand": "Show the other {count} unconfigured routes",
      "modelbar.label": "Target",
      "modelbar.auto": "Auto · follows the conversation",
      "modelbar.autoRoute": "Auto · {route}",
      "modelbar.titleAuto": "Following the conversation's model; click to pick another target",
      "modelbar.titleManual": "A manually picked target; click to change it or go back to auto",
      "picker.title": "Choose a model",
      "picker.auto": "Auto (follow the conversation)",
      "picker.default": "Deployment default: {route}",
      "picker.empty": "No routable model right now (check Settings → Models)",
      "picker.hint": "Pick any provider's model to inspect its usage. This does not change the model this conversation runs on, only what the plugin queries.",
      "settings.title": "Refresh settings",
      "settings.autoLabel": "Background auto refresh",
      "settings.on": "On",
      "settings.off": "Off",
      "settings.autoHint": "While on, the panel keeps querying in the background at the interval below even when it is closed; opening it shows the most recent result right away.",
      "settings.interval": "Refresh interval",
      "settings.customHint": "You can also type a number of minutes (1–1440).",
      "settings.customInvalid": "Enter a number of minutes between 1 and 1440.",
      "settings.staleHint": "When the last refresh is older than the interval, opening the panel first shows the previous numbers marked as refreshing and replaces them once the query returns.",
      "info.title": "Usage details",
      "info.hint": "Usage is queried for the model this conversation runs on: the model comes from the session's model selection, and the key from that provider's own credential reference (set in Settings → Models). No other provider's key is used.",
      "card.subscribed": "Subscribed",
      "card.windowLimit": "Window limits",
      "card.notApplicable": "Not applicable",
      "card.credits": "Credit balance",
      "card.monthlyRemaining": "Monthly remaining",
      "card.spent": "Spent",
      "card.requests": "Requests",
      "card.account": "Account",
      "card.cycleEnd": "Cycle ends",
      "card.balance": "Balance",
      "card.balanceEmpty": "The endpoint returned no balance_infos",
      "card.available": "Account available",
      "card.unavailable": "Account unavailable",
      "card.deepseekAccount": "DeepSeek account",
      "card.noWallet": "No wallet on this account",
      "card.windowFallback": "Window",
      "card.raw": "Raw response",
      "card.hideRaw": "Hide raw response",
      "card.unrecognized": "These fields are not recognized yet — the raw response is below (send it over to calibrate)",
      "history.title": "Balance spend trend",
      "history.range.today": "Today",
      "history.range.yesterday": "Yesterday",
      "history.range.week": "Last 7 days",
      "history.range.month": "Last 30 days",
      "history.range.custom": "Custom",
      "history.start": "Start date",
      "history.end": "End date",
      "history.apply": "Apply range",
      "history.empty": "Not enough balance samples for this period",
      "history.amount": "Spent",
      "history.clearMonth": "Clear selected month",
      "history.confirmClearMonth": "Clear balance records for {month}?",
      "history.reset": "Reset current records",
      "history.month": "Data month",
      "history.noMonths": "No stored months to clear",
      "history.confirmReset": "Clear all balance records for this account?",
      "card.used": "Used",
      "card.total": "Total",
      "window.fiveHour": "5-hour window",
      "window.weekly": "7-day window",
      "window.usedReset": "{percent}% used · resets in {duration}",
      "window.reset": "Window reset",
      "duration.reset": "reset",
      "currency.CNY": "Chinese yuan (CNY)",
      "meta.model": "Model",
      "meta.credential": "Credential",
      "meta.accountLogin": "Account sign-in (no API key)",
      "meta.usageUrl": "Usage page",
      "kind.commandcode": "Command Code usage (windows / credits)",
      "kind.deepseek": "DeepSeek official balance",
      "kind.deepseek-account": "DeepSeek account wallet balance",
      "kind.opencode-go": "OpenCode Go subscription usage",
      "kind.openrouter": "OpenRouter credits",
      "kind.moonshot": "Moonshot / Kimi balance",
      "kind.siliconflow": "SiliconFlow balance",
      "kind.newapi": "New API compatible credits",
      "kind.none": "Usage query not supported",
      "state.noHost": "Cannot reach this machine's host routes: the plugin may not be mounted correctly (see Settings → Plugins)",
    };

    /**
     * Substitute `{name}` placeholders ourselves so the panel does not depend
     * on the translate function's parameter form: `t(key)` returns the active
     * language's template, and anything it cannot fill stays visible.
     */
    function fill(template, params) {
      return String(template).replace(/\{(\w+)\}/g, (match, name) => (
        params !== undefined && params[name] !== undefined ? String(params[name]) : match
      ));
    }

    /**
     * The localized name of one usage adapter. The host reports a machine
     * `kind`; a kind this plugin does not know yet falls back to the host's own
     * label instead of showing a dictionary key.
     */
    function kindLabel(t, kind, fallback) {
      if (kind === null || kind === undefined) return t("kind.none");
      const key = `kind.${kind}`;
      const text = t(key);
      return text === key ? String(fallback ?? kind) : text;
    }

    // -----------------------------------------------------------------------
    // Owned stylesheet. Rendered as part of the cell (see UsageAction) so the
    // slot system removes it with this entry; every color comes from a theme
    // token the running build lists, except the modal scrim, for which the
    // theme exposes no token.
    const STYLES = [
      "@keyframes dsh-usage-spin { to { transform: rotate(360deg); } }",
      "@keyframes dsh-usage-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }",
      ".dsh-usage-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 6px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; font-size: 13px; font-weight: 500; line-height: 20px; cursor: pointer; transition: background 140ms ease, border-color 140ms ease, transform 140ms ease; }",
      ".dsh-usage-btn:hover { background: var(--dsw-alias-bg-layer-2); }",
      ".dsh-usage-btn:active { transform: scale(0.98); }",
      ".dsh-usage-btn-busy::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); animation: dsh-usage-pulse 1.2s ease-in-out infinite; }",
      ".dsh-usage-action { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 0 13px; border: 1px solid transparent; border-radius: 9px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; font-size: 13px; font-weight: 500; line-height: 20px; cursor: pointer; transition: background 140ms ease, border-color 140ms ease, transform 140ms ease; }",
      ".dsh-usage-action:active { transform: scale(0.98); }",
      ".dsh-usage-action-primary { background: #0A84FF; border-color: #0A84FF; color: #FFFFFF; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }",
      ".dsh-usage-action-outline { background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-action-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-action-outline:hover, .dsh-usage-action-ghost:hover { background: var(--dsw-alias-bg-layer-2); }",
      ".dsh-usage-action-ghost:hover { color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-modal-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(8, 12, 18, 0.34); backdrop-filter: blur(12px) saturate(125%); -webkit-backdrop-filter: blur(12px) saturate(125%); }",
      ".dsh-usage-modal-dialog { display: flex; flex-direction: column; width: min(620px, 100%); max-height: 100%; border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.1); outline: none; overflow: hidden; }",
      ".dsh-usage-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px 13px; border-bottom: 1px solid var(--dsw-alias-border-l2); }",
      ".dsh-usage-modal-title { font-size: 15px; font-weight: 600; line-height: 22px; color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 1; cursor: pointer; transition: background 140ms ease; }",
      ".dsh-usage-modal-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-modal-content { padding: 14px 18px; overflow: hidden; }",
      ".dsh-usage-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px 16px; border-top: 1px solid var(--dsw-alias-border-l2); }",
      ".dsh-usage-state { padding: 12px 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-error { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 4px 0; }",
      ".dsh-usage-error-text { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
      ".dsh-usage-inline-error { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); word-break: break-all; }",
      ".dsh-usage-stack { display: flex; flex-direction: column; gap: 12px; }",
      ".dsh-usage-status-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }",
      ".dsh-usage-status { display: inline-flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-status-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".dsh-usage-status-actions { display: inline-flex; align-items: center; gap: 6px; }",
      ".dsh-usage-spinner { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l2); border-top-color: var(--dsw-alias-label-primary); animation: dsh-usage-spin 0.8s linear infinite; }",
      ".dsh-usage-chip { display: inline-flex; align-items: center; height: 28px; padding: 0 11px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; cursor: pointer; transition: background 140ms ease, border-color 140ms ease; }",
      ".dsh-usage-chip:hover { background: var(--dsw-alias-bg-layer-2); }",
      ".dsh-usage-chip-active { color: #FFFFFF; border-color: #0A84FF; background: #0A84FF; }",
      ".dsh-usage-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 230px; }",
      ".dsh-usage-modelbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
      ".dsh-usage-modelbar-label { flex: 0 0 auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-balance-card { border: 1px solid var(--dsw-alias-border-l2); border-radius: 11px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--dsw-alias-bg-layer-1); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.035); }",
      ".dsh-usage-balance-card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 600; line-height: 22px; color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-balance-status { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-balance-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 25px; }",
      ".dsh-usage-balance-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-balance-value { font-size: 13px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-refresh { display: flex; justify-content: flex-end; }",
      ".dsh-usage-meta { border-top: 1px solid var(--dsw-alias-border-l2); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }",
      ".dsh-usage-meta-row { display: flex; gap: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-meta-key { flex: 0 0 auto; }",
      ".dsh-usage-meta-val { flex: 1 1 auto; word-break: break-all; font-variant-numeric: tabular-nums; }",
      ".dsh-usage-form { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }",
      ".dsh-usage-field { display: flex; flex-direction: column; gap: 6px; }",
      ".dsh-usage-field-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-input { height: 34px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; font-size: 13px; line-height: 20px; }",
      ".dsh-usage-mode-toggle { display: flex; flex-wrap: wrap; gap: 8px; }",
      ".dsh-usage-mode-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; font-size: 12px; font-weight: 500; line-height: 18px; cursor: pointer; transition: background 140ms ease, color 140ms ease, border-color 140ms ease; }",
      ".dsh-usage-mode-btn:hover { background: var(--dsw-alias-bg-layer-2); }",
      ".dsh-usage-mode-btn-active { background: #0A84FF; border-color: #0A84FF; color: #FFFFFF; }",
      ".dsh-usage-cc-window { display: flex; flex-direction: column; gap: 6px; }",
      ".dsh-usage-cc-window-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
      ".dsh-usage-cc-window-val { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-cc-bar { height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }",
      ".dsh-usage-cc-bar-fill { height: 100%; border-radius: 4px; background: var(--dsw-alias-state-success-primary); }",
      ".dsh-usage-cc-bar-fill-warn { background: var(--dsw-alias-state-warn-primary); }",
      ".dsh-usage-cc-bar-fill-danger { background: var(--dsw-alias-state-error-primary); }",
      ".dsh-usage-cc-reset { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
      ".dsh-usage-history { display: flex; flex-direction: column; gap: 10px; }",
      ".dsh-usage-history-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }",
      ".dsh-usage-history-title { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 500; line-height: 20px; }",
      ".dsh-usage-history-ranges { display: inline-flex; align-self: flex-start; gap: 2px; padding: 3px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); flex-wrap: wrap; }",
      ".dsh-usage-history-ranges .dsh-usage-mode-btn { min-height: 27px; padding: 0 10px; border-color: transparent; border-radius: 7px; background: transparent; font-size: 11px; }",
      ".dsh-usage-history-ranges .dsh-usage-mode-btn-active { background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14); }",
      ".dsh-usage-history-form { display: flex; align-items: end; gap: 6px; flex-wrap: wrap; }",
      ".dsh-usage-history-date { display: flex; flex-direction: column; gap: 3px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }",
      ".dsh-usage-history-date input, .dsh-usage-history-month { height: 30px; min-width: 112px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; font-size: 12px; }",
      ".dsh-usage-history-date input:focus, .dsh-usage-history-month:focus, .dsh-usage-input:focus { outline: 2px solid rgba(10, 132, 255, 0.45); outline-offset: 1px; }",
      ".dsh-usage-history-manage { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }",
      ".dsh-usage-history-manage .dsh-usage-action { height: 28px; padding: 0 9px; font-size: 11px; }",
      ".dsh-usage-history-chart { width: 100%; height: 148px; overflow: visible; }",
      ".dsh-usage-history-empty { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; padding: 8px 0; }",
      ".dsh-usage-modal-body { max-height: max(140px, calc(100vh - 260px)); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--dsw-alias-border-l2) transparent; }",
      ".dsh-usage-provider-list { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; overflow: hidden; }",
      ".dsh-usage-provider-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; }",
      ".dsh-usage-provider-row + .dsh-usage-provider-row { border-top: 1px solid var(--dsw-alias-border-l2); }",
      ".dsh-usage-provider-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }",
      ".dsh-usage-provider-meta { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
      ".dsh-usage-provider-toggle { display: flex; justify-content: center; }",
      ".dsh-usage-raw { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); word-break: break-all; max-height: 140px; overflow: auto; border-radius: 8px; padding: 8px 10px; background: var(--dsw-alias-bg-layer-2); }",
    ].join("\n");

    const CONFIG_KEY = "dsh-model-usage:refresh";
    /** Key this plugin used before it was renamed to dsh-model-usage. */
    const LEGACY_CONFIG_KEY = "dsh-desktop-usage:refresh";
    const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
    const MIN_INTERVAL_MS = 60 * 1000;
    const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;
    /** Offered intervals, in minutes; the input next to them takes any 1–1440. */
    const INTERVAL_PRESETS = [1, 5, 15, 30, 60];
    /** How often the open panel re-reads the clock and re-checks staleness. */
    const TICK_MS = 5000;
    const HISTORY_KEY = "dsh-model-usage:commandcode-history";
    const HISTORY_INTERVAL_MS = 10 * 60 * 1000;
    const HISTORY_RANGES = ["today", "yesterday", "week", "month", "custom"];
    /** Everything Tab may land on inside a dialog, for the focus trap. */
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function clampInterval(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_INTERVAL_MS;
      return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(ms)));
    }

    /** Read the saved refresh policy; anything malformed falls back to the default. */
    function readRefreshConfig() {
      const fallback = { auto: true, intervalMs: DEFAULT_INTERVAL_MS };
      try {
        // The pre-rename key is still honoured so a rename does not silently
        // reset the policy someone already chose.
        const raw = localStorage.getItem(CONFIG_KEY) ?? localStorage.getItem(LEGACY_CONFIG_KEY);
        if (raw == null) return fallback;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object") return fallback;
        return {
          auto: parsed.auto !== false,
          intervalMs: clampInterval(Number(parsed.intervalMs)),
        };
      } catch {
        // Corrupt storage (quota/private mode) degrades to the default policy.
        return fallback;
      }
    }

    /** Persist the refresh policy; storage failures keep the in-memory value only. */
    function writeRefreshConfig(config) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      } catch {
        // Quota/private mode: the policy still applies for this session.
      }
    }

    function historyStorageKey(data) {
      if (data?.mode !== "commandcode") return null;
      const account = typeof data.data?.account === "string" && data.data.account !== ""
        ? data.data.account
        : `${data.provider ?? "commandcode"}:${data.credential?.ref ?? "default"}:${data.credential?.source ?? ""}`;
      return `${HISTORY_KEY}:${encodeURIComponent(account)}`;
    }

    // Keep the current calendar month plus the two preceding complete months.
    // In October this retains October, September and August, and removes July.
    function historyCutoff(value = Date.now()) {
      const date = new Date(value);
      return new Date(date.getFullYear(), date.getMonth() - 2, 1).getTime();
    }

    function readHistory(data) {
      const key = historyStorageKey(data);
      if (key === null) return [];
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        const cutoff = historyCutoff(now);
        const retained = parsed.filter((point) => point !== null && typeof point === "object"
          && Number.isFinite(point.at) && point.at >= cutoff && point.at <= now
          && Number.isFinite(point.balance)
          && (point.spend === null || Number.isFinite(point.spend)))
          .sort((a, b) => a.at - b.at);
        if (retained.length !== parsed.length) {
          try {
            localStorage.setItem(key, JSON.stringify(retained));
          } catch {
            // The chart still uses the filtered in-memory history.
          }
        }
        return retained;
      } catch {
        return [];
      }
    }

    function pruneStoredHistories(now = Date.now()) {
      const prefix = `${HISTORY_KEY}:`;
      const cutoff = historyCutoff(now);
      try {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (typeof key !== "string" || !key.startsWith(prefix)) continue;
          let parsed;
          try { parsed = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { parsed = []; }
          const retained = Array.isArray(parsed)
            ? parsed.filter((point) => point !== null && typeof point === "object"
                && Number.isFinite(point.at) && point.at >= cutoff && point.at <= now
                && Number.isFinite(point.balance)
                && (point.spend === null || Number.isFinite(point.spend)))
            : [];
          if (retained.length === 0) localStorage.removeItem(key);
          else if (retained.length !== parsed.length) localStorage.setItem(key, JSON.stringify(retained));
        }
      } catch {
        // A storage restriction must not stop balance queries.
      }
    }

    function recordHistorySample(data, now = Date.now()) {
      const key = historyStorageKey(data);
      const balance = Number(data?.data?.credits?.totalRemaining);
      if (key === null || !Number.isFinite(balance)) return [];
      pruneStoredHistories(now);
      const points = readHistory(data);
      const last = points[points.length - 1];
      if (last !== undefined && Math.floor(last.at / HISTORY_INTERVAL_MS) === Math.floor(now / HISTORY_INTERVAL_MS)) return points;
      points.push({
        at: now,
        balance,
        spend: last === undefined ? null : Math.max(0, last.balance - balance),
      });
      const retained = points.filter((point) => point.at >= historyCutoff(now));
      try {
        localStorage.setItem(key, JSON.stringify(retained));
      } catch {
        // Storage can be unavailable or full; the current session still renders.
      }
      return retained;
    }

    function storedMonths(points) {
      return [...new Set(points.map((point) => {
        const date = new Date(point.at);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }))].sort().reverse();
    }

    function clearHistoryMonth(data, month) {
      const key = historyStorageKey(data);
      if (key === null || !/^\d{4}-\d{2}$/.test(month)) return [];
      const points = readHistory(data).filter((point) => {
        const date = new Date(point.at);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return value !== month;
      });
      try { localStorage.setItem(key, JSON.stringify(points)); } catch { /* memory view remains usable */ }
      return points;
    }

    function resetHistoryStorage(data) {
      const key = historyStorageKey(data);
      if (key !== null) {
        try { localStorage.removeItem(key); } catch { /* memory view remains usable */ }
      }
      return [];
    }

    const MODEL_KEY = "dsh-model-usage:model";
    /** Key this plugin used before it was renamed to dsh-model-usage. */
    const LEGACY_MODEL_KEY = "dsh-desktop-usage:model";

    /** Read the manual model override; absent or malformed means "follow the conversation". */
    function readModelOverride() {
      try {
        const raw = localStorage.getItem(MODEL_KEY) ?? localStorage.getItem(LEGACY_MODEL_KEY);
        if (raw == null) return null;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object") return null;
        if (typeof parsed.provider !== "string" || parsed.provider === "") return null;
        return {
          provider: parsed.provider,
          model: typeof parsed.model === "string" ? parsed.model : "",
        };
      } catch {
        // Corrupt storage degrades to following the conversation.
        return null;
      }
    }

    /** Persist the override (`null` restores 自动). */
    function writeModelOverride(override) {
      try {
        if (override === null) localStorage.removeItem(MODEL_KEY);
        else localStorage.setItem(MODEL_KEY, JSON.stringify(override));
      } catch {
        // Quota/private mode: the choice still applies for this session.
      }
    }

    function minutesLabel(t, ms) {
      const minutes = ms / 60000;
      const value = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
      return fill(t("minutes.value"), { count: value });
    }

    /** Human age of one refresh: 刚刚 / N 分钟前 / N 小时前 / N 天前. */
    function formatAge(t, ms) {
      if (!Number.isFinite(ms) || ms < 60000) return t("age.now");
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return fill(t("age.minutes"), { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return fill(t("age.hours"), { count: hours });
      return fill(t("age.days"), { count: Math.floor(hours / 24) });
    }

    function currencyName(t, currency) {
      return currency === "CNY" ? t("currency.CNY") : String(currency);
    }

    function currencySymbol(currency) {
      return currency === "CNY" ? "¥" : `${currency} `;
    }

    function unitSymbol(unit) {
      if (unit === "CNY") return "¥";
      if (unit === "USD") return "$";
      return `${unit} `;
    }

    function row(label, value, key) {
      return React.createElement("div", { key, className: "dsh-usage-balance-row" },
        React.createElement("span", { className: "dsh-usage-balance-label" }, label),
        React.createElement("span", { className: "dsh-usage-balance-value" }, value),
      );
    }

    // -----------------------------------------------------------------------
    // Own controls. Copying the shipped primitives' markup is not an option for
    // an out-of-tree bundle (that package is a build-time dependency), so these
    // are this plugin's own: they use only theme tokens, keep the behaviors
    // users rely on (Escape to close, focus moved in and restored on close,
    // Tab cycling inside the dialog), and carry their accessible names.

    const ACTION_VARIANTS = {
      primary: "dsh-usage-action-primary",
      outline: "dsh-usage-action-outline",
      ghost: "dsh-usage-action-ghost",
    };

    /** One dialog action button: variant + native button props. */
    function ActionButton(props) {
      const { variant, className, children } = props;
      const rest = { ...props };
      delete rest.variant;
      delete rest.className;
      delete rest.children;
      const variantClass = ACTION_VARIANTS[variant] ?? ACTION_VARIANTS.ghost;
      return React.createElement("button", {
        type: "button",
        ...rest,
        className: "dsh-usage-action " + variantClass + (className ? ` ${className}` : ""),
      }, children);
    }

    /**
     * One modal dialog. `onClose` is held in a ref so the focus effect runs only
     * on open/close — the panel re-renders on every background refresh, and
     * re-running it there would steal focus every few seconds.
     */
    function UsageModal(props) {
      const { open, onClose, title, closeLabel, className, footer, children } = props;
      const dialogRef = React.useRef(null);
      const restoreRef = React.useRef(null);
      const closeRef = React.useRef(onClose);
      closeRef.current = onClose;

      React.useEffect(() => {
        if (!open) return undefined;
        restoreRef.current = typeof document === "undefined" ? null : document.activeElement;
        const close = () => { closeRef.current(); };
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key !== "Tab") return;
          const dialog = dialogRef.current;
          if (dialog === null) return;
          const focusable = dialog.querySelectorAll(FOCUSABLE);
          if (focusable.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;
          const inside = active !== null && dialog.contains(active);
          if (event.shiftKey) {
            if (!inside || active === first) {
              event.preventDefault();
              last.focus();
            }
          } else if (!inside || active === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKeyDown, true);
        const timer = window.setTimeout(() => {
          const dialog = dialogRef.current;
          if (dialog === null) return;
          const focusable = dialog.querySelectorAll(FOCUSABLE);
          const target = focusable.length > 0 ? focusable[0] : dialog;
          if (typeof target.focus === "function") target.focus();
        }, 0);
        return () => {
          document.removeEventListener("keydown", onKeyDown, true);
          window.clearTimeout(timer);
          const restore = restoreRef.current;
          if (restore !== null && typeof restore.focus === "function") restore.focus();
        };
      }, [open]);

      if (!open) return null;
      return React.createElement("div", {
        className: "dsh-usage-modal-overlay",
        onMouseDown: (event) => { if (event.target === event.currentTarget) closeRef.current(); },
      },
        React.createElement("div", {
          ref: dialogRef,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          tabIndex: -1,
          className: "dsh-usage-modal-dialog" + (className ? ` ${className}` : ""),
        },
          React.createElement("div", { className: "dsh-usage-modal-head" },
            React.createElement("span", { className: "dsh-usage-modal-title" }, title),
            React.createElement("button", {
              type: "button",
              className: "dsh-usage-modal-close",
              "aria-label": closeLabel,
              title: closeLabel,
              onClick: () => { closeRef.current(); },
            }, "×"),
          ),
          React.createElement("div", { className: "dsh-usage-modal-content" }, children),
          footer === undefined || footer === null
            ? null
            : React.createElement("div", { className: "dsh-usage-modal-footer" }, footer),
        ),
      );
    }

    /** Format a duration (ms) as "Xh Ym" / "Xd Yh", falling back to "已重置". */
    function formatDuration(t, ms) {
      if (!Number.isFinite(ms) || ms <= 0) return t("duration.reset");
      const totalMin = Math.floor(ms / 60000);
      if (totalMin < 60) return `${totalMin}m`;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
    }

    /** One rolling-window meter: label, used/cap, percentage bar, reset countdown. */
    function CcWindowMeter({ label, used, cap, resetAt, now, t }) {
      const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
      const barClass = pct >= 90 ? "dsh-usage-cc-bar-fill-danger"
        : pct >= 70 ? "dsh-usage-cc-bar-fill-warn"
        : "dsh-usage-cc-bar-fill";
      const resetIn = resetAt > 0 ? resetAt - now : 0;
      return React.createElement("div", { className: "dsh-usage-cc-window" },
        React.createElement("div", { className: "dsh-usage-cc-window-head" },
          React.createElement("span", null, label),
          React.createElement("span", { className: "dsh-usage-cc-window-val" },
            `$${used.toFixed(2)} / $${cap.toFixed(2)}`),
        ),
        React.createElement("div", { className: "dsh-usage-cc-bar" },
          React.createElement("div", { className: barClass, style: { width: `${pct}%` } }),
        ),
        React.createElement("div", { className: "dsh-usage-cc-reset" },
          resetIn > 0
            ? fill(t("window.usedReset"), { percent: Math.round(pct), duration: formatDuration(t, resetIn) })
            : t("window.reset")),
      );
    }

    /** Command Code route: plan windows + credits, normalized by the host. */
    function CommandCodeCard({ data, t }) {
      const d = data.data;
      const windows = d.windows;
      const credits = d.credits;
      const now = typeof d.now === "number" ? d.now : Date.now();
      const cycleEnd = typeof d.cycleEnd === "number" && d.cycleEnd > 0
        ? new Date(d.cycleEnd).toLocaleDateString()
        : null;
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" },
          String(d.planName),
          React.createElement("span", { className: "dsh-usage-balance-status" },
            d.status === "active" ? t("card.subscribed") : String(d.status ?? "")),
        ),
        windows !== null && windows.limited
          ? React.createElement("div", { className: "dsh-usage-stack" },
              windows.fiveHour !== null && windows.fiveHour.cap > 0
                ? React.createElement(CcWindowMeter, { label: t("window.fiveHour"), ...windows.fiveHour, now, t })
                : null,
              windows.weekly !== null && windows.weekly.cap > 0
                ? React.createElement(CcWindowMeter, { label: t("window.weekly"), ...windows.weekly, now, t })
                : null,
            )
          : row(t("card.windowLimit"), t("card.notApplicable"), "cc-window"),
        React.createElement("div", { className: "dsh-usage-stack" },
          row(t("card.credits"), `$${(credits.totalRemaining ?? 0).toFixed(2)}`, "cc-total"),
          row(t("card.monthlyRemaining"), `$${(credits.monthlyRemaining ?? 0).toFixed(2)}`, "cc-monthly"),
          row(t("card.spent"), `$${(credits.totalSpent ?? 0).toFixed(2)}`, "cc-spent"),
          row(t("card.requests"), String(credits.totalCount ?? 0), "cc-count"),
          d.account !== null && d.account !== undefined ? row(t("card.account"), String(d.account), "cc-account") : null,
          cycleEnd !== null ? row(t("card.cycleEnd"), cycleEnd, "cc-cycle") : null,
        ),
      );
    }

    function dateInputValue(value) {
      const date = new Date(value);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function localDateStart(value) {
      const [year, month, day] = String(value).split("-").map(Number);
      return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
        ? new Date(year, month - 1, day).getTime()
        : NaN;
    }

    function BalanceHistory({ points, range, customRange, appliedCustomRange, selectedMonth, onRange, onCustomRange, onApplyCustomRange, onSelectMonth, onClearMonth, onReset, t }) {
      const now = Date.now();
      const todayStart = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
      let start = todayStart;
      let end = todayStart + 24 * 60 * 60 * 1000;
      let daily = false;
      if (range === "yesterday") {
        start -= 24 * 60 * 60 * 1000;
        end -= 24 * 60 * 60 * 1000;
      } else if (range === "week") {
        start -= 6 * 24 * 60 * 60 * 1000;
        daily = true;
      } else if (range === "month") {
        start -= 29 * 24 * 60 * 60 * 1000;
        daily = true;
      } else if (range === "custom") {
        const customStart = localDateStart(appliedCustomRange.start);
        const customEnd = localDateStart(appliedCustomRange.end);
        if (Number.isFinite(customStart) && Number.isFinite(customEnd) && customEnd >= customStart) {
          start = customStart;
          end = customEnd + 24 * 60 * 60 * 1000;
          daily = end - start >= 7 * 24 * 60 * 60 * 1000;
        }
      }
      const rawVisible = points.filter((point) => point.spend !== null && point.at >= start && point.at < end);
      let visible = rawVisible;
      if (daily) {
        const buckets = new Map();
        for (const point of rawVisible) {
          const date = new Date(point.at);
          const bucket = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          buckets.set(bucket, (buckets.get(bucket) ?? 0) + point.spend);
        }
        visible = [...buckets.entries()].map(([at, spend]) => ({ at: at + 12 * 60 * 60 * 1000, spend })).sort((a, b) => a.at - b.at);
      }
      const maxSpend = Math.max(0.01, ...visible.map((point) => point.spend));
      const chartPoints = visible.map((point) => ({
        x: 42 + Math.max(0, Math.min(1, (point.at - start) / (end - start))) * 306,
        y: 104 - (point.spend / maxSpend) * 78,
        point,
      }));
      const sum = visible.reduce((total, point) => total + point.spend, 0);
      const span = end - start;
      const tickCount = span <= 2 * 24 * 60 * 60 * 1000 ? 7 : span <= 8 * 24 * 60 * 60 * 1000 ? 8 : 7;
      const tickLabel = (value) => span <= 2 * 24 * 60 * 60 * 1000
        ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date(value).toLocaleDateString([], { month: "2-digit", day: "2-digit" });
      const children = [];
      for (let index = 0; index < tickCount; index += 1) {
        const ratio = index / (tickCount - 1);
        const x = 42 + ratio * 306;
        const value = start + ratio * span;
        children.push(
          React.createElement("line", { key: `grid-${index}`, x1: x, x2: x, y1: 20, y2: 108, stroke: "var(--dsw-alias-border-l2)", strokeWidth: 1 }),
          React.createElement("text", { key: `tick-${index}`, x, y: 126, textAnchor: index === 0 ? "start" : index === tickCount - 1 ? "end" : "middle", fill: "var(--dsw-alias-label-secondary)", fontSize: 10 }, tickLabel(value)),
        );
      }
      children.push(
        React.createElement("text", { key: "y-max", x: 36, y: 25, textAnchor: "end", fill: "var(--dsw-alias-label-secondary)", fontSize: 10 }, `$${maxSpend.toFixed(2)}`),
        React.createElement("text", { key: "y-zero", x: 36, y: 108, textAnchor: "end", fill: "var(--dsw-alias-label-secondary)", fontSize: 10 }, "$0"),
      );
      if (chartPoints.length > 0) {
        children.push(React.createElement("polyline", {
          key: "line", points: chartPoints.map(({ x, y }) => `${x},${y}`).join(" "), fill: "none",
          stroke: "var(--dsw-alias-state-success-primary)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round",
        }));
        chartPoints.forEach(({ x, y, point }, index) => children.push(
          React.createElement("g", { key: `point-${index}` },
            React.createElement("circle", { cx: x, cy: y, r: 3.5, fill: "var(--dsw-alias-state-success-primary)" }),
            React.createElement("title", null, `${new Date(point.at).toLocaleString()} · $${point.spend.toFixed(2)}`),
          ),
        ));
      }
      const months = storedMonths(points);
      const activeMonth = months.includes(selectedMonth) ? selectedMonth : (months[0] ?? "");
      return React.createElement("div", { className: "dsh-usage-balance-card dsh-usage-history" },
        React.createElement("div", { className: "dsh-usage-history-head" },
          React.createElement("span", { className: "dsh-usage-history-title" }, t("history.title")),
          visible.length > 0 ? React.createElement("span", { className: "dsh-usage-balance-status" }, `${t("history.amount")} $${sum.toFixed(2)}`) : null,
        ),
        React.createElement("div", { className: "dsh-usage-history-ranges" }, HISTORY_RANGES.map((item) =>
          React.createElement("button", { key: item, type: "button", className: "dsh-usage-mode-btn" + (range === item ? " dsh-usage-mode-btn-active" : ""), onClick: () => onRange(item) }, t(`history.range.${item}`)))),
        range === "custom"
          ? React.createElement("div", { className: "dsh-usage-history-form" },
              React.createElement("label", { className: "dsh-usage-history-date" }, t("history.start"), React.createElement("input", { type: "date", value: customRange.start, onChange: (event) => onCustomRange({ ...customRange, start: event.target.value }) })),
              React.createElement("label", { className: "dsh-usage-history-date" }, t("history.end"), React.createElement("input", { type: "date", value: customRange.end, onChange: (event) => onCustomRange({ ...customRange, end: event.target.value }) })),
              React.createElement(ActionButton, { variant: "outline", onClick: onApplyCustomRange }, t("history.apply")),
            )
          : null,
        visible.length > 0
          ? React.createElement("svg", { className: "dsh-usage-history-chart", viewBox: "0 0 360 132", role: "img", "aria-label": t("history.title") }, children)
          : React.createElement("div", { className: "dsh-usage-history-empty" }, t("history.empty")),
        React.createElement("div", { className: "dsh-usage-history-manage" },
          React.createElement("span", { className: "dsh-usage-history-title" }, t("history.month")),
          months.length > 0
            ? React.createElement("select", { className: "dsh-usage-history-month", value: activeMonth, onChange: (event) => onSelectMonth(event.target.value) }, months.map((month) => React.createElement("option", { key: month, value: month }, month)))
            : React.createElement("span", { className: "dsh-usage-history-empty" }, t("history.noMonths")),
          months.length > 0 ? React.createElement(ActionButton, { variant: "ghost", onClick: () => onClearMonth(activeMonth) }, t("history.clearMonth")) : null,
          React.createElement(ActionButton, { variant: "ghost", onClick: onReset }, t("history.reset")),
        ),
      );
    }

    /** Official DeepSeek route: one card per currency, 余额 only. */
    function DeepSeekCard({ data, t }) {
      const infos = Array.isArray(data.data.balance_infos) ? data.data.balance_infos : [];
      if (infos.length === 0) {
        return React.createElement("div", { className: "dsh-usage-balance-card" },
          row(t("card.balance"), t("card.balanceEmpty"), "balance-empty"));
      }
      return React.createElement("div", { className: "dsh-usage-stack" },
        infos.map((info) => React.createElement(
          "div",
          { key: info.currency, className: "dsh-usage-balance-card" },
          React.createElement("div", { className: "dsh-usage-balance-card-title" },
            currencyName(t, info.currency),
            React.createElement("span", { className: "dsh-usage-balance-status" },
              data.data.is_available === true ? t("card.available") : t("card.unavailable")),
          ),
          row(t("card.balance"), currencySymbol(info.currency) + String(info.total_balance), "balance"),
        )));
    }

    /** DeepSeek account route: platform wallets (recharge + bonus). */
    function DeepSeekAccountCard({ data, t }) {
      const wallets = Array.isArray(data.data.wallets) ? data.data.wallets : [];
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" }, t("card.deepseekAccount")),
        wallets.length === 0
          ? row(t("card.balance"), t("card.noWallet"), "account-empty")
          : React.createElement("div", { className: "dsh-usage-stack" },
              wallets.map((wallet, index) => row(
                currencyName(t, wallet.currency),
                currencySymbol(wallet.currency) + String(wallet.balance),
                `wallet-${index}`,
              ))),
      );
    }

    /**
     * Generic provider card for the adapters that normalize to the same two
     * building blocks: `windows` (used / limit / reset meters — OpenCode Go's
     * 5h / weekly / monthly allowances) and `rows` (label → value lines —
     * OpenRouter credits, Moonshot and SiliconFlow balances).
     *
     * Whatever the endpoint returned rides along as `raw` behind a toggle: the
     * OpenCode Go payload is not publicly documented, so an unrecognized field
     * stays visible instead of turning into an empty card.
     */
    function UsageRowsCard({ data, t }) {
      const [showRaw, setShowRaw] = React.useState(false);
      const d = data.data;
      const windows = Array.isArray(d.windows) ? d.windows : [];
      const models = Array.isArray(d.models) ? d.models : [];
      const rows = Array.isArray(d.rows) ? d.rows : [];
      const now = typeof d.now === "number" ? d.now : Date.now();
      const recognized = windows.length > 0 || models.length > 0 || rows.length > 0;
      const money = (value) => (value === null || value === undefined ? "—" : `$${Number(value).toFixed(2)}`);
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" },
          String(data.providerName ?? data.provider)),
        windows.length > 0
          ? React.createElement("div", { className: "dsh-usage-stack" },
              windows.map((w, i) => React.createElement(CcWindowMeter, {
                key: `w-${i}`,
                label: String(w.label ?? t("card.windowFallback")),
                used: Number(w.used ?? 0),
                cap: Number(w.limit ?? 0),
                resetAt: Number(w.resetsAt ?? 0),
                now,
                t,
              })))
          : null,
        rows.length > 0
          ? React.createElement("div", { className: "dsh-usage-stack" },
              rows.map((entry, i) => row(String(entry.label), String(entry.value), `r-${i}`)))
          : null,
        models.length > 0
          ? React.createElement("div", { className: "dsh-usage-stack" },
              models.slice(0, 12).map((entry, i) => row(
                String(entry.model),
                entry.limit === null || entry.limit === undefined
                  ? money(entry.used)
                  : `${money(entry.used)} / ${money(entry.limit)}`,
                `m-${i}`,
              )))
          : null,
        !recognized
          ? React.createElement("div", { className: "dsh-usage-hint" }, t("card.unrecognized"))
          : null,
        d.raw === undefined || d.raw === null
          ? null
          : React.createElement("div", { className: "dsh-usage-stack" },
              React.createElement("div", { className: "dsh-usage-provider-toggle" },
                React.createElement("button", {
                  type: "button",
                  className: "dsh-usage-chip",
                  onClick: () => { setShowRaw(!showRaw); },
                }, showRaw ? t("card.hideRaw") : t("card.raw"))),
              showRaw ? React.createElement("div", { className: "dsh-usage-raw" }, rawJson(d.raw)) : null),
      );
    }

    /** Compact one-line JSON for the raw-payload toggle. */
    function rawJson(value) {
      let text;
      try {
        text = JSON.stringify(value);
      } catch {
        text = String(value);
      }
      if (typeof text !== "string") text = String(text);
      return text.length > 900 ? `${text.slice(0, 900)}…` : text;
    }

    /** New API route: quota / used / total, normalized by the host. */
    function NewApiCard({ data, t }) {
      const d = data.data;
      const symbol = unitSymbol(d.unit);
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" }, String(d.planName)),
        row(t("card.balance"), symbol + String(d.remaining), "remaining"),
        row(t("card.used"), symbol + String(d.used), "used"),
        row(t("card.total"), symbol + String(d.total), "total"),
      );
    }

    /**
     * The model, provider and credential REFERENCE the numbers came from — the
     * answer to "which key was this queried with", never the key itself.
     */
    function UsageMeta({ data, t }) {
      const credential = data.credential;
      const usageUrl = data.data?.usageUrl;
      return React.createElement("div", { className: "dsh-usage-meta" },
        React.createElement("div", { className: "dsh-usage-meta-row" },
          React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.model")),
          React.createElement("span", { className: "dsh-usage-meta-val" },
            `${data.providerName ?? data.provider} / ${data.model}${data.reasoningEffort ? ` · ${data.reasoningEffort}` : ""}`),
        ),
        credential !== null && credential !== undefined
          ? React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.credential")),
              React.createElement("span", { className: "dsh-usage-meta-val" },
                `${credential.ref}${credential.source ? ` · ${credential.source}` : ""}`),
            )
          : React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.credential")),
              React.createElement("span", { className: "dsh-usage-meta-val" }, t("meta.accountLogin")),
            ),
        typeof usageUrl === "string" && usageUrl !== ""
          ? React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, t("meta.usageUrl")),
              React.createElement("span", { className: "dsh-usage-meta-val" }, usageUrl),
            )
          : null,
      );
    }

    function UsageBalance({ data, history, historyRange, customRange, appliedCustomRange, selectedMonth, onHistoryRange, onCustomRange, onApplyCustomRange, onSelectMonth, onClearMonth, onResetHistory, onRefresh, t }) {
      let card;
      if (data.mode === "commandcode") card = React.createElement(CommandCodeCard, { data, t });
      else if (data.mode === "newapi") card = React.createElement(NewApiCard, { data, t });
      else if (data.mode === "deepseek-account") card = React.createElement(DeepSeekAccountCard, { data, t });
      else if (data.mode === "opencode-go" || data.mode === "openrouter"
          || data.mode === "moonshot" || data.mode === "siliconflow") {
        card = React.createElement(UsageRowsCard, { data, t });
      } else card = React.createElement(DeepSeekCard, { data, t });
      return React.createElement("div", { className: "dsh-usage-stack" },
        card,
        data.mode === "commandcode"
          ? React.createElement(BalanceHistory, {
              points: history, range: historyRange, onRange: onHistoryRange, t,
              customRange, appliedCustomRange, selectedMonth, onCustomRange, onApplyCustomRange, onSelectMonth,
              onClearMonth, onReset: onResetHistory,
            })
          : null,
        React.createElement(UsageMeta, { data, t }),
        React.createElement("div", { className: "dsh-usage-refresh" },
          React.createElement(ActionButton, { variant: "ghost", onClick: onRefresh }, t("action.refresh")),
        ),
      );
    }

    /**
     * Refresh status: how old the numbers on screen are, whether a query is in
     * flight, and the two controls (auto-refresh toggle, interval settings).
     * While a refresh runs over existing numbers the age stays visible, so the
     * panel never blanks out to a spinner.
     *
     * The line is deliberately ONE line that never re-flows: the dialog is
     * vertically centred, so a status text that wrapped while a background
     * refresh swapped it would move the whole panel under the reader.
     */
    function RefreshStatus({ view, config, now, onToggleAuto, onOpenSettings, t }) {
      const age = view.updatedAt > 0 ? now - view.updatedAt : null;
      const label = age === null ? null : formatAge(t, age);
      const stale = !view.refreshing && age !== null && age > config.intervalMs;
      let text;
      if (view.refreshing) {
        text = label === null
          ? t("status.refreshing")
          : fill(t("status.refreshingAge"), { age: label });
      } else if (label === null) text = t("status.never");
      else {
        text = fill(t("status.updated"), { age: label })
          + (stale ? fill(t("status.stale"), { interval: minutesLabel(t, config.intervalMs) }) : "");
      }
      return React.createElement("div", { className: "dsh-usage-status-bar" },
        React.createElement("div", { className: "dsh-usage-status" },
          view.refreshing ? React.createElement("span", { className: "dsh-usage-spinner" }) : null,
          React.createElement("span", { className: "dsh-usage-status-text", title: text }, text),
        ),
        React.createElement("div", { className: "dsh-usage-status-actions" },
          React.createElement("button", {
            type: "button",
            className: "dsh-usage-chip" + (config.auto ? " dsh-usage-chip-active" : ""),
            onClick: onToggleAuto,
            title: config.auto
              ? fill(t("status.autoTooltipOn"), { interval: minutesLabel(t, config.intervalMs) })
              : t("status.autoTooltipOff"),
          }, config.auto ? t("status.autoOn") : t("status.autoOff")),
          React.createElement("button", {
            type: "button",
            className: "dsh-usage-chip",
            onClick: onOpenSettings,
          }, t("status.settings")),
        ),
      );
    }

    /** 刷新设置 form: the auto-refresh switch, preset intervals, and a custom one. */
    function RefreshSettings({ form, onChange, t }) {
      const set = (patch) => onChange({ ...form, ...patch });
      const chip = (label, active, onClick, key) => React.createElement("button", {
        key: key ?? label,
        type: "button",
        className: "dsh-usage-mode-btn" + (active ? " dsh-usage-mode-btn-active" : ""),
        onClick,
      }, label);
      const minutes = Number(form.minutes);
      const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440;
      return React.createElement("div", { className: "dsh-usage-form" },
        React.createElement("div", { className: "dsh-usage-field" },
          React.createElement("span", { className: "dsh-usage-field-label" }, t("settings.autoLabel")),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            chip(t("settings.on"), form.auto === true, () => set({ auto: true })),
            chip(t("settings.off"), form.auto === false, () => set({ auto: false })),
          ),
          React.createElement("span", { className: "dsh-usage-hint" }, t("settings.autoHint")),
        ),
        React.createElement("div", { className: "dsh-usage-field" },
          React.createElement("span", { className: "dsh-usage-field-label" }, t("settings.interval")),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            INTERVAL_PRESETS.map((value) => chip(
              fill(t("minutes.value"), { count: value }),
              Number(form.minutes) === value,
              () => set({ minutes: String(value) }),
              `preset-${value}`,
            )),
          ),
          React.createElement("input", {
            className: "dsh-usage-input",
            type: "number",
            min: 1,
            max: 1440,
            step: 1,
            value: form.minutes,
            "aria-label": t("settings.interval"),
            onChange: (event) => set({ minutes: event.target.value }),
          }),
          React.createElement("span", { className: "dsh-usage-hint" },
            valid ? t("settings.customHint") : t("settings.customInvalid")),
        ),
        React.createElement("span", { className: "dsh-usage-hint" }, t("settings.staleHint")),
      );
    }

    /**
     * Read the current conversation's model selection. The host always passes
     * `useProjection` for Session slots; the guard keeps the panel alive in a
     * composition that omits it. The wire view is `{ lastUsed, next }`, where
     * `next` already resolves a pending pick over the last used route.
     */
    function useModelSelection(props) {
      const useProjection = props.useProjection;
      const projected = typeof useProjection === "function" ? useProjection("modelSelection") : undefined;
      return projected?.next ?? projected?.lastUsed ?? null;
    }

    /**
     * The 说明 dialog: which provider routes exist and whether each key is set.
     * A deployment can declare dozens of routes (`llm-pi-ai` ships a whole
     * catalog), so the ones that matter — routes with a usage API or a
     * configured key — come first, and the rest wait behind a toggle.
     */
    function ProviderInfo({ providers, t }) {
      const [expanded, setExpanded] = React.useState(false);
      if (providers === null) {
        return React.createElement("div", { className: "dsh-usage-state" }, t("state.loading"));
      }
      if (providers.length === 0) {
        return React.createElement("div", { className: "dsh-usage-state" }, t("providers.none"));
      }
      const rank = (entry) => (entry.kind !== null ? 0 : entry.configured ? 1 : 2);
      const sorted = [...providers].sort((left, right) => rank(left) - rank(right)
        || String(left.displayName).localeCompare(String(right.displayName)));
      const relevant = sorted.filter((entry) => entry.kind !== null || entry.configured === true);
      const visible = expanded ? sorted : relevant;
      const hidden = sorted.length - visible.length;
      const supported = sorted.filter((entry) => entry.kind !== null).length;
      const configured = sorted.filter((entry) => entry.configured === true).length;
      return React.createElement("div", { className: "dsh-usage-stack" },
        React.createElement("div", { className: "dsh-usage-hint" },
          fill(t("providers.summary"), { total: sorted.length, configured, supported })),
        React.createElement("div", { className: "dsh-usage-provider-list" },
          visible.map((entry) => React.createElement("div", {
            key: entry.provider,
            className: "dsh-usage-provider-row",
          },
            React.createElement("div", { className: "dsh-usage-provider-head" },
              React.createElement("span", null, String(entry.displayName)),
              React.createElement("span", { className: "dsh-usage-balance-status" },
                entry.kind === null
                  ? (entry.configured ? t("providers.configuredUnsupported") : t("kind.none"))
                  : (entry.configured ? t("providers.keyConfigured") : t("providers.keyMissing"))),
            ),
            React.createElement("div", { className: "dsh-usage-provider-meta" },
              `${entry.provider} · ${kindLabel(t, entry.kind, entry.kindLabel)}${entry.credentialRef ? ` · ${entry.credentialRef}` : ""}`),
            entry.baseUrl !== null && entry.baseUrl !== undefined
              ? React.createElement("div", { className: "dsh-usage-provider-meta" }, String(entry.baseUrl))
              : null,
          ))),
        hidden > 0 || expanded
          ? React.createElement("div", { className: "dsh-usage-provider-toggle" },
              React.createElement("button", {
                type: "button",
                className: "dsh-usage-chip",
                onClick: () => { setExpanded(!expanded); },
              }, expanded ? t("providers.collapse") : fill(t("providers.expand"), { count: hidden })))
          : null,
      );
    }

    /**
     * The query-target row: which route the numbers belong to, and the manual
     * override that can point the panel somewhere other than the conversation.
     */
    function ModelBar({ override, effective, onOpen, t }) {
      const route = (selection) => override !== null
        ? `${selection.provider}${selection.model ? ` / ${selection.model}` : ""}`
        : "";
      const label = override !== null
        ? route(override)
        : (effective === null
            ? t("modelbar.auto")
            : fill(t("modelbar.autoRoute"), {
                route: `${effective.provider}${effective.model ? ` / ${effective.model}` : ""}`,
              }));
      return React.createElement("div", { className: "dsh-usage-modelbar" },
        React.createElement("span", { className: "dsh-usage-modelbar-label" }, t("modelbar.label")),
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-chip" + (override === null ? "" : " dsh-usage-chip-active"),
          title: override === null ? t("modelbar.titleAuto") : t("modelbar.titleManual"),
          onClick: onOpen,
        }, React.createElement("span", { className: "dsh-usage-chip-text" }, label)),
      );
    }

    /**
     * The 选择模型 dialog: 自动 (follow the conversation) plus every routable
     * route, so usage can be checked for a provider the conversation is not on.
     */
    function ModelPicker({ catalog, override, onAuto, onPick, t }) {
      if (catalog === null) {
        return React.createElement("div", { className: "dsh-usage-state" }, t("state.loading"));
      }
      const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
      const head = React.createElement("div", { className: "dsh-usage-stack" },
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-mode-btn" + (override === null ? " dsh-usage-mode-btn-active" : ""),
          onClick: onAuto,
        }, t("picker.auto")),
        catalog.default === null || catalog.default === undefined
          ? null
          : React.createElement("div", { className: "dsh-usage-hint" },
              fill(t("picker.default"), {
                route: `${catalog.default.provider}${catalog.default.model ? ` / ${catalog.default.model}` : ""}`,
              })),
      );
      if (groups.length === 0) {
        return React.createElement("div", { className: "dsh-usage-stack" }, head,
          React.createElement("div", { className: "dsh-usage-state" }, t("picker.empty")));
      }
      return React.createElement("div", { className: "dsh-usage-stack" }, head,
        groups.map((group) => React.createElement("div", {
          key: group.provider,
          className: "dsh-usage-balance-card",
        },
          React.createElement("div", { className: "dsh-usage-balance-card-title" },
            String(group.name),
            React.createElement("span", { className: "dsh-usage-balance-status" },
              kindLabel(t, group.kind, group.kindLabel))),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            group.models.map((model) => React.createElement("button", {
              key: model.id,
              type: "button",
              className: "dsh-usage-mode-btn"
                + (override !== null && override.provider === group.provider && override.model === model.id
                  ? " dsh-usage-mode-btn-active"
                  : ""),
              title: model.id,
              onClick: () => { onPick(group.provider, model.id); },
            }, React.createElement("span", { className: "dsh-usage-chip-text" }, String(model.name))))),
        )));
    }

    function UsageAction(props) {
      const { fetchBalance, fetchProviders, fetchModels } = props;
      // The slot passes the bound translate function; a composition that does
      // not mount the locale service still renders the Chinese source text
      // instead of blanking the cell.
      const t = typeof props.t === "function" ? props.t : (key) => (zh[key] ?? key);
      const selection = useModelSelection(props);
      // A manual override outranks the conversation: the panel can inspect any
      // routable route without switching what the conversation runs on.
      const [override, setOverride] = React.useState(readModelOverride);
      const effective = override ?? selection;
      const provider = effective?.provider ?? null;
      const model = effective?.model ?? null;
      const effort = override === null ? (selection?.reasoningEffort ?? null) : null;
      const sessionId = props.sessionId === undefined ? null : String(props.sessionId);
      const [open, setOpen] = React.useState(false);
      const [pickerOpen, setPickerOpen] = React.useState(false);
      const [catalog, setCatalog] = React.useState(null);
      const [infoOpen, setInfoOpen] = React.useState(false);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      const [providers, setProviders] = React.useState(null);
      const [dialogError, setDialogError] = React.useState("");
      const [config, setConfig] = React.useState(readRefreshConfig);
      const [form, setForm] = React.useState({ auto: true, minutes: "5" });
      const [view, setView] = React.useState({ refreshing: false, data: null, error: "", updatedAt: 0 });
      const [history, setHistory] = React.useState([]);
      const [historyRange, setHistoryRange] = React.useState("today");
      const [customRange, setCustomRange] = React.useState(() => ({
        start: dateInputValue(Date.now() - 6 * 24 * 60 * 60 * 1000),
        end: dateInputValue(Date.now()),
      }));
      const [appliedCustomRange, setAppliedCustomRange] = React.useState(() => ({
        start: dateInputValue(Date.now() - 6 * 24 * 60 * 60 * 1000),
        end: dateInputValue(Date.now()),
      }));
      const [selectedMonth, setSelectedMonth] = React.useState("");
      const [, forceRender] = React.useState(0);
      const viewRef = React.useRef(view);
      const inFlight = React.useRef(false);
      const samplePending = React.useRef(false);
      const generation = React.useRef(0);
      viewRef.current = view;

      /** One usage query; concurrent calls collapse into the first one. */
      const refresh = React.useCallback((sample = false) => {
        if (inFlight.current) {
          if (sample) samplePending.current = true;
          return;
        }
        inFlight.current = true;
        const gen = generation.current;
        // A missing host route binding is reported in the panel, never thrown:
        // a throwing cell would blank the whole slot entry.
        if (typeof fetchBalance !== "function") {
          inFlight.current = false;
          setView((s) => ({ ...s, refreshing: false, error: t("state.noHost") }));
          return;
        }
        setView((s) => ({ ...s, refreshing: true, error: "" }));
        fetchBalance({ provider, model, effort, sessionId })
          .then((result) => {
            // A model switch bumped the generation: this answer is for a route
            // the panel no longer shows, so it must not write anything.
            if (gen !== generation.current) return;
            inFlight.current = false;
            const pendingSample = samplePending.current;
            samplePending.current = false;
            if (result.ok) {
              const sampledAt = Date.now();
              const previousHistory = result.value.mode === "commandcode" ? readHistory(result.value) : [];
              const shouldRecord = sample || (!pendingSample && previousHistory.length === 0);
              const nextHistory = result.value.mode === "commandcode"
                ? shouldRecord
                  ? recordHistorySample(result.value, sampledAt)
                  : previousHistory
                : [];
              if (result.value.mode === "commandcode") setHistory(nextHistory);
              setView((s) => ({ ...s, refreshing: false, data: result.value, error: "", updatedAt: sampledAt }));
            } else {
              // Keep the last numbers: a failed background refresh must not
              // blank out what the user was reading.
              setView((s) => ({ ...s, refreshing: false, error: result.error.message }));
            }
            if (pendingSample && !sample) setTimeout(() => { refresh(true); }, 0);
          })
          .catch((err) => {
            if (gen !== generation.current) return;
            inFlight.current = false;
            setView((s) => ({ ...s, refreshing: false, error: String(err) }));
            if (samplePending.current) {
              samplePending.current = false;
              setTimeout(() => { refresh(true); }, 0);
            }
          });
      }, [fetchBalance, provider, model, effort, sessionId]);

      /** Whether what is on screen is older than the configured interval. */
      const isStale = React.useCallback(() => {
        const s = viewRef.current;
        return s.updatedAt === 0 || (Date.now() - s.updatedAt) > config.intervalMs;
      }, [config.intervalMs]);

      // Mount and every model switch: the new route owns the panel, so drop the
      // old numbers and query at once — this is what makes the first click show
      // data instead of starting a query.
      React.useEffect(() => {
        generation.current += 1;
        inFlight.current = false;
        samplePending.current = false;
        setView({ refreshing: false, data: null, error: "", updatedAt: 0 });
        setHistory([]);
        setSelectedMonth("");
        refresh();
      }, [refresh]);

      // Background auto refresh: lives with the cell, not with the modal, so the
      // numbers stay warm while the panel is closed.
      React.useEffect(() => {
        if (!config.auto) return undefined;
        const id = setInterval(() => { refresh(); }, config.intervalMs);
        return () => { clearInterval(id); };
      }, [config.auto, config.intervalMs, refresh]);

      // Sample at the system clock's 00/10/20/30/40/50 minute marks, even when
      // the configurable display auto-refresh is disabled.
      React.useEffect(() => {
        if (view.data?.mode !== "commandcode") return undefined;
        const now = new Date();
        const elapsed = (now.getMinutes() % 10) * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds();
        const wait = HISTORY_INTERVAL_MS - elapsed;
        let intervalId;
        const sampleId = setTimeout(() => {
          refresh(true);
          intervalId = setInterval(() => { if (!inFlight.current) refresh(true); }, HISTORY_INTERVAL_MS);
        }, wait);
        return () => {
          clearTimeout(sampleId);
          if (intervalId !== undefined) clearInterval(intervalId);
        };
      }, [view.data, refresh]);

      // Opening the panel: show what is known, and only pay for a query when the
      // numbers are stale (which also renders as 刷新中 over those numbers).
      React.useEffect(() => {
        if (!open) return;
        if (isStale() && !viewRef.current.refreshing) refresh();
      }, [open, isStale, refresh]);

      // While open: keep the age text moving and self-refresh when the numbers
      // age past the interval.
      React.useEffect(() => {
        if (!open) return undefined;
        const id = setInterval(() => {
          forceRender((n) => n + 1);
          if (isStale() && !viewRef.current.refreshing) refresh();
        }, TICK_MS);
        return () => { clearInterval(id); };
      }, [open, isStale, refresh]);

      const applyConfig = (next) => {
        setConfig(next);
        writeRefreshConfig(next);
        if (next.auto && isStale() && !viewRef.current.refreshing) refresh();
      };
      const toggleAuto = () => { applyConfig({ auto: !config.auto, intervalMs: config.intervalMs }); };
      // One dialog at a time: a sub-dialog replaces the panel, and closing it
      // returns to the panel. Nothing is stacked, so a background refresh
      // re-rendering the cell cannot reflow or re-order two centred cards
      // while the user is reading one of them.
      const openSettings = () => {
        setForm({ auto: config.auto, minutes: String(Math.max(1, Math.round(config.intervalMs / 60000))) });
        setOpen(false);
        setSettingsOpen(true);
      };
      const closeSettings = () => {
        setSettingsOpen(false);
        setOpen(true);
      };
      const saveSettings = () => {
        const minutes = Number(form.minutes);
        const intervalMs = Number.isFinite(minutes) && minutes >= 1
          ? clampInterval(minutes * 60000)
          : config.intervalMs;
        setSettingsOpen(false);
        setOpen(true);
        applyConfig({ auto: form.auto === true, intervalMs });
      };
      const openInfo = () => {
        setOpen(false);
        setProviders(null);
        setDialogError("");
        setInfoOpen(true);
        fetchProviders()
          .then((result) => setProviders(result.ok ? result.value : []))
          .catch((err) => { setDialogError(String(err)); setProviders([]); });
      };
      const closeInfo = () => {
        setInfoOpen(false);
        setOpen(true);
      };
      const openPicker = () => {
        setOpen(false);
        setCatalog(null);
        setDialogError("");
        setPickerOpen(true);
        fetchModels()
          .then((result) => setCatalog(result.ok ? result.value : { groups: [], default: null }))
          .catch((err) => { setDialogError(String(err)); setCatalog({ groups: [], default: null }); });
      };
      const closePicker = () => {
        setPickerOpen(false);
        setOpen(true);
      };
      // Switching the target resets the route: the effect below re-queries at once.
      const pickModel = (nextProvider, nextModel) => {
        const next = { provider: nextProvider, model: nextModel };
        setOverride(next);
        writeModelOverride(next);
        setPickerOpen(false);
        setOpen(true);
      };
      const pickAuto = () => {
        setOverride(null);
        writeModelOverride(null);
        setPickerOpen(false);
        setOpen(true);
      };

      const clearMonth = (month) => {
        if (view.data?.mode !== "commandcode" || month === "") return;
        const message = fill(t("history.confirmClearMonth"), { month });
        if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(message)) return;
        const next = clearHistoryMonth(view.data, month);
        setHistory(next);
        setSelectedMonth(storedMonths(next)[0] ?? "");
      };
      const resetHistory = () => {
        if (view.data?.mode !== "commandcode") return;
        if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(t("history.confirmReset"))) return;
        setHistory(resetHistoryStorage(view.data));
        setSelectedMonth("");
      };
      const applyCustomRange = () => {
        const start = localDateStart(customRange.start);
        const end = localDateStart(customRange.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
        setAppliedCustomRange({ ...customRange });
        setHistoryRange("custom");
      };

      let body;
      if (view.data !== null) {
        body = React.createElement("div", { className: "dsh-usage-stack" },
          React.createElement(UsageBalance, {
            data: view.data,
            history,
            historyRange,
            customRange,
            appliedCustomRange,
            selectedMonth,
            onHistoryRange: setHistoryRange,
            onCustomRange: setCustomRange,
            onApplyCustomRange: applyCustomRange,
            onSelectMonth: setSelectedMonth,
            onClearMonth: clearMonth,
            onResetHistory: resetHistory,
            onRefresh: refresh,
            t,
          }),
          view.error !== ""
            ? React.createElement("div", { className: "dsh-usage-inline-error" },
                fill(t("error.lastRefresh"), { error: view.error }))
            : null,
        );
      } else if (view.refreshing) {
        body = React.createElement("div", { className: "dsh-usage-state" }, t("state.querying"));
      } else if (view.error !== "") {
        body = React.createElement("div", { className: "dsh-usage-error" },
          React.createElement("div", { className: "dsh-usage-error-text" }, view.error),
          React.createElement(ActionButton, { variant: "outline", onClick: refresh }, t("action.retry")),
        );
      } else {
        body = React.createElement("div", { className: "dsh-usage-state" }, t("state.empty"));
      }

      const now = Date.now();
      // Deliberately stable: a title that changed on every background refresh
      // would re-open its tooltip under a resting pointer.
      const buttonTitle = config.auto
        ? fill(t("button.titleAuto"), { interval: minutesLabel(t, config.intervalMs) })
        : t("button.titleManual");

      return React.createElement(React.Fragment, null,
        React.createElement("style", {
          "data-plugin-css": "dsh-model-usage/styles",
          dangerouslySetInnerHTML: { __html: STYLES },
        }),
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-btn" + (view.refreshing ? " dsh-usage-btn-busy" : ""),
          title: buttonTitle,
          onClick: () => { setOpen(true); },
        }, t("button.label")),
        React.createElement(UsageModal, {
          open,
          onClose: () => { setOpen(false); },
          title: t("button.label"),
          closeLabel: t("action.close"),
          footer: React.createElement(React.Fragment, null,
            React.createElement(ActionButton, { variant: "ghost", onClick: openInfo }, t("action.info")),
            React.createElement(ActionButton, { variant: "primary", onClick: () => { setOpen(false); } }, t("action.close")),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement(RefreshStatus, {
              view,
              config,
              now,
              onToggleAuto: toggleAuto,
              onOpenSettings: openSettings,
              t,
            }),
            React.createElement(ModelBar, { override, effective, onOpen: openPicker, t }),
            body,
          ))),
        React.createElement(UsageModal, {
          open: pickerOpen,
          onClose: closePicker,
          title: t("picker.title"),
          closeLabel: t("action.cancel"),
          footer: React.createElement(React.Fragment, null,
            React.createElement(ActionButton, { variant: "outline", onClick: closePicker }, t("action.cancel")),
            React.createElement(ActionButton, { variant: "ghost", onClick: pickAuto }, t("action.auto")),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement("div", { className: "dsh-usage-hint" }, t("picker.hint")),
            dialogError !== "" ? React.createElement("div", { className: "dsh-usage-inline-error" }, dialogError) : null,
            React.createElement(ModelPicker, { catalog, override, onAuto: pickAuto, onPick: pickModel, t }),
          ))),
        React.createElement(UsageModal, {
          open: settingsOpen,
          onClose: closeSettings,
          title: t("settings.title"),
          closeLabel: t("action.cancel"),
          footer: React.createElement(React.Fragment, null,
            React.createElement(ActionButton, { variant: "outline", onClick: closeSettings }, t("action.cancel")),
            React.createElement(ActionButton, { variant: "primary", onClick: saveSettings }, t("action.save")),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement(RefreshSettings, { form, onChange: setForm, t }))),
        React.createElement(UsageModal, {
          open: infoOpen,
          onClose: closeInfo,
          title: t("info.title"),
          closeLabel: t("action.close"),
          footer: React.createElement(ActionButton, { variant: "primary", onClick: closeInfo }, t("action.close")),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement("div", { className: "dsh-usage-hint" }, t("info.hint")),
            dialogError !== "" ? React.createElement("div", { className: "dsh-usage-inline-error" }, dialogError) : null,
            React.createElement(ProviderInfo, { providers, t }),
          ))),
      );
    }

    function apply(ctx) {
      // Copy lives in the Client locale service, so a language switch re-renders
      // this cell. The service is read through `ctx.get()` rather than declared
      // as a hard dependency: a composition that does not mount it still gets
      // the panel (in the Chinese source language) instead of no panel at all.
      const locale = typeof ctx.get === "function" ? ctx.get("locale") : undefined;
      let t = (key) => (zh[key] ?? key);
      if (locale !== undefined && typeof locale.register === "function" && typeof locale.bind === "function") {
        ctx.effect(() => locale.register(NS, { zh, en }), "model-usage: dictionaries");
        t = locale.bind(NS);
      }
      /**
       * One JSON read from a host route. A refused request (the trust fence
       * answers 401/403) becomes a readable error instead of a JSON parse
       * failure, so the panel says what happened.
       */
      const readEnvelope = (res) => {
        if (res.ok) return res.json();
        throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
      };
      /** Ask the host for the usage of one conversation model (secrets stay host-side). */
      const fetchBalance = (selection) => {
        const payload = {};
        if (selection?.provider) payload.provider = selection.provider;
        if (selection?.model) payload.model = selection.model;
        if (selection?.effort) payload.reasoningEffort = selection.effort;
        if (selection?.sessionId) payload.sessionId = selection.sessionId;
        // The host itself gives up after 30s; this is the outer guard that makes
        // sure a stranded request cannot keep the single in-flight slot busy and
        // silently stop every later auto refresh.
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timer = controller === null ? null : setTimeout(() => { controller.abort(); }, 45000);
        return fetch(ROUTE_BALANCE, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          ...(controller === null ? {} : { signal: controller.signal }),
        })
          .then(readEnvelope)
          .finally(() => { if (timer !== null) clearTimeout(timer); });
      };
      /** Read-only provider/credential directory (reference names only). */
      const fetchProviders = () => fetch(ROUTE_PROVIDERS).then(readEnvelope);
      /** Routable models + per-route usage kind, for the manual picker. */
      const fetchModels = () => fetch(ROUTE_MODELS).then(readEnvelope);
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
        name: "conversation.session.header.utilities",
        id: "model-usage",
        order: 100,
        locale: NS,
        label: () => t("button.label"),
        inject: () => ({ fetchBalance, fetchProviders, fetchModels, t }),
      }, UsageAction));
    }

    // `slots` is the one hard dependency (the cell is the whole point); every
    // other service, locale included, is read through `ctx.get()` so the plugin
    // mounts in as many compositions as possible.
    const inject = ["slots"];

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
