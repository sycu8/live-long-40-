# auth.md

Agent authentication guide for **VivaAge** ({{SITE_URL}}).

## Audience

Automated agents and tools that call VivaAge **public educational APIs**.

VivaAge does **not** require end-user OAuth login for library, blog, product meta, assessment bootstrap, or grounded Q&A. Access is via an **anonymous session**.

## Register (anonymous)

```http
POST {{SITE_URL}}/api/v1/session
Content-Type: application/json

{}
```

Response includes `sessionPublicId` and `csrfToken`. The service also sets HttpOnly session + CSRF cookies.

Use the session cookie on later requests. Send the CSRF token on mutating API calls as documented by the client/`X-CSRF-Token` convention.

## Discovery documents

| Document | URL |
| --- | --- |
| Protected resource metadata | `{{SITE_URL}}/.well-known/oauth-protected-resource` |
| Authorization server metadata | `{{SITE_URL}}/.well-known/oauth-authorization-server` |
| API catalog (RFC 9727) | `{{SITE_URL}}/.well-known/api-catalog` |
| OpenAPI | `{{SITE_URL}}/openapi.json` |
| MCP server card | `{{SITE_URL}}/.well-known/mcp/server-card.json` |

## Scopes (logical)

- `public:read` — library, blog, meta, health
- `session:anonymous` — session bootstrap
- `chat:ask` — grounded Q&A
- `assessment:run` — readiness assessment

## Admin

`/admin` and `/api/v1/admin/*` are **not** for public agents. They are protected by Cloudflare Access (and optional shared secret in local/staging).

## Limits

Educational content only. Not a substitute for clinicians, financial advisors, or lawyers.
