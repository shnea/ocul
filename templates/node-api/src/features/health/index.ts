import { readSystemHealth } from "../../platform/index.ts";
import { formatJsonResponse } from "../../ui-kit/index.ts";

export function handleHealthCheck(): string {
  return formatJsonResponse(readSystemHealth("{{PROJECT_ID}}"));
}
