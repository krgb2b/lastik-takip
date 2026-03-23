"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type MenuItem = {
  title: string;
  href: string;
  permission?: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export default function HeaderMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { permissionState } = usePermissionState();

  const [loggingOut, setLoggingOut] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const isLoginPage = pathname === "/login";

  const menuGroups = useMemo<MenuGroup[]>(() => {
    return [
      {
        title: "Genel",
        items: [
          {
            title: "Ana Panel",
            href: "/",
            permission: "dashboard.view",
          },
        ],
      },
      {
        title: "Operasyon",
        items: [
          {
            title: "Toplu Lastik Alımı",
            href: "/collections/new",
            permission: "collections.view",
          },
          {
            title: "Toplu Alım Fişleri",
            href: "/all-receipts",
            permission: "collections.view",
          },
          {
            title: "Tüm Lastikler",
            href: "/all-tyres",
            permission: "collections.view",
          },
          {
            title: "Müşteriler",
            href: "/customers",
            permission: "collections.view",
          },
          {
            title: "Fabrikaya Giriş",
            href: "/factory-receipts",
            permission: "collections.view",
          },
          {
            title: "Yönetici Onayı",
            href: "/manager-approvals",
            permission: "manager_approval.view",
          },
          {
            title: "Üretim",
            href: "/production",
            permission: "production.view",
          },
        ],
      },
      {
  title: "Sevkiyat",
  items: [
    {
      title: "Sevkiyat Hazırlık",
      href: "/shipping",
      permission: "shipping.view",
    },
    {
      title: "Sevk Fişleri",
      href: "/shipment-receipts",
      permission: "shipping.view",
    },
    {
      title: "Araç Yüklemeleri",
      href: "/vehicle-loadings",
      permission: "shipping.view",
    },
    {
      title: "Nihai Sevk",
      href: "/final-shipping",
      permission: "shipping.view",
    },
  ],
},
      {
        title: "Yönetim",
        items: [
          {
            title: "Kullanıcılar",
            href: "/admin/users",
            permission: "users.view",
          },
          {
            title: "Roller",
            href: "/admin/roles",
            permission: "roles.view",
          },
          {
            title: "Rol Yetkileri",
            href: "/admin/role-permissions",
            permission: "roles.manage",
          },
          {
            title: "Audit Log",
            href: "/admin/audit-logs",
            permission: "roles.manage",
          },
        ],
      },
    ];
  }, []);

  const visibleGroups = useMemo(() => {
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.permission ? can(permissionState, item.permission) : true
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [menuGroups, permissionState]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function groupHasActiveItem(group: MenuGroup) {
    return group.items.some((item) => isActive(item.href));
  }

  if (isLoginPage) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div
        ref={wrapperRef}
        className="flex items-center justify-between gap-4 px-4 py-3"
      >
        <div className="shrink-0">
          <Link href="/" className="text-base font-semibold text-slate-900">
            KRG Kaplama Takip
          </Link>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-2 overflow-visible">
          {visibleGroups.map((group) => {
            const isOpen = openGroup === group.title;
            const isGroupActive = groupHasActiveItem(group);

            return (
              <div key={group.title} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup((prev) =>
                      prev === group.title ? null : group.title
                    )
                  }
                  className={[
                    "inline-flex whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
                    isOpen || isGroupActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {group.title}
                </button>

                {isOpen ? (
                  <div
                    className="absolute left-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
                    style={{ width: "max-content", minWidth: "260px" }}
                  >
                    <div
                      className="flex flex-col gap-1"
                      style={{ width: "max-content", minWidth: "100%" }}
                    >
                      {group.items.map((item) => {
                        const active = isActive(item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className={[
                              "rounded-xl px-3 py-2 text-sm font-medium transition",
                              active
                                ? "bg-slate-900 text-white"
                                : "text-slate-700 hover:bg-slate-50",
                            ].join(" ")}
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {item.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loggingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
          </button>
        </div>
      </div>
    </header>
  );
}