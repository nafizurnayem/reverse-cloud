select extname from pg_extension
where extname in ('pgcrypto', 'citext', 'pg_trgm', 'vector', 'pg_cron')
order by extname;