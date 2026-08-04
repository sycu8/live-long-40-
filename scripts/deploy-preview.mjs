#!/usr/bin/env node
/**
 * Deploy Sống An 40+ to Cloudflare.
 *
 * - With CLOUDFLARE_API_TOKEN: full deploy via Vite-built Worker (preferred).
 * - Without credentials: uses `wrangler deploy --temporary` preview account.
 *
 * Temporary preview accounts support D1/KV/Queues/AI but not R2/Workflows/AI Search.
 * Claim the preview account within ~60 minutes via the claim URL Wrangler prints.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const distConfigPath = resolve(root, "dist/song_an_40/wrangler.json");
const previewConfigPath = resolve(root, "wrangler.preview.jsonc");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...opts,
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

console.log("→ Building…");
run("pnpm", ["build"]);

if (!existsSync(distConfigPath)) {
  console.error("Missing dist/song_an_40/wrangler.json — build failed?");
  process.exit(1);
}

const preview = JSON.parse(stripJsonc(readFileSync(previewConfigPath, "utf8")));
const dist = JSON.parse(readFileSync(distConfigPath, "utf8"));

dist.vars = { ...dist.vars, ...preview.vars, ENVIRONMENT: "preview" };
dist.d1_databases = preview.d1_databases.map((db) => ({
  ...db,
  migrations_dir: "../../migrations",
}));
dist.kv_namespaces = preview.kv_namespaces;
dist.queues = preview.queues;
dist.ai = preview.ai;
delete dist.r2_buckets;
delete dist.workflows;
delete dist.ai_search_namespaces;
delete dist.ai_search;

writeFileSync(distConfigPath, JSON.stringify(dist));
console.log("→ Patched dist wrangler.json for preview bindings (no R2/Workflows/AI Search)");

const hasToken = Boolean(process.env.CLOUDFLARE_API_TOKEN);
const deployArgs = hasToken ? ["deploy"] : ["deploy", "--temporary"];
console.log(
  hasToken
    ? "→ Deploying with CLOUDFLARE_API_TOKEN…"
    : "→ Deploying with temporary preview account…",
);
run("pnpm", ["exec", "wrangler", ...deployArgs]);

console.log("→ Applying remote D1 migrations…");
run("pnpm", [
  "exec",
  "wrangler",
  "d1",
  "migrations",
  "apply",
  "song-an-40-db",
  "--remote",
  "-c",
  "wrangler.preview.jsonc",
]);

console.log("Done. Open the workers.dev URL from Wrangler output.");
console.log(
  "If this was a temporary account, claim it immediately via the printed claim URL.",
);
