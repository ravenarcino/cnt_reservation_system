import type { MetadataRoute } from "next";

// Web app manifest: lets the system be installed on phones and desktops.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CNT Reservation",
    short_name: "CNT Reserve",
    description: "Book halls, OB vehicle trips and equipment at CNT",
    start_url: "/auth/login",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#dc2626",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
