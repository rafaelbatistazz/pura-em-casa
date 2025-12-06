-- ==============================================================================
-- SCRIPT DE CORREÇÃO: SINCRONIZAR USUÁRIOS EXISTENTES
-- RODAR ISSO PARA CORRIGIR A TELA BRANCA
-- ==============================================================================

-- 1. Inserir usuários da auth.users que não estão na public.users
INSERT INTO public.users (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', email) as name,
    'user'::public.app_role as role
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Garantir que todo usuário tenha uma entry em user_roles (redundante mas necessário)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role
FROM public.users
ON CONFLICT DO NOTHING;

-- 3. Inserir configurações padrão se não existirem
INSERT INTO public.system_config (key, value)
VALUES 
    ('evolution_api_url', ''),
    ('evolution_api_key', ''),
    ('evolution_instance_name', '')
ON CONFLICT (key) DO NOTHING;

-- 4. Criar Lead de Teste para verificar Timezone
INSERT INTO public.leads (phone, name, status, created_at, updated_at)
VALUES 
    ('5511999999999', 'Lead de Teste Timezone', 'novo', now(), now())
ON CONFLICT (phone) DO UPDATE SET updated_at = now();
