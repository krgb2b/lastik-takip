"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";
import { formatTyreStatus } from "@/src/lib/formatters";

type ShipmentReceipt = {
  id: number;
  shipment_no: string;
  customer_id: number;
  shipment_type: string;
  status: string;
  shipment_date: string | null;
  description: string | null;
  created_at: string;
};

type ShipmentReceiptItem = {
  id: number;
  shipment_receipt_id: number;
  tyre_id: number;
};

type Customer = NormalizedCustomer;

type Tyre = {
  id: number;
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

export default function ShipmentReceiptsPage() {
  return (
    <PermissionGuard
      permission="shipping.view"
      title="Sevk Fişleri sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <ShipmentReceiptsPageContent />
    </PermissionGuard>
  );
}

function ShipmentReceiptsPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [shipmentReceipts, setShipmentReceipts] = useState<ShipmentReceipt[]>([]);
  const [shipmentReceiptItems, setShipmentReceiptItems] = useState<ShipmentReceiptItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);

  const [searchText, setSearchText] = useState("");
  const [shipmentTypeFilter, setShipmentTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<number[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [
        shipmentReceiptsRes,
        shipmentReceiptItemsRes,
        customersRes,
        tyresRes,
        retreadBrandsRes,
        treadPatternsRes,
      ] = await Promise.all([
        supabase
          .from("shipment_receipts")
          .select(`
            id,
            shipment_no,
            customer_id,
            shipment_type,
            status,
            shipment_date,
            description,
            created_at
          `)
          .order("id", { ascending: false }),

        supabase
          .from("shipment_receipt_items")
          .select("id, shipment_receipt_id, tyre_id")
          .order("id", { ascending: true }),

        supabase.from("customers").select(CUSTOMER_WITH_RELATIONS_SELECT).order("name"),

        supabase
          .from("tyres")
          .select(`
            id,
            serial_no,
            collection_type,
            tyre_type,
            size,
            sale_price,
            original_brand,
            original_pattern,
            retread_brand_id,
            tread_pattern_id,
            status
          `),

        supabase.from("retread_brands").select("id, name").order("name"),

        supabase
          .from("tread_patterns")
          .select("id, brand_id, name")
          .order("name"),
      ]);

      const firstError = [
        shipmentReceiptsRes.error,
        shipmentReceiptItemsRes.error,
        customersRes.error,
        tyresRes.error,
        retreadBrandsRes.error,
        treadPatternsRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("Shipment receipts load error:", firstError.message, {
          shipmentReceiptsRes,
          shipmentReceiptItemsRes,
          customersRes,
          tyresRes,
          retreadBrandsRes,
          treadPatternsRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setShipmentReceipts((shipmentReceiptsRes.data || []) as ShipmentReceipt[]);
      setShipmentReceiptItems((shipmentReceiptItemsRes.data || []) as ShipmentReceiptItem[]);
      setCustomers(normalizeCustomerRows((customersRes.data || []) as CustomerWithRelationsRow[]));
      setTyres((tyresRes.data || []) as Tyre[]);
      setRetreadBrands((retreadBrandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((treadPatternsRes.data || []) as TreadPattern[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const tyreMap = useMemo(
    () => new Map(tyres.map((t) => [t.id, t])),
    [tyres]
  );

  const retreadBrandMap = useMemo(
    () => new Map(retreadBrands.map((b) => [b.id, b.name])),
    [retreadBrands]
  );

  const treadPatternMap = useMemo(
    () => new Map(treadPatterns.map((p) => [p.id, p.name])),
    [treadPatterns]
  );

  const itemsByReceipt = useMemo(() => {
    const map = new Map<number, ShipmentReceiptItem[]>();

    for (const item of shipmentReceiptItems) {
      if (!map.has(item.shipment_receipt_id)) {
        map.set(item.shipment_receipt_id, []);
      }
      map.get(item.shipment_receipt_id)!.push(item);
    }

    return map;
  }, [shipmentReceiptItems]);

  const shipmentTypeOptions = useMemo(() => {
    return Array.from(
      new Set(shipmentReceipts.map((x) => x.shipment_type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(shipmentReceipts.map((x) => x.status).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts]);

  const regionOptions = useMemo(() => {
    return Array.from(
      new Set(
        shipmentReceipts
          .map((x) => customerMap.get(x.customer_id)?.region || "")
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts, customerMap]);

  const salespersonOptions = useMemo(() => {
    return Array.from(
      new Set(
        shipmentReceipts
          .map((x) => customerMap.get(x.customer_id)?.salesperson || "")
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts, customerMap]);

  const filteredReceipts = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return shipmentReceipts.filter((receipt) => {
      if (shipmentTypeFilter !== "all" && receipt.shipment_type !== shipmentTypeFilter) {
        return false;
      }

      if (statusFilter !== "all" && receipt.status !== statusFilter) {
        return false;
      }

      if (regionFilter !== "all" && (customerMap.get(receipt.customer_id)?.region || "") !== regionFilter) {
        return false;
      }

      if (
        salespersonFilter !== "all" &&
        (customerMap.get(receipt.customer_id)?.salesperson || "") !== salespersonFilter
      ) {
        return false;
      }

      if (!q) return true;

      const customerName = customerMap.get(receipt.customer_id)?.name || "";

      const haystack = [
        receipt.shipment_no,
        customerName,
        customerMap.get(receipt.customer_id)?.region || "",
        customerMap.get(receipt.customer_id)?.salesperson || "",
        receipt.shipment_type || "",
        receipt.status || "",
        receipt.description || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    shipmentReceipts,
    searchText,
    shipmentTypeFilter,
    statusFilter,
    regionFilter,
    salespersonFilter,
    customerMap,
  ]);

  const totalReceiptCount = filteredReceipts.length;

  const totalTyreCount = useMemo(() => {
    return filteredReceipts.reduce((sum, receipt) => {
      return sum + (itemsByReceipt.get(receipt.id)?.length || 0);
    }, 0);
  }, [filteredReceipts, itemsByReceipt]);

  const totalAmount = useMemo(() => {
    return filteredReceipts.reduce((sum, receipt) => {
      const items = itemsByReceipt.get(receipt.id) || [];
      const receiptTotal = items.reduce((innerSum, item) => {
        const tyre = tyreMap.get(item.tyre_id);
        return innerSum + Number(tyre?.sale_price || 0);
      }, 0);

      return sum + receiptTotal;
    }, 0);
  }, [filteredReceipts, itemsByReceipt, tyreMap]);

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
        <h1 className="text-2xl font-bold text-slate-900">Sevk Fişleri</h1>
        <p className="mt-1 text-sm text-slate-600">
          Oluşturulmuş sevk fişlerini müşteri, bölge ve plasiyer bazında izleyebilirsin.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Fiş Adedi" value={String(totalReceiptCount)} />
        <SummaryCard title="Toplam Lastik" value={String(totalTyreCount)} />
        <SummaryCard title="Toplam Tutar" value={`${formatMoney(totalAmount)} TL`} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
  <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
    <input
      className="filter-control min-w-[280px] flex-[1.6]"
      placeholder="Sevk no, müşteri, bölge, plasiyer ara..."
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
    />

    <select
      className="filter-control min-w-[170px] flex-1"
      value={shipmentTypeFilter}
      onChange={(e) => setShipmentTypeFilter(e.target.value)}
    >
      <option value="all">Tüm Sevk Tipleri</option>
      {shipmentTypeOptions.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>

    <select
      className="filter-control min-w-[170px] flex-1"
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
    >
      <option value="all">Tüm Durumlar</option>
      {statusOptions.map((item) => (
        <option key={item} value={item}>
          {formatTyreStatus(item)}
        </option>
      ))}
    </select>

    <select
      className="filter-control min-w-[170px] flex-1"
      value={regionFilter}
      onChange={(e) => setRegionFilter(e.target.value)}
    >
      <option value="all">Tüm Bölgeler</option>
      {regionOptions.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>

    <select
      className="filter-control min-w-[170px] flex-1"
      value={salespersonFilter}
      onChange={(e) => setSalespersonFilter(e.target.value)}
    >
      <option value="all">Tüm Plasiyerler</option>
      {salespersonOptions.map((item) => (
        <option key={item} value={item}>
          {item}
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
              const receiptItems = itemsByReceipt.get(receipt.id) || [];
              const expanded = expandedReceiptIds.includes(receipt.id);

              const receiptTotal = receiptItems.reduce((sum, item) => {
                const tyre = tyreMap.get(item.tyre_id);
                return sum + Number(tyre?.sale_price || 0);
              }, 0);

              return (
                <div
                  key={receipt.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
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
                              {receipt.shipment_no}
                            </div>
                            <div className="text-sm text-slate-600">
                              {customerMap.get(receipt.customer_id)?.name || "-"}
                            </div>
                            <StatusBadge status={receipt.status} />
                          </div>

                          <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                            <InlineMeta label="Bölge" value={customerMap.get(receipt.customer_id)?.region || "-"} />
                            <InlineMeta
                              label="Plasiyer"
                              value={customerMap.get(receipt.customer_id)?.salesperson || "-"}
                            />
                            <InlineMeta
                              label="Sevk Tipi"
                              value={receipt.shipment_type || "-"}
                            />
                            <InlineMeta
                              label="Tarih"
                              value={formatDate(receipt.shipment_date || receipt.created_at)}
                            />
                            <InlineMeta
                              label="Toplam Lastik"
                              value={String(receiptItems.length)}
                            />
                            <InlineMeta
                              label="Toplam Tutar"
                              value={`${formatMoney(receiptTotal)} TL`}
                            />
                          </div>

                          {receipt.description ? (
                            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              Açıklama: {receipt.description}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <a
                          href={`/shipment-receipts/${receipt.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Yazdır
                        </a>
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/40">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1300px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Talep Edilen İşlem</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Tür</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Fiyat</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptItems.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={10}
                                  className="p-6 text-center text-sm text-slate-500"
                                >
                                  Bu sevk fişinde lastik bulunamadı.
                                </td>
                              </tr>
                            ) : (
                              receiptItems.map((item) => {
                                const tyre = tyreMap.get(item.tyre_id);

                                if (!tyre) {
                                  return null;
                                }

                                return (
                                  <tr key={item.id} className="border-b border-slate-100 bg-white">
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
                                  </tr>
                                );
                              })
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
    draft: "bg-slate-100 text-slate-700",
    ready_for_loading: "bg-indigo-100 text-indigo-700",
    loaded: "bg-amber-100 text-amber-700",
    shipped: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    allocated_to_shipment: "bg-indigo-100 text-indigo-700",
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {formatTyreStatus(status)}
    </span>
  );
}