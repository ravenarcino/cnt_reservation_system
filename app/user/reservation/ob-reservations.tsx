"use client";

import { EmptyState } from "@/components/ui/empty-state";

import { StatusBadge } from "@/components/ui/status-badge";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Ellipsis, Trash, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { downloadReceipt } from "@/lib/receipt";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

// OB (official business) trips for the signed-in user. Rendered inside the
// /user/reservation page next to the hall table, and follows the same rules
// as hall reservations: edit only while PENDING, cancel through a request with
// proof, mark done once an approved trip has ended.

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
  ob_user: { name: string } | null;
  createdAt?: string;
  updatedAt?: string;
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

const INACTIVE = ["CANCELLED", "DECLINED"];

function isFinished(trip: Trip) {
  return new Date(trip.time_to) <= new Date();
}

// Same matrix as the hall reservation page for regular users.
function getActions(trip: Trip) {
  const ended = isFinished(trip);

  if (trip.status === "PENDING") {
    return { edit: !ended, cancel: !ended, done: false };
  }
  if (trip.status === "APPROVED") {
    return { edit: false, cancel: !ended, done: true };
  }
  // FOR_REVIEW (cancellation already requested), CANCELLED, DECLINED, DONE
  return { edit: false, cancel: false, done: false };
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

export function ObReservations({
  search,
  statusFilter,
  showHeading,
}: {
  search: string;
  statusFilter: string;
  showHeading: boolean;
}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const limit = 10;
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Trip | null>(null);
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelProof, setCancelProof] = useState<File | null>(null);

  // ------------------------------------------------------------------ data
  const { data: tripData, isLoading } = useQuery({
    queryKey: ["obReservation"],
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
    enabled: openEdit,
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

  // Vehicles and drivers busy in the new window. The trip being edited is
  // excluded, so its own vehicles and drivers stay selectable.
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
        t.vehicle.some((v) => v.vehicle_name.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tripData, search, statusFilter]);

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

  function startCancel(trip: Trip) {
    setSelected(trip);
    setCancelReason("");
    setCancelProof(null);
    setOpenView(false);
    setOpenCancel(true);
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
    const loading = toast.loading("Updating OB trip...");
    try {
      const res = await fetch(`/api/reservations/ob_reservations/${selected.ob_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      toast.dismiss(loading);

      if (!res.ok) {
        toast.error(json?.error ?? "Failed to update OB trip");
        queryClient.invalidateQueries({ queryKey: ["obAvailability"], exact: false });
        return;
      }

      toast.success("OB trip has been updated");
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

  async function handleCancel() {
    if (!selected) return;
    if (!cancelReason.trim()) return toast.error("Please enter a reason for cancellation");
    if (!cancelProof) return toast.error("Please attach a proof file");

    setBusy(true);
    const loading = toast.loading("Cancelling OB trip...");
    try {
      const fd = new FormData();
      fd.append("ob_id", selected.ob_id);
      fd.append("reason", cancelReason.trim());
      fd.append("proof", cancelProof);

      const res = await fetch("/api/reservations/ob_reservations/cancel", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      toast.dismiss(loading);

      if (!res.ok) {
        toast.error(json?.error ?? "Failed to cancel OB trip");
        return;
      }

      toast.success("Cancellation request has been sent");
      setOpenCancel(false);
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

  async function handleDone(trip: Trip) {
    if (!isFinished(trip)) return toast.error("This trip has not finished yet");

    setBusy(true);
    const loading = toast.loading("Marking trip as done...");
    try {
      const res = await fetch(`/api/reservations/ob_reservations/action/${trip.ob_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DONE" }),
      });
      const json = await res.json();
      toast.dismiss(loading);

      if (!res.ok) {
        toast.error(json?.error ?? "Failed to mark trip as done");
        return;
      }

      toast.success("Trip has been marked as done");
      setOpenView(false);
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
        toast.error(json?.error ?? "Failed to delete OB trip");
        return;
      }

      toast.success("OB trip has been deleted");
      setOpenDelete(false);
      setSelected(null);
      refresh();
    } catch (err) {
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ view
  const viewActions = selected ? getActions(selected) : null;

  return (
    <div className="flex flex-col gap-3">
      {showHeading && <p className="text-base font-semibold">OB Trips</p>}

      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>OB ID</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Passengers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Spinner />
                    <span>Loading OB trips</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  <EmptyState title="No OB trip found" description="Book an OB trip to see it here." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((trip, index) => {
                const actions = getActions(trip);
                return (
                  <TableRow key={trip.ob_id}>
                    <TableCell className="font-medium">
                      {index + 1 + (currentPage - 1) * limit}
                    </TableCell>
                    <TableCell className="font-medium">{trip.ob_id}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{trip.purpose}</TableCell>
                    <TableCell>{trip.destination}</TableCell>
                    <TableCell>
                      {trip.vehicle.map((v) => v.vehicle_name).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{format(new Date(trip.time_from), "MMM d, h:mm a")}</TableCell>
                    <TableCell>{format(new Date(trip.time_to), "MMM d, h:mm a")}</TableCell>
                    <TableCell>{trip.passengers_qty}</TableCell>
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
                              <DropdownMenuItem onClick={() => startEdit(trip)}>
                                Edit
                              </DropdownMenuItem>
                            )}
                            {actions.cancel && (
                              <DropdownMenuItem onClick={() => startCancel(trip)}>
                                Cancel
                              </DropdownMenuItem>
                            )}
                            {actions.done && (
                              <DropdownMenuItem
                                disabled={!isFinished(trip) || busy}
                                onClick={() => handleDone(trip)}
                              >
                                Done
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

      <Pagination className="justify-center lg:justify-end">
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

      {/* ------------------------------------------------------------ view */}
      {openView && selected && viewActions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl max-h-[85vh] overflow-y-auto relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8 rounded-full"
              onClick={() => setOpenView(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            <CardHeader>
              <CardTitle>OB Trip Detail</CardTitle>
              <CardDescription>OB ID: {selected.ob_id}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              <Detail label="Reserved By" value={selected.ob_user?.name ?? "—"} />
              <Detail label="Purpose" value={selected.purpose} />
              <Detail label="Destination" value={selected.destination} />
              <Detail
                label="Vehicles"
                value={
                  selected.vehicle
                    .map((v) => v.vehicle_name + (v.plate_number ? ` (${v.plate_number})` : ""))
                    .join(", ") || "—"
                }
              />
              <Detail label="Driver" value={driverList(selected)} />
              <div className="grid grid-cols-2 gap-3">
                <Detail
                  label="Departure"
                  value={format(new Date(selected.time_from), "MMM d, yyyy h:mm a")}
                />
                <Detail
                  label="Return"
                  value={format(new Date(selected.time_to), "MMM d, yyyy h:mm a")}
                />
              </div>
              <Detail label="Passengers" value={String(selected.passengers_qty)} />
              <Detail label="Other Request" value={selected.other_request || "—"} />
              <Detail label="Status" value={statusLabel(selected.status)} />

              {cancellationData?.cancellation && (
                <div>
                  <label className="text-xs text-muted-foreground">Cancellation Reason</label>
                  <p className="font-medium">{cancellationData.cancellation.reason}</p>
                  <label className="text-xs text-muted-foreground mt-2 block">Proof</label>
                  <a
                    href={`/api/uploads/cancellations/${cancellationData.cancellation.path.split("/").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm font-medium"
                  >
                    {cancellationData.cancellation.file_name}
                  </a>
                </div>
              )}
            </CardContent>

            {/* Same layout as the hall card: the wide button beside the small
                Delete is Edit while that is allowed, otherwise Cancel. */}
            <div className="flex flex-col gap-2 p-4 pt-0">
              {viewActions.done && (
                <Button
                  className="w-full bg-blue-700 rounded-sm py-5 text-white font-medium"
                  disabled={busy || !isFinished(selected)}
                  onClick={() => handleDone(selected)}
                >
                  {isFinished(selected) ? "Mark as Done" : "Mark as Done (not yet finished)"}
                </Button>
              )}

              {selected.status === "DONE" ? (
                // Finished trip: only its receipt and Delete remain.
                <div className="flex flex-col lg:flex-row gap-2">
                  <Button
                    className="w-full lg:flex-1 bg-brand rounded-sm py-5 text-white font-medium"
                    onClick={() =>
                      downloadReceipt({
                        kind: "OB Trip",
                        id: selected.ob_id,
                        requester: {
                          name: selected.ob_user?.name ?? session?.user?.name,
                          email: session?.user?.email,
                        },
                        details: [
                          ["Purpose", selected.purpose],
                          ["Destination", selected.destination],
                          [
                            "Vehicles",
                            selected.vehicle
                              .map((v) => v.vehicle_name + (v.plate_number ? ` (${v.plate_number})` : ""))
                              .join(", "),
                          ],
                          ["Driver", driverList(selected)],
                          ["Departure", format(new Date(selected.time_from), "MMM d, yyyy h:mm a")],
                          ["Return", format(new Date(selected.time_to), "MMM d, yyyy h:mm a")],
                          ["Passengers", String(selected.passengers_qty)],
                          ["Other Request", selected.other_request || "None"],
                        ],
                        filedAt: selected.createdAt,
                        completedAt: selected.updatedAt,
                      }).catch(() => toast.error("Failed to generate receipt"))
                    }
                  >
                    <Download className="h-4 w-4" />
                    Download Receipt
                  </Button>
                  <DeleteButton small onClick={() => setOpenDelete(true)} />
                </div>
              ) : viewActions.edit ? (
                <>
                  <div className="flex flex-col lg:flex-row gap-2">
                    <Button
                      className="w-full lg:flex-1 bg-brand rounded-sm py-5 text-white font-medium"
                      onClick={() => startEdit(selected)}
                    >
                      Edit Trip
                    </Button>
                    <DeleteButton small onClick={() => setOpenDelete(true)} />
                  </div>
                  {viewActions.cancel && <CancelButton onClick={() => startCancel(selected)} />}
                </>
              ) : (
                <div className="flex flex-col lg:flex-row gap-2">
                  {viewActions.cancel && (
                    <CancelButton wide onClick={() => startCancel(selected)} />
                  )}
                  <DeleteButton
                    small={viewActions.cancel}
                    onClick={() => setOpenDelete(true)}
                  />
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------ edit */}
      <Sheet open={openEdit} onOpenChange={setOpenEdit}>
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">Edit OB Trip</SheetTitle>
            <SheetDescription className="text-white">
              OB ID: {selected?.ob_id}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
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
                        id={`edit-ob-vehicle-${v.vehicle_id}`}
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
                        id={`edit-ob-driver-${dr.driver_id}`}
                        checked={form.drivers.includes(dr.driver_id)}
                        reason={reason}
                        onToggle={() => toggle("drivers", dr.driver_id)}
                        label={dr.driver_name}
                      />
                    );
                  })}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-ob-driver-personal"
                      checked={form.personal_driver}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          personal_driver: checked === true,
                          driver_name: checked === true ? form.driver_name : "",
                        })
                      }
                    />
                    <label htmlFor="edit-ob-driver-personal" className="font-normal cursor-pointer">
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
              Update OB Trip
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full rounded-sm py-5 font-medium">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ---------------------------------------------------------- cancel */}
      <Dialog
        open={openCancel}
        onOpenChange={(open) => {
          setOpenCancel(open);
          if (!open) {
            setCancelReason("");
            setCancelProof(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">Cancel this OB trip?</DialogTitle>
            <DialogDescription className="text-gray-600">
              This sends a cancellation request
              {selected ? ` for your trip to ${selected.destination}` : ""}. Please
              provide a reason and supporting proof.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <Field label="Reason for Cancellation">
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this trip is being cancelled"
                className="resize-none rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </Field>
            <Field label="Proof (image or document)">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setCancelProof(e.target.files?.[0] ?? null)}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {cancelProof && (
                <p className="text-xs text-muted-foreground">Selected: {cancelProof.name}</p>
              )}
            </Field>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenCancel(false)} disabled={busy}>
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {busy ? "Cancelling..." : "Cancel Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------- delete */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete this OB trip?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This removes the trip from your list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpenView(false);
                handleDelete();
              }}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {busy ? "Deleting..." : "Delete"}
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

function CancelButton({ onClick, wide }: { onClick: () => void; wide?: boolean }) {
  return (
    <Button
      className={`w-full ${wide ? "lg:flex-1" : ""} bg-yellow-600 rounded-sm py-5 text-white font-medium`}
      onClick={onClick}
    >
      Cancel Trip
    </Button>
  );
}

function DeleteButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <Button
      className={`w-full ${small ? "lg:w-20" : ""} bg-red-600 rounded-sm py-5 text-white font-medium`}
      onClick={onClick}
    >
      <Trash className="h-4 w-4 text-white" />
      <p className={small ? "block lg:hidden" : "ml-2"}>Delete</p>
    </Button>
  );
}
