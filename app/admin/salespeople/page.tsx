"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import MultiSelect from "@/src/components/MultiSelect";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type Region = {
  id: number;
  name: string;
  is_active: boolean;
};

type SalespersonRegionRelation = {
  region_id: number | null;
  regions?: Region | Region[] | null;
};

type SalespersonRow = {
  id: number;
  name: string;
  region_id: number | null;
  is_active: boolean;
  salesperson_regions?: SalespersonRegionRelation | SalespersonRegionRelation[] | null;
};

type Salesperson = {
  id: number;
  name: string;
  region_id: number | null;
  regionIds: number[];
  regionNames: string[];
  is_active: boolean;
};

type SalespersonStat = {
  id: number;
  name: string;
  regionNames: string[];
  count: number;
};

const SALESPERSON_WITH_REGIONS_SELECT = `
  id,
  name,
  region_id,
  is_active,
  salesperson_regions(
    region_id,
    regions(id, name, is_active)
  )
`;

function normalizeSalespeople(rows: SalespersonRow[], regionMap: Map<number, string>) {
  return rows.map((row) => {
    const relationRows = Array.isArray(row.salesperson_regions)
      ? row.salesperson_regions
      : row.salesperson_regions
        ? [row.salesperson_regions]
        : [];

    const regionIds = Array.from(
      new Set(
        relationRows
          .map((relation) => relation.region_id)
          .filter((value): value is number => value !== null)
      )
    );

    if (regionIds.length === 0 && row.region_id) {
      regionIds.push(row.region_id);
    }

    const regionNames = Array.from(
      new Set(
        relationRows
          .map((relation) => {
            if (!relation.regions) return "";
            const region = Array.isArray(relation.regions)
              ? relation.regions[0] || null
              : relation.regions;
            return region?.name || "";
          })
          .filter(Boolean)
      )
    );

    if (regionNames.length === 0) {
      regionIds.forEach((regionId) => {
        const regionName = regionMap.get(regionId);
        if (regionName && !regionNames.includes(regionName)) {
          regionNames.push(regionName);
        }
      });
    }

    return {
      id: row.id,
      name: row.name,
      region_id: row.region_id,
      regionIds,
      regionNames,
      is_active: row.is_active,
    };
  });
}

export default function AdminSalespeoplePage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Plasiyerler sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminSalespeoplePageContent />
    </PermissionGuard>
  );
}

