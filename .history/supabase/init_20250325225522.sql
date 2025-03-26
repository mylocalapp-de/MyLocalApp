-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set up storage for profile images (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
SELECT 'profile_images', 'profile_images', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'profile_images'
);

-- Create public schemas
CREATE SCHEMA IF NOT EXISTS public;

-- Set up user profiles table (extends auth.users)
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user preferences table
DROP TABLE IF EXISTS public.user_preferences CASCADE;
CREATE TABLE public.user_preferences (
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
DECLARE
  preferences_json JSONB;
  meta_keys TEXT;
BEGIN
  -- Debug logs with full details
  RAISE LOG 'TRIGGER FIRING - NEW USER DETECTED: %', new.id;
  RAISE LOG 'USER EMAIL: %', COALESCE(new.email, 'NULL');
  
  -- Log all available metadata for debugging
  RAISE LOG 'RAW USER METADATA: %', COALESCE(new.raw_user_meta_data::text, 'NULL');
  RAISE LOG 'USER METADATA: %', COALESCE(new.user_metadata::text, 'NULL');
  
  -- List all keys in the metadata for debugging
  IF new.raw_user_meta_data IS NOT NULL THEN
    SELECT string_agg(key, ', ') INTO meta_keys FROM jsonb_object_keys(new.raw_user_meta_data) AS t(key);
    RAISE LOG 'AVAILABLE METADATA KEYS: %', COALESCE(meta_keys, 'NONE');
  END IF;
  
  -- Create profile entry regardless of metadata
  BEGIN
    -- First check if the profile already exists to avoid duplicate key errors
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
      INSERT INTO public.profiles (id, username)
      VALUES (new.id, COALESCE(new.email, 'unknown@example.com'));
      RAISE LOG 'SUCCESS: Created profile for user: %', new.id;
    ELSE
      RAISE LOG 'NOTICE: Profile already exists for user: %', new.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'ERROR CREATING PROFILE: % - %', SQLERRM, SQLSTATE;
    -- Continue execution even if profile creation fails
  END;
  
  -- Try to get preferences from all possible locations in metadata
  BEGIN
    preferences_json := NULL;
    
    -- Try all possible paths where preferences might be stored
    IF new.raw_user_meta_data IS NOT NULL THEN
      -- Try direct preferences path
      IF new.raw_user_meta_data->>'preferences' IS NOT NULL THEN
        preferences_json := new.raw_user_meta_data->'preferences';
        RAISE LOG 'FOUND PREFERENCES in raw_user_meta_data->preferences: %', preferences_json;
      
      -- Try data.preferences path
      ELSIF new.raw_user_meta_data->'data'->>'preferences' IS NOT NULL THEN
        preferences_json := new.raw_user_meta_data->'data'->'preferences';
        RAISE LOG 'FOUND PREFERENCES in raw_user_meta_data->data->preferences: %', preferences_json;
      
      -- Try raw_preferences path (our custom path)
      ELSIF new.raw_user_meta_data->>'raw_preferences' IS NOT NULL THEN
        preferences_json := new.raw_user_meta_data->'raw_preferences';
        RAISE LOG 'FOUND PREFERENCES in raw_user_meta_data->raw_preferences: %', preferences_json;
      END IF;
    END IF;
    
    -- Also check user_metadata as a fallback
    IF preferences_json IS NULL AND new.user_metadata IS NOT NULL THEN
      IF new.user_metadata->>'preferences' IS NOT NULL THEN
        preferences_json := new.user_metadata->'preferences';
        RAISE LOG 'FOUND PREFERENCES in user_metadata->preferences: %', preferences_json;
      ELSIF new.user_metadata->'data'->>'preferences' IS NOT NULL THEN
        preferences_json := new.user_metadata->'data'->'preferences';
        RAISE LOG 'FOUND PREFERENCES in user_metadata->data->preferences: %', preferences_json;
      ELSIF new.user_metadata->>'raw_preferences' IS NOT NULL THEN
        preferences_json := new.user_metadata->'raw_preferences';
        RAISE LOG 'FOUND PREFERENCES in user_metadata->raw_preferences: %', preferences_json;
      END IF;
    END IF;

    -- If we found preferences in any location, attempt to insert them
    IF preferences_json IS NOT NULL THEN
      RAISE LOG 'ATTEMPTING TO INSERT PREFERENCES for user: % - %', new.id, preferences_json;
      
      -- Different handling based on whether preferences is an array or object
      IF jsonb_typeof(preferences_json) = 'array' THEN
        -- For array format like ["sport", "verkehr"]
        INSERT INTO public.user_preferences (user_id, preference_key)
        SELECT 
          new.id as user_id,
          pref as preference_key
        FROM jsonb_array_elements_text(preferences_json) as pref;
        
        RAISE LOG 'SUCCESS: Inserted array preferences for user: %', new.id;
      ELSIF jsonb_typeof(preferences_json) = 'object' THEN
        -- For object format like {"sport": true, "kultur": true}
        INSERT INTO public.user_preferences (user_id, preference_key)
        SELECT 
          new.id as user_id,
          key as preference_key
        FROM jsonb_each_text(preferences_json) as t(key, value)
        WHERE value::text = 'true';
        
        RAISE LOG 'SUCCESS: Inserted object preferences for user: %', new.id;
      ELSE
        RAISE LOG 'ERROR: Unrecognized preferences format: %', jsonb_typeof(preferences_json);
      END IF;
    ELSE
      RAISE LOG 'NOTICE: No preferences data found for user: %', new.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'ERROR PROCESSING PREFERENCES: % - %', SQLERRM, SQLSTATE;
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up a trigger to create a profile after user sign up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to manually create a profile for an existing user
CREATE OR REPLACE FUNCTION public.create_profile_for_user(user_id UUID)
RETURNS VOID AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Get the user information
  SELECT * INTO user_record FROM auth.users WHERE id = user_id;
  
  IF user_record.id IS NULL THEN
    RAISE EXCEPTION 'User not found with ID: %', user_id;
  END IF;
  
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    RAISE NOTICE 'Profile already exists for user %', user_id;
  ELSE
    -- Create the profile
    INSERT INTO public.profiles (id, username)
    VALUES (user_id, user_record.email);
    RAISE NOTICE 'Profile created for user %', user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    ),
    'auth_trigger_count', (
      SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'auth.users'::regclass::oid
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

-- Grant execute permission on the functions
GRANT EXECUTE ON FUNCTION public.check_triggers_exist() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user(UUID) TO authenticated;

-- Note: We've removed the sample seed data since the dummy user ID doesn't exist in auth.users
-- If you need test data, create an actual user through the auth system first, then add a profile 