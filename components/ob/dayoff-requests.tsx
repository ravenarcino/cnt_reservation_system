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
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Drivers' day-off requests, shown on the OB calendar page (super admin and
// OB admin). Approving one stops that driver from being picked for any OB
// trip on those dates.

type Row = {
  dayoff_id: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  createdAt: string;
  driver: { driver_id: string; driver_name: string };
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

export function DayOffRequests() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dayOffRequests", status],
    queryFn: async () => {
      const qs = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/dayoff${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: Row[] };
    },
  });
  const rows = data?.data ?? [];

  async function act(row: Row, action: "APPROVED" | "DECLINED") {
    setBusyId(row.dayoff_id);
    try {
      const res = await fetch(`/api/dayoff/${row.dayoff_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error ?? "Failed to update request");

      toast.success(`Day off ${action === "APPROVED" ? "approved" : "declined"}`);
      if (json.conflicts?.length) {
        toast.warning(
          `${row.driver.driver_name} is still assigned to ${json.conflicts.join(", ")} on those dates - reassign a driver.`,
          { duration: 10000 },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["dayOffRequests"] });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full lg:max-w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="DECLINED">Declined</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Spinner /> Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  <EmptyState title="No day-off requests" description="Requests filed by drivers will show up here." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.dayoff_id}>
                  <TableCell className="font-medium">{r.driver.driver_name}</TableCell>
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
                        <Button variant="ghost" disabled={busyId === r.dayoff_id}>
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => setViewing(r)}>View</DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={r.status !== "PENDING"}
                            onClick={() => act(r, "APPROVED")}
                          >
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={r.status !== "PENDING" && r.status !== "APPROVED"}
                            onClick={() => act(r, "DECLINED")}
                          >
                            Decline
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Day-off Request</DialogTitle>
            <DialogDescription>{viewing?.dayoff_id}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="flex flex-col gap-3 text-sm">
              <Field label="Driver" value={viewing.driver.driver_name} />
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
