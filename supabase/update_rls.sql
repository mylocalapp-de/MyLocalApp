-- supabase/update_rls.sql
-- Refactoring Script for Supabase Auth and RLS Implementation

-- IMPORTANT: This script DROPS the existing public.app_users table and related functions.
-- Backup your data before running this script. Data migration is NOT handled here.

BEGIN;

-- 1. Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Keep if used elsewhere, though not for passwords now

-- 2. Drop old custom auth tables and functions
DROP TABLE IF EXISTS public.app_users CASCADE;
DROP VIEW IF EXISTS public.user_profiles_with_preferences;
DROP FUNCTION IF EXISTS public.hash_password(TEXT);
DROP FUNCTION IF EXISTS public.verify_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user(TEXT, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.verify_custom_password(TEXT, TEXT);
-- Drop other potentially related custom functions if they exist

-- 3. Create the 'profiles' table linked to auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferences TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comment for clarity
COMMENT ON TABLE public.profiles IS 'Stores public profile information for authenticated users.';

-- 4. Set up RLS for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true); -- Or restrict as needed, e.g., (auth.role() = 'authenticated')

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy needed usually, deletion cascades from auth.users

-- 5. Create a trigger function to automatically create a profile on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_display_name TEXT;
  meta_preferences TEXT[];
BEGIN
  -- Safely extract display_name, checking if it exists and is text
  meta_display_name := NEW.raw_user_meta_data ->> 'display_name';

  -- Safely extract preferences, checking if it exists and is an array
  BEGIN
    IF jsonb_typeof(NEW.raw_user_meta_data -> 'preferences') = 'array' THEN
       SELECT array_agg(elem::TEXT) INTO meta_preferences
       FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'preferences') AS elem;
    ELSE
       meta_preferences := '{}'; -- Default to empty array if not a valid JSON array
    END IF;
  EXCEPTION
     WHEN others THEN
       meta_preferences := '{}'; -- Default on any error during extraction/casting
  END;

  INSERT INTO public.profiles (id, display_name, preferences)
  VALUES (
    NEW.id,
    meta_display_name, -- Use extracted display_name (can be NULL)
    COALESCE(meta_preferences, '{}') -- Use extracted preferences, default to empty array if NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; -- Drop existing trigger if it exists
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Update ARTICLES schema and RLS

-- Recreate articles table linking author_id to auth.users(id)
DROP TABLE IF EXISTS public.articles CASCADE;
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  author_id UUID REFERENCES public.profiles(id), -- Link to profiles table (which links to auth.users)
  is_published BOOLEAN DEFAULT true
);

-- Recreate article_comments table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.article_comments CASCADE;
CREATE TABLE public.article_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate article_reactions table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.article_reactions CASCADE;
CREATE TABLE public.article_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (article_id, user_id, emoji)
);

-- View for reactions count (group by emoji and article)
CREATE OR REPLACE VIEW public.article_reaction_counts AS
  SELECT
    article_id,
    emoji,
    count(*) as count
  FROM public.article_reactions
  GROUP BY article_id, emoji;

-- Re-enable RLS (if disabled previously) and define policies
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for articles
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.articles;
CREATE POLICY "Anyone can view published articles" ON public.articles
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Anyone can create articles" ON public.articles;
CREATE POLICY "Authenticated users can create articles" ON public.articles
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid()); -- Ensure author is the logged-in user

DROP POLICY IF EXISTS "Authors can update their own articles" ON public.articles;
CREATE POLICY "Authors can update their own articles" ON public.articles
  FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors can delete their own articles" ON public.articles;
CREATE POLICY "Authors can delete their own articles" ON public.articles
  FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Policies for article_comments
DROP POLICY IF EXISTS "Anyone can view comments" ON public.article_comments;
CREATE POLICY "Anyone can view comments" ON public.article_comments
  FOR SELECT USING (true); -- Assuming comments are public

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.article_comments;
CREATE POLICY "Authenticated users can create comments" ON public.article_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own comments" ON public.article_comments;
CREATE POLICY "Users can update their own comments" ON public.article_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.article_comments;
CREATE POLICY "Users can delete their own comments" ON public.article_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies for article_reactions
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.article_reactions;
CREATE POLICY "Anyone can view reactions" ON public.article_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reactions" ON public.article_reactions;
CREATE POLICY "Authenticated users can create reactions" ON public.article_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.article_reactions;
CREATE POLICY "Users can delete their own reactions" ON public.article_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Update VIEWS to join with profiles
DROP VIEW IF EXISTS public.article_comments_with_users;
CREATE OR REPLACE VIEW public.article_comments_with_users AS
  SELECT
    c.id,
    c.article_id,
    c.text,
    COALESCE(p.display_name, 'Anonymous') as user, -- Join with profiles
    format_time_german(c.created_at) as time,
    c.created_at,
    c.user_id
  FROM
    public.article_comments c
  LEFT JOIN
    public.profiles p ON c.user_id = p.id -- Join with profiles
  ORDER BY
    c.created_at;

