"use client";

import { formatDistanceToNow } from "date-fns";
import { StatusSummary } from "@/components/booking/status-summary";
import { DetailGrid, DetailHeader, DetailItem, StatusSteps } from "@/components/booking/detail-parts";
import { Person } from "@/components/dashboard/admin-tables";

import { EmptyState } from "@/components/ui/empty-state";

import { StatusBadge } from "@/components/ui/status-badge";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ellipsis, Search, Trash, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

// Super admin OB reservation management. Same layout and rules as Hall
// Reservation Management: which buttons show depends on the trip's status,
// and every transition is also enforced by the server.

type Trip = {
  ob_id: string;
  purpose: string;
  destination: string;
  passengers_qty: number;
  time_from: string;
  time_to: string;
  driver_name: string | null;
  other_request: string | null;
  status: string;
  vehicle: { vehicle_id: string; vehicle_name: string; plate_number?: string | null }[];
  drivers: { driver_id: string; driver_name: string }[];
  ob_user: { name: string; email?: string; department?: string } | null;
  createdAt?: string;
};

type AdminAction = "Approve" | "Decline" | "Cancel";

const ACTION_STATUS: Record<AdminAction, string> = {
  Approve: "APPROVED",
  Decline: "DECLINED",
  Cancel: "CANCELLED",
};

const emptyForm = {
  purpose: "",
  destination: "",
  passengers_qty: "",
  date_departure: "",
  time_from: "",
  date_return: "",
  time_to: "",
  vehicle: [] as string[],
  drivers: [] as string[],
  personal_driver: false,
  driver_name: "",
  other_request: "",
};

// Same matrix as the hall page.
function getAvailableActions(status: string) {
  if (status === "PENDING") {
    return { edit: true, approve: true, decline: true, cancel: true };
  }
  // A cancellation request is waiting: approving it is Cancel, rejecting it is Decline.
  if (status === "FOR_REVIEW" || status === "FOR_APPROVAL") {
    return { edit: true, approve: false, decline: true, cancel: true };
  }
  if (status === "APPROVED") {
    return { edit: true, approve: false, decline: false, cancel: true };
  }
  // DECLINED, CANCELLED, DONE - finished.
  return { edit: false, approve: false, decline: false, cancel: false };
}

