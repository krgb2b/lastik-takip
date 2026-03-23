"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";

type Option = {
  value: string;
  label: string;
};

type Customer = {
  id: number;
  name: string;
  region: string | null;
  salesperson: string | null;
};

type CustomerAddress = {
  id: number;
  customer_id: number;
  address_text: string;
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

type TyreTypeMaster = {
  id: number;
  name: string;
  sort_order: number;
};

type TyreSizeMaster = {
  id: number;
  tyre_type_id: number;
  name: string;
  sort_order: number;
};

type OriginalBrandMaster = {
  id: number;
  name: string;
};

type CollectionType = "Kaplama" | "Tamir" | "Karkas Satın Alma";
type TyreCondition = "Orijinal" | "Kaplama";
type YesNo = "Var" | "Yok";
type PaymentType = "Nakit" | "Havale" | "Çek" | "Cari";

type Row = {
  id: number;
  collection_type: CollectionType | "";
  serial_no: string;
  tyre_type: string;
  size: string;
  sale_price: string;
  original_brand: string;
  original_pattern: string;
  retread_brand_id: string;
  tread_pattern_id: string;
  tyre_condition: TyreCondition | "";
  rim_status: YesNo | "";
  warranty_status: YesNo | "";
  description: string;
};

const collectionTypeOptions: Option[] = [
  { value: "Kaplama", label: "Kaplama" },
  { value: "Tamir", label: "Tamir" },
  { value: "Karkas Satın Alma", label: "Karkas" },
];

const tyreConditionOptions: Option[] = [
  { value: "Orijinal", label: "Orijinal" },
  { value: "Kaplama", label: "Kaplama" },
];

const yesNoOptions: Option[] = [
  { value: "Var", label: "Var" },
  { value: "Yok", label: "Yok" },
];

const paymentTypeOptions: Option[] = [
  { value: "Nakit", label: "Nakit" },
  { value: "Havale", label: "Havale" },
  { value: "Çek", label: "Çek" },
  { value: "Cari", label: "Cari" },
];

function createEmptyRow(id: number): Row {
  return {
    id,
    collection_type: "",
    serial_no: "",
    tyre_type: "",
    size: "",
    sale_price: "",
    original_brand: "",
    original_pattern: "",
    retread_brand_id: "",
    tread_pattern_id: "",
    tyre_condition: "",
    rim_status: "",
    warranty_status: "",
    description: "",
  };
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "tr"));
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">
      {children}
    </label>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function SearchableSelect({
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
  footerAction,
}: {
  value: string;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  footerAction?: {
    label: string;
    onClick: () => void;
  };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((x) => x.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption?.label]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
        setQuery(selectedOption?.label || "");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption?.label]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalizeText(query);
    return options.filter((option) => normalizeText(option.label).includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }

    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex(0);
  }, [open, query, filteredOptions.length]);

  useEffect(() => {
    if (!open || highlightedIndex < 0 || !listRef.current) return;

    const activeEl = listRef.current.querySelector(
      `[data-option-index="${highlightedIndex}"]`
    ) as HTMLElement | null;

    activeEl?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  function selectOption(option: Option) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function getExactMatch() {
    const q = normalizeText(query.trim());
    if (!q) return null;
    return options.find((option) => normalizeText(option.label) === q) || null;
  }

  function commitBestMatch() {
    if (
      open &&
      highlightedIndex >= 0 &&
      highlightedIndex < filteredOptions.length
    ) {
      selectOption(filteredOptions[highlightedIndex]);
      return;
    }

    const exactMatch = getExactMatch();
    if (exactMatch) {
      selectOption(exactMatch);
      return;
    }

    setOpen(false);
    setHighlightedIndex(-1);
    setQuery(selectedOption?.label || "");
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
            setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!disabled) {
            if (value) onChange("");
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (disabled) return;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
              return;
            }
            setHighlightedIndex((prev) => {
              if (filteredOptions.length === 0) return -1;
              return prev < filteredOptions.length - 1 ? prev + 1 : prev;
            });
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
              return;
            }
            setHighlightedIndex((prev) => {
              if (filteredOptions.length === 0) return -1;
              return prev > 0 ? prev - 1 : 0;
            });
            return;
          }

          if (e.key === "Enter") {
            if (!open) return;
            e.preventDefault();
            commitBestMatch();
            return;
          }

          if (e.key === "Tab") {
            commitBestMatch();
            return;
          }

          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setHighlightedIndex(-1);
            setQuery(selectedOption?.label || "");
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setQuery(selectedOption?.label || "");
          }, 150);
        }}
      />

      {open && !disabled ? (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              Kayıt bulunamadı
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                data-option-index={index}
                tabIndex={-1}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(option);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  highlightedIndex === index
                    ? "bg-slate-100 text-slate-900"
                    : "hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))
          )}

          {footerAction ? (
            <>
              <div className="my-1 border-t border-slate-200" />
              <button
                tabIndex={-1}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  setHighlightedIndex(-1);
                  footerAction.onClick();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {footerAction.label}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CompactSegmentedSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-[42px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      {options.map((option, index) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              "flex-1 px-3 text-sm font-medium transition",
              index > 0 ? "border-l border-slate-200" : "",
              active
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function NewCollectionPage() {
  return (
    <PermissionGuard
      permission="collections.view"
      title="Toplu Lastik Alımı sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <NewCollectionPageContent />
    </PermissionGuard>
  );
}

function NewCollectionPageContent() {
  const { permissionState } = usePermissionState();

  const canCreateCollection = can(permissionState, "collections.create");
  const canEditCollection = can(permissionState, "collections.edit");
  const canDeleteCollection = can(permissionState, "collections.delete");
  const canPrintCollection = can(permissionState, "collections.print");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>(
    []
  );
  const [retreadBrands, setRetreadBrands] = useState<RetreadBrand[]>([]);
  const [treadPatterns, setTreadPatterns] = useState<TreadPattern[]>([]);
  const [tyreTypes, setTyreTypes] = useState<TyreTypeMaster[]>([]);
  const [tyreSizes, setTyreSizes] = useState<TyreSizeMaster[]>([]);
  const [originalBrands, setOriginalBrands] = useState<OriginalBrandMaster[]>(
    []
  );
  const [masterOriginalPatterns, setMasterOriginalPatterns] = useState<string[]>(
    []
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [doorstepDelivery, setDoorstepDelivery] = useState(false);
  const [deliveredBy, setDeliveredBy] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType | "">("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedReceiptNo, setSavedReceiptNo] = useState("");
  const [savedReceiptId, setSavedReceiptId] = useState<number | null>(null);
  const [bulkCount, setBulkCount] = useState("1");

  const [draftRow, setDraftRow] = useState<Row>(createEmptyRow(1));
  const [editingRowId, setEditingRowId] = useState<number | null>(null);

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [newAddressText, setNewAddressText] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);

  const [message, setMessage] = useState("");

  function openMessage(text: string) {
    setMessage(text);
  }

  useEffect(() => {
    async function loadData() {
      const [
        customersRes,
        addressesRes,
        brandsRes,
        patternsRes,
        tyreTypesRes,
        tyreSizesRes,
        originalBrandsRes,
        tyresRes,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, region, salesperson")
          .order("name"),
        supabase
          .from("customer_addresses")
          .select("id, customer_id, address_text")
          .order("id", { ascending: false }),
        supabase.from("retread_brands").select("id, name").order("name"),
        supabase
          .from("tread_patterns")
          .select("id, brand_id, name")
          .order("name"),
        supabase
          .from("tyre_types")
          .select("id, name, sort_order")
          .order("sort_order")
          .order("name"),
        supabase
          .from("tyre_sizes")
          .select("id, tyre_type_id, name, sort_order")
          .order("sort_order")
          .order("name"),
        supabase.from("original_brands").select("id, name").order("name"),
        supabase.from("tyres").select("original_pattern").limit(5000),
      ]);

      const firstError = [
        customersRes.error,
        addressesRes.error,
        brandsRes.error,
        patternsRes.error,
        tyreTypesRes.error,
        tyreSizesRes.error,
        originalBrandsRes.error,
        tyresRes.error,
      ].find(Boolean);

      if (firstError) {
        console.error("Master data load error:", firstError.message, {
          customersRes,
          addressesRes,
          brandsRes,
          patternsRes,
          tyreTypesRes,
          tyreSizesRes,
          originalBrandsRes,
          tyresRes,
        });
        openMessage(`Master veri yüklenemedi: ${firstError.message}`);
        return;
      }

      setCustomers((customersRes.data || []) as Customer[]);
      setCustomerAddresses((addressesRes.data || []) as CustomerAddress[]);
      setRetreadBrands((brandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((patternsRes.data || []) as TreadPattern[]);
      setTyreTypes((tyreTypesRes.data || []) as TyreTypeMaster[]);
      setTyreSizes((tyreSizesRes.data || []) as TyreSizeMaster[]);
      setOriginalBrands((originalBrandsRes.data || []) as OriginalBrandMaster[]);

      const tyreRows =
        (tyresRes.data || []) as Array<{
          original_pattern?: string | null;
        }>;

      setMasterOriginalPatterns(
        compactUnique(tyreRows.map((x) => x.original_pattern ?? ""))
      );
    }

    loadData();
  }, []);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (message) {
        setMessage("");
        return;
      }

      if (addressModalOpen) {
        setAddressModalOpen(false);
        setNewAddressText("");
      }
    }

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [message, addressModalOpen]);

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.sale_price || 0), 0);
  }, [rows]);

  const selectedCustomer =
    customers.find((c) => String(c.id) === customerId) || null;

  const selectedCustomerAddresses = useMemo(() => {
    if (!customerId) return [];
    return customerAddresses.filter(
      (address) => String(address.customer_id) === customerId
    );
  }, [customerAddresses, customerId]);

  const tyreTypeBySize = useMemo(() => {
    const map = new Map<string, string>();

    tyreSizes.forEach((sizeRow) => {
      const tyreType = tyreTypes.find((t) => t.id === sizeRow.tyre_type_id);
      if (tyreType) {
        map.set(sizeRow.name, tyreType.name);
      }
    });

    return map;
  }, [tyreSizes, tyreTypes]);

  const sizeOptions = useMemo(
    () =>
      tyreSizes.map((x) => ({
        value: x.name,
        label: x.name,
      })),
    [tyreSizes]
  );

  const retreadPatternOptions = useMemo(() => {
    if (!draftRow.retread_brand_id) return [];
    return treadPatterns
      .filter((pattern) => pattern.brand_id === Number(draftRow.retread_brand_id))
      .map((pattern) => ({
        value: String(pattern.id),
        label: pattern.name,
      }));
  }, [draftRow.retread_brand_id, treadPatterns]);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
      })),
    [customers]
  );

  const addressOptions = useMemo(
    () =>
      selectedCustomerAddresses.map((address) => ({
        value: String(address.id),
        label: address.address_text,
      })),
    [selectedCustomerAddresses]
  );

  const originalBrandOptions = useMemo(
    () =>
      originalBrands.map((x) => ({
        value: x.name,
        label: x.name,
      })),
    [originalBrands]
  );

  const originalPatternOptions = useMemo(
    () => masterOriginalPatterns.map((x) => ({ value: x, label: x })),
    [masterOriginalPatterns]
  );

  const retreadBrandOptions = useMemo(
    () =>
      retreadBrands.map((brand) => ({
        value: String(brand.id),
        label: brand.name,
      })),
    [retreadBrands]
  );

  function updateDraft(field: keyof Row, value: string) {
    setDraftRow((prev) => {
      if (field === "collection_type") {
        const nextType = value as CollectionType | "";
        if (nextType !== "Kaplama") {
          return {
            ...prev,
            collection_type: nextType,
            retread_brand_id: "",
            tread_pattern_id: "",
          };
        }
        return {
          ...prev,
          collection_type: nextType,
        };
      }

      if (field === "retread_brand_id") {
        return {
          ...prev,
          retread_brand_id: value,
          tread_pattern_id: "",
        };
      }

      if (field === "size") {
        return {
          ...prev,
          size: value,
          tyre_type: value ? tyreTypeBySize.get(value) || "" : "",
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  }

  function resetDraftRow() {
    setDraftRow(createEmptyRow(Date.now()));
    setBulkCount("1");
    setEditingRowId(null);
  }

  function isDuplicateSerialInRows(serial: string, ignoreRowId?: number) {
    const normalized = serial.trim().toLowerCase();
    if (!normalized) return false;

    return rows.some(
      (row) =>
        row.id !== ignoreRowId &&
        row.serial_no.trim().toLowerCase() === normalized
    );
  }

  function validateDraftRow() {
    if (!draftRow.collection_type) {
      openMessage("Talep edilen işlemi seçmelisin.");
      return false;
    }

    if (!draftRow.serial_no.trim()) {
      openMessage("Seri no girmelisin.");
      return false;
    }

    if (!draftRow.size) {
      openMessage("Ebat seçmelisin.");
      return false;
    }

    if (!draftRow.tyre_type) {
      openMessage("Lastik türü otomatik bulunamadı.");
      return false;
    }

    if (draftRow.collection_type === "Kaplama" && !draftRow.retread_brand_id) {
      openMessage("Kaplama için kaplama marka seçmelisin.");
      return false;
    }

    if (isDuplicateSerialInRows(draftRow.serial_no, editingRowId || undefined)) {
      openMessage("Bu seri no listede zaten var.");
      return false;
    }

    return true;
  }

  function addCurrentRow() {
    if (!canCreateCollection) return;
    if (!validateDraftRow()) return;

    if (editingRowId) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === editingRowId ? { ...draftRow, id: editingRowId } : row
        )
      );
      resetDraftRow();
      return;
    }

    setRows((prev) => [
      ...prev,
      {
        ...draftRow,
        id: Date.now(),
      },
    ]);

    resetDraftRow();
  }

  function addBulkRows() {
    if (!canCreateCollection) return;

    const count = Number(bulkCount);

    if (!validateDraftRow()) return;

    if (!count || count < 1) {
      openMessage("Geçerli bir adet gir.");
      return;
    }

    if (editingRowId) {
      openMessage("Düzenleme açıkken çoklu ekleme yapma. Önce güncelle.");
      return;
    }

    const rowsToAdd: Row[] = [];

    for (let i = 0; i < count; i++) {
      rowsToAdd.push({
        ...draftRow,
        id: Date.now() + i,
        serial_no: i === 0 ? draftRow.serial_no : "",
      });
    }

    if (rowsToAdd[0]?.serial_no?.trim()) {
      if (isDuplicateSerialInRows(rowsToAdd[0].serial_no)) {
        openMessage("Bu seri no listede zaten var.");
        return;
      }
    }

    setRows((prev) => [...prev, ...rowsToAdd]);
    resetDraftRow();
  }

  function removeRow(id: number) {
    if (!canDeleteCollection) return;

    const confirmed = window.confirm("Silmek istediğinizden emin misiniz?");
    if (!confirmed) return;

    setRows((prev) => prev.filter((row) => row.id !== id));

    if (editingRowId === id) {
      resetDraftRow();
    }
  }

  function editRow(id: number) {
    if (!canEditCollection) return;

    const row = rows.find((item) => item.id === id);
    if (!row) return;

    setDraftRow({ ...row });
    setEditingRowId(id);
  }

  function updateListRow(id: number, field: keyof Row, value: string) {
    if (!canEditCollection) return;

    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        if (field === "serial_no") {
          const normalized = value.trim().toLowerCase();
          const exists = prev.some(
            (item) =>
              item.id !== id &&
              item.serial_no.trim().toLowerCase() === normalized &&
              normalized !== ""
          );

          if (exists) {
            return row;
          }
        }

        return {
          ...row,
          [field]: value,
        };
      })
    );
  }

  async function handleAddAddress() {
    if (!customerId) {
      openMessage("Önce müşteri seçmelisin.");
      return;
    }

    if (!newAddressText.trim()) {
      openMessage("Adres yazmalısın.");
      return;
    }

    setAddingAddress(true);

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: Number(customerId),
        address_text: newAddressText.trim(),
      })
      .select("id, customer_id, address_text")
      .single();

    if (error) {
      openMessage(error.message);
      setAddingAddress(false);
      return;
    }

    const newAddress = data as CustomerAddress;
    setCustomerAddresses((prev) => [newAddress, ...prev]);
    setSelectedAddressId(String(newAddress.id));
    setAddressModalOpen(false);
    setNewAddressText("");
    setAddingAddress(false);
  }

  async function saveCollection(openPrint: boolean) {
    if (!canCreateCollection) return;
    if (openPrint && !canPrintCollection) return;

    if (!customerId) {
      openMessage("Müşteri seçmelisin.");
      return;
    }

    if (!doorstepDelivery && !selectedAddressId) {
      openMessage("Adres seçmelisin veya Kapı Önü Teslim işaretlemelisin.");
      return;
    }

    const validRows = rows.filter((row) => row.serial_no.trim() !== "");

    if (validRows.length === 0) {
      openMessage("En az 1 lastik eklemelisin.");
      return;
    }

    const rowsWithoutType = validRows.filter((row) => !row.collection_type);
    if (rowsWithoutType.length > 0) {
      openMessage("Tüm lastiklerde talep edilen işlem seçili olmalı.");
      return;
    }

    const invalidRetreadRows = validRows.filter(
      (row) => row.collection_type === "Kaplama" && !row.retread_brand_id
    );
    if (invalidRetreadRows.length > 0) {
      openMessage("Kaplama olan lastiklerde kaplama marka seçili olmalı.");
      return;
    }

    const duplicateSerials = validRows
      .map((r) => r.serial_no.trim().toLowerCase())
      .filter((serial, index, arr) => arr.indexOf(serial) !== index);

    if (duplicateSerials.length > 0) {
      openMessage("Aynı seri no birden fazla kez girilmiş.");
      return;
    }

    const serials = validRows.map((row) => row.serial_no.trim());

    const { data: existingTyres, error: existingError } = await supabase
      .from("tyres")
      .select("serial_no")
      .in("serial_no", serials);

    if (existingError) {
      openMessage(existingError.message);
      return;
    }

    if ((existingTyres || []).length > 0) {
      const existingSerials = existingTyres
        .map((item) => item.serial_no)
        .join(", ");
      openMessage(`Bu seri no zaten kayıtlı: ${existingSerials}`);
      return;
    }

    setSaving(true);

    try {
      const receiptNo = `ALM-${Date.now()}`;

      const { data: receipt, error: receiptError } = await supabase
        .from("collection_receipts")
        .insert({
          customer_id: Number(customerId),
          customer_address_id: doorstepDelivery ? null : Number(selectedAddressId),
          doorstep_delivery: doorstepDelivery,
          receipt_no: receiptNo,
          delivered_by: deliveredBy,
          payment_type: paymentType || null,
          payment_due_date: paymentDueDate || null,
          total_sale_price: totalAmount,
          description,
        })
        .select("id")
        .single();

      if (receiptError) throw new Error(receiptError.message);

      const tyrePayload = validRows.map((row) => ({
        customer_id: Number(customerId),
        collection_receipt_id: receipt.id,
        collection_type: row.collection_type,
        serial_no: row.serial_no.trim(),
        tyre_type: row.tyre_type,
        size: row.size,
        sale_price: Number(row.sale_price || 0),
        original_brand: row.original_brand,
        original_pattern: row.original_pattern,
        retread_brand_id:
          row.collection_type === "Kaplama" && row.retread_brand_id
            ? Number(row.retread_brand_id)
            : null,
        tread_pattern_id:
          row.collection_type === "Kaplama" && row.tread_pattern_id
            ? Number(row.tread_pattern_id)
            : null,
        tyre_condition: row.tyre_condition || null,
        rim_status: row.rim_status || null,
        warranty_status: row.warranty_status || null,
        received_by: null,
        description: row.description,
        status: "collected",
      }));

      const { error: tyreError } = await supabase
        .from("tyres")
        .insert(tyrePayload);

      if (tyreError) throw new Error(tyreError.message);

      setSavedReceiptNo(receiptNo);
      setSavedReceiptId(receipt.id);

      if (openPrint) {
        window.location.href = `/collections/${receipt.id}/print`;
        return;
      }

      openMessage("Toplu alım kaydedildi.");

      setRows([]);
      setCustomerId("");
      setSelectedAddressId("");
      setDoorstepDelivery(false);
      setDeliveredBy("");
      setPaymentType("");
      setPaymentDueDate("");
      setDescription("");
      resetDraftRow();
    } catch (error) {
      const errText = error instanceof Error ? error.message : "Kayıt hatası";
      openMessage(errText);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Toplu Lastik Alımı
            </h1>
            <p className="text-[11px] text-slate-500">
              Fiş oluştur, lastikleri ekle, kaydet ve yazdır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              Toplam Lastik: <strong>{rows.length}</strong>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
              Toplam Tutar: <strong>{totalAmount.toFixed(2)} TL</strong>
            </div>
          </div>
        </div>
      </div>

      {savedReceiptNo ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 shadow-sm">
          Kayıt tamamlandı • Fiş No: <strong>{savedReceiptNo}</strong>
          {savedReceiptId ? ` (ID: ${savedReceiptId})` : ""}
        </div>
      ) : null}

      <SectionCard title="Müşteri Bilgileri">
        <div className="grid gap-2 md:grid-cols-12">
          <div className="md:col-span-4">
            <FieldLabel>Müşteri</FieldLabel>
            <SearchableSelect
              value={customerId}
              options={customerOptions}
              placeholder="Müşteri ara..."
              onChange={(value) => {
                setCustomerId(value);
                setSelectedAddressId("");
                setDoorstepDelivery(false);
              }}
            />
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Adres</FieldLabel>
            <SearchableSelect
              value={selectedAddressId}
              options={addressOptions}
              placeholder={!customerId ? "Önce müşteri seçin" : "Adres ara / seç..."}
              disabled={doorstepDelivery || !customerId}
              onChange={setSelectedAddressId}
              footerAction={
                customerId
                  ? {
                      label: "+ Yeni Adres Ekle",
                      onClick: () => setAddressModalOpen(true),
                    }
                  : undefined
              }
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>&nbsp;</FieldLabel>
            <div className="flex h-[38px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={doorstepDelivery}
                  onChange={(e) => {
                    setDoorstepDelivery(e.target.checked);
                    if (e.target.checked) {
                      setSelectedAddressId("");
                    }
                  }}
                />
                Kapı Önü Teslim
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Teslim Eden Kişi</FieldLabel>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={deliveredBy}
              readOnly={!canCreateCollection}
              disabled={!canCreateCollection}
              onChange={(e) => setDeliveredBy(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-12">
          <div className="md:col-span-4">
            <FieldLabel>Fiş Açıklama</FieldLabel>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={description}
              readOnly={!canCreateCollection}
              disabled={!canCreateCollection}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Ödeme Tipi</FieldLabel>
            <SearchableSelect
              value={paymentType}
              options={paymentTypeOptions}
              placeholder="Ödeme tipi seç..."
              onChange={(value) => setPaymentType(value as PaymentType)}
            />
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Ödeme Vadesi</FieldLabel>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
            />
          </div>
        </div>

        {selectedCustomer ? (
          <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700 md:grid-cols-3">
            <div>
              <span className="text-xs text-slate-500">Müşteri</span>
              <div className="font-medium text-slate-900">{selectedCustomer.name}</div>
            </div>

            <div>
              <span className="text-xs text-slate-500">Bölge</span>
              <div className="font-medium text-slate-900">
                {selectedCustomer.region || "-"}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500">Plasiyer</span>
              <div className="font-medium text-slate-900">
                {selectedCustomer.salesperson || "-"}
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={editingRowId ? "Lastik Düzenle" : "Lastik Ekle"}>
        <div className="grid gap-2 md:grid-cols-6">
          <div>
            <FieldLabel>Talep Edilen İşlem</FieldLabel>
            <CompactSegmentedSelect
              value={draftRow.collection_type}
              options={collectionTypeOptions}
              onChange={(value) => updateDraft("collection_type", value)}
            />
          </div>

          <div>
            <FieldLabel>Seri No</FieldLabel>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={draftRow.serial_no}
              readOnly={!canCreateCollection}
              disabled={!canCreateCollection}
              onChange={(e) => updateDraft("serial_no", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Ebat</FieldLabel>
            <SearchableSelect
              value={draftRow.size}
              options={sizeOptions}
              placeholder="Ebat seç..."
              disabled={!canCreateCollection}
              onChange={(value) => updateDraft("size", value)}
            />
          </div>

          <div>
            <FieldLabel>Lastik Türü</FieldLabel>
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 shadow-sm"
              value={draftRow.tyre_type}
              readOnly
              placeholder="Ebat seçildiğinde otomatik gelir"
            />
          </div>

          <div>
            <FieldLabel>
              {draftRow.collection_type === "Karkas Satın Alma"
                ? "Satınalma Fiyatı"
                : "Satış Fiyatı"}
            </FieldLabel>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 shadow-sm focus:border-slate-400 focus:outline-none"
                value={draftRow.sale_price}
                readOnly={!canCreateCollection}
                disabled={!canCreateCollection}
                onChange={(e) => updateDraft("sale_price", e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                TL
              </span>
            </div>
          </div>

          <div>
            <FieldLabel>Açıklama</FieldLabel>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={draftRow.description}
              readOnly={!canCreateCollection}
              disabled={!canCreateCollection}
              onChange={(e) => updateDraft("description", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-6">
          <div>
            <FieldLabel>Lastik Durumu</FieldLabel>
            <CompactSegmentedSelect
              value={draftRow.tyre_condition}
              options={tyreConditionOptions}
              onChange={(value) => updateDraft("tyre_condition", value)}
            />
          </div>

          <div>
            <FieldLabel>Jant</FieldLabel>
            <CompactSegmentedSelect
              value={draftRow.rim_status}
              options={yesNoOptions}
              onChange={(value) => updateDraft("rim_status", value)}
            />
          </div>

          <div>
            <FieldLabel>Garanti</FieldLabel>
            <CompactSegmentedSelect
              value={draftRow.warranty_status}
              options={yesNoOptions}
              onChange={(value) => updateDraft("warranty_status", value)}
            />
          </div>

          <div>
            <FieldLabel>Orijinal Marka</FieldLabel>
            <SearchableSelect
              value={draftRow.original_brand}
              options={originalBrandOptions}
              placeholder="Orijinal marka seç..."
              disabled={!canCreateCollection}
              onChange={(value) => updateDraft("original_brand", value)}
            />
          </div>

          <div>
            <FieldLabel>Orijinal Desen</FieldLabel>
            <SearchableSelect
              value={draftRow.original_pattern}
              options={originalPatternOptions}
              placeholder="Orijinal desen seç..."
              disabled={!canCreateCollection}
              onChange={(value) => updateDraft("original_pattern", value)}
            />
          </div>

          <div />
        </div>

        {draftRow.collection_type === "Kaplama" ? (
          <div className="mt-2 grid gap-2 md:grid-cols-6">
            <div>
              <FieldLabel>Kaplama Marka</FieldLabel>
              <SearchableSelect
                value={draftRow.retread_brand_id}
                options={retreadBrandOptions}
                placeholder="Kaplama marka seç..."
                disabled={!canCreateCollection}
                onChange={(value) => updateDraft("retread_brand_id", value)}
              />
            </div>

            <div>
              <FieldLabel>Kaplama Desen</FieldLabel>
              <SearchableSelect
                value={draftRow.tread_pattern_id}
                options={retreadPatternOptions}
                placeholder={
                  !draftRow.retread_brand_id ? "Önce marka seçin" : "Kaplama desen seç..."
                }
                disabled={!draftRow.retread_brand_id || !canCreateCollection}
                onChange={(value) => updateDraft("tread_pattern_id", value)}
              />
            </div>

            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end justify-end gap-2">
          {canCreateCollection ? (
            <button
              type="button"
              onClick={addCurrentRow}
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Ekle
            </button>
          ) : null}

          {editingRowId ? (
            canEditCollection ? (
              <button
                type="button"
                onClick={resetDraftRow}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                İptal
              </button>
            ) : null
          ) : canCreateCollection ? (
            <>
              <input
                type="number"
                min="1"
                className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
              />

              <button
                type="button"
                onClick={addBulkRows}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {bulkCount || "*"} Adet Ekle
              </button>
            </>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Eklenen Lastikler">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            Toplam Adet: <strong>{rows.length}</strong>
          </div>
          <div>
            Toplam Tutar: <strong>{totalAmount.toFixed(2)} TL</strong>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1550px] border-collapse bg-white">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-2 text-xs">Sil</th>
                <th className="p-2 text-xs">Talep Edilen İşlem</th>
                <th className="p-2 text-xs">Seri No</th>
                <th className="p-2 text-xs">Tür</th>
                <th className="p-2 text-xs">Ebat</th>
                <th className="p-2 text-xs">Fiyat</th>
                <th className="p-2 text-xs">Durum</th>
                <th className="p-2 text-xs">Jant</th>
                <th className="p-2 text-xs">Garanti</th>
                <th className="p-2 text-xs">Orijinal Marka</th>
                <th className="p-2 text-xs">Orijinal Desen</th>
                <th className="p-2 text-xs">Kaplama</th>
                <th className="p-2 text-xs">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-5 text-center text-sm text-slate-500">
                    Henüz lastik eklenmedi
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const brandName =
                    retreadBrands.find(
                      (brand) => brand.id === Number(row.retread_brand_id)
                    )?.name || "-";

                  const patternName =
                    treadPatterns.find(
                      (pattern) => pattern.id === Number(row.tread_pattern_id)
                    )?.name || "-";

                  const showRetread = row.collection_type === "Kaplama";

                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 ${
                        editingRowId === row.id ? "bg-amber-50" : "hover:bg-slate-50"
                      }`}
                      onClick={() => editRow(row.id)}
                    >
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        {canDeleteCollection ? (
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                          >
                            Sil
                          </button>
                        ) : null}
                      </td>

                      <td className="p-2 text-sm">
                        {row.collection_type === "Karkas Satın Alma"
                          ? "Karkas"
                          : row.collection_type || "-"}
                      </td>

                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                          value={row.serial_no}
                          readOnly={!canEditCollection}
                          disabled={!canEditCollection}
                          onChange={(e) =>
                            updateListRow(row.id, "serial_no", e.target.value)
                          }
                        />
                      </td>

                      <td className="p-2 text-sm">{row.tyre_type || "-"}</td>
                      <td className="p-2 text-sm">{row.size || "-"}</td>
                      <td className="p-2 text-sm">
                        {Number(row.sale_price || 0).toFixed(2)} TL
                      </td>
                      <td className="p-2 text-sm">{row.tyre_condition || "-"}</td>
                      <td className="p-2 text-sm">{row.rim_status || "-"}</td>
                      <td className="p-2 text-sm">{row.warranty_status || "-"}</td>
                      <td className="p-2 text-sm">{row.original_brand || "-"}</td>
                      <td className="p-2 text-sm">{row.original_pattern || "-"}</td>
                      <td className="p-2 text-sm">
                        {showRetread
                          ? `${brandName} ${patternName !== "-" ? patternName : ""}`
                          : "-"}
                      </td>
                      <td className="p-2 text-sm">{row.description || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="sticky bottom-2 z-30">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Hazır kayıt: <strong>{rows.length}</strong> • Toplam:{" "}
            <strong>{totalAmount.toFixed(2)} TL</strong>
          </div>

          <div className="flex flex-wrap gap-2">
            {canCreateCollection ? (
              <button
                type="button"
                onClick={() => saveCollection(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            ) : null}

            {canPrintCollection ? (
              <button
                type="button"
                onClick={() => saveCollection(true)}
                disabled={saving}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet ve Yazdır"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {addressModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Yeni Adres Ekle
            </h3>

            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Müşteri: <strong>{selectedCustomer?.name || "-"}</strong>
            </div>

            <div className="mt-3">
              <FieldLabel>Adres</FieldLabel>
              <textarea
                autoFocus
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
                rows={4}
                value={newAddressText}
                onChange={(e) => setNewAddressText(e.target.value)}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddressModalOpen(false);
                  setNewAddressText("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleAddAddress}
                disabled={addingAddress}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {addingAddress ? "Ekleniyor..." : "Adresi Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Uyarı</h3>
            <div className="mt-3 text-sm text-slate-700">{message}</div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setMessage("")}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}