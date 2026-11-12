import { useEffect, useMemo, useState } from "react";
import type { DawStatus } from "@shared/types";
import { GENRES, type GenreTemplate } from "@studio/genres";
import { FREE_PLUGINS, GENRE_LABELS, SOUND_SOURCES, type GenreTag, type PluginEntry } from "@studio/catalog";
import { api } from "../api";
import { Icon } from "../Icon";

export type StudioTab = "beats" | "sounds" | "plugins";

const TAG_ORDER: GenreTag[] = ["all", "trap", "drill", "boombap", "lofi", "rnb", "pop", "afrobeats", "reggaeton", "house", "dnb"];

export function Studio({ daw, tab, setTab }: { daw: DawStatus | null; tab: StudioTab; setTab: (t: StudioTab) => void }) {
  const [genre, setGenre] = useState<GenreTag>("all");
  const [installed, setInstalled] = useState<string[]>([]);

  useEffect(() => {
    void api.installedPlugins().then(setInstalled);
  }, []);

  return (
    <section className="sheet studio">
      <div className="tabs" role="tablist">
        {(
          [
            ["beats", "Beats"],
            ["sounds", "Sounds"],
            ["plugins", "Plug-ins"],
          ] as [StudioTab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="genre-chips">
        {TAG_ORDER.map((t) => (
          <button key={t} className={`gchip ${genre === t ? "on" : ""}`} onClick={() => setGenre(t)}>
            {GENRE_LABELS[t]}
          </button>
        ))}
      </div>
      {tab === "beats" && <Beats daw={daw} genre={genre} />}
      {tab === "sounds" && <Sounds genre={genre} />}
      {tab === "plugins" && <Plugins genre={genre} installed={installed} />}
    </section>
  );
}

const matches = (tags: GenreTag[], g: GenreTag) => g === "all" || tags.includes(g) || tags.includes("all");

/* ------------------------------------------------------------------ Beats */

function Beats({ daw, genre }: { daw: DawStatus | null; genre: GenreTag }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = GENRES.filter((g) => genre === "all" || g.id === genre);
  return (
    <div className="stack">
      <p className="dim small">
        One click sets up a session in REAPER: tempo, key, song-section markers, instrument tracks with a playable 4-bar starter, EQ/compression and reverb and delay buses. It's added to the open project as a single undo step.
      </p>
      {list.map((g) => (
        <GenreCard key={g.id} g={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} connected={daw?.state === "connected"} />
      ))}
    </div>
  );
}

function GenreCard({ g, open, onToggle, connected }: { g: GenreTemplate; open: boolean; onToggle: () => void; connected: boolean }) {
  const [bpm, setBpm] = useState(g.bpm);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; notes?: string[] } | null>(null);
  return (
    <div className={`card genre ${open ? "open" : ""}`}>
      <button className="genre-head" onClick={onToggle} aria-expanded={open}>
        <span className="genre-badge">
          <Icon name="music" size={15} />
        </span>
        <span className="genre-title">
          <strong>{g.name}</strong>
          <span className="dim small">{g.vibe}</span>
        </span>
        <span className="genre-meta">
          <span>{g.bpm}</span>
          <span className="dim small">BPM</span>
        </span>
      </button>
      {open && (
        <div className="stack genre-body">
          <div className="facts">
            <span className="tag">
              {g.key.tonic} {g.key.mode}
            </span>
            <span className="tag">{g.bpmRange.join("–")} BPM</span>
            {g.swing > 50 && <span className="tag">swing {g.swing}%</span>}
            <span className="tag">{g.low === "808" ? "808" : "bass"}</span>
          </div>
          <ul className="tips">
            {g.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="row">
            <label className="field bpm">
              <span>Tempo</span>
              <input type="number" min={40} max={220} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
            </label>
            <button
              className="btn primary grow"
              disabled={!connected || busy}
              title={connected ? "" : "Connect REAPER in Settings → DAW first"}
              onClick={async () => {
                setBusy(true);
                setResult(await api.buildTemplate(g.id, bpm));
                setBusy(false);
              }}
            >
              {busy ? "Building…" : connected ? "Build in REAPER" : "Connect REAPER to build"}
            </button>
          </div>
          {result && (
            <div className={`notice ${result.ok ? "info" : "error"}`}>
              {result.message}
              {result.notes?.map((n) => (
                <div key={n} className="small">
                  • {n}
                </div>
              ))}
              {result.ok && <div className="small">Press Space in REAPER to hear it. Undo removes the whole template in one step.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Sounds */

function Sounds({ genre }: { genre: GenreTag }) {
  const sources = SOUND_SOURCES.filter((s) => matches(s.genres, genre));
  return (
    <div className="stack">
      <h3>Free sources</h3>
      <p className="dim small">Each site's own terms apply. Most free packs are royalty-free in your tracks but can't be re-shared as samples.</p>
      {sources.map((s) => (
        <a key={s.name} className="card link-card" href={s.url} onClick={(e) => (e.preventDefault(), api.openExternal(s.url))}>
          <div className="row">
            <strong className="grow">{s.name}</strong>
            {s.access === "account" && <span className="tag">sign-up</span>}
            <Icon name="external" size={13} />
          </div>
          <span className="small">{s.what}</span>
          <span className="dim small">{s.license}</span>
        </a>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Plugins */

function isInstalled(p: PluginEntry, installed: string[]): boolean {
  const m = p.match?.toLowerCase();
  if (!m) return false;
  return installed.some((n) => n.replace(/\s+/g, "").includes(m.replace(/\s+/g, "")));
}

function Plugins({ genre, installed }: { genre: GenreTag; installed: string[] }) {
  const [kind, setKind] = useState<string>("All");
  const kinds = useMemo(() => ["All", ...Array.from(new Set(FREE_PLUGINS.map((p) => p.kind)))], []);
  const list = FREE_PLUGINS.filter((p) => matches(p.genres, genre) && (kind === "All" || p.kind === kind));
  return (
    <div className="stack">
      <div className="row wrap">
        {kinds.map((k) => (
          <button key={k} className={`gchip ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>
            {k}
          </button>
        ))}
      </div>
      {list.map((p) => (
        <a key={p.name} className="card link-card" href={p.url} onClick={(e) => (e.preventDefault(), api.openExternal(p.url))}>
          <div className="row">
            <strong className="grow">
              {p.name} <span className="dim small">· {p.maker}</span>
            </strong>
            {isInstalled(p, installed) && <span className="tag ok">installed</span>}
            {p.access === "account" && <span className="tag">sign-up</span>}
            {p.access === "open-source" && <span className="tag">open source</span>}
            <Icon name="external" size={13} />
          </div>
          <span className="small">{p.what}</span>
          <span className="dim small">{p.kind}</span>
        </a>
      ))}
    </div>
  );
}
