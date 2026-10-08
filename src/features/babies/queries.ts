import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BabyColor = "sky" | "pink" | "sun";
/** Null = "Todos": show items for girls and boys. */
export type BabyGender = "girl" | "boy" | null;
export type Baby = {
  id: string;
  name: string;
  birth_date: string | null;
  due_date: string | null;
  color: BabyColor;
  gender: BabyGender;
};

/** The signed-in parent's babies (RLS: own rows only). */
export async function getMyBabies(): Promise<Baby[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("babies")
    .select("id, name, birth_date, due_date, color, gender")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Baby[];
}
