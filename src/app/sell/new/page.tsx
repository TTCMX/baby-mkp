import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AGE_STAGES, type AgeStage } from "@/lib/domain/constants";
import { track } from "@/lib/analytics/server";
import { SellWizard } from "@/features/listings/sell/sell-wizard";
import { loadWizardContext } from "@/features/listings/sell/load-wizard";

export const metadata: Metadata = { title: "Vender" };

export default async function NewListingPage({ searchParams }: PageProps<"/sell/new">) {
  const user = await requireUser("/sell/new");
  // "Vender lo de 3–6 meses" from the home pre-selects that stage.
  const { age } = await searchParams;
  const presetAge = typeof age === "string" && age in AGE_STAGES ? [age as AgeStage] : [];
  const context = await loadWizardContext(user);
  await track("listing_started", user.id);

  return (
    <SellWizard
      {...context}
      mode="new"
      userId={user.id}
      // Generated up front so photos can be uploaded under the listing's folder before it is saved.
      listingId={crypto.randomUUID()}
      initialPhotos={[]}
      initialFields={{
        title: "",
        description: "",
        categoryId: "",
        brand: "",
        model: "",
        condition: "",
        ageStages: presetAge,
        isBundle: false,
        bundleItemCount: "",
        price: "",
        city: user.profile.city ?? "",
        municipality: user.profile.municipality ?? "",
        deliveryMethods: ["pickup"],
        shippingPrice: "",
      }}
    />
  );
}
