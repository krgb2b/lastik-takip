"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type Region = {
  id: number;
  name: string;
  is_active: boolean;
};

type RegionStat = {
  id: number;
  name: string;
  count: number;
};

export default function AdminRegionsPage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Bölgeler sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminRegionsPageContent />
    </PermissionGuard>
  );
}

function AdminRegionsPageContent() {
  const { permissionState } = usePermissionState();
  const canEdit = can(permissionState, "users.edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [customerCounts, setCustomerCounts] = useState<Record<number, number>>({});
  const [searchText, setSearchText] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [editRegionName, setEditRegionName] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [regionsRes, customerCountsRes] = await Promise.all([
        supabase.from("regions").select("id, name, is_active").eq("is_active", true).order("name"),
        supabase.from("customers").select("region_id"),
      ]);

      const firstError = [regionsRes.error, customerCountsRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const counts: Record<number, number> = {};
      ((customerCountsRes.data || []) as Array<{ region_id: number | null }>).forEach((row) => {
        if (!row.region_id) return;
        counts[row.region_id] = (counts[row.region_id] || 0) + 1;
      });

      setRegions((regionsRes.data || []) as Region[]);
      setCustomerCounts(counts);
      setLoading(false);
    }

    loadData();
  }, []);

  const regionStats = useMemo<RegionStat[]>(() => {
    return regions
      .map((region) => ({
        id: region.id,
        name: region.name,
        count: customerCounts[region.id] || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [regions, customerCounts]);

  const filteredStats = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");
    if (!q) return regionStats;
    return regionStats.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(q));
  }, [regionStats, searchText]);

  function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase("tr-TR");
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setSelectedRegion(null);
    setEditRegionName("");
  }

  function openEditModal(region: Region) {
    setSelectedRegion(region);
    setEditRegionName(region.name);
    setEditModalOpen(true);
  }

  function openCreateModal() {
    setNewRegionName("");
    setCreateModalOpen(true);
  }

  async function handleCreateRegion() {
    if (!canEdit) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const trimmed = newRegionName.trim();
    if (!trimmed) {
      alert("Bölge adı zorunlu.");
      return;
    }

    const duplicateRegion = regions.find(
      (region) => normalizeName(region.name) === normalizeName(trimmed)
    );

    if (duplicateRegion) {
      alert("Aynı isimde bir bölge zaten var.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("regions")
        .insert({ name: trimmed, is_active: true })
        .select("id, name, is_active")
        .single();

      if (error) throw new Error(error.message);

      setRegions((prev) => [...prev, data as Region].sort((a, b) => a.name.localeCompare(b.name, "tr")));
      setCreateModalOpen(false);
      setNewRegionName("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kayıt hatası";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRegion() {
    if (!canEdit) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!selectedRegion) return;

    const trimmed = editRegionName.trim();
    if (!trimmed) {
      alert("Yeni bölge adı boş olamaz.");
      return;
    }

    const duplicateRegion = regions.find(
      (region) =>
        region.id !== selectedRegion.id &&
        normalizeName(region.name) === normalizeName(trimmed)
    );

    if (duplicateRegion) {
      alert("Aynı isimde bir bölge zaten var.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("regions")
        .update({ name: trimmed })
        .eq("id", selectedRegion.id);

      if (error) throw new Error(error.message);

      setRegions((prev) =>
        prev
          .map((region) =>
            region.id === selectedRegion.id ? { ...region, name: trimmed } : region
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

  async function handleDeleteRegion() {
    if (!canEdit) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!selectedRegion) return;

    const confirmed = window.confirm(
      `\"${selectedRegion.name}\" bölgesi pasif yapılacak ve bağlı kayıtlardan temizlenecek. Devam edilsin mi?`
    );
    if (!confirmed) return;

    setSaving(true);

    try {
      const [customersUpdateRes, salespersonRegionsDeleteRes, salespeopleUpdateRes, regionUpdateRes] = await Promise.all([
        supabase.from("customers").update({ region_id: null }).eq("region_id", selectedRegion.id),
        supabase.from("salesperson_regions").delete().eq("region_id", selectedRegion.id),
        supabase.from("salespeople").update({ region_id: null }).eq("region_id", selectedRegion.id),
        supabase.from("regions").update({ is_active: false }).eq("id", selectedRegion.id),
      ]);

      const firstError = [
        customersUpdateRes.error,
        salespersonRegionsDeleteRes.error,
        salespeopleUpdateRes.error,
        regionUpdateRes.error,
      ].find(Boolean);

      if (firstError) throw new Error(firstError.message);

      setRegions((prev) => prev.filter((item) => item.id !== selectedRegion.id));
      setCustomerCounts((prev) => {
        const next = { ...prev };
        delete next[selectedRegion.id];
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
          <h1 className="text-2xl font-bold text-slate-900">Bölgeler</h1>
          <p className="mt-1 text-sm text-slate-600">
            Müşteri kayıtlarındaki bölge değerlerini toplu olarak yönetebilirsin.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEdit || saving}
          className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Yeni Bölge Ekle
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          className="filter-control"
          placeholder="Bölge ara..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="p-3 text-xs font-semibold text-slate-600">Bölge</th>
                <th className="p-3 text-xs font-semibold text-slate-600">Müşteri Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredStats.map((item) => {
                  const region = regions.find((entry) => entry.id === item.id);
                  if (!region) return null;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => openEditModal(region)}
                      className="cursor-pointer border-b border-slate-100 bg-white transition hover:bg-slate-50"
                    >
                      <td className="p-3 text-sm font-medium text-slate-900">{item.name}</td>
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Bölgeyi düzenle</h2>
            <p className="mt-1 text-sm text-slate-600">
              Kaydı düzenleyebilir veya bu değeri temizleyebilirsin.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Bölge Adı</label>
              <input
                className="filter-control"
                value={editRegionName}
                onChange={(e) => setEditRegionName(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDeleteRegion}
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
                  onClick={handleSaveRegion}
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Yeni Bölge Ekle</h2>
            <p className="mt-1 text-sm text-slate-600">Yeni bölgeyi popup içinden ekleyebilirsin.</p>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Bölge Adı</label>
              <input
                className="filter-control"
                placeholder="Yeni bölge adı"
                value={newRegionName}
                onChange={(e) => setNewRegionName(e.target.value)}
              />
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
                onClick={handleCreateRegion}
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
