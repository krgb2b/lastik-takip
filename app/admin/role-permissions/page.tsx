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
};

type Permission = {
  id: number;
  code: string;
  name: string;
  module: string;
};

type RolePermission = {
  role_id: number;
  permission_id: number;
};

export default function AdminRolePermissionsPage() {
  return (
    <PermissionGuard
      permission="roles.manage"
      title="Rol İzinleri sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminRolePermissionsPageContent />
    </PermissionGuard>
  );
}

function AdminRolePermissionsPageContent() {
  const { permissionState, refreshPermissions } = usePermissionState();
  const canManageRoles = can(permissionState, "roles.manage");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [rolesRes, permissionsRes, rolePermissionsRes] = await Promise.all([
        supabase
          .from("roles")
          .select("id, code, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("permissions")
          .select("id, code, name, module")
          .order("module")
          .order("code"),
        supabase
          .from("role_permissions")
          .select("role_id, permission_id"),
      ]);

      if (rolesRes.error) {
        setError(rolesRes.error.message);
        setLoading(false);
        return;
      }

      if (permissionsRes.error) {
        setError(permissionsRes.error.message);
        setLoading(false);
        return;
      }

      if (rolePermissionsRes.error) {
        setError(rolePermissionsRes.error.message);
        setLoading(false);
        return;
      }

      const rolesData = (rolesRes.data || []) as Role[];
      const permissionsData = (permissionsRes.data || []) as Permission[];
      const rolePermissionsData = (rolePermissionsRes.data || []) as RolePermission[];

      setRoles(rolesData);
      setPermissions(permissionsData);
      setRolePermissions(rolePermissionsData);

      if (rolesData.length > 0) {
        const firstRoleId = rolesData[0].id;
        setSelectedRoleId(firstRoleId);
        setSelectedPermissionIds(
          rolePermissionsData
            .filter((row) => row.role_id === firstRoleId)
            .map((row) => row.permission_id)
        );
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const availableModules = useMemo(() => {
    return Array.from(new Set(permissions.map((permission) => permission.module))).sort(
      (a, b) => a.localeCompare(b, "tr")
    );
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return permissions.filter((permission) => {
      if (moduleFilter !== "all" && permission.module !== moduleFilter) {
        return false;
      }

      if (!q) return true;

      const haystack = [permission.name, permission.code, permission.module]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [permissions, searchText, moduleFilter]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();

    filteredPermissions.forEach((permission) => {
      const current = groups.get(permission.module) || [];
      current.push(permission);
      groups.set(permission.module, current);
    });

    return Array.from(groups.entries());
  }, [filteredPermissions]);

  function handleRoleChange(roleId: number) {
    setSelectedRoleId(roleId);
    setSelectedPermissionIds(
      rolePermissions
        .filter((row) => row.role_id === roleId)
        .map((row) => row.permission_id)
    );
  }

  function selectAllVisiblePermissions() {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setSelectedPermissionIds((prev) =>
      Array.from(new Set([...prev, ...filteredPermissions.map((p) => p.id)]))
    );
  }

  function clearAllVisiblePermissions() {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const visibleIds = filteredPermissions.map((permission) => permission.id);
    setSelectedPermissionIds((prev) =>
      prev.filter((id) => !visibleIds.includes(id))
    );
  }

  function selectAllPermissions() {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setSelectedPermissionIds(permissions.map((p) => p.id));
  }

  function clearAllPermissions() {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setSelectedPermissionIds([]);
  }

  function toggleModule(moduleName: string, checked: boolean) {
    if (!canManageRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const modulePermissionIds = permissions
      .filter((p) => p.module === moduleName)
      .map((p) => p.id);

    if (checked) {
      setSelectedPermissionIds((prev) =>
        Array.from(new Set([...prev, ...modulePermissionIds]))
      );
    } else {
      setSelectedPermissionIds((prev) =>
        prev.filter((id) => !modulePermissionIds.includes(id))
      );
    }
  }

  async function saveRolePermissions() {
    if (!canManageRoles || !selectedRoleId) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setSaving(true);

    const existingIds = rolePermissions
      .filter((row) => row.role_id === selectedRoleId)
      .map((row) => row.permission_id);

    const toDelete = existingIds.filter((id) => !selectedPermissionIds.includes(id));
    const toInsert = selectedPermissionIds.filter((id) => !existingIds.includes(id));

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRoleId)
        .in("permission_id", toDelete);

      if (error) {
        alert(error.message);
        await refreshPermissions();
        setSaving(false);
        return;
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("role_permissions")
        .insert(
          toInsert.map((permissionId) => ({
            role_id: selectedRoleId,
            permission_id: permissionId,
          }))
        );

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    }

    await writeAuditLog({
      action: "role_permissions_update",
      entity_table: "role_permissions",
      entity_id: selectedRoleId,
      description: "Rol izinleri güncellendi",
      payload: {
        role_id: selectedRoleId,
        added_permission_ids: toInsert,
        removed_permission_ids: toDelete,
      },
    });

    const { data, error } = await supabase
      .from("role_permissions")
      .select("role_id, permission_id");

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setRolePermissions((data || []) as RolePermission[]);
    setSaving(false);
    alert("Rol izinleri kaydedildi.");
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
          <h1 className="text-2xl font-bold">Rol İzinleri</h1>
          <p className="text-sm text-slate-600">
            Seçili rolün izinlerini yönetin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllPermissions}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Tümünü Seç
          </button>
          <button
            type="button"
            onClick={clearAllPermissions}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            Tümünü Kaldır
          </button>
          <button
            type="button"
            onClick={saveRolePermissions}
            disabled={saving || !selectedRoleId}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Rol" value={String(roles.length)} />
        <SummaryCard label="Toplam İzin" value={String(permissions.length)} />
        <SummaryCard
          label="Seçili İzin"
          value={String(selectedPermissionIds.length)}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Roller</h2>

          <div className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => handleRoleChange(role.id)}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  selectedRoleId === role.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="font-medium">{role.name}</div>
                <div
                  className={`text-xs ${
                    selectedRoleId === role.id ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {role.code}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="İzin adı, kodu veya modül ara..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />

              <select
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                <option value="all">Tüm Modüller</option>
                {availableModules.map((moduleName) => (
                  <option key={moduleName} value={moduleName}>
                    {moduleName}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllVisiblePermissions}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  Görünenleri Seç
                </button>
                <button
                  type="button"
                  onClick={clearAllVisiblePermissions}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  Görünenleri Kaldır
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Seçili rol:{" "}
              <strong>
                {selectedRole ? `${selectedRole.name} (${selectedRole.code})` : "-"}
              </strong>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {groupedPermissions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                Filtreye uygun izin bulunamadı.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedPermissions.map(([moduleName, modulePermissions]) => {
                  const modulePermissionIds = permissions
                    .filter((p) => p.module === moduleName)
                    .map((p) => p.id);

                  const allSelected =
                    modulePermissionIds.length > 0 &&
                    modulePermissionIds.every((id) =>
                      selectedPermissionIds.includes(id)
                    );

                  return (
                    <div
                      key={moduleName}
                      className="rounded-xl border border-slate-200"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                        <div>
                          <div className="font-medium capitalize">{moduleName}</div>
                          <div className="text-xs text-slate-500">
                            {modulePermissions.length} izin
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleModule(moduleName, e.target.checked)}
                          />
                          Modülü Seç
                        </label>
                      </div>

                      <div className="grid gap-2 p-3 md:grid-cols-2">
                        {modulePermissions.map((permission) => {
                          const checked = selectedPermissionIds.includes(permission.id);

                          return (
                            <label
                              key={permission.id}
                              className="flex items-start gap-2 rounded-lg border px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (!canManageRoles) {
                                    alert("Bu işlem için yetkin yok.");
                                    return;
                                  }

                                  if (e.target.checked) {
                                    setSelectedPermissionIds((prev) => [
                                      ...prev,
                                      permission.id,
                                    ]);
                                  } else {
                                    setSelectedPermissionIds((prev) =>
                                      prev.filter((id) => id !== permission.id)
                                    );
                                  }
                                }}
                              />
                              <div className="text-sm">
                                <div className="font-medium">{permission.name}</div>
                                <div className="text-slate-500">{permission.code}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
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