import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Data folder names of builds before the rename (package name, then product name). */
export const LEGACY_DATA_DIRS = ["kraftonic-assist", "Kraftonic Assist"];
/** Assist's own files in its data folder; Chromium's caches are not carried over. */
export const CARRIED = ["settings.json", "conversations", "reaper-original.json", "reaper-pending.json"];

/**
 * First start after the rename: copy the settings, chats and the Restore REAPER record from the old data
 * folder (a sibling of `userData`) so nothing is lost. Runs once, only while `userData` has no settings.
 * Saved API keys were encrypted under the old name and have to be entered again.
 * Returns the folder copied from, or null.
 */
export function migrateUserData(userData: string): string | null {
  if (existsSync(join(userData, "settings.json"))) return null;
  for (const name of LEGACY_DATA_DIRS) {
    const old = join(dirname(userData), name);
    if (!existsSync(join(old, "settings.json"))) continue;
    for (const f of CARRIED) {
      const from = join(old, f);
      if (existsSync(from)) cpSync(from, join(userData, f), { recursive: true, errorOnExist: false, force: false });
    }
    return old;
  }
  return null;
}
