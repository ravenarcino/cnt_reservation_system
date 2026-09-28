import { cn } from "@/lib/utils";

// Action label with a coloured dot for the Logs tables. The colour follows
// what happened: created (green), updated (blue), cancelled (orange),
// deleted (red).
function tone(eventType: string | undefined, event: string) {
  const e = `${eventType ?? ""} ${event}`.toLowerCase();
  if (e.includes("delete")) return "bg-red-500";
  if (e.includes("cancel") || e.includes("decline")) return "bg-orange-500";
  if (e.includes("create") || e.includes("file")) return "bg-emerald-500";
  return "bg-sky-500";
}

export function LogAction({
  event,
  eventType,
  changes,
}: {
  event: string;
  eventType?: string;
  changes?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone(eventType, event))} />
      <div className="min-w-0">
        <p className="font-medium">{event}</p>
        {changes && <p className="max-w-[420px] truncate text-xs text-muted-foreground">{changes}</p>}
      </div>
    </div>
  );
}

export function TypeChip({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex rounded border border-border bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      {type}
    </span>
  );
}
