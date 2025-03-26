-- Migration 001: Initial setup for MyLocalApp
-- This migration creates the basic schema for user management with preferences

-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set up storage for profile images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile_images', 'profile_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create user profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a view that joins user profiles with their preferences
CREATE OR REPLACE VIEW public.user_profiles_with_preferences AS
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.updated_at,
    p.created_at,
    array_agg(up.preference_key) as preferences
  FROM public.profiles p
  LEFT JOIN public.user_preferences up ON p.id = up.user_id
  GROUP BY p.id, p.username, p.avatar_url, p.updated_at, p.created_at;

-- Set up Row Level Security (RLS)
-- Enable RLS on the tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
-- Users can only view and update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create policies for user_preferences
-- Users can only view, create, update and delete their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences" 
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own preferences" ON public.user_preferences;
CREATE POLICY "Users can create own preferences" 
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" 
  ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete own preferences" 
  ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Function to create a profile after sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email);
  
  -- Copy preferences from user_metadata if available
  IF new.raw_user_meta_data->>'preferences' IS NOT NULL THEN
    INSERT INTO public.user_preferences (user_id, preference_key)
    SELECT 
      new.id as user_id,
      jsonb_array_elements_text(new.raw_user_meta_data->'preferences') as preference_key;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up a trigger to create a profile after user sign up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant access to tables for authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_profiles_with_preferences TO authenticated; 