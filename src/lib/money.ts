const formatters = new Map<string, Intl.NumberFormat>();

/** 450000 → "$4,500" (MXN, no decimals when whole). */
export function formatPrice(cents: number, currency = "MXN"): string {
  const whole = cents % 100 === 0;
  const key = `${currency}-${whole}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, fmt);
  }
  return fmt.format(cents / 100);
}

/** "4,500.50" | "4500" → 450050 | 450000. Returns null for invalid input. */
export function parsePriceToCents(input: string): number | null {
  const normalized = input.replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
