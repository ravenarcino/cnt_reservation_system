import Link from "next/link";

// CNT Promo & Ads Specialists logo used on public pages (landing and auth).
// Set `label` to show "Reservation" beside it.
export function BrandMark({
  href = "/",
  label = true,
  className = "h-8",
}: {
  href?: string;
  label?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <img
        src="/cnt-logo.png"
        alt="CNT Promo & Ads Specialists, Inc."
        width={1050}
        height={240}
        className={`${className} w-auto`}
      />
      {label && (
        <span className="hidden border-l border-border pl-3 text-sm font-medium text-muted-foreground sm:inline">
          Reservation
        </span>
      )}
    </Link>
  );
}
