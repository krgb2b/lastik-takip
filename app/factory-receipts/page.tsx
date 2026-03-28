"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { formatTyreStatus } from "@/src/lib/formatters";

type Receipt = {
  id: number;
  receipt_no: string;
  delivered_by: string | null;
  collection_date: string | null;
  description: string | null;
  customer_id: number;
};

type Customer = {
  id: number;
  name: string;
};

type Tyre = {
  id: number;
  collection_receipt_id: number | null;
  serial_no: string;
  collection_type: string | null;
  size: string | null;
  original_brand: string | null;
  original_pattern: string | null;
  status: string;
};

export default function FactoryReceiptsPage() {
  return (
    <PermissionGuard
      permission="collections.view"
      title="Fabrikaya Giriş sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <FactoryReceiptsPageContent />
    </PermissionGuard>
  );
}

function FactoryReceiptsPageContent() {
  const { permissionState } = usePermissionState();
  const canCreateCollection = can(permissionState, "collections.create");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);

  const [expandedReceiptIds, setExpandedReceiptIds] = useState<number[]>([]);
  const [selectedTyreIds, setSelectedTyreIds] = useState<number[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [receiptsRes, customersRes, tyresRes] = await Promise.all([
        supabase
          .from("collection_receipts")
          .select(
            "id, receipt_no, delivered_by, collection_date, description, customer_id"
          )
          .order("id", { ascending: false }),

        supabase.from("customers").select("id, name").order("name"),

        supabase
  .from("tyres")
  .select(`
    id,
    collection_receipt_id,
    serial_no,
    collection_type,
    size,
    original_brand,
    original_pattern,
    status
  `)
  .eq("status", "collected")
  .order("id", { ascending: true }),
      ]);

      const firstError = [
        receiptsRes.error,
        customersRes.error,
        tyresRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("Factory receipts load error:", firstError.message, {
          receiptsRes,
          customersRes,
          tyresRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setReceipts((receiptsRes.data || []) as Receipt[]);
      setCustomers((customersRes.data || []) as Customer[]);
      setTyres((tyresRes.data || []) as Tyre[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c.name]));
  }, [customers]);

  const tyresByReceipt = useMemo(() => {
    const map = new Map<number, Tyre[]>();

    for (const tyre of tyres) {
      if (!tyre.collection_receipt_id) continue;

      if (!map.has(tyre.collection_receipt_id)) {
        map.set(tyre.collection_receipt_id, []);
      }

      map.get(tyre.collection_receipt_id)!.push(tyre);
    }

    return map;
  }, [tyres]);

  const visibleReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const receiptTyres = tyresByReceipt.get(receipt.id) || [];
      return receiptTyres.length > 0;
    });
  }, [receipts, tyresByReceipt]);

  const totalPendingTyres = useMemo(() => tyres.length, [tyres]);

  const totalPendingReceipts = useMemo(() => visibleReceipts.length, [visibleReceipts]);

  function toggleExpanded(receiptId: number) {
    setExpandedReceiptIds((prev) =>
      prev.includes(receiptId)
        ? prev.filter((id) => id !== receiptId)
        : [...prev, receiptId]
    );
  }

  function isReceiptFullySelected(receiptId: number) {
    const receiptTyres = tyresByReceipt.get(receiptId) || [];
    if (receiptTyres.length === 0) return false;

    return receiptTyres.every((tyre) => selectedTyreIds.includes(tyre.id));
  }

  function isReceiptPartiallySelected(receiptId: number) {
    const receiptTyres = tyresByReceipt.get(receiptId) || [];
    if (receiptTyres.length === 0) return false;

    const selectedCount = receiptTyres.filter((tyre) =>
      selectedTyreIds.includes(tyre.id)
    ).length;

    return selectedCount > 0 && selectedCount < receiptTyres.length;
  }

  function toggleReceiptSelection(receiptId: number) {
    const receiptTyres = tyresByReceipt.get(receiptId) || [];
    const receiptTyreIds = receiptTyres.map((tyre) => tyre.id);

    if (receiptTyreIds.length === 0) return;

    const allSelected = receiptTyreIds.every((id) => selectedTyreIds.includes(id));

    if (allSelected) {
      setSelectedTyreIds((prev) => prev.filter((id) => !receiptTyreIds.includes(id)));
    } else {
      setSelectedTyreIds((prev) => Array.from(new Set([...prev, ...receiptTyreIds])));
    }
  }

  function toggleTyreSelection(tyreId: number) {
    setSelectedTyreIds((prev) =>
      prev.includes(tyreId)
        ? prev.filter((id) => id !== tyreId)
        : [...prev, tyreId]
    );
  }

  async function handleFactoryReceive() {
    if (!canCreateCollection) return;

    if (selectedTyreIds.length === 0) {
      alert("Önce lastik seçmelisin.");
      return;
    }

    const confirmed = window.confirm("Seçilen lastikler fabrikaya alınsın mı?");
    if (!confirmed) return;

    setSubmitting(true);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("tyres")
      .update({
        status: "factory_received",
        factory_arrived_at: now,
        factory_received_by: "Fabrika Giriş",
      })
      .in("id", selectedTyreIds);

    if (error) {
      alert(error.message);
      setSubmitting(false);
      return;
    }

    setTyres((prev) => prev.filter((tyre) => !selectedTyreIds.includes(tyre.id)));
    setSelectedTyreIds([]);
    alert("Seçilen lastikler fabrikaya alındı.");
    setSubmitting(false);
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
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fabrikaya Giriş</h1>
            <p className="mt-1 text-sm text-slate-600">
              Fabrikaya ulaşan lastikleri fiş bazında kontrol edip toplu şekilde
              kabul edebilirsin.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Seçilen lastik: <strong>{selectedTyreIds.length}</strong>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Bekleyen Fiş"
          value={String(totalPendingReceipts)}
          description="fabrikaya girişi tamamlanmamış fiş"
        />
        <SummaryCard
          title="Bekleyen Lastik"
          value={String(totalPendingTyres)}
          description="kabul bekleyen toplam lastik"
        />
        <SummaryCard
          title="Seçilen Lastik"
          value={String(selectedTyreIds.length)}
          description="işleme alınmaya hazır seçim"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Fabrikaya Gelmemiş Fişler
            </h2>
            <p className="text-sm text-slate-600">
              Her fişin içindeki lastikleri açıp tek tek veya toplu seçebilirsin.
            </p>
          </div>

          <button
            type="button"
            onClick={handleFactoryReceive}
            disabled={submitting || selectedTyreIds.length === 0 || !canCreateCollection}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "İşleniyor..." : "Seçilenleri Fabrikaya Al"}
          </button>
        </div>

        {visibleReceipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Fabrikaya gelmemiş fiş bulunamadı.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleReceipts.map((receipt) => {
              const receiptTyres = tyresByReceipt.get(receipt.id) || [];
              const expanded = expandedReceiptIds.includes(receipt.id);
              const fullySelected = isReceiptFullySelected(receipt.id);
              const partiallySelected = isReceiptPartiallySelected(receipt.id);

              return (
                <div
                  key={receipt.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(receipt.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        {expanded ? "−" : "+"}
                      </button>

                      <input
                        type="checkbox"
                        checked={fullySelected}
                        ref={(el) => {
                          if (el) el.indeterminate = partiallySelected;
                        }}
                        onChange={() => toggleReceiptSelection(receipt.id)}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
                        <div className="font-semibold text-slate-900">
                          {receipt.receipt_no}
                        </div>
                        <div className="text-sm text-slate-600">
                          {customerMap.get(receipt.customer_id) || "-"}
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>Teslim Eden: {receipt.delivered_by || "-"}</span>
                        <span>
                          Tarih:{" "}
                          {receipt.collection_date
                            ? new Date(receipt.collection_date).toLocaleString("tr-TR")
                            : "-"}
                        </span>
                        <span>Lastik: {receiptTyres.length}</span>
                      </div>

                      {receipt.description ? (
                        <div className="mt-2 text-sm text-slate-600">
                          Açıklama: {receipt.description}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <SelectionBadge
                        fullySelected={fullySelected}
                        partiallySelected={partiallySelected}
                      />
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/50">
                      <div className="overflow-x-auto">
                        <table className="min-w-[980px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600"></th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Seri No
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Talep Edilen İşlem
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Ebat
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Marka
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Desen
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Durum
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptTyres.map((tyre) => (
                              <tr key={tyre.id} className="border-b border-slate-100 bg-white">
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTyreIds.includes(tyre.id)}
                                    onChange={() => toggleTyreSelection(tyre.id)}
                                  />
                                </td>
                                <td className="p-3 text-sm font-medium text-slate-900">
                                  {tyre.serial_no}
                                </td>
                                <td className="p-3 text-sm text-slate-700">
                                  {tyre.collection_type || "-"}
                                </td>
                                <td className="p-3 text-sm text-slate-700">
                                  {tyre.size || "-"}
                                </td>
                                <td className="p-3 text-sm text-slate-700">
                                  {tyre.original_brand || "-"}
                                </td>
                                <td className="p-3 text-sm text-slate-700">
                                  {tyre.original_pattern || "-"}
                                </td>
                                <td className="p-3 text-sm">
                                  <StatusBadge status={tyre.status} />
                                </td>
                              </tr>
                            ))}
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
    </main>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </div>
  );
}

function SelectionBadge({
  fullySelected,
  partiallySelected,
}: {
  fullySelected: boolean;
  partiallySelected: boolean;
}) {
  if (fullySelected) {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        Tümü seçili
      </span>
    );
  }

  if (partiallySelected) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        Kısmi seçim
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Seçilmedi
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    collected: "bg-slate-100 text-slate-700",
    factory_received: "bg-sky-100 text-sky-700",
    approved_for_production: "bg-indigo-100 text-indigo-700",
    in_production: "bg-amber-100 text-amber-700",
    stocked: "bg-emerald-100 text-emerald-700",
    shipped: "bg-violet-100 text-violet-700",
    rejected: "bg-rose-100 text-rose-700",
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {formatTyreStatus(status)}
    </span>
  );
}