-- Add stable auth_email column (set at registration, never changed)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_email text;

-- Populate for existing username-accounts from current username_lower
-- (Safe: assumes no username changes before this fix, except testnutzer→testnutzer2)
UPDATE profiles
SET auth_email = username_lower || '@users.mylocalapp.de'
WHERE username IS NOT NULL AND username != '' AND auth_email IS NULL;