function AdminSalespeoplePageContent() {
  const { permissionState } = usePermissionState();
  const canEdit = can(permissionState, "users.edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [customerCounts, setCustomerCounts] = useState<Record<number, number>>({});
  const [searchText, setSearchText] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSalespersonName, setNewSalespersonName] = useState("");
  const [newSalespersonRegionIds, setNewSalespersonRegionIds] = useState<string[]>([]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [editSalespersonName, setEditSalespersonName] = useState("");
  const [editSalespersonRegionIds, setEditSalespersonRegionIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [salespeopleRes, customerCountsRes, regionsRes] = await Promise.all([
        supabase.from("salespeople").select(SALESPERSON_WITH_REGIONS_SELECT).eq("is_active", true).order("name"),
        supabase.from("customers").select("salesperson_id"),
        supabase.from("regions").select("id, name, is_active").eq("is_active", true).order("name"),
      ]);

      const firstError = [salespeopleRes.error, customerCountsRes.error, regionsRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const counts: Record<number, number> = {};
      ((customerCountsRes.data || []) as Array<{ salesperson_id: number | null }>).forEach((row) => {
        if (!row.salesperson_id) return;
        counts[row.salesperson_id] = (counts[row.salesperson_id] || 0) + 1;
      });

      const regionRows = (regionsRes.data || []) as Region[];
      const regionMap = new Map(regionRows.map((region) => [region.id, region.name]));

      setSalespeople(
        normalizeSalespeople((salespeopleRes.data || []) as SalespersonRow[], regionMap)
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
      setRegions(regionRows);
      setCustomerCounts(counts);
      setLoading(false);
    }

    loadData();
  }, []);

  const regionOptions = useMemo(
    () => regions.map((region) => ({ value: String(region.id), label: region.name })),
    [regions]
  );

  const regionNameMap = useMemo(() => new Map(regions.map((region) => [region.id, region.name])), [regions]);

  const salespersonStats = useMemo<SalespersonStat[]>(() => {
    return salespeople
      .map((salesperson) => ({
        id: salesperson.id,
        name: salesperson.name,
        regionNames: salesperson.regionNames,
        count: customerCounts[salesperson.id] || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [salespeople, customerCounts]);

  const filteredStats = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");
    if (!q) return salespersonStats;

    return salespersonStats.filter((item) => {
      const haystack = [item.name, ...item.regionNames].join(" ").toLocaleLowerCase("tr-TR");
      return haystack.includes(q);
    });
  }, [salespersonStats, searchText]);

  function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase("tr-TR");
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setSelectedSalesperson(null);
    setEditSalespersonName("");
    setEditSalespersonRegionIds([]);
  }

  function openEditModal(salesperson: Salesperson) {
    setSelectedSalesperson(salesperson);
    setEditSalespersonName(salesperson.name);
    setEditSalespersonRegionIds(salesperson.regionIds.map(String));
    setEditModalOpen(true);
  }

  function openCreateModal() {
    setNewSalespersonName("");
    setNewSalespersonRegionIds([]);
    setCreateModalOpen(true);
  }

  function buildRegionNames(regionIds: number[]) {
    return regionIds
      .map((regionId) => regionNameMap.get(regionId) || "")
      .filter(Boolean);
  }

  async function replaceSalespersonRegions(salespersonId: number, regionIds: number[]) {
    const deleteRes = await supabase.from("salesperson_regions").delete().eq("salesperson_id", salespersonId);
    if (deleteRes.error) {
      throw new Error(deleteRes.error.message);
    }

    if (regionIds.length === 0) {
      return;
    }

    const insertRes = await supabase.from("salesperson_regions").insert(
      regionIds.map((regionId) => ({ salesperson_id: salespersonId, region_id: regionId }))
    );

    if (insertRes.error) {
      throw new Error(insertRes.error.message);
    }
  }

  async function handleCreateSalesperson() {
    if (!canEdit) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const trimmed = newSalespersonName.trim();
    if (!trimmed) {
      alert("Plasiyer adı zorunlu.");
      return;
    }

    const duplicateSalesperson = salespeople.find(
      (salesperson) => normalizeName(salesperson.name) === normalizeName(trimmed)
    );

    if (duplicateSalesperson) {
      alert("Aynı isimde bir plasiyer zaten var.");
      return;
    }

    const regionIds = Array.from(new Set(newSalespersonRegionIds.map((value) => Number(value)).filter(Boolean)));

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("salespeople")
        .insert({
          name: trimmed,
          region_id: regionIds[0] || null,
          is_active: true,
        })
        .select("id, name, region_id, is_active")
        .single();

      if (error) throw new Error(error.message);

      const createdSalesperson = data as Pick<Salesperson, "id" | "name" | "region_id" | "is_active">;

      try {
        await replaceSalespersonRegions(createdSalesperson.id, regionIds);
      } catch (relationError) {
        await supabase.from("salespeople").delete().eq("id", createdSalesperson.id);
        throw relationError;
      }

      setSalespeople((prev) =>
        [
          ...prev,
          {
            id: createdSalesperson.id,
            name: createdSalesperson.name,
            region_id: regionIds[0] || null,
            regionIds,
            regionNames: buildRegionNames(regionIds),
            is_active: createdSalesperson.is_active,
          },
        ].sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
      setNewSalespersonName("");
      setNewSalespersonRegionIds([]);
      setCreateModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kayıt hatası";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSalesperson() {
    if (!canEdit) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!selectedSalesperson) return;

    const trimmed = editSalespersonName.trim();
    if (!trimmed) {
      alert("Yeni plasiyer adı boş olamaz.");
      return;
    }

    const duplicateSalesperson = salespeople.find(
      (salesperson) =>
        salesperson.id !== selectedSalesperson.id &&
        normalizeName(salesperson.name) === normalizeName(trimmed)
    );

    if (duplicateSalesperson) {
      alert("Aynı isimde bir plasiyer zaten var.");
      return;
    }

    const regionIds = Array.from(new Set(editSalespersonRegionIds.map((value) => Number(value)).filter(Boolean)));

    setSaving(true);

    try {
      const updateRes = await supabase
        .from("salespeople")
        .update({ name: trimmed, region_id: regionIds[0] || null })
        .eq("id", selectedSalesperson.id);

      if (updateRes.error) throw new Error(updateRes.error.message);

      await replaceSalespersonRegions(selectedSalesperson.id, regionIds);

      setSalespeople((prev) =>
        prev
          .map((salesperson) =>
            salesperson.id === selectedSalesperson.id
              ? {
                  ...salesperson,
                  name: trimmed,
                  region_id: regionIds[0] || null,
                  regionIds,
                  regionNames: buildRegionNames(regionIds),
                }
              : salesperson
          )
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
      closeEditModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Güncelleme hatası";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSalesperson() {
    if (!canEdit) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!selectedSalesperson) return;

    const confirmed = window.confirm(
      `\"${selectedSalesperson.name}\" plasiyeri pasif yapılacak ve bağlı müşterilerden kaldırılacak. Devam edilsin mi?`
    );
    if (!confirmed) return;

    setSaving(true);

    try {
      const [customersUpdateRes, relationDeleteRes, salespersonUpdateRes] = await Promise.all([
        supabase.from("customers").update({ salesperson_id: null }).eq("salesperson_id", selectedSalesperson.id),
        supabase.from("salesperson_regions").delete().eq("salesperson_id", selectedSalesperson.id),
        supabase.from("salespeople").update({ is_active: false, region_id: null }).eq("id", selectedSalesperson.id),
      ]);

      const firstError = [customersUpdateRes.error, relationDeleteRes.error, salespersonUpdateRes.error].find(Boolean);
      if (firstError) throw new Error(firstError.message);

      setSalespeople((prev) => prev.filter((item) => item.id !== selectedSalesperson.id));
      setCustomerCounts((prev) => {
        const next = { ...prev };
        delete next[selectedSalesperson.id];
        return next;
      });
      closeEditModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Temizleme hatası";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plasiyerler</h1>
          <p className="mt-1 text-sm text-slate-600">
            Plasiyerlere birden fazla bölge atayabilir ve tek ekrandan yönetebilirsin.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || saving}
          className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Yeni Plasiyer Ekle
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          className="filter-control"
          placeholder="Plasiyer veya bölge ara..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="p-3 text-xs font-semibold text-slate-600">Plasiyer</th>
                <th className="p-3 text-xs font-semibold text-slate-600">Bölgeler</th>
                <th className="p-3 text-xs font-semibold text-slate-600">Müşteri Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredStats.map((item) => {
                  const salesperson = salespeople.find((entry) => entry.id === item.id);
                  if (!salesperson) return null;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => openEditModal(salesperson)}
                      className="cursor-pointer border-b border-slate-100 bg-white transition hover:bg-slate-50"
                    >
                      <td className="p-3 text-sm font-medium text-slate-900">{item.name}</td>
                      <td className="p-3 text-sm text-slate-700">
                        {item.regionNames.length > 0 ? item.regionNames.join(", ") : "-"}
                      </td>
                      <td className="p-3 text-sm text-slate-700">{item.count}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Plasiyeri düzenle</h2>
            <p className="mt-1 text-sm text-slate-600">
              Plasiyer adını ve bağlı olduğu bölgeleri güncelleyebilirsin.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plasiyer Adı</label>
                <input
                  className="filter-control"
                  value={editSalespersonName}
                  onChange={(e) => setEditSalespersonName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bölgeler</label>
                <MultiSelect
                  options={regionOptions}
                  values={editSalespersonRegionIds}
                  onChange={setEditSalespersonRegionIds}
                  placeholder="Bölge seç..."
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDeleteSalesperson}
                disabled={saving || !canEdit}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                Bu Değeri Temizle
              </button>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleSaveSalesperson}
                  disabled={saving || !canEdit}
                  className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Yeni Plasiyer Ekle</h2>
            <p className="mt-1 text-sm text-slate-600">Yeni plasiyeri ve bağlı olduğu bölgeleri popup içinden ekleyebilirsin.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plasiyer Adı</label>
                <input
                  className="filter-control"
                  placeholder="Yeni plasiyer adı"
                  value={newSalespersonName}
                  onChange={(e) => setNewSalespersonName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bölgeler</label>
                <MultiSelect
                  options={regionOptions}
                  values={newSalespersonRegionIds}
                  onChange={setNewSalespersonRegionIds}
                  placeholder="Bölge seç..."
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCreateSalesperson}
                disabled={!canEdit || saving}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Ekleniyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
