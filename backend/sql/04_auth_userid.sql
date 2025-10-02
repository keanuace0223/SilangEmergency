-- Requires extension pgcrypto for crypt() and gen_salt
create extension if not exists pgcrypto;

-- login_with_userid(userid text, password text)
-- Returns the user row if password matches; otherwise raises error
create or replace function public.login_with_userid(p_userid text, p_password text)
returns users
language plpgsql
security definer
as $$
declare
  u users;
begin
  select * into u from users where userid = p_userid;
  if not found then
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;

  -- If password_hash present use crypt; otherwise reject
  if u.password_hash is null then
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;

  if crypt(p_password, u.password_hash) = u.password_hash then
    return u;
  else
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;
end;
$$;

-- Expose via PostgREST RPC and allow anonymous to call (no RLS bypass)
grant execute on function public.login_with_userid(text, text) to anon;

