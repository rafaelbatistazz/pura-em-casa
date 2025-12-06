-- ==============================================================================
-- CORREÇÃO: Garantir que novos usuários sejam criados como 'user' e não 'admin'
-- ==============================================================================

-- 1. Verificar trigger atual
SELECT tgname, tgenabled, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE '%new_user%';

-- 2. Recriar função handle_new_user (garantir que cria como 'user')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Inserir na tabela users (quem faz signup é USER, não admin)
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'  -- SEMPRE criar como 'user'
  );
  
  -- Inserir role na tabela user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');  -- SEMPRE criar como 'user'
  
  RETURN NEW;
END;
$function$;

-- 3. Garantir que o trigger existe e está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Corrigir usuários que foram criados incorretamente como admin
-- (exceto o admin principal gt.rafaa@gmail.com)
UPDATE public.users
SET role = 'user'
WHERE role = 'admin' 
  AND email != 'gt.rafaa@gmail.com';

UPDATE public.user_roles
SET role = 'user'
WHERE role = 'admin' 
  AND user_id != (SELECT id FROM public.users WHERE email = 'gt.rafaa@gmail.com');

-- 5. Verificar resultado
SELECT 
  u.email,
  u.role as users_role,
  ur.role as user_roles_role
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC
LIMIT 10;
