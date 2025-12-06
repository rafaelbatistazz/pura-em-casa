-- DIAGNOSTIC: Check Users and Roles
SELECT 
    u.id, 
    u.email, 
    u.role as role_in_users, 
    ur.role as role_in_ur
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id;
