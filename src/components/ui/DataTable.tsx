"use client";
import { useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { SkeletonList, SkeletonTableRows } from "@/components/ui/Skeleton";

/**
 * The shared data table. Replaces eight hand-built tables with static
 * headers. Adds what a table needs once it holds more than a screenful:
 * click-to-sort headers (announced through aria-sort), a search box,
 * paging with a live "Showing x to y of n" summary, tabular numerals,
 * and below 640px a stacked-card layout instead of a sideways scroll.
 *
 * Columns declare how to show a cell (`render`) and, optionally, how to
 * order it (`sortValue`). A column with an empty header is treated as
 * an actions column: not sortable, and shown without a label in the
 * card layout. Rows are filtered by `searchText` when it is provided.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
  /** Extra classes for the cell, e.g. "font-mono text-xs". */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  /** Visually hidden table name for assistive tech. */
  caption: string;
  searchText?: (row: T) => string;
  searchLabel?: string;
  pageSize?: number;
  /** Shown when `rows` is an empty array. */
  empty?: React.ReactNode;
}

type SortDir = "asc" | "desc";

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  searchText,
  searchLabel = "Search",
  pageSize = 15,
  empty,
}: DataTableProps<T>) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [page, setPage] = useState(0);

  const visible = useMemo(() => {
    if (!rows) return [];
    let out = rows;
    const q = query.trim().toLowerCase();
    if (q && searchText) out = out.filter((r) => searchText(r).toLowerCase().includes(q));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const get = col.sortValue;
        const factor = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          if (av === bv) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
          return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * factor;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchText]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const first = visible.length === 0 ? 0 : safePage * pageSize + 1;
  const last = Math.min(visible.length, (safePage + 1) * pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  if (rows && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div>
      {searchText && rows && rows.length > 0 && (
        <div className="relative mb-3 max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            {searchLabel}
          </label>
          <Icon icon={Search} size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchLabel}
            className="w-full rounded-lg border border-brand-gray bg-brand-surface py-2 pl-9 pr-3 text-sm text-brand-ink outline-none focus:border-brand-teal"
          />
        </div>
      )}

      {/* Tablet and desktop: a real table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-brand-gray text-xs uppercase tracking-wide text-gray-600">
              {columns.map((c) => {
                const sortable = !!c.sortValue && c.header !== "";
                const active = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (active === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined}
                    className={`py-2 pr-4 font-semibold ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-brand-teal"
                      >
                        {c.header}
                        <Icon icon={active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown} size="sm" />
                      </button>
                    ) : (
                      c.header || <span className="sr-only">Actions</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <SkeletonTableRows rows={4} cols={columns.length} />
            ) : (
              pageRows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-gray-100 align-top">
                  {columns.map((c) => (
                    <td key={c.key} className={`py-2.5 pr-4 ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per row. */}
      <div className="sm:hidden">
        {rows === null ? (
          <SkeletonList rows={3} />
        ) : (
          <ul className="space-y-3">
            {pageRows.map((row) => {
              const [titleCol, ...rest] = columns;
              return (
                <li key={rowKey(row)} className="rounded-xl border border-brand-gray bg-brand-surface p-4">
                  <div className="font-semibold text-brand-ink">{titleCol.render(row)}</div>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    {rest.map((c) =>
                      c.header ? (
                        <div key={c.key} className="flex items-start justify-between gap-3">
                          <dt className="text-gray-600">{c.header}</dt>
                          <dd className={`text-right ${c.className ?? ""}`}>{c.render(row)}</dd>
                        </div>
                      ) : (
                        <div key={c.key} className="pt-1">
                          {c.render(row)}
                        </div>
                      )
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rows && visible.length === 0 && rows.length > 0 && (
        <p className="py-6 text-center text-sm text-gray-600">Nothing matches &ldquo;{query}&rdquo;.</p>
      )}

      {rows && visible.length > pageSize && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-600">
          <p aria-live="polite">
            Showing {first} to {last} of {visible.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-teal disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-teal disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
