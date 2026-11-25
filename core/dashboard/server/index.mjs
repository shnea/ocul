import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRequest } from "./routes/api.mjs";
import { getDefaultVaultDir } from "./vault/secret-vault.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "../web");
const DEFAULT_HARNESS_ROOT = path.resolve(__dirname, "../../..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveStatic(res, pathname) {
  const safeRel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const fullPath = path.resolve(WEB_DIR, safeRel);
  if (!fullPath.startsWith(WEB_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  const ext = path.extname(fullPath);
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(fullPath).pipe(res);
}

export function createDashboardServer({
  harnessRoot = process.env.HARNESS_ROOT || DEFAULT_HARNESS_ROOT,
  vaultDir = getDefaultVaultDir(),
  authToken = process.env.HARNESS_AUTH_TOKEN || "",
} = {}) {
  return http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || "/", "http://127.0.0.1");

    if (authToken) {
      const header = req.headers.authorization || "";
      if (header !== `Bearer ${authToken}`) {
        res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    if (urlObj.pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, urlObj, { harnessRoot, vaultDir });
      return;
    }

    serveStatic(res, urlObj.pathname);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const portIdx = process.argv.indexOf("--port");
  const port = portIdx !== -1 ? Number(process.argv[portIdx + 1]) : Number(process.env.PORT || 4310);

  // Local binding 127.0.0.1 by default; 0.0.0.0 requires BOTH explicit flag and auth token
  const allowExternal = process.env.HARNESS_ALLOW_EXTERNAL === "1" && Boolean(process.env.HARNESS_AUTH_TOKEN);
  const host = allowExternal ? "0.0.0.0" : "127.0.0.1";

  const server = createDashboardServer();
  server.listen(port, host, () => {
    console.log(`[harness ui] Core dashboard running at http://${host}:${port}`);
  });
}
