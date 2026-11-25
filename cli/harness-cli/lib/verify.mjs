import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { checkBoundaries } from "../../../rules/boundary/check-boundary.mjs";
import { HARNESS_ROOT, resolveProject } from "./registry.mjs";
import { getSyncTargetsForStack, sha256File } from "./sync.mjs";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".dart_tool",
  ".harness",
  ".harness-rules",
]);

function walkSourceFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, result);
    } else {
      const ext = path.extname(entry.name);
      if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".dart"].includes(ext)) {
        result.push(full);
      }
    }
  }
  return result;
}

function appendVerifyLog(entry, harnessRoot = HARNESS_ROOT) {
  const logPath = path.join(harnessRoot, ".harness", "logs", "verify.jsonl");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
}

function runSyncCheck(projectDir, stack, projectId, harnessRoot, kind = "product") {
  const lockPath = path.join(projectDir, ".harness-lock.json");
  if (!fs.existsSync(lockPath)) {
    return {
      ok: false,
      summary: "Missing .harness-lock.json",
      fix: `Run 'harness sync ${projectId}' to synchronize central rules.`,
    };
  }

  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return {
      ok: false,
      summary: "Corrupted .harness-lock.json",
      fix: `Run 'harness sync ${projectId}' to regenerate .harness-lock.json.`,
    };
  }

  const targets = getSyncTargetsForStack(stack, harnessRoot, kind);
  for (const target of targets) {
    const destPath = path.join(projectDir, target.destRel);
    const locked = lock.files?.[target.destRel];
    if (!fs.existsSync(destPath)) {
      return {
        ok: false,
        summary: `Missing synced rule file: ${target.destRel}`,
        fix: `Run 'harness sync ${projectId}' to restore ${target.destRel}.`,
      };
    }
    const actualHash = sha256File(destPath);
    const ssotHash = sha256File(target.source);
    if (!locked || actualHash !== locked.sha256) {
      return {
        ok: false,
        summary: `Local rule file modified: ${target.destRel}`,
        fix: `Do not edit rule files inside individual projects. Run 'harness sync ${projectId}' to restore SSOT rules.`,
      };
    }
    if (actualHash !== ssotHash) {
      return {
        ok: false,
        summary: `Rule file out of sync with central SSOT: ${target.destRel}`,
        fix: `Central rules were updated. Run 'harness sync ${projectId}' (or 'harness sync --all').`,
      };
    }
  }

  return { ok: true };
}

function runBoundaryStep(projectDir, harnessRoot) {
  const rulesPath = path.join(harnessRoot, "rules", "boundary", "boundary-rules.json");
  const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  const violations = checkBoundaries(projectDir, rules);
  if (violations.length > 0) {
    const first = violations[0];
    const details = violations
      .slice(0, 5)
      .map((v) => `  - ${v.message}\n    Fix: ${v.fix}`)
      .join("\n");
    return {
      ok: false,
      summary: first.message,
      fix: `Resolve ${violations.length} boundary violation(s):\n${details}`,
    };
  }
  return { ok: true };
}

