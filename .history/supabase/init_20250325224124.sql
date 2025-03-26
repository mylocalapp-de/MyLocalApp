-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set up storage for profile images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile_images', 'profile_images', true);

-- Create public schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Set up user profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user preferences table
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a view that joins user profiles with their preferences
CREATE VIEW public.user_profiles_with_preferences AS
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
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create policies for user_preferences
-- Users can only view, create, update and delete their own preferences
CREATE POLICY "Users can view own preferences" 
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences" 
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
  ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" 
  ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Function to create a profile after sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Log trigger execution for debugging
  RAISE LOG 'Creating profile for new user: %', new.id;
  
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email);
  
  -- Copy preferences from user_metadata if available
  IF new.raw_user_meta_data->>'preferences' IS NOT NULL THEN
    RAISE LOG 'Migrating preferences for user: %', new.id;
    
    INSERT INTO public.user_preferences (user_id, preference_key)
    SELECT 
      new.id as user_id,
      jsonb_array_elements_text(new.raw_user_meta_data->'preferences') as preference_key;
  ELSE
    RAISE LOG 'No preferences found in metadata for user: %', new.id;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up a trigger to create a profile after user sign up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check if triggers exist (for debugging)
CREATE OR REPLACE FUNCTION public.check_triggers_exist()
RETURNS JSONB AS $$
DECLARE
  triggers JSONB;
BEGIN
  -- Check if our trigger exists
  SELECT jsonb_build_object(
    'trigger_exists', EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'on_auth_user_created'
    ),
    'function_exists', EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'handle_new_user'
    ),
    'profiles_table_exists', EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'profiles'
    ),
    'user_preferences_table_exists', EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'user_preferences'
    )
  ) INTO triggers;
  
  RETURN triggers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage to public and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to tables for authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_profiles_with_preferences TO authenticated;

-- Grant execute permission on the check_triggers_exist function
GRANT EXECUTE ON FUNCTION public.check_triggers_exist() TO anon, authenticated; 