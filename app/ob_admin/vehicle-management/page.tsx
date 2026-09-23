"use client";

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
    status: "",
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
    status: "",
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
        status: "",
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



  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Vehicle Management</h1>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage company vehicles
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-fit">
          <Button
            onClick={() => setOpenTypeForm(true)}
            className="w-full lg:w-fit bg-brand text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Vehicle Type
          </Button>

          <Button
            onClick={() => setOpenVehicleForm(true)}
            className="w-full lg:w-fit bg-brand text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Vehicle
          </Button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search vehicle"
            className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <SelectValue placeholder={"Status"} />
          </SelectTrigger>

          <SelectContent
              position="popper"
              sideOffset={4}
              className="w-fit "
          >
          <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="IN_USE">In Use</SelectItem>
              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
          </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-2">
        {selectedTypeFilter && (
          <button
            onClick={() => {
              setSelectedTypeFilter(null);
              setPage(1);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Filtered by{" "}
            <span className="text-foreground">
              {vehicleTypeMap[selectedTypeFilter] ?? selectedTypeFilter}
            </span>
            <X className="h-3 w-3" />
          </button>
        )}

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex flex-row gap-3 pb-4">
            {vehicleTypeLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-44 shrink-0 rounded-xl border p-4 space-y-2"
                >
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-full mt-3" />
                </div>
              ))
            ) : vehicleTypeData?.data?.length ? (
              vehicleTypeData.data
                .filter((vehicle: any) => !vehicle.deletedAt)
                .map((vtype: any) => {
                  const isActive = selectedTypeFilter === vtype.type_id;
                  return (
                    <div
                      key={vtype.type_id}
                      onClick={() => {
                        setSelectedTypeFilter((prev) =>
                          prev === vtype.type_id ? null : vtype.type_id
                        );
                        setPage(1);
                      }}
                      className={cn(
                        "group relative w-44 shrink-0 cursor-pointer rounded-xl border p-4 transition-all",
                        isActive
                          ? "border-brand bg-brand-soft shadow-sm"
                          : "hover:border-foreground/20 hover:shadow-sm"
                      )}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                          >
                            <Ellipsis className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedType(vtype);
                                setEditTypeForm({
                                  name: vtype.type,
                                });
                                setOpenTypeEditForm(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setSelectedType(vtype);
                                setOpenTypeDialog(true);
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="pr-6">
                        <span
                          className={cn(
                            "font-mono text-[11px] tracking-tight",
                            isActive
                              ? "text-brand"
                              : "text-muted-foreground"
                          )}
                        >
                          {vtype.type_id}
                        </span>

                        <p className="mt-1 text-[15px] font-semibold leading-tight">
                          {vtype.type}
                        </p>

                        <div className="mt-3 flex items-center justify-between border-t pt-2">
                          <span className="text-xs text-muted-foreground">
                            Vehicles
                          </span>

                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-xs font-semibold",
                              isActive
                                ? "bg-brand text-white"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            )}
                          >
                            {(vtype._count?.vehicles ?? 0) ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-sm text-muted-foreground p-4">
                No vehicle types found.
              </p>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            {vehicleLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>
                        Loading vehicle
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : vehicles.length === 0 ? (
              <>
                <TableBody>
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-10 text-muted-foreground"
                    >
                      <EmptyState title="No vehicles found" description="Add a vehicle to get started." />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Vehicle ID</TableHead>
                    <TableHead>Vehicle Name</TableHead>
                    <TableHead>Vehicle Brand</TableHead>
                    <TableHead>Plate Number</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead>Today&apos;s Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {vehicles.map((vehicle, index) => (
                    <TableRow
                      key={vehicle.vehicle_id}
                    >
                      <TableCell className="font-medium">
                        {index + 1 + (page - 1) * limit}
                      </TableCell>

                      <TableCell className="font-medium">
                        {vehicle.vehicle_id}
                      </TableCell>

                      <TableCell>{vehicle.vehicle_name}</TableCell>

                      <TableCell>{vehicle.vehicle_brand}</TableCell>

                      <TableCell>{vehicle.plate_number}</TableCell>

                      <TableCell>{vehicle.capacity ?? "—"}</TableCell>

                      <TableCell>{vehicleTypeMap[vehicle.vehicle_type] ?? vehicle.vehicle_type}</TableCell>

                      <TableCell>
                        <span className={vehicleToday(vehicle).tone}>
                          {vehicleToday(vehicle).label}
                        </span>
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
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Add New Vehicle
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in vehicle details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {/* Vehicle Name */}
            <div className="flex flex-col gap-1">
              <label>Vehicle Name</label>
              <Input
                placeholder="Vehicle Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={vehicleForm.name}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, name: e.target.value })
                }
              />
            </div>

            {/* Vehicle Brand */}
            <div className="flex flex-col gap-1">
              <label>Brand</label>
              <Input
                placeholder="Vehicle Brand"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={vehicleForm.vehicle_brand}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    vehicle_brand: e.target.value,
                  })
                }
              />
            </div>

            {/* Vehicle Number */}
            <div className="flex flex-col gap-1">
              <label>Plate Number</label>
              <Input
                placeholder="e.g. ABC 1234"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={vehicleForm.plate_number}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    plate_number: e.target.value,
                  })
                }
              />
            </div>


            {/* Capacity */}
            <div className="flex flex-col gap-1">
              <label>Capacity</label>
              <Input
                type="number"
                min={1}
                placeholder="Number of passengers"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={vehicleForm.capacity}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    capacity: e.target.value,
                  })
                }
              />
            </div>

            {/* Vehicle Type */}
            <div className="flex flex-col gap-1">
              <label>Vehicle Type</label>

              <Select
                value={vehicleForm.vehicle_type}
                onValueChange={(value) =>
                  setVehicleForm({
                    ...vehicleForm,
                    vehicle_type: value,
                  })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select Vehicle Type" />
                </SelectTrigger>

                <SelectContent>
                <SelectGroup>
                  <SelectLabel>Vehicle Type</SelectLabel>
                  {vehicleTypeData?.data?.map((type: any) => (
                    <SelectItem
                      key={type.type_id}
                      value={type.type_id}
                    >
                      {type.type}
                    </SelectItem>
                  ))}
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Status */}
            <div className="flex flex-col gap-1">
              <label>Vehicle Status</label>

              <Select value={vehicleForm.status} onValueChange={(value) =>
                setVehicleForm({
                  ...vehicleForm,
                  status: value,
                })
              }>
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <SelectValue placeholder={"Status"} />
                </SelectTrigger>

                <SelectContent>
                <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="IN_USE">In Use</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateVehicle}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Create Vehicle
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full rounded-sm py-5 font-medium"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openTypeForm} onOpenChange={setOpenTypeForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Add New Vehicle Type
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in vehicle type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-col">
              <label>Type Name</label>
              <Input
                type="name"
                placeholder="Vehicle Type Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateVehicleType}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Create Vehicle Type
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full rounded-sm py-5 font-medium"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openVehicle} onOpenChange={setOpenVehicle}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Vehicle Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review vehicle details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              Vehicle ID: {selectedVehicle?.vehicle_id}
            </label>

            <div className="flex flex-col">
              <label>Vehicle Name</label>
              <Input
                value={selectedVehicle?.vehicle_name ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Brand</label>
              <Input
                value={selectedVehicle?.vehicle_brand ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Plate Number</label>
              <Input
                value={selectedVehicle?.plate_number ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Capacity</label>
              <Input
                value={
                  selectedVehicle?.capacity != null
                    ? String(selectedVehicle.capacity)
                    : ""
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Vehicle Type</label>
              <Input
                value={
                  selectedVehicle
                    ? vehicleTypeMap[selectedVehicle.vehicle_type] ?? selectedVehicle.vehicle_type
                    : ""
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Vehicle Status</label>
              <Input
                value={selectedVehicle?.status ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>
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
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Edit Vehicle
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenVehicleDialog(true)}
                className="w-full rounded-sm py-5 font-medium"
              >
                Delete Vehicle
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openType} onOpenChange={setOpenType}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Vehicle Type Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review vehicle type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              Type ID: {selectedType?.type_id}
            </label>

            <div className="flex flex-col">
              <label>Type Name</label>
              <Input
                value={selectedType?.type ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
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
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Edit Type
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenTypeDialog(true)}
                className="w-full rounded-sm py-5 font-medium"
              >
                Delete Type
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openVehicleEditForm} onOpenChange={setOpenVehicleEditForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit Vehicle Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Update vehicle details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Vehicle ID: {selectedVehicle?.vehicle_id}
            </label>

            <div className="flex flex-col">
              <label>Name</label>
              <Input
                value={editVehicleForm.name}
                onChange={(e) =>
                  setEditVehicleForm({ ...editVehicleForm, name: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Vehicle Brand</label>
              <Input
                value={editVehicleForm.vehicle_brand}
                onChange={(e) =>
                  setEditVehicleForm({ ...editVehicleForm, vehicle_brand: e.target.value })  
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Plate Number</label>
              <Input
                value={editVehicleForm.plate_number}
                onChange={(e) =>
                  setEditVehicleForm({ ...editVehicleForm, plate_number: e.target.value }) 
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Capacity</label>
              <Input
                type="number"
                min={1}
                placeholder="Number of passengers"
                value={editVehicleForm.capacity}
                onChange={(e) =>
                  setEditVehicleForm({
                    ...editVehicleForm,
                    capacity: e.target.value,
                  })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Vehicle Type</label>

              <Select
                value={editVehicleForm.vehicle_type}
                onValueChange={(value) =>
                  setEditVehicleForm({
                    ...editVehicleForm,
                    vehicle_type: value,
                  })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select Vehicle Type" />
                </SelectTrigger>

                <SelectContent>
                  {vehicleTypeData?.data?.map((type: any) => (
                    <SelectItem
                      key={type.type_id}
                      value={type.type_id}
                    >
                      {type.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Status */}
            <div className="flex flex-col gap-1">
              <label>Vehicle Status</label>

              <Select value={editVehicleForm.status} onValueChange={(value) =>
                setEditVehicleForm({
                  ...editVehicleForm,
                  status: value,
                })
              }>
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <SelectValue placeholder={"Status"} />
                </SelectTrigger>

                <SelectContent>
                <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="IN_USE">In Use</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateVehicle}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Update Vehicle
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full rounded-sm py-5 font-medium"
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openTypeEditForm} onOpenChange={setOpenTypeEditForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit Vehicle Type
            </SheetTitle>
            <SheetDescription className="text-white">
              Update vehicle type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Vehicle Type ID: {selectedType?.type_id}
            </label>

            <div className="flex flex-col">
              <label>Name</label>
              <Input
                value={editTypeForm.name}
                onChange={(e) =>
                  setEditTypeForm({ ...editTypeForm, name: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateVehicleType}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
            >
              Update Vehicle Type
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full rounded-sm py-5 font-medium"
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
