"use client";

import { FilterStrip, PageHeader, Segmented, TodayPill } from "@/components/management/parts";
import { FormSection, FieldLabel } from "@/components/booking/form-parts";
import { Person } from "@/components/dashboard/admin-tables";

import { EmptyState } from "@/components/ui/empty-state";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Search } from "lucide-react";
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
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { todayStatus } from "@/lib/ob-today";

type Driver = {
  id: number;
  driver_id: string;
  driver_name: string;
  contact_number: string | null;
  status: "AVAILABLE" | "ON_LEAVE";
  userId?: string | null;
  user?: { user_id: string; name: string; email: string } | null;
};

// userId "none" = no login account linked (Select cannot hold an empty value).
const emptyForm = { driver_name: "", contact_number: "", status: "AVAILABLE", userId: "none" };

export default function DriverPage() {
  const queryClient = useQueryClient();
  const limit = 10;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  // One sheet serves both create and edit: `editing` is null when creating.
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["driver", page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(status !== "all" && { status }),
      });
      const res = await fetch(`/api/drivers/driver?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const drivers: Driver[] = data?.data ?? [];

  // Login accounts with the Driver system role, for the "Login Account" field.
  const { data: accountData } = useQuery({
    queryKey: ["driverAccounts"],
    queryFn: async () => {
      const res = await fetch("/api/drivers/accounts");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as {
        data: { user_id: string; name: string; email: string; linkedTo: string | null }[];
      };
    },
  });

  // Every OB trip, to work out who and what is out today.
  const { data: obTripData } = useQuery({
    queryKey: ["obReservation", "all"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  function driverToday(driver: Driver) {
    const trips = (obTripData?.data ?? []).filter((t: any) =>
      t.drivers?.some((dr: { driver_id: string }) => dr.driver_id === driver.driver_id),
    );
    return todayStatus(trips, driver.status === "ON_LEAVE" ? "On leave" : null);
  }
  const totalPages = Math.ceil((data?.total ?? 0) / limit) || 1;

  // Every driver (unfiltered) for the "today" strip.
  const { data: allDriverData } = useQuery({
    queryKey: ["driver", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/drivers/driver?limit=500");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: Driver[]; total: number };
    },
  });
  const allDrivers: Driver[] = allDriverData?.data ?? [];

  // Approved day offs, to show who is off today.
  const { data: dayOffData } = useQuery({
    queryKey: ["dayoff", "APPROVED"],
    queryFn: async () => {
      const res = await fetch("/api/dayoff?status=APPROVED");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: { driverId: string; date_from: string; date_to: string }[] };
    },
  });
  const offToday = new Set(
    (dayOffData?.data ?? [])
      .filter((d) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return new Date(d.date_from) <= end && new Date(d.date_to) >= start;
      })
      .map((d) => d.driverId),
  );

  // One bucket per driver for the strip. Order matters: leave and day off
  // win over the trip schedule.
  function bucket(driver: Driver) {
    if (driver.status === "ON_LEAVE") return "ON_LEAVE";
    if (offToday.has(driver.driver_id)) return "DAY_OFF";
    const t = driverToday(driver).label;
    if (t.startsWith("On trip")) return "ON_TRIP";
    if (t.startsWith("Booked")) return "BOOKED";
    return "FREE";
  }
  function todayOf(driver: Driver) {
    if (driver.status !== "ON_LEAVE" && offToday.has(driver.driver_id)) {
      return { label: "Day off", tone: "text-red-600" };
    }
    return driverToday(driver);
  }

  // A strip bucket filters on the client (the API only knows the manual
  // status); the table then shows every match without paging.
  const [today, setToday] = useState("all");
  const q = search.trim().toLowerCase();
  const rows: Driver[] =
    today === "all"
      ? drivers
      : allDrivers.filter(
          (d) =>
            bucket(d) === today &&
            (!q ||
              d.driver_name.toLowerCase().includes(q) ||
              d.driver_id.toLowerCase().includes(q) ||
              (d.contact_number ?? "").toLowerCase().includes(q)),
        );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  }

  function openEdit(driver: Driver) {
    setEditing(driver);
    setForm({
      driver_name: driver.driver_name,
      contact_number: driver.contact_number ?? "",
      status: driver.status,
      userId: driver.userId ?? "none",
    });
    setOpenForm(true);
  }

  async function handleSave() {
    if (!form.driver_name.trim()) {
      toast.error("Please enter the driver's name");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading(
      editing ? "Updating driver..." : "Creating driver...",
    );

    try {
      const res = await fetch(
        editing ? `/api/drivers/${editing.driver_id}` : "/api/drivers/driver",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, userId: form.userId === "none" ? null : form.userId }),
        },
      );
      const json = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(json?.error ?? json?.message ?? "Failed to save driver");
        return;
      }

      toast.success(editing ? "Driver has been updated" : "Driver has been created");
      setOpenForm(false);
      queryClient.invalidateQueries({ queryKey: ["driver"], exact: false });
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/drivers/${toDelete.driver_id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.message ?? "Failed to delete driver");
        return;
      }

      toast.success("Driver has been deleted");
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["driver"], exact: false });
    } catch (err) {
      toast.error("Something went wrong");
      console.log("error", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="h-full flex flex-col gap-5">
      <PageHeader title="Drivers" count={allDriverData?.total ?? data?.total} subtitle="Company drivers for OB trips">
        <Button onClick={openCreate}>+ Add driver</Button>
      </PageHeader>

      <FilterStrip
        title="Drivers today"
        total={allDrivers.length}
        active={today}
        onSelect={(key) => {
          setToday(key);
          setStatus("all");
          setPage(1);
        }}
        items={[
          { key: "FREE", label: "Free now", color: "#10b981", count: allDrivers.filter((d) => bucket(d) === "FREE").length },
          { key: "BOOKED", label: "Booked later today", color: "#f59e0b", count: allDrivers.filter((d) => bucket(d) === "BOOKED").length },
          { key: "ON_TRIP", label: "On a trip", color: "#ef4444", count: allDrivers.filter((d) => bucket(d) === "ON_TRIP").length },
          { key: "DAY_OFF", label: "Day off", color: "#8b5cf6", count: allDrivers.filter((d) => bucket(d) === "DAY_OFF").length },
          { key: "ON_LEAVE", label: "On leave", color: "#a3a3a3", count: allDrivers.filter((d) => bucket(d) === "ON_LEAVE").length },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID or contact"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setToday("all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="ON_LEAVE">On leave</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Login account</TableHead>
                <TableHead>Today</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading drivers</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <EmptyState
                      title="No drivers found"
                      description="Try another filter, or add a driver."
                      action={<Button size="sm" onClick={openCreate}>+ Add driver</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((driver) => (
                  <TableRow
                    key={driver.driver_id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      // The action menu renders in a portal; ignore its clicks.
                      if (!e.currentTarget.contains(e.target as Node)) return;
                      if ((e.target as HTMLElement).closest("button")) return;
                      openEdit(driver);
                    }}
                  >
                    <TableCell>
                      <Person name={driver.driver_name} sub={driver.driver_id} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {driver.contact_number || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {driver.user ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm">{driver.user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{driver.user.email}</p>
                        </div>
                      ) : (
                        <span className="inline-flex rounded border border-dashed border-neutral-300 px-1.5 py-0.5 text-xs text-muted-foreground">
                          Not linked
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TodayPill {...todayOf(driver)} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost">
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => openEdit(driver)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setToDelete(driver)}>
                              Delete
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

        <Pagination className={today === "all" ? "mt-4 justify-center lg:justify-end" : "hidden"}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  isActive={page === i + 1}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className={
                  page === totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* Create / edit */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              {editing ? "Edit driver" : "New driver"}
            </SheetTitle>
            <SheetDescription className="text-white">
              {editing ? `Driver ID: ${editing.driver_id}` : "Fill in driver details below."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Driver details" hint="Shown to admins when assigning trips.">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Full name</FieldLabel>
                <Input
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.driver_name}
                  onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Contact number</FieldLabel>
                <Input
                  placeholder="e.g. 0917 123 4567"
                  value={form.contact_number}
                  onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                />
              </div>
            </FormSection>

            <FormSection step={2} title="Login account" hint="Lets the driver sign in to see trips and file day offs.">
              <Select value={form.userId} onValueChange={(value) => setForm({ ...form, userId: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Login account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No account</SelectItem>
                    {(accountData?.data ?? [])
                      // Hide accounts already linked to a different driver.
                      .filter((a) => !a.linkedTo || a.linkedTo === editing?.driver_id)
                      .map((a) => (
                        <SelectItem key={a.user_id} value={a.user_id}>
                          {a.name} ({a.email})
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only users with the Driver role appear here. Add one in Employees first.
              </p>
            </FormSection>

            <FormSection step={3} title="Status" hint="On leave marks the driver unavailable for trips.">
              <Segmented
                value={form.status as "AVAILABLE" | "ON_LEAVE"}
                onChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { value: "AVAILABLE", label: "Available" },
                  { value: "ON_LEAVE", label: "On leave" },
                ]}
              />
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-10"
            >
              {editing ? "Save changes" : "Add driver"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full h-10">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete */}
      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete this driver?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {toDelete?.driver_name} will no longer be available for OB trips.
              Past trips keep their record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
