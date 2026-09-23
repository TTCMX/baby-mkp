import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/domain/types";

export type SessionUser = { id: string; email: string | null; profile: Profile };

/** Current user + public profile, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", claims.sub).maybeSingle<Profile>();
  if (!profile) return null;

  return { id: claims.sub, email: (claims.email as string | undefined) ?? null, profile };
});

/** Use at the top of protected pages and every mutating Server Action. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  if (user.profile.status !== "active") redirect("/suspended");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.profile.role !== "admin") redirect("/");
  return user;
}
