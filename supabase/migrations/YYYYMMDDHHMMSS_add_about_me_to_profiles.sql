-- Add the new column to the profiles table
ALTER TABLE public.profiles ADD COLUMN about_me TEXT NULL;

-- Add a comment describing the new column
COMMENT ON COLUMN public.profiles.about_me IS 'A short description about the user.'; 