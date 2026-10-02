const payoutFmt = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "martes 13 de octubre" for a YYYY-MM-DD payout date (a calendar date: no timezone shift). */
export function formatPayoutDate(date: string): string {
  const parts = Object.fromEntries(
    payoutFmt.formatToParts(new Date(`${date}T12:00:00Z`)).map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} de ${parts.month}`;
}
