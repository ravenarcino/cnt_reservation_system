import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

// Pieces for the reservation / trip detail popups on the user's
// Reservations page.

export function DetailHeader({
  kind,
  reference,
  title,
  status,
  onClose,
}: {
  kind: string;
  reference: string;
  title: string;
  status: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {kind} · <span className="font-mono normal-case">{reference}</span>
        </p>
        <p className="mt-1 truncate text-lg font-semibold">{title}</p>
        <StatusBadge status={status} className="mt-2" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-neutral-100 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

export function DetailItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium whitespace-pre-wrap">{value || "—"}</dd>
    </div>
  );
}

// Filed -> Approved -> Done, with Cancelled / Declined / In review shown as
// the end of the line where they apply.
export function StatusSteps({ status }: { status: string }) {
  const ended = status === "CANCELLED" || status === "DECLINED";
  const review = status === "FOR_REVIEW" || status === "FOR_APPROVAL";
  const reached =
    status === "DONE" ? 3 : status === "APPROVED" || review ? 2 : ended ? 1 : 1;

  const steps: { label: string; state: "done" | "current" | "todo" | "stop" }[] = [
    { label: "Filed", state: "done" },
    {
      label: ended ? (status === "DECLINED" ? "Declined" : "Cancelled") : "Approved",
      state: ended ? "stop" : reached >= 2 ? "done" : "current",
    },
    {
      label: review ? "Cancellation in review" : "Done",
      state: ended ? "todo" : review ? "current" : reached >= 3 ? "done" : "todo",
    },
  ];

  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center gap-2 last:flex-none">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                s.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                s.state === "current" && "border-amber-500 bg-amber-50 text-amber-700",
                s.state === "stop" && "border-red-500 bg-red-500 text-white",
                s.state === "todo" && "border-neutral-300 text-muted-foreground",
              )}
            >
              {s.state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : s.state === "stop" ? (
                <X className="h-3 w-3" strokeWidth={3} />
              ) : (
                i + 1
              )}
            </span>
            <span className={cn(s.state === "todo" ? "text-muted-foreground" : "font-medium")}>{s.label}</span>
          </span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
}
