-- Chat Groups, Messages, Reactions and Comments Database Structure
-- Enable PostgreSQL extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- First, disable row level security to make operations possible
ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_reactions DISABLE ROW LEVEL SECURITY;

-- Drop existing tables with dependencies in correct order
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.message_comments CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_groups CASCADE;

-- Chat Groups table
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'open_group', 'broadcast', 'bot'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  admin_id UUID REFERENCES public.app_users(id), -- admin for broadcast groups
  is_active BOOLEAN DEFAULT true,
  UNIQUE(name) -- Add unique constraint for the name
);

-- Messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Message Comments table (for broadcast groups)
CREATE TABLE public.message_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Message Reactions table
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- View for reactions count (group by emoji and message)
CREATE OR REPLACE VIEW public.message_reaction_counts AS
  SELECT 
    message_id,
    emoji,
    count(*) as count
  FROM public.message_reactions
  GROUP BY message_id, emoji;

-- Helper function to get message reactions as a JSON object
CREATE OR REPLACE FUNCTION public.get_message_reactions(message_uuid UUID)
RETURNS JSON AS $$
DECLARE
  reaction_json JSON;
BEGIN
  SELECT json_object_agg(emoji, count) INTO reaction_json
  FROM public.message_reaction_counts
  WHERE message_id = message_uuid;
  
  RETURN COALESCE(reaction_json, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for chat messages with formatted time and user display names
CREATE OR REPLACE VIEW public.chat_messages_with_users AS
  SELECT 
    m.id,
    m.chat_group_id,
    m.text,
    COALESCE(u.display_name, 'Anonymous') as sender,
    format_time_german(m.created_at) as time,
    m.created_at,
    m.user_id
  FROM 
    public.chat_messages m
  LEFT JOIN 
    public.app_users u ON m.user_id = u.id
  ORDER BY 
    m.created_at;

-- View for message comments with user display names
CREATE OR REPLACE VIEW public.message_comments_with_users AS
  SELECT 
    c.id,
    c.message_id,
    c.text,
    COALESCE(u.display_name, 'Anonymous') as sender,
    format_time_german(c.created_at) as time,
    c.created_at,
    c.user_id
  FROM 
    public.message_comments c
  LEFT JOIN 
    public.app_users u ON c.user_id = u.id
  ORDER BY 
    c.created_at;

-- View for chat groups with last message
CREATE OR REPLACE VIEW public.chat_group_listings AS
  SELECT 
    g.id,
    g.name,
    g.type,
    g.admin_id,
    g.is_active,
    (
      SELECT text 
      FROM public.chat_messages 
      WHERE chat_group_id = g.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) as last_message,
    (
      SELECT format_time_german(created_at)
      FROM public.chat_messages 
      WHERE chat_group_id = g.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) as last_message_time,
    (
      SELECT count(*) 
      FROM public.chat_messages 
      WHERE chat_group_id = g.id 
      AND created_at > (now() - interval '24 hours')
    ) as unread_count
  FROM 
    public.chat_groups g
  WHERE 
    g.is_active = true
  ORDER BY 
    (
      SELECT created_at
      FROM public.chat_messages 
      WHERE chat_group_id = g.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) DESC NULLS LAST;

-- Add helper function to set admin for chat groups
CREATE OR REPLACE FUNCTION public.set_chat_group_admin(group_id UUID, admin_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.chat_groups 
    SET admin_id = $2
    WHERE id = $1;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed data for chat groups
INSERT INTO public.chat_groups (id, name, type, description, is_active) VALUES
  (
    '00000000-0000-0000-0000-000000000001', -- Fixed ID for Dorfbot
    'Dorfbot - KI Assistent',
    'bot',
    'Frag mich über dein Dorf!',
    true
  )
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Seed data for non-bot chat groups - safer insertion without ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chat_groups WHERE name = 'Offene Gruppe Straßenbau') THEN
    INSERT INTO public.chat_groups (name, type, description, is_active) 
    VALUES (
      'Offene Gruppe Straßenbau',
      'open_group',
      'Diskussion über lokale Straßenbauarbeiten',
      true
    );
  END IF;
END $$;

-- Seed data for broadcast groups with safer insertions
DO $$
BEGIN
  -- Insert Ankündigungen Test e.V. if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.chat_groups WHERE name = 'Ankündigungen Test e.V.') THEN
    INSERT INTO public.chat_groups (name, type, description, is_active) 
    VALUES (
      'Ankündigungen Test e.V.',
      'broadcast',
      'Offizielle Ankündigungen des Test e.V.',
      true
    );
  END IF;
  
  -- Insert Kunsthaus Nachrichten if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.chat_groups WHERE name = 'Kunsthaus Nachrichten') THEN
    INSERT INTO public.chat_groups (name, type, description, is_active) 
    VALUES (
      'Kunsthaus Nachrichten',
      'broadcast',
      'Neuigkeiten und Veranstaltungen im Kunsthaus',
      true
    );
  END IF;
END $$;

-- Seed messages for the chat groups (excluding bot)
-- Straßenbau group messages
DO $$
DECLARE
  strassenbau_id UUID;