-- Recreate article_listings view
DROP VIEW IF EXISTS public.article_listings;
CREATE OR REPLACE VIEW public.article_listings AS
  SELECT
    a.id,
    a.title,
    format_date_german(a.published_at) as date,
    -- Extract first 100 characters of content for preview
    LEFT(a.content, 100) || (CASE WHEN length(a.content) > 100 THEN '...' ELSE '' END) as content,
    a.type,
    a.published_at,
    p.display_name as author_name -- Get author name from profiles
  FROM
    public.articles a
  LEFT JOIN
    public.profiles p ON a.author_id = p.id -- Join with profiles
  WHERE
    a.is_published = true
  ORDER BY
    a.published_at DESC;

-- Remove old update/delete functions that bypassed RLS
DROP FUNCTION IF EXISTS public.update_article(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.delete_article(UUID, UUID);


-- 7. Update CHAT GROUPS schema and RLS

-- Recreate chat_groups table linking admin_id to profiles(id)
DROP TABLE IF EXISTS public.chat_groups CASCADE;
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'open_group', 'broadcast', 'bot'
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  admin_id UUID REFERENCES public.profiles(id), -- Link to profiles
  is_active BOOLEAN DEFAULT true,
  UNIQUE(name)
);

-- Recreate chat_messages table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate message_comments table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.message_comments CASCADE;
CREATE TABLE public.message_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate message_reactions table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.message_reactions CASCADE;
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- View for message reactions count (group by emoji and message)
CREATE OR REPLACE VIEW public.message_reaction_counts AS
  SELECT
    message_id,
    emoji,
    count(*) as count
  FROM public.message_reactions
  GROUP BY message_id, emoji;

-- Re-enable RLS and define policies
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for chat_groups
DROP POLICY IF EXISTS "Allow public read access for active groups" ON public.chat_groups;
CREATE POLICY "Allow public read access for active groups" ON public.chat_groups
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Allow authenticated users to create open groups" ON public.chat_groups;
CREATE POLICY "Allow authenticated users to create open groups" ON public.chat_groups
  FOR INSERT TO authenticated WITH CHECK (type = 'open_group'); -- Allow creating open groups

DROP POLICY IF EXISTS "Allow admins to create broadcast groups" ON public.chat_groups;
-- Creating broadcast groups needs careful consideration. Limit via app logic or specific role.
-- This policy allows any authenticated user to create one if they set themselves as admin.
CREATE POLICY "Allow admins to create broadcast groups" ON public.chat_groups
  FOR INSERT TO authenticated WITH CHECK (type = 'broadcast' AND admin_id = auth.uid());

DROP POLICY IF EXISTS "Allow admin to update their broadcast group" ON public.chat_groups;
CREATE POLICY "Allow admin to update their broadcast group" ON public.chat_groups
  FOR UPDATE TO authenticated USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

DROP POLICY IF EXISTS "Allow admin to delete their broadcast group" ON public.chat_groups;
CREATE POLICY "Allow admin to delete their broadcast group" ON public.chat_groups
  FOR DELETE TO authenticated USING (admin_id = auth.uid());

-- Policies for chat_messages
DROP POLICY IF EXISTS "Allow members to view messages in active groups" ON public.chat_messages;
-- This policy allows any authenticated user to see messages in any active group.
-- Adjust if group membership logic is introduced later.
CREATE POLICY "Allow members to view messages in active groups" ON public.chat_messages
  FOR SELECT TO authenticated USING (
    chat_group_id IN (SELECT id FROM public.chat_groups WHERE is_active = true)
  );

DROP POLICY IF EXISTS "Allow users to send messages in open groups" ON public.chat_messages;
CREATE POLICY "Allow users to send messages in open groups" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    chat_group_id IN (SELECT id FROM public.chat_groups WHERE type = 'open_group' AND is_active = true)
  );

