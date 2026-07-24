-- Allow service-created organizations (e.g. admin-panel inserts) without an app-profile creator.
-- App-auth flows still pass admin_id and continue to get an automatic first admin membership.

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  original_replication_role TEXT;
  creator_id UUID := NEW.admin_id;
BEGIN
  IF creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  original_replication_role := current_setting('session_replication_role', true);
  SET LOCAL session_replication_role = replica;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, creator_id, 'admin');

  EXECUTE format('SET LOCAL session_replication_role = %L', original_replication_role);
  RETURN NEW;
END;
$function$;
