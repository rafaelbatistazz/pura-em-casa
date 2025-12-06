-- ==============================================================================
-- FUNÇÕES SEGURAS (RPC) - Bypass de RLS
-- ==============================================================================

-- 1. Função para ler o próprio perfil (usada no AuthContext)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como superusuário/criador
SET search_path = public
AS $function$
DECLARE
  current_user_id uuid;
  result json;
BEGIN
  current_user_id := auth.uid();
  
  SELECT row_to_json(u) INTO result
  FROM public.users u
  WHERE u.id = current_user_id;
  
  RETURN result;
END;
$function$;

-- Garantir permissão de execução
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;


-- 2. Função para listar usuários (usada na Config, apenas para admins)
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como superusuário/criador
SET search_path = public
AS $function$
BEGIN
  -- Verificar se quem chama é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores.';
  END IF;

  RETURN QUERY SELECT * FROM public.users ORDER BY created_at DESC;
END;
$function$;

-- Garantir permissão de execução
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
