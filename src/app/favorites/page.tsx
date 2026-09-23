import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  await requireUser("/favorites");
  return <ComingSoon title="Mis favoritos" description="Aquí verás los productos que guardes." />;
}
