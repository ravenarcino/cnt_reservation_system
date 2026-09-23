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
      base = { backgroundColor: "#fee2e2", color: "#991b1b" }; // light red
    } else if (activeNonWorkingDates.has(dateStr)) {
      base = { backgroundColor: "#e5e7eb", color: "#6b7280" }; // light grey
    } else if (isPastDate(date)) {
      base = { backgroundColor: "#f3f4f6", color: "#9ca3af" }; // light grey (past)
    } else {
      base = { backgroundColor: "#dcfce7", color: "#166534" }; // light green (available)
    }

    // Highlight the currently selected (or default) date with a red border.
    const isSelected =
      selectedDate && format(selectedDate, "yyyy-MM-dd") === dateStr;
    if (isSelected) {
      base = {
        ...base,
        boxShadow: "inset 0 0 0 2px #f87171", // light red border, no layout shift
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
    <div className="h-full flex flex-col gap-5">
      <div>
        <h1 className="page-title">Dashboard</h1>
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
                  {dashboardStats.totalTickets + obTicketCount}
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
                  {dashboardStats.totalDone + obDoneCount}
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
                  {obTicketCount}
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
                {todayItems.length}
              </div>

              {todayItems.length > 0 && (
                <div className="h-15 overflow-y-scroll space-y-1 pr-1">
                  {todayItems.map((item) => (
                    <p key={item.id} className="text-xs text-muted-foreground">
                      {item.id} - {item.label}
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
                {upcomingItems.length}
              </div>

              {upcomingItems.length > 0 && (
                <div className="h-15 overflow-y-scroll space-y-1 pr-1">
                  {upcomingItems.map((item) => (
                    <p key={item.id} className="text-xs text-muted-foreground">
                      {item.id} - {item.label}
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
          <div className="mb-3 inline-flex rounded-md border p-1">
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

          <Calendar
            localizer={localizer}
            events={calendarTab === "HALL" ? calendarEvents : obCalendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700 }}
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
            {calendarTab === "OB" ? "OB Details" : "Reservation Details"} -{" "}
            <span className="text-xs text-red-500">
              {selectedDate
                ? format(selectedDate, "PPP")
                : format(new Date(), "PPP")}
            </span>
          </h2>

          <div className="flex-1 overflow-y-auto space-y-2">
            {calendarTab === "OB" ? (
              obTripsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No OB trips on this date.
                </p>
              ) : (
                obTripsForSelectedDate.map((trip: any) => (
                  <div
                    key={trip.ob_id}
                    className="rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium">{trip.destination}</p>
                    <p className="text-xs text-muted-foreground">
                      {trip.purpose}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vehicle:{" "}
                      {trip.vehicle
                        ?.map((v: { vehicle_name: string }) => v.vehicle_name)
                        .join(", ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Driver:{" "}
                      {[
                        ...(trip.drivers ?? []).map(
                          (dr: { driver_name: string }) => dr.driver_name,
                        ),
                        ...(trip.driver_name ? [`${trip.driver_name} (personal)`] : []),
                      ].join(", ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(trip.time_from), "MMM d, h:mm a")} –{" "}
                      {format(new Date(trip.time_to), "MMM d, h:mm a")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {trip.status}
                    </p>
                  </div>
                ))
              )
            ) : reservationsForSelectedDate.length === 0 ? (
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
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-brand">
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
                ) : selectableHalls.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    No halls available for this date
                  </p>
                ) : (
                  selectableHalls.map(
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
                {selectableItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    No equipment available
                  </p>
                ) : (
                  selectableItems.map(
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
                  )
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
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
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
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">New OB Trip</SheetTitle>
            <SheetDescription className="text-white">
              Book company vehicles for an official business trip.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
              <label>Purpose</label>
              <Input
                placeholder="e.g. Client meeting"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={obForm.purpose}
                onChange={(e) =>
                  setObForm({ ...obForm, purpose: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Destination</label>
              <Input
                placeholder="e.g. Makati City"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={obForm.destination}
                onChange={(e) =>
                  setObForm({ ...obForm, destination: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Number of Passengers</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 4"
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={obForm.passengers_qty}
                onChange={(e) =>
                  setObForm({ ...obForm, passengers_qty: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label>Departure Date</label>
                <Input
                  type="date"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={obForm.date_departure}
                  onChange={(e) =>
                    setObForm({ ...obForm, date_departure: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label>Departure Time</label>
                <Input
                  type="time"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={obForm.time_from}
                  onChange={(e) =>
                    setObForm({ ...obForm, time_from: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label>Return Date</label>
                <Input
                  type="date"
                  min={obForm.date_departure || undefined}
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={obForm.date_return}
                  onChange={(e) =>
                    setObForm({ ...obForm, date_return: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label>Return Time</label>
                <Input
                  type="time"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={obForm.time_to}
                  onChange={(e) =>
                    setObForm({ ...obForm, time_to: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Vehicles - availability depends on the schedule above */}
            <div className="flex flex-col gap-2">
              <label>Vehicles</label>
              {!obWindowComplete ? (
                <p className="text-sm text-muted-foreground">
                  Set the departure and return schedule first to see which
                  vehicles are free.
                </p>
              ) : obVehicleLoading || obAvailabilityLoading ? (
                <p className="text-sm text-muted-foreground">
                  Checking availability...
                </p>
              ) : (obVehicleData?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vehicles registered yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
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
                      <div key={v.vehicle_id} className="flex items-center gap-2">
                        <Checkbox
                          id={`ob-vehicle-${v.vehicle_id}`}
                          // An already-ticked vehicle stays clickable even if it
                          // became busy, so the user can still untick it.
                          disabled={!!reason && !selected}
                          checked={selected}
                          onCheckedChange={() => toggleObVehicle(v.vehicle_id)}
                        />
                        <label
                          htmlFor={`ob-vehicle-${v.vehicle_id}`}
                          className={
                            reason
                              ? "font-normal text-red-500 cursor-not-allowed"
                              : "font-normal cursor-pointer"
                          }
                        >
                          {v.vehicle_name}
                          {v.plate_number ? ` (${v.plate_number})` : ""}
                          {v.capacity ? ` - ${v.capacity} seats` : ""}
                          {reason && <span className="text-xs"> ({reason})</span>}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
              {obForm.vehicle.length > 0 && selectedObCapacity > 0 && (
                <p
                  className={
                    Number(obForm.passengers_qty) > selectedObCapacity
                      ? "text-xs text-red-500"
                      : "text-xs text-muted-foreground"
                  }
                >
                  Selected seats: {selectedObCapacity}
                  {Number(obForm.passengers_qty) > selectedObCapacity &&
                    " - not enough for all passengers"}
                </p>
              )}
            </div>

            {/* Drivers - company pool as checkboxes, plus a personal driver */}
            <div className="flex flex-col gap-2">
              <label>Driver</label>
              {!obWindowComplete ? (
                <p className="text-sm text-muted-foreground">
                  Set the departure and return schedule first to see which
                  drivers are free.
                </p>
              ) : obDriverLoading || obAvailabilityLoading ? (
                <p className="text-sm text-muted-foreground">
                  Checking availability...
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                  {(obDriverData?.data ?? []).map((dr: any) => {
                    const reason = busyDriverIds.has(dr.driver_id)
                      ? "On another trip"
                      : dr.status === "ON_LEAVE"
                        ? "On leave"
                        : null;
                    const selected = obForm.drivers.includes(dr.driver_id);

                    return (
                      <div key={dr.driver_id} className="flex items-center gap-2">
                        <Checkbox
                          id={`ob-driver-${dr.driver_id}`}
                          disabled={!!reason && !selected}
                          checked={selected}
                          onCheckedChange={() => toggleObDriver(dr.driver_id)}
                        />
                        <label
                          htmlFor={`ob-driver-${dr.driver_id}`}
                          className={
                            reason
                              ? "font-normal text-red-500 cursor-not-allowed"
                              : "font-normal cursor-pointer"
                          }
                        >
                          {dr.driver_name}
                          {reason && <span className="text-xs"> ({reason})</span>}
                        </label>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ob-driver-personal"
                      checked={obForm.personal_driver}
                      onCheckedChange={(checked) =>
                        setObForm({
                          ...obForm,
                          personal_driver: checked === true,
                          // Clear the name when unticked so a stale value is
                          // never sent with the booking.
                          driver_name: checked === true ? obForm.driver_name : "",
                        })
                      }
                    />
                    <label
                      htmlFor="ob-driver-personal"
                      className="font-normal cursor-pointer"
                    >
                      Personal driver
                    </label>
                  </div>
                </div>
              )}

              {obForm.personal_driver && (
                <Input
                  placeholder="Personal driver's name"
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={obForm.driver_name}
                  onChange={(e) =>
                    setObForm({ ...obForm, driver_name: e.target.value })
                  }
                />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label>Other Request</label>
              <Textarea
                className="resize-none rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                value={obForm.other_request}
                onChange={(e) =>
                  setObForm({ ...obForm, other_request: e.target.value })
                }
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleCreateObReservation}
              className="w-full bg-brand rounded-sm py-5 text-white font-medium"
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
