-- Delete orphan user teste@gmail.com that doesn't exist in auth.users
DELETE FROM public.users 
WHERE email = 'teste@gmail.com'
AND id NOT IN (SELECT id FROM auth.users);