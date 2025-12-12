-- Migration: Add tags to articles and events tables
-- This enables free-form tagging for articles and events, with filtering in profile views

-- 1. Add tags column to articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- 2. Add tags column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- 3. Create index for faster tag-based queries on articles
CREATE INDEX IF NOT EXISTS idx_articles_tags ON public.articles USING GIN (tags);

-- 4. Create index for faster tag-based queries on events
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN (tags);

-- 5. Update article_listings view to include tags
DROP VIEW IF EXISTS public.article_listings;

CREATE VIEW public.article_listings AS
SELECT 
    a.id,
    a.title,
    public.format_date_german(a.published_at) AS date,
    (LEFT(a.content, 100) ||
        CASE
            WHEN (LENGTH(a.content) > 100) THEN '...'::text
            ELSE ''::text
        END) AS content,
    a.type,
    a.published_at,
    a.author_id,
    a.organization_id,
    a.image_url,
    a.preview_image_url,
    a.linked_event_id,
    a.tags,
    COALESCE(org.name, p.display_name, 'Redaktion'::text) AS author_name,
    (a.organization_id IS NOT NULL) AS is_organization_post
FROM public.articles a
LEFT JOIN public.profiles p ON (a.author_id = p.id)
LEFT JOIN public.organizations org ON (a.organization_id = org.id)
WHERE (a.is_published = true)
ORDER BY a.published_at DESC;

-- 6. Grant permissions on the updated view
GRANT SELECT ON public.article_listings TO anon, authenticated;

-- 7. Create event_listings view for easier event querying with author info
DROP VIEW IF EXISTS public.event_listings;

CREATE VIEW public.event_listings AS
SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.time,
    e.end_time,
    e.location,
    e.category,
    e.image_url,
    e.organizer_id,
    e.organization_id,
    e.is_published,
    e.created_at,
    e.recurrence_rule,
    e.recurrence_end_date,
    e.tags,
    COALESCE(org.name, p.display_name, 'Unbekannt'::text) AS organizer_name,
    (e.organization_id IS NOT NULL) AS is_organization_event
FROM public.events e
LEFT JOIN public.profiles p ON (e.organizer_id = p.id)
LEFT JOIN public.organizations org ON (e.organization_id = org.id)
WHERE (e.is_published = true)
ORDER BY e.date DESC;

-- 8. Grant permissions on the event_listings view
GRANT SELECT ON public.event_listings TO anon, authenticated;

-- 9. Add comments for documentation
COMMENT ON COLUMN public.articles.tags IS 'Array of free-form tags for categorizing and filtering articles.';
COMMENT ON COLUMN public.events.tags IS 'Array of free-form tags for categorizing and filtering events.';
