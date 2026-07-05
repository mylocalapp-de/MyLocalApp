-- Keep linked event-article dates aligned with their event date.
--
-- Event articles are shown through article_listings, which formats/sorts by
-- articles.published_at. Without this guard, linked articles default to now()
-- and display the creation date instead of the actual event date.

CREATE OR REPLACE FUNCTION public.event_datetime_as_article_published_at(
  p_date date,
  p_time text
)
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
AS $$
  SELECT (
    p_date::timestamp
    + COALESCE((substring(COALESCE(p_time, '') from '([0-9]{1,2}:[0-9]{2})'))::time, time '12:00')
  ) AT TIME ZONE 'Europe/Berlin'
$$;

CREATE OR REPLACE FUNCTION public.sync_article_published_at_from_linked_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  linked_event record;
BEGIN
  IF NEW.linked_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT date, time
    INTO linked_event
    FROM public.events
   WHERE id = NEW.linked_event_id;

  IF linked_event.date IS NOT NULL THEN
    NEW.published_at := public.event_datetime_as_article_published_at(linked_event.date, linked_event.time);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_article_published_at_from_linked_event
  ON public.articles;

CREATE TRIGGER sync_article_published_at_from_linked_event
BEFORE INSERT OR UPDATE OF linked_event_id
ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.sync_article_published_at_from_linked_event();

CREATE OR REPLACE FUNCTION public.sync_linked_articles_after_event_date_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date IS DISTINCT FROM OLD.date OR NEW.time IS DISTINCT FROM OLD.time THEN
    UPDATE public.articles
       SET published_at = public.event_datetime_as_article_published_at(NEW.date, NEW.time)
     WHERE linked_event_id = NEW.id
       AND NEW.date IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_linked_articles_after_event_date_change
  ON public.events;

CREATE TRIGGER sync_linked_articles_after_event_date_change
AFTER UPDATE OF date, time
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_linked_articles_after_event_date_change();

UPDATE public.articles a
   SET published_at = public.event_datetime_as_article_published_at(e.date, e.time)
  FROM public.events e
 WHERE a.linked_event_id = e.id
   AND e.date IS NOT NULL;
