import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AGE_STAGES } from "@/lib/domain/constants";
import { BabyForm } from "@/features/babies/baby-form";
import { BabyList } from "@/features/babies/baby-list";
import { getMyBabies } from "@/features/babies/queries";
import { ageLabel, currentStage, todayInMexico } from "@/features/babies/stages";

export const metadata: Metadata = { title: "Mis bebés" };

export default async function BabiesPage() {
  await requireUser("/babies");
  const today = todayInMexico();
  const babies = await getMyBabies();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-[28px] font-bold">Mis bebés</h1>
        <p className="text-sm text-muted-foreground">
          Te mostramos productos de su etapa y te recordamos vender lo que ya les queda chico.
        </p>
      </div>

      {babies.length > 0 && (
        <BabyList
          today={today}
          babies={babies.map((b) => ({
            ...b,
            ageLabel: ageLabel(b, today),
            stageLabel: AGE_STAGES[currentStage(b, today)],
          }))}
        />
      )}

      {babies.length < 8 && (
        <section className="space-y-4 rounded-[22px] border-[1.5px] bg-card p-5">
          <h2 className="text-xl font-semibold">{babies.length ? "Agregar otro bebé" : "Agrega a tu bebé"}</h2>
          <BabyForm today={today} />
        </section>
      )}

      {babies.length > 0 && (
        <Link href="/" className="block text-center text-sm font-extrabold text-primary">
          Ver productos para su etapa →
        </Link>
      )}
    </div>
  );
}
