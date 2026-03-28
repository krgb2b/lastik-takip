"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type RetreadBrand = {
  id: number;
  name: string;
};

type TreadPattern = {
  id: number;
  brand_id: number;
  name: string;
};

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "tr"));
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

export default function AdminRetreadCatalogPage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Kaplama marka ve desenlerine erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminRetreadCatalogPageContent />
    </PermissionGuard>
  );
}

function AdminRetreadCatalogPageContent() {
  const { permissionState } = usePermissionState();
  const canEditMasterData = can(permissionState, "users.edit");

  const [loading, setLoading] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingPattern, setSavingPattern] = useState(false);
  const [deletingBrandId, setDeletingBrandId] = useState<number | null>(null);
  const [deletingPatternId, setDeletingPatternId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [brands, setBrands] = useState<RetreadBrand[]>([]);
  const [patterns, setPatterns] = useState<TreadPattern[]>([]);

  const [brandSearch, setBrandSearch] = useState("");
  const [patternSearch, setPatternSearch] = useState("");
  const [patternFilterBrandId, setPatternFilterBrandId] = useState("all");

  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [brandName, setBrandName] = useState("");

  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);
  const [patternName, setPatternName] = useState("");
  const [patternBrandId, setPatternBrandId] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [brandsRes, patternsRes] = await Promise.all([
        supabase.from("retread_brands").select("id, name").order("name"),
        supabase.from("tread_patterns").select("id, brand_id, name").order("name"),
      ]);

      const firstError = [brandsRes.error, patternsRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setBrands(sortByName((brandsRes.data || []) as RetreadBrand[]));
      setPatterns(sortByName((patternsRes.data || []) as TreadPattern[]));
      setLoading(false);
    }

    loadData();
  }, []);

  const brandMap = useMemo(() => new Map(brands.map((brand) => [brand.id, brand.name])), [brands]);

  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return brands;
    return brands.filter((brand) => brand.name.toLocaleLowerCase("tr-TR").includes(query));
  }, [brands, brandSearch]);

  const filteredPatterns = useMemo(() => {
    const query = patternSearch.trim().toLocaleLowerCase("tr-TR");

    return patterns.filter((pattern) => {
      if (patternFilterBrandId !== "all" && String(pattern.brand_id) !== patternFilterBrandId) {
        return false;
      }

      if (!query) return true;

      const haystack = [pattern.name, brandMap.get(pattern.brand_id) || ""]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(query);
    });
  }, [patterns, patternSearch, patternFilterBrandId, brandMap]);

  function resetBrandForm() {
    setEditingBrandId(null);
    setBrandName("");
  }

  function resetPatternForm() {
    setEditingPatternId(null);
    setPatternName("");
    setPatternBrandId("");
  }

  function startEditBrand(brand: RetreadBrand) {
    setEditingBrandId(brand.id);
    setBrandName(brand.name);
  }

  function startEditPattern(pattern: TreadPattern) {
    setEditingPatternId(pattern.id);
    setPatternName(pattern.name);
    setPatternBrandId(String(pattern.brand_id));
  }

  async function saveBrand() {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!brandName.trim()) {
      alert("Marka adı zorunlu.");
      return;
    }

    setSavingBrand(true);
    setError("");
    setMessage("");

    if (editingBrandId) {
      const { data, error: updateError } = await supabase
        .from("retread_brands")
        .update({ name: brandName.trim() })
        .eq("id", editingBrandId)
        .select("id, name")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSavingBrand(false);
        return;
      }

      setBrands((prev) => sortByName(prev.map((brand) => (brand.id === editingBrandId ? (data as RetreadBrand) : brand))));
      setMessage("Kaplama markası güncellendi.");
      resetBrandForm();
      setSavingBrand(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("retread_brands")
      .insert({ name: brandName.trim() })
      .select("id, name")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingBrand(false);
      return;
    }

    setBrands((prev) => sortByName([...(prev || []), data as RetreadBrand]));
    setMessage("Kaplama markası eklendi.");
    resetBrandForm();
    setSavingBrand(false);
  }

  async function savePattern() {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!patternBrandId) {
      alert("Desen için marka seç.");
      return;
    }

    if (!patternName.trim()) {
      alert("Desen adı zorunlu.");
      return;
    }

    setSavingPattern(true);
    setError("");
    setMessage("");

    const payload = {
      brand_id: Number(patternBrandId),
      name: patternName.trim(),
    };

    if (editingPatternId) {
      const { data, error: updateError } = await supabase
        .from("tread_patterns")
        .update(payload)
        .eq("id", editingPatternId)
        .select("id, brand_id, name")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSavingPattern(false);
        return;
      }

      setPatterns((prev) =>
        sortByName(prev.map((pattern) => (pattern.id === editingPatternId ? (data as TreadPattern) : pattern)))
      );
      setMessage("Kaplama deseni güncellendi.");
      resetPatternForm();
      setSavingPattern(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tread_patterns")
      .insert(payload)
      .select("id, brand_id, name")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingPattern(false);
      return;
    }

    setPatterns((prev) => sortByName([...(prev || []), data as TreadPattern]));
    setMessage("Kaplama deseni eklendi.");
    resetPatternForm();
    setSavingPattern(false);
  }

  async function deleteBrand(brand: RetreadBrand) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!window.confirm(`Kaplama markası silinsin mi? ${brand.name}`)) {
      return;
    }

    setDeletingBrandId(brand.id);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("retread_brands").delete().eq("id", brand.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingBrandId(null);
      return;
    }

    setBrands((prev) => prev.filter((item) => item.id !== brand.id));
    setPatterns((prev) => prev.filter((item) => item.brand_id !== brand.id));
    if (editingBrandId === brand.id) resetBrandForm();
    setMessage("Kaplama markası silindi.");
    setDeletingBrandId(null);
  }

  async function deletePattern(pattern: TreadPattern) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!window.confirm(`Kaplama deseni silinsin mi? ${pattern.name}`)) {
      return;
    }

    setDeletingPatternId(pattern.id);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("tread_patterns").delete().eq("id", pattern.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingPatternId(null);
      return;
    }

    setPatterns((prev) => prev.filter((item) => item.id !== pattern.id));
    if (editingPatternId === pattern.id) resetPatternForm();
    setMessage("Kaplama deseni silindi.");
    setDeletingPatternId(null);
  }

  return (
    <main className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kaplama Marka ve Desenleri</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kaplama markalarını ve bu markalara bağlı desenleri adminden yönet.
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {brands.length} marka, {patterns.length} desen
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Kaplama Markaları" description="Yeni marka ekle, mevcut kaydı düzenle veya sil.">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <FormInput
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="Marka adı"
              disabled={!canEditMasterData || savingBrand}
            />
            <ActionButton onClick={saveBrand} disabled={!canEditMasterData || savingBrand}>
              {editingBrandId ? "Güncelle" : "Ekle"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={resetBrandForm}
              disabled={(!editingBrandId && !brandName) || savingBrand}
            >
              Temizle
            </ActionButton>
          </div>

          <div className="mt-4">
            <FormInput
              value={brandSearch}
              onChange={(event) => setBrandSearch(event.target.value)}
              placeholder="Marka ara"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Marka</th>
                  <th className="px-4 py-3 font-medium">Desen</th>
                  <th className="px-4 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Yükleniyor...
                    </td>
                  </tr>
                ) : filteredBrands.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredBrands.map((brand) => {
                    const patternCount = patterns.filter((pattern) => pattern.brand_id === brand.id).length;

                    return (
                      <tr key={brand.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{brand.name}</td>
                        <td className="px-4 py-3 text-slate-600">{patternCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <ActionButton variant="secondary" onClick={() => startEditBrand(brand)}>
                              Düzenle
                            </ActionButton>
                            <ActionButton
                              variant="danger"
                              onClick={() => deleteBrand(brand)}
                              disabled={deletingBrandId === brand.id}
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

        <SectionCard title="Kaplama Desenleri" description="Desenler marka bazlı tutulur; istersen sadece tek markayı filtreleyebilirsin.">
          <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)_auto_auto]">
            <FormSelect
              value={patternBrandId}
              onChange={(event) => setPatternBrandId(event.target.value)}
              disabled={!canEditMasterData || savingPattern}
            >
              <option value="">Marka seç</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </FormSelect>
            <FormInput
              value={patternName}
              onChange={(event) => setPatternName(event.target.value)}
              placeholder="Desen adı"
              disabled={!canEditMasterData || savingPattern}
            />
            <ActionButton onClick={savePattern} disabled={!canEditMasterData || savingPattern}>
              {editingPatternId ? "Güncelle" : "Ekle"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={resetPatternForm}
              disabled={(!editingPatternId && !patternName && !patternBrandId) || savingPattern}
            >
              Temizle
            </ActionButton>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
            <FormSelect value={patternFilterBrandId} onChange={(event) => setPatternFilterBrandId(event.target.value)}>
              <option value="all">Tüm markalar</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </FormSelect>
            <FormInput
              value={patternSearch}
              onChange={(event) => setPatternSearch(event.target.value)}
              placeholder="Desen veya marka ara"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Desen</th>
                  <th className="px-4 py-3 font-medium">Marka</th>
                  <th className="px-4 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Yükleniyor...
                    </td>
                  </tr>
                ) : filteredPatterns.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredPatterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{pattern.name}</td>
                      <td className="px-4 py-3 text-slate-600">{brandMap.get(pattern.brand_id) || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <ActionButton variant="secondary" onClick={() => startEditPattern(pattern)}>
                            Düzenle
                          </ActionButton>
                          <ActionButton
                            variant="danger"
                            onClick={() => deletePattern(pattern)}
                            disabled={deletingPatternId === pattern.id}
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