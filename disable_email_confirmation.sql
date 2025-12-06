-- Desabilitar confirmação de email no Supabase
-- Isso permite criar usuários sem precisar confirmar email

-- IMPORTANTE: Execute isso no Supabase Dashboard > SQL Editor

-- Atualizar configuração do auth para não requerer confirmação de email
UPDATE auth.config
SET enable_signup = true;

-- Nota: A configuração de confirmação de email é feita via Dashboard
-- Vá em: Authentication > Settings > Email Auth
-- Desmarque "Enable email confirmations"
