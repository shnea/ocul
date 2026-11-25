import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".dart"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".dart_tool", ".harness"]);

function walkFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }
  return result;
}

function extractImports(content) {
  const imports = [];
  const lines = content.split(/\r?\n/);
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        imports.push({ specifier: match[1], line: i + 1 });
      }
    }
  }
  return imports;
}

function detectLayer(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  const serverMatch = normalized.match(/(?:^|\/)server\/(routes|scanners|vault)\//);
  if (serverMatch) {
    return { kind: "server", layer: serverMatch[1], featureName: null };
  }
  const fourLayerMatch = normalized.match(/(?:^|\/)(?:src|lib)\/(core|platform|ui-kit|features)\/(.*)$/);
  if (fourLayerMatch) {
    const layer = fourLayerMatch[1];
    const rest = fourLayerMatch[2];
    const featureName = layer === "features" ? rest.split("/")[0] : null;
    return { kind: "app", layer, featureName };
  }
  return null;
}

function resolveTargetLayer(projectRoot, fromFile, specifier) {
  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(fromFile), specifier);
    const rel = path.relative(projectRoot, resolved).split(path.sep).join("/");
    const serverMatch = rel.match(/(?:^|\/)server\/(routes|scanners|vault)(?:\/|$)/);
    if (serverMatch) {
      return { kind: "server", layer: serverMatch[1], rel, isRelative: true };
    }
    if (rel.startsWith("shared/") || rel.includes("/shared/")) {
      return { kind: "server", layer: "shared", rel, isRelative: true };
    }
    const appMatch = rel.match(/(?:^|\/)(?:src|lib)\/(core|platform|ui-kit|features)(?:\/(.*))?$/);
    if (appMatch) {
      const rest = appMatch[2] || "";
      const featureName = appMatch[1] === "features" ? rest.split("/")[0] : null;
      return { kind: "app", layer: appMatch[1], featureName, rest, rel, isRelative: true };
    }
    return { kind: "other", layer: null, rel, isRelative: true };
  }

  // Dart package import: package:<pkg>/(core|platform|ui-kit|features)/...
  const dartPkg = specifier.match(/^package:[^/]+\/(core|platform|ui-kit|features)(?:\/(.*))?$/);
  if (dartPkg) {
    const rest = dartPkg[2] || "";
    return {
      kind: "app",
      layer: dartPkg[1],
      featureName: dartPkg[1] === "features" ? rest.split("/")[0] : null,
      rest,
      rel: specifier,
      isRelative: false,
    };
  }

  return { kind: "external", layer: null, rel: specifier, isRelative: false };
}

export function checkBoundaries(projectRoot, rules) {
  const files = walkFiles(projectRoot);
  const violations = [];

  for (const file of files) {
    const relPath = path.relative(projectRoot, file).split(path.sep).join("/");
    const sourceInfo = detectLayer(relPath);
    if (!sourceInfo) continue;

    const ruleSet =
      sourceInfo.kind === "server"
        ? rules.serverLayers?.[sourceInfo.layer]
        : rules.layers?.[sourceInfo.layer];
    if (!ruleSet) continue;

    const content = fs.readFileSync(file, "utf8");
    const imports = extractImports(content);

    for (const { specifier, line } of imports) {
      const target = resolveTargetLayer(projectRoot, file, specifier);

      if (target.kind === "external") {
        if (ruleSet.forbiddenExternal?.includes(specifier)) {
          violations.push({
            file: relPath,
            line,
            specifier,
            message: `${relPath}:${line} forbidden external import '${specifier}' in ${sourceInfo.layer}/`,
            fix: ruleSet.fix,
          });
        }
        continue;
      }

      if (target.layer && !ruleSet.allowedTargets.includes(target.layer)) {
        violations.push({
          file: relPath,
          line,
          specifier,
          message: `${relPath}:${line} layer violation (${sourceInfo.layer}/ -> ${target.layer}/ via '${specifier}')`,
          fix: ruleSet.fix,
        });
        continue;
      }

      // Check deep platform internal imports from features/
      if (
        sourceInfo.kind === "app" &&
        sourceInfo.layer === "features" &&
        target.kind === "app" &&
        target.layer === "platform" &&
        ruleSet.disallowDeepPlatformImports
      ) {
        const rest = (target.rest || "").replace(/\.(js|mjs|cjs|ts|tsx|dart)$/, "");
        if (rest.includes("/") && !rest.endsWith("/index")) {
          violations.push({
            file: relPath,
            line,
            specifier,
            message: `${relPath}:${line} deep platform internal import '${specifier}' from features/`,
            fix: "Import only from platform/ top-level interface (e.g. platform/api-client or platform/index).",
          });
        }
      }

      // Check cross-feature imports
      if (
        sourceInfo.kind === "app" &&
        sourceInfo.layer === "features" &&
        target.kind === "app" &&
        target.layer === "features" &&
        ruleSet.disallowCrossFeatureImports &&
        sourceInfo.featureName &&
        target.featureName &&
        sourceInfo.featureName !== target.featureName
      ) {
        violations.push({
          file: relPath,
          line,
          specifier,
          message: `${relPath}:${line} cross-feature import ('features/${sourceInfo.featureName}' -> 'features/${target.featureName}')`,
          fix: "Move shared domain logic to core/ or shared UI to ui-kit/ instead of importing across features/.",
        });
      }
    }
  }

  return violations;
}
