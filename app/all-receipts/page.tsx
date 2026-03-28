"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { initialState, rootReducer } from "./reducers";
import {
  formatMoney,
  formatDate,
  getMonthStart,
  getMonthEnd,
  formatTyreStatus,
} from "@/src/lib/formatters";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

type Receipt = {
  id: number;
  receipt_no: string;
  customer_id: number;
  delivered_by: string | null;
  payment_type: string | null;
  payment_due_date: string | null;
  total_sale_price: number | null;
  description: string | null;
  doorstep_delivery: boolean | null;
  collection_date: string | null;
  created_at?: string | null;
};

type Customer = NormalizedCustomer;

type FilterOption = {
  value: string;
  label: string;
};

type Tyre = {
  id: number;
  collection_receipt_id: number | null;
  tyre_code: string | null;
  serial_no: string;
  collection_type: string | null;
  tyre_type: string | null;
  size: string | null;
  sale_price: number | null;
  original_brand: string | null;
  original_pattern: string | null;
  status: string;
};

export default function AllReceiptsPage() {
  return (
    <PermissionGuard
      permission="collections.view"
      title="Karkas Formları sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AllReceiptsPageContent />
    </PermissionGuard>
  );
}

function AllReceiptsPageContent() {
  const [state, dispatch] = useReducer(rootReducer, initialState);
  const { data, filters } = state;

  const hasActiveFilters =
    Boolean(filters.searchText) ||
    filters.customerFilter.length > 0 ||
    filters.regionFilter.length > 0 ||
    filters.salespersonFilter.length > 0 ||
    filters.paymentTypeFilter.length > 0 ||
    Boolean(filters.dateStart) ||
    Boolean(filters.dateEnd);

  function openReceiptPrintPopup(receiptId: number) {
    const printUrl = `/collections/${receiptId}/print`;
    const popup = window.open(
      printUrl,
      "collection-print",
      "popup=yes,width=620,height=980,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      window.alert("Yazdırma penceresi engellendi. Popup izni verip tekrar dene.");
    }
  }

  function openWorkOrderPrint(tyreId: number) {
    const popup = window.open(
      `/tyres/${tyreId}/workorder-print`,
      `workorder-print-${tyreId}`,
      "popup=yes,width=620,height=980,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      window.alert("Yazdırma penceresi engellendi. Popup izni verip tekrar dene.");
    }
  }

  function openReceiptWorkOrders(receiptId: number) {
    const receiptTyres = tyresByReceipt.get(receiptId) || [];
    const printableTyres = receiptTyres.filter(
      (tyre) => tyre.status === "factory_received"
    );

    if (printableTyres.length === 0) {
      window.alert("İş emri yazdırmak için uygun lastik bulunamadı.");
      return;
    }

    const popup = window.open(
      `/collections/${receiptId}/workorders-print`,
      `workorders-print-${receiptId}`,
      "popup=yes,width=700,height=980,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      window.alert("Yazdırma penceresi engellendi. Popup izni verip tekrar dene.");
    }
  }

  useEffect(() => {
    async function loadData() {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const [receiptsRes, customersRes, tyresRes] = await Promise.all([
          supabase
            .from("collection_receipts")
            .select(`
              id,
              receipt_no,
              customer_id,
              delivered_by,
              payment_type,
              payment_due_date,
              total_sale_price,
              description,
              doorstep_delivery,
              collection_date,
              created_at
            `)
            .order("id", { ascending: false })
            .limit(500),

          supabase
            .from("customers")
            .select(CUSTOMER_WITH_RELATIONS_SELECT)
            .order("name"),

          supabase
            .from("tyres")
            .select(`
              id,
              collection_receipt_id,
              tyre_code,
              serial_no,
              collection_type,
              tyre_type,
              size,
              sale_price,
              original_brand,
              original_pattern,
              status
            `)
            .order("collection_receipt_id", { ascending: true })
            .order("id", { ascending: true })
            .limit(10000),
        ]);

        const firstError = [
          receiptsRes.error,
          customersRes.error,
          tyresRes.error,
        ].find(Boolean);

        if (firstError) {
          dispatch({ type: "SET_ERROR", payload: firstError.message });
          dispatch({ type: "SET_LOADING", payload: false });
          return;
        }

        dispatch({
          type: "SET_DATA",
          payload: {
            receipts: (receiptsRes.data || []) as Receipt[],
            customers: normalizeCustomerRows(
              (customersRes.data || []) as CustomerWithRelationsRow[]
            ),
            tyres: (tyresRes.data || []) as Tyre[],
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Supabase baglanti hatasi. Ag baglantini ve URL ayarlarini kontrol et.";

        dispatch({ type: "SET_ERROR", payload: message });
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }

    loadData();
  }, []);

  const customerMap = useMemo(() => {
    return new Map(data.customers.map((c: Customer) => [c.id, c]));
  }, [data.customers]);

  const tyresByReceipt = useMemo(() => {
    const map = new Map<number, Tyre[]>();

    for (const tyre of data.tyres as Tyre[]) {
      if (!tyre.collection_receipt_id) continue;

      if (!map.has(tyre.collection_receipt_id)) {
        map.set(tyre.collection_receipt_id, []);
      }

      map.get(tyre.collection_receipt_id)!.push(tyre);
    }

    return map;
  }, [data.tyres]);

  const customerOptions = useMemo(
    () =>
      (data.customers as Customer[]).map((customer) => ({
        value: String(customer.id),
        label: customer.name,
      })),
    [data.customers]
  );

  const regionOptions = useMemo(() => {
    return Array.from(
      new Set((data.customers as Customer[]).map((x) => x.region || "").filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: x }));
  }, [data.customers]);

  const salespersonOptions = useMemo(() => {
    return Array.from(
      new Set(
        (data.customers as Customer[])
          .map((x) => x.salesperson || "")
          .filter(Boolean)
      )
    )
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: x }));
  }, [data.customers]);

  const paymentTypeOptions = useMemo(() => {
    return Array.from(
      new Set((data.receipts as Receipt[]).map((x) => x.payment_type || "").filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((x) => ({ value: x, label: x }));
  }, [data.receipts]);

  const filteredReceipts = useMemo(() => {
    const q = filters.searchText.trim().toLocaleLowerCase("tr-TR");

    return (data.receipts as Receipt[]).filter((receipt) => {
      const customer = customerMap.get(receipt.customer_id);

      if (
        filters.customerFilter.length > 0 &&
        !filters.customerFilter.includes(String(receipt.customer_id))
      ) {
        return false;
      }

      if (
        filters.paymentTypeFilter.length > 0 &&
        !filters.paymentTypeFilter.includes(receipt.payment_type || "")
      ) {
        return false;
      }

      if (
        filters.regionFilter.length > 0 &&
        !filters.regionFilter.includes(customer?.region || "")
      ) {
        return false;
      }

      if (
        filters.salespersonFilter.length > 0 &&
        !filters.salespersonFilter.includes(customer?.salesperson || "")
      ) {
        return false;
      }

      const rawDate = receipt.collection_date || receipt.created_at || null;
      const receiptDate = rawDate ? new Date(rawDate) : null;

      if (filters.dateStart && receiptDate) {
        const start = new Date(`${filters.dateStart}T00:00:00`);
        if (receiptDate < start) return false;
      }

      if (filters.dateEnd && receiptDate) {
        const end = new Date(`${filters.dateEnd}T23:59:59`);
        if (receiptDate > end) return false;
      }

      if (!q) return true;

      const receiptTyres = tyresByReceipt.get(receipt.id) || [];
      const tyreHaystack = receiptTyres
        .map((tyre) =>
          [
            tyre.tyre_code || "",
            tyre.serial_no || "",
            tyre.collection_type || "",
            tyre.tyre_type || "",
            tyre.size || "",
            tyre.original_brand || "",
            tyre.original_pattern || "",
            tyre.status || "",
          ].join(" ")
        )
        .join(" ");

      const haystack = [
        receipt.receipt_no,
        customer?.name || "",
        customer?.region || "",
        customer?.salesperson || "",
        receipt.delivered_by || "",
        receipt.payment_type || "",
        receipt.description || "",
        tyreHaystack,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    data.receipts,
    tyresByReceipt,
    filters.searchText,
    filters.customerFilter,
    filters.paymentTypeFilter,
    filters.regionFilter,
    filters.salespersonFilter,
    filters.dateStart,
    filters.dateEnd,
    customerMap,
  ]);

  const filteredTotalAmount = useMemo(() => {
    return filteredReceipts.reduce(
      (sum, receipt) => sum + Number(receipt.total_sale_price || 0),
      0
    );
  }, [filteredReceipts]);

  function toggleExpanded(receiptId: number) {
    dispatch({ type: "TOGGLE_EXPANDED", payload: receiptId });
  }

  if (data.loading) {
    return <main className="p-6">Yukleniyor...</main>;
  }

  if (data.error) {
    return <main className="p-6">Hata: {data.error}</main>;
  }

  return (
    <main className="space-y-3 p-4 md:p-6">
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Karkas Formlari</h1>
            <p className="text-[11px] text-slate-500">
              Fisleri filtrele, detaylari incele ve formu popup olarak yazdir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              Toplam Form: <strong>{(data.receipts as Receipt[]).length}</strong>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              Liste: <strong>{filteredReceipts.length}</strong>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              Tutar: <strong>{formatMoney(filteredTotalAmount)} TL</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-slate-900">Filtreler</h2>
        </div>

        <div className="space-y-4">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
          >
            <div className="min-w-0">
              <label className="filter-label">
                Ara
              </label>
              <input
                id="all-receipts-search"
                className="filter-control"
                placeholder="Fis no, musteri, kod, seri..."
                value={filters.searchText}
                onChange={(e) =>
                  dispatch({ type: "SET_SEARCH_TEXT", payload: e.target.value })
                }
              />
            </div>

            <div className="min-w-0">
              <label className="filter-label">
                Musteri
              </label>
              <PageMultiSelect
                options={customerOptions}
                values={filters.customerFilter}
                onChange={(value) =>
                  dispatch({ type: "SET_CUSTOMER_FILTER", payload: value })
                }
                placeholder="Seçiniz"
              />
            </div>

            <div className="min-w-0">
              <label className="filter-label">
                Bolge
              </label>
              <PageMultiSelect
                options={regionOptions}
                values={filters.regionFilter}
                onChange={(value) =>
                  dispatch({ type: "SET_REGION_FILTER", payload: value })
                }
                placeholder="Seçiniz"
              />
            </div>

            <div className="min-w-0">
              <label className="filter-label">
                Plasiyer
              </label>
              <PageMultiSelect
                options={salespersonOptions}
                values={filters.salespersonFilter}
                onChange={(value) =>
                  dispatch({ type: "SET_SALESPERSON_FILTER", payload: value })
                }
                placeholder="Seçiniz"
              />
            </div>

            <div className="min-w-0">
              <label className="filter-label">
                Odeme
              </label>
              <PageMultiSelect
                options={paymentTypeOptions}
                values={filters.paymentTypeFilter}
                onChange={(value) =>
                  dispatch({ type: "SET_PAYMENT_TYPE_FILTER", payload: value })
                }
                placeholder="Seçiniz"
              />
            </div>

            <div aria-hidden="true" />
          </div>

          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
          >
            <div className="min-w-0">
              <label className="filter-label">
                Baslangic
              </label>
              <input
                type="date"
                className="filter-control"
                value={filters.dateStart}
                onChange={(e) =>
                  dispatch({ type: "SET_DATE_START", payload: e.target.value })
                }
              />
            </div>

            <div className="min-w-0">
              <label className="filter-label">
                Bitis
              </label>
              <input
                type="date"
                className="filter-control"
                value={filters.dateEnd}
                onChange={(e) =>
                  dispatch({ type: "SET_DATE_END", payload: e.target.value })
                }
              />
            </div>

            <div aria-hidden="true" />
            <div aria-hidden="true" />

            <div className="min-w-0">
              <label className="filter-label-hidden" aria-hidden="true">
                Buton
              </label>
              <button
                type="button"
                onClick={() => {
                  const active = document.activeElement as HTMLElement | null;
                  active?.blur();
                }}
                className="filter-button-primary"
              >
                Filtrele
              </button>
            </div>

            <div className="min-w-0">
              <label className="filter-label-hidden" aria-hidden="true">
                Buton
              </label>
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET_FILTERS" })}
                className="filter-button-danger"
              >
                Temizle
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {filteredReceipts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Kayit bulunamadi.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReceipts.map((receipt) => {
              const receiptTyres = tyresByReceipt.get(receipt.id) || [];
              const expanded = filters.expandedReceiptIds.includes(receipt.id);
              const customer = customerMap.get(receipt.customer_id);

              return (
                <div
                  key={receipt.id}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(receipt.id)}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        {expanded ? "-" : "+"}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900">
                              {receipt.receipt_no}
                            </div>
                            <div className="text-sm text-slate-600">
                              {customer?.name || "-"}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => openReceiptPrintPopup(receipt.id)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Formu Yazdır
                            </button>
                            <button
                              type="button"
                              onClick={() => openReceiptWorkOrders(receipt.id)}
                              disabled={!receiptTyres.some((tyre) => tyre.status === "factory_received")}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100"
                            >
                              Toplu İş Emri Yazdır
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                          <InlineMeta label="Bolge" value={customer?.region || "-"} />
                          <InlineMeta label="Plasiyer" value={customer?.salesperson || "-"} />
                          <InlineMeta
                            label="Tarih"
                            value={formatDate(receipt.collection_date || receipt.created_at)}
                          />
                          <InlineMeta label="Teslim Eden" value={receipt.delivered_by || "-"} />
                          <InlineMeta label="Odeme Tipi" value={receipt.payment_type || "-"} />
                          <InlineMeta
                            label="Odeme Vadesi"
                            value={
                              receipt.payment_due_date
                                ? formatDate(receipt.payment_due_date)
                                : "-"
                            }
                          />
                          <InlineMeta label="Toplam Lastik" value={String(receiptTyres.length)} />
                          <InlineMeta
                            label="Toplam Tutar"
                            value={`${formatMoney(receipt.total_sale_price)} TL`}
                          />
                        </div>

                        {receipt.description ? (
                          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            Aciklama: {receipt.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50/40">
                      <div className="overflow-x-auto">
                        <table className="min-w-[1180px] w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Lastik Kodu
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Seri No
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Talep Edilen Islem
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Tur
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Ebat
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Fiyat
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Orijinal Marka
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Orijinal Desen
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                Durum
                              </th>
                              <th className="p-3 text-xs font-semibold text-slate-600">
                                İş Emri
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiptTyres.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={10}
                                  className="p-6 text-center text-sm text-slate-500"
                                >
                                  Bu formda lastik bulunamadi.
                                </td>
                              </tr>
                            ) : (
                              receiptTyres.map((tyre) => (
                                <tr
                                  key={tyre.id}
                                  className="border-b border-slate-100 bg-white"
                                >
                                  <td className="p-3 text-sm font-medium text-slate-900">
                                    {tyre.tyre_code || "-"}
                                  </td>
                                  <td className="p-3 text-sm font-medium text-slate-900">
                                    {tyre.serial_no}
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
                                  <td className="p-3 text-sm text-slate-700">
                                    {formatMoney(tyre.sale_price)} TL
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
                                  <td className="p-3 text-sm">
                                    <button
                                      type="button"
                                      onClick={() => openWorkOrderPrint(tyre.id)}
                                      disabled={tyre.status !== "factory_received"}
                                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100"
                                    >
                                      İş Emri Yazdır
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
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

function normalizeFilterText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function PageMultiSelect({
  options,
  values,
  onChange,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOptions = useMemo(() => {
    return options.filter((option) => values.includes(option.value));
  }, [options, values]);

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return "";
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    if (selectedOptions.length === 2) {
      return `${selectedOptions[0].label}, ${selectedOptions[1].label}`;
    }

    return `${selectedOptions[0].label}, ${selectedOptions[1].label} +${
      selectedOptions.length - 2
    }`;
  }, [selectedOptions]);

  const filteredOptions = useMemo(() => {
    const sourceText = query.trim();
    if (!sourceText) return options;

    const normalizedQuery = normalizeFilterText(sourceText);
    return options.filter((option) =>
      normalizeFilterText(option.label).includes(normalizedQuery)
    );
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }

    onChange([...values, value]);
  }

  function handleFocus() {
    setOpen(true);
    setQuery("");
  }

  function handleChange(nextValue: string) {
    setQuery(nextValue);
    if (!open) setOpen(true);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : displayText}
          placeholder={selectedOptions.length === 0 ? placeholder : ""}
          onFocus={handleFocus}
          onChange={(e) => handleChange(e.target.value)}
          className="filter-control pr-12"
        />

        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            if (!open) {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          tabIndex={-1}
        >
          ⌄
        </button>
      </div>

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="max-h-64 overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                Kayit bulunamadi
              </div>
            ) : (
              filteredOptions.map((option) => {
                const checked = values.includes(option.value);

                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
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
    allocated_to_shipment: "bg-indigo-100 text-indigo-700",
  };

  const className = map[status] || "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {formatTyreStatus(status)}
    </span>
  );
}