BEGIN
  SELECT id INTO strassenbau_id FROM public.chat_groups WHERE name = 'Offene Gruppe Straßenbau' LIMIT 1;
  
  IF strassenbau_id IS NOT NULL THEN
    -- Only insert if we don't already have messages for this group
    IF NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE chat_group_id = strassenbau_id LIMIT 1) THEN
      INSERT INTO public.chat_messages (chat_group_id, text, created_at) VALUES
        (strassenbau_id, 'Hallo zusammen! Weiß jemand, wann die Bauarbeiten an der Hauptstraße beginnen?', NOW() - INTERVAL '1 hour'),
        (strassenbau_id, 'Laut Gemeindeblatt soll es nächste Woche Montag losgehen.', NOW() - INTERVAL '45 minutes'),
        (strassenbau_id, 'Danke für die Info!', NOW() - INTERVAL '30 minutes');
    END IF;
  END IF;
END $$;

-- Test e.V. group messages
DO $$
DECLARE
  testev_id UUID;
  message_id UUID;
BEGIN
  SELECT id INTO testev_id FROM public.chat_groups WHERE name = 'Ankündigungen Test e.V.' LIMIT 1;
  
  IF testev_id IS NOT NULL THEN
    -- Only insert if we don't already have messages for this group
    IF NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE chat_group_id = testev_id LIMIT 1) THEN
      INSERT INTO public.chat_messages (chat_group_id, text, created_at) 
      VALUES (testev_id, 'Das Sportfest findet am 15. Juli statt. Bitte merkt euch den Termin vor!', NOW() - INTERVAL '3 hours')
      RETURNING id INTO message_id;
      
      -- Add reactions
      IF message_id IS NOT NULL THEN
        INSERT INTO public.message_reactions (message_id, emoji) VALUES
          (message_id, '👍'),
          (message_id, '👍'),
          (message_id, '❤️');
        
        -- Add comment
        INSERT INTO public.message_comments (message_id, text, created_at) VALUES
          (message_id, 'Super, ich freue mich darauf!', NOW() - INTERVAL '2 hours');
      END IF;
    END IF;
  END IF;
END $$;

-- Kunsthaus group messages
DO $$
DECLARE
  kunsthaus_id UUID;
  message_id UUID;
BEGIN
  SELECT id INTO kunsthaus_id FROM public.chat_groups WHERE name = 'Kunsthaus Nachrichten' LIMIT 1;
  
  IF kunsthaus_id IS NOT NULL THEN
    -- Only insert if we don't already have messages for this group
    IF NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE chat_group_id = kunsthaus_id LIMIT 1) THEN
      INSERT INTO public.chat_messages (chat_group_id, text, created_at) 
      VALUES (kunsthaus_id, 'Unsere neue Ausstellung "Lokale Kunst im Wandel der Zeit" öffnet nächsten Freitag. Eintritt frei!', NOW() - INTERVAL '5 hours')
      RETURNING id INTO message_id;
      
      -- Add reactions
      IF message_id IS NOT NULL THEN
        INSERT INTO public.message_reactions (message_id, emoji) VALUES
          (message_id, '👍'),
          (message_id, '👍'),
          (message_id, '👍'),
          (message_id, '❤️'),
          (message_id, '❤️');
      END IF;
    END IF;
  END IF;
END $$;

-- Add seed data for the Dorfbot
DO $$
DECLARE
  dorfbot_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Only insert if we don't already have messages for the bot
  IF NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE chat_group_id = dorfbot_id LIMIT 1) THEN
    INSERT INTO public.chat_messages (chat_group_id, text, created_at) VALUES
      (dorfbot_id, 'Hallo! Ich bin der Dorfbot. Wie kann ich dir bei Fragen zu deinem Dorf helfen?', NOW() - INTERVAL '6 hours');
  END IF;
END $$;

-- Set an admin for broadcast groups if available
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first user from app_users table (usually exists after initial setup)
  SELECT id INTO first_user_id FROM public.app_users ORDER BY created_at LIMIT 1;
  
  -- If we found a user, assign them as admin to broadcast groups that don't have an admin
  IF first_user_id IS NOT NULL THEN
    RAISE NOTICE 'Setting admin_id to % for broadcast groups without admin', first_user_id;
    
    UPDATE public.chat_groups 
    SET admin_id = first_user_id
    WHERE type = 'broadcast' AND admin_id IS NULL;
  ELSE
    RAISE NOTICE 'No users found in app_users table for admin assignment';
  END IF;
END $$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.chat_groups TO anon, authenticated;
GRANT SELECT ON public.chat_group_listings TO anon, authenticated;
GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT SELECT ON public.chat_messages_with_users TO anon, authenticated;
GRANT SELECT ON public.message_comments TO anon, authenticated;
GRANT SELECT ON public.message_comments_with_users TO anon, authenticated;
GRANT SELECT ON public.message_reactions TO anon, authenticated;
GRANT SELECT ON public.message_reaction_counts TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.chat_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.message_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.message_reactions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_groups TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_message_reactions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_chat_group_admin(UUID, UUID) TO anon, authenticated;

-- Keep RLS disabled for all tables
-- This is the key change - we're not using RLS for these tables at all
-- All permission checking will be done in the application code 