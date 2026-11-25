// API Router: Strictly NO direct fs imports allowed.
// All file reads go through server/scanners/ and all secret writes go through server/vault/.
import { runSyncAction, runVerifyAction } from "../scanners/cli-runner.mjs";
import { scanVerifyLogs } from "../scanners/log-scanner.mjs";
import { scanMcpPlugins } from "../scanners/mcp-scanner.mjs";
import { scanDashboardOverview, scanProjects } from "../scanners/project-scanner.mjs";
import { scanRulesCatalog, scanTemplates } from "../scanners/rules-scanner.mjs";
import { readSkillContent, scanSkills } from "../scanners/skill-scanner.mjs";
import { deleteSecret, listSecrets, upsertSecret } from "../vault/secret-vault.mjs";

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export async function handleApiRequest(req, res, urlObj, { harnessRoot, vaultDir }) {
  const { pathname, searchParams } = urlObj;
  const method = req.method || "GET";

  try {
    if (method === "GET" && pathname === "/api/dashboard") {
      return sendJson(res, 200, scanDashboardOverview(harnessRoot));
    }

    if (method === "GET" && pathname === "/api/projects") {
      return sendJson(res, 200, { projects: scanProjects(harnessRoot) });
    }

    if (method === "GET" && pathname === "/api/rules") {
      return sendJson(res, 200, scanRulesCatalog(harnessRoot));
    }

    if (method === "GET" && pathname === "/api/templates") {
      return sendJson(res, 200, { templates: scanTemplates(harnessRoot) });
    }

    if (method === "GET" && pathname === "/api/skills") {
      const skills = scanSkills(harnessRoot, {
        scope: searchParams.get("scope") || undefined,
        provider: searchParams.get("provider") || undefined,
      });
      return sendJson(res, 200, { skills });
    }

    if (method === "GET" && pathname === "/api/skills/content") {
      const filePath = searchParams.get("path") || "";
      return sendJson(res, 200, readSkillContent(filePath, harnessRoot));
    }

    if (method === "GET" && pathname === "/api/mcp") {
      return sendJson(res, 200, { items: scanMcpPlugins(harnessRoot) });
    }

    if (method === "GET" && pathname === "/api/logs") {
      const logs = scanVerifyLogs(harnessRoot, {
        projectId: searchParams.get("projectId") || undefined,
        result: searchParams.get("result") || undefined,
        limit: searchParams.get("limit") || undefined,
      });
      return sendJson(res, 200, { logs });
    }

    if (method === "POST" && pathname === "/api/actions/verify") {
      const body = await readJsonBody(req);
      const result = await runVerifyAction(body.projectId, harnessRoot);
      return sendJson(res, 200, result);
    }

    if (method === "POST" && pathname === "/api/actions/sync") {
      const body = await readJsonBody(req);
      const result = await runSyncAction(body.projectId || "--all", harnessRoot);
      return sendJson(res, 200, result);
    }

    if (method === "GET" && pathname === "/api/secrets") {
      return sendJson(res, 200, { secrets: listSecrets(vaultDir) });
    }

    if (method === "POST" && pathname === "/api/secrets") {
      const body = await readJsonBody(req);
      const created = upsertSecret(body, vaultDir);
      return sendJson(res, 201, { secret: created });
    }

    const secretIdMatch = pathname.match(/^\/api\/secrets\/([^/]+)$/);
    if (secretIdMatch && method === "PUT") {
      const body = await readJsonBody(req);
      const updated = upsertSecret({ ...body, id: decodeURIComponent(secretIdMatch[1]) }, vaultDir);
      return sendJson(res, 200, { secret: updated });
    }

    if (secretIdMatch && method === "DELETE") {
      const deleted = deleteSecret(decodeURIComponent(secretIdMatch[1]), vaultDir);
      return sendJson(res, deleted ? 200 : 404, { deleted });
    }

    return sendJson(res, 404, { error: "API route not found" });
  } catch (err) {
    const status = err?.name === "PathTraversalError" ? 403 : 400;
    return sendJson(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
}
