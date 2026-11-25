export interface HealthReport {
  service: string;
  status: "ok";
}

export function buildHealthReport(service: string): HealthReport {
  return { service, status: "ok" };
}