DROP POLICY IF EXISTS "Allow admin to send messages in broadcast groups" ON public.chat_messages;
CREATE POLICY "Allow admin to send messages in broadcast groups" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    chat_group_id IN (SELECT id FROM public.chat_groups WHERE type = 'broadcast' AND admin_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Allow users to delete their own messages" ON public.chat_messages;
CREATE POLICY "Allow users to delete their own messages" ON public.chat_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies for message_comments (Only allow in broadcast groups)
DROP POLICY IF EXISTS "Allow users to view comments in active broadcast groups" ON public.message_comments;
CREATE POLICY "Allow users to view comments in active broadcast groups" ON public.message_comments
  FOR SELECT TO authenticated USING (
    message_id IN (
      SELECT m.id FROM public.chat_messages m JOIN public.chat_groups g ON m.chat_group_id = g.id
      WHERE g.type = 'broadcast' AND g.is_active = true
    )
  );

DROP POLICY IF EXISTS "Allow users to comment on broadcast messages" ON public.message_comments;
CREATE POLICY "Allow users to comment on broadcast messages" ON public.message_comments
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    message_id IN (
      SELECT m.id FROM public.chat_messages m JOIN public.chat_groups g ON m.chat_group_id = g.id
      WHERE g.type = 'broadcast' AND g.is_active = true
    )
  );

DROP POLICY IF EXISTS "Allow users to delete their own comments" ON public.message_comments;
CREATE POLICY "Allow users to delete their own comments" ON public.message_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies for message_reactions
DROP POLICY IF EXISTS "Allow users to view reactions" ON public.message_reactions;
CREATE POLICY "Allow users to view reactions" ON public.message_reactions
  FOR SELECT TO authenticated USING (true); -- Assuming reactions are public within the chat

DROP POLICY IF EXISTS "Allow users to add reactions" ON public.message_reactions;
CREATE POLICY "Allow users to add reactions" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to delete their own reactions" ON public.message_reactions;
CREATE POLICY "Allow users to delete their own reactions" ON public.message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Update VIEWS to join with profiles
DROP VIEW IF EXISTS public.chat_messages_with_users;
CREATE OR REPLACE VIEW public.chat_messages_with_users AS
  SELECT
    m.id,
    m.chat_group_id,
    m.text,
    COALESCE(p.display_name, 'Anonymous') as sender,
    format_time_german(m.created_at) as time,
    m.created_at,
    m.user_id
  FROM
    public.chat_messages m
  LEFT JOIN
    public.profiles p ON m.user_id = p.id
  ORDER BY
    m.created_at;

DROP VIEW IF EXISTS public.message_comments_with_users;
CREATE OR REPLACE VIEW public.message_comments_with_users AS
  SELECT
    c.id,
    c.message_id,
    c.text,
    COALESCE(p.display_name, 'Anonymous') as sender,
    format_time_german(c.created_at) as time,
    c.created_at,
    c.user_id
  FROM
    public.message_comments c
  LEFT JOIN
    public.profiles p ON c.user_id = p.id
  ORDER BY
    c.created_at;

-- Update chat_group_listings view
DROP VIEW IF EXISTS public.chat_group_listings;
CREATE OR REPLACE VIEW public.chat_group_listings AS
  SELECT
    g.id,
    g.name,
    g.type,
    g.tags,
    g.admin_id,
    g.is_active,
    ( SELECT text FROM public.chat_messages WHERE chat_group_id = g.id ORDER BY created_at DESC LIMIT 1 ) as last_message,
    ( SELECT format_time_german(created_at) FROM public.chat_messages WHERE chat_group_id = g.id ORDER BY created_at DESC LIMIT 1 ) as last_message_time,
    -- Unread count logic needs adjustment - RLS might prevent direct count.
    -- This basic count might work if SELECT policy allows viewing all messages.
    -- More complex logic (e.g., last read timestamp per user) needed for accurate unread counts with RLS.
    0 as unread_count -- Placeholder: Accurate unread count needs more work with RLS
  FROM
    public.chat_groups g
  WHERE
    g.is_active = true
  ORDER BY
    (SELECT created_at FROM public.chat_messages WHERE chat_group_id = g.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST;

-- Remove old function
DROP FUNCTION IF EXISTS public.set_chat_group_admin(UUID, UUID);

-- 8. Update EVENTS schema and RLS

-- Recreate events table linking organizer_id to profiles(id)
DROP TABLE IF EXISTS public.events CASCADE;
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  time TEXT,
  end_time TEXT, -- Keep if used
  location TEXT,
  category TEXT,
  image_url TEXT,
  organizer_id UUID REFERENCES public.profiles(id), -- Link to profiles
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate event_comments table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.event_comments CASCADE;
CREATE TABLE public.event_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate event_reactions table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.event_reactions CASCADE;
CREATE TABLE public.event_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id, emoji)
);

