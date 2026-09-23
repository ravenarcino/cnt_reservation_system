"use client";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { ObAnalytics, type ObTripRow } from "@/components/ob/ob-analytics";

// OB admin home: the same OB cards and charts shown on the super admin
// dashboard, with every chart turned on.
export default function ObAdminDashboard() {
  const { data: tripData, isLoading } = useQuery({
    queryKey: ["obReservation", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ["obDashboardVehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles/vehicles/vehicle?limit=1");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: driversData } = useQuery({
    queryKey: ["obDashboardDrivers"],
    queryFn: async () => {
      const res = await fetch("/api/drivers/driver?limit=1");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const trips: ObTripRow[] = tripData?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of OB trips, vehicles and drivers</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
          <Spinner />
          <span>Loading dashboard</span>
        </div>
      ) : (
        <ObAnalytics
          trips={trips}
          vehiclesTotal={vehiclesData?.total ?? 0}
          driversTotal={driversData?.total ?? 0}
          basePath="/ob_admin"
        />
      )}
    </div>
  );
}
