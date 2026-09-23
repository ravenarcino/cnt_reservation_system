import { cn } from "@/lib/utils";

// Small status pill: coloured dot + label. One place for every status colour
// so tables across the app read the same way.

const TONES: Record<string, { dot: string; pill: string }> = {
  PENDING: { dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 ring-amber-200" },
  FOR_APPROVAL: { dot: "bg-orange-500", pill: "bg-orange-50 text-orange-800 ring-orange-200" },
  FOR_REVIEW: { dot: "bg-orange-500", pill: "bg-orange-50 text-orange-800 ring-orange-200" },
  APPROVED: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  AVAILABLE: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  OPEN: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  DONE: { dot: "bg-sky-500", pill: "bg-sky-50 text-sky-800 ring-sky-200" },
  BORROWED: { dot: "bg-sky-500", pill: "bg-sky-50 text-sky-800 ring-sky-200" },
  DECLINED: { dot: "bg-red-500", pill: "bg-red-50 text-red-800 ring-red-200" },
  CANCELLED: { dot: "bg-neutral-400", pill: "bg-neutral-100 text-neutral-700 ring-neutral-200" },
  ON_LEAVE: { dot: "bg-neutral-400", pill: "bg-neutral-100 text-neutral-700 ring-neutral-200" },
};

export function statusText(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONES[status] ?? TONES.CANCELLED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        tone.pill,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {statusText(status)}
    </span>
  );
}
