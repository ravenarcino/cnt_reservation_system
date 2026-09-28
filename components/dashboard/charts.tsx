"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// Shared dashboard pieces: grouped stat strips, chart cards and three small
// dependency-free charts (donut, horizontal bars, vertical bars). Colours
// match the status pills used across the app.

export const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#10b981",
  PENDING: "#f59e0b",
  FOR_APPROVAL: "#f97316",
  FOR_REVIEW: "#f97316",
  DECLINED: "#ef4444",
  CANCELLED: "#a3a3a3",
  DONE: "#0ea5e9",
};

export const ACTION_COLORS: Record<string, string> = {
  CREATED: "#10b981",
  UPDATED: "#0ea5e9",
  DELETED: "#ef4444",
  CANCELLED: "#a3a3a3",
};

const FALLBACK = ["#dc2626", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#a3a3a3"];

const pretty = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ------------------------------------------------------------------ stats

export type Stat = {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  // Change against the previous period, shown as a small +N / -N pill.
  delta?: number;
};

// A titled card of stats joined by hairlines. Each cell links to its page.
export function StatGroup({ title, stats }: { title: string; stats: Stat[] }) {
  const cols =
    stats.length >= 5 ? "lg:grid-cols-5" : stats.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      <p className="border-b border-border bg-neutral-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className={cn("grid grid-cols-2 sm:grid-cols-3", cols)}>
        {stats.map((s) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{s.icon}</span>
              </div>
              <div className="mt-2 flex min-w-0 items-baseline gap-2">
                <p className="truncate text-2xl font-semibold tabular-nums tracking-tight" title={String(s.value)}>{s.value}</p>
                {s.delta !== undefined && s.delta !== 0 && (
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[11px] font-medium tabular-nums",
                      s.delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                    )}
                  >
                    {s.delta > 0 ? `+${s.delta}` : s.delta}
                  </span>
                )}
              </div>
              <p className="mt-0.5 h-4 truncate text-xs text-muted-foreground">{s.hint ?? ""}</p>
            </>
          );
          const cell = "block border-b border-r border-neutral-100 p-4";
          return s.href ? (
            <Link key={s.label} href={s.href} className={cn(cell, "transition-colors hover:bg-neutral-50")}>
              {body}
            </Link>
          ) : (
            <div key={s.label} className={cell}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ chart shell

export function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-white", className)}>
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

export function SectionHeading({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex items-baseline gap-3 pt-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

const Empty = ({ label }: { label: string }) => (
  <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">{label}</p>
);

// ------------------------------------------------------------------ donut

export function DonutChart({
  data,
  emptyLabel = "No data",
}: {
  data: { label: string; value: number; color?: string }[];
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total === 0) return <Empty label={emptyLabel} />;

  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f5f5f5" strokeWidth="16" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle
              key={d.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={d.color ?? FALLBACK[i % FALLBACK.length]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="rotate-90 fill-foreground" style={{ transformOrigin: "70px 70px", fontSize: 22, fontWeight: 600 }}>
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" className="rotate-90 fill-neutral-500" style={{ transformOrigin: "70px 70px", fontSize: 10 }}>
          total
        </text>
      </svg>

      <ul className="flex w-full flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color ?? FALLBACK[i % FALLBACK.length] }} />
            <span className="font-medium">{pretty(d.label)}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {d.value} · {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------------------------------------------- horizontal bars

export function HBarChart({
  data,
  emptyLabel = "No data",
}: {
  data: { label: string; value: number; color?: string }[];
  emptyLabel?: string;
}) {
  if (!data.length) return <Empty label={emptyLabel} />;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ol className="flex flex-col gap-3">
      {data.map((d, i) => (
        <li key={d.label} className="flex items-center gap-3">
          <span className="w-4 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium">{d.label}</span>
              <span className="tabular-nums text-muted-foreground">{d.value}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------- vertical bars

export function VBarChart({
  data,
  emptyLabel = "No data",
}: {
  data: { label: string; value: number }[];
  emptyLabel?: string;
}) {
  if (!data.length) return <Empty label={emptyLabel} />;
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [max, Math.round(max / 2), 0];
  return (
    <div className="flex h-52 gap-2">
      <div className="flex flex-col justify-between pb-5 text-[10px] tabular-nums text-muted-foreground">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="relative flex flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
          {ticks.map((_, i) => (
            <span key={i} className="h-px w-full bg-neutral-100" />
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-2">
          {data.map((d) => (
            <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {d.value}
              </span>
              <div
                className="w-full max-w-10 rounded-t-sm bg-brand/85 transition-colors group-hover:bg-brand"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="flex h-5 gap-2">
          {data.map((d) => (
            <span key={d.label} className="flex-1 truncate pt-1 text-center text-[10px] text-muted-foreground">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
