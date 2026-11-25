import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";

export function getDefaultVaultDir() {
  return process.env.HARNESS_VAULT_DIR || path.join(os.homedir(), ".harness");
}

export function maskSecretValue(raw) {
  if (typeof raw !== "string" || raw.length === 0) return "****";
  if (raw.length <= 8) return `${raw.slice(0, 2)}****`;
  return `${raw.slice(0, 3)}****${raw.slice(-4)}`;
}

function ensureVaultKey(vaultDir) {
  fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
  if (process.env.HARNESS_VAULT_KEY) {
    return crypto.createHash("sha256").update(process.env.HARNESS_VAULT_KEY).digest();
  }
  const keyPath = path.join(vaultDir, ".vault.key");
  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, generated.toString("hex") + "\n", { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
  return generated;
}

function encryptPayload(payloadObj, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payloadObj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    data: encrypted.toString("hex"),
  });
}

function decryptPayload(rawJson, key) {
  const parsed = JSON.parse(rawJson);
  const iv = Buffer.from(parsed.iv, "hex");
  const tag = Buffer.from(parsed.tag, "hex");
  const encrypted = Buffer.from(parsed.data, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

function readRawVault(vaultDir) {
  const secretsPath = path.join(vaultDir, "secrets.enc");
  if (!fs.existsSync(secretsPath)) {
    return { version: 1, secrets: [] };
  }
  const key = ensureVaultKey(vaultDir);
  const raw = fs.readFileSync(secretsPath, "utf8");
  return decryptPayload(raw, key);
}

function writeRawVault(vaultDir, payload) {
  const key = ensureVaultKey(vaultDir);
  const secretsPath = path.join(vaultDir, "secrets.enc");
  const encrypted = encryptPayload(payload, key);
  fs.writeFileSync(secretsPath, encrypted, { mode: 0o600 });
  fs.chmodSync(secretsPath, 0o600);
}

export function listSecrets(vaultDir = getDefaultVaultDir()) {
  const vault = readRawVault(vaultDir);
  // STRICT SECURITY: Never return raw secret values; return masked values + metadata only
  return (vault.secrets || []).map((s) => ({
    id: s.id,
    name: s.name,
    projectId: s.projectId,
    maskedValue: maskSecretValue(s.value),
    updatedAt: s.updatedAt,
  }));
}

export function upsertSecret({ id, name, projectId, value }, vaultDir = getDefaultVaultDir()) {
  if (!name || !value) {
    throw new Error("Both 'name' and 'value' are required.");
  }
  const vault = readRawVault(vaultDir);
  const now = new Date().toISOString();
  const targetId = id || crypto.randomUUID();
  const idx = vault.secrets.findIndex((s) => s.id === targetId);
  const record = {
    id: targetId,
    name: String(name).trim(),
    projectId: String(projectId || "central").trim(),
    value: String(value),
    updatedAt: now,
  };

  if (idx >= 0) {
    vault.secrets[idx] = record;
  } else {
    vault.secrets.push(record);
  }
  writeRawVault(vaultDir, vault);

  return {
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    maskedValue: maskSecretValue(record.value),
    updatedAt: record.updatedAt,
  };
}

export function deleteSecret(id, vaultDir = getDefaultVaultDir()) {
  const vault = readRawVault(vaultDir);
  const before = vault.secrets.length;
  vault.secrets = vault.secrets.filter((s) => s.id !== id);
  if (vault.secrets.length === before) return false;
  writeRawVault(vaultDir, vault);
  return true;
}
