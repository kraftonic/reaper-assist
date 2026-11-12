/**
 * Assist REAPER tools as an MCP server over stdio.
 *
 * The Claude Code or Codex CLI starts this process when Assist runs it with
 * your own subscription login. It owns no logic: every tool call is forwarded
 * to the Assist window (127.0.0.1 only, with a per-launch token), which
 * validates it, asks for approval in the panel when needed, and talks to REAPER.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const URL_BASE = process.env.KA_URL;
const TOKEN = process.env.KA_TOKEN;
const CONV = process.env.KA_CONV ?? "";
if (!URL_BASE || !TOKEN) {
  process.stderr.write("reaper-assist-mcp: started without Assist's connection details\n");
  process.exit(1);
}

async function call(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${URL_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "x-ka-conv": CONV },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Assist answered ${res.status}`);
  return res.json();
}

const server = new Server({ name: "reaper", version: "0.2.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = (await call("/tools")) as { name: string; description: string; schema: Record<string, unknown> }[];
  return { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: { type: "object", ...t.schema } as { type: "object" } })) };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const r = (await call("/call", { name: req.params.name, input: req.params.arguments ?? {} })) as { content: string; isError: boolean };
    return { content: [{ type: "text", text: r.content }], isError: r.isError };
  } catch (e) {
    return { content: [{ type: "text", text: `REAPER Assist is not reachable: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
});

void server.connect(new StdioServerTransport());
