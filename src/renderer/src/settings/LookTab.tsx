import { useState } from "react";
import type { WorkflowResult } from "@shared/types";
import { WORKFLOWS, findWorkflow, keymapLine, shortcutLabel, type KeyOs, type KeySection, type Workflow, type WorkflowId } from "@profiles";
import { api } from "../api";
import type { Props } from "./types";

const SECTION_NAME: Record<KeySection, string> = { main: "Shortcuts", midi: "Piano roll shortcuts", alt1: "Keyboard Focus shortcuts", midilist: "Event list shortcuts", explorer: "Browser shortcuts" };

/** Shortcuts that exist on this platform. */
const keyOs = (): KeyOs => (api.platform === "darwin" ? "mac" : api.platform === "linux" ? "linux" : "win");
const keyCount = (w: Workflow) => w.shortcuts.filter((s) => keymapLine(s, keyOs()) !== null).length;

function layoutWords(w: Workflow): string {
  const l = w.layout!;
  const out = [`transport ${l.transport === "top" || l.transport === "above" ? "at the top" : "at the bottom"}`];
  if (l.tcp === "right") out.push("track headers on the right");
  for (const b of [l.browser ?? []].flat()) out.push(`${b.tabs.map((t) => (t === "explorer" ? "sample browser" : "plug-in browser")).join(" and ")} on the ${b.side}`);
  out.push(l.mixer === "docked" ? "mixer docked below" : l.mixer === "window" ? "mixer in its own window" : "mixer opens with its shortcut");
  out.push(l.midiEditor === "docked" ? "piano roll docked below" : "piano roll in its own window");
  if (l.midiNoteColor) out.push(`notes in the ${l.midiNoteColor === "track" ? "track's" : "clip's"} colour`);
  return out.join(", ");
}

