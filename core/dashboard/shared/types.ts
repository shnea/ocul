export type ProjectKind = "core" | "product";
export type ProjectStatus = "active" | "paused" | "archived";
export type VerifyResult = "PASSED" | "FAILED";

export interface ProjectRegistryEntry {
  id: string;
  kind: ProjectKind;
  path: string;
  stack: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface VerifyLogEntry {
  ts: string;
  projectId: string;
  result: VerifyResult;
  failedStep: string | null;
  durationMs: number;
  errorSummary: string | null;
}

export interface ProjectGitStatus {
  isGitRepo: boolean;
  branch: string | null;
  isWipBranch: boolean;
  dirtyCount: number;
  lastCommitAt: string | null;
  lastCommitSubject: string | null;
  preCommitHookInstalled: boolean;
}

export interface LayerDistribution {
  core: { files: number; lines: number };
  platform: { files: number; lines: number };
  "ui-kit": { files: number; lines: number };
  features: { files: number; lines: number };
  totalFiles: number;
  totalLines: number;
}

export interface ProjectSummary extends ProjectRegistryEntry {
  exists: boolean;
  syncStatus: "synced" | "out-of-sync" | "missing-lock";
  lastVerify: VerifyLogEntry | null;
  checklist: {
    completed: number;
    total: number;
    percent: number;
  };
  git: ProjectGitStatus;
  layers: LayerDistribution;
}

export interface SkillItem {
  name: string;
  scope: "common" | "project";
  provider: string;
  projectId: string | null;
  filePath: string;
  overridesCommon: boolean;
}

export interface McpPluginItem {
  name: string;
  provider: string;
  enabled: boolean;
  targetProject: string;
  sourcePath: string;
}

export interface SecretMetadata {
  id: string;
  name: string;
  projectId: string;
  maskedValue: string;
  updatedAt: string;
}

export interface AgentsDietItem {
  label: string;
  filePath: string;
  lines: number;
  limit: number;
  status: "ok" | "warning";
}

export interface TwoStrikeAlert {
  projectId: string;
  failedStep: string;
  errorPattern: string;
  count: number;
  lastSeen: string;
}

export interface TrendPoint {
  date: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avgDurationMs: number;
}

export interface DashboardOverview {
  totalProjects: number;
  passRate: number;
  syncWarnings: number;
  topFailedSteps: Array<{ step: string; count: number }>;
  recentLogs: VerifyLogEntry[];
  twoStrikeAlerts: TwoStrikeAlert[];
  agentsDiet: AgentsDietItem[];
  trends: TrendPoint[];
}

export interface RulesCatalog {
  bypassComments: Array<{ id: string; regex: string; message: string; fix: string }>;
  scopedRules: Array<{
    id: string;
    pathPattern: string;
    message: string;
    fix: string;
  }>;
  appLayers: Array<{
    layer: string;
    allowedTargets: string[];
    forbiddenExternal: string[];
    fix: string;
  }>;
  serverLayers: Array<{
    layer: string;
    allowedTargets: string[];
    forbiddenExternal: string[];
    fix: string;
  }>;
  dartRules: string[];
}

export interface TemplateInfo {
  stack: string;
  files: string[];
}

export interface CliActionResult {
  ok: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}
