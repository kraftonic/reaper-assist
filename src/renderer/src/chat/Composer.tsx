import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ContextPreview, ImageRef, Mentionable, PermissionMode, SkillInfo } from "@shared/types";
import { IMAGE_LIMITS, formatBytes } from "@shared/images";
import { Icon } from "../Icon";
import { applyCompletion, canSend, contextChoice, findTrigger, menuItems, quickActions, usedMentions, type MenuItem, type Trigger } from "./chatLogic";
import { imageFiles, prepareImage, type PendingImage } from "./images";
import { Thumb } from "./Thumb";

/** A message ready to go. */
export interface Outgoing {
  text: string;
  images: PendingImage[];
  /** Images already stored with the chat (when editing a message that had some). */
  keep: ImageRef[];
  contextOff: string[];
  contextLabels: string[];
  mentions: { label: string; ref: string }[];
  /** Set when this replaces an earlier message. */
  editIndex?: number;
}

export interface ComposerHandle {
  /** Load an earlier message for editing. */
  edit(index: number, text: string, images: ImageRef[]): void;
  addFiles(files: File[]): void;
  /** The context chips as they are now (for retry). */
  choice(): { contextOff: string[]; contextLabels: string[] };
  focus(): void;
}

interface Props {
  convId: string;
  busy: boolean;
  connected: boolean;
  hidden: boolean;
  preview: ContextPreview | null;
  skills: SkillInfo[];
  mode: PermissionMode;
  setMode: (m: PermissionMode) => void;
  error: string | null;
  setError: (e: string | null) => void;
  onSend: (o: Outgoing) => Promise<boolean>;
  onStop: () => void;
  onEditLast: () => void;
  onFocus: () => void;
  onShowImage: (url: string, alt: string) => void;
}

