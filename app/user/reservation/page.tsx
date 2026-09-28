"use client";

import { FieldLabel, FormSection, SelectCard } from "@/components/booking/form-parts";
import { ProofDropzone } from "@/components/booking/proof-dropzone";
import { DetailGrid, DetailHeader, DetailItem, StatusSteps } from "@/components/booking/detail-parts";

import { UserOverview } from "@/components/booking/user-overview";

import { EmptyState } from "@/components/ui/empty-state";

import { StatusBadge } from "@/components/ui/status-badge";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ellipsis, X, Trash, Download } from "lucide-react";
import { downloadReceipt } from "@/lib/receipt";
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
  Pagination,
  PaginationContent,
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { ObReservations } from "./ob-reservations";

type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role?: string;
  systemRole?: string;
};

type Equipment = {
  id: number;
  item_id: string;
  item_name: string;
  item_brand: string | null;
  item_number: string | null;
  item_type: string;
  status: "OPEN" | "BORROWED";
};

type Hall = {
  id: number;
  hall_id: string;
  hall_name: string;
  floor: string;
  status: "OPEN" | "FULL";
};

type HallReservation = {
  id: number;
  reservation_id: string;
  userId: string;
  purpose: string;
  attendees_qty: number;
  hall_type: string;
  date_appointment: string;
  time_from: string;
  time_to: string;
  other_request: string | null;
  status:
    | "PENDING"
    | "APPROVED"
    | "DECLINED"
    | "CANCELLED"
    | "FOR_APPROVAL"
    | "FOR_REVIEW"
    | "DONE";
  notifyUser: boolean;
  readByUser: boolean;
  createdAt: string;
  updatedAt?: string;
  equipment: Equipment[];
  hall: Hall[];
  hall_user: {
    name: string;
  } | null;
};

