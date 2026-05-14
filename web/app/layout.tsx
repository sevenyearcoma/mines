import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteHeader } from "@/components/auth/SiteHeader";

export const metadata: Metadata = {
  title: "MINES",
  description: "A high-stakes minesweeper.",
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
          <SiteHeader />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
