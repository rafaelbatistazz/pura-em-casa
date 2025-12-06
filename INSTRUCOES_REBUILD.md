# INSTRUÇÕES DE RECONSTRUÇÃO FINAL (V4 - DEFINITIVO)

Este é o procedimento corrigido e final para restaurar o sistema de usuários sem erros e sem perder dados.

## 1. Executar o SQL Definitivo
1. Vá no Supabase SQL Editor.
2. Copie e cole o conteúdo de: `/Users/rafaelbatista/Downloads/Apps/leadwhisper-pro-main/rebuild_users_final_v4.sql`.
3. Execute.

**O que este script faz:**
- Cria a tabela `users` (que estava faltando).
- Reconecta as tabelas `leads` e `messages` (que já existiam) à nova tabela de usuários.
- Configura permissões (RLS) onde Admins veem tudo e Usuários veem apenas o seu.

## 2. Criar Conta Admin
1. Vá para o Login (`/login`).
2. Cadastre-se.
   - Sua conta será **ADMIN** automaticamente (porque é a primeira).

## 3. Gestão de Usuários
- Se você quiser criar usuários pelo painel "Adicionar Usuário", você precisa fazer deploy das Edge Functions:
  ```bash
  npx supabase functions deploy create-user --no-verify-jwt
  npx supabase functions deploy delete-user --no-verify-jwt
  ```
- Se não puder fazer deploy, peça para os usuários se cadastrarem sozinhos e use o botão "Promover a Admin" no painel.

Pode testar!
