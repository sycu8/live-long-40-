/**
 * WebMCP (browser) tools for VivaAge — registers on page load when
 * `navigator.modelContext` is available.
 */
import { EXAMPLE_QUESTIONS } from "@shared/constants/product";

type JsonSchema = Record<string, unknown>;

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

type ModelContext = {
  registerTool?: (tool: WebMcpTool) => void;
  provideContext?: (ctx: { tools: WebMcpTool[] }) => void;
  unregisterTool?: (name: string) => void;
};

function getModelContext(): ModelContext | null {
  const nav = navigator as Navigator & { modelContext?: ModelContext };
  return nav.modelContext ?? null;
}

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

const TOOLS: WebMcpTool[] = [
  {
    name: "vivaage_get_meta",
    description:
      "Get VivaAge disclaimer, versions, and example educational questions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: async () => apiGet("/api/v1/meta"),
  },
  {
    name: "vivaage_list_library",
    description: "List educational library lessons; optional category filter.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Library category id" },
      },
      additionalProperties: false,
    },
    execute: async (args) => {
      const q =
        typeof args.category === "string" && args.category
          ? `?category=${encodeURIComponent(args.category)}`
          : "";
      return apiGet(`/api/v1/library${q}`);
    },
  },
  {
    name: "vivaage_open_ask",
    description:
      "Navigate the user to Hỏi VivaAge with an optional prefilled question.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Optional Vietnamese question to prefill",
        },
      },
      additionalProperties: false,
    },
    execute: (args) => {
      const q =
        typeof args.question === "string" && args.question.trim()
          ? args.question.trim()
          : EXAMPLE_QUESTIONS[0];
      const url = `/hoi?q=${encodeURIComponent(q)}`;
      window.location.assign(url);
      return { navigatedTo: url };
    },
  },
  {
    name: "vivaage_start_assessment",
    description: "Navigate to the readiness assessment flow.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: () => {
      window.location.assign("/danh-gia");
      return { navigatedTo: "/danh-gia" };
    },
  },
];

/** Register WebMCP tools; returns cleanup. */
export function registerWebMcpTools(): () => void {
  const ctx = getModelContext();
  if (!ctx) return () => undefined;

  const registered: string[] = [];

  if (typeof ctx.registerTool === "function") {
    for (const tool of TOOLS) {
      ctx.registerTool(tool);
      registered.push(tool.name);
    }
  } else if (typeof ctx.provideContext === "function") {
    ctx.provideContext({ tools: TOOLS });
    registered.push(...TOOLS.map((t) => t.name));
  }

  return () => {
    if (typeof ctx.unregisterTool === "function") {
      for (const name of registered) ctx.unregisterTool(name);
    }
  };
}
