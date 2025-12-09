-- LIST ACTIVE POLICIES (SNIPER MODE DIAGNOSTIC)
-- Run this to see EXACTLY what rules are active on your tables.

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd AS "action", -- SELECT, INSERT, UPDATE, DELETE
    roles,
    cmd
FROM 
    pg_policies 
WHERE 
    tablename IN ('leads', 'messages')
ORDER BY 
    tablename, policyname;
