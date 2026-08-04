# Bug log — QA pass 1 (2026-08-04)

## Shared causes

1. **CSRF race (StrictMode double mount)** — two parallel `POST /session` calls created mismatched CSRF cookie vs memory token → chat/admin mutations failed with `CSRF token không hợp lệ`, input stayed disabled.
2. **`run_worker_first` included `/admin`** — Worker had no SPA handler for `/admin`, returned plain `404 Not Found` instead of the React admin page.
3. **Today week calculation** — both branches of ternary used `new Date()`, always week 1.
4. **Admin auth secrets** — raw `.dev.vars` secrets did not bind under Vite until `LOCAL_QA_ADMIN_TOKEN` was declared as a Wrangler `vars` override.
5. **Silent library errors / CSRF attach gaps / ignored results `:id`** — secondary UX defects.

## Fixes shipped

| ID | Fix |
| --- | --- |
| B1 | Singleton `ensureSession` + one CSRF retry in `client/lib/api.ts` |
| B2 | `run_worker_first` limited to `/api/*` |
| B3 | `currentPlanWeek` + Today UI week label |
| B4 | `LOCAL_QA_ADMIN_TOKEN` + requireAdmin checks; admin token field |
| B5 | Library error alert; results route id mismatch warning; admin CSRF middleware |

| B6 | Admin success toast cleared by refresh — preserveMessage option |

## Evidence

- Playwright error context: chat page snapshot showed `alert: CSRF token không hợp lệ` with disabled input.
- Admin snapshot: `generic: 404 Not Found`.
- Health after token var: `adminSecretConfigured: true`; no-auth admin → 401; bearer → 200.
- Pass2 admin create: source appeared in list (`QA nguồn …`) but success message wiped by `refresh()`.
