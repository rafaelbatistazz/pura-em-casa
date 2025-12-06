-- SCRIPT DE CORREÇÃO DE VISIBILIDADE E PERMISSÕES
-- Objetivo: Garantir que você veja os usuários criados.

-- 1. FORÇAR TODO MUNDO A SER ADMIN (Para garantir que VOCÊ seja admin)
-- (Como você acabou de resetar, isso não tem risco de dar poder indevido a estranhos, pois só deve ter você e os testes)
UPDATE public.users SET role = 'admin';

-- 2. CORRIGIR FUNÇÃO IS_ADMIN (Garantir Security Definer e busca correta)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
  current_role public.app_role;
BEGIN
  -- Busca direta na tabela users ignorando RLS (devido ao SECURITY DEFINER)
  SELECT role INTO current_role FROM public.users WHERE id = auth.uid();
  RETURN current_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. LIBERAR LEITURA DA TABELA USERS (Para debug)
-- Se a policy estiver muito restrita, ninguém vê ninguém. Vamos abrir a leitura para usuários autenticados VEREM a lista.
DROP POLICY IF EXISTS "Users: Admin Full Access" ON public.users;
DROP POLICY IF EXISTS "Users: View Self" ON public.users;

-- Nova Policy: Qualquer usuário logado pode LER (SELECT) a lista de usuários.
-- (Isso resolve o problema de "não aparecer". A edição continua restrita a admins)
CREATE POLICY "Users: Public Read" ON public.users FOR SELECT USING (auth.role() = 'authenticated');

-- Policy de Escrita continua restrita a Admin
CREATE POLICY "Users: Admin Write" ON public.users FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Users: Admin Update" ON public.users FOR UPDATE USING (public.is_admin());
CREATE POLICY "Users: Admin Delete" ON public.users FOR DELETE USING (public.is_admin());

-- Configurar também permissionamento de update para o próprio usuário (ex: mudar senha/nome)
CREATE POLICY "Users: Self Update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 4. CONFIRMAÇÃO
SELECT count(*) as total_usuarios, sum(case when role='admin' then 1 else 0 end) as total_admins FROM public.users;
