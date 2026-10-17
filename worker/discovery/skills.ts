/**
 * Agent skills discovery helpers — digests computed from bundled markdown.
 */

const SKILLS: Record<string, { name: string; description: string; markdown: string }> = {
  "vivaage-overview": {
    name: "vivaage-overview",
    description:
      "Overview of VivaAge: healthy-aging education for Vietnamese adults 40+, public APIs, and safety limits.",
    markdown: `# VivaAge overview

Help users prepare for later life with educational content — not medical or investment advice.

## Product
- Assessment (~7 minutes) → readiness scores for health / finance / caregiving
- 30-day plan with small weekly actions
- Library lessons and motivational blog
- Grounded Q&A (“Hỏi VivaAge”) with citations when sources exist

## Public discovery
- OpenAPI: \`/openapi.json\`
- API catalog: \`/.well-known/api-catalog\`
- Auth for agents: \`/auth.md\` (anonymous session)
- MCP card: \`/.well-known/mcp/server-card.json\`
- ARD catalog: \`/.well-known/ai-catalog.json\`

## Limits
Do not diagnose, prescribe, or give personalized investment advice. Prefer official Vietnamese / WHO sources when answering.
`,
  },
  "vivaage-auth": {
    name: "vivaage-auth",
    description:
      "How agents authenticate to VivaAge public APIs using anonymous session cookies and CSRF.",
    markdown: `# VivaAge agent auth

## Audience
Automated agents calling public educational HTTP APIs.

## Method: anonymous session
1. \`POST /api/v1/session\` — receive \`sessionPublicId\` and \`csrfToken\` (cookies set).
2. Include session cookie on subsequent requests.
3. Send CSRF token on mutating requests as required by the API.

## OAuth metadata
- Protected resource: \`/.well-known/oauth-protected-resource\`
- Authorization server: \`/.well-known/oauth-authorization-server\`
- Human-readable: \`/auth.md\`

No end-user OAuth login is required for public library, blog, meta, or assessment bootstrap.
`,
  },
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function agentSkillsIndex(
  origin: string,
  _assets?: Fetcher,
): Promise<Record<string, unknown>> {
  const o = origin.replace(/\/$/, "");
  const skills = [];
  for (const skill of Object.values(SKILLS)) {
    const digest = await sha256Hex(skill.markdown);
    skills.push({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: `${o}/.well-known/agent-skills/${skill.name}/SKILL.md`,
      digest: `sha256:${digest}`,
    });
  }
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills,
  };
}

export async function skillMarkdown(
  name: string,
  _assets?: Fetcher,
): Promise<string | null> {
  return SKILLS[name]?.markdown ?? null;
}
