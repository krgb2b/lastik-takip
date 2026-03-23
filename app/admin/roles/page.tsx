"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";

type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
};

type UserRoleRow = {
  user_id: number;
  role_id: number;
};

type StatusFilter = "all" | "active" | "passive";

export default function AdminRolesPage() {
  return (
    <PermissionGuard
      permission="roles.view"
      title="Roller sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminRolesPageContent />
    </PermissionGuard>
  );
}

function AdminRolesPageContent() {
  const { permissionState } = usePermissionState();
  const canManageRoles = can(permissionState, "roles.manage");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [roleDescription, setRoleDescription] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [rolesRes, userRolesRes] = await Promise.all([
        supabase
          .from("roles")
          .select("id, code, name, description, is_system, is_active")
          .order("name"),
        supabase.from("user_roles").select("user_id, role_id"),
      ]);

      if (rolesRes.error) {
        setError(rolesRes.error.message);
        setLoading(false);
        return;
      }

      if (userRolesRes.error) {
        setError(userRolesRes.error.message);
        setLoading(false);
        return;
      }

      setRoles((rolesRes.data || []) as Role[]);
      setUserRoles((userRolesRes.data || []) as UserRoleRow[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const roleUserCountMap = useMemo(() => {
    const map = new Map<number, number>();

    userRoles.forEach((row) => {
      map.set(row.role_id, (map.get(row.role_id) || 0) + 1);
    });

    return map;
  }, [userRoles]);

  const filteredRoles = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return roles.filter((role) => {
      if (statusFilter === "active" && !role.is_active) return false;
      if (statusFilter === "passive" && role.is_active) return false;

      if (!q) return true;

      const haystack = [role.name, role.code, role.description || ""]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [roles, searchText, statusFilter]);

  const totalActiveRoles = useMemo(
    () => roles.filter((role) => role.is_active).length,
    [roles]
  );

  const totalPassiveRoles = useMemo(
    () => roles.filter((role) => !role.is_active).length,
    [roles]
  );

  async function handleCreateRole() {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!roleName.trim() || !roleCode.trim()) {
      alert("Rol adı ve kodu gir.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("roles")
      .insert({
        name: roleName.trim(),
        code: roleCode.trim(),
        description: roleDescription.trim() || null,
        is_system: false,
        is_active: true,
      })
      .select("id, code, name, description, is_system, is_active")
      .single();

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    const createdRole = data as Role;

    await writeAuditLog({
      action: "role_create",
      entity_table: "roles",
      entity_id: createdRole.id,
      description: "Yeni rol oluşturuldu",
      payload: {
        role_name: createdRole.name,
        role_code: createdRole.code,
      },
    });

    setRoles((prev) =>
      [...prev, createdRole].sort((a, b) => a.name.localeCompare(b.name, "tr"))
    );
    setShowCreateModal(false);
    setRoleName("");
    setRoleCode("");
    setRoleDescription("");
    setSaving(false);
  }

  async function toggleRole(role: Role) {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (role.is_system) {
      alert("Sistem rolleri bu ekrandan pasife alınamaz.");
      return;
    }

    const { error } = await supabase
      .from("roles")
      .update({ is_active: !role.is_active })
      .eq("id", role.id);

    if (error) {
      alert(error.message);
      return;
    }

    await writeAuditLog({
      action: role.is_active ? "role_deactivate" : "role_activate",
      entity_table: "roles",
      entity_id: role.id,
      description: role.is_active ? "Rol pasife alındı" : "Rol aktife alındı",
      payload: {
        role_id: role.id,
        new_is_active: !role.is_active,
      },
    });

    setRoles((prev) =>
      prev.map((item) =>
        item.id === role.id ? { ...item, is_active: !item.is_active } : item
      )
    );
  }

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roller</h1>
          <p className="text-sm text-slate-600">Sistem rollerini yönetin.</p>
        </div>

        {canManageRoles ? (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Yeni Rol
          </button>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Rol" value={String(roles.length)} />
        <SummaryCard label="Aktif" value={String(totalActiveRoles)} />
        <SummaryCard label="Pasif" value={String(totalPassiveRoles)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Rol adı, kod veya açıklama ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              label="Tümü"
            />
            <FilterButton
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
              label="Aktif"
            />
            <FilterButton
              active={statusFilter === "passive"}
              onClick={() => setStatusFilter("passive")}
              label="Pasif"
            />
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3 text-sm">Rol Adı</th>
              <th className="p-3 text-sm">Kod</th>
              <th className="p-3 text-sm">Açıklama</th>
              <th className="p-3 text-sm">Sistem Rolü</th>
              <th className="p-3 text-sm">Kullanıcı Sayısı</th>
              <th className="p-3 text-sm">Durum</th>
              <th className="p-3 text-sm">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                  Filtreye uygun rol bulunamadı.
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id} className="border-t border-slate-100">
                  <td className="p-3 text-sm font-medium">{role.name}</td>
                  <td className="p-3 text-sm">{role.code}</td>
                  <td className="p-3 text-sm">{role.description || "-"}</td>
                  <td className="p-3 text-sm">
                    {role.is_system ? (
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                        Sistem
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        Özel
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm">{roleUserCountMap.get(role.id) || 0}</td>
                  <td className="p-3 text-sm">
                    <StatusBadge active={role.is_active} />
                  </td>
                  <td className="p-3 text-sm">
                    {canManageRoles && !role.is_system ? (
                      <button
                        type="button"
                        onClick={() => toggleRole(role)}
                        className="rounded-lg border px-3 py-1"
                      >
                        {role.is_active ? "Pasife Al" : "Aktif Yap"}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Yeni Rol</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Rol Adı</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Kod</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Açıklama</label>
                <textarea
                  className="w-full rounded-xl border px-3 py-2"
                  rows={3}
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setRoleName("");
                  setRoleCode("");
                  setRoleDescription("");
                }}
                className="rounded-xl border px-4 py-2"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleCreateRole}
                disabled={saving}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-white"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}