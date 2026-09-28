"use client";

import { Ellipsis, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Row of type chips ("All 12 · Sedan 3 · Van 2 ...") used as the type filter
// on Vehicles, Halls and Items. Each type has a small menu to edit/delete it.
export function TypeChips({
  label,
  items,
  total,
  active,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  loading,
  hint,
  selectable = true,
}: {
  label: string;
  hint?: string;
  // false = types are only managed here, not used to filter the list.
  selectable?: boolean;
  items: { id: string; name: string; count?: number }[];
  total: number;
  active: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  loading?: boolean;
}) {
  const chip = (on: boolean) =>
    cn(
      "group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border pl-3 text-sm font-medium transition-colors",
      on ? "border-brand bg-brand-soft text-brand" : "border-border bg-white hover:bg-neutral-50",
    );
  const count = (on: boolean) =>
    cn(
      "rounded px-1.5 text-[11px] font-semibold tabular-nums",
      on ? "bg-brand text-white" : "bg-neutral-100 text-muted-foreground",
    );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal">{hint}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {selectable && (
          <button type="button" onClick={() => onSelect(null)} className={cn(chip(active === null), "pr-2")}>
            All <span className={count(active === null)}>{total}</span>
          </button>
        )}

        {loading ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : (
          items.map((t) => {
            const on = selectable && active === t.id;
            return (
              <div key={t.id} className={chip(on)}>
                <button
                  type="button"
                  onClick={() => selectable && onSelect(on ? null : t.id)}
                  className={cn("flex items-center gap-1.5", !selectable && "cursor-default")}
                >
                  {t.name} {t.count !== undefined && <span className={count(on)}>{t.count}</span>}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Options for ${t.name}`}
                      className="flex h-full w-6 items-center justify-center rounded-r-md text-muted-foreground hover:bg-neutral-100"
                    >
                      <Ellipsis className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => onEdit(t.id)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(t.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-neutral-300 px-3 text-sm text-muted-foreground hover:border-neutral-400 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add type
        </button>
      </div>
    </div>
  );
}
