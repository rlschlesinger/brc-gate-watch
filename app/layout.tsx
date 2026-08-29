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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDE4D3" },
    { media: "(prefers-color-scheme: dark)", color: "#16130F" },
  ],
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
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Set the stored theme before first paint so a night driver never gets flashed white. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('gatewatch:theme');" +
              "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-gw-theme',t);}catch(e){}",
          }}
        />
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
