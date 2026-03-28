"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import MultiSelect from "@/src/components/MultiSelect";
import { formatTyreStatus } from "@/src/lib/formatters";

type Tyre = {
  id: number;
  customer_id: number | null;
  collection_receipt_id: number | null;
  tyre_code: string | null;
  serial_no: string;
  collection_type: string | null;
  tyre_type: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  retread_brand_id: number | null;
  tread_pattern_id: number | null;
  status: string;
  created_at: string | null;
  factory_arrived_at: string | null;
  produced_at: string | null;
  shipped_at: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

type Customer = {
  id: number;
  name: string;
};

type Receipt = {
  id: number;
  receipt_no: string;
};

type RetreadBrand = {
  id: number;
  name: string;
};

type TreadPattern = {
  id: number;
  brand_id: number;
  name: string;
};

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("tr-TR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    collected: "bg-slate-100 text-slate-700",
    factory_received: "bg-sky-100 text-sky-700",
    approved_for_production: "bg-indigo-100 text-indigo-700",
    in_production: "bg-amber-100 text-amber-700",
    stocked: "bg-emerald-100 text-emerald-700",
    shipped: "bg-violet-100 text-violet-700",
    rejected: "bg-rose-100 text-rose-700",
    allocated_to_shipment: "bg-indigo-100 text-indigo-700",
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}
      title={formatTyreStatus(status)}
    >
      {formatTyreStatus(status)}
    </span>
  );
}

function GridHeaderCell({ label }: { label: string }) {
  return (
    <div
      className="truncate px-2 py-2 text-[11px] font-semibold text-slate-600"
      title={label}
    >
      {label}
    </div>
  );
}

function GridCell({
  value,
  title,
  strong = false,
}: {
  value: string;
  title?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`truncate px-2 py-1.5 text-[11px] leading-5 ${
        strong ? "font-medium text-slate-900" : "text-slate-700"
      }`}
      title={title || value}
    >
      {value}
    </div>
  );
}

const GRID_COLUMNS =
  "92px 120px 1fr 90px 100px 200px 200px 100px 125px";

export default function AllTyresPage() {
  return (
    <PermissionGuard
      permission="collections.view"
      title="Tüm Lastikler sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AllTyresPageContent />
    </PermissionGuard>
  );
}

function AllTyresPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [collectionTypeFilter, setCollectionTypeFilter] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [originalBrandFilter, setOriginalBrandFilter] = useState<string[]>([]);
  const [originalPatternFilter, setOriginalPatternFilter] = useState<string[]>([]);
  const [retreadBrandFilter, setRetreadBrandFilter] = useState<string[]>([]);
  const [treadPatternFilter, setTreadPatternFilter] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTyre, setSelectedTyre] = useState<Tyre | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [tyresRes, customersRes, receiptsRes, retreadBrandsRes, treadPatternsRes] =
        await Promise.all([
          supabase
            .from("tyres")
            .select("*")
            .order("id", { ascending: false })
            .limit(10000),

          supabase.from("customers").select("id, name").order("name"),

          supabase.from("collection_receipts").select("id, receipt_no"),

          supabase.from("retread_brands").select("id, name").order("name"),

          supabase
            .from("tread_patterns")
            .select("id, brand_id, name")
            .order("name"),
        ]);

      const firstError = [
        tyresRes.error,
        customersRes.error,
        receiptsRes.error,
        retreadBrandsRes.error,
        treadPatternsRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("All tyres load error:", firstError.message, {
          tyresRes,
          customersRes,
          receiptsRes,
          retreadBrandsRes,
          treadPatternsRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setTyres((tyresRes.data || []) as Tyre[]);
      setCustomers((customersRes.data || []) as Customer[]);
      setReceipts((receiptsRes.data || []) as Receipt[]);
      setRetreadBrands((retreadBrandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((treadPatternsRes.data || []) as TreadPattern[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const receiptMap = useMemo(
    () => new Map(receipts.map((r) => [r.id, r.receipt_no])),
    [receipts]
  );

  const retreadBrandMap = useMemo(
    () => new Map(retreadBrands.map((b) => [b.id, b.name])),
    [retreadBrands]
  );

  const treadPatternMap = useMemo(
    () => new Map(treadPatterns.map((p) => [p.id, p.name])),
    [treadPatterns]
  );

  const statusOptions = useMemo(() => {
    return Array.from(new Set(tyres.map((x) => x.status).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: formatTyreStatus(x) }));
  }, [tyres]);

  const customerOptions = useMemo(() => {
    return customers.map((customer) => ({
      value: String(customer.id),
      label: customer.name,
    }));
  }, [customers]);

  const collectionTypeOptions = useMemo(() => {
    return Array.from(new Set(tyres.map((x) => x.collection_type).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: x }));
  }, [tyres]);

  const sizeOptions = useMemo(() => {
    return Array.from(new Set(tyres.map((x) => x.size).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map((x) => ({ value: x, label: x }));
  }, [tyres]);

  const originalBrandOptions = useMemo(() => {
    return Array.from(new Set(tyres.map((x) => x.original_brand).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: x }));
  }, [tyres]);

  const originalPatternOptions = useMemo(() => {
    return Array.from(new Set(tyres.map((x) => x.original_pattern).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: x }));
  }, [tyres]);

  const retreadBrandOptions = useMemo(() => {
    return retreadBrands.map((brand) => ({
      value: String(brand.id),
      label: brand.name,
    }));
  }, [retreadBrands]);

  const treadPatternOptions = useMemo(() => {
    if (retreadBrandFilter.length === 0) {
      return treadPatterns.map((pattern) => ({
        value: String(pattern.id),
        label: pattern.name,
      }));
    }

    const selectedBrandIds = retreadBrandFilter.map((id) => parseInt(id));
    return treadPatterns
      .filter((pattern) => selectedBrandIds.includes(pattern.brand_id))
      .map((pattern) => ({
        value: String(pattern.id),
        label: pattern.name,
      }));
  }, [treadPatterns, retreadBrandFilter]);

  const [filteredTyres, setFilteredTyres] = useState<Tyre[]>([]);

  useEffect(() => {
    setFilteredTyres(tyres);
  }, [tyres]);

  function handleFilter() {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");
    const result = tyres.filter((tyre) => {
      if (statusFilter.length > 0 && !statusFilter.includes(tyre.status)) return false;
      if (customerFilter.length > 0 && !customerFilter.includes(String(tyre.customer_id || ""))) return false;
      if (collectionTypeFilter.length > 0 && !collectionTypeFilter.includes(tyre.collection_type || "")) return false;
      if (sizeFilter.length > 0 && !sizeFilter.includes(tyre.size || "")) return false;
      if (originalBrandFilter.length > 0 && !originalBrandFilter.includes(tyre.original_brand || "")) return false;
      if (originalPatternFilter.length > 0 && !originalPatternFilter.includes(tyre.original_pattern || "")) return false;
      if (retreadBrandFilter.length > 0 && !retreadBrandFilter.includes(String(tyre.retread_brand_id || ""))) return false;
      if (treadPatternFilter.length > 0 && !treadPatternFilter.includes(String(tyre.tread_pattern_id || ""))) return false;

      if (!q) return true;

      const customerName = tyre.customer_id ? customerMap.get(tyre.customer_id) || "" : "";
      const receiptNo = tyre.collection_receipt_id ? receiptMap.get(tyre.collection_receipt_id) || "" : "";
      const retreadBrandName = tyre.retread_brand_id ? retreadBrandMap.get(tyre.retread_brand_id) || "" : "";
      const treadPatternName = tyre.tread_pattern_id ? treadPatternMap.get(tyre.tread_pattern_id) || "" : "";

      const haystack = [
        tyre.tyre_code || "", tyre.serial_no, receiptNo, customerName,
        tyre.collection_type || "", tyre.tyre_type || "", tyre.size || "",
        tyre.original_brand || "", tyre.original_pattern || "",
        retreadBrandName, treadPatternName, tyre.status || "",
      ].join(" ").toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
    setFilteredTyres(result);
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredTyres.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paginatedTyres = filteredTyres.slice(pageStart, pageEnd);

  const maxVisiblePageButtons = 6;
  const pageButtonStart = Math.max(
    1,
    Math.min(currentPage - Math.floor(maxVisiblePageButtons / 2), totalPages - maxVisiblePageButtons + 1)
  );
  const pageButtonEnd = Math.min(totalPages, pageButtonStart + maxVisiblePageButtons - 1);
  const visiblePageNumbers = Array.from(
    { length: pageButtonEnd - pageButtonStart + 1 },
    (_, i) => pageButtonStart + i
  );

  async function exportToExcel() {
    const XLSX = await import("xlsx");

    const rows = filteredTyres.map((tyre) => {
      const customerName = tyre.customer_id
        ? customerMap.get(tyre.customer_id) || "-"
        : "-";
      const receiptNo = tyre.collection_receipt_id
        ? receiptMap.get(tyre.collection_receipt_id) || "-"
        : "-";
      const retreadBrandName = tyre.retread_brand_id
        ? retreadBrandMap.get(tyre.retread_brand_id) || "-"
        : "-";
      const treadPatternName = tyre.tread_pattern_id
        ? treadPatternMap.get(tyre.tread_pattern_id) || "-"
        : "-";

      const exportRow: Record<string, string | number | boolean | null> = {
        Kod: tyre.tyre_code || "-",
        "Seri No": tyre.serial_no || "-",
        Müşteri: customerName,
        "Karkas Form No": receiptNo,
        Talep: tyre.collection_type || "-",
        "Lastik Türü": tyre.tyre_type || "-",
        Ebat: tyre.size || "-",
        "Orijinal Marka": tyre.original_brand || "-",
        "Orijinal Desen": tyre.original_pattern || "-",
        "Kaplama Marka": retreadBrandName,
        "Kaplama Desen": treadPatternName,
        "Satış Fiyatı": Number(tyre.sale_price || 0),
        Durum: formatTyreStatus(tyre.status),
        "Durum Kodu": tyre.status || "-",
        "Toplama Tarihi": formatDate(tyre.created_at),
        "Fabrika Giriş Tarihi": formatDate(tyre.factory_arrived_at),
        "Üretim Tarihi": formatDate(tyre.produced_at),
        "Sevkiyat Tarihi": formatDate(tyre.shipped_at),
      };

      return exportRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tum Lastikler");

    const dateLabel = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `tum-lastikler-${dateLabel}.xlsx`);
  }

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-3 p-4">
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Tüm Lastikler</h1>
        <p className="mt-1 text-xs text-slate-600">
          Sistemde kayıtlı tüm lastikler.
        </p>
      </section>


      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="space-y-4">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
            >
              <div className="min-w-0">
                <label className="filter-label">
                  Arama
                </label>
                <input
                  className="filter-control"
                  placeholder="Lastik kodu, seri no, fiş no, müşteri..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleFilter(); }}
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Durum
                </label>
                <MultiSelect
                  options={statusOptions}
                  values={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Müşteri
                </label>
                <MultiSelect
                  options={customerOptions}
                  values={customerFilter}
                  onChange={setCustomerFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Talep
                </label>
                <MultiSelect
                  options={collectionTypeOptions}
                  values={collectionTypeFilter}
                  onChange={setCollectionTypeFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Ebat
                </label>
                <MultiSelect
                  options={sizeOptions}
                  values={sizeFilter}
                  onChange={setSizeFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label
                  className="filter-label-hidden"
                  aria-hidden="true"
                >
                  Buton
                </label>
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="filter-button-success"
                >
                  Excele Aktar
                </button>
              </div>
            </div>

            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
            >
              <div className="min-w-0">
                <label className="filter-label">
                  Orijinal Marka
                </label>
                <MultiSelect
                  options={originalBrandOptions}
                  values={originalBrandFilter}
                  onChange={setOriginalBrandFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Orijinal Desen
                </label>
                <MultiSelect
                  options={originalPatternOptions}
                  values={originalPatternFilter}
                  onChange={setOriginalPatternFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Kaplama Marka
                </label>
                <MultiSelect
                  options={retreadBrandOptions}
                  values={retreadBrandFilter}
                  onChange={setRetreadBrandFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label">
                  Kaplama Desen
                </label>
                <MultiSelect
                  options={treadPatternOptions}
                  values={treadPatternFilter}
                  onChange={setTreadPatternFilter}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="min-w-0">
                <label className="filter-label-hidden" aria-hidden="true">
                  Buton
                </label>
                <button
                  type="button"
                  onClick={handleFilter}
                  className="filter-button-primary"
                >
                  Filtrele
                </button>
              </div>

              <div className="min-w-0">
                <label className="filter-label-hidden" aria-hidden="true">
                  Buton
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setStatusFilter([]);
                    setCustomerFilter([]);
                    setCollectionTypeFilter([]);
                    setSizeFilter([]);
                    setOriginalBrandFilter([]);
                    setOriginalPatternFilter([]);
                    setRetreadBrandFilter([]);
                    setTreadPatternFilter([]);
                    setFilteredTyres(tyres);
                    setCurrentPage(1);
                  }}
                  className="filter-button-danger"
                >
                  Temizle
                </button>
              </div>
            </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[1280px]">
            <div
              className="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-50"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <GridHeaderCell label="Kod" />
              <GridHeaderCell label="Seri No" />
              <GridHeaderCell label="Müşteri" />
              <GridHeaderCell label="Talep" />
              <GridHeaderCell label="Ebat" />
              <GridHeaderCell label="Orijinal Marka-Desen" />
              <GridHeaderCell label="Kaplama Marka-Desen" />
              <GridHeaderCell label="Fiyat" />
              <GridHeaderCell label="Durum" />

            </div>

            {filteredTyres.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Kayıt bulunamadı.
              </div>
            ) : (
              paginatedTyres.map((tyre) => {
                const customerName = tyre.customer_id
                  ? customerMap.get(tyre.customer_id) || "-"
                  : "-";

                const retreadBrandName = tyre.retread_brand_id
                  ? retreadBrandMap.get(tyre.retread_brand_id) || "-"
                  : "-";

                const treadPatternName = tyre.tread_pattern_id
                  ? treadPatternMap.get(tyre.tread_pattern_id) || "-"
                  : "-";

                return (
                  <div
                    key={tyre.id}
                    className="grid border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition hover:bg-slate-100"
                    style={{ gridTemplateColumns: GRID_COLUMNS }}
                    onClick={() => setSelectedTyre(tyre)}
                  >
                    <GridCell value={tyre.tyre_code || "-"} strong />
                    <GridCell value={tyre.serial_no} strong />
                    <GridCell value={customerName} />
                    <GridCell value={tyre.collection_type || "-"} />
                    <GridCell value={tyre.size || "-"} />
                    <GridCell value={`${tyre.original_brand || "-"} - ${tyre.original_pattern || "-"}`} />
                    <GridCell value={`${retreadBrandName} - ${treadPatternName}`} />
                    <GridCell value={`${formatMoney(tyre.sale_price)} TL`} />
                    <div className="flex items-center px-2 py-1.5">
                      <StatusBadge status={tyre.status} />
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          {/* Sol: kayıt / sayfa */}
          <div className="flex flex-1 items-center gap-2 text-xs text-slate-500">
            <span>Toplam kayıt sayısı: <strong className="text-slate-700">{filteredTyres.length}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Sayfada:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Orta: sayfa butonları */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹
            </button>

            {visiblePageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition"
                style={
                  page === currentPage
                    ? { background: "#2563eb", borderColor: "#2563eb", color: "#ffffff" }
                    : { background: "#ffffff", borderColor: "#e2e8f0", color: "#334155" }
                }
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              »
            </button>
          </div>

          {/* Sağ: denge alanı */}
          <div className="flex flex-1 justify-end text-xs text-slate-400">
            {currentPage} / {totalPages}
          </div>
        </div>
      </section>

      {selectedTyre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Lastik Detayları</h2>
              <button
                onClick={() => setSelectedTyre(null)}
                className="text-2xl text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Kod</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedTyre.tyre_code || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Seri No</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedTyre.serial_no}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Müşteri</p>
                  <p className="text-sm text-slate-900">
                    {selectedTyre.customer_id
                      ? customerMap.get(selectedTyre.customer_id) || "-"
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Talep Türü</p>
                  <p className="text-sm text-slate-900">{selectedTyre.collection_type || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Lastik Türü</p>
                  <p className="text-sm text-slate-900">{selectedTyre.tyre_type || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Ebat</p>
                  <p className="text-sm text-slate-900">{selectedTyre.size || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Orijinal Marka</p>
                  <p className="text-sm text-slate-900">{selectedTyre.original_brand || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Orijinal Desen</p>
                  <p className="text-sm text-slate-900">{selectedTyre.original_pattern || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Kaplama Marka</p>
                  <p className="text-sm text-slate-900">
                    {selectedTyre.retread_brand_id
                      ? retreadBrandMap.get(selectedTyre.retread_brand_id) || "-"
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Kaplama Desen</p>
                  <p className="text-sm text-slate-900">
                    {selectedTyre.tread_pattern_id
                      ? treadPatternMap.get(selectedTyre.tread_pattern_id) || "-"
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Satış Fiyatı</p>
                  <p className="text-sm font-semibold text-slate-900">{formatMoney(selectedTyre.sale_price)} TL</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Durum</p>
                  <p className="text-sm text-slate-900">
                    <StatusBadge status={selectedTyre.status} />
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Toplama Tarihi</p>
                  <p className="text-sm text-slate-900">{formatDate(selectedTyre.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Fabrika Giriş</p>
                  <p className="text-sm text-slate-900">{formatDate(selectedTyre.factory_arrived_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Üretim Tarihi</p>
                  <p className="text-sm text-slate-900">{formatDate(selectedTyre.produced_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Sevkiyat Tarihi</p>
                  <p className="text-sm text-slate-900">{formatDate(selectedTyre.shipped_at)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedTyre(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}