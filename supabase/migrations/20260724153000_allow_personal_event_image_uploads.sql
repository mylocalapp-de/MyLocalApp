-- Allow every authenticated user to manage their own event images.
--
-- The previous policies granted access only to users who belonged to any
-- organization. Event creation already supports personal events, so image
-- storage must follow the authenticated uploader instead of organization
-- membership.

BEGIN;

DROP POLICY IF EXISTS "all organz user can upload cojoot_0" ON storage.objects;
DROP POLICY IF EXISTS "all organz user can upload cojoot_1" ON storage.objects;
DROP POLICY IF EXISTS "all organz user can upload cojoot_2" ON storage.objects;
DROP POLICY IF EXISTS "all organz user can upload cojoot_3" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;

CREATE POLICY "Anyone can view event images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'event_images');

CREATE POLICY "Authenticated users can upload event images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event_images'
  AND (storage.foldername(name))[1] IS NULL
  AND owner_id = (SELECT auth.uid()::text)
);

CREATE POLICY "Users can update own event images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event_images'
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'event_images'
  AND (storage.foldername(name))[1] IS NULL
  AND owner_id = (SELECT auth.uid()::text)
);

CREATE POLICY "Users can delete own event images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event_images'
  AND owner_id = (SELECT auth.uid()::text)
);

COMMIT;
