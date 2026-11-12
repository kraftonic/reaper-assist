import { describe, expect, it } from "vitest";
import { COMMANDS, describeCommand, validateArgs } from "@daw/reaper/commands";

describe("REAPER action-list commands", () => {
  it("searching never asks; removing a shortcut always does; running an action is not 'safe'", () => {
    expect(COMMANDS.findActions.risk).toBe("read");
    expect(COMMANDS.runAction.risk).toBe("caution");
    expect(COMMANDS.removeShortcut.alwaysConfirm).toBe(true);
  });

  it("accepts REAPER's numeric and named ids, nothing else", () => {
    expect(validateArgs("runAction", { action: 40279, name: "View: Show docker" }).ok).toBe(true);
    expect(validateArgs("runAction", { action: "_SWS_ABOUT", name: "SWS: About" }).ok).toBe(true);
    expect(validateArgs("runAction", { action: "os.execute('x')", name: "x" }).ok).toBe(false);
    expect(validateArgs("runAction", { action: 0, name: "x" }).ok).toBe(false);
  });

  it("needs the action's name, so the approval card says what will run", () => {
    expect(validateArgs("runAction", { action: 40279 }).ok).toBe(false);
    expect(describeCommand("runAction", { action: 40279, name: "View: Show docker" })).toBe("Run “View: Show docker”");
    expect(describeCommand("assignShortcut", { action: 40279, name: "View: Show docker", key: "Shift+D" })).toBe("Add a shortcut (Shift+D) to “View: Show docker”");
  });

  it("only knows REAPER's action sections", () => {
    expect(validateArgs("findActions", { query: "split", section: "midi" }).ok).toBe(true);
    expect(validateArgs("findActions", { query: "split", section: "everything" }).ok).toBe(false);
  });
});
