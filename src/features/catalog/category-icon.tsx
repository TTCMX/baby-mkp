import {
  Baby,
  Backpack,
  Bath,
  BedDouble,
  Car,
  Milk,
  MonitorSmartphone,
  Package,
  Puzzle,
  Shirt,
  type LucideIcon,
} from "lucide-react";

// `categories.icon` stores one of these keys so admins can pick an icon.
const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  car: Car,
  bed: BedDouble,
  milk: Milk,
  monitor: MonitorSmartphone,
  puzzle: Puzzle,
  shirt: Shirt,
  backpack: Backpack,
  bath: Bath,
  package: Package,
};

export function CategoryIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Package;
  return <Icon className={className} aria-hidden />;
}
