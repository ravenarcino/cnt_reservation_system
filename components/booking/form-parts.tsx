import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Building blocks for the booking forms (hall and OB): numbered sections,
// selectable option cards and a summary box.

export function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-5 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
          {step}
        </span>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

export function SelectCard({
  selected,
  disabled,
  onToggle,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border p-3 text-left transition-colors",
        selected
          ? "border-brand bg-brand-soft"
          : "border-border bg-white hover:border-neutral-300 hover:bg-neutral-50",
        disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-white",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          selected ? "border-brand bg-brand text-white" : "border-neutral-300 bg-white",
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {badge && (
        <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border border-border bg-neutral-50 p-3 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="truncate text-right font-medium">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
