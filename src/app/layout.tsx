import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BakimX | Oto Servisler İçin Dijital Araç Kabul Platformu",
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
  openGraph: {
    title: "BakimX | Oto Servisler İçin Dijital Araç Kabul Platformu",
    description:
      "Oto tamirciler için mobil araç kabul, hasar kaydı, müşteri onayı ve WhatsApp işlem çıktısı platformu.",
    type: "website",
    locale: "tr_TR",
    siteName: "BakimX",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        {children}
      </body>
    </html>
  );
}