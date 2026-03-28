"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";
import { formatTyreStatus } from "@/src/lib/formatters";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

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

type VehicleLoadingItem = {
  id: number;
  vehicle_loading_id: number;
  shipment_receipt_id: number;
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

function createLoadingNo() {
  return `YUK-${Date.now()}`;
}

export default function VehicleLoadingsPage() {
  return (
    <PermissionGuard
      permission="shipping.view"
      title="Araç Yüklemeleri sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <VehicleLoadingsPageContent />
    </PermissionGuard>
  );
}

function VehicleLoadingsPageContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [shipmentReceipts, setShipmentReceipts] = useState<ShipmentReceipt[]>(
    []
  );
  const [shipmentReceiptItems, setShipmentReceiptItems] = useState<
    ShipmentReceiptItem[]
  >([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [vehicleLoadings, setVehicleLoadings] = useState<VehicleLoading[]>([]);
  const [vehicleLoadingItems, setVehicleLoadingItems] = useState<
    VehicleLoadingItem[]
  >([]);

  const [searchText, setSearchText] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");
  const [shipmentTypeFilter, setShipmentTypeFilter] = useState("all");
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<number[]>([]);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<number[]>([]);

  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [loadingDate, setLoadingDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [
        shipmentReceiptsRes,
        shipmentReceiptItemsRes,
        customersRes,
        tyresRes,
        vehicleLoadingsRes,
        vehicleLoadingItemsRes,
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
          .eq("status", "ready_for_loading")
          .order("id", { ascending: false }),

        supabase
          .from("shipment_receipt_items")
          .select("id, shipment_receipt_id, tyre_id")
          .order("id", { ascending: true }),

        supabase.from("customers").select(CUSTOMER_WITH_RELATIONS_SELECT).order("name"),

        supabase.from("tyres").select(`
          id,
          serial_no,
          collection_type,
          tyre_type,
          size,
          sale_price,
          original_brand,
          original_pattern,
          status
        `),

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
          .order("id", { ascending: false }),

        supabase
          .from("vehicle_loading_items")
          .select("id, vehicle_loading_id, shipment_receipt_id")
          .order("id", { ascending: true }),
      ]);

      const firstError = [
        shipmentReceiptsRes.error,
        shipmentReceiptItemsRes.error,
        customersRes.error,
        tyresRes.error,
        vehicleLoadingsRes.error,
        vehicleLoadingItemsRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("Vehicle loadings load error:", firstError.message, {
          shipmentReceiptsRes,
          shipmentReceiptItemsRes,
          customersRes,
          tyresRes,
          vehicleLoadingsRes,
          vehicleLoadingItemsRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setShipmentReceipts((shipmentReceiptsRes.data || []) as ShipmentReceipt[]);
      setShipmentReceiptItems(
        (shipmentReceiptItemsRes.data || []) as ShipmentReceiptItem[]
      );
      setCustomers(normalizeCustomerRows((customersRes.data || []) as CustomerWithRelationsRow[]));
      setTyres((tyresRes.data || []) as Tyre[]);
      setVehicleLoadings((vehicleLoadingsRes.data || []) as VehicleLoading[]);
      setVehicleLoadingItems(
        (vehicleLoadingItemsRes.data || []) as VehicleLoadingItem[]
      );
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

  const shipmentTypeOptions = useMemo(() => {
    return Array.from(
      new Set(shipmentReceipts.map((x) => x.shipment_type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [shipmentReceipts]);

  const filteredReceipts = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return shipmentReceipts.filter((receipt) => {
      if (regionFilter !== "all" && (customerMap.get(receipt.customer_id)?.region || "") !== regionFilter) {
        return false;
      }

      if (
        salespersonFilter !== "all" &&
        (customerMap.get(receipt.customer_id)?.salesperson || "") !== salespersonFilter
      ) {
        return false;
      }

      if (
        shipmentTypeFilter !== "all" &&
        receipt.shipment_type !== shipmentTypeFilter
      ) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        receipt.shipment_no,
        customerMap.get(receipt.customer_id)?.name || "",
        customerMap.get(receipt.customer_id)?.region || "",
        customerMap.get(receipt.customer_id)?.salesperson || "",
        receipt.shipment_type || "",
        receipt.description || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    shipmentReceipts,
    searchText,
    regionFilter,
    salespersonFilter,
    shipmentTypeFilter,
    customerMap,
  ]);

  const selectedReceipts = useMemo(() => {
    return filteredReceipts.filter((receipt) =>
      selectedReceiptIds.includes(receipt.id)
    );
  }, [filteredReceipts, selectedReceiptIds]);

  const selectedTyreCount = useMemo(() => {
    return selectedReceipts.reduce((sum, receipt) => {
      return sum + (itemsByReceipt.get(receipt.id)?.length || 0);
    }, 0);
  }, [selectedReceipts, itemsByReceipt]);

  const selectedTotalAmount = useMemo(() => {
    return selectedReceipts.reduce((sum, receipt) => {
      const items = itemsByReceipt.get(receipt.id) || [];
      const total = items.reduce((inner, item) => {
        const tyre = tyreMap.get(item.tyre_id);
        return inner + Number(tyre?.sale_price || 0);
      }, 0);
      return sum + total;
    }, 0);
  }, [selectedReceipts, itemsByReceipt, tyreMap]);

  function toggleReceiptSelection(receiptId: number) {
    setSelectedReceiptIds((prev) =>
      prev.includes(receiptId)
        ? prev.filter((id) => id !== receiptId)
        : [...prev, receiptId]
    );
  }

  function toggleExpanded(receiptId: number) {
    setExpandedReceiptIds((prev) =>
      prev.includes(receiptId)
        ? prev.filter((id) => id !== receiptId)
        : [...prev, receiptId]
    );
  }

  async function handleCreateVehicleLoading() {
    if (!vehiclePlate.trim()) {
      alert("Araç plakası zorunlu.");
      return;
    }

    if (selectedReceiptIds.length === 0) {
      alert("En az 1 sevk fişi seçmelisin.");
      return;
    }

    setSaving(true);

    try {
      const loadingNo = createLoadingNo();

      const { data: loadingRow, error: loadingError } = await supabase
        .from("vehicle_loadings")
        .insert({
          loading_no: loadingNo,
          vehicle_plate: vehiclePlate.trim(),
          driver_name: driverName.trim() || null,
          loading_date: loadingDate || new Date().toISOString(),
          status: "loaded",
          description: description.trim() || null,
        })
        .select("id")
        .single();

      if (loadingError) {
        throw new Error(loadingError.message);
      }

      const loadingItemsPayload = selectedReceiptIds.map((receiptId) => ({
        vehicle_loading_id: loadingRow.id,
        shipment_receipt_id: receiptId,
      }));

      const { error: itemsError } = await supabase
        .from("vehicle_loading_items")
        .insert(loadingItemsPayload);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const { error: shipmentUpdateError } = await supabase
        .from("shipment_receipts")
        .update({
          status: "loaded",
        })
        .in("id", selectedReceiptIds);

      if (shipmentUpdateError) {
        throw new Error(shipmentUpdateError.message);
      }

      await writeAuditLog({
        action: "vehicle_loading_create",
        entity_table: "vehicle_loadings",
        entity_id: loadingRow.id,
        description: "Araç yükleme fişi oluşturuldu",
        payload: {
          vehicle_loading_id: loadingRow.id,
          loading_no: loadingNo,
          vehicle_plate: vehiclePlate.trim(),
          driver_name: driverName.trim() || null,
          loading_date: loadingDate || null,
          shipment_receipt_ids: selectedReceiptIds,
        },
      });

      setShipmentReceipts((prev) =>
        prev.filter((receipt) => !selectedReceiptIds.includes(receipt.id))
      );

      setSelectedReceiptIds([]);
      setVehiclePlate("");
      setDriverName("");
      setLoadingDate("");
      setDescription("");

      alert(`Araç yükleme fişi oluşturuldu: ${loadingNo}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Araç yükleme fişi oluşturulamadı";
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
    <main className="space-y-4 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Araç Yüklemeleri</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sevk fişlerinden seçim yaparak araç yükleme fişi oluştur.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Seçili Sevk Fişi"
          value={String(selectedReceipts.length)}
        />
        <SummaryCard
          title="Seçili Lastik"
          value={String(selectedTyreCount)}
        />
        <SummaryCard
          title="Seçili Tutar"
          value={`${formatMoney(selectedTotalAmount)} TL`}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Araç Plakası
            </label>
            <input
              className="filter-control"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Şoför
            </label>
            <input
              className="filter-control"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Yükleme Tarihi
            </label>
            <input
              type="datetime-local"
              className="filter-control"
              value={loadingDate}
              onChange={(e) => setLoadingDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Açıklama
            </label>
            <input
              className="filter-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreateVehicleLoading}
            disabled={saving}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Oluşturuluyor..." : "Araç Yükleme Fişi Oluştur"}
          </button>
        </div>
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
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {filteredReceipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Yüklemeye hazır sevk fişi bulunamadı.
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
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-2"
                        checked={selectedReceiptIds.includes(receipt.id)}
                        onChange={() => toggleReceiptSelection(receipt.id)}
                      />

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
                            label="Toplam Lastik"
                            value={String(receiptItems.length)}
                          />
                          <InlineMeta
                            label="Toplam Tutar"
                            value={`${formatMoney(receiptTotal)} TL`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/40">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1300px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Seri No
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Talep Edilen İşlem
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Tür
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Ebat
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Fiyat
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Orijinal Marka
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Orijinal Desen
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Durum
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptItems.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="p-6 text-center text-sm text-slate-500"
                                >
                                  Bu sevk fişinde lastik bulunamadı.
                                </td>
                              </tr>
                            ) : (
                              receiptItems.map((item) => {
                                const tyre = tyreMap.get(item.tyre_id);
                                if (!tyre) return null;

                                return (
                                  <tr
                                    key={item.id}
                                    className="border-b border-slate-100 bg-white"
                                  >
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
                                      {formatTyreStatus(tyre.status)}
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

      {vehicleLoadings.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Oluşturulmuş Araç Yüklemeleri
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Yükleme No
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Plaka
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Şoför
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Tarih
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Fiş Adedi
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Durum
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-600">
                    Yazdır
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicleLoadings.map((loadingRow) => {
                  const count =
                    loadingItemsByLoading.get(loadingRow.id)?.length || 0;

                  return (
                    <tr
                      key={loadingRow.id}
                      className="border-b border-slate-100 bg-white"
                    >
                      <td className="p-3 text-sm font-medium text-slate-900">
                        {loadingRow.loading_no}
                      </td>
                      <td className="p-3 text-sm text-slate-700">
                        {loadingRow.vehicle_plate}
                      </td>
                      <td className="p-3 text-sm text-slate-700">
                        {loadingRow.driver_name || "-"}
                      </td>
                      <td className="p-3 text-sm text-slate-700">
                        {formatDate(
                          loadingRow.loading_date || loadingRow.created_at
                        )}
                      </td>
                      <td className="p-3 text-sm text-slate-700">{count}</td>
                      <td className="p-3 text-sm">
                        <StatusBadge status={loadingRow.status} />
                      </td>
                      <td className="p-3 text-sm">
                        <button
  type="button"
  onClick={() => {
    const url = `/vehicle-loadings/${loadingRow.id}/print?autoprint=1`;
    const width = 1400;
    const height = 900;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      url,
      "vehicle-loading-print",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }}
  className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
>
  Yazdır
</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {formatTyreStatus(status)}
    </span>
  );
}