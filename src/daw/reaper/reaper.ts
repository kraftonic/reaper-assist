import { existsSync } from "node:fs";
import { stat, statfs } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { COMMANDS, type CommandName } from "./commands";
import { FileBridgeTransport, type BridgeStatus, type WireResponse } from "./transport";
import { describeBands, interpretLevels, noteLines, recordingMinutes, recordingVerdicts, summarizeNotes, type LevelReading, type NoteRow } from "./analysis";
import { formatContext, sessionFromState, type ContextToggles, type SessionContext } from "./context";

export type { BarSpan, ContextToggles, SelectionState, SessionContext } from "./context";
export { formatContext } from "./context";
import { findGenre } from "@studio/genres";
import { pickInstrument, planTemplate, type PlannedCommand } from "@studio/templates/build";
import type { TransportWhere, WorkspacePlan } from "@profiles/engine/workspace";

/** REAPER's resource folder for a normal install on this OS. */
export function osReaperResourcePath(home = homedir(), os: NodeJS.Platform = platform(), env: NodeJS.ProcessEnv = process.env): string {
  switch (os) {
    case "darwin":
      return join(home, "Library", "Application Support", "REAPER");
    case "win32":
      return join(env.APPDATA ?? join(home, "AppData", "Roaming"), "REAPER");
    default:
      return join(env.XDG_CONFIG_HOME ?? join(home, ".config"), "REAPER");
  }
}

/** The Flatpak build of REAPER on Linux keeps its folder in the sandbox. */
export const flatpakReaperResourcePath = (home = homedir()) => join(home, ".var", "app", "fm.reaper.Reaper", "config", "REAPER");

let resourceOverride: string | null = null;

/** Settings → DAW → REAPER folder: for a portable install (empty = find it). */
export function setReaperResourcePath(p: string | null | undefined): void {
  resourceOverride = p && p.trim() ? p.trim() : null;
}

/**
 * The REAPER resource folder Assist works with: the folder set in Settings, then REAPER_ASSIST_RESOURCE,
 * then the OS's usual place, or on Linux the Flatpak folder when only that one has a reaper.ini.
 */
export function defaultReaperResourcePath(): string {
  if (resourceOverride) return resourceOverride;
  const env = process.env.REAPER_ASSIST_RESOURCE;
  if (env && env.trim()) return env.trim();
  const std = osReaperResourcePath();
  if (platform() === "linux" && !existsSync(join(std, "reaper.ini")) && existsSync(join(flatpakReaperResourcePath(), "reaper.ini"))) return flatpakReaperResourcePath();
  return std;
}

/** Must match assist_bridge.lua's default. */
export function defaultBridgeDir(): string {
  const env = process.env.REAPER_ASSIST_BRIDGE_DIR;
  if (env && env.trim()) return env;
  return join(defaultReaperResourcePath(), "ReaperAssist", "bridge");
}

const FRESH_MS = 4000;

export interface CommandOutcome {
  ok: boolean;
  /** Compact text handed back to the model. */
  text: string;
  undoLabel?: string;
}

interface TrackLite {
  id: string;
  index: number;
  name: string;
}

/**
 * A connection to the Lua bridge running inside REAPER.
 *
 * Name references ("the Vocals track") are resolved here against a fresh read
 * of the project, so the bridge only ever receives stable ids. A name that
 * matches several tracks is refused instead of guessed.
 */
export class ReaperConnection {
  private transport: FileBridgeTransport;
  private session: string | null = null;

  constructor(readonly bridgeDir: string) {
    this.transport = new FileBridgeTransport({ dir: bridgeDir });
  }

  async status(): Promise<{ state: "connected" | "stale" | "waiting"; status: BridgeStatus | null }> {
    const s = await this.transport.readStatus();
    if (!s) return { state: "waiting", status: null };
    const fresh = s.state === "running" && Date.now() - s.now < FRESH_MS;
    return { state: fresh ? "connected" : "stale", status: s };
  }

