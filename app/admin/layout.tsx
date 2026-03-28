import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <AdminSidebar />
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
