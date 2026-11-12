/**
 * The per-message project context: what goes into the <reaper_project> block of
 * the user turn, and the small SessionContext the chat box uses for its chips and
 * @-mentions. Pure functions over the bridge's getProjectState / getSessionContext data.
 */

/** Which parts of the selection go into the context; all default to true (the chat box's chips). */
export interface ContextToggles {
  tracks?: boolean;
  items?: boolean;
  timeSelection?: boolean;
  midi?: boolean;
}

/** A stretch of time: seconds plus ruler labels. An end at "17.1" means the span covers bars up to 16. */
export interface BarSpan {
  start: number;
  end: number;
  startBar: string;
  endBar: string;
  /** "bars 9–16", "bar 9", or ruler positions when the edges are not on downbeats. */
  label: string;
}

export interface SelectionState {
  tracks: { id: string; index: number; name: string }[];
  /** At most 64; itemCount is the real count. */
  items: ({ id: string; trackId: string; track: string; name: string; kind: "midi" | "audio" | "empty" } & BarSpan)[];
  itemCount: number;
  razor: ({ trackId: string; track: string } & BarSpan)[];
  timeSelection: BarSpan | null;
  midiEditor: { itemId: string; track: string; take: string; notes: number; selectedNotes: number; pitchRange: string | null; selectedSpan: BarSpan | null } | null;
  envelope: { track: string | null; name: string; points: number } | null;
}

export interface SessionContext {
  project: { name: string; saved: boolean; dirty: boolean; bpm: number; timeSig: string; transport: string; cursorBar: string; lengthBars: number | null; trackCount: number };
  selection: SelectionState;
  /** Named regions, and markers (a marker section runs to the next marker). */
  sections: ({ name: string; kind: "region" | "marker" } & BarSpan)[];
  /** Every track, capped at 200 (for @-mentions). */
  tracks: { id: string; index: number; name: string; armed: boolean }[];
}

type Obj = Record<string, unknown>;
const arr = <T = Obj>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");
const nr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "VST3: Pro-Q 3 (FabFilter)" → "Pro-Q 3". */
export function shortFxName(name: string): string {
  return name.replace(/^[A-Za-z0-9]+i?:\s*/, "").replace(/\s+\([^()]*\)\s*$/, "").trim() || name;
}

const db = (v: unknown) => {
  const x = nr(v);
  return x === null ? "" : x <= -150 ? "-inf dB" : `${x > 0 ? "+" : ""}${x.toFixed(1)} dB`;
};
/** -0.2 → "L20", 0.35 → "R35", 0 → "C". */
export function panLabel(p: unknown): string {
  const x = nr(p) ?? 0;
  const v = Math.round(Math.abs(x) * 100);
  return v === 0 ? "C" : `${x < 0 ? "L" : "R"}${v}`;
}

/** Old (0.3) bridges send bar positions as { bar, beat }. */
function barText(v: unknown): string {
  if (typeof v === "string") return v;
  const b = obj(v);
  if (typeof b.bar !== "number") return "";
  const beat = typeof b.beat === "number" ? b.beat : 1;
  return Number.isInteger(beat) ? `${b.bar}.${beat}` : `${b.bar}.${beat.toFixed(2)}`;
}

function spanLabel(v: unknown): string {
  const s = obj(v);
  if (typeof s.label === "string") return s.label;
  const a = nr(s.start), b = nr(s.end);
  return a !== null && b !== null ? `${a.toFixed(1)}–${b.toFixed(1)} s` : "";
}

function itemsLine(it: Obj): string {
  const count = nr(it.count) ?? 0;
  if (!count) return "";
  const midi = nr(it.midi) ?? 0, audio = nr(it.audio) ?? 0;
  const kinds = [audio && `${audio} audio`, midi && `${midi} MIDI`].filter(Boolean).join(" + ");
  const spans = arr(it.spans).map((s) => spanLabel(s).replace(/^bars? /, "")).filter(Boolean);
  const more = nr(it.moreSpans) ?? 0;
  return `items: ${kinds || count}${spans.length ? ` in bars ${spans.join(", ")}${more ? ` (+${more} more)` : ""}` : ""}`;
}

