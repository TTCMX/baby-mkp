import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/analytics/server";
import { SellWizard } from "@/features/listings/sell/sell-wizard";
import { loadWizardContext } from "@/features/listings/sell/load-wizard";

export const metadata: Metadata = { title: "Vender" };

export default async function NewListingPage() {
  const user = await requireUser("/sell/new");
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
        ageStages: [],
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
