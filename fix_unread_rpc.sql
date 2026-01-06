-- Função segura para marcar mensagens como lidas
-- Isso resolve o problema de permissão (RLS) que impedia o "zerar" das notificações

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com permissões de admin/criador
SET search_path = public
AS $function$
BEGIN
  -- Atualiza todas as mensagens recebidas (inbound) e não lidas desse lead
  UPDATE public.messages
  SET read = true
  WHERE lead_id = p_lead_id
    AND direction = 'inbound'
    AND read = false;
END;
$function$;

-- Garantir que usuários logados possam executar
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;
