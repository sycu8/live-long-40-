import type { Context } from "hono";
import type { Env, AppVariables } from "../env";
import { APP_VERSION } from "./meta";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

const TOOLS = [
  {
    name: "get_meta",
    description:
      "Return VivaAge product disclaimer, versions, and example questions.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_library",
    description: "List active educational library lessons (optional category filter).",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional library category id",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_health",
    description: "Check API liveness.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

export async function handleMcpRequest(c: AppContext): Promise<Response> {
  if (c.req.method === "GET" || c.req.method === "HEAD") {
    return c.json(
      {
        protocol: "mcp",
        version: "2025-03-26",
        serverInfo: { name: "vivaage", version: APP_VERSION },
        transport: "streamable-http",
        tools: TOOLS.map((t) => t.name),
      },
      200,
      { "Cache-Control": "public, max-age=300" },
    );
  }

  if (c.req.method !== "POST") {
    return c.json({ error: "method_not_allowed" }, 405);
  }

  let body: {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      400,
    );
  }

  const id = body.id ?? null;
  const method = body.method ?? "";

  if (method === "initialize") {
    return c.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "vivaage", version: APP_VERSION },
      },
    });
  }

  if (method === "tools/list" || method === "list_tools") {
    return c.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    });
  }

  if (method === "tools/call" || method === "call_tool") {
    const params = body.params ?? {};
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    try {
      const text = await runTool(c, name, args);
      return c.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text }],
          isError: false,
        },
      });
    } catch (err) {
      return c.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : "Tool error",
            },
          ],
          isError: true,
        },
      });
    }
  }

  if (method === "ping") {
    return c.json({ jsonrpc: "2.0", id, result: {} });
  }

  return c.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

async function runTool(
  c: AppContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (name === "get_health") {
    return JSON.stringify({
      ok: true,
      app: c.env.APP_NAME ?? "VivaAge",
      environment: c.env.ENVIRONMENT ?? "unknown",
    });
  }

  if (name === "get_meta") {
    const { DISCLAIMER, EXAMPLE_QUESTIONS } = await import(
      "@shared/constants/product"
    );
    return JSON.stringify({
      name: "VivaAge",
      disclaimer: DISCLAIMER,
      exampleQuestions: EXAMPLE_QUESTIONS,
      versions: {
        prompt: c.env.PROMPT_VERSION,
        scoring: c.env.SCORING_RULESET_VERSION,
      },
    });
  }

  if (name === "list_library") {
    const category =
      typeof args.category === "string" && args.category
        ? args.category
        : null;
    let sql = `SELECT slug, title, summary, category, pillar
               FROM library_lessons WHERE status = 'active'`;
    const binds: string[] = [];
    if (category) {
      sql += ` AND category = ?`;
      binds.push(category);
    }
    sql += ` ORDER BY category, title LIMIT 50`;
    const stmt = c.env.DB.prepare(sql);
    const rows = binds.length
      ? await stmt.bind(...binds).all()
      : await stmt.all();
    return JSON.stringify({ items: rows.results ?? [] });
  }

  throw new Error(`Unknown tool: ${name}`);
}
