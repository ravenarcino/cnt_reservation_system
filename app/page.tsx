import Link from "next/link";
import { Building2, Car, ClipboardCheck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { StatusChecker } from "@/components/landing/status-checker";

// Public landing page: what the system is for, a reservation status lookup,
// and the way in (Sign in / Create account).

const FEATURES = [
  {
    icon: Building2,
    title: "Halls & meeting rooms",
    body: "See which rooms are free, pick a time slot and book it without double-booking anyone.",
  },
  {
    icon: Car,
    title: "OB vehicle trips",
    body: "Request a company vehicle and driver for official business, across one day or several.",
  },
  {
    icon: Package,
    title: "Equipment",
    body: "Borrow projectors, speakers and other items along with your hall booking.",
  },
  {
    icon: ClipboardCheck,
    title: "Approvals & reports",
    body: "Admins approve requests in one place, with logs and reports for every booking.",
  },
];

const STEPS = [
  { n: "01", title: "Sign in", body: "Use your CNT account. New here? Create one and wait for IT to activate it." },
  { n: "02", title: "Pick a slot", body: "Choose a hall or vehicle, the date and time. Taken slots are blocked out." },
  { n: "03", title: "Get approved", body: "Track the status from your dashboard, or right here with your reference number." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#status" className="hover:text-foreground">Check status</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/auth/signup">Create account</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            CNT Promo & Ads Specialists, Inc.
          </p>
          <h1 className="page-title mt-4 !text-4xl sm:!text-5xl !leading-[1.1]">
            Book halls and company vehicles in minutes.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            One place to reserve meeting rooms, request OB trips and borrow
            equipment, and to see where your request stands.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/auth/login">Log in to book</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#status">Check a reservation</a>
            </Button>
          </div>
        </div>

        {/* Product preview (drawn, not a screenshot) */}
        <div className="rounded-xl border border-border bg-neutral-50 p-3">
          <div className="rounded-lg border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Today&apos;s bookings</p>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                3 pending
              </span>
            </div>
            {[
              ["Conference Hall A", "9:00 – 11:30 AM", "Approved", "bg-emerald-500"],
              ["Toyota Innova · Makati", "1:00 – 5:00 PM", "Pending", "bg-amber-500"],
              ["Meeting Room 2", "2:00 – 3:00 PM", "Approved", "bg-emerald-500"],
              ["Training Room", "4:00 – 6:30 PM", "Pending", "bg-amber-500"],
            ].map(([what, when, status, dot]) => (
              <div
                key={what}
                className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{what}</p>
                  <p className="text-xs text-muted-foreground">{when}</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Features</p>
          <h2 className="page-title mt-2">Everything a booking needs</h2>
          <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white p-6">
                <Icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
                <p className="mt-4 text-sm font-semibold">{title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">How it works</p>
          <h2 className="page-title mt-2">Three steps, no paperwork</h2>
          <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t-2 border-brand pt-5">
                <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                <p className="mt-2 text-base font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Status lookup */}
      <section id="status" className="border-t border-border bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Track a request</p>
          <h2 className="page-title mt-2">Where is my reservation?</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Enter the reference number from your booking and the email you used.
          </p>
          <div className="mt-8">
            <StatusChecker />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-start md:justify-between">
          <div>
            <BrandMark label={false} />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Internal reservation system of CNT Promo &amp; Ads Specialists, Inc.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Need help?</p>
            <p className="mt-1 text-muted-foreground">Contact the IT Group for account or booking concerns.</p>
          </div>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} CNT Promo &amp; Ads Specialists, Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
