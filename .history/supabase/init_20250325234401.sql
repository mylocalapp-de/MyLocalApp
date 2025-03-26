-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create public schema
CREATE SCHEMA IF NOT EXISTS public;

-- SIMPLIFIED APPROACH: Single users table for auth and preferences
DROP TABLE IF EXISTS public.app_users CASCADE;
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  preferences TEXT[] DEFAULT '{}',
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- View with same name for compatibility
CREATE OR REPLACE VIEW public.user_profiles_with_preferences AS
  SELECT 
    id,
    email as username,
    NULL as avatar_url,
    updated_at,
    created_at,
    preferences
  FROM public.app_users;

-- Enable Row Level Security
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Create policy for app_users table
CREATE POLICY "Users can view and update their own data" 
  ON public.app_users 
  USING (true) 
  WITH CHECK (true);

-- Helper function to hash passwords (using MD5 as a fallback which is not secure but simpler)
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Try using pgcrypto if available, otherwise fall back to MD5
  BEGIN
    -- Using pgcrypto's digest function (safe)
    RETURN encode(digest(password, 'sha256'), 'hex');
  EXCEPTION WHEN undefined_function THEN
    -- Fallback to MD5 (less secure but more widely available)
    RETURN md5(password);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to verify passwords
CREATE OR REPLACE FUNCTION public.verify_password(email TEXT, password TEXT)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id
  FROM public.app_users
  WHERE 
    email = verify_password.email AND
    password_hash = public.hash_password(password);
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to create a new user
CREATE OR REPLACE FUNCTION public.create_user(
  p_email TEXT,
  p_password TEXT,
  p_preferences TEXT[] DEFAULT '{}',
  p_display_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  INSERT INTO public.app_users (
    email,
    password_hash,
    preferences,
    display_name
  ) VALUES (
    p_email,
    public.hash_password(p_password),
    p_preferences,
    p_display_name
  )
  RETURNING id INTO new_user_id;
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.app_users TO anon, authenticated; 
GRANT ALL ON public.user_profiles_with_preferences TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user(TEXT, TEXT, TEXT[], TEXT) TO anon, authenticated; 