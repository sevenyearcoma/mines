import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteHeader } from "@/components/auth/SiteHeader";
import { MascotProvider, MascotRail } from "@/components/mascot/MascotRail";
import { ProProvider } from "@/components/pro/ProProvider";

export const metadata: Metadata = {
  title: "MINES",
  description: "A high-stakes minesweeper.",
  // Favicon is auto-wired by Next.js via the App Router file convention —
  // `web/app/icon.png` (sourced from web/assets/logo.png) gets injected as
  // <link rel="icon"> automatically. No metadata.icons needed.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AuthProvider>
          <ProProvider>
            <MascotProvider>
              <div className="with-mascot-rail" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <SiteHeader />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  {children}
                </div>
              </div>
              <MascotRail />
            </MascotProvider>
          </ProProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
