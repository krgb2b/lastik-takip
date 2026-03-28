"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

type Option = {
  value: string;
  label: string;
};

type Customer = NormalizedCustomer;

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

type TyreUsageRow = {
  tyre_type?: string | null;
  size?: string | null;
  original_pattern?: string | null;
};

type OriginalBrandMaster = {
  id: number;
  name: string;
};

type OriginalPatternMaster = {
  id: number;
  brand_id: number;
  name: string;
  sort_order: number;
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

const CONTROL_INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none";
const CONTROL_INPUT_DISABLED_CLASS = `${CONTROL_INPUT_CLASS} disabled:bg-slate-100`;
const CONTROL_READONLY_INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 shadow-sm";
const CONTROL_SEGMENT_CONTAINER_CLASS =
  "flex h-[42px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm";
const CONTROL_SEGMENT_BUTTON_BASE_CLASS =
  "h-full flex-1 px-3 text-sm font-medium transition";

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

function normalizeUsageText(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
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

type ExistingTyreCycleRow = {
  serial_no: string;
  status: string | null;
  rejection_return_shipped: boolean | null;
  cycle_no: number | null;
};

function isTerminalCycleStatus(tyre: ExistingTyreCycleRow) {
  if (tyre.status === "shipped") return true;
  if (tyre.status === "rejected" && tyre.rejection_return_shipped === true) {
    return true;
  }
  return false;
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
  inputRef,
  onEnterNext,
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
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnterNext?: () => void;
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
        ref={inputRef}
        className={CONTROL_INPUT_DISABLED_CLASS}
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
            e.preventDefault();
            if (open) {
              commitBestMatch();
            }
            onEnterNext?.();
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
  onEnterNext,
  firstButtonRef,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onEnterNext?: () => void;
  firstButtonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className={CONTROL_SEGMENT_CONTAINER_CLASS}>
      {options.map((option, index) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            ref={index === 0 ? firstButtonRef : undefined}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onChange(option.value);
                onEnterNext?.();
              }
            }}
            className={[
              CONTROL_SEGMENT_BUTTON_BASE_CLASS,
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
  const [masterOriginalPatterns, setMasterOriginalPatterns] = useState<
    OriginalPatternMaster[]
  >([]);

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
  const [justSaved, setJustSaved] = useState(false);
  const [bulkCount, setBulkCount] = useState("1");

  const [draftRow, setDraftRow] = useState<Row>(createEmptyRow(1));
  const [editingRowId, setEditingRowId] = useState<number | null>(null);

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [newAddressText, setNewAddressText] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);

  const [message, setMessage] = useState("");

  const serialInputRef = useRef<HTMLInputElement | null>(null);
  const sizeInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const tyreConditionFirstButtonRef = useRef<HTMLButtonElement | null>(null);
  const originalBrandInputRef = useRef<HTMLInputElement | null>(null);
  const originalPatternInputRef = useRef<HTMLInputElement | null>(null);
  const retreadBrandInputRef = useRef<HTMLInputElement | null>(null);
  const retreadPatternInputRef = useRef<HTMLInputElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const allowNavigationRef = useRef(false);

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
          .select(CUSTOMER_WITH_RELATIONS_SELECT)
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
          .order("name"),
        supabase
          .from("tyre_sizes")
          .select("id, tyre_type_id, name, sort_order")
          .order("name"),
        supabase.from("original_brands").select("id, name").order("name"),
        supabase.from("tyres").select("tyre_type, size, original_pattern"),
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

      setCustomers(
        normalizeCustomerRows(
          ((customersRes.data || []) as CustomerWithRelationsRow[])
        )
      );
      setCustomerAddresses((addressesRes.data || []) as CustomerAddress[]);
      setRetreadBrands((brandsRes.data || []) as RetreadBrand[]);
      setTreadPatterns((patternsRes.data || []) as TreadPattern[]);
      const tyreRows = (tyresRes.data || []) as TyreUsageRow[];

      const typeUsageCounts = new Map<string, number>();
      const sizeUsageCounts = new Map<string, number>();

      tyreRows.forEach((row) => {
        if (row.tyre_type?.trim()) {
          const key = normalizeUsageText(row.tyre_type);
          typeUsageCounts.set(key, (typeUsageCounts.get(key) || 0) + 1);
        }

        if (row.size?.trim()) {
          const key = normalizeSizeKey(row.size);
          sizeUsageCounts.set(key, (sizeUsageCounts.get(key) || 0) + 1);
        }
      });

      setTyreTypes(
        [ ...((tyreTypesRes.data || []) as TyreTypeMaster[]) ].sort((a, b) => {
          const usageDiff = (typeUsageCounts.get(normalizeUsageText(b.name)) || 0) - (typeUsageCounts.get(normalizeUsageText(a.name)) || 0);
          if (usageDiff !== 0) return usageDiff;
          return a.name.localeCompare(b.name, "tr");
        })
      );
      setTyreSizes(
        [ ...((tyreSizesRes.data || []) as TyreSizeMaster[]) ].sort((a, b) => {
          const usageDiff = (sizeUsageCounts.get(normalizeSizeKey(b.name)) || 0) - (sizeUsageCounts.get(normalizeSizeKey(a.name)) || 0);
          if (usageDiff !== 0) return usageDiff;
          return a.name.localeCompare(b.name, "tr");
        })
      );
      setOriginalBrands((originalBrandsRes.data || []) as OriginalBrandMaster[]);

      const { data: originalPatternRows, error: originalPatternError } = await supabase
        .from("original_pattern")
        .select("id, brand_id, name, sort_order")
        .order("sort_order")
        .order("name");

      if (originalPatternError) {
        setMasterOriginalPatterns([]);
        return;
      }

      setMasterOriginalPatterns(
        ((originalPatternRows || []) as OriginalPatternMaster[]).filter(
          (item) => !!item.name?.trim()
        )
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

  useEffect(() => {
    if (rows.length > 0 && justSaved) {
      setJustSaved(false);
    }
  }, [rows.length, justSaved]);

  useEffect(() => {
    const hasUnsavedTyres = rows.length > 0;
    if (!hasUnsavedTyres || justSaved) {
      allowNavigationRef.current = false;
      return;
    }

    const warningText =
      "Tabloya lastik eklendi. Sayfadan ayrılırsan bilgiler kaybolacak. Devam etmek istiyor musun?";

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = warningText;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (allowNavigationRef.current) return;

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (nextUrl.href === currentUrl.href) return;

      const confirmed = window.confirm(warningText);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      allowNavigationRef.current = true;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [rows.length, justSaved]);

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.sale_price || 0), 0);
  }, [rows]);

  const headerLocked = rows.length > 0;

  const selectedCustomer =
    customers.find((c) => String(c.id) === customerId) || null;

  const selectedCustomerAddresses = useMemo(() => {
    if (!customerId) return [];
    return customerAddresses.filter(
      (address) => String(address.customer_id) === customerId
    );
  }, [customerAddresses, customerId]);
function normalizeSizeKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .toLocaleLowerCase("tr-TR");
}

