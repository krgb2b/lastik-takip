"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";
import { can } from "@/src/lib/auth/permissions";
import { usePermissionState } from "@/src/hooks/usePermissionState";
import {
  CUSTOMER_WITH_RELATIONS_SELECT,
  normalizeCustomerRows,
  type CustomerWithRelationsRow,
  type NormalizedCustomer,
} from "@/src/lib/customer-relations";

type Region = { id: number; name: string; is_active: boolean };
type SalespersonRegionLink = {
  region_id: number | null;
};

type SalespersonRow = {
  id: number;
  name: string;
  region_id: number | null;
  is_active: boolean;
  salesperson_regions?: SalespersonRegionLink | SalespersonRegionLink[] | null;
};

type Salesperson = {
  id: number;
  name: string;
  regionIds: number[];
  is_active: boolean;
};

type CustomerAddress = {
  id: number;
  customer_id: number;
  address_text: string;
};

const SALESPERSON_WITH_REGIONS_SELECT = `
  id,
  name,
  region_id,
  is_active,
  salesperson_regions(region_id)
`;

function normalizeSalespeople(rows: SalespersonRow[]): Salesperson[] {
  return rows.map((row) => {
    const relationRows = Array.isArray(row.salesperson_regions)
      ? row.salesperson_regions
      : row.salesperson_regions
        ? [row.salesperson_regions]
        : [];

    const regionIds = Array.from(
      new Set(
        relationRows
          .map((relation) => relation.region_id)
          .filter((value): value is number => value !== null)
      )
    );

    if (regionIds.length === 0 && row.region_id) {
      regionIds.push(row.region_id);
    }

    return {
      id: row.id,
      name: row.name,
      regionIds,
      is_active: row.is_active,
    };
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

export default function AdminCustomersPage() {
  return (
    <PermissionGuard
      permission="users.view"
      title="Müşteriler sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AdminCustomersPageContent />
    </PermissionGuard>
  );
}

function AdminCustomersPageContent() {
  const { permissionState } = usePermissionState();
  const canEditCustomer = can(permissionState, "users.edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [customers, setCustomers] = useState<NormalizedCustomer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);

  const [searchText, setSearchText] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [salespersonId, setSalespersonId] = useState("");

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [newAddressText, setNewAddressText] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [customersRes, regionsRes, salespeopleRes, addressesRes] = await Promise.all([
        supabase.from("customers").select(CUSTOMER_WITH_RELATIONS_SELECT).order("name"),
        supabase.from("regions").select("id, name, is_active").eq("is_active", true).order("name"),
        supabase
          .from("salespeople")
          .select(SALESPERSON_WITH_REGIONS_SELECT)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("customer_addresses")
          .select("id, customer_id, address_text")
          .order("id", { ascending: false }),
      ]);

      const firstError = [customersRes.error, regionsRes.error, salespeopleRes.error, addressesRes.error].find(Boolean);
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setCustomers(normalizeCustomerRows((customersRes.data || []) as CustomerWithRelationsRow[]));
      setRegions((regionsRes.data || []) as Region[]);
      setSalespeople(normalizeSalespeople((salespeopleRes.data || []) as SalespersonRow[]));
      setCustomerAddresses((addressesRes.data || []) as CustomerAddress[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const regionMap = useMemo(() => new Map(regions.map((item) => [item.id, item])), [regions]);
  const salespersonMap = useMemo(() => new Map(salespeople.map((item) => [item.id, item])), [salespeople]);

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
        return;
      }

      if (modalOpen) {
        setModalOpen(false);
        resetForm();
      }
    }

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [message, addressModalOpen, modalOpen]);

  const selectedCustomerAddresses = useMemo(() => {
    if (!editingCustomerId) return [];
    return customerAddresses.filter((address) => address.customer_id === editingCustomerId);
  }, [customerAddresses, editingCustomerId]);

  const filteredSalespeople = useMemo(() => {
    if (!regionId) return salespeople;
    const selectedRegionId = Number(regionId);
    return salespeople.filter(
      (item) => item.regionIds.length === 0 || item.regionIds.includes(selectedRegionId)
    );
  }, [salespeople, regionId]);

  const filteredCustomers = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");
    return customers.filter((customer) => {
      if (regionFilter !== "all" && String(customer.regionId || "") !== regionFilter) return false;
      if (salespersonFilter !== "all" && String(customer.salespersonId || "") !== salespersonFilter) return false;
      if (!q) return true;

      const haystack = [customer.name, customer.region || "", customer.salesperson || ""]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [customers, searchText, regionFilter, salespersonFilter]);

  const totalCustomerCount = filteredCustomers.length;
  const distinctRegionCount = useMemo(() => new Set(filteredCustomers.map((x) => x.region).filter(Boolean)).size, [filteredCustomers]);
  const distinctSalespersonCount = useMemo(() => new Set(filteredCustomers.map((x) => x.salesperson).filter(Boolean)).size, [filteredCustomers]);

  function resetForm() {
    setEditingCustomerId(null);
    setCustomerName("");
    setRegionId("");
    setSalespersonId("");
    setAddressModalOpen(false);
    setNewAddressText("");
  }

  function openCreateModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(customer: NormalizedCustomer) {
    setEditingCustomerId(customer.id);
    setCustomerName(customer.name || "");
    setRegionId(customer.regionId ? String(customer.regionId) : "");
    setSalespersonId(customer.salespersonId ? String(customer.salespersonId) : "");
    setModalOpen(true);
  }

  async function handleSaveCustomer() {
    if (!canEditCustomer) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    if (!customerName.trim()) {
      alert("Müşteri adı zorunlu.");
      return;
    }

    const resolvedRegion = regionId ? regionMap.get(Number(regionId)) || null : null;
    const resolvedSalesperson = salespersonId ? salespersonMap.get(Number(salespersonId)) || null : null;

    setSaving(true);

    try {
      const payload = {
        name: customerName.trim(),
        region_id: resolvedRegion?.id || null,
        salesperson_id: resolvedSalesperson?.id || null,
      };

      if (editingCustomerId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editingCustomerId);
        if (error) throw new Error(error.message);

        setCustomers((prev) =>
          prev.map((customer) =>
            customer.id === editingCustomerId
              ? {
                  ...customer,
                  name: payload.name,
                  region: resolvedRegion?.name || null,
                  salesperson: resolvedSalesperson?.name || null,
                  regionId: payload.region_id,
                  salespersonId: payload.salesperson_id,
                }
              : customer
          )
        );
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert(payload)
          .select(CUSTOMER_WITH_RELATIONS_SELECT)
          .single();

        if (error) throw new Error(error.message);

        const normalized = normalizeCustomerRows([data as CustomerWithRelationsRow])[0];
        setCustomers((prev) => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name, "tr")));
      }

      setModalOpen(false);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kayıt hatası";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustomer(customer: NormalizedCustomer) {
    if (!canEditCustomer) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const approved = window.confirm(`\"${customer.name}\" müşterisini silmek istediğine emin misin?`);
    if (!approved) return;

    setDeletingCustomerId(customer.id);

    try {
      const { error } = await supabase.from("customers").delete().eq("id", customer.id);
      if (error) throw new Error(error.message);
      setCustomers((prev) => prev.filter((item) => item.id !== customer.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Silme hatası";
      alert(`Müşteri silinemedi: ${message}`);
    } finally {
      setDeletingCustomerId(null);
    }
  }

  async function handleAddAddress() {
    if (!editingCustomerId) {
      setMessage("Önce müşteri düzenleme modunu açmalısın.");
      return;
    }

    if (!newAddressText.trim()) {
      setMessage("Adres yazmalısın.");
      return;
    }

    setAddingAddress(true);

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: editingCustomerId,
        address_text: newAddressText.trim(),
      })
      .select("id, customer_id, address_text")
      .single();

    if (error) {
      setMessage(error.message);
      setAddingAddress(false);
      return;
    }

    const newAddress = data as CustomerAddress;
    setCustomerAddresses((prev) => [newAddress, ...prev]);
    setAddressModalOpen(false);
    setNewAddressText("");
    setAddingAddress(false);
  }

  async function handleDeleteAddress(addressId: number) {
    if (!canEditCustomer) {
      alert("Bu işlem için yetkin yok.");
      return;
    }

    const approved = window.confirm("Bu adresi silmek istediğine emin misin?");
    if (!approved) return;

    setDeletingAddressId(addressId);

    try {
      const { error } = await supabase.from("customer_addresses").delete().eq("id", addressId);
      if (error) throw new Error(error.message);
      setCustomerAddresses((prev) => prev.filter((item) => item.id !== addressId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Adres silinemedi";
      setMessage(message);
    } finally {
      setDeletingAddressId(null);
    }
  }

  if (loading) return <main className="p-6">Yükleniyor...</main>;
  if (error) return <main className="p-6">Hata: {error}</main>;

  return (
    <main className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
          <p className="mt-1 text-sm text-slate-600">Müşteri, bölge ve plasiyer ilişkilerini yönetebilirsin.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEditCustomer}
          className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Yeni Müşteri
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <input
            className="filter-control"
            placeholder="Müşteri, bölge veya plasiyer ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select className="filter-control" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="all">Tüm Bölgeler</option>
            {regions.map((item) => (
              <option key={item.id} value={String(item.id)}>{item.name}</option>
            ))}
          </select>
          <select className="filter-control" value={salespersonFilter} onChange={(e) => setSalespersonFilter(e.target.value)}>
            <option value="all">Tüm Plasiyerler</option>
            {salespeople.map((item) => (
              <option key={item.id} value={String(item.id)}>{item.name}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="p-3 text-xs font-semibold text-slate-600">Müşteri</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Bölge</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Plasiyer</th>
              <th className="p-3 text-xs font-semibold text-slate-600">Oluşturulma</th>
              <th className="p-3 text-xs font-semibold text-slate-600">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Kayıt bulunamadı.</td></tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-100 bg-white">
                  <td className="p-3 text-sm font-medium text-slate-900">{customer.name}</td>
                  <td className="p-3 text-sm text-slate-700">{customer.region || "-"}</td>
                  <td className="p-3 text-sm text-slate-700">{customer.salesperson || "-"}</td>
                  <td className="p-3 text-sm text-slate-700">{formatDate(customer.created_at)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditModal(customer)} disabled={!canEditCustomer} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Düzenle</button>
                      <button type="button" onClick={() => handleDeleteCustomer(customer)} disabled={!canEditCustomer || deletingCustomerId === customer.id} className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60">{deletingCustomerId === customer.id ? "Siliniyor..." : "Sil"}</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editingCustomerId ? "Müşteri Düzenle" : "Yeni Müşteri"}</h2>
                <p className="mt-1 text-sm text-slate-600">Müşteri bilgisi ile bağlı bölge ve plasiyeri seç.</p>
              </div>
              <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Kapat</button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Müşteri Adı</label>
                <input className="filter-control" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bölge</label>
                <select className="filter-control" value={regionId} onChange={(e) => { setRegionId(e.target.value); setSalespersonId(""); }}>
                  <option value="">Seçiniz</option>
                  {regions.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plasiyer</label>
                <select className="filter-control" value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {filteredSalespeople.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {editingCustomerId && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Müşteri Adresleri</h3>
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(true)}
                    disabled={!canEditCustomer}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    + Yeni Adres
                  </button>
                </div>

                {selectedCustomerAddresses.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
                    Henüz kayıtlı adres yok.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomerAddresses.map((address) => (
                      <div key={address.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="min-w-0 flex-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                          {address.address_text}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(address.id)}
                          disabled={!canEditCustomer || deletingAddressId === address.id}
                          className="mt-1 shrink-0 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          {deletingAddressId === address.id ? "Siliniyor..." : "Sil"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Vazgeç</button>
              <button type="button" onClick={handleSaveCustomer} disabled={saving || !canEditCustomer} className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">{saving ? "Kaydediliyor..." : "Kaydet"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {addressModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Yeni Adres Ekle</h3>

            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Müşteri: <strong>{customers.find((c) => c.id === editingCustomerId)?.name || "-"}</strong>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Adres</label>
              <textarea
                autoFocus
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-slate-400 focus:outline-none"
                rows={4}
                value={newAddressText}
                onChange={(e) => setNewAddressText(e.target.value)}
                placeholder="Adres yazınız..."
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
                disabled={addingAddress || !canEditCustomer}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {addingAddress ? "Ekleniyor..." : "Adresi Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <p className="text-sm text-slate-700">{message}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setMessage("")}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
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

