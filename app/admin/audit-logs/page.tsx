"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import PermissionGuard from "@/src/components/PermissionGuard";

type AuditLogRow = {
  id: number;
  app_user_id: number | null;
  user_id: number | null;
  action_code: string;
  entity_type: string;
  entity_id: number | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  payload_json: Record<string, unknown> | null;
  created_at: string;
};

type AppUserRow = {
  id: number;
  full_name: string;
  email: string | null;
};

export default function AuditLogsPage() {
  return (
    <PermissionGuard
      permission="roles.manage"
      title="Audit Log sayfasına erişim yetkiniz yok"
      description="Bu ekranı görüntüleme izniniz bulunmuyor."
    >
      <AuditLogsPageContent />
    </PermissionGuard>
  );
}

function AuditLogsPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [users, setUsers] = useState<AppUserRow[]>([]);

  const [searchText, setSearchText] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const [logsRes, usersRes] = await Promise.all([
        supabase
          .from("audit_logs")
          .select(`
            id,
            app_user_id,
            user_id,
            action_code,
            entity_type,
            entity_id,
            old_data,
            new_data,
            payload_json,
            created_at
          `)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("app_users").select("id, full_name, email"),
      ]);

      if (logsRes.error) {
        setError(logsRes.error.message);
        setLoading(false);
        return;
      }

      if (usersRes.error) {
        setError(usersRes.error.message);
        setLoading(false);
        return;
      }

      setLogs((logsRes.data || []) as AuditLogRow[]);
      setUsers((usersRes.data || []) as AppUserRow[]);
      setLoading(false);
    }

    loadData();
  }, []);

  const userMap = useMemo(() => {
    const map = new Map<number, AppUserRow>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action_code))).sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, [logs]);

  const tableOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.entity_type))).sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase("tr-TR");

    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action_code !== actionFilter) return false;
      if (tableFilter !== "all" && log.entity_type !== tableFilter) return false;

      if (!q) return true;

      const actorId = log.app_user_id ?? log.user_id;
      const user = actorId ? userMap.get(actorId) : null;

      const haystack = [
        log.action_code,
        log.entity_type,
        String(log.entity_id ?? ""),
        user?.full_name || "",
        user?.email || "",
        JSON.stringify(log.payload_json || {}),
        JSON.stringify(log.old_data || {}),
        JSON.stringify(log.new_data || {}),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [logs, searchText, actionFilter, tableFilter, userMap]);

  if (loading) {
    return <main className="p-6">Yükleniyor...</main>;
  }

  if (error) {
    return <main className="p-6">Hata: {error}</main>;
  }

  return (
    <main className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-slate-600">
          Sistem üzerinde yapılan kritik işlemlerin kayıtları.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Kayıt" value={String(logs.length)} />
        <SummaryCard label="Filtreli Kayıt" value={String(filteredLogs.length)} />
        <SummaryCard
          label="İşlem Türü"
          value={actionFilter === "all" ? "Tümü" : actionFilter}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Kullanıcı, işlem, tablo veya payload ara..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">Tüm İşlemler</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          >
            <option value="all">Tüm Tablolar</option>
            {tableOptions.map((tableName) => (
              <option key={tableName} value={tableName}>
                {tableName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1500px] border-collapse">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3 text-sm">Tarih</th>
              <th className="p-3 text-sm">Kullanıcı</th>
              <th className="p-3 text-sm">İşlem</th>
              <th className="p-3 text-sm">Tablo</th>
              <th className="p-3 text-sm">Kayıt ID</th>
              <th className="p-3 text-sm">Payload</th>
              <th className="p-3 text-sm">Old Data</th>
              <th className="p-3 text-sm">New Data</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const actorId = log.app_user_id ?? log.user_id;
                const user = actorId ? userMap.get(actorId) : null;

                return (
                  <tr key={log.id} className="border-t border-slate-100 align-top">
                    <td className="p-3 text-sm whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="p-3 text-sm">
                      {user ? (
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-xs text-slate-500">
                            {user.email || "-"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {log.action_code}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{log.entity_type}</td>
                    <td className="p-3 text-sm">{log.entity_id ?? "-"}</td>
                    <td className="p-3 text-xs text-slate-600">
                      <pre className="max-w-[380px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
                        {JSON.stringify(log.payload_json || {}, null, 2)}
                      </pre>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      <pre className="max-w-[380px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
                        {JSON.stringify(log.old_data || {}, null, 2)}
                      </pre>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      <pre className="max-w-[380px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
                        {JSON.stringify(log.new_data || {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}