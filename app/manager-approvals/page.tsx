"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";
import { formatTyreStatus } from "@/src/lib/formatters";

type Tyre = {
  id: number;
  collection_receipt_id: number | null;
  serial_no: string;
  collection_type: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  retread_brand_id: number | null;
  tread_pattern_id: number | null;
  factory_arrived_at: string | null;
  factory_received_by: string | null;
  status: string;
  rejection_stage: string | null;
  rejection_reason: string | null;
  rejection_note: string | null;
  rejection_return_shipped: boolean;
};

type Receipt = {
  id: number;
  receipt_no: string;
  customer_id: number;
  collection_date: string | null;
  delivered_by: string | null;
  payment_type: string | null;
  payment_due_date: string | null;
  description: string | null;
};

type Customer = {
  id: number;
  name: string;
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

type FilterType = "pending" | "rejected_not_shipped" | "rejected_shipped";

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateNoSeconds(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ManagerApprovalsPage() {
  return (
    <PermissionGuard
      permission="manager_approval.view"
      title="Yönetici Onayı sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <ManagerApprovalsPageContent />
    </PermissionGuard>
  );
}

function ManagerApprovalsPageContent() {
  const { permissionState } = usePermissionState();

  const canApprove = can(permissionState, "manager_approval.approve");
  const canReject = can(permissionState, "manager_approval.reject");
  const canReapprove = can(permissionState, "manager_approval.reapprove");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [submittingReceiptId, setSubmittingReceiptId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<number[]>([]);

  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [tyresRes, receiptsRes, customersRes, retreadBrandsRes, treadPatternsRes] =
        await Promise.all([
          supabase
            .from("tyres")
            .select(`
              id,
              collection_receipt_id,
              serial_no,
              collection_type,
              size,
              sale_price,
              original_brand,
              original_pattern,
              retread_brand_id,
              tread_pattern_id,
              factory_arrived_at,
              factory_received_by,
              status,
              rejection_stage,
              rejection_reason,
              rejection_note,
              rejection_return_shipped
            `)
            .or(
              "status.eq.factory_received,and(status.eq.rejected,rejection_stage.eq.manager)"
            )
            .order("factory_arrived_at", { ascending: false }),

          supabase
            .from("collection_receipts")
            .select(
               "id, receipt_no, customer_id, collection_date, delivered_by, payment_type, payment_due_date, description"
              )
  .order("id", { ascending: false }),

          supabase.from("customers").select("id, name").order("name"),

          supabase.from("retread_brands").select("id, name").order("name"),

          supabase
            .from("tread_patterns")
            .select("id, brand_id, name")
            .order("name"),
        ]);

      const firstError = [
        tyresRes.error,
        receiptsRes.error,
        customersRes.error,
        retreadBrandsRes.error,
        treadPatternsRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("Manager approvals load error:", firstError.message, {
          tyresRes,
          receiptsRes,
          customersRes,
          retreadBrandsRes,
          treadPatternsRes,
        });
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setTyres((tyresRes.data || []) as Tyre[]);
      setReceipts((receiptsRes.data || []) as Receipt[]);
      setCustomers((customersRes.data || []) as Customer[]);
      setRetreadBrands((retreadBrandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((treadPatternsRes.data || []) as TreadPattern[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const retreadBrandMap = useMemo(
    () => new Map(retreadBrands.map((b) => [b.id, b.name])),
    [retreadBrands]
  );

  const treadPatternMap = useMemo(
    () => new Map(treadPatterns.map((p) => [p.id, p.name])),
    [treadPatterns]
  );

  const pendingTyres = useMemo(
    () => tyres.filter((t) => t.status === "factory_received"),
    [tyres]
  );

  const rejectedNotShippedTyres = useMemo(
    () =>
      tyres.filter(
        (t) =>
          t.status === "rejected" &&
          t.rejection_stage === "manager" &&
          !t.rejection_return_shipped
      ),
    [tyres]
  );

  const rejectedShippedTyres = useMemo(
    () =>
      tyres.filter(
        (t) =>
          t.status === "rejected" &&
          t.rejection_stage === "manager" &&
          t.rejection_return_shipped
      ),
    [tyres]
  );

  const filteredTyres = useMemo(() => {
    if (filter === "pending") return pendingTyres;
    if (filter === "rejected_not_shipped") return rejectedNotShippedTyres;
    return rejectedShippedTyres;
  }, [filter, pendingTyres, rejectedNotShippedTyres, rejectedShippedTyres]);

  const filteredTyresByReceipt = useMemo(() => {
    const map = new Map<number, Tyre[]>();

    for (const tyre of filteredTyres) {
      if (!tyre.collection_receipt_id) continue;
      if (!map.has(tyre.collection_receipt_id)) {
        map.set(tyre.collection_receipt_id, []);
      }
      map.get(tyre.collection_receipt_id)!.push(tyre);
    }

    return map;
  }, [filteredTyres]);

  const visibleReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const receiptTyres = filteredTyresByReceipt.get(receipt.id) || [];
      return receiptTyres.length > 0;
    });
  }, [receipts, filteredTyresByReceipt]);

  function toggleExpanded(receiptId: number) {
    setExpandedReceiptIds((prev) =>
      prev.includes(receiptId)
        ? prev.filter((id) => id !== receiptId)
        : [...prev, receiptId]
    );
  }

  async function handleApprove(id: number, isReapprove: boolean) {
    if (isReapprove) {
      if (!canReapprove) {
        alert("Bu işlem için yetkin yok.");
        return;
      }
    } else {
      if (!canApprove) {
        alert("Bu işlem için yetkin yok.");
        return;
      }
    }

    const tyre = tyres.find((t) => t.id === id);
    const isCarcass = tyre?.collection_type === "Karkas Satın Alma";
    const newStatus = "approved_for_production";
    const confirmMessage = isCarcass
      ? "Bu karkas lastik operatör uygunluk kontrolüne gönderilsin mi?"
      : "Bu lastik üretime onaylansın mı?";

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setSubmittingId(id);

    const { data, error } = await supabase
      .from("tyres")
      .update({
        status: newStatus,
        rejection_stage: null,
        rejection_reason: null,
        rejection_note: null,
        rejection_return_shipped: false,
        rejection_return_shipped_at: null,
      })
      .eq("id", id)
      .select("id");

    if (error) {
      alert(error.message);
      setSubmittingId(null);
      return;
    }

    if (!data || data.length === 0) {
      alert("Hiçbir kayıt güncellenemedi.");
      setSubmittingId(null);
      return;
    }

    await writeAuditLog({
      action: isReapprove ? "manager_reapprove" : "manager_approve",
      entity_table: "tyres",
      entity_id: id,
      description: isReapprove
        ? "Yönetici reddedilmiş lastiği tekrar onayladı"
        : "Yönetici lastiği üretime onayladı",
      payload: {
        tyre_id: id,
        is_reapprove: isReapprove,
      },
    });

    setTyres((prev) =>
      prev.map((tyre) =>
        tyre.id === id
          ? {
              ...tyre,
              status: newStatus,
              rejection_stage: null,
              rejection_reason: null,
              rejection_note: null,
              rejection_return_shipped: false,
            }
          : tyre
      )
    );

    setSubmittingId(null);
  }

  async function handleReject(id: number) {
    if (!canReject) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const confirmed = window.confirm("Bu lastik yönetici tarafından reddedilsin mi?");
    if (!confirmed) return;

    setSubmittingId(id);

    const { data, error } = await supabase
      .from("tyres")
      .update({
        status: "rejected",
        rejection_stage: "manager",
        rejection_reason: "Yönetici Red",
        rejection_note: null,
        rejection_return_shipped: false,
        rejection_return_shipped_at: null,
      })
      .eq("id", id)
      .select("id");

    if (error) {
      alert(error.message);
      setSubmittingId(null);
      return;
    }

    if (!data || data.length === 0) {
      alert("Hiçbir kayıt güncellenemedi.");
      setSubmittingId(null);
      return;
    }

    await writeAuditLog({
      action: "manager_reject",
      entity_table: "tyres",
      entity_id: id,
      description: "Yönetici lastiği reddetti",
      payload: {
        tyre_id: id,
        rejection_stage: "manager",
        rejection_reason: "Yönetici Red",
      },
    });

    setTyres((prev) =>
      prev.map((tyre) =>
        tyre.id === id
          ? {
              ...tyre,
              status: "rejected",
              rejection_stage: "manager",
              rejection_reason: "Yönetici Red",
              rejection_note: null,
              rejection_return_shipped: false,
            }
          : tyre
      )
    );

    setSubmittingId(null);
  }

  async function handleApproveReceipt(receiptId: number) {
    if (!canApprove) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const receiptTyres = (filteredTyresByReceipt.get(receiptId) || []).filter(
      (t) => t.status === "factory_received"
    );

    if (receiptTyres.length === 0) {
      alert("Bu fişte toplu onaylanacak kayıt yok.");
      return;
    }

    const confirmed = window.confirm(
      `Bu fişteki ${receiptTyres.length} lastik topluca onaylansın mı?`
    );
    if (!confirmed) return;

    setSubmittingReceiptId(receiptId);

    const ids = receiptTyres.map((t) => t.id);

    const sharedPayload = {
      rejection_stage: null,
      rejection_reason: null,
      rejection_note: null,
      rejection_return_shipped: false,
      rejection_return_shipped_at: null,
    };

    const { data, error } = await supabase
      .from("tyres")
      .update({ status: "approved_for_production", ...sharedPayload })
      .in("id", ids)
      .select("id");

    if (error) {
      alert(error.message);
      setSubmittingReceiptId(null);
      return;
    }

    const updatedIds = (data || []).map((x) => x.id);

    await writeAuditLog({
      action: "manager_approve_bulk",
      entity_table: "tyres",
      entity_id: receiptId,
      description: "Fiş bazlı toplu yönetici onayı",
      payload: {
        receipt_id: receiptId,
        tyre_ids: updatedIds,
      },
    });

    setTyres((prev) =>
      prev.map((tyre) =>
        updatedIds.includes(tyre.id)
          ? {
              ...tyre,
              status: "approved_for_production",
              rejection_stage: null,
              rejection_reason: null,
              rejection_note: null,
              rejection_return_shipped: false,
            }
          : tyre
      )
    );

    setSubmittingReceiptId(null);
  }

  async function handleRejectReceipt(receiptId: number) {
    if (!canReject) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const receiptTyres = (filteredTyresByReceipt.get(receiptId) || []).filter(
      (t) => t.status === "factory_received"
    );

    if (receiptTyres.length === 0) {
      alert("Bu fişte toplu reddedilecek kayıt yok.");
      return;
    }

    const confirmed = window.confirm(
      `Bu fişteki ${receiptTyres.length} lastik topluca reddedilsin mi?`
    );
    if (!confirmed) return;

    setSubmittingReceiptId(receiptId);

    const ids = receiptTyres.map((t) => t.id);

    const { data, error } = await supabase
      .from("tyres")
      .update({
        status: "rejected",
        rejection_stage: "manager",
        rejection_reason: "Yönetici Red",
        rejection_note: null,
        rejection_return_shipped: false,
        rejection_return_shipped_at: null,
      })
      .in("id", ids)
      .select("id");

    if (error) {
      alert(error.message);
      setSubmittingReceiptId(null);
      return;
    }

    const updatedIds = (data || []).map((x) => x.id);

    await writeAuditLog({
      action: "manager_reject_bulk",
      entity_table: "tyres",
      entity_id: receiptId,
      description: "Fiş bazlı toplu yönetici reddi",
      payload: {
        receipt_id: receiptId,
        tyre_ids: updatedIds,
      },
    });

    setTyres((prev) =>
      prev.map((tyre) =>
        updatedIds.includes(tyre.id)
          ? {
              ...tyre,
              status: "rejected",
              rejection_stage: "manager",
              rejection_reason: "Yönetici Red",
              rejection_note: null,
              rejection_return_shipped: false,
            }
          : tyre
      )
    );

    setSubmittingReceiptId(null);
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
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Yönetici Onayı</h1>
            <p className="mt-1 text-sm text-slate-600">
              Fiş bazlı incele, içeride satır bazlı veya fiş bazlı karar ver.
            </p>
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-2 text-sm">
            <CompactInfo label="Görünen Fiş" value={String(visibleReceipts.length)} />
            <CompactInfo label="Görünen Lastik" value={String(filteredTyres.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Onay Bekleyen" value={String(pendingTyres.length)} />
        <SummaryCard
          title="Red / Sevk Edilmemiş"
          value={String(rejectedNotShippedTyres.length)}
        />
        <SummaryCard
          title="Red / Sevk Edilmiş"
          value={String(rejectedShippedTyres.length)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterButton active={filter === "pending"} onClick={() => setFilter("pending")}>
            Onay Bekleyen
          </FilterButton>
          <FilterButton
            active={filter === "rejected_not_shipped"}
            onClick={() => setFilter("rejected_not_shipped")}
          >
            Yönetici Red / Sevk Edilmemiş
          </FilterButton>
          <FilterButton
            active={filter === "rejected_shipped"}
            onClick={() => setFilter("rejected_shipped")}
          >
            Yönetici Red / Sevk Edilmiş
          </FilterButton>
        </div>

        {visibleReceipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Bu filtrede gösterilecek fiş yok.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleReceipts.map((receipt) => {
              const receiptTyres = filteredTyresByReceipt.get(receipt.id) || [];
              const expanded = expandedReceiptIds.includes(receipt.id);

              const pendingCount = receiptTyres.filter(
                (t) => t.status === "factory_received"
              ).length;

              const rejectedCount = receiptTyres.filter(
                (t) => t.status === "rejected" && t.rejection_stage === "manager"
              ).length;

              const totalAmount = receiptTyres.reduce(
                (sum, t) => sum + Number(t.sale_price || 0),
                0
              );

              return (
                <div
                  key={receipt.id}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="p-4">
  <div className="flex items-start justify-between gap-4">
    <div className="flex min-w-0 flex-1 gap-3">
      <button
        type="button"
        onClick={() => toggleExpanded(receipt.id)}
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        {expanded ? "−" : "+"}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-base font-semibold text-slate-900">
            {receipt.receipt_no}
          </div>
          <div className="text-sm text-slate-600">
            {customerMap.get(receipt.customer_id) || "-"}
          </div>
          <Pill label={`Bekleyen: ${pendingCount}`} />
          <Pill label={`Red: ${rejectedCount}`} />
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          <InlineMeta
            label="Tarih"
            value={formatDateNoSeconds(receipt.collection_date)}
          />
          <InlineMeta
            label="Teslim Eden"
            value={receipt.delivered_by || "-"}
          />
          <InlineMeta
            label="Ödeme Tipi"
            value={receipt.payment_type || "-"}
          />
          <InlineMeta
            label="Ödeme Vadesi"
            value={
              receipt.payment_due_date
                ? formatDateNoSeconds(receipt.payment_due_date)
                : "-"
            }
          />
          <InlineMeta
            label="Toplam Lastik"
            value={String(receiptTyres.length)}
          />
          <InlineMeta
            label="Toplam Tutar"
            value={`${formatMoney(totalAmount)} TL`}
          />
        </div>

        {receipt.description ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Açıklama: {receipt.description}
          </div>
        ) : null}
      </div>
    </div>

    {filter === "pending" && pendingCount > 0 ? (
  <div className="shrink-0 xl:w-[220px]">
    <div className="flex flex-col gap-2">
      {canApprove ? (
        <button
          type="button"
          onClick={() => handleApproveReceipt(receipt.id)}
          disabled={submittingReceiptId === receipt.id}
          className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {submittingReceiptId === receipt.id
            ? "İşleniyor..."
            : "Fişteki Tümünü Onayla"}
        </button>
      ) : null}

      {canReject ? (
        <button
          type="button"
          onClick={() => handleRejectReceipt(receipt.id)}
          disabled={submittingReceiptId === receipt.id}
          className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          {submittingReceiptId === receipt.id
            ? "İşleniyor..."
            : "Fişteki Tümünü Reddet"}
        </button>
      ) : null}
    </div>
  </div>
) : null}
  </div>
</div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/40">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1400px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Talep Edilen İşlem</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Fiyat</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Fabrikaya Geliş</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Durum</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">İşlem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptTyres.map((tyre) => {
                              const isRejected = tyre.status === "rejected";

                              return (
                                <tr key={tyre.id} className="border-b border-slate-100 bg-white">
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
                                    {formatMoney(tyre.sale_price)} TL
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.original_brand || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.original_pattern || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.retread_brand_id
                                      ? retreadBrandMap.get(tyre.retread_brand_id) || "-"
                                      : "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.tread_pattern_id
                                      ? treadPatternMap.get(tyre.tread_pattern_id) || "-"
                                      : "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {formatDateNoSeconds(tyre.factory_arrived_at)}
                                  </td>
                                  <td className="p-3 text-sm">
                                    <StatusBadge tyre={tyre} />
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-wrap gap-2">
                                      {isRejected ? (
                                        canReapprove ? (
                                          <button
                                            type="button"
                                            onClick={() => handleApprove(tyre.id, true)}
                                            disabled={submittingId === tyre.id}
                                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                          >
                                            {submittingId === tyre.id
                                              ? "İşleniyor..."
                                              : "Tekrar Onayla"}
                                          </button>
                                        ) : null
                                      ) : (
                                        <>
                                          {canApprove ? (
                                            <button
                                              type="button"
                                              onClick={() => handleApprove(tyre.id, false)}
                                              disabled={submittingId === tyre.id}
                                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                              {submittingId === tyre.id ? "İşleniyor..." : "Onayla"}
                                            </button>
                                          ) : null}

                                          {canReject ? (
                                            <button
                                              type="button"
                                              onClick={() => handleReject(tyre.id)}
                                              disabled={submittingId === tyre.id}
                                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                            >
                                              {submittingId === tyre.id ? "İşleniyor..." : "Reddet"}
                                            </button>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InlineMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-[92px] text-xs text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}

function StatusBadge({ tyre }: { tyre: Tyre }) {
  if (tyre.status === "factory_received") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
        Onay Bekliyor
      </span>
    );
  }

  if (tyre.status === "rejected" && tyre.rejection_stage === "manager") {
    if (tyre.rejection_return_shipped) {
      return (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          Red / Sevk Edildi
        </span>
      );
    }

    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
        Red / Sevk Bekliyor
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {formatTyreStatus(tyre.status)}
    </span>
  );
}