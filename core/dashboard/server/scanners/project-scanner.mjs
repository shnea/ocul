import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { scanLayerDistribution, scanProjectGitStatus } from "./git-scanner.mjs";
import { scanVerifyLogs } from "./log-scanner.mjs";
import { assertAllowedPath } from "./path-guard.mjs";
import { scanAgentsDiet } from "./rules-scanner.mjs";

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseChecklistProgress(filePath) {
  if (!fs.existsSync(filePath)) {
    return { completed: 0, total: 0, percent: 0 };
  }
  const content = fs.readFileSync(filePath, "utf8");
  const matches = content.match(/^\s*[-*]\s+\[([ xX])\]/gm) || [];
  const total = matches.length;
  const completed = matches.filter((m) => /\[[xX]\]/.test(m)).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

function checkProjectSyncStatus(projectDir, harnessRoot) {
  const lockPath = path.join(projectDir, ".harness-lock.json");
  if (!fs.existsSync(lockPath)) return "missing-lock";
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    for (const [relFile, info] of Object.entries(lock.files || {})) {
      const localPath = path.join(projectDir, relFile);
      const ssotPath = path.join(harnessRoot, info.source);
      if (!fs.existsSync(localPath) || !fs.existsSync(ssotPath)) return "out-of-sync";
      const localHash = sha256(localPath);
      const ssotHash = sha256(ssotPath);
      if (localHash !== info.sha256 || localHash !== ssotHash) {
        return "out-of-sync";
      }
    }
    return "synced";
  } catch {
    return "out-of-sync";
  }
}

export function detectTwoStrikeAlerts(logs) {
  const buckets = new Map();
  for (const log of logs) {
    if (log.result !== "FAILED") continue;
    const step = log.failedStep || "unknown";
    const normalizedErr = String(log.errorSummary || step)
      .replace(/:\d+/g, ":N")
      .slice(0, 90);
    const key = `${log.projectId}::${step}::${normalizedErr}`;
    const prev = buckets.get(key);
    if (prev) {
      prev.count += 1;
      if (log.ts > prev.lastSeen) prev.lastSeen = log.ts;
    } else {
      buckets.set(key, {
        projectId: log.projectId,
        failedStep: step,
        errorPattern: normalizedErr,
        count: 1,
        lastSeen: log.ts,
      });
    }
  }
  return [...buckets.values()]
    .filter((b) => b.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function computeVerifyTrends(logs) {
  const byDate = new Map();
  for (const log of logs) {
    const date = (log.ts || "").slice(0, 10);
    if (!date) continue;
    const entry = byDate.get(date) || {
      date,
      total: 0,
      passed: 0,
      failed: 0,
      totalDurationMs: 0,
    };
    entry.total += 1;
    if (log.result === "PASSED") entry.passed += 1;
    else entry.failed += 1;
    entry.totalDurationMs += Number(log.durationMs || 0);
    byDate.set(date, entry);
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((d) => ({
      date: d.date,
      total: d.total,
      passed: d.passed,
      failed: d.failed,
      passRate: d.total > 0 ? Math.round((d.passed / d.total) * 100) : 100,
      avgDurationMs: d.total > 0 ? Math.round(d.totalDurationMs / d.total) : 0,
    }));
}

export function scanProjects(harnessRoot) {
  const registryPath = assertAllowedPath(
    path.join(harnessRoot, "registry", "projects.json"),
    harnessRoot
  );
  if (!fs.existsSync(registryPath)) return [];

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch {
    return [];
  }

  const allLogs = scanVerifyLogs(harnessRoot, { limit: 1000 });
  const latestByProject = new Map();
  for (const log of allLogs) {
    if (!latestByProject.has(log.projectId)) {
      latestByProject.set(log.projectId, log);
    }
  }

  return (registry.projects || []).map((proj) => {
    const projectDir = assertAllowedPath(path.resolve(harnessRoot, proj.path), harnessRoot);
    const exists = fs.existsSync(projectDir);
    const checklist = exists
      ? parseChecklistProgress(path.join(projectDir, "CHECKLIST.md"))
      : { completed: 0, total: 0, percent: 0 };
    const syncStatus = exists ? checkProjectSyncStatus(projectDir, harnessRoot) : "missing-lock";
    const git = exists
      ? scanProjectGitStatus(projectDir, harnessRoot)
      : {
          isGitRepo: false,
          branch: null,
          isWipBranch: false,
          dirtyCount: 0,
          lastCommitAt: null,
          lastCommitSubject: null,
          preCommitHookInstalled: false,
        };
    const layers = exists
      ? scanLayerDistribution(projectDir, harnessRoot)
      : {
          core: { files: 0, lines: 0 },
          platform: { files: 0, lines: 0 },
          "ui-kit": { files: 0, lines: 0 },
          features: { files: 0, lines: 0 },
          totalFiles: 0,
          totalLines: 0,
        };

    return {
      ...proj,
      exists,
      syncStatus,
      lastVerify: latestByProject.get(proj.id) || null,
      checklist,
      git,
      layers,
    };
  });
}

export function scanDashboardOverview(harnessRoot) {
  const projects = scanProjects(harnessRoot);
  const logs = scanVerifyLogs(harnessRoot, { limit: 500 });
  const passedCount = logs.filter((l) => l.result === "PASSED").length;
  const passRate = logs.length > 0 ? Math.round((passedCount / logs.length) * 100) : 100;
  const syncWarnings = projects.filter((p) => p.syncStatus !== "synced").length;

  const failCounts = new Map();
  for (const log of logs) {
    if (log.result === "FAILED") {
      const key = log.failedStep || "unknown";
      failCounts.set(key, (failCounts.get(key) || 0) + 1);
    }
  }

  const topFailedSteps = [...failCounts.entries()]
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalProjects: projects.length,
    passRate,
    syncWarnings,
    topFailedSteps,
    recentLogs: logs.slice(0, 10),
    twoStrikeAlerts: detectTwoStrikeAlerts(logs),
    agentsDiet: scanAgentsDiet(harnessRoot),
    trends: computeVerifyTrends(logs),
  };
}
