import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { ToolDef } from "../providers/types";

/**
 * Know-how packs ("skills") with progressive disclosure: the static system
 * prompt carries only a short index (id + when to use), and the model calls
 * the loadSkill tool to read a pack in full. Works the same for every
 * provider; the Claude Code / Codex CLIs reach loadSkill through the MCP
 * tool server like any other Assist tool.
 *
 * A skill is src/ai/skills/<id>.md with a small front matter:
 *   ---
 *   title: Gain staging and recording levels
 *   when: one line saying when to use it
 *   tools: getRecordingSetup, checkInputLevels
 *   ---
 */

export interface SkillInfo {
  id: string;
  title: string;
  when: string;
}

interface Skill extends SkillInfo {
  tools: string[];
  body: string;
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

let override: string | null = null;
let cache: { dir: string | null; skills: Map<string, Skill> } | null = null;

/** Point at another skills folder (tests, or a packaged app layout). null = automatic. */
export function setSkillsDir(dir: string | null): void {
  override = dir;
  cache = null;
}

/** Forget the parsed skills so edited files are picked up. */
export function reloadSkills(): void {
  cache = null;
}

function candidates(): string[] {
  const out: string[] = [];
  if (override) out.push(override);
  if (process.env.KA_SKILLS_DIR) out.push(process.env.KA_SKILLS_DIR);
  // The .md files sit next to this module in the source tree (tests, vite-node).
  if (typeof __dirname !== "undefined") out.push(__dirname);
  // Built app: out/main is two levels below the app root, which still holds src/ai/skills.
  if (typeof __dirname !== "undefined") out.push(join(__dirname, "..", "..", "src", "ai", "skills"));
  const res = (process as { resourcesPath?: string }).resourcesPath;
  if (res) out.push(join(res, "skills"));
  out.push(join(process.cwd(), "src", "ai", "skills"));
  return out;
}

export function skillsDir(): string | null {
  for (const d of candidates()) if (existsSync(d) && readdirSync(d).some((f) => f.endsWith(".md"))) return d;
  return null;
}

/** Parses one skill file. Exported for tests. */
export function parseSkill(id: string, text: string): Skill | null {
  if (!ID.test(id)) return null;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([a-zA-Z]+)\s*:\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]!.toLowerCase()] = kv[2]!.trim();
  }
  if (!meta.title || !meta.when) return null;
  return {
    id,
    title: meta.title,
    when: meta.when,
    tools: (meta.tools ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    body: m[2]!.trim(),
  };
}

function all(): Map<string, Skill> {
  const dir = skillsDir();
  if (cache && cache.dir === dir) return cache.skills;
  const skills = new Map<string, Skill>();
  if (dir) {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue;
      try {
        const s = parseSkill(basename(f, ".md"), readFileSync(join(dir, f), "utf8"));
        if (s) skills.set(s.id, s);
      } catch {
        /* unreadable file: skip it */
      }
    }
  }
  cache = { dir, skills };
  return skills;
}

/** Every skill: id, title and a one-line "when to use". B's slash commands build on this. */
export function listSkills(): SkillInfo[] {
  return [...all().values()].map(({ id, title, when }) => ({ id, title, when }));
}

/** The full text of a skill (front matter removed), or null when there is no such skill. */
export function loadSkill(id: string): string | null {
  const s = all().get(String(id ?? "").trim().toLowerCase());
  if (!s) return null;
  const tools = s.tools.length ? `\nTools: ${s.tools.join(", ")}` : "";
  return `# ${s.title}\nUse when: ${s.when}${tools}\n\n${s.body}`;
}

/** Short index for the static system prompt. */
export function skillIndex(): string {
  return listSkills().map((s) => `- ${s.id}: ${s.when}`).join("\n");
}

export const SKILL_TOOL_NAME = "loadSkill";

/** Tool definition shared by every provider (and the CLIs' MCP server). */
export const SKILL_TOOL: ToolDef = {
  name: SKILL_TOOL_NAME,
  description:
    "Read one of Assist's know-how packs (see the skills index in your instructions) before advising on that topic or doing a multi-step job. Returns working numbers, a method, and which tools to use.",
  schema: {
    type: "object",
    properties: { id: { type: "string", description: "Skill id from the index, e.g. vocal-recording" } },
    required: ["id"],
    additionalProperties: false,
  },
};

/** Runs a loadSkill tool call. Never touches REAPER, so it needs no approval. */
export function runSkillTool(input: unknown): { ok: boolean; text: string; summary: string } {
  const id = input && typeof input === "object" ? String((input as { id?: unknown }).id ?? "") : "";
  const text = loadSkill(id);
  if (text) {
    const title = all().get(id.trim().toLowerCase())?.title ?? id;
    return { ok: true, text, summary: `Read the “${title}” guide` };
  }
  const ids = listSkills().map((s) => s.id);
  return { ok: false, text: `No skill “${id}”. Skills: ${ids.join(", ") || "none installed"}.`, summary: `Look up “${id}”` };
}
