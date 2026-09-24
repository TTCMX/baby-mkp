import "server-only";
import type { SessionUser } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";
import { getActiveCategories, getBrandNames, getSellerSummary } from "../queries";
import type { WizardCategory } from "./sell-wizard";

/** Data every sell/edit wizard page needs. */
export async function loadWizardContext(user: SessionUser) {
  const [categories, brands, settings, seller] = await Promise.all([
    getActiveCategories(),
    getBrandNames(),
    getPlatformSettings(),
    getSellerSummary(user.id),
  ]);

  return {
    categories: categories.map<WizardCategory>((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      allows_shipping: c.allows_shipping,
    })),
    brands,
    maxImages: settings.max_images_per_listing,
    seller: {
      displayName: user.profile.display_name,
      avatarUrl: user.profile.avatar_url,
      salesCount: seller?.sales_count ?? 0,
      ratingAvg: seller?.rating_avg ?? null,
      ratingCount: seller?.rating_count ?? 0,
      activeListings: seller?.active_listings ?? 0,
    },
  };
}
