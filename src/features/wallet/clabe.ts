// Pure helpers for withdrawals (shared by client forms and server actions).

const WEIGHTS = [3, 7, 1];

/** CLABE: 18 digits whose last one is a check digit (weights 3, 7, 1). Mirrors `is_valid_clabe` in SQL. */
export function isValidClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (Number(clabe[i]) * WEIGHTS[i % 3]) % 10;
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}

/** Digits only, so people can paste "002 180 0012…" or with dashes. */
export function cleanClabe(input: string): string {
  return input.replace(/\D/g, "");
}

// First 3 digits of a CLABE = bank (Banxico codes). Only a suggestion: the
// seller can always type the bank name.
const BANKS: Record<string, string> = {
  "002": "Banamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "030": "BanBajío",
  "036": "Inbursa",
  "044": "Scotiabank",
  "058": "Banregio",
  "062": "Afirme",
  "072": "Banorte",
  "127": "Banco Azteca",
  "137": "BanCoppel",
  "638": "Nu México",
  "646": "STP",
  "722": "Mercado Pago",
};

export function bankFromClabe(clabe: string): string | null {
  return clabe.length >= 3 ? (BANKS[clabe.slice(0, 3)] ?? null) : null;
}

/** "•••• 7896" — enough for people to recognise their account. */
export function maskClabe(clabe: string): string {
  return `•••• ${clabe.slice(-4)}`;
}

/**
 * Tuesday a withdrawal requested on `day` (Mexico City date, YYYY-MM-DD) is paid:
 * requests up to Friday are paid the following Tuesday. Mirrors `withdrawal_payout_date`.
 */
export function payoutDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const isoDow = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + ((5 - isoDow + 7) % 7) + 4);
  return date.toISOString().slice(0, 10);
}
