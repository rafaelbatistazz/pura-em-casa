# INSTRUÇÕES DE RESET TOTAL (V2 - DEFINITIVO)

Este procedimento irá ELIMINAR COMPLETAMENTE todo o sistema de usuários, garantindo que não restem conflitos para a reconstrução.

1. Acesse o Supabase SQL Editor: https://supabase.com/dashboard/project/uxmuncibtisjsopvvuds/sql/new

2. Copie e cole o conteúdo do arquivo `wipe_users_clean_final.sql` e execute.
   - O arquivo está em: `/Users/rafaelbatista/Downloads/Apps/leadwhisper-pro-main/wipe_users_clean_final.sql`

3. O que este script fará:
   - Limpará referências em Leads e Atalhos (evitando erros de chave estrangeira).
   - Apagará tabelas `users` e `user_roles`.
   - Apagará funções e triggers.
   - Apagará TODOS os usuários logados do sistema (`auth.users`).

4. Após executar, recarregue a página `http://localhost:8080`.
   - Você precisará criar uma nova conta assim que reconstruirmos o sistema (próximo passo).
   - A página de Configurações estará acessível sem erros (seção de usuários desativada).

Aguarde a confirmação de execução para prosseguirmos com a reconstrução correta.
