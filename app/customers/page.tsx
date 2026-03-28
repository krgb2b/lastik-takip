import { redirect } from "next/navigation";

export default function CustomersLegacyRedirectPage() {
  redirect("/admin/customers");
}