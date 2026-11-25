// Shared UI kit components (low-level UI state/hooks allowed here)
export function renderBadge(label: string, ok: boolean): string {
  return `[${ok ? "OK" : "ERR"}] ${label}`;
}
