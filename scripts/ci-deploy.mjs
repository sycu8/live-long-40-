#!/usr/bin/env node
/**
 * CI deploy for Sống An 40+.
 * Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
 * Provisions D1/KV/R2/Queues if missing, patches wrangler.jsonc IDs, builds, deploys, migrates.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const PLACEHOLDER_D1 = "00000000-0000-0000-0000-000000000001";
const PLACEHOLDER_KV = "00000000000000000000000000000001";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    ...opts,
  });
  if (opts.stdio !== "inherit" && res.stdout) process.stdout.write(res.stdout);
  if (opts.stdio !== "inherit" && res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
  }
  return res.stdout ?? "";
}

function wrangler(args, opts = {}) {
  return run("pnpm", ["exec", "wrangler", ...args], opts);
}

function ensureToken() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error(
      "Missing CLOUDFLARE_API_TOKEN. Add it as a GitHub Actions secret.",
    );
    process.exit(1);
  }
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.error(
      "Missing CLOUDFLARE_ACCOUNT_ID. Add it as a GitHub Actions secret.",
    );
    process.exit(1);
  }
}

async function cfApi(path) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(
      `CF API ${path} failed: ${res.status} ${JSON.stringify(body.errors ?? body)}`,
    );
  }
  return body.result;
}

async function findD1Id(name) {
  const list = await cfApi("/d1/database");
  const hit = (list ?? []).find((d) => d.name === name);
  return hit?.uuid ?? null;
}

function createD1(name) {
  const out = wrangler(["d1", "create", name]);
  const m = out.match(/database_id["\s:]+([0-9a-f-]{36})/i);
  if (m) return m[1];
  throw new Error(`Could not determine D1 id for ${name}`);
}

async function findKvId(title) {
  const list = await cfApi("/storage/kv/namespaces");
  const hit = (list ?? []).find((n) => n.title === title);
  return hit?.id ?? null;
}

function createKv(title) {
  const out = wrangler(["kv", "namespace", "create", title]);
  const m = out.match(/"id"\s*:\s*"([a-f0-9]{32})"/i);
  if (m) return m[1];
  throw new Error(`Could not determine KV id for ${title}`);
}

function ensureR2(name) {
  try {
    wrangler(["r2", "bucket", "create", name]);
  } catch {
    // may already exist
  }
}

function ensureQueue(name) {
  try {
    wrangler(["queues", "create", name]);
  } catch {
    // may already exist
  }
}

function patchWrangler({ d1Id, kvId, environment }) {
  const path = resolve(root, "wrangler.jsonc");
  let text = readFileSync(path, "utf8");
  text = text.replace(PLACEHOLDER_D1, d1Id);
  text = text.replace(PLACEHOLDER_KV, kvId);
  text = text.replace(
    /"ENVIRONMENT":\s*"[^"]+"/,
    `"ENVIRONMENT": "${environment}"`,
  );
  writeFileSync(path, text);
  console.log(`Patched wrangler.jsonc (D1=${d1Id}, KV=${kvId}, env=${environment})`);
}

function putSecret(name, value) {
  const res = spawnSync(
    "pnpm",
    ["exec", "wrangler", "secret", "put", name],
    {
      cwd: root,
      input: value,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status !== 0) {
    console.warn(`Warning: could not set secret ${name} (status ${res.status})`);
  }
}

ensureToken();

const environment = process.env.DEPLOY_ENVIRONMENT || "staging";
const dbName = "song-an-40-db";
const kvTitle = "song-an-40-config";
const r2Name = "song-an-40-sources";

async function main() {
  console.log("→ Installing deps…");
  run("pnpm", ["install", "--frozen-lockfile"], { stdio: "inherit" });

  console.log("→ Authenticating…");
  wrangler(["whoami"], { stdio: "inherit" });

  console.log("→ Ensuring D1…");
  let d1Id = await findD1Id(dbName);
  if (!d1Id) {
    console.log(`Creating D1 ${dbName}…`);
    d1Id = createD1(dbName);
  } else {
    console.log(`D1 exists: ${d1Id}`);
  }

  console.log("→ Ensuring KV…");
  let kvId = (await findKvId(kvTitle)) || (await findKvId("CONFIG"));
  if (!kvId) {
    console.log(`Creating KV ${kvTitle}…`);
    kvId = createKv(kvTitle);
  } else {
    console.log(`KV exists: ${kvId}`);
  }

  console.log("→ Ensuring R2 + Queues…");
  ensureR2(r2Name);
  for (const q of [
    "song-an-40-ingestion",
    "song-an-40-analytics",
    "song-an-40-ingestion-dlq",
  ]) {
    ensureQueue(q);
  }

  patchWrangler({ d1Id, kvId, environment });

  console.log("→ Building…");
  run("pnpm", ["build"], { stdio: "inherit" });

  console.log("→ Deploying Worker…");
  wrangler(["deploy"], { stdio: "inherit" });

  console.log("→ Applying D1 migrations…");
  wrangler(
    ["d1", "migrations", "apply", dbName, "--remote"],
    { stdio: "inherit" },
  );

  if (process.env.SEED_REMOTE === "1" || process.env.SEED_REMOTE === "true") {
    const seed = resolve(root, "seed/demo.sql");
    if (existsSync(seed)) {
      console.log("→ Seeding demo data…");
      wrangler(
        ["d1", "execute", dbName, "--remote", `--file=${seed}`],
        { stdio: "inherit" },
      );
    }
  }

  const sessionSecret =
    process.env.SESSION_SIGNING_SECRET ||
    `ci-${randomBytes(24).toString("hex")}`;
  putSecret("SESSION_SIGNING_SECRET", sessionSecret);

  if (process.env.ADMIN_SHARED_SECRET) {
    putSecret("ADMIN_SHARED_SECRET", process.env.ADMIN_SHARED_SECRET);
  }

  console.log("→ Deploy complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
