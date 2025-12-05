-- 1. Corrigir trigger handle_new_user para criar usuários como 'user' por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Inserir na tabela users (quem faz signup é USER, não admin)
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'  -- CORREÇÃO: signup normal cria USER
  );
  
  -- Inserir role na tabela user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');  -- CORREÇÃO: user
  
  RETURN NEW;
END;
$$;

-- 2. Adicionar campo notes na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS notes TEXT;