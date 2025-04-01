-- ====================================================================
-- == SINGLE CLEANUP AND REBUILD SCRIPT ==
-- ====================================================================
-- WARNING: This script drops the entire public schema and all its objects.
-- Ensure you have backups or are running this on a development environment.
-- ====================================================================

BEGIN;

-- 1. Drop the entire public schema and all its contents
DROP SCHEMA IF EXISTS public CASCADE;

-- 2. Recreate the public schema
CREATE SCHEMA public;

-- 3. Grant basic usage permissions on the new schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated; -- Ensure auth schema usage is granted

-- Ensure necessary extensions are enabled (usually done by Supabase, but good practice)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- == Continue with object creation (Tables, Functions, Views, RLS) ==
-- ====================================================================

-- 2. Recreate Profiles Table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferences TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Stores public profile information for authenticated users.';

-- 3. Recreate Organizations Tables
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  admin_id UUID NOT NULL REFERENCES public.profiles(id), -- User who created the org initially
  invite_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
COMMENT ON TABLE public.organizations IS 'Stores information about organizations (clubs, companies, etc.).';
COMMENT ON COLUMN public.organizations.invite_code IS 'Unique, shareable code for users to join the organization.';

CREATE TABLE public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
COMMENT ON TABLE public.organization_members IS 'Links users (profiles) to organizations and defines their role.';

-- 4. Recreate Content Tables (linked to profiles and optionally organizations)
-- Articles
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  author_id UUID REFERENCES public.profiles(id),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- Added Org Link
  is_published BOOLEAN DEFAULT true
);

CREATE TABLE public.article_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.article_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (article_id, user_id, emoji)
);

-- Chat Groups
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'open_group', 'broadcast', 'bot'
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- admin_id UUID REFERENCES public.profiles(id), -- Replaced by org admin concept for broadcast
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- Added Org Link
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.message_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  time TEXT,
  end_time TEXT,
  location TEXT,
  category TEXT,
  image_url TEXT,
  organizer_id UUID REFERENCES public.profiles(id), -- Kept original organizer concept for non-org events?
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- Added Org Link
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.event_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.event_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id, emoji)
);

CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL CHECK (status IN ('attending', 'maybe', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 5. Recreate Helper Functions
-- Formatting Functions
CREATE OR REPLACE FUNCTION public.format_date_german(date_value TIMESTAMP WITH TIME ZONE)
RETURNS TEXT AS $$ BEGIN RETURN to_char(date_value, 'DD.MM.YYYY'); END; $$ LANGUAGE plpgsql IMMUTABLE;
CREATE OR REPLACE FUNCTION public.format_date_german(date_value DATE)
RETURNS TEXT AS $$ BEGIN RETURN to_char(date_value, 'DD.MM.YYYY'); END; $$ LANGUAGE plpgsql IMMUTABLE;
CREATE OR REPLACE FUNCTION public.format_time_german(time_value TIMESTAMP WITH TIME ZONE)
RETURNS TEXT AS $$ BEGIN RETURN to_char(time_value, 'HH24:MI'); END; $$ LANGUAGE plpgsql IMMUTABLE;

-- Invite Code Generator
CREATE OR REPLACE FUNCTION public.generate_unique_invite_code()
RETURNS TEXT AS $$
DECLARE new_code TEXT; found BOOLEAN;
BEGIN
  LOOP
    new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE invite_code = new_code) INTO found;
    EXIT WHEN NOT found;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql VOLATILE;
COMMENT ON FUNCTION public.generate_unique_invite_code() IS 'Generates a unique 8-character invite code.';
-- Set default invite code on org creation
ALTER TABLE public.organizations ALTER COLUMN invite_code SET DEFAULT public.generate_unique_invite_code();

-- Trigger Function for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE meta_display_name TEXT; meta_preferences TEXT[];
BEGIN
  meta_display_name := NEW.raw_user_meta_data ->> 'display_name';
  BEGIN
    IF jsonb_typeof(NEW.raw_user_meta_data -> 'preferences') = 'array' THEN
       SELECT array_agg(elem::TEXT) INTO meta_preferences
       FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'preferences') AS elem;
    ELSE meta_preferences := '{}'; END IF;
  EXCEPTION WHEN others THEN meta_preferences := '{}'; END;
  INSERT INTO public.profiles (id, display_name, preferences)
  VALUES (NEW.id, meta_display_name, COALESCE(meta_preferences, '{}'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function for new organizations (RLS bypass version)
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
DECLARE original_replication_role TEXT;
BEGIN
  original_replication_role := current_setting('session_replication_role', true);
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.admin_id, 'admin');
  EXECUTE format('SET LOCAL session_replication_role = %L', original_replication_role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reaction/Attendee Count Functions (used by views)
CREATE OR REPLACE VIEW public.article_reaction_counts AS
  SELECT article_id, emoji, count(*) as count
  FROM public.article_reactions GROUP BY article_id, emoji;
CREATE OR REPLACE VIEW public.message_reaction_counts AS
  SELECT message_id, emoji, count(*) as count
  FROM public.message_reactions GROUP BY message_id, emoji;
CREATE OR REPLACE VIEW public.event_reaction_counts AS
  SELECT event_id, emoji, count(*) as count
  FROM public.event_reactions GROUP BY event_id, emoji;
CREATE OR REPLACE VIEW public.event_attendee_counts AS
  SELECT event_id, status, count(*) as count
  FROM public.event_attendees GROUP BY event_id, status;

CREATE OR REPLACE FUNCTION public.get_event_attendees(event_uuid UUID)
RETURNS JSON AS $$
DECLARE attendee_json JSON;
BEGIN
  SELECT json_object_agg(status, count) INTO attendee_json
  FROM public.event_attendee_counts WHERE event_id = event_uuid;
  RETURN COALESCE(attendee_json, '{"attending": 0, "maybe": 0, "declined": 0}'::JSON);
END;
$$ LANGUAGE plpgsql STABLE; -- Use STABLE, not SECURITY DEFINER unless needed

-- 6. Recreate Triggers
-- Profile Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Organization Trigger
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- 7. Recreate Views (Consolidated)
-- Article Listings
CREATE OR REPLACE VIEW public.article_listings AS
  SELECT
    a.id, a.title, format_date_german(a.published_at) as date,
    LEFT(a.content, 100) || (CASE WHEN length(a.content) > 100 THEN '...' ELSE '' END) as content,
    a.type, a.published_at, a.author_id, a.organization_id,
    COALESCE(org.name, p.display_name, 'Redaktion') as author_name, -- Org name or profile name
    (a.organization_id IS NOT NULL) as is_organization_post
  FROM public.articles a
  LEFT JOIN public.profiles p ON a.author_id = p.id
  LEFT JOIN public.organizations org ON a.organization_id = org.id
  WHERE a.is_published = true
  ORDER BY a.published_at DESC;

-- Article Comments
CREATE OR REPLACE VIEW public.article_comments_with_users AS
  SELECT c.id, c.article_id, c.text, c.user_id,
    COALESCE(p.display_name, 'Anonymous') as user_name,
    format_time_german(c.created_at) as time, c.created_at
  FROM public.article_comments c
  LEFT JOIN public.profiles p ON c.user_id = p.id ORDER BY c.created_at;

-- Chat Group Listings
CREATE OR REPLACE VIEW public.chat_group_listings AS
  WITH LastMessages AS (
    SELECT chat_group_id, text, created_at, user_id,
           ROW_NUMBER() OVER(PARTITION BY chat_group_id ORDER BY created_at DESC) as rn
    FROM public.chat_messages
  )
  SELECT
    g.id, g.name, g.type, g.tags, g.organization_id, g.is_active,
    lm.text as last_message, format_time_german(lm.created_at) as last_message_time,
    lm.created_at as last_message_timestamp,
    COALESCE(org.name, g.name) as display_source, -- Org name or group name
    -- Attempt to get sender name (might need refinement for org context)
    COALESCE(
        (SELECT sender_org.name FROM public.organizations sender_org WHERE sender_org.id = g.organization_id AND lm.user_id IS NULL), -- Placeholder logic for system/org sent message
        sender_profile.display_name,
        'System'
     ) as last_message_sender_name,
    0 as unread_count -- Placeholder, requires complex logic with RLS/read status
  FROM public.chat_groups g
  LEFT JOIN LastMessages lm ON g.id = lm.chat_group_id AND lm.rn = 1
  LEFT JOIN public.organizations org ON g.organization_id = org.id
  LEFT JOIN public.profiles sender_profile ON lm.user_id = sender_profile.id
  WHERE g.is_active = true AND g.type != 'bot'
  ORDER BY lm.created_at DESC NULLS LAST;

-- Chat Messages
CREATE OR REPLACE VIEW public.chat_messages_with_users AS
  SELECT m.id, m.chat_group_id, m.text, m.user_id,
    COALESCE(p.display_name, 'Anonymous') as sender,
    format_time_german(m.created_at) as time, m.created_at
  FROM public.chat_messages m
  LEFT JOIN public.profiles p ON m.user_id = p.id ORDER BY m.created_at;

-- Message Comments
CREATE OR REPLACE VIEW public.message_comments_with_users AS
  SELECT c.id, c.message_id, c.text, c.user_id,
    COALESCE(p.display_name, 'Anonymous') as sender,
    format_time_german(c.created_at) as time, c.created_at
  FROM public.message_comments c
  LEFT JOIN public.profiles p ON c.user_id = p.id ORDER BY c.created_at;

-- Event Listings
CREATE OR REPLACE VIEW public.event_listings AS
  SELECT
    e.id, e.title, e.description, e.date, format_date_german(e.date) as formatted_date,
    e.time, e.end_time, e.location, e.category, e.image_url,
    e.organizer_id, e.organization_id,
    COALESCE(org.name, p.display_name, 'Unbekannt') as organizer_name, -- Org name or profile name
    (e.organization_id IS NOT NULL) as is_organization_event,
    (SELECT get_event_attendees(e.id)) as attendees
  FROM public.events e
  LEFT JOIN public.profiles p ON e.organizer_id = p.id
  LEFT JOIN public.organizations org ON e.organization_id = org.id
  WHERE e.is_published = true
  ORDER BY e.date ASC, e.time ASC;

-- Event Comments
CREATE OR REPLACE VIEW public.event_comments_with_users AS
  SELECT c.id, c.event_id, c.text, c.user_id,
    COALESCE(p.display_name, 'Anonymous') as user_name,
    format_time_german(c.created_at) as time, c.created_at
  FROM public.event_comments c
  LEFT JOIN public.profiles p ON c.user_id = p.id ORDER BY c.created_at;

-- Event Attendees
CREATE OR REPLACE VIEW public.event_attendees_with_users AS
  SELECT a.id, a.event_id, a.user_id, a.status,
    COALESCE(p.display_name, 'Unbekannt') as user_name, a.created_at
  FROM public.event_attendees a
  LEFT JOIN public.profiles p ON a.user_id = p.id ORDER BY a.created_at;

-- ====================================================================
-- == Helper Functions for RLS (SECURITY DEFINER to bypass recursion) ==
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _organization_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if a membership row exists for the given user and organization
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members mem
    WHERE mem.user_id = _user_id AND mem.organization_id = _organization_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.is_org_member(uuid, uuid) IS 'Checks if a user is a member of an organization. SECURITY DEFINER bypasses RLS.';

CREATE OR REPLACE FUNCTION public.is_org_member_admin(_user_id uuid, _organization_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members mem
    WHERE mem.user_id = _user_id
      AND mem.organization_id = _organization_id
      AND mem.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.is_org_member_admin(uuid, uuid) IS 'Checks if a user is an admin of an organization. SECURITY DEFINER bypasses RLS.';

-- 8. Enable RLS and Define Policies
-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Drop existing profile policies if needed (optional, for cleanliness)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
-- Recreate profile policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop potentially problematic policies first
DROP POLICY IF EXISTS "Allow members to read their organization details" ON public.organizations;
DROP POLICY IF EXISTS "Allow admin to manage their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow authenticated users to create organizations" ON public.organizations; -- Also drop insert policy

-- Revised SELECT Policy (Using SECURITY DEFINER function)
CREATE POLICY "Allow members to read their organization details" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id)); -- Use function

-- Revised UPDATE Policy (Using SECURITY DEFINER function)
CREATE POLICY "Allow admin to manage their organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_member_admin(auth.uid(), id)) -- Use admin function
  WITH CHECK (public.is_org_member_admin(auth.uid(), id)); -- Use admin function

-- Recreate INSERT policy (no change in logic needed here)
CREATE POLICY "Allow authenticated users to create organizations" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid()); -- Check creator is admin

