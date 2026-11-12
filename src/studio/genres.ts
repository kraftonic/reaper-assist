/**
 * Beat-making starting points, one per genre. Shared with the renderer for
 * the gallery; the main process turns one into REAPER commands.
 */

export type GenreId = "trap" | "drill" | "boombap" | "lofi" | "rnb" | "pop" | "afrobeats" | "reggaeton" | "house" | "dnb";

export interface StepLane {
  note: number; // General MIDI drum note (36..51)
  /** 16 steps per bar; 1 or 4 bars. x = accent, o = ghost, . = rest. */
  steps: string;
}

export interface GenreTemplate {
  id: GenreId;
  name: string;
  family: "Hip-hop" | "Pop & R&B" | "Global" | "Electronic";
  bpm: number;
  bpmRange: [number, number];
  key: { tonic: string; midi: number; mode: "minor" | "major" };
  /** Scale degrees (1-7) of the 4-bar chord loop. */
  progression: number[];
  sevenths: boolean;
  /** Percent swing on odd 16ths (50 = straight), used for the written patterns. */
  swing: number;
  vibe: string;
  /** The drum pattern. */
  drums: StepLane[];
  low: "808" | "bass";
  /** 16-step rhythm for the 808/bass line; each hit plays the bar's chord root. */
  lowRhythm: string;
  /** Overlapping notes (the drill slide) on the 808. */
  slides?: boolean;
  keys: "keys" | "pad" | "pluck";
  sections: [string, number][];
  tips: string[];
}

const K = 36, RIM = 37, SN = 38, CL = 39, PERC = 41, HAT = 42, HAT2 = 44, TOM = 45, OH = 46, SNAP = 48, CRASH = 49;
void PERC; void TOM; void CRASH;

