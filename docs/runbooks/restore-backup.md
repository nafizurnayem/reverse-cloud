# Runbook: Database Backup and Restore Drill

This runbook documents how to restore the PostgreSQL database from a backup, verify data integrity, and execute scheduled restore drills.

---

## 1. Backup Architecture

Reverse Cloud uses Supabase-managed Postgres on AWS (`aws-0-ap-southeast-1`):
- **Automated Daily Backups**: Managed by Supabase with retention period based on project tier.
- **Point-in-Time Recovery (PITR)**: Provides write-ahead-log (WAL) continuous replication for recovery to any second within the retention window.
- **Physical schema dumps**: Local schema snapshots via `supabase db dump`.

---

## 2. Recovery Procedures

### Scenario A: Supabase Dashboard PITR Restore (Production Incident)

1. Open **Supabase Dashboard → Project Settings → Database → Backups**.
2. Select **Point in Time Recovery (PITR)** or select the latest automated snapshot.
3. Choose the target restoration timestamp (just prior to corruption or erroneous drop/update).
4. Click **Restore Project**.
5. Once restored, note the temporary connection pause (typically 2–5 minutes).
6. Verify status:
   ```bash
   npx supabase@2.120.0 migration list --linked
   ```

### Scenario B: Logical Restore to Staging / Local Drill

To test recovery without affecting production or development databases:

1. **Export dump from source:**
   ```bash
   # Schema only:
   npx supabase@2.120.0 db dump --linked --file supabase/backup_schema_drill.sql

   # Data only (private tables, excludes auth/storage internal schemas):
   npx supabase@2.120.0 db dump --linked --data-only --file supabase/backup_data_drill.sql
   ```

2. **Restore into target database:**
   ```bash
   psql "$TARGET_DATABASE_URL" -f supabase/backup_schema_drill.sql
   psql "$TARGET_DATABASE_URL" -f supabase/backup_data_drill.sql
   ```

---

## 3. Post-Restore Verification Checklist

After any restore or restore drill, run these verification steps:

1. **Run migration status check:**
   Ensure all migrations from `0001` to `0025` are recognized:
   ```bash
   npx supabase@2.120.0 migration list --db-url "$DATABASE_URL"
   ```

2. **Run pgTAP database tests:**
   Confirm RLS policies, permissions, triggers, and functions are intact:
   ```bash
   npx supabase@2.120.0 test db --db-url "$DATABASE_URL"
   ```

3. **Check critical table row counts:**
   ```sql
   select
     (select count(*) from public.roles) as roles_count,
     (select count(*) from public.permissions) as permissions_count,
     (select count(*) from public.services) as services_count,
     (select count(*) from public.meeting_types) as meeting_types_count;
   ```

4. **Verify application health probe:**
   ```bash
   curl -i https://<APP_DOMAIN>/api/health
   # Must return HTTP 200 with "database": { "connected": true }
   ```

---

## 4. Scheduled Backup Restore Drill Procedure

Quarterly restore drill requirements:
1. Schedule drill during maintenance window or on a dedicated clone project.
2. Pull the latest production snapshot.
3. Restore onto the staging environment.
4. Execute `pnpm --filter web test` and `supabase test db`.
5. Log drill completion date, operator name, duration (RTO), and findings in `docs/runbooks/drill-log.md`.
