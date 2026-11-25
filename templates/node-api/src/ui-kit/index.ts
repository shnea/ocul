export function formatJsonResponse<T>(data: T): string {
  return JSON.stringify({ data });
}
