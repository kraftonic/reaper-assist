/**
 * A curated starter kit of free plug-ins and sample sources, tagged by genre.
 * Links point to each maker's own page; downloads happen there, under their
 * terms. Nothing here is bundled or redistributed by REAPER Assist.
 * Links checked 2026-11-04.
 */

export type GenreTag = "trap" | "drill" | "boombap" | "lofi" | "rnb" | "pop" | "afrobeats" | "reggaeton" | "house" | "dnb" | "all";

export interface PluginEntry {
  name: string;
  maker: string;
  kind: "Synth" | "Sampler" | "Drums" | "EQ" | "Dynamics" | "Reverb & Delay" | "Saturation & Lo-fi" | "Stereo" | "Metering" | "Bundle";
  what: string;
  genres: GenreTag[];
  url: string;
  /** "account" = free but needs a sign-up or the maker's installer app. */
  access: "direct" | "account" | "open-source";
  /** Substring that identifies it in REAPER's plug-in list, to show "Installed". */
  match?: string;
}

export interface SoundSource {
  name: string;
  what: string;
  genres: GenreTag[];
  url: string;
  license: string;
  access: "direct" | "account";
}

export const FREE_PLUGINS: PluginEntry[] = [
  { name: "Vital", maker: "Matt Tytel", kind: "Synth", what: "Wavetable synth: modern leads, plucks, basses. Free tier is fully usable.", genres: ["trap", "drill", "pop", "house", "dnb", "reggaeton"], url: "https://vital.audio", access: "account", match: "vital" },
  { name: "Surge XT", maker: "Surge Synth Team", kind: "Synth", what: "Deep hybrid synth with thousands of presets.", genres: ["house", "dnb", "pop", "all"], url: "https://surge-synthesizer.github.io", access: "open-source", match: "surge" },
  { name: "Dexed", maker: "Digital Suburban", kind: "Synth", what: "Classic FM synth: e-pianos, bells, glassy keys.", genres: ["rnb", "lofi", "pop"], url: "https://asb2m10.github.io/dexed/", access: "open-source", match: "dexed" },
  { name: "TAL-NoiseMaker", maker: "TAL Software", kind: "Synth", what: "Warm analog-style synth: pads, basses, simple leads.", genres: ["lofi", "house", "pop"], url: "https://tal-software.com/products/tal-noisemaker", access: "direct", match: "noisemaker" },
  { name: "LABS", maker: "Spitfire Audio", kind: "Sampler", what: "Free sampled pianos, strings, choirs, textures: drill and R&B melodies.", genres: ["drill", "rnb", "lofi", "trap"], url: "https://labs.spitfireaudio.com", access: "account", match: "labs" },
  { name: "Decent Sampler", maker: "Decent Samples", kind: "Sampler", what: "Free player with a big catalog of free instruments.", genres: ["lofi", "rnb", "all"], url: "https://www.decentsamples.com", access: "direct", match: "decentsampler" },
  { name: "Sitala", maker: "Decomposer", kind: "Drums", what: "Simple 16-pad drum sampler: drag in any one-shots.", genres: ["boombap", "house", "afrobeats", "all"], url: "https://decomposer.de/sitala/", access: "direct", match: "sitala" },
  { name: "Kilohearts Essentials", maker: "Kilohearts", kind: "Bundle", what: "30+ small effects (EQ, delay, distortion, trance gate…).", genres: ["all"], url: "https://kilohearts.com/products/kilohearts_essentials", access: "account", match: "kilohearts" },
  { name: "MFreeFXBundle", maker: "MeldaProduction", kind: "Bundle", what: "Large free bundle: EQ, compressors, analyzers, modulation.", genres: ["all"], url: "https://www.meldaproduction.com/MFreeFXBundle", access: "direct", match: "mfree" },
  { name: "TDR Nova", maker: "Tokyo Dawn Labs", kind: "EQ", what: "Dynamic EQ: tame harsh vocals, de-mud 808s only when they boom.", genres: ["all"], url: "https://www.tokyodawn.net/tdr-nova/", access: "direct", match: "nova" },
  { name: "TDR Kotelnikov", maker: "Tokyo Dawn Labs", kind: "Dynamics", what: "Transparent bus and mastering compressor.", genres: ["all"], url: "https://www.tokyodawn.net/tdr-kotelnikov/", access: "direct", match: "kotelnikov" },
  { name: "DC1A", maker: "Klanghelm", kind: "Dynamics", what: "One-knob character compressor, great on vocals and drums.", genres: ["boombap", "rnb", "all"], url: "https://klanghelm.com/contents/products/DC1A.php", access: "direct", match: "dc1a" },
  { name: "OTT", maker: "Xfer Records", kind: "Dynamics", what: "Aggressive multiband compression: the EDM/trap 'make it pop' button.", genres: ["trap", "house", "dnb", "pop"], url: "https://xferrecords.com/freeware", access: "direct", match: "ott" },
  { name: "Valhalla Supermassive", maker: "Valhalla DSP", kind: "Reverb & Delay", what: "Huge lush reverbs and delays.", genres: ["trap", "drill", "rnb", "lofi", "all"], url: "https://valhalladsp.com/shop/reverb/valhalla-supermassive/", access: "direct", match: "supermassive" },
  { name: "Dragonfly Reverb", maker: "Michael Willis", kind: "Reverb & Delay", what: "Natural room, plate and hall reverbs.", genres: ["all"], url: "https://michaelwillis.github.io/dragonfly-reverb/", access: "open-source", match: "dragonfly" },
  { name: "Saturation Knob", maker: "Softube", kind: "Saturation & Lo-fi", what: "Instant warmth and grit; thicken 808s.", genres: ["trap", "drill", "boombap"], url: "https://www.softube.com/plug-ins/saturation-knob", access: "account", match: "saturation knob" },
  { name: "Vinyl", maker: "iZotope", kind: "Saturation & Lo-fi", what: "Vinyl crackle, wear and warp for lo-fi.", genres: ["lofi", "boombap"], url: "https://www.izotope.com/en/products/vinyl.html", access: "account", match: "vinyl" },
  { name: "ChowTapeModel", maker: "Chowdhury DSP", kind: "Saturation & Lo-fi", what: "Analog tape: saturation, wow and flutter.", genres: ["lofi", "boombap", "rnb"], url: "https://chowdsp.com/products.html", access: "open-source", match: "chowtape" },
  { name: "Airwindows", maker: "Chris Johnson", kind: "Bundle", what: "Hundreds of open-source effects (consoles, tape, saturation).", genres: ["all"], url: "https://www.airwindows.com", access: "open-source", match: "airwindows" },
  { name: "Wider", maker: "Polyverse", kind: "Stereo", what: "Mono-compatible stereo widening for pads and backing vocals.", genres: ["pop", "rnb", "house"], url: "https://polyversemusic.com/products/wider/", access: "account", match: "wider" },
  { name: "Youlean Loudness Meter", maker: "Youlean", kind: "Metering", what: "LUFS and true-peak meter: hit streaming loudness targets.", genres: ["all"], url: "https://youlean.co/youlean-loudness-meter/", access: "direct", match: "youlean" },
  { name: "SPAN", maker: "Voxengo", kind: "Metering", what: "Spectrum analyzer: see where the 808 and kick collide.", genres: ["all"], url: "https://www.voxengo.com/product/span/", access: "direct", match: "span" },
];

