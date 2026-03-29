-- Add username_lower column for case-insensitive uniqueness
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_lower TEXT;

-- Populate for existing rows (all existing usernames are already lowercase)
UPDATE profiles SET username_lower = LOWER(username) WHERE username IS NOT NULL AND username_lower IS NULL;

-- Drop old unique index on username (case-sensitive)
DROP INDEX IF EXISTS idx_profiles_username;

-- Create unique index on username_lower
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles (username_lower) WHERE username_lower IS NOT NULL;

-- Keep a non-unique index on username for display lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username_display ON profiles (username) WHERE username IS NOT NULL;
