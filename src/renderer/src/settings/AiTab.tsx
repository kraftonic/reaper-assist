import { useEffect, useState } from "react";
import { PROVIDERS, PROVIDER_IDS, type Effort, type ProviderId, type SettingsView } from "@shared/types";
import { api } from "../api";
import { Icon } from "../Icon";
import type { Props } from "./types";

export function AiTab({ settings, setSettings, update }: Props) {
  const [open, setOpen] = useState<ProviderId>(settings.activeProvider);
  return (
    <div className="stack">
      <p className="dim">
        {settings.cliAllowed ? "Use the Claude or ChatGPT plan you already pay for, or bring an API key. " : "Bring your own key. "}
        Keys are stored encrypted in your system keychain{settings.secureStorage ? "" : " (not available on this system)"} and are only sent to the provider you choose.
      </p>
      {PROVIDER_IDS.filter((id) => settings.cliAllowed || PROVIDERS[id].kind !== "cli").map((id) =>
        PROVIDERS[id].kind === "cli" ? (
          <CliCard key={id} id={id} settings={settings} update={update} open={open === id} onOpen={() => setOpen(open === id ? ("" as ProviderId) : id)} />
        ) : (
        <ProviderCard key={id} id={id} settings={settings} setSettings={setSettings} update={update} open={open === id} onOpen={() => setOpen(open === id ? ("" as ProviderId) : id)} />
        ),
      )}
      <label className="toggle">
        <input type="checkbox" checked={settings.webAccess} onChange={(e) => update({ webAccess: e.target.checked })} />
        <span>Web access: let the assistant search the web and read pages</span>
      </label>
      <p className="dim">Searches go through your AI provider. With a Claude API key, Anthropic bills each search (about 1 cent).</p>
      <label className="field">
        <span>Thinking effort (Claude API key)</span>
        <select value={settings.effort} onChange={(e) => update({ effort: e.target.value as Effort })}>
          <option value="low">Low: fastest replies, good for quick questions</option>
          <option value="medium">Medium: balanced</option>
          <option value="high">High: careful, for multi-step DAW work</option>
          <option value="xhigh">Extra high</option>
          <option value="max">Max: slowest, most thorough</option>
        </select>
      </label>
    </div>
  );
}

