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

-- Drop any existing RLS policies
DO $$
BEGIN
  -- Drop policies if they exist (these will fail silently if they don't exist)
  BEGIN
    DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Organizers can manage their own events" ON public.events;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Anyone can view event comments" ON public.event_comments;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can create event comments" ON public.event_comments;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update their own event comments" ON public.event_comments;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete their own event comments" ON public.event_comments;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Anyone can view event reactions" ON public.event_reactions;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can create event reactions" ON public.event_reactions;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update their own event reactions" ON public.event_reactions;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete their own event reactions" ON public.event_reactions;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Anyone can view event attendees" ON public.event_attendees;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can create event attendees" ON public.event_attendees;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update their own event attendance" ON public.event_attendees;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete their own event attendance" ON public.event_attendees;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
END;
$$;

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
DO $$
BEGIN
  -- Grant permissions to tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    GRANT ALL ON public.events TO authenticated;
    GRANT SELECT ON public.events TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_comments') THEN
    GRANT ALL ON public.event_comments TO authenticated;
    GRANT SELECT ON public.event_comments TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_reactions') THEN
    GRANT ALL ON public.event_reactions TO authenticated;
    GRANT SELECT ON public.event_reactions TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_attendees') THEN
    GRANT ALL ON public.event_attendees TO authenticated;
    GRANT SELECT ON public.event_attendees TO anon;
  END IF;
  
  -- Grant permissions to views
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_reaction_counts') THEN
    GRANT ALL ON public.event_reaction_counts TO authenticated;
    GRANT SELECT ON public.event_reaction_counts TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_attendee_counts') THEN
    GRANT ALL ON public.event_attendee_counts TO authenticated;
    GRANT SELECT ON public.event_attendee_counts TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_listings') THEN
    GRANT ALL ON public.event_listings TO authenticated;
    GRANT SELECT ON public.event_listings TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_comments_with_users') THEN
    GRANT ALL ON public.event_comments_with_users TO authenticated;
    GRANT SELECT ON public.event_comments_with_users TO anon;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'event_attendees_with_users') THEN
    GRANT ALL ON public.event_attendees_with_users TO authenticated;
    GRANT SELECT ON public.event_attendees_with_users TO anon;
  END IF;
  
  -- Grant execute permissions on functions
  GRANT EXECUTE ON FUNCTION public.get_event_reactions(UUID) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.format_date_german(DATE) TO anon, authenticated;
END;
$$;

-- Seed data for events (only if the table is empty)
DO $$
BEGIN
  -- Only insert seed data if the events table is empty
  IF (SELECT COUNT(*) FROM public.events) = 0 THEN
    INSERT INTO public.events (id, title, description, date, time, location, category, created_at) VALUES
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
      '2024-02-15T10:00:00Z'
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
      '2024-02-20T14:30:00Z'
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
      '2024-02-25T09:45:00Z'
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
      '2024-02-10T11:20:00Z'
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
      '2024-02-18T16:15:00Z'
    );
  END IF;
END;
$$; 