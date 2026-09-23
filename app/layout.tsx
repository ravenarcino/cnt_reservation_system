import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NextAuthSessionProvider from "@/components/session-provider";
import { Pwa } from "@/components/pwa/pwa";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display font for page titles only; body text stays Inter.
const montserrat = Montserrat({
  variable: "--font-display",
  weight: ["700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CNT Reservation",
  description: "Book halls, OB vehicle trips and equipment at CNT",
  // Tab icon comes from app/favicon.ico and app/icon.png (Next.js file
  // conventions), cut from the CNT logo.
  appleWebApp: { capable: true, title: "CNT Reserve", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextAuthSessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </NextAuthSessionProvider>
        <Toaster richColors position="top-right" />
        <Pwa />
      </body>
    </html>
  );
}
