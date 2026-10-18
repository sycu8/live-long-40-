import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDeployPolicy } from "../../scripts/deploy-policy.mjs";

const workflow = readFileSync(resolve(".github/workflows/deploy-cloudflare.yml"), "utf8");

function jobSource(source: string, jobId: string) {
  const marker = `\n  ${jobId}:\n`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

function pushBranches(source: string) {
  const onBlock = source.split(/^jobs:/m)[0] ?? "";
  const match = onBlock.match(/push:\n\s+branches:\n((?:\s+-\s+.+\n)+)/);
  expect(match).not.toBeNull();
  return [...match![1].matchAll(/-\s+["']?([^"'\n]+)["']?/g)].map((match) =>
    match[1].trim(),
  );
}

function runPolicy(env: Record<string, string>) {
  const githubEnv = join(mkdtempSync(join(tmpdir(), "deploy-policy-")), "env");
  const res = spawnSync("node", ["scripts/deploy-policy.mjs"], {
    encoding: "utf8",
    env: { ...process.env, ...env, GITHUB_ENV: githubEnv },
  });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    written: existsSync(githubEnv) ? readFileSync(githubEnv, "utf8") : "",
  };
}

describe("deploy workflow triggers", () => {
  it("deploys a push only from main", () => {
    expect(workflow).not.toContain("cursor/**");
    expect(workflow).not.toContain("cursor/");
    expect(pushBranches(workflow)).toEqual(["main"]);
    expect(workflow).toMatch(/^ {2}pull_request:\s*$/m);
  });

  it("keeps secret names and the staging/production choices", () => {
    for (const secret of [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "ADMIN_SHARED_SECRET",
      "SESSION_SIGNING_SECRET",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toMatch(/options:\n {10}- staging\n {10}- production/);
    expect(workflow).toMatch(/seed:[\s\S]*?default:\s*false/);
    expect(workflow).not.toMatch(/\|\|\s*['"]true['"]/);
    expect(workflow).not.toMatch(/DEPLOY_ENVIRONMENT:.*staging/);
  });

  it("runs the real deploy only for push and manual dispatch", () => {
    const deploy = jobSource(workflow, "deploy");
    const pullRequest = jobSource(workflow, "pull-request");

    expect(deploy).toContain(
      "if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'",
    );
    expect(deploy).toContain("node scripts/deploy-policy.mjs");
    expect(deploy.indexOf("node scripts/deploy-policy.mjs")).toBeLessThan(
      deploy.indexOf("node scripts/ci-deploy.mjs"),
    );
    expect(deploy).toContain('DEPLOY_ENVIRONMENT" != "production"');

    expect(pullRequest).toContain("if: github.event_name == 'pull_request'");
    expect(pullRequest).toContain("pnpm build");
    expect(pullRequest).toContain("pnpm exec wrangler deploy --dry-run");
    expect(pullRequest).not.toContain("ci-deploy.mjs");
    expect(pullRequest).not.toContain("deploy-policy.mjs");
    expect(pullRequest).not.toContain("secret put");
    expect(pullRequest).not.toContain("--remote");
    expect(pullRequest).not.toMatch(/wrangler deploy(?! --dry-run)/);
  });
});

describe("resolveDeployPolicy", () => {
  it("sends a push to production and never seeds", () => {
    expect(
      resolveDeployPolicy({
        eventName: "push",
        environmentInput: "staging",
        seedInput: "true",
      }),
    ).toEqual({
      mode: "deploy",
      environment: "production",
      seedRemote: false,
    });
  });

  it("seeds only for a manual dispatch with an explicit true input", () => {
    expect(
      resolveDeployPolicy({
        eventName: "workflow_dispatch",
        environmentInput: "staging",
        seedInput: "false",
      }),
    ).toEqual({
      mode: "deploy",
      environment: "staging",
      seedRemote: false,
    });
    expect(
      resolveDeployPolicy({
        eventName: "workflow_dispatch",
        environmentInput: "production",
        seedInput: "true",
      }),
    ).toEqual({
      mode: "deploy",
      environment: "production",
      seedRemote: true,
    });
    expect(
      resolveDeployPolicy({
        eventName: "workflow_dispatch",
        environmentInput: "production",
        seedInput: true,
      }).seedRemote,
    ).toBe(true);
  });

  it("rejects an unknown manual environment and does not deploy pull requests", () => {
    expect(() =>
      resolveDeployPolicy({
        eventName: "workflow_dispatch",
        environmentInput: "preview",
        seedInput: "true",
      }),
    ).toThrow(/staging or production/);
    expect(
      resolveDeployPolicy({
        eventName: "pull_request",
        environmentInput: "staging",
        seedInput: "true",
      }),
    ).toEqual({
      mode: "dry-run",
      environment: "production",
      seedRemote: false,
    });
  });

  it("writes production and seed=false for a push", () => {
    const result = runPolicy({
      GITHUB_EVENT_NAME: "push",
      INPUT_ENVIRONMENT: "staging",
      INPUT_SEED: "true",
    });
    expect(result.status).toBe(0);
    expect(result.written).toBe("DEPLOY_ENVIRONMENT=production\nSEED_REMOTE=false\n");
  });

  it("writes the manual environment and seeds only when seed is true", () => {
    const seeded = runPolicy({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      INPUT_ENVIRONMENT: "staging",
      INPUT_SEED: "true",
    });
    expect(seeded.status).toBe(0);
    expect(seeded.written).toBe("DEPLOY_ENVIRONMENT=staging\nSEED_REMOTE=true\n");

    const plain = runPolicy({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      INPUT_ENVIRONMENT: "production",
      INPUT_SEED: "false",
    });
    expect(plain.status).toBe(0);
    expect(plain.written).toBe("DEPLOY_ENVIRONMENT=production\nSEED_REMOTE=false\n");
  });

  it("refuses to emit a deploy policy for a pull request", () => {
    const result = runPolicy({
      GITHUB_EVENT_NAME: "pull_request",
      INPUT_SEED: "true",
    });
    expect(result.status).not.toBe(0);
    expect(result.written).toBe("");
    expect(result.stderr).toMatch(/dry-run only/);
  });
});
