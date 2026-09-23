import type { AgeStage, DeliveryMethod, ListingCondition, ListingStatus, ListingType } from "./constants";

// Row shapes of the tables used by the app. Replace with generated types
// (`npm run db:types`) once a Supabase project is linked.

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  municipality: string | null;
  role: "user" | "admin";
  status: "active" | "suspended";
  sales_count: number;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
};

export type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  allows_shipping: boolean;
};

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category_id: string;
  subcategory_id: string | null;
  brand: string | null;
  model: string | null;
  condition: ListingCondition;
  age_stages: AgeStage[];
  listing_type: ListingType;
  bundle_item_count: number | null;
  price_cents: number;
  currency: string;
  city: string;
  municipality: string | null;
  state: string | null;
  delivery_methods: DeliveryMethod[];
  shipping_price_cents: number | null;
  status: ListingStatus;
  view_count: number;
  favorite_count: number;
  published_at: string | null;
  created_at: string;
};
