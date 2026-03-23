"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";

type ProductionChartRow = {
  date: string;
  count: number;
};

export default function DashboardPage() {
  return (
    <PermissionGuard
      permission="dashboard.view"
      title="Ana Panel sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <DashboardPageContent />
    </PermissionGuard>
  );
}

function DashboardPageContent() {
  const [productionChartData, setProductionChartData] = useState<ProductionChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const maxChartValue = useMemo(() => {
    const max = Math.max(...productionChartData.map((x) => x.count), 0);
    return max === 0 ? 1 : max;
  }, [productionChartData]);

  useEffect(() => {
    async function loadProductionChart() {
      setLoading(true);
      setError("");

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const { data, error } = await supabase
        .from("tyres")
        .select("id, produced_at")
        .not("produced_at", "is", null)
        .gte("produced_at", monthStart.toISOString())
        .lte("produced_at", monthEnd.toISOString());

      if (error) {
        console.error("Production chart error:", error.message);
        setError(error.message);
        setLoading(false);
        return;
      }

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayMap = new Map<number, number>();

      for (let day = 1; day <= daysInMonth; day++) {
        dayMap.set(day, 0);
      }

      ((data || []) as Array<{ produced_at: string | null }>).forEach((row) => {
        if (!row.produced_at) return;
        const day = new Date(row.produced_at).getDate();
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });

      const chartRows = Array.from(dayMap.entries()).map(([day, count]) => ({
        date: String(day).padStart(2, "0"),
        count,
      }));

      setProductionChartData(chartRows);
      setLoading(false);
    }

    loadProductionChart();
  }, []);

  if (loading) {
    return <main className="p-6">Dashboard yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Ana Panel</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bu ay gün gün üretilen lastik adetleri.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Bu Ay Günlük Üretim Adedi
          </h2>
          <p className="text-sm text-slate-600">
            Mevcut ay içinde gün gün üretilen lastik sayısı
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-4 flex items-end justify-between">
            <div className="text-sm text-slate-500">
              Veri olan gün sayısı:{" "}
              <strong>{productionChartData.filter((x) => x.count > 0).length}</strong>
            </div>
            <div className="text-sm text-slate-500">
              Aylık en yüksek üretim: <strong>{maxChartValue}</strong>
            </div>
          </div>

          <div className="flex h-[320px] items-end gap-2 overflow-x-auto">
            {productionChartData.map((item) => {
              const barHeight = `${(item.count / maxChartValue) * 100}%`;

              return (
                <div
                  key={item.date}
                  className="flex min-w-[28px] flex-1 flex-col items-center justify-end gap-2"
                  title={`${item.date}: ${item.count}`}
                >
                  <div className="text-[11px] text-slate-500">{item.count}</div>

                  <div className="flex h-[240px] w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-slate-800 transition-all"
                      style={{ height: item.count === 0 ? "4px" : barHeight }}
                    />
                  </div>

                  <div className="text-[11px] text-slate-500">{item.date}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}