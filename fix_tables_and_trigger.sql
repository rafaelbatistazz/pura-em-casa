-- ==============================================================================
-- SCRIPT DE CORREÇÃO FINAL: SYNC, ADMIN E TRIGGER
-- ==============================================================================

-- 1. Sincronização Manual (Copia quem se cadastrou para a tabela pública)
INSERT INTO public.users (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', email), 
    'admin'::public.app_role -- Já cria como Admin
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin'::public.app_role;

-- 2. Garante a tabela user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.users
ON CONFLICT (id) DO UPDATE SET role = 'admin'::public.app_role;

-- 3. Tenta criar o Gatilho (Trigger) para que os próximos cadastros sejam automáticos
-- (Isso garante que não fique vazio de novo)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'admin');
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Confirmação
SELECT count(*) as total_usuarios_corrigidos FROM public.users;