-- Organization Members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Drop potentially problematic policies first
DROP POLICY IF EXISTS "Allow members to view membership of their orgs" ON public.organization_members;
DROP POLICY IF EXISTS "Allow admin to manage members in their org" ON public.organization_members;
DROP POLICY IF EXISTS "Allow users to join an organization (insert)" ON public.organization_members;
DROP POLICY IF EXISTS "Allow users to leave an organization (delete)" ON public.organization_members;

-- Revised SELECT Policy (Using SECURITY DEFINER function)
CREATE POLICY "Allow members to view membership of their orgs" ON public.organization_members
    FOR SELECT TO authenticated
    USING (public.is_org_member(auth.uid(), organization_id)); -- Use function

-- Revised UPDATE Policy (Using SECURITY DEFINER function)
CREATE POLICY "Allow admin to manage members in their org" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_member_admin(auth.uid(), organization_id) AND user_id != auth.uid()) -- Use admin function
  WITH CHECK (public.is_org_member_admin(auth.uid(), organization_id)); -- Use admin function

-- Recreate INSERT policy (no change needed)
CREATE POLICY "Allow users to join an organization (insert)" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); -- User can only insert themselves
-- Recreate DELETE policy (no change needed)
CREATE POLICY "Allow users to leave an organization (delete)" ON public.organization_members
  FOR DELETE TO authenticated USING (user_id = auth.uid()); -- User can only delete themselves

-- Articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
-- Drop old article policies (optional, for cleanliness)
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.articles;
DROP POLICY IF EXISTS "Allow insert if user is author or org member" ON public.articles;
DROP POLICY IF EXISTS "Allow update if user is author or org member" ON public.articles;
DROP POLICY IF EXISTS "Allow delete if user is author or org member" ON public.articles;
-- Recreate article policies
CREATE POLICY "Anyone can view published articles" ON public.articles FOR SELECT USING (is_published = true);
CREATE POLICY "Allow insert if user is author or org member" ON public.articles FOR INSERT TO authenticated WITH CHECK (
    ( author_id = auth.uid() AND organization_id IS NULL ) OR -- Personal post
    -- Use helper function for organization check
    ( organization_id IS NOT NULL AND author_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id) )
);
CREATE POLICY "Allow update if user is author or org member" ON public.articles FOR UPDATE TO authenticated USING (
    ( author_id = auth.uid() AND organization_id IS NULL ) OR
    -- Use helper function for organization check
    ( organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id) )
) WITH CHECK (
    ( author_id = auth.uid() AND organization_id IS NULL ) OR
    -- Use helper function for organization check
    ( organization_id IS NOT NULL AND author_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id) )
);
CREATE POLICY "Allow delete if user is author or org member" ON public.articles FOR DELETE TO authenticated USING (
    ( author_id = auth.uid() AND organization_id IS NULL ) OR
    -- Use helper function for organization check (maybe check admin role here?)
    ( organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id) )
    -- Consider: ( organization_id IS NOT NULL AND public.is_org_member_admin(auth.uid(), organization_id) )
);

