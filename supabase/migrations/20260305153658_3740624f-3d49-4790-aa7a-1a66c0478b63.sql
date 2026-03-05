
-- Add new roles to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab_technician';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pharmacist';
