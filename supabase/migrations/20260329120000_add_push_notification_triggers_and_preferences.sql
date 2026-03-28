create extension if not exists pg_net with schema extensions;

alter table public.profiles
add column if not exists notification_preferences jsonb default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'Stores per-user notification settings used by push notification delivery.';

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own notification_preferences'
  ) then
    create policy "Users can update own notification_preferences"
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end
$$;

create or replace function public.notify_recipient_on_new_dm()
returns trigger
language plpgsql
security definer
set search_path = public, auth, net, extensions
as $$
declare
  recipient_user_id uuid;
  recipient_push_token text;
  sender_display_name text;
  payload jsonb;
  request_id bigint;
  secret_value constant text := 'mla-internal-2026-abc123';
  backend_url constant text := 'https://admin.mylocalapp.de/api/internal/notify-dm';
begin
  select dp.user_id
  into recipient_user_id
  from public.dm_participants dp
  where dp.conversation_id = new.conversation_id
    and dp.user_id <> new.sender_id
  limit 1;

  if recipient_user_id is null then
    select c.initiator_user_id
    into recipient_user_id
    from public.dm_conversations c
    where c.id = new.conversation_id
      and c.is_org_conversation = true
      and c.initiator_user_id is not null
      and c.initiator_user_id <> new.sender_id
    limit 1;
  end if;

  if recipient_user_id is null or recipient_user_id = new.sender_id then
    return new;
  end if;

  select pt.expo_push_token
  into recipient_push_token
  from public.push_tokens pt
  where pt.user_id = recipient_user_id
    and pt.expo_push_token is not null
  order by pt.updated_at desc nulls last, pt.created_at desc
  limit 1;

  if recipient_push_token is null then
    return new;
  end if;

  select coalesce(p.display_name, 'Jemand')
  into sender_display_name
  from public.profiles p
  where p.id = new.sender_id;

  payload := jsonb_build_object(
    'recipientUserId', recipient_user_id,
    'recipientPushToken', recipient_push_token,
    'senderUserId', new.sender_id,
    'senderDisplayName', coalesce(sender_display_name, 'Jemand'),
    'messageContent', coalesce(new.text, '[Bild]'),
    'conversationId', new.conversation_id
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
      raise warning '[notify_recipient_on_new_dm] failed for conversation %, sender %: %',
        new.conversation_id,
        new.sender_id,
        sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.notify_recipient_on_new_dm() is
  'Sends DM push notifications to the other participant via the admin backend.';

drop trigger if exists on_new_dm_notify on public.direct_messages;
create trigger on_new_dm_notify
  after insert on public.direct_messages
  for each row
  execute function public.notify_recipient_on_new_dm();

create or replace function public.notify_author_on_article_comment()
returns trigger
language plpgsql
security definer
set search_path = public, auth, net, extensions
as $$
declare
  article_author_id uuid;
  article_title text;
  article_author_push_token text;
  article_author_email text;
  commenter_display_name text;
  payload jsonb;
  request_id bigint;
  secret_value constant text := 'mla-internal-2026-abc123';
  backend_url constant text := 'https://admin.mylocalapp.de/api/internal/notify-article-comment';
begin
  select a.author_id, a.title
  into article_author_id, article_title
  from public.articles a
  where a.id = new.article_id;

  if article_author_id is null or article_author_id = new.user_id then
    return new;
  end if;

  select pt.expo_push_token
  into article_author_push_token
  from public.push_tokens pt
  where pt.user_id = article_author_id
    and pt.expo_push_token is not null
  order by pt.updated_at desc nulls last, pt.created_at desc
  limit 1;

  select u.email
  into article_author_email
  from auth.users u
  where u.id = article_author_id;

  if article_author_push_token is null and article_author_email is null then
    return new;
  end if;

  select coalesce(p.display_name, 'Ein Benutzer')
  into commenter_display_name
  from public.profiles p
  where p.id = new.user_id;

  payload := jsonb_build_object(
    'articleId', new.article_id,
    'articleAuthorId', article_author_id,
    'articleTitle', article_title,
    'commenterId', new.user_id,
    'commenterUserId', new.user_id,
    'commenterDisplayName', coalesce(commenter_display_name, 'Ein Benutzer'),
    'commentText', new.text,
    'commentId', new.id,
    'recipientPushToken', article_author_push_token,
    'recipientEmail', article_author_email
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
      raise warning '[notify_author_on_article_comment] failed for article %, comment %: %',
        new.article_id,
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.notify_author_on_article_comment() is
  'Sends article-comment notifications to the article author via the admin backend.';

drop trigger if exists on_article_comment_notify on public.article_comments;
create trigger on_article_comment_notify
  after insert on public.article_comments
  for each row
  execute function public.notify_author_on_article_comment();

create or replace function public.notify_users_on_new_article()
returns trigger
language plpgsql
security definer
set search_path = public, auth, net, extensions
as $$
declare
  author_display_name text;
  organization_name text;
  recipients_payload jsonb;
  payload jsonb;
  request_id bigint;
  secret_value constant text := 'mla-internal-2026-abc123';
  backend_url constant text := 'https://admin.mylocalapp.de/api/internal/notify-new-article';
begin
  select coalesce(p.display_name, 'Redaktion')
  into author_display_name
  from public.profiles p
  where p.id = new.author_id;

  if new.organization_id is not null then
    select o.name
    into organization_name
    from public.organizations o
    where o.id = new.organization_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', deduped_tokens.user_id,
        'pushToken', deduped_tokens.expo_push_token
      )
      order by deduped_tokens.token_timestamp desc
    ),
    '[]'::jsonb
  )
  into recipients_payload
  from (
    select latest_tokens.user_id, latest_tokens.expo_push_token, latest_tokens.token_timestamp
    from (
      select distinct on (pt.user_id)
        pt.user_id,
        pt.expo_push_token,
        coalesce(pt.updated_at, pt.created_at) as token_timestamp
      from public.push_tokens pt
      where pt.user_id is not null
        and pt.expo_push_token is not null
        and pt.user_id is distinct from new.author_id
      order by pt.user_id, coalesce(pt.updated_at, pt.created_at) desc
    ) latest_tokens
    order by latest_tokens.token_timestamp desc
    limit 100
  ) as deduped_tokens;

  if jsonb_array_length(recipients_payload) = 0 then
    return new;
  end if;

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
$$;

comment on function public.notify_users_on_new_article() is
  'Sends new-article notifications to users with registered push tokens via the admin backend.';

drop trigger if exists on_new_article_notify on public.articles;
create trigger on_new_article_notify
  after insert on public.articles
  for each row
  when (new.is_published = true)
  execute function public.notify_users_on_new_article();
