-- Add enable_personal column to article_filters and default to false
ALTER TABLE public.article_filters
ADD COLUMN IF NOT EXISTS enable_personal boolean DEFAULT false;

-- Example: set current personal board category to true
UPDATE public.article_filters SET enable_personal = true WHERE name = 'Schwarzes Brett'; 