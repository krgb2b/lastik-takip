"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type AdminNavItem = {
  href: string;
  label: string;
  permission: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/users", label: "Kullanıcılar", permission: "users.view" },
  { href: "/admin/customers", label: "Müşteriler", permission: "users.view" },
  { href: "/admin/regions", label: "Bölgeler", permission: "users.view" },
  { href: "/admin/salespeople", label: "Plasiyerler", permission: "users.view" },
  { href: "/admin/retread-catalog", label: "Kaplama Marka / Desen", permission: "users.view" },
  { href: "/admin/original-catalog", label: "Orijinal Marka / Desen", permission: "users.view" },
  { href: "/admin/tyre-sizes", label: "Lastik Ebatları", permission: "users.view" },
  { href: "/admin/roles", label: "Roller", permission: "roles.view" },
  { href: "/admin/role-permissions", label: "Rol Yetkileri", permission: "roles.view" },
  { href: "/admin/audit-logs", label: "Audit Logları", permission: "audit.view" },
];

function isRouteActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { permissionState } = usePermissionState();

  const visibleItems = ADMIN_NAV_ITEMS.filter((item) =>
    can(permissionState, item.permission)
  );

  return (
    <aside className="lg:sticky lg:top-4 self-start rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="px-2 pb-2 text-sm font-semibold text-slate-900">Yönetim Paneli</h2>

      <nav className="flex flex-col gap-1">
        {visibleItems.map((item) => {
          const active = isRouteActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
