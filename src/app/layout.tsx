import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  openGraph: { siteName: SITE_NAME, locale: "es_MX", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" className={`${nunito.variable} ${fredoka.variable}`}>
      <body className="min-h-dvh font-sans">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-12">{children}</main>
        <MobileNav />
        <SpeedInsights />
      </body>
    </html>
  );
}
