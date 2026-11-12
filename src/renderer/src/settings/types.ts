import type { DawStatus, SettingsPatch, SettingsView } from "@shared/types";

export type SettingsTab = "ai" | "look" | "daw" | "general";

/** What every settings tab gets from the Settings sheet. */
export interface Props {
  settings: SettingsView;
  setSettings: (s: SettingsView) => void;
  update: (p: SettingsPatch) => Promise<void>;
  daw: DawStatus | null;
  tab: SettingsTab;
  setTab: (t: SettingsTab) => void;
}
