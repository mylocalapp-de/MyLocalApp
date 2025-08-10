-- Add show_in_list column to profiles and RPC to fetch opted-in users

-- 1) Schema change: add column if not exists
alter table if exists public.profiles
  add column if not exists show_in_list boolean not null default false;

-- 2) RPC: get_public_users
create or replace function public.get_public_users(p_exclude_user_id uuid default null)
returns table (
  id uuid,
  display_name text,
  email text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.display_name,
         u.email,
         p.avatar_url
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(p.show_in_list, false) = true
    and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  order by p.display_name asc nulls last;
$$;

-- 3) Permissions: allow authenticated users to execute
grant execute on function public.get_public_users(uuid) to authenticated;

comment on column public.profiles.show_in_list is 'When true, user opts in to appear in the public DM directory.';
comment on function public.get_public_users(uuid) is 'Returns users who opted in (show_in_list = true). Optionally exclude a user id.';

