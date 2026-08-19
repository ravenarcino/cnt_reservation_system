"use client";

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

type HallType = {
  id: number;
  type_id: string;
  type: string;
  // equipments: Equipment[];
};

type Hall = {
  id: number;
  hall_id: string;
  hall_name: string;
  floor: string;
  status: string;
};

export default function HallPage() {
  const [openType, setOpenType] = useState(false);
  const [openHall, setOpenHall] = useState(false);
  const [openTypeForm, setOpenTypeForm] = useState(false);
  const [openHallForm, setOpenHallForm] = useState(false);
  const [openTypeEditForm, setOpenTypeEditForm] = useState(false);
  const [openHallEditForm, setOpenHallEditForm] = useState(false);
  const [openTypeDialog, setOpenTypeDialog] = useState(false);
  const [openHallDialog, setOpenHallDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const queryClient = useQueryClient();

  const [typeForm, setTypeForm] = useState({
    name: "",
  });
  const [hallForm, setHallForm] = useState({
    name: "",
    floor: "",
    status: "",
  });
  const [editTypeForm, setEditTypeForm] = useState({
    name: "",
  });
  const [editHallForm, setEditHallForm] = useState({
    name: "",
    floor: "",
    status: "",
  });
  const [selectedHall, setSelectedHall] = useState<Hall | null>(null);
  const [selectedType, setSelectedType] = useState<HallType | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [status, setStatus] = useState("all");

  // filters
  const [search, setSearch] = useState("");
  // const [role, setRole] = useState("all");
  // const [department, setDepartment] = useState("all");

  const handleCreateHallType = async () => {
    // Validation
    if (!typeForm.name.trim()) {
      toast.error("Please enter a type name");
      return;
    }
    
    const loadingToast = toast.loading("Creating hall type ...");

    try {
      const res = await fetch("/api/halls/types/type", {
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
        toast.error("Failed to create hall type");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New hall type has been created`);

      setOpenTypeForm(false);
      setTypeForm({
        name: "",
      });

      queryClient.invalidateQueries({
        queryKey: ["hallType"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleCreateHall = async () => {
    // Validation
    if (!hallForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!hallForm.floor.trim()) {
      toast.error("Please enter a floor");
      return;
    }
    if (!hallForm.status.trim()) {
      toast.error("Please select a status");
      return;
    }
    
    const loadingToast = toast.loading("Creating hall ...");

    try {
      const res = await fetch("/api/halls/rooms/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...hallForm,
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to create hall");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New hall has been created`);

      // Reset hallForm state to include floor field after creating hall
      setOpenHallForm(false);
      setHallForm({
        name: "",
        floor: "",
        status: "",
      });

      queryClient.invalidateQueries({
        queryKey: ["hall"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const { data: hallTypeData, isLoading: hallTypeLoading } = useQuery({
    queryKey: ["hallType", page, search],
    queryFn: async () => {

      const res = await fetch(`/api/halls/types/type`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const { data: hallData, isLoading: hallLoading } = useQuery({
    queryKey: ["hall", page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(status && status !== "all" && { status }),
      });

      const res = await fetch(`/api/halls/rooms/room?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const handleUpdateHallType  = async () => {
    if (!selectedType) return;

    // Validation
    if (!editTypeForm.name.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const loadingToast = toast.loading("Updating hall type...");       

    try {
      const res = await fetch(`/api/halls/types/${selectedType.type_id}`, {
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
        toast.error("Failed to update hall type");
        console.log("Error:", data);
        return;
      }

      toast.success("Hall type has been updated");

      setOpenTypeForm(false);
      setSelectedType(null);

      queryClient.invalidateQueries({
        queryKey: ["itemType"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleUpdateHall  = async () => {
    if (!selectedHall) return;

    // Validation
    if (!editHallForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    const loadingToast = toast.loading("Updating hall...");       

    try {
      const res = await fetch(`/api/halls/rooms/${selectedHall.hall_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editHallForm,
        }),
      });

      const data = await res.json();

      // UX delay (same as create/delete)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to update hall");
        console.log("Error:", data);
        return;
      }

      toast.success("Item has been updated");

      setOpenHallForm(false);
      setSelectedHall(null);

      queryClient.invalidateQueries({
        queryKey: ["hall"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteHallType = async () => {
    if (!selectedType) return;

    const loadingToast = toast.loading("Deleting hall type...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/halls/types/${selectedType.type_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deletedBy: "SUPER_ADMIN",
        }),
      });

      const data = await res.json();

      // UX delay (same pattern as create)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to delete hall type");
        console.log("Error:", data);
        return;
      }

      toast.success(`Hall type has been deleted`);

      setOpenTypeDialog(false);
      setSelectedType(null);
      setDeleting(false);

      queryClient.invalidateQueries({
        queryKey: ["hallType"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteHall = async () => {
    if (!selectedHall) return;

    const loadingToast = toast.loading("Deleting hall...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/halls/rooms/${selectedHall.hall_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deletedBy: "SUPER_ADMIN",
        }),
      });

      const data = await res.json();

      // UX delay (same pattern as create)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to delete hall");
        console.log("Error:", data);
        return;
      }

      toast.success(`Hall has been deleted`);

      setOpenHallDialog(false);
      setSelectedHall(null);
      setDeleting(false);

      queryClient.invalidateQueries({
        queryKey: ["hall"], 
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const halls: Hall[] = hallData?.data ?? [];
  const totalHalls = hallData?.total ?? 0;
  const totalPages = Math.ceil(totalHalls / limit) || 1;
  const hallTypes: HallType[] = hallTypeData?.data ?? [];
  const totalHallTypes = hallTypeData?.total ?? 0;
  const totalPagesHallTypes = Math.ceil(totalHallTypes / limit) || 1;

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

  // const itemTypeMap = useMemo(() => {
  //   const map: Record<string, string> = {};
  //   itemTypeData?.data?.forEach((type: any) => {
  //     map[type.item_id] = type.type;
  //   });
  //   return map;
  // }, [itemTypeData]);

  // const itemCountMap = useMemo(() => {
  //   const map: Record<string, number> = {};

  //   (itemData?.data ?? [])
  //     .filter((item: any) => !item.deletedAt)
  //     .forEach((item: any) => {
  //       map[item.item_type] = (map[item.item_type] ?? 0) + 1;
  //     });

  //   return map;
  // }, [itemData]);

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Hall Management</p>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage halls
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-fit">
          <Button
            onClick={() => setOpenTypeForm(true)}
            className="w-full lg:w-fit bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Hall Type
          </Button>

          <Button
            onClick={() => setOpenHallForm(true)}
            className="w-full lg:w-fit bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Hall
          </Button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search hall"
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
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
          </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-2">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex flex-row gap-3 pb-4">
            {hallTypeLoading ? (
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
            ) : hallTypeData?.data?.length ? (
              hallTypeData.data
                .filter((hall: any) => !hall.deletedAt)
                .map((hall: any) => {
                  const isActive = selectedTypeFilter === hall.type_id;
                  return (
                    <div
                      key={hall.type_id}
                      onClick={() => {
                        setSelectedTypeFilter((prev) =>
                          prev === hall.type_id ? null : hall.type_id
                        );
                      }}
                      className={cn(
                        "group relative w-44 shrink-0 cursor-pointer rounded-xl border p-4 transition-all",
                        isActive
                          ? "border-green-800 bg-green-50 shadow-sm dark:bg-green-950/20"
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
                                setSelectedType(hall);
                                setEditTypeForm({
                                  name: hall.type,
                                });
                                setOpenTypeEditForm(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setSelectedType(hall);
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
                              ? "text-green-800 dark:text-green-400"
                              : "text-muted-foreground"
                          )}
                        >
                        {hall.type_id}
                        </span>

                        <p className="mt-1 text-[15px] font-semibold leading-tight">
                          {hall.type}
                        </p>

                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-sm text-muted-foreground p-4">
                No equipment types found.
              </p>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            {hallLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>
                        Loading hall
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : halls.length === 0 ? (
              <>
                <TableBody>
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No halls found
                    </TableCell>
                  </TableRow>
                </TableBody>
              </>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Hall ID</TableHead>
                    <TableHead>Hall Name</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {halls.map((hall, index) => (
                    <TableRow
                      key={hall.hall_id}
                    >
                      <TableCell className="font-medium">
                        {index + 1 + (page - 1) * limit}
                      </TableCell>

                      <TableCell className="font-medium">
                        {hall.hall_id}
                      </TableCell>

                      <TableCell>{hall.hall_name}</TableCell>

                      <TableCell>{hall.floor}</TableCell>

                      <TableCell>{hall.status === "OPEN" ? "Open" : "Full"}</TableCell>

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
                                  setSelectedHall(hall);
                                  setOpenHall(true);
                                }}
                              >
                                View
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedHall(hall);
                                  setEditHallForm({
                                    name: hall.hall_name,
                                    floor: hall.floor,
                                    status: hall.status,
                                  });
                                  setOpenHallEditForm(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedHall(hall);
                                  setOpenHallDialog(true);
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

      <Sheet open={openHallForm} onOpenChange={setOpenHallForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Add New Hall
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in hall details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {/* Hall Name */}
            <div className="flex flex-col gap-1">
              <label>Hall Name</label>
              <Input
                placeholder="Hall Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={hallForm.name}
                onChange={(e) =>
                  setHallForm({ ...hallForm, name: e.target.value })
                }
              />
            </div>

            {/* Floor */}
            <div className="flex flex-col gap-1">
              <label>Floor</label>
              <Input
                placeholder="Floor"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={hallForm.floor}
                onChange={(e) =>
                  setHallForm({ ...hallForm, floor: e.target.value })
                }
              />
            </div>

            {/* Item Status */}
            <div className="flex flex-col gap-1">
              <label>Hall Status</label>

              <Select value={hallForm.status} onValueChange={(value) =>
                setHallForm({
                  ...hallForm,
                  status: value,
                })
              }>
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <SelectValue placeholder={"Status"} />
                </SelectTrigger>

                <SelectContent>
                <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="FULL">Full</SelectItem>
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateHall}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Create Hall
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
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Add New Hall Type
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in hall type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-col">
              <label>Type Name</label>
              <Input
                type="name"
                placeholder="Hall Type Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateHallType}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Create Hall Type
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

      <Sheet open={openHall} onOpenChange={setOpenHall}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Hall Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review hall details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              Hall ID: {selectedHall?.hall_id}
            </label>

            <div className="flex flex-col">
              <label>Hall Name</label>
              <Input
                value={selectedHall?.hall_name}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            {/* Hall Type */}
            <div className="flex flex-col">
              <label>Hall Floor</label>
              <Input
                value={selectedHall?.floor}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            {/* Hall Status */}
            <div className="flex flex-col">
              <label>Status</label>
              <Input
                value={selectedHall?.status === "OPEN" ? "Open" : "Full"}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => {
                setOpenHall(false);
                if (selectedHall) {
                  setEditHallForm({
                    name: selectedHall.hall_name,
                    floor: selectedHall.floor,
                    status: selectedHall.status,
                  });
                }
                setOpenHallEditForm(true);
              }}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Edit Hall
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenHallDialog(true)}
                className="w-full rounded-sm py-5 font-medium"
              >
                Delete Hall
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openType} onOpenChange={setOpenType}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Hall Type Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review hall type details below.
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
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
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

      <Sheet open={openHallEditForm} onOpenChange={setOpenHallEditForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Edit Hall Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Update hall details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Hall ID: {selectedHall?.hall_id}
            </label>

            <div className="flex flex-col">
              <label>Name</label>
              <Input
                value={editHallForm.name}
                onChange={(e) =>
                  setEditHallForm({ ...editHallForm, name: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Floor</label>
              <Input
                value={editHallForm.floor}
                onChange={(e) =>
                  setEditHallForm({ ...editHallForm, floor: e.target.value })  
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Hall Status</label>

              <Select value={editHallForm.status} onValueChange={(value) =>
                setEditHallForm({
                  ...editHallForm,
                  status: value,
                })
              }>
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <SelectValue placeholder={"Status"} />
                </SelectTrigger>

                <SelectContent>
                <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="FULL">Full</SelectItem>
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>

          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateHall}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Hall
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
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Edit Hall Type
            </SheetTitle>
            <SheetDescription className="text-white">
              Update hall type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Hall Type ID: {selectedType?.type_id}
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
              onClick={handleUpdateHallType}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Hall Type
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

      <AlertDialog open={openHallDialog} onOpenChange={setOpenHallDialog}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete this hall?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHall}
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
              Delete this hall type?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHallType}
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