export const MODE_LABEL: Record<PermissionMode, string> = { ask: "Ask before changes", "auto-edits": "Auto low-risk", "full-auto": "Full auto" };
const MODE_HINT: Record<PermissionMode, string> = {
  ask: "Every change waits for your OK.",
  "auto-edits": "Play, mute, volume, new tracks run; plug-ins, recording, edits ask.",
  "full-auto": "Everything runs without asking. Undo it in REAPER (Edit → Undo).",
};
export function nextMode(m: PermissionMode): PermissionMode {
  return m === "ask" ? "auto-edits" : m === "auto-edits" ? "full-auto" : "ask";
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(p, ref) {
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [keep, setKeep] = useState<ImageRef[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [caret, setCaret] = useState(0);
  /** A menu opened from a toolbar button rather than by typing / or @. */
  const [forced, setForced] = useState<Trigger["kind"] | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Mentionable[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const count = useRef(0);
  count.current = images.length + keep.length + preparing;

  const actions = useMemo(() => quickActions(p.preview), [p.preview]);
  const typed = findTrigger(draft, caret);
  const trigger: Trigger | null = forced ? { kind: forced, start: caret, query: "" } : typed;
  const triggerKey = trigger ? `${trigger.kind}:${trigger.start}` : null;
  const items = trigger && dismissed !== triggerKey ? menuItems(trigger, { actions, skills: p.skills, mentions: p.preview?.mentions ?? [] }) : [];
  const menuOpen = items.length > 0;
  const projectOff = off.has("project");

  useEffect(() => setActive(0), [triggerKey, trigger?.query]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  useEffect(() => {
    if (!p.hidden) input.current?.focus();
  }, [p.hidden]);

  const focusAt = (pos: number) =>
    requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });

  const addFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const room = IMAGE_LIMITS.perMessage - count.current;
      if (room <= 0) return p.setError(`Up to ${IMAGE_LIMITS.perMessage} images per message.`);
      if (files.length > room) p.setError(`Up to ${IMAGE_LIMITS.perMessage} images per message, so only the first ${room} were added.`);
      else p.setError(null);
      for (const f of files.slice(0, room)) {
        setPreparing((n) => n + 1);
        prepareImage(f, f.name)
          .then((img) => setImages((l) => [...l, img]))
          .catch((e: unknown) => p.setError(e instanceof Error ? e.message : String(e)))
          .finally(() => setPreparing((n) => n - 1));
      }
    },
    [p],
  );

  useImperativeHandle(
    ref,
    () => ({
      edit(index, text, imgs) {
        setEditIndex(index);
        setDraft(text);
        setImages([]);
        setKeep(imgs);
        setPicked([]);
        focusAt(text.length);
      },
      addFiles,
      choice: () => contextChoice(p.preview, off),
      focus: () => input.current?.focus(),
    }),
    [addFiles, p.preview, off],
  );

  const reset = () => {
    setDraft("");
    setImages([]);
    setKeep([]);
    setEditIndex(null);
    setPicked([]);
    setForced(null);
  };

  const submit = async () => {
    if (!canSend(draft, images.length + keep.length, p.busy, preparing)) return;
    const saved = { draft, images, keep, editIndex, picked };
    const out: Outgoing = {
      text: draft.trim(),
      images,
      keep,
      ...contextChoice(p.preview, off),
      mentions: usedMentions(draft, picked),
      ...(editIndex !== null ? { editIndex } : {}),
    };
    reset();
    p.setError(null);
    if (!(await p.onSend(out))) {
      // Refused (e.g. an image the main process rejected): put the message back.
      setDraft(saved.draft);
      setImages(saved.images);
      setKeep(saved.keep);
      setEditIndex(saved.editIndex);
      setPicked(saved.picked);
    }
  };

  const pick = (it: MenuItem) => {
    const t = trigger!;
    setForced(null);
    if (it.kind === "action") {
      setDraft(it.prompt);
      focusAt(it.prompt.length);
      return;
    }
    if (it.kind === "skill") {
      const rest = (t.kind === "slash" && !forced ? draft.slice(caret) : draft.replace(/^\/\S*\s*/, "")).trimStart();
      const text = `/${it.id} ${rest}`;
      setDraft(text);
      focusAt(it.id.length + 2);
      return;
    }
    setPicked((l) => [...l, it.mention]);
    if (forced) {
      const pre = draft.slice(0, caret);
      const ins = `${pre && !/\s$/.test(pre) ? " " : ""}@${it.label} `;
      const text = pre + ins + draft.slice(caret);
      setDraft(text);
      focusAt(pre.length + ins.length);
      return;
    }
    const r = applyCompletion(draft, caret, t, `@${it.label}`);
    setDraft(r.text);
    focusAt(r.caret);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (menuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
        return;
      }
      if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        pick(items[Math.min(active, items.length - 1)]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setForced(null);
        setDismissed(triggerKey);
        return;
      }
    }
    if (e.key === "Tab" && e.shiftKey) {
      // Like Claude Code: Shift+Tab cycles the permission mode.
      e.preventDefault();
      p.setMode(nextMode(p.mode));
      return;
    }
    if (e.key === "Escape") {
      if (editIndex !== null) {
        e.preventDefault();
        reset();
      } else if (p.busy) {
        e.preventDefault();
        p.onStop();
      }
      return;
    }
    if (e.key === "ArrowUp" && !draft && !images.length && !keep.length && editIndex === null && !p.busy) {
      e.preventDefault();
      p.onEditLast();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const toggleChip = (id: string) =>
    setOff((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chips = p.connected ? (p.preview?.chips ?? []) : [];
  const sendable = canSend(draft, images.length + keep.length, p.busy, preparing);

  return (
    <div className="composer-wrap">
      {p.error && (
        <div className="composer-error" role="alert">
          <span>{p.error}</span>
          <button className="icon-btn" onClick={() => p.setError(null)} title="Dismiss">
            <Icon name="x" size={12} />
          </button>
        </div>
      )}
      {menuOpen && (
        <div className="menu composer-menu" role="listbox" aria-label={trigger!.kind === "mention" ? "Tracks and sections" : "Quick actions and skills"}>
          <div className="menu-label">{trigger!.kind === "mention" ? "Mention a track or section" : actions.length ? "Quick actions and skills" : "Skills"}</div>
          {items.map((it, i) => (
            <button
              key={`${it.kind}:${it.id}`}
              role="option"
              aria-selected={i === active}
              className={`menu-item ${i === active ? "on" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep the caret in the box
                pick(it);
              }}
            >
              <Icon name={it.kind === "action" ? "bolt" : it.kind === "skill" ? "spark" : it.mention.kind === "track" ? "tracks" : "section"} size={13} />
              <span className="menu-main">{it.label}</span>
              <span className="menu-hint">{it.hint}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className={`composer ${editIndex !== null ? "editing" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {editIndex !== null && (
          <div className="edit-banner">
            <Icon name="edit" size={12} />
            <span>Editing. Sending replaces this message and the replies after it.</span>
            <button type="button" className="link" onClick={reset}>
              Cancel
            </button>
          </div>
        )}
        {chips.length > 0 && (
          <div className="ctx-chips" aria-label="REAPER context sent with this message">
            {chips.map((c) => {
              const isOff = off.has(c.id) || (projectOff && c.id !== "project");
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`ctx-chip ${isOff ? "off" : ""}`}
                  disabled={projectOff && c.id !== "project"}
                  aria-pressed={!isOff}
                  onClick={() => toggleChip(c.id)}
                  title={`${c.detail ?? c.label}\n${isOff ? "Left out of the next message. Click to include it." : "Goes with your next message. Click to leave it out."}`}
                >
                  <Icon name={c.icon} size={12} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {(images.length > 0 || keep.length > 0 || preparing > 0) && (
          <div className="attachments">
            {keep.map((r) => (
              <div className="attachment" key={r.id}>
                <Thumb convId={p.convId} image={r} onOpen={p.onShowImage} />
                <button type="button" className="remove" title="Remove" onClick={() => setKeep((l) => l.filter((x) => x.id !== r.id))}>
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
            {images.map((img) => (
              <div className="attachment" key={img.key} title={`${img.name ?? "Image"} · ${img.width}×${img.height} · ${formatBytes(img.bytes)}`}>
                <button type="button" className="thumb" onClick={() => p.onShowImage(img.url, img.name ?? "Attached image")}>
                  <img src={img.url} alt={img.name ?? "Attached image"} />
                </button>
                <button type="button" className="remove" title="Remove" onClick={() => setImages((l) => l.filter((x) => x.key !== img.key))}>
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
            {Array.from({ length: preparing }, (_, i) => (
              <div className="attachment loading" key={`prep-${i}`} aria-label="Preparing image" />
            ))}
          </div>
        )}
        <textarea
          ref={input}
          rows={1}
          value={draft}
          aria-label="Message"
          placeholder={p.connected ? "Ask, or tell me what to do in REAPER…" : "Ask a studio question…"}
          onChange={(e) => {
            setDraft(e.target.value);
            setCaret(e.target.selectionStart);
            setForced(null);
            if (dismissed && !e.target.value) setDismissed(null);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onFocus={p.onFocus}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const files = imageFiles(e.clipboardData?.files);
            if (!files.length) return;
            e.preventDefault();
            addFiles(files);
          }}
          onBlur={() => setForced(null)}
        />
        <div className="composer-bar">
          <input
            ref={file}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(imageFiles(e.target.files));
              e.target.value = "";
            }}
          />
          <button type="button" className="icon-btn" onClick={() => file.current?.click()} title="Attach images (or paste / drop a screenshot)">
            <Icon name="clip" />
          </button>
          {(actions.length > 0 || p.skills.length > 0) && (
            <button
              type="button"
              className={`icon-btn ${forced === "slash" ? "on" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDismissed(null);
                setForced(forced === "slash" ? null : "slash");
                input.current?.focus();
              }}
              title="Quick actions and skills (type /)"
            >
              <Icon name="spark" />
            </button>
          )}
          {p.connected && (p.preview?.mentions.length ?? 0) > 0 && (
            <button
              type="button"
              className={`icon-btn ${forced === "mention" ? "on" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDismissed(null);
                setForced(forced === "mention" ? null : "mention");
                input.current?.focus();
              }}
              title="Mention a track or section (type @)"
            >
              <Icon name="at" />
            </button>
          )}
          <div className="spacer" />
          {p.busy ? (
            <button type="button" className="send stop" onClick={p.onStop} title="Stop (Esc)">
              <Icon name="stop" />
            </button>
          ) : (
            <button type="submit" className="send" disabled={!sendable} title={editIndex !== null ? "Send edited message (Enter)" : "Send (Enter)"}>
              <Icon name="send" />
            </button>
          )}
        </div>
      </form>
      {p.connected && (
        <div className="mode-bar">
          <button type="button" className={`mode-chip mode-${p.mode}`} onClick={() => p.setMode(nextMode(p.mode))} title="How much Assist may do in REAPER without asking (Shift+Tab)">
            <Icon name={p.mode === "full-auto" ? "bolt" : p.mode === "ask" ? "key" : "check"} size={12} /> {MODE_LABEL[p.mode]}
          </button>
          <span className="dim small">{MODE_HINT[p.mode]}</span>
        </div>
      )}
    </div>
  );
});
