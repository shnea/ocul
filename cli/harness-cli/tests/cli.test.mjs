import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runInitCommand } from "../lib/init.mjs";
import { HARNESS_ROOT } from "../lib/registry.mjs";
import { syncProject } from "../lib/sync.mjs";
import { verifyProject } from "../lib/verify.mjs";

function makeTempHarness() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ocul-harness-test-"));
  fs.cpSync(path.join(HARNESS_ROOT, "rules"), path.join(tmp, "rules"), { recursive: true });
  fs.cpSync(path.join(HARNESS_ROOT, "templates"), path.join(tmp, "templates"), { recursive: true });
  fs.cpSync(path.join(HARNESS_ROOT, "cli"), path.join(tmp, "cli"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "registry"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "registry", "projects.json"),
    JSON.stringify({ version: 1, projects: [] }, null, 2),
    "utf8"
  );
  return tmp;
}

test("harness init + sync + verify passes on clean project and logs JSONL", () => {
  const tmpHarness = makeTempHarness();
  try {
    const projectDir = path.join(tmpHarness, "projects", "demo-app");
    runInitCommand(["demo-app", "--stack", "node-api", "--dir", projectDir], tmpHarness);

    const res = verifyProject("demo-app", tmpHarness);
    assert.equal(res.passed, true);
    assert.equal(res.logEntry.result, "PASSED");

    const logFile = path.join(tmpHarness, ".harness", "logs", "verify.jsonl");
    assert.equal(fs.existsSync(logFile), true);
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).projectId, "demo-app");
  } finally {
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});

test("harness verify fails sync-check when local rule file is tampered", () => {
  const tmpHarness = makeTempHarness();
  try {
    const projectDir = path.join(tmpHarness, "projects", "tamper-app");
    runInitCommand(["tamper-app", "--stack", "react-ts", "--dir", projectDir], tmpHarness);

    fs.appendFileSync(path.join(projectDir, "eslint.config.mjs"), "\n// tampered\n");
    const res = verifyProject("tamper-app", tmpHarness);
    assert.equal(res.passed, false);
    assert.equal(res.failedStep, "sync-check");
    assert.match(res.fix, /harness sync/);

    syncProject("tamper-app", tmpHarness);
    const fixed = verifyProject("tamper-app", tmpHarness);
    assert.equal(fixed.passed, true);
  } finally {
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});

test("harness verify catches boundary violation and bypass comment", () => {
  const tmpHarness = makeTempHarness();
  try {
    const projectDir = path.join(tmpHarness, "projects", "guard-app");
    runInitCommand(["guard-app", "--stack", "react-ts", "--dir", projectDir], tmpHarness);

    // Trigger boundary violation: core importing platform
    const coreFile = path.join(projectDir, "src", "core", "index.ts");
    const originalCore = fs.readFileSync(coreFile, "utf8");
    fs.writeFileSync(coreFile, `import { fetchAppStatus } from "../platform/index.ts";\n${originalCore}`);
    const boundaryRes = verifyProject("guard-app", tmpHarness);
    assert.equal(boundaryRes.passed, false);
    assert.equal(boundaryRes.failedStep, "boundary");

    // Restore core, trigger lint bypass comment
    fs.writeFileSync(coreFile, originalCore);
    const featFile = path.join(projectDir, "src", "features", "home", "index.ts");
    fs.appendFileSync(featFile, "\n// eslint-disable-next-line\n");
    const lintRes = verifyProject("guard-app", tmpHarness);
    assert.equal(lintRes.passed, false);
    assert.equal(lintRes.failedStep, "lint");
  } finally {
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});

test("harness init installs AGENTS/CLAUDE/GEMINI instructions and pre-commit hook enforces verify on main", () => {
  const tmpHarness = makeTempHarness();
  try {
    const projectDir = path.join(tmpHarness, "projects", "hook-app");
    runInitCommand(["hook-app", "--stack", "node-api", "--dir", projectDir], tmpHarness);

    // Verify multi-agent instruction files & hook exist
    assert.equal(fs.existsSync(path.join(projectDir, "AGENTS.md")), true);
    assert.equal(fs.existsSync(path.join(projectDir, "CLAUDE.md")), true);
    assert.equal(fs.existsSync(path.join(projectDir, "GEMINI.md")), true);
    const hookPath = path.join(projectDir, ".git", "hooks", "pre-commit");
    assert.equal(fs.existsSync(hookPath), true);

    const git = (args) =>
      spawnSync("git", args, {
        cwd: projectDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Test",
          GIT_AUTHOR_EMAIL: "test@example.com",
          GIT_COMMITTER_NAME: "Test",
          GIT_COMMITTER_EMAIL: "test@example.com",
        },
      });

    git(["checkout", "-B", "main"]);
    git(["add", "."]);
    const cleanCommit = git(["commit", "-m", "initial clean commit"]);
    assert.equal(cleanCommit.status, 0, cleanCommit.stderr);

    // Introduce bypass comment -> commit on main must be blocked
    const featFile = path.join(projectDir, "src", "features", "health", "index.ts");
    fs.appendFileSync(featFile, "\n// HACK: bypass test\n");
    git(["add", "."]);
    const blockedCommit = git(["commit", "-m", "should fail on main"]);
    assert.notEqual(blockedCommit.status, 0);

    // Switch to wip/draft -> unverified commit allowed for WIP isolation
    git(["checkout", "-b", "wip/draft"]);
    const wipCommit = git(["commit", "-m", "wip save"]);
    assert.equal(wipCommit.status, 0, wipCommit.stderr);
  } finally {
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});
