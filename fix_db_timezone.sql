-- PASSO 1: Verificar o tipo atual (apenas para conferência, opcional)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'timestamp';

-- PASSO 2: Converter a coluna para suportar fuso horário CORRETAMENTE
-- Isso fará com que o PostgreSQL entenda o "-03:00" que o sistema envia
ALTER TABLE messages 
ALTER COLUMN timestamp TYPE timestamp with time zone 
USING timestamp AT TIME ZONE 'UTC';

-- PASSO 3: Definir o valor padrão para o momento atual (com fuso)
ALTER TABLE messages 
ALTER COLUMN timestamp SET DEFAULT now();

-- PASSO 4 (OPCIONAL): Corrigir dados antigos se estiverem deslocados
-- Se as mensagens antigas ficaram com 3 ou 6 horas a menos, rode uma das linhas abaixo:
-- UPDATE messages SET timestamp = timestamp + interval '3 hours';
-- UPDATE messages SET timestamp = timestamp + interval '6 hours';
