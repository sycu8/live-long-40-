import type { Context } from "hono";
import type { Env, AppVariables } from "../env";
import { DEFAULT_PUBLIC_SITE_URL } from "@shared/constants/blog";
import { BRAND } from "@shared/brand";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export function publicOrigin(c: AppContext): string {
  const fromEnv = (c.env as Env & { PUBLIC_SITE_URL?: string }).PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    return new URL(c.req.url).origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

/** RFC 8288 Link values for homepage agent discovery. */
export function homepageLinkHeaders(origin: string): string[] {
  const o = origin.replace(/\/$/, "");
  return [
    `<${o}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${o}/openapi.json>; rel="service-desc"; type="application/json"`,
    `<${o}/llms.txt>; rel="service-doc"; type="text/plain"`,
    `<${o}/llms-full.txt>; rel="service-doc"; type="text/plain"`,
    `<${o}/auth.md>; rel="describedby"; type="text/markdown"`,
    `<${o}/.well-known/oauth-protected-resource>; rel="oauth-protected-resource"`,
    `<${o}/.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"`,
    `<${o}/.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"`,
    `<${o}/.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"`,
    `<${o}/.well-known/ard.json>; rel="ard"; type="application/json"`,
    `<${o}/sitemap.xml>; rel="describedby"; type="application/xml"`,
  ];
}

/** robots.txt Agentmap directive (ARD §5.1) pointing at the capability manifest. */
export function agentMapDirective(origin: string): string {
  const o = origin.replace(/\/$/, "");
  return `Agentmap: ${o}/.well-known/ai-catalog.json`;
}

export function applyHomepageLinkHeaders(res: Response, origin: string): Response {
  const headers = new Headers(res.headers);
  for (const link of homepageLinkHeaders(origin)) {
    headers.append("Link", link);
  }
  // Allow brief public caching of the HTML shell; discovery links stay on the response.
  if (!headers.has("Cache-Control") || headers.get("Cache-Control") === "no-store") {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function jsonPublic(
  c: AppContext,
  body: unknown,
  contentType = "application/json; charset=utf-8",
  maxAge = 3600,
  extraHeaders?: Record<string, string>,
) {
  return c.body(JSON.stringify(body, null, 2), 200, {
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=${maxAge}`,
    ...extraHeaders,
  });
}

/** CORS for the public ARD manifest. Scanners require a wildcard origin. */
export const ARD_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const APP_VERSION = "0.1.0";

export function openApiDocument(origin: string) {
  const o = origin.replace(/\/$/, "");
  return {
    openapi: "3.1.0",
    info: {
      title: `${BRAND.name} Public API`,
      version: APP_VERSION,
      description:
        "Educational HTTP API for readiness assessment, library lessons, motivational blog, and grounded Q&A. Not medical, financial, or legal advice.",
      contact: { name: BRAND.name, url: o },
    },
    servers: [{ url: o }],
    paths: {
      "/api/health": {
        get: {
          operationId: "health",
          summary: "Liveness / app metadata",
          responses: {
            "200": { description: "Service is up" },
          },
        },
      },
      "/api/v1/meta": {
        get: {
          operationId: "meta",
          summary: "Product disclaimer and example questions",
          responses: { "200": { description: "Meta payload" } },
        },
      },
      "/api/v1/session": {
        post: {
          operationId: "createAnonymousSession",
          summary: "Bootstrap anonymous session + CSRF cookie",
          responses: { "200": { description: "Session created" } },
        },
      },
      "/api/v1/library": {
        get: {
          operationId: "listLibrary",
          summary: "List active educational library lessons",
          parameters: [
            {
              name: "category",
              in: "query",
              schema: { type: "string" },
              required: false,
            },
          ],
          responses: { "200": { description: "Lesson list" } },
        },
      },
      "/api/v1/library/{slug}": {
        get: {
          operationId: "getLibraryLesson",
          summary: "Get one library lesson by slug",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Lesson" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/blog": {
        get: {
          operationId: "listBlog",
          summary: "List published posts (paginated 6–9/page; featured hero on page 1)",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", minimum: 6, maximum: 9 },
            },
            {
              name: "theme",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "featured + items, page, pageSize, total, totalPages",
            },
          },
        },
      },
      "/api/v1/chat/sessions": {
        post: {
          operationId: "createChatSession",
          summary: "Start a grounded Q&A chat session",
          responses: { "200": { description: "Chat session" } },
        },
      },
    },
  };
}

export function apiCatalogLinkset(origin: string) {
  const o = origin.replace(/\/$/, "");
  return {
    linkset: [
      {
        anchor: `${o}/api/v1`,
        "service-desc": [
          {
            href: `${o}/openapi.json`,
            type: "application/json",
          },
        ],
        "service-doc": [
          {
            href: `${o}/llms.txt`,
            type: "text/plain",
          },
          {
            href: `${o}/auth.md`,
            type: "text/markdown",
          },
        ],
        status: [
          {
            href: `${o}/api/health`,
            type: "application/json",
          },
        ],
        describedby: [
          {
            href: `${o}/.well-known/oauth-protected-resource`,
            type: "application/json",
          },
        ],
      },
    ],
  };
}

export function oauthProtectedResource(origin: string) {
  const o = origin.replace(/\/$/, "");
  return {
    resource: `${o}/`,
    authorization_servers: [`${o}/`],
    scopes_supported: ["public:read", "session:anonymous", "chat:ask", "assessment:run"],
    bearer_methods_supported: ["header", "cookie"],
    resource_documentation: `${o}/auth.md`,
  };
}

export function oauthAuthorizationServer(origin: string) {
  const o = origin.replace(/\/$/, "");
  return {
    issuer: `${o}/`,
    authorization_endpoint: `${o}/.well-known/oauth/authorize`,
    token_endpoint: `${o}/api/v1/session`,
    registration_endpoint: `${o}/api/v1/session`,
    jwks_uri: `${o}/.well-known/jwks.json`,
    grant_types_supported: [
      "urn:ietf:params:oauth:grant-type:device_code",
      "client_credentials",
    ],
    response_types_supported: ["token"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["public:read", "session:anonymous", "chat:ask", "assessment:run"],
    service_documentation: `${o}/auth.md`,
    code_challenge_methods_supported: ["S256"],
    agent_auth: {
      skill: `${o}/auth.md`,
      register_uri: `${o}/api/v1/session`,
      identity_endpoint: `${o}/api/v1/session`,
      claim_endpoint: `${o}/api/v1/session`,
      claim_uri: `${o}/api/v1/session`,
      identity_types_supported: ["anonymous"],
      anonymous: {
        credential_types_supported: ["session_cookie", "csrf_token"],
        claim_uri: `${o}/api/v1/session`,
      },
    },
  };
}

export function mcpServerCard(origin: string) {
  const o = origin.replace(/\/$/, "");
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/server-card/v1.json",
    serverInfo: {
      name: "vivaage",
      title: BRAND.name,
      version: APP_VERSION,
      description: BRAND.descriptionShort,
    },
    transport: {
      type: "streamable-http",
      endpoint: `${o}/mcp`,
    },
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
    },
    tools: [
      {
        name: "list_library",
        description: "List educational library lessons for healthy aging preparation.",
      },
      {
        name: "ask_vivaage",
        description:
          "Ask an educational question; returns a grounded answer when sources exist.",
      },
      {
        name: "get_meta",
        description: "Product disclaimer, versions, and example questions.",
      },
    ],
  };
}

/**
 * ARD / ai-catalog capability manifest.
 * specVersion is the ai-catalog data model (1.0), not the ARD spec version.
 * Each entry has exactly one of url or data (ARD §4.3).
 */
export function aiCatalogDocument(origin: string) {
  const o = origin.replace(/\/$/, "");
  const host = new URL(o).hostname;
  const urn = (namespace: string, name: string) => `urn:air:${host}:${namespace}:${name}`;

  return {
    specVersion: "1.0",
    host: {
      displayName: BRAND.name,
      identifier: `did:web:${host}`,
    },
    entries: [
      {
        identifier: urn("server", "vivaage"),
        displayName: "VivaAge MCP Server",
        description:
          "Educational MCP tools for library lessons, product meta, and grounded Q&A.",
        type: "application/mcp-server-card+json",
        url: `${o}/.well-known/mcp/server-card.json`,
        capabilities: ["list_library", "ask_vivaage", "get_meta"],
        representativeQueries: [
          "list VivaAge library lessons about healthy aging",
          "ask an educational question about preparing for later life",
          "what tools does the VivaAge MCP server expose",
        ],
      },
      {
        identifier: urn("api", "public"),
        displayName: "VivaAge Public HTTP API",
        description:
          "OpenAPI description of the public educational API: library, blog, assessment, and chat.",
        type: "application/openapi+json",
        url: `${o}/openapi.json`,
        capabilities: ["library", "blog", "assessment", "chat"],
        representativeQueries: [
          "how do I list published VivaAge blog posts",
          "what is the readiness assessment API",
          "bootstrap an anonymous session for the public API",
        ],
      },
      {
        identifier: urn("skills", "index"),
        displayName: "VivaAge Agent Skills",
        description:
          "Agent skills index for the VivaAge overview and anonymous-session auth skill.",
        type: "application/agent-skills+json",
        url: `${o}/.well-known/agent-skills/index.json`,
        capabilities: ["vivaage-overview", "vivaage-auth"],
        representativeQueries: [
          "how should an agent authenticate to VivaAge",
          "what can the VivaAge educational agent do",
        ],
      },
      {
        identifier: urn("catalog", "api"),
        displayName: "VivaAge API Catalog",
        description: "RFC 9727 linkset for the public API, docs, and health endpoint.",
        type: "application/linkset+json",
        url: `${o}/.well-known/api-catalog`,
        capabilities: ["service-desc", "service-doc", "status"],
        representativeQueries: [
          "where is the OpenAPI description for VivaAge",
          "find the health endpoint for the VivaAge API",
        ],
      },
    ],
  };
}
