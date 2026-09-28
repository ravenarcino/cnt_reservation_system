"use client";

import { FilterStrip, PageHeader, Segmented } from "@/components/management/parts";
import { FormSection, FieldLabel } from "@/components/booking/form-parts";
import { DetailGrid, DetailItem } from "@/components/booking/detail-parts";
import { cn } from "@/lib/utils";

import { EmptyState } from "@/components/ui/empty-state";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, differenceInCalendarDays } from "date-fns";
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

// Which calendar this page manages. Sent on create/edit and used to filter
// the list, so HALL and OB never show each other's entries.
const NWD_TYPE = "HALL";

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
    type: "HOLIDAY",
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
    queryKey: ["nwd", NWD_TYPE, page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        nwd_type: NWD_TYPE,
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
    queryKey: ["nwd", NWD_TYPE, "all"],
    queryFn: async () => {
      const res = await fetch(
        `/api/no_work_days/nwd?limit=1000&nwd_type=${NWD_TYPE}`,
      );
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
          nwd_type: NWD_TYPE,
        }),
      });

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setCreating(false);

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to create non-working day");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New non-working day has been created`);

      setOpenNwdForm(false);
      setNwdForm({
        date: "",
        description: "",
        type: "HOLIDAY",
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
          nwd_type: NWD_TYPE,
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

  // Non-working days split for the summary strip. A strip bucket filters
  // on the client over every entry; "all" uses the paged API list.
  const [nwdFilter, setNwdFilter] = useState("all");
  const allNwd: NoWorkDay[] = nwdAllData?.data ?? [];
  const daysAway = (d: NoWorkDay) => differenceInCalendarDays(new Date(d.date), new Date());
  const nwdBucket = (d: NoWorkDay) =>
    daysAway(d) < 0 ? "PAST" : d.type === "HOLIDAY" ? "HOLIDAY" : "CUSTOM";
  const q = search.trim().toLowerCase();
  const nwdRows: NoWorkDay[] =
    nwdFilter === "all"
      ? noWorkDays
      : allNwd
          .filter((d) => nwdBucket(d) === nwdFilter && (!q || d.description.toLowerCase().includes(q)))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextNwd = allNwd
    .filter((d) => daysAway(d) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return (
    <div className="h-full flex flex-col gap-5">
      <PageHeader title="Hall calendar" count={allNwd.length} subtitle="Non-working days and bookings for halls">
        <div className="w-full sm:w-52">
          <Segmented
            value={changeMode ? "calendar" : "list"}
            onChange={(v) => setChangeMode(v === "calendar")}
            options={[
              { value: "list", label: "List" },
              { value: "calendar", label: "Calendar" },
            ]}
          />
        </div>
        <Button onClick={() => setOpenNwdForm(true)}>+ Add non-working day</Button>
      </PageHeader>

      <FilterStrip
        title={nextNwd ? `Next non-working day: ${format(new Date(nextNwd.date), "EEE, MMM d")} · ${nextNwd.description}` : "Non-working days"}
        total={allNwd.length}
        active={nwdFilter}
        onSelect={(key) => {
          setNwdFilter(key);
          setChangeMode(false);
          setPage(1);
        }}
        items={[
          { key: "HOLIDAY", label: "Upcoming holidays", color: "#dc2626", count: allNwd.filter((d) => nwdBucket(d) === "HOLIDAY").length },
          { key: "CUSTOM", label: "Upcoming custom days", color: "#f59e0b", count: allNwd.filter((d) => nwdBucket(d) === "CUSTOM").length },
          { key: "PAST", label: "Past", color: "#a3a3a3", count: allNwd.filter((d) => nwdBucket(d) === "PAST").length },
        ]}
      />

      {changeMode ? (
        <div className="rounded-lg border border-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {[
              ["#dcfce7", "Open"],
              ["#fee2e2", "Fully booked"],
              ["#e5e7eb", "Non-working day"],
              ["#f3f4f6", "Past"],
            ].map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm ring-1 ring-inset ring-black/5" style={{ backgroundColor: c }} />
                {l}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3 w-3" /> Bookings that day
            </span>
          </div>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 680 }}
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
                dateCellWrapper: CustomDateCellWrapper,
                month: {
                  event: () => null,
                },
              }}
              eventPropGetter={(event: any) => {
                const status = event.resource?.status;
                const colorMap: Record<string, string> = {
                  APPROVED: "#10b981",
                  PENDING: "#f59e0b",
                  FOR_APPROVAL: "#f97316",
                  FOR_REVIEW: "#f97316",
                  DECLINED: "#ef4444",
                  CANCELLED: "#a3a3a3",
                  DONE: "#0ea5e9",
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
      ) : (
        <div className="flex h-full flex-col">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative lg:w-full lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by description"
                    className="pl-9"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex-1 overflow-auto rounded-lg border border-border bg-white">
                <Table>
                  {nwdLoading ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Spinner />
                            <span>Loading non-working days</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : nwdRows.length === 0 ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          <EmptyState
                            title="No non-working days found"
                            description="Add one to block the date on the calendar."
                            action={<Button size="sm" onClick={() => setOpenNwdForm(true)}>+ Add non-working day</Button>}
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {nwdRows.map((nwd) => {
                          const away = daysAway(nwd);
                          const d = new Date(nwd.date);
                          return (
                            <TableRow
                              key={nwd.nwd_id}
                              className={cn("cursor-pointer", away < 0 && "text-muted-foreground")}
                              onClick={(e) => {
                                // The action menu renders in a portal; ignore its clicks.
                                if (!e.currentTarget.contains(e.target as Node)) return;
                                if ((e.target as HTMLElement).closest("button")) return;
                                setSelectedNwd(nwd);
                                setOpenView(true);
                              }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-white leading-none">
                                    <span className="text-[10px] font-semibold uppercase text-brand">{format(d, "MMM")}</span>
                                    <span className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{format(d, "d")}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{format(d, "EEEE")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {away === 0 ? "Today" : away === 1 ? "Tomorrow" : away > 0 ? `In ${away} days` : format(d, "yyyy")}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="max-w-md whitespace-normal">{nwd.description}</TableCell>

                              <TableCell>
                                <span
                                  className={cn(
                                    "inline-flex rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                                    nwd.type === "HOLIDAY"
                                      ? "bg-red-50 text-red-700 ring-red-200"
                                      : "bg-neutral-100 text-neutral-700 ring-neutral-200",
                                  )}
                                >
                                  {nwd.type === "HOLIDAY" ? "Holiday" : "Custom"}
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
                                            date: format(new Date(nwd.date), "yyyy-MM-dd"),
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
                          );
                        })}
                      </TableBody>
                    </>
                  )}
                </Table>
              </div>
              <Pagination className={nwdFilter === "all" ? "mt-4 justify-center lg:justify-end" : "hidden"}>
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
        </div>
      )}

      <Sheet open={openNwdForm} onOpenChange={setOpenNwdForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              New non-working day
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in the non-working day details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Date" hint="Bookings are blocked on this day.">
              <Input
                type="date"
                value={nwdForm.date}
                onChange={(e) => setNwdForm({ ...nwdForm, date: e.target.value })}
              />
            </FormSection>

            <FormSection step={2} title="Details">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  placeholder="e.g. Christmas Day, Founder's Day"
                  value={nwdForm.description}
                  onChange={(e) => setNwdForm({ ...nwdForm, description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Type</FieldLabel>
                <Segmented
                  value={(nwdForm.type || "HOLIDAY") as "HOLIDAY" | "CUSTOM"}
                  onChange={(v) => setNwdForm({ ...nwdForm, type: v })}
                  options={[
                    { value: "HOLIDAY", label: "Holiday" },
                    { value: "CUSTOM", label: "Custom" },
                  ]}
                />
              </div>
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateNwd}
              disabled={creating}
              className="w-full h-10"
            >
              {creating ? "Creating..." : "Add non-working day"}
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

      {/* View Non-Working Day */}
      <Sheet open={openView} onOpenChange={setOpenView}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Non-working day
            </SheetTitle>
            <SheetDescription className="text-white">
              Review the non-working day details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-neutral-50 p-4">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-white leading-none">
                <span className="text-[11px] font-semibold uppercase text-brand">
                  {selectedNwd ? format(new Date(selectedNwd.date), "MMM") : ""}
                </span>
                <span className="mt-1 text-xl font-semibold tabular-nums">
                  {selectedNwd ? format(new Date(selectedNwd.date), "d") : ""}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-muted-foreground">{selectedNwd?.nwd_id}</p>
                <p className="text-lg font-semibold leading-tight">{selectedNwd?.description}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedNwd ? format(new Date(selectedNwd.date), "EEEE, MMMM d, yyyy") : ""}
                </p>
              </div>
            </div>
            <DetailGrid>
              <DetailItem label="Type" value={selectedNwd?.type === "HOLIDAY" ? "Holiday" : "Custom"} />
              <DetailItem
                label="When"
                value={
                  selectedNwd
                    ? (() => {
                        const a = daysAway(selectedNwd);
                        return a === 0 ? "Today" : a === 1 ? "Tomorrow" : a > 0 ? `In ${a} days` : `${-a} days ago`;
                      })()
                    : ""
                }
              />
            </DetailGrid>
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
              className="w-full h-10"
            >
              Edit
            </Button>

            <SheetClose asChild>
              <Button
                variant="destructive"
                onClick={() => setOpenDeleteDialog(true)}
                className="w-full h-10"
              >
                Delete
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Non-Working Day */}
      <Sheet open={openEditForm} onOpenChange={setOpenEditForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit non-working day
            </SheetTitle>
            <SheetDescription className="text-white">
              Update the non-working day details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Date" hint="Bookings are blocked on this day.">
              <Input
                type="date"
                value={editNwdForm.date}
                onChange={(e) => setEditNwdForm({ ...editNwdForm, date: e.target.value })}
              />
            </FormSection>

            <FormSection step={2} title="Details">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  placeholder="e.g. Christmas Day, Founder's Day"
                  value={editNwdForm.description}
                  onChange={(e) => setEditNwdForm({ ...editNwdForm, description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Type</FieldLabel>
                <Segmented
                  value={(editNwdForm.type || "HOLIDAY") as "HOLIDAY" | "CUSTOM"}
                  onChange={(v) => setEditNwdForm({ ...editNwdForm, type: v })}
                  options={[
                    { value: "HOLIDAY", label: "Holiday" },
                    { value: "CUSTOM", label: "Custom" },
                  ]}
                />
              </div>
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateNwd}
              className="w-full h-10"
            >
              Save changes
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
