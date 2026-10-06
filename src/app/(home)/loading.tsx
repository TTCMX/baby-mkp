import { GridSkeleton } from "@/components/layout/skeletons";

// Only the home page: the route group keeps this boundary away from other routes.
export default function Loading() {
  return <GridSkeleton title={false} />;
}
