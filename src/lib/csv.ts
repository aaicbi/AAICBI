/**
 * Minimal CSV writer for downloads. Quotes cells that need it and
 * defuses spreadsheet formula injection: a cell that starts with =, +, -
 * or @ would be run as a formula by Excel or Sheets, so it is prefixed
 * with an apostrophe. Names and course titles come from users.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
