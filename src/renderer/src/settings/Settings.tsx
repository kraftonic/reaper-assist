import type { Props, SettingsTab } from "./types";
import { AiTab } from "./AiTab";
import { DawTab } from "./DawTab";
import { GeneralTab } from "./GeneralTab";
import { LookTab } from "./LookTab";

export type { SettingsTab } from "./types";

/** The Settings sheet: one tab per file in this folder. */
export function Settings(props: Props) {
  const { tab, setTab } = props;
  const tabs: [SettingsTab, string][] = [
    ["ai", "AI"],
    ["look", "Coming from"],
    ["daw", "DAW"],
    ["general", "General"],
  ];
  return (
    <section className="sheet settings">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "ai" && <AiTab {...props} />}
      {tab === "look" && <LookTab {...props} />}
      {tab === "daw" && <DawTab {...props} />}
      {tab === "general" && <GeneralTab {...props} />}
    </section>
  );
}
