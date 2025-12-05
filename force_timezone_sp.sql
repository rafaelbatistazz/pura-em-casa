-- SOLUÇÃO DEFINITIVA DE FUSO HORÁRIO
-- Isso configura o PostgreSQL para operar OFICIALMENTE no horário de Brasília.
-- Elimina a necessidade de compensações manuais no código.

-- 1. Configurar o banco de dados padrão para SP
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';

-- 2. Configurar os usuários de acesso (API/Supabase) para SP
-- 'authenticated' é o usuário que o seu Front-end usa.
ALTER ROLE authenticated SET timezone TO 'America/Sao_Paulo';

-- 'service_role' é o usuário que o N8N e Backend usam.
ALTER ROLE service_role SET timezone TO 'America/Sao_Paulo';

-- 'postgres' é o admin.
ALTER ROLE postgres SET timezone TO 'America/Sao_Paulo';

-- 3. Confirmação (Se rodar no editor, deve mostrar America/Sao_Paulo)
SHOW timezone;