/** A provider that runs the user's own Claude Code or Codex install with their subscription login. */
function CliCard({ id, settings, update, open, onOpen }: { id: ProviderId; settings: SettingsView; update: Props["update"]; open: boolean; onOpen: () => void }) {
  const info = PROVIDERS[id];
  const p = settings.providers[id];
  const active = settings.activeProvider === id;
  const [st, setSt] = useState<{ installed: boolean; loggedIn: boolean; detail: string } | null>(null);
  const check = async () => {
    setSt(null);
    setSt(await api.cliStatus(id));
  };
  useEffect(() => {
    if (open || active) void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const claude = id === "claude-cli";
  return (
    <div className={`card provider ${active ? "active" : ""}`}>
      <div className="card-head">
        <button className="card-title" onClick={onOpen} aria-expanded={open}>
          <span className={`chev ${open ? "open" : ""}`}>
            <Icon name="chevron" size={14} />
          </span>
          <span>{info.label}</span>
          <span className="tag">{st ? (st.loggedIn ? "signed in" : st.installed ? "not signed in" : "not installed") : "your plan"}</span>
        </button>
        <button className={`btn small ${active ? "primary" : ""}`} disabled={active} onClick={() => update({ activeProvider: id })}>
          {active ? "In use" : "Use"}
        </button>
      </div>
      {open && (
        <div className="card-body stack">
          <p className="small dim">
            Runs the {claude ? "Claude Code" : "Codex"} app already installed on this Mac, signed in with your own {claude ? "Claude" : "ChatGPT"} plan. No API key, no extra
            bill: it counts toward your plan's usage limits. It can only chat and use Assist's REAPER tools, with the same approvals as always.
          </p>
          <div className={`notice ${st ? (st.loggedIn ? "info" : "warn") : "info"}`}>
            {st ? st.detail : "Checking…"}{" "}
            <button className="link" onClick={check}>
              Check again
            </button>
          </div>
          {st && !st.installed && (
            <a className="small" href="#" onClick={(e) => (e.preventDefault(), api.openExternal(claude ? "https://claude.com/product/claude-code" : "https://developers.openai.com/codex/cli"))}>
              How to install {claude ? "Claude Code" : "Codex"} <Icon name="external" size={12} />
            </a>
          )}
          <label className="field">
            <span>Model</span>
            {claude ? (
              <select value={p.model || "default"} onChange={(e) => update({ providers: { [id]: { model: e.target.value } } })}>
                <option value="default">Your plan's default</option>
                <option value="opus">Opus: most capable</option>
                <option value="sonnet">Sonnet: balanced</option>
                <option value="haiku">Haiku: fastest, lightest on limits</option>
              </select>
            ) : (
              <input value={p.model === "default" ? "" : p.model} placeholder="Your Codex default" onChange={(e) => update({ providers: { [id]: { model: e.target.value.trim() || "default" } } })} spellCheck={false} />
            )}
          </label>
          <p className="small dim">Personal use on this Mac only. This option isn't included in builds for other people.</p>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ id, settings, setSettings, update, open, onOpen }: { id: ProviderId; settings: SettingsView; setSettings: (s: SettingsView) => void; update: Props["update"]; open: boolean; onOpen: () => void }) {
  const info = PROVIDERS[id];
  const p = settings.providers[id];
  const active = settings.activeProvider === id;
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>(info.suggestedModels);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = !info.needsKey || p.hasKey;

  const fetchModels = async () => {
    setLoading(true);
    const r = await api.listModels(id);
    setLoading(false);
    if (r.error) setStatus({ ok: false, message: r.error });
    else {
      const merged = Array.from(new Set([...info.suggestedModels, ...r.models]));
      setModels(merged);
      setStatus({ ok: true, message: `Connected. ${r.models.length} models available.` });
      if (!p.model && merged[0]) await update({ providers: { [id]: { model: merged[0] } } });
    }
  };

  useEffect(() => {
    if (open && ready && models.length <= info.suggestedModels.length) void fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);

  return (
    <div className={`card provider ${active ? "active" : ""}`}>
      <div className="card-head">
        <button className="card-title" onClick={onOpen} aria-expanded={open}>
          <span className={`chev ${open ? "open" : ""}`}>
            <Icon name="chevron" size={14} />
          </span>
          <span>{info.label}</span>
          {p.hasKey && <span className="tag">key ••{p.keyHint}</span>}
          {!info.needsKey && <span className="tag">local</span>}
        </button>
        <button className={`btn small ${active ? "primary" : ""}`} disabled={active} onClick={() => update({ activeProvider: id })}>
          {active ? "In use" : "Use"}
        </button>
      </div>
      {open && (
        <div className="card-body stack">
          {info.needsKey && (
            <div className="row">
              <input
                type="password"
                placeholder={p.hasKey ? `Saved (••••${p.keyHint}). Paste to replace` : "Paste API key"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="btn primary"
                disabled={!key.trim()}
                onClick={async () => {
                  try {
                    setSettings(await api.setApiKey(id, key));
                    setKey("");
                    await fetchModels();
                  } catch (e) {
                    setStatus({ ok: false, message: e instanceof Error ? e.message : String(e) });
                  }
                }}
              >
                Save
              </button>
              {p.hasKey && (
                <button className="btn" title="Remove key" onClick={async () => setSettings(await api.setApiKey(id, null))}>
                  <Icon name="trash" />
                </button>
              )}
            </div>
          )}
          {info.keyUrl && (
            <a className="small" href={info.keyUrl} onClick={(e) => (e.preventDefault(), api.openExternal(info.keyUrl!))}>
              Get a key <Icon name="external" size={12} />
            </a>
          )}
          <label className="field">
            <span>Model</span>
            <div className="row">
              <input list={`models-${id}`} value={p.model} placeholder="Model name" onChange={(e) => update({ providers: { [id]: { model: e.target.value } } })} spellCheck={false} />
              <datalist id={`models-${id}`}>
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <button className="btn" onClick={fetchModels} disabled={loading || !ready}>
                {loading ? "…" : "Refresh"}
              </button>
            </div>
          </label>
          <label className="field">
            <span>Endpoint</span>
            <input value={p.baseUrl} onChange={(e) => update({ providers: { [id]: { baseUrl: e.target.value } } })} spellCheck={false} />
          </label>
          {status && <div className={`notice ${status.ok ? "info" : "error"}`}>{status.message}</div>}
        </div>
      )}
    </div>
  );
}
