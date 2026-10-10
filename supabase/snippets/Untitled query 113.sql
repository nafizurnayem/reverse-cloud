begin;
set local role authenticated;
insert into public.audit_log (action, entity_type) values ('insert', 'fake');
rollback;