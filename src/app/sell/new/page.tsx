import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth";

export default async function Page() {
  await requireUser("/sell/new");
  return <ComingSoon title="Vender" description="Aquí podrás publicar tu producto con fotos en un par de minutos." />;
}