  async exists(): Promise<boolean> {
    try {
      await stat(this.bridgeDir);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureSession(): Promise<string> {
    const { state, status } = await this.status();
    if (state !== "connected" || !status) {
      this.session = null;
      throw new BridgeUnavailable(
        state === "waiting"
          ? "REAPER isn't connected. Open REAPER and run the Assist bridge script (Settings → DAW shows how)."
          : "REAPER stopped responding: it may be closed, or the bridge script was stopped.",
      );
    }
    if (this.session !== status.session) this.session = status.session;
    return this.session;
  }

  private async raw(command: string, args: unknown, timeoutMs: number, signal?: AbortSignal): Promise<WireResponse> {
    const session = await this.ensureSession();
    const out = await this.transport.send({ session, kind: "command", command, args, undoLabel: `Assist: ${command}` }, { timeoutMs, signal });
    if (out.kind === "response") return out.response;
    if (out.kind === "not_executed") throw new BridgeUnavailable(out.reason === "cancelled" ? "Cancelled before REAPER ran it." : "REAPER didn't pick the request up in time, so it was not run.");
    throw new BridgeUnavailable("REAPER took the request but didn't answer. It may or may not have run. Check the project before retrying.");
  }

  async projectState(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const r = await this.raw("getProjectState", {}, 5000, signal);
    if (r.status !== "ok" && r.status !== "verified") throw new Error(r.error?.message ?? "Could not read the project.");
    return (r.data ?? {}) as Record<string, unknown>;
  }

  /** The <reaper_project> text for the user turn; `toggles` leave parts of the selection out. Never throws. */
  async contextSummary(toggles?: ContextToggles): Promise<string | null> {
    try {
      const { state } = await this.status();
      if (state !== "connected") return null;
      const p = await this.projectState();
      return formatContext(p, toggles);
    } catch {
      return null;
    }
  }

  /**
   * Selection, sections and the track list, for the chat box's chips and @-mentions.
   * Cheap (no FX walks). Never throws; null when REAPER isn't connected.
   */
  async sessionContext(signal?: AbortSignal): Promise<SessionContext | null> {
    try {
      const { state } = await this.status();
      if (state !== "connected") return null;
      const r = await this.raw("getSessionContext", {}, 4000, signal);
      if (r.status === "ok" && r.data) return r.data as unknown as SessionContext;
      // A bridge older than 0.4 is still running: derive what we can from the project state.
      if (r.status === "unsupported") return sessionFromState(await this.projectState(signal));
      return null;
    } catch {
      return null;
    }
  }

  async run(name: CommandName, args: Record<string, unknown>, signal?: AbortSignal): Promise<CommandOutcome> {
    const spec = COMMANDS[name];
    if (name === "loadGenreTemplate") return this.loadTemplate(String(args.genre), typeof args.bpm === "number" ? args.bpm : undefined, signal);
    const { status } = await this.status();
    if (status && status.playState === "recording" && !spec.allowedWhileRecording) {
      return { ok: false, text: "REAPER is recording. This action waits until recording stops, so it was not run." };
    }
    let wire: Record<string, unknown>;
    try {
      wire = await this.resolveRefs(name, args, signal);
    } catch (e) {
      if (e instanceof RefError) return { ok: false, text: e.message };
      throw e;
    }
    const r = await this.raw(name, wire, spec.timeoutMs, signal);
    if ((r.status === "ok" || r.status === "verified") && r.data) {
      try {
        await postProcess(name, r, args);
      } catch {
        /* keep the raw reading */
      }
    }
    return formatResponse(r);
  }

  /** Run undoable commands as one transaction: one undo step, rolled back if any part fails. */
  async runBatch(commands: PlannedCommand[], undoLabel: string, timeoutMs = 60000, signal?: AbortSignal): Promise<WireResponse> {
    const session = await this.ensureSession();
    const out = await this.transport.send({ session, kind: "batch", commands, undoLabel, atomic: true }, { timeoutMs, signal });
    if (out.kind === "response") return out.response;
    if (out.kind === "not_executed") throw new BridgeUnavailable("REAPER didn't pick the request up in time, so nothing was changed.");
    throw new BridgeUnavailable("REAPER took the request but didn't answer. Check the project before retrying.");
  }

  /** Load a theme file from REAPER's ColorThemes folder (see src/profiles/engine/theme.ts). */
  /** Ask REAPER to quit the normal way (it asks to save unsaved projects). Bridge 0.4.1+. */
  async quitReaper(signal?: AbortSignal): Promise<{ ok: boolean; exe?: string; message: string }> {
    const r = await this.raw("quitReaper", {}, 10000, signal);
    if (r.status === "verified") return { ok: true, exe: typeof r.data?.exe === "string" ? r.data.exe : undefined, message: "REAPER is quitting." };
    if (r.status === "unsupported") return { ok: false, message: "REAPER is running an older Assist script that can't do this. Quit REAPER yourself (save your project first)." };
    return { ok: false, message: r.error?.message ?? "REAPER didn't confirm." };
  }

  async loadColorTheme(path: string, signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
    const r = await this.raw("loadColorTheme", { path }, 15000, signal);
    if (r.status === "verified") return { ok: true, message: "Theme loaded in REAPER." };
    if (r.status === "unsupported") return { ok: false, message: "The REAPER bridge is an older version. Update it in Settings → DAW, or pick the theme in REAPER: Options → Themes." };
    return { ok: false, message: r.error?.message ?? "REAPER didn't confirm the theme change." };
  }

  /**
   * Dock the Media Explorer and FX Browser beside the arrange view while REAPER runs
   * (the live twin of installWorkspace in src/profiles/engine/workspace.ts).
   */
  async setupWorkspace(plan: Omit<WorkspacePlan, "transport"> & { transport?: TransportWhere; defaults: { path: string; title: string }[] }, signal?: AbortSignal): Promise<{ ok: boolean; message: string; data?: Record<string, unknown> }> {
    // transportTop keeps bridges older than 0.3.2 (which only knew "top") working.
    const r = await this.raw("setupWorkspace", { ...plan, transportTop: plan.transport === "top" }, 20000, signal);
    const warn = (r.warnings ?? []).join(" ");
    if (r.status === "verified") return { ok: true, message: warn, data: r.data };
    if (r.status === "unsupported") return { ok: false, message: "REAPER is still running the previous Assist script. Restart REAPER once, or quit it and press the button again." };
    return { ok: false, message: [r.error?.message, r.error?.hint, warn].filter(Boolean).join(" ") || "REAPER didn't confirm the new layout.", data: r.data };
  }

  /** Put REAPER's windows back as they were before Assist changed them (states not given are left alone). */
  async restoreLayout(
    target: { transport?: TransportWhere | "hidden"; tcpRight?: boolean; explorerOpen?: boolean; fxBrowserOpen?: boolean; mixerVisible?: boolean; mixerDocked?: boolean; midiDocked?: boolean },
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; message: string; supported: boolean; data?: Record<string, unknown> }> {
    const r = await this.raw("restoreLayout", target, 20000, signal);
    if (r.status === "verified") return { ok: true, supported: true, message: "", data: r.data };
    if (r.status === "unsupported") return { ok: false, supported: false, message: "REAPER is still running the previous Assist script." };
    return { ok: false, supported: true, message: r.error?.message ?? "REAPER didn't confirm its windows were put back.", data: r.data };
  }

  async loadTemplate(genreId: string, bpm?: number, signal?: AbortSignal): Promise<TemplateOutcome> {
    const g = findGenre(genreId);
    if (!g) return { ok: false, text: `Unknown genre ${genreId}.` };
    const { status } = await this.status();
    if (status?.playState === "recording") return { ok: false, text: "REAPER is recording. The template waits until recording stops, so nothing was changed." };
    const listed = await this.raw("listInstalledFx", { kind: "instrument", limit: 2000 }, 10000, signal);
    const installed = ((listed.data?.fx as { name: string; instrument?: boolean }[] | undefined) ?? []);
    // REAPER's own instruments only, so a template sounds the same on every machine.
    const inst = { drums: null, bass: null, keys: null, synth: pickInstrument(installed, "reasynth") };
    const plan = planTemplate(g, inst, bpm ?? g.bpm);
    const label = `Assist: ${g.name} template`;
    const r = await this.runBatch(plan.commands, label, 60000, signal);
    if (r.status !== "verified" && r.status !== "unverified") {
      const results = (r.data?.results as { status: string; command: string; error?: { message: string } }[] | undefined) ?? [];
      const bad = results.find((x) => x.status !== "verified" && x.status !== "unverified" && x.status !== "ok" && x.status !== "skipped");
      return { ok: false, text: JSON.stringify({ status: r.status, rolledBack: r.data?.rolledBack, failedCommand: bad?.command, error: bad?.error?.message ?? r.error?.message, note: "Nothing was changed (the template is all-or-nothing)." }) };
    }
    await this.raw("setLoopRegion", { start: { bar: 1 }, end: { bar: 1 + plan.bars }, repeat: true }, 5000, signal).catch(() => undefined);
    return {
      ok: true,
      undoLabel: label,
      tracks: plan.tracks,
      notes: plan.notes,
      text: JSON.stringify({
        status: r.status,
        undoLabel: label,
        message: `${g.name} template built: ${g.bpm === (bpm ?? g.bpm) ? g.bpm : bpm} BPM, ${g.key.tonic} ${g.key.mode}, ${plan.bars}-bar loop on repeat.`,
        tracks: plan.tracks,
        instruments: inst.synth ? "ReaSynth (REAPER stock)" : "none found: load your own",
        notes: plan.notes,
      }),
    };
  }

  private async resolveRefs(name: CommandName, args: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let needs = false;
    mapTrackRefs(name, args, (ref) => {
      if (isNameRef(ref)) needs = true;
      return ref;
    });
    let tracks: TrackLite[] = [];
    if (needs) {
      const p = await this.projectState(signal);
      tracks = ((p.tracks as TrackLite[] | undefined) ?? []).map((t) => ({ id: t.id, index: t.index, name: t.name }));
    }
    const out = mapTrackRefs(name, args, (ref) => toWireTrack(ref, tracks)) as Record<string, unknown>;
    if (args.clip && typeof args.clip === "object") out.clip = { by: "id", id: (args.clip as { id: string }).id };
    return out;
  }
}

/**
 * Applies `fn` to every track reference in a command's arguments: `track`, `toTrack` and `tracks`
 * at any depth (items: { track }, notes: { track }, target: { tracks }), plus createSend's from/to
 * and configureSidechain's source/target. Other from/to keys are positions or values.
 */
export function mapTrackRefs(name: string, v: unknown, fn: (ref: unknown) => unknown, depth = 0): unknown {
  if (Array.isArray(v)) return v.map((x) => mapTrackRefs(name, x, fn, depth + 1));
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const top = depth === 0;
    const track = k === "track" || k === "toTrack"
      || (top && name === "createSend" && (k === "from" || k === "to"))
      || (top && name === "configureSidechain" && (k === "source" || k === "target"));
    if (track) out[k] = fn(x);
    else if (k === "tracks" && Array.isArray(x)) out[k] = x.map(fn);
    else out[k] = mapTrackRefs(name, x, fn, depth + 1);
  }
  return out;
}

/** Turn raw readings into what an engineer would quote (key, crest, headroom, disk time…), in place. */
export async function postProcess(name: CommandName, r: WireResponse, args: Record<string, unknown>): Promise<void> {
  const d = r.data as Record<string, unknown>;
  if (name === "readMidiNotes") {
    const rows = (d.notes as NoteRow[] | undefined) ?? [];
    const clips = (d.clips as { itemId: string; track: string; name: string; label?: string; notes: number }[] | undefined) ?? [];
    const drums = rows.length > 0 && (rows.every((n) => n[5] === 9) || (clips.length > 0 && clips.every((c) => /drum|kit|perc|beat/i.test(c.track))));
    const limit = typeof args.limit === "number" ? args.limit : 200;
    const range = d.range as { label?: string } | null | undefined;
    r.data = {
      summary: summarizeNotes(rows, { bpm: Number(d.bpm) || 120, drums }),
      clips: clips.map((c) => ({ itemId: c.itemId, track: c.track, name: c.name || undefined, bars: c.label, notes: c.notes })),
      ...(range?.label ? { range: range.label } : {}),
      bpm: d.bpm,
      timeSig: d.timeSig,
      ...(limit > 0 ? { columns: "position pitch lengthBeats velocity [channel] [sel] [muted]", notes: noteLines(rows, limit) } : {}),
      ...(rows.length > limit ? { listed: limit, total: d.total, more: "Narrow the range or raise limit to list the rest." } : {}),
      ...(d.truncated ? { readCap: "Only the first 20000 notes were read." } : {}),
    };
  } else if (name === "analyzeAudio") {
    const results = (d.results as (LevelReading & Record<string, unknown>)[] | undefined) ?? [];
    d.results = results.map((x) => {
      const { derived, verdicts } = interpretLevels(x);
      const scan = x.sourceScan;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(x)) if (v !== null && v !== undefined && k !== "sourceScan" && !(k === "missing" && !v)) out[k] = v;
      Object.assign(out, derived);
      const tone = describeBands(scan);
      if (tone) out.tonalBalanceBeforeFx = tone;
      if (scan?.clipRuns) out.clippedStretches = scan.clipRuns;
      if (verdicts.length) out.verdicts = verdicts;
      return out;
    });
  } else if (name === "getRecordingSetup") {
    const dev = (d.device ?? {}) as Record<string, number | null>;
    const lat = (d.latency ?? {}) as Record<string, number | null>;
    const fmt = (d.recordFormat ?? {}) as { bitDepth?: number };
    const armed = (d.armed as { input?: { type?: string; stereo?: boolean } }[] | undefined) ?? [];
    const free = await diskFree(typeof d.recordPath === "string" ? d.recordPath : null);
    const rate = Number(d.projectSampleRate) || Number(dev.sampleRate) || 48000;
    const depth = fmt.bitDepth || 24;
    const channels = armed.reduce((s, a) => s + (a.input?.type === "audio" ? (a.input.stereo ? 2 : 1) : 0), 0);
    if (free) {
      const mins = recordingMinutes(free.freeBytes, rate, depth, Math.max(channels, 1));
      d.disk = {
        path: free.path,
        freeGb: Math.round((free.freeBytes / 1e9) * 10) / 10,
        ...(mins !== null ? { recordingTimeLeft: `${mins >= 120 ? `${Math.floor(mins / 60)} h` : `${mins} min`} at ${depth}-bit/${Math.round(rate / 100) / 10} kHz, ${Math.max(channels, 1)} channel${Math.max(channels, 1) === 1 ? "" : "s"}` } : {}),
      };
    }
    const verdicts = recordingVerdicts({ roundTripMs: lat.roundTripMs, bufferSize: dev.bufferSize, sampleRate: rate, armed: armed.length, freeGb: free ? free.freeBytes / 1e9 : null });
    if (verdicts.length) d.verdicts = verdicts;
  }
}

