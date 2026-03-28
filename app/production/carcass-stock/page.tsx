"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { formatDate } from "@/src/lib/formatters";
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
  factory_arrived_at: string | null;
  collection_receipt_id: number | null;
  status: string;
};

type Receipt = {
  id: number;
  receipt_no: string;
  customer_id: number;
  collection_date: string | null;
  delivered_by: string | null;
};

type Customer = {
  id: number;
  name: string;
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

export default function CarcassStockPage() {
  return (
    <PermissionGuard
      permission="production.view"
      title="Karkas kontrol sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <CarcassStockPageContent />
    </PermissionGuard>
  );
}

function CarcassStockPageContent() {
  const { permissionState } = usePermissionState();

  const canApproveCarcass = can(permissionState, "production.start");
  const canRejectCarcass = can(permissionState, "production.reject");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [rejectTyreId, setRejectTyreId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [tyresRes, receiptsRes, customersRes] = await Promise.all([
        supabase
          .from("tyres")
          .select(
            "id, serial_no, collection_type, size, original_brand, original_pattern, factory_arrived_at, collection_receipt_id, status"
          )
          .eq("collection_type", "Karkas Satın Alma")
          .in("status", ["approved_for_production", "carcass_stocked"])
          .order("id", { ascending: false }),

        supabase
          .from("collection_receipts")
          .select("id, receipt_no, customer_id, collection_date, delivered_by")
          .order("id", { ascending: false }),

        supabase.from("customers").select("id, name").order("name"),
      ]);

      const firstError = [tyresRes.error, receiptsRes.error, customersRes.error].find(
        Boolean
      );
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setTyres((tyresRes.data || []) as Tyre[]);
      setReceipts((receiptsRes.data || []) as Receipt[]);
      setCustomers((customersRes.data || []) as Customer[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const receiptMap = useMemo(() => new Map(receipts.map((r) => [r.id, r])), [receipts]);
  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const pendingTyres = useMemo(
    () => tyres.filter((t) => t.status === "approved_for_production"),
    [tyres]
  );
  const stockedTyres = useMemo(
    () => tyres.filter((t) => t.status === "carcass_stocked"),
    [tyres]
  );

  async function handleApproveCarcass(id: number) {
    if (!canApproveCarcass) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const confirmed = window.confirm(
      "Bu karkas uygun bulundu, karkas stoğuna alınsın mı?"
    );
    if (!confirmed) return;

    setSubmittingId(id);

    const { error } = await supabase
      .from("tyres")
      .update({
        status: "carcass_stocked",
        rejection_stage: null,
        rejection_reason: null,
        rejection_note: null,
        rejection_return_shipped: false,
        rejection_return_shipped_at: null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setSubmittingId(null);
      return;
    }

    await writeAuditLog({
      action: "carcass_stock_approve",
      entity_table: "tyres",
      entity_id: id,
      description: "Operatör karkası uygun buldu ve karkas stoğuna aldı",
      payload: {
        tyre_id: id,
        new_status: "carcass_stocked",
      },
    });

    setTyres((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "carcass_stocked" } : t))
    );
    setSubmittingId(null);
  }

  function openRejectModal(id: number) {
    if (!canRejectCarcass) {
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

  async function handleRejectCarcass() {
    if (!canRejectCarcass) {
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
      action: "carcass_stock_reject",
      entity_table: "tyres",
      entity_id: rejectTyreId,
      description: "Operatör karkası uygun bulmadı ve reddetti",
      payload: {
        tyre_id: rejectTyreId,
        rejection_stage: "operator",
        rejection_reason: rejectReason,
        rejection_note: rejectReason === "Diğer" ? rejectNote.trim() : null,
      },
    });

    setTyres((prev) => prev.filter((t) => t.id !== rejectTyreId));
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
    <main className="space-y-4 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Karkas Uygunluk ve Stok</h1>
            <p className="mt-1 text-sm text-slate-600">
              Yönetici onayından geçen karkaslar için operatör uygunluk kontrolü.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-50 px-4 py-2 text-center">
              <div className="text-xs text-amber-700">Operatör Onayı Bekleyen</div>
              <div className="text-2xl font-bold text-amber-900">{pendingTyres.length}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-center">
              <div className="text-xs text-emerald-700">Karkas Stokta</div>
              <div className="text-2xl font-bold text-emerald-900">{stockedTyres.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Operatör Onayı Bekleyen Karkaslar</h2>
        </div>

        {pendingTyres.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Operatör uygunluk onayı bekleyen karkas yok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Marka</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Desen</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Fiş No</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Müşteri</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Teslim Eden</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Fabrikaya Geliş</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pendingTyres.map((tyre) => {
                  const receipt = tyre.collection_receipt_id
                    ? receiptMap.get(tyre.collection_receipt_id)
                    : null;
                  const customerName = receipt
                    ? customerMap.get(receipt.customer_id) || "-"
                    : "-";

                  return (
                    <tr key={tyre.id} className="border-b border-slate-100 bg-white">
                      <td className="p-3 text-sm font-medium text-slate-900">{tyre.serial_no}</td>
                      <td className="p-3 text-sm text-slate-700">{tyre.size || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{tyre.original_brand || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{tyre.original_pattern || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{receipt?.receipt_no || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{customerName}</td>
                      <td className="p-3 text-sm text-slate-700">{receipt?.delivered_by || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{formatDate(tyre.factory_arrived_at)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {canApproveCarcass ? (
                            <button
                              type="button"
                              onClick={() => handleApproveCarcass(tyre.id)}
                              disabled={submittingId === tyre.id}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {submittingId === tyre.id ? "İşleniyor..." : "Uygun, Stoğa Al"}
                            </button>
                          ) : null}

                          {canRejectCarcass ? (
                            <button
                              type="button"
                              onClick={() => openRejectModal(tyre.id)}
                              disabled={submittingId === tyre.id}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              {submittingId === tyre.id ? "İşleniyor..." : "Uygun Değil, Reddet"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Karkas Stokta Olanlar</h2>
        </div>

        {stockedTyres.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Karkas stok kaydı yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Fiş No</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Müşteri</th>
                  <th className="p-3 text-xs font-semibold text-slate-600">Fabrikaya Geliş</th>
                </tr>
              </thead>
              <tbody>
                {stockedTyres.map((tyre) => {
                  const receipt = tyre.collection_receipt_id
                    ? receiptMap.get(tyre.collection_receipt_id)
                    : null;
                  const customerName = receipt
                    ? customerMap.get(receipt.customer_id) || "-"
                    : "-";

                  return (
                    <tr key={tyre.id} className="border-b border-slate-100 bg-white">
                      <td className="p-3 text-sm font-medium text-slate-900">{tyre.serial_no}</td>
                      <td className="p-3 text-sm text-slate-700">{tyre.size || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{receipt?.receipt_no || "-"}</td>
                      <td className="p-3 text-sm text-slate-700">{customerName}</td>
                      <td className="p-3 text-sm text-slate-700">{formatDate(tyre.factory_arrived_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rejectTyreId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Karkas Red Nedeni</h3>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Red Nedeni
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seçiniz</option>
                  {rejectionReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>

              {rejectReason === "Diğer" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Açıklama
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Red açıklaması"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleRejectCarcass}
                disabled={submittingId === rejectTyreId}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submittingId === rejectTyreId ? "İşleniyor..." : "Reddet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
