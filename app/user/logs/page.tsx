"use client";

import { format } from "date-fns";

import { LogAction, TypeChip } from "@/components/log-action";

import { EmptyState } from "@/components/ui/empty-state";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Ellipsis, X } from "lucide-react";
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type SessionUser = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role?: string;
  systemRole?: string;
};

type Log = {
  id: number;
  log_id: string;
  event: string;
  changes: string | null;
  userId: string;
  reservationId: string | null;
  obReservationId?: string | null;
  reservation_type: string | null;
  event_type?: string;
  createdAt: string;
};

// the raw `event` string on each log (e.g. "Update Reservation") is matched
// against these filter values to bucket it into an action category
const ACTION_KEYWORDS: Record<string, string> = {
  CREATED: "create",
  UPDATED: "update",
  DELETED: "delete",
  CANCELLED: "cancel",
};

export default function UserActivityPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  const [page, setPage] = useState(1);
  const limit = 10;

  const [openLog, setOpenLog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [type, setType] = useState("all");

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["userActivity", user?.userId],
    queryFn: async () => {
      const res = await fetch(`/api/logs/hall`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
    enabled: !!user?.userId,
  });

  const userLogs: Log[] = logData?.data ?? [];

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return userLogs.filter((log) => {
      const matchesSearch =
        !query ||
        log.log_id.toLowerCase().includes(query) ||
        (log.changes ?? "").toLowerCase().includes(query) ||
        (log.reservationId ?? log.obReservationId ?? "").toLowerCase().includes(query) ||
        log.event.toLowerCase().includes(query);

      const matchesAction =
        actionFilter === "all" ||
        log.event.toLowerCase().includes(ACTION_KEYWORDS[actionFilter]);

      const matchesType = type === "all" || log.reservation_type === type;

      return matchesSearch && matchesAction && matchesType;
    });
  }, [userLogs, search, actionFilter, type]);

  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const currentPage = Math.min(page, totalPages);
  const logs = filteredLogs.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        <div>
          <h1 className="page-title">User Activity</h1>
          <p className="text-sm text-muted-foreground text-wrap">
            Monitor your reservation actions and activities
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative lg:w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search activity"
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
            <SelectValue placeholder={"Type"} />
          </SelectTrigger>

          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Type</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Hall">Hall</SelectItem>
              <SelectItem value="OB">OB</SelectItem>
              <SelectItem value="Info">Info</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={actionFilter}
          onValueChange={(value) => {
            setActionFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full lg:max-w-48 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder={"Status"} />
          </SelectTrigger>

          <SelectContent position="popper" sideOffset={4} className="w-fit">
            <SelectGroup>
              <SelectLabel>Action Performed</SelectLabel>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="CREATED">Created</SelectItem>
              <SelectItem value="UPDATED">Updated</SelectItem>
              <SelectItem value="DELETED">Deleted</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-white">
          <Table>
            {logLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Loading logs</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : logs.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    <EmptyState title="No activity found" description="Actions you take will show up here." />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.log_id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        // The action menu renders in a portal; ignore its clicks.
                        if (!e.currentTarget.contains(e.target as Node)) return;
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSelectedLog(log);
                        setOpenLog(true);
                      }}
                    >
                      <TableCell>
                        <LogAction event={log.event} eventType={log.event_type} changes={log.changes} />
                      </TableCell>

                      <TableCell className="font-mono text-xs">
                        {log.reservationId ?? log.obReservationId ?? <span className="font-sans text-muted-foreground">—</span>}
                      </TableCell>

                      <TableCell>
                        <TypeChip type={log.reservation_type} />
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <p>{format(new Date(log.createdAt), "MMM d, yyyy")}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {format(new Date(log.createdAt), "h:mm a")}
                        </p>
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
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedLog(log);
                                  setOpenLog(true);
                                }}
                              >
                                View
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
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink isActive={currentPage === i + 1} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {openLog && selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            // Click on the dim backdrop closes the popup.
            if (e.target === e.currentTarget) setOpenLog(false);
          }}
        >
          <Card className="relative w-full max-w-lg max-h-[85vh] gap-0 overflow-y-auto py-0">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Activity · <span className="font-mono normal-case">{selectedLog.log_id}</span>
                </p>
                <div className="mt-2">
                  <LogAction event={selectedLog.event} eventType={selectedLog.event_type} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenLog(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-neutral-100 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-5">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Reference</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium">
                    {selectedLog.reservationId ?? selectedLog.obReservationId ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-1">
                    <TypeChip type={selectedLog.reservation_type} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">When</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {format(new Date(selectedLog.createdAt), "EEEE, MMM d, yyyy · h:mm a")}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="text-xs text-muted-foreground">Details</p>
                <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-neutral-50 p-3 text-sm">
                  {selectedLog.changes || "No details recorded."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}