"use client";

import { useEffect, useState, useRef } from "react";
import {
  CalendarIcon,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Plus,
  RefreshCw,
  Search,
  MoreVertical,
  Building2,
  Clock,
  FileText,
  MapPin,
  X,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ReservationStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Completed";

type Reservation = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatarInitials: string;
  location: string;
  time: string;
  purpose: string;
  status: ReservationStatus;
  date: Date;
  createdDate: string;
  approvedBy: string | null;
};

const CURRENT_USER_ID = "EMP-001";

const today = new Date();
today.setHours(0, 0, 0, 0);

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: "RES-001",
    employeeId: "EMP-002",
    employeeName: "Marielle Santos",
    department: "Finance",
    avatarInitials: "MS",
    location: "Finance Meeting Room",
    time: "9:00 AM - 10:00 AM",
    purpose: "Quarterly budget review",
    status: "Approved",
    date: today,
    createdDate: "Jul 2, 2026",
    approvedBy: "Robjun Dela Cruz",
  },
  {
    id: "RES-002",
    employeeId: "EMP-003",
    employeeName: "Angelica Talidro",
    department: "Human Resources",
    avatarInitials: "AT",
    location: "HR Training Room",
    time: "10:30 AM - 11:30 AM",
    purpose: "New hire orientation",
    status: "Pending",
    date: today,
    createdDate: "Jul 5, 2026",
    approvedBy: null,
  },
  {
    id: "RES-003",
    employeeId: "EMP-004",
    employeeName: "Julius Ramos",
    department: "IT Support",
    avatarInitials: "JR",
    location: "Server Room B",
    time: "1:00 PM - 2:00 PM",
    purpose: "Server migration briefing",
    status: "Rejected",
    date: today,
    createdDate: "Jul 4, 2026",
    approvedBy: "Robjun Dela Cruz",
  },
  {
    id: "RES-004",
    employeeId: "EMP-005",
    employeeName: "Kristine Bautista",
    department: "Marketing",
    avatarInitials: "KB",
    location: "Marketing Lounge",
    time: "3:00 PM - 4:00 PM",
    purpose: "Campaign planning session",
    status: "Cancelled",
    date: today,
    createdDate: "Jul 1, 2026",
    approvedBy: null,
  },
  {
    id: "RES-005",
    employeeId: CURRENT_USER_ID,
    employeeName: "Dean Arcino",
    department: "IT Support",
    avatarInitials: "DA",
    location: "IT Server Room",
    time: "8:00 AM - 9:00 AM",
    purpose: "Weekly standup",
    status: "Approved",
    date: addDays(today, 2),
    createdDate: "Jul 6, 2026",
    approvedBy: "Angelica Talidro",
  },
  {
    id: "RES-006",
    employeeId: CURRENT_USER_ID,
    employeeName: "Dean Arcino",
    department: "IT Support",
    avatarInitials: "DA",
    location: "IT Server Room",
    time: "2:00 PM - 3:00 PM",
    purpose: "Equipment inventory check",
    status: "Approved",
    date: today,
    createdDate: "Jul 8, 2026",
    approvedBy: "Robjun Dela Cruz",
  },
];

const FULLY_RESERVED_DATES = [addDays(today, 1), addDays(today, 4)];
const UNAVAILABLE_DATES = [addDays(today, 6), addDays(today, 7)];

const MAX_SLOTS_PER_DAY = 8;

