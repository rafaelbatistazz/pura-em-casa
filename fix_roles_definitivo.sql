-- ==============================================================================
-- DIAGNÓSTICO E CORREÇÃO DEFINITIVA: Problema de Roles
-- ==============================================================================

-- 1. Verificar TODOS os triggers ativos em auth.users
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;

-- 2. Verificar a função handle_new_user atual
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);

-- 3. DELETAR TODOS os triggers em auth.users (vamos recriar do zero)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_new_user ON auth.users;

-- 4. Recriar a função handle_new_user CORRETAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Inserir na tabela users com role 'user' SEMPRE
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'::public.app_role  -- FORÇAR como 'user'
  );
  
  -- Inserir role na tabela user_roles com 'user' SEMPRE
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role);  -- FORÇAR como 'user'
  
  RETURN NEW;
END;
$function$;

-- 5. Criar o trigger ÚNICO
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Verificar políticas RLS em users e user_roles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('users', 'user_roles')
ORDER BY tablename, policyname;

-- 7. Garantir que admins podem UPDATE em users e user_roles
-- Deletar políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Admin full access users" ON public.users;
DROP POLICY IF EXISTS "Manage roles" ON public.user_roles;

-- Recriar políticas corretas
CREATE POLICY "Admin full access users" 
  ON public.users 
  FOR ALL 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Manage roles" 
  ON public.user_roles 
  FOR ALL 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Corrigir TODOS os usuários que estão como admin (exceto gt.rafaa@gmail.com)
UPDATE public.users
SET role = 'user'::public.app_role
WHERE role = 'admin'::public.app_role
  AND email != 'gt.rafaa@gmail.com';

UPDATE public.user_roles
SET role = 'user'::public.app_role
WHERE role = 'admin'::public.app_role
  AND user_id != (SELECT id FROM public.users WHERE email = 'gt.rafaa@gmail.com');

-- 9. Verificação final
SELECT 
  u.email,
  u.role as users_role,
  ur.role as user_roles_role,
  u.created_at
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC
LIMIT 15;
