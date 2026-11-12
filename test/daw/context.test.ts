import { describe, expect, it } from "vitest";
import { formatContext, panLabel, sessionFromState, shortFxName } from "@daw/reaper/context";

const span = (start: number, end: number, startBar: string, endBar: string, label: string) => ({ start, end, startBar, endBar, label });

/** A project as bridge 0.4's getProjectState returns it (trimmed to what the context reads). */
const STATE = {
  project: { name: "Night Drive", saved: true, dirty: true, lengthBar: { bar: 33, beat: 1 } },
  tempo: { bpm: 92, numerator: 4, denominator: 4, hasTempoMap: false },
  transport: { state: "stopped", cursorBar: { bar: 9, beat: 1 }, repeat: true },
  loop: span(0, 10.43, "1.1", "5.1", "bars 1–4"),
  timeSelection: span(20.87, 41.74, "9.1", "17.1", "bars 9–16"),
  recording: { countIn: { enabled: true, bars: 1 }, metronome: true, newTakeMode: "lanes", recordMode: "normal" },
  sections: [
    { name: "Intro", kind: "region", ...span(0, 20.87, "1.1", "9.1", "bars 1–8") },
    { name: "Chorus", kind: "region", ...span(20.87, 41.74, "9.1", "17.1", "bars 9–16") },
    { name: "Chorus", kind: "region", ...span(62.6, 83.48, "25.1", "33.1", "bars 25–32") },
  ],
  selection: {
    tracks: [{ id: "{B}", index: 2, name: "Bass" }],
    items: [{ id: "{I1}", trackId: "{B}", track: "Bass", name: "bass", kind: "midi", ...span(20.87, 31.3, "9.1", "13.1", "bars 9–12") }],
    itemCount: 1,
    razor: [],
    timeSelection: span(20.87, 41.74, "9.1", "17.1", "bars 9–16"),
    midiEditor: { itemId: "{I1}", track: "Bass", take: "bass", notes: 32, selectedNotes: 4, pitchRange: "E1–A1", selectedSpan: span(20.87, 23.48, "9.1", "10.1", "bar 9") },
    envelope: null,
  },
  tracks: [
    {
      id: "{D}", index: 1, name: "Drums", isFolder: true, volumeDb: -3, pan: 0, muted: false, soloed: false, selected: false, armed: false,
      fx: [{ index: 0, name: "VST: ReaComp (Cockos)", enabled: true, preset: "Glue" }], sends: [], receives: [], inputFx: [],
      items: { count: 0, midi: 0, audio: 0, spans: [], moreSpans: 0 }, envelopes: [], parentId: null, mainSend: true, automation: "trim/read",
    },
    {
      id: "{K}", index: 3, name: "Kick", volumeDb: 0, pan: -0.2, muted: true, selected: false, armed: false,
      fx: [{ index: 0, name: "VSTi: ReaSynth (Cockos)", enabled: true, instrument: true }, { index: 1, name: "JS: Saturation", enabled: false }],
      sends: [{ destName: "Bass", volumeDb: 0, destChannel: 3, mode: "pre-fader" }], receives: [], inputFx: [],
      items: { count: 4, midi: 4, audio: 0, spans: [{ ...span(0, 83.48, "1.1", "33.1", "bars 1–32"), count: 4 }], moreSpans: 0 },
      envelopes: [{ name: "Volume", points: 6, automationItems: 0, active: true }], parentId: "{D}", mainSend: true, automation: "latch",
    },
    {
      id: "{B}", index: 2, name: "Bass", volumeDb: -6.5, pan: 0, selected: true, armed: true, input: { label: "In 1 (Mic)" }, monitoring: "auto",
      fx: [{ index: 0, name: "VST3: Pro-Q 3 (FabFilter)", enabled: true }], sends: [],
      receives: [{ fromName: "Kick", destChannel: 3 }, { fromName: "Keys", destChannel: 1 }],
      inputFx: [{ name: "JS: Gain", enabled: true }],
      items: { count: 6, midi: 6, audio: 0, spans: [{ ...span(20.87, 41.74, "9.1", "17.1", "bars 9–16"), count: 3 }, { ...span(62.6, 83.48, "25.1", "33.1", "bars 25–32"), count: 3 }], moreSpans: 2 },
      envelopes: [], parentId: null, mainSend: true, automation: "read",
    },
  ],
};

