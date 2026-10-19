// Browser half of dsh-model-usage — a hand-built client bundle in the
// closure-factory format client-modules expects. It registers one entry into
// the session header's right-aligned utilities slot ('用量') and renders a
// modal with the usage of the model THIS CONVERSATION is running on: the model
// comes from the Session's `modelSelection` projection (the same fact the model
// picker shows), the key comes from that provider's own credential reference on
// the host, and the numbers come from the matching usage API (Command Code,
// DeepSeek, OpenCode Go, OpenRouter, Moonshot, SiliconFlow, or a New API
// deployment). The host resolves and holds every secret; this half only ever
// sees the normalized payload plus the credential REFERENCE NAME.
//
// Refreshing is a background concern, not a click handler: this cell mounts
// with the session view, so it queries once on mount (and on every model
// switch) and then keeps the numbers warm on its own timer while 自动刷新 is on.
// Opening the panel shows what is already known — a query only starts when the
// numbers are older than the configured interval, and even then the last
// numbers stay on screen under a 刷新中 marker until the new ones land. The
// status line then reads 刷新时间：刚刚. Interval and toggle live in
// localStorage (`dsh-model-usage:refresh`). The 说明 dialog lists the provider
// routes the deployment declares and whether each key is configured.
// React and the primitives (Button/Modal) resolve from the loader's module
// table.
window.__ModuleLoader__.load({
  id: "dsh-model-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { Button, Modal } = require("@deepseek-ai/dsh-client-ui-primitives");

    // One owned stylesheet, injected once (idempotent under re-evaluation).
    if (typeof document !== "undefined"
        && document.querySelector('style[data-plugin-css="dsh-model-usage/styles"]') === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-model-usage";
      tag.dataset.pluginCss = "dsh-model-usage/styles";
      tag.textContent = [
        "@keyframes dsh-usage-spin { to { transform: rotate(360deg); } }",
        "@keyframes dsh-usage-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }",
        ".dsh-usage-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 6px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 18px; color: var(--dsw-alias-label-primary); background: transparent; font-family: var(--dsw-font-family); font-size: 13px; font-weight: 400; line-height: 20px; cursor: pointer; }",
        ".dsh-usage-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }",
        ".dsh-usage-btn-busy::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); animation: dsh-usage-pulse 1.2s ease-in-out infinite; }",
        ".dsh-usage-state { padding: 12px 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-error { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 4px 0; }",
        ".dsh-usage-error-text { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
        ".dsh-usage-inline-error { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); word-break: break-all; }",
        ".dsh-usage-stack { display: flex; flex-direction: column; gap: 10px; }",
        ".dsh-usage-status-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }",
        ".dsh-usage-status { display: inline-flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
        ".dsh-usage-status-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
        ".dsh-usage-status-actions { display: inline-flex; align-items: center; gap: 6px; }",
        ".dsh-usage-spinner { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l2); border-top-color: var(--dsw-alias-label-primary); animation: dsh-usage-spin 0.8s linear infinite; }",
        ".dsh-usage-chip { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 13px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: var(--dsw-font-family); font-size: 12px; line-height: 18px; cursor: pointer; }",
        ".dsh-usage-chip:hover { background: var(--dsw-alias-interactive-bg-hover); }",
        ".dsh-usage-chip-active { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-state-success-primary); }",
        ".dsh-usage-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 230px; }",
        ".dsh-usage-modelbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
        ".dsh-usage-modelbar-label { flex: 0 0 auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-balance-card { border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }",
        ".dsh-usage-balance-card-title { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 500; line-height: 22px; color: var(--dsw-alias-label-primary); }",
        ".dsh-usage-balance-status { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-balance-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
        ".dsh-usage-balance-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-balance-value { font-size: 14px; line-height: 22px; font-weight: 500; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }",
        ".dsh-usage-refresh { display: flex; justify-content: flex-end; }",
        ".dsh-usage-meta { border-top: 1px solid var(--dsw-alias-border-l2); padding-top: 10px; display: flex; flex-direction: column; gap: 4px; }",
        ".dsh-usage-meta-row { display: flex; gap: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-meta-key { flex: 0 0 auto; }",
        ".dsh-usage-meta-val { flex: 1 1 auto; word-break: break-all; font-variant-numeric: tabular-nums; }",
        ".dsh-usage-form { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }",
        ".dsh-usage-field { display: flex; flex-direction: column; gap: 6px; }",
        ".dsh-usage-field-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-input { height: 34px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-specific-input-major); color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-family); font-size: 13px; line-height: 20px; }",
        ".dsh-usage-mode-toggle { display: flex; flex-wrap: wrap; gap: 8px; }",
        ".dsh-usage-mode-btn { display: inline-flex; align-items: center; justify-content: center; height: 30px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: var(--dsw-font-family); font-size: 13px; line-height: 20px; cursor: pointer; }",
        ".dsh-usage-mode-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }",
        ".dsh-usage-mode-btn-active { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }",
        ".dsh-usage-cc-window { display: flex; flex-direction: column; gap: 6px; }",
        ".dsh-usage-cc-window-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }",
        ".dsh-usage-cc-window-val { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }",
        ".dsh-usage-cc-bar { height: 8px; border-radius: 4px; background: var(--dsw-alias-interactive-bg-hover); overflow: hidden; }",
        ".dsh-usage-cc-bar-fill { height: 100%; border-radius: 4px; background: var(--dsw-alias-state-success-primary); }",
        ".dsh-usage-cc-bar-fill-warn { background: var(--dsw-alias-state-warn-primary); }",
        ".dsh-usage-cc-bar-fill-danger { background: var(--dsw-alias-state-error-primary); }",
        ".dsh-usage-cc-reset { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }",
        // The Modal primitive centers its card in a 24px-inset overlay and leaves
        // height to the consumer ("consumers cap growth with max-height: 100%"),
        // so every dialog here caps itself and scrolls its own body instead of
        // growing past the top and bottom of the window.
        ".dsh-usage-modal-dialog { max-height: 100%; }",
        ".dsh-usage-modal-body { max-height: max(140px, calc(100vh - 260px)); overflow-y: auto; overscroll-behavior: contain; }",
        ".dsh-usage-provider-list { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; overflow: hidden; }",
        ".dsh-usage-provider-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; }",
        ".dsh-usage-provider-row + .dsh-usage-provider-row { border-top: 1px solid var(--dsw-alias-border-l2); }",
        ".dsh-usage-provider-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }",
        ".dsh-usage-provider-meta { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); word-break: break-all; }",
        ".dsh-usage-provider-toggle { display: flex; justify-content: center; }",
        ".dsh-usage-raw { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); word-break: break-all; max-height: 140px; overflow: auto; border-radius: 8px; padding: 8px 10px; background: var(--dsw-alias-interactive-bg-hover); }",
      ].join("\n");
      document.head.appendChild(tag);
    }

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

    function minutesLabel(ms) {
      const minutes = ms / 60000;
      return Number.isInteger(minutes) ? `${minutes} 分钟` : `${minutes.toFixed(1)} 分钟`;
    }

    /** Human age of one refresh: 刚刚 / N 分钟前 / N 小时前 / N 天前. */
    function formatAge(ms) {
      if (!Number.isFinite(ms) || ms < 60000) return "刚刚";
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return `${minutes} 分钟前`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} 小时前`;
      return `${Math.floor(hours / 24)} 天前`;
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

    function refreshButton(onRefresh) {
      return React.createElement("div", { className: "dsh-usage-refresh" },
        React.createElement(Button, { variant: "ghost", onClick: onRefresh }, "刷新"),
      );
    }

    /** Format a duration (ms) as "Xh Ym" / "Xd Yh", falling back to "已重置". */
    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return "已重置";
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
    function CcWindowMeter({ label, used, cap, resetAt, now }) {
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
          `已用 ${Math.round(pct)}% · ${resetIn > 0 ? `重置还有 ${formatDuration(resetIn)}` : "窗口已重置"}`),
      );
    }

    /** Command Code route: plan windows + credits, normalized by the host. */
    function CommandCodeCard({ data }) {
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
            d.status === "active" ? "订阅中" : String(d.status ?? "")),
        ),
        windows !== null && windows.limited
          ? React.createElement("div", { className: "dsh-usage-stack" },
              windows.fiveHour !== null && windows.fiveHour.cap > 0
                ? React.createElement(CcWindowMeter, { label: "5 小时窗口", ...windows.fiveHour, now })
                : null,
              windows.weekly !== null && windows.weekly.cap > 0
                ? React.createElement(CcWindowMeter, { label: "7 天窗口", ...windows.weekly, now })
                : null,
            )
          : row("窗口限制", "不适用", "cc-window"),
        React.createElement("div", { className: "dsh-usage-stack" },
          row("信用余额", `$${(credits.totalRemaining ?? 0).toFixed(2)}`, "cc-total"),
          row("月度剩余", `$${(credits.monthlyRemaining ?? 0).toFixed(2)}`, "cc-monthly"),
          row("已花费", `$${(credits.totalSpent ?? 0).toFixed(2)}`, "cc-spent"),
          row("请求数", String(credits.totalCount ?? 0), "cc-count"),
          d.account !== null && d.account !== undefined ? row("账户", String(d.account), "cc-account") : null,
          cycleEnd !== null ? row("本期截止", cycleEnd, "cc-cycle") : null,
        ),
      );
    }

    /** Official DeepSeek route: one card per currency, 余额 only. */
    function DeepSeekCard({ data }) {
      const infos = Array.isArray(data.data.balance_infos) ? data.data.balance_infos : [];
      if (infos.length === 0) {
        return React.createElement("div", { className: "dsh-usage-balance-card" },
          row("余额", "接口未返回 balance_infos", "balance-empty"));
      }
      return React.createElement("div", { className: "dsh-usage-stack" },
        infos.map((info) => React.createElement(
          "div",
          { key: info.currency, className: "dsh-usage-balance-card" },
          React.createElement("div", { className: "dsh-usage-balance-card-title" },
            info.currency === "CNY" ? "人民币（CNY）" : String(info.currency),
            React.createElement("span", { className: "dsh-usage-balance-status" },
              data.data.is_available === true ? "账户可用" : "账户不可用"),
          ),
          row("余额", currencySymbol(info.currency) + String(info.total_balance), "balance"),
        )));
    }

    /** DeepSeek account route: platform wallets (recharge + bonus). */
    function DeepSeekAccountCard({ data }) {
      const wallets = Array.isArray(data.data.wallets) ? data.data.wallets : [];
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" }, "DeepSeek 账户"),
        wallets.length === 0
          ? row("余额", "账户没有可用钱包", "account-empty")
          : React.createElement("div", { className: "dsh-usage-stack" },
              wallets.map((wallet, index) => row(
                wallet.currency === "CNY" ? "人民币（CNY）" : String(wallet.currency),
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
    function UsageRowsCard({ data }) {
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
                label: String(w.label ?? "窗口"),
                used: Number(w.used ?? 0),
                cap: Number(w.limit ?? 0),
                resetAt: Number(w.resetsAt ?? 0),
                now,
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
          ? React.createElement("div", { className: "dsh-usage-hint" },
              "接口返回的字段还没被识别，下面是原始返回（可以发给我做校准）")
          : null,
        d.raw === undefined || d.raw === null
          ? null
          : React.createElement("div", { className: "dsh-usage-stack" },
              React.createElement("div", { className: "dsh-usage-provider-toggle" },
                React.createElement("button", {
                  type: "button",
                  className: "dsh-usage-chip",
                  onClick: () => { setShowRaw(!showRaw); },
                }, showRaw ? "隐藏原始返回" : "原始返回")),
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
    function NewApiCard({ data }) {
      const d = data.data;
      const symbol = unitSymbol(d.unit);
      return React.createElement("div", { className: "dsh-usage-balance-card" },
        React.createElement("div", { className: "dsh-usage-balance-card-title" }, String(d.planName)),
        row("余额", symbol + String(d.remaining), "remaining"),
        row("已用", symbol + String(d.used), "used"),
        row("总额", symbol + String(d.total), "total"),
      );
    }

    /**
     * The model, provider and credential REFERENCE the numbers came from — the
     * answer to "which key was this queried with", never the key itself.
     */
    function UsageMeta({ data }) {
      const credential = data.credential;
      const usageUrl = data.data?.usageUrl;
      return React.createElement("div", { className: "dsh-usage-meta" },
        React.createElement("div", { className: "dsh-usage-meta-row" },
          React.createElement("span", { className: "dsh-usage-meta-key" }, "模型"),
          React.createElement("span", { className: "dsh-usage-meta-val" },
            `${data.providerName ?? data.provider} / ${data.model}${data.reasoningEffort ? ` · ${data.reasoningEffort}` : ""}`),
        ),
        credential !== null && credential !== undefined
          ? React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, "密钥"),
              React.createElement("span", { className: "dsh-usage-meta-val" },
                `${credential.ref}${credential.source ? ` · ${credential.source}` : ""}`),
            )
          : React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, "密钥"),
              React.createElement("span", { className: "dsh-usage-meta-val" }, "账户登录（无 API Key）"),
            ),
        typeof usageUrl === "string" && usageUrl !== ""
          ? React.createElement("div", { className: "dsh-usage-meta-row" },
              React.createElement("span", { className: "dsh-usage-meta-key" }, "用量页"),
              React.createElement("span", { className: "dsh-usage-meta-val" }, usageUrl),
            )
          : null,
      );
    }

    function UsageBalance({ data, onRefresh }) {
      let card;
      if (data.mode === "commandcode") card = React.createElement(CommandCodeCard, { data });
      else if (data.mode === "newapi") card = React.createElement(NewApiCard, { data });
      else if (data.mode === "deepseek-account") card = React.createElement(DeepSeekAccountCard, { data });
      else if (data.mode === "opencode-go" || data.mode === "openrouter"
          || data.mode === "moonshot" || data.mode === "siliconflow") {
        card = React.createElement(UsageRowsCard, { data });
      } else card = React.createElement(DeepSeekCard, { data });
      return React.createElement("div", { className: "dsh-usage-stack" },
        card,
        React.createElement(UsageMeta, { data }),
        refreshButton(onRefresh),
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
    function RefreshStatus({ view, config, now, onToggleAuto, onOpenSettings }) {
      const age = view.updatedAt > 0 ? now - view.updatedAt : null;
      const label = age === null ? null : formatAge(age);
      const stale = !view.refreshing && age !== null && age > config.intervalMs;
      let text;
      if (view.refreshing) text = label === null ? "刷新中…" : `刷新中… · 当前显示 ${label}数据`;
      else if (label === null) text = "尚未刷新";
      else text = `刷新时间：${label}${stale ? ` · 已超过刷新间隔（${minutesLabel(config.intervalMs)}）` : ""}`;
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
              ? `每 ${minutesLabel(config.intervalMs)}在后台刷新（关闭弹窗也生效）`
              : "后台自动刷新已关闭，仅在打开弹窗且数据过期时查询",
          }, `自动刷新：${config.auto ? "开" : "关"}`),
          React.createElement("button", {
            type: "button",
            className: "dsh-usage-chip",
            onClick: onOpenSettings,
          }, "刷新设置"),
        ),
      );
    }

    /** 刷新设置 form: the auto-refresh switch, preset intervals, and a custom one. */
    function RefreshSettings({ form, onChange }) {
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
          React.createElement("span", { className: "dsh-usage-field-label" }, "后台自动刷新"),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            chip("开启", form.auto === true, () => set({ auto: true })),
            chip("关闭", form.auto === false, () => set({ auto: false })),
          ),
          React.createElement("span", { className: "dsh-usage-hint" },
            "开启后，即使用量弹窗没打开，也会按下面的间隔在后台查询并更新；打开弹窗时直接显示最近一次结果。"),
        ),
        React.createElement("div", { className: "dsh-usage-field" },
          React.createElement("span", { className: "dsh-usage-field-label" }, "刷新间隔"),
          React.createElement("div", { className: "dsh-usage-mode-toggle" },
            INTERVAL_PRESETS.map((value) => chip(`${value} 分钟`, Number(form.minutes) === value, () => set({ minutes: String(value) }), `preset-${value}`)),
          ),
          React.createElement("input", {
            className: "dsh-usage-input",
            type: "number",
            min: 1,
            max: 1440,
            step: 1,
            value: form.minutes,
            onChange: (event) => set({ minutes: event.target.value }),
          }),
          React.createElement("span", { className: "dsh-usage-hint" },
            valid
              ? "也可以直接填写分钟数（1–1440）。"
              : "请填写 1–1440 之间的分钟数。"),
        ),
        React.createElement("span", { className: "dsh-usage-hint" },
          "上次刷新超过刷新间隔时，打开弹窗会先显示上次的用量并标记「刷新中…」，查询完成后自动更新为「刷新时间：刚刚」。"),
      );
    }

    /**
     * Read the current conversation's model selection. The host always passes
     * `useProjection` for Session slots; the guard keeps the panel alive in a
     * composition that omits it.
     */
    function useModelSelection(props) {
      const useProjection = props.useProjection;
      const projected = typeof useProjection === "function" ? useProjection("modelSelection") : undefined;
      // `next` is the durable intent, `lastUsed` the last request route.
      return projected?.next ?? projected?.lastUsed ?? null;
    }

    /**
     * The 说明 dialog: which provider routes exist and whether each key is set.
     * A deployment can declare dozens of routes (`llm-pi-ai` ships a whole
     * catalog), so the ones that matter — routes with a usage API or a
     * configured key — come first, and the rest wait behind a toggle.
     */
    function ProviderInfo({ providers }) {
      const [expanded, setExpanded] = React.useState(false);
      if (providers === null) {
        return React.createElement("div", { className: "dsh-usage-state" }, "读取中…");
      }
      if (providers.length === 0) {
        return React.createElement("div", { className: "dsh-usage-state" }, "当前部署没有声明任何模型供应商");
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
          `共 ${sorted.length} 个供应商路由 · ${configured} 个密钥已配置 · ${supported} 个支持用量查询`),
        React.createElement("div", { className: "dsh-usage-provider-list" },
          visible.map((entry) => React.createElement("div", {
            key: entry.provider,
            className: "dsh-usage-provider-row",
          },
            React.createElement("div", { className: "dsh-usage-provider-head" },
              React.createElement("span", null, String(entry.displayName)),
              React.createElement("span", { className: "dsh-usage-balance-status" },
                entry.kind === null
                  ? (entry.configured ? "密钥已配置 · 不支持用量查询" : "不支持用量查询")
                  : (entry.configured ? "密钥已配置" : "密钥未配置")),
            ),
            React.createElement("div", { className: "dsh-usage-provider-meta" },
              `${entry.provider}${entry.kindLabel ? ` · ${entry.kindLabel}` : ""}${entry.credentialRef ? ` · ${entry.credentialRef}` : ""}`),
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
              }, expanded ? "只看已配置 / 支持用量的" : `显示其余 ${hidden} 个未配置路由`))
          : null,
      );
    }

    /**
     * The query-target row: which route the numbers belong to, and the manual
     * override that can point the panel somewhere other than the conversation.
     */
    function ModelBar({ override, effective, onOpen }) {
      const label = override !== null
        ? `${override.provider}${override.model ? ` / ${override.model}` : ""}`
        : (effective === null
            ? "自动 · 跟随当前对话"
            : `自动 · ${effective.provider}${effective.model ? ` / ${effective.model}` : ""}`);
      return React.createElement("div", { className: "dsh-usage-modelbar" },
        React.createElement("span", { className: "dsh-usage-modelbar-label" }, "查询对象"),
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-chip" + (override === null ? "" : " dsh-usage-chip-active"),
          title: override === null
            ? "当前跟随对话使用的模型，点击可手动切换"
            : "手动指定的模型，点击可切换或改回自动",
          onClick: onOpen,
        }, React.createElement("span", { className: "dsh-usage-chip-text" }, label)),
      );
    }

    /**
     * The 选择模型 dialog: 自动 (follow the conversation) plus every routable
     * route, so usage can be checked for a provider the conversation is not on.
     */
    function ModelPicker({ catalog, override, onAuto, onPick }) {
      if (catalog === null) {
        return React.createElement("div", { className: "dsh-usage-state" }, "读取中…");
      }
      const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
      const head = React.createElement("div", { className: "dsh-usage-stack" },
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-mode-btn" + (override === null ? " dsh-usage-mode-btn-active" : ""),
          onClick: onAuto,
        }, "自动（跟随当前对话）"),
        catalog.default === null || catalog.default === undefined
          ? null
          : React.createElement("div", { className: "dsh-usage-hint" },
              `部署默认：${catalog.default.provider}${catalog.default.model ? ` / ${catalog.default.model}` : ""}`),
      );
      if (groups.length === 0) {
        return React.createElement("div", { className: "dsh-usage-stack" }, head,
          React.createElement("div", { className: "dsh-usage-state" }, "当前没有可路由的模型（检查 设置 → 模型）"));
      }
      return React.createElement("div", { className: "dsh-usage-stack" }, head,
        groups.map((group) => React.createElement("div", {
          key: group.provider,
          className: "dsh-usage-balance-card",
        },
          React.createElement("div", { className: "dsh-usage-balance-card-title" },
            String(group.name),
            React.createElement("span", { className: "dsh-usage-balance-status" }, String(group.kindLabel))),
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
      const [config, setConfig] = React.useState(readRefreshConfig);
      const [form, setForm] = React.useState({ auto: true, minutes: "5" });
      const [view, setView] = React.useState({ refreshing: false, data: null, error: "", updatedAt: 0 });
      const [, forceRender] = React.useState(0);
      const viewRef = React.useRef(view);
      const inFlight = React.useRef(false);
      const generation = React.useRef(0);
      viewRef.current = view;

      /** One usage query; concurrent calls collapse into the first one. */
      const refresh = React.useCallback(() => {
        if (inFlight.current) return;
        inFlight.current = true;
        const gen = generation.current;
        setView((s) => ({ ...s, refreshing: true, error: "" }));
        fetchBalance({ provider, model, effort, sessionId })
          .then((result) => {
            // A model switch bumped the generation: this answer is for a route
            // the panel no longer shows, so it must not write anything.
            if (gen !== generation.current) return;
            inFlight.current = false;
            if (result.ok) {
              setView((s) => ({ ...s, refreshing: false, data: result.value, error: "", updatedAt: Date.now() }));
            } else {
              // Keep the last numbers: a failed background refresh must not
              // blank out what the user was reading.
              setView((s) => ({ ...s, refreshing: false, error: result.error.message }));
            }
          })
          .catch((err) => {
            if (gen !== generation.current) return;
            inFlight.current = false;
            setView((s) => ({ ...s, refreshing: false, error: String(err) }));
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
        setView({ refreshing: false, data: null, error: "", updatedAt: 0 });
        refresh();
      }, [refresh]);

      // Background auto refresh: lives with the cell, not with the modal, so the
      // numbers stay warm while the panel is closed.
      React.useEffect(() => {
        if (!config.auto) return undefined;
        const id = setInterval(() => { refresh(); }, config.intervalMs);
        return () => { clearInterval(id); };
      }, [config.auto, config.intervalMs, refresh]);

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
        setInfoOpen(true);
        fetchProviders()
          .then((result) => setProviders(result.ok ? result.value : []))
          .catch(() => setProviders([]));
      };
      const closeInfo = () => {
        setInfoOpen(false);
        setOpen(true);
      };
      const openPicker = () => {
        setOpen(false);
        setCatalog(null);
        setPickerOpen(true);
        fetchModels()
          .then((result) => setCatalog(result.ok ? result.value : { groups: [], default: null }))
          .catch(() => setCatalog({ groups: [], default: null }));
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

      let body;
      if (view.data !== null) {
        body = React.createElement("div", { className: "dsh-usage-stack" },
          React.createElement(UsageBalance, { data: view.data, onRefresh: refresh }),
          view.error !== ""
            ? React.createElement("div", { className: "dsh-usage-inline-error" }, `上次刷新失败：${view.error}`)
            : null,
        );
      } else if (view.refreshing) {
        body = React.createElement("div", { className: "dsh-usage-state" }, "查询中…");
      } else if (view.error !== "") {
        body = React.createElement("div", { className: "dsh-usage-error" },
          React.createElement("div", { className: "dsh-usage-error-text" }, view.error),
          React.createElement(Button, { variant: "outline", onClick: refresh }, "重试"),
        );
      } else {
        body = React.createElement("div", { className: "dsh-usage-state" }, "暂无数据");
      }

      const now = Date.now();
      // Deliberately stable: a title that changed on every background refresh
      // would re-open its tooltip under a resting pointer.
      const buttonTitle = `用量（${config.auto ? `每 ${minutesLabel(config.intervalMs)}自动刷新` : "自动刷新已关闭"}）`;

      return React.createElement(React.Fragment, null,
        React.createElement("button", {
          type: "button",
          className: "dsh-usage-btn" + (view.refreshing ? " dsh-usage-btn-busy" : ""),
          title: buttonTitle,
          onClick: () => { setOpen(true); },
        }, "用量"),
        React.createElement(Modal, {
          open,
          onClose: () => { setOpen(false); },
          title: "用量",
          closeLabel: "关闭",
          className: "dsh-usage-modal-dialog",
          footer: React.createElement(React.Fragment, null,
            React.createElement(Button, { variant: "ghost", onClick: openInfo }, "说明"),
            React.createElement(Button, { variant: "primary", onClick: () => { setOpen(false); } }, "关闭"),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement(RefreshStatus, {
              view,
              config,
              now,
              onToggleAuto: toggleAuto,
              onOpenSettings: openSettings,
            }),
            React.createElement(ModelBar, { override, effective, onOpen: openPicker }),
            body,
          ))),
        React.createElement(Modal, {
          open: pickerOpen,
          onClose: closePicker,
          title: "选择模型",
          closeLabel: "取消",
          className: "dsh-usage-modal-dialog",
          footer: React.createElement(React.Fragment, null,
            React.createElement(Button, { variant: "outline", onClick: closePicker }, "取消"),
            React.createElement(Button, { variant: "ghost", onClick: pickAuto }, "改回自动"),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement("div", { className: "dsh-usage-hint" },
              "选一个供应商的模型来查询它的用量；这不改变当前对话使用的模型，只改变插件查询的对象。"),
            React.createElement(ModelPicker, { catalog, override, onAuto: pickAuto, onPick: pickModel }),
          ))),
        React.createElement(Modal, {
          open: settingsOpen,
          onClose: closeSettings,
          title: "刷新设置",
          closeLabel: "取消",
          className: "dsh-usage-modal-dialog",
          footer: React.createElement(React.Fragment, null,
            React.createElement(Button, { variant: "outline", onClick: closeSettings }, "取消"),
            React.createElement(Button, { variant: "primary", onClick: saveSettings }, "保存"),
          ),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement(RefreshSettings, { form, onChange: setForm }))),
        React.createElement(Modal, {
          open: infoOpen,
          onClose: closeInfo,
          title: "用量说明",
          closeLabel: "关闭",
          className: "dsh-usage-modal-dialog",
          footer: React.createElement(Button, {
            variant: "primary",
            onClick: closeInfo,
          }, "关闭"),
        }, React.createElement("div", { className: "dsh-usage-modal-body" },
          React.createElement("div", { className: "dsh-usage-stack" },
            React.createElement("div", { className: "dsh-usage-hint" },
              "用量按「当前对话使用的模型」查询：模型来自会话的模型选择，密钥来自该供应商自己的凭据引用（设置 → 模型 里填写），不会使用其它供应商的 key。"),
            React.createElement(ProviderInfo, { providers }),
          ))),
      );
    }

    function apply(ctx) {
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
        return fetch("/model-usage/balance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          ...(controller === null ? {} : { signal: controller.signal }),
        })
          .then((res) => res.json())
          .finally(() => { if (timer !== null) clearTimeout(timer); });
      };
      /** Read-only provider/credential directory (reference names only). */
      const fetchProviders = () => fetch("/model-usage/providers").then((res) => res.json());
      /** Routable models + per-route usage kind, for the manual picker. */
      const fetchModels = () => fetch("/model-usage/models").then((res) => res.json());
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
        name: "conversation.session.header.utilities",
        id: "model-usage",
        order: 100,
        inject: () => ({ fetchBalance, fetchProviders, fetchModels }),
      }, UsageAction));
    }

    const inject = ["slots", "connection"];

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
