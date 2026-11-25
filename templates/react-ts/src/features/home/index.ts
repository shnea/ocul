// Feature layer: main agent workspace (strictest guardrails)
import { renderBadge } from "../../ui-kit/index.ts";
import { fetchAppStatus } from "../../platform/index.ts";

export async function loadHomeBanner(): Promise<string> {
  const status = await fetchAppStatus("{{PROJECT_ID}}");
  return renderBadge(status.projectId, status.healthy);
}
