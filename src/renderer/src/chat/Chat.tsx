import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssistantPart, ChatEvent, ChatInput, ContextPreview, ConversationView, DawStatus, ImageRef, PermissionMode, SkillInfo, ToolPart, TranscriptItem, UserItem } from "@shared/types";
import { api } from "../api";
import { Icon } from "../Icon";
import { Composer, type ComposerHandle, type Outgoing } from "./Composer";
import { applyChatEvent, OFFLINE_SUGGESTIONS, quickActions, toolOutcome, type ToolOutcome } from "./chatLogic";
import { imageFiles, seedImage } from "./images";
import { Lightbox } from "./Lightbox";
import { Thumb } from "./Thumb";
import { prettyModel } from "./models";

export { MODE_LABEL, nextMode } from "./Composer";

const SUGGESTIONS_CONNECTED = ["What's in this project?", "Set up a vocal track with a clean chain", "Sidechain the bass to the kick", "Add a reverb bus and send the vocals to it"];

type Assistant = Extract<TranscriptItem, { role: "assistant" }>;

interface Props {
  conv: ConversationView;
  setConv: Dispatch<SetStateAction<ConversationView | null>>;
  daw: DawStatus | null;
  needsSetup: boolean;
  onSetup: () => void;
  hidden: boolean;
  mode: PermissionMode;
  setMode: (m: PermissionMode) => void;
}

/** What message rows need from the chat without prop drilling. */
interface ChatCtx {
  convId: string;
  busy: boolean;
  retry: () => void;
  openSettings: () => void;
  showImage: (url: string, alt: string) => void;
  setConv: Dispatch<SetStateAction<ConversationView | null>>;
}
const Ctx = createContext<ChatCtx | null>(null);
const useChat = () => useContext(Ctx)!;

