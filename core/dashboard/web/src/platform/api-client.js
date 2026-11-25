// Platform layer: all HTTP fetch() calls are strictly isolated here.

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const apiClient = {
  getDashboard: () => requestJson("/api/dashboard"),
  getProjects: () => requestJson("/api/projects"),
  getRules: () => requestJson("/api/rules"),
  getTemplates: () => requestJson("/api/templates"),
  getSkills: (params = {}) => {
    const q = new URLSearchParams();
    if (params.scope) q.set("scope", params.scope);
    if (params.provider) q.set("provider", params.provider);
    const suffix = q.toString() ? `?${q}` : "";
    return requestJson(`/api/skills${suffix}`);
  },
  getSkillContent: (filePath) =>
    requestJson(`/api/skills/content?path=${encodeURIComponent(filePath)}`),
  getMcp: () => requestJson("/api/mcp"),
  getLogs: (params = {}) => {
    const q = new URLSearchParams();
    if (params.projectId) q.set("projectId", params.projectId);
    if (params.result) q.set("result", params.result);
    const suffix = q.toString() ? `?${q}` : "";
    return requestJson(`/api/logs${suffix}`);
  },
  runVerify: (projectId) =>
    requestJson("/api/actions/verify", {
      method: "POST",
      body: JSON.stringify({ projectId }),
    }),
  runSync: (projectId = "--all") =>
    requestJson("/api/actions/sync", {
      method: "POST",
      body: JSON.stringify({ projectId }),
    }),
  getSecrets: () => requestJson("/api/secrets"),
  createSecret: (payload) =>
    requestJson("/api/secrets", { method: "POST", body: JSON.stringify(payload) }),
  deleteSecret: (id) =>
    requestJson(`/api/secrets/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
