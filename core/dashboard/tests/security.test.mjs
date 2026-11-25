import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { handleApiRequest } from "../server/routes/api.mjs";
import { parseVerifyJsonl } from "../server/scanners/log-scanner.mjs";
import { assertAllowedPath, PathTraversalError } from "../server/scanners/path-guard.mjs";
import { computeVerifyTrends, detectTwoStrikeAlerts } from "../server/scanners/project-scanner.mjs";
import { scanAgentsDiet, scanRulesCatalog, scanTemplates } from "../server/scanners/rules-scanner.mjs";
import { parseFrontmatter, readSkillContent, scanSkills } from "../server/scanners/skill-scanner.mjs";
import { listSecrets, upsertSecret } from "../server/vault/secret-vault.mjs";

test("GET /api/secrets never exposes raw secret value and stores encrypted 0600 file", async () => {
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), "ocul-vault-test-"));
  const tmpHarness = fs.mkdtempSync(path.join(os.tmpdir(), "ocul-harness-sec-"));
  fs.mkdirSync(path.join(tmpHarness, "registry"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpHarness, "registry", "projects.json"),
    JSON.stringify({ version: 1, projects: [] })
  );

  const rawSecret = "sk-live-SUPER-SECRET-TOKEN-9876543210";
  upsertSecret(
    { name: "OPENAI_API_KEY", projectId: "core-dashboard", value: rawSecret },
    tmpVault
  );

  // Verify on-disk encryption & 0600 permission
  const encPath = path.join(tmpVault, "secrets.enc");
  const diskContent = fs.readFileSync(encPath, "utf8");
  assert.equal(diskContent.includes(rawSecret), false);
  const mode = fs.statSync(encPath).mode & 0o777;
  assert.equal(mode, 0o600);

  // Verify listSecrets() masks value
  const listed = listSecrets(tmpVault);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].maskedValue, "sk-****3210");
  assert.equal(JSON.stringify(listed).includes(rawSecret), false);

  // Verify HTTP GET /api/secrets route masks value without opening network socket
  let statusCode = 0;
  let responseBody = "";
  const mockReq = { method: "GET", headers: {} };
  const mockRes = {
    writeHead(code) {
      statusCode = code;
    },
    end(payload) {
      responseBody = String(payload || "");
    },
  };
  try {
    await handleApiRequest(
      mockReq,
      mockRes,
      new URL("http://127.0.0.1/api/secrets"),
      { harnessRoot: tmpHarness, vaultDir: tmpVault }
    );
    assert.equal(statusCode, 200);
    assert.equal(responseBody.includes(rawSecret), false);
    const json = JSON.parse(responseBody);
    assert.equal(json.secrets[0].maskedValue, "sk-****3210");
  } finally {
    fs.rmSync(tmpVault, { recursive: true, force: true });
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});

test("Path guard blocks path traversal and unregistered external paths", () => {
  const tmpHarness = fs.mkdtempSync(path.join(os.tmpdir(), "ocul-pathguard-"));
  try {
    fs.mkdirSync(path.join(tmpHarness, "registry"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHarness, "registry", "projects.json"),
      JSON.stringify({ version: 1, projects: [] })
    );

    assert.throws(
      () => assertAllowedPath("../../etc/passwd", tmpHarness),
      PathTraversalError
    );
    assert.throws(
      () => assertAllowedPath("/etc/passwd", tmpHarness),
      PathTraversalError
    );

    const allowed = assertAllowedPath("registry/projects.json", tmpHarness);
    assert.equal(allowed, path.join(tmpHarness, "registry", "projects.json"));
  } finally {
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});

test("Scanners safely skip corrupted JSONL lines and missing/malformed YAML frontmatter", () => {
  const rawJsonl = [
    '{"ts":"2026-11-25T01:00:00Z","projectId":"a","result":"PASSED","failedStep":null,"durationMs":120,"errorSummary":null}',
    "{this is corrupted json!!!",
    '{"incomplete": true}',
    '{"ts":"2026-11-25T02:00:00Z","projectId":"b","result":"FAILED","failedStep":"lint","durationMs":80,"errorSummary":"bad"}',
  ].join("\n");

  const parsed = parseVerifyJsonl(rawJsonl);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].projectId, "b"); // reverse chronological
  assert.equal(parsed[1].projectId, "a");

  assert.equal(parseFrontmatter("# No frontmatter here"), null);
  assert.equal(parseFrontmatter("---\nname: incomplete\n---\nbody"), null);

  const tmpHarness = fs.mkdtempSync(path.join(os.tmpdir(), "ocul-skills-"));
  try {
    fs.mkdirSync(path.join(tmpHarness, "registry"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHarness, "registry", "projects.json"),
      JSON.stringify({ version: 1, projects: [] })
    );
    const skillDir = path.join(tmpHarness, "rules", "agent-skills");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "broken.md"), "# Missing frontmatter");
    fs.writeFileSync(
      path.join(skillDir, "valid.md"),
      "---\nname: verify-ui\nscope: common\nprovider: local\n---\n# Valid"
    );

    const skills = scanSkills(tmpHarness);
    assert.equal(skills.length, 1);
    assert.equal(skills[0].name, "verify-ui");
  } finally {
    fs.rmSync(tmpHarness, { recursive: true, force: true });
  }
});

