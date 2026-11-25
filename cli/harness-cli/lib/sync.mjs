import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HARNESS_ROOT, readRegistry, resolveProject } from "./registry.mjs";

export function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function getSyncTargetsForStack(stack, harnessRoot = HARNESS_ROOT, kind = "product") {
  const targets = [
    {
      source: path.join(harnessRoot, "rules", "boundary", "boundary-rules.json"),
      destRel: ".harness-rules/boundary-rules.json",
    },
    {
      source: path.join(harnessRoot, "rules", "eslint-config", "guardrail-rules.json"),
      destRel: ".harness-rules/guardrail-rules.json",
    },
    {
      source: path.join(harnessRoot, "rules", "agent-instructions", "CLAUDE.md"),
      destRel: "CLAUDE.md",
    },
    {
      source: path.join(harnessRoot, "rules", "agent-instructions", "GEMINI.md"),
      destRel: "GEMINI.md",
    },
  ];

  if (kind !== "core") {
    targets.push({
      source: path.join(harnessRoot, "rules", "agent-instructions", "PROJECT_AGENTS.md"),
      destRel: "AGENTS.md",
    });
  }

  if (stack === "flutter-app") {
    targets.push({
      source: path.join(harnessRoot, "rules", "dart-lints", "analysis_options.yaml"),
      destRel: "analysis_options.yaml",
    });
  } else {
    targets.push({
      source: path.join(harnessRoot, "rules", "eslint-config", "eslint.config.mjs"),
      destRel: "eslint.config.mjs",
    });
  }

  return targets;
}

export function installGitPreCommitHook(projectDir, harnessRoot = HARNESS_ROOT) {
  const hookSource = path.join(harnessRoot, "rules", "hooks", "pre-commit");
  const gitHooksDir = path.join(projectDir, ".git", "hooks");
  if (!fs.existsSync(hookSource) || !fs.existsSync(gitHooksDir)) {
    return false;
  }
  const dest = path.join(gitHooksDir, "pre-commit");
  fs.copyFileSync(hookSource, dest);
  fs.chmodSync(dest, 0o755);
  return true;
}

export function syncProject(projectId, harnessRoot = HARNESS_ROOT, cwd = process.cwd()) {
  const { entry, projectDir } = resolveProject(projectId, cwd, harnessRoot);
  if (!fs.existsSync(projectDir)) {
    throw new Error(
      `Project directory does not exist: ${projectDir}\nFix: Verify path in registry/projects.json.`
    );
  }

  const targets = getSyncTargetsForStack(entry.stack, harnessRoot, entry.kind);
  const filesLock = {};

  for (const target of targets) {
    if (!fs.existsSync(target.source)) {
      throw new Error(`Missing central SSOT rule file: ${target.source}`);
    }
    const destPath = path.join(projectDir, target.destRel);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(target.source, destPath);
    filesLock[target.destRel] = {
      sha256: sha256File(destPath),
      source: path.relative(harnessRoot, target.source).split(path.sep).join("/"),
    };
  }

  const lockPayload = {
    version: 1,
    projectId: entry.id,
    stack: entry.stack,
    syncedAt: new Date().toISOString(),
    files: filesLock,
  };

  const lockPath = path.join(projectDir, ".harness-lock.json");
  fs.writeFileSync(lockPath, JSON.stringify(lockPayload, null, 2) + "\n", "utf8");

  const hookInstalled = installGitPreCommitHook(projectDir, harnessRoot);

  return {
    projectId: entry.id,
    projectDir,
    syncedFiles: Object.keys(filesLock),
    hookInstalled,
  };
}

export function runSyncCommand(args, harnessRoot = HARNESS_ROOT) {
  const syncAll = args.includes("--all");
  const projectId = args.find((a) => !a.startsWith("-"));

  if (syncAll) {
    const registry = readRegistry(harnessRoot);
    const results = [];
    for (const proj of registry.projects) {
      if (proj.status === "archived") continue;
      const res = syncProject(proj.id, harnessRoot);
      results.push(res);
      console.log(`[sync] ${res.projectId}: synced ${res.syncedFiles.length} rule file(s)`);
    }
    console.log(`SYNC COMPLETE (${results.length} project(s))`);
    return results;
  }

  const res = syncProject(projectId, harnessRoot);
  console.log(`[sync] ${res.projectId}: synced ${res.syncedFiles.length} rule file(s)`);
  return [res];
}
