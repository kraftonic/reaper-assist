import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateUserData } from "../../src/main/migrate";

const root = () => mkdtempSync(join(tmpdir(), "ra-migrate-"));

describe("data folder from before the rename", () => {
  it("copies settings, chats and the restore record once, and skips caches", () => {
    const r = root();
    const old = join(r, "kraftonic-assist");
    mkdirSync(join(old, "conversations"), { recursive: true });
    mkdirSync(join(old, "Cache"));
    writeFileSync(join(old, "settings.json"), '{"workflow":"fl"}');
    writeFileSync(join(old, "reaper-original.json"), "{}");
    writeFileSync(join(old, "conversations", "a.json"), "[]");
    const now = join(r, "REAPER Assist");
    expect(migrateUserData(now)).toBe(old);
    expect(readFileSync(join(now, "settings.json"), "utf8")).toBe('{"workflow":"fl"}');
    expect(existsSync(join(now, "conversations", "a.json"))).toBe(true);
    expect(existsSync(join(now, "reaper-original.json"))).toBe(true);
    expect(existsSync(join(now, "Cache"))).toBe(false);
    // Second start: the new folder has settings, so nothing is copied again.
    writeFileSync(join(old, "settings.json"), '{"workflow":"logic"}');
    expect(migrateUserData(now)).toBeNull();
    expect(readFileSync(join(now, "settings.json"), "utf8")).toBe('{"workflow":"fl"}');
  });
  it("does nothing on a fresh install", () => {
    expect(migrateUserData(join(root(), "REAPER Assist"))).toBeNull();
  });
});
