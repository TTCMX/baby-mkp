import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  await requireUser("/messages");
  return <ComingSoon title="Mensajes" description="Aquí verás tus conversaciones con compradores y vendedores." />;
}
