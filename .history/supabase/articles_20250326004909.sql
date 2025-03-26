-- Articles, Comments and Reactions Database Structure
-- Enable PostgreSQL extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Articles table
DROP TABLE IF EXISTS public.articles CASCADE;
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  author_id UUID REFERENCES public.app_users(id),
  is_published BOOLEAN DEFAULT true
);

-- Comments table
DROP TABLE IF EXISTS public.article_comments CASCADE;
CREATE TABLE public.article_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reactions table (using a more normalized approach than in the UI code)
DROP TABLE IF EXISTS public.article_reactions CASCADE;
CREATE TABLE public.article_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id),
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

-- Helper function to get article reactions as a JSON object
CREATE OR REPLACE FUNCTION public.get_article_reactions(article_uuid UUID)
RETURNS JSON AS $$
DECLARE
  reaction_json JSON;
BEGIN
  SELECT json_object_agg(emoji, count) INTO reaction_json
  FROM public.article_reaction_counts
  WHERE article_id = article_uuid;
  
  RETURN COALESCE(reaction_json, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for articles table
CREATE POLICY "Anyone can view published articles" 
  ON public.articles 
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Authors can manage their own articles" 
  ON public.articles 
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Create policies for article_comments table
CREATE POLICY "Anyone can view comments" 
  ON public.article_comments 
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments" 
  ON public.article_comments 
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own comments" 
  ON public.article_comments 
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" 
  ON public.article_comments 
  FOR DELETE
  USING (user_id = auth.uid());

-- Create policies for article_reactions table
CREATE POLICY "Anyone can view reactions" 
  ON public.article_reactions 
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reactions" 
  ON public.article_reactions 
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reactions" 
  ON public.article_reactions 
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions" 
  ON public.article_reactions 
  FOR DELETE
  USING (user_id = auth.uid());

-- Seed data for articles
INSERT INTO public.articles (id, title, content, type, published_at) VALUES
  (
    uuid_generate_v4(),
    'Polizei hat wieder Sprechstunden',
    'Beitrag vom 01.03.2023. Die Polizei informiert über neue Sprechzeiten...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Polizei',
    '2023-03-01T10:00:00Z'
  ),
  (
    uuid_generate_v4(),
    'Dein Heimatort-Rat',
    'Der Rat tagt ab sofort jeden zweiten Mittwoch im Monat...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Gemeinde',
    '2023-03-15T14:30:00Z'
  ),
  (
    uuid_generate_v4(),
    'Allgemeine Offene Gruppe',
    'Neue Treffen ab jetzter Woche jeden Donnerstag...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Vereine',
    '2023-03-20T15:45:00Z'
  ),
  (
    uuid_generate_v4(),
    'Neue Feuerwehr-Spritze',
    'Was tun, ob die Sirene heult?...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nunc nisl aliquam nisl, eget aliquam nunc nisl eget nisl.

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Gemeinde',
    '2023-03-25T11:15:00Z'
  );

-- Function to format date in German format
CREATE OR REPLACE FUNCTION format_date_german(date_value TIMESTAMP WITH TIME ZONE)
RETURNS TEXT AS $$
BEGIN
  RETURN to_char(date_value, 'DD.MM.YYYY');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format time in German format (HH:MM)
CREATE OR REPLACE FUNCTION format_time_german(time_value TIMESTAMP WITH TIME ZONE)
RETURNS TEXT AS $$
BEGIN
  RETURN to_char(time_value, 'HH24:MI');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view for article listings (for home screen)
CREATE OR REPLACE VIEW public.article_listings AS
  SELECT 
    a.id,
    a.title,
    format_date_german(a.published_at) as date,
    -- Extract first 100 characters of content for preview
    LEFT(a.content, 100) || (CASE WHEN length(a.content) > 100 THEN '...' ELSE '' END) as content,
    a.type,
    a.published_at
  FROM 
    public.articles a
  WHERE 
    a.is_published = true
  ORDER BY 
    a.published_at DESC;

-- Create view for article comments with user display names
CREATE OR REPLACE VIEW public.article_comments_with_users AS
  SELECT 
    c.id,
    c.article_id,
    c.text,
    COALESCE(u.display_name, 'Anonymous') as user,
    format_time_german(c.created_at) as time,
    c.created_at
  FROM 
    public.article_comments c
  LEFT JOIN 
    public.app_users u ON c.user_id = u.id
  ORDER BY 
    c.created_at;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.articles TO anon, authenticated;
GRANT SELECT ON public.article_listings TO anon, authenticated;
GRANT SELECT ON public.article_comments TO anon, authenticated;
GRANT SELECT ON public.article_comments_with_users TO anon, authenticated;
GRANT SELECT ON public.article_reactions TO anon, authenticated;
GRANT SELECT ON public.article_reaction_counts TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.article_comments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.article_reactions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.articles TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_article_reactions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_date_german(TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_time_german(TIMESTAMP WITH TIME ZONE) TO anon, authenticated; 