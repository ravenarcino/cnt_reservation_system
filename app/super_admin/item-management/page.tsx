"use client";

import { FormSection, FieldLabel } from "@/components/booking/form-parts";
import { DetailGrid, DetailItem } from "@/components/booking/detail-parts";

import { FilterStrip, PageHeader, Segmented } from "@/components/management/parts";
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
    status: "OPEN",
  });
  const [editTypeForm, setEditTypeForm] = useState({
    name: "",
  });
  const [editItemForm, setEditItemForm] = useState({
    name: "",
    item_brand: "",
    item_number: "",
    item_type: "",
    status: "OPEN",
  });
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [returningItemId, setReturningItemId] = useState<string | null>(null);
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
        status: "OPEN",
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

  // Marks a borrowed item as returned, putting it back into circulation.
  // Only the super admin does this - it is the single point where physical
  // custody of an item is confirmed, so nothing else flips it back to OPEN.
  const handleReturnItem = async (item: Item) => {
    if (item.status !== "BORROWED") {
      toast.error("This item is not borrowed");
      return;
    }

    const loadingToast = toast.loading("Marking item as returned...");
    setReturningItemId(item.item_id);

    try {
      const res = await fetch(`/api/equipments/items/${item.item_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Only `status` is sent - Prisma leaves fields it never receives
        // untouched, so the item's name, brand and type are preserved.
        body: JSON.stringify({ status: "OPEN" }),
      });

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setReturningItemId(null);

      if (!res.ok) {
        toast.error(data?.message ?? "Failed to mark item as returned");
        console.log("Error:", data);
        return;
      }

      toast.success(`"${item.item_name}" is now available`);

      queryClient.invalidateQueries({
        queryKey: ["item"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      setReturningItemId(null);

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

  // Every item (unfiltered) for the summary strip and type counts.
  const { data: allItemData } = useQuery({
    queryKey: ["item", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/equipments/items/item?limit=500");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: Item[]; total: number };
    },
  });
  const allItems: Item[] = (allItemData?.data ?? []).filter((i: any) => !i.deletedAt);

  const itemCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allItems.forEach((item) => {
      map[item.item_type] = (map[item.item_type] ?? 0) + 1;
    });
    return map;
  }, [allItems]);

  return (
    <div className="h-full flex flex-col gap-5">
      <PageHeader title="Items" count={allItemData?.total ?? totalItems} subtitle="IT equipment users can borrow">
        <Button onClick={() => setOpenItemForm(true)}>+ Add item</Button>
      </PageHeader>

      <FilterStrip
        title="Equipment right now"
        total={allItems.length}
        active={status}
        onSelect={(key) => {
          setStatus(key);
          setPage(1);
        }}
        items={[
          { key: "OPEN", label: "Available", color: "#10b981", count: allItems.filter((i) => i.status === "OPEN").length },
          { key: "BORROWED", label: "Borrowed", color: "#f59e0b", count: allItems.filter((i) => i.status === "BORROWED").length },
        ]}
      />

      <TypeChips
        label="Item types"
        loading={itemTypeLoading}
        total={allItems.length}
        active={selectedTypeFilter}
        onSelect={(id) => {
          setSelectedTypeFilter(id);
          setPage(1);
        }}
        items={itemTypes
          .filter((t: any) => !t.deletedAt)
          .map((t) => ({ id: t.item_id, name: t.type, count: itemCountMap[t.item_id] ?? 0 }))}
        onAdd={() => setOpenTypeForm(true)}
        onEdit={(id) => {
          const t = itemTypes.find((x) => x.item_id === id);
          if (!t) return;
          setSelectedType(t);
          setEditTypeForm({ name: t.type });
          setOpenTypeEditForm(true);
        }}
        onDelete={(id) => {
          const t = itemTypes.find((x) => x.item_id === id);
          if (!t) return;
          setSelectedType(t);
          setOpenTypeDialog(true);
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, brand or serial"
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
              <SelectItem value="OPEN">Available</SelectItem>
              <SelectItem value="BORROWED">Borrowed</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            {itemLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading items</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : items.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <EmptyState
                      title="No items found"
                      description="Try another filter, or add an item."
                      action={<Button size="sm" onClick={() => setOpenItemForm(true)}>+ Add item</Button>}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Serial no.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.item_id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        // The action menu renders in a portal; ignore its clicks.
                        if (!e.currentTarget.contains(e.target as Node)) return;
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSelectedItem(item);
                        setOpenItem(true);
                      }}
                    >
                      <TableCell>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.item_brand || "—"} · <span className="font-mono">{item.item_id}</span>
                        </p>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex rounded border border-border bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {itemTypeMap[item.item_type] ?? item.item_type}
                        </span>
                      </TableCell>

                      <TableCell>
                        {item.item_number ? (
                          <span className="font-mono text-xs">{item.item_number}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                            item.status === "OPEN"
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-amber-50 text-amber-800 ring-amber-200",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", item.status === "OPEN" ? "bg-emerald-500" : "bg-amber-500")} />
                          {item.status === "OPEN" ? "Available" : "Borrowed"}
                        </span>
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

                              {item.status === "BORROWED" && (
                                <DropdownMenuItem
                                  disabled={returningItemId === item.item_id}
                                  onClick={() => handleReturnItem(item)}
                                >
                                  Mark returned
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                variant="destructive"
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
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              New item
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in item details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Item" hint="What users see when they borrow it.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    placeholder="e.g. Projector"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Brand</FieldLabel>
                  <Input
                    placeholder="e.g. Epson"
                    value={itemForm.item_brand}
                    onChange={(e) => setItemForm({ ...itemForm, item_brand: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Identification" hint="The serial number helps tell identical items apart.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Serial number</FieldLabel>
                  <Input
                    placeholder="e.g. SN-00123"
                    value={itemForm.item_number}
                    onChange={(e) => setItemForm({ ...itemForm, item_number: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Item type</FieldLabel>
                  <Select value={itemForm.item_type} onValueChange={(value) => setItemForm({ ...itemForm, item_type: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(itemTypeData?.data ?? [])
                          .filter((t: any) => !t.deletedAt)
                          .map((t: any) => (
                            <SelectItem key={t.item_id} value={t.item_id}>
                              {t.type}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            <FormSection step={3} title="Status" hint="">
              <Segmented
                value={itemForm.status as "OPEN" | "BORROWED"}
                onChange={(v) => setItemForm({ ...itemForm, status: v })}
                options={[{ value: "OPEN", label: "Available" }, { value: "BORROWED", label: "Borrowed" }]}
              />
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateItem}
              className="w-full h-10"
            >
              Add item
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
              New item type
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in item type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type Name</label>
              <Input
                type="name"
                placeholder="Item Type Name"
                className=""
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateItemType}
              className="w-full h-10"
            >
              Create Item Type
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

      <Sheet open={openItem} onOpenChange={setOpenItem}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Item
            </SheetTitle>
            <SheetDescription className="text-white">
              Review item details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <div className="rounded-lg border border-border bg-neutral-50 p-4">
              <p className="font-mono text-[11px] text-muted-foreground">{selectedItem?.item_id}</p>
              <p className="mt-1 text-lg font-semibold">{selectedItem?.item_name}</p>
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                  selectedItem?.status === "OPEN"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-amber-50 text-amber-800 ring-amber-200",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", selectedItem?.status === "OPEN" ? "bg-emerald-500" : "bg-amber-500")} />
                {selectedItem?.status === "OPEN" ? "Available" : "Borrowed"}
              </span>
            </div>
            <DetailGrid>
              <DetailItem label="Brand" value={selectedItem?.item_brand} />
              <DetailItem
                label="Type"
                value={selectedItem ? itemTypeMap[selectedItem.item_type] ?? selectedItem.item_type : ""}
              />
              <DetailItem label="Serial number" value={selectedItem?.item_number} wide />
            </DetailGrid>
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
              className="w-full h-10"
            >
              Edit
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenItemDialog(true)}
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
              Item type
            </SheetTitle>
            <SheetDescription className="text-white">
              Review item type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="font-mono text-xs text-muted-foreground">
              Type ID: {selectedType?.item_id}
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

      <Sheet open={openItemEditForm} onOpenChange={setOpenItemEditForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit item
            </SheetTitle>
            <SheetDescription className="text-white">
              Update item details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Item" hint="What users see when they borrow it.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    placeholder="e.g. Projector"
                    value={editItemForm.name}
                    onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Brand</FieldLabel>
                  <Input
                    placeholder="e.g. Epson"
                    value={editItemForm.item_brand}
                    onChange={(e) => setEditItemForm({ ...editItemForm, item_brand: e.target.value })}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Identification" hint="The serial number helps tell identical items apart.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Serial number</FieldLabel>
                  <Input
                    placeholder="e.g. SN-00123"
                    value={editItemForm.item_number}
                    onChange={(e) => setEditItemForm({ ...editItemForm, item_number: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Item type</FieldLabel>
                  <Select value={editItemForm.item_type} onValueChange={(value) => setEditItemForm({ ...editItemForm, item_type: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(itemTypeData?.data ?? [])
                          .filter((t: any) => !t.deletedAt)
                          .map((t: any) => (
                            <SelectItem key={t.item_id} value={t.item_id}>
                              {t.type}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            <FormSection step={3} title="Status" hint="">
              <Segmented
                value={editItemForm.status as "OPEN" | "BORROWED"}
                onChange={(v) => setEditItemForm({ ...editItemForm, status: v })}
                options={[{ value: "OPEN", label: "Available" }, { value: "BORROWED", label: "Borrowed" }]}
              />
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateItem}
              className="w-full h-10"
            >
              Update Item
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
              Edit item type
            </SheetTitle>
            <SheetDescription className="text-white">
              Update item type details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="font-mono text-xs text-muted-foreground">
              Item Type ID: {selectedType?.item_id}
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
              onClick={handleUpdateItemType}
              className="w-full h-10"
            >
              Update Item Type
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
