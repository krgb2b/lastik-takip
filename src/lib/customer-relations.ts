export const CUSTOMER_WITH_RELATIONS_SELECT = `
  id,
  name,
  created_at,
  region_id,
  salesperson_id,
  region_rel:regions!customers_region_id_fkey(id, name),
  salesperson_rel:salespeople!customers_salesperson_id_fkey(id, name)
`;

type RelationRow = {
  id?: number | null;
  name?: string | null;
};

type RelationValue = RelationRow | RelationRow[] | null | undefined;

export type CustomerWithRelationsRow = {
  id: number;
  name: string;
  region_id: number | null;
  salesperson_id: number | null;
  region_rel?: RelationValue;
  salesperson_rel?: RelationValue;
  created_at?: string | null;
};

export type NormalizedCustomer = {
  id: number;
  name: string;
  region: string | null;
  salesperson: string | null;
  regionId: number | null;
  salespersonId: number | null;
  created_at?: string | null;
};

function pickRelation(value: RelationValue): RelationRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

export function normalizeCustomerRow(
  row: CustomerWithRelationsRow
): NormalizedCustomer {
  const regionRelation = pickRelation(row.region_rel);
  const salespersonRelation = pickRelation(row.salesperson_rel);

  return {
    id: row.id,
    name: row.name,
    region: regionRelation?.name || null,
    salesperson: salespersonRelation?.name || null,
    regionId: regionRelation?.id || row.region_id || null,
    salespersonId: salespersonRelation?.id || row.salesperson_id || null,
    created_at: row.created_at,
  };
}

export function normalizeCustomerRows(
  rows: CustomerWithRelationsRow[]
): NormalizedCustomer[] {
  return rows.map(normalizeCustomerRow);
}