-- Article Comments
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view comments" ON public.article_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.article_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.article_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.article_comments;
CREATE POLICY "Anyone can view comments" ON public.article_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.article_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own comments" ON public.article_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own comments" ON public.article_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Article Reactions
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.article_reactions;
DROP POLICY IF EXISTS "Authenticated users can create reactions" ON public.article_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.article_reactions;
CREATE POLICY "Anyone can view reactions" ON public.article_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reactions" ON public.article_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own reactions" ON public.article_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Chat Groups
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow members/admins to view their org groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Anon can view public groups" ON public.chat_groups;
DROP POLICY IF EXISTS "Allow org members/admins to create broadcast groups for org" ON public.chat_groups;
CREATE POLICY "Allow members/admins to view their org groups" ON public.chat_groups FOR SELECT TO authenticated USING (
    (type = 'bot') OR
    -- Use helper function for organization check
    (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id))
);
CREATE POLICY "Anon can view public groups" ON public.chat_groups FOR SELECT TO anon USING (
    type IN ('broadcast', 'bot') AND is_active = true
);
CREATE POLICY "Allow org members/admins to create broadcast groups for org" ON public.chat_groups FOR INSERT TO authenticated WITH CHECK (
    type = 'broadcast' AND organization_id IS NOT NULL AND
    -- Use helper function (maybe check admin role?)
    public.is_org_member(auth.uid(), organization_id)
    -- Consider: public.is_org_member_admin(auth.uid(), organization_id)
);

