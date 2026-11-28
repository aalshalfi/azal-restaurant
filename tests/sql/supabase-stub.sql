-- Minimal Supabase stand-in (NOT the real platform): roles, auth schema, auth.uid(), auth.users.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (instance_id uuid, id uuid primary key default gen_random_uuid(), aud varchar(255), role varchar(255), email varchar(255), encrypted_password varchar(255), email_confirmed_at timestamptz, raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb, phone text, banned_until timestamptz, last_sign_in_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid not null, provider_id text not null default 'stub', identity_data jsonb default '{}'::jsonb, provider text not null default 'email', last_sign_in_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create or replace function auth.email() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.email', true),'') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase default privileges: new public tables/functions are granted to client roles.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
