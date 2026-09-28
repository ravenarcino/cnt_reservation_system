"use client";

import { FormSection, FieldLabel } from "@/components/booking/form-parts";
import { DetailGrid, DetailItem } from "@/components/booking/detail-parts";

import { FilterStrip, PageHeader, Segmented, TodayPill } from "@/components/management/parts";
import { TypeChips } from "@/components/management/type-chips";

import { EmptyState } from "@/components/ui/empty-state";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Check, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
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
  PaginationEllipsis,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  SheetTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { toast } from "sonner";
import { todayStatus } from "@/lib/ob-today";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

// type Employee = {
//   id: number;
//   user_id: string;
//   name: string;
//   department: string;
//   role: string;
//   email: string;
//   systemRole: string;
//   status: string;
// };

type VehicleType = {
  id: number;
  type_id: string;
  type: string;
};

type Vehicle = {
  id: number;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_brand?: string;
  plate_number?: string;
  capacity?: number | null;
  vehicle_type: string;
  status: string;
};

export default function VehiclePage() {
  const [openType, setOpenType] = useState(false);
  const [openVehicle, setOpenVehicle] = useState(false);
  const [openTypeForm, setOpenTypeForm] = useState(false);
  const [openVehicleForm, setOpenVehicleForm] = useState(false);
  const [openTypeEditForm, setOpenTypeEditForm] = useState(false);
  const [openVehicleEditForm, setOpenVehicleEditForm] = useState(false);
  const [openTypeDialog, setOpenTypeDialog] = useState(false);
  const [openVehicleDialog, setOpenVehicleDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const queryClient = useQueryClient();

  const [typeForm, setTypeForm] = useState({
    name: "",
  });
  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    vehicle_brand: "",
    plate_number: "",
    capacity: "",
    vehicle_type: "",
    status: "AVAILABLE",
  });
  const [editTypeForm, setEditTypeForm] = useState({
    name: "",
  });
  const [editVehicleForm, setEditVehicleForm] = useState({
    name: "",
    vehicle_brand: "",
    plate_number: "",
    capacity: "",
    vehicle_type: "",
    status: "AVAILABLE",
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [returningVehicleId, setReturningVehicleId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [status, setStatus] = useState("all");

  // filters
  const [search, setSearch] = useState("");
  // const [role, setRole] = useState("all");
  // const [department, setDepartment] = useState("all");
  // const [status, setStatus] = useState("all");

  const handleCreateVehicleType = async () => {
    // Validation
    if (!typeForm.name.trim()) {
      toast.error("Please enter a type name");
      return;
    }
    
    const loadingToast = toast.loading("Creating vehicle type ...");

    try {
      const res = await fetch("/api/vehicles/types/type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...typeForm,
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.error ?? data?.error ?? "Failed to create vehicle type");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New vehicle type has been created`);

      setOpenTypeForm(false);
      setTypeForm({
        name: "",
      });

      queryClient.invalidateQueries({
        queryKey: ["vehicleType"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleCreateVehicle = async () => {
    // Validation
    if (!vehicleForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!vehicleForm.vehicle_type.trim()) {
      toast.error("Please select a type");
      return;
    }
    if (!vehicleForm.status.trim()) {
      toast.error("Please select a status");
      return;
    }
    
    const loadingToast = toast.loading("Creating vehicle ...");

    try {
      const res = await fetch("/api/vehicles/vehicles/vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...vehicleForm,
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.error ?? data?.error ?? "Failed to create vehicle");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New vehicle has been created`);

      setOpenVehicleForm(false);
      setVehicleForm({
        name: "",
        vehicle_brand: "",
        plate_number: "",
        capacity: "",
        vehicle_type: "",
        status: "AVAILABLE",
      });

      queryClient.invalidateQueries({
        queryKey: ["vehicle"],
        exact: false,
      });

      // Type cards show how many vehicles each type has - refresh them too.
      queryClient.invalidateQueries({ queryKey: ["vehicleType"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const { data: vehicleTypeData, isLoading: vehicleTypeLoading } = useQuery({
    queryKey: ["vehicleType", page, search],
    queryFn: async () => {

      const res = await fetch(`/api/vehicles/types/type`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const { data: vehicleData, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", page, search, selectedTypeFilter, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(selectedTypeFilter && { vehicle_type: selectedTypeFilter }),
        ...(status && status !== "all" && { status }),
      });

      const res = await fetch(`/api/vehicles/vehicles/vehicle?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const handleUpdateVehicleType  = async () => {
    if (!selectedType) return;

    // Validation
    if (!editTypeForm.name.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const loadingToast = toast.loading("Updating vehicle type...");       

    try {
      const res = await fetch(`/api/vehicles/types/${selectedType.type_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editTypeForm,
        }),
      });

      const data = await res.json();

      // UX delay (same as create/delete)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.message ?? data?.error ?? "Failed to update vehicle type");
        console.log("Error:", data);
        return;
      }

      toast.success("Vehicle type has been updated");

      setOpenTypeForm(false);
      setSelectedType(null);

      queryClient.invalidateQueries({
        queryKey: ["vehicleType"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  // Puts a vehicle that is back from a trip into circulation again.
  // Only the super admin does this - it is the single point where physical
  // The super admin confirms the vehicle is physically back.
  const handleReturnVehicle = async (vehicle: Vehicle) => {
    if (vehicle.status !== "IN_USE") {
      toast.error("This vehicle is not out on a trip");
      return;
    }

    const loadingToast = toast.loading("Marking vehicle as available...");
    setReturningVehicleId(vehicle.vehicle_id);

    try {
      const res = await fetch(`/api/vehicles/vehicles/${vehicle.vehicle_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Only `status` is sent - Prisma leaves fields it never receives
        // untouched, so the vehicle's name, brand and type are preserved.
        body: JSON.stringify({ status: "AVAILABLE" }),
      });

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setReturningVehicleId(null);

      if (!res.ok) {
        toast.error(data?.message ?? "Failed to mark vehicle as available");
        console.log("Error:", data);
        return;
      }

      toast.success(`"${vehicle.vehicle_name}" is now available`);

      queryClient.invalidateQueries({
        queryKey: ["vehicle"],
        exact: false,
      });

      // Type cards show how many vehicles each type has - refresh them too.
      queryClient.invalidateQueries({ queryKey: ["vehicleType"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      setReturningVehicleId(null);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleUpdateVehicle  = async () => {
    if (!selectedVehicle) return;

    // Validation
    if (!editVehicleForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!editVehicleForm.vehicle_type.trim()) {
      toast.error("Please select a type");
      return;
    }
    if (!editVehicleForm.status.trim()) {
      toast.error("Please select a status");
      return;
    }

    const loadingToast = toast.loading("Updating vehicle...");       

    try {
      const res = await fetch(`/api/vehicles/vehicles/${selectedVehicle.vehicle_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editVehicleForm,
        }),
      });

      const data = await res.json();

      // UX delay (same as create/delete)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.message ?? data?.error ?? "Failed to update vehicle");
        console.log("Error:", data);
        return;
      }

      toast.success("Vehicle has been updated");

      setOpenVehicleForm(false);
      setSelectedVehicle(null);

      queryClient.invalidateQueries({
        queryKey: ["vehicle"],
        exact: false,
      });

      // Type cards show how many vehicles each type has - refresh them too.
      queryClient.invalidateQueries({ queryKey: ["vehicleType"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteVehicleType = async () => {
    if (!selectedType) return;

    const loadingToast = toast.loading("Deleting vehicle type...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/vehicles/types/${selectedType.type_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deletedBy: "OB_ADMIN",
        }),
      });

      const data = await res.json();

      // UX delay (same pattern as create)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.message ?? data?.error ?? "Failed to delete vehicle type");
        console.log("Error:", data);
        return;
      }

      toast.success(`Vehicle type has been deleted`);

      setOpenTypeDialog(false);
      setSelectedType(null);
      setDeleting(false);

      queryClient.invalidateQueries({
        queryKey: ["vehicleType"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;

    const loadingToast = toast.loading("Deleting vehicle...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/vehicles/vehicles/${selectedVehicle.vehicle_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deletedBy: "OB_ADMIN",
        }),
      });

      const data = await res.json();

      // UX delay (same pattern as create)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(data?.message ?? data?.error ?? "Failed to delete vehicle");
        console.log("Error:", data);
        return;
      }

      toast.success(`Vehicle has been deleted`);

      setOpenVehicleDialog(false);
      setSelectedVehicle(null);
      setDeleting(false);

      queryClient.invalidateQueries({
        queryKey: ["vehicle"],
        exact: false,
      });

      // Type cards show how many vehicles each type has - refresh them too.
      queryClient.invalidateQueries({ queryKey: ["vehicleType"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const vehicles: Vehicle[] = vehicleData?.data ?? [];

  // Every vehicle (unfiltered) for the "today" summary strip.
  const { data: allVehicleData } = useQuery({
    queryKey: ["vehicle", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles/vehicles/vehicle?limit=500");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: Vehicle[]; total: number };
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

  function vehicleToday(vehicle: Vehicle) {
    const trips = (obTripData?.data ?? []).filter((t: any) =>
      t.vehicle?.some((v: { vehicle_id: string }) => v.vehicle_id === vehicle.vehicle_id),
    );
    const manual =
      vehicle.status === "MAINTENANCE"
        ? "Maintenance"
        : vehicle.status === "IN_USE"
          ? "Marked in use"
          : null;
    return todayStatus(trips, manual);
  }
  const totalItems = vehicleData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const vehicleTypes: VehicleType[] = vehicleTypeData?.data ?? [];
  const totalVehicleTypes = vehicleTypeData?.total ?? 0;
  const totalPagesVehicleTypes = Math.ceil(totalVehicleTypes / limit) || 1;

  // const filteredEmployees = employees.filter((t) => {
  //   const matchSearch =
  //     t.user_id.toLowerCase().includes(search.toLowerCase()) ||
  //     t.name.toLowerCase().includes(search.toLowerCase()) ||
  //     t.email.toLowerCase().includes(search.toLowerCase()) 

  //   const matchRole =
  //     role === "all" || t.role.toLowerCase() === role.toLowerCase();

  //   const matchStatus =
  //     status === "all" || t.status.toLowerCase() === status.toLowerCase();

  //   return matchSearch && matchStatus && matchRole;
  // });

  // const { data: rolesData } = useQuery({
  //   queryKey: ["employee-roles"],
  //   queryFn: async () => {
  //   const params = new URLSearchParams({
  //     rolesOnly: "true",
  //   //   systemRole: "USER",
  //   });
    
  //     const res = await fetch(`/api/users/role?${params}`);
  //     const json = await res.json();
  //     console.log("roles response:", json);
  //     if (!res.ok) throw new Error(json?.error);
  //     return json;
  //   },
  // });

  // const { data: departmentsData } = useQuery({
  //   queryKey: ["departments"],
  //   queryFn: async () => {
  //       const params = new URLSearchParams({
  //       departmentsOnly: "true",
  //       });

  //       const res = await fetch(`/api/users/department?${params}`);
  //       const json = await res.json();
  //       console.log("departments response:", json);

  //       if (!res.ok) throw new Error(json?.error);

  //       return json;
  //   },
  //   });

  const vehicleTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    vehicleTypeData?.data?.forEach((type: any) => {
      map[type.type_id] = type.type;
    });
    return map;
  }, [vehicleTypeData]);



  // Today's status for every vehicle, grouped for the summary strip.
  const allVehicles = allVehicleData?.data ?? [];
  const bucket = (v: Vehicle) => {
    if (v.status === "MAINTENANCE") return "MAINTENANCE";
    if (v.status === "IN_USE") return "IN_USE";
    const label = vehicleToday(v).label;
    return label.startsWith("On trip") ? "ON_TRIP" : label.startsWith("Booked") ? "BOOKED" : "FREE";
  };

  return (
    <div className="h-full flex flex-col gap-5">
      <PageHeader title="Vehicles" count={allVehicleData?.total ?? totalItems} subtitle="Company vehicles for OB trips">
        <Button onClick={() => setOpenVehicleForm(true)}>+ Add vehicle</Button>
      </PageHeader>

      <FilterStrip
        title="Fleet today"
        total={allVehicles.length}
        active={status === "AVAILABLE" ? "FREE" : status}
        onSelect={(key) => {
          // Only the manual statuses can filter the list server-side.
          setStatus(["IN_USE", "MAINTENANCE"].includes(key) ? key : key === "FREE" ? "AVAILABLE" : "all");
          setPage(1);
        }}
        items={[
          { key: "FREE", label: "Free now", color: "#10b981", count: allVehicles.filter((v) => bucket(v) === "FREE").length },
          { key: "BOOKED", label: "Booked later today", color: "#f59e0b", count: allVehicles.filter((v) => bucket(v) === "BOOKED").length },
          { key: "ON_TRIP", label: "On a trip", color: "#ef4444", count: allVehicles.filter((v) => bucket(v) === "ON_TRIP").length },
          { key: "IN_USE", label: "Marked in use", color: "#f97316", count: allVehicles.filter((v) => bucket(v) === "IN_USE").length },
          { key: "MAINTENANCE", label: "Maintenance", color: "#a3a3a3", count: allVehicles.filter((v) => bucket(v) === "MAINTENANCE").length },
        ]}
      />

      <TypeChips
        label="Vehicle types"
        loading={vehicleTypeLoading}
        total={allVehicles.length}
        active={selectedTypeFilter}
        onSelect={(id) => {
          setSelectedTypeFilter(id);
          setPage(1);
        }}
        items={(vehicleTypeData?.data ?? [])
          .filter((t: any) => !t.deletedAt)
          .map((t: any) => ({ id: t.type_id, name: t.type, count: t._count?.vehicles ?? 0 }))}
        onAdd={() => setOpenTypeForm(true)}
        onEdit={(id) => {
          const t = (vehicleTypeData?.data ?? []).find((x: any) => x.type_id === id);
          if (!t) return;
          setSelectedType(t);
          setEditTypeForm({ name: t.type });
          setOpenTypeEditForm(true);
        }}
        onDelete={(id) => {
          const t = (vehicleTypeData?.data ?? []).find((x: any) => x.type_id === id);
          if (!t) return;
          setSelectedType(t);
          setOpenTypeDialog(true);
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, brand or plate"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:max-w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="IN_USE">In use</SelectItem>
              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            {vehicleLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading vehicles</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : vehicles.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <EmptyState
                      title="No vehicles found"
                      description="Try another filter, or add a vehicle."
                      action={<Button size="sm" onClick={() => setOpenVehicleForm(true)}>+ Add vehicle</Button>}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead className="text-right">Seats</TableHead>
                    <TableHead>Today</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {vehicles.map((vehicle) => (
                    <TableRow
                      key={vehicle.vehicle_id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        // The action menu renders in a portal; ignore its clicks.
                        if (!e.currentTarget.contains(e.target as Node)) return;
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSelectedVehicle(vehicle);
                        setOpenVehicle(true);
                      }}
                    >
                      <TableCell>
                        <p className="font-medium">{vehicle.vehicle_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle.vehicle_brand || "—"} · <span className="font-mono">{vehicle.vehicle_id}</span>
                        </p>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex rounded border border-border bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {vehicleTypeMap[vehicle.vehicle_type] ?? vehicle.vehicle_type}
                        </span>
                      </TableCell>

                      <TableCell>
                        {vehicle.plate_number ? (
                          <span className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider">
                            {vehicle.plate_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">{vehicle.capacity ?? "—"}</TableCell>

                      <TableCell>
                        <TodayPill {...vehicleToday(vehicle)} />
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost">
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent className="">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedVehicle(vehicle);
                                  setOpenVehicle(true);
                                }}
                              >
                                View
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedVehicle(vehicle);
                                  setEditVehicleForm({
                                    name: vehicle.vehicle_name,
                                    vehicle_brand: vehicle.vehicle_brand || "",
                                    plate_number: vehicle.plate_number || "",
                                    capacity:
                                      vehicle.capacity != null
                                        ? String(vehicle.capacity)
                                        : "",
                                    vehicle_type: vehicle.vehicle_type,
                                    status: vehicle.status,
                                  });
                                  setOpenVehicleEditForm(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>

                              {vehicle.status === "IN_USE" && (
                                <DropdownMenuItem
                                  disabled={returningVehicleId === vehicle.vehicle_id}
                                  onClick={() => handleReturnVehicle(vehicle)}
                                >
                                  Mark Available
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedVehicle(vehicle);
                                  setOpenVehicleDialog(true);
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </>
            )}
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

      <Sheet open={openVehicleForm} onOpenChange={setOpenVehicleForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              New vehicle
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in vehicle details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Vehicle" hint="How it appears when users book a trip.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    placeholder="e.g. Service Van 1"
                    value={vehicleForm.name}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Brand</FieldLabel>
                  <Input
                    placeholder="e.g. Toyota Hiace"
                    value={vehicleForm.vehicle_brand}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_brand: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Registration and seats" hint="Seats is how many passengers it can take.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Plate number</FieldLabel>
                  <Input
                    placeholder="e.g. ABC 1234"
                    value={vehicleForm.plate_number}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Seats</FieldLabel>
                  <Input type="number" min={1}
                    placeholder="e.g. 12"
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={3} title="Type and status" hint="">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Vehicle type</FieldLabel>
                <Select value={vehicleForm.vehicle_type} onValueChange={(value) => setVehicleForm({ ...vehicleForm, vehicle_type: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(vehicleTypeData?.data ?? [])
                        .filter((t: any) => !t.deletedAt)
                        .map((t: any) => (
                          <SelectItem key={t.type_id} value={t.type_id}>
                            {t.type}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Status</FieldLabel>
                <Segmented
                  value={vehicleForm.status as "AVAILABLE" | "IN_USE" | "MAINTENANCE"}
                  onChange={(v) => setVehicleForm({ ...vehicleForm, status: v })}
                  options={[{ value: "AVAILABLE", label: "Available" }, { value: "IN_USE", label: "In use" }, { value: "MAINTENANCE", label: "Maintenance" }]}
                />
              </div>
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateVehicle}
              className="w-full h-10"
            >
              Add vehicle
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full h-10"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openTypeForm} onOpenChange={setOpenTypeForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              New vehicle type
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in vehicle type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type Name</label>
              <Input
                type="name"
                placeholder="Vehicle Type Name"
                className=""
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateVehicleType}
              className="w-full h-10"
            >
              Create Vehicle Type
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full h-10"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openVehicle} onOpenChange={setOpenVehicle}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Vehicle
            </SheetTitle>
            <SheetDescription className="text-white">
              Review vehicle details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <div className="rounded-lg border border-border bg-neutral-50 p-4">
              <p className="font-mono text-[11px] text-muted-foreground">{selectedVehicle?.vehicle_id}</p>
              <p className="mt-1 text-lg font-semibold">{selectedVehicle?.vehicle_name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {selectedVehicle?.plate_number && (
                  <span className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider">
                    {selectedVehicle.plate_number}
                  </span>
                )}
                {selectedVehicle && <TodayPill {...vehicleToday(selectedVehicle)} />}
              </div>
            </div>
            <DetailGrid>
              <DetailItem label="Brand" value={selectedVehicle?.vehicle_brand} />
              <DetailItem
                label="Type"
                value={selectedVehicle ? vehicleTypeMap[selectedVehicle.vehicle_type] ?? selectedVehicle.vehicle_type : ""}
              />
              <DetailItem label="Seats" value={selectedVehicle?.capacity != null ? String(selectedVehicle.capacity) : ""} />
              <DetailItem
                label="Status"
                value={{ AVAILABLE: "Available", IN_USE: "In use", MAINTENANCE: "Maintenance" }[selectedVehicle?.status ?? ""] ?? selectedVehicle?.status}
              />
            </DetailGrid>
          </div>

          <SheetFooter>
            <Button
              onClick={() => {
                setOpenVehicle(false);
                if (selectedVehicle) {
                  setEditVehicleForm({
                    name: selectedVehicle.vehicle_name,
                    vehicle_brand: selectedVehicle.vehicle_brand ?? "",
                    plate_number: selectedVehicle.plate_number ?? "",
                    capacity:
                      selectedVehicle.capacity != null
                        ? String(selectedVehicle.capacity)
                        : "",
                    vehicle_type: selectedVehicle.vehicle_type,
                    status: selectedVehicle.status,
                  });
                }
                setOpenVehicleEditForm(true);
              }}
              className="w-full h-10"
            >
              Edit
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenVehicleDialog(true)}
                className="w-full h-10"
              >
                Delete
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openType} onOpenChange={setOpenType}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Vehicle type
            </SheetTitle>
            <SheetDescription className="text-white">
              Review vehicle type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="font-mono text-xs text-muted-foreground">
              Type ID: {selectedType?.type_id}
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type Name</label>
              <p className="text-sm font-medium">{(selectedType?.type ?? "") || "—"}</p>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => {
                setOpenType(false);
                if (selectedType) {
                  setEditTypeForm({
                    name: selectedType.type,
                  });
                }
                setOpenTypeEditForm(true);
              }}
              className="w-full h-10"
            >
              Edit Type
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenTypeDialog(true)}
                className="w-full h-10"
              >
                Delete Type
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openVehicleEditForm} onOpenChange={setOpenVehicleEditForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit vehicle
            </SheetTitle>
            <SheetDescription className="text-white">
              Update vehicle details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Vehicle" hint="How it appears when users book a trip.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    placeholder="e.g. Service Van 1"
                    value={editVehicleForm.name}
                    onChange={(e) => setEditVehicleForm({ ...editVehicleForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Brand</FieldLabel>
                  <Input
                    placeholder="e.g. Toyota Hiace"
                    value={editVehicleForm.vehicle_brand}
                    onChange={(e) => setEditVehicleForm({ ...editVehicleForm, vehicle_brand: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Registration and seats" hint="Seats is how many passengers it can take.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Plate number</FieldLabel>
                  <Input
                    placeholder="e.g. ABC 1234"
                    value={editVehicleForm.plate_number}
                    onChange={(e) => setEditVehicleForm({ ...editVehicleForm, plate_number: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Seats</FieldLabel>
                  <Input type="number" min={1}
                    placeholder="e.g. 12"
                    value={editVehicleForm.capacity}
                    onChange={(e) => setEditVehicleForm({ ...editVehicleForm, capacity: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={3} title="Type and status" hint="">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Vehicle type</FieldLabel>
                <Select value={editVehicleForm.vehicle_type} onValueChange={(value) => setEditVehicleForm({ ...editVehicleForm, vehicle_type: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(vehicleTypeData?.data ?? [])
                        .filter((t: any) => !t.deletedAt)
                        .map((t: any) => (
                          <SelectItem key={t.type_id} value={t.type_id}>
                            {t.type}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Status</FieldLabel>
                <Segmented
                  value={editVehicleForm.status as "AVAILABLE" | "IN_USE" | "MAINTENANCE"}
                  onChange={(v) => setEditVehicleForm({ ...editVehicleForm, status: v })}
                  options={[{ value: "AVAILABLE", label: "Available" }, { value: "IN_USE", label: "In use" }, { value: "MAINTENANCE", label: "Maintenance" }]}
                />
              </div>
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateVehicle}
              className="w-full h-10"
            >
              Update Vehicle
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full h-10"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openTypeEditForm} onOpenChange={setOpenTypeEditForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit vehicle type
            </SheetTitle>
            <SheetDescription className="text-white">
              Update vehicle type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="font-mono text-xs text-muted-foreground">
              Vehicle Type ID: {selectedType?.type_id}
            </label>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={editTypeForm.name}
                onChange={(e) =>
                  setEditTypeForm({ ...editTypeForm, name: e.target.value })
                }
                className=""
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateVehicleType}
              className="w-full h-10"
            >
              Update Vehicle Type
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full h-10"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={openVehicleDialog} onOpenChange={setOpenVehicleDialog}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete this vehicle?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVehicle}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={openTypeDialog} onOpenChange={setOpenTypeDialog}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete this vehicle type?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVehicleType}
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
