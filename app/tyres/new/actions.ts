"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";

export async function createTyre(formData: FormData) {
  const customer_id = Number(formData.get("customer_id"));
  const retread_brand_id = formData.get("retread_brand_id")
    ? Number(formData.get("retread_brand_id"))
    : null;
  const tread_pattern_id = formData.get("tread_pattern_id")
    ? Number(formData.get("tread_pattern_id"))
    : null;

  const serial_no = String(formData.get("serial_no") || "");
  const tyre_type = String(formData.get("tyre_type") || "");
  const size = String(formData.get("size") || "");
  const original_brand = String(formData.get("original_brand") || "");
  const original_pattern = String(formData.get("original_pattern") || "");
  const sale_price = Number(formData.get("sale_price") || 0);
  const received_by = String(formData.get("received_by") || "");
  const description = String(formData.get("description") || "");

  const { error } = await supabase.from("tyres").insert({
    customer_id,
    serial_no,
    tyre_type,
    size,
    original_brand,
    original_pattern,
    retread_brand_id,
    tread_pattern_id,
    sale_price,
    received_by,
    description,
    status: "collected",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/tyres/new");
  redirect("/");
}