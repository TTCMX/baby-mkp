import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WalletEntry = {
  id: string;
  kind:
    | "sale"
    | "sale_reversal"
    | "purchase"
    | "purchase_release"
    | "refund"
    | "withdrawal"
    | "withdrawal_reversal"
    | "adjustment";
  amount_cents: number;
  balance_after_cents: number;
  order_id: string | null;
  withdrawal_id: string | null;
  note: string | null;
  created_at: string;
};

export type Withdrawal = {
  id: string;
  amount_cents: number;
  status: "requested" | "paid" | "failed";
  payout_date: string;
  clabe: string;
  bank_name: string;
  failure_reason: string | null;
  created_at: string;
};

export type BankAccount = { clabe: string; holder_name: string; bank_name: string };

/** Current balance of the signed-in user (0 before their first movement). RLS: own wallet only. */
export async function getMyBalance(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("wallets").select("balance_cents").eq("user_id", userId).maybeSingle();
  return data?.balance_cents ?? 0;
}

export async function getMyWallet(userId: string) {
  const supabase = await createClient();
  const [balance, entries, withdrawals, account] = await Promise.all([
    getMyBalance(userId),
    supabase
      .from("wallet_entries")
      .select("id, kind, amount_cents, balance_after_cents, order_id, withdrawal_id, note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("withdrawals")
      .select("id, amount_cents, status, payout_date, clabe, bank_name, failure_reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("bank_accounts").select("clabe, holder_name, bank_name").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    balance,
    entries: (entries.data ?? []) as WalletEntry[],
    withdrawals: (withdrawals.data ?? []) as Withdrawal[],
    account: (account.data ?? null) as BankAccount | null,
  };
}
