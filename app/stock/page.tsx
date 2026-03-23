"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";

type Tyre = {
  id: number;
  serial_no: string;
  collection_type: string | null;
  size: string | null;
  original_brand: string | null;
  original_pattern: string | null;
  status: string;
};

export default function StockPage() {
  return (
    <PermissionGuard
      permission="stock.view"
      title="Stok sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <StockPageContent />
    </PermissionGuard>
  );
}

function StockPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tyres, setTyres] = useState<Tyre[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("tyres")
        .select(`
          id,
          serial_no,
          collection_type,
          size,
          original_brand,
          original_pattern,
          status
        `)
        .eq("status", "stocked")
        .order("id", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setTyres((data || []) as Tyre[]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Stok</h1>

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Stoğa Giren Lastikler</h2>

        {tyres.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">Stokta lastik yok</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Seri No</th>
                  <th className="p-2">Talep Edilen İşlem</th>
                  <th className="p-2">Ebat</th>
                  <th className="p-2">Marka</th>
                  <th className="p-2">Desen</th>
                  <th className="p-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {tyres.map((tyre) => (
                  <tr key={tyre.id} className="border-b">
                    <td className="p-2">{tyre.serial_no}</td>
                    <td className="p-2">{tyre.collection_type || "-"}</td>
                    <td className="p-2">{tyre.size || "-"}</td>
                    <td className="p-2">{tyre.original_brand || "-"}</td>
                    <td className="p-2">{tyre.original_pattern || "-"}</td>
                    <td className="p-2">Stokta</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}