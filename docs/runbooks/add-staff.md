# Add or remove staff

Only an authorized administrator performs this procedure. Confirm the person's
work email, manager approval and least-privileged role. The person must sign in
once so `auth.users` contains the account.

Resolve the IDs, then add the role in a transaction:

```sql
select id, email from auth.users where lower(email) = lower('<WORK_EMAIL>');
select id, key from public.roles order by key;

begin;
insert into public.staff_roles (user_id, role_id)
select u.id, r.id from auth.users u cross join public.roles r
where lower(u.email) = lower('<WORK_EMAIL>') and r.key = '<ROLE_KEY>'
on conflict (user_id, role_id) do nothing;
commit;
```

After a fresh login, verify `/en/admin` and each permission granted by the role.
Never give a human the `service_role` claim or seed a shared production
password.

For offboarding, delete the person's `staff_roles` rows, revoke active Supabase
sessions and provider/deployment access, rotate credentials they could read,
and verify `is_staff()` returns false. Preserve required audit records.