const tyreTypeBySize = useMemo(() => {
  const typeMap = new Map<number, string>();
  const result = new Map<string, string>();

  tyreTypes.forEach((typeRow) => {
    typeMap.set(Number(typeRow.id), String(typeRow.name).trim());
  });

  tyreSizes.forEach((sizeRow) => {
    const normalizedSize = normalizeSizeKey(String(sizeRow.name));
    const typeName = typeMap.get(Number(sizeRow.tyre_type_id));

    if (typeName) {
      result.set(normalizedSize, typeName);
    }
  });

  console.log(
    "TYPE MAP:",
    tyreTypes.map((t) => ({
      id: t.id,
      idType: typeof t.id,
      name: t.name,
    }))
  );

  console.log(
    "SIZE MAP SOURCE:",
    tyreSizes.map((s) => ({
      id: s.id,
      name: s.name,
      normalized: normalizeSizeKey(String(s.name)),
      tyre_type_id: s.tyre_type_id,
      tyre_type_id_type: typeof s.tyre_type_id,
      matchedType: typeMap.get(Number(s.tyre_type_id)) || null,
    }))
  );

  console.log("FINAL tyreTypeBySize entries:", Array.from(result.entries()));

  return result;
}, [tyreSizes, tyreTypes]);

  const sizeOptions = useMemo(
  () =>
    tyreSizes.map((x) => ({
      value: String(x.name),
      label: String(x.name),
    })),
  [tyreSizes]
);
console.log("TYRE TYPES RAW:", tyreTypes);
console.log(
  "TYRE TYPE ID LIST:",
  tyreTypes.map((t) => ({
    id: t.id,
    name: t.name,
    idType: typeof t.id,
  }))
);
console.log(
  "HAS TYPE ID 4:",
  tyreTypes.some((t) => Number(t.id) === 4)
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

  const originalPatternOptions = useMemo(() => {
    if (!draftRow.original_brand) return [];

    const selectedBrand = originalBrands.find(
      (brand) => brand.name === draftRow.original_brand
    );

    if (!selectedBrand) return [];

    return masterOriginalPatterns
      .filter((pattern) => Number(pattern.brand_id) === Number(selectedBrand.id))
      .map((pattern) => ({
        value: pattern.name,
        label: pattern.name,
      }));
  }, [draftRow.original_brand, masterOriginalPatterns, originalBrands]);

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

      if (field === "original_brand") {
        return {
          ...prev,
          original_brand: value,
          original_pattern: "",
        };
      }

      if (field === "size") {
  const normalizedSize = normalizeSizeKey(String(value));
  const matchedType = tyreTypeBySize.get(normalizedSize) || "";

  console.log("SELECTED SIZE:", value);
  console.log("SELECTED SIZE TYPE:", typeof value);
  console.log("NORMALIZED SIZE:", normalizedSize);
  console.log("MATCHED TYPE:", matchedType);

  return {
    ...prev,
    size: value,
    tyre_type: matchedType,
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

  function validateHeaderForAdd() {
    if (!customerId) {
      openMessage("Önce müşteri seçmelisin.");
      return false;
    }

    if (!selectedAddressId) {
      openMessage("Adres seçmeden ekleme yapamazsın.");
      return false;
    }

    if (!deliveredBy.trim()) {
      openMessage("Teslim eden kişi zorunlu.");
      return false;
    }

    if (!paymentType) {
      openMessage("Ödeme tipi seçmelisin.");
      return false;
    }

    return true;
  }

  function addCurrentRow() {
    if (!canCreateCollection) return;
    if (!validateHeaderForAdd()) return;
    if (!validateDraftRow()) return;

    setJustSaved(false);

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
    if (!validateHeaderForAdd()) return;

    setJustSaved(false);

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
      .select("serial_no, status, rejection_return_shipped, cycle_no")
      .in("serial_no", serials);

    if (existingError) {
      openMessage(existingError.message);
      return;
    }

    const existingBySerial = new Map<string, ExistingTyreCycleRow[]>();
    for (const row of ((existingTyres || []) as ExistingTyreCycleRow[])) {
      const normalizedSerial = (row.serial_no || "").trim().toLowerCase();
      if (!normalizedSerial) continue;
      const list = existingBySerial.get(normalizedSerial);
      if (list) {
        list.push(row);
      } else {
        existingBySerial.set(normalizedSerial, [row]);
      }
    }

    const blockedSerials: string[] = [];
    const cycleNoBySerial = new Map<string, number>();

    for (const serial of serials) {
      const normalizedSerial = serial.trim().toLowerCase();
      const matches = existingBySerial.get(normalizedSerial) || [];

      if (matches.length === 0) {
        cycleNoBySerial.set(normalizedSerial, 1);
        continue;
      }

      const hasActiveCycle = matches.some((item) => !isTerminalCycleStatus(item));
      if (hasActiveCycle) {
        blockedSerials.push(serial);
        continue;
      }

      const maxCycleNo = matches.reduce((max, item) => {
        const cycleNo = item.cycle_no && item.cycle_no > 0 ? item.cycle_no : 1;
        return Math.max(max, cycleNo);
      }, 1);

      cycleNoBySerial.set(normalizedSerial, maxCycleNo + 1);
    }

    if (blockedSerials.length > 0) {
      openMessage(
        `Bu seri no için aktif süreç devam ediyor: ${blockedSerials.join(", ")}`
      );
      return;
    }

    setSaving(true);

    try {
  const { data: receipt, error: receiptError } = await supabase
    .from("collection_receipts")
    .insert({
      customer_id: Number(customerId),
      customer_address_id: doorstepDelivery ? null : Number(selectedAddressId),
      doorstep_delivery: doorstepDelivery,
      receipt_no: "TEMP",
      delivered_by: deliveredBy,
      payment_type: paymentType || null,
      payment_due_date: paymentDueDate || null,
      total_sale_price: totalAmount,
      description,
    })
    .select("id")
    .single();

  if (receiptError) throw new Error(receiptError.message);

  const yearPart = new Date().getFullYear().toString().slice(-2);
  const receiptNo = `ALM-${yearPart}${String(receipt.id).padStart(6, "0")}`;

  const { error: receiptNoUpdateError } = await supabase
    .from("collection_receipts")
    .update({
      receipt_no: receiptNo,
    })
    .eq("id", receipt.id);

  if (receiptNoUpdateError) throw new Error(receiptNoUpdateError.message);

  const tyrePayload = validRows.map((row) => ({
    customer_id: Number(customerId),
    collection_receipt_id: receipt.id,
    collection_type: row.collection_type,
    serial_no: row.serial_no.trim(),
    cycle_no: cycleNoBySerial.get(row.serial_no.trim().toLowerCase()) || 1,
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
        const printUrl = `/collections/${receipt.id}/print`;
        const popup = window.open(
          printUrl,
          "collection-print",
          "popup=yes,width=480,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
        );

        if (!popup) {
          openMessage("Yazdırma penceresi engellendi. Popup izni verip tekrar dene.");
          return;
        }
      }

      openMessage("Toplu alım kaydedildi.");

      setRows([]);
      setJustSaved(true);
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
            {savedReceiptNo ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-900">
                Kayıt: <strong>{savedReceiptNo}</strong>
                {savedReceiptId ? ` (ID: ${savedReceiptId})` : ""}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <SectionCard title="Müşteri Bilgileri">
        {headerLocked ? (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            İlk lastik eklendiği için müşteri bilgileri kilitlendi. Farklı müşteri için yeni form başlatmalısın.
          </div>
        ) : null}

        <div className="grid gap-2 md:grid-cols-12">
          <div className="md:col-span-4">
            <FieldLabel>Müşteri</FieldLabel>
            <SearchableSelect
              value={customerId}
              options={customerOptions}
              placeholder="Müşteri ara..."
              disabled={headerLocked}
              onChange={(value) => {
                setCustomerId(value);
                setSelectedAddressId("");
                setDoorstepDelivery(false);
              }}
            />
            {selectedCustomer ? (
              <div className="mt-1.5 text-[11px] text-slate-600">
                <strong className="text-slate-800">{selectedCustomer.name}</strong>
                <span className="mx-1.5">•</span>
                Bölge: {selectedCustomer.region || "-"}
                <span className="mx-1.5">•</span>
                Plasiyer: {selectedCustomer.salesperson || "-"}
              </div>
            ) : null}
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Adres</FieldLabel>
            <SearchableSelect
              value={selectedAddressId}
              options={addressOptions}
              placeholder={!customerId ? "Önce müşteri seçin" : "Adres ara / seç..."}
              disabled={headerLocked || doorstepDelivery || !customerId}
              onChange={setSelectedAddressId}
              footerAction={
                customerId && !headerLocked
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
                  disabled={headerLocked}
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
              readOnly={!canCreateCollection || headerLocked}
              disabled={!canCreateCollection || headerLocked}
              onChange={(e) => setDeliveredBy(e.target.value)}
            />
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Fiş Açıklama</FieldLabel>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={description}
              readOnly={!canCreateCollection || headerLocked}
              disabled={!canCreateCollection || headerLocked}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Ödeme Tipi</FieldLabel>
            <SearchableSelect
              value={paymentType}
              options={paymentTypeOptions}
              placeholder="Ödeme tipi seç..."
              disabled={headerLocked}
              onChange={(value) => setPaymentType(value as PaymentType)}
            />
          </div>

          <div className="md:col-span-4">
            <FieldLabel>Ödeme Vadesi</FieldLabel>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
              value={paymentDueDate}
              disabled={headerLocked}
              onChange={(e) => setPaymentDueDate(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title={editingRowId ? "Lastik Düzenle" : "Lastik Ekle"}>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Kimlik ve Islem
            </div>
            <div className="grid gap-2 md:grid-cols-6">
              <div>
                <FieldLabel>Talep Edilen İşlem</FieldLabel>
                <CompactSegmentedSelect
                  value={draftRow.collection_type}
                  options={collectionTypeOptions}
                  onChange={(value) => updateDraft("collection_type", value)}
                  onEnterNext={() => serialInputRef.current?.focus()}
                />
              </div>

              <div>
                <FieldLabel>Seri No</FieldLabel>
                <input
                  ref={serialInputRef}
                  className={CONTROL_INPUT_CLASS}
                  value={draftRow.serial_no}
                  readOnly={!canCreateCollection}
                  disabled={!canCreateCollection}
                  onChange={(e) => updateDraft("serial_no", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sizeInputRef.current?.focus();
                    }
                  }}
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
                  inputRef={sizeInputRef}
                  onEnterNext={() => priceInputRef.current?.focus()}
                />
              </div>

              <div>
                <FieldLabel>Lastik Türü</FieldLabel>
                <input
                  className={CONTROL_READONLY_INPUT_CLASS}
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
                    ref={priceInputRef}
                    type="number"
                    step="0.01"
                    className={`${CONTROL_INPUT_CLASS} pr-10`}
                    value={draftRow.sale_price}
                    readOnly={!canCreateCollection}
                    disabled={!canCreateCollection}
                    onChange={(e) => updateDraft("sale_price", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        tyreConditionFirstButtonRef.current?.focus();
                      }
                    }}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    TL
                  </span>
                </div>
              </div>

              <div>
                <FieldLabel>Açıklama</FieldLabel>
                <input
                  className={CONTROL_INPUT_CLASS}
                  value={draftRow.description}
                  readOnly={!canCreateCollection}
                  disabled={!canCreateCollection}
                  onChange={(e) => updateDraft("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Teknik Durum ve Desen
            </div>
            <div className="grid gap-2 md:grid-cols-6">
              <div>
                <FieldLabel>Lastik Durumu</FieldLabel>
                <CompactSegmentedSelect
                  value={draftRow.tyre_condition}
                  options={tyreConditionOptions}
                  onChange={(value) => updateDraft("tyre_condition", value)}
                  onEnterNext={() => originalBrandInputRef.current?.focus()}
                  firstButtonRef={tyreConditionFirstButtonRef}
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
                  inputRef={originalBrandInputRef}
                  onEnterNext={() => originalPatternInputRef.current?.focus()}
                />
              </div>

              <div>
                <FieldLabel>Orijinal Desen</FieldLabel>
                <SearchableSelect
                  value={draftRow.original_pattern}
                  options={originalPatternOptions}
                  placeholder={
                    !draftRow.original_brand
                      ? "Önce orijinal marka seçin"
                      : "Orijinal desen seç..."
                  }
                  disabled={!canCreateCollection || !draftRow.original_brand}
                  onChange={(value) => updateDraft("original_pattern", value)}
                  inputRef={originalPatternInputRef}
                  onEnterNext={() => {
                    if (draftRow.collection_type === "Kaplama") {
                      retreadBrandInputRef.current?.focus();
                    } else {
                      addButtonRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div />
            </div>
          </div>
        </div>

        {draftRow.collection_type === "Kaplama" ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Kaplama Detayi
            </div>
            <div className="grid gap-2 md:grid-cols-6">
              <div>
                <FieldLabel>Kaplama Marka</FieldLabel>
                <SearchableSelect
                  value={draftRow.retread_brand_id}
                  options={retreadBrandOptions}
                  placeholder="Kaplama marka seç..."
                  disabled={!canCreateCollection}
                  onChange={(value) => updateDraft("retread_brand_id", value)}
                  inputRef={retreadBrandInputRef}
                  onEnterNext={() => retreadPatternInputRef.current?.focus()}
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
                  inputRef={retreadPatternInputRef}
                  onEnterNext={() => addButtonRef.current?.focus()}
                />
              </div>

              <div />
              <div />
              <div />
              <div />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end justify-end gap-2">
          {canCreateCollection ? (
            <button
              ref={addButtonRef}
              type="button"
              onClick={addCurrentRow}
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {editingRowId ? "Düzenle" : "Ekle"}
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
                  className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
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
                className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            ) : null}

            {canPrintCollection ? (
              <button
                type="button"
                onClick={() => saveCollection(true)}
                disabled={saving}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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