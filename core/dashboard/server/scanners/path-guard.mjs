import fs from "node:fs";
import path from "node:path";

export class PathTraversalError extends Error {
  constructor(targetPath) {
    super(`Blocked unauthorized path access outside allowed harness roots: ${targetPath}`);
    this.name = "PathTraversalError";
  }
}

function isInsideRoot(candidate, root) {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function getAllowedRoots(harnessRoot) {
  const roots = [path.resolve(harnessRoot)];
  const registryPath = path.join(harnessRoot, "registry", "projects.json");
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, "utf8"));
      for (const proj of reg.projects || []) {
        if (typeof proj.path === "string" && proj.path.length > 0) {
          roots.push(path.resolve(harnessRoot, proj.path));
        }
      }
    } catch {
      // Ignore malformed registry here; harnessRoot remains allowed
    }
  }
  return roots;
}

export function assertAllowedPath(targetPath, harnessRoot) {
  if (typeof targetPath !== "string" || targetPath.includes("\0")) {
    throw new PathTraversalError(String(targetPath));
  }
  const resolved = path.resolve(harnessRoot, targetPath);
  const allowedRoots = getAllowedRoots(harnessRoot);

  const allowedByLexical = allowedRoots.some((root) => isInsideRoot(resolved, root));
  if (!allowedByLexical) {
    throw new PathTraversalError(targetPath);
  }

  // Also resolve symlinks if path exists
  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    const allowedByReal = allowedRoots.some((root) => {
      const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
      return isInsideRoot(realTarget, realRoot);
    });
    if (!allowedByReal) {
      throw new PathTraversalError(targetPath);
    }
  }

  return resolved;
}

export function safeReadTextFile(targetPath, harnessRoot) {
  const safePath = assertAllowedPath(targetPath, harnessRoot);
  return fs.readFileSync(safePath, "utf8");
}
