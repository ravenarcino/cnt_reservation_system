"use client";

import { cn } from "@/lib/utils";

// Shared bits for the management pages (Users, Items, Halls, Vehicles,
// Drivers): a clickable summary strip, role/status chips and a page header
// with a count.

export type StripItem = { key: string; label: string; count: number; color?: string };

// Row of counts at the top of a list; clicking one filters the list.
export function FilterStrip({
  title,
  items,
  active,
  onSelect,
  total,
}: {
  title: string;
  items: StripItem[];
  active: string;
  onSelect: (key: string) => void;
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border bg-neutral-50 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={cn("text-xs font-medium", active === "all" ? "text-muted-foreground" : "text-brand hover:underline")}
        >
          {active === "all" ? `${total} total` : `Show all ${total}`}
        </button>
      </div>
      <div className={cn("grid grid-cols-2 sm:grid-cols-3", items.length >= 6 ? "lg:grid-cols-6" : items.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        {items.map((it) => {
          const on = active === it.key;
          const pct = total ? Math.round((it.count / total) * 100) : 0;
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
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color ?? "#a3a3a3" }} />
                <span className={cn("truncate text-xs font-medium", on ? "text-brand" : "text-muted-foreground")}>
                  {it.label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{it.count}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: it.color ?? "#a3a3a3" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const ROLE_META: Record<string, { label: string; color: string; chip: string; hint: string }> = {
  USER: { label: "User", color: "#a3a3a3", chip: "bg-neutral-100 text-neutral-700 ring-neutral-200", hint: "Books halls and OB trips for themselves." },
  HALL_ADMIN: { label: "Hall Admin", color: "#0ea5e9", chip: "bg-sky-50 text-sky-800 ring-sky-200", hint: "Approves hall reservations, manages halls and the hall calendar." },
  OB_ADMIN: { label: "OB Admin", color: "#f59e0b", chip: "bg-amber-50 text-amber-800 ring-amber-200", hint: "Approves OB trips, manages vehicles, drivers and day offs." },
  DRIVER: { label: "Driver", color: "#10b981", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", hint: "Sees assigned trips and files day offs." },
  IT_ADMIN: { label: "IT Admin", color: "#8b5cf6", chip: "bg-violet-50 text-violet-800 ring-violet-200", hint: "Full admin access, including user accounts." },
  SUPER_ADMIN: { label: "Super Admin", color: "#dc2626", chip: "bg-red-50 text-red-700 ring-red-200", hint: "Full access to everything." },
};

export function RoleChip({ role }: { role: string }) {
  const m = ROLE_META[role] ?? ROLE_META.USER;
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", m.chip)}>
      {m.label}
    </span>
  );
}

export function AccountStatus({ status }: { status: string }) {
  const active = status === "REGISTERED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-amber-500")} />
      {active ? "Active" : "Pending activation"}
    </span>
  );
}

// Segmented two/three-way switch, e.g. Active / Pending.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-md border border-border bg-neutral-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-white text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Today's status (from lib/ob-today) as a pill. `tone` is the text colour
// class that function returns.
export function TodayPill({ label, tone }: { label: string; tone: string }) {
  const style = tone.includes("red")
    ? "bg-red-50 text-red-700 ring-red-200"
    : tone.includes("amber")
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  const dot = tone.includes("red") ? "bg-red-500" : tone.includes("amber") ? "bg-amber-500" : "bg-emerald-500";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

// Page title with a count badge and action buttons on the right.
export function PageHeader({
  title,
  count,
  subtitle,
  children,
}: {
  title: string;
  count?: number;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="page-title flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-sans text-sm font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-col gap-2 sm:flex-row">{children}</div>}
    </div>
  );
}