-- View for event reactions count (group by emoji and event)
CREATE OR REPLACE VIEW public.event_reaction_counts AS
  SELECT
    event_id,
    emoji,
    count(*) as count
  FROM public.event_reactions
  GROUP BY event_id, emoji;

-- Recreate event_attendees table linking user_id to profiles(id)
DROP TABLE IF EXISTS public.event_attendees CASCADE;
CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id), -- Link to profiles
  status TEXT NOT NULL CHECK (status IN ('attending', 'maybe', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- View for event attendees count (group by event and status)
CREATE OR REPLACE VIEW public.event_attendee_counts AS
  SELECT
    event_id,
    status,
    count(*) as count
  FROM public.event_attendees
  GROUP BY event_id, status;

-- Re-enable RLS and define policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Policies for events
DROP POLICY IF EXISTS "Allow public read access for published events" ON public.events;
CREATE POLICY "Allow public read access for published events" ON public.events
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Allow authenticated users to create events" ON public.events;
CREATE POLICY "Allow authenticated users to create events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Allow organizer to update their events" ON public.events;
CREATE POLICY "Allow organizer to update their events" ON public.events
  FOR UPDATE TO authenticated USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Allow organizer to delete their events" ON public.events;
CREATE POLICY "Allow organizer to delete their events" ON public.events
  FOR DELETE TO authenticated USING (organizer_id = auth.uid());

-- Policies for event_comments
DROP POLICY IF EXISTS "Allow users to view comments" ON public.event_comments;
CREATE POLICY "Allow users to view comments" ON public.event_comments
  FOR SELECT USING (true); -- Assuming public comments

DROP POLICY IF EXISTS "Allow authenticated users to add comments" ON public.event_comments;
CREATE POLICY "Allow authenticated users to add comments" ON public.event_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to update their own comments" ON public.event_comments;
CREATE POLICY "Allow users to update their own comments" ON public.event_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to delete their own comments" ON public.event_comments;
CREATE POLICY "Allow users to delete their own comments" ON public.event_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies for event_reactions
DROP POLICY IF EXISTS "Allow users to view reactions" ON public.event_reactions;
CREATE POLICY "Allow users to view reactions" ON public.event_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to add reactions" ON public.event_reactions;
CREATE POLICY "Allow authenticated users to add reactions" ON public.event_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to delete their own reactions" ON public.event_reactions;
CREATE POLICY "Allow users to delete their own reactions" ON public.event_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies for event_attendees
DROP POLICY IF EXISTS "Allow users to view attendance" ON public.event_attendees;
CREATE POLICY "Allow users to view attendance" ON public.event_attendees
  FOR SELECT USING (true); -- Assuming public attendance lists

DROP POLICY IF EXISTS "Allow authenticated users to set their attendance" ON public.event_attendees;
CREATE POLICY "Allow authenticated users to set their attendance" ON public.event_attendees
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to update their own attendance" ON public.event_attendees;
CREATE POLICY "Allow users to update their own attendance" ON public.event_attendees
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to delete their own attendance" ON public.event_attendees;
CREATE POLICY "Allow users to delete their own attendance" ON public.event_attendees
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Update VIEWS to join with profiles
DROP VIEW IF EXISTS public.event_comments_with_users;
CREATE OR REPLACE VIEW public.event_comments_with_users AS
  SELECT
    c.id,
    c.event_id,
    c.text,
    c.user_id,
    COALESCE(p.display_name, 'Anonymous') as user_name, -- Join with profiles
    c.created_at,
    to_char(c.created_at, 'HH24:MI') as time
  FROM
    public.event_comments c
  LEFT JOIN
    public.profiles p ON c.user_id = p.id -- Join with profiles
  ORDER BY
    c.created_at;

DROP VIEW IF EXISTS public.event_attendees_with_users;
CREATE OR REPLACE VIEW public.event_attendees_with_users AS
  SELECT
    a.id,
    a.event_id,
    a.user_id,
    a.status,
    COALESCE(p.display_name, 'Anonymous') as user_name, -- Join with profiles
    a.created_at
  FROM
    public.event_attendees a
  LEFT JOIN
    public.profiles p ON a.user_id = p.id -- Join with profiles
  ORDER BY
    a.created_at;

-- Update event_listings view
DROP VIEW IF EXISTS public.event_listings;
CREATE OR REPLACE VIEW public.event_listings AS
  SELECT
    e.id,
    e.title,
    e.description,
    e.date,
    format_date_german(e.date) as formatted_date, -- Assuming this function exists
    e.time,
    e.end_time,
    e.location,
    e.category,
    e.image_url,
    e.organizer_id,
    p.display_name as organizer_name, -- Get organizer name from profiles
    (SELECT get_event_attendees(e.id)) as attendees -- Assuming this function exists and works
  FROM
    public.events e
  LEFT JOIN
    public.profiles p ON e.organizer_id = p.id -- Join with profiles
  WHERE
    e.is_published = true
  ORDER BY
    e.date ASC;

-- Remove old update/delete functions that bypassed RLS
DROP FUNCTION IF EXISTS public.update_event(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.delete_event(UUID, UUID);

-- 9. Grant Permissions (Simplified - Grant necessary permissions on tables/views/functions to roles)
-- Grant basic usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated; -- Important for auth functions

-- Grant permissions on tables (RLS will enforce row-level access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon; -- Adjust if anon users shouldn't see profiles

GRANT SELECT ON public.articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.articles TO authenticated;

GRANT SELECT ON public.article_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.article_comments TO authenticated;

GRANT SELECT ON public.article_reactions TO anon, authenticated;
GRANT INSERT, DELETE ON public.article_reactions TO authenticated; -- INSERT covers upsert via ON CONFLICT

GRANT SELECT ON public.chat_groups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated;

GRANT SELECT ON public.chat_messages TO authenticated;
GRANT INSERT, DELETE ON public.chat_messages TO authenticated;

GRANT SELECT ON public.message_comments TO authenticated;
GRANT INSERT, DELETE ON public.message_comments TO authenticated;

GRANT SELECT ON public.message_reactions TO authenticated;
GRANT INSERT, DELETE ON public.message_reactions TO authenticated;

GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;

GRANT SELECT ON public.event_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_comments TO authenticated;

GRANT SELECT ON public.event_reactions TO anon, authenticated;
GRANT INSERT, DELETE ON public.event_reactions TO authenticated;

GRANT SELECT ON public.event_attendees TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_attendees TO authenticated;

-- Grant permissions on Views
GRANT SELECT ON public.article_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.article_comments_with_users TO anon, authenticated;
GRANT SELECT ON public.article_listings TO anon, authenticated;
GRANT SELECT ON public.message_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.chat_messages_with_users TO authenticated;
GRANT SELECT ON public.message_comments_with_users TO authenticated;
GRANT SELECT ON public.chat_group_listings TO authenticated;
GRANT SELECT ON public.event_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.event_attendee_counts TO anon, authenticated;
GRANT SELECT ON public.event_comments_with_users TO anon, authenticated;
GRANT SELECT ON public.event_attendees_with_users TO anon, authenticated;
GRANT SELECT ON public.event_listings TO anon, authenticated;

-- Grant permissions on Functions (Ensure these functions still make sense with RLS)
GRANT EXECUTE ON FUNCTION public.get_article_reactions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_date_german(TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_time_german(TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_message_reactions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_date_german(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_reactions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres; -- Trigger function needs elevated privilege usually handled by Supabase
GRANT INSERT ON public.profiles TO postgres; -- Grant insert permission to the trigger definer role

-- Function to get reaction counts for multiple messages
CREATE OR REPLACE FUNCTION get_reactions_for_messages(message_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_object_agg(message_id, reactions)
  FROM (
    SELECT
      message_id,
      jsonb_object_agg(emoji, count) as reactions
    FROM (
      SELECT
        message_id,
        emoji,
        COUNT(*) as count
      FROM message_reactions
      WHERE message_id = ANY(message_ids)
      GROUP BY message_id, emoji
    ) as reaction_counts
    GROUP BY message_id
  ) as grouped_reactions;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_reactions_for_messages(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reactions_for_messages(uuid[]) TO service_role;

-- ====================================================================
-- 11. Grant Final Permissions
-- ====================================================================

COMMIT; 