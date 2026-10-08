/**
 * Pure rule for turning a table into cards on a phone: each cell is shown
 * with its column heading beside it. Tables that cannot be cleanly read that
 * way (merged header cells, merged body cells, no headings at all) are left
 * as tables, which scroll sideways instead.
 */
export interface HeaderCell {
  text: string;
  colSpan: number;
}

/** The label for each body cell of one row, or null if this table should stay a table. */
export function cardLabels(headers: HeaderCell[], rowCells: number[]): string[] | null {
  if (headers.length === 0) return null;
  if (headers.some((h) => h.colSpan !== 1)) return null;
  if (rowCells.some((span) => span !== 1)) return null;
  if (rowCells.length > headers.length) return null;
  return rowCells.map((_, i) => headers[i].text.trim());
}
