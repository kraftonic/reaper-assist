import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * File-based IPC with the REAPER bridge (assist_bridge.lua).
 *
 * REAPER's Lua has no sockets or HTTP, so requests and responses are JSON
 * files. Every write is atomic (write to tmp/, then rename). The bridge claims
 * a request by renaming it out of inbox/ before running it, and the app
 * withdraws a request by renaming it out of inbox/ as well. Only one of the
 * two renames can succeed, which gives the app a race-free way to cancel: if
 * the app's rename succeeds, the command can never run; if the file is
 * already gone, it may be running.
 */

export interface WireRequest {
  v: 1;
  id: string;
  session: string | null;
  kind: "command" | "batch" | "hello";
  command?: string;
  args?: unknown;
  commands?: { command: string; args: unknown }[];
  undoLabel?: string;
  atomic?: boolean;
  expectProject?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface WireResponse {
  v: number;
  id: string;
  session: string;
  status: string;
  command?: string | null;
  kind?: string | null;
  data?: Record<string, unknown>;
  observed?: Record<string, unknown>;
  message?: string;
  warnings?: string[];
  error?: { code: string; message: string; hint?: string; details?: unknown };
  undoLabel?: string;
  rolledBack?: boolean;
  durationMs?: number;
}

export interface BridgeStatus {
  bridge: string;
  bridgeVersion: string;
  protocol: string;
  session: string;
  seq: number;
  state: "running" | "stopped" | string;
  startedAt: number;
  now: number;
  reaperVersion: string;
  project: { key: string; name: string; path: string | null };
  playState: string;
  busy: boolean;
  lastRecording: { newTakes: number; startedAt: number } | null;
}

export type SendOutcome =
  | { kind: "response"; response: WireResponse; late?: boolean }
  /** Removed from the inbox before the bridge claimed it: definitely not executed. */
  | { kind: "not_executed"; reason: "timeout" | "cancelled" }
  /** Claimed by the bridge but no answer arrived: it may or may not have run. */
  | { kind: "unknown"; reason: "timeout" | "cancelled" };

export interface SendOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  /** Extra time to wait for an answer once the bridge has claimed the request. */
  claimedGraceMs?: number;
}

export interface TransportOptions {
  dir: string;
  pollMs?: number;
  now?: () => number;
}

const SUBDIRS = ["inbox", "outbox", "processing", "tmp", "events"] as const;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}

function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

export class FileBridgeTransport {
  readonly dir: string;
  private readonly pollMs: number;
  private readonly now: () => number;
  private seq = 0;
  private ready: Promise<void> | null = null;

  constructor(opts: TransportOptions) {
    this.dir = opts.dir;
    this.pollMs = opts.pollMs ?? 15;
    this.now = opts.now ?? Date.now;
  }

  path(...parts: string[]): string {
    return join(this.dir, ...parts);
  }

  ensureDirs(): Promise<void> {
    this.ready ??= (async () => {
      await mkdir(this.dir, { recursive: true });
      for (const d of SUBDIRS) await mkdir(this.path(d), { recursive: true });
    })().catch((e) => {
      this.ready = null;
      throw e;
    });
    return this.ready;
  }

  /** Sortable, unique, filename-safe. The bridge processes requests in name order. */
  newRequestId(): string {
    this.seq = (this.seq + 1) % 1_000_000;
    return `${String(this.now()).padStart(13, "0")}-${String(this.seq).padStart(6, "0")}-${randomBytes(4).toString("hex")}`;
  }

  async readStatus(): Promise<BridgeStatus | null> {
    try {
      const raw = await readFile(this.path("status.json"), "utf8");
      const v = JSON.parse(raw) as BridgeStatus;
      if (typeof v !== "object" || v === null || typeof v.session !== "string") return null;
      return v;
    } catch {
      return null;
    }
  }

  async writeAtomic(finalPath: string, data: string): Promise<void> {
    const tmp = this.path("tmp", `app-${process.pid}-${randomBytes(6).toString("hex")}.tmp`);
    try {
      await writeFile(tmp, data, "utf8");
      await rename(tmp, finalPath);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      // A folder was removed underneath us (e.g. the bridge folder was reset): recreate and retry once.
      this.ready = null;
      await this.ensureDirs();
      await writeFile(tmp, data, "utf8");
      await rename(tmp, finalPath);
    }
  }