function trackLine(t: Obj, depth: number, showSelected: boolean): string {
  const name = str(t.name) || `Track ${t.index}`;
  const bits: string[] = [];
  const level = [nr(t.volumeDb) !== null && nr(t.volumeDb) !== 0 ? db(t.volumeDb) : "", nr(t.pan) ? `pan ${panLabel(t.pan)}` : ""].filter(Boolean);
  const flags = [
    t.isFolder && "folder",
    t.muted && "muted",
    t.soloed && "solo",
    showSelected && t.selected && "selected",
    t.frozen && "frozen",
    t.armed && `armed: ${str(obj(t.input).label) || "input?"}, monitoring ${str(t.monitoring) || "on"}`,
    typeof t.automation === "string" && /write|latch|touch/.test(t.automation) && `automation mode ${t.automation}`,
    t.mainSend === false && !t.parentId && "not sent to master",
  ].filter(Boolean) as string[];
  if (level.length || flags.length) bits.push([...level, ...flags].join(", "));
  const fx = arr(t.fx);
  const label = (f: Obj) => `${shortFxName(str(f.name))}${f.enabled === false ? " (off)" : ""}${str(f.preset) ? ` [${str(f.preset)}]` : ""}`;
  const inst = fx.filter((f) => f.instrument);
  const fxs = fx.filter((f) => !f.instrument);
  if (inst.length) bits.push(`inst: ${inst.map(label).join(", ")}`);
  if (fxs.length) bits.push(`FX: ${fxs.slice(0, 8).map(label).join(", ")}${fxs.length > 8 ? ` +${fxs.length - 8}` : ""}`);
  const infx = arr(t.inputFx);
  if (infx.length) bits.push(`input FX: ${infx.map(label).join(", ")}`);
  const sends = arr(t.sends).map((s) => `→ ${str(s.destName) || "?"} ${db(s.volumeDb)}${s.mode && s.mode !== "post-fader" ? ` ${s.mode}` : ""}${(nr(s.destChannel) ?? 1) > 2 ? ` into ${s.destChannel}/${(nr(s.destChannel) ?? 0) + 1}` : ""}`);
  if (sends.length) bits.push(`sends ${sends.join(", ")}`);
  const sc = arr(t.receives).filter((r) => (nr(r.destChannel) ?? 1) > 2).map((r) => `${str(r.fromName) || "?"} (${r.destChannel}/${(nr(r.destChannel) ?? 0) + 1})`);
  if (sc.length) bits.push(`sidechain from ${sc.join(", ")}`);
  const items = obj(t.items);
  const il = Object.keys(items).length ? itemsLine(items) : (nr(t.itemCount) ? `items: ${t.itemCount}` : "");
  if (il) bits.push(il);
  const env = arr(t.envelopes).filter((e) => e.active !== false).map((e) => `${str(e.name)}${nr(e.points) ? ` (${e.points} pts)` : ""}${nr(e.automationItems) ? ` +${e.automationItems} auto items` : ""}`);
  if (env.length) bits.push(`automation: ${env.join(", ")}`);
  return `${"  ".repeat(Math.min(depth, 4))}${t.index}. ${name}${bits.length ? `: ${bits.join(" · ")}` : ""}`;
}

/**
 * The <reaper_project> text: small, stable in shape, and enough to act without a read for
 * the usual requests. Details (FX parameters, notes, item ids) stay behind tools.
 */
