import { supabase } from "../src/lib/supabase";

export default async function Home() {
  const [{ data: tyres, error: tyresError }, { data: customers, error: customersError }] =
    await Promise.all([
      supabase
        .from("tyres")
        .select(`
          id,
          customer_id,
          serial_no,
          tyre_type,
          size,
          original_brand,
          original_pattern,
          sale_price,
          status
        `)
        .order("id", { ascending: false })
        .limit(20),
      supabase
        .from("customers")
        .select("id, name"),
    ]);

  const error = tyresError || customersError;

  const customerMap = new Map(
    (customers || []).map((customer) => [customer.id, customer.name])
  );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">KRG Kaplama Takip</h1>
<a
  href="/tyres/new"
  className="inline-block mt-4 rounded border px-4 py-2"
>
  Yeni Lastik Kaydı
</a>
      {error ? (
        <p className="mt-4">Hata: {error.message}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {tyres?.map((tyre) => (
            <div key={tyre.id} className="rounded border p-4">
              <div><strong>ID:</strong> {tyre.id}</div>
              <div><strong>Müşteri:</strong> {customerMap.get(tyre.customer_id) || "-"}</div>
              <div><strong>Seri No:</strong> {tyre.serial_no}</div>
              <div><strong>Tür:</strong> {tyre.tyre_type}</div>
              <div><strong>Ebat:</strong> {tyre.size}</div>
              <div><strong>Marka:</strong> {tyre.original_brand}</div>
              <div><strong>Desen:</strong> {tyre.original_pattern}</div>
              <div><strong>Satış Fiyatı:</strong> {tyre.sale_price}</div>
              <div><strong>Durum:</strong> {tyre.status}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}