-- Fix (Issue #3): Feed-Auszug zeigt rohes HTML, wenn der 100-Zeichen-Schnitt
-- mitten in einem Tag landet. Die View strippt jetzt erst alle Tags und
-- normalisiert Whitespace, BEVOR gekürzt wird.
--
-- Hinweis: Diese Definition rekonstruiert die Live-View (inkl. der Spalte
-- linked_event_is_published, die in keiner Repo-Migration steht). Vor dem
-- Ausführen ggf. abgleichen mit:
--   SELECT pg_get_viewdef('public.article_listings'::regclass, true);

DROP VIEW IF EXISTS public.article_listings;

CREATE VIEW public.article_listings AS
SELECT
    a.id,
    a.title,
    public.format_date_german(a.published_at) AS date,
    (
        LEFT(plain.content, 100) ||
        CASE
            WHEN LENGTH(plain.content) > 100 THEN '...'::text
            ELSE ''::text
        END
    ) AS content,
    a.type,
    a.published_at,
    a.author_id,
    a.organization_id,
    a.image_url,
    a.preview_image_url,
    a.linked_event_id,
    a.tags,
    COALESCE(org.name, p.display_name, 'Redaktion'::text) AS author_name,
    (a.organization_id IS NOT NULL) AS is_organization_post,
    ev.is_published AS linked_event_is_published
FROM public.articles a
LEFT JOIN public.profiles p ON (a.author_id = p.id)
LEFT JOIN public.organizations org ON (a.organization_id = org.id)
LEFT JOIN public.events ev ON (a.linked_event_id = ev.id)
CROSS JOIN LATERAL (
    SELECT BTRIM(
        REGEXP_REPLACE(
            REGEXP_REPLACE(COALESCE(a.content, ''), '<[^>]*>', ' ', 'g'),
            '\s+', ' ', 'g'
        )
    ) AS content
) plain
WHERE (a.is_published = true)
ORDER BY a.published_at DESC;

GRANT SELECT ON public.article_listings TO anon, authenticated;
