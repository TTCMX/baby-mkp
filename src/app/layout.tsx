import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
};

export const viewport: Viewport = {
  themeColor: "#fbf8f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" className={nunito.variable}>
      <body className="min-h-dvh font-sans">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-12">{children}</main>
        <MobileNav />
      </body>
    </html>
  );
}
