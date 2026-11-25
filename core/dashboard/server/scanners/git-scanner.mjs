import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertAllowedPath } from "./path-guard.mjs";

const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".dart"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".dart_tool", ".harness"]);

function runGit(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function scanProjectGitStatus(projectDir, harnessRoot) {
  const safeDir = assertAllowedPath(projectDir, harnessRoot);
  const dotGit = path.join(safeDir, ".git");
  const isGitRepo = fs.existsSync(dotGit);

  if (!isGitRepo) {
    return {
      isGitRepo: false,
      branch: null,
      isWipBranch: false,
      dirtyCount: 0,
      lastCommitAt: null,
      lastCommitSubject: null,
      preCommitHookInstalled: false,
    };
  }

  const branch = runGit(["symbolic-ref", "--short", "HEAD"], safeDir) || "detached";
  const statusOut = runGit(["status", "--porcelain"], safeDir) || "";
  const dirtyCount = statusOut ? statusOut.split(/\r?\n/).filter(Boolean).length : 0;
  const lastLog = runGit(["log", "-1", "--format=%cI%x1f%s"], safeDir);
  let lastCommitAt = null;
  let lastCommitSubject = null;
  if (lastLog && lastLog.includes("\x1f")) {
    const [ts, subject] = lastLog.split("\x1f");
    lastCommitAt = ts || null;
    lastCommitSubject = subject || null;
  }

  const hookPath = path.join(dotGit, "hooks", "pre-commit");
  const preCommitHookInstalled = fs.existsSync(hookPath);

  return {
    isGitRepo: true,
    branch,
    isWipBranch: branch.startsWith("wip/"),
    dirtyCount,
    lastCommitAt,
    lastCommitSubject,
    preCommitHookInstalled,
  };
}

function walkLayerStats(dir, bucket) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkLayerStats(full, bucket);
    } else if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
      bucket.files += 1;
      try {
        const content = fs.readFileSync(full, "utf8");
        bucket.lines += content ? content.split(/\r?\n/).length : 0;
      } catch {
        // Ignore unreadable files
      }
    }
  }
}

export function scanLayerDistribution(projectDir, harnessRoot) {
  const safeDir = assertAllowedPath(projectDir, harnessRoot);
  const layers = {
    core: { files: 0, lines: 0 },
    platform: { files: 0, lines: 0 },
    "ui-kit": { files: 0, lines: 0 },
    features: { files: 0, lines: 0 },
  };

  const roots = [
    path.join(safeDir, "src"),
    path.join(safeDir, "lib"),
    path.join(safeDir, "web", "src"),
  ];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const layerName of Object.keys(layers)) {
      walkLayerStats(path.join(root, layerName), layers[layerName]);
    }
  }

  const totalFiles = Object.values(layers).reduce((acc, item) => acc + item.files, 0);
  const totalLines = Object.values(layers).reduce((acc, item) => acc + item.lines, 0);

  return { ...layers, totalFiles, totalLines };
}
