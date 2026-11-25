import fs from "node:fs";
import path from "node:path";
import { assertAllowedPath } from "./path-guard.mjs";
import { scanProjects } from "./project-scanner.mjs";

function parseMcpConfigFile(filePath, targetProject, harnessRoot) {
  const safePath = assertAllowedPath(filePath, harnessRoot);
  if (!fs.existsSync(safePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(safePath, "utf8"));
    const servers = data.mcpServers || data.plugins || {};
    return Object.entries(servers).map(([name, cfg]) => ({
      name,
      provider: cfg?.provider || "local",
      enabled: cfg?.disabled ? false : true,
      targetProject,
      sourcePath: path.relative(harnessRoot, safePath).split(path.sep).join("/"),
    }));
  } catch {
    // Safely skip malformed MCP JSON files
    return [];
  }
}

export function scanMcpPlugins(harnessRoot) {
  const items = [];
  const rootMcp = path.join(harnessRoot, ".harness", "mcp.json");
  items.push(...parseMcpConfigFile(rootMcp, "central", harnessRoot));

  const projects = scanProjects(harnessRoot);
  for (const proj of projects) {
    if (!proj.exists) continue;
    const projMcp = path.resolve(harnessRoot, proj.path, ".mcp.json");
    items.push(...parseMcpConfigFile(projMcp, proj.id, harnessRoot));
  }
  return items;
}
