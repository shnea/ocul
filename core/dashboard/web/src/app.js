import { renderDashboardView } from "./features/dashboard/view.js";
import { renderLogsView } from "./features/logs/view.js";
import { renderMcpView } from "./features/mcp/view.js";
import { renderProjectsView } from "./features/projects/view.js";
import { renderRulesView } from "./features/rules/view.js";
import { renderSecretsView } from "./features/secrets/view.js";
import { renderSkillsView } from "./features/skills/view.js";
import { apiClient } from "./platform/api-client.js";
import { bindModalClose, openModal } from "./ui-kit/components.js";

const VIEWS = {
  dashboard: { title: "대시보드", render: renderDashboardView },
  projects: { title: "프로젝트", render: renderProjectsView },
  rules: { title: "가드레일 / 템플릿", render: renderRulesView },
  skills: { title: "스킬", render: renderSkillsView },
  mcp: { title: "MCP / 플러그인", render: renderMcpView },
  logs: { title: "검증 로그", render: renderLogsView },
  secrets: { title: "키 연결 (Secrets)", render: renderSecretsView },
};

let activeTab = "dashboard";
const contentEl = document.getElementById("content");
const titleEl = document.getElementById("page-title");
const navEl = document.getElementById("nav");
const refreshBtn = document.getElementById("refresh-btn");
const syncAllBtn = document.getElementById("sync-all-btn");

bindModalClose();

async function loadTab(tab) {
  activeTab = tab;
  const view = VIEWS[tab] || VIEWS.dashboard;
  titleEl.textContent = view.title;
  for (const btn of navEl.querySelectorAll(".nav-item")) {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  }
  contentEl.innerHTML = `<div class="card">로딩 중...</div>`;
  try {
    await view.render(contentEl);
  } catch (err) {
    contentEl.innerHTML = `<div class="card" style="color: var(--err);">오류: ${err.message}</div>`;
  }
}

navEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  loadTab(btn.dataset.tab);
});

refreshBtn.addEventListener("click", () => loadTab(activeTab));

syncAllBtn.addEventListener("click", async () => {
  syncAllBtn.disabled = true;
  syncAllBtn.textContent = "동기화 중...";
  try {
    const res = await apiClient.runSync("--all");
    const output = [res.stdout, res.stderr].filter(Boolean).join("\n");
    openModal(`harness sync --all (${res.ok ? "OK" : "FAILED"})`, output || "(출력 없음)");
    await loadTab(activeTab);
  } catch (err) {
    openModal("harness sync --all 오류", err.message);
  } finally {
    syncAllBtn.disabled = false;
    syncAllBtn.textContent = "Sync All";
  }
});

loadTab(activeTab);
