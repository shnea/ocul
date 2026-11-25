import { escapeHtml, formatTimestamp } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import { renderTable } from "../../ui-kit/components.js";

export async function renderSecretsView(container) {
  async function render() {
    const { secrets } = await apiClient.getSecrets();
    const formHtml = `
      <div class="card">
        <div class="card-label">Git 외부 암호화 저장소 (~/.harness/secrets.enc, AES-256-GCM, 0600)</div>
        <form id="secret-form" class="form-row">
          <input id="sec-name" placeholder="키 이름 (예: OPENAI_API_KEY)" required />
          <input id="sec-project" placeholder="연결 프로젝트 (기본: central)" value="central" />
          <input id="sec-value" type="password" placeholder="시크릿 값" required />
          <button type="submit" class="btn">암호화 저장</button>
        </form>
      </div>
    `;

    const rows = secrets.map(
      (s) => `<tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.projectId)}</td>
        <td><code>${escapeHtml(s.maskedValue)}</code></td>
        <td>${escapeHtml(formatTimestamp(s.updatedAt))}</td>
        <td><button class="btn btn-danger sec-del" data-id="${escapeHtml(s.id)}">삭제</button></td>
      </tr>`
    );

    container.innerHTML =
      formHtml +
      renderTable(
        ["키 이름", "연결 프로젝트", "마스킹된 값", "수정 시각", "작업"],
        rows,
        "등록된 키가 없습니다."
      );

    container.querySelector("#secret-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = container.querySelector("#sec-name").value.trim();
      const projectId = container.querySelector("#sec-project").value.trim() || "central";
      const value = container.querySelector("#sec-value").value;
      await apiClient.createSecret({ name, projectId, value });
      await render();
    });

    for (const btn of container.querySelectorAll(".sec-del")) {
      btn.addEventListener("click", async () => {
        await apiClient.deleteSecret(btn.dataset.id);
        await render();
      });
    }
  }

  await render();
}
