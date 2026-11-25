import { escapeHtml, formatDuration, formatTimestamp } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import {
  renderBadge,
  renderStatCard,
  renderTable,
  renderTrendChart,
} from "../../ui-kit/components.js";

export async function renderDashboardView(container) {
  const data = await apiClient.getDashboard();

  const twoStrikeHtml =
    data.twoStrikeAlerts && data.twoStrikeAlerts.length > 0
      ? `
      <div class="alert-banner">
        <h3>⚡ 투 스트라이크 감지 — 반복 실수 규칙 추가 검토 필요</h3>
        <ul>
          ${data.twoStrikeAlerts
            .map(
              (a) =>
                `<li><strong>${escapeHtml(a.projectId)}</strong> · <code>${escapeHtml(a.failedStep)}</code> 단계 ${a.count}회 반복 — ${escapeHtml(a.errorPattern)}</li>`
            )
            .join("")}
        </ul>
      </div>
    `
      : "";

  const cards = `
    <div class="grid">
      ${renderStatCard("전체 프로젝트", data.totalProjects)}
      ${renderStatCard("최근 Verify 통과율", `${data.passRate}%`)}
      ${renderStatCard("규칙 동기화 경고", data.syncWarnings)}
      ${renderStatCard("투 스트라이크 알림", (data.twoStrikeAlerts || []).length)}
    </div>
  `;

  const dietRows = (data.agentsDiet || [])
    .map((d) => {
      const badge = renderBadge(
        `${d.lines} / ${d.limit}줄`,
        d.status === "warning" ? "warn" : "ok"
      );
      return `<div class="diet-row">
        <div><strong>${escapeHtml(d.label)}</strong> <code style="color:var(--muted)">${escapeHtml(d.filePath)}</code></div>
        <div>${badge}</div>
      </div>`;
    })
    .join("");

  const dietCard = `
    <div class="card">
      <h3 class="card-title">📏 AGENTS.md 다이어트 모니터</h3>
      ${dietRows || '<div class="card-label">지침 파일 없음</div>'}
    </div>
  `;

  const middleGrid = `<div class="grid-2">${renderTrendChart(data.trends)}${dietCard}</div>`;

  const topFailsRows = data.topFailedSteps.map(
    (item) =>
      `<tr><td>${escapeHtml(item.step)}</td><td>${renderBadge(`${item.count}회`, "err")}</td></tr>`
  );
  const topFailsTable = renderTable(
    ["최다 실패 단계 (TOP 5)", "실패 횟수"],
    topFailsRows,
    "최근 실패 이력이 없습니다."
  );

  const recentRows = data.recentLogs.map((log) => {
    const badge = renderBadge(log.result, log.result === "PASSED" ? "ok" : "err");
    return `<tr>
      <td>${escapeHtml(formatTimestamp(log.ts))}</td>
      <td>${escapeHtml(log.projectId)}</td>
      <td>${badge}</td>
      <td>${escapeHtml(log.failedStep || "-")}</td>
      <td>${escapeHtml(formatDuration(log.durationMs))}</td>
      <td>${escapeHtml(log.errorSummary || "-")}</td>
    </tr>`;
  });
  const recentTable = renderTable(
    ["시각", "프로젝트", "결과", "실패 단계", "소요 시간", "요약"],
    recentRows,
    "검증 로그가 아직 없습니다. 'harness verify'를 실행하세요.",
    "최근 검증 이력"
  );

  container.innerHTML = twoStrikeHtml + cards + middleGrid + topFailsTable + recentTable;
}
