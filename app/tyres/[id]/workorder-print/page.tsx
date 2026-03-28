"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRow,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

type TyreRow = {
  id: number;
  customer_id: number | null;
  collection_receipt_id: number | null;
  tyre_code: string | null;
  serial_no: string | null;
  collection_type: string | null;
  tyre_condition: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  retread_brand_id: number | null;
  tread_pattern_id: number | null;
  rim_status: string | null;
  description: string | null;
  factory_arrived_at: string | null;
  created_at: string | null;
};

type CustomerRow = NormalizedCustomer;

type ReceiptRow = {
  id: number;
  receipt_no: string | null;
};

type RetreadBrandRow = {
  id: number;
  name: string;
};

type TreadPatternRow = {
  id: number;
  brand_id: number;
  name: string;
};

type FactoryReceiptLoose = {
  id?: number;
  receipt_no?: string | null;
  factory_receipt_no?: string | null;
  receipt_date?: string | null;
  created_at?: string | null;
};

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 leading-tight">
        {label}
      </div>
      <div className="min-h-[20px] rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-900 leading-tight">
        {value && value.trim() ? value : "\u00A0"}
      </div>
    </div>
  );
}

export default function TyreWorkOrderPrintPage() {
  const params = useParams<{ id: string }>();
  const tyreId = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tyre, setTyre] = useState<TyreRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [collectionReceipt, setCollectionReceipt] = useState<ReceiptRow | null>(null);
  const [retreadBrandName, setRetreadBrandName] = useState("");
  const [treadPatternName, setTreadPatternName] = useState("");
  const [factoryEntryDate, setFactoryEntryDate] = useState("");

  function resolveTyreCondition(value: TyreRow | null) {
    if (!value) return "";
    const dynamicCondition = (value as TyreRow & { condition?: string | null }).condition;
    return (value.tyre_condition || dynamicCondition || "").trim();
  }

  function handlePrint() {
    window.print();
  }

  function handleClose() {
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        window.history.back();
      }
    }, 100);
  }

  useEffect(() => {
    async function loadData() {
      if (!tyreId || Number.isNaN(tyreId)) {
        setError("Geçersiz lastik ID.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data: tyreRow, error: tyreError } = await supabase
        .from("tyres")
        .select("*")
        .eq("id", tyreId)
        .single();

      if (tyreError || !tyreRow) {
        setError(tyreError?.message || "Lastik bulunamadı.");
        setLoading(false);
        return;
      }

      const normalizedTyre = tyreRow as TyreRow & { condition?: string | null };
      setTyre({
        ...normalizedTyre,
        tyre_condition: normalizedTyre.tyre_condition ?? normalizedTyre.condition ?? null,
      });

      const [customerRes, receiptRes, retreadBrandRes, treadPatternRes] =
        await Promise.all([
          tyreRow.customer_id
            ? supabase
                .from("customers")
                .select(CUSTOMER_WITH_RELATIONS_SELECT)
                .eq("id", tyreRow.customer_id)
                .single()
            : Promise.resolve({ data: null, error: null }),

          tyreRow.collection_receipt_id
            ? supabase
                .from("collection_receipts")
                .select("id, receipt_no")
                .eq("id", tyreRow.collection_receipt_id)
                .single()
            : Promise.resolve({ data: null, error: null }),

          tyreRow.retread_brand_id
            ? supabase
                .from("retread_brands")
                .select("id, name")
                .eq("id", tyreRow.retread_brand_id)
                .single()
            : Promise.resolve({ data: null, error: null }),

          tyreRow.tread_pattern_id
            ? supabase
                .from("tread_patterns")
                .select("id, brand_id, name")
                .eq("id", tyreRow.tread_pattern_id)
                .single()
            : Promise.resolve({ data: null, error: null }),
        ]);

      if (customerRes.data) {
        setCustomer(normalizeCustomerRow(customerRes.data as CustomerWithRelationsRow));
      }
      if (receiptRes.data) setCollectionReceipt(receiptRes.data as ReceiptRow);
      if (retreadBrandRes.data) {
        setRetreadBrandName((retreadBrandRes.data as RetreadBrandRow).name);
      }
      if (treadPatternRes.data) {
        setTreadPatternName((treadPatternRes.data as TreadPatternRow).name);
      }

      try {
        const factoryItemRes = await supabase
          .from("factory_receipt_items")
          .select("*")
          .eq("tyre_id", tyreId)
          .limit(1)
          .maybeSingle();

        const factoryReceiptId = (factoryItemRes.data as { factory_receipt_id?: number } | null)
          ?.factory_receipt_id;

        if (factoryReceiptId) {
          const factoryReceiptRes = await supabase
            .from("factory_receipts")
            .select("*")
            .eq("id", factoryReceiptId)
            .single();

          if (factoryReceiptRes.data) {
            const fr = factoryReceiptRes.data as FactoryReceiptLoose;
            setFactoryEntryDate(
              formatDate(fr.receipt_date || fr.created_at || tyreRow.factory_arrived_at)
            );
          }
        } else {
          setFactoryEntryDate(formatDate(tyreRow.factory_arrived_at));
        }
      } catch {
        setFactoryEntryDate(formatDate(tyreRow.factory_arrived_at));
      }

      setLoading(false);
    }

    loadData();
  }, [tyreId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        Yükleniyor...
      </main>
    );
  }

  if (error || !tyre) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-6 text-center">
        {error || "Kayıt bulunamadı."}
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: 150mm 210mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 150mm;
            height: 210mm;
            margin: 0;
            padding: 0;
            background: white;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-controls {
            display: none !important;
          }
        }
      `}</style>

      <div className="print-controls fixed right-4 top-4 z-[9999] flex gap-2 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Yazdır
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Kapat
        </button>
      </div>

      <main className="mx-auto min-h-screen bg-white p-0 print:p-0">
        <div
          className="mx-auto flex flex-col border border-slate-400 bg-white p-[5mm] text-slate-900"
          style={{
            width: "150mm",
            height: "210mm",
            overflow: "hidden",
            boxSizing: "border-box",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div className="mb-1 flex flex-nowrap items-stretch gap-2 border-b border-slate-400 pb-2">
            <div className="flex min-h-[64px] basis-[58%] items-center justify-start border border-slate-400 px-4 py-2 text-[24px] font-bold tracking-wide leading-none">
              İŞ EMRİ
            </div>

            <div className="min-w-0 flex-1 border border-slate-400 px-3 py-2 text-[11px] text-slate-900">
              <div className="mb-1.5">
                <span className="font-bold">Lastik Kodu:</span>{" "}
                <span className="font-normal">{tyre.tyre_code || "-"}</span>
              </div>
              <div className="mb-1.5">
                <span className="font-bold">Karkas Form No:</span>{" "}
                <span className="font-normal">{collectionReceipt?.receipt_no || "-"}</span>
              </div>
              <div>
                <span className="font-bold">Fabrika Giriş Tarihi:</span>{" "}
                <span className="font-normal">{factoryEntryDate || "-"}</span>
              </div>
            </div>
          </div>

          <div className="mb-1 border border-slate-400 px-3 py-2 text-[11px] text-slate-900">
            <div className="mb-1.5">
              <span className="font-bold">Müşteri Adı:</span>{" "}
              <span className="font-normal">{customer?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="font-bold">Personel:</span>{" "}
                <span className="font-normal">{customer?.salesperson || "-"}</span>
              </div>
              <div className="text-right">
                <span className="font-bold">Bölge:</span>{" "}
                <span className="font-normal">{customer?.region || "-"}</span>
              </div>
            </div>
          </div>

          <div className="mb-1 border border-slate-400">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold text-slate-600">
                    Ebat
                  </th>
                  <th className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold text-slate-600">
                    Marka
                  </th>
                  <th className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold text-slate-600">
                    Desen
                  </th>
                  <th className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold text-slate-600">
                    Seri No
                  </th>
                  <th className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold text-slate-600">
                    Lastik Durumu
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                    {tyre.size || "\u00A0"}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                    {tyre.original_brand || "\u00A0"}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                    {tyre.original_pattern || "\u00A0"}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                    {tyre.serial_no || "\u00A0"}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                    {resolveTyreCondition(tyre) || "\u00A0"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-2 border border-slate-400">
            <div className="flex justify-between items-center border-b border-slate-400 px-2 py-0.5">
              <div className="text-[15px] font-bold">
                YAPILACAK İŞLEM
              </div>
              <div className="text-[15px] font-bold">
                {tyre.collection_type || "\u00A0"}
              </div>
            </div>
          </div>

          <div className="mb-2 border border-slate-400">
            <div className="border-b border-slate-400 px-2 py-0.5 text-[11px] font-bold">
              KAPLAMA
            </div>

            <table className="w-full border-collapse">
              <tbody>
                <tr style={{ height: "24px" }}>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Kaplama Markası</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">K. Desen</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">İlk Kontrol</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Kauçuk Kodu</th>
                </tr>
                <tr>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{retreadBrandName || "\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{treadPatternName || "\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                </tr>
                <tr style={{ height: "24px" }}>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Raspa</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Krater</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sement</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sırt Genişliği</th>
                </tr>
                <tr style={{ height: "24px" }}>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                </tr>
                <tr style={{ height: "24px" }}>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sırt Uzunluğu</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sırt Geçirme</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Son Kontrol</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Üretim No</th>
                </tr>
                <tr style={{ height: "24px" }}>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                </tr>
                <tr style={{ height: "24px" }}>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Yama-1</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Yama-2</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Yama-3</th>
                  <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Yama-4</th>
                </tr>
                <tr style={{ height: "24px" }}>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                  <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-2 border border-slate-400">
            <div className="flex items-center justify-between border-b border-slate-400 px-2 py-0.5">
              <div className="text-[15px] font-bold">JANT</div>
              <div className="text-[15px] font-bold">{tyre.rim_status || "\u00A0"}</div>
            </div>
          </div>

          <div className="mb-1 flex min-h-0 flex-1 flex-col border border-slate-400 p-1.5">
            <div className="mb-0.5 text-[11px] font-bold uppercase text-slate-600 leading-tight">
              Notlar / Açıklama
            </div>
            <div className="h-full rounded border border-slate-300 px-1.5 py-1 text-[11px] leading-snug">
              {tyre.description && tyre.description.trim() ? (
                <div className="whitespace-pre-wrap">{tyre.description}</div>
              ) : (
                <div>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[20px] border-b border-slate-200"
                    >
                      {"\u00A0"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}