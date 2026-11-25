import { escapeHtml } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import { openModal, renderBadge, renderTable } from "../../ui-kit/components.js";

export async function renderSkillsView(container) {
  const state = { scope: "", provider: "" };

  async function render() {
    const { skills } = await apiClient.getSkills(state);
    const filterBar = `
      <div class="card form-row">
        <select id="skill-scope">
          <option value="">전체 범위 (scope)</option>
          <option value="common" ${state.scope === "common" ? "selected" : ""}>common</option>
          <option value="project" ${state.scope === "project" ? "selected" : ""}>project</option>
        </select>
        <input id="skill-provider" placeholder="provider 필터 (예: local)" value="${escapeHtml(state.provider)}" />
        <button id="skill-filter-btn" class="btn">필터 적용</button>
      </div>
    `;

    const rows = skills.map((s) => {
      const overrideBadge = s.overridesCommon
        ? ` ${renderBadge("OVERRIDES common", "warn")}`
        : "";
      return `<tr>
        <td><strong>${escapeHtml(s.name)}</strong>${overrideBadge}</td>
        <td>${renderBadge(s.scope, s.scope === "common" ? "ok" : "muted")}</td>
        <td>${escapeHtml(s.provider)}</td>
        <td>${escapeHtml(s.projectId || "central")}</td>
        <td><code>${escapeHtml(s.filePath)}</code></td>
        <td><button class="btn btn-secondary btn-sm skill-preview" data-path="${escapeHtml(s.filePath)}" data-name="${escapeHtml(s.name)}">미리보기</button></td>
      </tr>`;
    });

    container.innerHTML =
      filterBar +
      renderTable(
        ["스킬명", "범위", "제공자", "프로젝트", "파일 경로", "내용"],
        rows,
        "스캔된 스킬이 없습니다."
      );

    container.querySelector("#skill-filter-btn").addEventListener("click", () => {
      state.scope = container.querySelector("#skill-scope").value;
      state.provider = container.querySelector("#skill-provider").value.trim();
      render();
    });

    for (const btn of container.querySelectorAll(".skill-preview")) {
      btn.addEventListener("click", async () => {
        try {
          const data = await apiClient.getSkillContent(btn.dataset.path);
          openModal(`스킬: ${btn.dataset.name} (${data.filePath})`, data.content);
        } catch (err) {
          openModal("스킬 미리보기 오류", err.message);
        }
      });
    }
  }

  await render();
}
