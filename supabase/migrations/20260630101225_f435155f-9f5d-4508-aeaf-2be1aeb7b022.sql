
CREATE POLICY "ai_core_uploads_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-core-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ai_core_uploads_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-core-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ai_core_uploads_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ai-core-uploads' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'ai-core-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ai_core_uploads_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-core-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
