import { useMemo, useState } from "react";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

/**
 * Reusable table: sortable headers, optional search box, "Showing x to y of n
 * entries" and Prev / Page x of y / Next pagination.
 *
 *   <DataTable
 *     title="Search Details"
 *     columns={[
 *       { key: "name", label: "Employee Name", sortable: true },
 *       { key: "days", label: "NoOfDays", sortable: true, className: "tabular-nums" },
 *       { key: "edit", label: "Edit", render: (row) => <button…/> },
 *     ]}
 *     rows={rows} rowKey="id"
 *     searchKeys={["name"]} searchPlaceholder="Search By Name"
 *     rowClassName={(row) => (row.pending ? "bg-rustbg" : "")}
 *     pageSize={10}
 *   />
 *
 * Props also: compact (dense rows for modals), showSummary, pageSize, emptyText.
 * Column: key, label, sortable, render(row, index), sortValue(row), className, headerClassName.
 * `index` passed to render is the row's position in the full (sorted, filtered) list.
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = "id",
  title,
  searchKeys,
  searchPlaceholder = "Search",
  rowClassName,
  pageSize = 10,
  emptyText = "No records found.",
  showSummary = true,
  compact = false, // tighter rows + smaller text (e.g. inside modals)
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchKeys?.length || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.key]);
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      {(title || searchKeys?.length) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-line bg-primary/5">
          {title ? <div className="text-sm font-semibold text-ink">{title}</div> : <span />}
          <div className="flex items-center gap-3">
            {showSummary && (
              <span className="text-xs font-semibold text-ink">
                Showing {sorted.length ? start + 1 : 0} to {start + pageRows.length} of {sorted.length} entries
              </span>
            )}
            {searchKeys?.length > 0 && (
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-8 w-52 px-3 rounded-md border border-line bg-card text-ink text-sm"
              />
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={`w-full border-collapse ${compact ? "text-xs" : "text-sm"}`}>
          <thead>
            <tr className="bg-primary/10">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`text-left px-3 ${compact ? "py-1" : "py-2"} font-semibold text-primary border-b border-line whitespace-nowrap ${c.headerClassName || ""}`}
                  aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:underline">
                      {c.label}
                      {sort.key === c.key ? (
                        sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      ) : (
                        <ChevronsUpDown size={13} className="opacity-60" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`px-3 ${compact ? "py-3" : "py-8"} text-center text-slate`}>{emptyText}</td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={typeof rowKey === "function" ? rowKey(row) : row[rowKey]}
                  className={`border-b border-line last:border-b-0 ${rowClassName ? rowClassName(row) : "hover:bg-ivory/60"}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 ${compact ? "py-1" : "py-2.5"} text-ink ${c.className || ""}`}>
                      {c.render ? c.render(row, start + i) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-2 px-4 py-2.5 border-t border-line">
        <button
          type="button"
          className="h-8 px-3 rounded-md text-sm bg-line/70 text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          Prev
        </button>
        <span className="text-sm text-ink">Page {current} of {totalPages}</span>
        <button
          type="button"
          className="h-8 px-3 rounded-md text-sm bg-line/70 text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={current >= totalPages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
