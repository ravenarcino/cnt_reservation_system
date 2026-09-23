"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Registers the service worker (production builds only - in `next dev` it
// would cache half-built files) and shows a banner while the device is offline.
export function Pwa() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-2 bg-neutral-900 px-4 py-2.5 text-sm text-white"
    >
      <WifiOff className="h-4 w-4" />
      You&apos;re offline. Showing the last saved data — changes can&apos;t be saved until you reconnect.
    </div>
  );
}

// Call before signing out so the next person on this device does not see
// the previous user's cached pages and data.
export function clearOfflineCache() {
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-user-cache");
  } catch {
    // no service worker - nothing to clear
  }
}