function runLintStep(projectDir, meta, harnessRoot) {
  const guardrailPath = path.join(
    harnessRoot,
    "rules",
    "eslint-config",
    "guardrail-rules.json"
  );
  const guardrails = JSON.parse(fs.readFileSync(guardrailPath, "utf8"));
  const files = walkSourceFiles(projectDir);
  const errors = [];

  for (const file of files) {
    const rel = path.relative(projectDir, file).split(path.sep).join("/");
    // Skip synced config files and test fixtures that intentionally test guardrail strings
    if (rel === "eslint.config.mjs" || rel.startsWith(".harness-rules/")) continue;

    const ext = path.extname(file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of guardrails.bypassCommentPatterns || []) {
        const re = new RegExp(pattern.regex);
        if (re.test(line)) {
          errors.push({
            summary: `${rel}:${i + 1} ${pattern.message}`,
            fix: pattern.fix,
          });
        }
      }
      for (const rule of guardrails.scopedRules || []) {
        if (rule.extensions && !rule.extensions.includes(ext)) continue;
        if (!new RegExp(rule.pathPattern).test(rel)) continue;
        if (new RegExp(rule.regex).test(line)) {
          errors.push({
            summary: `${rel}:${i + 1} ${rule.message}`,
            fix: rule.fix,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    const details = errors
      .slice(0, 5)
      .map((e) => `  - ${e.summary}\n    Fix: ${e.fix}`)
      .join("\n");
    return {
      ok: false,
      summary: errors[0].summary,
      fix: `Resolve ${errors.length} lint guardrail violation(s):\n${details}`,
    };
  }

  if (meta.customVerify?.lint) {
    return runShellStep("lint", meta.customVerify.lint, projectDir);
  }

  // If local eslint binary exists, execute with --max-warnings 0
  const localEslint = path.join(projectDir, "node_modules", ".bin", "eslint");
  if (fs.existsSync(localEslint)) {
    return runShellStep("lint", `"${localEslint}" . --max-warnings 0`, projectDir);
  }

  return { ok: true };
}

function runShellStep(stepName, command, cwd) {
  const res = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    const output = (res.stderr || res.stdout || "").trim().split(/\r?\n/).slice(-5).join(" | ");
    return {
      ok: false,
      summary: `${stepName} command failed: ${output || `exit code ${res.status}`}`,
      fix: `Inspect the ${stepName} failure output above and fix the underlying error before re-running 'harness verify'.`,
    };
  }
  return { ok: true };
}

function runTestStep(projectDir, meta) {
  if (meta.customVerify?.test) {
    return runShellStep("test", meta.customVerify.test, projectDir);
  }
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.scripts?.test) {
      return runShellStep("test", "npm test", projectDir);
    }
  }
  return { ok: true };
}

function runBuildStep(projectDir, meta) {
  if (meta.customVerify?.build) {
    return runShellStep("build", meta.customVerify.build, projectDir);
  }
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.scripts?.build) {
      return runShellStep("build", "npm run build", projectDir);
    }
  }
  return { ok: true };
}

export function verifyProject(projectId, harnessRoot = HARNESS_ROOT, cwd = process.cwd()) {
  const startedAt = Date.now();
  const { entry, projectDir } = resolveProject(projectId, cwd, harnessRoot);
  const metaPath = path.join(projectDir, "harness.json");
  if (!fs.existsSync(metaPath)) {
    throw new Error(
      `Missing harness.json in ${projectDir}\nFix: Ensure this project was created via 'harness init'.`
    );
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const pipeline = meta.verifyPipeline || ["sync-check", "boundary", "lint", "test", "build"];

  for (const step of pipeline) {
    let outcome;
    if (step === "sync-check") {
      outcome = runSyncCheck(
        projectDir,
        meta.stack || entry.stack,
        entry.id,
        harnessRoot,
        entry.kind
      );
    } else if (step === "boundary") {
      outcome = runBoundaryStep(projectDir, harnessRoot);
    } else if (step === "lint") {
      outcome = runLintStep(projectDir, meta, harnessRoot);
    } else if (step === "test") {
      outcome = runTestStep(projectDir, meta);
    } else if (step === "build") {
      outcome = runBuildStep(projectDir, meta);
    } else if (meta.customVerify?.[step]) {
      outcome = runShellStep(step, meta.customVerify[step], projectDir);
    } else {
      outcome = { ok: true };
    }

    if (!outcome.ok) {
      const durationMs = Date.now() - startedAt;
      const logEntry = {
        ts: new Date().toISOString(),
        projectId: entry.id,
        result: "FAILED",
        failedStep: step,
        durationMs,
        errorSummary: outcome.summary,
      };
      appendVerifyLog(logEntry, harnessRoot);
      return {
        passed: false,
        failedStep: step,
        durationMs,
        errorSummary: outcome.summary,
        fix: outcome.fix,
        logEntry,
      };
    }
  }

  const durationMs = Date.now() - startedAt;
  const logEntry = {
    ts: new Date().toISOString(),
    projectId: entry.id,
    result: "PASSED",
    failedStep: null,
    durationMs,
    errorSummary: null,
  };
  appendVerifyLog(logEntry, harnessRoot);
  return { passed: true, durationMs, logEntry };
}

export function runVerifyCommand(args, harnessRoot = HARNESS_ROOT) {
  const projectId = args.find((a) => !a.startsWith("-"));
  const result = verifyProject(projectId, harnessRoot);
  if (!result.passed) {
    console.error(`[verify] Step '${result.failedStep}' failed (${result.durationMs}ms)`);
    console.error(`Error: ${result.errorSummary}`);
    console.error(`Fix: ${result.fix}`);
    console.error("RESULT: FAILED");
    process.exitCode = 1;
    return result;
  }
  console.log(`[verify] ${result.logEntry.projectId} verified in ${result.durationMs}ms`);
  console.log("RESULT: PASSED");
  return result;
}
