-- Migration: Add search_users_by_display_name function
-- Creates a helper RPC to search users by their display_name (case-insensitive partial match).
-- -------------------------------------------------------------------
-- NOTE: Adjust the timestamp in the filename if you need chronological ordering.

-- DROP the function if it already exists (helps with re-runs during local development)
DROP FUNCTION IF EXISTS public.search_users_by_display_name(text);

CREATE FUNCTION public.search_users_by_display_name(p_search_query text)
RETURNS TABLE(
    id uuid,
    display_name text,
    email text
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    current_user_id uuid := auth.uid();
    search_pattern text := '%' || p_search_query || '%';
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.display_name,
        u.email::TEXT
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.display_name ILIKE search_pattern
      AND p.id <> current_user_id;  -- Exclude caller
END;
$$;

-- Grant execution to regular app roles
GRANT ALL ON FUNCTION public.search_users_by_display_name(text) TO service_role;
GRANT ALL ON FUNCTION public.search_users_by_display_name(text) TO authenticated;

COMMENT ON FUNCTION public.search_users_by_display_name(p_search_query text)
IS 'Searches for users by display_name (case-insensitive partial match), joining profiles and auth.users, excluding the caller. Returns id, display_name, and email.'; 