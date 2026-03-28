import "./globals.css";
import type { Metadata } from "next";
import { PermissionProvider } from "@/src/providers/PermissionProvider";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import AppShell from "@/src/components/AppShell";

export const metadata: Metadata = {
  title: "KRG Kaplama Takip",
  description: "KRG Kaplama Takip Sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <ErrorBoundary>
          <PermissionProvider>
            <AppShell>{children}</AppShell>
          </PermissionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}