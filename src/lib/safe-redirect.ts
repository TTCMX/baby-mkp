/**
 * Only allow same-origin relative paths as post-login destinations
 * (prevents open redirects such as `?next=https://evil.com` or `//evil.com`).
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
