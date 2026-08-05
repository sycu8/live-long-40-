# Agent discovery (isitagentready)

VivaAge publishes machine-readable discovery surfaces so AI agents can find APIs, auth, and skills.

## Implemented (Worker / SPA)

| Surface | Path |
| --- | --- |
| Link headers (RFC 8288) | `Link` on `GET /` |
| Content Signals | `Content-Signal` in `/robots.txt` |
| API catalog (RFC 9727) | `/.well-known/api-catalog` (`application/linkset+json`) |
| OpenAPI | `/openapi.json` |
| Auth.md | `/auth.md` |
| llms.txt (llmstxt.org) | `/llms.txt` |
| llms-full.txt | `/llms-full.txt` |
| OAuth protected resource (RFC 9728) | `/.well-known/oauth-protected-resource` |
| OAuth AS / OIDC discovery | `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration` |
| MCP server card | `/.well-known/mcp/server-card.json` (+ minimal `/mcp`) |
| Agent skills index | `/.well-known/agent-skills/index.json` |
| WebMCP | `navigator.modelContext.registerTool` on page load |

Public APIs use **anonymous sessions** (`POST /api/v1/session`), not end-user OAuth login.

## DNS-AID / DNSSEC (custom domain required)

On `*.workers.dev`, Cloudflare may already answer `HTTPS` lookups under `_index._agents.*`, but **DNSSEC validation fails** for that zone. Scanners therefore report DNS-AID as incomplete.

To fully pass DNS-AID:

1. Attach a **custom domain** to the Worker.
2. Publish ServiceMode `HTTPS`/`SVCB` records, e.g. `_index._agents.example.com`, `_mcp._agents.example.com`, with `alpn` / endpoint params (see [DNS-AID draft](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/)).
3. Sign the zone with **DNSSEC**.

Until then, rely on HTTP well-known discovery + homepage `Link` headers.

## Validate

```bash
curl -sSI https://song-an-40.sycu-lee.workers.dev/ | grep -i '^link:'
curl -sS https://song-an-40.sycu-lee.workers.dev/.well-known/api-catalog | head
curl -sS -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://song-an-40.sycu-lee.workers.dev"}'
```
