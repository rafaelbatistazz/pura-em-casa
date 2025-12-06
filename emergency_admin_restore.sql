-- SCRIPT DE EMERGÊNCIA: FORÇAR ADMIN
-- Substitua 'seu-email-aqui@exemplo.com' pelo seu email real

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'gt.rafaa@gmail.com';

-- Verifica se funcionou
SELECT email, role FROM public.users WHERE role = 'admin';
