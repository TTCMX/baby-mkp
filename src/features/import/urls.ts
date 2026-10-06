/** Admin-supplied links only; still, never let the server fetch internal addresses. */
export function isFetchableUrl(raw: string, allowPrivate = process.env.IMPORT_ALLOW_PRIVATE_URLS === "1"): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (allowPrivate) return true;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return !(
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    /^(127|10|0)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h === "::1" ||
    /^f[cd]/.test(h) ||
    /^fe80/.test(h)
  );
}
