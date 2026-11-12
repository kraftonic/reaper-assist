import { useEffect, useState } from "react";
import type { PermissionMode, PermissionRule } from "@shared/types";
import { api } from "../api";
import { MODE_LABEL } from "../chat/Chat";
import { Icon } from "../Icon";
import type { Props } from "./types";

export function DawTab({ settings, update, daw }: Props) {
  const [autostart, setAutostart] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const state = daw?.state ?? "waiting";
  const text: Record<string, string> = {
    disabled: "DAW control is off.",
    "not-installed": "The REAPER bridge isn't installed yet.",
    waiting: "Installed. Waiting for REAPER: open it and run the Assist bridge script.",
    stale: "REAPER stopped answering. Is it closed, or was the script stopped?",
    connected: `Connected to REAPER ${daw?.reaperVersion ?? ""}${daw?.project ? `: “${daw.project}”` : ""}`,
  };
  return (
    <div className="stack">
      <label className="toggle">
        <input type="checkbox" checked={settings.daw.enabled} onChange={(e) => update({ daw: { enabled: e.target.checked } })} />
        <span>Let Assist control REAPER</span>
      </label>
      <div className={`notice ${state === "connected" ? "info" : "warn"}`}>{text[state]}</div>

      {settings.daw.enabled && (
        <>
          <div className="card stack">
            <h3>Connect REAPER</h3>
            <ol className="steps">
              <li>Install the bridge script (it's copied into REAPER's Scripts folder; nothing else is changed).</li>
              <li>In REAPER: Actions → Show action list → New action → Load ReaScript…, pick <code>ReaperAssist/assist_bridge.lua</code>, then Run.</li>
              <li>The REAPER pill at the top turns green.</li>
            </ol>
            <label className="toggle">
              <input type="checkbox" checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />
              <span>Start the bridge automatically with REAPER</span>
            </label>
            <div className="row wrap">
              <button className="btn primary" onClick={async () => setResult(await api.installBridge({ autostart }))}>
                {daw?.installedAt ? "Reinstall / update bridge" : "Install bridge"}
              </button>
              {daw?.installedAt && (
                <button className="btn" onClick={() => api.revealBridgeScript()}>
                  <Icon name="folder" /> Show script
                </button>
              )}
            </div>
            {result && <div className={`notice ${result.ok ? "info" : "error"}`}>{result.message}</div>}
          </div>

          <PermissionsCard settings={settings} update={update} />
          <p className="dim small">Assist never deletes media or takes, every change is one undo step in REAPER, and recordings are always kept.</p>
          <label className="field">
            <span>REAPER folder (advanced)</span>
            <input
              value={settings.daw.resourcePath}
              placeholder="Found automatically. For a portable REAPER, its folder (the one with reaper.ini)"
              onChange={(e) => update({ daw: { resourcePath: e.target.value } })}
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>Bridge folder (advanced)</span>
            <input value={settings.daw.bridgeDir} onChange={(e) => update({ daw: { bridgeDir: e.target.value } })} spellCheck={false} />
          </label>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Permissions */

function PermissionsCard({ settings, update }: Pick<Props, "settings" | "update">) {
  const [actions, setActions] = useState<Awaited<ReturnType<typeof api.listActions>>>([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => void api.listActions().then(setActions), []);
  const p = settings.permissions;
  const setRule = (name: string, v: "default" | PermissionRule) => {
    const rules = { ...p.rules };
    if (v === "default") delete rules[name];
    else rules[name] = v;
    void update({ permissions: { ...p, rules } });
  };
  const changing = actions.filter((a) => a.risk !== "read");
  const ruled = changing.filter((a) => p.rules[a.name]);
  const list = showAll ? changing : ruled;
  const modeDefault = (a: (typeof actions)[number]) =>
    p.mode === "full-auto" ? "runs" : p.mode === "ask" ? "asks" : a.risk === "safe" && !a.alwaysConfirm ? "runs" : "asks";
  return (
    <div className="card stack">
      <h3>Permissions</h3>
      <p className="dim small">Like Claude Code and Codex: pick how much Assist may do in REAPER on its own. Shift+Tab in the chat box switches mode. Reading the project never asks.</p>
      <div className="seg" role="radiogroup">
        {(["ask", "auto-edits", "full-auto"] as PermissionMode[]).map((m) => (
          <button key={m} role="radio" aria-checked={p.mode === m} className={p.mode === m ? "on" : ""} onClick={() => update({ permissions: { ...p, mode: m } })}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="row space">
        <strong className="small">Rules{ruled.length ? ` (${ruled.length})` : ""}</strong>
        <button className="link small" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Only show my rules" : "Show every action"}
        </button>
      </div>
      {!list.length && <p className="dim small">No rules yet. Click “Always” on an action in chat, or show every action to set them here.</p>}
      {list.length > 0 && (
        <table className="kv">
          <tbody>
            {list.map((a) => (
              <tr key={a.name}>
                <td title={a.summary}>
                  <code>{a.name}</code>
                </td>
                <td>
                  <select value={p.rules[a.name] ?? "default"} onChange={(e) => setRule(a.name, e.target.value as "default" | PermissionRule)}>
                    <option value="default">Follow mode ({modeDefault(a)})</option>
                    <option value="allow">Always allow</option>
                    <option value="ask">Always ask</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {ruled.length > 0 && (
        <button className="btn small" onClick={() => update({ permissions: { ...p, rules: {} } })}>
          Clear all rules
        </button>
      )}
    </div>
  );
}