/** Free space on the disk that holds `path` (or its nearest existing parent). */
async function diskFree(path: string | null): Promise<{ path: string; freeBytes: number } | null> {
  if (!path) return null;
  let dir = path;
  for (let i = 0; i < 32; i++) {
    try {
      const s = await statfs(dir);
      return { path: dir, freeBytes: Number(s.bavail) * Number(s.bsize) };
    } catch {
      const up = dirname(dir);
      if (up === dir) return null;
      dir = up;
    }
  }
  return null;
}

export interface TemplateOutcome extends CommandOutcome {
  tracks?: string[];
  notes?: string[];
}

export class BridgeUnavailable extends Error {}
class RefError extends Error {}

function isNameRef(v: unknown): boolean {
  return !!v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string";
}

function toWireTrack(ref: unknown, tracks: TrackLite[]): unknown {
  if (!ref || typeof ref !== "object") return ref;
  const r = ref as Record<string, unknown>;
  if (typeof r.id === "string") return { by: "id", id: r.id };
  if (typeof r.index === "number") return { by: "index", index: r.index };
  if (typeof r.name === "string") {
    const want = r.name.trim().toLowerCase();
    const exact = tracks.filter((t) => t.name.trim().toLowerCase() === want);
    const hits = exact.length ? exact : tracks.filter((t) => t.name.toLowerCase().includes(want));
    if (hits.length === 1) return { by: "id", id: hits[0]!.id };
    if (hits.length === 0) throw new RefError(`No track is named “${r.name}”. Tracks: ${tracks.map((t) => `${t.index}. ${t.name || "(unnamed)"}`).join(", ") || "none"}.`);
    throw new RefError(`More than one track matches “${r.name}”: ${hits.map((t) => `${t.index}. ${t.name}`).join(", ")}. Use the track number.`);
  }
  return ref;
}

