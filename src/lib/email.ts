import "server-only";

// Transactional email through Resend's HTTP API (no SDK needed).
// RESEND_API_BASE points to a local fake in tests; never set it in production.

export type Email = { to: string; subject: string; html: string; text: string };

/**
 * EMAIL_FROM as Resend expects it ("Name <a@b.com>" or "a@b.com"), forgiving
 * what gets pasted into dashboards: surrounding quotes, spaces, a bare name+address.
 */
export function normalizeFrom(raw: string | undefined): string {
  const v = (raw ?? "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  const angle = v.match(/^(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>$/);
  if (angle) {
    const name = angle[1]
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .trim();
    return name ? `${name} <${angle[2]}>` : angle[2];
  }
  const bare = v.match(/^(.*?)\s*([^\s<>]+@[^\s<>]+)$/);
  if (bare) return bare[1].trim() ? `${bare[1].trim()} <${bare[2]}>` : bare[2];
  return v;
}

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && normalizeFrom(process.env.EMAIL_FROM));
}

export async function sendEmail(email: Email): Promise<void> {
  const res = await fetch(`${process.env.RESEND_API_BASE || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: normalizeFrom(process.env.EMAIL_FROM), ...email }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
