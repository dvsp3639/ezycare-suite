
-- Add report file columns to lab_orders
ALTER TABLE public.lab_orders 
  ADD COLUMN IF NOT EXISTS report_file_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS report_file_name text DEFAULT '';

-- Create storage bucket for lab reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-reports', 'lab-reports', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for lab-reports bucket
CREATE POLICY "Authenticated users can upload lab reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lab-reports');

CREATE POLICY "Authenticated users can view lab reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lab-reports');

CREATE POLICY "Authenticated users can delete lab reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lab-reports');
