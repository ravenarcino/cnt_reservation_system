import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

// Layout for sign-in, sign-up and password pages: form on the left, a plain
// brand panel on the right (hidden on small screens).
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <BrandMark />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CNT Promo &amp; Ads Specialists, Inc.
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-brand lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Faint grid, drawn with CSS - no stock imagery. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <p className="relative text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
          CNT Reservation System
        </p>
        <div className="relative">
          <p className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
            Halls, vehicles and equipment, booked the same way every time.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg bg-white/20">
            {[
              ["Halls", "Meeting rooms"],
              ["OB", "Vehicle trips"],
              ["Items", "Equipment"],
            ].map(([a, b]) => (
              <div key={a} className="bg-brand/90 p-4">
                <p className="text-lg font-semibold text-white">{a}</p>
                <p className="text-xs text-white/70">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/70">
          Having trouble signing in? Contact the IT Group.
        </p>
      </div>
    </div>
  );
}