function formatResponse(r: WireResponse): CommandOutcome {
  const ok = r.status === "ok" || r.status === "verified";
  const body: Record<string, unknown> = { status: r.status };
  if (r.message) body.message = r.message;
  if (r.data && Object.keys(r.data).length) body.data = r.data;
  if (r.observed) body.observed = r.observed;
  if (r.warnings?.length) body.warnings = r.warnings;
  if (r.error) body.error = r.error;
  if (r.status === "unsupported" && r.error?.code === "UNSUPPORTED" && /does not implement/.test(r.error.message)) {
    body.error = {
      code: "BRIDGE_OUTDATED",
      message: "REAPER is still running an older Assist script that can't do this yet.",
      hint: "Ask the user to restart REAPER (or run the Assist bridge script again) so the updated script loads. Nothing was changed.",
    };
  }
  if (r.undoLabel) body.undoLabel = r.undoLabel;
  if (r.rolledBack) body.rolledBack = true;
  if (r.status === "unverified") body.note = "REAPER ran this but could not confirm the result. Tell the user to check.";
  let text = JSON.stringify(body);
  if (text.length > 30000) text = text.slice(0, 30000) + "…(truncated)";
  return { ok, text, undoLabel: r.undoLabel };
}

/** The whole-project summary (kept for older callers; same as formatContext with everything on). */
export function summarizeProject(p: Record<string, unknown>): string {
  return formatContext(p);
}