-- Chat Messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow members to view messages in groups they can access" ON public.chat_messages;
DROP POLICY IF EXISTS "Anon can view messages in public groups" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow members to send messages in groups they can access" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow users to delete their own messages" ON public.chat_messages;
CREATE POLICY "Allow members to view messages in groups they can access" ON public.chat_messages FOR SELECT TO authenticated USING (
    chat_group_id IN (SELECT id FROM public.chat_groups) -- Relies on chat_groups SELECT policy using helper function now
);
CREATE POLICY "Anon can view messages in public groups" ON public.chat_messages FOR SELECT TO anon USING (
    chat_group_id IN (SELECT id FROM public.chat_groups WHERE type IN ('broadcast', 'bot') AND is_active = true)
);
CREATE POLICY "Allow members to send messages in groups they can access" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    chat_group_id IN (SELECT id FROM public.chat_groups)
    -- Add specific checks for broadcast (only org admins?) vs open groups if they exist
    -- Example check for broadcast:
    -- AND (
    --    (SELECT type FROM public.chat_groups WHERE id = chat_group_id) != 'broadcast' OR
    --    public.is_org_member_admin(auth.uid(), (SELECT organization_id FROM public.chat_groups WHERE id = chat_group_id))
    -- )
);
CREATE POLICY "Allow users to delete their own messages" ON public.chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Message Comments
ALTER TABLE public.message_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to view comments in accessible broadcast groups" ON public.message_comments;
DROP POLICY IF EXISTS "Anon can view comments in public groups" ON public.message_comments;
DROP POLICY IF EXISTS "Allow users to comment on broadcast messages in accessible groups" ON public.message_comments;
DROP POLICY IF EXISTS "Allow users to delete their own comments" ON public.message_comments;
CREATE POLICY "Allow users to view comments in accessible broadcast groups" ON public.message_comments FOR SELECT TO authenticated USING (
    message_id IN (
      SELECT m.id FROM public.chat_messages m JOIN public.chat_groups g ON m.chat_group_id = g.id
      WHERE g.type = 'broadcast' AND m.chat_group_id IN (SELECT id FROM public.chat_groups) -- Relies on chat_groups policy
    )
);
CREATE POLICY "Anon can view comments in public groups" ON public.message_comments FOR SELECT TO anon USING (
    message_id IN (
        SELECT m.id FROM public.chat_messages m JOIN public.chat_groups g ON m.chat_group_id = g.id
        WHERE g.type IN ('broadcast', 'bot') AND g.is_active = true
    )
);
CREATE POLICY "Allow users to comment on broadcast messages in accessible groups" ON public.message_comments FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND message_id IN (
      SELECT m.id FROM public.chat_messages m JOIN public.chat_groups g ON m.chat_group_id = g.id
      WHERE g.type = 'broadcast' AND m.chat_group_id IN (SELECT id FROM public.chat_groups) -- Relies on chat_groups policy
    )
);
CREATE POLICY "Allow users to delete their own comments" ON public.message_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Message Reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to view reactions in accessible groups" ON public.message_reactions;
DROP POLICY IF EXISTS "Anon can view reactions in public groups" ON public.message_reactions;
DROP POLICY IF EXISTS "Allow users to add reactions in accessible groups" ON public.message_reactions;
DROP POLICY IF EXISTS "Allow users to delete their own reactions" ON public.message_reactions;
CREATE POLICY "Allow users to view reactions in accessible groups" ON public.message_reactions FOR SELECT TO authenticated USING (
    message_id IN (SELECT id FROM public.chat_messages) -- Relies on chat_messages SELECT policy
);
CREATE POLICY "Anon can view reactions in public groups" ON public.message_reactions FOR SELECT TO anon USING (
    message_id IN (
        SELECT m.id FROM public.chat_messages m JOIN public.chat_groups g ON m.chat_group_id = g.id
        WHERE g.type IN ('broadcast', 'bot') AND g.is_active = true
    )
);
CREATE POLICY "Allow users to add reactions in accessible groups" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND message_id IN (SELECT id FROM public.chat_messages)
);
CREATE POLICY "Allow users to delete their own reactions" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
DROP POLICY IF EXISTS "Allow insert if user is organizer or org member" ON public.events;
DROP POLICY IF EXISTS "Allow update if user is organizer or org member" ON public.events;
DROP POLICY IF EXISTS "Allow delete if user is organizer or org member" ON public.events;
CREATE POLICY "Anyone can view published events" ON public.events FOR SELECT USING (is_published = true);
CREATE POLICY "Allow insert if user is organizer or org member" ON public.events FOR INSERT TO authenticated WITH CHECK (
    ( organizer_id = auth.uid() AND organization_id IS NULL ) OR -- Personal event
    -- Use helper function for organization check
    ( organization_id IS NOT NULL AND organizer_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id) )
);
CREATE POLICY "Allow update if user is organizer or org member" ON public.events FOR UPDATE TO authenticated USING (
    ( organizer_id = auth.uid() AND organization_id IS NULL ) OR
    -- Use helper function for organization check
    ( organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id) )
) WITH CHECK (
    ( organizer_id = auth.uid() AND organization_id IS NULL ) OR
    -- Use helper function for organization check
    ( organization_id IS NOT NULL AND organizer_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id) )
);
CREATE POLICY "Allow delete if user is organizer or org member" ON public.events FOR DELETE TO authenticated USING (
    ( organizer_id = auth.uid() AND organization_id IS NULL ) OR
    -- Use helper function for organization check (maybe check admin role here?)
    ( organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id) )
    -- Consider: ( organization_id IS NOT NULL AND public.is_org_member_admin(auth.uid(), organization_id) )
);

-- Event Comments
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view event comments" ON public.event_comments;
DROP POLICY IF EXISTS "Authenticated users can add event comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can update their own event comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can delete their own event comments" ON public.event_comments;
CREATE POLICY "Anyone can view event comments" ON public.event_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add event comments" ON public.event_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own event comments" ON public.event_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own event comments" ON public.event_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Event Reactions
ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view event reactions" ON public.event_reactions;
DROP POLICY IF EXISTS "Authenticated users can add event reactions" ON public.event_reactions;
DROP POLICY IF EXISTS "Users can delete their own event reactions" ON public.event_reactions;
CREATE POLICY "Anyone can view event reactions" ON public.event_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add event reactions" ON public.event_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own event reactions" ON public.event_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Event Attendees
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to view attendance" ON public.event_attendees;
DROP POLICY IF EXISTS "Authenticated users to set their attendance" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can update their own attendance" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can delete their own attendance" ON public.event_attendees;
CREATE POLICY "Allow users to view attendance" ON public.event_attendees FOR SELECT USING (true); -- Assuming public lists
CREATE POLICY "Authenticated users to set their attendance" ON public.event_attendees FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own attendance" ON public.event_attendees FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own attendance" ON public.event_attendees FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 9. Grant Permissions
-- Grant basic usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated; -- Important for auth functions

