-- ==============================================================================
-- FIX RLS RECURSION (ERRO 500)
-- OBJETIVO: Corrigir o Loop Infinito na política de segurança da tabela app_profiles.
-- ==============================================================================

BEGIN;

-- 1. FUNÇÃO SEGURA PARA CHECAR ADMIN (SECURITY DEFINER)
-- Esta função roda com permissão de "Superusuário" do banco,
-- ignorando o RLS para evitar o loop infinito.
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CORRIGIR AS POLÍTICAS DE SEGURANÇA (RLS)
-- Removemos as políticas antigas que causavam erro
DROP POLICY IF EXISTS "Profiles: Admin Write" ON public.app_profiles;
DROP POLICY IF EXISTS "Profiles: Public Read" ON public.app_profiles;
DROP POLICY IF EXISTS "Profiles: Update Self" ON public.app_profiles;

-- Recriamos de forma segura
-- Leitura: Aberta para quem tem login
CREATE POLICY "Profiles: Public Read" ON public.app_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita (Insert/Update/Delete): Só Admin (via função segura)
CREATE POLICY "Profiles: Admin Write" ON public.app_profiles
  FOR ALL USING (public.is_app_admin());

-- Atualizar o Próprio Perfil: Permitido (Aponta para o próprio ID)
CREATE POLICY "Profiles: Update Self" ON public.app_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. REFORÇAR A SINCRONIA
-- Garantir que o usuário atual seja Admin (caso tenha se perdido no erro anterior)
UPDATE public.app_profiles
SET role = 'admin'
WHERE email ILIKE '%gt.rafaa@gmail.com%';

COMMIT;
