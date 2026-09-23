"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

// Public "check your reservation" box on the landing page. The result card
// sits on the left, the lookup form on the right.

type Result = {
  type: string;
  reference: string;
  status: string;
  purpose: string;
  where: string;
  date_from: string;
  date_to: string;
  date_appointment: string | null;
  updatedAt: string;
};

export function StatusChecker() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(json?.error ?? "Something went wrong");
      } else {
        setResult(json.data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Result */}
      <div className="order-2 lg:order-1">
        {result ? (
          <ResultCard r={result} />
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white p-8 text-center">
            <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-2 text-sm font-medium">
              {error ?? "Your reservation will show here"}
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {error
                ? "Check the reference number in your confirmation and the email you booked with."
                : "Enter the reference number (RES-… or OB-…) and the email you used."}
            </p>
          </div>
        )}
      </div>

      {/* Form */}
      <form
        onSubmit={check}
        className="order-1 flex flex-col gap-4 rounded-lg border border-border bg-white p-6 lg:order-2"
      >
        <div>
          <p className="text-sm font-semibold">Check reservation status</p>
          <p className="text-xs text-muted-foreground">No sign-in needed.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ref" className="text-xs font-medium text-muted-foreground">
            Reference number
          </label>
          <Input
            id="ref"
            placeholder="e.g. RES-2brAktMfK_"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status-email" className="text-xs font-medium text-muted-foreground">
            Email address
          </label>
          <Input
            id="status-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="mt-1">
          {loading ? "Checking..." : "Check status"}
        </Button>
      </form>
    </div>
  );
}

function ResultCard({ r }: { r: Result }) {
  const from = new Date(r.date_from);
  const to = new Date(r.date_to);
  const when =
    r.type === "Hall" && r.date_appointment
      ? `${format(new Date(r.date_appointment), "MMM d, yyyy")} · ${format(from, "h:mm a")} – ${format(to, "h:mm a")}`
      : `${format(from, "MMM d, h:mm a")} – ${format(to, "MMM d, h:mm a")}`;

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.type}</p>
          <p className="mt-0.5 font-mono text-sm font-semibold">{r.reference}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
        <Item label="Purpose" value={r.purpose} />
        <Item label={r.type === "Hall" ? "Hall" : "Destination"} value={r.where || "—"} />
        <Item label="Schedule" value={when} />
        <Item label="Last update" value={format(new Date(r.updatedAt), "MMM d, yyyy h:mm a")} />
      </dl>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