export function LookTab({ settings, update, daw }: Props) {
  return (
    <div className="stack">
      {daw?.bridgeOutdated && <div className="notice warn">Restart REAPER once to finish Assist's update; until then some changes only apply after REAPER restarts.</div>}
      <ComingFrom settings={settings} update={update} />
    </div>
  );
}

/* ------------------------------------------------------- Coming from… */

function ComingFrom({ settings, update }: Pick<Props, "settings" | "update">) {
  const [picked, setPicked] = useState<WorkflowId | null>(settings.workflow);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<WorkflowResult | null>(null);
  const w = findWorkflow(picked);
  const mac = api.platform === "darwin";

  const restore = async (to?: "defaults") => {
    setRestoring(true);
    setRestored(null);
    setResult(null);
    try {
      setRestored(await api.restoreReaper(to));
    } finally {
      setRestoring(false);
    }
  };
  const [finishing, setFinishing] = useState(false);
  /** Quit REAPER (it asks to save), finish the waiting job, open REAPER again; the outcome replaces `set`'s card. */
  const finish = async (set: (r: WorkflowResult) => void) => {
    setFinishing(true);
    try {
      set(await api.quitReaperAndFinish());
    } finally {
      setFinishing(false);
    }
  };

  const apply = async (wf: Workflow) => {
    setBusy(true);
    setResult(null);
    setRestored(null);
    try {
      const r = await api.applyWorkflow(wf.id);
      setResult(r);
      if (r.ok) await update({ workflow: wf.id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div>
        <h3 className="section-title">Make REAPER feel like home</h3>
        <p className="dim small">Coming from another DAW? Pick it, and REAPER takes that DAW's look, window layout, toolbar, shortcuts and mouse behaviour, so your hands and eyes feel at home. The assistant uses your old DAW's words too. Restore REAPER below puts everything back exactly as it was.</p>
      </div>
      <div className="wf-grid">
        {WORKFLOWS.map((x) => (
          <button key={x.id} className={`wf-tile ${picked === x.id ? "on" : ""}`} onClick={() => (setPicked(x.id), setResult(null))} aria-pressed={picked === x.id}>
            <WfPreview w={x} />
            <span className="theme-name">
              {x.daw}
              {settings.workflow === x.id && <span className="tag ok">current</span>}
            </span>
          </button>
        ))}
      </div>

      {w && (
        <div className="card stack">
          <div>
            <strong>Coming from {w.daw}</strong>
            <p className="dim small">{w.blurb}</p>
          </div>
          <ul className="dim small changes">
            <li>The look: {w.daw}'s colours, track headers, mixer strips and transport (original artwork, no logos)</li>
            {w.layout && <li>Window layout: {layoutWords(w)}</li>}
            {!!w.toolbars?.length && <li>A {w.daw}-style toolbar{w.toolbars.some((t) => t.items.some((i) => i.action !== "-" && String(i.action).startsWith("_RS_assist_"))) ? " with its tools" : ""}</li>}
            <li>{keyCount(w)} {w.daw} shortcuts{w.scripts?.length ? `, with ${w.scripts.length} small scripts for what REAPER doesn't do out of the box` : ""} (your own shortcuts stay where they don't clash)</li>
            {!!w.mouse?.length && <li>Mouse: {w.mouse.slice(0, 3).map((m) => m.does.charAt(0).toLowerCase() + m.does.slice(1)).join("; ")}{w.mouse.length > 3 ? "; …" : ""}</li>}
            {!!w.prefs?.length && <li>Preferences: {w.prefs.slice(0, 3).map((p) => p.does.charAt(0).toLowerCase() + p.does.slice(1)).join("; ")}{w.prefs.length > 3 ? "; …" : ""}</li>}
            {!!w.startup?.length && <li>When REAPER starts, the toolbar's tool lights are set to match (a few lines in REAPER's start-up script; Restore removes them)</li>}
          </ul>
          <button className="btn primary" disabled={busy} onClick={() => apply(w)}>
            {busy ? "Setting up REAPER…" : settings.workflow === w.id ? `Set up ${w.daw} again` : `Make REAPER work like ${w.daw}`}
          </button>
          {result && <Steps r={result} finishing={finishing} onFinish={() => void finish(setResult)} />}

          {(["main", "midi", "alt1", "midilist", "explorer"] as const).map((sec) => {
            const list = w.shortcuts.filter((s) => (s.section ?? "main") === sec && keymapLine(s, keyOs()) !== null);
            if (!list.length) return null;
            return (
              <details key={sec}>
                <summary>{SECTION_NAME[sec]} ({list.length})</summary>
                <table className="kv">
                  <tbody>
                    {list.map((s) => (
                      <tr key={`${s.mods.join("+")}${s.key}${s.action}`}>
                        <td>
                          <kbd>{shortcutLabel(s, mac, api.platform === "linux")}</kbd>
                        </td>
                        <td>{s.does}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })}
          {!!w.mouse?.length && (
            <details>
              <summary>Mouse ({w.mouse.length})</summary>
              <ul className="small">
                {w.mouse.map((m) => (
                  <li key={`${m.ctx}${m.mods.join()}`}>{m.does}</li>
                ))}
              </ul>
            </details>
          )}
          <details>
            <summary>{w.daw} words → REAPER</summary>
            <table className="kv">
              <tbody>
                {w.glossary.map(([a, b]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td className="dim">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      <div className="card stack">
        <div>
          <strong>Restore REAPER</strong>
          <p className="dim small">
            <b>Restore REAPER</b> puts the theme, layout, toolbars, mouse behaviour and preferences back as they were before Assist changed them.{" "}
            <b>REAPER's defaults</b> sets them the way a fresh REAPER has them instead. Either way your own shortcuts and your projects stay.
          </p>
        </div>
        <div className="row">
          <button className="btn" disabled={restoring || busy || finishing} onClick={() => void restore()}>
            {restoring ? "Restoring REAPER…" : "Restore REAPER"}
          </button>
          <button className="btn" disabled={restoring || busy || finishing} onClick={() => void restore("defaults")}>
            REAPER's defaults
          </button>
        </div>
        {restored && <Steps r={restored} finishing={finishing} onFinish={() => void finish(setRestored)} />}
      </div>
    </div>
  );
}

export function Steps({ r, onFinish, finishing }: { r: WorkflowResult; onFinish?: () => void; finishing?: boolean }) {
  return (
    <>
      {r.steps.map((s) => (
        <div key={s.label} className={`notice ${s.ok ? "info" : "error"}`}>
          <strong>{s.label}:</strong> {s.detail}
        </div>
      ))}
      {r.pending && onFinish && (
        <div className="row">
          <button className="btn primary" disabled={finishing} onClick={onFinish}>
            {finishing ? "Waiting for REAPER to close…" : "Quit REAPER and finish"}
          </button>
          <span className="dim small">REAPER asks to save your project first, then opens again.</span>
        </div>
      )}
    </>
  );
}

/** A tiny arrange view in the profile's REAPER colours. */
function WfPreview({ w }: { w: Workflow }) {
  const c = w.reaper;
  return (
    <span className="wf-preview" style={{ background: c.col_arrangebg }}>
      <span className="wf-ruler" style={{ background: c.col_tl_bg }} />
      {[0, 1, 2].map((i) => (
        <span key={i} className="wf-lane" style={{ background: i % 2 ? c.col_tr2_bg : c.col_tr1_bg }}>
          <span className="wf-item" style={{ background: c.col_mi_bg, left: `${8 + i * 18}%`, width: `${30 + (i % 2) * 14}%` }} />
        </span>
      ))}
      <span className="wf-play" style={{ background: c.playcursor_color }} />
    </span>
  );
}
