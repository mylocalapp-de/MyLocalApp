-- Events, Comments, Reactions and Attendees Database Structure
-- Enable PostgreSQL extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to format date in German format
CREATE OR REPLACE FUNCTION format_date_german(date_value DATE)
RETURNS TEXT AS $$
BEGIN
  RETURN to_char(date_value, 'DD.MM.YYYY');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update tables only if they exist (no drops)
BEGIN;
  -- Skip table creation if they already exist
  -- We'll just make sure foreign keys are intact
  
  -- Events table: Add organizer_id if it doesn't exist
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'organizer_id') THEN
      ALTER TABLE public.events ADD COLUMN organizer_id UUID REFERENCES public.app_users(id);
    END IF;
  END $$;

  -- Add indexes for performance
  CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
  CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON public.events(organizer_id);
  CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON public.event_comments(event_id);
  CREATE INDEX IF NOT EXISTS idx_event_reactions_event_id_user_id ON public.event_reactions(event_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id_user_id ON public.event_attendees(event_id, user_id);

  -- Recreate views to include organizer_id and potentially missing columns
  DROP VIEW IF EXISTS public.event_listings;
  DROP VIEW IF EXISTS public.event_comments_with_users;
  DROP VIEW IF EXISTS public.event_attendees_with_users;
  DROP VIEW IF EXISTS public.event_reaction_counts;
  DROP VIEW IF EXISTS public.event_attendee_counts;

  -- View for reactions count (group by emoji and event)
  CREATE OR REPLACE VIEW public.event_reaction_counts AS
    SELECT 
      event_id,
      emoji,
      count(*) as count
    FROM public.event_reactions
    GROUP BY event_id, emoji;

  -- View for attendees count (group by event and status)
  CREATE OR REPLACE VIEW public.event_attendee_counts AS
    SELECT 
      event_id,
      status,
      count(*) as count
    FROM public.event_attendees
    GROUP BY event_id, status;

  -- Helper function to get event reactions as a JSON object
  CREATE OR REPLACE FUNCTION public.get_event_reactions(event_uuid UUID)
  RETURNS JSON AS $$
  DECLARE
    reaction_json JSON;
  BEGIN
    SELECT json_object_agg(emoji, count) INTO reaction_json
    FROM public.event_reaction_counts
    WHERE event_id = event_uuid;
    
    RETURN COALESCE(reaction_json, '{}'::JSON);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Helper function to get event attendees as a JSON object
  CREATE OR REPLACE FUNCTION public.get_event_attendees(event_uuid UUID)
  RETURNS JSON AS $$
  DECLARE
    attendee_json JSON;
  BEGIN
    SELECT json_object_agg(status, count) INTO attendee_json
    FROM public.event_attendee_counts
    WHERE event_id = event_uuid;
    
    RETURN COALESCE(attendee_json, '{"attending": 0, "maybe": 0, "declined": 0}'::JSON);
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Create view for event listings (for calendar screen)
  CREATE OR REPLACE VIEW public.event_listings AS
    SELECT 
      e.id,
      e.title,
      e.description,
      e.date,
      format_date_german(e.date) as formatted_date,
      e.time,
      e.end_time,
      e.location,
      e.category,
      e.image_url,
      e.organizer_id,
      (SELECT get_event_attendees(e.id)) as attendees
    FROM 
      public.events e
    WHERE 
      e.is_published = true
    ORDER BY 
      e.date ASC;

  -- Create view for event comments with user display names
  CREATE OR REPLACE VIEW public.event_comments_with_users AS
    SELECT 
      c.id,
      c.event_id,
      c.text,
      c.user_id,
      COALESCE(u.display_name, 'Anonymous') as user_name,
      c.created_at,
      to_char(c.created_at, 'HH24:MI') as time
    FROM 
      public.event_comments c
    LEFT JOIN 
      public.app_users u ON c.user_id = u.id
    ORDER BY 
      c.created_at;

  -- Create view for event attendees with user display names
  CREATE OR REPLACE VIEW public.event_attendees_with_users AS
    SELECT
      a.id,
      a.event_id,
      a.user_id,
      a.status,
      COALESCE(u.display_name, 'Anonymous') as user_name,
      a.created_at
    FROM
      public.event_attendees a
    LEFT JOIN
      public.app_users u ON a.user_id = u.id
    ORDER BY
      a.created_at;
COMMIT;

-- == RLS Section Removed ==
-- RLS Policies are disabled for these tables due to custom authentication.
-- Security checks must be handled in application logic or dedicated DB functions.

-- Disable Row Level Security for all event tables
DO $$
BEGIN
  -- Check if tables exist and disable RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_comments') THEN
    ALTER TABLE public.event_comments DISABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_reactions') THEN
    ALTER TABLE public.event_reactions DISABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_attendees') THEN
    ALTER TABLE public.event_attendees DISABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;

-- Grant all needed permissions (these will only work if the views/tables exist)
-- Grant broad permissions as RLS is disabled. App logic must enforce fine-grained control.
DO $$
BEGIN
  -- Grant permissions to tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    GRANT ALL ON public.events TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_comments') THEN
    GRANT ALL ON public.event_comments TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_reactions') THEN
    GRANT ALL ON public.event_reactions TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_attendees') THEN
    GRANT ALL ON public.event_attendees TO anon, authenticated;
  END IF;

  -- Grant permissions to views
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_reaction_counts') THEN
    GRANT ALL ON public.event_reaction_counts TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_attendee_counts') THEN
    GRANT ALL ON public.event_attendee_counts TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_listings') THEN
    GRANT ALL ON public.event_listings TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_comments_with_users') THEN
    GRANT ALL ON public.event_comments_with_users TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_attendees_with_users') THEN
    GRANT ALL ON public.event_attendees_with_users TO anon, authenticated;
  END IF;

  -- Grant execute permissions on functions
  GRANT EXECUTE ON FUNCTION public.get_event_reactions(UUID) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.format_date_german(DATE) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.update_event(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated; -- Grant to anon too if needed by app logic
  GRANT EXECUTE ON FUNCTION public.delete_event(UUID, UUID) TO anon, authenticated; -- Grant to anon too if needed by app logic
END;
$$;

-- Seed data for events (only if the table is empty)
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get a user ID to assign as organizer (replace with a real ID if needed)
  SELECT id INTO test_user_id FROM public.app_users LIMIT 1;
  IF test_user_id IS NULL THEN
    -- Insert a dummy user if none exist (for testing purposes)
    INSERT INTO public.app_users (id, display_name) VALUES (uuid_generate_v4(), 'Test Organizer')
    RETURNING id INTO test_user_id;
  END IF;

  -- Only insert seed data if the events table is empty
  IF (SELECT COUNT(*) FROM public.events) = 0 THEN
    INSERT INTO public.events (id, title, description, date, time, location, category, created_at, organizer_id, is_published) VALUES
    (
      uuid_generate_v4(),
      'Dorffest',
      'Unser jährliches Dorffest mit Musik, Essen und Getränken. Alle Einwohner sind herzlich eingeladen!

Programm:
- 14:00 Uhr: Eröffnung durch den Bürgermeister
- 15:00 Uhr: Auftritt der Kindergartengruppe
- 16:30 Uhr: Kaffee und Kuchen
- 18:00 Uhr: Live-Musik
- 22:00 Uhr: Ende der Veranstaltung

Für das leibliche Wohl ist gesorgt!',
      '2024-03-15',
      'Um 14:00',
      'Dorfplatz',
      'Kultur',
      '2024-02-15T10:00:00Z',
      test_user_id,
      true
    ),
    (
      uuid_generate_v4(),
      'Fußballspiel: Heimverein vs. Nachbardorf',
      'Das große Derby gegen unsere Nachbarn! Kommt alle und unterstützt unser Team!

Die Mannschaft freut sich über zahlreiche Unterstützung. Die Vereinsgaststätte ist ab 14:00 Uhr geöffnet.

Bei Regen findet das Spiel trotzdem statt.',
      '2024-03-12',
      'Um 16:00',
      'Sportplatz',
      'Sport',
      '2024-02-20T14:30:00Z',
      test_user_id,
      true
    ),
    (
      uuid_generate_v4(),
      'Feuerwehr-Übung',
      'Öffentliche Vorführung der Feuerwehr mit Löschübungen und Vorstellung der neuen Ausrüstung.

Programm:
- Vorstellung der neuen Feuerwehrspritze
- Demonstration verschiedener Löschverfahren
- Informationen zum Brandschutz im Haushalt
- Kinderprogramm mit Mini-Feuerwehrauto

Im Anschluss gibt es Getränke und Grillwürste am Feuerwehrhaus.',
      '2024-03-18',
      'Um 18:30',
      'Feuerwehrhaus',
      'Vereine',
      '2024-02-25T09:45:00Z',
      test_user_id,
      true
    ),
    (
      uuid_generate_v4(),
      'Bürgerversammlung',
      'Wichtige Informationen zur geplanten Umgehungsstraße und anderen aktuellen Themen im Ort.

Tagesordnung:
1. Begrüßung durch den Bürgermeister
2. Vorstellung der Pläne zur Umgehungsstraße
3. Diskussion zu den geplanten Baumaßnahmen im Dorfzentrum
4. Verschiedenes

Alle Bürgerinnen und Bürger sind herzlich eingeladen, ihre Fragen und Anregungen einzubringen.',
      '2024-03-05',
      'Um 19:00',
      'Gemeindeamt',
      'Gemeindeamt',
      '2024-02-10T11:20:00Z',
      test_user_id,
      true
    ),
    (
      uuid_generate_v4(),
      'Seniorennachmittag',
      'Gemütlicher Nachmittag für Senioren mit Kaffee, Kuchen und musikalischer Unterhaltung.

Es gibt selbstgebackenen Kuchen und die Musikgruppe des Dorfes sorgt für Unterhaltung.

Fahrdienst kann bei Bedarf organisiert werden, bitte bis zum 10.03. im Gemeindeamt melden.',
      '2024-03-13',
      'Um 15:00',
      'Gemeindesaal',
      'Kultur',
      '2024-02-18T16:15:00Z',
      test_user_id,
      true
    );
  END IF;
END;
$$;

-- Helper functions for updating/deleting events bypassing RLS check issues
-- These functions are still useful for encapsulation but not enforced by RLS.
-- Function to update events without relying on auth.uid() within the function
CREATE OR REPLACE FUNCTION public.update_event(
  p_event_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_date DATE,
  p_time TEXT,
  p_end_time TEXT,
  p_location TEXT,
  p_category TEXT,
  p_image_url TEXT,
  p_organizer_id UUID -- Pass the organizer ID explicitly
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.events
  SET
    title = p_title,
    description = p_description,
    date = p_date,
    time = p_time,
    end_time = p_end_time,
    location = p_location,
    category = p_category,
    image_url = p_image_url
    -- updated_at = now() -- Consider adding an updated_at column
  WHERE
    id = p_event_id AND
    organizer_id = p_organizer_id; -- Check ownership here

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete events without relying on auth.uid() within the function
CREATE OR REPLACE FUNCTION public.delete_event(
  p_event_id UUID,
  p_organizer_id UUID -- Pass the organizer ID explicitly
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM public.events
  WHERE
    id = p_event_id AND
    organizer_id = p_organizer_id; -- Check ownership here

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to the new functions (redundant given grants above, but kept for clarity)
-- GRANT EXECUTE ON FUNCTION public.update_event(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.delete_event(UUID, UUID) TO authenticated; 