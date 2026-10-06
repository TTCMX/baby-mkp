// Spreadsheet of a payout day's withdrawals, to prepare the SPEI transfers.

type Row = { holder_name: string; clabe: string; bank_name: string; amount_cents: number; id: string };

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function withdrawalsCsv(rows: Row[]): string {
  const header = ["Beneficiario", "CLABE", "Banco", "Monto", "Concepto", "Referencia"];
  const lines = rows.map((r) =>
    [r.holder_name, r.clabe, r.bank_name, (r.amount_cents / 100).toFixed(2), "Retiro mercadito.baby", r.id.slice(0, 8)]
      .map(cell)
      .join(","),
  );
  // BOM so spreadsheet apps read the accents as UTF-8.
  return "﻿" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
