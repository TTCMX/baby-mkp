import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryMethod, OrderStatus } from "@/lib/domain/constants";

export type OrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  status: OrderStatus;
  delivery_method: DeliveryMethod;
  shipping_address: Record<string, string> | null;
  currency: string;
  item_price_cents: number;
  shipping_cents: number;
  total_cents: number;
  commission_percentage: number;
  platform_commission_cents: number;
  seller_net_cents: number;
  paid_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  order_items: { title: string; price_cents: number }[];
  listing: { id: string; listing_images: { storage_path: string; position: number }[] } | null;
};

const ORDER_COLUMNS =
  "*, order_items(title, price_cents), listing:listings(id, listing_images(storage_path, position))";

/** Orders where the user is buyer or seller (RLS enforces participation). */
export async function getMyOrders(userId: string, role: "buyer" | "seller"): Promise<OrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq(role === "buyer" ? "buyer_id" : "seller_id", userId)
    // Abandoned checkouts are noise for users.
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getOrder(id: string): Promise<(OrderRow & { buyer_name: string; seller_name: string }) | null> {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle<OrderRow>();
  if (!order) return null;
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [order.buyer_id, order.seller_id]);
  const name = (uid: string) => people?.find((p) => p.id === uid)?.display_name ?? "Usuario";
  return { ...order, buyer_name: name(order.buyer_id), seller_name: name(order.seller_id) };
}

export function coverOf(order: OrderRow) {
  return [...(order.listing?.listing_images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null;
}
