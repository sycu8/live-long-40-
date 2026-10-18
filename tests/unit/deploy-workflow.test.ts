import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("deploy workflow triggers", () => {
  it("deploys a push only from main", () => {
    expect(workflow).not.toContain("cursor/**");
    expect(workflow).not.toContain("cursor/");
    expect(pushBranches(workflow)).toEqual(["main"]);
    expect(workflow).toMatch(/^ {2}pull_request:\n {4}branches:\n {6}- main\s*$/m);
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
    expect(workflow).not.toMatch(/DEPLOY_ENVIRONMENT:.*staging/);
  });

  it("sets production on push and seeds only for an explicit manual input", () => {
    expect(workflow).toContain(
      "DEPLOY_ENVIRONMENT: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.environment || 'production' }}",
    );
    expect(workflow).toContain(
      "SEED_REMOTE: ${{ github.event_name == 'workflow_dispatch' && (github.event.inputs.seed == 'true' || github.event.inputs.seed == true) && 'true' || 'false' }}",
    );
    expect(workflow).not.toMatch(/\|\|\s*'true'/);
  });

  it("limits pull requests to test, build, and wrangler deploy --dry-run", () => {
    const deploy = jobSource(workflow, "deploy");
    const pullRequest = jobSource(workflow, "verify");

    expect(deploy).toContain(
      "if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'",
    );
    expect(deploy).toContain("node scripts/ci-deploy.mjs");
    expect(deploy).not.toContain("wrangler deploy --dry-run");

    expect(pullRequest).toContain("if: github.event_name == 'pull_request'");
    expect(pullRequest).toContain("pnpm test");
    expect(pullRequest).toContain("pnpm build");
    expect(pullRequest).toContain("pnpm exec wrangler deploy --dry-run");
    expect(pullRequest).not.toContain("ci-deploy.mjs");
    expect(pullRequest).not.toContain("secret put");
    expect(pullRequest).not.toContain("--remote");
    expect(pullRequest).not.toMatch(/wrangler deploy(?! --dry-run)/);
  });
});
