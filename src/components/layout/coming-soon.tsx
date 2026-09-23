import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Temporary placeholder for routes delivered in later stages. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
