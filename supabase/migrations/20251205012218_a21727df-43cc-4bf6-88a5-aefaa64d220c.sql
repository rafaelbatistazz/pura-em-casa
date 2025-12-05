-- Fix remaining functions with mutable search_path

-- Fix handle_new_user function (already has SET search_path but let's verify)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Inserir na tabela users (quem faz signup é USER, não admin)
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'
  );
  
  -- Inserir role na tabela user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;