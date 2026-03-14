import { supabase } from "../../../src/lib/supabase";
import { createTyre } from "./actions";

export default async function NewTyrePage() {
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  const { data: retreadBrands } = await supabase
    .from("retread_brands")
    .select("id, name")
    .order("name");

  const { data: treadPatterns } = await supabase
    .from("tread_patterns")
    .select("id, name")
    .order("name");

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Yeni Lastik Kaydı</h1>

      <form action={createTyre} className="mt-6 space-y-4">
        <div>
          <label className="block mb-1 font-medium">Müşteri</label>
          <select
            name="customer_id"
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="">Seçiniz</option>
            {customers?.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Kaplama Marka</label>
          <select
            name="retread_brand_id"
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Seçiniz</option>
            {retreadBrands?.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Kaplama Desen</label>
          <select
            name="tread_pattern_id"
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Seçiniz</option>
            {treadPatterns?.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Seri No</label>
          <input
            name="serial_no"
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Lastik Türü</label>
          <input name="tyre_type" className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block mb-1 font-medium">Ebat</label>
          <input name="size" className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block mb-1 font-medium">Orijinal Marka</label>
          <input
            name="original_brand"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Orijinal Desen</label>
          <input
            name="original_pattern"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Satış Fiyatı</label>
          <input
            name="sale_price"
            type="number"
            step="0.01"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Teslim Alan Kişi</label>
          <input
            name="received_by"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Açıklama</label>
          <textarea
            name="description"
            className="w-full border rounded px-3 py-2"
            rows={4}
          />
        </div>

        <button className="border rounded px-4 py-2">
          Kaydet
        </button>
      </form>
    </main>
  );
}