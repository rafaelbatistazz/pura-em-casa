-- ==============================================================================
-- SCRIPT DE LIBERAÇÃO FINAL E ABSOLUTA (V6) - PARA TODAS AS TABELAS
-- ==============================================================================

-- Função auxiliar para limpar policies e habilitar acesso irrestrito para autenticados
create or replace function public.liberar_tabela(nome_tabela text)
returns void as $$
begin
    execute format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nome_tabela);
    
    -- Tenta remover policies comuns antigas (ignora erro se não existir)
    begin
        execute format('DROP POLICY IF EXISTS "Public Read %I" ON public.%I', nome_tabela, nome_tabela);
        execute format('DROP POLICY IF EXISTS "Public Write %I" ON public.%I', nome_tabela, nome_tabela);
        execute format('DROP POLICY IF EXISTS "Allow All %I" ON public.%I', nome_tabela, nome_tabela);
        execute format('DROP POLICY IF EXISTS "Select %I" ON public.%I', nome_tabela, nome_tabela);
        execute format('DROP POLICY IF EXISTS "Insert %I" ON public.%I', nome_tabela, nome_tabela);
        execute format('DROP POLICY IF EXISTS "Update %I" ON public.%I', nome_tabela, nome_tabela);
        execute format('DROP POLICY IF EXISTS "Delete %I" ON public.%I', nome_tabela, nome_tabela);
    exception when others then
        null;
    end;

    -- Cria Policy de LEITURA (SELECT) para QUALQUER usuário logado
    execute format('CREATE POLICY "Public Read %I" ON public.%I FOR SELECT TO authenticated USING (true)', nome_tabela, nome_tabela);

    -- Cria Policy de ESCRITA (ALL) para QUALQUER usuário logado
    execute format('CREATE POLICY "Public Write %I" ON public.%I FOR ALL TO authenticated USING (true)', nome_tabela, nome_tabela);

    -- Garante Grants
    execute format('GRANT ALL ON TABLE public.%I TO authenticated', nome_tabela);
    execute format('GRANT ALL ON TABLE public.%I TO service_role', nome_tabela);
end;
$$ language plpgsql;

-- Aplicar para TODAS as tabelas do sistema
SELECT public.liberar_tabela('leads');
SELECT public.liberar_tabela('messages');
SELECT public.liberar_tabela('message_shortcuts');
SELECT public.liberar_tabela('lead_distribution');
SELECT public.liberar_tabela('lead_distribution_config');
SELECT public.liberar_tabela('n8n_dados_cliente');
SELECT public.liberar_tabela('n8n_fila_mensagens');
SELECT public.liberar_tabela('n8n_historico_mensagens');
SELECT public.liberar_tabela('n8n_status_atendimento');

-- Remover a função auxiliar após uso
DROP FUNCTION public.liberar_tabela(text);

-- ==============================================================================
-- Fim do Script
-- ==============================================================================
