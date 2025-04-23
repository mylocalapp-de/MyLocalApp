--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

-- <<< ADDED: Drop the old, redundant function >>>
DROP FUNCTION IF EXISTS public.find_or_create_dm_conversation(uuid);
-- <<< END ADDED >>>

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA _realtime;


ALTER SCHEMA _realtime OWNER TO supabase_admin;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: pgsodium; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA pgsodium;


ALTER SCHEMA pgsodium OWNER TO supabase_admin;

--
-- Name: pgsodium; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;


--
-- Name: EXTENSION pgsodium; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgsodium IS 'Pgsodium is a modern cryptography library for Postgres.';


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO supabase_admin;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: supabase_admin
--

COMMENT ON SCHEMA public IS '';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: supabase_functions; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA supabase_functions;


ALTER SCHEMA supabase_functions OWNER TO supabase_admin;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: EXTENSION pgjwt; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for Postgresql';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: postgres
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO postgres;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: postgres
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: postgres
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO postgres;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: postgres
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: postgres
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RAISE WARNING 'PgBouncer auth request: %', p_usename;

    RETURN QUERY
    SELECT usename::TEXT, passwd::TEXT FROM pg_catalog.pg_shadow
    WHERE usename = p_usename;
END;
$$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO postgres;

--
-- Name: create_new_organization(text); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.create_new_organization(org_name text) RETURNS TABLE(id uuid, name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid(); -- Get the currently authenticated user's ID
  _new_org_id uuid;
BEGIN
  -- Check if user is authenticated (should always be true if called via authenticated client)
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create an organization.';
  END IF;

  -- Insert the new organization
  INSERT INTO public.organizations (name, admin_id)
  VALUES (org_name, _user_id)
  RETURNING organizations.id INTO _new_org_id; -- Get the new ID

  -- Return the ID and name of the newly created org
  RETURN QUERY SELECT o.id, o.name FROM public.organizations o WHERE o.id = _new_org_id;
END;
$$;


ALTER FUNCTION public.create_new_organization(org_name text) OWNER TO supabase_admin;

--
-- Name: FUNCTION create_new_organization(org_name text); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.create_new_organization(org_name text) IS 'Creates a new organization, ensuring the creator is set as admin_id and added as the first admin member via trigger. SECURITY DEFINER bypasses INSERT RLS.';


--
-- Name: delete_event(uuid, uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.delete_event(p_event_id uuid, p_organizer_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  target_event record;
  is_member boolean;
BEGIN
  -- Get the event details
  SELECT * INTO target_event FROM public.events WHERE id = p_event_id;

  -- Check if event exists
  IF target_event IS NULL THEN
    RAISE WARNING 'Event not found: %', p_event_id;
    RETURN false;
  END IF;

  -- Authorization check:
  -- 1. Personal event: Check if p_organizer_id matches the event's organizer_id
  IF target_event.organization_id IS NULL THEN
    IF target_event.organizer_id != p_organizer_id THEN
      RAISE WARNING 'Permission denied: User % cannot delete personal event %', p_organizer_id, p_event_id;
      RETURN false; -- Not authorized
    END IF;
  -- 2. Organizational event: Check if p_organizer_id is a member of the organization
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members mem
      WHERE mem.user_id = p_organizer_id AND mem.organization_id = target_event.organization_id
    ) INTO is_member;

    IF NOT is_member THEN
       RAISE WARNING 'Permission denied: User % is not a member of organization % for event %', p_organizer_id, target_event.organization_id, p_event_id;
       RETURN false; -- Not authorized
    END IF;
  END IF;

  -- If authorized, delete the event
  -- RLS policies on DELETE might also apply, but this function provides explicit checks.
  -- Using SECURITY DEFINER bypasses RLS within the function execution if needed,
  -- but the initial permission check ensures only authorized users can execute it.
  DELETE FROM public.events WHERE id = p_event_id;

  -- Check if deletion was successful
  IF FOUND THEN
    RETURN true;
  ELSE
    -- This case might happen if the event was deleted between the SELECT and DELETE (race condition)
    RAISE WARNING 'Event % might have been deleted concurrently.', p_event_id;
    RETURN false;
  END IF;

EXCEPTION
    WHEN others THEN
        -- Log the error or handle it as needed
        RAISE WARNING 'Error deleting event %: %', p_event_id, SQLERRM;
        RETURN false;

END;
$$;


ALTER FUNCTION public.delete_event(p_event_id uuid, p_organizer_id uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION delete_event(p_event_id uuid, p_organizer_id uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.delete_event(p_event_id uuid, p_organizer_id uuid) IS 'Deletes an event after checking if the requesting user is authorized (either personal organizer or org member). Returns true on success, false on failure/permission denied.';


--
-- Name: delete_user_account(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.delete_user_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  target_user_id uuid := auth.uid();
  is_admin_in_org boolean;
BEGIN
  -- 1. Check if the user is an admin in any organization
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = target_user_id AND role = 'admin'
  ) INTO is_admin_in_org;

  IF is_admin_in_org THEN
    RAISE EXCEPTION 'User is an admin in one or more organizations. Please transfer admin rights before deleting the account.';
  END IF;

  -- 2. If not an admin anywhere, proceed with deletion
  -- Note: Deleting from auth.users requires the service_role key or specific privileges.
  -- This function will delete the profile and rely on CASCADE/SET NULL for related data.
  -- The final step of deleting the auth.users entry must be handled by a trusted backend/service role call.

  -- Delete the user's profile entry (this triggers cascades)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Explicitly delete memberships just in case (cascade should handle it)
  DELETE FROM public.organization_members WHERE user_id = target_user_id;

  -- Explicitly delete push subscriptions (cascade should handle it)
  DELETE FROM public.push_notification_subscriptions WHERE user_id = target_user_id;

  -- The actual deletion from auth.users needs to happen separately using a service role key.
  -- Example (run this from a secure backend context):
  -- supabase.auth.admin.deleteUser(target_user_id)

EXCEPTION
  WHEN raise_exception THEN
    -- Re-raise the specific exception for admin check failure
    RAISE EXCEPTION '%', SQLERRM;
  WHEN others THEN
    -- Log other errors and raise a generic failure message
    RAISE WARNING 'Error deleting user account %: %', target_user_id, SQLERRM;
    RAISE EXCEPTION 'Failed to delete user account due to an internal error.';
END;
$$;


ALTER FUNCTION public.delete_user_account() OWNER TO supabase_admin;

--
-- Name: FUNCTION delete_user_account(); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.delete_user_account() IS 'Deletes the calling users profile and associated data after checking they are not an admin in any organization. Does NOT delete the auth.users entry (requires service role).';


--
-- Name: find_or_create_dm_conversation(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.find_or_create_dm_conversation(p_other_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
BEGIN
  -- Check if p_other_user_id is the same as current_user_id
  IF p_other_user_id = current_user_id THEN
      RAISE EXCEPTION 'Cannot create a DM conversation with yourself.';
  END IF;

  -- Check if a conversation already exists between these two users
  SELECT p1.conversation_id INTO existing_conversation_id
  FROM public.dm_participants p1
  JOIN public.dm_participants p2 ON p1.conversation_id = p2.conversation_id
  WHERE p1.user_id = current_user_id AND p2.user_id = p_other_user_id
  LIMIT 1;

  -- If conversation exists, return its ID
  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;

  -- If not, create a new conversation and add participants
  -- Use SECURITY DEFINER to bypass RLS if needed for inserts, though separate inserts might be fine
  INSERT INTO public.dm_conversations (created_at, last_message_at) VALUES (now(), now()) RETURNING id INTO new_conversation_id;

  INSERT INTO public.dm_participants (conversation_id, user_id) VALUES (new_conversation_id, current_user_id);
  INSERT INTO public.dm_participants (conversation_id, user_id) VALUES (new_conversation_id, p_other_user_id);

  RETURN new_conversation_id;

EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error in find_or_create_dm_conversation: %', SQLERRM;
    RETURN NULL; -- Or re-raise the exception
END;
$$;


ALTER FUNCTION public.find_or_create_dm_conversation(p_other_user_id uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION find_or_create_dm_conversation(p_other_user_id uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.find_or_create_dm_conversation(p_other_user_id uuid) IS 'Finds an existing DM conversation between the current user and another user, or creates a new one if none exists. Returns the conversation ID.';


--
-- Name: find_or_create_org_dm_conversation(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.find_or_create_org_dm_conversation(p_organization_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_user_id       uuid := auth.uid(); -- Get the caller's ID
  existing_conversation   uuid;
  new_conversation        uuid;
BEGIN
  -- Check if the caller is actually a user
  IF current_user_id IS NULL THEN
     RAISE EXCEPTION 'User must be authenticated to initiate an Org DM.';
  END IF;

  -- Find existing conversation
  SELECT c.id
  INTO   existing_conversation
  FROM   public.dm_conversations c
  WHERE  c.is_org_conversation = true
    AND  c.organization_id     = p_organization_id
  LIMIT  1;

  IF existing_conversation IS NOT NULL THEN
    RETURN existing_conversation;
  END IF;

  -- Create new conversation and store the initiator
  INSERT INTO public.dm_conversations
         (created_at, last_message_at, is_org_conversation, organization_id, initiator_user_id) -- Added initiator
  VALUES (now(),      now(),          true,                p_organization_id, current_user_id)  -- Store caller's ID
  RETURNING id INTO new_conversation;

  RETURN new_conversation;
END;
$$;


ALTER FUNCTION public.find_or_create_org_dm_conversation(p_organization_id uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION find_or_create_org_dm_conversation(p_organization_id uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.find_or_create_org_dm_conversation(p_organization_id uuid) IS 'Finds an existing ORG DM conversation for the given organization or creates a new one, storing the initiator. Returns the conversation ID.';


--
-- Name: find_or_create_user_dm_conversation(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.find_or_create_user_dm_conversation(p_other_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_user_id        uuid := auth.uid();
  existing_conversation   uuid;
  new_conversation        uuid;
BEGIN
  IF p_other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot create a DM conversation with yourself.';
  END IF;

  SELECT p1.conversation_id
  INTO   existing_conversation
  FROM   public.dm_participants p1
  JOIN   public.dm_participants p2
       ON p1.conversation_id = p2.conversation_id
  JOIN   public.dm_conversations c
       ON p1.conversation_id = c.id
  WHERE  p1.user_id = current_user_id
    AND  p2.user_id = p_other_user_id
    AND  c.is_org_conversation = false
  LIMIT  1;

  IF existing_conversation IS NOT NULL THEN
    RETURN existing_conversation;
  END IF;

  INSERT INTO public.dm_conversations
         (created_at, last_message_at, is_org_conversation, organization_id, initiator_user_id) -- Added initiator
  VALUES (now(),      now(),          false,               NULL,              current_user_id) -- Store caller's ID
  RETURNING id INTO new_conversation;

  INSERT INTO public.dm_participants (conversation_id, user_id)
  VALUES (new_conversation, current_user_id),
         (new_conversation, p_other_user_id);

  RETURN new_conversation;
END;
$$;


ALTER FUNCTION public.find_or_create_user_dm_conversation(p_other_user_id uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION find_or_create_user_dm_conversation(p_other_user_id uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.find_or_create_user_dm_conversation(p_other_user_id uuid) IS 'Finds an existing USER-DM or creates a new one, storing the initiator. Returns the conversation ID.';


--
-- Name: format_date_german(date); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.format_date_german(date_value date) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$ BEGIN RETURN to_char(date_value, 'DD.MM.YYYY'); END; $$;


ALTER FUNCTION public.format_date_german(date_value date) OWNER TO supabase_admin;

--
-- Name: format_date_german(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.format_date_german(date_value timestamp with time zone) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$ BEGIN RETURN to_char(date_value, 'DD.MM.YYYY'); END; $$;


ALTER FUNCTION public.format_date_german(date_value timestamp with time zone) OWNER TO supabase_admin;

--
-- Name: format_time_german(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.format_time_german(time_value timestamp with time zone) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$ BEGIN RETURN to_char(time_value, 'HH24:MI'); END; $$;


ALTER FUNCTION public.format_time_german(time_value timestamp with time zone) OWNER TO supabase_admin;

--
-- Name: generate_unique_invite_code(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.generate_unique_invite_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE new_code TEXT; found BOOLEAN;
BEGIN
  LOOP
    new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE invite_code = new_code) INTO found;
    EXIT WHEN NOT found;
  END LOOP;
  RETURN new_code;
END;
$$;


ALTER FUNCTION public.generate_unique_invite_code() OWNER TO supabase_admin;

--
-- Name: FUNCTION generate_unique_invite_code(); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.generate_unique_invite_code() IS 'Generates a unique 8-character invite code.';


--
-- Name: get_article_reactions(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.get_article_reactions(article_uuid uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE reaction_counts JSON;
BEGIN
  SELECT json_object_agg(emoji, count) INTO reaction_counts
  FROM (
    SELECT emoji, count(*) as count
    FROM public.article_reactions
    WHERE article_id = article_uuid
    GROUP BY emoji
  ) as grouped_reactions;

  RETURN COALESCE(reaction_counts, '{}'::JSON); -- Return empty JSON object if no reactions
END;
$$;


ALTER FUNCTION public.get_article_reactions(article_uuid uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION get_article_reactions(article_uuid uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.get_article_reactions(article_uuid uuid) IS 'Retrieves the counts of each reaction emoji for a given article UUID.';


--
-- Name: get_event_attendees(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.get_event_attendees(event_uuid uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE attendee_json JSON;
BEGIN
  SELECT json_object_agg(status, count) INTO attendee_json
  FROM public.event_attendee_counts WHERE event_id = event_uuid;
  RETURN COALESCE(attendee_json, '{"attending": 0, "maybe": 0, "declined": 0}'::JSON);
END;
$$;


ALTER FUNCTION public.get_event_attendees(event_uuid uuid) OWNER TO supabase_admin;

--
-- Name: get_event_reactions(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.get_event_reactions(event_uuid uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE reaction_counts JSON;
BEGIN
  SELECT json_object_agg(emoji, count) INTO reaction_counts
  FROM (
    SELECT emoji, count(*) as count
    FROM public.event_reactions -- Querying event_reactions table
    WHERE event_id = event_uuid -- Using event_id column
    GROUP BY emoji
  ) as grouped_reactions;

  RETURN COALESCE(reaction_counts, '{}'::JSON); -- Return empty JSON object if no reactions
END;
$$;


ALTER FUNCTION public.get_event_reactions(event_uuid uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION get_event_reactions(event_uuid uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.get_event_reactions(event_uuid uuid) IS 'Retrieves the counts of each reaction emoji for a given event UUID.';


--
-- Name: get_organization_members_with_names(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.get_organization_members_with_names(p_organization_id uuid) RETURNS TABLE(user_id uuid, role text, display_name text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Ensure the CALLER is actually a member of the organization first
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
      RAISE EXCEPTION 'Access denied: User must be a member of the organization to view members.';
  END IF;

  -- If caller is a member, proceed to fetch members and join profiles
  -- The SECURITY DEFINER context allows bypassing RLS on profiles for this specific join
  RETURN QUERY
  SELECT
      mem.user_id,
      mem.role,
      COALESCE(prof.display_name, 'Unbekannt') AS display_name
  FROM public.organization_members mem
  LEFT JOIN public.profiles prof ON mem.user_id = prof.id
  WHERE mem.organization_id = p_organization_id;

END;
$$;


ALTER FUNCTION public.get_organization_members_with_names(p_organization_id uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION get_organization_members_with_names(p_organization_id uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.get_organization_members_with_names(p_organization_id uuid) IS 'Returns member list for an organization including display names. Checks caller membership first, then uses SECURITY DEFINER to bypass profile RLS for the name lookup.';


--
-- Name: get_organizations_with_members(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.get_organizations_with_members() RETURNS TABLE(id uuid, name text, logo_url text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    o.id,
    o.name,
    o.logo_url
  FROM public.organizations      o
  JOIN public.organization_members m
    ON o.id = m.organization_id;
END;
$$;


ALTER FUNCTION public.get_organizations_with_members() OWNER TO supabase_admin;

--
-- Name: FUNCTION get_organizations_with_members(); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.get_organizations_with_members() IS 'Returns all organizations that have at least one member.';


--
-- Name: get_reactions_for_messages(uuid[]); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.get_reactions_for_messages(message_ids uuid[]) RETURNS json
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  reaction_counts JSON;
BEGIN
  SELECT json_object_agg(
    grouped.message_id, grouped.emoji_counts
  ) INTO reaction_counts
  FROM (
    SELECT
      mr.message_id,
      json_object_agg(mr.emoji, mr.count) as emoji_counts
    FROM (
      -- Inner query to count emojis per message
      SELECT message_id, emoji, count(*) as count
      FROM public.message_reactions
      WHERE message_id = ANY(message_ids) -- Filter by the input array
      GROUP BY message_id, emoji
    ) as mr
    GROUP BY mr.message_id
  ) as grouped;

  RETURN COALESCE(reaction_counts, '{}'::JSON); -- Return empty JSON object if no reactions
END;
$$;


ALTER FUNCTION public.get_reactions_for_messages(message_ids uuid[]) OWNER TO supabase_admin;

--
-- Name: FUNCTION get_reactions_for_messages(message_ids uuid[]); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.get_reactions_for_messages(message_ids uuid[]) IS 'Retrieves the counts of each reaction emoji for a given list of message UUIDs, aggregated by message ID.';


--
-- Name: handle_new_organization(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.handle_new_organization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  original_replication_role TEXT;
  creator_id UUID := NEW.admin_id; -- Get the admin_id passed during INSERT
BEGIN
  -- Ensure creator_id is provided
  IF creator_id IS NULL THEN
     RAISE EXCEPTION 'Cannot create organization without an admin_id (creator).';
  END IF;

  original_replication_role := current_setting('session_replication_role', true);
  SET LOCAL session_replication_role = replica;

  -- Insert the creator as the first admin member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, creator_id, 'admin');

  EXECUTE format('SET LOCAL session_replication_role = %L', original_replication_role);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_organization() OWNER TO supabase_admin;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE 
  meta_display_name TEXT; 
  meta_preferences TEXT[];
  meta_is_temporary BOOLEAN; -- Declare variable for is_temporary
BEGIN
  -- Extract display_name (handle potential null)
  meta_display_name := NEW.raw_user_meta_data ->> 'display_name';

  -- Extract preferences (handle potential null or non-array)
  BEGIN
    IF jsonb_typeof(NEW.raw_user_meta_data -> 'preferences') = 'array' THEN
       SELECT array_agg(elem::TEXT) INTO meta_preferences
       FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'preferences') AS elem;
    ELSE 
       meta_preferences := '{}'; 
    END IF;
  EXCEPTION WHEN others THEN 
    meta_preferences := '{}'; 
  END;

  -- Extract is_temporary (handle potential null or non-boolean, default to false)
  BEGIN
    IF jsonb_typeof(NEW.raw_user_meta_data -> 'is_temporary') = 'boolean' THEN
      meta_is_temporary := (NEW.raw_user_meta_data ->> 'is_temporary')::BOOLEAN;
    ELSE
      meta_is_temporary := false; -- Default if not provided or wrong type
    END IF;
  EXCEPTION WHEN others THEN
    meta_is_temporary := false; -- Default on error
  END;

  -- Insert into profiles table
  INSERT INTO public.profiles (id, display_name, preferences, is_temporary)
  VALUES (
    NEW.id, 
    meta_display_name, 
    COALESCE(meta_preferences, '{}'), 
    meta_is_temporary -- Insert the extracted value
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO supabase_admin;

--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.is_org_member(_user_id uuid, _organization_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Check if a membership row exists for the given user and organization
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members mem
    WHERE mem.user_id = _user_id AND mem.organization_id = _organization_id
  );
END;
$$;


ALTER FUNCTION public.is_org_member(_user_id uuid, _organization_id uuid) OWNER TO supabase_admin;

--
-- Name: is_org_member_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.is_org_member_admin(_user_id uuid, _organization_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members mem
    WHERE mem.user_id = _user_id
      AND mem.organization_id = _organization_id
      AND mem.role = 'admin'
  );
END;
$$;


ALTER FUNCTION public.is_org_member_admin(_user_id uuid, _organization_id uuid) OWNER TO supabase_admin;

--
-- Name: match_documents(public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) RETURNS TABLE(id uuid, storage_path text, chunk_text text, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    ke.id,
    ke.storage_path,
    ke.chunk_text,
    1 - (ke.embedding <=> query_embedding) AS similarity -- Cosine similarity
  FROM public.knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold -- <=> is cosine distance, 1-distance = similarity
  ORDER BY similarity DESC
  LIMIT match_count;
$$;


ALTER FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) OWNER TO supabase_admin;

--
-- Name: FUNCTION match_documents(query_embedding public.vector, match_threshold double precision, match_count integer); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) IS 'Finds document chunks with embeddings similar to the query embedding.';


--
-- Name: search_users_by_email(text); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.search_users_by_email(p_search_query text) RETURNS TABLE(id uuid, display_name text, email text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  search_pattern text := '%' || p_search_query || '%';
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    u.email::TEXT -- Cast email to TEXT
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE
    u.email ILIKE search_pattern
    AND p.id != current_user_id; -- Exclude the current user
END;
$$;


ALTER FUNCTION public.search_users_by_email(p_search_query text) OWNER TO supabase_admin;

--
-- Name: FUNCTION search_users_by_email(p_search_query text); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.search_users_by_email(p_search_query text) IS 'Searches for users by email (case-insensitive partial match), joining profiles and auth.users, excluding the caller. Returns id, display_name, and email.';


--
-- Name: set_organization_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.set_organization_admin(p_organization_id uuid, p_new_admin_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_admin_id uuid;
  new_admin_exists boolean;
BEGIN
  -- 1. Verify the caller is the current admin
  SELECT user_id INTO current_admin_id
  FROM public.organization_members
  WHERE organization_id = p_organization_id AND role = 'admin'
  LIMIT 1;

  IF current_admin_id IS NULL OR current_admin_id <> current_user_id THEN
    RAISE EXCEPTION 'Permission denied: Only the current admin can transfer ownership.';
  END IF;

  -- 2. Verify the target user exists and is a member of the organization
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id AND user_id = p_new_admin_user_id
  ) INTO new_admin_exists;

  IF NOT new_admin_exists THEN
    RAISE EXCEPTION 'Target user is not a member of this organization.';
  END IF;

  -- 3. Verify the target user is not the current admin
  IF p_new_admin_user_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot transfer admin role to yourself.';
  END IF;

  -- 4. Perform the transfer within a transaction
  BEGIN
    -- Update current admin to member
    UPDATE public.organization_members
    SET role = 'member'
    WHERE organization_id = p_organization_id AND user_id = current_user_id;

    -- Update target user to admin
    UPDATE public.organization_members
    SET role = 'admin'
    WHERE organization_id = p_organization_id AND user_id = p_new_admin_user_id;

    -- Optional: Update the organizations table admin_id (if still used)
    -- UPDATE public.organizations SET admin_id = p_new_admin_user_id WHERE id = p_organization_id;

  EXCEPTION
    WHEN others THEN
      RAISE WARNING 'Error during admin transfer transaction: %', SQLERRM;
      RETURN false;
  END;

  RETURN true; -- Success

END;
$$;


ALTER FUNCTION public.set_organization_admin(p_organization_id uuid, p_new_admin_user_id uuid) OWNER TO supabase_admin;

--
-- Name: FUNCTION set_organization_admin(p_organization_id uuid, p_new_admin_user_id uuid); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.set_organization_admin(p_organization_id uuid, p_new_admin_user_id uuid) IS 'Transfers the admin role from the current admin (caller) to another member within the organization.';


--
-- Name: update_dm_conversation_last_message_at(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.update_dm_conversation_last_message_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.dm_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_dm_conversation_last_message_at() OWNER TO supabase_admin;

--
-- Name: FUNCTION update_dm_conversation_last_message_at(); Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON FUNCTION public.update_dm_conversation_last_message_at() IS 'Updates the last_message_at timestamp in dm_conversations when a new message is inserted.';


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  partition_name text;
BEGIN
  partition_name := 'messages_' || to_char(NOW(), 'YYYY_MM_DD');

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime'
    AND c.relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE realtime.%I PARTITION OF realtime.messages FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      NOW(),
      (NOW() + interval '1 day')::timestamp
    );
  END IF;

  INSERT INTO realtime.messages (payload, event, topic, private, extension)
  VALUES (payload, event, topic, private, 'broadcast');
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'::text),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
  v_order_by text;
  v_sort_order text;
begin
  case
    when sortcolumn = 'name' then
      v_order_by = 'name';
    when sortcolumn = 'updated_at' then
      v_order_by = 'updated_at';
    when sortcolumn = 'created_at' then
      v_order_by = 'created_at';
    when sortcolumn = 'last_accessed_at' then
      v_order_by = 'last_accessed_at';
    else
      v_order_by = 'name';
  end case;

  case
    when sortorder = 'asc' then
      v_sort_order = 'asc';
    when sortorder = 'desc' then
      v_sort_order = 'desc';
    else
      v_sort_order = 'asc';
  end case;

  v_order_by = v_order_by || ' ' || v_sort_order;

  return query execute
    'with folders as (
       select path_tokens[$1] as folder
       from storage.objects
         where objects.name ilike $2 || $3 || ''%''
           and bucket_id = $4
           and array_length(objects.path_tokens, 1) <> $1
       group by folder
       order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: supabase_functions_admin
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
  DECLARE
    request_id bigint;
    payload jsonb;
    url text := TG_ARGV[0]::text;
    method text := TG_ARGV[1]::text;
    headers jsonb DEFAULT '{}'::jsonb;
    params jsonb DEFAULT '{}'::jsonb;
    timeout_ms integer DEFAULT 1000;
  BEGIN
    IF url IS NULL OR url = 'null' THEN
      RAISE EXCEPTION 'url argument is missing';
    END IF;

    IF method IS NULL OR method = 'null' THEN
      RAISE EXCEPTION 'method argument is missing';
    END IF;

    IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
      headers = '{"Content-Type": "application/json"}'::jsonb;
    ELSE
      headers = TG_ARGV[2]::jsonb;
    END IF;

    IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
      params = '{}'::jsonb;
    ELSE
      params = TG_ARGV[3]::jsonb;
    END IF;

    IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
      timeout_ms = 1000;
    ELSE
      timeout_ms = TG_ARGV[4]::integer;
    END IF;

    CASE
      WHEN method = 'GET' THEN
        SELECT http_get INTO request_id FROM net.http_get(
          url,
          params,
          headers,
          timeout_ms
        );
      WHEN method = 'POST' THEN
        payload = jsonb_build_object(
          'old_record', OLD,
          'record', NEW,
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA
        );

        SELECT http_post INTO request_id FROM net.http_post(
          url,
          payload,
          params,
          headers,
          timeout_ms
        );
      ELSE
        RAISE EXCEPTION 'method argument % is invalid', method;
    END CASE;

    INSERT INTO supabase_functions.hooks
      (hook_table_id, hook_name, request_id)
    VALUES
      (TG_RELID, TG_NAME, request_id);

    RETURN NEW;
  END
$$;


ALTER FUNCTION supabase_functions.http_request() OWNER TO supabase_functions_admin;

--
-- Name: secrets_encrypt_secret_secret(); Type: FUNCTION; Schema: vault; Owner: supabase_admin
--

CREATE FUNCTION vault.secrets_encrypt_secret_secret() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
		BEGIN
		        new.secret = CASE WHEN new.secret IS NULL THEN NULL ELSE
			CASE WHEN new.key_id IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.secret, 'utf8'),
				pg_catalog.convert_to((new.id::text || new.description::text || new.created_at::text || new.updated_at::text)::text, 'utf8'),
				new.key_id::uuid,
				new.nonce
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;


ALTER FUNCTION vault.secrets_encrypt_secret_secret() OWNER TO supabase_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: extensions; Type: TABLE; Schema: _realtime; Owner: supabase_admin
--

CREATE TABLE _realtime.extensions (
    id uuid NOT NULL,
    type text,
    settings jsonb,
    tenant_external_id text,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


ALTER TABLE _realtime.extensions OWNER TO supabase_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: _realtime; Owner: supabase_admin
--

CREATE TABLE _realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE _realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: tenants; Type: TABLE; Schema: _realtime; Owner: supabase_admin
--

CREATE TABLE _realtime.tenants (
    id uuid NOT NULL,
    name text,
    external_id text,
    jwt_secret text,
    max_concurrent_users integer DEFAULT 200 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    max_events_per_second integer DEFAULT 100 NOT NULL,
    postgres_cdc_default text DEFAULT 'postgres_cdc_rls'::text,
    max_bytes_per_second integer DEFAULT 100000 NOT NULL,
    max_channels_per_client integer DEFAULT 100 NOT NULL,
    max_joins_per_second integer DEFAULT 500 NOT NULL,
    suspend boolean DEFAULT false,
    jwt_jwks jsonb,
    notify_private_alpha boolean DEFAULT false,
    private_only boolean DEFAULT false NOT NULL
);


ALTER TABLE _realtime.tenants OWNER TO supabase_admin;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;

--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: ai_drafts; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.ai_drafts (
    id bigint NOT NULL,
    draft_type text NOT NULL,
    title text,
    summary text,
    body_md text,
    event_start timestamp with time zone,
    event_end timestamp with time zone,
    address text,
    lat double precision,
    lon double precision,
    image_url text,
    source_doc_id bigint,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_drafts OWNER TO supabase_admin;

--
-- Name: COLUMN ai_drafts.draft_type; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.ai_drafts.draft_type IS 'Stores the suggested category for the draft, often matching an article_filter or event_category.';


--
-- Name: ai_drafts_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.ai_drafts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ai_drafts_id_seq OWNER TO supabase_admin;

--
-- Name: ai_drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.ai_drafts_id_seq OWNED BY public.ai_drafts.id;


--
-- Name: anonymous_push_subscriptions; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.anonymous_push_subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    chat_group_id uuid NOT NULL,
    expo_push_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.anonymous_push_subscriptions OWNER TO supabase_admin;

--
-- Name: TABLE anonymous_push_subscriptions; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.anonymous_push_subscriptions IS 'Stores anonymous (non-logged-in user) subscriptions to chat groups for push notifications.';


--
-- Name: COLUMN anonymous_push_subscriptions.expo_push_token; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.anonymous_push_subscriptions.expo_push_token IS 'The Expo push token for the specific app installation.';


--
-- Name: article_comments; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.article_comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    article_id uuid NOT NULL,
    user_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.article_comments OWNER TO supabase_admin;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    updated_at timestamp with time zone,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    preferences text[] DEFAULT '{}'::text[],
    avatar_url text, -- Add this line
    about_me text, -- Add this line
    is_temporary boolean DEFAULT false
);


ALTER TABLE public.profiles OWNER TO supabase_admin;

--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.profiles IS 'Stores public profile information for authenticated users.';

--
-- Name: COLUMN profiles.is_temporary; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.profiles.is_temporary IS 'Indicates if the account was created via the initial onboarding without a user-set password.';

--
-- Name: COLUMN profiles.about_me; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.profiles.about_me IS 'A short description about the user.';


--
-- Name: article_comments_with_users; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.article_comments_with_users AS
 SELECT c.id,
    c.article_id,
    c.text,
    c.user_id,
    COALESCE(p.display_name, 'Anonymous'::text) AS user_name,
    public.format_time_german(c.created_at) AS "time",
    c.created_at
   FROM (public.article_comments c
     LEFT JOIN public.profiles p ON ((c.user_id = p.id)))
  ORDER BY c.created_at;


ALTER TABLE public.article_comments_with_users OWNER TO supabase_admin;

--
-- Name: article_filters; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.article_filters (
    id integer NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0,
    is_admin_only boolean DEFAULT false,
    is_highlighted boolean DEFAULT false
);


ALTER TABLE public.article_filters OWNER TO supabase_admin;

--
-- Name: TABLE article_filters; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.article_filters IS 'Stores available filter categories for articles and their display order.';


--
-- Name: COLUMN article_filters.name; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.article_filters.name IS 'The unique name of the filter (e.g., Aktuell, Sport).';


--
-- Name: COLUMN article_filters.display_order; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.article_filters.display_order IS 'Order in which filters should be displayed.';


--
-- Name: COLUMN article_filters.is_admin_only; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.article_filters.is_admin_only IS 'If true, this filter is only assignable via database, not shown in create/edit UI.';


--
-- Name: COLUMN article_filters.is_highlighted; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.article_filters.is_highlighted IS 'If true, display this filter with a visual highlight.';


--
-- Name: article_filters_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.article_filters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.article_filters_id_seq OWNER TO supabase_admin;

--
-- Name: article_filters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.article_filters_id_seq OWNED BY public.article_filters.id;


--
-- Name: articles; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.articles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone DEFAULT now(),
    author_id uuid,
    organization_id uuid,
    is_published boolean DEFAULT true,
    image_url text,
    preview_image_url text
);


ALTER TABLE public.articles OWNER TO supabase_admin;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.organizations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    logo_url text,
    admin_id uuid,
    invite_code text DEFAULT public.generate_unique_invite_code(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.organizations OWNER TO supabase_admin;

--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.organizations IS 'Stores information about organizations (clubs, companies, etc.). The admin_id references the initial creator, but administration is managed via organization_members roles.';


--
-- Name: COLUMN organizations.invite_code; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.organizations.invite_code IS 'Unique, shareable code for users to join the organization.';


--
-- Name: article_listings; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.article_listings AS
 SELECT a.id,
    a.title,
    public.format_date_german(a.published_at) AS date,
    ("left"(a.content, 100) ||
        CASE
            WHEN (length(a.content) > 100) THEN '...'::text
            ELSE ''::text
        END) AS content,
    a.type,
    a.published_at,
    a.author_id,
    a.organization_id,
    a.image_url,
    a.preview_image_url,
    COALESCE(org.name, p.display_name, 'Redaktion'::text) AS author_name,
    (a.organization_id IS NOT NULL) AS is_organization_post
   FROM ((public.articles a
     LEFT JOIN public.profiles p ON ((a.author_id = p.id)))
     LEFT JOIN public.organizations org ON ((a.organization_id = org.id)))
  WHERE (a.is_published = true)
  ORDER BY a.published_at DESC;


ALTER TABLE public.article_listings OWNER TO supabase_admin;

--
-- Name: article_reactions; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.article_reactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    article_id uuid NOT NULL,
    user_id uuid,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.article_reactions OWNER TO supabase_admin;

--
-- Name: article_reaction_counts; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.article_reaction_counts AS
 SELECT article_reactions.article_id,
    article_reactions.emoji,
    count(*) AS count
   FROM public.article_reactions
  GROUP BY article_reactions.article_id, article_reactions.emoji;


ALTER TABLE public.article_reaction_counts OWNER TO supabase_admin;

--
-- Name: chat_groups; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.chat_groups (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    organization_id uuid,
    is_active boolean DEFAULT true,
    is_pinned boolean DEFAULT false
);


ALTER TABLE public.chat_groups OWNER TO supabase_admin;

--
-- Name: COLUMN chat_groups.is_pinned; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.chat_groups.is_pinned IS 'Indicates if the chat group should be pinned to the top of the list for all users.';


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    chat_group_id uuid NOT NULL,
    user_id uuid,
    text text,
    created_at timestamp with time zone DEFAULT now(),
    image_url text,
    CONSTRAINT text_or_image_check CHECK (((text IS NOT NULL) OR (image_url IS NOT NULL)))
);


ALTER TABLE public.chat_messages OWNER TO supabase_admin;

--
-- Name: COLUMN chat_messages.image_url; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.chat_messages.image_url IS 'URL of an image attached to the message.';


--
-- Name: CONSTRAINT text_or_image_check ON chat_messages; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON CONSTRAINT text_or_image_check ON public.chat_messages IS 'Ensures that every message has either text content or an image URL.';


--
-- Name: chat_group_listings; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.chat_group_listings AS
 WITH lastmessages AS (
         SELECT chat_messages.chat_group_id,
            chat_messages.text,
            chat_messages.created_at,
            chat_messages.user_id,
            row_number() OVER (PARTITION BY chat_messages.chat_group_id ORDER BY chat_messages.created_at DESC) AS rn
           FROM public.chat_messages
        )
 SELECT g.id,
    g.name,
    g.type,
    g.tags,
    g.organization_id,
    g.is_active,
    lm.text AS last_message,
    public.format_time_german(lm.created_at) AS last_message_time,
    lm.created_at AS last_message_timestamp,
    COALESCE(org.name, g.name) AS display_source,
        CASE
            WHEN ((g.type = 'broadcast'::text) AND (g.organization_id IS NOT NULL)) THEN COALESCE(org.name, 'Organisation'::text)
            ELSE COALESCE(sender_profile.display_name, 'System'::text)
        END AS last_message_sender_name,
    0 AS unread_count,
    g.is_pinned
   FROM (((public.chat_groups g
     LEFT JOIN lastmessages lm ON (((g.id = lm.chat_group_id) AND (lm.rn = 1))))
     LEFT JOIN public.organizations org ON ((g.organization_id = org.id)))
     LEFT JOIN public.profiles sender_profile ON ((lm.user_id = sender_profile.id)))
  WHERE ((g.is_active = true) AND (g.type <> 'bot'::text))
  ORDER BY g.is_pinned DESC, lm.created_at DESC NULLS LAST;


ALTER TABLE public.chat_group_listings OWNER TO supabase_admin;

--
-- Name: chat_group_tags; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.chat_group_tags (
    id integer NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0,
    is_admin_only boolean DEFAULT false,
    is_highlighted boolean DEFAULT false
);


ALTER TABLE public.chat_group_tags OWNER TO supabase_admin;

--
-- Name: TABLE chat_group_tags; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.chat_group_tags IS 'Stores available tags for chat groups and their display order.';


--
-- Name: COLUMN chat_group_tags.name; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.chat_group_tags.name IS 'The unique name of the tag (e.g., Kultur, Sport).';


--
-- Name: COLUMN chat_group_tags.display_order; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.chat_group_tags.display_order IS 'Order in which tags should be displayed.';


--
-- Name: COLUMN chat_group_tags.is_admin_only; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.chat_group_tags.is_admin_only IS 'If true, this tag is only assignable via database, not shown in create/edit UI.';


--
-- Name: COLUMN chat_group_tags.is_highlighted; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.chat_group_tags.is_highlighted IS 'If true, display this tag with a visual highlight.';


--
-- Name: chat_group_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.chat_group_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chat_group_tags_id_seq OWNER TO supabase_admin;

--
-- Name: chat_group_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.chat_group_tags_id_seq OWNED BY public.chat_group_tags.id;


--
-- Name: chat_messages_with_users; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.chat_messages_with_users AS
 SELECT m.id,
    m.chat_group_id,
    m.text,
    m.user_id,
        CASE
            WHEN ((g.type = 'broadcast'::text) AND (g.organization_id IS NOT NULL)) THEN COALESCE(org.name, 'Organisation'::text)
            ELSE COALESCE(p.display_name, 'Unbekannt'::text)
        END AS sender,
    public.format_time_german(m.created_at) AS "time",
    m.created_at,
    g.type AS group_type,
    g.organization_id,
    m.image_url
   FROM (((public.chat_messages m
     LEFT JOIN public.profiles p ON ((m.user_id = p.id)))
     LEFT JOIN public.chat_groups g ON ((m.chat_group_id = g.id)))
     LEFT JOIN public.organizations org ON ((g.organization_id = org.id)))
  ORDER BY m.created_at;


ALTER TABLE public.chat_messages_with_users OWNER TO supabase_admin;

--
-- Name: content_sources; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.content_sources (
    id bigint NOT NULL,
    label text NOT NULL,
    kind text NOT NULL,
    url text NOT NULL,
    polling_interval interval DEFAULT '24:00:00'::interval NOT NULL,
    last_checked_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT content_sources_kind_check CHECK ((kind = ANY (ARRAY['rss'::text, 'url'::text, 'opendata'::text, 'image_url'::text])))
);


ALTER TABLE public.content_sources OWNER TO supabase_admin;

--
-- Name: content_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.content_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.content_sources_id_seq OWNER TO supabase_admin;

--
-- Name: content_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.content_sources_id_seq OWNED BY public.content_sources.id;


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    text text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT direct_messages_check CHECK (((text IS NOT NULL) OR (image_url IS NOT NULL)))
);


ALTER TABLE public.direct_messages OWNER TO supabase_admin;

--
-- Name: TABLE direct_messages; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.direct_messages IS 'Stores individual messages within a direct message conversation.';


--
-- Name: COLUMN direct_messages.sender_id; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.direct_messages.sender_id IS 'The user who sent the message.';


--
-- Name: dm_conversations; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.dm_conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_message_at timestamp with time zone DEFAULT now(),
    is_org_conversation boolean DEFAULT false NOT NULL,
    organization_id uuid,
    initiator_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- <<< ADDED
    CONSTRAINT org_conversation_link CHECK ((((is_org_conversation = true) AND (organization_id IS NOT NULL)) OR ((is_org_conversation = false) AND (organization_id IS NULL))))
);


ALTER TABLE public.dm_conversations OWNER TO supabase_admin;

--
-- Name: TABLE dm_conversations; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.dm_conversations IS 'Represents a direct message conversation thread between users or between a user and an organization.';


--
-- Name: COLUMN dm_conversations.last_message_at; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.dm_conversations.last_message_at IS 'Timestamp of the last message sent in this conversation, used for sorting.';


--
-- Name: COLUMN dm_conversations.is_org_conversation; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.dm_conversations.is_org_conversation IS 'True if this is a conversation with an organization, false if between two users.';


--
-- Name: COLUMN dm_conversations.organization_id; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.dm_conversations.organization_id IS 'The organization ID if is_org_conversation is true.';

--
-- Name: COLUMN dm_conversations.initiator_user_id; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.dm_conversations.initiator_user_id IS 'The user who initiated this conversation (relevant for Org DMs started by users).'; -- <<< ADDED

--
-- Name: CONSTRAINT org_conversation_link ON dm_conversations; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON CONSTRAINT org_conversation_link ON public.dm_conversations IS 'Ensures organization_id is set if and only if is_org_conversation is true.';


--
-- Name: dm_participants; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.dm_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL
);


ALTER TABLE public.dm_participants OWNER TO supabase_admin;

--
-- Name: TABLE dm_participants; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.dm_participants IS 'Links users to their direct message conversations (only for user-to-user DMs).';


--
-- Name: dm_conversation_list; Type: VIEW; Schema: public; Owner: supabase_admin
--

DROP VIEW IF EXISTS public.dm_conversation_list;
CREATE OR REPLACE VIEW public.dm_conversation_list
WITH (security_invoker=false) -- <<< ADDED THIS LINE
AS
 WITH latestmessages AS (
         SELECT dm.conversation_id,
            dm.sender_id,
            dm.text,
            dm.image_url,
            dm.created_at,
            row_number() OVER (PARTITION BY dm.conversation_id ORDER BY dm.created_at DESC) AS rn
           FROM public.direct_messages dm
        )
 SELECT c.id AS conversation_id,
    c.is_org_conversation,
    c.organization_id,
    p_other.user_id AS other_user_id,
    prof_other.display_name AS target_name,
    c.initiator_user_id AS initiator_id, -- Use the direct column
    lm.text AS last_message_text,
    lm.image_url AS last_message_image_url,
    lm.created_at AS last_message_created_at,
    public.format_time_german(lm.created_at) AS last_message_time,
    lm.sender_id AS last_message_sender_id,
        CASE
            WHEN (lm.sender_id = p_current.user_id) THEN prof_current.display_name
            ELSE prof_sender.display_name
        END AS last_message_sender_name,
    c.last_message_at
   FROM ((((((public.dm_conversations c
     JOIN public.dm_participants p_current ON (((c.id = p_current.conversation_id) AND (p_current.user_id = auth.uid()))))
     JOIN public.dm_participants p_other ON (((c.id = p_other.conversation_id) AND (p_other.user_id <> auth.uid()))))
     JOIN public.profiles prof_current ON ((p_current.user_id = prof_current.id)))
     JOIN public.profiles prof_other ON ((p_other.user_id = prof_other.id)))
     LEFT JOIN latestmessages lm ON (((c.id = lm.conversation_id) AND (lm.rn = 1))))
     LEFT JOIN public.profiles prof_sender ON ((lm.sender_id = prof_sender.id)))
  WHERE (NOT c.is_org_conversation)
UNION ALL
 SELECT c.id AS conversation_id,
    c.is_org_conversation,
    c.organization_id,
    NULL::uuid AS other_user_id,
    org.name AS target_name,
    c.initiator_user_id AS initiator_id, -- Use the direct column
    lm.text AS last_message_text,
    lm.image_url AS last_message_image_url,
    lm.created_at AS last_message_created_at,
    public.format_time_german(lm.created_at) AS last_message_time,
    lm.sender_id AS last_message_sender_id,
        CASE
            WHEN (lm.sender_id IS NULL) THEN org.name
            ELSE COALESCE(prof_sender.display_name, 'Unbekannt'::text)
        END AS last_message_sender_name,
    c.last_message_at
   FROM (((public.dm_conversations c
     JOIN public.organizations org ON ((c.organization_id = org.id)))
     LEFT JOIN latestmessages lm ON (((c.id = lm.conversation_id) AND (lm.rn = 1))))
     LEFT JOIN public.profiles prof_sender ON ((lm.sender_id = prof_sender.id)))
  WHERE c.is_org_conversation;


ALTER TABLE public.dm_conversation_list OWNER TO supabase_admin;

--
-- Name: VIEW dm_conversation_list; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON VIEW public.dm_conversation_list IS 'Lists active DM conversations (user-to-user and user-to-org) for the logged-in user, including target name, initiator (from dm_conversations table), and last message details. Uses security_invoker=false.'; -- <<< UPDATED COMMENT

-- Grant necessary permissions on the view again (might be needed after recreation)
GRANT SELECT ON public.dm_conversation_list TO authenticated;
GRANT SELECT ON public.dm_conversation_list TO service_role;


--
-- Name: draft_images; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.draft_images (
    id bigint NOT NULL,
    draft_id bigint,
    url text NOT NULL,
    alt_text text,
    embedding public.vector(1536)
);


ALTER TABLE public.draft_images OWNER TO supabase_admin;

--
-- Name: draft_images_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.draft_images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.draft_images_id_seq OWNER TO supabase_admin;

--
-- Name: draft_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.draft_images_id_seq OWNED BY public.draft_images.id;


--
-- Name: event_attendees; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.event_attendees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT event_attendees_status_check CHECK ((status = ANY (ARRAY['attending'::text, 'maybe'::text, 'declined'::text])))
);


ALTER TABLE public.event_attendees OWNER TO supabase_admin;

--
-- Name: event_attendee_counts; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.event_attendee_counts AS
 SELECT event_attendees.event_id,
    event_attendees.status,
    count(*) AS count
   FROM public.event_attendees
  GROUP BY event_attendees.event_id, event_attendees.status;


ALTER TABLE public.event_attendee_counts OWNER TO supabase_admin;

--
-- Name: event_attendees_with_users; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.event_attendees_with_users AS
 SELECT a.id,
    a.event_id,
    a.user_id,
    a.status,
    COALESCE(p.display_name, 'Unbekannt'::text) AS user_name,
    a.created_at
   FROM (public.event_attendees a
     LEFT JOIN public.profiles p ON ((a.user_id = p.id)))
  ORDER BY a.created_at;


ALTER TABLE public.event_attendees_with_users OWNER TO supabase_admin;

--
-- Name: event_categories; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.event_categories (
    id integer NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0,
    is_admin_only boolean DEFAULT false,
    is_highlighted boolean DEFAULT false
);


ALTER TABLE public.event_categories OWNER TO supabase_admin;

--
-- Name: TABLE event_categories; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.event_categories IS 'Stores available categories for events and their display order.';


--
-- Name: COLUMN event_categories.name; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.event_categories.name IS 'The unique name of the category (e.g., Kultur, Sport).';


--
-- Name: COLUMN event_categories.display_order; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.event_categories.display_order IS 'Order in which categories should be displayed.';


--
-- Name: COLUMN event_categories.is_admin_only; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.event_categories.is_admin_only IS 'If true, this category is only assignable via database, not shown in create/edit UI.';


--
-- Name: COLUMN event_categories.is_highlighted; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.event_categories.is_highlighted IS 'If true, display this category with a visual highlight.';


--
-- Name: event_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.event_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.event_categories_id_seq OWNER TO supabase_admin;

--
-- Name: event_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: supabase_admin
--

ALTER SEQUENCE public.event_categories_id_seq OWNED BY public.event_categories.id;


--
-- Name: event_comments; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.event_comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_comments OWNER TO supabase_admin;

--
-- Name: event_comments_with_users; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.event_comments_with_users AS
 SELECT c.id,
    c.event_id,
    c.text,
    c.user_id,
    COALESCE(p.display_name, 'Anonymous'::text) AS user_name,
    public.format_time_german(c.created_at) AS "time",
    c.created_at
   FROM (public.event_comments c
     LEFT JOIN public.profiles p ON ((c.user_id = p.id)))
  ORDER BY c.created_at;


ALTER TABLE public.event_comments_with_users OWNER TO supabase_admin;

--
-- Name: events; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    date date,
    "time" text,
    end_time text,
    location text,
    category text,
    image_url text,
    organizer_id uuid,
    organization_id uuid,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    recurrence_rule text,
    recurrence_end_date date
);


ALTER TABLE public.events OWNER TO supabase_admin;

--
-- Name: COLUMN events.recurrence_rule; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.events.recurrence_rule IS 'iCalendar RRULE string defining the recurrence pattern.';


--
-- Name: COLUMN events.recurrence_end_date; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.events.recurrence_end_date IS 'The date when the recurrence stops.';


--
-- Name: event_listings; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.event_listings AS
 SELECT e.id,
    e.title,
    e.description,
    e.date,
    public.format_date_german(e.date) AS formatted_date,
    e."time",
    e.end_time,
    e.location,
    e.category,
    e.image_url,
    e.organizer_id,
    e.organization_id,
    e.recurrence_rule,
    e.recurrence_end_date,
    COALESCE(org.name, p.display_name, 'Redaktion'::text) AS organizer_name,
    (e.organization_id IS NOT NULL) AS is_organization_event,
    ( SELECT public.get_event_attendees(e.id) AS get_event_attendees) AS attendees
   FROM ((public.events e
     LEFT JOIN public.profiles p ON ((e.organizer_id = p.id)))
     LEFT JOIN public.organizations org ON ((e.organization_id = org.id)))
  WHERE (e.is_published = true);


ALTER TABLE public.event_listings OWNER TO supabase_admin;

--
-- Name: event_reactions; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.event_reactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_reactions OWNER TO supabase_admin;

--
-- Name: event_reaction_counts; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.event_reaction_counts AS
 SELECT event_reactions.event_id,
    event_reactions.emoji,
    count(*) AS count
   FROM public.event_reactions
  GROUP BY event_reactions.event_id, event_reactions.emoji;


ALTER TABLE public.event_reaction_counts OWNER TO supabase_admin;

--
-- Name: knowledge_embeddings; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.knowledge_embeddings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    storage_path text NOT NULL,
    chunk_text text NOT NULL,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_embeddings OWNER TO supabase_admin;

--
-- Name: TABLE knowledge_embeddings; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.knowledge_embeddings IS 'Stores text chunks from knowledge base documents and their vector embeddings for RAG.';


--
-- Name: COLUMN knowledge_embeddings.storage_path; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.knowledge_embeddings.storage_path IS 'Path to the original file in the knowledge storage bucket.';


--
-- Name: COLUMN knowledge_embeddings.embedding; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.knowledge_embeddings.embedding IS 'Vector embedding generated from chunk_text (e.g., using OpenAI).';


--
-- Name: map_config; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.map_config (
    id integer DEFAULT 1 NOT NULL,
    initial_latitude numeric NOT NULL,
    initial_longitude numeric NOT NULL,
    initial_latitude_delta numeric NOT NULL,
    initial_longitude_delta numeric NOT NULL,
    map_filters text[] DEFAULT ARRAY['Alle'::text],
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT map_config_singleton CHECK ((id = 1))
);


ALTER TABLE public.map_config OWNER TO supabase_admin;

--
-- Name: TABLE map_config; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.map_config IS 'Stores global map configuration like initial view and filters. Only one row allowed.';


--
-- Name: map_pois; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.map_pois (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organization_id uuid,
    author_id uuid
);


ALTER TABLE public.map_pois OWNER TO supabase_admin;

--
-- Name: TABLE map_pois; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.map_pois IS 'Stores Points of Interest (POIs) for the map.';


--
-- Name: COLUMN map_pois.organization_id; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.map_pois.organization_id IS 'Link to the organization this POI belongs to (if any).';


--
-- Name: COLUMN map_pois.author_id; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.map_pois.author_id IS 'The user who created this POI.';


--
-- Name: message_comments; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.message_comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.message_comments OWNER TO supabase_admin;

--
-- Name: message_comments_with_users; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.message_comments_with_users AS
 SELECT c.id,
    c.message_id,
    c.text,
    c.user_id,
    COALESCE(p.display_name, 'Anonymous'::text) AS sender,
    public.format_time_german(c.created_at) AS "time",
    c.created_at
   FROM (public.message_comments c
     LEFT JOIN public.profiles p ON ((c.user_id = p.id)))
  ORDER BY c.created_at;


ALTER TABLE public.message_comments_with_users OWNER TO supabase_admin;

--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.message_reactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.message_reactions OWNER TO supabase_admin;

--
-- Name: message_reaction_counts; Type: VIEW; Schema: public; Owner: supabase_admin
--

CREATE VIEW public.message_reaction_counts AS
 SELECT message_reactions.message_id,
    message_reactions.emoji,
    count(*) AS count
   FROM public.message_reactions
  GROUP BY message_reactions.message_id, message_reactions.emoji;


ALTER TABLE public.message_reaction_counts OWNER TO supabase_admin;

--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.organization_members (
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


ALTER TABLE public.organization_members OWNER TO supabase_admin;

--
-- Name: TABLE organization_members; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.organization_members IS 'Links users (profiles) to organizations and defines their role.';


--
-- Name: organization_vouchers; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.organization_vouchers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    expires_at timestamp with time zone,
    user_id uuid
);


ALTER TABLE public.organization_vouchers OWNER TO supabase_admin;

--
-- Name: TABLE organization_vouchers; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.organization_vouchers IS 'Stores single-use voucher codes for creating organizations.';


--
-- Name: COLUMN organization_vouchers.code; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.organization_vouchers.code IS 'The unique voucher code.';


--
-- Name: COLUMN organization_vouchers.is_used; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.organization_vouchers.is_used IS 'Whether the voucher has been redeemed.';


--
-- Name: COLUMN organization_vouchers.used_at; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.organization_vouchers.used_at IS 'Timestamp when the voucher was redeemed.';


--
-- Name: COLUMN organization_vouchers.expires_at; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.organization_vouchers.expires_at IS 'Optional expiration date for the voucher.';


--
-- Name: COLUMN organization_vouchers.user_id; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.organization_vouchers.user_id IS 'The ID of the user who redeemed the voucher.';


--
-- Name: pinned_articles; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.pinned_articles (
    filter_name text NOT NULL,
    article_id uuid NOT NULL,
    pinned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pinned_articles OWNER TO supabase_admin;

--
-- Name: TABLE pinned_articles; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON TABLE public.pinned_articles IS 'Associates articles with specific filters to mark them as pinned.';


--
-- Name: pipeline_runs; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.pipeline_runs (
    id bigint NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    phase text,
    status text NOT NULL,
    log text,
    CONSTRAINT pipeline_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text])))
);


ALTER TABLE public.pipeline_runs OWNER TO supabase_admin;

-- END: Add push_tokens table and related objects

-- Grants on push_tokens table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO authenticated;
GRANT ALL ON TABLE public.push_tokens TO service_role;

-- Explicitly grant schema usage (usually default, but added for safety)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- RLS Policies for push_tokens table
-- Ensure RLS is enabled on the table in the Supabase UI!

-- Drop existing policies first to avoid conflicts (optional but safer)
DROP POLICY IF EXISTS "Allow service_role full access" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow anonymous users to view their token" ON public.push_tokens; -- Not strictly needed, covered by user policy
DROP POLICY IF EXISTS "Allow users to manage their own token" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow anonymous update if already anonymous" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow anonymous update to disassociate token" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow anonymous delete" ON public.push_tokens;
-- Drop potentially misconfigured policies seen in screenshot (adjust names if needed)
DROP POLICY IF EXISTS "Allow anonymous users to insert their token" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow authenticated users to insert their token" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow users to delete their token" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow users to disassociate token (logout)" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow users to update their own token or claim anonymous token" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow users to view their token" ON public.push_tokens;

-- Allow service_role full access (needed for sending notifications from backend)
CREATE POLICY "Allow service_role full access" ON public.push_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow users to manage the token associated with their user_id (covers SELECT, INSERT, UPDATE, DELETE)
-- This handles logged-in users inserting, updating, deleting their token, and claiming an existing anonymous token via UPSERT.
CREATE POLICY "Allow users to manage their own token" ON public.push_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow anonymous users to insert a new token (user_id must be NULL)
CREATE POLICY "Allow anonymous insert" ON public.push_tokens
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Allow anonymous users to update a token ONLY IF the result is user_id = NULL
-- This handles keeping an anonymous token anonymous, OR disassociating a token on logout.
CREATE POLICY "Allow anonymous update to null user_id" ON public.push_tokens
  FOR UPDATE
  TO anon
  USING (true) -- Needs to be able to target any row for the disassociate case
  WITH CHECK (user_id IS NULL);

-- Allow anonymous users to delete a token ONLY IF user_id IS NULL
CREATE POLICY "Allow anonymous delete" ON public.push_tokens
  FOR DELETE
  TO anon
  USING (user_id IS NULL);
