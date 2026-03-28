import { z } from "zod";

// App User Schema
export const AppUserSchema = z.object({
  id: z.number().int().positive(),
  auth_user_id: z.string().nullable(),
  full_name: z.string().min(1),
  email: z.string().email().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type AppUser = z.infer<typeof AppUserSchema>;

// User Permission Row Schema
export const UserPermissionRowSchema = z.object({
  user_id: z.number().int().positive(),
  auth_user_id: z.string().nullable(),
  full_name: z.string(),
  email: z.string().nullable(),
  role_id: z.number().int().positive(),
  role_code: z.string(),
  permission_id: z.number().int().positive(),
  permission_code: z.string(),
  permission_name: z.string().nullable(),
  module: z.string(),
});

export const UserPermissionRowsSchema = z.array(UserPermissionRowSchema);

export type UserPermissionRowType = z.infer<typeof UserPermissionRowSchema>;
export type UserPermissionRows = z.infer<typeof UserPermissionRowsSchema>;

// Database Response Schema
export const SupabaseResponseSchema = z.object({
  data: z.unknown().nullable(),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
    })
    .nullable(),
  status: z.number().int().optional(),
  statusText: z.string().optional(),
});

export type SupabaseResponse = z.infer<typeof SupabaseResponseSchema>;

// Collection Receipt Schema
export const CollectionReceiptSchema = z.object({
  id: z.number().int().positive(),
  receipt_no: z.string().min(1),
  customer_id: z.number().int().positive(),
  delivered_by: z.string().nullable(),
  payment_type: z.string().nullable(),
  payment_due_date: z.string().datetime().nullable(),
  total_sale_price: z.number().nonnegative().nullable(),
  description: z.string().nullable(),
  doorstep_delivery: z.boolean().nullable(),
  collection_date: z.string().datetime().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const CollectionReceiptsSchema = z.array(CollectionReceiptSchema);

export type CollectionReceipt = z.infer<typeof CollectionReceiptSchema>;

// Customer Schema
const CustomerRelationSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
  })
  .partial()
  .nullable();

export const CustomerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  region: z.string().nullable(),
  salesperson: z.string().nullable(),
  region_id: z.number().int().positive().nullable().optional(),
  salesperson_id: z.number().int().positive().nullable().optional(),
  regionId: z.number().int().positive().nullable().optional(),
  salespersonId: z.number().int().positive().nullable().optional(),
  region_rel: z.union([CustomerRelationSchema, z.array(CustomerRelationSchema)]).optional(),
  salesperson_rel: z
    .union([CustomerRelationSchema, z.array(CustomerRelationSchema)])
    .optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  created_at: z.string().datetime().optional(),
});

export const CustomersSchema = z.array(CustomerSchema);

export type Customer = z.infer<typeof CustomerSchema>;

// Tyre Schema
export const TyreSchema = z.object({
  id: z.number().int().positive(),
  collection_receipt_id: z.number().int().positive().nullable(),
  tyre_code: z.string().nullable(),
  serial_no: z.string().min(1),
  collection_type: z.string().nullable(),
  tyre_type: z.string().nullable(),
  size: z.string().nullable(),
  sale_price: z.number().nonnegative().nullable(),
  original_brand: z.string().nullable(),
  original_pattern: z.string().nullable(),
  status: z.enum([
    "collected",
    "factory_received",
    "approved_for_production",
    "in_production",
    "stocked",
    "shipped",
    "rejected",
    "allocated_to_shipment",
  ]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const TyresSchema = z.array(TyreSchema);

export type Tyre = z.infer<typeof TyreSchema>;
