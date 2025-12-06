-- ==============================================================================
-- SCRIPT DE SINCRONIZAÇÃO: AUTH -> APP_PROFILES
-- OBJETIVO: Corrigir o "Limbo". Usuários existem no Auth (Login funciona),
-- mas não existem no App (Tela fica branca ou sem permissão).
-- ==============================================================================

-- 1. Copiar usuários do Auth que não estão no App_Profiles
INSERT INTO public.app_profiles (id, email, name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', email),
  'user' -- Todo mundo entra como User primeiro
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. GARANTIR QUE VOCÊ SEJA ADMIN
-- Substitua pelo seu email se for diferente, mas peguei do histórico.
UPDATE public.app_profiles
SET role = 'admin'
WHERE email ILIKE '%gt.rafaa@gmail.com%';

-- 3. Confirmação
SELECT * FROM public.app_profiles;
