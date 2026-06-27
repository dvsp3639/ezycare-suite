
CREATE POLICY "Staff can upload invoice files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'purchase-invoices' AND auth.uid() = owner);

CREATE POLICY "Staff can read their invoice files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'purchase-invoices' AND auth.uid() = owner);

CREATE POLICY "Staff can delete their invoice files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'purchase-invoices' AND auth.uid() = owner);
