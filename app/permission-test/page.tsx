"use client";

import { useEffect, useState } from "react";
import PermissionGuard from "@/src/components/PermissionGuard";
import { getCurrentUserPermissions } from "@/src/lib/auth/get-current-user-permissions";
import { can, canAny, canAll, hasRole } from "@/src/lib/auth/permissions";
import type { CurrentUserPermissionState } from "@/src/types/auth";

const emptyState: CurrentUserPermissionState = {
  user: null,
  roles: [],
  permissions: [],
  permissionSet: new Set<string>(),
};

export default function PermissionTestPage() {
  return (
    <PermissionGuard
      permission="roles.view"
      title="Permission Test sayfasına erişim yetkiniz yok"
      description="Bu sayfa sadece yetkili kullanıcılar içindir."
    >
      <PermissionTestContent />
    </PermissionGuard>
  );
}

function PermissionTestContent() {
  const [state, setState] = useState<CurrentUserPermissionState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const result = await getCurrentUserPermissions();
        if (mounted) {
          setState(result);
        }
      } catch (error) {
        console.error("permission-test load error:", error);
        if (mounted) {
          setErrorText(
            error instanceof Error ? error.message : "Bilinmeyen hata oluştu."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <main className="p-6">Yetkiler yükleniyor...</main>;
  }

  if (errorText) {
    return (
      <main className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Hata: {errorText}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Permission Test</h1>
        <p className="text-sm text-slate-600">
          Geçerli test kullanıcısı: <strong>ornek@firma.com</strong>
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Kullanıcı</h2>

        {state.user ? (
          <div className="space-y-1 text-sm">
            <div>
              <strong>App User ID:</strong> {state.user.id}
            </div>
            <div>
              <strong>Ad Soyad:</strong> {state.user.fullName}
            </div>
            <div>
              <strong>Email:</strong> {state.user.email || "-"}
            </div>
            <div>
              <strong>Aktif:</strong> {state.user.isActive ? "Evet" : "Hayır"}
            </div>
          </div>
        ) : (
          <div className="text-sm text-rose-600">App user bulunamadı.</div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Roller</h2>
        {state.roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {state.roles.map((role) => (
              <span
                key={role}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
              >
                {role}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Rol yok.</div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Örnek Kontroller</h2>

        <div className="grid gap-2 md:grid-cols-2">
          <TestRow
            label='can("dashboard.view")'
            value={can(state, "dashboard.view")}
          />
          <TestRow
            label='can("collections.create")'
            value={can(state, "collections.create")}
          />
          <TestRow
            label='can("manager_approval.approve")'
            value={can(state, "manager_approval.approve")}
          />
          <TestRow
            label='can("prices.edit")'
            value={can(state, "prices.edit")}
          />
          <TestRow
            label='canAny(["prices.edit", "payment_terms.edit"])'
            value={canAny(state, ["prices.edit", "payment_terms.edit"])}
          />
          <TestRow
            label='canAll(["collections.view", "collections.create"])'
            value={canAll(state, ["collections.view", "collections.create"])}
          />
          <TestRow label='hasRole("admin")' value={hasRole(state, "admin")} />
          <TestRow label='hasRole("manager")' value={hasRole(state, "manager")} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">
          Tüm İzinler ({state.permissions.length})
        </h2>

        {state.permissions.length > 0 ? (
          <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-2">Permission Code</th>
                </tr>
              </thead>
              <tbody>
                {state.permissions.map((permission) => (
                  <tr key={permission} className="border-t border-slate-100">
                    <td className="p-2">{permission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500">İzin bulunamadı.</div>
        )}
      </section>
    </main>
  );
}

function TestRow({
  label,
  value,
}: {
  label: string;
  value: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <span>{label}</span>
      <span
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          value
            ? "bg-emerald-100 text-emerald-700"
            : "bg-rose-100 text-rose-700"
        }`}
      >
        {value ? "true" : "false"}
      </span>
    </div>
  );
}