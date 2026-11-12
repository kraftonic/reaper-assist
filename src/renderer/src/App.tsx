import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROVIDERS, type ConversationSummary, type ConversationView, type DawStatus, type SettingsPatch, type SettingsView } from "@shared/types";
import { api } from "./api";
import { applyTheme, themeFor } from "./theme";
import { Chat } from "./chat/Chat";
import { Settings, type SettingsTab } from "./settings/Settings";
import { Icon } from "./Icon";
import { Studio, type StudioTab } from "./studio/Studio";
import { chipLabel, modelGroups, prettyModel } from "./chat/models";

export { chipLabel, prettyModel };

type View = { kind: "chat" } | { kind: "history" } | { kind: "settings"; tab: SettingsTab } | { kind: "studio"; tab: StudioTab };

export function App() {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [daw, setDaw] = useState<DawStatus | null>(null);
  const [conv, setConv] = useState<ConversationView | null>(null);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    void api.getSettings().then(setSettings);
    void api.dawStatus().then(setDaw);
    // "#conv-<id>" opens a saved chat (used for UI screenshots); otherwise start fresh.
    const open = /^#conv-([0-9a-f-]{36})$/.exec(location.hash)?.[1];
    void (open ? api.getConversation(open) : Promise.resolve(null)).then(async (c) => setConv(c ?? (await api.newConversation())));
    const offSettings = api.onSettings(setSettings);
    const offDaw = api.onDawStatus(setDaw);
    return () => (offSettings(), offDaw());
  }, []);

  const workflow = settings?.workflow ?? null;
  const theme = useMemo(() => themeFor(workflow), [workflow]);
  useEffect(() => applyTheme(theme), [theme]);

  const update = useCallback(async (p: SettingsPatch) => setSettings(await api.updateSettings(p)), []);

  const newChat = useCallback(async () => {
    setConv(await api.newConversation());
    setView({ kind: "chat" });
  }, []);

  const openHistory = useCallback(async () => {
    setHistory(await api.listConversations());
    setView((v) => (v.kind === "history" ? { kind: "chat" } : { kind: "history" }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void newChat();
      } else if (mod && e.key === ",") {
        e.preventDefault();
        setView({ kind: "settings", tab: "ai" });
      } else if (e.key === "Escape" && view.kind !== "chat") setView({ kind: "chat" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat, view.kind]);

  if (!settings || !conv) return <div className="app boot" />;

  const prov = settings.activeProvider;
  const model = settings.providers[prov].model;
  const needsSetup = PROVIDERS[prov].needsKey && !settings.providers[prov].hasKey;

  return (
    <div className="app">
      <header className={`titlebar ${api.platform === "darwin" ? "mac" : ""}`}>
        <div className="brand">
          <span className="logo" aria-hidden>
            <Icon name="wave" />
          </span>
          <span>Assist</span>
        </div>
        <ModelMenu settings={settings} needsSetup={needsSetup} update={update} onSettings={() => setView({ kind: "settings", tab: "ai" })} />
        <DawPill daw={daw} onClick={() => setView({ kind: "settings", tab: "daw" })} />
        <div className="spacer" />
        <nav className="tb-actions">
          <button className="icon-btn" onClick={newChat} title={`New chat (${api.platform === "darwin" ? "⌘N" : "Ctrl+N"})`}>
            <Icon name="plus" />
          </button>
          <button className={`icon-btn ${view.kind === "studio" ? "on" : ""}`} onClick={() => setView(view.kind === "studio" ? { kind: "chat" } : { kind: "studio", tab: "beats" })} title="Beats, sounds and plug-ins">
            <Icon name="grid" />
          </button>
          <button className={`icon-btn ${view.kind === "history" ? "on" : ""}`} onClick={openHistory} title="Chat history">
            <Icon name="history" />
          </button>
          <button className={`icon-btn ${settings.alwaysOnTop ? "on" : ""}`} onClick={() => update({ alwaysOnTop: !settings.alwaysOnTop })} title="Keep on top of the DAW">
            <Icon name="pin" />
          </button>
          <button className={`icon-btn ${view.kind === "settings" ? "on" : ""}`} onClick={() => setView(view.kind === "settings" ? { kind: "chat" } : { kind: "settings", tab: "ai" })} title={`Settings (${api.platform === "darwin" ? "⌘," : "Ctrl+,"})`}>
            <Icon name="gear" />
          </button>
        </nav>
      </header>

      <main className="body">
        <Chat key={conv.id} conv={conv} setConv={setConv} daw={daw} needsSetup={needsSetup} onSetup={() => setView({ kind: "settings", tab: "ai" })} hidden={view.kind !== "chat"} mode={settings.permissions.mode} setMode={(m) => void update({ permissions: { ...settings.permissions, mode: m } })} />
        {view.kind === "history" && (
          <section className="sheet">
            <h2>Chats</h2>
            {history.length === 0 && <p className="dim">No saved chats yet.</p>}
            <ul className="history">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    className="history-item"
                    onClick={async () => {
                      const c = await api.getConversation(h.id);
                      if (c) setConv(c);
                      setView({ kind: "chat" });
                    }}
                  >
                    <span className="title">{h.title}</span>
                    <span className="dim small">{new Date(h.updatedAt).toLocaleString()}</span>
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    onClick={async () => {
                      await api.deleteConversation(h.id);
                      setHistory(await api.listConversations());
                      if (conv.id === h.id) setConv(await api.newConversation());
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {view.kind === "studio" && <Studio daw={daw} tab={view.tab} setTab={(tab) => setView({ kind: "studio", tab })} />}
        {view.kind === "settings" && <Settings settings={settings} setSettings={setSettings} update={update} daw={daw} tab={view.tab} setTab={(tab) => setView({ kind: "settings", tab })} />}
      </main>
    </div>
  );
}

function DawPill({ daw, onClick }: { daw: DawStatus | null; onClick: () => void }) {
  if (!daw || daw.state === "disabled") return null;
  const label = daw.state === "connected" ? (daw.playState === "recording" ? "REC" : "REAPER") : "REAPER off";
  const cls = daw.state === "connected" ? (daw.playState === "recording" ? "rec" : "ok") : "off";
  return (
    <button className={`chip daw-pill ${cls}`} onClick={onClick} title={daw.state === "connected" ? `Connected to ${daw.project ?? "REAPER"}` : "REAPER isn't connected. Click to set up."}>
      <span className={`dot ${cls}`} />
      {label}
    </button>
  );
}

function initialView(): View {
  const h = location.hash.replace("#", "");
  if (h === "history") return { kind: "history" };
  const st = /^studio-(beats|sounds|plugins)$/.exec(h);
  if (st) return { kind: "studio", tab: st[1] as StudioTab };
  const m = /^settings-(ai|look|daw|general)$/.exec(h);
  return m ? { kind: "settings", tab: m[1] as SettingsTab } : { kind: "chat" };
}

/** The model chip: switch provider and model without leaving the chat. */
function ModelMenu({ settings, needsSetup, update, onSettings }: { settings: SettingsView; needsSetup: boolean; update: (p: SettingsPatch) => Promise<void>; onSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  const prov = settings.activeProvider;
  const model = settings.providers[prov].model;
  const groups = modelGroups(settings);
  const go = () => {
    setOpen(false);
    onSettings();
  };
  return (
    <div className="model-menu" ref={box}>
      <button className="chip model-chip" onClick={() => setOpen(!open)} title="Switch AI model" aria-haspopup="menu" aria-expanded={open}>
        <span className={`dot ${needsSetup ? "warn" : "ok"}`} />
        <span className="chip-text">{chipLabel(prov, model)}</span>
        <Icon name="down" size={11} />
      </button>
      {open && (
        <div className="menu model-pop" role="menu">
          {groups.map((g) => (
            <div key={g.provider} className="menu-group" role="group" aria-label={g.label}>
              <div className="menu-label">
                {g.label}
                {!g.ready && <span className="tag">needs a key</span>}
              </div>
              {g.models.length === 0 && (
                <button className="menu-item" role="menuitem" onClick={go}>
                  Pick a model…
                </button>
              )}
              {g.models.map((m) => {
                const on = g.provider === prov && (model || "default") === m.id;
                return (
                  <button
                    key={m.id}
                    role="menuitemradio"
                    aria-checked={on}
                    className={`menu-item ${on ? "on" : ""}`}
                    onClick={() => {
                      if (!g.ready) return go();
                      setOpen(false);
                      if (!on) void update({ activeProvider: g.provider, providers: { [g.provider]: { model: m.id } } });
                    }}
                  >
                    <span className="menu-main">{m.label}</span>
                    {on && <Icon name="check" size={12} />}
                  </button>
                );
              })}
            </div>
          ))}
          <button className="menu-item menu-foot" role="menuitem" onClick={go}>
            <Icon name="gear" size={12} /> <span className="menu-main">AI settings and keys…</span>
          </button>
        </div>
      )}
    </div>
  );
}
