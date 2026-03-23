"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";

type AppUser = {
  id: number;
  full_name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
};

type Role = {
  id: number;
  code: string;
  name: string;
};

type UserRoleRow = {
  user_id: number;
  role_id: number;
};

type StatusFilter = "all" | "active" | "passive";

export default function AdminUsersPage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Kullanıcılar sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminUsersPageContent />
    </PermissionGuard>
  );
}

function AdminUsersPageContent() {
  const { permissionState, refreshPermissions } = usePermissionState();

  const canCreateUser = can(permissionState, "users.create");
  const canEditUser = can(permissionState, "users.edit");
  const canAssignRoles = can(permissionState, "users.assign_roles");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSelectedRoleIds, setNewSelectedRoleIds] = useState<number[]>([]);

  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [usersRes, rolesRes, userRolesRes] = await Promise.all([
        supabase
          .from("app_users")
          .select("id, full_name, email, is_active, created_at")
          .order("id", { ascending: false }),
        supabase
          .from("roles")
          .select("id, code, name")
          .eq("is_active", true)
          .order("name"),
        supabase.from("user_roles").select("user_id, role_id"),
      ]);

      if (usersRes.error) {
        setError(usersRes.error.message);
        setLoading(false);
        return;
      }

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

      setUsers((usersRes.data || []) as AppUser[]);
      setRoles((rolesRes.data || []) as Role[]);
      setUserRoles((userRolesRes.data || []) as UserRoleRow[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const roleMap = useMemo(() => {
    const map = new Map<number, Role>();
    roles.forEach((role) => map.set(role.id, role));
    return map;
  }, [roles]);

  const roleNamesByUserId = useMemo(() => {
    const map = new Map<number, string[]>();

    users.forEach((user) => {
      const names = userRoles
        .filter((row) => row.user_id === user.id)
        .map((row) => roleMap.get(row.role_id)?.name)
        .filter(Boolean) as string[];

      map.set(user.id, names);
    });

    return map;
  }, [users, userRoles, roleMap]);

  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return users.filter((user) => {
      if (statusFilter === "active" && !user.is_active) return false;
      if (statusFilter === "passive" && user.is_active) return false;

      if (!q) return true;

      const roleNames = roleNamesByUserId.get(user.id) || [];
      const haystack = [user.full_name, user.email || "", roleNames.join(" ")]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [users, searchText, statusFilter, roleNamesByUserId]);

  const totalActiveUsers = useMemo(
    () => users.filter((user) => user.is_active).length,
    [users]
  );

  const totalPassiveUsers = useMemo(
    () => users.filter((user) => !user.is_active).length,
    [users]
  );

  async function handleCreateUser() {
    if (!canCreateUser) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!newFullName.trim()) {
      alert("Ad soyad gir.");
      return;
    }

    setSavingCreate(true);

    const { data, error } = await supabase
      .from("app_users")
      .insert({
        full_name: newFullName.trim(),
        email: newEmail.trim() || null,
        is_active: true,
      })
      .select("id, full_name, email, is_active, created_at")
      .single();

    if (error) {
      alert(error.message);
      setSavingCreate(false);
      return;
    }

    const createdUser = data as AppUser;

    if (newSelectedRoleIds.length > 0) {
      if (!canAssignRoles) {
        alert("Kullanıcı oluşturuldu ancak rol atama yetkin yok.");
        setUsers((prev) => [createdUser, ...prev]);
        setShowCreateModal(false);
        setNewFullName("");
        setNewEmail("");
        setNewSelectedRoleIds([]);
        setSavingCreate(false);
        return;
      }

      const { error: roleInsertError } = await supabase
        .from("user_roles")
        .insert(
          newSelectedRoleIds.map((roleId) => ({
            user_id: createdUser.id,
            role_id: roleId,
          }))
        );

      if (roleInsertError) {
        alert(roleInsertError.message);
        setSavingCreate(false);
        return;
      }
    }

    await writeAuditLog({
      action: "user_create",
      entity_table: "app_users",
      entity_id: createdUser.id,
      description: "Yeni kullanıcı oluşturuldu",
      payload: {
        full_name: createdUser.full_name,
        email: createdUser.email,
        initial_role_ids: newSelectedRoleIds,
      },
    });

    const { data: latestUserRoles, error: latestUserRolesError } = await supabase
      .from("user_roles")
      .select("user_id, role_id");

    if (latestUserRolesError) {
      alert(latestUserRolesError.message);
      setSavingCreate(false);
      return;
    }

    setUsers((prev) => [createdUser, ...prev]);
    setUserRoles((latestUserRoles || []) as UserRoleRow[]);
    setShowCreateModal(false);
    setNewFullName("");
    setNewEmail("");
    setNewSelectedRoleIds([]);
    setSavingCreate(false);
  }

  async function toggleActive(user: AppUser) {
    if (!canEditUser) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const { error } = await supabase
      .from("app_users")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await writeAuditLog({
      action: user.is_active ? "user_deactivate" : "user_activate",
      entity_table: "app_users",
      entity_id: user.id,
      description: user.is_active
        ? "Kullanıcı pasife alındı"
        : "Kullanıcı aktife alındı",
      payload: {
        user_id: user.id,
        new_is_active: !user.is_active,
      },
    });

    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id ? { ...item, is_active: !item.is_active } : item
      )
    );
  }

  function openRoleModal(userId: number) {
    if (!canAssignRoles) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setAssigningUserId(userId);
    setSelectedRoleIds(
      userRoles.filter((row) => row.user_id === userId).map((row) => row.role_id)
    );
  }

  async function saveRoles() {
    if (!canAssignRoles || !assigningUserId) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setSavingRoles(true);

    const existingRoleIds = userRoles
      .filter((row) => row.user_id === assigningUserId)
      .map((row) => row.role_id);

    const toDelete = existingRoleIds.filter((id) => !selectedRoleIds.includes(id));
    const toInsert = selectedRoleIds.filter((id) => !existingRoleIds.includes(id));

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", assigningUserId)
        .in("role_id", toDelete);

      if (error) {
        alert(error.message);
        await refreshPermissions();
        setSavingRoles(false);
        return;
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("user_roles")
        .insert(
          toInsert.map((roleId) => ({
            user_id: assigningUserId,
            role_id: roleId,
          }))
        );

      if (error) {
        alert(error.message);
        setSavingRoles(false);
        return;
      }
    }

    await writeAuditLog({
      action: "user_roles_update",
      entity_table: "user_roles",
      entity_id: assigningUserId,
      description: "Kullanıcının rol atamaları güncellendi",
      payload: {
        user_id: assigningUserId,
        added_role_ids: toInsert,
        removed_role_ids: toDelete,
      },
    });

    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role_id");

    if (error) {
      alert(error.message);
      setSavingRoles(false);
      return;
    }

    setUserRoles((data || []) as UserRoleRow[]);
    setAssigningUserId(null);
    setSelectedRoleIds([]);
    setSavingRoles(false);
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
          <h1 className="text-2xl font-bold">Kullanıcılar</h1>
          <p className="text-sm text-slate-600">
            Uygulama kullanıcılarını ve rollerini yönetin.
          </p>
        </div>

        {canCreateUser ? (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Yeni Kullanıcı
          </button>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Kullanıcı" value={String(users.length)} />
        <SummaryCard label="Aktif" value={String(totalActiveUsers)} />
        <SummaryCard label="Pasif" value={String(totalPassiveUsers)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ad soyad, email veya rol ara..."
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
              <th className="p-3 text-sm">Ad Soyad</th>
              <th className="p-3 text-sm">Email</th>
              <th className="p-3 text-sm">Durum</th>
              <th className="p-3 text-sm">Roller</th>
              <th className="p-3 text-sm">Oluşturulma</th>
              <th className="p-3 text-sm">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                  Filtreye uygun kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const roleNames = roleNamesByUserId.get(user.id) || [];

                return (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="p-3 text-sm font-medium">{user.full_name}</td>
                    <td className="p-3 text-sm">{user.email || "-"}</td>
                    <td className="p-3 text-sm">
                      <StatusBadge active={user.is_active} />
                    </td>
                    <td className="p-3 text-sm">
                      {roleNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {roleNames.map((roleName) => (
                            <span
                              key={`${user.id}-${roleName}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                            >
                              {roleName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      {new Date(user.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {canAssignRoles ? (
                          <button
                            type="button"
                            onClick={() => openRoleModal(user.id)}
                            className="rounded-lg border px-3 py-1"
                          >
                            Rolleri Düzenle
                          </button>
                        ) : null}

                        {canEditUser ? (
                          <button
                            type="button"
                            onClick={() => toggleActive(user)}
                            className="rounded-lg border px-3 py-1"
                          >
                            {user.is_active ? "Pasife Al" : "Aktif Yap"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Yeni Kullanıcı</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Ad Soyad</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">İlk Roller</label>
                <div className="grid gap-2">
                  {roles.map((role) => {
                    const checked = newSelectedRoleIds.includes(role.id);

                    return (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSelectedRoleIds((prev) => [...prev, role.id]);
                            } else {
                              setNewSelectedRoleIds((prev) =>
                                prev.filter((id) => id !== role.id)
                              );
                            }
                          }}
                        />
                        <span className="text-sm">{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFullName("");
                  setNewEmail("");
                  setNewSelectedRoleIds([]);
                }}
                className="rounded-xl border px-4 py-2"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleCreateUser}
                disabled={savingCreate}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-white"
              >
                {savingCreate ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assigningUserId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Kullanıcı Rolleri</h2>

            <div className="mt-4 grid gap-2">
              {roles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);

                return (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoleIds((prev) => [...prev, role.id]);
                        } else {
                          setSelectedRoleIds((prev) =>
                            prev.filter((id) => id !== role.id)
                          );
                        }
                      }}
                    />
                    <span className="text-sm">{role.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssigningUserId(null);
                  setSelectedRoleIds([]);
                }}
                className="rounded-xl border px-4 py-2"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={saveRoles}
                disabled={savingRoles}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-white"
              >
                {savingRoles ? "Kaydediliyor..." : "Kaydet"}
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