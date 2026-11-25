import { escapeHtml } from "../../core/formatters.js";
import { apiClient } from "../../platform/api-client.js";
import { openModal, renderBadge, renderLayerBar, renderTable } from "../../ui-kit/components.js";

function renderGitCell(git) {
  if (!git || !git.isGitRepo) {
    return renderBadge("Git 미초기화", "muted");
  }
  const branchBadge = renderBadge(git.branch || "detached", git.isWipBranch ? "warn" : "info");
  const dirtyBadge =
    git.dirtyCount > 0 ? renderBadge(`변경 ${git.dirtyCount}`, "warn") : renderBadge("clean", "ok");
  const hookBadge = git.preCommitHookInstalled
    ? renderBadge("hook ✅", "ok")
    : renderBadge("hook ⚠️", "warn");
  return `<div class="pill-list">${branchBadge}${dirtyBadge}${hookBadge}</div>`;
}

export async function renderProjectsView(container) {
  async function render() {
    const { projects } = await apiClient.getProjects();
    const rows = projects.map((p) => {
      const syncVariant = p.syncStatus === "synced" ? "ok" : "warn";
      const lastRes = p.lastVerify
        ? renderBadge(p.lastVerify.result, p.lastVerify.result === "PASSED" ? "ok" : "err")
        : renderBadge("NONE", "muted");
      const checklist = `${p.checklist.completed}/${p.checklist.total} (${p.checklist.percent}%)`;

      return `<tr>
        <td>
          <strong>${escapeHtml(p.id)}</strong><br/>
          <span style="font-size:11px;color:var(--muted)">${escapeHtml(p.stack)} · ${escapeHtml(p.kind)}</span>
        </td>
        <td>${renderGitCell(p.git)}</td>
        <td>${renderLayerBar(p.layers)}</td>
        <td>${renderBadge(p.syncStatus, syncVariant)}</td>
        <td>${lastRes}</td>
        <td>${escapeHtml(checklist)}</td>
        <td>
          <div class="pill-list">
            <button class="btn btn-sm proj-verify" data-id="${escapeHtml(p.id)}">Verify</button>
            <button class="btn btn-secondary btn-sm proj-sync" data-id="${escapeHtml(p.id)}">Sync</button>
          </div>
        </td>
      </tr>`;
    });

    container.innerHTML = renderTable(
      ["프로젝트", "Git / 훅 상태", "4계층 비중 (C/P/U/F)", "규칙 동기화", "최근 검증", "체크리스트", "CLI 실행"],
      rows,
      "등록된 프로젝트가 없습니다."
    );

    for (const btn of container.querySelectorAll(".proj-verify")) {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "실행 중...";
        try {
          const res = await apiClient.runVerify(id);
          const output = [res.stdout, res.stderr].filter(Boolean).join("\n");
          openModal(`harness verify ${id} (${res.ok ? "PASSED" : "FAILED"})`, output || "(출력 없음)");
          await render();
        } catch (err) {
          openModal(`harness verify ${id} 오류`, err.message);
          btn.disabled = false;
          btn.textContent = "Verify";
        }
      });
    }

    for (const btn of container.querySelectorAll(".proj-sync")) {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = "동기화 중...";
        try {
          const res = await apiClient.runSync(id);
          const output = [res.stdout, res.stderr].filter(Boolean).join("\n");
          openModal(`harness sync ${id} (${res.ok ? "OK" : "FAILED"})`, output || "(출력 없음)");
          await render();
        } catch (err) {
          openModal(`harness sync ${id} 오류`, err.message);
          btn.disabled = false;
          btn.textContent = "Sync";
        }
      });
    }
  }

  await render();
}
