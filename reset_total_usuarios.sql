-- ==============================================================================
-- RESET TOTAL: Deletar tudo e recriar do ZERO
-- Sistema simples: primeiro usuário = admin permanente
-- ==============================================================================

-- 1. DELETAR TUDO relacionado a usuários
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Deletar triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_new_user ON auth.users;

-- Deletar funções
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

-- 2. RECRIAR tabela users (SIMPLES - sem user_roles)
CREATE TABLE public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role public.app_role DEFAULT 'user'::public.app_role,
  is_first_user boolean DEFAULT false,  -- Marca o primeiro usuário (admin permanente)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Criar função para novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_count integer;
  user_role public.app_role;
  is_first boolean;
BEGIN
  -- Contar quantos usuários existem
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  -- Se for o primeiro usuário, é admin permanente
  IF user_count = 0 THEN
    user_role := 'admin'::public.app_role;
    is_first := true;
  ELSE
    user_role := 'user'::public.app_role;
    is_first := false;
  END IF;
  
  -- Inserir na tabela users
  INSERT INTO public.users (id, email, name, role, is_first_user)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    user_role,
    is_first
  );
  
  RETURN NEW;
END;
$function$;

-- 4. Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Criar políticas RLS SIMPLES
-- SELECT: todos podem ver todos os usuários
CREATE POLICY "users_select" ON public.users 
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: apenas via trigger (ninguém insere diretamente)
CREATE POLICY "users_insert" ON public.users 
  FOR INSERT TO authenticated
  WITH CHECK (false);  -- Bloqueado - só via trigger

-- UPDATE: apenas admin pode atualizar, MAS não pode alterar is_first_user
CREATE POLICY "users_update" ON public.users 
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    AND (
      -- Se for o primeiro usuário, não pode alterar o próprio role
      (is_first_user = true AND id != auth.uid())
      OR
      -- Se não for o primeiro usuário, pode alterar qualquer um
      (is_first_user = false OR id != auth.uid())
    )
  );

-- DELETE: apenas admin pode deletar, MAS não pode deletar o primeiro usuário
CREATE POLICY "users_delete" ON public.users 
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    AND is_first_user = false  -- Não pode deletar o primeiro usuário
  );

-- 6. Deletar TODOS os usuários do auth.users (vai recriar do zero)
-- CUIDADO: Isso vai deletar TODOS os usuários!
DELETE FROM auth.users;

-- 7. Verificar que está tudo limpo
SELECT COUNT(*) as total_users FROM public.users;
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- PRONTO! Agora faça logout e crie uma nova conta.
-- O primeiro usuário que se cadastrar será o ADMIN PERMANENTE.
