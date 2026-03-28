"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRow,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

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

export default function ShipmentReceiptPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [receipt, setReceipt] = useState<ShipmentReceipt | null>(null);
  const [items, setItems] = useState<ShipmentReceiptItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const receiptId = Number(params.id);

      const { data: shipmentReceipt, error: shipmentReceiptError } = await supabase
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
        .eq("id", receiptId)
        .single();

      if (shipmentReceiptError) {
        setError(shipmentReceiptError.message);
        setLoading(false);
        return;
      }

      const receiptData = shipmentReceipt as ShipmentReceipt;
      setReceipt(receiptData);

      const [
        itemsRes,
        customerRes,
        retreadBrandsRes,
        treadPatternsRes,
      ] = await Promise.all([
        supabase
          .from("shipment_receipt_items")
          .select("id, shipment_receipt_id, tyre_id")
          .eq("shipment_receipt_id", receiptId)
          .order("id", { ascending: true }),

        supabase
          .from("customers")
          .select(CUSTOMER_WITH_RELATIONS_SELECT)
          .eq("id", receiptData.customer_id)
          .single(),

        supabase.from("retread_brands").select("id, name").order("name"),

        supabase
          .from("tread_patterns")
          .select("id, brand_id, name")
          .order("name"),
      ]);

      const firstError = [
        itemsRes.error,
        customerRes.error,
        retreadBrandsRes.error,
        treadPatternsRes.error,
      ].find(Boolean);

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const itemRows = (itemsRes.data || []) as ShipmentReceiptItem[];
      setItems(itemRows);
      setCustomer(
        customerRes.data
          ? normalizeCustomerRow(customerRes.data as CustomerWithRelationsRow)
          : null
      );
      setRetreadBrands((retreadBrandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((treadPatternsRes.data || []) as TreadPattern[]);

      const tyreIds = itemRows.map((x) => x.tyre_id);

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
            tread_pattern_id
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
  }, [params.id]);

  const retreadBrandMap = useMemo(
    () => new Map(retreadBrands.map((b) => [b.id, b.name])),
    [retreadBrands]
  );

  const treadPatternMap = useMemo(
    () => new Map(treadPatterns.map((p) => [p.id, p.name])),
    [treadPatterns]
  );

  const orderedTyres = useMemo(() => {
    const map = new Map(tyres.map((t) => [t.id, t]));
    return items
      .map((item) => map.get(item.tyre_id))
      .filter(Boolean) as Tyre[];
  }, [items, tyres]);

  const totalAmount = useMemo(() => {
    return orderedTyres.reduce((sum, tyre) => sum + Number(tyre.sale_price || 0), 0);
  }, [orderedTyres]);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error || !receipt) {
    return <main className="p-6">Hata: {error || "Fiş bulunamadı."}</main>;
  }

  return (
    <main className="min-h-screen bg-white p-6 text-slate-900">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-bold">Müşteri Teslim Fişi</h1>
            <p className="mt-1 text-sm text-slate-600">
              Yazdırmaya uygun teslim fişi görünümü
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Yazdır
          </button>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-white p-6">
          <div className="border-b border-slate-300 pb-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-2xl font-bold">Müşteri Teslim Fişi</div>
                <div className="mt-2 text-sm text-slate-600">
                  Sevk No: <span className="font-medium text-slate-900">{receipt.shipment_no}</span>
                </div>
              </div>

              <div className="text-right text-sm">
                <div>
                  <span className="text-slate-500">Tarih: </span>
                  <span className="font-medium text-slate-900">
                    {formatDate(receipt.shipment_date || receipt.created_at)}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500">Sevk Tipi: </span>
                  <span className="font-medium text-slate-900">
                    {receipt.shipment_type || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Müşteri Bilgisi
              </div>

              <div className="grid gap-2 text-sm">
                <PrintMeta label="Müşteri" value={customer?.name || "-"} />
                <PrintMeta label="Bölge" value={customer?.region || "-"} />
                <PrintMeta label="Plasiyer" value={customer?.salesperson || "-"} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fiş Özeti
              </div>

              <div className="grid gap-2 text-sm">
                <PrintMeta label="Toplam Lastik" value={String(orderedTyres.length)} />
                <PrintMeta label="Toplam Tutar" value={`${formatMoney(totalAmount)} TL`} />
                <PrintMeta label="Durum" value={receipt.status || "-"} />
              </div>
            </div>
          </div>

          {receipt.description ? (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Açıklama
              </div>
              <div className="text-sm text-slate-800">{receipt.description}</div>
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Seri No</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Talep Edilen İşlem</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Tür</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Ebat</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Fiyat</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Orijinal Marka</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Orijinal Desen</th>
                  <th className="border-b border-slate-300 p-3 text-xs font-semibold">Kaplama</th>
                </tr>
              </thead>
              <tbody>
                {orderedTyres.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-sm text-slate-500">
                      Bu fişte lastik bulunamadı.
                    </td>
                  </tr>
                ) : (
                  orderedTyres.map((tyre) => {
                    const brandName = tyre.retread_brand_id
                      ? retreadBrandMap.get(tyre.retread_brand_id) || "-"
                      : "-";

                    const patternName = tyre.tread_pattern_id
                      ? treadPatternMap.get(tyre.tread_pattern_id) || "-"
                      : "-";

                    return (
                      <tr key={tyre.id}>
                        <td className="border-b border-slate-200 p-3 text-sm">{tyre.serial_no}</td>
                        <td className="border-b border-slate-200 p-3 text-sm">{tyre.collection_type || "-"}</td>
                        <td className="border-b border-slate-200 p-3 text-sm">{tyre.tyre_type || "-"}</td>
                        <td className="border-b border-slate-200 p-3 text-sm">{tyre.size || "-"}</td>
                        <td className="border-b border-slate-200 p-3 text-sm">
                          {formatMoney(tyre.sale_price)} TL
                        </td>
                        <td className="border-b border-slate-200 p-3 text-sm">{tyre.original_brand || "-"}</td>
                        <td className="border-b border-slate-200 p-3 text-sm">{tyre.original_pattern || "-"}</td>
                        <td className="border-b border-slate-200 p-3 text-sm">
                          {brandName !== "-" ? `${brandName} ${patternName !== "-" ? patternName : ""}` : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <SignatureBox title="Teslim Eden" />
            <SignatureBox title="Teslim Alan" />
          </div>
        </div>
      </div>
    </main>
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

function SignatureBox({ title }: { title: string }) {
  return (
    <div className="pt-10">
      <div className="border-t border-slate-400 pt-2 text-center text-sm text-slate-700">
        {title}
      </div>
    </div>
  );
}