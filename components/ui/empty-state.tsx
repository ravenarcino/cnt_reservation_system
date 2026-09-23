import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

// Shown in place of an empty table or list: outline icon, a short title and
// an optional hint or action.
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" strokeWidth={1.5} />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground whitespace-normal">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
