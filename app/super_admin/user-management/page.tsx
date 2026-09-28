"use client";

import { AccountStatus, FilterStrip, ROLE_META, RoleChip, Segmented } from "@/components/management/parts";
import { FormSection, FieldLabel, SelectCard } from "@/components/booking/form-parts";
import { PasswordField, PasswordStrength } from "@/components/account/password-field";

import { EmptyState } from "@/components/ui/empty-state";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Check, X, RefreshCw } from "lucide-react";
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
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";

type Employee = {
  id: number;
  user_id: string;
  name: string;
  department: string;
  role: string;
  email: string;
  systemRole: string;
  status: string;
};

type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role?: string;
  systemRole?: string;
};

export default function UserPage() {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user as SessionUser | undefined;

  const [open, setOpen] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [openEditForm, setOpenEditForm] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    role: "",
    systemRole: "USER",
    password: "",
    status: "REGISTERED",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    department: "",
    role: "",
    systemRole: "",
    status: "",
  });
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [systemRole, setSystemRole] = useState("all");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");

  const handleCreateUser = async () => {
    // Validation
    if (!form.name.trim()) {
      toast.error("toast.error");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    if (!form.email.includes("@")) {
      toast.error("Invalid email address");
      return;
    }
    if (!form.email.includes("gmail.com")) {
      toast.error("Invalid email address");
      return;
    }
    if (!form.department.trim()) {
      toast.error("Please enter a department");
      return;
    }
    if (!form.role.trim()) {
      toast.error("Please enter a role");
      return;
    }
    if (!form.password.trim()) {
      toast.error("Please enter a password");
      return;
    }
    if (!form.systemRole.trim()) {
      toast.error("Please enter a system role");
      return;
    }
    if (!form.status.trim()) {
      toast.error("Please enter a status");
      return;
    }

    const loadingToast = toast.loading("Creating employee ...");

    try {
      const res = await fetch("/api/users/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: form.role.toLowerCase(),
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to create employee");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New employee has been created`);

      setOpenForm(false);
      setForm({
        name: "",
        department: "",
        role: "",
        email: "",
        password: "",
        systemRole: "USER",
        status: "REGISTERED",
      });

      queryClient.invalidateQueries({
        queryKey: ["employee"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["employee", page, search, status, systemRole, department],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        // systemRole: "USER",
        ...(search && { search }),
        ...(status !== "all" && { status }),
        ...(systemRole !== "all" && { systemRole }),
        ...(department !== "all" && { department }),
      });

      const res = await fetch(`/api/users/user?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    const loadingToast = toast.loading("Deleting employee...");

    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${selectedUser.user_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deletedBy: "IT_ADMIN",
        }),
      });

      const data = await res.json();

      // UX delay (same pattern as create)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to delete employee");
        console.log("Error:", data);
        return;
      }

      toast.success(`Employee has been deleted`);

      setOpenDialog(false);
      setSelectedUser(null);
      setDeleting(false);

      queryClient.invalidateQueries({
        queryKey: ["employee"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    // Validation
    if (!editForm.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!editForm.email.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    if (!editForm.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!editForm.email.includes("gmail.com")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!editForm.department.trim()) {
      toast.error("Please enter a department");
      return;
    }
    if (!editForm.role.trim()) {
      toast.error("Please enter a role");
      return;
    }
    if (!editForm.status.trim()) {
      toast.error("Please enter a status");
      return;
    }

    const loadingToast = toast.loading("Updating employee...");

    try {
      const res = await fetch(`/api/users/${selectedUser.user_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editForm,
          role: editForm.role.toLowerCase(),
        }),
      });

      const data = await res.json();

      // UX delay (same as create/delete)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to update employee");
        console.log("Error:", data);
        return;
      }

      toast.success("Employee has been updated");

      setOpenEditForm(false);
      setSelectedUser(null);

      queryClient.invalidateQueries({
        queryKey: ["employee"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const employees: Employee[] = data?.data ?? [];

  // Every account (unfiltered) for the summary strip.
  const { data: allUsersData } = useQuery({
    queryKey: ["employee", "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/users/user?limit=1000`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: Employee[]; total: number };
    },
  });
  const allUsers = allUsersData?.data ?? [];
  const stripActive = status === "UNREGISTERED" ? "PENDING" : systemRole;
  const initialsOf = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

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

  const { data: rolesData } = useQuery({
    queryKey: ["employee-systemRoles"],
    queryFn: async () => {
      const params = new URLSearchParams({
        rolesOnly: "true",
        //   systemRole: "USER",
      });

      const res = await fetch(`/api/users/role?${params}`);
      const json = await res.json();
      console.log("roles response:", json);
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const params = new URLSearchParams({
        departmentsOnly: "true",
      });

      const res = await fetch(`/api/users/department?${params}`);
      const json = await res.json();
      console.log("departments response:", json);

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Employees
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-sans text-sm font-medium tabular-nums text-muted-foreground">
              {allUsersData?.total ?? total}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage employee accounts, roles and access
          </p>
        </div>
        <Button onClick={() => setOpenForm(true)} className="w-full lg:w-fit">
          + Add employee
        </Button>
      </div>

      <FilterStrip
        title="Accounts by role"
        total={allUsers.length}
        active={stripActive}
        onSelect={(key) => {
          setPage(1);
          if (key === "PENDING") {
            setSystemRole("all");
            setStatus("UNREGISTERED");
          } else {
            setStatus("all");
            setSystemRole(key);
          }
        }}
        items={[
          ...["USER", "HALL_ADMIN", "OB_ADMIN", "DRIVER"].map((r) => ({
            key: r,
            label: ROLE_META[r].label + "s",
            color: ROLE_META[r].color,
            count: allUsers.filter((u) => u.systemRole === r).length,
          })),
          {
            key: "SUPER_ADMIN",
            label: "Admins",
            color: ROLE_META.SUPER_ADMIN.color,
            count: allUsers.filter((u) => u.systemRole === "SUPER_ADMIN" || u.systemRole === "IT_ADMIN").length,
          },
          {
            key: "PENDING",
            label: "Pending activation",
            color: "#f59e0b",
            count: allUsers.filter((u) => u.status === "UNREGISTERED").length,
          },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select value={systemRole} onValueChange={(v) => { setSystemRole(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:max-w-44">
            <SelectValue placeholder="System role" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>System role</SelectLabel>
              <SelectItem value="all">All roles</SelectItem>
              {rolesData?.data?.map((r: string) => (
                <SelectItem key={r} value={r}>
                  {ROLE_META[r]?.label ?? r}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={department} onValueChange={(v) => { setDepartment(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:max-w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Department</SelectLabel>
              <SelectItem value="all">All departments</SelectItem>
              {departmentsData?.data?.map((d: string) => (
                <SelectItem key={d} value={d}>
                  {d.replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:max-w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="REGISTERED">Active</SelectItem>
              <SelectItem value="UNREGISTERED">Pending activation</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            {isLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading employees</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : employees.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <EmptyState
                      title="No employees found"
                      description="Try a different search or filter."
                      action={
                        <Button size="sm" onClick={() => setOpenForm(true)}>
                          + Add employee
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>System role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {employees.map((employee) => (
                    <TableRow
                      key={employee.user_id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        // The action menu renders in a portal; ignore its clicks.
                        if (!e.currentTarget.contains(e.target as Node)) return;
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSelectedUser(employee);
                        setOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: ROLE_META[employee.systemRole]?.color ?? "#a3a3a3" }}
                          >
                            {initialsOf(employee.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{employee.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <p>{employee.department}</p>
                        <p className="text-xs text-muted-foreground">
                          {employee.role.replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                      </TableCell>

                      <TableCell>
                        <RoleChip role={employee.systemRole} />
                      </TableCell>

                      <TableCell>
                        <AccountStatus status={employee.status} />
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {employee.user_id}
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
                                  setSelectedUser(employee);
                                  setOpen(true);
                                }}
                              >
                                View
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(employee);
                                  setEditForm({
                                    name: employee.name,
                                    email: employee.email,
                                    department: employee.department,
                                    role: employee.role,
                                    systemRole: employee.systemRole,
                                    status: employee.status,
                                  });
                                  setOpenEditForm(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(employee);
                                  setOpenDialog(true);
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

      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">Add employee</SheetTitle>
            <SheetDescription className="text-white">Create an account and choose what they can access.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Personal information">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="form-name">Full name</FieldLabel>
                <Input id="form-name" placeholder="Juan Dela Cruz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="form-email">Email</FieldLabel>
                <Input id="form-email" type="email" placeholder="name@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="form-dept">Department</FieldLabel>
                  <Input id="form-dept" placeholder="Marketing" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="form-role">Position</FieldLabel>
                  <Input id="form-role" placeholder="Account Executive" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Access">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>System role</FieldLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {["USER", "HALL_ADMIN", "OB_ADMIN", "DRIVER", "IT_ADMIN", "SUPER_ADMIN"].map((r) => (
                    <SelectCard
                      key={r}
                      selected={form.systemRole === r}
                      onToggle={() => setForm({ ...form, systemRole: r })}
                      title={ROLE_META[r].label}
                      subtitle={ROLE_META[r].hint}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Account status</FieldLabel>
                <Segmented
                  value={(form.status || "REGISTERED") as string}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                    { value: "REGISTERED", label: "Active" },
                    { value: "UNREGISTERED", label: "Pending activation" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">Pending accounts cannot sign in.</p>
              </div>
            </FormSection>

            <FormSection step={3} title="Password" hint="At least 8 characters">
              <PasswordField
                id="new-user-password"
                value={form.password}
                placeholder="Set a starting password"
                onChange={(v) => setForm({ ...form, password: v })}
              />
              <PasswordStrength value={form.password} />
            </FormSection>
          </div>

          <SheetFooter>
            <Button onClick={handleCreateUser} className="w-full h-10">Create employee</Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full h-10">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Employee</SheetTitle>
            <SheetDescription>Employee details</SheetDescription>
          </SheetHeader>

          {selectedUser && (
            <div className="flex flex-col">
              <div className="flex flex-col items-center gap-2 border-b border-border px-6 pb-6 pt-10 text-center">
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
                  style={{ backgroundColor: ROLE_META[selectedUser.systemRole]?.color ?? "#a3a3a3" }}
                >
                  {initialsOf(selectedUser.name)}
                </span>
                <p className="text-lg font-semibold">{selectedUser.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                  <RoleChip role={selectedUser.systemRole} />
                  <AccountStatus status={selectedUser.status} />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Department</dt>
                  <dd className="mt-0.5 font-medium">{selectedUser.department || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Position</dt>
                  <dd className="mt-0.5 font-medium">
                    {(selectedUser.role || "—").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Employee ID</dt>
                  <dd className="mt-0.5 font-mono text-sm">{selectedUser.user_id}</dd>
                </div>
                <div className="col-span-2 rounded-md border border-border bg-neutral-50 p-3">
                  <dt className="text-xs text-muted-foreground">What this role can do</dt>
                  <dd className="mt-0.5 text-sm">{ROLE_META[selectedUser.systemRole]?.hint ?? "—"}</dd>
                </div>
              </dl>
            </div>
          )}

          <SheetFooter className="border-t border-border">
            <Button
              onClick={() => {
                setOpen(false);
                if (selectedUser) {
                  setEditForm({
                    name: selectedUser.name,
                    email: selectedUser.email,
                    department: selectedUser.department,
                    role: selectedUser.role,
                    systemRole: selectedUser.systemRole,
                    status: selectedUser.status,
                  });
                }
                setOpenEditForm(true);
              }}
              className="w-full h-10"
            >
              Edit employee
            </Button>
            <SheetClose asChild>
              <Button
                variant="outline"
                onClick={() => setOpenDialog(true)}
                className="w-full h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Delete employee
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openEditForm} onOpenChange={setOpenEditForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">Edit employee</SheetTitle>
            <SheetDescription className="text-white">Update details, role or access.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Personal information">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="editForm-name">Full name</FieldLabel>
                <Input id="editForm-name" placeholder="Juan Dela Cruz" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="editForm-email">Email</FieldLabel>
                <Input id="editForm-email" type="email" placeholder="name@gmail.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="editForm-dept">Department</FieldLabel>
                  <Input id="editForm-dept" placeholder="Marketing" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="editForm-role">Position</FieldLabel>
                  <Input id="editForm-role" placeholder="Account Executive" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Access">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>System role</FieldLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {["USER", "HALL_ADMIN", "OB_ADMIN", "DRIVER", "IT_ADMIN", "SUPER_ADMIN"].map((r) => (
                    <SelectCard
                      key={r}
                      selected={editForm.systemRole === r}
                      onToggle={() => setEditForm({ ...editForm, systemRole: r })}
                      title={ROLE_META[r].label}
                      subtitle={ROLE_META[r].hint}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Account status</FieldLabel>
                <Segmented
                  value={(editForm.status || "REGISTERED") as string}
                  onChange={(v) => setEditForm({ ...editForm, status: v })}
                  options={[
                    { value: "REGISTERED", label: "Active" },
                    { value: "UNREGISTERED", label: "Pending activation" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">Pending accounts cannot sign in.</p>
              </div>
            </FormSection>
          </div>

          <SheetFooter>
            <Button onClick={handleUpdateUser} className="w-full h-10">Save changes</Button>
            <SheetClose asChild>
              <Button variant="outline" className="w-full h-10">Cancel</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedUser?.name ?? "this employee"}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to sign in. Their past reservations and
              logs are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
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
