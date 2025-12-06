-- SCRIPT DE CORREÇÃO FINAL DE ACESSO (O "DESBLOQUEIO")
-- EXECUTE ISSO PARA QUE O FRONTEND CONSIGA LER QUE VOCÊ É ADMIN

-- 1. Resetar permissões da tabela users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Derrubar policies antigas que podem estar bloqueando (limpeza total)
DROP POLICY IF EXISTS "Users: Admin Full Access" ON public.users;
DROP POLICY IF EXISTS "Users: View Self" ON public.users;
DROP POLICY IF EXISTS "Users: Update Self" ON public.users;
DROP POLICY IF EXISTS "Users: Public Read" ON public.users;
DROP POLICY IF EXISTS "Users: Admin Write" ON public.users;
DROP POLICY IF EXISTS "Users: Admin Update" ON public.users;
DROP POLICY IF EXISTS "Users: Admin Delete" ON public.users;
DROP POLICY IF EXISTS "Allow All" ON public.users;
DROP POLICY IF EXISTS "Users: Read All Authenticated" ON public.users;

-- 2. CRIAR POLICY DE LEITURA TOTAL (Para resolver o "sumiço")
-- Isso permite que o Frontend LEIA o role correto. Se não ler, ele chuta "user".
CREATE POLICY "Users: Read All Authenticated" 
ON public.users 
FOR SELECT 
USING (auth.role() = 'authenticated'); 
-- (Traduzindo: Se está logado, pode ver a lista e o próprio role)

-- 3. CRIAR POLICY DE ADMINISTRAÇÃO
-- Admins podem fazer tudo (UPDATE, DELETE)
CREATE POLICY "Users: Admin Full Control" 
ON public.users 
FOR ALL 
USING (
  public.is_admin() = true
);

-- 4. CRIAR POLICY DE AUTO-EDIÇÃO (Nome, Senha, etc)
CREATE POLICY "Users: Update Self"
ON public.users
FOR UPDATE
USING (auth.uid() = id);


-- 5. RE-VERIFICAR SEU ADMIN
-- (Só pra garantir, roda de novo o update no seu email)
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'gt.rafaa@gmail.com';

-- FIM.
