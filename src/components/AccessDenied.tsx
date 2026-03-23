"use client";

export default function AccessDenied({
  title = "Bu alana erişim yetkiniz yok",
  description = "Bu sayfayı görüntüleme izniniz bulunmuyor.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <div className="mb-3 inline-flex rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
          Erişim Engellendi
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/"
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Ana Panele Dön
          </a>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Geri Git
          </button>
        </div>
      </div>
    </main>
  );
}