test("Skill preview blocks path traversal and CLI action rejects unregistered projectId", async () => {
  const harnessRoot = path.resolve(import.meta.dirname, "../../..");

  // Path traversal on skill preview must throw PathTraversalError
  assert.throws(
    () => readSkillContent("../../etc/passwd.md", harnessRoot),
    PathTraversalError
  );

  // Valid skill preview succeeds
  const preview = readSkillContent("rules/agent-skills/verify-ui.md", harnessRoot);
  assert.match(preview.content, /name:\s*verify-ui/);

  // Unregistered or injected projectId on POST /api/actions/verify must return 400
  let statusCode = 0;
  let body = "";
  const mockReq = {
    method: "POST",
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify({ projectId: "core-dashboard; echo pwned" }));
    },
  };
  const mockRes = {
    writeHead(code) {
      statusCode = code;
    },
    end(payload) {
      body = String(payload || "");
    },
  };
  await handleApiRequest(
    mockReq,
    mockRes,
    new URL("http://127.0.0.1/api/actions/verify"),
    { harnessRoot, vaultDir: os.tmpdir() }
  );
  assert.equal(statusCode, 400);
  assert.match(body, /Invalid or unregistered projectId/);
});

test("Two-strike detector, AGENTS.md diet, rules catalog, and templates scanner work", () => {
  const harnessRoot = path.resolve(import.meta.dirname, "../../..");

  const alerts = detectTwoStrikeAlerts([
    { ts: "2026-11-25T01:00:00Z", projectId: "app", result: "FAILED", failedStep: "lint", errorSummary: "features/a.ts:12 fetch forbidden" },
    { ts: "2026-11-25T02:00:00Z", projectId: "app", result: "FAILED", failedStep: "lint", errorSummary: "features/a.ts:45 fetch forbidden" },
    { ts: "2026-11-25T03:00:00Z", projectId: "app", result: "PASSED", failedStep: null, errorSummary: null },
  ]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].count, 2);

  const trends = computeVerifyTrends([
    { ts: "2026-11-25T01:00:00Z", projectId: "app", result: "FAILED", durationMs: 200 },
    { ts: "2026-11-25T02:00:00Z", projectId: "app", result: "PASSED", durationMs: 400 },
  ]);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].passRate, 50);
  assert.equal(trends[0].avgDurationMs, 300);

  const diet = scanAgentsDiet(harnessRoot);
  assert.ok(diet.length >= 2);
  assert.equal(diet[0].status, "ok");

  const catalog = scanRulesCatalog(harnessRoot);
  assert.ok(catalog.bypassComments.length >= 3);
  assert.ok(catalog.appLayers.length === 4);

  const templates = scanTemplates(harnessRoot);
  assert.deepEqual(
    templates.map((t) => t.stack),
    ["flutter-app", "node-api", "react-ts"]
  );
});
