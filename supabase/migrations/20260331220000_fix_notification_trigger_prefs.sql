-- Fix notify_users_on_new_article() to respect notification_preferences.
-- Previously it sent push notifications to ALL users with push tokens.
-- Now it filters recipients based on their notification_preferences JSONB:
--   - Normal articles: check filter_<articleType> = 'true'
--   - Org articles: check org_articles = 'true' (master) OR org_articles_<uuid> = 'true' (per-org)

create or replace function public.notify_users_on_new_article()
returns trigger
language plpgsql
security definer
set search_path = public, auth, net, extensions
as $fn$
declare
  author_display_name text;
  organization_name text;
  recipients_payload jsonb;
  payload jsonb;
  request_id bigint;
  pref_key text;
  secret_value constant text := 'mla-internal-2026-abc123';
  backend_url constant text := 'https://admin.mylocalapp.de/api/internal/notify-new-article';
begin
  -- Resolve author display name
  select coalesce(p.display_name, 'Redaktion')
  into author_display_name
  from public.profiles p
  where p.id = new.author_id;

  -- Resolve organization name if org article
  if new.organization_id is not null then
    select o.name
    into organization_name
    from public.organizations o
    where o.id = new.organization_id;
  end if;

  -- Map article type to preference key for non-org articles
  pref_key := case new.type
    when 'aktuell'          then 'filter_aktuell'
    when 'schwarzes_brett'   then 'filter_schwarzes_brett'
    when 'mitfahrboerse'     then 'filter_mitfahrboerse'
    when 'veranstaltungen'   then 'filter_veranstaltungen'
    when 'hilfe'             then 'filter_hilfe'
    when 'dorfschnack'       then 'filter_dorfschnack'
    else null
  end;

  -- Build recipients list, filtering by notification preferences
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', deduped.user_id,
        'pushToken', deduped.expo_push_token
      )
      order by deduped.token_timestamp desc
    ),
    '[]'::jsonb
  )
  into recipients_payload
  from (
    select lt.user_id, lt.expo_push_token, lt.token_timestamp
    from (
      select distinct on (pt.user_id)
        pt.user_id,
        pt.expo_push_token,
        coalesce(pt.updated_at, pt.created_at) as token_timestamp
      from public.push_tokens pt
      join public.profiles prof on prof.id = pt.user_id
      where pt.user_id is not null
        and pt.expo_push_token is not null
        and pt.user_id is distinct from new.author_id
        and (
          case
            -- Organization article: user must have master OR per-org toggle enabled
            when new.organization_id is not null then
              coalesce(prof.notification_preferences->>'org_articles', 'false') = 'true'
              or coalesce(
                prof.notification_preferences->>('org_articles_' || new.organization_id::text),
                'false'
              ) = 'true'
            -- Normal article with known type: check type-specific filter
            when pref_key is not null then
              coalesce(prof.notification_preferences->>pref_key, 'false') = 'true'
            -- Unknown article type: skip
            else false
          end
        )
      order by pt.user_id, coalesce(pt.updated_at, pt.created_at) desc
    ) lt
    order by lt.token_timestamp desc
    limit 100
  ) as deduped;

  -- Nothing to send
  if jsonb_array_length(recipients_payload) = 0 then
    return new;
  end if;

  -- Build and send payload
  payload := jsonb_build_object(
    'articleId', new.id,
    'articleTitle', new.title,
    'articleType', new.type,
    'organizationId', new.organization_id,
    'organizationName', organization_name,
    'authorId', new.author_id,
    'authorDisplayName', coalesce(author_display_name, 'Redaktion'),
    'recipients', recipients_payload
  );

  begin
    select net.http_post(
      url := backend_url,
      body := payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Internal-Secret', secret_value
      ),
      timeout_milliseconds := 5000
    )
    into request_id;
  exception
    when others then
      raise warning '[notify_users_on_new_article] failed for article %: %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$fn$;

comment on function public.notify_users_on_new_article() is
  'Sends new-article notifications filtered by user notification_preferences via the admin backend.';
