"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
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
  original_brand: string | null;
  original_pattern: string | null;
  retread_brand_id: number | null;
  tread_pattern_id: number | null;
  rim_status: string | null;
  description: string | null;
  factory_arrived_at: string | null;
  status: string | null;
  condition?: string | null;
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

type FactoryReceiptItemRow = {
  tyre_id: number;
  factory_receipt_id: number | null;
};

type FactoryReceiptRow = {
  id: number;
  receipt_date: string | null;
  created_at: string | null;
};

type WorkOrderData = {
  tyre: TyreRow;
  customer: CustomerRow | null;
  retreadBrandName: string;
  treadPatternName: string;
  factoryEntryDate: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function resolveTyreCondition(value: TyreRow | null) {
  if (!value) return "";
  return (value.tyre_condition || value.condition || "").trim();
}

function WorkOrderSheet({
  item,
  receiptNo,
}: {
  item: WorkOrderData;
  receiptNo: string;
}) {
  return (
    <section
      className="workorder-sheet mx-auto flex flex-col border border-slate-400 bg-white p-[5mm] text-slate-900"
      style={{
        width: "150mm",
        height: "210mm",
        boxSizing: "border-box",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div className="mb-2 flex flex-nowrap items-stretch gap-2 border-b border-slate-400 pb-2">
        <div className="flex min-h-[64px] basis-[58%] items-center justify-start border border-slate-400 px-4 py-2 text-[24px] font-bold tracking-wide leading-none">
          IS EMRI
        </div>

        <div className="min-w-0 flex-1 border border-slate-400 px-3 py-2 text-[11px] text-slate-900">
          <div className="mb-1.5">
            <span className="font-bold">Lastik Kodu:</span>{" "}
            <span className="font-normal">{item.tyre.tyre_code || "-"}</span>
          </div>
          <div className="mb-1.5">
            <span className="font-bold">Karkas Form No:</span>{" "}
            <span className="font-normal">{receiptNo || "-"}</span>
          </div>
          <div>
            <span className="font-bold">Fabrika Giris Tarihi:</span>{" "}
            <span className="font-normal">{item.factoryEntryDate || "-"}</span>
          </div>
        </div>
      </div>

      <div className="mb-2 border border-slate-400 px-3 py-2 text-[11px] text-slate-900">
        <div className="mb-1.5">
          <span className="font-bold">Musteri Adi:</span>{" "}
          <span className="font-normal">{item.customer?.name || "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="font-bold">Personel:</span>{" "}
            <span className="font-normal">{item.customer?.salesperson || "-"}</span>
          </div>
          <div className="text-right">
            <span className="font-bold">Bolge:</span>{" "}
            <span className="font-normal">{item.customer?.region || "-"}</span>
          </div>
        </div>
      </div>

      <div className="mb-2 border border-slate-400">
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
                {item.tyre.size || "\u00A0"}
              </td>
              <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                {item.tyre.original_brand || "\u00A0"}
              </td>
              <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                {item.tyre.original_pattern || "\u00A0"}
              </td>
              <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                {item.tyre.serial_no || "\u00A0"}
              </td>
              <td className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-medium text-slate-900">
                {resolveTyreCondition(item.tyre) || "\u00A0"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-1 border border-slate-400">
        <div className="flex items-center justify-between border-b border-slate-400 px-2 py-0.5">
          <div className="text-[15px] font-bold">YAPILACAK ISLEM</div>
          <div className="text-[15px] font-bold">{item.tyre.collection_type || "\u00A0"}</div>
        </div>
      </div>

      <div className="mb-1 border border-slate-400">
        <div className="border-b border-slate-400 px-2 py-0.5 text-[11px] font-bold">KAPLAMA</div>

        <table className="w-full border-collapse">
          <tbody>
            <tr style={{ height: "24px" }}>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Kaplama Markasi</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">K. Desen</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Ilk Kontrol</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Kaucuk Kodu</th>
            </tr>
            <tr>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{item.retreadBrandName || "\u00A0"}</td>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{item.treadPatternName || "\u00A0"}</td>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
            </tr>
            <tr style={{ height: "24px" }}>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Raspa</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Krater</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sement</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sirt Genisligi</th>
            </tr>
            <tr style={{ height: "24px" }}>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
              <td style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px]">{"\u00A0"}</td>
            </tr>
            <tr style={{ height: "24px" }}>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sirt Uzunlugu</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Sirt Gecirme</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Son Kontrol</th>
              <th style={{ width: "25%" }} className="border border-slate-300 px-1.5 py-1 text-center text-[11px] font-bold">Uretim No</th>
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

      <div className="mb-1 border border-slate-400">
        <div className="flex items-center justify-between border-b border-slate-400 px-2 py-0.5">
          <div className="text-[15px] font-bold">JANT</div>
          <div className="text-[15px] font-bold">{item.tyre.rim_status || "\u00A0"}</div>
        </div>
      </div>

      <div className="mb-1 flex min-h-0 flex-1 flex-col border border-slate-400 p-1.5">
        <div className="mb-0.5 text-[11px] font-bold uppercase text-slate-600 leading-tight">
          Notlar / Aciklama
        </div>
        <div className="h-full rounded border border-slate-300 px-1.5 py-1 text-[11px] leading-snug">
          {item.tyre.description && item.tyre.description.trim() ? (
            <div className="whitespace-pre-wrap">{item.tyre.description}</div>
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
    </section>
  );
}

export default function ReceiptWorkOrdersPrintPage() {
  const params = useParams<{ id: string }>();
  const receiptId = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!receiptId || Number.isNaN(receiptId)) {
        setError("Gecersiz form ID.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [receiptRes, tyresRes] = await Promise.all([
        supabase
          .from("collection_receipts")
          .select("id, receipt_no")
          .eq("id", receiptId)
          .single(),

        supabase
          .from("tyres")
          .select(`
            id,
            customer_id,
            collection_receipt_id,
            tyre_code,
            serial_no,
            collection_type,
            tyre_condition,
            size,
            original_brand,
            original_pattern,
            retread_brand_id,
            tread_pattern_id,
            rim_status,
            description,
            factory_arrived_at,
            status
          `)
          .eq("collection_receipt_id", receiptId)
          .eq("status", "factory_received")
          .order("id", { ascending: true }),
      ]);

      if (receiptRes.error) {
        setError(receiptRes.error.message);
        setLoading(false);
        return;
      }

      if (tyresRes.error) {
        setError(tyresRes.error.message);
        setLoading(false);
        return;
      }

      const tyres = (tyresRes.data || []) as TyreRow[];
      if (tyres.length === 0) {
        setError("Is emri yazdirilacak uygun lastik bulunamadi.");
        setLoading(false);
        return;
      }

      setReceiptNo(((receiptRes.data as ReceiptRow | null)?.receipt_no || "").trim());

      const customerIds = Array.from(
        new Set(tyres.map((x) => x.customer_id).filter((x): x is number => typeof x === "number"))
      );
      const retreadBrandIds = Array.from(
        new Set(
          tyres
            .map((x) => x.retread_brand_id)
            .filter((x): x is number => typeof x === "number")
        )
      );
      const treadPatternIds = Array.from(
        new Set(
          tyres
            .map((x) => x.tread_pattern_id)
            .filter((x): x is number => typeof x === "number")
        )
      );

      const [customersRes, retreadBrandsRes, treadPatternsRes, factoryItemsRes] =
        await Promise.all([
          customerIds.length > 0
            ? supabase
                .from("customers")
                .select(CUSTOMER_WITH_RELATIONS_SELECT)
                .in("id", customerIds)
            : Promise.resolve({ data: [], error: null }),

          retreadBrandIds.length > 0
            ? supabase
                .from("retread_brands")
                .select("id, name")
                .in("id", retreadBrandIds)
            : Promise.resolve({ data: [], error: null }),

          treadPatternIds.length > 0
            ? supabase
                .from("tread_patterns")
                .select("id, brand_id, name")
                .in("id", treadPatternIds)
            : Promise.resolve({ data: [], error: null }),

          Promise.resolve({ data: [], error: null }),
        ]);

      const secondError = [
        customersRes.error,
        retreadBrandsRes.error,
        treadPatternsRes.error,
        factoryItemsRes.error,
      ].find(Boolean);

      if (secondError) {
        setError(secondError.message);
        setLoading(false);
        return;
      }

      const factoryItems: FactoryReceiptItemRow[] = [];
      const factoryReceiptIds: number[] = [];

      const factoryReceiptsRes = { data: [] as FactoryReceiptRow[], error: null };

      const customerMap = new Map<number, CustomerRow>(
        normalizeCustomerRows((customersRes.data || []) as CustomerWithRelationsRow[]).map(
          (x) => [x.id, x]
        )
      );
      const retreadBrandMap = new Map<number, string>(
        ((retreadBrandsRes.data || []) as RetreadBrandRow[]).map((x) => [x.id, x.name])
      );
      const treadPatternMap = new Map<number, string>(
        ((treadPatternsRes.data || []) as TreadPatternRow[]).map((x) => [x.id, x.name])
      );
      const factoryReceiptByTyreMap = new Map<number, number>();
      for (const row of factoryItems) {
        if (typeof row.factory_receipt_id === "number") {
          factoryReceiptByTyreMap.set(row.tyre_id, row.factory_receipt_id);
        }
      }

      const factoryReceiptDateMap = new Map<number, string>(
        ((factoryReceiptsRes.data || []) as FactoryReceiptRow[]).map((x) => [
          x.id,
          x.receipt_date || x.created_at || "",
        ])
      );

      const mapped: WorkOrderData[] = tyres.map((tyre) => {
        const factoryReceiptId = factoryReceiptByTyreMap.get(tyre.id);
        const factoryDate =
          (factoryReceiptId ? factoryReceiptDateMap.get(factoryReceiptId) : "") ||
          tyre.factory_arrived_at ||
          "";

        return {
          tyre,
          customer:
            typeof tyre.customer_id === "number"
              ? customerMap.get(tyre.customer_id) || null
              : null,
          retreadBrandName:
            typeof tyre.retread_brand_id === "number"
              ? retreadBrandMap.get(tyre.retread_brand_id) || ""
              : "",
          treadPatternName:
            typeof tyre.tread_pattern_id === "number"
              ? treadPatternMap.get(tyre.tread_pattern_id) || ""
              : "",
          factoryEntryDate: formatDate(factoryDate),
        };
      });

      setWorkOrders(mapped);
      setLoading(false);
    }

    loadData();
  }, [receiptId]);

  const hasData = useMemo(() => workOrders.length > 0, [workOrders.length]);

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        Yukleniyor...
      </main>
    );
  }

  if (error || !hasData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-6 text-center">
        {error || "Kayit bulunamadi."}
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
            margin: 0;
            padding: 0;
            background: white;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .workorder-sheet {
            page-break-after: always;
            break-after: page;
            margin: 0;
          }

          .workorder-sheet:first-child {
            page-break-before: avoid;
            break-before: avoid;
          }

          .workorder-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
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
          Yazdir
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Kapat
        </button>
      </div>

      <main className="bg-slate-100 px-0 py-0 print:bg-white print:p-0">
        {workOrders.map((item) => (
          <WorkOrderSheet
            key={item.tyre.id}
            item={item}
            receiptNo={receiptNo}
          />
        ))}
      </main>
    </>
  );
}
