// Platform layer: API, storage, OS, and third-party wrappers
import type { AppStatus } from "../core/index.ts";
import { createInitialStatus } from "../core/index.ts";

export async function fetchAppStatus(projectId: string): Promise<AppStatus> {
  return createInitialStatus(projectId);
}
