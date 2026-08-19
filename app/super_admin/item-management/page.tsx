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

type ItemType = {
  id: number;
  item_id: string;
  type: string;
  // equipments: Equipment[];
};

type Item = {
  id: number;
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_number?: string;
  item_type: string;
  status: string;
};

export default function ItemPage() {
  const [openType, setOpenType] = useState(false);
  const [openItem, setOpenItem] = useState(false);
  const [openTypeForm, setOpenTypeForm] = useState(false);
  const [openItemForm, setOpenItemForm] = useState(false);
  const [openTypeEditForm, setOpenTypeEditForm] = useState(false);
  const [openItemEditForm, setOpenItemEditForm] = useState(false);
  const [openTypeDialog, setOpenTypeDialog] = useState(false);
  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const queryClient = useQueryClient();

  const [typeForm, setTypeForm] = useState({
    name: "",
  });
  const [itemForm, setItemForm] = useState({
    name: "",
    item_brand: "",
    item_number: "",
    item_type: "",
    status: "",
  });
  const [editTypeForm, setEditTypeForm] = useState({
    name: "",
  });
  const [editItemForm, setEditItemForm] = useState({
    name: "",
    item_brand: "",
    item_number: "",
    item_type: "",
    status: "",
  });
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedType, setSelectedType] = useState<ItemType | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [status, setStatus] = useState("all");

  // filters
  const [search, setSearch] = useState("");
  // const [role, setRole] = useState("all");
  // const [department, setDepartment] = useState("all");
  // const [status, setStatus] = useState("all");

  const handleCreateItemType = async () => {
    // Validation
    if (!typeForm.name.trim()) {
      toast.error("Please enter a type name");
      return;
    }
    
    const loadingToast = toast.loading("Creating item type ...");

    try {
      const res = await fetch("/api/equipments/types/type", {
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
        toast.error("Failed to create item type");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New item type has been created`);

      setOpenTypeForm(false);
      setTypeForm({
        name: "",
      });

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

  const handleCreateItem = async () => {
    // Validation
    if (!itemForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!itemForm.item_type.trim()) {
      toast.error("Please select a type");
      return;
    }
    if (!itemForm.status.trim()) {
      toast.error("Please select a status");
      return;
    }
    
    const loadingToast = toast.loading("Creating item ...");

    try {
      const res = await fetch("/api/equipments/items/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...itemForm,
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to create item");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New item has been created`);

      setOpenItemForm(false);
      setItemForm({
        name: "",
        item_brand: "",
        item_number: "",
        item_type: "",
        status: "",
      });

      queryClient.invalidateQueries({
        queryKey: ["item"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const { data: itemTypeData, isLoading: itemTypeLoading } = useQuery({
    queryKey: ["itemType", page, search],
    queryFn: async () => {

      const res = await fetch(`/api/equipments/types/type`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const { data: itemData, isLoading: itemLoading } = useQuery({
    queryKey: ["item", page, search, selectedTypeFilter, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(selectedTypeFilter && { item_type: selectedTypeFilter }),
        ...(status && status !== "all" && { status }),
      });

      const res = await fetch(`/api/equipments/items/item?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const handleUpdateItemType  = async () => {
    if (!selectedType) return;

    // Validation
    if (!editTypeForm.name.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const loadingToast = toast.loading("Updating item type...");       

    try {
      const res = await fetch(`/api/equipments/types/${selectedType.item_id}`, {
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
        toast.error("Failed to update item type");
        console.log("Error:", data);
        return;
      }

      toast.success("Item type has been updated");

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

  const handleUpdateItem  = async () => {
    if (!selectedItem) return;

    // Validation
    if (!editItemForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!editItemForm.item_type.trim()) {
      toast.error("Please select a type");
      return;
    }
    if (!editItemForm.status.trim()) {
      toast.error("Please select a status");
      return;
    }

    const loadingToast = toast.loading("Updating item...");       

    try {
      const res = await fetch(`/api/equipments/items/${selectedItem.item_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editItemForm,
        }),
      });

      const data = await res.json();

      // UX delay (same as create/delete)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to update item");
        console.log("Error:", data);
        return;
      }

      toast.success("Item has been updated");

      setOpenItemForm(false);
      setSelectedItem(null);

      queryClient.invalidateQueries({
        queryKey: ["item"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteItemType = async () => {
    if (!selectedType) return;

    const loadingToast = toast.loading("Deleting item type...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/equipments/types/${selectedType.item_id}`, {
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
        toast.error("Failed to delete item type");
        console.log("Error:", data);
        return;
      }

      toast.success(`Item type has been deleted`);

      setOpenTypeDialog(false);
      setSelectedType(null);
      setDeleting(false);

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

  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    const loadingToast = toast.loading("Deleting item...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/equipments/items/${selectedItem.item_id}`, {
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
        toast.error("Failed to delete item");
        console.log("Error:", data);
        return;
      }

      toast.success(`Item has been deleted`);

      setOpenItemDialog(false);
      setSelectedItem(null);
      setDeleting(false);

      queryClient.invalidateQueries({
        queryKey: ["item"], 
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const items: Item[] = itemData?.data ?? [];
  const totalItems = itemData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const itemTypes: ItemType[] = itemTypeData?.data ?? [];
  const totalItemTypes = itemTypeData?.total ?? 0;
  const totalPagesItemTypes = Math.ceil(totalItemTypes / limit) || 1;

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

  const itemTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    itemTypeData?.data?.forEach((type: any) => {
      map[type.item_id] = type.type;
    });
    return map;
  }, [itemTypeData]);

  const itemCountMap = useMemo(() => {
    const map: Record<string, number> = {};

    (itemData?.data ?? [])
      .filter((item: any) => !item.deletedAt)
      .forEach((item: any) => {
        map[item.item_type] = (map[item.item_type] ?? 0) + 1;
      });

    return map;
  }, [itemData]);

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Item Management</p>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage IT equipment
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-fit">
          <Button
            onClick={() => setOpenTypeForm(true)}
            className="w-full lg:w-fit bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Item Type
          </Button>

          <Button
            onClick={() => setOpenItemForm(true)}
            className="w-full lg:w-fit bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Item
          </Button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search item"
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
              <SelectItem value="BORROWED">Borrowed</SelectItem>
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
              {itemTypeMap[selectedTypeFilter] ?? selectedTypeFilter}
            </span>
            <X className="h-3 w-3" />
          </button>
        )}

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex flex-row gap-3 pb-4">
            {itemTypeLoading ? (
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
            ) : itemTypeData?.data?.length ? (
              itemTypeData.data
                .filter((item: any) => !item.deletedAt)
                .map((item: any) => {
                  const isActive = selectedTypeFilter === item.item_id;
                  return (
                    <div
                      key={item.item_id}
                      onClick={() => {
                        setSelectedTypeFilter((prev) =>
                          prev === item.item_id ? null : item.item_id
                        );
                        setPage(1);
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
                                setSelectedType(item);
                                setEditTypeForm({
                                  name: item.type,
                                });
                                setOpenTypeEditForm(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setSelectedType(item);
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
                          {item.item_id}
                        </span>

                        <p className="mt-1 text-[15px] font-semibold leading-tight">
                          {item.type}
                        </p>

                        <div className="mt-3 flex items-center justify-between border-t pt-2">
                          <span className="text-xs text-muted-foreground">
                            Items
                          </span>

                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-xs font-semibold",
                              isActive
                                ? "bg-green-800 text-white"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            )}
                          >
                            {itemCountMap[item.item_id] ?? 0}
                          </span>
                        </div>
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
            {itemLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>
                        Loading item
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : items.length === 0 ? (
              <>
                <TableBody>
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No items found
                    </TableCell>
                  </TableRow>
                </TableBody>
              </>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Item ID</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Item Brand</TableHead>
                    <TableHead>Item Serial Number</TableHead>
                    <TableHead>Item Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {items.map((item, index) => (
                    <TableRow
                      key={item.item_id}
                    >
                      <TableCell className="font-medium">
                        {index + 1 + (page - 1) * limit}
                      </TableCell>

                      <TableCell className="font-medium">
                        {item.item_id}
                      </TableCell>

                      <TableCell>{item.item_name}</TableCell>

                      <TableCell>{item.item_brand}</TableCell>

                      <TableCell>{item.item_number}</TableCell>

                      <TableCell>{itemTypeMap[item.item_type] ?? item.item_type}</TableCell>

                      <TableCell>{item.status === "OPEN" ? "Open" : "Borrowed"}</TableCell>

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
                                  setSelectedItem(item);
                                  setOpenItem(true);
                                }}
                              >
                                View
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedItem(item);
                                  setEditItemForm({
                                    name: item.item_name,
                                    item_brand: item.item_brand || "",
                                    item_number: item.item_number || "",
                                    item_type: item.item_type,
                                    status: item.status,
                                  });
                                  setOpenItemEditForm(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedItem(item);
                                  setOpenItemDialog(true);
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

      <Sheet open={openItemForm} onOpenChange={setOpenItemForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Add New Item
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in item details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {/* Item Name */}
            <div className="flex flex-col gap-1">
              <label>Item Name</label>
              <Input
                placeholder="Item Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({ ...itemForm, name: e.target.value })
                }
              />
            </div>

            {/* Item Brand */}
            <div className="flex flex-col gap-1">
              <label>Brand</label>
              <Input
                placeholder="Item Brand"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={itemForm.item_brand}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    item_brand: e.target.value,
                  })
                }
              />
            </div>

            {/* Item Number */}
            <div className="flex flex-col gap-1">
              <label>Item Number</label>
              <Input
                placeholder="Item Number"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={itemForm.item_number}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    item_number: e.target.value,
                  })
                }
              />
            </div>

            {/* Item Type */}
            <div className="flex flex-col gap-1">
              <label>Item Type</label>

              <Select
                value={itemForm.item_type}
                onValueChange={(value) =>
                  setItemForm({
                    ...itemForm,
                    item_type: value,
                  })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select Item Type" />
                </SelectTrigger>

                <SelectContent>
                <SelectGroup>
                  <SelectLabel>Item Type</SelectLabel>
                  {itemTypeData?.data?.map((type: any) => (
                    <SelectItem
                      key={type.item_id}
                      value={type.item_id}
                    >
                      {type.type}
                    </SelectItem>
                  ))}
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Item Status */}
            <div className="flex flex-col gap-1">
              <label>Item Status</label>

              <Select value={itemForm.status} onValueChange={(value) =>
                setItemForm({
                  ...itemForm,
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
                    <SelectItem value="BORROWED">Borrowed</SelectItem>
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateItem}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Create Item
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
              Add New Item Type
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in item type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-col">
              <label>Type Name</label>
              <Input
                type="name"
                placeholder="Item Type Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateItemType}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Create Item Type
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

      <Sheet open={openItem} onOpenChange={setOpenItem}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Item Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review item details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              Item ID: {selectedItem?.item_id}
            </label>

            <div className="flex flex-col">
              <label>Item Name</label>
              <Input
                value={selectedItem?.item_name ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Brand</label>
              <Input
                value={selectedItem?.item_brand ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Item Number</label>
              <Input
                value={selectedItem?.item_number ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Item Type</label>
              <Input
                value={
                  selectedItem
                    ? itemTypeMap[selectedItem.item_type] ?? selectedItem.item_type
                    : ""
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Item Status</label>
              <Input
                value={selectedItem?.status ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => {
                setOpenItem(false);
                if (selectedItem) {
                  setEditItemForm({
                    name: selectedItem.item_name,
                    item_brand: selectedItem.item_brand ?? "",
                    item_number: selectedItem.item_number ?? "",
                    item_type: selectedItem.item_type,
                    status: selectedItem.status,
                  });
                }
                setOpenItemEditForm(true);
              }}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Edit Item
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenItemDialog(true)}
                className="w-full rounded-sm py-5 font-medium"
              >
                Delete Item
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openType} onOpenChange={setOpenType}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Item Type Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review item type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              Type ID: {selectedType?.item_id}
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

      <Sheet open={openItemEditForm} onOpenChange={setOpenItemEditForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Edit Item Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Update item details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Item ID: {selectedItem?.item_id}
            </label>

            <div className="flex flex-col">
              <label>Name</label>
              <Input
                value={editItemForm.name}
                onChange={(e) =>
                  setEditItemForm({ ...editItemForm, name: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Item Brand</label>
              <Input
                value={editItemForm.item_brand}
                onChange={(e) =>
                  setEditItemForm({ ...editItemForm, item_brand: e.target.value })  
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Item Number</label>
              <Input
                value={editItemForm.item_number}
                onChange={(e) =>
                  setEditItemForm({ ...editItemForm, item_number: e.target.value }) 
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Item Type</label>

              <Select
                value={editItemForm.item_type}
                onValueChange={(value) =>
                  setEditItemForm({
                    ...editItemForm,
                    item_type: value,
                  })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select Item Type" />
                </SelectTrigger>

                <SelectContent>
                  {itemTypeData?.data?.map((type: any) => (
                    <SelectItem
                      key={type.item_id}
                      value={type.item_id}
                    >
                      {type.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Status */}
            <div className="flex flex-col gap-1">
              <label>Item Status</label>

              <Select value={editItemForm.status} onValueChange={(value) =>
                setEditItemForm({
                  ...editItemForm,
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
                    <SelectItem value="BORROWED">Borrowed</SelectItem>
                </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateItem}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Item
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
              Edit Item Type
            </SheetTitle>
            <SheetDescription className="text-white">
              Update item type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Item Type ID: {selectedType?.item_id}
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
              onClick={handleUpdateItemType}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Item Type
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

      <AlertDialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete this item?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
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
              Delete this item type?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItemType}
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
