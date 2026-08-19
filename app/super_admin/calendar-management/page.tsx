"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Ticket,
  Building2,
  Radio,
  CalendarCheck,
  CalendarClock,
  Search,
  Ellipsis,
  User,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const BUSINESS_START = 8 * 60 + 30; // 08:30 in minutes
const BUSINESS_END = 18 * 60 + 30; // 18:30 in minutes

type NoWorkDay = {
  id: number;
  nwd_id: string;
  date: string;
  description: string;
  type: string;
};

export default function CalendarPage() {
  const [changeMode, setChangeMode] = useState(false);
  const [calendarView, setCalendarView] = useState("month");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [openNwdForm, setOpenNwdForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;
  const queryClient = useQueryClient();
  const [nwdForm, setNwdForm] = useState({
    date: "",
    description: "",
    type: "",
  });
  const [openView, setOpenView] = useState(false);
  const [openEditForm, setOpenEditForm] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedNwd, setSelectedNwd] = useState<NoWorkDay | null>(null);
  const [editNwdForm, setEditNwdForm] = useState({
    date: "",
    description: "",
    type: "",
  });

  const { data: nwdData, isLoading: nwdLoading } = useQuery({
    queryKey: ["nwd", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
      });

      const res = await fetch(`/api/no_work_days/nwd?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const noWorkDays: NoWorkDay[] = nwdData?.data ?? [];
  const totalNwd = nwdData?.total ?? 0;
  const totalPages = Math.ceil(totalNwd / limit) || 1;

  // Fetch all non-working days (unpaginated) for the calendar view
  const { data: nwdAllData } = useQuery({
    queryKey: ["nwd", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/no_work_days/nwd?limit=1000`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const nonWorkingDates = new Set<string>(
    (nwdAllData?.data ?? []).map((d: NoWorkDay) =>
      format(new Date(d.date), "yyyy-MM-dd"),
    ),
  );

  // Existing reservations — used for calendar coloring, counts and events
  const { data: reservationData } = useQuery({
    queryKey: ["hallReservation"],
    queryFn: async () => {
      const res = await fetch(
        `/api/reservations/hall_reservations/reservation`,
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function isActiveReservation(res: any) {
    return res.status !== "CANCELLED" && res.status !== "DECLINED";
  }

  function isPastDate(date: Date) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    return compareDate < startOfToday;
  }

  // Set of "yyyy-MM-dd" strings where the FULL 8:30AM–6:30PM window is booked
  const fullyOccupiedDates = useMemo(() => {
    const allReservations = reservationData?.data ?? [];
    const byDate: Record<string, { start: number; end: number }[]> = {};

    allReservations.forEach((res: any) => {
      if (!isActiveReservation(res)) return;

      const dateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      const start = timeToMinutes(
        new Date(res.time_from).toTimeString().slice(0, 5),
      );
      const end = timeToMinutes(
        new Date(res.time_to).toTimeString().slice(0, 5),
      );

      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push({ start, end });
    });

    const occupied = new Set<string>();

    Object.entries(byDate).forEach(([dateStr, ranges]) => {
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      const merged: { start: number; end: number }[] = [];

      for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (last && range.start <= last.end) {
          last.end = Math.max(last.end, range.end);
        } else {
          merged.push({ ...range });
        }
      }

      const coversFullDay = merged.some(
        (range) => range.start <= BUSINESS_START && range.end >= BUSINESS_END,
      );

      if (coversFullDay) occupied.add(dateStr);
    });

    return occupied;
  }, [reservationData]);

  // Count of active reservations per "yyyy-MM-dd" date
  const reservationCountByDate = useMemo(() => {
    const allReservations = reservationData?.data ?? [];
    const counts: Record<string, number> = {};

    allReservations.forEach((res: any) => {
      if (!isActiveReservation(res)) return;
      const dateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      counts[dateStr] = (counts[dateStr] ?? 0) + 1;
    });

    return counts;
  }, [reservationData]);

  // Map reservations into react-big-calendar's { title, start, end } event shape
  const calendarEvents = useMemo(() => {
    const allReservations = reservationData?.data ?? [];

    return allReservations.filter(isActiveReservation).map((res: any) => {
      const start = new Date(res.date_appointment);
      const startTime = new Date(res.time_from);
      start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

      const end = new Date(res.date_appointment);
      const endTime = new Date(res.time_to);
      end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

      return {
        id: res.reservation_id,
        title: res.purpose,
        start,
        end,
        resource: res,
      };
    });
  }, [reservationData]);

  // Shared day coloring used by both the month cell wrapper and dayPropGetter
  function getDayStyle(date: Date): React.CSSProperties {
    const dateStr = format(date, "yyyy-MM-dd");

    if (fullyOccupiedDates.has(dateStr)) {
      return { backgroundColor: "#fee2e2", color: "#991b1b" }; // light red
    }

    if (nonWorkingDates.has(dateStr)) {
      return { backgroundColor: "#e5e7eb", color: "#6b7280" }; // light grey
    }

    if (isPastDate(date)) {
      return { backgroundColor: "#f3f4f6", color: "#9ca3af" }; // light grey (past)
    }

    return { backgroundColor: "#dcfce7", color: "#166534" }; // light green (available)
  }

  function CustomDateCellWrapper({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: Date;
  }) {
    const dateStr = format(value, "yyyy-MM-dd");
    const count = reservationCountByDate[dateStr] ?? 0;
    const isFull = fullyOccupiedDates.has(dateStr);

    return (
      <div
        style={{
          position: "relative",
          flex: "1 1 0%",
          height: "100%",
          ...getDayStyle(value),
        }}
      >
        {children}
        {count > 0 && (
          <span
            className={`pointer-events-none absolute bottom-1 right-1 z-10 flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-xs font-medium shadow-sm ${
              isFull ? "text-red-600" : "text-green-600"
            }`}
          >
            <User className="h-3 w-3" />
            {count}
          </span>
        )}
      </div>
    );
  }

  const handleCreateNwd = async () => {
    // Validation
    if (!nwdForm.date.trim()) {
      toast.error("Please select a date");
      return;
    }
    if (!nwdForm.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    if (!nwdForm.type.trim()) {
      toast.error("Please select a type");
      return;
    }

    const loadingToast = toast.loading("Creating non-working day ...");
    setCreating(true);

    try {
      const res = await fetch("/api/no_work_days/nwd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nwdForm,
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setCreating(false);

      if (!res.ok) {
        toast.error("Failed to create non-working day");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New non-working day has been created`);

      setOpenNwdForm(false);
      setNwdForm({
        date: "",
        description: "",
        type: "",
      });

      queryClient.invalidateQueries({
        queryKey: ["nwd"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      setCreating(false);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleUpdateNwd = async () => {
    if (!selectedNwd) return;

    // Validation
    if (!editNwdForm.date.trim()) {
      toast.error("Please select a date");
      return;
    }
    if (!editNwdForm.description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    if (!editNwdForm.type.trim()) {
      toast.error("Please select a type");
      return;
    }

    const loadingToast = toast.loading("Updating non-working day...");

    try {
      const res = await fetch(`/api/no_work_days/${selectedNwd.nwd_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editNwdForm,
        }),
      });

      const data = await res.json();

      // UX delay
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to update non-working day");
        console.log("Error:", data);
        return;
      }

      toast.success("Non-working day has been updated");

      setOpenEditForm(false);
      setSelectedNwd(null);

      queryClient.invalidateQueries({
        queryKey: ["nwd"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteNwd = async () => {
    if (!selectedNwd) return;

    const loadingToast = toast.loading("Deleting non-working day...");
    setDeleting(true);

    try {
      const res = await fetch(`/api/no_work_days/${selectedNwd.nwd_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      // UX delay
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setDeleting(false);

      if (!res.ok) {
        toast.error("Failed to delete non-working day");
        console.log("Error:", data);
        return;
      }

      toast.success("Non-working day has been deleted");

      setOpenDeleteDialog(false);
      setSelectedNwd(null);

      queryClient.invalidateQueries({
        queryKey: ["nwd"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      setDeleting(false);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Calendar Management</p>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage non-working days and dayoff requests
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-fit">
          <Button
            onClick={() => setOpenNwdForm(true)}
            className="w-full lg:w-fit bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
          >
            + Add Non-working Day
          </Button>

          {changeMode ? (
            <Button
              onClick={() => setChangeMode(false)}
              className="w-full bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
            >
              View Table
            </Button>
          ) : (
            <Button
              onClick={() => setChangeMode(true)}
              className="w-full bg-green-800 text-white px-4 py-4 rounded-sm font-medium "
            >
              View Calendar
            </Button>
          )}
        </div>
      </div>
      {!changeMode && (
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative lg:w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              placeholder="Search non-working day"
              className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}
      {changeMode ? (
        <div className="w-full flex flex-row justify-center">
          <div className="w-full lg:w-2/3 rounded-xl border bg-white p-4 shadow">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 700 }}
              view={calendarView as any}
              onView={(view) => setCalendarView(view)}
              date={calendarDate}
              onNavigate={(date) => setCalendarDate(date)}
              onDrillDown={(date) => {
                setCalendarDate(date);
                setCalendarView("day");
              }}
              views={["month", "week", "day", "agenda"]}
              components={{
                month: {
                  dateCellWrapper: CustomDateCellWrapper,
                  event: () => null,
                },
              }}
              eventPropGetter={(event) => {
                const status = event.resource?.status;
                const colorMap: Record<string, string> = {
                  APPROVED: "#16a34a",
                  PENDING: "#ca8a04",
                  FOR_APPROVAL: "#ca8a04",
                  FOR_REVIEW: "#ea580c",
                  DECLINED: "#dc2626",
                  CANCELLED: "#6b7280",
                };
                return {
                  style: {
                    backgroundColor: colorMap[status] ?? "#2563eb",
                    borderRadius: "4px",
                    border: "none",
                  },
                };
              }}
              dayPropGetter={(date) => ({
                style: getDayStyle(date),
              })}
            />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <Tabs defaultValue="nwd" className="w-full">
            <TabsList>
              <TabsTrigger value="nwd">Non Working Days</TabsTrigger>
              <TabsTrigger value="dr">Dayoff Request</TabsTrigger>
            </TabsList>
            <TabsContent value="nwd">
              <div className="flex-1 overflow-auto rounded-md border">
                <Table>
                  {nwdLoading ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Spinner />
                            <span>Loading data</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : noWorkDays.length === 0 ? (
                    <TableBody>
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-muted-foreground"
                        >
                          No non-working days found
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No.</TableHead>
                          <TableHead>NWD ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {noWorkDays.map((nwd, index) => (
                          <TableRow key={nwd.nwd_id}>
                            <TableCell className="font-medium">
                              {index + 1 + (page - 1) * limit}
                            </TableCell>

                            <TableCell className="font-medium">
                              {nwd.nwd_id}
                            </TableCell>

                            <TableCell>
                              {format(new Date(nwd.date), "MMM d, yyyy")}
                            </TableCell>

                            <TableCell>{nwd.description}</TableCell>

                            <TableCell>
                              {nwd.type === "HOLIDAY" ? "Holiday" : "Custom"}
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
                                        setSelectedNwd(nwd);
                                        setOpenView(true);
                                      }}
                                    >
                                      View
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedNwd(nwd);
                                        setEditNwdForm({
                                          date: format(
                                            new Date(nwd.date),
                                            "yyyy-MM-dd",
                                          ),
                                          description: nwd.description,
                                          type: nwd.type,
                                        });
                                        setOpenEditForm(true);
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => {
                                        setSelectedNwd(nwd);
                                        setOpenDeleteDialog(true);
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
                      className={
                        page === 1 ? "pointer-events-none opacity-50" : ""
                      }
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
                        page === totalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </TabsContent>
            <TabsContent value="dr">Change your password here.</TabsContent>
          </Tabs>
        </div>
      )}

      <Sheet open={openNwdForm} onOpenChange={setOpenNwdForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Add Non-Working Day
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in the non-working day details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label>Date</label>
              <Input
                type="date"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={nwdForm.date}
                onChange={(e) =>
                  setNwdForm({ ...nwdForm, date: e.target.value })
                }
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label>Description</label>
              <Textarea
                placeholder="e.g. Christmas Day, Founder's Day"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={nwdForm.description}
                onChange={(e) =>
                  setNwdForm({ ...nwdForm, description: e.target.value })
                }
              />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <label>Type</label>

              <Select
                value={nwdForm.type}
                onValueChange={(value) =>
                  setNwdForm({
                    ...nwdForm,
                    type: value,
                  })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder={"Type"} />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Type</SelectLabel>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                    <SelectItem value="HOLIDAY">Holiday</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateNwd}
              disabled={creating}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              {creating ? "Creating..." : "Create Non-Working Day"}
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

      {/* View Non-Working Day */}
      <Sheet open={openView} onOpenChange={setOpenView}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Non-Working Day Detail
            </SheetTitle>
            <SheetDescription className="text-white">
              Review the non-working day details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              NWD ID: {selectedNwd?.nwd_id}
            </label>

            <div className="flex flex-col">
              <label>Date</label>
              <Input
                value={
                  selectedNwd?.date
                    ? format(new Date(selectedNwd.date), "MMM d, yyyy")
                    : ""
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Description</label>
              <Input
                value={selectedNwd?.description ?? ""}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>

            <div className="flex flex-col">
              <label>Type</label>
              <Input
                value={selectedNwd?.type === "HOLIDAY" ? "Holiday" : "Custom"}
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                readOnly
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={() => {
                setOpenView(false);
                if (selectedNwd) {
                  setEditNwdForm({
                    date: format(new Date(selectedNwd.date), "yyyy-MM-dd"),
                    description: selectedNwd.description,
                    type: selectedNwd.type,
                  });
                }
                setOpenEditForm(true);
              }}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Edit
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenDeleteDialog(true)}
                className="w-full rounded-sm py-5 font-medium"
              >
                Delete
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Non-Working Day */}
      <Sheet open={openEditForm} onOpenChange={setOpenEditForm}>
        <SheetContent side="right" className=" overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Edit Non-Working Day
            </SheetTitle>
            <SheetDescription className="text-white">
              Update the non-working day details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              NWD ID: {selectedNwd?.nwd_id}
            </label>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label>Date</label>
              <Input
                type="date"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={editNwdForm.date}
                onChange={(e) =>
                  setEditNwdForm({ ...editNwdForm, date: e.target.value })
                }
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label>Description</label>
              <Textarea
                placeholder="e.g. Christmas Day, Founder's Day"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={editNwdForm.description}
                onChange={(e) =>
                  setEditNwdForm({
                    ...editNwdForm,
                    description: e.target.value,
                  })
                }
              />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <label>Type</label>

              <Select
                value={editNwdForm.type}
                onValueChange={(value) =>
                  setEditNwdForm({
                    ...editNwdForm,
                    type: value,
                  })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder={"Type"} />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Type</SelectLabel>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                    <SelectItem value="HOLIDAY">Holiday</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateNwd}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Non-Working Day
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

      {/* Delete Non-Working Day */}
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent className="">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete this non-working day?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNwd}
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
