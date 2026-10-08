// Email version of an in-app notification (pure: unit-tested).

export type NotificationEmailInput = {
  displayName: string | null;
  title: string;
  body: string | null;
  link: string | null;
  siteUrl: string;
  siteName: string;
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function notificationEmail({ displayName, title, body, link, siteUrl, siteName }: NotificationEmailInput) {
  // Only links inside the site: a notification never sends people elsewhere.
  const url = `${siteUrl}${link?.startsWith("/") && !link.startsWith("//") ? link : "/notifications"}`;
  const hello = displayName ? `Hola, ${displayName}:` : "Hola:";
  const settingsUrl = `${siteUrl}/notifications`;

  const text = [hello, "", title, ...(body ? [body] : []), "", `Ver detalle: ${url}`, "", `— ${siteName}`].join("\n");

  const html = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title></head>
<body style="margin:0;background:#f7fbff;font-family:Nunito,Helvetica,Arial,sans-serif;color:#1f2a44">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:28px">
        <tr><td style="font-size:18px;font-weight:700;color:#286eb2;padding-bottom:16px">${escape(siteName)}</td></tr>
        <tr><td style="font-size:15px;padding-bottom:8px">${escape(hello)}</td></tr>
        <tr><td style="font-size:20px;font-weight:700;padding-bottom:8px">${escape(title)}</td></tr>
        ${body ? `<tr><td style="font-size:15px;line-height:1.5;padding-bottom:20px">${escape(body)}</td></tr>` : ""}
        <tr><td style="padding-bottom:8px">
          <a href="${escape(url)}" style="display:inline-block;background:#ff6f9c;color:#1f2a44;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">Ver detalle</a>
        </td></tr>
      </table>
      <p style="font-size:12px;color:#616a83;max-width:520px;margin:16px auto 0">
        Recibes este correo por la actividad de tu cuenta en ${escape(siteName)}.
        Todos tus avisos están en <a href="${escape(settingsUrl)}" style="color:#286eb2">${escape(settingsUrl.replace(/^https?:\/\//, ""))}</a>.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject: title, html, text };
}
