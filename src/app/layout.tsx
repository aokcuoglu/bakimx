import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SiteAssistant } from "@/components/site-assistant/site-assistant"
import { SITE_URL, BRAND_NAME, DEFAULT_OG_IMAGE, HOME_TITLE, TITLE_TEMPLATE, TWITTER_HANDLE } from "@/lib/seo"
import { MarketingAnalytics } from "@/components/analytics/marketing-analytics"
import { CookieConsent } from "@/components/cookie-consent/cookie-consent"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND_NAME,
  title: {
    default: HOME_TITLE,
    template: TITLE_TEMPLATE,
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
    title: HOME_TITLE,
    description:
      "Oto tamirciler için mobil araç kabul, hasar kaydı, müşteri onayı ve WhatsApp işlem çıktısı platformu.",
    type: "website",
    locale: "tr_TR",
    siteName: BRAND_NAME,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    title: HOME_TITLE,
    description:
      "Oto tamirciler için mobil araç kabul, hasar kaydı, müşteri onayı ve WhatsApp işlem çıktısı platformu.",
    images: ["/twitter-image"],
  },
  appleWebApp: {
    title: BRAND_NAME,
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
      className={`${geistMono.variable} antialiased`}
    >
      <head>
        {/*
          JS kapalıyken kaydırma animasyonlarını tamamen devre dışı bırakır
          (BAK-165). `Reveal` gizliliği sunucuda basar — titremeyi önlemek
          için — ve normalde IntersectionObserver geri alır. Gözlemci hiç
          çalışmayacaksa içerik gizli kalmamalı; tarayıcı `<noscript>` içindeki
          kuralı yalnız JS devre dışıyken uygular.
        */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html:
                '[data-reveal="pending"]{opacity:1}[data-landing-motion]{opacity:1!important;transform:none!important}',
            }}
          />
        </noscript>
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <TooltipProvider>
          {children}
          <CookieConsent />
          <MarketingAnalytics />
          <Toaster />
          <SiteAssistant />
        </TooltipProvider>
      </body>
    </html>
  );
}
