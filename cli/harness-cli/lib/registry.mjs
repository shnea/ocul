import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HARNESS_ROOT = path.resolve(__dirname, "../../..");
export const REGISTRY_PATH = path.join(HARNESS_ROOT, "registry", "projects.json");
export const VERIFY_LOG_PATH = path.join(HARNESS_ROOT, ".harness", "logs", "verify.jsonl");

export function readRegistry(harnessRoot = HARNESS_ROOT) {
  const regPath = path.join(harnessRoot, "registry", "projects.json");
  if (!fs.existsSync(regPath)) {
    return { version: 1, projects: [] };
  }
  return JSON.parse(fs.readFileSync(regPath, "utf8"));
}

export function writeRegistry(registry, harnessRoot = HARNESS_ROOT) {
  const regPath = path.join(harnessRoot, "registry", "projects.json");
  fs.mkdirSync(path.dirname(regPath), { recursive: true });
  fs.writeFileSync(regPath, JSON.stringify(registry, null, 2) + "\n", "utf8");
}

export function resolveProject(projectId, cwd = process.cwd(), harnessRoot = HARNESS_ROOT) {
  const registry = readRegistry(harnessRoot);
  if (projectId) {
    const entry = registry.projects.find((p) => p.id === projectId);
    if (!entry) {
      throw new Error(
        `Project '${projectId}' not found in registry/projects.json.\nFix: Run 'harness init ${projectId} --stack <stack>' or check registry/projects.json.`
      );
    }
    const projectDir = path.resolve(harnessRoot, entry.path);
    return { entry, projectDir };
  }

  // Resolve from cwd by walking up until harness.json is found
  let cur = path.resolve(cwd);
  while (true) {
    const candidate = path.join(cur, "harness.json");
    if (fs.existsSync(candidate)) {
      const meta = JSON.parse(fs.readFileSync(candidate, "utf8"));
      const entry = registry.projects.find((p) => p.id === meta.projectId) || {
        id: meta.projectId,
        kind: "product",
        path: path.relative(harnessRoot, cur),
        stack: meta.stack,
        status: "active",
      };
      return { entry, projectDir: cur };
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  throw new Error(
    "Could not locate harness.json in current directory or parent directories.\nFix: Pass a project ID (e.g. 'harness verify core-dashboard') or run inside a harness-managed project."
  );
}
