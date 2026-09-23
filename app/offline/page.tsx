import { WifiOff } from "lucide-react";

// Shown by the service worker when a page is opened offline and this device
// has no saved copy of it yet.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border text-muted-foreground">
        <WifiOff className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <h1 className="page-title">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page hasn&apos;t been opened on this device yet, so there is no saved
        copy. Pages you visited before still work offline. Reconnect to load it.
      </p>
    </div>
  );
}
