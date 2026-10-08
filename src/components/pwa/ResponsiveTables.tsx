"use client";
import { useEffect } from "react";
import { cardLabels, type HeaderCell } from "@/lib/pwa/tableCards";

/**
 * On a phone, wide tables become stacked cards (each value beside its column
 * heading) instead of scrolling sideways; the styles are in globals.css and
 * apply only below 640px. This labels every cell from its column heading, for
 * every table in the app at once, so no page needs rewriting. A table opts out
 * with data-table="scroll", and tables that cannot be read cleanly as cards
 * are left alone. On larger screens the tables are untouched.
 */
function enhance(table: HTMLTableElement) {
  if (table.dataset.table === "scroll" || table.closest('[data-table="scroll"]')) return;
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;
  const headers: HeaderCell[] = Array.from(headRow.cells).map((c) => ({ text: c.textContent ?? "", colSpan: c.colSpan }));
  const rows = Array.from(table.tBodies).flatMap((b) => Array.from(b.rows));
  for (const row of rows) {
    const cells = Array.from(row.cells);
    const labels = cardLabels(headers, cells.map((c) => c.colSpan));
    if (!labels) {
      table.dataset.cards = "false";
      return;
    }
    cells.forEach((c, i) => {
      if (c.dataset.label !== labels[i]) c.dataset.label = labels[i];
    });
  }
  table.dataset.cards = "true";
}

export default function ResponsiveTables() {
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 639px)");
    let observer: MutationObserver | null = null;
    let frame = 0;

    const run = () => {
      frame = 0;
      document.querySelectorAll("table").forEach((t) => enhance(t as HTMLTableElement));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(run);
    };
    const sync = () => {
      observer?.disconnect();
      observer = null;
      if (!phone.matches) return;
      run();
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
    };

    sync();
    phone.addEventListener("change", sync);
    return () => {
      phone.removeEventListener("change", sync);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
