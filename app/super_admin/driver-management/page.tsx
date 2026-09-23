"use client";

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
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Driver Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage company drivers for OB trips
          </p>
        </div>
        <Button className="bg-brand text-white" onClick={openCreate}>
          Add Driver
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search driver"
            className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
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
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Driver ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact Number</TableHead>
                <TableHead>Today&apos;s Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading drivers</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : drivers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <EmptyState title="No drivers found" description="Add a driver to get started." />
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver, index) => (
                  <TableRow key={driver.driver_id}>
                    <TableCell className="font-medium">
                      {index + 1 + (page - 1) * limit}
                    </TableCell>
                    <TableCell className="font-medium">{driver.driver_id}</TableCell>
                    <TableCell>{driver.driver_name}</TableCell>
                    <TableCell>{driver.contact_number ?? "—"}</TableCell>
                    <TableCell>
                      <span className={driverToday(driver).tone}>
                        {driverToday(driver).label}
                      </span>
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
                            <DropdownMenuItem onClick={() => openEdit(driver)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setToDelete(driver)}>
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

        <Pagination className="mt-4 justify-center lg:justify-end">
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
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              {editing ? "Edit Driver" : "New Driver"}
            </SheetTitle>
            <SheetDescription className="text-white">
              {editing ? `Driver ID: ${editing.driver_id}` : "Fill in driver details below."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
              <label>Name</label>
              <Input
                placeholder="e.g. Juan Dela Cruz"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.driver_name}
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Contact Number</label>
              <Input
                placeholder="e.g. 0917 123 4567"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.contact_number}
                onChange={(e) =>
                  setForm({ ...form, contact_number: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Login Account</label>
              <Select
                value={form.userId}
                onValueChange={(value) => setForm({ ...form, userId: value })}
              >
                <SelectTrigger className="w-full rounded-sm">
                  <SelectValue placeholder="Login account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">None</SelectItem>
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
                Users with the Driver system role. Lets the driver sign in to see
                trips and file day offs.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label>Status</label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
              >
                <SelectTrigger className="w-full rounded-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              {editing ? "Update Driver" : "Create Driver"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full rounded-sm py-5 font-medium">
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
