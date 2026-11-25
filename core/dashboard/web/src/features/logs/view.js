import { escapeHtml, formatDuration, formatTimestamp } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import { renderBadge, renderTable } from "../../ui-kit/components.js";

export async function renderLogsView(container) {
  const state = { projectId: "", result: "" };

  async function render() {
    const { logs } = await apiClient.getLogs(state);
    const filterBar = `
      <div class="card form-row">
        <input id="log-project" placeholder="프로젝트 ID 필터" value="${escapeHtml(state.projectId)}" />
        <select id="log-result">
          <option value="">전체 결과</option>
          <option value="PASSED" ${state.result === "PASSED" ? "selected" : ""}>PASSED</option>
          <option value="FAILED" ${state.result === "FAILED" ? "selected" : ""}>FAILED</option>
        </select>
        <button id="log-filter-btn" class="btn">조회</button>
      </div>
    `;

    const rows = logs.map(
      (l) => `<tr>
        <td>${escapeHtml(formatTimestamp(l.ts))}</td>
        <td>${escapeHtml(l.projectId)}</td>
        <td>${renderBadge(l.result, l.result === "PASSED" ? "ok" : "err")}</td>
        <td>${escapeHtml(l.failedStep || "-")}</td>
        <td>${escapeHtml(formatDuration(l.durationMs))}</td>
        <td>${escapeHtml(l.errorSummary || "-")}</td>
      </tr>`
    );

    container.innerHTML =
      filterBar +
      renderTable(
        ["시각", "프로젝트", "결과", "실패 단계", "소요 시간", "오류 요약"],
        rows,
        "조건에 맞는 검증 로그가 없습니다."
      );

    container.querySelector("#log-filter-btn").addEventListener("click", () => {
      state.projectId = container.querySelector("#log-project").value.trim();
      state.result = container.querySelector("#log-result").value;
      render();
    });
  }

  await render();
}
