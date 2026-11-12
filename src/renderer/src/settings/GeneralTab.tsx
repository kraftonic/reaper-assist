import { useState } from "react";
import type { SettingsView } from "@shared/types";
import type { Props } from "./types";

export function GeneralTab({ settings, update }: Props) {
  const [hotkey, setHotkey] = useState(settings.hotkey);
  return (
    <div className="stack">
      <label className="field">
        <span>Show / hide shortcut (works from any app)</span>
        <div className="row">
          <input value={hotkey} onChange={(e) => setHotkey(e.target.value)} spellCheck={false} />
          <button className="btn" disabled={hotkey === settings.hotkey} onClick={() => update({ hotkey })}>
            Apply
          </button>
        </div>
        <span className="dim small">Electron accelerator, e.g. CommandOrControl+Shift+Space or Alt+A.</span>
      </label>
      <label className="field">
        <span>Dock the panel</span>
        <select value={settings.dock} onChange={(e) => update({ dock: e.target.value as SettingsView["dock"] })}>
          <option value="right">Right edge of the screen</option>
          <option value="left">Left edge of the screen</option>
          <option value="free">Free-floating window</option>
        </select>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.alwaysOnTop} onChange={(e) => update({ alwaysOnTop: e.target.checked })} />
        <span>Keep on top of the DAW (also over full-screen apps on macOS)</span>
      </label>
    </div>
  );
}
