"use client";

import React from "react";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
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
  CalendarIcon,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

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

type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role?: string;
  systemRole?: string;
};

const BUSINESS_START = 8 * 60 + 30; // 08:30 in minutes
const BUSINESS_END = 18 * 60 + 30; // 18:30 in minutes

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user as SessionUser | undefined;

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [openReservationForm, setOpenReservationForm] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const [reservationForm, setReservationForm] = useState({
    purpose: "",
    attendees_qty: "",
    hall_type: "",
    equipment: [] as string[],
    hall: [] as string[],
    time_from: "",
    time_to: "",
    other_request: "",
  });

  const { data: hallTypeData, isLoading: hallTypeLoading } = useQuery({
    queryKey: ["hallType", page],
    queryFn: async () => {
      const res = await fetch(`/api/halls/types/type`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const { data: hallData, isLoading: hallLoading } = useQuery({
    queryKey: ["hall", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
      });

      const res = await fetch(`/api/halls/rooms/room?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const { data: itemData, isLoading: itemLoading } = useQuery({
    queryKey: ["item", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
      });

      const res = await fetch(`/api/equipments/items/item?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  // Existing reservations — used for conflict checks, calendar marking, and the details panel
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

  // Non-working days — used to grey out and block booking on those dates
  const { data: nwdAllData } = useQuery({
    queryKey: ["nwd", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/no_work_days/nwd?limit=1000`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const nonWorkingDates = useMemo(() => {
    return new Set<string>(
      (nwdAllData?.data ?? []).map((d: { date: string }) =>
        format(new Date(d.date), "yyyy-MM-dd"),
      ),
    );
  }, [nwdAllData]);

  const dashboardStats = useMemo(() => {
    const allReservations = reservationData?.data ?? [];
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const totalTickets = allReservations.length;

    const totalDone = allReservations.filter(
      (res: any) => res.status === "DONE",
    ).length;

    const hallTickets = allReservations.filter(
      (res: any) => (res.hall?.length ?? 0) > 0,
    ).length;

    const obTickets = allReservations.filter(
      (res: any) => (res.hall?.length ?? 0) === 0,
    ).length;

    const todaysReservationsList = allReservations.filter((res: any) => {
      if (!isActiveReservation(res)) return false;
      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      return resDateStr === todayStr;
    });

    const upcomingReservationsList = allReservations.filter((res: any) => {
      if (!isActiveReservation(res)) return false;
      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      return resDateStr > todayStr;
    });

    return {
      totalTickets,
      totalDone,
      hallTickets,
      obTickets,
      todaysReservations: todaysReservationsList.length,
      upcomingReservations: upcomingReservationsList.length,
      todaysReservationsList,
      upcomingReservationsList,
    };
  }, [reservationData]);

  function toggleEquipment(id: string) {
    setReservationForm((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(id)
        ? prev.equipment.filter((item) => item !== id)
        : [...prev.equipment, id],
    }));
  }

  function toggleHall(id: string) {
    setReservationForm((prev) => ({
      ...prev,
      hall: prev.hall.includes(id)
        ? prev.hall.filter((item) => item !== id)
        : [...prev.hall, id],
    }));
  }

  function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function isActiveReservation(res: any) {
    return res.status !== "CANCELLED" && res.status !== "DECLINED";
  }

  // Reservations for the currently selected date (active ones only)
  const reservationsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const allReservations = reservationData?.data ?? [];
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

    return allReservations.filter((res: any) => {
      if (!isActiveReservation(res)) return false;
      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      return resDateStr === selectedDateStr;
    });
  }, [reservationData, selectedDate]);

  // Set of "yyyy-MM-dd" strings where the FULL 8:30AM–6:30PM window is booked
  // (merged time ranges across all active reservations for that date leave no gap)
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
      // sort and merge overlapping/adjacent ranges
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

      // fully occupied only if a single merged range covers the entire business day
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
      // combine date_appointment's date with time_from/time_to's hours & minutes
      // (mirrors the pattern already used in isReservationCancellable/isReservationEditable)
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
        resource: res, // keep full reservation object accessible for custom rendering/coloring
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

  function CustomDateHeader({ date, label }: { date: Date; label: string }) {
    const dateStr = format(date, "yyyy-MM-dd");
    const count = reservationCountByDate[dateStr] ?? 0;
    const isFull = fullyOccupiedDates.has(dateStr);

    return (
      <div className="flex items-center justify-between px-1 py-0.5">
        <span>{label}</span>
        {count > 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${
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

  function isPastDate(date: Date) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    return compareDate < startOfToday;
  }

  const isSelectedDateFullyOccupied = selectedDate
    ? fullyOccupiedDates.has(format(selectedDate, "yyyy-MM-dd"))
    : false;

  const isSelectedDatePast = selectedDate ? isPastDate(selectedDate) : false;

  const isSelectedDateNonWorking = selectedDate
    ? nonWorkingDates.has(format(selectedDate, "yyyy-MM-dd"))
    : false;

  function hasReservationConflict() {
    if (!selectedDate) return false;

    const existingReservations = reservationData?.data ?? [];
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

    const newStart = timeToMinutes(reservationForm.time_from);
    const newEnd = timeToMinutes(reservationForm.time_to);

    return existingReservations.some((res: any) => {
      if (!isActiveReservation(res)) return false;

      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      if (resDateStr !== selectedDateStr) return false;

      const resHallIds =
        res.hall?.map((h: { hall_id: string }) => h.hall_id) ?? [];
      const hasSameHall = reservationForm.hall.some((hallId) =>
        resHallIds.includes(hallId),
      );
      if (!hasSameHall) return false;

      const existingStart = timeToMinutes(
        new Date(res.time_from).toTimeString().slice(0, 5),
      );
      const existingEnd = timeToMinutes(
        new Date(res.time_to).toTimeString().slice(0, 5),
      );

      return newStart < existingEnd && newEnd > existingStart;
    });
  }

  const handleCreateHallReservation = async () => {
    // Validation
    if (!selectedDate) {
      toast.error("Please select reservation date");
      return;
    }

    if (nonWorkingDates.has(format(selectedDate, "yyyy-MM-dd"))) {
      toast.error("Selected date is a non-working day");
      return;
    }

    if (!user?.userId) {
      toast.error("Can't find user");
      return;
    }

    if (!reservationForm.purpose.trim()) {
      toast.error("Please enter a purpose");
      return;
    }

    if (!reservationForm.hall_type.trim()) {
      toast.error("Please select hall type");
      return;
    }

    if (reservationForm.hall.length === 0) {
      toast.error("Please select at least one hall");
      return;
    }

    if (!reservationForm.attendees_qty.trim()) {
      toast.error("Please enter quantity of attendees");
      return;
    }

    if (!reservationForm.time_from.trim()) {
      toast.error("Please enter a start time");
      return;
    }

    if (
      reservationForm.time_from < "08:30" ||
      reservationForm.time_from > "18:30"
    ) {
      toast.error("The time must be from 8:30AM to 6:30PM");
      return;
    }

    if (!reservationForm.time_to.trim()) {
      toast.error("Please enter an end time");
      return;
    }

    if (
      reservationForm.time_to < "08:30" ||
      reservationForm.time_to > "18:30"
    ) {
      toast.error("The time must be from 8:30AM to 6:30PM");
      return;
    }

    if (hasReservationConflict()) {
      toast.error("Selected hall is already reserved for this date and time");
      return;
    }

    const loadingToast = toast.loading("Creating reservation type ...");

    try {
      const res = await fetch(
        "/api/reservations/hall_reservations/reservation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...reservationForm,
            userId: user.userId,
            date_appointment: selectedDate,
            changes: "Has Create Hall Reservation",
          }),
        },
      );

      const data = await res.json();

      // delay AFTER response (for UX)
      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to create reservation");
        console.log("Error: ", data?.error);
        return;
      }

      toast.success(`New item type has been created`);

      setOpenReservationForm(false);
      setReservationForm({
        purpose: "",
        attendees_qty: "",
        hall_type: "",
        equipment: [] as string[],
        hall: [] as string[],
        time_from: "",
        time_to: "",
        other_request: "",
      });
      setSelectedDate(new Date());

      queryClient.invalidateQueries({
        queryKey: ["hallReservation"],
        exact: false,
      });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <p className="text-lg font-semibold">Dashboard</p>
        <p className="text-sm text-muted-foreground text-wrap">
          Create and view reservations
        </p>
      </div>

      <div className="flex flex-col lg:flex-row w-full gap-2">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row gap-2">
            <Card className="shadow-sm w-full h-fit">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tickets Created
                </CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.totalTickets}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm w-full h-fit">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Done Reservations
                </CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.totalDone}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-row gap-2">
            <Card className="shadow-sm w-full h-fit">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Hall Tickets
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.hallTickets}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm w-full h-fit">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  OB Tickets
                </CardTitle>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.obTickets}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today`s Reservation
              </CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-row justify-between">
              <div className="text-2xl font-bold">
                {dashboardStats.todaysReservations}
              </div>

              {dashboardStats.todaysReservationsList.length > 0 && (
                <div className="h-15 overflow-y-scroll space-y-1 pr-1">
                  {dashboardStats.todaysReservationsList.map((res: any) => (
                    <p
                      key={res.reservation_id}
                      className="text-xs text-muted-foreground"
                    >
                      {res.reservation_id} - {res.purpose}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Upcoming Reservation
              </CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-row justify-between">
              <div className="text-2xl font-bold">
                {dashboardStats.upcomingReservations}
              </div>

              {dashboardStats.upcomingReservationsList.length > 0 && (
                <div className="h-15 overflow-y-scroll space-y-1 pr-1">
                  {dashboardStats.upcomingReservationsList.map((res: any) => (
                    <p
                      key={res.reservation_id}
                      className="text-xs text-muted-foreground"
                    >
                      {res.reservation_id} - {res.purpose}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-2/3 rounded-xl border bg-white p-4 shadow">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700 }}
            defaultView="month"
            views={["month", "week", "day", "agenda"]}
            selectable
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
            onSelectSlot={(slotInfo) => {
              setSelectedDate(slotInfo.start);
            }}
            onDrillDown={(date) => {
              const normalized = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                12,
                0,
                0, // noon = safe from timezone rollover
              );
              setSelectedDate(normalized);
            }}
          />
        </div>

        <div className="w-full lg:w-1/3 rounded-xl border bg-white p-4 shadow flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Reservation Details -{" "}
            <span className="text-xs text-red-500">
              {selectedDate
                ? format(selectedDate, "PPP")
                : format(new Date(), "PPP")}
            </span>
          </h2>

          <div className="flex-1 overflow-y-auto space-y-2">
            {reservationsForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reservations for this date.
              </p>
            ) : (
              reservationsForSelectedDate.map((res: any) => (
                <div
                  key={res.reservation_id}
                  className="rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium">{res.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    Reserved by: {res.hall_user?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hall:{" "}
                    {res.hall
                      ?.map((h: { hall_name: string }) => h.hall_name)
                      .join(", ") ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(res.time_from).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(res.time_to).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {res.status}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="w-full h-fit">
            <Button
              className="w-full py-5"
              disabled={
                isSelectedDateFullyOccupied ||
                isSelectedDatePast ||
                isSelectedDateNonWorking
              }
              onClick={() => setOpenReservationForm(true)}
            >
              {isSelectedDatePast
                ? "Date has Passed"
                : isSelectedDateNonWorking
                  ? "Non-Working Day"
                  : isSelectedDateFullyOccupied
                    ? "Fully Booked"
                    : "Book Reservation"}
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={openReservationForm} onOpenChange={setOpenReservationForm}>
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              New Hall Reservation
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in reservation details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <p className="font-bold">
              Date Selected:{" "}
              {selectedDate
                ? format(selectedDate, "PPP")
                : format(new Date(), "PPP")}
            </p>

            {/* Purpose */}
            <div className="flex flex-col gap-1">
              <label>Purpose</label>
              <Input
                placeholder="e.g. Quarterly Town Hall"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={reservationForm.purpose}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    purpose: e.target.value,
                  })
                }
              />
            </div>

            {/* Hall Type */}
            <div className="flex flex-col gap-1">
              <label>Hall Type</label>
              <Select
                value={reservationForm.hall_type}
                onValueChange={(value) =>
                  setReservationForm({ ...reservationForm, hall_type: value })
                }
              >
                <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue
                    placeholder={
                      hallTypeLoading ? "Loading..." : "Select hall type"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Type</SelectLabel>
                    {hallTypeLoading ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading hall types...
                      </div>
                    ) : hallTypeData?.data?.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No hall types found
                      </div>
                    ) : (
                      hallTypeData?.data?.map(
                        (type: { type_id: string; type: string }) => (
                          <SelectItem key={type.type_id} value={type.type_id}>
                            {type.type}
                          </SelectItem>
                        ),
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Hall checklist */}
            <div className="flex flex-col gap-2">
              <label>Hall</label>
              <div className="grid grid-cols-2 gap-3 h-20 overflow-y-auto pr-2">
                {hallLoading ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    Loading halls...
                  </p>
                ) : hallData?.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    No halls found
                  </p>
                ) : (
                  hallData?.data?.map(
                    (item: { hall_id: string; hall_name: string }) => (
                      <div
                        key={item.hall_id}
                        className="flex items-center gap-1"
                      >
                        <Checkbox
                          id={`hall-${item.hall_id}`}
                          checked={reservationForm.hall.includes(item.hall_id)}
                          onCheckedChange={() => toggleHall(item.hall_id)}
                        />
                        <label
                          htmlFor={`hall-${item.hall_id}`}
                          className="font-normal cursor-pointer"
                        >
                          {item.hall_name}
                        </label>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>

            {/* Equipment checklist */}
            <div className="flex flex-col gap-2">
              <label>Equipment</label>
              <div className="grid grid-cols-2 gap-3 h-20 overflow-y-auto pr-2">
                {itemData?.data?.map(
                  (item: { item_id: string; item_name: string }) => (
                    <div key={item.item_id} className="flex items-center gap-2">
                      <Checkbox
                        id={`equipment-${item.item_id}`}
                        checked={reservationForm.equipment.includes(
                          item.item_id,
                        )}
                        onCheckedChange={() => toggleEquipment(item.item_id)}
                      />
                      <label
                        htmlFor={`equipment-${item.item_id}`}
                        className="font-normal cursor-pointer"
                      >
                        {item.item_name}
                      </label>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Attendees */}
            <div className="flex flex-col gap-1">
              <label>Number of Attendees</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 50"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={reservationForm.attendees_qty}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    attendees_qty: e.target.value,
                  })
                }
              />
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label>Time From</label>
                <Input
                  type="time"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={reservationForm.time_from}
                  onChange={(e) =>
                    setReservationForm({
                      ...reservationForm,
                      time_from: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label>Time To</label>
                <Input
                  type="time"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={reservationForm.time_to}
                  onChange={(e) =>
                    setReservationForm({
                      ...reservationForm,
                      time_to: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Other request */}
            <div className="flex flex-col gap-1">
              <label>Other Request</label>
              <Textarea
                placeholder="Any additional requirements..."
                className="resize-none rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={reservationForm.other_request}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    other_request: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateHallReservation}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Create Reservation
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
    </div>
  );
}
