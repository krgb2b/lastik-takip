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
    pathname?.startsWith("/vehicle-loadings/") && pathname?.endsWith("/print") ||
    pathname?.startsWith("/shipment-receipts/") && pathname?.endsWith("/print");

  return (
    <>
      {!hideHeader ? <HeaderMenu /> : null}
      {children}
    </>
  );
}