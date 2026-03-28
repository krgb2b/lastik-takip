-- Migration: Extend tyres_status_check with carcass_stocked
-- Date: 2026-03-28

ALTER TABLE public.tyres
  DROP CONSTRAINT IF EXISTS tyres_status_check;

ALTER TABLE public.tyres
  ADD CONSTRAINT tyres_status_check CHECK (
    status = ANY (
      ARRAY[
        'draft',
        'collected',
        'factory_received',
        'approved_for_production',
        'in_production',
        'stocked',
        'carcass_stocked',
        'allocated_to_shipment',
        'ready_for_loading',
        'loaded',
        'shipped',
        'rejected'
      ]::text[]
    )
  );
