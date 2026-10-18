#!/usr/bin/env node
/**
 * Deploy policy for .github/workflows/deploy-cloudflare.yml.
 *
 * Push (main only, enforced by the workflow trigger): production, never seed.
 * workflow_dispatch: staging or production from the environment input.
 * Remote D1 seeding only when that manual run sets seed to true.
 * Any other event must not deploy.
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ENVIRONMENTS = new Set(["staging", "production"]);

export function resolveDeployPolicy({
  eventName,
  environmentInput = "",
  seedInput = "",
}) {
  if (eventName === "push") {
    return { mode: "deploy", environment: "production", seedRemote: false };
  }

  if (eventName === "workflow_dispatch") {
    if (!ENVIRONMENTS.has(environmentInput)) {
      throw new Error(
        `Unsupported environment "${environmentInput}". Expected staging or production.`,
      );
    }
    return {
      mode: "deploy",
      environment: environmentInput,
      seedRemote: seedInput === true || seedInput === "true",
    };
  }

  return { mode: "dry-run", environment: "production", seedRemote: false };
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  try {
    const eventName = process.env.GITHUB_EVENT_NAME ?? "";
    const policy = resolveDeployPolicy({
      eventName,
      environmentInput: process.env.INPUT_ENVIRONMENT ?? "",
      seedInput: process.env.INPUT_SEED ?? "",
    });
    if (policy.mode !== "deploy") {
      throw new Error(
        `Refusing to deploy for event "${eventName}". Pull requests may build or dry-run only.`,
      );
    }
    if (policy.seedRemote && eventName !== "workflow_dispatch") {
      throw new Error(
        "Remote seeding is only allowed on workflow_dispatch with an explicit seed input.",
      );
    }
    const lines = [
      `DEPLOY_ENVIRONMENT=${policy.environment}`,
      `SEED_REMOTE=${policy.seedRemote ? "true" : "false"}`,
    ];
    if (process.env.GITHUB_ENV) {
      appendFileSync(process.env.GITHUB_ENV, `${lines.join("\n")}\n`);
    }
    console.log(
      `Deploy policy: event=${eventName} environment=${policy.environment} seed=${policy.seedRemote}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
