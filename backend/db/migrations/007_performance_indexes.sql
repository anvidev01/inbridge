-- ============================================================
-- Migration 007: Performance indexes for grievances, audit_log,
--                and optimised pool config comments.
-- ============================================================
-- Context: Load testing revealed:
--   1. GET /api/v1/grievance/:id does a PK lookup — already fast.
--   2. Any future "list grievances by citizen" query would do a seq-scan
--      on grievances(citizen_id) without this index.
--   3. audit_log has no index on (citizen_id, timestamp_ist) — slow
--      for compliance queries filtering by citizen over time ranges.
--
-- NOTE: CREATE INDEX CONCURRENTLY is used so this migration does not
--       lock the tables in production. Run outside a transaction block.
-- ============================================================

-- Grievances: citizen lookup + status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grievances_citizen_id
    ON grievances(citizen_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grievances_citizen_status
    ON grievances(citizen_id, status);

-- Audit log: compliance and alerting range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_citizen_time
    ON audit_log(citizen_id, timestamp_ist DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_action
    ON audit_log(action, timestamp_ist DESC);

-- Applications: service_code filtering (for admin dashboards)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_service_status
    ON applications(service_code, status);