const STATUS_BADGE_STYLES: Record<ReservationStatus, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Approved: "bg-green-100 text-green-800 border-green-200",
  Completed: "bg-blue-100 text-blue-800 border-blue-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  Cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function ReservationDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [reservations, setReservations] = useState<Reservation[]>(MOCK_RESERVATIONS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const reservationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 700);
  };

  const reservationsOnSelectedDate = reservations.filter((r) =>
    isSameDay(r.date, selectedDate)
  );

  const filteredReservations = reservationsOnSelectedDate.filter((r) => {
    const matchesSearch =
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.purpose.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    const matchesDepartment =
      departmentFilter === "all" || r.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const departments = Array.from(
    new Set(reservations.map((r) => r.department))
  );

  const remainingSlots = Math.max(
    MAX_SLOTS_PER_DAY - reservationsOnSelectedDate.length,
    0
  );

  // ================= TODAY'S / UPCOMING RESERVATION (CURRENT USER) =================
  const myReservations = reservations.filter(
    (r) => r.employeeId === CURRENT_USER_ID
  );

  const todaysReservation =
    myReservations.find((r) => isSameDay(r.date, today)) ?? null;

  const upcomingReservation =
    myReservations
      .filter(
        (r) =>
          r.date.getTime() > today.getTime() &&
          (r.status === "Pending" || r.status === "Approved")
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;

  const upcomingDaysAway = upcomingReservation
    ? Math.round(
        (upcomingReservation.date.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const upcomingDistanceLabel =
    upcomingDaysAway === 1
      ? "Tomorrow"
      : upcomingDaysAway >= 2 && upcomingDaysAway <= 6
      ? `In ${upcomingDaysAway} Days`
      : "Next Week";

    const scrollToReservation = () => {
      reservationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

  return (
    <div className="min-h-screen bg-muted/30 p-4 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ================= DASHBOARD HEADER ================= */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Reservation Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserve an available schedule and monitor reservations for your
              selected date.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="rounded-md"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* ================= TODAY'S RESERVATION + UPCOMING RESERVATION ROW ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">
              Today`s Reservation
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 lg:p-6">
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : todaysReservation ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <Badge
                    variant="outline"
                    className={`w-fit px-3 py-1 text-sm font-semibold ${
                      STATUS_BADGE_STYLES[todaysReservation.status]
                    }`}
                  >
                    {todaysReservation.status}
                  </Badge>

                  <Separator orientation="vertical" className="hidden h-10 sm:block" />

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-green-700" />
                      <span className="font-medium text-foreground">
                        {todaysReservation.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-green-700" />
                      {todaysReservation.time}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-green-700" />
                      {todaysReservation.location}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-green-700" />
                      {todaysReservation.purpose}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Created {todaysReservation.createdDate}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md"
                    onClick={() => {
                      setSelectedReservation(todaysReservation);
                      setSheetOpen(true);
                    }}
                  >
                    View Details
                  </Button>

                  {todaysReservation.status === "Pending" && (
                    <Button
                      variant="destructive"
                      className="rounded-md"
                      onClick={() =>
                        setReservations((prev) =>
                          prev.map((r) =>
                            r.id === todaysReservation.id
                              ? { ...r, status: "Cancelled" }
                              : r
                          )
                        )
                      }
                    >
                      <CalendarX2 className="mr-2 h-4 w-4" />
                      Cancel Reservation
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <span className="rounded-full bg-green-100 p-4 text-green-800">
                  <CalendarIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No Reservation Today
                </p>
                <p className="max-w-[260px] text-xs text-muted-foreground">
                  You don&apos;t have any reservation scheduled for today.
                </p>
                <Button className="mt-1 rounded-md bg-green-800 text-white hover:bg-green-900" onClick={scrollToReservation}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Reserve Schedule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================= UPCOMING RESERVATION ================= */}
        <Card className="border shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">
              Upcoming Reservation
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 lg:p-6">
            {isLoading ? (
              <Skeleton className="h-28 w-full rounded-lg" />
            ) : upcomingReservation ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`px-3 py-1 text-sm font-semibold ${
                        STATUS_BADGE_STYLES[upcomingReservation.status]
                      }`}
                    >
                      {upcomingReservation.status}
                    </Badge>

                    <Badge className="bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
                      {upcomingDistanceLabel}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-green-700" />
                      <span className="font-medium text-foreground">
                        {upcomingReservation.date.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-green-700" />
                      {upcomingReservation.time}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-green-700" />
                      {upcomingReservation.location}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-green-700" />
                      {upcomingReservation.purpose}
                    </div>
                  </div>

                  {/* Visual Timeline */}
                  <div className="mt-4 flex max-w-sm items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Today
                    </span>
                    <div className="relative h-px flex-1 bg-border">
                      <span className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-green-700" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {upcomingDistanceLabel === "Tomorrow"
                        ? "Tomorrow"
                        : upcomingReservation.date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md"
                    onClick={() => {
                      setSelectedReservation(upcomingReservation);
                      setSheetOpen(true);
                    }}
                  >
                    View Details
                  </Button>

                  {upcomingReservation.status === "Pending" && (
                    <Button
                      variant="destructive"
                      className="rounded-md"
                      onClick={() =>
                        setReservations((prev) =>
                          prev.map((r) =>
                            r.id === upcomingReservation.id
                              ? { ...r, status: "Cancelled" }
                              : r
                          )
                        )
                      }
                    >
                      <CalendarX2 className="mr-2 h-4 w-4" />
                      Cancel Reservation
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <span className="rounded-full bg-green-100 p-4 text-green-800">
                  <CalendarIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  No Upcoming Reservations
                </p>
                <p className="max-w-[260px] text-xs text-muted-foreground">
                  You currently have no scheduled reservations.
                </p>
                <Button className="mt-1 rounded-md bg-green-800 text-white hover:bg-green-900" onClick={scrollToReservation}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Reserve Schedule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* ================= MAIN CONTENT ================= */}
        <Card className="border-none shadow-sm bg-green-300">
          <CardContent className="p-4 lg:p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
              {/* ================= LEFT COLUMN (70%) ================= */}
              <div className="lg:col-span-7" ref={reservationRef}>
                <Card className="border shadow-sm">
                  {/* Calendar Header */}
                  <CardHeader className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold text-foreground">
                        Reservation Calendar
                      </CardTitle>
                      <CardDescription>
                        Select an available date to create a reservation.
                      </CardDescription>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                        Available
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Fully Reserved
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        Selected Date
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                        Unavailable
                      </div>
                    </div>
                  </CardHeader>

                  {/* Calendar */}
                  <CardContent className="flex flex-col items-center gap-6 p-4 lg:p-6">
                    {isLoading ? (
                      <Skeleton className="h-[360px] w-full max-w-md rounded-lg" />
                    ) : (
                      <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-sm">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          disabled={[{ before: today }, ...UNAVAILABLE_DATES]}
                          modifiers={{
                            reserved: FULLY_RESERVED_DATES,
                            unavailable: UNAVAILABLE_DATES,
                          }}
                          modifiersClassNames={{
                            reserved:
                              "bg-red-100 text-red-700 rounded-md hover:bg-red-100",
                            unavailable:
                              "text-gray-400 line-through opacity-60",
                            selected:
                              "bg-blue-600 text-white hover:bg-blue-600 focus:bg-blue-600 rounded-md",
                          }}
                          className="mx-auto"
                        />
                      </div>
                    )}

                    {/* Reservation Summary */}
                    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                      {isLoading ? (
                        <>
                          <Skeleton className="h-28 rounded-lg" />
                          <Skeleton className="h-28 rounded-lg" />
                          <Skeleton className="h-28 rounded-lg" />
                        </>
                      ) : (
                        <>
                          {/* Card 1: Selected Date */}
                          <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="rounded-md bg-green-100 p-2 text-green-800">
                                <CalendarIcon className="h-4 w-4" />
                              </span>
                            </div>
                            <p className="mt-3 text-lg font-semibold text-foreground">
                              {selectedDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground">
                              Selected Date
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {selectedDate.toLocaleDateString("en-US", {
                                weekday: "long",
                              })}
                            </p>
                          </div>

                          {/* Card 2: Reservations */}
                          <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="rounded-md bg-green-100 p-2 text-green-800">
                                <CalendarCheck2 className="h-4 w-4" />
                              </span>
                            </div>
                            <p className="mt-3 text-lg font-semibold text-foreground">
                              {reservationsOnSelectedDate.length}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground">
                              Reservations
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Total booked for this date
                            </p>
                          </div>

                          {/* Card 3: Remaining Slots */}
                          <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="rounded-md bg-green-100 p-2 text-green-800">
                                <CalendarClock className="h-4 w-4" />
                              </span>
                            </div>
                            <p className="mt-3 text-lg font-semibold text-foreground">
                              {remainingSlots}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground">
                              Remaining Slots
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Out of {MAX_SLOTS_PER_DAY} daily slots
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ================= RIGHT COLUMN (30%) ================= */}
              <div className="lg:col-span-3">
                <Card className="flex h-fit flex-col border shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Reservations on Selected Date
                    </CardTitle>
                    <CardDescription>
                      People who already reserved this schedule.
                    </CardDescription>  

                    {/* Filters */}
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search name or purpose"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="rounded-md pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 p-0">
                    <ScrollArea className="h-[560px] px-4 py-4">
                      {isLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-24 w-full rounded-lg" />
                          <Skeleton className="h-24 w-full rounded-lg" />
                          <Skeleton className="h-24 w-full rounded-lg" />
                        </div>
                      ) : filteredReservations.length === 0 ? (
                        /* ================= EMPTY STATE ================= */
                        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
                          <span className="rounded-full bg-green-100 p-4 text-green-800">
                            <CalendarIcon className="h-6 w-6" />
                          </span>
                          <p className="text-sm font-semibold text-foreground">
                            No Reservations
                          </p>
                          <p className="max-w-[220px] text-xs text-muted-foreground">
                            No one has reserved this date yet.
                          </p>
                          <Button className="mt-2 rounded-md bg-green-800 text-white hover:bg-green-900">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Reservation
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredReservations.map((reservation) => (
                            <div
                              key={reservation.id}
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setSheetOpen(true);
                              }}
                              className="cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-green-700/40 hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-9 w-9 border">
                                    <AvatarFallback className="bg-green-100 text-xs font-semibold text-green-800">
                                      {reservation.avatarInitials}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div>
                                    <p className="text-sm font-semibold leading-tight text-foreground">
                                      {reservation.employeeName}
                                    </p>
                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Building2 className="h-3 w-3" />
                                      {reservation.department}
                                    </p>
                                  </div>
                                </div>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-7 w-7"
                                          >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedReservation(reservation);
                                              setSheetOpen(true);
                                            }}
                                          >
                                            View Details
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TooltipTrigger>
                                    <TooltipContent>More options</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>

                              <Separator className="my-2" />

                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {reservation.time}
                              </div>

                              <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                                <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                                <span className="line-clamp-1">
                                  {reservation.purpose}
                                </span>
                              </div>

                              <div className="mt-2 flex justify-end">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-medium ${
                                    STATUS_BADGE_STYLES[reservation.status]
                                  }`}
                                >
                                  {reservation.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= SIDEBAR DETAILS PANEL ================= */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="font-bold text-white">
              Reservation Detail
            </SheetTitle>
            <SheetDescription className="text-white/90">
              Review and manage this reservation.
            </SheetDescription>
          </SheetHeader>

          {selectedReservation && (
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border">
                  <AvatarFallback className="bg-green-100 text-sm font-semibold text-green-800">
                    {selectedReservation.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedReservation.employeeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedReservation.department}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Reservation Date
                </label>
                <p className="text-sm font-medium text-foreground">
                  {selectedReservation.date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Reservation Time
                </label>
                <p className="text-sm font-medium text-foreground">
                  {selectedReservation.time}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Purpose</label>
                <p className="text-sm font-medium text-foreground">
                  {selectedReservation.purpose}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Badge
                  variant="outline"
                  className={`w-fit text-xs font-medium ${
                    STATUS_BADGE_STYLES[selectedReservation.status]
                  }`}
                >
                  {selectedReservation.status}
                </Badge>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Created Date
                </label>
                <p className="text-sm font-medium text-foreground">
                  {selectedReservation.createdDate}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Approved By
                </label>
                <p className="text-sm font-medium text-foreground">
                  {selectedReservation.approvedBy ?? "—"}
                </p>
              </div>
            </div>
          )}

          <SheetFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full rounded-sm bg-green-800 py-5 font-medium text-white hover:bg-green-900"
              onClick={() => {
                if (!selectedReservation) return;
                setReservations((prev) =>
                  prev.map((r) =>
                    r.id === selectedReservation.id
                      ? { ...r, status: "Approved" }
                      : r
                  )
                );
                setSheetOpen(false);
              }}
            >
              Approve
            </Button>

            <Button
              variant="destructive"
              className="w-full rounded-sm py-5 font-medium"
              onClick={() => {
                if (!selectedReservation) return;
                setReservations((prev) =>
                  prev.map((r) =>
                    r.id === selectedReservation.id
                      ? { ...r, status: "Rejected" }
                      : r
                  )
                );
                setSheetOpen(false);
              }}
            >
              Reject
            </Button>

            <SheetClose asChild>
              <Button variant="outline" className="w-full rounded-sm py-5 font-medium">
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}