export const GENRES: GenreTemplate[] = [
  {
    id: "trap", name: "Trap", family: "Hip-hop", bpm: 140, bpmRange: [130, 160], key: { tonic: "F#", midi: 54, mode: "minor" },
    progression: [1, 6, 3, 7], sevenths: false, swing: 50, vibe: "Half-time knock, rolling hats, long 808s",
    drums: [
      { note: K, steps: "x.........x....." },
      { note: CL, steps: "........x......." },
      { note: HAT, steps: "x.x.x.x.x.x.xxx." },
      { note: OH, steps: "..............x." },
    ],
    low: "808", lowRhythm: "x.........x.....", keys: "pluck",
    sections: [["Intro", 1], ["Hook", 5], ["Verse 1", 13], ["Hook", 29], ["Verse 2", 37], ["Hook", 53], ["Outro", 61]],
    tips: [
      "Tune the 808 to the key (F# here) and keep the kick and 808 starting together; sidechain the 808 to the kick if they fight.",
      "Hat rolls sound best as 1/32 and 1/16-triplet bursts into the snare; vary velocity so they don't machine-gun.",
      "Leave 100–300 Hz light in the melody: that's the 808's room.",
    ],
  },
  {
    id: "drill", name: "Drill", family: "Hip-hop", bpm: 142, bpmRange: [138, 146], key: { tonic: "C", midi: 48, mode: "minor" },
    progression: [1, 6, 4, 5], sevenths: false, swing: 50, vibe: "Sliding 808s, syncopated kicks, triplet hats",
    drums: [
      { note: K, steps: "x......x..x....." },
      { note: SN, steps: "........x......o" },
      { note: HAT, steps: "x..x..x.x..x.x.." },
      { note: RIM, steps: "...x.......x...." },
    ],
    low: "808", lowRhythm: "x......x..x.....", slides: true, keys: "pad",
    sections: [["Intro", 1], ["Hook", 5], ["Verse 1", 13], ["Hook", 29], ["Verse 2", 37], ["Hook", 53]],
    tips: [
      "The slide comes from overlapping 808 notes with glide or portamento on in your 808 sampler.",
      "Snare on beat 3 of each bar (half time), with a late ghost before it for the bounce.",
      "Dark minor melodies: strings, choirs and bells in the C–G range work well.",
    ],
  },
  {
    id: "boombap", name: "Boom Bap", family: "Hip-hop", bpm: 90, bpmRange: [84, 98], key: { tonic: "A", midi: 57, mode: "minor" },
    progression: [1, 4, 7, 3], sevenths: true, swing: 58, vibe: "Dusty breaks, swung 16ths, sample-chop feel",
    drums: [
      { note: K, steps: "x.......x.x....." },
      { note: SN, steps: "....x.......x..." },
      { note: HAT, steps: "x.o.x.o.x.o.x.oo" },
    ],
    low: "bass", lowRhythm: "x.......x.x.....", keys: "keys",
    sections: [["Intro", 1], ["Verse 1", 5], ["Hook", 21], ["Verse 2", 29], ["Hook", 45]],
    tips: ["Swing 55–60 % on the hats and ghost notes; keep kick and snare tight.", "Saturate and low-pass the drum bus a little (12–14 kHz) for that sampled-from-vinyl feel.", "Jazzy 7th chords (Am7, Dm7, G7, Cmaj7) suit chopped-soul vibes."],
  },
  {
    id: "lofi", name: "Lo-fi Hip-Hop", family: "Hip-hop", bpm: 78, bpmRange: [70, 90], key: { tonic: "D", midi: 50, mode: "major" },
    progression: [2, 5, 1, 6], sevenths: true, swing: 60, vibe: "Lazy swing, warm keys, vinyl dust",
    drums: [
      { note: K, steps: "x......x..x....." },
      { note: SN, steps: "....x.......x..." },
      { note: HAT, steps: "x.x.x.x.x.x.x.x." },
    ],
    low: "bass", lowRhythm: "x.....x...x.....", keys: "keys",
    sections: [["Loop A", 1], ["Loop B", 9], ["Loop A", 17], ["Outro", 25]],
    tips: ["ii–V–I–vi with 7ths and 9ths is the classic move.", "Layer a vinyl/tape noise loop from 'Lofi - Dust & Noise' at around -30 dB.", "Gentle wow and flutter plus a low-pass around 8–10 kHz on the keys."],
  },
  {
    id: "rnb", name: "R&B", family: "Pop & R&B", bpm: 68, bpmRange: [60, 80], key: { tonic: "Eb", midi: 51, mode: "major" },
    progression: [4, 3, 2, 5], sevenths: true, swing: 54, vibe: "Slow and lush: snaps, 808s, rich 7ths",
    drums: [
      { note: K, steps: "x.......x.....x." },
      { note: SNAP, steps: "....x.......x..." },
      { note: HAT, steps: "x.x.x.x.x.x.x.xx" },
    ],
    low: "808", lowRhythm: "x.......x.....x.", keys: "keys",
    sections: [["Intro", 1], ["Verse 1", 5], ["Pre", 13], ["Chorus", 17], ["Verse 2", 25], ["Chorus", 37]],
    tips: ["Use maj7, min9 and 11 chords; voice them close in the middle of the keyboard.", "Snaps or rims instead of snares keep it intimate.", "Leave space at 1–4 kHz for the vocal."],
  },
  {
    id: "pop", name: "Pop", family: "Pop & R&B", bpm: 118, bpmRange: [100, 128], key: { tonic: "C", midi: 48, mode: "major" },
    progression: [1, 5, 6, 4], sevenths: false, swing: 50, vibe: "Punchy four-chord loop, big clap, driving 8ths",
    drums: [
      { note: K, steps: "x.....x.x......." },
      { note: CL, steps: "....x.......x..." },
      { note: HAT, steps: "x.x.x.x.x.x.x.x." },
      { note: OH, steps: "..............x." },
    ],
    low: "bass", lowRhythm: "x.x.x.x.x.x.x.x.", keys: "keys",
    sections: [["Intro", 1], ["Verse 1", 5], ["Pre", 13], ["Chorus", 17], ["Verse 2", 25], ["Pre", 33], ["Chorus", 37], ["Bridge", 45], ["Chorus", 53]],
    tips: ["I–V–vi–IV is the four-chord pop loop; change the voicing, not the chords, between sections.", "Drop the drums for the pre-chorus to make the chorus hit.", "Aim for around -9 to -8 LUFS integrated on the final master for streaming-ready loudness."],
  },
  {
    id: "afrobeats", name: "Afrobeats", family: "Global", bpm: 105, bpmRange: [95, 115], key: { tonic: "A", midi: 57, mode: "minor" },
    progression: [1, 4, 6, 5], sevenths: true, swing: 55, vibe: "Bouncy log-drum feel, rim tresillo, shakers",
    drums: [
      { note: K, steps: "x...x...x...x..." },
      { note: RIM, steps: "x..x..x...x..x.." },
      { note: CL, steps: "....x.......x..." },
      { note: HAT2, steps: "oxoxoxoxoxoxoxox" },
    ],
    low: "bass", lowRhythm: "x..x..x...x.x...", keys: "pluck",
    sections: [["Intro", 1], ["Verse 1", 5], ["Hook", 21], ["Verse 2", 29], ["Hook", 45]],
    tips: ["The 3-3-2 rim pattern (tresillo) is the engine; keep it slightly behind the beat.", "Shakers on every 16th with accents on the off-beats.", "Bass and log-drum lines move a lot: follow the rim rhythm."],
  },
  {
    id: "reggaeton", name: "Reggaeton", family: "Global", bpm: 95, bpmRange: [88, 100], key: { tonic: "G", midi: 55, mode: "minor" },
    progression: [1, 6, 3, 7], sevenths: false, swing: 50, vibe: "The dembow riddim, steady kick, snare pushes",
    drums: [
      { note: K, steps: "x...x...x...x..." },
      { note: SN, steps: "...x..x....x..x." },
      { note: HAT, steps: "x.x.x.x.x.x.x.x." },
    ],
    low: "808", lowRhythm: "x..x..x.x..x..x.", keys: "pluck",
    sections: [["Intro", 1], ["Verse 1", 5], ["Pre", 13], ["Coro", 17], ["Verse 2", 25], ["Coro", 37]],
    tips: ["Dembow: kick on every beat, snare on the 4th and 7th 16th of each half bar.", "Keep the 808 short and punchy, following the snare rhythm.", "Bright plucks and vocal chops sit on top."],
  },
  {
    id: "house", name: "House", family: "Electronic", bpm: 124, bpmRange: [120, 128], key: { tonic: "F", midi: 53, mode: "minor" },
    progression: [1, 6, 7, 5], sevenths: true, swing: 53, vibe: "Four on the floor, off-beat hats, chord stabs",
    drums: [
      { note: K, steps: "x...x...x...x..." },
      { note: CL, steps: "....x.......x..." },
      { note: OH, steps: "..x...x...x...x." },
      { note: HAT, steps: "oooooooooooooooo" },
    ],
    low: "bass", lowRhythm: "..x...x...x...x.", keys: "keys",
    sections: [["Intro", 1], ["Build", 17], ["Drop", 33], ["Break", 49], ["Drop 2", 65], ["Outro", 81]],
    tips: ["Sidechain the bass and chords to the kick (fast attack, ~100 ms release).", "Sections in 16 or 32 bars so DJs can mix it.", "Off-beat open hats give the groove its lift."],
  },
  {
    id: "dnb", name: "Drum & Bass", family: "Electronic", bpm: 174, bpmRange: [170, 176], key: { tonic: "E", midi: 52, mode: "minor" },
    progression: [1, 6, 4, 5], sevenths: false, swing: 50, vibe: "Two-step break, rolling sub, high energy",
    drums: [
      { note: K, steps: "x.........x....." },
      { note: SN, steps: "....x.......x..." },
      { note: HAT, steps: "x.x.x.x.x.x.x.x." },
      { note: SN, steps: ".......o.......o" },
    ],
    low: "bass", lowRhythm: "x.........x..x..", keys: "pad",
    sections: [["Intro", 1], ["Build", 17], ["Drop", 33], ["Break", 65], ["Drop 2", 81]],
    tips: ["Two-step: kick on 1 and the 'and' of 3, snare on 2 and 4.", "Keep the sub mono and clean below 100 Hz; put the growl on a separate mid-bass.", "Layer a sped-up break under the programmed drums for movement."],
  },
];

export function findGenre(id: string): GenreTemplate | undefined {
  return GENRES.find((g) => g.id === id);
}
