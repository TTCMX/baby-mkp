import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BabyColor = "sky" | "pink" | "sun";
export type Baby = {
  id: string;
  name: string;
  birth_date: string | null;
  due_date: string | null;
  color: BabyColor;
};

/** The signed-in parent's babies (RLS: own rows only). */
export async function getMyBabies(): Promise<Baby[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("babies")
    .select("id, name, birth_date, due_date, color")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Baby[];
}
