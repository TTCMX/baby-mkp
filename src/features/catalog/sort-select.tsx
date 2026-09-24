"use client";

import { useRouter } from "next/navigation";
import { SORTS, filtersToQuery, type CatalogFilters, type Sort } from "./filters";

export function SortSelect({ filters, basePath }: { filters: CatalogFilters; basePath: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Ordenar"
      value={filters.sort}
      onChange={(e) => router.push(basePath + filtersToQuery({ ...filters, sort: e.target.value as Sort, page: 1 }))}
      className="h-9 rounded-full border border-input bg-card px-3 text-sm font-semibold"
    >
      {Object.entries(SORTS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
