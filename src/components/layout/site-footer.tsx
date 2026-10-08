import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const LINKS = [
  ["/ayuda", "Ayuda"],
  ["/terminos", "Términos y condiciones"],
  ["/privacidad", "Aviso de privacidad"],
] as const;

export function SiteFooter() {
  return (
    // Extra bottom space on phones: the bottom navigation covers the last 5rem.
    <footer className="border-t pb-28 pt-6 text-sm text-muted-foreground md:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Información" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="font-semibold hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
        <p>
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
      </div>
    </footer>
  );
}
