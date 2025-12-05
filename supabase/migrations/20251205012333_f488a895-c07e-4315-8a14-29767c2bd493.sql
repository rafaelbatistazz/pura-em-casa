-- Add RLS policies for n8n tables (used by webhook, need service role access)

-- n8n_dados_cliente policies
CREATE POLICY "Service role full access to n8n_dados_cliente"
ON public.n8n_dados_cliente
FOR ALL
USING (true)
WITH CHECK (true);

-- n8n_fila_mensagens policies  
CREATE POLICY "Service role full access to n8n_fila_mensagens"
ON public.n8n_fila_mensagens
FOR ALL
USING (true)
WITH CHECK (true);

-- n8n_historico_mensagens policies
CREATE POLICY "Service role full access to n8n_historico_mensagens"
ON public.n8n_historico_mensagens
FOR ALL
USING (true)
WITH CHECK (true);

-- n8n_status_atendimento policies
CREATE POLICY "Service role full access to n8n_status_atendimento"
ON public.n8n_status_atendimento
FOR ALL
USING (true)
WITH CHECK (true);