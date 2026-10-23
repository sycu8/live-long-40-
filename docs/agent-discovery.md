# Agent discovery (isitagentready)

VivaAge publishes machine-readable discovery surfaces so AI agents can find APIs, auth, and skills.

## Implemented (Worker / SPA)

| Surface                             | Path                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Link headers (RFC 8288)             | `Link` on `GET /`                                                              |
| Content Signals                     | `Content-Signal` in `/robots.txt`                                              |
| API catalog (RFC 9727)              | `/.well-known/api-catalog` (`application/linkset+json`)                        |
| OpenAPI                             | `/openapi.json`                                                                |
| Auth.md                             | `/auth.md`                                                                     |
| llms.txt (llmstxt.org)              | `/llms.txt`                                                                    |
| llms-full.txt                       | `/llms-full.txt`                                                               |
| OAuth protected resource (RFC 9728) | `/.well-known/oauth-protected-resource`                                        |
| OAuth AS / OIDC discovery           | `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration` |
| MCP server card                     | `/.well-known/mcp/server-card.json` (+ minimal `/mcp`)                         |
| Agent skills index                  | `/.well-known/agent-skills/index.json`                                         |
| ARD capability manifest             | `/.well-known/ai-catalog.json` and `/.well-known/ard.json`                     |
| WebMCP                              | `navigator.modelContext.registerTool` on page load                             |

Public APIs use **anonymous sessions** (`POST /api/v1/session`), not end-user OAuth login.

## OAuth protected resource (RFC 9728)

`GET /.well-known/oauth-protected-resource` returns `resource`, `authorization_servers`, and a non-empty `scopes_supported` list. The authorization server is this origin; public APIs use anonymous sessions (`POST /api/v1/session`), described in `/auth.md`.

## ARD manifest

`GET /.well-known/ai-catalog.json` and `GET /.well-known/ard.json` return the same JSON document:

- `Content-Type: application/json` and `Access-Control-Allow-Origin: *`
- `specVersion` `1.0` (ai-catalog data model)
- `host.displayName` and `host.identifier` (`did:web:<hostname>`)
- `entries[]` with `urn:air:<hostname>:<namespace>:<name>`, `displayName`, a media type, exactly one of `url` or `data`, and 2–5 `representativeQueries`

Also advertised by homepage `Link` headers, `<link rel="ai-catalog">` / `<link rel="ard">`, and an `Agentmap:` line in `/robots.txt`.

## DNS-AID / DNSSEC (custom domain required)

The scanner looks up ServiceMode `SVCB` and `HTTPS` records for `_index._agents`, `_a2a._agents`, and `_mcp._agents` over DNS-over-HTTPS, then requires the answer to be DNSSEC-validated (`AD=true`).

The canonical origin is `https://vivaage.orangecloud.vn`. `workers.dev` has no DS record, so a validating resolver will not set `AD` for `song-an-40.sycu-lee.workers.dev`. Publish the record set on `vivaage.orangecloud.vn` before the DNSSEC check can pass.

Record definitions live in `dns/dns-aid.mjs` (ServiceMode priority 1, `alpn="h3,h2"`, `port=443`, plus a `_catalog._agents` TXT pointer). To publish them on a domain you control:

```bash
node scripts/publish-dns-aid.mjs --print
# after the Worker is attached to that custom domain:
CLOUDFLARE_API_TOKEN=… node scripts/publish-dns-aid.mjs \
  --zone example.com --hostname example.com --dnssec
```

Leave the `_agents` names DNS-only. Cloudflare does not serve a manual `HTTPS` record when another record on the same name is proxied. Add the printed DS record at the registrar if the domain is not registered at Cloudflare.

Agents should use the HTTP well-known documents and homepage `Link` headers on `https://vivaage.orangecloud.vn`.

## Validate

```bash
curl -sSI https://vivaage.orangecloud.vn/ | grep -i '^link:'
curl -sS https://vivaage.orangecloud.vn/.well-known/api-catalog | head
curl -sS -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://vivaage.orangecloud.vn"}'
```
