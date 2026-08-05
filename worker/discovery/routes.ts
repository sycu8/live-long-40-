import { Hono } from "hono";
import type { Env, AppVariables } from "../env";
import {
  apiCatalogLinkset,
  applyHomepageLinkHeaders,
  jsonPublic,
  mcpServerCard,
  oauthAuthorizationServer,
  oauthProtectedResource,
  openApiDocument,
  publicOrigin,
} from "./meta";
import { handleMcpRequest } from "./mcp";
import { agentSkillsIndex, skillMarkdown } from "./skills";

export const discoveryRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

/** Homepage: serve SPA shell from ASSETS and attach RFC 8288 Link headers. */
discoveryRoutes.get("/", async (c) => {
  if (!c.env.ASSETS) {
    return c.text("ASSETS binding missing", 500);
  }
  const assetRes = await c.env.ASSETS.fetch(c.req.raw);
  return applyHomepageLinkHeaders(assetRes, publicOrigin(c));
});

discoveryRoutes.get("/openapi.json", (c) =>
  jsonPublic(c, openApiDocument(publicOrigin(c))),
);

discoveryRoutes.get("/llms.txt", (c) => servePlainTextAsset(c, "/llms.txt"));
discoveryRoutes.get("/llms-full.txt", (c) =>
  servePlainTextAsset(c, "/llms-full.txt"),
);

discoveryRoutes.get("/auth.md", async (c) => {
  const origin = publicOrigin(c);
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(new URL("/auth.md", c.req.url));
    if (res.ok) {
      const text = await res.text();
      // Rewrite absolute site URL placeholder if present
      const body = text.replaceAll("{{SITE_URL}}", origin);
      return c.body(body, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
    }
  }
  return c.body(fallbackAuthMd(origin), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

discoveryRoutes.get("/.well-known/api-catalog", (c) =>
  jsonPublic(
    c,
    apiCatalogLinkset(publicOrigin(c)),
    "application/linkset+json; charset=utf-8",
  ),
);

discoveryRoutes.get("/.well-known/oauth-protected-resource", (c) =>
  jsonPublic(c, oauthProtectedResource(publicOrigin(c))),
);

discoveryRoutes.get("/.well-known/oauth-authorization-server", (c) =>
  jsonPublic(c, oauthAuthorizationServer(publicOrigin(c))),
);

discoveryRoutes.get("/.well-known/openid-configuration", (c) =>
  jsonPublic(c, {
    ...oauthAuthorizationServer(publicOrigin(c)),
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["none"],
  }),
);

discoveryRoutes.get("/.well-known/jwks.json", (c) =>
  jsonPublic(c, {
    keys: [],
  }),
);

discoveryRoutes.get("/.well-known/oauth/authorize", (c) => {
  const origin = publicOrigin(c);
  return c.json(
    {
      error: "unsupported_response_type",
      error_description:
        "VivaAge public APIs use anonymous session cookies. POST /api/v1/session to register an anonymous agent session. See /auth.md.",
      authorization_servers: [`${origin}/`],
      register_uri: `${origin}/api/v1/session`,
    },
    400,
  );
});

discoveryRoutes.get("/.well-known/mcp/server-card.json", (c) =>
  jsonPublic(c, mcpServerCard(publicOrigin(c))),
);

discoveryRoutes.get("/.well-known/mcp.json", (c) =>
  jsonPublic(c, mcpServerCard(publicOrigin(c))),
);

discoveryRoutes.get("/.well-known/agent-skills/index.json", async (c) => {
  const origin = publicOrigin(c);
  const index = await agentSkillsIndex(origin, c.env.ASSETS);
  return jsonPublic(c, index);
});

discoveryRoutes.get("/.well-known/agent-skills/:skill/SKILL.md", async (c) => {
  const skill = c.req.param("skill");
  const md = await skillMarkdown(skill, c.env.ASSETS);
  if (!md) return c.json({ error: "not_found" }, 404);
  return c.body(md, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

discoveryRoutes.all("/mcp", (c) => handleMcpRequest(c));
discoveryRoutes.all("/mcp/*", (c) => handleMcpRequest(c));

async function servePlainTextAsset(
  c: Parameters<typeof publicOrigin>[0],
  path: string,
) {
  if (!c.env.ASSETS) {
    return c.text("ASSETS binding missing", 500);
  }
  const res = await c.env.ASSETS.fetch(new URL(path, c.req.url));
  if (!res.ok) {
    return c.text("Not found", 404);
  }
  const body = await res.text();
  return c.body(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
}

function fallbackAuthMd(origin: string): string {
  return `# auth.md

VivaAge agent authentication for ${origin}.

Public educational APIs use **anonymous sessions** (cookie + CSRF). There is no end-user login for library, blog, assessment bootstrap, or chat.

## Register

\`POST ${origin}/api/v1/session\`

Returns \`sessionPublicId\` and \`csrfToken\`. Send CSRF on mutating requests.

See also: \`${origin}/.well-known/oauth-protected-resource\` and OpenAPI at \`${origin}/openapi.json\`.
`;
}
