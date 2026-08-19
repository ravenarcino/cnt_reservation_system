"use client";

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
    systemRole: "",
    password: "",
    status: "",
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
        systemRole: "",
        status: "",
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
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Employee Management</p>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage employee accounts
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-fit">
          <Button
            onClick={() => setOpenForm(true)}
            className="w-full lg:w-fit bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Employee
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search employee"
            className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* System Role Select */}
          <Select value={systemRole} onValueChange={setSystemRole}>
            <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <SelectValue placeholder={"System Role"} />
            </SelectTrigger>

            <SelectContent position="popper" sideOffset={4} className="w-fit ">
              <SelectGroup>
                <SelectLabel>System Role</SelectLabel>
                <SelectItem value="all">All</SelectItem>
                {rolesData?.data?.map((r: string) => (
                  <SelectItem key={r} value={r}>
                    {r
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Department */}
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <SelectValue placeholder="Department" />
            </SelectTrigger>

            <SelectContent position="popper" sideOffset={4} className="w-fit">
              <SelectGroup>
                <SelectLabel>Department</SelectLabel>
                <SelectItem value="all">All</SelectItem>
                {departmentsData?.data?.map((d: string) => (
                  <SelectItem key={d} value={d}>
                    {d.replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Status Select */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <SelectValue placeholder={"Status"} />
            </SelectTrigger>

            <SelectContent position="popper" sideOffset={4} className="w-fit ">
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="REGISTERED">Registered</SelectItem>
                <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            {isLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading employee</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : employees.length === 0 ? (
              <>
                <TableBody>
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-10 text-muted-foreground"
                    >
                      No staff found
                    </TableCell>
                  </TableRow>
                </TableBody>
              </>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {employees.map((employee, index) => (
                    <TableRow key={employee.user_id}>
                      <TableCell className="font-medium">
                        {index + 1 + (page - 1) * limit}
                      </TableCell>

                      <TableCell className="font-medium">
                        {employee.user_id}
                      </TableCell>

                      <TableCell>{employee.name}</TableCell>

                      <TableCell>{employee.email}</TableCell>

                      <TableCell>{employee.department}</TableCell>

                      <TableCell>
                        {employee.role.replace(/\b\w/g, (c) => c.toUpperCase())}
                      </TableCell>

                      <TableCell>
                        {employee.systemRole
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </TableCell>

                      <TableCell>{employee.status}</TableCell>

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
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Add New Employee
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in employee details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-col">
              <label>Name</label>
              <Input
                type="name"
                placeholder="Employee Name"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="flex flex-col">
              <label>Department</label>
              <Input
                placeholder="Department"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col">
              <label>Role</label>
              <Input
                placeholder="Role"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </div>

            <div className="flex flex-col">
              <label>Email</label>
              <Input
                placeholder="Email"
                type="email"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="flex flex-col">
              <label>Password</label>
              <Input
                placeholder="Password"
                type="password"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div className="flex flex-col">
              <label>System Role</label>
              <Select
                value={form.systemRole}
                onValueChange={(value) =>
                  setForm({ ...form, systemRole: value })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select system role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="IT_ADMIN">IT Admin</SelectItem>
                  <SelectItem value="HALL_ADMIN">Hall Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <label>Status</label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGISTERED">Registered</SelectItem>
                  <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateUser}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Create Employee
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Employee Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review employee details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Employee ID: {selectedUser?.user_id}
            </label>

            <div className="flex flex-col">
              <label>Name</label>
              <Input
                value={selectedUser?.name ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Email</label>
              <Input
                value={selectedUser?.email ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Department</label>
              <Input
                value={selectedUser?.department ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Role</label>
              <Input
                value={selectedUser?.role ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Status</label>
              <Input
                value={selectedUser?.status ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>
          </div>

          <SheetFooter>
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
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Edit Employee
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenDialog(true)}
                className="w-full rounded-sm py-5 font-medium"
              >
                Delete Employee
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openEditForm} onOpenChange={setOpenEditForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Edit Employee Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Update employee details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 p-4">
            <label className="text-xs text-gray-500">
              Employee ID: {selectedUser?.user_id}
            </label>

            <div className="flex flex-col">
              <label>Name</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Email</label>
              <Input
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Department</label>
              <Input
                value={editForm.department}
                onChange={(e) =>
                  setEditForm({ ...editForm, department: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>Role</label>
              <Input
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col">
              <label>System Role</label>
              <Select
                value={editForm.systemRole}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, systemRole: value })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select system role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="IT_ADMIN">IT Admin</SelectItem>
                  <SelectItem value="HALL_ADMIN">Hall Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <label>Status</label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, status: value })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGISTERED">Registered</SelectItem>
                  <SelectItem value="UNREGISTERED">Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateUser}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Employee
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

      <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
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
