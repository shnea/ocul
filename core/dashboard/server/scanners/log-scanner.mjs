import fs from "node:fs";
import path from "node:path";
import { assertAllowedPath } from "./path-guard.mjs";

export function parseVerifyJsonl(rawText) {
  const entries = [];
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed.ts === "string" &&
        typeof parsed.projectId === "string" &&
        (parsed.result === "PASSED" || parsed.result === "FAILED")
      ) {
        entries.push({
          ts: parsed.ts,
          projectId: parsed.projectId,
          result: parsed.result,
          failedStep: parsed.failedStep ?? null,
          durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
          errorSummary: parsed.errorSummary ?? null,
        });
      }
    } catch {
      // Safely skip corrupted JSONL lines
    }
  }
  return entries.reverse();
}

export function scanVerifyLogs(harnessRoot, filters = {}) {
  const logPath = assertAllowedPath(
    path.join(harnessRoot, ".harness", "logs", "verify.jsonl"),
    harnessRoot
  );
  if (!fs.existsSync(logPath)) {
    return [];
  }
  const raw = fs.readFileSync(logPath, "utf8");
  let logs = parseVerifyJsonl(raw);

  if (filters.projectId) {
    logs = logs.filter((l) => l.projectId === filters.projectId);
  }
  if (filters.result) {
    logs = logs.filter((l) => l.result === filters.result);
  }
  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 200;
  return logs.slice(0, limit);
}
