// Minimal RFC 4180 CSV reader for spreadsheet exports: quoted cells with commas,
// quotes ("") and line breaks, CRLF, a UTF-8 BOM, and the delimiter Excel uses
// in Spanish locales (";") or a tab.

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const unquoted = firstLine.replace(/"[^"]*"/g, "");
  const [best, count] = [",", ";", "\t"]
    .map((d) => [d, unquoted.split(d).length - 1] as const)
    .sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop blank lines (e.g. trailing ones or rows of empty cells).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
