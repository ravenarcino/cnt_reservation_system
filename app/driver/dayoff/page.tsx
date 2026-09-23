"use client";

import { EmptyState } from "@/components/ui/empty-state";

import { StatusBadge } from "@/components/ui/status-badge";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Driver day-off requests: file one, see the status of past ones, and cancel
// a request while it is still pending.

type DayOff = {
  dayoff_id: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  createdAt: string;
};

const TONE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-700",
};

function dayRange(from: string, to: string) {
  const a = format(new Date(from), "MMM d, yyyy");
  const b = format(new Date(to), "MMM d, yyyy");
  return a === b ? a : `${a} – ${b}`;
}

export default function DriverDayOffPage() {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({ date_from: "", date_to: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<DayOff | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["driverDayOff"],
    queryFn: async () => {
      const res = await fetch("/api/driver/dayoff");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: DayOff[] };
    },
  });
  const rows = data?.data ?? [];

  async function submit() {
    if (!form.date_from) return toast.error("Select a start date");
    if (!form.reason.trim()) return toast.error("Enter a reason");

    setSaving(true);
    try {
      const res = await fetch("/api/driver/dayoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date_to: form.date_to || form.date_from }),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error ?? "Failed to file day off");
      toast.success("Day-off request filed");
      setForm({ date_from: "", date_to: "", reason: "" });
      setOpenForm(false);
      queryClient.invalidateQueries({ queryKey: ["driverDayOff"] });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/driver/dayoff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCELLED" }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json?.error ?? "Failed to cancel");
    toast.success("Request cancelled");
    queryClient.invalidateQueries({ queryKey: ["driverDayOff"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Day Off</h1>
          <p className="text-sm text-muted-foreground">
            File a day off. Once the OB admin approves it you will not be assigned
            to trips on those dates.
          </p>
        </div>
        <Button className="bg-brand text-white" onClick={() => setOpenForm(true)}>
          File Day Off
        </Button>
      </div>


      <div className="flex flex-col gap-3">
        <p className="text-base font-semibold">My Requests</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No day-off requests yet" description="Use File Day Off to request a day off." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.dayoff_id}>
                    <TableCell className="whitespace-nowrap">{dayRange(r.date_from, r.date_to)}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(r.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost">
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => setViewing(r)}>View</DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={r.status !== "PENDING"}
                              onClick={() => cancel(r.dayoff_id)}
                            >
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* File a day off */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">File Day Off</SheetTitle>
            <SheetDescription className="text-white">
              Fill in the dates and reason below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>From</Label>
                <Input
                  type="date"
                  min={today}
                  value={form.date_from}
                  onChange={(e) => setForm({ ...form, date_from: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>To (optional)</Label>
                <Input
                  type="date"
                  min={form.date_from || today}
                  value={form.date_to}
                  onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Reason</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Personal matter, medical check-up"
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={submit}
              disabled={saving}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              {saving ? "Filing..." : "Submit Request"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full rounded-sm py-5 font-medium">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* View */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Day-off Request</DialogTitle>
            <DialogDescription>{viewing?.dayoff_id}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="flex flex-col gap-3 text-sm">
              <Field label="Date" value={dayRange(viewing.date_from, viewing.date_to)} />
              <Field label="Reason" value={viewing.reason} />
              <Field label="Filed" value={format(new Date(viewing.createdAt), "MMM d, yyyy h:mm a")} />
              <Field
                label="Status"
                value={viewing.status.charAt(0) + viewing.status.slice(1).toLowerCase()}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}
