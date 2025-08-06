-- Migration: create app_config table and seed initial configuration values
create table if not exists public.app_config (
  key text primary key,
  value text not null
);

-- Seed default configuration values
insert into public.app_config (key, value) values
  ('REVENUECAT_API_KEY_ANDROID', 'goog_ikmtULTnDYzmpNgFkoqQduRlGgQ'),
  ('REVENUECAT_API_KEY_IOS', 'appl_pOtBuQxlHbwbqEFFNKVVgcFpilu'),
  ('EXPO_PUBLIC_DISABLE_CHAT', 'true'),
  ('EXPO_PUBLIC_DISABLE_DORFBOT', 'true'),
  ('EXPO_PUBLIC_DISABLE_MAP', 'true'),
  ('EXPO_PUBLIC_DISABLE_PREFERENCES', 'true'),
  ('EXPO_PUBLIC_ENABLE_ANDROID_IAP', 'true'),
  ('EXPO_PUBLIC_ENABLE_IOS_IAP', 'true')
  on conflict (key) do update set value = excluded.value;

-- Grant read-only access to client roles
grant select on table public.app_config to anon, authenticated;

-- Revoke insert/update/delete for safety (they are not granted by default, but be explicit)
revoke insert, update, delete on table public.app_config from anon, authenticated; 