"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";

type Receipt = {
  id: number;
  receipt_no: string;
  customer_id: number;
  delivered_by: string | null;
  payment_type: string | null;
  payment_due_date: string | null;
  total_sale_price: number | null;
  description: string | null;
  doorstep_delivery: boolean | null;
  collection_date: string | null;
  created_at?: string | null;
};

type Customer = {
  id: number;
  name: string;
  region: string | null;
  salesperson: string | null;
};

type Tyre = {
  id: number;
  collection_receipt_id: number | null;
  serial_no: string;
  collection_type: string | null;
  tyre_type: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  status: string;
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

export default function AllReceiptsPage() {
  return (
    <PermissionGuard
      permission="collections.view"
      title="Toplu Alım Fişleri sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AllReceiptsPageContent />
    </PermissionGuard>
  );
}

function AllReceiptsPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);

  const [searchText, setSearchText] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<number[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [receiptsRes, customersRes, tyresRes] = await Promise.all([
        supabase
          .from("collection_receipts")
          .select(`
            id,
            receipt_no,
            customer_id,
            delivered_by,
            payment_type,
            payment_due_date,
            total_sale_price,
            description,
            doorstep_delivery,
            collection_date,
            created_at
          `)
          .order("id", { ascending: false }),

        supabase
          .from("customers")
          .select("id, name, region, salesperson")
          .order("name"),

        supabase
          .from("tyres")
          .select(`
            id,
            collection_receipt_id,
            serial_no,
            collection_type,
            tyre_type,
            size,
            sale_price,
            original_brand,
            original_pattern,
            status
          `)
          .order("id", { ascending: true }),
      ]);

      const firstError = [
        receiptsRes.error,
        customersRes.error,
        tyresRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("All receipts load error:", firstError.message, {
          receiptsRes,
          customersRes,
          tyresRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setReceipts((receiptsRes.data || []) as Receipt[]);
      setCustomers((customersRes.data || []) as Customer[]);
      setTyres((tyresRes.data || []) as Tyre[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]));
  }, [customers]);

  const tyresByReceipt = useMemo(() => {
    const map = new Map<number, Tyre[]>();

    for (const tyre of tyres) {
      if (!tyre.collection_receipt_id) continue;

      if (!map.has(tyre.collection_receipt_id)) {
        map.set(tyre.collection_receipt_id, []);
      }

      map.get(tyre.collection_receipt_id)!.push(tyre);
    }

    return map;
  }, [tyres]);

  const paymentTypeOptions = useMemo(() => {
    return Array.from(
      new Set(receipts.map((x) => x.payment_type || "").filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [receipts]);

  const regionOptions = useMemo(() => {
    return Array.from(
      new Set(customers.map((x) => x.region || "").filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [customers]);

  const salespersonOptions = useMemo(() => {
    return Array.from(
      new Set(customers.map((x) => x.salesperson || "").filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [customers]);

  const filteredReceipts = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return receipts.filter((receipt) => {
      const customer = customerMap.get(receipt.customer_id);

      if (customerFilter !== "all" && String(receipt.customer_id) !== customerFilter) {
        return false;
      }

      if (
        paymentTypeFilter !== "all" &&
        (receipt.payment_type || "") !== paymentTypeFilter
      ) {
        return false;
      }

      if (regionFilter !== "all" && (customer?.region || "") !== regionFilter) {
        return false;
      }

      if (
        salespersonFilter !== "all" &&
        (customer?.salesperson || "") !== salespersonFilter
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        receipt.receipt_no,
        customer?.name || "",
        customer?.region || "",
        customer?.salesperson || "",
        receipt.delivered_by || "",
        receipt.payment_type || "",
        receipt.description || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    receipts,
    searchText,
    customerFilter,
    paymentTypeFilter,
    regionFilter,
    salespersonFilter,
    customerMap,
  ]);

  const totalReceiptCount = filteredReceipts.length;

  const totalTyreCount = useMemo(() => {
    return filteredReceipts.reduce((sum, receipt) => {
      return sum + (tyresByReceipt.get(receipt.id)?.length || 0);
    }, 0);
  }, [filteredReceipts, tyresByReceipt]);

  const totalAmount = useMemo(() => {
    return filteredReceipts.reduce(
      (sum, receipt) => sum + Number(receipt.total_sale_price || 0),
      0
    );
  }, [filteredReceipts]);

  function toggleExpanded(receiptId: number) {
    setExpandedReceiptIds((prev) =>
      prev.includes(receiptId)
        ? prev.filter((id) => id !== receiptId)
        : [...prev, receiptId]
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Toplu Alım Fişleri</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sistemde kayıtlı tüm toplu alım fişlerini görüntüleyebilirsin.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Fiş Adedi" value={String(totalReceiptCount)} />
        <SummaryCard title="Toplam Lastik" value={String(totalTyreCount)} />
        <SummaryCard title="Toplam Tutar" value={`${formatMoney(totalAmount)} TL`} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_220px_220px]">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Fiş no, müşteri, bölge, plasiyer veya açıklama ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

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

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">Tüm Bölgeler</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
          >
            <option value="all">Tüm Plasiyerler</option>
            {salespersonOptions.map((salesperson) => (
              <option key={salesperson} value={salesperson}>
                {salesperson}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
          >
            <option value="all">Tüm Ödeme Tipleri</option>
            {paymentTypeOptions.map((paymentType) => (
              <option key={paymentType} value={paymentType}>
                {paymentType}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {filteredReceipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Kayıt bulunamadı.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReceipts.map((receipt) => {
              const receiptTyres = tyresByReceipt.get(receipt.id) || [];
              const expanded = expandedReceiptIds.includes(receipt.id);
              const customer = customerMap.get(receipt.customer_id);

              return (
                <div
                  key={receipt.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(receipt.id)}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        {expanded ? "−" : "+"}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="text-base font-semibold text-slate-900">
                            {receipt.receipt_no}
                          </div>
                          <div className="text-sm text-slate-600">
                            {customer?.name || "-"}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                          <InlineMeta
                            label="Bölge"
                            value={customer?.region || "-"}
                          />
                          <InlineMeta
                            label="Plasiyer"
                            value={customer?.salesperson || "-"}
                          />
                          <InlineMeta
                            label="Tarih"
                            value={formatDate(receipt.collection_date || receipt.created_at)}
                          />
                          <InlineMeta
                            label="Teslim Eden"
                            value={receipt.delivered_by || "-"}
                          />
                          <InlineMeta
                            label="Ödeme Tipi"
                            value={receipt.payment_type || "-"}
                          />
                          <InlineMeta
                            label="Ödeme Vadesi"
                            value={
                              receipt.payment_due_date
                                ? formatDate(receipt.payment_due_date)
                                : "-"
                            }
                          />
                          <InlineMeta
                            label="Toplam Lastik"
                            value={String(receiptTyres.length)}
                          />
                          <InlineMeta
                            label="Toplam Tutar"
                            value={`${formatMoney(receipt.total_sale_price)} TL`}
                          />
                        </div>

                        {receipt.description ? (
                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            Açıklama: {receipt.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/40">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1200px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Talep Edilen İşlem</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Tür</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Fiyat</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptTyres.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="p-6 text-center text-sm text-slate-500"
                                >
                                  Bu fişte lastik bulunamadı.
                                </td>
                              </tr>
                            ) : (
                              receiptTyres.map((tyre) => (
                                <tr key={tyre.id} className="border-b border-slate-100 bg-white">
                                  <td className="p-3 text-sm font-medium text-slate-900">
                                    {tyre.serial_no}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.collection_type || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.tyre_type || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.size || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {formatMoney(tyre.sale_price)} TL
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.original_brand || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.original_pattern || "-"}
                                  </td>
                                  <td className="p-3 text-sm">
                                    <StatusBadge status={tyre.status} />
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
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

function InlineMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-[92px] text-xs text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
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
    allocated_to_shipment: "bg-indigo-100 text-indigo-700",
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}