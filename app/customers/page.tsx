"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";

type Customer = {
  id: number;
  name: string;
  region: string | null;
  salesperson: string | null;
  created_at?: string | null;
};

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

export default function CustomersPage() {
  return (
    <PermissionGuard
      permission="collections.view"
      title="Müşteriler sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <CustomersPageContent />
    </PermissionGuard>
  );
}

function CustomersPageContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [searchText, setSearchText] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [region, setRegion] = useState("");
  const [salesperson, setSalesperson] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("customers")
        .select("id, name, region, salesperson, created_at")
        .order("name");

      if (error) {
        console.error("Customers load error:", error.message);
        setError(error.message);
        setLoading(false);
        return;
      }

      setCustomers((data || []) as Customer[]);
      setLoading(false);
    }

    loadData();
  }, []);

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

  const filteredCustomers = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return customers.filter((customer) => {
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

      const haystack = [
        customer.name || "",
        customer.region || "",
        customer.salesperson || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [customers, searchText, regionFilter, salespersonFilter]);

  const totalCustomerCount = filteredCustomers.length;

  const distinctRegionCount = useMemo(() => {
    return new Set(filteredCustomers.map((x) => x.region).filter(Boolean)).size;
  }, [filteredCustomers]);

  const distinctSalespersonCount = useMemo(() => {
    return new Set(filteredCustomers.map((x) => x.salesperson).filter(Boolean)).size;
  }, [filteredCustomers]);

  function resetForm() {
    setEditingCustomerId(null);
    setCustomerName("");
    setRegion("");
    setSalesperson("");
  }

  function openCreateModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomerId(customer.id);
    setCustomerName(customer.name || "");
    setRegion(customer.region || "");
    setSalesperson(customer.salesperson || "");
    setModalOpen(true);
  }

  async function handleSaveCustomer() {
    if (!customerName.trim()) {
      alert("Müşteri adı zorunlu.");
      return;
    }

    setSaving(true);

    try {
      if (editingCustomerId) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: customerName.trim(),
            region: region.trim() || null,
            salesperson: salesperson.trim() || null,
          })
          .eq("id", editingCustomerId);

        if (error) {
          throw new Error(error.message);
        }

        setCustomers((prev) =>
          prev.map((customer) =>
            customer.id === editingCustomerId
              ? {
                  ...customer,
                  name: customerName.trim(),
                  region: region.trim() || null,
                  salesperson: salesperson.trim() || null,
                }
              : customer
          )
        );
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            name: customerName.trim(),
            region: region.trim() || null,
            salesperson: salesperson.trim() || null,
          })
          .select("id, name, region, salesperson, created_at")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setCustomers((prev) =>
          [...prev, data as Customer].sort((a, b) =>
            a.name.localeCompare(b.name, "tr")
          )
        );
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

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-4 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
            <p className="mt-1 text-sm text-slate-600">
              Müşteri, bölge ve plasiyer bilgilerini yönetebilirsin.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Yeni Müşteri
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Müşteri Adedi" value={String(totalCustomerCount)} />
        <SummaryCard title="Bölge Sayısı" value={String(distinctRegionCount)} />
        <SummaryCard
          title="Plasiyer Sayısı"
          value={String(distinctSalespersonCount)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Müşteri, bölge veya plasiyer ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">Tüm Bölgeler</option>
            {regionOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
          >
            <option value="all">Tüm Plasiyerler</option>
            {salespersonOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
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
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-100 bg-white">
                  <td className="p-3 text-sm font-medium text-slate-900">
                    {customer.name}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {customer.region || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {customer.salesperson || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">
                    {formatDate(customer.created_at)}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(customer)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Düzenle
                    </button>
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
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingCustomerId ? "Müşteri Düzenle" : "Yeni Müşteri"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Müşteri, bölge ve plasiyer bilgisini kaydet.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Müşteri Adı
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Bölge
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Plasiyer
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleSaveCustomer}
                disabled={saving}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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