"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type TyreType = {
  id: number;
  name: string;
  sort_order: number;
};

type TyreSize = {
  id: number;
  tyre_type_id: number;
  name: string;
  sort_order: number;
};

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function normalizeSizeText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .toLocaleLowerCase("tr-TR");
}

function sortTypes(items: TyreType[], usageCounts: Map<string, number>) {
  return [...items].sort((a, b) => {
    const usageDiff = (usageCounts.get(normalizeText(b.name)) || 0) - (usageCounts.get(normalizeText(a.name)) || 0);
    if (usageDiff !== 0) return usageDiff;
    return a.name.localeCompare(b.name, "tr");
  });
}

function sortSizes(items: TyreSize[], usageCounts: Map<string, number>) {
  return [...items].sort((a, b) => {
    const usageDiff = (usageCounts.get(normalizeSizeText(b.name)) || 0) - (usageCounts.get(normalizeSizeText(a.name)) || 0);
    if (usageDiff !== 0) return usageDiff;
    return a.name.localeCompare(b.name, "tr");
  });
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
    />
  );
}

function FormSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
    />
  );
}

function ActionButton({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const className =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : variant === "secondary"
        ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
        : "bg-slate-900 text-white hover:bg-slate-700";

  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export default function AdminTyreSizesPage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Lastik ebatlarına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminTyreSizesPageContent />
    </PermissionGuard>
  );
}

