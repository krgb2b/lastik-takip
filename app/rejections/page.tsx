"use client";

import { useEffect, useMemo, useState } from "react";
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
  rejection_stage: string | null;
  rejection_reason: string | null;
  rejection_note: string | null;
  rejection_return_shipped: boolean;
};

type FilterType = "all" | "manager" | "operator";

export default function RejectionsPage() {
  return (
    <PermissionGuard
      permission="rejected_tyres.view"
      title="Reddedilen Lastikler sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <RejectionsPageContent />
    </PermissionGuard>
  );
}

function RejectionsPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
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
          status,
          rejection_stage,
          rejection_reason,
          rejection_note,
          rejection_return_shipped
        `)
        .eq("status", "rejected")
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

  const filteredTyres = useMemo(() => {
    if (filter === "manager") {
      return tyres.filter((tyre) => tyre.rejection_stage === "manager");
    }

    if (filter === "operator") {
      return tyres.filter((tyre) => tyre.rejection_stage === "operator");
    }

    return tyres;
  }, [tyres, filter]);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Reddedilen Lastikler</h1>

      <div className="mt-6 rounded border p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="rounded border px-3 py-1"
          >
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setFilter("manager")}
            className="rounded border px-3 py-1"
          >
            Yönetici Redleri
          </button>
          <button
            type="button"
            onClick={() => setFilter("operator")}
            className="rounded border px-3 py-1"
          >
            Operatör Redleri
          </button>
        </div>

        {filteredTyres.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">Kayıt yok</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1150px] border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Seri No</th>
                  <th className="p-2">Talep Edilen İşlem</th>
                  <th className="p-2">Ebat</th>
                  <th className="p-2">Marka</th>
                  <th className="p-2">Desen</th>
                  <th className="p-2">Red Aşaması</th>
                  <th className="p-2">Red Nedeni</th>
                  <th className="p-2">Not</th>
                  <th className="p-2">İade Sevk</th>
                </tr>
              </thead>
              <tbody>
                {filteredTyres.map((tyre) => (
                  <tr key={tyre.id} className="border-b">
                    <td className="p-2">{tyre.serial_no}</td>
                    <td className="p-2">{tyre.collection_type || "-"}</td>
                    <td className="p-2">{tyre.size || "-"}</td>
                    <td className="p-2">{tyre.original_brand || "-"}</td>
                    <td className="p-2">{tyre.original_pattern || "-"}</td>
                    <td className="p-2">
                      {tyre.rejection_stage === "manager"
                        ? "Yönetici"
                        : tyre.rejection_stage === "operator"
                          ? "Operatör"
                          : "-"}
                    </td>
                    <td className="p-2">{tyre.rejection_reason || "-"}</td>
                    <td className="p-2">{tyre.rejection_note || "-"}</td>
                    <td className="p-2">
                      {tyre.rejection_stage === "manager"
                        ? tyre.rejection_return_shipped
                          ? "Sevk Edildi"
                          : "Bekliyor"
                        : "-"}
                    </td>
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