-- Grant execute on new helper functions
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member_admin(uuid, uuid) TO authenticated;

-- Grant table permissions (RLS enforces row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon; -- Allow anon read? Adjust if needed.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;

GRANT SELECT ON public.articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT SELECT ON public.article_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.article_comments TO authenticated;
GRANT SELECT ON public.article_reactions TO anon, authenticated;
GRANT INSERT, DELETE ON public.article_reactions TO authenticated;

GRANT SELECT ON public.chat_groups TO anon, authenticated; -- Added anon SELECT
GRANT INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated; -- Granting broadly, RLS controls access
GRANT SELECT ON public.chat_messages TO anon, authenticated; -- Added anon SELECT
GRANT INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT ON public.message_comments TO anon, authenticated; -- Added anon SELECT
GRANT INSERT, UPDATE, DELETE ON public.message_comments TO authenticated;
GRANT SELECT ON public.message_reactions TO anon, authenticated; -- Added anon SELECT
GRANT INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated; -- Note: Original had INSERT,UPDATE,DELETE here, corrected to match others

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
GRANT SELECT ON public.message_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.event_reaction_counts TO anon, authenticated;
GRANT SELECT ON public.event_attendee_counts TO anon, authenticated;
GRANT SELECT ON public.article_listings TO anon, authenticated;
GRANT SELECT ON public.article_comments_with_users TO anon, authenticated;
GRANT SELECT ON public.chat_group_listings TO authenticated; -- RLS on underlying tables controls rows. Anon will see rows based on underlying table RLS.
GRANT SELECT ON public.chat_messages_with_users TO anon, authenticated; -- Added anon SELECT
GRANT SELECT ON public.message_comments_with_users TO anon, authenticated; -- Added anon SELECT
GRANT SELECT ON public.event_listings TO anon, authenticated;
GRANT SELECT ON public.event_comments_with_users TO anon, authenticated;
GRANT SELECT ON public.event_attendees_with_users TO anon, authenticated;

-- Grant permissions on Functions
GRANT EXECUTE ON FUNCTION public.format_date_german(TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_date_german(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_time_german(TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres; -- Trigger needs elevated rights
GRANT EXECUTE ON FUNCTION public.handle_new_organization() TO postgres; -- Trigger needs elevated rights

-- NEW FUNCTION: Securely create an organization
CREATE OR REPLACE FUNCTION public.create_new_organization(org_name TEXT)
RETURNS TABLE(id uuid, name text) -- Define the return type to match select
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANT: Runs with function owner privileges, bypassing RLS for the insert itself
SET search_path = public -- Ensure it operates in the public schema
AS $$
DECLARE
  _user_id uuid := auth.uid(); -- Get the currently authenticated user's ID
  _new_org_id uuid;
BEGIN
  -- Check if user is authenticated (should always be true if called via authenticated client)
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create an organization.';
  END IF;

  -- Insert the new organization
  INSERT INTO public.organizations (name, admin_id)
  VALUES (org_name, _user_id)
  RETURNING organizations.id INTO _new_org_id; -- Get the new ID

  -- Return the ID and name of the newly created org
  RETURN QUERY SELECT o.id, o.name FROM public.organizations o WHERE o.id = _new_org_id;
END;
$$;
COMMENT ON FUNCTION public.create_new_organization(TEXT) IS 'Creates a new organization, ensuring the creator is set as admin_id. SECURITY DEFINER bypasses INSERT RLS.';

-- Grant execute on new create organization function
GRANT EXECUTE ON FUNCTION public.create_new_organization(TEXT) TO authenticated;

-- ====================================================================
-- End of script
-- ====================================================================
COMMIT;