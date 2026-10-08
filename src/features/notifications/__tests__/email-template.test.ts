import { describe, expect, it } from "vitest";
import { notificationEmail } from "../email-template";

const base = { siteUrl: "https://mercadito.baby", siteName: "mercadito.baby" };

describe("notificationEmail", () => {
  it("uses the title as subject and links to the notification target", () => {
    const e = notificationEmail({
      ...base,
      displayName: "Ana",
      title: "¡Vendiste!",
      body: "Carriola Nuna",
      link: "/orders/1",
    });
    expect(e.subject).toBe("¡Vendiste!");
    expect(e.html).toContain('href="https://mercadito.baby/orders/1"');
    expect(e.text).toContain("Hola, Ana:");
    expect(e.text).toContain("Ver detalle: https://mercadito.baby/orders/1");
  });

  it("escapes user-provided text", () => {
    const e = notificationEmail({
      ...base,
      displayName: "<b>x</b>",
      title: "T",
      body: 'Motivo: <script>"',
      link: null,
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;&quot;");
    expect(e.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("never links outside the site", () => {
    for (const link of ["https://evil.example", "//evil.example", null]) {
      const e = notificationEmail({ ...base, displayName: null, title: "T", body: null, link });
      expect(e.html).toContain('href="https://mercadito.baby/notifications"');
      expect(e.html).not.toContain("evil");
    }
  });
});
