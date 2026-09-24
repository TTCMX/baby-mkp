import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { listingPhotoUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { coverOf, getMyOrders } from "@/features/orders/queries";
import { ORDER_STATUS } from "@/features/orders/status";

export const metadata: Metadata = { title: "Mis pedidos" };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser("/orders");
  const tab = (await searchParams).tab === "sales" ? "sales" : "purchases";
  const orders = await getMyOrders(user.id, tab === "sales" ? "seller" : "buyer");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-extrabold">Mis pedidos</h1>
      <nav className="flex gap-2">
        {(
          [
            ["purchases", "Compras"],
            ["sales", "Ventas"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "sales" ? "/orders?tab=sales" : "/orders"}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold",
              tab === key ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {tab === "sales" ? "Aún no has vendido nada." : "Aún no has comprado nada."}
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {orders.map((o) => {
            const cover = coverOf(o);
            const status = ORDER_STATUS[o.status];
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex gap-3 p-3 hover:bg-muted/50">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listingPhotoUrl(cover, "thumb")}
                      alt=""
                      className="size-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <ImageOff className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="line-clamp-1 text-sm font-bold">{o.order_items[0]?.title}</p>
                    <p className="text-sm font-extrabold">
                      {formatPrice(tab === "sales" ? o.seller_net_cents : o.total_cents, o.currency)}
                      {tab === "sales" && <span className="font-normal text-muted-foreground"> para ti</span>}
                    </p>
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", status.tone)}>
                      {status.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
