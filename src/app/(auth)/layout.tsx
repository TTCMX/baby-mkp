import { Card } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm py-6 md:py-12">
      <Card className="p-6">{children}</Card>
    </div>
  );
}
