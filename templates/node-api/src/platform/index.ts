import type { HealthReport } from "../core/index.ts";
import { buildHealthReport } from "../core/index.ts";

export function readSystemHealth(service: string): HealthReport {
  return buildHealthReport(service);
}