describe("project context", () => {
  it("formats a compact, complete block", () => {
    const text = formatContext(STATE);
    expect(text).toBe([
      "Project “Night Drive” (unsaved changes), 92 BPM 4/4, stopped, cursor at 9.1, 32 bars long.",
      "Sections: Intro bars 1–8, Chorus bars 9–16, Chorus (#2) bars 25–32.",
      "Loop: bars 1–4, repeat on.",
      "Time selection: bars 9–16.",
      "Selected tracks: 2. Bass.",
      "Selected items (1): 1 on Bass (bars 9–12). Refer to them as items: { selected: true }.",
      "MIDI editor open: Bass “bass”, 32 notes, 4 selected (E1–A1, bar 9); refer to them as notes: { selected: \"notes\" }.",
      "Recording setup: 1 armed; record mode normal; count-in 1 bar; metronome on; new takes as lanes.",
      "Tracks (3):",
      "1. Drums: -3.0 dB, folder · FX: ReaComp [Glue]",
      "  3. Kick: pan L20, muted, automation mode latch · inst: ReaSynth · FX: Saturation (off) · sends → Bass 0.0 dB pre-fader into 3/4 · items: 4 MIDI in bars 1–32 · automation: Volume (6 pts)",
      "2. Bass: -6.5 dB, selected, armed: In 1 (Mic), monitoring auto · FX: Pro-Q 3 · input FX: Gain · sidechain from Kick (3/4) · items: 6 MIDI in bars 9–16, 25–32 (+2 more)",
    ].join("\n"));
  });

  it("leaves out what the user switched off", () => {
    const text = formatContext(STATE, { tracks: false, items: false, timeSelection: false, midi: false });
    expect(text).not.toMatch(/Selected tracks|Selected items|Time selection|MIDI editor/);
    expect(text).not.toContain("selected,");
    expect(text).toContain("Sections:");
    expect(text).toContain("2. Bass: -6.5 dB, armed");
  });

  it("works with an older bridge's state (no sections or selection)", () => {
    const old = {
      project: { name: "Old", saved: false }, tempo: { bpm: 120, numerator: 3, denominator: 4 },
      transport: { state: "playing", cursorBar: { bar: 2, beat: 1.5 } },
      markers: [{ name: "Verse", isRegion: true, bar: { bar: 5, beat: 1 }, position: 8, end: 16 }],
      tracks: [{ id: "{A}", index: 1, name: "Gtr", volumeDb: 0, pan: 0, itemCount: 2, fx: [], sends: [] }],
    };
    expect(formatContext(old)).toBe([
      "Project “Old” (never saved), 120 BPM 3/4, playing, cursor at 2.1.50.",
      "Regions: Verse from 5.1.",
      "Tracks (1):",
      "1. Gtr: items: 2",
    ].join("\n"));
    const s = sessionFromState({ ...old, timeSelection: { start: 1, end: 2 }, tracks: [{ ...old.tracks[0], selected: true, armed: true }] });
    expect(s.project).toMatchObject({ name: "Old", bpm: 120, timeSig: "3/4", transport: "playing", trackCount: 1 });
    expect(s.selection.tracks).toEqual([{ id: "{A}", index: 1, name: "Gtr" }]);
    expect(s.selection.timeSelection?.label).toBe("1.0–2.0 s");
    expect(s.sections[0]).toMatchObject({ name: "Verse", kind: "region", start: 8, end: 16, startBar: "5.1" });
    expect(s.tracks).toEqual([{ id: "{A}", index: 1, name: "Gtr", armed: true }]);
  });

  it("shortens plug-in names and pans like a console", () => {
    expect(shortFxName("VST3: Pro-Q 3 (FabFilter)")).toBe("Pro-Q 3");
    expect(shortFxName("JS: Saturation")).toBe("Saturation");
    expect(shortFxName("ReaEQ")).toBe("ReaEQ");
    expect(panLabel(0)).toBe("C");
    expect(panLabel(-0.25)).toBe("L25");
    expect(panLabel(1)).toBe("R100");
  });
});
