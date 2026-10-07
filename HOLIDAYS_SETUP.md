# Validade dos pacotes e feriados globais

Aplicar `supabase/migrations/202610070001_global_holidays.sql` depois das migrations existentes (inclusive `202610010001_authenticated_cancellations.sql`). A migration não altera registros de alunos, pacotes, presenças, cobranças ou reposições. Cria a proteção dos feriados e uma lista privada de administradores.

A conta verificada `jvictordesc99@gmail.com`, já usada como administrador pelo aplicativo, é cadastrada automaticamente na lista. Confira no SQL Editor:

```sql
select user_id from public.calendar_administrators;
```

Se a conta ainda não existia ou não estava verificada quando a migration foi aplicada, cadastre o UUID real do administrador (o mesmo `GOOGLE_CALENDAR_OWNER_USER_ID`) usando o SQL Editor:

```sql
insert into public.calendar_administrators(user_id)
values ('UUID-REAL-DO-ADMINISTRADOR') on conflict do nothing;
```

Publicar os arquivos estáticos atualizados, incluindo `calendar-rules.js`, e republicar as Edge Functions que usam `_shared/calendar-sync.ts`:

```text
supabase functions deploy google-calendar
supabase functions deploy google-calendar-webhook
supabase functions deploy google-calendar-renew
```

Não são necessárias novas variáveis de ambiente. A integração continua usando a conexão OAuth existente. A validação automatizada usa PostgreSQL local via PGlite e mocks do Google; não envia eventos para uma conta Google real.

Na agenda do administrador, selecione a data e use **Marcar feriado** ou **Remover feriado**. A mesma data tem um único registro; remoção troca seu indicador ativo, preservando as aulas originais. Os cálculos e calendários consultam esse indicador, sem lançar presença, falta ou cancelamento e sem alterar o término do pacote. Cancelamentos anteriores ao feriado permanecem no histórico e voltam a produzir seus efeitos originais ao remover o feriado. Eventos oficialmente cancelados já excluídos do Google continuam excluídos; os demais eventos afetados recebem o título **Feriado**.

Os feriados antigos do formulário financeiro continuam com a regra anterior; somente o botão da agenda registra um feriado global. Os novos feriados globais são excluídos das cobranças `per_class` mesmo quando a configuração financeira antiga permite contar feriados. A cobrança `fixed` preserva o valor do mês fechado.

Pacotes antigos sem datas continuam com os campos vazios; podem ser editados para informar dia, mês e ano. Sem início e término completos não se gera uma agenda de pacote por suposição. Renovar com **Novo pacote** cria outro registro e preserva o histórico.
