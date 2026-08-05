# QA Inventory — Sống An 40+

Sanitized, production-scale local validation checklist.
Last updated: 2026-08-04. Environment under test: local Wrangler/Vite with `remoteBindings: false`, D1 seed `seed/production-scale.sql`, `.dev.vars` production-like flags.

## Roles

| Role | Identity | Capabilities |
| --- | --- | --- |
| Anonymous learner | HttpOnly `sa_session` + CSRF cookie | Assessment, plan, chat, library, profile |
| Admin editor | Cloudflare Access JWT **or** `Authorization: Bearer` admin secret | Source CRUD, ingest, approve, withdraw |

## Routes & primary action

| Route | Primary action | Acceptance criteria | Edge cases (finite) |
| --- | --- | --- | --- |
| `/` | Start assessment / ask question | Brand “Sống An 40+” hero-level; CTAs work; 4 example questions link to `/hoi?q=` | Deep-link with unknown path redirects home |
| `/hom-nay` | See readiness + week actions | Empty CTA if no result; scores if result; link to plan | No plan but has result; completed all week actions |
| `/danh-gia` | Answer one question at a time | Progress updates; back works; save persists; completes to results | Mid-run refresh; invalid option; rate-limit create |
| `/ket-qua/:id?` | Create 30-day plan | Shows 3 pillars, gaps, strengths, disclaimer; plan CTA | No readiness; create plan twice |
| `/ke-hoach` | Complete weekly actions | 4 week tabs; 2+1 actions; complete toggles state | Empty plan; complete twice (409) |
| `/hoi` | Ask grounded question | Stream or JSON; sources drawer; feedback; suggestions | Empty KB abstain; high-risk; no-diacritics; unsupported invest ask; streaming fail |
| `/thu-vien` | Browse by category | 6 categories + all; cards show issuer/dates/status | Empty category; API error visible |
| `/thu-vien/:slug` | Read lesson | Body + metadata | Unknown slug 404 |
| `/ho-so` | Understand privacy limits + chat history toggle | Disclaimer; CTAs; opt-in checkbox | Toggle persists on device |
| `/blog` | Read motivational posts | List + detail; theme filter; daily cadence | Empty / unknown slug |
| `/sitemap.xml` `/robots.txt` `/feed.xml` | Crawl / GEO | Dynamic blog URLs + Atom full text | Stale cache |

| `/admin` | Manage knowledge | Create+ingest+approve; list; withdraw | Missing auth (staging secret); empty form validation; withdraw active source |

## Shared chrome

| Control | AC | Edge |
| --- | --- | --- |
| Bottom nav (mobile) | 6 destinations; active state; focus visible | Hidden from `lg` breakpoint |
| Side nav (desktop) | Persistent left nav with full labels | Hidden below `lg` |
| Header brand | Returns home | — |
| Boot session | Creates session before routes | API down shows migrate/seed hint |
| CSRF | Mutations send `X-CSRF-Token` | First `/session` exempt |

## API workflows

| Workflow | AC | Edge |
| --- | --- | --- |
| Assessment scoring | Deterministic; versioned; explain unanswered | Partial answers still score |
| Plan generation | 12 actions / 4 weeks | Low vs high readiness changes priority |
| Chat pipeline | Risk → retrieve → generate/abstain → cite | Superseded excluded; injection text not obeyed |
| Ingestion | Chunk → awaiting approval → approve indexes | PDF without reviewed text fails clearly |

## States matrix

Every page must show: loading, empty (if applicable), error, success. Chat also: streaming, high-risk, abstain, feedback.

## Out of scope (do not test as pass)

Telemedicine, payments, Zalo, SMS/email, real Access JWT crypto verify without Cloudflare edge, remote Workers AI without token.
