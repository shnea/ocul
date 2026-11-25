import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertAllowedPath } from "./path-guard.mjs";

// Delegates state-changing operations strictly to harness-cli subprocess (never mutates files directly).

function getRegisteredProjectIds(harnessRoot) {
  const regPath = assertAllowedPath(
    path.join(harnessRoot, "registry", "projects.json"),
    harnessRoot
  );
  if (!fs.existsSync(regPath)) return new Set();
  const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
  return new Set((reg.projects || []).map((p) => p.id));
}

function execHarnessCli(args, harnessRoot) {
  const cliBin = assertAllowedPath(
    path.join(harnessRoot, "cli", "harness-cli", "bin", "harness.mjs"),
    harnessRoot
  );
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cliBin, ...args],
      { cwd: harnessRoot, encoding: "utf8", timeout: 60_000 },
      (err, stdout, stderr) => {
        const exitCode = err && typeof err.code === "number" ? err.code : err ? 1 : 0;
        resolve({
          ok: exitCode === 0,
          command: `harness ${args.join(" ")}`,
          exitCode,
          stdout: (stdout || "").trim(),
          stderr: (stderr || "").trim(),
        });
      }
    );
  });
}

export async function runVerifyAction(projectId, harnessRoot) {
  const allowed = getRegisteredProjectIds(harnessRoot);
  if (!projectId || !allowed.has(projectId)) {
    throw new Error(`Invalid or unregistered projectId: ${projectId}`);
  }
  return execHarnessCli(["verify", projectId], harnessRoot);
}

export async function runSyncAction(projectId, harnessRoot) {
  if (projectId === "--all") {
    return execHarnessCli(["sync", "--all"], harnessRoot);
  }
  const allowed = getRegisteredProjectIds(harnessRoot);
  if (!projectId || !allowed.has(projectId)) {
    throw new Error(`Invalid or unregistered projectId: ${projectId}`);
  }
  return execHarnessCli(["sync", projectId], harnessRoot);
}
