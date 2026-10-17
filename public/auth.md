# auth.md

Agent authentication guide for **VivaAge**.

Site: {{SITE_URL}}

## Audience

Automated agents calling VivaAge public educational HTTP APIs.

VivaAge does not require end-user OAuth login for library, blog, product meta, assessment bootstrap, or grounded Q&A. Access uses an anonymous session.

## Registration method: anonymous

Supported identity type: anonymous

Provisioning endpoint:

POST {{SITE_URL}}/api/v1/session

Request:

Content-Type: application/json

{}

Response fields:

- sessionPublicId
- csrfToken

Credentials:

- session cookie (HttpOnly)
- csrf token (cookie / header on mutating requests)

Claim / bootstrap URI: {{SITE_URL}}/api/v1/session

After registration, reuse the session cookie for subsequent API calls. Send the CSRF token on mutating requests.

## Discovery documents

- Protected resource metadata: {{SITE_URL}}/.well-known/oauth-protected-resource
- Authorization server metadata: {{SITE_URL}}/.well-known/oauth-authorization-server
- API catalog: {{SITE_URL}}/.well-known/api-catalog
- OpenAPI: {{SITE_URL}}/openapi.json
- MCP server card: {{SITE_URL}}/.well-known/mcp/server-card.json
- AI catalog (ARD): {{SITE_URL}}/.well-known/ai-catalog.json

## Scopes

- public:read — library, blog, meta, health
- session:anonymous — session bootstrap
- chat:ask — grounded Q&A
- assessment:run — readiness assessment

## Admin

/admin and /api/v1/admin are not for public agents. They use Cloudflare Access.

## Limits

Educational content only. Not a substitute for clinicians, financial advisors, or lawyers.
