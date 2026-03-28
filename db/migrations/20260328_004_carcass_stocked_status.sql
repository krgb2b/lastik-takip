-- Migration: Add carcass_stocked tyre status
-- Date: 2026-03-28
--
-- This migration documents the new `carcass_stocked` status for tyres
-- with collection_type = 'Karkas Satın Alma'.
--
-- Flow change:
--   Karkas Satın Alma:  collected → factory_received → carcass_stocked
--   Kaplama / Tamir:    collected → factory_received → approved_for_production → in_production → stocked
--
-- The `status` column on the `tyres` table is a TEXT field, but it may still be
-- protected by a CHECK constraint (`tyres_status_check`).
-- This migration only documents the status and updates the column comment.
-- Constraint updates must be done in a dedicated migration.

COMMENT ON COLUMN public.tyres.status IS
  'Possible values: collected, factory_received, approved_for_production, in_production,
   stocked, carcass_stocked, allocated_to_shipment, ready_for_loading, loaded, shipped, rejected';
