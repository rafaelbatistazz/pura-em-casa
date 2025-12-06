-- FORÇAR ADMIN PARA O DONO
UPDATE public.users 
SET role = 'admin', is_first_user = true 
WHERE email = 'gt.rafaa@gmail.com';

-- Garantir que não há outros 'first_user' conflitantes (opcional, por segurança)
UPDATE public.users 
SET is_first_user = false 
WHERE email != 'gt.rafaa@gmail.com';

-- Verificar resultado
SELECT email, role, is_first_user FROM public.users WHERE email = 'gt.rafaa@gmail.com';
