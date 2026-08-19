"use client";

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
  reservation_type: string | null;
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
        (log.reservationId ?? "").toLowerCase().includes(query) ||
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
          <p className="text-lg font-semibold">User Activity</p>
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
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            {logLoading ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
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
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No activity found
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Log ID</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Reservation ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {logs.map((log, index) => (
                    <TableRow key={log.log_id}>
                      <TableCell className="font-medium">
                        {index + 1 + (currentPage - 1) * limit}
                      </TableCell>

                      <TableCell className="font-medium">{log.log_id}</TableCell>

                      <TableCell>{log.event}</TableCell>

                      <TableCell>{log.reservationId ?? "—"}</TableCell>

                      <TableCell>{log.reservation_type ?? "—"}</TableCell>

                      <TableCell>
                        {new Date(log.createdAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-fit lg:w-100 max-w-lg max-h-[85vh] overflow-y-auto relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8 rounded-full"
              onClick={() => setOpenLog(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            <CardHeader>
              <CardTitle>Activity Detail</CardTitle>
              <CardDescription>Log ID: {selectedLog.log_id}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Action</label>
                <p className="font-medium">{selectedLog.event}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Reservation ID</label>
                <p className="font-medium">{selectedLog.reservationId ?? "—"}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <p className="font-medium">{selectedLog.reservation_type ?? "—"}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <p className="font-medium">
                  {new Date(selectedLog.createdAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Details</label>
                <p className="font-medium whitespace-pre-wrap">
                  {selectedLog.changes || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}