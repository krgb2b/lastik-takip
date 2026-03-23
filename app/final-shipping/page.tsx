"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";

type VehicleLoading = {
  id: number;
  loading_no: string;
  vehicle_plate: string;
  driver_name: string | null;
  loading_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
};

type VehicleLoadingItem = {
  id: number;
  vehicle_loading_id: number;
  shipment_receipt_id: number;
};

type ShipmentReceipt = {
  id: number;
  shipment_no: string;
  customer_id: number;
  shipment_type: string;
  status: string;
  shipment_date: string | null;
  region: string | null;
  salesperson: string | null;
  description: string | null;
  created_at: string;
};

type ShipmentReceiptItem = {
  id: number;
  shipment_receipt_id: number;
  tyre_id: number;
};

type Customer = {
  id: number;
  name: string;
};

type Tyre = {
  id: number;
  serial_no: string;
  collection_type: string | null;
  tyre_type: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  status: string;
  shipped_at: string | null;
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

export default function FinalShippingPage() {
  return (
    <PermissionGuard
      permission="shipping.view"
      title="Nihai Sevk sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <FinalShippingPageContent />
    </PermissionGuard>
  );
}

function FinalShippingPageContent() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [vehicleLoadings, setVehicleLoadings] = useState<VehicleLoading[]>([]);
  const [vehicleLoadingItems, setVehicleLoadingItems] = useState<VehicleLoadingItem[]>([]);
  const [shipmentReceipts, setShipmentReceipts] = useState<ShipmentReceipt[]>([]);
  const [shipmentReceiptItems, setShipmentReceiptItems] = useState<ShipmentReceiptItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const [searchText, setSearchText] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [vehiclePlateFilter, setVehiclePlateFilter] = useState("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [
        vehicleLoadingsRes,
        vehicleLoadingItemsRes,
        shipmentReceiptsRes,
        shipmentReceiptItemsRes,
        customersRes,
        tyresRes,
      ] = await Promise.all([
        supabase
          .from("vehicle_loadings")
          .select(`
            id,
            loading_no,
            vehicle_plate,
            driver_name,
            loading_date,
            status,
            description,
            created_at
          `)
          .eq("status", "loaded")
          .order("id", { ascending: false }),

        supabase
          .from("vehicle_loading_items")
          .select("id, vehicle_loading_id, shipment_receipt_id")
          .order("id", { ascending: true }),

        supabase
          .from("shipment_receipts")
          .select(`
            id,
            shipment_no,
            customer_id,
            shipment_type,
            status,
            shipment_date,
            region,
            salesperson,
            description,
            created_at
          `),

        supabase
          .from("shipment_receipt_items")
          .select("id, shipment_receipt_id, tyre_id")
          .order("id", { ascending: true }),

        supabase.from("customers").select("id, name").order("name"),

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
    status,
    shipped_at
  `)
      ]);

      const firstError = [
        vehicleLoadingsRes.error,
        vehicleLoadingItemsRes.error,
        shipmentReceiptsRes.error,
        shipmentReceiptItemsRes.error,
        customersRes.error,
        tyresRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("Final shipping load error:", firstError.message, {
          vehicleLoadingsRes,
          vehicleLoadingItemsRes,
          shipmentReceiptsRes,
          shipmentReceiptItemsRes,
          customersRes,
          tyresRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setVehicleLoadings((vehicleLoadingsRes.data || []) as VehicleLoading[]);
      setVehicleLoadingItems((vehicleLoadingItemsRes.data || []) as VehicleLoadingItem[]);
      setShipmentReceipts((shipmentReceiptsRes.data || []) as ShipmentReceipt[]);
      setShipmentReceiptItems((shipmentReceiptItemsRes.data || []) as ShipmentReceiptItem[]);
      setCustomers((customersRes.data || []) as Customer[]);
      setTyres((tyresRes.data || []) as Tyre[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const shipmentReceiptMap = useMemo(
    () => new Map(shipmentReceipts.map((r) => [r.id, r])),
    [shipmentReceipts]
  );

  const tyreMap = useMemo(
    () => new Map(tyres.map((t) => [t.id, t])),
    [tyres]
  );

  const loadingItemsByLoading = useMemo(() => {
    const map = new Map<number, VehicleLoadingItem[]>();

    for (const item of vehicleLoadingItems) {
      if (!map.has(item.vehicle_loading_id)) {
        map.set(item.vehicle_loading_id, []);
      }
      map.get(item.vehicle_loading_id)!.push(item);
    }

    return map;
  }, [vehicleLoadingItems]);

  const receiptItemsByReceipt = useMemo(() => {
    const map = new Map<number, ShipmentReceiptItem[]>();

    for (const item of shipmentReceiptItems) {
      if (!map.has(item.shipment_receipt_id)) {
        map.set(item.shipment_receipt_id, []);
      }
      map.get(item.shipment_receipt_id)!.push(item);
    }

    return map;
  }, [shipmentReceiptItems]);

  const regionOptions = useMemo(() => {
    const values = new Set<string>();

    shipmentReceipts.forEach((receipt) => {
      if (receipt.region) values.add(receipt.region);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts]);

  const salespersonOptions = useMemo(() => {
    const values = new Set<string>();

    shipmentReceipts.forEach((receipt) => {
      if (receipt.salesperson) values.add(receipt.salesperson);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts]);

  const vehiclePlateOptions = useMemo(() => {
    return Array.from(
      new Set(vehicleLoadings.map((x) => x.vehicle_plate).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [vehicleLoadings]);

  const filteredVehicleLoadings = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return vehicleLoadings.filter((loadingRow) => {
      const loadingItems = loadingItemsByLoading.get(loadingRow.id) || [];
      const relatedReceipts = loadingItems
        .map((x) => shipmentReceiptMap.get(x.shipment_receipt_id))
        .filter(Boolean) as ShipmentReceipt[];

      if (
        vehiclePlateFilter !== "all" &&
        loadingRow.vehicle_plate !== vehiclePlateFilter
      ) {
        return false;
      }

      if (
        regionFilter !== "all" &&
        !relatedReceipts.some((r) => (r.region || "") === regionFilter)
      ) {
        return false;
      }

      if (
        salespersonFilter !== "all" &&
        !relatedReceipts.some((r) => (r.salesperson || "") === salespersonFilter)
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        loadingRow.loading_no,
        loadingRow.vehicle_plate,
        loadingRow.driver_name || "",
        ...relatedReceipts.map((r) => r.shipment_no),
        ...relatedReceipts.map((r) => r.region || ""),
        ...relatedReceipts.map((r) => r.salesperson || ""),
        ...relatedReceipts.map((r) => customerMap.get(r.customer_id) || ""),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    vehicleLoadings,
    loadingItemsByLoading,
    shipmentReceiptMap,
    customerMap,
    searchText,
    regionFilter,
    salespersonFilter,
    vehiclePlateFilter,
  ]);

  const totalLoadingCount = filteredVehicleLoadings.length;

  const totalReceiptCount = useMemo(() => {
    return filteredVehicleLoadings.reduce((sum, loadingRow) => {
      return sum + (loadingItemsByLoading.get(loadingRow.id)?.length || 0);
    }, 0);
  }, [filteredVehicleLoadings, loadingItemsByLoading]);

  const totalTyreCount = useMemo(() => {
    return filteredVehicleLoadings.reduce((sum, loadingRow) => {
      const loadingItems = loadingItemsByLoading.get(loadingRow.id) || [];
      const relatedReceipts = loadingItems
        .map((x) => shipmentReceiptMap.get(x.shipment_receipt_id))
        .filter(Boolean) as ShipmentReceipt[];

      const tyreCount = relatedReceipts.reduce((innerSum, receipt) => {
        return innerSum + (receiptItemsByReceipt.get(receipt.id)?.length || 0);
      }, 0);

      return sum + tyreCount;
    }, 0);
  }, [filteredVehicleLoadings, loadingItemsByLoading, shipmentReceiptMap, receiptItemsByReceipt]);

  const totalAmount = useMemo(() => {
    return filteredVehicleLoadings.reduce((sum, loadingRow) => {
      const loadingItems = loadingItemsByLoading.get(loadingRow.id) || [];
      const relatedReceipts = loadingItems
        .map((x) => shipmentReceiptMap.get(x.shipment_receipt_id))
        .filter(Boolean) as ShipmentReceipt[];

      const loadingTotal = relatedReceipts.reduce((innerSum, receipt) => {
        const receiptTotal = (receiptItemsByReceipt.get(receipt.id) || []).reduce(
          (itemSum, item) => itemSum + Number(tyreMap.get(item.tyre_id)?.sale_price || 0),
          0
        );
        return innerSum + receiptTotal;
      }, 0);

      return sum + loadingTotal;
    }, 0);
  }, [filteredVehicleLoadings, loadingItemsByLoading, shipmentReceiptMap, receiptItemsByReceipt, tyreMap]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCompleteShipping(loadingId: number) {
    const loadingItems = loadingItemsByLoading.get(loadingId) || [];
    const shipmentReceiptIds = loadingItems.map((x) => x.shipment_receipt_id);

    if (shipmentReceiptIds.length === 0) {
      alert("Bu yüklemede sevk fişi bulunamadı.");
      return;
    }

    const relatedReceipts = shipmentReceiptIds
      .map((id) => shipmentReceiptMap.get(id))
      .filter(Boolean) as ShipmentReceipt[];

    const tyreIds = relatedReceipts.flatMap((receipt) =>
      (receiptItemsByReceipt.get(receipt.id) || []).map((x) => x.tyre_id)
    );

    if (tyreIds.length === 0) {
      alert("Bu yüklemede lastik bulunamadı.");
      return;
    }

    const confirmed = window.confirm(
      "Bu araç yüklemesi için sevk tamamlandı olarak işaretlensin mi?"
    );
    if (!confirmed) return;

    setSavingId(loadingId);

    try {
      const now = new Date().toISOString();

      const { error: loadingError } = await supabase
        .from("vehicle_loadings")
        .update({ status: "shipped" })
        .eq("id", loadingId);

      if (loadingError) throw new Error(loadingError.message);

      const { error: receiptError } = await supabase
        .from("shipment_receipts")
        .update({ status: "shipped" })
        .in("id", shipmentReceiptIds);

      if (receiptError) throw new Error(receiptError.message);

      const normalTyreIds: number[] = [];
      const rejectedTyreIds: number[] = [];

      for (const receipt of relatedReceipts) {
        const ids = (receiptItemsByReceipt.get(receipt.id) || []).map((x) => x.tyre_id);

        if (receipt.shipment_type === "rejected_return") {
          rejectedTyreIds.push(...ids);
        } else {
          normalTyreIds.push(...ids);
        }
      }

      if (normalTyreIds.length > 0) {
        const { error: normalTyresError } = await supabase
          .from("tyres")
          .update({
            status: "shipped",
            shipped_at: now,
          })
          .in("id", normalTyreIds);

        if (normalTyresError) throw new Error(normalTyresError.message);
      }

      if (rejectedTyreIds.length > 0) {
        const { error: rejectedTyresError } = await supabase
          .from("tyres")
          .update({
            shipped_at: now,
          })
          .in("id", rejectedTyreIds);

        if (rejectedTyresError) throw new Error(rejectedTyresError.message);
      }

      await writeAuditLog({
        action: "final_shipping_complete",
        entity_table: "vehicle_loadings",
        entity_id: loadingId,
        description: "Araç yüklemesi için nihai sevk tamamlandı",
        payload: {
          vehicle_loading_id: loadingId,
          shipment_receipt_ids: shipmentReceiptIds,
          normal_tyre_ids: normalTyreIds,
          rejected_tyre_ids: rejectedTyreIds,
          shipped_at: now,
        },
      });

      setVehicleLoadings((prev) => prev.filter((x) => x.id !== loadingId));
      setShipmentReceipts((prev) =>
        prev.map((x) =>
          shipmentReceiptIds.includes(x.id) ? { ...x, status: "shipped" } : x
        )
      );
      setTyres((prev) =>
        prev.map((x) => {
          if (normalTyreIds.includes(x.id)) {
            return { ...x, status: "shipped", shipped_at: now };
          }
          if (rejectedTyreIds.includes(x.id)) {
            return { ...x, shipped_at: now };
          }
          return x;
        })
      );

      alert("Nihai sevk tamamlandı.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sevk tamamlanamadı";
      alert(msg);
    } finally {
      setSavingId(null);
    }
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
        <h1 className="text-2xl font-bold text-slate-900">Nihai Sevk</h1>
        <p className="mt-1 text-sm text-slate-600">
          Yüklenmiş araçları sevk tamamlandı olarak işaretle.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Araç Yükleme" value={String(totalLoadingCount)} />
        <SummaryCard title="Sevk Fişi" value={String(totalReceiptCount)} />
        <SummaryCard title="Toplam Lastik" value={String(totalTyreCount)} />
        <SummaryCard title="Toplam Tutar" value={`${formatMoney(totalAmount)} TL`} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <input
            className="h-10 min-w-[280px] flex-[1.6] rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Yükleme no, plaka, şoför, müşteri, bölge ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className="h-10 min-w-[170px] flex-1 rounded-xl border border-slate-300 px-3 text-sm"
            value={vehiclePlateFilter}
            onChange={(e) => setVehiclePlateFilter(e.target.value)}
          >
            <option value="all">Tüm Plakalar</option>
            {vehiclePlateOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="h-10 min-w-[170px] flex-1 rounded-xl border border-slate-300 px-3 text-sm"
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
            className="h-10 min-w-[170px] flex-1 rounded-xl border border-slate-300 px-3 text-sm"
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

      {filteredVehicleLoadings.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Nihai sevk bekleyen araç yüklemesi yok.
        </section>
      ) : (
        <section className="space-y-3">
          {filteredVehicleLoadings.map((loadingRow) => {
            const loadingItems = loadingItemsByLoading.get(loadingRow.id) || [];
            const relatedReceipts = loadingItems
              .map((x) => shipmentReceiptMap.get(x.shipment_receipt_id))
              .filter(Boolean) as ShipmentReceipt[];

            const tyreCount = relatedReceipts.reduce((sum, receipt) => {
              return sum + (receiptItemsByReceipt.get(receipt.id)?.length || 0);
            }, 0);

            const loadingTotalAmount = relatedReceipts.reduce((sum, receipt) => {
              const itemTotal = (receiptItemsByReceipt.get(receipt.id) || []).reduce(
                (inner, item) => inner + Number(tyreMap.get(item.tyre_id)?.sale_price || 0),
                0
              );
              return sum + itemTotal;
            }, 0);

            const expanded = expandedIds.includes(loadingRow.id);

            return (
              <div
                key={loadingRow.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(loadingRow.id)}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        {expanded ? "−" : "+"}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="text-base font-semibold text-slate-900">
                            {loadingRow.loading_no}
                          </div>
                          <div className="text-sm text-slate-600">
                            {loadingRow.vehicle_plate}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                          <InlineMeta label="Şoför" value={loadingRow.driver_name || "-"} />
                          <InlineMeta
                            label="Yükleme Tarihi"
                            value={formatDate(loadingRow.loading_date || loadingRow.created_at)}
                          />
                          <InlineMeta
                            label="Sevk Fişi"
                            value={String(relatedReceipts.length)}
                          />
                          <InlineMeta
                            label="Toplam Lastik"
                            value={String(tyreCount)}
                          />
                          <InlineMeta
                            label="Toplam Tutar"
                            value={`${formatMoney(loadingTotalAmount)} TL`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCompleteShipping(loadingRow.id)}
                        disabled={savingId === loadingRow.id}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {savingId === loadingRow.id ? "İşleniyor..." : "Sevki Tamamla"}
                      </button>
                    </div>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-slate-200 bg-slate-50/40">
                    <div className="space-y-3 p-3">
                      {relatedReceipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="rounded-xl border border-slate-200 bg-white"
                        >
                          <div className="border-b border-slate-200 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <div className="text-sm font-semibold text-slate-900">
                                {receipt.shipment_no}
                              </div>
                              <div className="text-sm text-slate-600">
                                {customerMap.get(receipt.customer_id) || "-"}
                              </div>
                              <div className="text-xs text-slate-500">
                                {receipt.region || "-"} / {receipt.salesperson || "-"}
                              </div>
                            </div>
                          </div>

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
        <th className="p-3 text-xs font-semibold text-slate-600">Durum</th>
      </tr>
    </thead>
    <tbody>
      {(receiptItemsByReceipt.get(receipt.id) || []).map((item) => {
        const tyre = tyreMap.get(item.tyre_id);
        if (!tyre) return null;

        return (
          <tr key={item.id} className="border-b border-slate-100">
            <td className="p-3 text-sm">{tyre.serial_no}</td>
            <td className="p-3 text-sm">{tyre.collection_type || "-"}</td>
            <td className="p-3 text-sm">{tyre.tyre_type || "-"}</td>
            <td className="p-3 text-sm">{tyre.size || "-"}</td>
            <td className="p-3 text-sm">{formatMoney(tyre.sale_price)} TL</td>
            <td className="p-3 text-sm">{tyre.original_brand || "-"}</td>
            <td className="p-3 text-sm">{tyre.original_pattern || "-"}</td>
            <td className="p-3 text-sm">{tyre.status || "-"}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
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