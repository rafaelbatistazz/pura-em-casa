-- Adicionar configurações padrão para novos leads
INSERT INTO system_config (key, value, description) VALUES
('default_ai_enabled', 'false', 'IA ativa por padrão em novos leads'),
('default_followup_enabled', 'false', 'Follow-up ativo por padrão em novos leads')
ON CONFLICT (key) DO NOTHING;
