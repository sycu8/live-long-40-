import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productionDeployRefusal } from "../../scripts/ci-deploy.mjs";

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
    expect(pullRequest).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(pullRequest).not.toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(pullRequest).not.toMatch(/wrangler deploy(?! --dry-run)/);
  });

  it("does not cancel an in-progress production deploy", () => {
    expect(workflow).toMatch(
      /cancel-in-progress:\s*\$\{\{\s*github\.ref != 'refs\/heads\/main'\s*\}\}/,
    );
    expect(workflow).not.toMatch(/cancel-in-progress:\s*true/);
  });

  it("fails closed unless the ref is refs/heads/main and the environment is production", () => {
    const deploy = jobSource(workflow, "deploy");
    expect(deploy).toContain('if [ "$GITHUB_REF" != "refs/heads/main" ]');
    expect(deploy).toContain('if [ "$DEPLOY_ENVIRONMENT" != "production" ]');
    expect(deploy.indexOf('"$GITHUB_REF" != "refs/heads/main"')).toBeLessThan(
      deploy.indexOf("node scripts/ci-deploy.mjs"),
    );
    expect(deploy.indexOf('"$DEPLOY_ENVIRONMENT" != "production"')).toBeLessThan(
      deploy.indexOf("node scripts/ci-deploy.mjs"),
    );
  });
});

describe("productionDeployRefusal", () => {
  it("allows production only from refs/heads/main on Actions", () => {
    expect(
      productionDeployRefusal({
        environment: "production",
        githubActions: "true",
        githubRef: "refs/heads/main",
      }),
    ).toBeNull();
  });

  it("refuses staging before the production Worker can be updated", () => {
    expect(
      productionDeployRefusal({
        environment: "staging",
        githubActions: "true",
        githubRef: "refs/heads/main",
      }),
    ).toMatch(/song-an-40/);
    expect(
      productionDeployRefusal({
        environment: "",
        githubActions: "false",
        githubRef: "",
      }),
    ).toMatch(/no staging Worker/);
  });

  it("refuses a production deploy from any other ref", () => {
    expect(
      productionDeployRefusal({
        environment: "production",
        githubActions: "true",
        githubRef: "refs/heads/fix/deploy-main-only",
      }),
    ).toMatch(/refs\/heads\/main/);
  });

  it("exits before wrangler when staging or a non-main ref is requested", () => {
    const staging = spawnSync("node", ["scripts/ci-deploy.mjs"], {
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
        DEPLOY_ENVIRONMENT: "staging",
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/main",
      },
    });
    expect(staging.status).not.toBe(0);
    expect(staging.stderr).toMatch(/song-an-40/);
    expect(`${staging.stdout}`).not.toMatch(/Deploying Worker|Authenticating/);

    const otherBranch = spawnSync("node", ["scripts/ci-deploy.mjs"], {
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
        DEPLOY_ENVIRONMENT: "production",
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/fix/deploy-main-only",
      },
    });
    expect(otherBranch.status).not.toBe(0);
    expect(otherBranch.stderr).toMatch(/refs\/heads\/main/);
    expect(`${otherBranch.stdout}`).not.toMatch(/Deploying Worker|Authenticating/);
  });
});