export default function ReservationPage() {
  const { data: session, status } = useSession();
  const user = session?.user as SessionUser | undefined;

  const [openReservation, setOpenReservation] = useState(false);
  const [openReservationEditForm, setOpenReservationEditForm] = useState(false);
  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const queryClient = useQueryClient();

  const [editReservationForm, setEditReservationForm] = useState({
    purpose: "",
    attendees_qty: "",
    hall_type: "",
    equipment: [] as string[],
    hall: [] as string[],
    time_from: "",
    time_to: "",
    other_request: "",
  });
  const [selectedReservation, setSelectedReservation] =
    useState<HallReservation | null>(null);

  // cancel reservation — reason + proof
  const [cancelReason, setCancelReason] = useState("");
  const [cancelProofFile, setCancelProofFile] = useState<File | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [reservationStatus, setReservationStatus] = useState("all");
  // Which list is showing - a tab, like the dashboard calendar. Hall first.
  const [type, setType] = useState<"Hall" | "OB">("Hall");

  const { data: reservationData, isLoading: reservationLoading } = useQuery({
    queryKey: ["hallReservation", page, search],
    queryFn: async () => {
      const res = await fetch(
        `/api/reservations/hall_reservations/reservation`,
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  // Every hall booking by ANY user (times and halls only), for the edit
  // form's availability. reservationData holds only this user's bookings,
  // so it cannot tell whether someone else has a hall.
  const { data: hallOccupancyData } = useQuery({
    queryKey: ["hallReservation", "occupancy"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/hall_reservations/occupancy");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: hallTypeData } = useQuery({
    queryKey: ["hallType"],
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
        limit: "100",
      });

      const res = await fetch(`/api/equipments/items/item?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });


  // 08:30-18:30 business window, in minutes past midnight.
  const EDIT_BUSINESS_START = 8 * 60 + 30;
  const EDIT_BUSINESS_END = 18 * 60 + 30;

  // Halls and items the reservation being edited already holds. These stay
  // selectable even though they read as taken - they are taken BY this
  // reservation, and hiding them would silently drop them on save.
  const ownHallIds: string[] =
    selectedReservation?.hall?.map((h) => h.hall_id) ?? [];
  const ownItemIds: string[] =
    selectedReservation?.equipment?.map((i) => i.item_id) ?? [];

  // Items held by someone else - BORROWED and not part of this reservation.
  const unavailableItemIds = useMemo(() => {
    const allItems = itemData?.data ?? [];
    return new Set<string>(
      allItems
        .filter(
          (i: any) => i.status === "BORROWED" && !ownItemIds.includes(i.item_id),
        )
        .map((i: any) => i.item_id),
    );
  }, [itemData, selectedReservation]);

  // Halls that cannot be picked for this reservation's date: marked FULL, or
  // already booked solid 08:30-18:30 by OTHER active reservations. This
  // reservation's own booking is excluded from the calculation, otherwise a
  // hall would look full because of the very booking being edited.
  const unavailableHallIds = useMemo(() => {
    const allHalls = hallData?.data ?? [];
    const allReservations = hallOccupancyData?.data ?? [];
    const unavailable = new Set<string>();

    allHalls.forEach((h: any) => {
      if (h.status === "FULL" && !ownHallIds.includes(h.hall_id)) {
        unavailable.add(h.hall_id);
      }
    });

    if (!selectedReservation) return unavailable;

    const dateStr = format(
      new Date(selectedReservation.date_appointment),
      "yyyy-MM-dd",
    );

    const rangesByHall: Record<string, { start: number; end: number }[]> = {};

    allReservations.forEach((res: any) => {
      if (res.status === "CANCELLED" || res.status === "DECLINED") return;
      // Skip the reservation being edited - it must not block itself.
      if (res.reservation_id === selectedReservation.reservation_id) return;

      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      if (resDateStr !== dateStr) return;

      const start = timeToMinutes(
        new Date(res.time_from).toTimeString().slice(0, 5),
      );
      const end = timeToMinutes(
        new Date(res.time_to).toTimeString().slice(0, 5),
      );

      (res.hall ?? []).forEach((h: { hall_id: string }) => {
        if (!rangesByHall[h.hall_id]) rangesByHall[h.hall_id] = [];
        rangesByHall[h.hall_id].push({ start, end });
      });
    });

    Object.entries(rangesByHall).forEach(([hallId, ranges]) => {
      if (ownHallIds.includes(hallId)) return;

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

      const bookedAllDay = merged.some(
        (r) => r.start <= EDIT_BUSINESS_START && r.end >= EDIT_BUSINESS_END,
      );

      if (bookedAllDay) unavailable.add(hallId);
    });

    return unavailable;
  }, [hallData, hallOccupancyData, selectedReservation]);

  function toggleEditEquipment(id: string) {
    setEditReservationForm((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(id)
        ? prev.equipment.filter((item) => item !== id)
        : [...prev.equipment, id],
    }));
  }

  function toggleEditHall(id: string) {
    setEditReservationForm((prev) => ({
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

  // a reservation can only be cancelled if it hasn't already passed its
  // date_appointment + time_to, and isn't already CANCELLED/DECLINED
  function isReservationCancellable(reservation: HallReservation) {
    // Only a live booking can be cancelled - not one already finished, ended,
    // or with a cancellation request waiting for review.
    if (reservation.status !== "PENDING" && reservation.status !== "APPROVED")
      return false;

    const appointmentEnd = new Date(reservation.date_appointment);
    const timeTo = new Date(reservation.time_to);
    appointmentEnd.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);

    return new Date() < appointmentEnd;
  }

  function isReservationEditable(reservation: HallReservation) {
    if (reservation.status === "CANCELLED" || reservation.status === "DECLINED")
      return false;

    const appointmentEnd = new Date(reservation.date_appointment);
    const timeTo = new Date(reservation.time_to);
    appointmentEnd.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);

    return new Date() < appointmentEnd;
  }

  function hasEditReservationConflict() {
    if (!selectedReservation) return false;

    const existingReservations = hallOccupancyData?.data ?? [];
    const selectedDateStr = format(
      new Date(selectedReservation.date_appointment),
      "yyyy-MM-dd",
    );

    const newStart = timeToMinutes(editReservationForm.time_from);
    const newEnd = timeToMinutes(editReservationForm.time_to);

    return existingReservations.some((res: HallReservation) => {
      // skip the reservation being edited — it shouldn't conflict with itself
      if (res.reservation_id === selectedReservation.reservation_id)
        return false;

      // cancelled/declined reservations don't block the slot
      if (res.status === "CANCELLED" || res.status === "DECLINED") return false;

      const resDateStr = format(new Date(res.date_appointment), "yyyy-MM-dd");
      if (resDateStr !== selectedDateStr) return false;

      const resHallIds = res.hall?.map((h) => h.hall_id) ?? [];
      const hasSameHall = editReservationForm.hall.some((hallId) =>
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

  const handleUpdateReservation = async () => {
    if (!selectedReservation) {
      toast.error("No Reservation ID found");
      return;
    }

    if (!user?.userId) {
      toast.error("Can't find user");
      return;
    }

    if (!editReservationForm.purpose.trim()) {
      toast.error("Please enter a purpose");
      return;
    }

    if (!editReservationForm.hall_type.trim()) {
      toast.error("Please select hall type");
      return;
    }

    if (editReservationForm.hall.length === 0) {
      toast.error("Please select at least one hall");
      return;
    }

    if (!editReservationForm.attendees_qty.trim()) {
      toast.error("Please enter quantity of attendees");
      return;
    }

    if (!editReservationForm.time_from.trim()) {
      toast.error("Please enter a start time");
      return;
    }

    if (
      editReservationForm.time_from < "08:30" ||
      editReservationForm.time_from > "18:30"
    ) {
      toast.error("The time must be from 8:30AM to 6:30PM");
      return;
    }

    if (!editReservationForm.time_to.trim()) {
      toast.error("Please enter an end time");
      return;
    }

    if (
      editReservationForm.time_to < "08:30" ||
      editReservationForm.time_to > "18:30"
    ) {
      toast.error("The time must be from 8:30AM to 6:30PM");
      return;
    }

    if (hasEditReservationConflict()) {
      toast.error("Selected hall is already reserved for this date and time");
      return;
    }

    const loadingToast = toast.loading("Updating reservation...");

    try {
      const res = await fetch(
        `/api/reservations/hall_reservations/${selectedReservation.reservation_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editReservationForm,
            changes: "Has Edit Hall Reservation Details",
          }),
        },
      );

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        // Show the server's reason (e.g. an item was claimed mid-edit) so the
        // user knows what to change instead of a blank failure.
        toast.error(data?.error ?? "Failed to update reservation");
        queryClient.invalidateQueries({ queryKey: ["item"], exact: false });
        console.log("Error:", data);
        return;
      }

      toast.success("Reservation has been updated");

      setOpenReservationEditForm(false);
      setSelectedReservation(null);

      queryClient.invalidateQueries({
        queryKey: ["hallReservation"],
        exact: false,
      });

      // Equipment may have been released or claimed by this edit.
      queryClient.invalidateQueries({ queryKey: ["item"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  // True once the booked time has passed - only then can the user mark the
  // reservation as done.
  function isReservationFinished(reservation: HallReservation) {
    const appointmentEnd = new Date(reservation.date_appointment);
    const timeTo = new Date(reservation.time_to);
    appointmentEnd.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);

    return new Date() >= appointmentEnd;
  }

  const handleMarkAsDone = async (reservation: HallReservation) => {
    if (!user?.userId) {
      toast.error("Can't find user");
      return;
    }

    if (!isReservationFinished(reservation)) {
      toast.error("This reservation is not finished yet");
      return;
    }

    const loadingToast = toast.loading("Marking reservation as done...");
    setMarkingDone(true);

    try {
      const res = await fetch(`/api/action/${reservation.reservation_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DONE",
          changes: "Has Marked Reservation as Done",
        }),
      });

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setMarkingDone(false);

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to mark reservation as done");
        console.log("Error:", data);
        return;
      }

      toast.success("Reservation has been marked as done");

      setOpenReservation(false);
      setSelectedReservation(null);

      queryClient.invalidateQueries({
        queryKey: ["hallReservation"],
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: ["item"], exact: false });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);
      setMarkingDone(false);

      toast.error("Something went wrong");
      console.log("error", err);
    }
  };

  const handleDeleteReservation = async () => {
    if (!selectedReservation) {
      toast.error("No Reservation ID found");
      return;
    }

    if (!user?.userId) {
      toast.error("Can't find user");
      return;
    }

    const loadingToast = toast.loading("Deleting reservation...");

    setDeleting(true);

    try {
      const res = await fetch(
        `/api/reservations/hall_reservations/${selectedReservation.reservation_id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deletedBy: user?.userId,
            changes: "Has Delete Hall Reservation Details",
          }),
        },
      );

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error("Failed to delete reservation");
        console.log("Error:", data);
        return;
      }

      toast.success(`Reservation has been deleted`);

      setOpenReservationDialog(false);
      setSelectedReservation(null);
      setDeleting(false);

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

  const handleCancelReservation = async () => {
    if (!selectedReservation) {
      toast.error("No Reservation ID found");
      return;
    }

    if (!user?.userId) {
      toast.error("Can't find user");
      return;
    }

    if (!isReservationCancellable(selectedReservation)) {
      toast.error("This reservation can no longer be cancelled");
      setOpenCancelDialog(false);
      return;
    }

    if (!cancelReason.trim()) {
      toast.error("Please enter a reason for cancellation");
      return;
    }

    if (!cancelProofFile) {
      toast.error("Please attach a proof file");
      return;
    }

    const loadingToast = toast.loading("Cancelling reservation...");

    setCancelling(true);

    try {
      const formData = new FormData();
      formData.append("reservation_id", selectedReservation.reservation_id);
      formData.append("reason", cancelReason.trim());
      formData.append("proof", cancelProofFile);

      const res = await fetch(`/api/reservations/hall_reservations/cancel`, {
        method: "POST",
        body: formData, // no Content-Type header — browser sets the multipart boundary
      });

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setCancelling(false);

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to cancel reservation");
        console.log("Error:", data);
        return;
      }

      toast.success("Reservation has been cancelled");

      setOpenCancelDialog(false);
      setSelectedReservation(null);
      setCancelReason("");
      setCancelProofFile(null);

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

  const { data: cancellationData, isLoading: cancellationLoading } = useQuery({
    queryKey: [
      "hallReservationCancellation",
      selectedReservation?.reservation_id,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/reservations/hall_reservations/cancel?reservation_id=${selectedReservation?.reservation_id}`,
      );
      const json = await res.json();

      // no cancellation on this reservation yet — not an error, just nothing to show
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(json?.error);

      return json;
    },
    enabled: openReservation && !!selectedReservation,
  });

  function getAvailableActions(reservationStatus: HallReservation["status"]) {
    if (reservationStatus === "PENDING") {
      return {
        view: true,
        edit: true,
        cancel: true,
        done: false,
        delete: true,
      };
    }

    // Only an approved booking can be closed out as done - there is nothing to
    // finish about one that was never approved.
    if (reservationStatus === "APPROVED") {
      return {
        view: true,
        edit: false,
        cancel: true,
        done: true,
        delete: true,
      };
    }

    // if (reservationStatus === "FOR_REVIEW") {
    //   return {
    //     view: true,
    //     edit: false,
    //     cancel: false,
    //     delete: true,
    //   };
    // }

    // if (reservationStatus === "FOR_APPROVAL") {
    //   return {
    //     view: true,
    //     edit: false,
    //     cancel: false,
    //     delete: true,
    //   };
    // }

    // FOR_REVIEW (cancellation already requested), DECLINED, CANCELLED,
    // DONE - nothing left to do but view or delete.
    return {
      view: true,
      edit: false,
      cancel: false,
      done: false,
      delete: true,
    };
  }

  const allReservations: HallReservation[] = reservationData?.data ?? [];

  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allReservations.filter((reservation) => {
      const matchesSearch =
        !query ||
        reservation.reservation_id.toLowerCase().includes(query) ||
        reservation.purpose.toLowerCase().includes(query) ||
        reservation.hall.some((h) => h.hall_name.toLowerCase().includes(query));

      const matchesStatus =
        reservationStatus === "all" || reservation.status === reservationStatus;

      return matchesSearch && matchesStatus;
    });
  }, [allReservations, search, reservationStatus]);

  const totalItems = filteredReservations.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const currentPage = Math.min(page, totalPages);
  const reservations = filteredReservations.slice(
    (currentPage - 1) * limit,
    currentPage * limit,
  );

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Reservations</h1>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage Your Reservation
          </p>
        </div>
      </div>

      <UserOverview />

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="inline-flex h-8 w-fit shrink-0 items-center rounded-md border p-0.5">
          {(["Hall", "OB"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setType(tab);
                setPage(1);
              }}
              className={
                type === tab
                  ? "h-full rounded px-4 text-sm font-medium bg-brand text-white"
                  : "h-full rounded px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search reservation"
            className="pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={reservationStatus}
          onValueChange={(value) => {
            setReservationStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder={"Status"} />
          </SelectTrigger>

          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="DECLINED">Declined</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="FOR_APPROVAL">For Approval</SelectItem>
              <SelectItem value="FOR_REVIEW">For Review</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Hall tab */}
      {type === "Hall" && (
        <div className="flex flex-col gap-3">
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            {reservationLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading reservations</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : reservations.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <EmptyState title="No reservation found" description="Try a different search or status filter." />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="text-right">Attendees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {reservations.map((reservation) => {
                    const actions = getAvailableActions(reservation.status);

                    return (
                      <TableRow
                        key={reservation.reservation_id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          // Row click opens the detail; clicks on the
                          // action menu are left to the menu.
                          // Ignore clicks from the action menu: it renders in a portal (outside
                          // the row in the DOM) but React still bubbles its clicks here -
                          // including clicks on disabled items.
                          if (!e.currentTarget.contains(e.target as Node)) return;
                          if ((e.target as HTMLElement).closest("button")) return;
                          setSelectedReservation(reservation);
                          setOpenReservation(true);
                        }}
                      >
                        <TableCell className="max-w-[260px]">
                          <p className="truncate font-medium">{reservation.purpose}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {reservation.reservation_id}
                          </p>
                        </TableCell>

                        <TableCell className="max-w-[220px]">
                          <p className="truncate">
                            {reservation.hall.map((h) => h.hall_name).join(", ") || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {hallTypeData?.data?.find(
                              (t: { type_id: string; type: string }) =>
                                t.type_id === reservation.hall_type,
                            )?.type ?? reservation.hall_type}
                          </p>
                        </TableCell>

                        <TableCell>
                          <p className="font-medium">
                            {format(new Date(reservation.date_appointment), "EEE, MMM d, yyyy")}
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {format(new Date(reservation.time_from), "h:mm a")} –{" "}
                            {format(new Date(reservation.time_to), "h:mm a")}
                          </p>
                        </TableCell>

                        <TableCell className="text-right tabular-nums">
                          {reservation.attendees_qty}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={reservation.status} />
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost">
                                <Ellipsis />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent>
                              <DropdownMenuGroup>
                                {actions.view && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      setOpenReservation(true);
                                    }}
                                  >
                                    View
                                  </DropdownMenuItem>
                                )}

                                {actions.edit && (
                                  <DropdownMenuItem
                                    disabled={
                                      !isReservationEditable(reservation)
                                    }
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      setEditReservationForm({
                                        purpose: reservation.purpose,
                                        attendees_qty: String(
                                          reservation.attendees_qty,
                                        ),
                                        hall_type: reservation.hall_type,
                                        equipment: reservation.equipment.map(
                                          (e) => e.item_id,
                                        ),
                                        hall: reservation.hall.map(
                                          (h) => h.hall_id,
                                        ),
                                        time_from: new Date(
                                          reservation.time_from,
                                        )
                                          .toTimeString()
                                          .slice(0, 5),
                                        time_to: new Date(reservation.time_to)
                                          .toTimeString()
                                          .slice(0, 5),
                                        other_request:
                                          reservation.other_request ?? "",
                                      });
                                      setOpenReservationEditForm(true);
                                    }}
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                )}

                                {actions.cancel && (
                                  <DropdownMenuItem
                                    disabled={
                                      !isReservationCancellable(reservation)
                                    }
                                    onClick={() => {
                                      if (
                                        !isReservationCancellable(reservation)
                                      ) {
                                        toast.error(
                                          "This reservation can no longer be cancelled",
                                        );
                                        return;
                                      }
                                      setSelectedReservation(reservation);
                                      setCancelReason("");
                                      setCancelProofFile(null);
                                      setOpenCancelDialog(true);
                                    }}
                                  >
                                    Cancel
                                  </DropdownMenuItem>
                                )}

                                {actions.done && (
                                  <DropdownMenuItem
                                    disabled={
                                      !isReservationFinished(reservation)
                                    }
                                    onClick={() => handleMarkAsDone(reservation)}
                                  >
                                    Done
                                  </DropdownMenuItem>
                                )}

                                {actions.delete && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      setOpenReservationDialog(true);
                                    }}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
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

        <Pagination className="mt-4 justify-center lg:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>

            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  isActive={currentPage === i + 1}
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
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
        </div>
      )}

      {/* OB tab */}
      {type === "OB" && (
        <ObReservations
          search={search}
          statusFilter={reservationStatus}
          showHeading={false}
        />
      )}

      {openReservation && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="relative w-full max-w-2xl max-h-[88vh] gap-0 overflow-y-auto py-0">
            <DetailHeader
              kind="Hall reservation"
              reference={selectedReservation.reservation_id}
              title={selectedReservation.purpose}
              status={selectedReservation.status}
              onClose={() => setOpenReservation(false)}
            />

            <div className="flex flex-col gap-5 p-5">
              <div className="rounded-md border border-border bg-neutral-50 px-4 py-3">
                <StatusSteps status={selectedReservation.status} />
              </div>

              <DetailGrid>
                <DetailItem
                  label="Date"
                  value={format(new Date(selectedReservation.date_appointment), "EEEE, MMM d, yyyy")}
                />
                <DetailItem
                  label="Time"
                  value={`${format(new Date(selectedReservation.time_from), "h:mm a")} – ${format(new Date(selectedReservation.time_to), "h:mm a")}`}
                />
                <DetailItem
                  label="Hall"
                  value={selectedReservation.hall?.map((h) => h.hall_name).join(", ")}
                />
                <DetailItem
                  label="Hall type"
                  value={
                    hallTypeData?.data?.find(
                      (t: { type_id: string; type: string }) => t.type_id === selectedReservation.hall_type,
                    )?.type ?? selectedReservation.hall_type
                  }
                />
                <DetailItem label="Attendees" value={String(selectedReservation.attendees_qty)} />
                <DetailItem label="Reserved by" value={selectedReservation.hall_user?.name} />
                <DetailItem
                  wide
                  label="Equipment"
                  value={
                    selectedReservation.equipment?.length
                      ? selectedReservation.equipment.map((e) => e.item_name).join(", ")
                      : "None"
                  }
                />
                <DetailItem wide label="Other request" value={selectedReservation.other_request || "None"} />
              </DetailGrid>

              {cancellationLoading ? (
                <p className="text-sm text-muted-foreground">Loading cancellation info...</p>
              ) : cancellationData?.cancellation ? (
                <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Cancellation request</p>
                  <p className="mt-1.5">{cancellationData.cancellation.reason}</p>
                  <a
                    href={`/api/uploads/cancellations/${cancellationData.cancellation.path.split("/").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-brand underline"
                  >
                    View proof: {cancellationData.cancellation.file_name}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t border-border p-5">
              {(() => {
                // Only a PENDING reservation can still be edited - once it is
                // approved the details are settled, and the table's dropdown
                // already hides Edit for every other status.
                const statusActions = getAvailableActions(
                  selectedReservation.status,
                );
                const canEdit = statusActions.edit;

                const doneButton = statusActions.done ? (
                  <Button
                    className="w-full h-10"
                    disabled={
                      markingDone || !isReservationFinished(selectedReservation)
                    }
                    onClick={() => handleMarkAsDone(selectedReservation)}
                  >
                    {markingDone
                      ? "Marking as done..."
                      : isReservationFinished(selectedReservation)
                        ? "Mark as Done"
                        : "Mark as Done (not yet finished)"}
                  </Button>
                ) : null;

                const cancelButton = (
                  <Button
                    className="w-full lg:flex-1 h-10 border border-border bg-white text-foreground hover:bg-neutral-50"
                    disabled={!isReservationCancellable(selectedReservation)}
                    onClick={() => {
                      if (!isReservationCancellable(selectedReservation)) {
                        toast.error(
                          "This reservation can no longer be cancelled",
                        );
                        return;
                      }
                      setOpenReservation(false);
                      setCancelReason("");
                      setCancelProofFile(null);
                      setOpenCancelDialog(true);
                    }}
                  >
                    Cancel Reservation
                  </Button>
                );

                const deleteButton = (
                  <Button
                    className="w-full lg:w-10 h-10 border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setSelectedReservation(selectedReservation);
                      setOpenReservationDialog(true);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                    <p className="block lg:hidden">Delete</p>
                  </Button>
                );

                // A finished reservation has nothing left to do: only its
                // receipt and Delete remain.
                if (selectedReservation.status === "DONE") {
                  const r = selectedReservation;
                  return (
                    <div className="flex flex-col lg:flex-row gap-2">
                      <Button
                        className="w-full lg:flex-1 h-10"
                        onClick={() =>
                          downloadReceipt({
                            kind: "Hall Reservation",
                            id: r.reservation_id,
                            requester: {
                              name: r.hall_user?.name ?? user?.name,
                              email: user?.email,
                            },
                            details: [
                              ["Purpose", r.purpose],
                              ["Hall Type", r.hall_type],
                              ["Hall", r.hall.map((h) => h.hall_name).join(", ")],
                              ["Date", format(new Date(r.date_appointment), "MMM d, yyyy")],
                              [
                                "Time",
                                `${format(new Date(r.time_from), "h:mm a")} - ${format(new Date(r.time_to), "h:mm a")}`,
                              ],
                              ["Attendees", String(r.attendees_qty)],
                              [
                                "Equipment",
                                r.equipment.map((e) => e.item_name).join(", ") || "None",
                              ],
                              ["Other Request", r.other_request || "None"],
                            ],
                            filedAt: r.createdAt,
                            completedAt: r.updatedAt,
                          }).catch(() => toast.error("Failed to generate receipt"))
                        }
                      >
                        <Download className="h-4 w-4" />
                        Download Receipt
                      </Button>
                      {deleteButton}
                    </div>
                  );
                }

                // Delete always sits small on the right. The wide button beside
                // it is Edit while that is still possible, and Cancel once it
                // is not - so the row never collapses to a lone small button.
                return canEdit ? (
                  <>
                    {doneButton}
                    <div className="flex flex-col lg:flex-row gap-2">
                      <Button
                        className="w-full lg:flex-1 h-10"
                        disabled={!isReservationEditable(selectedReservation)}
                        onClick={() => {
                          setOpenReservation(false);
                          setEditReservationForm({
                            purpose: selectedReservation.purpose,
                            attendees_qty: String(
                              selectedReservation.attendees_qty,
                            ),
                            hall_type: selectedReservation.hall_type,
                            equipment: selectedReservation.equipment.map(
                              (e) => e.item_id,
                            ),
                            hall: selectedReservation.hall.map(
                              (h) => h.hall_id,
                            ),
                            time_from: new Date(selectedReservation.time_from)
                              .toTimeString()
                              .slice(0, 5),
                            time_to: new Date(selectedReservation.time_to)
                              .toTimeString()
                              .slice(0, 5),
                            other_request:
                              selectedReservation.other_request ?? "",
                          });
                          setOpenReservationEditForm(true);
                        }}
                      >
                        Edit Reservation
                      </Button>

                      {deleteButton}
                    </div>

                    {cancelButton}
                  </>
                ) : (
                  <>
                    {doneButton}
                    <div className="flex flex-col lg:flex-row gap-2">
                      {cancelButton}
                      {deleteButton}
                    </div>
                  </>
                );
              })()}
            </div>
          </Card>
        </div>
      )}

      {/* Edit — kept as Sheet */}
      <Sheet
        open={openReservationEditForm}
        onOpenChange={setOpenReservationEditForm}
      >
        <SheetContent side="right" className="overflow-y-scroll data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="bg-brand">
            <SheetTitle className="text-white font-bold">
              Edit Reservation
            </SheetTitle>
            <SheetDescription className="text-white">
              Update reservation details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4">
            <p className="font-mono text-xs text-muted-foreground">{selectedReservation?.reservation_id}</p>

            <FormSection step={1} title="Details">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="edit-purpose">Purpose</FieldLabel>
                <Input
                  id="edit-purpose"
                  type="text"
                  value={editReservationForm.purpose}
                  onChange={(e) => setEditReservationForm({ ...editReservationForm, purpose: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="edit-attendees">Number of attendees</FieldLabel>
                <Input
                  id="edit-attendees"
                  type="number"
                  min={1}
                  value={editReservationForm.attendees_qty}
                  onChange={(e) => setEditReservationForm({ ...editReservationForm, attendees_qty: e.target.value })}
                />
              </div>
            </FormSection>

            <FormSection
              step={2}
              title="Venue"
              hint={editReservationForm.hall.length ? `${editReservationForm.hall.length} selected` : undefined}
            >
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Hall type</FieldLabel>
                <Select
                  value={editReservationForm.hall_type}
                  onValueChange={(value) =>
                    setEditReservationForm({
                      ...editReservationForm,
                      hall_type: value,
                    })
                  }
                >
                  <SelectTrigger className="w-full rounded-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <SelectValue placeholder="Select hall type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Type</SelectLabel>
                      {hallTypeData?.data?.map(
                        (t: { type_id: string; type: string }) => (
                          <SelectItem key={t.type_id} value={t.type_id}>
                            {t.type}
                          </SelectItem>
                        ),
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hallLoading ? (
                  <p className="col-span-full text-sm text-muted-foreground">Loading halls...</p>
                ) : (
                  hallData?.data?.map((item: { hall_id: string; hall_name: string; floor?: string }) => {
                    const taken = unavailableHallIds.has(item.hall_id);
                    const selected = editReservationForm.hall.includes(item.hall_id);
                    return (
                      <SelectCard
                        key={item.hall_id}
                        selected={selected}
                        disabled={taken && !selected}
                        onToggle={() => toggleEditHall(item.hall_id)}
                        title={item.hall_name}
                        subtitle={item.floor ? `Floor ${item.floor}` : undefined}
                        badge={taken ? "Taken" : undefined}
                      />
                    );
                  })
                )}
              </div>
            </FormSection>

            <FormSection
              step={3}
              title="Schedule"
              hint={selectedReservation ? format(new Date(selectedReservation.date_appointment), "EEE, MMM d") : undefined}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="edit-from">From</FieldLabel>
                <Input
                  id="edit-from"
                  type="time"
                  value={editReservationForm.time_from}
                  onChange={(e) => setEditReservationForm({ ...editReservationForm, time_from: e.target.value })}
                />
                </div>
                <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="edit-to">To</FieldLabel>
                <Input
                  id="edit-to"
                  type="time"
                  value={editReservationForm.time_to}
                  onChange={(e) => setEditReservationForm({ ...editReservationForm, time_to: e.target.value })}
                />
                </div>
              </div>
            </FormSection>

            <FormSection
              step={4}
              title="Extras"
              hint={editReservationForm.equipment.length ? `${editReservationForm.equipment.length} item(s)` : "Optional"}
            >
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {itemLoading ? (
                  <p className="col-span-full text-sm text-muted-foreground">Loading equipment...</p>
                ) : (
                  itemData?.data?.map((item: { item_id: string; item_name: string; item_brand?: string | null }) => {
                    const taken = unavailableItemIds.has(item.item_id);
                    const selected = editReservationForm.equipment.includes(item.item_id);
                    return (
                      <SelectCard
                        key={item.item_id}
                        selected={selected}
                        disabled={taken && !selected}
                        onToggle={() => toggleEditEquipment(item.item_id)}
                        title={item.item_name}
                        subtitle={item.item_brand ?? undefined}
                        badge={taken ? "Borrowed" : undefined}
                      />
                    );
                  })
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="edit-other">Other request</FieldLabel>
                <Textarea
                  id="edit-other"
                  className="resize-none"
                  value={editReservationForm.other_request}
                  onChange={(e) =>
                    setEditReservationForm({ ...editReservationForm, other_request: e.target.value })
                  }
                />
              </div>
            </FormSection>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateReservation}
              className="w-full h-10"
            >
              Update Reservation
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

      <AlertDialog
        open={openReservationDialog}
        onOpenChange={setOpenReservationDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              Delete this reservation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete this
              record and remove it from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReservation}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel — now a Dialog with reason + proof upload */}
      <Dialog
        open={openCancelDialog}
        onOpenChange={(open) => {
          setOpenCancelDialog(open);
          if (!open) {
            setCancelReason("");
            setCancelProofFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">
              Cancel this reservation?
            </DialogTitle>
            <DialogDescription>
              {selectedReservation
                ? `${selectedReservation.purpose} · ${format(new Date(selectedReservation.date_appointment), "EEE, MMM d, yyyy")}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Your request goes to the admin for review. The booking stays active
            until it is approved.
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this reservation is being cancelled"
                className="min-h-24 resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Proof</FieldLabel>
              <ProofDropzone file={cancelProofFile} onChange={setCancelProofFile} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpenCancelDialog(false)}
              disabled={cancelling}
            >
              Back
            </Button>
            <Button
              onClick={handleCancelReservation}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling ? "Sending..." : "Request cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
