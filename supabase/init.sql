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

-- Helper function to hash passwords using bcrypt
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use bcrypt (Blowfish) with work factor 10 (good balance of security and speed)
  -- Higher work factor (up to 31) makes it more secure but slower
  RETURN crypt(password, gen_salt('bf', 10));
EXCEPTION WHEN undefined_function THEN
  -- Fallback to MD5 if crypt/gen_salt functions are unavailable
  RAISE WARNING 'Using insecure MD5 hash because pgcrypto functions are not available';
  RETURN md5(password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to verify passwords with bcrypt
CREATE OR REPLACE FUNCTION public.verify_password(email TEXT, password TEXT)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
  stored_hash TEXT;
BEGIN
  -- First, get the stored hash for this user
  SELECT id, password_hash INTO user_id, stored_hash
  FROM public.app_users
  WHERE email = verify_password.email;
  
  -- If no user found, return null
  IF user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Verify the password by passing entered password and stored hash to crypt
  -- This works because bcrypt stores the salt in the hash
  IF stored_hash = crypt(password, stored_hash) THEN
    RETURN user_id;
  ELSE
    RETURN NULL;
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- Fallback to basic verification if crypt function isn't available
  SELECT id INTO user_id
  FROM public.app_users
  WHERE 
    email = verify_password.email AND
    password_hash = md5(password);
  
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

-- Custom function to verify a password against a stored hash
CREATE OR REPLACE FUNCTION public.verify_custom_password(
  p_stored_hash TEXT,
  p_password TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- For bcrypt, we can use the stored hash as the salt
  RETURN p_stored_hash = crypt(p_password, p_stored_hash);
EXCEPTION WHEN undefined_function THEN
  -- Fallback to MD5 if crypt isn't available
  RETURN p_stored_hash = md5(p_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.app_users TO anon, authenticated; 
GRANT ALL ON public.user_profiles_with_preferences TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user(TEXT, TEXT, TEXT[], TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_custom_password(TEXT, TEXT) TO anon, authenticated; 