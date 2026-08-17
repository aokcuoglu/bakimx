import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SiteAssistant } from "@/components/site-assistant/site-assistant"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  applicationName: "BakimX",
  title: {
    default: "BakimX | Oto Servis Yönetim Platformu",
    template: "%s | BakimX",
  },
  description:
    "Oto tamirciler için mobil araç kabul, hasar kaydı, müşteri onayı ve WhatsApp işlem çıktısı platformu.",
  keywords: [
    "oto servis",
    "araç kabul",
    "hasar kaydı",
    "müşteri onayı",
    "WhatsApp işlem çıktısı",
    "dijital araç kabul",
    "bakımX",
    "oto tamir",
    "sanayi",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "BakimX | Oto Servis Yönetim Platformu",
    description:
      "Oto tamirciler için mobil araç kabul, hasar kaydı, müşteri onayı ve WhatsApp işlem çıktısı platformu.",
    type: "website",
    locale: "tr_TR",
    siteName: "BakimX",
  },
  appleWebApp: {
    title: "BakimX",
    statusBarStyle: "default",
    capable: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563EB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <TooltipProvider>
          {children}
          <Toaster />
          <SiteAssistant />
        </TooltipProvider>
      </body>
    </html>
  );
}
