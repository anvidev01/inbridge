CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    timestamp_ist TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
);

CREATE INDEX idx_audit_log_citizen_id ON audit_log(citizen_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp_ist);

-- Append-only constraint via DB permissions (assuming app connects as specific user)
-- Alternatively, we can use a trigger to prevent updates and deletes
CREATE OR REPLACE FUNCTION prevent_audit_modifications()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates and deletes are not allowed on the audit_log table. CERT-In compliance requirement.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_prevent_modifications
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_modifications();
