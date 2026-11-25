import { escapeHtml } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import { renderBadge, renderTable } from "../../ui-kit/components.js";

export async function renderMcpView(container) {
  const { items } = await apiClient.getMcp();
  const rows = items.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.provider)}</td>
      <td>${renderBadge(item.enabled ? "ENABLED" : "DISABLED", item.enabled ? "ok" : "muted")}</td>
      <td>${escapeHtml(item.targetProject)}</td>
      <td><code>${escapeHtml(item.sourcePath)}</code></td>
    </tr>`
  );

  container.innerHTML = renderTable(
    ["이름", "제공자", "활성 상태", "연결 프로젝트", "설정 파일"],
    rows,
    "등록된 MCP / 플러그인 설정 파일(.harness/mcp.json 또는 .mcp.json)이 없습니다."
  );
}
