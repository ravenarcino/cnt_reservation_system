"use client";

import React from "react";
import { useState, useMemo, useRef } from "react";
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
import { DateHoverPopup, type DateHoverPopupHandle } from "./date-hover-popup";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldLabel, FormSection, SelectCard, Summary } from "@/components/booking/form-parts";

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
  // Which calendar the user is looking at. Hall is the default; OB has no
  // reservations yet, so that tab shows its own non-working days only.
  const [calendarTab, setCalendarTab] = useState<"HALL" | "OB">("HALL");
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
        limit: "100",
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

  // Every hall booking by ANY user (times and halls only). Availability must
  // come from this: reservationData above holds only this user's own bookings.
  // Keyed under "hallReservation" so the existing refresh after booking also
  // refreshes this.
  const { data: hallOccupancyData } = useQuery({
    queryKey: ["hallReservation", "occupancy"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/hall_reservations/occupancy");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  // Everyone's OB trips (from today on) for the calendar's hover popup.
  const { data: obOccupancyData } = useQuery({
    queryKey: ["obReservation", "occupancy"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/occupancy");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  // Drives the hover popup without putting the hovered date in this
  // component's state - see date-hover-popup.tsx for why.
  const hoverPopupRef = useRef<DateHoverPopupHandle>(null);

  // Non-working days - used to grey out and block booking on those dates.
  // Scoped to the HALL calendar: an OB non-working day must not close the
  // halls, and vice versa.
  const { data: nwdAllData } = useQuery({
    queryKey: ["nwd", "HALL", "all"],
    queryFn: async () => {
      const res = await fetch(
        `/api/no_work_days/nwd?limit=1000&nwd_type=HALL`,
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  // OB non-working days, for the OB tab of the calendar.
  const { data: obNwdAllData } = useQuery({
    queryKey: ["nwd", "OB", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/no_work_days/nwd?limit=1000&nwd_type=OB`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const toDateSet = (rows: { date: string }[] | undefined) =>
    new Set<string>(
      (rows ?? []).map((d) => format(new Date(d.date), "yyyy-MM-dd")),
    );

  // HALL non-working days. These govern whether a hall can be booked, so they
  // are read from this set no matter which calendar tab is open.
  const nonWorkingDates = useMemo(
    () => toDateSet(nwdAllData?.data),
    [nwdAllData],
  );

  const obNonWorkingDates = useMemo(
    () => toDateSet(obNwdAllData?.data),
    [obNwdAllData],
  );

  // The set the calendar paints grey - follows the open tab.
  const activeNonWorkingDates =
    calendarTab === "OB" ? obNonWorkingDates : nonWorkingDates;

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

  // Set of "yyyy-MM-dd" strings where EVERY hall is booked solid for the whole
  // 8:30AM-6:30PM window. A date counts as fully occupied only when no hall has
  // any free gap left - if even one hall still has time available, the date
  // stays open (green, bookable).
  //
  // Halls whose status is FULL are treated as unavailable for the whole day.
  const fullyOccupiedDates = useMemo(() => {
    const allReservations = hallOccupancyData?.data ?? [];
    const allHalls = hallData?.data ?? [];

    // No halls loaded yet -> nothing can be declared fully booked.
    if (allHalls.length === 0) return new Set<string>();

    // Halls that can still be reserved at all (status OPEN).
    const openHallIds: string[] = allHalls
      .filter((h: any) => h.status !== "FULL")
      .map((h: any) => h.hall_id);

    // byDate[dateStr][hallId] = list of booked {start,end} minute ranges
    const byDate: Record<string, Record<string, { start: number; end: number }[]>> =
      {};

    allReservations.forEach((res: any) => {
      if (!isActiveReservation(res)) return;

      const dateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      const start = timeToMinutes(
        new Date(res.time_from).toTimeString().slice(0, 5),
      );
      const end = timeToMinutes(
        new Date(res.time_to).toTimeString().slice(0, 5),
      );

      const hallIds: string[] =
        res.hall?.map((h: { hall_id: string }) => h.hall_id) ?? [];

      if (!byDate[dateStr]) byDate[dateStr] = {};

      // A reservation can hold several halls at once - block each of them.
      hallIds.forEach((hallId) => {
        if (!byDate[dateStr][hallId]) byDate[dateStr][hallId] = [];
        byDate[dateStr][hallId].push({ start, end });
      });
    });

    // Is this single hall booked solid across the whole business day?
    const isHallFullForDay = (ranges: { start: number; end: number }[]) => {
      if (!ranges || ranges.length === 0) return false;

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

      return merged.some(
        (range) => range.start <= BUSINESS_START && range.end >= BUSINESS_END,
      );
    };

    const occupied = new Set<string>();

    Object.entries(byDate).forEach(([dateStr, hallRanges]) => {
      // Every OPEN hall must be booked solid for the date to be fully occupied.
      const everyHallFull = openHallIds.every((hallId) =>
        isHallFullForDay(hallRanges[hallId]),
      );

      if (everyHallFull) occupied.add(dateStr);
    });

    return occupied;
  }, [hallOccupancyData, hallData]);

  // True when every hall is manually marked FULL - no date is bookable at all.
  const allHallsMarkedFull = useMemo(() => {
    const allHalls = hallData?.data ?? [];
    if (allHalls.length === 0) return false;
    return allHalls.every((h: any) => h.status === "FULL");
  }, [hallData]);

  // Halls offered in the reservation form for the currently selected date.
  // A hall is hidden when it is marked FULL, or when it is already booked
  // solid for the whole 8:30AM-6:30PM window on that date.
  const selectableHalls = useMemo(() => {
    const allHalls = hallData?.data ?? [];
    if (!selectedDate) return allHalls;

    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    const allReservations = hallOccupancyData?.data ?? [];

    // Booked minute-ranges for each hall on the selected date.
    const rangesByHall: Record<string, { start: number; end: number }[]> = {};

    allReservations.forEach((res: any) => {
      if (!isActiveReservation(res)) return;

      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      if (resDateStr !== selectedDateStr) return;

      const start = timeToMinutes(
        new Date(res.time_from).toTimeString().slice(0, 5),
      );
      const end = timeToMinutes(
        new Date(res.time_to).toTimeString().slice(0, 5),
      );

      const hallIds: string[] =
        res.hall?.map((h: { hall_id: string }) => h.hall_id) ?? [];

      hallIds.forEach((hallId) => {
        if (!rangesByHall[hallId]) rangesByHall[hallId] = [];
        rangesByHall[hallId].push({ start, end });
      });
    });

    const isBookedAllDay = (ranges: { start: number; end: number }[]) => {
      if (!ranges || ranges.length === 0) return false;

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

      return merged.some(
        (range) => range.start <= BUSINESS_START && range.end >= BUSINESS_END,
      );
    };

    return allHalls.filter(
      (h: any) =>
        h.status !== "FULL" && !isBookedAllDay(rangesByHall[h.hall_id]),
    );
  }, [hallData, hallOccupancyData, selectedDate]);

  // Equipment offered in the reservation form - anything already BORROWED is
  // out of circulation and must not be selectable.
  const selectableItems = useMemo(() => {
    const allItems = itemData?.data ?? [];
    return allItems.filter((i: any) => i.status !== "BORROWED");
  }, [itemData]);

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

    const isHallTab = calendarTab === "HALL";

    let base: React.CSSProperties;
    // "Fully booked" is a hall notion - there are no OB bookings to fill a day.
    if (isHallTab && (allHallsMarkedFull || fullyOccupiedDates.has(dateStr))) {
      base = { backgroundColor: "#fef2f2", color: "#b91c1c" }; // light red (fully booked)
    } else if (activeNonWorkingDates.has(dateStr)) {
      base = { backgroundColor: "#f5f5f5", color: "#737373" }; // grey (non-working)
    } else if (isPastDate(date)) {
      base = { backgroundColor: "#fafafa", color: "#a3a3a3" }; // faint (past)
    } else {
      base = { backgroundColor: "#f0fdf4", color: "#166534" }; // light green (available)
    }

    // Highlight the currently selected (or default) date with a red border.
    const isSelected =
      selectedDate && format(selectedDate, "yyyy-MM-dd") === dateStr;
    if (isSelected) {
      base = {
        ...base,
        boxShadow: "inset 0 0 0 2px #dc2626", // brand red ring, no layout shift
        borderRadius: "8px", // curved corners
      };
    }

    return base;
  }

  function CustomDateHeader({ date, label }: { date: Date; label: string }) {
    const dateStr = format(date, "yyyy-MM-dd");
    // Hall reservation counts - there is no OB booking data to show yet.
    const count =
      calendarTab === "HALL"
        ? (reservationCountByDate[dateStr] ?? 0)
        : (obTripCountByDate[dateStr] ?? 0);
    const isFull =
      calendarTab === "HALL" &&
      (allHallsMarkedFull || fullyOccupiedDates.has(dateStr));

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
    const count =
      calendarTab === "HALL"
        ? (reservationCountByDate[dateStr] ?? 0)
        : (obTripCountByDate[dateStr] ?? 0);
    const isFull =
      calendarTab === "HALL" &&
      (allHallsMarkedFull || fullyOccupiedDates.has(dateStr));

    return (
      <div
        style={{
          position: "relative",
          flex: "1 1 0%",
          height: "100%",
          ...getDayStyle(value),
        }}
        onMouseEnter={(e) =>
          hoverPopupRef.current?.show(value, e.clientX, e.clientY)
        }
        onMouseLeave={() => hoverPopupRef.current?.hide()}
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

  // Month-view day header. Mirrors react-big-calendar's default (a button
  // that drills down to the day) and adds the hover popup, because the header
  // layer sits on top of the cell body and would otherwise swallow the hover.
  function HoverDateHeader({
    date,
    label,
    drilldownView,
    onDrillDown,
  }: {
    date: Date;
    label: string;
    drilldownView?: string | null;
    onDrillDown?: (e: React.MouseEvent) => void;
  }) {
    return (
      <span
        style={{ display: "block" }}
        onMouseEnter={(e) =>
          hoverPopupRef.current?.show(date, e.clientX, e.clientY)
        }
        onMouseLeave={() => hoverPopupRef.current?.hide()}
      >
        {drilldownView ? (
          <button type="button" className="rbc-button-link" onClick={onDrillDown}>
            {label}
          </button>
        ) : (
          label
        )}
      </span>
    );
  }

  function isPastDate(date: Date) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    return compareDate < startOfToday;
  }

  // ===================== OB (official business) trips =====================

  // The signed-in user's OB trips - for the calendar and the side panel.
  const { data: obReservationData } = useQuery({
    queryKey: ["obReservation"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const obTrips: any[] = obReservationData?.data ?? [];
  const obTicketCount = obTrips.length;
  const obDoneCount = obTrips.filter((t) => t.status === "DONE").length;

  // Today's and upcoming bookings across both hall and OB, for the two cards
  // at the top. An OB trip counts as "today" if any part of it falls on today
  // (it may have left yesterday), and as "upcoming" if it leaves after today.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const activeObTrips = obTrips.filter(
    (t) => t.status !== "CANCELLED" && t.status !== "DECLINED",
  );

  const todayItems = [
    ...dashboardStats.todaysReservationsList.map((r: any) => ({
      id: r.reservation_id,
      label: r.purpose,
    })),
    ...activeObTrips
      .filter(
        (t) => new Date(t.time_from) <= todayEnd && new Date(t.time_to) >= todayStart,
      )
      .map((t) => ({ id: t.ob_id, label: `${t.destination} - ${t.purpose}` })),
  ];

  const upcomingItems = [
    ...dashboardStats.upcomingReservationsList.map((r: any) => ({
      id: r.reservation_id,
      label: r.purpose,
    })),
    ...activeObTrips
      .filter((t) => new Date(t.time_from) > todayEnd)
      .map((t) => ({ id: t.ob_id, label: `${t.destination} - ${t.purpose}` })),
  ];

  // Every vehicle, for the booking form's checklist.
  const { data: obVehicleData, isLoading: obVehicleLoading } = useQuery({
    queryKey: ["vehicle", "all"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles/vehicles/vehicle?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  // Company drivers, for the booking form's checklist.
  const { data: obDriverData, isLoading: obDriverLoading } = useQuery({
    queryKey: ["driver", "all"],
    queryFn: async () => {
      const res = await fetch("/api/drivers/driver?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const [openObForm, setOpenObForm] = useState(false);
  const emptyObForm = {
    purpose: "",
    destination: "",
    passengers_qty: "",
    date_departure: "",
    time_from: "",
    date_return: "",
    time_to: "",
    vehicle: [] as string[],
    drivers: [] as string[],
    personal_driver: false,
    driver_name: "",
    other_request: "",
  };
  const [obForm, setObForm] = useState(emptyObForm);

  const obWindowComplete =
    !!obForm.date_departure &&
    !!obForm.time_from &&
    !!obForm.date_return &&
    !!obForm.time_to;

  // Vehicles already booked by ANYONE in the chosen window. The user's own
  // trip list cannot answer this - it only holds their trips - so the server
  // works it out and returns vehicle ids only.
  const { data: obAvailability, isFetching: obAvailabilityLoading } = useQuery({
    queryKey: [
      "obAvailability",
      obForm.date_departure,
      obForm.time_from,
      obForm.date_return,
      obForm.time_to,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_departure: obForm.date_departure,
        time_from: obForm.time_from,
        date_return: obForm.date_return,
        time_to: obForm.time_to,
      });
      const res = await fetch(
        `/api/reservations/ob_reservations/availability?${params}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
    enabled: openObForm && obWindowComplete,
  });

  const busyVehicleIds = new Set<string>(obAvailability?.busyVehicleIds ?? []);
  const busyDriverIds = new Set<string>(obAvailability?.busyDriverIds ?? []);

  function toggleObDriver(id: string) {
    setObForm((prev) => ({
      ...prev,
      drivers: prev.drivers.includes(id)
        ? prev.drivers.filter((dr) => dr !== id)
        : [...prev.drivers, id],
    }));
  }

  function toggleObVehicle(id: string) {
    setObForm((prev) => ({
      ...prev,
      vehicle: prev.vehicle.includes(id)
        ? prev.vehicle.filter((v) => v !== id)
        : [...prev.vehicle, id],
    }));
  }

  // OB trips drawn on the calendar. A trip can span several days, so the
  // event runs from departure to return.
  const obCalendarEvents = useMemo(() => {
    const trips = obReservationData?.data ?? [];
    return trips
      .filter((t: any) => t.status !== "CANCELLED" && t.status !== "DECLINED")
      .map((t: any) => ({
        id: t.ob_id,
        title: `${t.destination} - ${t.purpose}`,
        start: new Date(t.time_from),
        end: new Date(t.time_to),
        resource: t,
      }));
  }, [obReservationData]);

  // Number of active OB trips on each day, for the badge in each calendar cell.
  // A trip spanning several days is counted on every one of them.
  const obTripCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    (obReservationData?.data ?? []).forEach((t: any) => {
      if (t.status === "CANCELLED" || t.status === "DECLINED") return;

      const day = new Date(t.time_from);
      day.setHours(0, 0, 0, 0);
      const last = new Date(t.time_to);

      while (day <= last) {
        const key = format(day, "yyyy-MM-dd");
        counts[key] = (counts[key] ?? 0) + 1;
        day.setDate(day.getDate() + 1);
      }
    });
    return counts;
  }, [obReservationData]);

  // Trips that are underway at any point on the selected day.
  const obTripsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    return (obReservationData?.data ?? []).filter(
      (t: any) =>
        t.status !== "CANCELLED" &&
        t.status !== "DECLINED" &&
        new Date(t.time_from) <= dayEnd &&
        new Date(t.time_to) >= dayStart,
    );
  }, [obReservationData, selectedDate]);

  const isSelectedDateObNonWorking = selectedDate
    ? obNonWorkingDates.has(format(selectedDate, "yyyy-MM-dd"))
    : false;

  function openObFormForSelectedDate() {
    const day = format(selectedDate ?? new Date(), "yyyy-MM-dd");
    setObForm({ ...emptyObForm, date_departure: day, date_return: day });
    setOpenObForm(true);
  }

  const selectedObCapacity = (obVehicleData?.data ?? [])
    .filter((v: any) => obForm.vehicle.includes(v.vehicle_id))
    .reduce((sum: number, v: any) => sum + (v.capacity ?? 0), 0);

  const handleCreateObReservation = async () => {
    if (!obForm.purpose.trim()) return toast.error("Please enter a purpose");
    if (!obForm.destination.trim())
      return toast.error("Please enter a destination");

    const passengers = Number(obForm.passengers_qty);
    if (!Number.isInteger(passengers) || passengers < 1)
      return toast.error("Please enter the number of passengers");

    if (!obWindowComplete)
      return toast.error("Please complete the departure and return schedule");

    const start = new Date(`${obForm.date_departure}T${obForm.time_from}`);
    const end = new Date(`${obForm.date_return}T${obForm.time_to}`);
    if (end <= start) return toast.error("Return must be after departure");
    if (start < new Date()) return toast.error("Departure cannot be in the past");

    if (obNonWorkingDates.has(obForm.date_departure))
      return toast.error("Departure date is a non-working day");
    if (obNonWorkingDates.has(obForm.date_return))
      return toast.error("Return date is a non-working day");

    if (obForm.vehicle.length === 0)
      return toast.error("Please select at least one vehicle");

    if (obForm.personal_driver && !obForm.driver_name.trim())
      return toast.error("Please enter the personal driver's name");
    if (obForm.drivers.length === 0 && !obForm.personal_driver)
      return toast.error("Please select at least one driver");
    if (obForm.drivers.some((id) => busyDriverIds.has(id)))
      return toast.error(
        "Some selected drivers are already assigned at that time",
      );

    const nowBusy = obForm.vehicle.filter((id) => busyVehicleIds.has(id));
    if (nowBusy.length > 0)
      return toast.error(
        "Some selected vehicles are already booked for that time",
      );

    const loadingToast = toast.loading("Booking OB trip...");

    try {
      const res = await fetch("/api/reservations/ob_reservations/reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obForm),
      });
      const data = await res.json();

      toast.dismiss(loadingToast);

      if (!res.ok) {
        // e.g. a vehicle taken by someone else a moment ago
        toast.error(data?.error ?? "Failed to book OB trip");
        queryClient.invalidateQueries({ queryKey: ["obAvailability"], exact: false });
        return;
      }

      toast.success("OB trip has been booked");
      setOpenObForm(false);
      setObForm(emptyObForm);

      queryClient.invalidateQueries({ queryKey: ["obReservation"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["obAvailability"], exact: false });
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const isSelectedDateFullyOccupied = selectedDate
    ? allHallsMarkedFull ||
      fullyOccupiedDates.has(format(selectedDate, "yyyy-MM-dd"))
    : false;

  const isSelectedDatePast = selectedDate ? isPastDate(selectedDate) : false;

  const isSelectedDateNonWorking = selectedDate
    ? nonWorkingDates.has(format(selectedDate, "yyyy-MM-dd"))
    : false;

  function hasReservationConflict() {
    if (!selectedDate) return false;

    const existingReservations = hallOccupancyData?.data ?? [];
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

    const loadingToast = toast.loading("Creating reservation ...");

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
        // Surface the server's reason (e.g. an item was taken mid-submit)
        // instead of a generic failure the user can't act on.
        toast.error(data?.error ?? "Failed to create reservation");
        console.log("Error: ", data?.error);

        // Another user's claim may have changed what's still available.
        queryClient.invalidateQueries({ queryKey: ["item"], exact: false });
        return;
      }

      toast.success("Reservation has been created");

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

      // The booked items are now BORROWED and the halls just lost a slot -
      // refetch both so the next form opens with an accurate list.
      queryClient.invalidateQueries({ queryKey: ["item"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["hall"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  return (
    // On large screens the page fills exactly the viewport below the top bar
    // (48px) and the layout padding (2 x 24px): the calendar and the side
    // panel stretch to fit, and only the booking list scrolls inside.
    <div className="dashboard-fit flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground text-wrap">
          Create and view reservations
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex w-full min-h-0 flex-col rounded-lg border border-border bg-white p-4 lg:w-2/3">
          <div className="mb-3 inline-flex w-fit shrink-0 rounded-md border p-1">
            {(["HALL", "OB"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCalendarTab(tab)}
                className={
                  calendarTab === tab
                    ? "rounded px-4 py-1.5 text-sm font-medium bg-brand text-white"
                    : "rounded px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                }
              >
                {tab === "HALL" ? "Hall" : "OB"}
              </button>
            ))}
          </div>

          <DateHoverPopup
            ref={hoverPopupRef}
            tab={calendarTab}
            hallBookings={hallOccupancyData?.data ?? []}
            obTrips={obOccupancyData?.data ?? []}
          />

          <div className="min-h-[520px] flex-1 lg:min-h-[380px]">
          <Calendar
            localizer={localizer}
            events={calendarTab === "HALL" ? calendarEvents : obCalendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            defaultView="month"
            views={["month", "week", "day", "agenda"]}
            selectable
            components={{
              dateCellWrapper: CustomDateCellWrapper,
              month: { dateHeader: HoverDateHeader },
            }}
            eventPropGetter={(event: any) => {
              const status = event.resource?.status;
              const colorMap: Record<string, string> = {
                // Same colours as the status pills.
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
                  backgroundColor: colorMap[status] ?? "#0ea5e9",
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

          {/* Legend - matches getDayStyle */}
          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {[
              ["#f0fdf4", "#bbf7d0", "Available"],
              ...(calendarTab === "HALL" ? [["#fef2f2", "#fecaca", "Fully booked"]] : []),
              ["#f5f5f5", "#e5e5e5", "Non-working day"],
              ["#fafafa", "#e5e5e5", "Past"],
            ].map(([bg, border, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: bg, borderColor: border }} />
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm ring-2 ring-inset ring-brand" />
              Selected
            </span>
          </div>
        </div>

        <div className="flex w-full min-h-0 flex-col rounded-lg border border-border bg-white lg:w-1/3">
          {/* Selected date */}
          <div className="flex shrink-0 items-center gap-4 border-b border-border p-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-brand-soft text-brand">
              <span className="text-[10px] font-semibold uppercase">
                {format(selectedDate ?? new Date(), "MMM")}
              </span>
              <span className="text-xl font-bold leading-none tabular-nums">
                {format(selectedDate ?? new Date(), "d")}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{format(selectedDate ?? new Date(), "EEEE")}</p>
              <p className="text-xs text-muted-foreground">
                {calendarTab === "OB"
                  ? `${obTripsForSelectedDate.length} OB trip${obTripsForSelectedDate.length === 1 ? "" : "s"}`
                  : `${reservationsForSelectedDate.length} reservation${reservationsForSelectedDate.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {/* Bookings on that date, as a timeline */}
          <div className="min-h-[200px] flex-1 overflow-y-auto p-4 lg:min-h-0">
            {calendarTab === "OB" ? (
              obTripsForSelectedDate.length === 0 ? (
                <EmptyState title="No OB trips on this date" className="py-6" />
              ) : (
                <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                  {obTripsForSelectedDate.map((trip: any) => (
                    <li key={trip.ob_id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand ring-4 ring-white" />
                      <p className="text-xs font-medium tabular-nums text-muted-foreground">
                        {format(new Date(trip.time_from), "MMM d, h:mm a")} – {format(new Date(trip.time_to), "MMM d, h:mm a")}
                      </p>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{trip.destination}</p>
                        <StatusBadge status={trip.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{trip.purpose}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {trip.vehicle?.map((v: { vehicle_name: string }) => v.vehicle_name).join(", ") || "—"} ·{" "}
                        {[
                          ...(trip.drivers ?? []).map((dr: { driver_name: string }) => dr.driver_name),
                          ...(trip.driver_name ? [`${trip.driver_name} (personal)`] : []),
                        ].join(", ") || "No driver"}
                      </p>
                    </li>
                  ))}
                </ol>
              )
            ) : reservationsForSelectedDate.length === 0 ? (
              <EmptyState title="No reservations on this date" className="py-6" />
            ) : (
              <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                {reservationsForSelectedDate.map((res: any) => (
                  <li key={res.reservation_id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand ring-4 ring-white" />
                    <p className="text-xs font-medium tabular-nums text-muted-foreground">
                      {format(new Date(res.time_from), "h:mm a")} – {format(new Date(res.time_to), "h:mm a")}
                    </p>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{res.purpose}</p>
                      <StatusBadge status={res.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {res.hall?.map((h: { hall_name: string }) => h.hall_name).join(", ") ?? "—"} ·{" "}
                      {res.hall_user?.name ?? "Unknown"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="w-full h-fit shrink-0 border-t border-border p-4">
            {calendarTab === "OB" ? (
              <Button
                className="w-full py-5"
                disabled={isSelectedDatePast || isSelectedDateObNonWorking}
                onClick={openObFormForSelectedDate}
              >
                {isSelectedDatePast
                  ? "Date has Passed"
                  : isSelectedDateObNonWorking
                    ? "Non-Working Day"
                    : "Book OB Trip"}
              </Button>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      <Sheet open={openReservationForm} onOpenChange={setOpenReservationForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              New Hall Reservation
            </SheetTitle>
            <SheetDescription className="text-white">
              Fill in reservation details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Details">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="hall-purpose">Purpose</FieldLabel>
                <Input
                  id="hall-purpose"
                  placeholder="e.g. Quarterly Town Hall"
                  value={reservationForm.purpose}
                  onChange={(e) =>
                    setReservationForm({ ...reservationForm, purpose: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="hall-attendees">Number of attendees</FieldLabel>
                <Input
                  id="hall-attendees"
                  type="number"
                  min={1}
                  placeholder="e.g. 50"
                  value={reservationForm.attendees_qty}
                  onChange={(e) =>
                    setReservationForm({ ...reservationForm, attendees_qty: e.target.value })
                  }
                />
              </div>
            </FormSection>

            <FormSection
              step={2}
              title="Venue"
              hint={reservationForm.hall.length ? `${reservationForm.hall.length} selected` : undefined}
            >
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Hall type</FieldLabel>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hallLoading ? (
                  <p className="col-span-full text-sm text-muted-foreground">Loading halls...</p>
                ) : selectableHalls.length === 0 ? (
                  <p className="col-span-full rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    {reservationForm.hall_type ? "No halls available for this date" : "Pick a hall type first"}
                  </p>
                ) : (
                  selectableHalls.map((item: { hall_id: string; hall_name: string; floor?: string }) => (
                    <SelectCard
                      key={item.hall_id}
                      selected={reservationForm.hall.includes(item.hall_id)}
                      onToggle={() => toggleHall(item.hall_id)}
                      title={item.hall_name}
                      subtitle={item.floor ? `Floor ${item.floor}` : undefined}
                    />
                  ))
                )}
              </div>
            </FormSection>

            <FormSection step={3} title="Schedule" hint={format(selectedDate ?? new Date(), "EEE, MMM d")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="hall-from">From</FieldLabel>
                  <Input
                    id="hall-from"
                    type="time"
                    value={reservationForm.time_from}
                    onChange={(e) =>
                      setReservationForm({ ...reservationForm, time_from: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="hall-to">To</FieldLabel>
                  <Input
                    id="hall-to"
                    type="time"
                    value={reservationForm.time_to}
                    onChange={(e) =>
                      setReservationForm({ ...reservationForm, time_to: e.target.value })
                    }
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              step={4}
              title="Extras"
              hint={reservationForm.equipment.length ? `${reservationForm.equipment.length} item(s)` : "Optional"}
            >
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {selectableItems.length === 0 ? (
                  <p className="col-span-full text-xs text-muted-foreground">No equipment available</p>
                ) : (
                  selectableItems.map((item: { item_id: string; item_name: string; item_brand?: string | null }) => (
                    <SelectCard
                      key={item.item_id}
                      selected={reservationForm.equipment.includes(item.item_id)}
                      onToggle={() => toggleEquipment(item.item_id)}
                      title={item.item_name}
                      subtitle={item.item_brand ?? undefined}
                    />
                  ))
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="hall-other">Other request</FieldLabel>
                <Textarea
                  id="hall-other"
                  placeholder="Any additional requirements..."
                  className="resize-none"
                  value={reservationForm.other_request}
                  onChange={(e) =>
                    setReservationForm({ ...reservationForm, other_request: e.target.value })
                  }
                />
              </div>
            </FormSection>

            <Summary
              rows={[
                ["Date", format(selectedDate ?? new Date(), "EEEE, MMM d, yyyy")],
                ["Time", reservationForm.time_from && reservationForm.time_to ? `${reservationForm.time_from} – ${reservationForm.time_to}` : ""],
                [
                  "Hall",
                  selectableHalls
                    .filter((h: { hall_id: string }) => reservationForm.hall.includes(h.hall_id))
                    .map((h: { hall_name: string }) => h.hall_name)
                    .join(", "),
                ],
                ["Attendees", reservationForm.attendees_qty],
              ]}
            />
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateHallReservation}
              className="w-full h-10"
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

      {/* ---------------------------- OB trip booking ---------------------------- */}
      <Sheet open={openObForm} onOpenChange={setOpenObForm}>
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">New OB Trip</SheetTitle>
            <SheetDescription className="text-white">
              Book company vehicles for an official business trip.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <FormSection step={1} title="Trip details">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-purpose">Purpose</FieldLabel>
                <Input
                  id="ob-purpose"
                  type="text"
                  placeholder="e.g. Client meeting"
                  value={obForm.purpose}
                  onChange={(e) => setObForm({ ...obForm, purpose: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-destination">Destination</FieldLabel>
                <Input
                  id="ob-destination"
                  type="text"
                  placeholder="e.g. Makati City"
                  value={obForm.destination}
                  onChange={(e) => setObForm({ ...obForm, destination: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-pax">Number of passengers</FieldLabel>
                <Input
                  id="ob-pax"
                  type="number"
                  min={1}
                  placeholder="e.g. 4"
                  value={obForm.passengers_qty}
                  onChange={(e) => setObForm({ ...obForm, passengers_qty: e.target.value })}
                />
              </div>
            </FormSection>

            <FormSection step={2} title="Schedule">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-dep-date">Departure date</FieldLabel>
                <Input
                  id="ob-dep-date"
                  type="date"
                  placeholder=""
                  value={obForm.date_departure}
                  onChange={(e) => setObForm({ ...obForm, date_departure: e.target.value })}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-dep-time">Departure time</FieldLabel>
                <Input
                  id="ob-dep-time"
                  type="time"
                  placeholder=""
                  value={obForm.time_from}
                  onChange={(e) => setObForm({ ...obForm, time_from: e.target.value })}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-ret-date">Return date</FieldLabel>
                <Input
                  id="ob-ret-date"
                  type="date"
                  min={obForm.date_departure || undefined}
                  placeholder=""
                  value={obForm.date_return}
                  onChange={(e) => setObForm({ ...obForm, date_return: e.target.value })}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-ret-time">Return time</FieldLabel>
                <Input
                  id="ob-ret-time"
                  type="time"
                  placeholder=""
                  value={obForm.time_to}
                  onChange={(e) => setObForm({ ...obForm, time_to: e.target.value })}
                />
                </div>
              </div>
            </FormSection>

            <FormSection
              step={3}
              title="Vehicle"
              hint={
                obForm.vehicle.length > 0 && selectedObCapacity > 0
                  ? `${selectedObCapacity} seats selected`
                  : undefined
              }
            >
              {!obWindowComplete ? (
                <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  Set the schedule first to see which vehicles are free.
                </p>
              ) : obVehicleLoading || obAvailabilityLoading ? (
                <p className="text-sm text-muted-foreground">Checking availability...</p>
              ) : (obVehicleData?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles registered yet.</p>
              ) : (
                <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1">
                  {(obVehicleData?.data ?? []).map((v: any) => {
                    const reason = busyVehicleIds.has(v.vehicle_id)
                      ? "Booked"
                      : v.status === "IN_USE"
                        ? "In use"
                        : v.status === "MAINTENANCE"
                          ? "Maintenance"
                          : null;
                    const selected = obForm.vehicle.includes(v.vehicle_id);
                    return (
                      <SelectCard
                        key={v.vehicle_id}
                        selected={selected}
                        // An already-ticked vehicle stays clickable even if it
                        // became busy, so the user can still untick it.
                        disabled={!!reason && !selected}
                        onToggle={() => toggleObVehicle(v.vehicle_id)}
                        title={v.vehicle_name}
                        subtitle={[v.plate_number, v.capacity ? `${v.capacity} seats` : null].filter(Boolean).join(" · ")}
                        badge={reason ?? undefined}
                      />
                    );
                  })}
                </div>
              )}
              {obForm.vehicle.length > 0 &&
                selectedObCapacity > 0 &&
                Number(obForm.passengers_qty) > selectedObCapacity && (
                  <p className="text-xs text-red-600">
                    Only {selectedObCapacity} seats - not enough for all passengers.
                  </p>
                )}
            </FormSection>

            <FormSection step={4} title="Driver">
              {!obWindowComplete ? (
                <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  Set the schedule first to see which drivers are free.
                </p>
              ) : obDriverLoading || obAvailabilityLoading ? (
                <p className="text-sm text-muted-foreground">Checking availability...</p>
              ) : (
                <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {(obDriverData?.data ?? []).map((dr: any) => {
                    const reason = busyDriverIds.has(dr.driver_id)
                      ? "Unavailable"
                      : dr.status === "ON_LEAVE"
                        ? "On leave"
                        : null;
                    const selected = obForm.drivers.includes(dr.driver_id);
                    return (
                      <SelectCard
                        key={dr.driver_id}
                        selected={selected}
                        disabled={!!reason && !selected}
                        onToggle={() => toggleObDriver(dr.driver_id)}
                        title={dr.driver_name}
                        badge={reason ?? undefined}
                      />
                    );
                  })}
                  <SelectCard
                    selected={obForm.personal_driver}
                    onToggle={() =>
                      setObForm({
                        ...obForm,
                        personal_driver: !obForm.personal_driver,
                        // Clear the name when unticked so a stale value is
                        // never sent with the booking.
                        driver_name: obForm.personal_driver ? "" : obForm.driver_name,
                      })
                    }
                    title="Personal driver"
                    subtitle="Bring your own driver"
                  />
                </div>
              )}
              {obForm.personal_driver && (
                <Input
                  placeholder="Personal driver's name"
                  value={obForm.driver_name}
                  onChange={(e) => setObForm({ ...obForm, driver_name: e.target.value })}
                />
              )}
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ob-other">Other request</FieldLabel>
                <Textarea
                  id="ob-other"
                  className="resize-none"
                  placeholder="Optional"
                  value={obForm.other_request}
                  onChange={(e) => setObForm({ ...obForm, other_request: e.target.value })}
                />
              </div>
            </FormSection>

            <Summary
              rows={[
                ["Destination", obForm.destination],
                [
                  "Leaves",
                  obForm.date_departure && obForm.time_from ? `${obForm.date_departure} ${obForm.time_from}` : "",
                ],
                ["Returns", obForm.date_return && obForm.time_to ? `${obForm.date_return} ${obForm.time_to}` : ""],
                [
                  "Vehicle",
                  (obVehicleData?.data ?? [])
                    .filter((v: any) => obForm.vehicle.includes(v.vehicle_id))
                    .map((v: any) => v.vehicle_name)
                    .join(", "),
                ],
                ["Passengers", obForm.passengers_qty],
              ]}
            />
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateObReservation}
              className="w-full h-10"
            >
              Book OB Trip
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
