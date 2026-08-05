import { describe, expect, it } from "vitest";
import {
  apiCatalogLinkset,
  homepageLinkHeaders,
  mcpServerCard,
  oauthAuthorizationServer,
  oauthProtectedResource,
  openApiDocument,
} from "../../worker/discovery/meta";
import { agentSkillsIndex, skillMarkdown } from "../../worker/discovery/skills";

const ORIGIN = "https://example.com";

describe("agent discovery documents", () => {
  it("builds RFC 8288 Link header values for the homepage", () => {
    const links = homepageLinkHeaders(ORIGIN);
    expect(links.some((l) => l.includes('rel="api-catalog"'))).toBe(true);
    expect(links.some((l) => l.includes("/openapi.json"))).toBe(true);
    expect(links.some((l) => l.includes("/auth.md"))).toBe(true);
  });

  it("builds api-catalog linkset+json shape", () => {
    const catalog = apiCatalogLinkset(ORIGIN);
    expect(Array.isArray(catalog.linkset)).toBe(true);
    const entry = catalog.linkset[0]!;
    expect(entry.anchor).toBe(`${ORIGIN}/api/v1`);
    expect(entry["service-desc"]?.[0]?.href).toContain("/openapi.json");
    expect(entry.status?.[0]?.href).toContain("/api/health");
  });

  it("builds OpenAPI 3.1 with health and library paths", () => {
    const doc = openApiDocument(ORIGIN);
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/api/health"]).toBeTruthy();
    expect(doc.paths["/api/v1/library"]).toBeTruthy();
  });

  it("builds OAuth protected resource + AS metadata with agent_auth", () => {
    const prm = oauthProtectedResource(ORIGIN);
    expect(prm.resource).toBe(`${ORIGIN}/`);
    expect(prm.authorization_servers).toContain(`${ORIGIN}/`);
    expect(prm.bearer_methods_supported).toContain("header");

    const as = oauthAuthorizationServer(ORIGIN);
    expect(as.issuer).toBe(`${ORIGIN}/`);
    expect(as.agent_auth.identity_types_supported).toContain("anonymous");
    expect(as.agent_auth.register_uri).toContain("/api/v1/session");
  });

  it("builds MCP server card with transport endpoint", () => {
    const card = mcpServerCard(ORIGIN);
    expect(card.serverInfo.name).toBe("vivaage");
    expect(card.transport.endpoint).toBe(`${ORIGIN}/mcp`);
    expect(card.tools?.length).toBeGreaterThan(0);
  });

  it("builds agent-skills index with sha256 digests", async () => {
    const index = await agentSkillsIndex(ORIGIN);
    expect(index.$schema).toContain("0.2.0");
    const skills = index.skills as Array<{
      name: string;
      digest: string;
      url: string;
      type: string;
    }>;
    expect(skills.length).toBeGreaterThanOrEqual(2);
    for (const s of skills) {
      expect(s.type).toBe("skill-md");
      expect(s.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(s.url).toContain(`/.well-known/agent-skills/${s.name}/SKILL.md`);
      const md = await skillMarkdown(s.name);
      expect(md).toBeTruthy();
      expect(md!).toMatch(/^# /);
    }
  });
});
