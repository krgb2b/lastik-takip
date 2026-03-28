"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import { writeAuditLog } from "@/src/lib/audit/write-audit-log";
import { formatTyreStatus } from "@/src/lib/formatters";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

type Tyre = {
  id: number;
  collection_receipt_id: number | null;
  customer_id: number | null;
  serial_no: string;
  collection_type: string | null;
  tyre_type: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  retread_brand_id: number | null;
  tread_pattern_id: number | null;
  produced_at: string | null;
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

type Customer = NormalizedCustomer;

type RetreadBrand = {
  id: number;
  name: string;
};

type TreadPattern = {
  id: number;
  brand_id: number;
  name: string;
};

type FilterType = "ready_to_ship" | "rejected_return";

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

function createShipmentNo() {
  return `SVK-${Date.now()}`;
}

export default function ShippingPage() {
  return (
    <PermissionGuard
      permission="shipping.view"
      title="Sevkiyat sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <ShippingPageContent />
    </PermissionGuard>
  );
}

function ShippingPageContent() {
  const { permissionState } = usePermissionState();

  const canDispatch = can(permissionState, "shipping.dispatch");
  const canReturnDispatch = can(permissionState, "shipping.return_dispatch");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<FilterType>("ready_to_ship");
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<number[]>([]);
  const [selectedTyreIds, setSelectedTyreIds] = useState<number[]>([]);
  const [submittingCustomerId, setSubmittingCustomerId] = useState<number | null>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");

  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [
        tyresRes,
        receiptsRes,
        customersRes,
        retreadBrandsRes,
        treadPatternsRes,
      ] = await Promise.all([
        supabase
          .from("tyres")
          .select(`
            id,
            collection_receipt_id,
            customer_id,
            serial_no,
            collection_type,
            tyre_type,
            size,
            sale_price,
            original_brand,
            original_pattern,
            retread_brand_id,
            tread_pattern_id,
            produced_at,
            status,
            rejection_stage,
            rejection_reason,
            rejection_note,
            rejection_return_shipped
          `)
          .in("status", ["stocked", "rejected"])
          .order("id", { ascending: false }),

        supabase
          .from("collection_receipts")
          .select(`
            id,
            receipt_no,
            customer_id,
            collection_date,
            delivered_by,
            payment_type,
            payment_due_date,
            description
          `)
          .order("id", { ascending: false }),

        supabase
          .from("customers")
          .select(CUSTOMER_WITH_RELATIONS_SELECT)
          .order("name"),

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
        console.error("Shipping load error:", firstError.message, {
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
      setCustomers(
        normalizeCustomerRows(
          ((customersRes.data || []) as CustomerWithRelationsRow[])
        )
      );
      setRetreadBrands((retreadBrandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((treadPatternsRes.data || []) as TreadPattern[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const receiptMap = useMemo(
    () => new Map(receipts.map((r) => [r.id, r])),
    [receipts]
  );

  const retreadBrandMap = useMemo(
    () => new Map(retreadBrands.map((b) => [b.id, b.name])),
    [retreadBrands]
  );

  const treadPatternMap = useMemo(
    () => new Map(treadPatterns.map((p) => [p.id, p.name])),
    [treadPatterns]
  );

  const regionOptions = useMemo(() => {
    return Array.from(
      new Set(customers.map((c) => c.region || "").filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [customers]);

  const salespersonOptions = useMemo(() => {
    return Array.from(
      new Set(customers.map((c) => c.salesperson || "").filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [customers]);

  const readyToShipTyres = useMemo(
    () => tyres.filter((t) => t.status === "stocked"),
    [tyres]
  );

  const rejectedReturnTyres = useMemo(
    () =>
      tyres.filter(
        (t) =>
          t.status === "rejected" &&
          t.rejection_stage === "manager" &&
          !t.rejection_return_shipped
      ),
    [tyres]
  );

  const filteredTyres = useMemo(() => {
    const baseTyres =
      filter === "ready_to_ship" ? readyToShipTyres : rejectedReturnTyres;

    const q = customerSearch.trim().toLocaleLowerCase("tr-TR");

    return baseTyres.filter((tyre) => {
      const customer = tyre.customer_id
        ? customerMap.get(tyre.customer_id)
        : null;

      if (!customer) return false;

      if (regionFilter !== "all" && (customer.region || "") !== regionFilter) {
        return false;
      }

      if (
        salespersonFilter !== "all" &&
        (customer.salesperson || "") !== salespersonFilter
      ) {
        return false;
      }

      if (!q) return true;

      const receipt = tyre.collection_receipt_id
        ? receiptMap.get(tyre.collection_receipt_id)
        : null;

      const haystack = [
        customer.name || "",
        customer.region || "",
        customer.salesperson || "",
        tyre.serial_no || "",
        receipt?.receipt_no || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    filter,
    readyToShipTyres,
    rejectedReturnTyres,
    customerSearch,
    regionFilter,
    salespersonFilter,
    customerMap,
    receiptMap,
  ]);

  const tyresByCustomer = useMemo(() => {
    const map = new Map<number, Tyre[]>();

    for (const tyre of filteredTyres) {
      if (!tyre.customer_id) continue;

      if (!map.has(tyre.customer_id)) {
        map.set(tyre.customer_id, []);
      }

      map.get(tyre.customer_id)!.push(tyre);
    }

    return map;
  }, [filteredTyres]);

  const visibleCustomerIds = useMemo(() => {
    return Array.from(tyresByCustomer.keys());
  }, [tyresByCustomer]);

  const totalVisibleTyres = filteredTyres.length;

  const totalVisibleAmount = useMemo(() => {
    if (filter === "rejected_return") return 0;

    return filteredTyres.reduce(
      (sum, tyre) => sum + Number(tyre.sale_price || 0),
      0
    );
  }, [filteredTyres, filter]);

  function toggleExpanded(customerId: number) {
    setExpandedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  }

  function isCustomerFullySelected(customerId: number) {
    const customerTyres = tyresByCustomer.get(customerId) || [];
    if (customerTyres.length === 0) return false;
    return customerTyres.every((tyre) => selectedTyreIds.includes(tyre.id));
  }

  function isCustomerPartiallySelected(customerId: number) {
    const customerTyres = tyresByCustomer.get(customerId) || [];
    if (customerTyres.length === 0) return false;

    const selectedCount = customerTyres.filter((tyre) =>
      selectedTyreIds.includes(tyre.id)
    ).length;

    return selectedCount > 0 && selectedCount < customerTyres.length;
  }

  function toggleCustomerSelection(customerId: number) {
    const customerTyres = tyresByCustomer.get(customerId) || [];
    const customerTyreIds = customerTyres.map((tyre) => tyre.id);

    if (customerTyreIds.length === 0) return;

    const allSelected = customerTyreIds.every((id) => selectedTyreIds.includes(id));

    if (allSelected) {
      setSelectedTyreIds((prev) => prev.filter((id) => !customerTyreIds.includes(id)));
    } else {
      setSelectedTyreIds((prev) => Array.from(new Set([...prev, ...customerTyreIds])));
    }
  }

  function toggleTyreSelection(tyreId: number) {
    setSelectedTyreIds((prev) =>
      prev.includes(tyreId)
        ? prev.filter((id) => id !== tyreId)
        : [...prev, tyreId]
    );
  }

  async function handleCreateShipmentReceipt(customerId: number) {
    const isRejectedReturn = filter === "rejected_return";

    if (isRejectedReturn) {
      if (!canReturnDispatch) {
        alert("Bu işlem için yetkin yok.");
        return;
      }
    } else {
      if (!canDispatch) {
        alert("Bu işlem için yetkin yok.");
        return;
      }
    }

    const customerTyres = (tyresByCustomer.get(customerId) || []).filter((tyre) =>
      selectedTyreIds.includes(tyre.id)
    );

    if (customerTyres.length === 0) {
      alert("Önce bu müşteri altında en az 1 lastik seçmelisin.");
      return;
    }

    const confirmed = window.confirm(
      `${customerMap.get(customerId)?.name || "Müşteri"} için ${customerTyres.length} lastiklik sevk fişi oluşturulsun mu?`
    );
    if (!confirmed) return;

    setSubmittingCustomerId(customerId);

    try {
      const shipmentNo = createShipmentNo();
      const shipmentType = isRejectedReturn ? "rejected_return" : "normal";

      const currentCustomer = customerMap.get(customerId);

const { data: shipmentReceipt, error: shipmentReceiptError } = await supabase
  .from("shipment_receipts")
  .insert({
    shipment_no: shipmentNo,
    customer_id: customerId,
    shipment_type: shipmentType,
    status: "ready_for_loading",
    shipment_date: new Date().toISOString(),
    description: null,
  })
  .select("id")
  .single();

      if (shipmentReceiptError) {
        throw new Error(shipmentReceiptError.message);
      }

      const itemRows = customerTyres.map((tyre) => ({
        shipment_receipt_id: shipmentReceipt.id,
        tyre_id: tyre.id,
      }));

      const { error: itemsError } = await supabase
        .from("shipment_receipt_items")
        .insert(itemRows);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const tyreIds = customerTyres.map((tyre) => tyre.id);

      const { error: tyresUpdateError } = await supabase
        .from("tyres")
        .update({
          status: "allocated_to_shipment",
        })
        .in("id", tyreIds);

      if (tyresUpdateError) {
        throw new Error(tyresUpdateError.message);
      }

      await writeAuditLog({
  action: "shipment_receipt_create",
  entity_table: "shipment_receipts",
  entity_id: shipmentReceipt.id,
  description: "Müşteri bazlı sevk fişi oluşturuldu",
  payload: {
    shipment_receipt_id: shipmentReceipt.id,
    shipment_no: shipmentNo,
    customer_id: customerId,
    tyre_ids: tyreIds,
    shipment_type: shipmentType,
    region: currentCustomer?.region || null,
    salesperson: currentCustomer?.salesperson || null,
  },
});

      setTyres((prev) =>
        prev.map((tyre) =>
          tyreIds.includes(tyre.id)
            ? {
                ...tyre,
                status: "allocated_to_shipment",
              }
            : tyre
        )
      );

      setSelectedTyreIds((prev) => prev.filter((id) => !tyreIds.includes(id)));
      alert(`Sevk fişi oluşturuldu: ${shipmentNo}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sevk fişi oluşturulamadı";
      alert(message);
    } finally {
      setSubmittingCustomerId(null);
    }
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
            <h1 className="text-2xl font-bold text-slate-900">Sevkiyat Hazırlık</h1>
            <p className="mt-1 text-sm text-slate-600">
              Sevke uygun lastikleri müşteri, bölge ve plasiyer bazında gruplayıp sevk fişi oluştur.
            </p>
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-2 text-sm">
            <CompactInfo label="Görünen Müşteri" value={String(visibleCustomerIds.length)} />
            <CompactInfo label="Görünen Lastik" value={String(totalVisibleTyres)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Sevke Hazır" value={String(readyToShipTyres.length)} />
        <SummaryCard
          title="Red / İade Sevki"
          value={String(rejectedReturnTyres.length)}
        />
        <SummaryCard
          title="Toplam Tutar"
          value={
            filter === "rejected_return"
              ? "-"
              : `${formatMoney(totalVisibleAmount)} TL`
          }
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
  <div className="mb-3 flex flex-wrap gap-2">
    <FilterButton
      active={filter === "ready_to_ship"}
      onClick={() => setFilter("ready_to_ship")}
    >
      Sevke Hazır
    </FilterButton>

    <FilterButton
      active={filter === "rejected_return"}
      onClick={() => setFilter("rejected_return")}
    >
      Red / İade Sevki
    </FilterButton>
  </div>

  <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
    <input
      className="filter-control min-w-[280px] flex-[1.6]"
      placeholder="Müşteri, bölge, plasiyer, seri no veya fiş no ara..."
      value={customerSearch}
      onChange={(e) => setCustomerSearch(e.target.value)}
    />

    <select
      className="filter-control min-w-[170px] flex-1"
      value={regionFilter}
      onChange={(e) => setRegionFilter(e.target.value)}
    >
      <option value="all">Tüm Bölgeler</option>
      {regionOptions.map((region) => (
        <option key={region} value={region}>
          {region}
        </option>
      ))}
    </select>

    <select
      className="filter-control min-w-[170px] flex-1"
      value={salespersonFilter}
      onChange={(e) => setSalespersonFilter(e.target.value)}
    >
      <option value="all">Tüm Plasiyerler</option>
      {salespersonOptions.map((salesperson) => (
        <option key={salesperson} value={salesperson}>
          {salesperson}
        </option>
      ))}
    </select>
  </div>


        {visibleCustomerIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Bu filtrede gösterilecek kayıt yok.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCustomerIds.map((customerId) => {
              const customerTyres = tyresByCustomer.get(customerId) || [];
              const expanded = expandedCustomerIds.includes(customerId);
              const totalAmount = customerTyres.reduce(
                (sum, t) => sum + Number(t.sale_price || 0),
                0
              );
              const selectedCount = customerTyres.filter((t) =>
                selectedTyreIds.includes(t.id)
              ).length;
              const customer = customerMap.get(customerId);

              return (
                <div
                  key={customerId}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(customerId)}
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          {expanded ? "−" : "+"}
                        </button>

                        <input
                          type="checkbox"
                          className="mt-2 shrink-0"
                          checked={isCustomerFullySelected(customerId)}
                          ref={(el) => {
                            if (el) el.indeterminate = isCustomerPartiallySelected(customerId);
                          }}
                          onChange={() => toggleCustomerSelection(customerId)}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div className="text-base font-semibold text-slate-900">
                              {customer?.name || "-"}
                            </div>
                            <Pill label={`Lastik: ${customerTyres.length}`} />
                            <Pill label={`Seçili: ${selectedCount}`} />
                          </div>

                          <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                            <InlineMeta
                              label="Bölge"
                              value={customer?.region || "-"}
                            />
                            <InlineMeta
                              label="Plasiyer"
                              value={customer?.salesperson || "-"}
                            />
                            <InlineMeta
                              label="Toplam Lastik"
                              value={String(customerTyres.length)}
                            />
                            <InlineMeta
                              label="Toplam Tutar"
                              value={
                                filter === "rejected_return"
                                  ? "-"
                                  : `${formatMoney(totalAmount)} TL`
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 xl:w-[240px]">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleCreateShipmentReceipt(customerId)}
                            disabled={submittingCustomerId === customerId || selectedCount === 0}
                            className="w-full rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {submittingCustomerId === customerId
                              ? "Oluşturuluyor..."
                              : "Sevk Fişi Oluştur"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/40">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1550px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600"></th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Seri No</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Alım Fişi</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Talep Edilen İşlem</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Tür</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Ebat</th>
                              {filter === "ready_to_ship" ? (
                                <th className="p-3 text-xs font-semibold text-slate-600">Fiyat</th>
                              ) : null}
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Orijinal Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Marka</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Kaplama Desen</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Üretim</th>
                              <th className="p-3 text-xs font-semibold text-slate-600">Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerTyres.map((tyre) => {
                              const receipt = tyre.collection_receipt_id
                                ? receiptMap.get(tyre.collection_receipt_id)
                                : null;

                              return (
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
                                    {receipt?.receipt_no || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.collection_type || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.tyre_type || "-"}
                                  </td>
                                  <td className="p-3 text-sm text-slate-700">
                                    {tyre.size || "-"}
                                  </td>
                                  {filter === "ready_to_ship" ? (
                                    <td className="p-3 text-sm text-slate-700">
                                      {formatMoney(tyre.sale_price)} TL
                                    </td>
                                  ) : null}
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
                                    {formatDate(tyre.produced_at)}
                                  </td>
                                  <td className="p-3 text-sm">
                                    <StatusBadge status={tyre.status} />
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

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    stocked: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    allocated_to_shipment: "bg-indigo-100 text-indigo-700",
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {formatTyreStatus(status)}
    </span>
  );
}