function AdminTyreSizesPageContent() {
  const { permissionState } = usePermissionState();
  const canEditMasterData = can(permissionState, "users.edit");

  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);
  const [deletingSizeId, setDeletingSizeId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tyreTypes, setTyreTypes] = useState<TyreType[]>([]);
  const [tyreSizes, setTyreSizes] = useState<TyreSize[]>([]);
  const [typeUsageCounts, setTypeUsageCounts] = useState<Map<string, number>>(new Map());
  const [sizeUsageCounts, setSizeUsageCounts] = useState<Map<string, number>>(new Map());

  const [typeSearch, setTypeSearch] = useState("");
  const [sizeSearch, setSizeSearch] = useState("");
  const [sizeFilterTypeId, setSizeFilterTypeId] = useState("all");

  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [typeName, setTypeName] = useState("");

  const [editingSizeId, setEditingSizeId] = useState<number | null>(null);
  const [sizeTypeId, setSizeTypeId] = useState("");
  const [sizeName, setSizeName] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [typesRes, sizesRes, tyresRes] = await Promise.all([
        supabase.from("tyre_types").select("id, name, sort_order").order("name"),
        supabase.from("tyre_sizes").select("id, tyre_type_id, name, sort_order").order("name"),
        supabase.from("tyres").select("tyre_type, size"),
      ]);

      const firstError = [typesRes.error, sizesRes.error, tyresRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const nextTypeUsageCounts = new Map<string, number>();
      const nextSizeUsageCounts = new Map<string, number>();

      ((tyresRes.data || []) as Array<{ tyre_type: string | null; size: string | null }>).forEach((row) => {
        if (row.tyre_type?.trim()) {
          const key = normalizeText(row.tyre_type);
          nextTypeUsageCounts.set(key, (nextTypeUsageCounts.get(key) || 0) + 1);
        }

        if (row.size?.trim()) {
          const key = normalizeSizeText(row.size);
          nextSizeUsageCounts.set(key, (nextSizeUsageCounts.get(key) || 0) + 1);
        }
      });

      setTypeUsageCounts(nextTypeUsageCounts);
      setSizeUsageCounts(nextSizeUsageCounts);
      setTyreTypes(sortTypes((typesRes.data || []) as TyreType[], nextTypeUsageCounts));
      setTyreSizes(sortSizes((sizesRes.data || []) as TyreSize[], nextSizeUsageCounts));
      setLoading(false);
    }

    loadData();
  }, []);

  const typeMap = useMemo(() => new Map(tyreTypes.map((item) => [item.id, item.name])), [tyreTypes]);

  const filteredTypes = useMemo(() => {
    const query = typeSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return tyreTypes;
    return tyreTypes.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(query));
  }, [tyreTypes, typeSearch]);

  const filteredSizes = useMemo(() => {
    const query = sizeSearch.trim().toLocaleLowerCase("tr-TR");

    return tyreSizes.filter((item) => {
      if (sizeFilterTypeId !== "all" && String(item.tyre_type_id) !== sizeFilterTypeId) return false;
      if (!query) return true;

      const haystack = [item.name, typeMap.get(item.tyre_type_id) || ""]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(query);
    });
  }, [tyreSizes, sizeSearch, sizeFilterTypeId, typeMap]);

  function resetTypeForm() {
    setEditingTypeId(null);
    setTypeName("");
  }

  function resetSizeForm() {
    setEditingSizeId(null);
    setSizeTypeId("");
    setSizeName("");
  }

  function startEditType(item: TyreType) {
    setEditingTypeId(item.id);
    setTypeName(item.name);
  }

  function startEditSize(item: TyreSize) {
    setEditingSizeId(item.id);
    setSizeTypeId(String(item.tyre_type_id));
    setSizeName(item.name);
  }

  async function saveType() {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!typeName.trim()) {
      alert("Lastik türü adı zorunlu.");
      return;
    }

    setSavingType(true);
    setError("");
    setMessage("");

    const payload = {
      name: typeName.trim(),
    };

    if (editingTypeId) {
      const { data, error: updateError } = await supabase
        .from("tyre_types")
        .update(payload)
        .eq("id", editingTypeId)
        .select("id, name, sort_order")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSavingType(false);
        return;
      }

      setTyreTypes((prev) => sortTypes(prev.map((item) => (item.id === editingTypeId ? (data as TyreType) : item)), typeUsageCounts));
      setMessage("Lastik türü güncellendi.");
      resetTypeForm();
      setSavingType(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tyre_types")
      .insert(payload)
      .select("id, name, sort_order")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingType(false);
      return;
    }

    setTyreTypes((prev) => sortTypes([...(prev || []), data as TyreType], typeUsageCounts));
    setMessage("Lastik türü eklendi.");
    resetTypeForm();
    setSavingType(false);
  }

  async function saveSize() {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!sizeTypeId) {
      alert("Önce lastik türü seç.");
      return;
    }

    if (!sizeName.trim()) {
      alert("Ebat adı zorunlu.");
      return;
    }

    setSavingSize(true);
    setError("");
    setMessage("");

    const payload = {
      tyre_type_id: Number(sizeTypeId),
      name: sizeName.trim(),
    };

    if (editingSizeId) {
      const { data, error: updateError } = await supabase
        .from("tyre_sizes")
        .update(payload)
        .eq("id", editingSizeId)
        .select("id, tyre_type_id, name, sort_order")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSavingSize(false);
        return;
      }

      setTyreSizes((prev) => sortSizes(prev.map((item) => (item.id === editingSizeId ? (data as TyreSize) : item)), sizeUsageCounts));
      setMessage("Lastik ebatı güncellendi.");
      resetSizeForm();
      setSavingSize(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tyre_sizes")
      .insert(payload)
      .select("id, tyre_type_id, name, sort_order")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingSize(false);
      return;
    }

    setTyreSizes((prev) => sortSizes([...(prev || []), data as TyreSize], sizeUsageCounts));
    setMessage("Lastik ebatı eklendi.");
    resetSizeForm();
    setSavingSize(false);
  }

  async function deleteType(item: TyreType) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!window.confirm(`Lastik türü silinsin mi? ${item.name}`)) {
      return;
    }

    setDeletingTypeId(item.id);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("tyre_types").delete().eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingTypeId(null);
      return;
    }

    setTyreTypes((prev) => prev.filter((entry) => entry.id !== item.id));
    setTyreSizes((prev) => prev.filter((entry) => entry.tyre_type_id !== item.id));
    if (editingTypeId === item.id) resetTypeForm();
    setMessage("Lastik türü silindi.");
    setDeletingTypeId(null);
  }

  async function deleteSize(item: TyreSize) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!window.confirm(`Lastik ebatı silinsin mi? ${item.name}`)) {
      return;
    }

    setDeletingSizeId(item.id);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("tyre_sizes").delete().eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingSizeId(null);
      return;
    }

    setTyreSizes((prev) => prev.filter((entry) => entry.id !== item.id));
    if (editingSizeId === item.id) resetSizeForm();
    setMessage("Lastik ebatı silindi.");
    setDeletingSizeId(null);
  }

  return (
    <main className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Lastik Ebatları</h1>
          <p className="mt-1 text-sm text-slate-500">
            Önce lastik türlerini, ardından bu türe bağlı ebatları tek ekrandan düzenle.
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {tyreTypes.length} tür, {tyreSizes.length} ebat
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Lastik Türleri" description="Tür adlarını buradan yönet; liste kullanım yoğunluğuna göre sıralanır.">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <FormInput
              value={typeName}
              onChange={(event) => setTypeName(event.target.value)}
              placeholder="Tür adı"
              disabled={!canEditMasterData || savingType}
            />
            <ActionButton onClick={saveType} disabled={!canEditMasterData || savingType}>
              {editingTypeId ? "Güncelle" : "Ekle"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={resetTypeForm}
              disabled={(!editingTypeId && !typeName) || savingType}
            >
              Temizle
            </ActionButton>
          </div>

          <div className="mt-4">
            <FormInput value={typeSearch} onChange={(event) => setTypeSearch(event.target.value)} placeholder="Tür ara" />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tür</th>
                  <th className="px-4 py-3 font-medium">Kullanım</th>
                  <th className="px-4 py-3 font-medium">Ebat</th>
                  <th className="px-4 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Yükleniyor...</td>
                  </tr>
                ) : filteredTypes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                ) : (
                  filteredTypes.map((item) => {
                    const sizeCount = tyreSizes.filter((entry) => entry.tyre_type_id === item.id).length;

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-600">{typeUsageCounts.get(normalizeText(item.name)) || 0}</td>
                        <td className="px-4 py-3 text-slate-600">{sizeCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <ActionButton variant="secondary" onClick={() => startEditType(item)}>Düzenle</ActionButton>
                            <ActionButton
                              variant="danger"
                              onClick={() => deleteType(item)}
                              disabled={deletingTypeId === item.id}
                            >
                              Sil
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Lastik Ebatları" description="Ebatları tür bazlı ekle; liste kullanım yoğunluğuna göre sıralanır.">
          <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)_auto_auto]">
            <FormSelect value={sizeTypeId} onChange={(event) => setSizeTypeId(event.target.value)} disabled={!canEditMasterData || savingSize}>
              <option value="">Tür seç</option>
              {tyreTypes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </FormSelect>
            <FormInput
              value={sizeName}
              onChange={(event) => setSizeName(event.target.value)}
              placeholder="Ebat adı"
              disabled={!canEditMasterData || savingSize}
            />
            <ActionButton onClick={saveSize} disabled={!canEditMasterData || savingSize}>
              {editingSizeId ? "Güncelle" : "Ekle"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={resetSizeForm}
              disabled={(!editingSizeId && !sizeTypeId && !sizeName) || savingSize}
            >
              Temizle
            </ActionButton>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
            <FormSelect value={sizeFilterTypeId} onChange={(event) => setSizeFilterTypeId(event.target.value)}>
              <option value="all">Tüm türler</option>
              {tyreTypes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </FormSelect>
            <FormInput value={sizeSearch} onChange={(event) => setSizeSearch(event.target.value)} placeholder="Ebat veya tür ara" />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ebat</th>
                  <th className="px-4 py-3 font-medium">Tür</th>
                  <th className="px-4 py-3 font-medium">Kullanım</th>
                  <th className="px-4 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Yükleniyor...</td>
                  </tr>
                ) : filteredSizes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                ) : (
                  filteredSizes.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{typeMap.get(item.tyre_type_id) || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{sizeUsageCounts.get(normalizeSizeText(item.name)) || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <ActionButton variant="secondary" onClick={() => startEditSize(item)}>Düzenle</ActionButton>
                          <ActionButton
                            variant="danger"
                            onClick={() => deleteSize(item)}
                            disabled={deletingSizeId === item.id}
                          >
                            Sil
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}