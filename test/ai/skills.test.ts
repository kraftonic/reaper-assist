import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GENRES } from "@studio/genres";
import { COMMAND_NAMES } from "@daw/reaper/commands";
import { SYSTEM_PROMPT } from "@ai/prompt";
import { SKILL_TOOL, listSkills, loadSkill, parseSkill, runSkillTool, setSkillsDir, skillIndex } from "@ai/skills";

const IDS = [
  "arrangement", "bass-808", "drums", "gain-staging", "genre-playbooks", "mastering", "midi-groove", "mixing-basics",
  "music-theory", "reaper-workflows", "recording-workflow", "reference-tracks", "sampling", "sound-design", "troubleshooting", "vocal-recording",
];
const TOOLS = new Set<string>([...COMMAND_NAMES, "loadSkill"]);

afterEach(() => setSkillsDir(null));

describe("skills (src/ai/skills)", () => {
  it("lists every skill with a title and a one-line 'when'", () => {
    const list = listSkills();
    expect(list.map((s) => s.id)).toEqual(IDS);
    for (const s of list) {
      expect(s.title.length, s.id).toBeGreaterThan(5);
      expect(s.when, s.id).not.toMatch(/\n/);
      expect(s.when.length, s.id).toBeLessThan(200);
    }
  });

  it("each guide is written, short, has numbers and names only real tools", () => {
    for (const id of IDS) {
      const text = loadSkill(id)!;
      expect(text, id).toBeTruthy();
      expect(text, id).not.toContain("Being written");
      expect(text.length, id).toBeLessThan(6000);
      expect(text, id).toMatch(/\d/);
      const tools = /^Tools: (.*)$/m.exec(text)?.[1]?.split(", ") ?? [];
      expect(tools.length, id).toBeGreaterThan(0);
      for (const t of tools) expect(TOOLS.has(t), `${id} names unknown tool ${t}`).toBe(true);
      // Tools mentioned in backticks in the body must exist too.
      const verb = /^(get|set|list|read|analyze|check|split|move|copy|trim|glue|edit|delete|write|choose|freeze|load|create|insert|quantize|add|mark|start|stop|configure|select|arm|rename|save|clear|pause)[A-Z]/;
      for (const m of text.matchAll(/`([a-z][A-Za-z]+)`/g)) {
        if (verb.test(m[1]!)) expect(TOOLS.has(m[1]!), `${id} mentions unknown tool ${m[1]}`).toBe(true);
      }
    }
  });

  it("the genre playbook covers every template genre by its loadGenreTemplate id", () => {
    const text = loadSkill("genre-playbooks")!;
    for (const g of GENRES) {
      expect(text, g.id).toContain(`## ${g.id}: `);
      expect(text, g.id).toContain(`${g.bpmRange[0]}-${g.bpmRange[1]} BPM (${g.bpm}, ${g.key.tonic} ${g.key.mode})`);
    }
  });

  it("loadSkill is forgiving about case and space, and null for unknown ids", () => {
    expect(loadSkill(" Vocal-Recording ")).toMatch(/^# Vocal recording and the vocal chain\nUse when: /);
    expect(loadSkill("nope")).toBeNull();
    expect(loadSkill("")).toBeNull();
  });

  it("runSkillTool answers a model's tool call", () => {
    const ok = runSkillTool({ id: "mastering" });
    expect(ok.ok).toBe(true);
    expect(ok.summary).toBe("Read the “Mastering and loudness targets” guide");
    expect(ok.text).toContain("-14");
    const bad = runSkillTool({ id: "mixing" });
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain("mixing-basics");
    expect(runSkillTool(null).ok).toBe(false);
  });

  it("the tool schema is a plain object every provider accepts", () => {
    expect(SKILL_TOOL.name).toBe("loadSkill");
    expect(SKILL_TOOL.schema).toMatchObject({ type: "object", required: ["id"] });
  });

  it("the static system prompt carries the index and the context rules", () => {
    for (const id of IDS) expect(SYSTEM_PROMPT).toContain(`- ${id}: `);
    expect(SYSTEM_PROMPT).toBe(SYSTEM_PROMPT.trim());
    for (const tag of ["<reaper_project>", "<mentions>", "<skill>", "<panel_events>", "loadSkill", "{ fromBar: 9, toBar: 16 }", "verified"]) expect(SYSTEM_PROMPT).toContain(tag);
    expect(skillIndex().split("\n")).toHaveLength(IDS.length);
  });

  it("parses front matter strictly and reads another folder when told to", () => {
    expect(parseSkill("x", "no front matter")).toBeNull();
    expect(parseSkill("Bad Id", "---\ntitle: T\nwhen: W\n---\nbody")).toBeNull();
    expect(parseSkill("x", "---\ntitle: T\n---\nbody")).toBeNull();
    expect(parseSkill("a-b", "---\ntitle: A: B\nwhen: Now\ntools: one, two\n---\n\nBody 1\n")).toMatchObject({ id: "a-b", title: "A: B", when: "Now", tools: ["one", "two"], body: "Body 1" });
    const dir = mkdtempSync(join(tmpdir(), "ka-skills-"));
    writeFileSync(join(dir, "only.md"), "---\ntitle: Only\nwhen: Testing\n---\nText 42");
    writeFileSync(join(dir, "_draft.md"), "---\ntitle: Draft\nwhen: Never\n---\nx");
    writeFileSync(join(dir, "broken.md"), "nothing");
    setSkillsDir(dir);
    expect(listSkills()).toEqual([{ id: "only", title: "Only", when: "Testing" }]);
    expect(loadSkill("only")).toBe("# Only\nUse when: Testing\n\nText 42");
  });
});