export function formatContext(p: Obj, toggles: ContextToggles = {}): string {
  const on = (k: keyof ContextToggles) => toggles[k] !== false;
  const proj = obj(p.project), tempo = obj(p.tempo), tr = obj(p.transport), sel = obj(p.selection), rec = obj(p.recording);
  const tracks = arr(p.tracks);
  const lines: string[] = [];
  const len = obj(proj.lengthBar);
  const lengthBars = typeof len.bar === "number" ? (typeof len.beat === "number" && len.beat > 1.001 ? len.bar : len.bar - 1) : null;
  lines.push(
    `Project “${str(proj.name) || "Untitled"}”${proj.saved === false ? " (never saved)" : proj.dirty ? " (unsaved changes)" : ""}, ${tempo.bpm} BPM ${tempo.numerator}/${tempo.denominator}${tempo.hasTempoMap ? " (tempo changes)" : ""}, ${str(tr.state) || "stopped"}, cursor at ${barText(tr.cursorBar) || "?"}${lengthBars ? `, ${lengthBars} bars long` : ""}.`,
  );
  const sections = arr(p.sections);
  if (sections.length) {
    const seen = new Map<string, number>();
    lines.push(`Sections: ${sections.slice(0, 40).map((s) => {
      const n = (seen.get(str(s.name).toLowerCase()) ?? 0) + 1;
      seen.set(str(s.name).toLowerCase(), n);
      return `${str(s.name)}${n > 1 ? ` (#${n})` : ""} ${spanLabel(s)}`;
    }).join(", ")}${sections.length > 40 ? ` +${sections.length - 40} more` : ""}.`);
  } else {
    const regions = arr(p.markers).filter((m) => m.isRegion && str(m.name));
    if (regions.length) lines.push(`Regions: ${regions.slice(0, 40).map((m) => `${str(m.name)} from ${barText(m.bar)}`).join(", ")}.`);
  }
  const loop = obj(p.loop);
  if (tr.repeat && Object.keys(loop).length) lines.push(`Loop: ${spanLabel(loop)}, repeat on.`);
  if (on("timeSelection") && p.timeSelection) lines.push(`Time selection: ${spanLabel(p.timeSelection)}.`);
  if (on("tracks")) {
    const st = arr(sel.tracks);
    if (st.length) lines.push(`Selected tracks: ${st.slice(0, 12).map((t) => `${t.index}. ${str(t.name) || "(unnamed)"}`).join(", ")}${st.length > 12 ? ` +${st.length - 12}` : ""}.`);
    const env = obj(sel.envelope);
    if (str(env.name)) lines.push(`Selected envelope: ${str(env.name)}${str(env.track) ? ` on ${str(env.track)}` : ""} (${env.points ?? 0} points).`);
  }
  if (on("items")) {
    const items = arr(sel.items);
    const count = nr(sel.itemCount) ?? items.length;
    if (count) {
      const byTrack = new Map<string, Obj[]>();
      for (const it of items) byTrack.set(str(it.track), [...(byTrack.get(str(it.track)) ?? []), it]);
      const where = [...byTrack.entries()].slice(0, 6).map(([t, its]) => `${its.length} on ${t} (${[...new Set(its.map(spanLabel))].slice(0, 4).join(", ")})`).join("; ");
      lines.push(`Selected items (${count})${where ? `: ${where}` : ""}. Refer to them as items: { selected: true }.`);
    }
    const razor = arr(sel.razor);
    if (razor.length) lines.push(`Razor edits: ${razor.slice(0, 8).map((r) => `${str(r.track)} ${spanLabel(r)}`).join(", ")}.`);
  }
  if (on("midi") && sel.midiEditor && typeof sel.midiEditor === "object") {
    const m = obj(sel.midiEditor);
    lines.push(`MIDI editor open: ${str(m.track)}${str(m.take) ? ` “${str(m.take)}”` : ""}, ${m.notes} notes${nr(m.selectedNotes) ? `, ${m.selectedNotes} selected (${str(m.pitchRange)}${m.selectedSpan ? `, ${spanLabel(m.selectedSpan)}` : ""}); refer to them as notes: { selected: "notes" }` : ""}.`);
  }
  const armed = tracks.filter((t) => t.armed);
  if (armed.length || tr.state === "recording") {
    const ci = obj(rec.countIn);
    lines.push(`Recording setup: ${armed.length} armed; record mode ${str(rec.recordMode) || "?"}; count-in ${ci.enabled ? `${ci.bars} bar${ci.bars === 1 ? "" : "s"}` : "off"}; metronome ${rec.metronome ? "on" : "off"}; new takes as ${str(rec.newTakeMode) || "?"}.`);
  }

  // Tracks, indented under their folder.
  const depthOf = new Map<string, number>();
  for (const t of tracks) {
    const parent = str(t.parentId);
    depthOf.set(str(t.id), parent ? (depthOf.get(parent) ?? 0) + 1 : 0);
  }
  lines.push(`Tracks (${tracks.length})${tracks.length ? ":" : "."}`);
  for (const t of tracks.slice(0, 60)) lines.push(trackLine(t, depthOf.get(str(t.id)) ?? 0, on("tracks")));
  if (tracks.length > 60) lines.push(`…and ${tracks.length - 60} more (getProjectState lists them all).`);
  return lines.join("\n");
}

/** A SessionContext from an older (0.3) bridge's project state, which has no selection or sections. */
export function sessionFromState(p: Obj): SessionContext {
  const proj = obj(p.project), tempo = obj(p.tempo), tr = obj(p.transport);
  const tracks = arr(p.tracks);
  const ts = obj(p.timeSelection);
  const span = (s: number, e: number): BarSpan => ({ start: s, end: e, startBar: "", endBar: "", label: `${s.toFixed(1)}–${e.toFixed(1)} s` });
  return {
    project: {
      name: str(proj.name) || "Untitled project", saved: proj.saved !== false, dirty: !!proj.dirty, bpm: nr(tempo.bpm) ?? 120,
      timeSig: `${tempo.numerator ?? 4}/${tempo.denominator ?? 4}`, transport: str(tr.state) || "stopped", cursorBar: barText(tr.cursorBar),
      lengthBars: null, trackCount: tracks.length,
    },
    selection: {
      tracks: tracks.filter((t) => t.selected).map((t) => ({ id: str(t.id), index: nr(t.index) ?? 0, name: str(t.name) })),
      items: [], itemCount: 0, razor: [],
      timeSelection: nr(ts.start) !== null && nr(ts.end) !== null ? span(nr(ts.start)!, nr(ts.end)!) : null,
      midiEditor: null, envelope: null,
    },
    sections: arr(p.markers).filter((m) => m.isRegion && str(m.name)).map((m) => ({
      name: str(m.name), kind: "region" as const, ...span(nr(m.position) ?? 0, nr(m.end) ?? 0), startBar: barText(m.bar), label: `from bar ${barText(m.bar)}`,
    })),
    tracks: tracks.slice(0, 200).map((t) => ({ id: str(t.id), index: nr(t.index) ?? 0, name: str(t.name), armed: !!t.armed })),
  };
}
