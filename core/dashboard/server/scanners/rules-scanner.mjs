import fs from "node:fs";
import path from "node:path";
import { assertAllowedPath } from "./path-guard.mjs";

function parseDartLintRules(yamlText) {
  const rules = [];
  let inRules = false;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^\s*rules\s*:/.test(line)) {
      inRules = true;
      continue;
    }
    if (inRules) {
      const m = line.match(/^\s*-\s+([a-z0-9_]+)/i);
      if (m) {
        rules.push(m[1]);
      } else if (line.trim() && !line.trim().startsWith("#")) {
        inRules = false;
      }
    }
  }
  return rules;
}

export function scanRulesCatalog(harnessRoot) {
  const guardrailPath = assertAllowedPath(
    path.join(harnessRoot, "rules", "eslint-config", "guardrail-rules.json"),
    harnessRoot
  );
  const boundaryPath = assertAllowedPath(
    path.join(harnessRoot, "rules", "boundary", "boundary-rules.json"),
    harnessRoot
  );
  const dartPath = assertAllowedPath(
    path.join(harnessRoot, "rules", "dart-lints", "analysis_options.yaml"),
    harnessRoot
  );

  let guardrails = { bypassCommentPatterns: [], scopedRules: [] };
  if (fs.existsSync(guardrailPath)) {
    try {
      guardrails = JSON.parse(fs.readFileSync(guardrailPath, "utf8"));
    } catch {
      // Safe fallback
    }
  }

  let boundaries = { layers: {}, serverLayers: {} };
  if (fs.existsSync(boundaryPath)) {
    try {
      boundaries = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
    } catch {
      // Safe fallback
    }
  }

  let dartRules = [];
  if (fs.existsSync(dartPath)) {
    try {
      dartRules = parseDartLintRules(fs.readFileSync(dartPath, "utf8"));
    } catch {
      // Safe fallback
    }
  }

  const appLayers = Object.entries(boundaries.layers || {}).map(([layer, cfg]) => ({
    layer,
    allowedTargets: cfg.allowedTargets || [],
    forbiddenExternal: cfg.forbiddenExternal || [],
    fix: cfg.fix || "",
  }));

  const serverLayers = Object.entries(boundaries.serverLayers || {}).map(([layer, cfg]) => ({
    layer,
    allowedTargets: cfg.allowedTargets || [],
    forbiddenExternal: cfg.forbiddenExternal || [],
    fix: cfg.fix || "",
  }));

  return {
    bypassComments: (guardrails.bypassCommentPatterns || []).map((r) => ({
      id: r.id,
      regex: r.regex,
      message: r.message,
      fix: r.fix,
    })),
    scopedRules: (guardrails.scopedRules || []).map((r) => ({
      id: r.id,
      pathPattern: r.pathPattern,
      message: r.message,
      fix: r.fix,
    })),
    appLayers,
    serverLayers,
    dartRules,
  };
}

function listFilesRecursive(dir, baseDir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursive(full, baseDir, out);
    } else {
      out.push(path.relative(baseDir, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

export function scanTemplates(harnessRoot) {
  const templatesDir = assertAllowedPath(path.join(harnessRoot, "templates"), harnessRoot);
  if (!fs.existsSync(templatesDir)) return [];

  const result = [];
  for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const stackDir = path.join(templatesDir, entry.name);
    result.push({
      stack: entry.name,
      files: listFilesRecursive(stackDir, stackDir),
    });
  }
  return result.sort((a, b) => a.stack.localeCompare(b.stack));
}

export function scanAgentsDiet(harnessRoot) {
  const targets = [
    { label: "Root AGENTS.md", rel: "AGENTS.md", limit: 50 },
    { label: "Project SSOT AGENTS.md", rel: "rules/agent-instructions/PROJECT_AGENTS.md", limit: 50 },
    { label: "Core Dashboard AGENTS.md", rel: "core/dashboard/AGENTS.md", limit: 80 },
  ];

  return targets
    .map((t) => {
      const full = assertAllowedPath(path.join(harnessRoot, t.rel), harnessRoot);
      if (!fs.existsSync(full)) return null;
      const lines = fs.readFileSync(full, "utf8").split(/\r?\n/).length;
      return {
        label: t.label,
        filePath: t.rel,
        lines,
        limit: t.limit,
        status: lines > t.limit ? "warning" : "ok",
      };
    })
    .filter(Boolean);
}
