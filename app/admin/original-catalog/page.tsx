"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type OriginalBrand = {
  id: number;
  name: string;
};

type OriginalPattern = {
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

export default function AdminOriginalCatalogPage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Orijinal marka ve desenlere erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminOriginalCatalogPageContent />
    </PermissionGuard>
  );
}

function AdminOriginalCatalogPageContent() {
  const { permissionState } = usePermissionState();
  const canEditMasterData = can(permissionState, "users.edit");

  const [loading, setLoading] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingPattern, setSavingPattern] = useState(false);
  const [importingPatterns, setImportingPatterns] = useState(false);
  const [deletingBrandId, setDeletingBrandId] = useState<number | null>(null);
  const [deletingPatternId, setDeletingPatternId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [brands, setBrands] = useState<OriginalBrand[]>([]);
  const [patterns, setPatterns] = useState<OriginalPattern[]>([]);

  const [brandSearch, setBrandSearch] = useState("");
  const [patternSearch, setPatternSearch] = useState("");
  const [patternFilterBrandId, setPatternFilterBrandId] = useState("all");

  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [brandName, setBrandName] = useState("");

  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);
  const [patternName, setPatternName] = useState("");
  const [patternBrandId, setPatternBrandId] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [brandsRes, patternsRes] = await Promise.all([
      supabase.from("original_brands").select("id, name").order("name"),
      supabase.from("original_pattern").select("id, brand_id, name").order("name"),
    ]);

    const firstError = [brandsRes.error, patternsRes.error].find(Boolean);
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setBrands(sortByName((brandsRes.data || []) as OriginalBrand[]));
    setPatterns(sortByName((patternsRes.data || []) as OriginalPattern[]));
    setLoading(false);
  }

  useEffect(() => {
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

  function startEditBrand(brand: OriginalBrand) {
    setEditingBrandId(brand.id);
    setBrandName(brand.name);
  }

  function startEditPattern(pattern: OriginalPattern) {
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
        .from("original_brands")
        .update({ name: brandName.trim() })
        .eq("id", editingBrandId)
        .select("id, name")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSavingBrand(false);
        return;
      }

      setBrands((prev) => sortByName(prev.map((brand) => (brand.id === editingBrandId ? (data as OriginalBrand) : brand))));
      setMessage("Orijinal marka güncellendi.");
      resetBrandForm();
      setSavingBrand(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("original_brands")
      .insert({ name: brandName.trim() })
      .select("id, name")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingBrand(false);
      return;
    }

    setBrands((prev) => sortByName([...(prev || []), data as OriginalBrand]));
    setMessage("Orijinal marka eklendi.");
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
        .from("original_pattern")
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
        sortByName(prev.map((pattern) => (pattern.id === editingPatternId ? (data as OriginalPattern) : pattern)))
      );
      setMessage("Orijinal desen güncellendi.");
      resetPatternForm();
      setSavingPattern(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("original_pattern")
      .insert(payload)
      .select("id, brand_id, name")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSavingPattern(false);
      return;
    }

    setPatterns((prev) => sortByName([...(prev || []), data as OriginalPattern]));
    setMessage("Orijinal desen eklendi.");
    resetPatternForm();
    setSavingPattern(false);
  }

  async function deleteBrand(brand: OriginalBrand) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!window.confirm(`Orijinal markası silinsin mi? ${brand.name}`)) {
      return;
    }

    setDeletingBrandId(brand.id);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("original_brands").delete().eq("id", brand.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingBrandId(null);
      return;
    }

    setBrands((prev) => prev.filter((item) => item.id !== brand.id));
    setPatterns((prev) => prev.filter((item) => item.brand_id !== brand.id));
    if (editingBrandId === brand.id) resetBrandForm();
    setMessage("Orijinal marka silindi.");
    setDeletingBrandId(null);
  }

  async function deletePattern(pattern: OriginalPattern) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!window.confirm(`Orijinal desen silinsin mi? ${pattern.name}`)) {
      return;
    }

    setDeletingPatternId(pattern.id);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.from("original_pattern").delete().eq("id", pattern.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingPatternId(null);
      return;
    }

    setPatterns((prev) => prev.filter((item) => item.id !== pattern.id));
    if (editingPatternId === pattern.id) resetPatternForm();
    setMessage("Orijinal desen silindi.");
    setDeletingPatternId(null);
  }

  function exportPatternsToExcel() {
    const rows = patterns.map((pattern) => ({
      id: pattern.id,
      marka: brandMap.get(pattern.brand_id) || "",
      desen: pattern.name,
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["id", "marka", "desen"],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OrijinalDesenler");
    XLSX.writeFile(wb, "orijinal-desenler.xlsx");
  }

  async function importPatternsFromExcel(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canEditMasterData) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setImportingPatterns(true);
    setError("");
    setMessage("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setError("Excel dosyasında sayfa bulunamadı.");
        return;
      }

      const ws = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
      });

      if (rawRows.length === 0) {
        setError("Excel dosyası boş.");
        return;
      }

      const brandLookup = new Map(
        brands.map((brand) => [brand.name.trim().toLocaleLowerCase("tr-TR"), brand])
      );

      const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
      const patternByBrandAndName = new Map(
        patterns.map((pattern) => {
          const brandName = (brandMap.get(pattern.brand_id) || "").trim().toLocaleLowerCase("tr-TR");
          const name = pattern.name.trim().toLocaleLowerCase("tr-TR");
          return [`${brandName}__${name}`, pattern];
        })
      );

      const inserts: Array<{ brand_id: number; name: string }> = [];
      const updates: Array<{ id: number; brand_id: number; name: string }> = [];
      const skipped: string[] = [];

      rawRows.forEach((row, index) => {
        const line = index + 2;
        const idText = String(row.id ?? "").trim();
        const brandNameRaw = String(row.marka ?? row.brand ?? "").trim();
        const patternName = String(row.desen ?? row.pattern ?? "").trim();

        if (!brandNameRaw && !patternName && !idText) {
          return;
        }

        if (!brandNameRaw || !patternName) {
          skipped.push(`Satır ${line}: Marka ve desen zorunlu.`);
          return;
        }

        const brand = brandLookup.get(brandNameRaw.toLocaleLowerCase("tr-TR"));
        if (!brand) {
          skipped.push(`Satır ${line}: Marka bulunamadı (${brandNameRaw}).`);
          return;
        }

        const key = `${brand.name.trim().toLocaleLowerCase("tr-TR")}__${patternName.toLocaleLowerCase("tr-TR")}`;
        const idValue = Number(idText);

        if (idText && Number.isFinite(idValue) && idValue > 0) {
          const existingById = patternById.get(idValue);
          if (!existingById) {
            skipped.push(`Satır ${line}: ID bulunamadı (${idText}).`);
            return;
          }

          updates.push({ id: idValue, brand_id: brand.id, name: patternName });
          return;
        }

        const existingByKey = patternByBrandAndName.get(key);
        if (existingByKey) {
          updates.push({ id: existingByKey.id, brand_id: brand.id, name: patternName });
          return;
        }

        inserts.push({ brand_id: brand.id, name: patternName });
      });

      if (inserts.length === 0 && updates.length === 0) {
        setError(skipped[0] || "İşlenecek geçerli satır bulunamadı.");
        return;
      }

      for (const item of updates) {
        const { error: updateError } = await supabase
          .from("original_pattern")
          .update({ brand_id: item.brand_id, name: item.name })
          .eq("id", item.id);

        if (updateError) {
          throw new Error(`Güncelleme hatası (ID ${item.id}): ${updateError.message}`);
        }
      }

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from("original_pattern").insert(inserts);
        if (insertError) {
          throw new Error(`Ekleme hatası: ${insertError.message}`);
        }
      }

      await loadData();

      const parts = [`${inserts.length} eklendi`, `${updates.length} güncellendi`];
      if (skipped.length > 0) {
        parts.push(`${skipped.length} atlandı`);
      }

      setMessage(`Excel içe aktarma tamamlandı: ${parts.join(", ")}.`);
      if (skipped.length > 0) {
        setError(skipped.slice(0, 5).join(" "));
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Excel içe aktarma başarısız oldu.";
      setError(text);
    } finally {
      setImportingPatterns(false);
      event.target.value = "";
    }
  }

  return (
    <main className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orijinal Marka ve Desenleri</h1>
          <p className="mt-1 text-sm text-slate-500">
            Toplama formundaki orijinal marka ve desen seçeneklerini tek yerden yönet.
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {brands.length} marka, {patterns.length} desen
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Orijinal Markalar" description="Yeni marka ekle, mevcut kaydı düzenle veya sil.">
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
            <FormInput value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} placeholder="Marka ara" />
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
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Yükleniyor...</td>
                  </tr>
                ) : filteredBrands.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
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

        <SectionCard title="Orijinal Desenleri" description="Desenler marka bazlı tutulur; istersen sadece tek markayı filtreleyebilirsin.">
          <div className="mb-4 flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              onClick={exportPatternsToExcel}
              disabled={loading || patterns.length === 0}
            >
              Excel Dışa Aktar
            </ActionButton>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={importPatternsFromExcel}
                disabled={!canEditMasterData || importingPatterns}
              />
              <span
                className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-medium transition ${
                  !canEditMasterData || importingPatterns
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-slate-900 text-white hover:bg-slate-700"
                }`}
              >
                {importingPatterns ? "İçe Aktarılıyor..." : "Excel İçe Aktar (Ekle/Güncelle)"}
              </span>
            </label>
          </div>

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
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Yükleniyor...</td>
                  </tr>
                ) : filteredPatterns.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
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