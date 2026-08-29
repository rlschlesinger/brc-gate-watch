import type { Metadata, Viewport } from "next";
import "./globals.css";

const TITLE = "Gate Watch · Black Rock City 2026";
const DESC =
  "Live Gravel-to-Gate travel times, weather and road chatter for Burning Man 2026 — plotted against how long the line actually took in past years.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  applicationName: "Gate Watch",
  metadataBase: new URL("https://brc-gate-watch.vercel.app"),
  openGraph: { title: TITLE, description: DESC, type: "website", siteName: "Gate Watch" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Gate Watch" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0d0a07",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
