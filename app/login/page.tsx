"use client";

import { useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { AUTH_MODE } from "@/src/lib/auth/auth-config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (AUTH_MODE !== "supabase_auth") {
      setMessage("Login ekranı sadece supabase_auth modunda kullanılır.");
      return;
    }

    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Giriş Yap</h1>
        <p className="mt-1 text-sm text-slate-600">
          Yetkili kullanıcı hesabınla giriş yap.
        </p>

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Şifre</label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {message ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}