  async send(
    req: Omit<WireRequest, "v" | "id" | "issuedAt" | "expiresAt"> & { id?: string },
    opts: SendOptions,
  ): Promise<SendOutcome> {
    // Cancelled before it was even written: nothing can have run.
    if (opts.signal?.aborted) return { kind: "not_executed", reason: "cancelled" };
    await this.ensureDirs();
    const id = req.id ?? this.newRequestId();
    const issuedAt = this.now();
    const body: WireRequest = { ...req, v: 1, id, issuedAt, expiresAt: issuedAt + opts.timeoutMs };
    const inboxPath = this.path("inbox", `${id}.json`);
    const outPath = this.path("outbox", `${id}.json`);
    await this.writeAtomic(inboxPath, JSON.stringify(body));

    const deadline = issuedAt + opts.timeoutMs;
    const response = await this.waitForResponse(outPath, deadline, opts.signal);
    if (response) return { kind: "response", response };

    // Timed out or cancelled. Try to withdraw the request. The bridge claims a request by
    // renaming it out of inbox/, so the app withdraws by renaming it too: of two renames of
    // the same file only one can succeed. (unlink is not safe here: on APFS an unlink that
    // overlaps the bridge's rename can succeed as well, and the command would run anyway.)
    const reason = opts.signal?.aborted ? "cancelled" : "timeout";
    const withdrawn = this.path("tmp", `${id}.withdrawn`);
    let won = false;
    try {
      await rename(inboxPath, withdrawn);
      won = true;
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
    if (won) {
      await unlink(withdrawn).catch(() => undefined);
      // Belt and braces: only report "not executed" if the bridge holds no copy and gave no answer.
      if (!(await exists(this.path("processing", `${id}.json`))) && !(await exists(outPath))) return { kind: "not_executed", reason };
    }
    const grace = opts.claimedGraceMs ?? 3000;
    const late = await this.waitForResponse(outPath, this.now() + grace);
    if (late) return { kind: "response", response: late, late: true };
    return { kind: "unknown", reason };
  }

  private async waitForResponse(outPath: string, deadline: number, signal?: AbortSignal): Promise<WireResponse | null> {
    for (;;) {
      const r = await this.tryReadResponse(outPath);
      if (r) return r;
      if (signal?.aborted || this.now() >= deadline) return null;
      await sleep(Math.min(this.pollMs, Math.max(1, deadline - this.now())), signal);
    }
  }

  private async tryReadResponse(outPath: string): Promise<WireResponse | null> {
    let raw: string;
    try {
      raw = await readFile(outPath, "utf8");
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
    await unlink(outPath).catch(() => undefined);
    try {
      return JSON.parse(raw) as WireResponse;
    } catch {
      return { v: 1, id: "", session: "", status: "unknown", error: { code: "INTERNAL", message: "The bridge's response could not be read." } };
    }
  }

  /** Delete responses nobody collected (after timeouts) once they are older than maxAgeMs. */
  async sweepOrphans(maxAgeMs = 60_000): Promise<string[]> {
    const removed: string[] = [];
    let names: string[] = [];
    try {
      names = await readdir(this.path("outbox"));
    } catch {
      return removed;
    }
    const cutoff = this.now() - maxAgeMs;
    for (const n of names) {
      const p = this.path("outbox", n);
      try {
        const s = await stat(p);
        if (s.mtimeMs < cutoff) {
          await unlink(p);
          removed.push(n);
        }
      } catch {
        /* raced with a reader */
      }
    }
    return removed;
  }

  /** Read and delete push-to-talk / bridge events (events/*.json). */
  async drainEvents(): Promise<unknown[]> {
    let names: string[] = [];
    try {
      names = (await readdir(this.path("events"))).filter((n) => n.endsWith(".json")).sort();
    } catch {
      return [];
    }
    const out: unknown[] = [];
    for (const n of names) {
      const p = this.path("events", n);
      try {
        const raw = await readFile(p, "utf8");
        await unlink(p);
        out.push(JSON.parse(raw));
      } catch {
        /* partial or raced; ignore */
      }
    }
    return out;
  }
}
