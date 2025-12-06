-- SCRIPT DE CONCILIAÇÃO DE PERMISSÕES (Manual do Proprietário)
-- Objetivo: Permitir que VOCÊ defina quem é admin sem "transformar todos".

-- 1. Verifique quem são os usuários atuais (Rode essa linha se quiser ver o ID)
-- SELECT id, email, role FROM public.users;

-- 2. FUNÇÃO para PROMOVER UM EMAIL ESPECÍFICO a Admin
CREATE OR REPLACE FUNCTION public.promote_admin_by_email(target_email text)
RETURNS text AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Acha o usuário pelo email na tabela publica
  SELECT id INTO v_user_id FROM public.users WHERE email = target_email;
  
  IF v_user_id IS NULL THEN
    RETURN 'Usuário não encontrado: ' || target_email;
  END IF;

  -- Promove
  UPDATE public.users SET role = 'admin' WHERE id = v_user_id;
  
  RETURN 'Sucesso! Usuário ' || target_email || ' agora é Admin.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFORÇAR A VISIBILIDADE (Garantir que Admin VEJA TUDO)
-- Às vezes o RLS fica "preso". Vamos recriar a policy de visualização.

DROP POLICY IF EXISTS "Users: Admin Full Access" ON public.users;
DROP POLICY IF EXISTS "Users: View Self" ON public.users;
DROP POLICY IF EXISTS "Users: Public Read" ON public.users;

-- Policy Definitiva:
-- Admins veem TUDO.
CREATE POLICY "Users: Admin Full Access" ON public.users 
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Usuários comuns veem APENAS A SI MESMOS (Segurança padrão)
-- MAS, se quiser que eles vejam a lista para "distribuição", teria que liberar.
-- Por enquanto, vamos manter SEGURO: User vê User. Admin vê Tudo.
CREATE POLICY "Users: View Self" ON public.users 
FOR SELECT USING (auth.uid() = id);

-- 4. COMO USAR:
-- No editor SQL, apague tudo e rode APENAS:
-- SELECT public.promote_admin_by_email('seu@email.com');

-- (Isso vai garantir que O SEU usuário seja admin e consiga ver a lista toda)
