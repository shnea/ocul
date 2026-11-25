// Pure domain model and business logic (0 external dependencies)
export interface AppStatus {
  projectId: string;
  healthy: boolean;
}

export function createInitialStatus(projectId: string): AppStatus {
  return { projectId, healthy: true };
}
