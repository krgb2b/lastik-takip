"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { supabase } from "@/src/lib/supabase";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { HEADER_DROPDOWN_Z_INDEX } from "@/src/constants/z-index";

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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
            title: "Karkas Formları",
            href: "/all-receipts",
            permission: "collections.view",
          },
          {
            title: "Tüm Lastikler",
            href: "/all-tyres",
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
        ],
      },
      {
        title: "Üretim",
        items: [
          {
            title: "Production",
            href: "/production",
            permission: "production.view",
          },
          {
            title: "In-Production",
            href: "/in-production",
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
        title: "Admin Paneli",
        items: [
          {
            title: "Kullanıcılar",
            href: "/admin",
            permission: "users.view",
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
      
      // Check if click target is inside header wrapper
      if (wrapperRef.current.contains(event.target as Node)) return;
      
      // Check if click target is inside portal dropdown
      const clickedElement = event.target as HTMLElement;
      if (clickedElement?.closest('[data-portal-dropdown]')) return;
      
      setOpenGroup(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!openGroup || !buttonRefs.current[openGroup]) return;

    const button = buttonRefs.current[openGroup];
    const setFromButtonRect = () => {
      const rect = button.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    };

    setFromButtonRect();

    function handleResize() {
      setFromButtonRect();
    }

    function handleScroll() {
      setFromButtonRect();
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openGroup]);

  function computeDropdownPosFromButton(button: HTMLButtonElement | null) {
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
    });
  }

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
    <header className="sticky top-0 z-[9999] border-b border-slate-200 bg-white/95 backdrop-blur overflow-visible">
      <div
        ref={wrapperRef}
        className="flex items-center justify-between gap-4 px-4 py-3 overflow-visible"
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
            const isSingleLink = group.items.length === 1;
            const singleItem = isSingleLink ? group.items[0] : null;

            return (
              <div key={group.title} className="relative shrink-0">
                <button
                  ref={(el) => {
                    if (el) buttonRefs.current[group.title] = el;
                  }}
                  type="button"
                  onClick={(e) => {
                    if (isSingleLink && singleItem) {
                      router.push(singleItem.href);
                      return;
                    }

                    const clickedButton = e.currentTarget;

                    setOpenGroup((prev) => {
                      if (prev === group.title) {
                        setDropdownPos(null);
                        return null;
                      }

                      computeDropdownPosFromButton(clickedButton);
                      return group.title;
                    });
                  }}
                  className={[
                    "inline-flex whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
                    isOpen || isGroupActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {group.title}
                </button>

                {!isSingleLink && isOpen && mounted && dropdownPos
                  ? createPortal(
                      <div
                        data-portal-dropdown
                        className="fixed mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
                        style={{
                          // Keep header dropdown above page-level filters and sticky bars.
                          zIndex: HEADER_DROPDOWN_Z_INDEX,
                          top: `${dropdownPos.top}px`,
                          left: `${dropdownPos.left}px`,
                          width: "max-content",
                          minWidth: "260px",
                          pointerEvents: "auto",
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="flex flex-col gap-1"
                          style={{ width: "max-content", minWidth: "100%" }}
                        >
                          {group.items.map((item) => {
                            const active = isActive(item.href);

                            return (
                              <button
                                key={item.href}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenGroup(null);
                                  router.push(item.href);
                                }}
                                className={[
                                  "w-full text-left rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer",
                                  active
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-700 hover:bg-slate-50",
                                ].join(" ")}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {item.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>,
                      document.body
                    )
                  : null}
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