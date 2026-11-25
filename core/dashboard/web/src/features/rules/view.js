import { escapeHtml } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import { renderBadge, renderTable } from "../../ui-kit/components.js";

export async function renderRulesView(container) {
  const [rules, tplData] = await Promise.all([apiClient.getRules(), apiClient.getTemplates()]);

  const bypassRows = (rules.bypassComments || []).map(
    (r) => `<tr>
      <td><code>${escapeHtml(r.id)}</code></td>
      <td><code>${escapeHtml(r.regex)}</code></td>
      <td>${escapeHtml(r.message)}</td>
      <td>${escapeHtml(r.fix)}</td>
    </tr>`
  );

  const scopedRows = (rules.scopedRules || []).map(
    (r) => `<tr>
      <td><code>${escapeHtml(r.id)}</code></td>
      <td><code>${escapeHtml(r.pathPattern)}</code></td>
      <td>${escapeHtml(r.message)}</td>
      <td>${escapeHtml(r.fix)}</td>
    </tr>`
  );

  const boundaryRows = [
    ...(rules.appLayers || []).map((l) => ({ kind: "4계층", ...l })),
    ...(rules.serverLayers || []).map((l) => ({ kind: "서버 3계층", ...l })),
  ].map(
    (l) => `<tr>
      <td>${renderBadge(l.kind, l.kind === "4계층" ? "info" : "warn")}</td>
      <td><strong>${escapeHtml(l.layer)}/</strong></td>
      <td>${escapeHtml(l.allowedTargets.join(", ") || "-")}</td>
      <td>${escapeHtml(l.forbiddenExternal.join(", ") || "-")}</td>
      <td>${escapeHtml(l.fix)}</td>
    </tr>`
  );

  const dartCard = `
    <div class="card">
      <h3 class="card-title">🎯 Flutter / Dart 활성 린트 규칙 (${(rules.dartRules || []).length}개)</h3>
      <div class="pill-list">
        ${(rules.dartRules || []).map((r) => renderBadge(r, "muted")).join("")}
      </div>
    </div>
  `;

  const templatesHtml = `
    <div class="card">
      <h3 class="card-title">📦 스택별 골든 패스 템플릿 (templates/)</h3>
      <div class="grid">
        ${(tplData.templates || [])
          .map(
            (t) => `<div class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${escapeHtml(t.stack)}</strong>
                ${renderBadge(`${t.files.length} files`, "info")}
              </div>
              <ul class="file-list">
                ${t.files.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join("")}
              </ul>
            </div>`
          )
          .join("")}
      </div>
    </div>
  `;

  container.innerHTML =
    renderTable(
      ["규칙 ID", "차단 패턴", "에러 메시지", "Fix 안내"],
      bypassRows,
      "등록된 우회 주석 규칙이 없습니다.",
      "🛡️ 우회 주석 차단 규칙 (SSOT)"
    ) +
    renderTable(
      ["규칙 ID", "적용 경로", "에러 메시지", "Fix 안내"],
      scopedRows,
      "등록된 금지 API 규칙이 없습니다.",
      "🚫 구역별 금지 API 규칙 (features / server/routes)"
    ) +
    renderTable(
      ["구분", "계층", "허용 대상", "금지 외부 모듈", "Fix 안내"],
      boundaryRows,
      "등록된 계층 경계 규칙이 없습니다.",
      "🧱 아키텍처 계층 경계 규칙"
    ) +
    dartCard +
    templatesHtml;
}
