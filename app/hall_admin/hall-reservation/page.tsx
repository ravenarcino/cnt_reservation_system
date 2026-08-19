"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ellipsis, X, Trash } from "lucide-react";
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
    | "FOR_REVIEW";
  notifyUser: boolean;
  readByUser: boolean;
  createdAt: string;
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
  const [openActionDialog, setOpenActionDialog] = useState(false);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [action, setAction] = useState("");
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
  const [type, setType] = useState("all");

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
      const params = new URLSearchParams({ page: String(page) });

      const res = await fetch(`/api/halls/rooms/room?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const { data: itemData, isLoading: itemLoading } = useQuery({
    queryKey: ["item", page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });

      const res = await fetch(`/api/equipments/items/item?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

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
    if (reservation.status === "CANCELLED" || reservation.status === "DECLINED")
      return false;

    const appointmentEnd = new Date(reservation.date_appointment);
    const timeTo = new Date(reservation.time_to);
    appointmentEnd.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);

    return new Date() < appointmentEnd;
  }

  function isReservationActionable(reservation: HallReservation) {
    if (reservation.status === "CANCELLED" || reservation.status === "DECLINED")
      return false;

    const appointmentEnd = new Date(reservation.date_appointment);
    const timeTo = new Date(reservation.time_to);
    appointmentEnd.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);

    return new Date() < appointmentEnd;
  }

  function hasEditReservationConflict() {
    if (!selectedReservation) return false;

    const existingReservations = reservationData?.data ?? [];
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
        toast.error("Failed to update reservation");
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
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1500));
      toast.dismiss(loadingToast);

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

  const handleUpdateReservationStatus = async () => {
    if (!selectedReservation) {
      toast.error("No Reservation ID found");
      return;
    }

    if (!user?.userId) {
      toast.error("Can't find user");
      return;
    }

    let adminAction: string;

    if (!action) {
      toast.error("No action selected");
      return;
    }

    if (action === "Approve") {
      adminAction = "APPROVED";
    } else if (action === "Decline") {
      adminAction = "DECLINED";
    } else if (action === "Cancel") {
      adminAction = "CANCELLED";
    } else {
      toast.error("Unknown action");
      return;
    }

    const loadingToast = toast.loading("Updating reservation status...");
    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/action/${selectedReservation.reservation_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: adminAction,
            changes: `Has ${adminAction.charAt(0).toUpperCase() + adminAction.slice(1).toLowerCase()} Reservation`,
          }),
        },
      );

      const data = await res.json();

      await new Promise((r) => setTimeout(r, 1500));

      toast.dismiss(loadingToast);
      setActionLoading(false);

      if (!res.ok) {
        toast.error("Failed to update reservation status");
        console.log("Error:", data);
        return;
      }

      toast.success("Reservation status has been updated");

      // setOpenReservationEditForm(false);
      setOpenActionDialog(false);
      setAction("");
      setSelectedReservation(null);

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

  // const handleCancelReservation = async () => {
  //   if (!selectedReservation) {
  //     toast.error("No Reservation ID found");
  //     return;
  //   }

  //   if (!user?.userId) {
  //     toast.error("Can't find user");
  //     return;
  //   }

  //   if (!isReservationCancellable(selectedReservation)) {
  //     toast.error("This reservation can no longer be cancelled");
  //     setOpenCancelDialog(false);
  //     return;
  //   }

  //   if (!cancelReason.trim()) {
  //     toast.error("Please enter a reason for cancellation");
  //     return;
  //   }

  //   if (!cancelProofFile) {
  //     toast.error("Please attach a proof file");
  //     return;
  //   }

  //   const loadingToast = toast.loading("Cancelling reservation...");

  //   setCancelling(true);

  //   try {
  //     const formData = new FormData();
  //     formData.append("reservation_id", selectedReservation.reservation_id);
  //     formData.append("reason", cancelReason.trim());
  //     formData.append("proof", cancelProofFile);

  //     const res = await fetch(`/api/reservations/hall_reservations/cancel`, {
  //       method: "POST",
  //       body: formData, // no Content-Type header — browser sets the multipart boundary
  //     });

  //     const data = await res.json();

  //     await new Promise((r) => setTimeout(r, 1500));

  //     toast.dismiss(loadingToast);
  //     setCancelling(false);

  //     if (!res.ok) {
  //       toast.error(data?.error ?? "Failed to cancel reservation");
  //       console.log("Error:", data);
  //       return;
  //     }

  //     toast.success("Reservation has been cancelled");

  //     setOpenCancelDialog(false);
  //     setSelectedReservation(null);
  //     setCancelReason("");
  //     setCancelProofFile(null);

  //     queryClient.invalidateQueries({
  //       queryKey: ["hallReservation"],
  //       exact: false,
  //     });
  //   } catch (err) {
  //     await new Promise((r) => setTimeout(r, 1500));
  //     toast.dismiss(loadingToast);

  //     toast.error("Something went wrong");
  //     console.log("error", err);
  //   }
  // };

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
        approve: true,
        decline: true,
        cancel: true,
        delete: true,
      };
    }

    if (reservationStatus === "FOR_REVIEW") {
      return {
        view: true,
        edit: true,
        approve: false,
        decline: true,
        cancel: true,
        delete: true,
      };
    }

    if (reservationStatus === "FOR_APPROVAL") {
      return {
        view: true,
        edit: true,
        approve: false,
        decline: true,
        cancel: true,
        delete: true,
      };
    }

    // APPROVED, DECLINED, CANCELLED (and any other/unknown status) — view + delete only
    return {
      view: true,
      edit: false,
      approve: false,
      decline: false,
      cancel: false,
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

      const hasHall = reservation.hall.length > 0;
      const matchesType =
        type === "all" || reservation.hall.some((h) => h.hall_id === type);

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allReservations, search, reservationStatus, type]);

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
          <p className="text-lg font-semibold">Hall Reservation</p>
          <p className="text-sm text-muted-foreground text-wrap">
            Manage Employee Reservation
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
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
          value={type}
          onValueChange={(value) => {
            setType(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder={"Hall"} />
          </SelectTrigger>

          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Hall</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              {hallData?.data?.map(
                (hall: { hall_id: string; hall_name: string }) => (
                  <SelectItem key={hall.hall_id} value={hall.hall_id}>
                    {hall.hall_name}
                  </SelectItem>
                ),
              )}
            </SelectGroup>
          </SelectContent>
        </Select>

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
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            {reservationLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
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
                    colSpan={8}
                    className="text-center py-10 text-muted-foreground"
                  >
                    No reservation found
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Reservation ID</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Hall Type</TableHead>
                    <TableHead>Hall</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {reservations.map((reservation, index) => {
                    const actions = getAvailableActions(reservation.status);

                    return (
                      <TableRow key={reservation.reservation_id}>
                        <TableCell className="font-medium">
                          {index + 1 + (currentPage - 1) * limit}
                        </TableCell>

                        <TableCell className="font-medium">
                          {reservation.reservation_id}
                        </TableCell>

                        <TableCell className="max-w-[20px] truncate">
                          {reservation.purpose}
                        </TableCell>

                        <TableCell>
                          {hallTypeData?.data?.find(
                            (t: { type_id: string; type: string }) =>
                              t.type_id === reservation.hall_type,
                          )?.type ?? reservation.hall_type}
                        </TableCell>

                        <TableCell>
                          {reservation.hall.map((h) => h.hall_name).join(", ")}
                        </TableCell>

                        <TableCell>
                          {new Date(
                            reservation.date_appointment,
                          ).toLocaleDateString()}
                        </TableCell>

                        <TableCell>
                          {new Date(reservation.time_from).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}{" "}
                          –{" "}
                          {new Date(reservation.time_to).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </TableCell>

                        <TableCell>{reservation.attendees_qty}</TableCell>

                        <TableCell>
                          {reservation.status
                            .toLowerCase()
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (char) => char.toUpperCase())}
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
                                      !isReservationActionable(reservation)
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

                                {actions.approve && (
                                  <DropdownMenuItem
                                    disabled={
                                      !isReservationActionable(reservation)
                                    }
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      setOpenActionDialog(true);
                                      setAction("Approve");
                                    }}
                                  >
                                    Approve
                                  </DropdownMenuItem>
                                )}

                                {actions.decline && (
                                  <DropdownMenuItem
                                    disabled={
                                      !isReservationActionable(reservation)
                                    }
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      setOpenActionDialog(true);
                                      setAction("Decline");
                                    }}
                                  >
                                    Decline
                                  </DropdownMenuItem>
                                )}

                                {actions.cancel && (
                                  <DropdownMenuItem
                                    disabled={
                                      !isReservationCancellable(reservation)
                                    }
                                    onClick={() => {
                                      setSelectedReservation(reservation);
                                      setOpenActionDialog(true);
                                      setAction("Cancel");
                                    }}
                                  >
                                    Cancel
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

      {openReservation &&
        selectedReservation &&
        (() => {
          const actions = getAvailableActions(selectedReservation.status);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <Card className="w-fit max-w-lg max-h-[85vh] overflow-y-auto relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 rounded-full"
                  onClick={() => setOpenReservation(false)}
                >
                  <X className="h-4 w-4" />
                </Button>

                <CardHeader>
                  <CardTitle>Reservation Detail</CardTitle>
                  <CardDescription>
                    Reservation ID: {selectedReservation.reservation_id}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Reserved By
                    </label>
                    <p className="font-medium">
                      {selectedReservation.hall_user?.name ?? "—"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Purpose
                    </label>
                    <p className="font-medium">{selectedReservation.purpose}</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Hall Type
                    </label>
                    <p className="font-medium">
                      {hallTypeData?.data?.find(
                        (t: { type_id: string; type: string }) =>
                          t.type_id === selectedReservation.hall_type,
                      )?.type ?? selectedReservation.hall_type}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Hall
                    </label>
                    <p className="font-medium">
                      {selectedReservation.hall
                        ?.map((h) => h.hall_name)
                        .join(", ") ?? "—"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Equipment
                    </label>
                    <p className="font-medium">
                      {selectedReservation.equipment &&
                      selectedReservation.equipment.length > 0
                        ? selectedReservation.equipment
                            .map((e) => e.item_name)
                            .join(", ")
                        : "None"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Date
                      </label>
                      <p className="font-medium">
                        {new Date(
                          selectedReservation.date_appointment,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Attendees
                      </label>
                      <p className="font-medium">
                        {selectedReservation.attendees_qty}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Time From
                      </label>
                      <p className="font-medium">
                        {new Date(
                          selectedReservation.time_from,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Time To
                      </label>
                      <p className="font-medium">
                        {new Date(
                          selectedReservation.time_to,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Other Request
                    </label>
                    <p className="font-medium">
                      {selectedReservation.other_request || "—"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Status
                    </label>
                    <p className="font-medium">{selectedReservation.status}</p>
                  </div>

                  <div>
                    {cancellationLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading cancellation info...
                      </p>
                    ) : cancellationData?.cancellation ? (
                      <>
                        <label className="text-xs text-muted-foreground">
                          Cancellation Reason
                        </label>
                        <p className="font-medium">
                          {cancellationData.cancellation.reason}
                        </p>

                        <label className="text-xs text-muted-foreground mt-2 block">
                          Proof
                        </label>

                        <a
                          href={`/api/uploads/cancellations/${cancellationData.cancellation.path.split("/").pop()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline text-sm font-medium"
                        >
                          {cancellationData.cancellation.file_name}
                        </a>
                      </>
                    ) : null}
                  </div>
                </CardContent>

                <div className="flex flex-col gap-2 p-4 pt-0">
                  <div className="flex flex-col lg:flex-row gap-2">
                    <Button
                      className="w-90 bg-green-800 rounded-sm py-5 text-white font-medium"
                      disabled={
                        !actions.edit ||
                        !isReservationActionable(selectedReservation)
                      }
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
                          hall: selectedReservation.hall.map((h) => h.hall_id),
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

                    <Button
                      className="w-full lg:w-20 bg-red-600 rounded-sm py-5 text-white font-medium"
                      onClick={() => {
                        setSelectedReservation(selectedReservation);
                        setOpenReservationDialog(true);
                      }}
                    >
                      <Trash className="h-4 w-4 text-white" />
                      <p className="block lg:hidden">Delete</p>
                    </Button>
                  </div>

                  <div className="flex flex-col lg:flex-row justify-evenly gap-2">
                    <Button
                      className="w-full lg:w-auto bg-green-600 rounded-sm py-5 text-white font-medium"
                      disabled={
                        !actions.approve ||
                        !isReservationActionable(selectedReservation)
                      }
                      onClick={() => {
                        setOpenActionDialog(true);
                        setAction("Approve");
                      }}
                    >
                      Approve
                    </Button>

                    <Button
                      className="w-full lg:w-auto bg-red-600 rounded-sm py-5 text-white font-medium"
                      disabled={
                        !actions.decline ||
                        !isReservationActionable(selectedReservation)
                      }
                      onClick={() => {
                        setOpenActionDialog(true);
                        setAction("Decline");
                      }}
                    >
                      Decline
                    </Button>

                    <Button
                      className="w-full lg:w-auto bg-yellow-600 rounded-sm py-5 text-white font-medium"
                      disabled={
                        !actions.cancel ||
                        !isReservationActionable(selectedReservation)
                      }
                      onClick={() => {
                        setOpenActionDialog(true);
                        setAction("Cancel");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

      {/* Edit — kept as Sheet */}
      <Sheet
        open={openReservationEditForm}
        onOpenChange={setOpenReservationEditForm}
      >
        <SheetContent side="right" className="overflow-y-scroll">
          <SheetHeader className="bg-green-800">
            <SheetTitle className="text-white font-bold">
              Edit Reservation
            </SheetTitle>
            <SheetDescription className="text-white">
              Update reservation details below.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <label className="text-xs text-gray-500">
              Reservation ID: {selectedReservation?.reservation_id}
            </label>

            <div className="flex flex-col gap-1">
              <label>Purpose</label>
              <Input
                value={editReservationForm.purpose}
                onChange={(e) =>
                  setEditReservationForm({
                    ...editReservationForm,
                    purpose: e.target.value,
                  })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label>Hall Type</label>
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

            <div className="flex flex-col gap-2">
              <label>Hall</label>
              <div className="grid grid-cols-2 gap-3 h-20 overflow-y-auto pr-2">
                {hallLoading ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    Loading halls...
                  </p>
                ) : (
                  hallData?.data?.map(
                    (item: { hall_id: string; hall_name: string }) => (
                      <div
                        key={item.hall_id}
                        className="flex items-center gap-1"
                      >
                        <Checkbox
                          id={`edit-hall-${item.hall_id}`}
                          checked={editReservationForm.hall.includes(
                            item.hall_id,
                          )}
                          onCheckedChange={() => toggleEditHall(item.hall_id)}
                        />
                        <label
                          htmlFor={`edit-hall-${item.hall_id}`}
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

            <div className="flex flex-col gap-2">
              <label>Equipment</label>
              <div className="grid grid-cols-2 gap-3 h-20 overflow-y-auto pr-2">
                {itemLoading ? (
                  <p className="text-sm text-muted-foreground col-span-2">
                    Loading equipment...
                  </p>
                ) : (
                  itemData?.data?.map(
                    (item: { item_id: string; item_name: string }) => (
                      <div
                        key={item.item_id}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={`edit-equipment-${item.item_id}`}
                          checked={editReservationForm.equipment.includes(
                            item.item_id,
                          )}
                          onCheckedChange={() =>
                            toggleEditEquipment(item.item_id)
                          }
                        />
                        <label
                          htmlFor={`edit-equipment-${item.item_id}`}
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

            <div className="flex flex-col gap-1">
              <label>Number of Attendees</label>
              <Input
                type="number"
                min={1}
                value={editReservationForm.attendees_qty}
                onChange={(e) =>
                  setEditReservationForm({
                    ...editReservationForm,
                    attendees_qty: e.target.value,
                  })
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label>Time From</label>
                <Input
                  type="time"
                  value={editReservationForm.time_from}
                  onChange={(e) =>
                    setEditReservationForm({
                      ...editReservationForm,
                      time_from: e.target.value,
                    })
                  }
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label>Time To</label>
                <Input
                  type="time"
                  value={editReservationForm.time_to}
                  onChange={(e) =>
                    setEditReservationForm({
                      ...editReservationForm,
                      time_to: e.target.value,
                    })
                  }
                  className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label>Other Request</label>
              <Textarea
                value={editReservationForm.other_request}
                onChange={(e) =>
                  setEditReservationForm({
                    ...editReservationForm,
                    other_request: e.target.value,
                  })
                }
                className="resize-none rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleUpdateReservation}
              className="w-full bg-green-800 rounded-sm py-5 text-white font-medium"
            >
              Update Reservation
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

      <AlertDialog open={openActionDialog} onOpenChange={setOpenActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">
              {action} this reservation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              This will update the reservation status. This action can`t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleUpdateReservationStatus();
              }}
              disabled={actionLoading}
              className={
                action === "Decline"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : action === "Approve"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-yellow-600 hover:bg-yellow-700 text-white"
              }
            >
              {actionLoading ? `Processing...` : action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel — now a Dialog with reason + proof upload */}
      {/* <Dialog
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
            <DialogDescription className="text-gray-600">
              This will cancel your reservation
              {selectedReservation
                ? ` for ${new Date(selectedReservation.date_appointment).toLocaleDateString()}`
                : ""}
              . Please provide a reason and supporting proof. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Reason for Cancellation
              </label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this reservation is being cancelled"
                className="resize-none rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Proof (image or document)
              </label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  setCancelProofFile(e.target.files?.[0] ?? null)
                }
                className="rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {cancelProofFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {cancelProofFile.name}
                </p>
              )}
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
              {cancelling ? "Cancelling..." : "Cancel Reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
