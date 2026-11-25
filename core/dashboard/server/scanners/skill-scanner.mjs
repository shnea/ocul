import fs from "node:fs";
import path from "node:path";
import { assertAllowedPath } from "./path-guard.mjs";
import { scanProjects } from "./project-scanner.mjs";

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) meta[key] = val;
  }

  if (!meta.name || !meta.scope || !meta.provider) {
    return null;
  }
  return meta;
}

function scanSkillDir(dirPath, harnessRoot, projectId = null) {
  const safeDir = assertAllowedPath(dirPath, harnessRoot);
  if (!fs.existsSync(safeDir)) return [];

  const items = [];
  for (const entry of fs.readdirSync(safeDir, { withFileTypes: true })) {
    const full = path.join(safeDir, entry.name);
    if (entry.isDirectory()) {
      items.push(...scanSkillDir(full, harnessRoot, projectId));
    } else if (entry.name.endsWith(".md")) {
      try {
        const content = fs.readFileSync(full, "utf8");
        const meta = parseFrontmatter(content);
        if (!meta) continue;
        items.push({
          name: meta.name,
          scope: meta.scope === "common" ? "common" : "project",
          provider: meta.provider,
          projectId,
          filePath: path.relative(harnessRoot, full).split(path.sep).join("/"),
          overridesCommon: false,
        });
      } catch {
        // Safely skip unreadable or malformed skill files
      }
    }
  }
  return items;
}

export function scanSkills(harnessRoot, filters = {}) {
  const commonDir = path.join(harnessRoot, "rules", "agent-skills");
  const commonSkills = scanSkillDir(commonDir, harnessRoot, null);
  const commonNames = new Set(commonSkills.map((s) => s.name));

  const projectSkills = [];
  const projects = scanProjects(harnessRoot);
  for (const proj of projects) {
    if (!proj.exists) continue;
    const agentDir = path.resolve(harnessRoot, proj.path, ".agent");
    if (fs.existsSync(agentDir)) {
      const found = scanSkillDir(agentDir, harnessRoot, proj.id);
      for (const item of found) {
        item.overridesCommon = commonNames.has(item.name);
        projectSkills.push(item);
      }
    }
  }

  const allSkills = [...commonSkills, ...projectSkills];
  return allSkills.filter((s) => {
    if (filters.scope && s.scope !== filters.scope) return false;
    if (filters.provider && s.provider !== filters.provider) return false;
    return true;
  });
}

export function readSkillContent(relFilePath, harnessRoot) {
  if (!relFilePath || !relFilePath.endsWith(".md")) {
    throw new Error("Only markdown (.md) skill files may be previewed.");
  }
  const safePath = assertAllowedPath(relFilePath, harnessRoot);
  if (!fs.existsSync(safePath)) {
    throw new Error("Skill file not found.");
  }
  return {
    filePath: relFilePath,
    content: fs.readFileSync(safePath, "utf8"),
  };
}
