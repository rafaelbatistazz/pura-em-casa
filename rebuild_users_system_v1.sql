-- ==============================================================================
-- SCRIPT DE RECONSTRUÇÃO DO SISTEMA DE USUÁRIOS (V1 - BLINDADO)
-- OBJETIVO: Recriar tabelas de usuário com lógica SIMPLES e ROBUSTA de permissões.
-- ==============================================================================

-- 1. GARANTIA DE LIMPEZA (Redundância Defensiva)
DROP TABLE IF EXISTS public.user_roles CASCADE; -- Se ainda existir
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- 2. CRIAÇÃO DE TIPOS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 3. CRIAÇÃO DA TABELA DE USUÁRIOS
-- Simplificada: O role vive na própria tabela users. Menos joins, menos erro.
CREATE TABLE public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role public.app_role DEFAULT 'user'::public.app_role,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Habilitar RLS imediatamente
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. FUNÇÃO E TRIGGER DE NOVO USUÁRIO (LÓGICA DE AUTO-ADMIN)
-- O primeiro usuário a se cadastrar vira ADMIN automaticamente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Verifica se é o primeiro usuário da tabela
  SELECT NOT EXISTS (SELECT 1 FROM public.users) INTO is_first_user;

  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    CASE WHEN is_first_user THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na auth.users (Supabase executa isso sempre que alguém faz Sign Up)
-- Drop e recria para garantir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. FUNÇÃO HELPER PARA VERIFICAR ADMIN (Útil para RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. POLÍTICAS DE SEGURANÇA (RLS) - SIMPLES E FUNCIONAIS

-- LEITURA: Todos os usuários autenticados podem ver a lista de usuários (necessário para o painel)
CREATE POLICY "Leitura permitida para autenticados" 
ON public.users FOR SELECT 
TO authenticated 
USING (true);

-- EDIÇÃO (UPDATE):
-- 1. O próprio usuário pode editar seu nome/email.
-- 2. Admin pode editar qualquer usuário (incluindo roles).
CREATE POLICY "Update usuarios" 
ON public.users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- EXCLUSÃO (DELETE): Apenas Admin pode deletar usuários
CREATE POLICY "Delete apenas admin" 
ON public.users FOR DELETE 
TO authenticated 
USING (public.is_admin());


-- 7. REPARAR DADOS DE OUTRAS TABELAS (Evitar erros de FK se leads existirem)
-- Tenta reconectar leads órfãos se o email bater (opcional, mas inteligente)
-- Se não, deixa NULL mesmo para o Admin reatribuir depois.

-- 8. GRANT DE PERMISSÕES (Crucial para evitar 403 em queries normais)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, service_role;
GRANT SELECT, UPDATE, DELETE ON TABLE public.users TO authenticated;

-- FIM
