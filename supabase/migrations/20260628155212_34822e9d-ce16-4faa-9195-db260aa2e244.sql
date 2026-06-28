
-- 1) Revoke anon EXECUTE on SECURITY DEFINER functions in public schema
REVOKE EXECUTE ON FUNCTION public.import_purchase_invoice(jsonb, jsonb, jsonb, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_purchase_invoice(jsonb, jsonb, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_rx_correction(text, text, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_medicine_pick(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_purchase_invoice(jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_purchase_invoice(jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_rx_correction(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_medicine_pick(uuid, text) TO authenticated;

-- 2) Tighten prescriptions bucket SELECT policy to owner folder only
DROP POLICY IF EXISTS "Auth users read prescription files" ON storage.objects;
CREATE POLICY "Auth users read own prescription files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 3) Add UPDATE policy for purchase-invoices bucket
CREATE POLICY "Staff can update their invoice files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'purchase-invoices' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'purchase-invoices' AND auth.uid() = owner);
