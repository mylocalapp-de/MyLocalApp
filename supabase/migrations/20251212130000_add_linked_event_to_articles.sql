-- Migration: Add linked_event_id to articles table
-- This enables "Event Articles" - articles that link to events and appear in the article feed
-- but navigate to EventDetailScreen when clicked

-- 1. Add linked_event_id column to articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS linked_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_articles_linked_event_id ON public.articles(linked_event_id);

-- 3. Update article_listings view to include linked_event_id
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
    COALESCE(org.name, p.display_name, 'Redaktion'::text) AS author_name,
    (a.organization_id IS NOT NULL) AS is_organization_post
FROM public.articles a
LEFT JOIN public.profiles p ON (a.author_id = p.id)
LEFT JOIN public.organizations org ON (a.organization_id = org.id)
WHERE (a.is_published = true)
ORDER BY a.published_at DESC;

-- 4. Grant permissions on the view
GRANT SELECT ON public.article_listings TO anon, authenticated;

-- 5. Add comment for documentation
COMMENT ON COLUMN public.articles.linked_event_id IS 'References an event if this article is an "Event Article" that should navigate to EventDetailScreen when clicked.';
