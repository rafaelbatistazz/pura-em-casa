-- Fix handle_new_user trigger to insert into correct table (app_profiles) instead of non-existent users table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Verificar se já existe (idempotência)
  IF EXISTS (SELECT 1 FROM public.app_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Inserir na tabela CORRETA: app_profiles
  INSERT INTO public.app_profiles (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user', -- Default role
    now(),
    now()
  );
  
  RETURN NEW;
END;
$function$;
