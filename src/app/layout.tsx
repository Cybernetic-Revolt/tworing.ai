import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Calistoga } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Warm display serif for headings — paired with Geist body for an editorial,
// premium feel. Single weight (400); its size carries the hierarchy.
const calistoga = Calistoga({
  variable: "--font-calistoga",
  subsets: ["latin"],
  weight: "400",
});

const SITE_DESC =
  "TwoRing is the 24/7 AI receptionist for the trades: it answers every call in two rings, books the job into your calendar during the call, and emails you the lead. Canadian-owned and CASL-compliant, so you never lose a customer to voicemail.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tworing.ai"),
  title: "TwoRing — The 24/7 AI receptionist for the trades",
  description: SITE_DESC,
  openGraph: {
    title: "TwoRing — The 24/7 AI receptionist for the trades",
    description: SITE_DESC,
    url: "/",
    siteName: "TwoRing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TwoRing — The 24/7 AI receptionist for the trades",
    description: SITE_DESC,
  },
  // Installable web app. The manifest is site-wide so the login page is inside the app's
  // scope; the icons here are what iOS uses (it ignores the manifest's icon list).
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "TwoRing",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  // Installed apps on iOS render under the status bar; cover the notch area with our own
  // background rather than leaving a white band.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${calistoga.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