export const SOUND_SOURCES: SoundSource[] = [
  { name: "SampleRadar (MusicRadar)", what: "Hundreds of large free packs across every genre, direct downloads.", genres: ["all"], url: "https://www.musicradar.com/news/tech/free-music-samples-royalty-free-loops-hits-and-multis-to-download-sampleradar", license: "Royalty-free in your music; don't redistribute the samples.", access: "direct" },
  { name: "Cymatics free vault", what: "Trap, drill, hip-hop and EDM drum kits, loops and presets.", genres: ["trap", "drill", "house", "pop"], url: "https://cymatics.fm/pages/free-download-vault", license: "Royalty-free per pack terms; email sign-up.", access: "account" },
  { name: "Looperman", what: "Huge community library of loops and acapellas, strong in hip-hop and trap.", genres: ["trap", "drill", "boombap", "rnb"], url: "https://www.looperman.com", license: "Per-loop terms set by each uploader; read them before release.", access: "account" },
  { name: "99Sounds", what: "Free sound libraries: textures, drums, cinematic hits.", genres: ["lofi", "house", "all"], url: "https://99sounds.org", license: "Royalty-free; see each library.", access: "direct" },
  { name: "Bedroom Producers Blog freebies", what: "Curated list of free sample packs, updated often.", genres: ["all"], url: "https://bedroomproducersblog.com/free-samples/", license: "Varies by pack.", access: "direct" },
  { name: "Freesound", what: "Field recordings, foley, one-shots; filter by CC0 for no-strings use.", genres: ["lofi", "afrobeats", "all"], url: "https://freesound.org", license: "Creative Commons per sound (CC0, CC BY…).", access: "account" },
  { name: "Reverb Drum Machines", what: "Classic drum machines sampled in detail: boom bap, house, electro.", genres: ["boombap", "house", "trap"], url: "https://reverb.com/software/samples/reverb-drum-machines", license: "Free and royalty-free.", access: "direct" },
  { name: "Philharmonia sound samples", what: "Orchestral one-shots: strings, brass, woodwinds for drill and cinematic beats.", genres: ["drill", "trap"], url: "https://philharmonia.co.uk/resources/sound-samples/", license: "Free to use in music; don't sell the samples themselves.", access: "direct" },
  { name: "VCSL", what: "Versilian Community Sample Library: pianos, percussion, orchestral.", genres: ["lofi", "afrobeats", "all"], url: "https://github.com/sgossner/VCSL", license: "CC0 (public domain).", access: "direct" },
  { name: "FreePats", what: "Free instrument samples and SoundFonts.", genres: ["all"], url: "https://freepats.zenvoid.org", license: "Mostly CC0/GPL, per instrument.", access: "direct" },
];

export const GENRE_LABELS: Record<GenreTag, string> = {
  all: "Everything", trap: "Trap", drill: "Drill", boombap: "Boom Bap", lofi: "Lo-fi", rnb: "R&B", pop: "Pop", afrobeats: "Afrobeats", reggaeton: "Reggaeton", house: "House", dnb: "Drum & Bass",
};
