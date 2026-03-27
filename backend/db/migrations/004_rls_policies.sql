-- Enable Row Level Security
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Assuming Supabase auth is used mapping to auth.uid() function
-- If running strictly standard without supabase, this provides a mockup or handles custom functions mapped nicely.

CREATE POLICY "Citizens can view their own profile"
ON citizens FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Citizens can update their own profile"
ON citizens FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Citizens can view their own applications"
ON applications FOR SELECT
USING (citizen_id = auth.uid());

CREATE POLICY "Citizens can create their own applications"
ON applications FOR INSERT
WITH CHECK (citizen_id = auth.uid());

CREATE POLICY "Users cannot delete applications"
ON applications FOR DELETE
USING (false);

CREATE POLICY "Citizens can view their own audit logs"
ON audit_log FOR SELECT
USING (citizen_id = auth.uid());
