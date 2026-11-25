import { escapeHtml, formatDuration } from "../core/formatters.js";

export function renderBadge(text, variant = "muted") {
  return `<span class="badge badge-${variant}">${escapeHtml(text)}</span>`;
}

export function renderStatCard(label, value) {
  return `
    <div class="card">
      <div class="card-label">${escapeHtml(label)}</div>
      <div class="card-value">${escapeHtml(value)}</div>
    </div>
  `;
}

export function renderTable(headers, rowsHtml, emptyText = "데이터가 없습니다.", title = "") {
  const titleHtml = title ? `<h3 class="card-title">${escapeHtml(title)}</h3>` : "";
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rowsHtml.length
    ? rowsHtml.join("")
    : `<tr><td colspan="${headers.length}" style="color: var(--muted);">${escapeHtml(emptyText)}</td></tr>`;
  return `<div class="card">${titleHtml}<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderLayerBar(layers) {
  if (!layers || layers.totalLines === 0) {
    return `<span class="layer-legend">코드 없음</span>`;
  }
  const pct = (n) => Math.max(0, Math.round((n / layers.totalLines) * 100));
  const c = pct(layers.core.lines);
  const p = pct(layers.platform.lines);
  const u = pct(layers["ui-kit"].lines);
  const f = Math.max(0, 100 - c - p - u);

  return `
    <div class="layer-bar" title="core ${c}% / platform ${p}% / ui-kit ${u}% / features ${f}%">
      <div class="layer-seg-core" style="width:${c}%"></div>
      <div class="layer-seg-platform" style="width:${p}%"></div>
      <div class="layer-seg-uikit" style="width:${u}%"></div>
      <div class="layer-seg-features" style="width:${f}%"></div>
    </div>
    <div class="layer-legend">C:${layers.core.files} P:${layers.platform.files} U:${layers["ui-kit"].files} F:${layers.features.files} (${layers.totalLines}L)</div>
  `;
}

export function renderTrendChart(trends) {
  if (!trends || trends.length === 0) {
    return `<div class="card"><h3 class="card-title">검증 통과율 / 소요 시간 추이</h3><div class="card-label">아직 집계할 로그가 없습니다.</div></div>`;
  }

  const width = 460;
  const height = 120;
  const barWidth = Math.max(18, Math.floor((width - 20) / trends.length) - 8);
  const bars = trends
    .map((pt, idx) => {
      const x = 10 + idx * (barWidth + 8);
      const barH = Math.max(6, Math.round((pt.passRate / 100) * (height - 34)));
      const y = height - 22 - barH;
      const fill = pt.passRate >= 80 ? "#2ecc71" : pt.passRate >= 50 ? "#f5b041" : "#ff5c5c";
      const label = pt.date.slice(5);
      return `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${fill}">
            <title>${escapeHtml(pt.date)}: ${pt.passRate}% (${pt.passed}/${pt.total}), 평균 ${formatDuration(pt.avgDurationMs)}</title>
          </rect>
          <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" fill="#e6eaf2" font-size="10">${pt.passRate}%</text>
          <text x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle" fill="#8b95a7" font-size="10">${escapeHtml(label)}</text>
        </g>
      `;
    })
    .join("");

  const latest = trends[trends.length - 1];
  return `
    <div class="card">
      <h3 class="card-title">검증 통과율 / 평균 소요 시간 추이</h3>
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${bars}</svg>
      <div class="card-label">최근(${escapeHtml(latest.date)}): 통과 ${latest.passed}/${latest.total}회 · 평균 ${escapeHtml(formatDuration(latest.avgDurationMs))}</div>
    </div>
  `;
}

export function openModal(title, text) {
  const root = document.getElementById("modal-root");
  const titleEl = document.getElementById("modal-title");
  const bodyEl = document.getElementById("modal-body");
  if (!root || !titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.textContent = text;
  root.classList.remove("hidden");
}

export function bindModalClose() {
  const root = document.getElementById("modal-root");
  const closeBtn = document.getElementById("modal-close");
  if (!root || !closeBtn) return;
  closeBtn.addEventListener("click", () => root.classList.add("hidden"));
  root.addEventListener("click", (e) => {
    if (e.target === root) root.classList.add("hidden");
  });
}
