-- Articles, Comments, and Reactions Schema
-- This file contains the schema for article-related functionality in MyLocalApp

-- Create articles table
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  short_content TEXT NOT NULL, -- For preview in home screen
  type TEXT NOT NULL, -- Category such as 'Polizei', 'Gemeinde', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  author_id UUID REFERENCES public.app_users(id),
  is_published BOOLEAN DEFAULT true
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.article_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create reactions table for storing emoji reactions
CREATE TABLE IF NOT EXISTS public.article_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- Store emoji as text (e.g. '👍', '❤️', etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint to prevent duplicate reactions from the same user
ALTER TABLE public.article_reactions 
  ADD CONSTRAINT article_reactions_unique_user_emoji 
  UNIQUE (article_id, user_id, emoji);

-- Create view for aggregated reaction counts per article
CREATE OR REPLACE VIEW public.article_reaction_counts AS
  SELECT 
    article_id,
    emoji,
    COUNT(*) as count
  FROM public.article_reactions
  GROUP BY article_id, emoji;

-- Create view for comments with user display names
CREATE OR REPLACE VIEW public.article_comments_with_users AS
  SELECT 
    c.id,
    c.article_id,
    c.text,
    c.created_at,
    c.updated_at,
    u.display_name as user_name,
    u.id as user_id
  FROM public.article_comments c
  JOIN public.app_users u ON c.user_id = u.id;

-- Enable Row Level Security
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for articles table
CREATE POLICY "Anyone can view published articles" 
  ON public.articles FOR SELECT
  USING (is_published = true);

CREATE POLICY "Users can create articles" 
  ON public.articles FOR INSERT
  WITH CHECK (true);  -- Organizations may have additional checks

CREATE POLICY "Users can update their own articles" 
  ON public.articles FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Create policies for comments table
CREATE POLICY "Anyone can view comments" 
  ON public.article_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments" 
  ON public.article_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own comments" 
  ON public.article_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" 
  ON public.article_comments FOR DELETE
  USING (user_id = auth.uid());

-- Create policies for reactions table
CREATE POLICY "Anyone can view reactions" 
  ON public.article_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can create reactions" 
  ON public.article_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions" 
  ON public.article_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Function to add/toggle a reaction
CREATE OR REPLACE FUNCTION public.toggle_article_reaction(
  p_article_id UUID,
  p_emoji TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Check if reaction already exists
  SELECT EXISTS (
    SELECT 1 
    FROM public.article_reactions
    WHERE 
      article_id = p_article_id AND
      user_id = v_user_id AND
      emoji = p_emoji
  ) INTO v_exists;
  
  -- Toggle reaction
  IF v_exists THEN
    -- Remove reaction
    DELETE FROM public.article_reactions
    WHERE 
      article_id = p_article_id AND
      user_id = v_user_id AND
      emoji = p_emoji;
    RETURN false;
  ELSE
    -- Add reaction
    INSERT INTO public.article_reactions (
      article_id,
      user_id,
      emoji
    ) VALUES (
      p_article_id,
      v_user_id,
      p_emoji
    );
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get reactions for article with counts
CREATE OR REPLACE FUNCTION public.get_article_reactions(
  p_article_id UUID
)
RETURNS TABLE (
  emoji TEXT,
  count BIGINT,
  user_reacted BOOLEAN
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  RETURN QUERY
  SELECT 
    r.emoji,
    COUNT(*) as count,
    EXISTS (
      SELECT 1 
      FROM public.article_reactions ur
      WHERE 
        ur.article_id = p_article_id AND
        ur.user_id = v_user_id AND
        ur.emoji = r.emoji
    ) as user_reacted
  FROM public.article_reactions r
  WHERE r.article_id = p_article_id
  GROUP BY r.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed data for articles (from HomeScreen.js)
INSERT INTO public.articles (id, title, short_content, content, type, published_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Polizei hat wieder Sprechstunden',
    'Beitrag vom 01.03.2023. Die Polizei informiert über neue Sprechzeiten...',
    'Beitrag vom 01.03.2023. Die Polizei informiert über neue Sprechzeiten...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. 

Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Polizei',
    '2023-03-01 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Dein Heimatort-Rat',
    'Der Rat tagt ab sofort jeden zweiten Mittwoch im Monat...',
    'Der Rat tagt ab sofort jeden zweiten Mittwoch im Monat...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Gemeinde',
    '2023-03-15 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'Allgemeine Offene Gruppe',
    'Neue Treffen ab jetzter Woche jeden Donnerstag...',
    'Neue Treffen ab jetzter Woche jeden Donnerstag...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Vereine',
    '2023-03-20 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    'Neue Feuerwehr-Spritze',
    'Was tun, ob die Sirene heult?...',
    'Was tun, ob die Sirene heult?...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    'Gemeinde',
    '2023-03-25 00:00:00+00'
  );

-- Seed data for comments (from ArticleDetailScreen.js)
-- Let's add comments to the first article
INSERT INTO public.article_comments (id, article_id, user_id, text, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    (SELECT id FROM public.app_users LIMIT 1), -- First user in the system
    'Das ist sehr interessant!',
    now() - interval '1 hour'
  ),
  (
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    (SELECT id FROM public.app_users LIMIT 1 OFFSET 1), -- Second user, or first again if only one
    'Danke für die Information.',
    now() - interval '30 minutes'
  );

-- Seed data for reactions
-- Let's add reactions to the first article
INSERT INTO public.article_reactions (article_id, user_id, emoji)
VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    (SELECT id FROM public.app_users LIMIT 1),
    '👍'
  );

-- Add more reactions (let's assume we have more users, if not these will fail with FK constraints)
DO $$
DECLARE
  v_user_id UUID;
  v_article_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  v_emoji TEXT;
  v_count INTEGER;
BEGIN
  -- Add multiple 👍 reactions
  FOR i IN 1..11 LOOP
    -- Get a random user id if available, otherwise use the first user
    SELECT id INTO v_user_id FROM public.app_users ORDER BY random() LIMIT 1;
    
    -- Skip if we already have this reaction for this user
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.article_reactions 
      WHERE article_id = v_article_id AND user_id = v_user_id AND emoji = '👍'
    );
    
    -- Insert reaction
    INSERT INTO public.article_reactions (article_id, user_id, emoji)
    VALUES (v_article_id, v_user_id, '👍');
  END LOOP;
  
  -- Add multiple ❤️ reactions
  FOR i IN 1..4 LOOP
    -- Get a random user id if available, otherwise use the first user
    SELECT id INTO v_user_id FROM public.app_users ORDER BY random() LIMIT 1;
    
    -- Skip if we already have this reaction for this user
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.article_reactions 
      WHERE article_id = v_article_id AND user_id = v_user_id AND emoji = '❤️'
    );
    
    -- Insert reaction
    INSERT INTO public.article_reactions (article_id, user_id, emoji)
    VALUES (v_article_id, v_user_id, '❤️');
  END LOOP;
  
  -- Add multiple 😮 reactions
  FOR i IN 1..2 LOOP
    -- Get a random user id if available, otherwise use the first user
    SELECT id INTO v_user_id FROM public.app_users ORDER BY random() LIMIT 1;
    
    -- Skip if we already have this reaction for this user
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.article_reactions 
      WHERE article_id = v_article_id AND user_id = v_user_id AND emoji = '😮'
    );
    
    -- Insert reaction
    INSERT INTO public.article_reactions (article_id, user_id, emoji)
    VALUES (v_article_id, v_user_id, '😮');
  END LOOP;
  
  -- Add multiple 🤔 reactions
  FOR i IN 1..1 LOOP
    -- Get a random user id if available, otherwise use the first user
    SELECT id INTO v_user_id FROM public.app_users ORDER BY random() LIMIT 1;
    
    -- Skip if we already have this reaction for this user
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.article_reactions 
      WHERE article_id = v_article_id AND user_id = v_user_id AND emoji = '🤔'
    );
    
    -- Insert reaction
    INSERT INTO public.article_reactions (article_id, user_id, emoji)
    VALUES (v_article_id, v_user_id, '🤔');
  END LOOP;
END $$;

-- Grant permissions
GRANT ALL ON public.articles TO anon, authenticated;
GRANT ALL ON public.article_comments TO anon, authenticated;
GRANT ALL ON public.article_reactions TO anon, authenticated;
GRANT ALL ON public.article_reaction_counts TO anon, authenticated;
GRANT ALL ON public.article_comments_with_users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_article_reaction TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_article_reactions TO anon, authenticated; 