// Nothing can be changed once the trip has ended - only viewed or deleted.
function isActionable(trip: Trip) {
  return new Date(trip.time_to) > new Date();
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function driverList(trip: Trip) {
  return (
    [
      ...(trip.drivers ?? []).map((d) => d.driver_name),
      ...(trip.driver_name ? [`${trip.driver_name} (personal)`] : []),
    ].join(", ") || "—"
  );
}

export default function ObReservationPage() {
  const queryClient = useQueryClient();
  const limit = 10;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected] = useState<Trip | null>(null);
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openAction, setOpenAction] = useState(false);
  const [action, setAction] = useState<AdminAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // ------------------------------------------------------------------ data
  const { data: tripData, isLoading } = useQuery({
    queryKey: ["obReservation", "admin"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: vehicleData } = useQuery({
    queryKey: ["vehicle", "all"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles/vehicles/vehicle?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: driverData } = useQuery({
    queryKey: ["driver", "all"],
    queryFn: async () => {
      const res = await fetch("/api/drivers/driver?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
    enabled: openEdit,
  });

  const windowComplete =
    !!form.date_departure && !!form.time_from && !!form.date_return && !!form.time_to;

  // Busy vehicles and drivers in the edited window, ignoring this trip itself.
  const { data: availability, isFetching: availabilityLoading } = useQuery({
    queryKey: [
      "obAvailability",
      selected?.ob_id,
      form.date_departure,
      form.time_from,
      form.date_return,
      form.time_to,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_departure: form.date_departure,
        time_from: form.time_from,
        date_return: form.date_return,
        time_to: form.time_to,
        ...(selected && { exclude: selected.ob_id }),
      });
      const res = await fetch(`/api/reservations/ob_reservations/availability?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
    enabled: openEdit && windowComplete,
  });

  const busyVehicles = new Set<string>(availability?.busyVehicleIds ?? []);
  const busyDrivers = new Set<string>(availability?.busyDriverIds ?? []);

  const { data: cancellationData } = useQuery({
    queryKey: ["obCancellation", selected?.ob_id],
    queryFn: async () => {
      const res = await fetch(
        `/api/reservations/ob_reservations/cancel?ob_id=${selected?.ob_id}`,
      );
      if (res.status === 404) return null;
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
    enabled: openView && !!selected,
  });

  // --------------------------------------------------------------- listing
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((tripData?.data ?? []) as Trip[]).filter((t) => {
      const matchesSearch =
        !q ||
        t.ob_id.toLowerCase().includes(q) ||
        t.purpose.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        (t.ob_user?.name ?? "").toLowerCase().includes(q);
      const matchesVehicle =
        vehicleFilter === "all" || t.vehicle.some((v) => v.vehicle_id === vehicleFilter);
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesVehicle && matchesStatus;
    });
  }, [tripData, search, vehicleFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / limit) || 1;
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["obReservation"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["obAvailability"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["obCancellation"], exact: false });
  }

  // --------------------------------------------------------------- actions
  function startEdit(trip: Trip) {
    const from = new Date(trip.time_from);
    const to = new Date(trip.time_to);
    setSelected(trip);
    setForm({
      purpose: trip.purpose,
      destination: trip.destination,
      passengers_qty: String(trip.passengers_qty),
      date_departure: format(from, "yyyy-MM-dd"),
      time_from: format(from, "HH:mm"),
      date_return: format(to, "yyyy-MM-dd"),
      time_to: format(to, "HH:mm"),
      vehicle: trip.vehicle.map((v) => v.vehicle_id),
      drivers: trip.drivers.map((d) => d.driver_id),
      personal_driver: !!trip.driver_name,
      driver_name: trip.driver_name ?? "",
      other_request: trip.other_request ?? "",
    });
    setOpenView(false);
    setOpenEdit(true);
  }

  function startAction(trip: Trip, next: AdminAction) {
    setSelected(trip);
    setAction(next);
    setOpenAction(true);
  }

  function toggle(key: "vehicle" | "drivers", id: string) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter((x) => x !== id)
        : [...prev[key], id],
    }));
  }

  async function handleUpdate() {
    if (!selected) return;
    if (!form.purpose.trim()) return toast.error("Please enter a purpose");
    if (!form.destination.trim()) return toast.error("Please enter a destination");
    if (!windowComplete)
      return toast.error("Please complete the departure and return schedule");
    if (form.vehicle.length === 0)
      return toast.error("Please select at least one vehicle");
    if (form.personal_driver && !form.driver_name.trim())
      return toast.error("Please enter the personal driver's name");
    if (form.drivers.length === 0 && !form.personal_driver)
      return toast.error("Please select at least one driver");

    setBusy(true);
    const loading = toast.loading("Updating OB reservation...");
    try {
      const res = await fetch(`/api/reservations/ob_reservations/${selected.ob_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      toast.dismiss(loading);

      if (!res.ok) {
        toast.error(json?.error ?? "Failed to update OB reservation");
        queryClient.invalidateQueries({ queryKey: ["obAvailability"], exact: false });
        return;
      }

      toast.success("OB reservation has been updated");
      setOpenEdit(false);
      setSelected(null);
      refresh();
    } catch (err) {
      toast.dismiss(loading);
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusAction() {
    if (!selected || !action) return;

    setBusy(true);
    const loading = toast.loading("Updating reservation status...");
    try {
      const res = await fetch(`/api/reservations/ob_reservations/action/${selected.ob_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: ACTION_STATUS[action] }),
      });
      const json = await res.json();
      toast.dismiss(loading);

      if (!res.ok) {
        toast.error(json?.error ?? "Failed to update reservation status");
        return;
      }

      toast.success("Reservation status has been updated");
      setOpenAction(false);
      setOpenView(false);
      setAction(null);
      setSelected(null);
      refresh();
    } catch (err) {
      toast.dismiss(loading);
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/ob_reservations/${selected.ob_id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.error ?? "Failed to delete reservation");
        return;
      }

      toast.success("Reservation has been deleted");
      setOpenDelete(false);
      setOpenView(false);
      setSelected(null);
      refresh();
    } catch (err) {
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------- render
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <h1 className="page-title">OB Reservation</h1>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage Employee OB Trips
          </p>
        </div>
      </div>

      <StatusSummary
        statuses={((tripData?.data ?? []) as Trip[]).map((t) => t.status)}
        active={statusFilter}
        onSelect={(st) => {
          setStatusFilter(st);
          setPage(1);
        }}
      />

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reservation"
            className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={vehicleFilter}
          onValueChange={(value) => {
            setVehicleFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder="Vehicle" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Vehicle</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              {(vehicleData?.data ?? []).map(
                (v: { vehicle_id: string; vehicle_name: string }) => (
                  <SelectItem key={v.vehicle_id} value={v.vehicle_id}>
                    {v.vehicle_name}
                  </SelectItem>
                ),
              )}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="DECLINED">Declined</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="FOR_APPROVAL">For Approval</SelectItem>
              <SelectItem value="FOR_REVIEW">For Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Pax</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading reservations</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <EmptyState title="No reservation found" description="Try a different search or status filter." />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((trip) => {
                  const actions = getAvailableActions(trip.status);
                  const actionable = isActionable(trip);
                  return (
                    <TableRow
                      key={trip.ob_id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        // The action menu renders in a portal; ignore its clicks.
                        if (!e.currentTarget.contains(e.target as Node)) return;
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSelected(trip);
                        setOpenView(true);
                      }}
                    >
                      <TableCell>
                        <Person name={trip.ob_user?.name} sub={trip.ob_user?.department} />
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate font-medium">{trip.purpose}</p>
                        <p className="font-mono text-xs text-muted-foreground">{trip.ob_id}</p>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate">{trip.destination}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {trip.vehicle.map((v) => v.vehicle_name).join(", ") || "No vehicle"}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-medium">{format(new Date(trip.time_from), "EEE, MMM d · h:mm a")}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          until {format(new Date(trip.time_to), "MMM d, h:mm a")}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{trip.passengers_qty}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {trip.createdAt ? formatDistanceToNow(new Date(trip.createdAt), { addSuffix: true }) : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={trip.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost">
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelected(trip);
                                  setOpenView(true);
                                }}
                              >
                                View
                              </DropdownMenuItem>
                              {actions.edit && (
                                <DropdownMenuItem
                                  disabled={!actionable}
                                  onClick={() => startEdit(trip)}
                                >
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {actions.approve && (
                                <DropdownMenuItem
                                  disabled={!actionable}
                                  onClick={() => startAction(trip, "Approve")}
                                >
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {actions.decline && (
                                <DropdownMenuItem
                                  disabled={!actionable}
                                  onClick={() => startAction(trip, "Decline")}
                                >
                                  Decline
                                </DropdownMenuItem>
                              )}
                              {actions.cancel && (
                                <DropdownMenuItem
                                  disabled={!actionable}
                                  onClick={() => startAction(trip, "Cancel")}
                                >
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelected(trip);
                                  setOpenDelete(true);
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination className="mt-4 justify-center lg:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink isActive={currentPage === i + 1} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* ------------------------------------------------------------ view */}
      {openView && selected && (() => {
        const actions = getAvailableActions(selected.status);
        const actionable = isActionable(selected);

        const deleteButton = (
          <Button
            className="w-full lg:w-10 h-10 border border-red-200 bg-white text-red-600 hover:bg-red-50"
            onClick={() => setOpenDelete(true)}
          >
            <Trash className="h-4 w-4" />
            <p className="block lg:hidden">Delete</p>
          </Button>
        );

        const statusButtons = [
          actions.approve && (
            <Button
              key="approve"
              className="w-full lg:flex-1 h-10 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!actionable}
              onClick={() => startAction(selected, "Approve")}
            >
              Approve
            </Button>
          ),
          actions.decline && (
            <Button
              key="decline"
              className="w-full lg:flex-1 h-10 border border-red-200 bg-white text-red-600 hover:bg-red-50"
              disabled={!actionable}
              onClick={() => startAction(selected, "Decline")}
            >
              Decline
            </Button>
          ),
          actions.cancel && (
            <Button
              key="cancel"
              className="w-full lg:flex-1 h-10 border border-border bg-white text-foreground hover:bg-neutral-50"
              disabled={!actionable}
              onClick={() => startAction(selected, "Cancel")}
            >
              Cancel
            </Button>
          ),
        ].filter(Boolean);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="relative w-full max-w-2xl max-h-[88vh] gap-0 overflow-y-auto py-0">
              <DetailHeader
                kind="OB trip"
                reference={selected.ob_id}
                title={selected.purpose}
                status={selected.status}
                onClose={() => setOpenView(false)}
              />

              <div className="flex flex-col gap-5 p-5">
                <div className="rounded-md border border-border bg-neutral-50 px-4 py-3">
                  <StatusSteps status={selected.status} />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Person name={selected.ob_user?.name} sub={selected.ob_user?.email} />
                  <span className="text-xs text-muted-foreground">
                    {selected.createdAt
                      ? `Filed ${formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}`
                      : ""}
                  </span>
                </div>

                <DetailGrid>
                  <DetailItem label="Destination" value={selected.destination} />
                  <DetailItem label="Passengers" value={String(selected.passengers_qty)} />
                  <DetailItem label="Departure" value={format(new Date(selected.time_from), "EEE, MMM d, yyyy · h:mm a")} />
                  <DetailItem label="Return" value={format(new Date(selected.time_to), "EEE, MMM d, yyyy · h:mm a")} />
                  <DetailItem
                    label="Vehicle"
                    value={selected.vehicle
                      .map((v) => v.vehicle_name + (v.plate_number ? ` (${v.plate_number})` : ""))
                      .join(", ")}
                  />
                  <DetailItem label="Driver" value={driverList(selected)} />
                  <DetailItem wide label="Other request" value={selected.other_request || "None"} />
                </DetailGrid>

                {cancellationData?.cancellation && (
                  <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Cancellation request</p>
                    <p className="mt-1.5">{cancellationData.cancellation.reason}</p>
                    <a
                      href={`/api/uploads/cancellations/${cancellationData.cancellation.path.split("/").pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-brand underline"
                    >
                      View proof: {cancellationData.cancellation.file_name}
                    </a>
                  </div>
                )}
              </div>

              {/* Same layout as the hall card: Edit beside a small Delete; when
                  there is no Edit, Delete joins the status row; alone, it is
                  full width. */}
              <div className="flex flex-col gap-2 border-t border-border p-5">
                {actions.edit && (
                  <div className="flex flex-col lg:flex-row gap-2">
                    <Button
                      className="w-full lg:flex-1 h-10"
                      disabled={!actionable}
                      onClick={() => startEdit(selected)}
                    >
                      Edit Reservation
                    </Button>
                    {deleteButton}
                  </div>
                )}

                {statusButtons.length > 0 && (
                  <div className="flex flex-col lg:flex-row gap-2">
                    {statusButtons}
                    {!actions.edit && deleteButton}
                  </div>
                )}

                {!actions.edit && statusButtons.length === 0 && (
                  <Button
                    className="w-full h-10 border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    onClick={() => setOpenDelete(true)}
                  >
                    <Trash className="h-4 w-4" />
                    <p className="ml-2">Delete</p>
                  </Button>
                )}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ------------------------------------------------------------ edit */}
      <Sheet open={openEdit} onOpenChange={setOpenEdit}>
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">Edit OB Reservation</SheetTitle>
            <SheetDescription className="text-white">
              Update reservation details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">OB ID: {selected?.ob_id}</label>

            <Field label="Purpose">
              <Input
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </Field>
            <Field label="Destination">
              <Input
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
            </Field>
            <Field label="Number of Passengers">
              <Input
                type="number"
                min={1}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.passengers_qty}
                onChange={(e) => setForm({ ...form, passengers_qty: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Departure Date">
                <Input
                  type="date"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={form.date_departure}
                  onChange={(e) => setForm({ ...form, date_departure: e.target.value })}
                />
              </Field>
              <Field label="Departure Time">
                <Input
                  type="time"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={form.time_from}
                  onChange={(e) => setForm({ ...form, time_from: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Return Date">
                <Input
                  type="date"
                  min={form.date_departure || undefined}
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={form.date_return}
                  onChange={(e) => setForm({ ...form, date_return: e.target.value })}
                />
              </Field>
              <Field label="Return Time">
                <Input
                  type="time"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={form.time_to}
                  onChange={(e) => setForm({ ...form, time_to: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Vehicles">
              {!windowComplete ? (
                <p className="text-sm text-muted-foreground">
                  Set the schedule first to see which vehicles are free.
                </p>
              ) : availabilityLoading ? (
                <p className="text-sm text-muted-foreground">Checking availability...</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                  {(vehicleData?.data ?? []).map((v: any) => {
                    const reason = busyVehicles.has(v.vehicle_id)
                      ? "Booked"
                      : v.status === "IN_USE"
                        ? "In use"
                        : v.status === "MAINTENANCE"
                          ? "Maintenance"
                          : null;
                    return (
                      <CheckRow
                        key={v.vehicle_id}
                        id={`admin-ob-vehicle-${v.vehicle_id}`}
                        checked={form.vehicle.includes(v.vehicle_id)}
                        reason={reason}
                        onToggle={() => toggle("vehicle", v.vehicle_id)}
                        label={`${v.vehicle_name}${v.plate_number ? ` (${v.plate_number})` : ""}${
                          v.capacity ? ` - ${v.capacity} seats` : ""
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </Field>

            <Field label="Driver">
              {!windowComplete ? (
                <p className="text-sm text-muted-foreground">
                  Set the schedule first to see which drivers are free.
                </p>
              ) : availabilityLoading ? (
                <p className="text-sm text-muted-foreground">Checking availability...</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                  {(driverData?.data ?? []).map((dr: any) => {
                    const reason = busyDrivers.has(dr.driver_id)
                      ? "On another trip"
                      : dr.status === "ON_LEAVE"
                        ? "On leave"
                        : null;
                    return (
                      <CheckRow
                        key={dr.driver_id}
                        id={`admin-ob-driver-${dr.driver_id}`}
                        checked={form.drivers.includes(dr.driver_id)}
                        reason={reason}
                        onToggle={() => toggle("drivers", dr.driver_id)}
                        label={dr.driver_name}
                      />
                    );
                  })}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="admin-ob-driver-personal"
                      checked={form.personal_driver}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          personal_driver: checked === true,
                          driver_name: checked === true ? form.driver_name : "",
                        })
                      }
                    />
                    <label htmlFor="admin-ob-driver-personal" className="font-normal cursor-pointer">
                      Personal driver
                    </label>
                  </div>
                </div>
              )}
              {form.personal_driver && (
                <Input
                  placeholder="Personal driver's name"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={form.driver_name}
                  onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                />
              )}
            </Field>

            <Field label="Other Request">
              <Textarea
                className="resize-none rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.other_request}
                onChange={(e) => setForm({ ...form, other_request: e.target.value })}
              />
            </Field>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdate}
              disabled={busy}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Update Reservation
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full rounded-sm py-5 font-medium">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ---------------------------------------------------------- delete */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete this reservation?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this record and
              remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {busy ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------------ status action */}
      <AlertDialog open={openAction} onOpenChange={setOpenAction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "Approve"
                ? "Approve this OB trip?"
                : action === "Decline"
                  ? selected?.status === "FOR_REVIEW"
                    ? "Decline the cancellation request?"
                    : "Decline this OB trip?"
                  : "Cancel this OB trip?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "Approve"
                ? "The vehicle and driver are reserved for this trip and the requester is notified."
                : action === "Decline"
                  ? selected?.status === "FOR_REVIEW"
                    ? "The request is rejected and the trip stays as it was."
                    : "The request is rejected and the vehicle is freed up."
                  : "The trip is called off and the vehicle is freed up."}
            </AlertDialogDescription>
            {selected && (
              <div className="mt-2 rounded-md border border-border bg-neutral-50 p-3 text-sm">
                <p className="font-medium">{selected.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{selected.ob_id}</span> · {selected.destination} ·{" "}
                  {format(new Date(selected.time_from), "MMM d, h:mm a")}
                </p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusAction}
              disabled={busy}
              className={
                action === "Approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {busy ? "Processing..." : action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------ small pieces

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label>{label}</label>
      {children}
    </div>
  );
}

function CheckRow({
  id,
  checked,
  reason,
  onToggle,
  label,
}: {
  id: string;
  checked: boolean;
  reason: string | null;
  onToggle: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        // An already-ticked option stays clickable so it can be unticked.
        disabled={!!reason && !checked}
        checked={checked}
        onCheckedChange={onToggle}
      />
      <label
        htmlFor={id}
        className={
          reason ? "font-normal text-red-500 cursor-not-allowed" : "font-normal cursor-pointer"
        }
      >
        {label}
        {reason && <span className="text-xs"> ({reason})</span>}
      </label>
    </div>
  );
}
