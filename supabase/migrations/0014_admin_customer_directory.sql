-- 0014 T-08: admin-only customer directory email read.
-- The browser cannot read auth.users. This narrowly scoped definer returns only the approved directory fields.
-- No auth metadata, password data, tokens, providers or other auth.users columns are exposed.
begin;

create or replace function public.azal_admin_customer_directory()
returns table (
  user_id uuid,
  display_name text,
  phone text,
  email text,
  member_number bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $azal_admin_customer_directory$
begin
  if auth.uid() is null or not public.azal_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select p.id, p.display_name, p.phone, u.email::text, p.member_number, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.anonymized_at is null
      and not exists (
        select 1 from public.user_roles r
        where r.user_id = p.id and r.role in ('admin', 'staff')
      )
    order by p.created_at desc, p.id desc;
end;
$azal_admin_customer_directory$;

revoke all on function public.azal_admin_customer_directory() from public, anon, authenticated;
grant execute on function public.azal_admin_customer_directory() to authenticated;
comment on function public.azal_admin_customer_directory() is
  'T-08: returns only non-anonymized customer directory fields to authenticated admins; checks azal_is_admin internally.';

commit;
