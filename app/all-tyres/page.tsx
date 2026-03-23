"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";

type Tyre = {
  id: number;
  customer_id: number | null;
  collection_receipt_id: number | null;
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [tyresRes, customersRes, receiptsRes, retreadBrandsRes, treadPatternsRes] =
        await Promise.all([
          supabase
            .from("tyres")
            .select(`
              id,
              customer_id,
              collection_receipt_id,
              serial_no,
              collection_type,
              tyre_type,
              size,
              sale_price,
              original_brand,
              original_pattern,
              retread_brand_id,
              tread_pattern_id,
              status,
              created_at,
              factory_arrived_at,
              produced_at,
              shipped_at
            `)
            .order("id", { ascending: false }),

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

  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c.name]));
  }, [customers]);

  const receiptMap = useMemo(() => {
    return new Map(receipts.map((r) => [r.id, r.receipt_no]));
  }, [receipts]);

  const retreadBrandMap = useMemo(() => {
    return new Map(retreadBrands.map((b) => [b.id, b.name]));
  }, [retreadBrands]);

  const treadPatternMap = useMemo(() => {
    return new Map(treadPatterns.map((p) => [p.id, p.name]));
  }, [treadPatterns]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(tyres.map((x) => x.status).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, [tyres]);

  const filteredTyres = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return tyres.filter((tyre) => {
      if (statusFilter !== "all" && tyre.status !== statusFilter) {
        return false;
      }

      if (customerFilter !== "all" && String(tyre.customer_id || "") !== customerFilter) {
        return false;
      }

      if (!q) return true;

      const customerName = tyre.customer_id
        ? customerMap.get(tyre.customer_id) || ""
        : "";

      const receiptNo = tyre.collection_receipt_id
        ? receiptMap.get(tyre.collection_receipt_id) || ""
        : "";

      const retreadBrandName = tyre.retread_brand_id
        ? retreadBrandMap.get(tyre.retread_brand_id) || ""
        : "";

      const treadPatternName = tyre.tread_pattern_id
        ? treadPatternMap.get(tyre.tread_pattern_id) || ""
        : "";

      const haystack = [
        tyre.serial_no,
        receiptNo,
        customerName,
        tyre.collection_type || "",
        tyre.tyre_type || "",
        tyre.size || "",
        tyre.original_brand || "",
        tyre.original_pattern || "",
        retreadBrandName,
        treadPatternName,
        tyre.status || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    tyres,
    searchText,
    statusFilter,
    customerFilter,
    customerMap,
    receiptMap,
    retreadBrandMap,
    treadPatternMap,
  ]);

  const totalCount = filteredTyres.length;

  const totalAmount = useMemo(() => {
    return filteredTyres.reduce((sum, tyre) => sum + Number(tyre.sale_price || 0), 0);
  }, [filteredTyres]);

  const statusSummary = useMemo(() => {
    const map = new Map<string, number>();

    filteredTyres.forEach((tyre) => {
      map.set(tyre.status, (map.get(tyre.status) || 0) + 1);
    });

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [filteredTyres]);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-4 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Tüm Lastikler</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sistemde kayıtlı tüm lastikleri tek ekrandan izleyebilirsin.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Toplam Lastik" value={String(totalCount)} />
        <SummaryCard title="Toplam Tutar" value={`${formatMoney(totalAmount)} TL`} />
        <SummaryCard
          title="Farklı Durum"
          value={String(new Set(filteredTyres.map((x) => x.status)).size)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_240px]">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Seri no, fiş no, müşteri, ebat, marka, desen ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tüm Durumlar</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="all">Tüm Müşteriler</option>
            {customers.map((customer) => (
              <option key={customer.id} value={String(customer.id)}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {statusSummary.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {statusSummary.map(([status, count]) => (
              <span
                key={status}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1800px] w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Fiş No</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Müşteri</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Talep Edilen İşlem</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Tür</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Fiyat</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Marka</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Desen</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Marka</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Desen</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Durum</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Toplama</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Fabrika Giriş</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Üretim</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Sevk</th>
            </tr>
          </thead>

          <tbody>
            {filteredTyres.length === 0 ? (
              <tr>
                <td colSpan={16} className="p-8 text-center text-sm text-slate-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              filteredTyres.map((tyre) => (
                <tr key={tyre.id} className="border-b border-slate-100 bg-white">
                  <td className="p-3 text-sm font-medium text-slate-900">
                    {tyre.serial_no}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.collection_receipt_id
                      ? receiptMap.get(tyre.collection_receipt_id) || "-"
                      : "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.customer_id ? customerMap.get(tyre.customer_id) || "-" : "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.collection_type || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.tyre_type || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">{tyre.size || "-"}</td>
                  <td className="p-3 text-sm text-slate-700">
                    {formatMoney(tyre.sale_price)} TL
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.original_brand || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.original_pattern || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.retread_brand_id
                      ? retreadBrandMap.get(tyre.retread_brand_id) || "-"
                      : "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {tyre.tread_pattern_id
                      ? treadPatternMap.get(tyre.tread_pattern_id) || "-"
                      : "-"}
                  </td>
                  <td className="p-3 text-sm">
                    <StatusBadge status={tyre.status} />
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {formatDate(tyre.created_at)}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {formatDate(tyre.factory_arrived_at)}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {formatDate(tyre.produced_at)}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {formatDate(tyre.shipped_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
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
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}