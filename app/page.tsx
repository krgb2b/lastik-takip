import { supabase } from "../src/lib/supabase";

export default async function Home() {
  const { data: tyres, error } = await supabase
    .from("tyres")
    .select(`
      id,
      serial_no,
      tyre_type,
      size,
      original_brand,
      original_pattern,
      sale_price,
      status,
      customers (
        name
      )
    `)
    .limit(20);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">KRG Kaplama Takip</h1>

      {error ? (
        <p className="mt-4">Hata: {error.message}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {tyres?.map((tyre) => {
            const customerName = Array.isArray(tyre.customers)
              ? tyre.customers[0]?.name
              : tyre.customers?.name;

            return (
              <div key={tyre.id} className="rounded border p-4">
                <div><strong>Müşteri:</strong> {customerName}</div>
                <div><strong>Seri No:</strong> {tyre.serial_no}</div>
                <div><strong>Tür:</strong> {tyre.tyre_type}</div>
                <div><strong>Ebat:</strong> {tyre.size}</div>
                <div><strong>Marka:</strong> {tyre.original_brand}</div>
                <div><strong>Desen:</strong> {tyre.original_pattern}</div>
                <div><strong>Satış Fiyatı:</strong> {tyre.sale_price}</div>
                <div><strong>Durum:</strong> {tyre.status}</div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}