"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
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
  status: string | null;
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

export default function VehicleLoadingPrintPage() {
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const loadingId = Number(idParam);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [vehicleLoading, setVehicleLoading] = useState<VehicleLoading | null>(
    null
  );
  const [vehicleLoadingItems, setVehicleLoadingItems] = useState<
    VehicleLoadingItem[]
  >([]);
  const [shipmentReceipts, setShipmentReceipts] = useState<ShipmentReceipt[]>(
    []
  );
  const [shipmentReceiptItems, setShipmentReceiptItems] = useState<
    ShipmentReceiptItem[]
  >([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!loadingId || Number.isNaN(loadingId)) {
        setError("Geçersiz yükleme id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data: loadingRow, error: loadingError } = await supabase
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
        .eq("id", loadingId)
        .single();

      if (loadingError) {
        setError(loadingError.message);
        setLoading(false);
        return;
      }

      const currentLoading = loadingRow as VehicleLoading;
      setVehicleLoading(currentLoading);

      const [
        loadingItemsRes,
        customersRes,
        retreadBrandsRes,
        treadPatternsRes,
      ] = await Promise.all([
        supabase
          .from("vehicle_loading_items")
          .select("id, vehicle_loading_id, shipment_receipt_id")
          .eq("vehicle_loading_id", loadingId)
          .order("id", { ascending: true }),

        supabase.from("customers").select(CUSTOMER_WITH_RELATIONS_SELECT).order("name"),

        supabase.from("retread_brands").select("id, name").order("name"),

        supabase
          .from("tread_patterns")
          .select("id, brand_id, name")
          .order("name"),
      ]);

      const firstError = [
        loadingItemsRes.error,
        customersRes.error,
        retreadBrandsRes.error,
        treadPatternsRes.error,
      ].find(Boolean);

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const loadingItems = (loadingItemsRes.data || []) as VehicleLoadingItem[];
      setVehicleLoadingItems(loadingItems);
      setCustomers(normalizeCustomerRows((customersRes.data || []) as CustomerWithRelationsRow[]));
      setRetreadBrands((retreadBrandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((treadPatternsRes.data || []) as TreadPattern[]);

      const shipmentReceiptIds = loadingItems.map((x) => x.shipment_receipt_id);

      if (shipmentReceiptIds.length === 0) {
        setShipmentReceipts([]);
        setShipmentReceiptItems([]);
        setTyres([]);
        setLoading(false);
        return;
      }

      const { data: shipmentRows, error: shipmentError } = await supabase
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
        .in("id", shipmentReceiptIds);

      if (shipmentError) {
        setError(shipmentError.message);
        setLoading(false);
        return;
      }

      const shipmentReceiptsData = (shipmentRows || []) as ShipmentReceipt[];
      setShipmentReceipts(shipmentReceiptsData);

      const { data: shipmentItemRows, error: shipmentItemsError } =
        await supabase
          .from("shipment_receipt_items")
          .select("id, shipment_receipt_id, tyre_id")
          .in("shipment_receipt_id", shipmentReceiptIds)
          .order("id", { ascending: true });

      if (shipmentItemsError) {
        setError(shipmentItemsError.message);
        setLoading(false);
        return;
      }

      const shipmentItemsData =
        (shipmentItemRows || []) as ShipmentReceiptItem[];
      setShipmentReceiptItems(shipmentItemsData);

      const tyreIds = shipmentItemsData.map((x) => x.tyre_id);

      if (tyreIds.length > 0) {
        const { data: tyreRows, error: tyresError } = await supabase
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
          `)
          .in("id", tyreIds);

        if (tyresError) {
          setError(tyresError.message);
          setLoading(false);
          return;
        }

        setTyres((tyreRows || []) as Tyre[]);
      } else {
        setTyres([]);
      }

      setLoading(false);
    }

    loadData();
  }, [loadingId]);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const tyreMap = useMemo(() => new Map(tyres.map((t) => [t.id, t])), [tyres]);

  const retreadBrandMap = useMemo(
    () => new Map(retreadBrands.map((b) => [b.id, b.name])),
    [retreadBrands]
  );

  const treadPatternMap = useMemo(
    () => new Map(treadPatterns.map((p) => [p.id, p.name])),
    [treadPatterns]
  );

  const shipmentReceiptMap = useMemo(
    () => new Map(shipmentReceipts.map((r) => [r.id, r])),
    [shipmentReceipts]
  );

  const orderedShipmentReceipts = useMemo(() => {
    return vehicleLoadingItems
      .map((item) => shipmentReceiptMap.get(item.shipment_receipt_id))
      .filter(Boolean) as ShipmentReceipt[];
  }, [vehicleLoadingItems, shipmentReceiptMap]);

  const itemsByShipmentReceipt = useMemo(() => {
    const map = new Map<number, ShipmentReceiptItem[]>();

    for (const item of shipmentReceiptItems) {
      if (!map.has(item.shipment_receipt_id)) {
        map.set(item.shipment_receipt_id, []);
      }
      map.get(item.shipment_receipt_id)!.push(item);
    }

    return map;
  }, [shipmentReceiptItems]);

  const totalTyreCount = useMemo(() => {
    return orderedShipmentReceipts.reduce((sum, receipt) => {
      return sum + (itemsByShipmentReceipt.get(receipt.id)?.length || 0);
    }, 0);
  }, [orderedShipmentReceipts, itemsByShipmentReceipt]);

  const totalAmount = useMemo(() => {
    return orderedShipmentReceipts.reduce((sum, receipt) => {
      const items = itemsByShipmentReceipt.get(receipt.id) || [];
      const receiptTotal = items.reduce((innerSum, item) => {
        const tyre = tyreMap.get(item.tyre_id);
        return innerSum + Number(tyre?.sale_price || 0);
      }, 0);
      return sum + receiptTotal;
    }, 0);
  }, [orderedShipmentReceipts, itemsByShipmentReceipt, tyreMap]);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error || !vehicleLoading) {
    return <main className="p-6">Hata: {error || "Yükleme bulunamadı."}</main>;
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            width: 297mm;
            height: 210mm;
            background: white;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <main className="bg-white p-4 text-slate-900">
        <div className="mx-auto mb-3 flex max-w-[1400px] justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Yazdır
          </button>
        </div>

        <div className="mx-auto max-w-[1400px] rounded-2xl border border-slate-300 bg-white p-6">
          <div className="border-b border-slate-300 pb-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-2xl font-bold">Araç Yükleme Fişi</div>
                <div className="mt-2 text-sm text-slate-600">
                  Yükleme No:{" "}
                  <span className="font-medium text-slate-900">
                    {vehicleLoading.loading_no}
                  </span>
                </div>
              </div>

              <div className="text-right text-sm">
                <div>
                  <span className="text-slate-500">Tarih: </span>
                  <span className="font-medium text-slate-900">
                    {formatDate(
                      vehicleLoading.loading_date || vehicleLoading.created_at
                    )}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">Durum: </span>
                  <span className="font-medium text-slate-900">
                    {vehicleLoading.status || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Araç Bilgisi
              </div>

              <div className="grid gap-2 text-sm">
                <PrintMeta
                  label="Araç Plakası"
                  value={vehicleLoading.vehicle_plate}
                />
                <PrintMeta label="Şoför" value={vehicleLoading.driver_name || "-"} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Yükleme Özeti
              </div>

              <div className="grid gap-2 text-sm">
                <PrintMeta
                  label="Sevk Fişi Adedi"
                  value={String(orderedShipmentReceipts.length)}
                />
                <PrintMeta label="Toplam Lastik" value={String(totalTyreCount)} />
                <PrintMeta
                  label="Toplam Tutar"
                  value={`${formatMoney(totalAmount)} TL`}
                />
              </div>
            </div>
          </div>

          {vehicleLoading.description ? (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Açıklama
              </div>
              <div className="text-sm text-slate-800">
                {vehicleLoading.description}
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-6">
            {orderedShipmentReceipts.map((receipt) => {
              const receiptItems = itemsByShipmentReceipt.get(receipt.id) || [];
              const receiptTotal = receiptItems.reduce((sum, item) => {
                const tyre = tyreMap.get(item.tyre_id);
                return sum + Number(tyre?.sale_price || 0);
              }, 0);

              return (
                <section
                  key={receipt.id}
                  className="overflow-hidden rounded-xl border border-slate-300"
                >
                  <div className="border-b border-slate-300 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900">
                          {receipt.shipment_no}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {customerMap.get(receipt.customer_id)?.name || "-"}
                        </div>
                      </div>

                      <div className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-4">
                        <PrintMetaInline
                          label="Bölge"
                          value={customerMap.get(receipt.customer_id)?.region || "-"}
                        />
                        <PrintMetaInline
                          label="Plasiyer"
                          value={customerMap.get(receipt.customer_id)?.salesperson || "-"}
                        />
                        <PrintMetaInline
                          label="Adet"
                          value={String(receiptItems.length)}
                        />
                        <PrintMetaInline
                          label="Tutar"
                          value={`${formatMoney(receiptTotal)} TL`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-white text-left">
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Seri No
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Talep Edilen İşlem
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Tür
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Ebat
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Fiyat
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Orijinal Marka
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Orijinal Desen
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Kaplama
                          </th>
                          <th className="border-b border-slate-200 p-3 text-xs font-semibold">
                            Durum
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="p-6 text-center text-sm text-slate-500"
                            >
                              Bu sevk fişinde lastik bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          receiptItems.map((item) => {
                            const tyre = tyreMap.get(item.tyre_id);
                            if (!tyre) return null;

                            const brandName = tyre.retread_brand_id
                              ? retreadBrandMap.get(tyre.retread_brand_id) || "-"
                              : "-";

                            const patternName = tyre.tread_pattern_id
                              ? treadPatternMap.get(tyre.tread_pattern_id) || "-"
                              : "-";

                            return (
                              <tr key={item.id}>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {tyre.serial_no}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {tyre.collection_type || "-"}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {tyre.tyre_type || "-"}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {tyre.size || "-"}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {formatMoney(tyre.sale_price)} TL
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {tyre.original_brand || "-"}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {tyre.original_pattern || "-"}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {brandName !== "-"
                                    ? `${brandName}${
                                        patternName !== "-" ? ` ${patternName}` : ""
                                      }`
                                    : "-"}
                                </td>
                                <td className="border-b border-slate-200 p-3 text-sm">
                                  {formatTyreStatus(tyre.status)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <SignatureBox title="Yükleyen" />
            <SignatureBox title="Araç Sorumlusu / Şoför" />
          </div>
        </div>
      </main>
    </>
  );
}

function PrintMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-[110px] text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function PrintMetaInline({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SignatureBox({ title }: { title: string }) {
  return (
    <div className="pt-10">
      <div className="border-t border-slate-400 pt-2 text-center text-sm text-slate-700">
        {title}
      </div>
    </div>
  );
}