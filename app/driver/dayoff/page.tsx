"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Ellipsis, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterStrip, PageHeader } from "@/components/management/parts";
import { FieldLabel, FormSection, Summary } from "@/components/booking/form-parts";
import { DetailGrid, DetailItem } from "@/components/booking/detail-parts";
import { cn } from "@/lib/utils";

// Driver day-off requests: file one, follow its status, cancel it while it
// is still pending. The form warns about trips already assigned on the
// picked dates, since the OB admin would have to reassign them.

type DayOff = {
  dayoff_id: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  createdAt: string;
};

type Trip = { ob_id: string; destination: string; status: string; time_from: string; time_to: string };

const REASONS = ["Personal matter", "Medical check-up", "Family event", "Emergency"];

const days = (from: string, to: string) =>
  differenceInCalendarDays(new Date(to), new Date(from)) + 1;

function dayRange(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  if (format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd")) return format(a, "EEE, MMM d, yyyy");
  return format(a, "yyyy") === format(b, "yyyy")
    ? `${format(a, "MMM d")} – ${format(b, "MMM d, yyyy")}`
    : `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
}

function DateBlock({ date, size = "sm" }: { date: string; size?: "sm" | "lg" }) {
  const d = new Date(date);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-md border border-border bg-white leading-none",
        size === "lg" ? "h-14 w-14" : "h-11 w-11",
      )}
    >
      <span className="text-[10px] font-semibold uppercase text-brand">{format(d, "MMM")}</span>
      <span className={cn("mt-0.5 font-semibold tabular-nums", size === "lg" ? "text-xl" : "text-base")}>
        {format(d, "d")}
      </span>
    </div>
  );
}

export default function DriverDayOffPage() {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({ date_from: "", date_to: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [viewing, setViewing] = useState<DayOff | null>(null);
  const [toCancel, setToCancel] = useState<DayOff | null>(null);
  const [filter, setFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["driverDayOff"],
    queryFn: async () => {
      const res = await fetch("/api/driver/dayoff");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: DayOff[] };
    },
  });
  const all = useMemo(() => data?.data ?? [], [data]);
  const rows = filter === "all" ? all : all.filter((r) => r.status === filter);

  // Assigned trips, to warn when a day off would overlap one.
  const { data: tripData } = useQuery({
    queryKey: ["driverTrips"],
    queryFn: async () => {
      const res = await fetch("/api/driver/trips");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: Trip[] };
    },
  });

  const to = form.date_to || form.date_from;
  const validRange = !!form.date_from && to >= form.date_from;
  const clashTrips = validRange
    ? (tripData?.data ?? []).filter(
        (t) =>
          t.status === "APPROVED" &&
          new Date(t.time_from) <= new Date(`${to}T23:59:59`) &&
          new Date(t.time_to) >= new Date(`${form.date_from}T00:00:00`),
      )
    : [];
  const clashRequest = validRange
    ? all.find(
        (r) =>
          (r.status === "PENDING" || r.status === "APPROVED") &&
          format(new Date(r.date_from), "yyyy-MM-dd") <= to &&
          format(new Date(r.date_to), "yyyy-MM-dd") >= form.date_from,
      )
    : undefined;

  const nextOff = all
    .filter((r) => r.status === "APPROVED" && startOfDay(new Date(r.date_to)) >= startOfDay(new Date()))
    .sort((a, b) => new Date(a.date_from).getTime() - new Date(b.date_from).getTime())[0];

  function openNew() {
    setForm({ date_from: "", date_to: "", reason: "" });
    setOpenForm(true);
  }

  async function submit() {
    if (!form.date_from) return toast.error("Select a start date");
    if (form.date_to && form.date_to < form.date_from) return toast.error("End date must be on or after the start date");
    if (!form.reason.trim()) return toast.error("Enter a reason");

    setSaving(true);
    try {
      const res = await fetch("/api/driver/dayoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date_to: to }),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error ?? "Failed to file day off");
      toast.success("Day-off request filed");
      setOpenForm(false);
      queryClient.invalidateQueries({ queryKey: ["driverDayOff"] });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(r: DayOff) {
    const res = await fetch(`/api/driver/dayoff/${r.dayoff_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCELLED" }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json?.error ?? "Failed to cancel");
    toast.success("Request cancelled");
    setToCancel(null);
    setViewing(null);
    queryClient.invalidateQueries({ queryKey: ["driverDayOff"] });
  }

  const count = (s: string) => all.filter((r) => r.status === s).length;

  const menu = (r: DayOff) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setViewing(r)}>View</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={r.status !== "PENDING"} onClick={() => setToCancel(r)}>
            Cancel request
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Row/card click opens the details; clicks from the menu portal are ignored.
  const openRow = (r: DayOff) => (e: React.MouseEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("button")) return;
    setViewing(r);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Day off" count={all.length} subtitle="Once the OB admin approves it, you won't be assigned trips on those dates">
        <Button className="h-10" onClick={openNew}>
          <Plus className="h-4 w-4" /> File day off
        </Button>
      </PageHeader>

      <FilterStrip
        title={
          nextOff
            ? `Next day off: ${dayRange(nextOff.date_from, nextOff.date_to)}`
            : "My requests"
        }
        total={all.length}
        active={filter}
        onSelect={setFilter}
        items={[
          { key: "PENDING", label: "Pending", color: "#f59e0b", count: count("PENDING") },
          { key: "APPROVED", label: "Approved", color: "#10b981", count: count("APPROVED") },
          { key: "DECLINED", label: "Declined", color: "#ef4444", count: count("DECLINED") },
          { key: "CANCELLED", label: "Cancelled", color: "#a3a3a3", count: count("CANCELLED") },
        ]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner /> Loading requests...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-white py-6">
          <EmptyState
            title={filter === "all" ? "No day-off requests yet" : "Nothing here"}
            description={filter === "all" ? "File one and the OB admin will review it." : "Try another filter."}
            action={filter === "all" ? <Button size="sm" onClick={openNew}>+ File day off</Button> : undefined}
          />
        </div>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map((r) => (
              <li
                key={r.dayoff_id}
                onClick={openRow(r)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-white p-3"
              >
                <DateBlock date={r.date_from} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{dayRange(r.date_from, r.date_to)}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                  <StatusBadge status={r.status} className="mt-1.5" />
                </div>
                {menu(r)}
              </li>
            ))}
          </ul>

          {/* Tablet and up: table */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-white sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dates</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.dayoff_id} className="cursor-pointer" onClick={openRow(r)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <DateBlock date={r.date_from} />
                        <div>
                          <p className="text-sm font-medium">{dayRange(r.date_from, r.date_to)}</p>
                          <p className="text-xs text-muted-foreground">
                            {days(r.date_from, r.date_to)} day{days(r.date_from, r.date_to) > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(r.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>{menu(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* File a day off */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="font-bold text-white">File day off</SheetTitle>
            <SheetDescription className="text-white">The OB admin reviews every request.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Dates" hint="Leave the end empty for one day.">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>From</FieldLabel>
                  <Input
                    type="date"
                    className="h-11"
                    min={today}
                    value={form.date_from}
                    onChange={(e) => setForm({ ...form, date_from: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>To</FieldLabel>
                  <Input
                    type="date"
                    className="h-11"
                    min={form.date_from || today}
                    value={form.date_to}
                    onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                  />
                </div>
              </div>

              {clashRequest && (
                <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    You already have a {clashRequest.status.toLowerCase()} request for{" "}
                    {dayRange(clashRequest.date_from, clashRequest.date_to)}. Pick other dates.
                  </p>
                </div>
              )}
              {clashTrips.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      You have {clashTrips.length} trip{clashTrips.length > 1 ? "s" : ""} on these dates
                    </p>
                    <ul className="mt-1 list-disc pl-4">
                      {clashTrips.map((t) => (
                        <li key={t.ob_id}>
                          {format(new Date(t.time_from), "MMM d, h:mm a")} · {t.destination}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1">If approved, the OB admin will need to assign another driver.</p>
                  </div>
                </div>
              )}
            </FormSection>

            <FormSection step={2} title="Reason">
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, reason: r })}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm transition-colors",
                      form.reason === r ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-neutral-50",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Pick one above or write your own"
              />
            </FormSection>

            <FormSection step={3} title="Review">
              <Summary
                rows={[
                  ["Dates", form.date_from ? dayRange(form.date_from, to) : ""],
                  ["Length", validRange ? `${days(form.date_from, to)} day${days(form.date_from, to) > 1 ? "s" : ""}` : ""],
                  ["Trips affected", validRange ? String(clashTrips.length) : ""],
                  ["Reason", form.reason],
                ]}
              />
            </FormSection>
          </div>

          <SheetFooter className="sticky bottom-0 border-t border-border bg-white">
            <Button onClick={submit} disabled={saving || !!clashRequest} className="h-11 w-full">
              {saving ? "Filing..." : "Submit request"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="h-11 w-full">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Details */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="font-bold text-white">Day-off request</SheetTitle>
            <SheetDescription className="text-white">{viewing?.dayoff_id}</SheetDescription>
          </SheetHeader>
          {viewing && (
            <div className="flex flex-col gap-5 p-4">
              <div className="flex items-center gap-4 rounded-lg border border-border bg-neutral-50 p-4">
                <DateBlock date={viewing.date_from} size="lg" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight">{dayRange(viewing.date_from, viewing.date_to)}</p>
                  <p className="text-xs text-muted-foreground">
                    {days(viewing.date_from, viewing.date_to)} day{days(viewing.date_from, viewing.date_to) > 1 ? "s" : ""}
                  </p>
                  <StatusBadge status={viewing.status} className="mt-1.5" />
                </div>
              </div>
              <DetailGrid>
                <DetailItem label="Reason" value={viewing.reason} wide />
                <DetailItem label="Filed" value={format(new Date(viewing.createdAt), "MMM d, yyyy h:mm a")} />
                <DetailItem
                  label="What happens next"
                  value={
                    viewing.status === "PENDING"
                      ? "Waiting for the OB admin"
                      : viewing.status === "APPROVED"
                        ? "You won't be assigned trips on these dates"
                        : viewing.status === "DECLINED"
                          ? "You can still be assigned trips"
                          : "Request withdrawn"
                  }
                />
              </DetailGrid>
            </div>
          )}
          {viewing?.status === "PENDING" && (
            <SheetFooter className="border-t border-border">
              <Button variant="destructive" className="h-11 w-full" onClick={() => setToCancel(viewing)}>
                Cancel request
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm cancel */}
      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel && dayRange(toCancel.date_from, toCancel.date_to)}. You can file a new one later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => toCancel && cancel(toCancel)}>
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
