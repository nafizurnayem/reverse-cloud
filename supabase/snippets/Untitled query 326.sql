begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"715589fc-cf0f-40f0-bc50-658690c1c528","role":"authenticated"}', true);
select id, full_name from public.profiles;
select * from public.roles;
rollback;