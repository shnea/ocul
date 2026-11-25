import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HARNESS_ROOT, readRegistry, writeRegistry } from "./registry.mjs";
import { syncProject } from "./sync.mjs";

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function copyTemplateDir(srcDir, destDir, replacements) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath, replacements);
    } else {
      let content = fs.readFileSync(srcPath, "utf8");
      for (const [key, value] of Object.entries(replacements)) {
        content = content.split(key).join(value);
      }
      fs.writeFileSync(destPath, content, "utf8");
    }
  }
}

export function runInitCommand(args, harnessRoot = HARNESS_ROOT) {
  const projectId = args[0];
  if (!projectId || projectId.startsWith("-")) {
    throw new Error(
      "Missing project ID.\nFix: Usage: harness init <kebab-case-id> --stack <react-ts|flutter-app|node-api> [--dir <path>]"
    );
  }
  if (!KEBAB_CASE_RE.test(projectId)) {
    throw new Error(
      `Invalid project ID '${projectId}'. Must be kebab-case (e.g. 'photo-resizer').\nFix: Use lowercase letters, digits, and single hyphens only.`
    );
  }

  const stackIdx = args.indexOf("--stack");
  const stack = stackIdx !== -1 ? args[stackIdx + 1] : null;
  if (!stack) {
    throw new Error(
      "Missing --stack option.\nFix: Specify --stack react-ts, --stack flutter-app, or --stack node-api."
    );
  }

  const templateDir = path.join(harnessRoot, "templates", stack);
  if (!fs.existsSync(templateDir)) {
    const available = fs.existsSync(path.join(harnessRoot, "templates"))
      ? fs.readdirSync(path.join(harnessRoot, "templates")).join(", ")
      : "none";
    throw new Error(
      `Unknown stack template '${stack}'. Available: ${available}\nFix: Choose one of the available templates.`
    );
  }

  const registry = readRegistry(harnessRoot);
  if (registry.projects.some((p) => p.id === projectId)) {
    throw new Error(
      `Project '${projectId}' is already registered in registry/projects.json.\nFix: Pick a unique project ID.`
    );
  }

  const dirIdx = args.indexOf("--dir");
  const targetDir =
    dirIdx !== -1 && args[dirIdx + 1]
      ? path.resolve(args[dirIdx + 1])
      : path.resolve(harnessRoot, "..", "projects", projectId);

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(
      `Target directory already exists and is not empty: ${targetDir}\nFix: Choose a new project ID or pass an empty --dir.`
    );
  }

  const relHarnessPath = path.relative(targetDir, harnessRoot).split(path.sep).join("/");
  const createdAt = new Date().toISOString().slice(0, 10);

  copyTemplateDir(templateDir, targetDir, {
    "{{PROJECT_ID}}": projectId,
    "{{PROJECT_ID_SNAKE}}": projectId.replace(/-/g, "_"),
    "{{HARNESS_PATH}}": relHarnessPath,
    "{{CREATED_AT}}": createdAt,
  });

  registry.projects.push({
    id: projectId,
    kind: "product",
    path: path.relative(harnessRoot, targetDir).split(path.sep).join("/"),
    stack,
    status: "active",
    createdAt,
  });
  writeRegistry(registry, harnessRoot);

  try {
    execFileSync("git", ["init", "-q"], { cwd: targetDir, stdio: "ignore" });
  } catch {
    // Non-fatal if git is unavailable in restricted env
  }

  const syncRes = syncProject(projectId, harnessRoot);

  console.log(`[init] Created '${projectId}' (${stack}) at ${targetDir}`);
  console.log(
    `[init] Registered in registry/projects.json, synced rules${syncRes.hookInstalled ? ", and installed git pre-commit hook" : ""}.`
  );
  return { projectId, stack, targetDir };
}