export function Chat({ conv, setConv, daw, needsSetup, onSetup, hidden, mode, setMode }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ContextPreview | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const stick = useRef(true);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const connected = daw?.state === "connected";

  // Live updates from the main process. Text deltas are applied once per frame so long answers stream smoothly.
  useEffect(() => {
    let queue: ChatEvent[] = [];
    let frame = 0;
    const flush = () => {
      frame = 0;
      const evs = queue;
      queue = [];
      setConv((c) => evs.reduce(applyChatEvent, c));
    };
    const off = api.onChatEvent((e) => {
      if (e.convId !== conv.id) return;
      if (e.type === "done") {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        queue = [];
        setConv(e.conversation);
        setBusy(false);
        return;
      }
      queue.push(e);
      if (!frame) frame = requestAnimationFrame(flush);
    });
    return () => {
      off();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [conv.id, setConv]);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [conv]);

  // The chat box grows with chips, attachments and longer text; keep the newest message in view when it does.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    void api
      .listSkills()
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  // What REAPER context goes with the next message (chips, @-mentions, quick actions).
  const inFlight = useRef(false);
  const refreshContext = useCallback(() => {
    if (!connected) return setPreview(null);
    if (inFlight.current) return;
    inFlight.current = true;
    void api
      .chatContext()
      .then(setPreview)
      .catch(() => undefined)
      .finally(() => (inFlight.current = false));
  }, [connected]);
  useEffect(() => refreshContext(), [refreshContext, daw?.project, busy]);
  useEffect(() => {
    if (hidden || !connected) return;
    const t = setInterval(() => {
      if (document.hasFocus() && !busyRef.current) refreshContext();
    }, 5000);
    return () => clearInterval(t);
  }, [hidden, connected, refreshContext]);

  const send = useCallback(
    async (o: Outgoing): Promise<boolean> => {
      if (busyRef.current) return false;
      setBusy(true);
      stick.current = true;
      const shown: ImageRef[] = [
        ...o.keep,
        ...o.images.map((p) => {
          seedImage(p.key, p.url);
          return { id: p.key, mime: p.mime, width: p.width, height: p.height, bytes: p.bytes, ...(p.name ? { name: p.name } : {}) };
        }),
      ];
      const user: UserItem = { role: "user", text: o.text, at: Date.now(), ...(shown.length ? { images: shown } : {}), ...(o.contextLabels.length ? { context: o.contextLabels } : {}) };
      const placeholder: Assistant = { role: "assistant", parts: [], at: Date.now(), model: "", provider: "anthropic" };
      let before: TranscriptItem[] = [];
      setConv((c) => {
        if (!c) return c;
        before = c.transcript;
        const kept = o.editIndex !== undefined ? c.transcript.slice(0, o.editIndex) : c.transcript;
        return { ...c, transcript: [...kept, user, placeholder] };
      });
      const input: ChatInput = {
        text: o.text,
        images: o.images.map((p) => ({ mime: p.mime, data: p.data, ...(p.name ? { name: p.name } : {}) })),
        keepImages: o.keep,
        contextOff: o.contextOff,
        contextLabels: o.contextLabels,
        mentions: o.mentions,
      };
      let r: { ok: boolean; message?: string };
      try {
        r = o.editIndex !== undefined ? await api.editAndResend(conv.id, o.editIndex, input) : await api.send(conv.id, input);
      } catch (e) {
        r = { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
      if (!r.ok) {
        setConv((c) => (c ? { ...c, transcript: before } : c));
        setBusy(false);
        setError(r.message ?? "Couldn't send that.");
      }
      return r.ok;
    },
    [conv.id, setConv],
  );

  const retry = useCallback(async () => {
    if (busyRef.current) return;
    setBusy(true);
    setError(null);
    stick.current = true;
    let before: TranscriptItem[] = [];
    setConv((c) => {
      if (!c) return c;
      before = c.transcript;
      const t = c.transcript.slice();
      while (t.length && t[t.length - 1]!.role === "assistant") t.pop();
      return { ...c, transcript: [...t, { role: "assistant", parts: [], at: Date.now(), model: "", provider: "anthropic" }] };
    });
    const r = await api.retry(conv.id, composer.current?.choice()).catch((e: unknown) => ({ ok: false, message: String(e) }));
    if (!r.ok) {
      setConv((c) => (c ? { ...c, transcript: before } : c));
      setBusy(false);
      setError(r.message ?? "Couldn't retry.");
    }
  }, [conv.id, setConv]);

  const editAt = useCallback(
    (index: number) => {
      const it = conv.transcript[index];
      if (!it || it.role !== "user" || busyRef.current) return;
      composer.current?.edit(index, it.skill ? `/${it.skill.id}${it.text ? ` ${it.text}` : ""}` : it.text, it.images ?? []);
    },
    [conv.transcript],
  );
  const editLast = useCallback(() => {
    for (let i = conv.transcript.length - 1; i >= 0; i--) if (conv.transcript[i]!.role === "user") return editAt(i);
  }, [conv.transcript, editAt]);

  const ctx = useMemo<ChatCtx>(
    () => ({ convId: conv.id, busy, retry: () => void retry(), openSettings: onSetup, showImage: (url, alt) => setLightbox({ url, alt }), setConv }),
    [conv.id, busy, retry, onSetup, setConv],
  );

  const empty = conv.transcript.length === 0;
  const actions = quickActions(preview);
  const lastIndex = conv.transcript.length - 1;

  return (
    <Ctx.Provider value={ctx}>
      <section
        className="chat"
        hidden={hidden}
        onDragEnter={(e) => {
          if (Array.from(e.dataTransfer.types).includes("Files")) setDragging(true);
        }}
        onDragOver={(e) => {
          if (!Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = imageFiles(e.dataTransfer.files);
          if (files.length) composer.current?.addFiles(files);
          else if (e.dataTransfer.files.length) setError("Only images can be attached (PNG, JPEG, WebP or GIF).");
        }}
      >
        <div
          className="messages"
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {empty && (
            <div className="empty">
              <div className="empty-mark">
                <Icon name="wave" size={28} />
              </div>
              <h1>Ask anything about your session</h1>
              <p className="dim">
                Mixing, recording, sound design, or where a setting lives. Paste a screenshot of a plug-in or error and I'll read it.{" "}
                {connected ? "REAPER is connected, so I can make the changes too." : "Connect REAPER in Settings and I can make changes for you too."}
              </p>
              {needsSetup ? (
                <button className="btn primary" onClick={onSetup}>
                  <Icon name="key" /> Add an API key to start
                </button>
              ) : (
                <div className="suggestions">
                  {connected && actions.length
                    ? actions.map((a) => (
                        <button key={a.id} className="suggestion" onClick={() => void send({ text: a.prompt, images: [], keep: [], ...(composer.current?.choice() ?? { contextOff: [], contextLabels: [] }), mentions: [] })} title={a.prompt}>
                          <Icon name="bolt" size={13} /> {a.label}
                        </button>
                      ))
                    : (connected ? SUGGESTIONS_CONNECTED : OFFLINE_SUGGESTIONS).map((s) => (
                        <button key={s} className="suggestion" onClick={() => void send({ text: s, images: [], keep: [], contextOff: [], contextLabels: [], mentions: [] })}>
                          {s}
                        </button>
                      ))}
                </div>
              )}
            </div>
          )}
          {conv.transcript.map((item, i) =>
            item.role === "user" ? (
              <UserMessage key={i} item={item} index={i} onEdit={busy ? null : editAt} />
            ) : (
              <AssistantMessage key={i} item={item} live={busy && i === lastIndex} last={i === lastIndex} />
            ),
          )}
        </div>

        <Composer
          ref={composer}
          convId={conv.id}
          busy={busy}
          connected={connected}
          hidden={hidden}
          preview={preview}
          skills={skills}
          mode={mode}
          setMode={setMode}
          error={error}
          setError={setError}
          onSend={send}
          onStop={() => void api.stop(conv.id)}
          onEditLast={editLast}
          onFocus={refreshContext}
          onShowImage={(url, alt) => setLightbox({ url, alt })}
        />
        {dragging && (
          <div className="drop-zone" aria-hidden>
            <Icon name="image" size={28} />
            <span>Drop images to attach</span>
          </div>
        )}
        {lightbox && <Lightbox url={lightbox.url} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      </section>
    </Ctx.Provider>
  );
}

/* ---------------------------------------------------------------- messages */

export const UserMessage = memo(function UserMessage({ item, index, onEdit }: { item: UserItem; index: number; onEdit: ((i: number) => void) | null }) {
  const { convId, showImage } = useChat();
  return (
    <div className="msg user">
      {item.images?.length ? (
        <div className="msg-images">
          {item.images.map((img) => (
            <Thumb key={img.id} convId={convId} image={img} onOpen={showImage} />
          ))}
        </div>
      ) : null}
      {(item.text || item.skill) && (
        <div className="bubble">
          {item.skill && (
            <span className="skill-tag" title={`Sent with the ${item.skill.title} skill`}>
              /{item.skill.id}
            </span>
          )}
          {item.skill && item.text ? " " : null}
          {item.text}
        </div>
      )}
      <div className="msg-meta">
        {item.context?.length ? (
          <span className="ctx-note" title={`REAPER context sent: ${item.context.join(", ")}`}>
            with {item.context.join(" · ")}
          </span>
        ) : null}
        {onEdit && (
          <button className="msg-action" onClick={() => onEdit(index)} title="Edit and resend">
            <Icon name="edit" size={12} />
          </button>
        )}
      </div>
    </div>
  );
});

export const AssistantMessage = memo(function AssistantMessage({ item, live, last }: { item: Assistant; live: boolean; last: boolean }) {
  const { busy, retry } = useChat();
  const [copied, setCopied] = useState(false);
  const text = item.parts
    .filter((p): p is Extract<AssistantPart, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join("\n\n")
    .trim();
  const tail = item.parts[item.parts.length - 1];
  return (
    <div className="msg assistant">
      {item.parts.length === 0 && live && (
        <div className="typing" aria-label="Thinking">
          <span />
          <span />
          <span />
        </div>
      )}
      {item.parts.map((p, i) => (
        <Part key={i} part={p} streaming={live && p === tail && p.kind === "text"} last={last} />
      ))}
      {!live && item.parts.length > 0 && (
        <div className="msg-meta assistant-meta">
          {text && (
            <button
              className="msg-action"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              title="Copy answer"
            >
              <Icon name={copied ? "check" : "copy"} size={12} />
            </button>
          )}
          {last && !busy && (
            <button className="msg-action" onClick={retry} title="Ask again">
              <Icon name="retry" size={12} />
            </button>
          )}
          {item.model && <span className="model-note">{prettyModel(item.model) === "default" ? "" : prettyModel(item.model)}</span>}
        </div>
      )}
    </div>
  );
});

const Part = memo(function Part({ part, streaming, last }: { part: AssistantPart; streaming: boolean; last: boolean }) {
  if (part.kind === "text") return <TextPart text={part.text} streaming={streaming} />;
  if (part.kind === "notice") return <Notice level={part.level} text={part.text} last={last} />;
  return <ToolCard part={part} />;
});

const MD_COMPONENTS = {
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) void api.openExternal(href);
      }}
    >
      {children}
    </a>
  ),
  pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
};

function TextPart({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className={`md ${streaming ? "streaming" : ""}`}>
      <Markdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const lang = /language-([\w-]+)/.exec(((children as { props?: { className?: string } } | undefined)?.props?.className as string) ?? "")?.[1];
  return (
    <div className="code">
      {lang && <span className="code-lang">{lang}</span>}
      <button
        className="copy"
        onClick={() => {
          void navigator.clipboard.writeText(ref.current?.innerText ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

function Notice({ level, text, last }: { level: "info" | "warn" | "error"; text: string; last: boolean }) {
  const { busy, retry, openSettings } = useChat();
  const settings = /Settings →/.test(text);
  return (
    <div className={`notice ${level}`}>
      <span>{text}</span>
      {level !== "info" && last && !busy && (
        <span className="notice-actions">
          <button className="btn small" onClick={retry}>
            <Icon name="retry" size={12} /> Retry
          </button>
          {settings && (
            <button className="btn small" onClick={openSettings}>
              <Icon name="gear" size={12} /> Open Settings
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- tool cards */

const BADGE: Record<ToolOutcome["badge"], string> = {
  waiting: "Needs your OK",
  running: "Running…",
  verified: "Verified",
  done: "Done",
  check: "Check it",
  failed: "Failed",
  skipped: "Skipped",
  undone: "Undone",
};

const RISK_NOTE: Record<ToolPart["risk"], string> = {
  read: "Reads the project. Changes nothing.",
  safe: "A small change you can undo.",
  caution: "Changes your project. One undo step.",
  destructive: "Changes existing material. One undo step.",
};

export function ToolCard({ part }: { part: ToolPart }) {
  const { convId, busy, setConv } = useChat();
  const [open, setOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);
  const out = toolOutcome(part);
  const waiting = out.badge === "waiting";
  const icon = out.badge === "verified" || out.badge === "done" ? "check" : out.badge === "failed" || out.badge === "skipped" ? "x" : out.badge === "undone" ? "undo" : "bolt";
  const undo = async () => {
    setUndoing(true);
    setUndoMsg(null);
    const r = await api.undoTool(convId, part.id).catch((e: unknown) => ({ ok: false, message: String(e), conversation: undefined }));
    setUndoing(false);
    if (r.conversation) setConv(r.conversation);
    if (!r.ok) setUndoMsg(r.message);
  };
  return (
    <div className={`tool ${part.status} risk-${part.risk} badge-${out.badge}`}>
      <button className="tool-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="tool-icon">
          <Icon name={icon} size={14} />
        </span>
        <span className="tool-summary">{part.summary}</span>
        <span className="tool-status">{BADGE[out.badge]}</span>
      </button>
      {waiting && <div className="tool-msg">{RISK_NOTE[part.risk]}</div>}
      {!waiting && out.message && !open && <div className="tool-msg">{out.message}</div>}
      {undoMsg && <div className="tool-msg warn">{undoMsg}</div>}
      {waiting && (
        <div className="approve">
          <button className="btn primary" onClick={() => api.answerApproval(part.id, "once")}>
            <Icon name="check" /> Do it
          </button>
          <button className="btn" onClick={() => api.answerApproval(part.id, "chat")} title={`Don't ask again for “${part.name}” in this chat`}>
            Yes, this chat
          </button>
          <button className="btn" onClick={() => api.answerApproval(part.id, "always")} title={`Always allow “${part.name}” (change in Settings → DAW)`}>
            Always
          </button>
          <button className="btn ghost" onClick={() => api.answerApproval(part.id, "deny")}>
            Skip
          </button>
        </div>
      )}
      {out.undoLabel && !busy && (
        <div className="tool-actions">
          <button className="btn small" disabled={undoing} onClick={() => void undo()} title={`Undo “${out.undoLabel}” in REAPER`}>
            <Icon name="undo" size={12} /> {undoing ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}
      {open && (
        <div className="tool-detail">
          <div className="dim small">Action: {part.name}</div>
          <pre>{JSON.stringify(part.input, null, 2)}</pre>
          {out.detail && (
            <>
              <div className="dim small">Result</div>
              <pre>{out.detail}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
