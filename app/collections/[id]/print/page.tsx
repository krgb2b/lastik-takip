"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";

type Receipt = {
  id: number;
  receipt_no: string;
  delivered_by: string | null;
  collection_date: string | null;
  total_sale_price: number | null;
  description: string | null;
  customers: {
    name: string;
  }[] | null;
};

type Tyre = {
  id: number;
  collection_type: string | null;
  serial_no: string;
  tyre_type: string | null;
  size: string | null;
  original_brand: string | null;
  original_pattern: string | null;
  sale_price: number | null;
  description: string | null;
  retread_brand_id: number | null;
  tread_pattern_id: number | null;
};

type RetreadBrand = {
  id: number;
  name: string;
};

type TreadPattern = {
  id: number;
  name: string;
};

export default function CollectionPrintPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!id) return;

      const [receiptRes, tyresRes, brandsRes, patternsRes] = await Promise.all([
        supabase
          .from("collection_receipts")
          .select(`
            id,
            receipt_no,
            delivered_by,
            collection_date,
            total_sale_price,
            description,
            customers (
              name
            )
          `)
          .eq("id", Number(id))
          .single(),

        supabase
          .from("tyres")
          .select(`
            id,
            collection_type,
            serial_no,
            tyre_type,
            size,
            original_brand,
            original_pattern,
            sale_price,
            description,
            retread_brand_id,
            tread_pattern_id
          `)
          .eq("collection_receipt_id", Number(id))
          .order("id", { ascending: true }),

        supabase.from("retread_brands").select("id, name"),
        supabase.from("tread_patterns").select("id, name"),
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

      if (brandsRes.error) {
        setError(brandsRes.error.message);
        setLoading(false);
        return;
      }

      if (patternsRes.error) {
        setError(patternsRes.error.message);
        setLoading(false);
        return;
      }

      setReceipt(receiptRes.data as Receipt);
      setTyres((tyresRes.data || []) as Tyre[]);
      setRetreadBrands((brandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((patternsRes.data || []) as TreadPattern[]);
      setLoading(false);
    }

    loadData();
  }, [id]);

  const totalAmount = useMemo(() => {
    return tyres.reduce((sum, tyre) => sum + Number(tyre.sale_price || 0), 0);
  }, [tyres]);

  const brandMap = useMemo(() => {
    return new Map(retreadBrands.map((item) => [item.id, item.name]));
  }, [retreadBrands]);

  const patternMap = useMemo(() => {
    return new Map(treadPatterns.map((item) => [item.id, item.name]));
  }, [treadPatterns]);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  const customerName = receipt?.customers?.[0]?.name || "-";
  const printDate = receipt?.collection_date
    ? new Date(receipt.collection_date).toLocaleString("tr-TR")
    : "-";

  return (
    <>
      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 4mm;
        }

        @media print {
          html,
          body {
            background: #fff;
          }

          .no-print {
            display: none !important;
          }

          .thermal-paper {
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-gray-100 p-4">
        <div className="no-print mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border bg-white px-4 py-2"
          >
            Yazdır
          </button>

          <button
            type="button"
            onClick={() => window.close()}
            className="rounded border bg-white px-4 py-2"
          >
            Kapat
          </button>
        </div>

        <div className="thermal-paper mx-auto w-[72mm] bg-white p-3 text-[11px] leading-[1.35] text-black">
          <div className="text-center">
            <div className="text-[15px] font-bold">KRG KAPLAMA TAKİP</div>
            <div className="mt-1 text-[12px] font-semibold">TESLİM ALMA FİŞİ</div>
          </div>

          <div className="my-3 border-t border-dashed border-black" />

          <div className="space-y-1">
            <div>
              <strong>Fiş No:</strong> {receipt?.receipt_no || "-"}
            </div>
            <div>
              <strong>Tarih:</strong> {printDate}
            </div>
            <div>
              <strong>Müşteri:</strong> {customerName}
            </div>
            <div>
              <strong>Teslim Eden:</strong> {receipt?.delivered_by || "-"}
            </div>
            <div>
              <strong>Adet:</strong> {tyres.length}
            </div>
          </div>

          {receipt?.description ? (
            <>
              <div className="my-3 border-t border-dashed border-black" />
              <div>
                <strong>Fiş Açıklama:</strong>
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words">
                {receipt.description}
              </div>
            </>
          ) : null}

          <div className="my-3 border-t border-dashed border-black" />

          <div className="space-y-3">
            {tyres.map((tyre, index) => {
              const retreadBrandName = tyre.retread_brand_id
                ? brandMap.get(tyre.retread_brand_id) || "-"
                : "-";

              const treadPatternName = tyre.tread_pattern_id
                ? patternMap.get(tyre.tread_pattern_id) || ""
                : "";

              const showRetread = tyre.collection_type === "Kaplama";

              return (
                <div key={tyre.id} className="break-inside-avoid">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold">{index + 1}. LASTİK</div>
                    <div className="font-bold">
                      {Number(tyre.sale_price || 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="text-center text-[12px] font-bold uppercase">
  {tyre.collection_type || "-"}
</div>

                    <div>
                      <strong>EBAT:</strong> {tyre.size || "-"}
                    </div>

                    <div className="break-words">
                      <strong>MARKA:</strong> {tyre.original_brand || "-"}{" "}
                      {tyre.original_pattern || ""}
                    </div>

                    {showRetread ? (
                      <div className="break-words">
                        <strong>KAPLAMA:</strong> {retreadBrandName}{" "}
                        {treadPatternName}
                      </div>
                    ) : null}

                    {tyre.description ? (
                      <div className="break-words">
                        <strong>AÇIKLAMA:</strong> {tyre.description}
                      </div>
                    ) : null}

                    <div className="pt-2 text-center text-[12px] font-bold">
                      SERİ NO = {tyre.serial_no || "-"}
                    </div>
                  </div>

                  {index !== tyres.length - 1 ? (
                    <div className="mt-3 border-t border-dashed border-black" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="my-3 border-t border-dashed border-black" />

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[12px] font-bold">
              <span>TOPLAM</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="my-4 border-t border-dashed border-black" />

          <div className="space-y-6 pt-2">
            <div>
              <div className="font-medium">Teslim Eden İmza</div>
              <div className="mt-6 border-t border-black" />
            </div>

            <div>
              <div className="font-medium">Teslim Alan İmza</div>
              <div className="mt-6 border-t border-black" />
            </div>
          </div>

          <div className="mt-6 text-center text-[10px]">
            Bu belge teslim alma amaçlı düzenlenmiştir.
          </div>
        </div>
      </main>
    </>
  );
}