-- Chat Groups, Messages, Reactions and Comments Database Structure
-- Enable PostgreSQL extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Chat Groups table
DROP TABLE IF EXISTS public.chat_groups CASCADE;
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'open_group', 'broadcast', 'bot'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  admin_id UUID REFERENCES public.app_users(id), -- admin for broadcast groups
  is_active BOOLEAN DEFAULT true
);

-- Messages table
DROP TABLE IF EXISTS public.chat_messages CASCADE;
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Message Comments table (for broadcast groups)
DROP TABLE IF EXISTS public.message_comments CASCADE;
CREATE TABLE public.message_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Message Reactions table
DROP TABLE IF EXISTS public.message_reactions CASCADE;
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

-- Enable Row Level Security
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_groups table
CREATE POLICY "Anyone can view active chat groups" 
  ON public.chat_groups 
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage their own chat groups" 
  ON public.chat_groups 
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- Create policies for chat_messages table
CREATE POLICY "Anyone can view messages" 
  ON public.chat_messages 
  FOR SELECT
  USING (true);

CREATE POLICY "Open groups allow anyone to post messages" 
  ON public.chat_messages 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_groups 
      WHERE id = chat_group_id 
      AND type = 'open_group'
    )
  );

CREATE POLICY "Broadcast groups allow only admins to post messages" 
  ON public.chat_messages 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_groups 
      WHERE id = chat_group_id 
      AND type = 'broadcast' 
      AND admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" 
  ON public.chat_messages 
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" 
  ON public.chat_messages 
  FOR DELETE
  USING (user_id = auth.uid());

-- Create policies for message_comments table
CREATE POLICY "Anyone can view comments" 
  ON public.message_comments 
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments" 
  ON public.message_comments 
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own comments" 
  ON public.message_comments 
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" 
  ON public.message_comments 
  FOR DELETE
  USING (user_id = auth.uid());

-- Create policies for message_reactions table
CREATE POLICY "Anyone can view reactions" 
  ON public.message_reactions 
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reactions" 
  ON public.message_reactions 
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own reactions" 
  ON public.message_reactions 
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions" 
  ON public.message_reactions 
  FOR DELETE
  USING (user_id = auth.uid());

-- Seed data for chat groups
INSERT INTO public.chat_groups (id, name, type, description, is_active) VALUES
  (
    '00000000-0000-0000-0000-000000000001', -- Fixed ID for Dorfbot
    'Dorfbot - KI Assistent',
    'bot',
    'Frag mich über dein Dorf!',
    true
  );

-- Seed data for non-bot chat groups
INSERT INTO public.chat_groups (name, type, description, is_active) VALUES
  (
    'Offene Gruppe Straßenbau',
    'open_group',
    'Diskussion über lokale Straßenbauarbeiten',
    true
  ),
  (
    'Ankündigungen Test e.V.',
    'broadcast',
    'Offizielle Ankündigungen des Test e.V.',
    true
  ),
  (
    'Kunsthaus Nachrichten',
    'broadcast',
    'Neuigkeiten und Veranstaltungen im Kunsthaus',
    true
  );

-- Seed messages for the chat groups (excluding bot)
-- Straßenbau group messages
INSERT INTO public.chat_messages (chat_group_id, text, created_at) VALUES
  (
    (SELECT id FROM public.chat_groups WHERE name = 'Offene Gruppe Straßenbau'),
    'Hallo zusammen! Weiß jemand, wann die Bauarbeiten an der Hauptstraße beginnen?',
    NOW() - INTERVAL '1 hour'
  ),
  (
    (SELECT id FROM public.chat_groups WHERE name = 'Offene Gruppe Straßenbau'),
    'Laut Gemeindeblatt soll es nächste Woche Montag losgehen.',
    NOW() - INTERVAL '45 minutes'
  ),
  (
    (SELECT id FROM public.chat_groups WHERE name = 'Offene Gruppe Straßenbau'),
    'Danke für die Info!',
    NOW() - INTERVAL '30 minutes'
  );

-- Test e.V. group messages
INSERT INTO public.chat_messages (chat_group_id, text, created_at) VALUES
  (
    (SELECT id FROM public.chat_groups WHERE name = 'Ankündigungen Test e.V.'),
    'Das Sportfest findet am 15. Juli statt. Bitte merkt euch den Termin vor!',
    NOW() - INTERVAL '3 hours'
  );

-- Add a reaction to the Test e.V. message
INSERT INTO public.message_reactions (message_id, emoji) VALUES
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Sportfest%'),
    '👍'
  ),
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Sportfest%'),
    '👍'
  ),
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Sportfest%'),
    '❤️'
  );

-- Add a comment to the Test e.V. message
INSERT INTO public.message_comments (message_id, text, created_at) VALUES
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Sportfest%'),
    'Super, ich freue mich darauf!',
    NOW() - INTERVAL '2 hours'
  );

-- Kunsthaus group messages
INSERT INTO public.chat_messages (chat_group_id, text, created_at) VALUES
  (
    (SELECT id FROM public.chat_groups WHERE name = 'Kunsthaus Nachrichten'),
    'Unsere neue Ausstellung "Lokale Kunst im Wandel der Zeit" öffnet nächsten Freitag. Eintritt frei!',
    NOW() - INTERVAL '5 hours'
  );

-- Add reactions to the Kunsthaus message
INSERT INTO public.message_reactions (message_id, emoji) VALUES
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Ausstellung%'),
    '👍'
  ),
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Ausstellung%'),
    '👍'
  ),
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Ausstellung%'),
    '👍'
  ),
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Ausstellung%'),
    '❤️'
  ),
  (
    (SELECT id FROM public.chat_messages WHERE text LIKE '%Ausstellung%'),
    '❤️'
  );

-- Add seed data for the Dorfbot
INSERT INTO public.chat_messages (chat_group_id, text, created_at) VALUES
  (
    '00000000-0000-0000-0000-000000000001', -- Fixed ID for Dorfbot
    'Hallo! Ich bin der Dorfbot. Wie kann ich dir bei Fragen zu deinem Dorf helfen?',
    NOW() - INTERVAL '6 hours'
  );

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

GRANT INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.message_comments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_message_reactions(UUID) TO anon, authenticated; 