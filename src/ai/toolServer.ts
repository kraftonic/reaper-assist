import { createServer, type IncomingMessage } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ToolDef, ToolResult } from "./providers/types";
import { SKILL_TOOL } from "./skills";

export interface ToolServer {
  url: string;
  token: string;
  close(): void;
}

/**
 * Loopback-only endpoint the MCP tool server (src/ai/mcpServer.ts) forwards CLI tool calls to.
 * A fresh random token per app launch; requests without it are refused.
 */
export async function startToolServer(h: { tools(): ToolDef[]; call(convId: string, name: string, input: unknown): Promise<ToolResult> }): Promise<ToolServer> {
  const token = randomBytes(32).toString("hex");
  const expected = Buffer.from(`Bearer ${token}`);
  const authed = (req: IncomingMessage) => {
    const got = Buffer.from(String(req.headers.authorization ?? ""));
    return got.length === expected.length && timingSafeEqual(got, expected);
  };
  const server = createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (!authed(req)) return reply(401, { error: "unauthorized" });
    if (req.method === "GET" && req.url === "/tools") {
      // Skills (loadSkill) work with or without REAPER, so they are always listed.
      const tools = h.tools();
      return reply(200, tools.some((t) => t.name === SKILL_TOOL.name) ? tools : [...tools, SKILL_TOOL]);
    }
    if (req.method === "POST" && req.url === "/call") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 2_000_000) return reply(413, { error: "too large" });
      }
      try {
        const { name, input } = JSON.parse(raw) as { name: string; input: unknown };
        const r = await h.call(String(req.headers["x-ka-conv"] ?? ""), String(name), input);
        return reply(200, { content: r.content, isError: r.isError });
      } catch (e) {
        return reply(200, { content: `Assist error: ${e instanceof Error ? e.message : String(e)}`, isError: true });
      }
    }
    reply(404, { error: "not found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { url: `http://127.0.0.1:${port}`, token, close: () => server.close() };
}
