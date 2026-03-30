-- Fix: Allow user deletion without losing content
-- 
-- Strategy:
-- - Content tables (articles, events, map_pois): author_id → SET NULL (content survives)
-- - Interaction tables (comments, reactions, attendees): user_id → CASCADE (deleted with user)
-- - Message tables: → CASCADE (deleted with user)

-- articles
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_author_id_fkey;
ALTER TABLE public.articles ADD CONSTRAINT articles_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- article_comments
ALTER TABLE public.article_comments DROP CONSTRAINT IF EXISTS article_comments_user_id_fkey;
ALTER TABLE public.article_comments ADD CONSTRAINT article_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- article_reactions
ALTER TABLE public.article_reactions DROP CONSTRAINT IF EXISTS article_reactions_user_id_fkey;
ALTER TABLE public.article_reactions ADD CONSTRAINT article_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- events (organizer)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE public.events ADD CONSTRAINT events_organizer_id_fkey
  FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- event_attendees
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_user_id_fkey;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- event_comments
ALTER TABLE public.event_comments DROP CONSTRAINT IF EXISTS event_comments_user_id_fkey;
ALTER TABLE public.event_comments ADD CONSTRAINT event_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- event_reactions
ALTER TABLE public.event_reactions DROP CONSTRAINT IF EXISTS event_reactions_user_id_fkey;
ALTER TABLE public.event_reactions ADD CONSTRAINT event_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- chat_messages
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- message_comments
ALTER TABLE public.message_comments DROP CONSTRAINT IF EXISTS message_comments_user_id_fkey;
ALTER TABLE public.message_comments ADD CONSTRAINT message_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- message_reactions
ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey;
ALTER TABLE public.message_reactions ADD CONSTRAINT message_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
