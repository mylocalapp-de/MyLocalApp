-- Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Make sure we can access the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to the profiles table
GRANT ALL ON public.profiles TO anon, authenticated, service_role;

-- Enable Row Level Security on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure we're starting fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create policies for the profiles table
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Create a function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, preferences)
  VALUES (new.id, '{}')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to bypass RLS for profile creation
CREATE OR REPLACE FUNCTION public.create_profile_bypass_rls(user_id UUID, user_preferences TEXT[] DEFAULT '{}')
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, preferences, created_at, updated_at)
  VALUES (user_id, user_preferences, NOW(), NOW())
  ON CONFLICT (id) DO 
    UPDATE SET preferences = user_preferences, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to directly create_profile_for_user (used in AuthContext.js)
CREATE OR REPLACE FUNCTION create_profile_for_user(user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, preferences, created_at, updated_at)
  VALUES (user_id, '{}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 