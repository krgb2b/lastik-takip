import { supabase } from "../../../src/lib/supabase";
import NewTyreForm from "./NewTyreForm";
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
    .select("id, brand_id, name")
    .order("name");

  return (
    <NewTyreForm
      customers={customers || []}
      retreadBrands={retreadBrands || []}
      treadPatterns={treadPatterns || []}
      createTyreAction={createTyre}
    />
  );
}