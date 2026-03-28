"use client";

import { usePathname } from "next/navigation";
import HeaderMenu from "@/app/HeaderMenu";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideHeader =
    pathname?.includes("/print") ||
    pathname?.includes("workorder-print") ||
    pathname?.includes("workorders-print") ||
    (pathname?.startsWith("/vehicle-loadings/") && pathname?.endsWith("/print")) ||
    (pathname?.startsWith("/shipment-receipts/") && pathname?.endsWith("/print"));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {!hideHeader ? <HeaderMenu /> : null}

      <div className="flex-1">
        {children}
      </div>

      {!hideHeader ? (
        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-600">
          Copyright Emre Lastik Otomotiv San. ve Tic. Ltd. Şti.
        </footer>
      ) : null}
    </div>
  );
}