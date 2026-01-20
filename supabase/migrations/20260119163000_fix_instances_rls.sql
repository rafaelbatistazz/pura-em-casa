-- Enable RLS on instances table (ensure it is on)
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;

-- Drop existing overlapping policies if any (to avoid conflicts/duplication errors)
DROP POLICY IF EXISTS "Admins can view all instances" ON instances;
DROP POLICY IF EXISTS "Admins can manage instances" ON instances;

-- Create comprehensive policy for admins
CREATE POLICY "Admins can manage instances" ON instances
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'admin' 
  OR 
  EXISTS (
    SELECT 1 FROM app_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Note: has_role might verify against app_profiles or claims. 
-- Using direct subquery is often safer if has_role implementation varies.
