"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";

type Tyre = {
  id: number;
  serial_no: string;
  collection_type: string | null;
  size: string | null;
  original_brand: string | null;
  original_pattern: string | null;
  status: string;
};

const rejectionReasons = [
  "Karkas Uygun Değil",
  "Yanak Hasarlı",
  "Tel Kırığı",
  "Boncuk Hasarı",
  "Aşırı Yıpranma",
  "Ölçü Uygun Değil",
  "Tamire Uygun Değil",
  "Diğer",
] as const;

export default function ProductionPage() {
  return (
    <PermissionGuard
      permission="production.view"
      title="Üretim sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <ProductionPageContent />
    </PermissionGuard>
  );
}

function ProductionPageContent() {
  const { permissionState } = usePermissionState();

  const canStartProduction = can(permissionState, "production.start");
  const canRejectProduction = can(permissionState, "production.reject");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [tyres, setTyres] = useState<Tyre[]>([]);

  const [rejectTyreId, setRejectTyreId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");

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
        .eq("status", "approved_for_production")
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

  async function handleStartProduction(id: number) {
    if (!canStartProduction) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const confirmed = window.confirm("Bu lastik üretime alınsın mı?");
    if (!confirmed) return;

    setSubmittingId(id);

    const { error } = await supabase
      .from("tyres")
      .update({
        status: "in_production",
        rejection_stage: null,
        rejection_reason: null,
        rejection_note: null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setSubmittingId(null);
      return;
    }

    await writeAuditLog({
      action: "production_start",
      entity_table: "tyres",
      entity_id: id,
      description: "Lastik üretime alındı",
      payload: {
        tyre_id: id,
        new_status: "in_production",
      },
    });

    setTyres((prev) => prev.filter((tyre) => tyre.id !== id));
    setSubmittingId(null);
  }

  function openRejectModal(id: number) {
    if (!canRejectProduction) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    setRejectTyreId(id);
    setRejectReason("");
    setRejectNote("");
  }

  function closeRejectModal() {
    setRejectTyreId(null);
    setRejectReason("");
    setRejectNote("");
  }

  async function handleOperatorReject() {
    if (!canRejectProduction) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!rejectTyreId) return;

    if (!rejectReason) {
      alert("Red nedeni seçmelisin.");
      return;
    }

    if (rejectReason === "Diğer" && !rejectNote.trim()) {
      alert("Diğer seçtiğinde açıklama yazmalısın.");
      return;
    }

    setSubmittingId(rejectTyreId);

    const { error } = await supabase
      .from("tyres")
      .update({
        status: "rejected",
        rejection_stage: "operator",
        rejection_reason: rejectReason,
        rejection_note: rejectReason === "Diğer" ? rejectNote.trim() : null,
        rejection_return_shipped: false,
        rejection_return_shipped_at: null,
      })
      .eq("id", rejectTyreId);

    if (error) {
      alert(error.message);
      setSubmittingId(null);
      return;
    }

    await writeAuditLog({
      action: "operator_reject",
      entity_table: "tyres",
      entity_id: rejectTyreId,
      description: "Operatör lastiği reddetti",
      payload: {
        tyre_id: rejectTyreId,
        rejection_stage: "operator",
        rejection_reason: rejectReason,
        rejection_note: rejectReason === "Diğer" ? rejectNote.trim() : null,
      },
    });

    setTyres((prev) => prev.filter((tyre) => tyre.id !== rejectTyreId));
    setSubmittingId(null);
    closeRejectModal();
  }

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Üretime Onaylananlar</h1>

      <div className="mt-6 rounded border p-4">
        <h2 className="text-lg font-semibold">Üretime Onaylanan Lastikler</h2>

        {tyres.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">
            Üretime onaylanan lastik yok
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse min-w-[1050px]">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Seri No</th>
                  <th className="p-2">Talep Edilen İşlem</th>
                  <th className="p-2">Ebat</th>
                  <th className="p-2">Marka</th>
                  <th className="p-2">Desen</th>
                  <th className="p-2">Durum</th>
                  <th className="p-2">İşlem</th>
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
                    <td className="p-2">Üretime Hazır</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        {canStartProduction ? (
                          <button
                            type="button"
                            onClick={() => handleStartProduction(tyre.id)}
                            disabled={submittingId === tyre.id}
                            className="rounded border px-3 py-1"
                          >
                            {submittingId === tyre.id
                              ? "İşleniyor..."
                              : "Üretime Al"}
                          </button>
                        ) : null}

                        {canRejectProduction ? (
                          <button
                            type="button"
                            onClick={() => openRejectModal(tyre.id)}
                            disabled={submittingId === tyre.id}
                            className="rounded border px-3 py-1"
                          >
                            Operatör Red
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectTyreId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border bg-white p-4">
            <h2 className="text-lg font-semibold">Operatör Red</h2>

            <div className="mt-4">
              <label className="block mb-1 font-medium">Red Nedeni</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="">Seçiniz</option>
                {rejectionReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {rejectReason === "Diğer" ? (
              <div className="mt-4">
                <label className="block mb-1 font-medium">Açıklama</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={4}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded border px-4 py-2"
              >
                Vazgeç
              </button>

              {canRejectProduction ? (
                <button
                  type="button"
                  onClick={handleOperatorReject}
                  className="rounded border px-4 py-2"
                >
                  Reddet
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}