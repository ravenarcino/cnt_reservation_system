"use client";

import { cn } from "@/lib/utils";

// "Received requests" strip above the admin ticket tables: one cell per
// status with its count and share, clickable to filter the table.

const ITEMS: { key: string; label: string; color: string }[] = [
  { key: "PENDING", label: "Pending", color: "#f59e0b" },
  { key: "FOR_REVIEW", label: "For review", color: "#f97316" },
  { key: "APPROVED", label: "Approved", color: "#10b981" },
  { key: "DONE", label: "Done", color: "#0ea5e9" },
  { key: "DECLINED", label: "Declined", color: "#ef4444" },
  { key: "CANCELLED", label: "Cancelled", color: "#a3a3a3" },
];

export function StatusSummary({
  statuses,
  active,
  onSelect,
}: {
  statuses: string[];
  active: string;
  onSelect: (status: string) => void;
}) {
  const total = statuses.length;
  const count = (key: string) =>
    statuses.filter((s) => s === key || (key === "PENDING" && s === "FOR_APPROVAL")).length;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border bg-neutral-50 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Received requests
        </p>
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={cn(
            "text-xs font-medium",
            active === "all" ? "text-muted-foreground" : "text-brand hover:underline",
          )}
        >
          {active === "all" ? `${total} total` : `Show all ${total}`}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {ITEMS.map((it) => {
          const n = count(it.key);
          const pct = total ? Math.round((n / total) * 100) : 0;
          const on = active === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onSelect(on ? "all" : it.key)}
              className={cn(
                "border-b border-r border-neutral-100 p-4 text-left transition-colors",
                on ? "bg-brand-soft" : "hover:bg-neutral-50",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
                <span className={cn("text-xs font-medium", on ? "text-brand" : "text-muted-foreground")}>
                  {it.label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{n}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: it.color }} />
                </div>
                <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
