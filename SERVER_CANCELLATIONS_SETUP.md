# Cancelamento autenticado e fila Google — etapa 1

Esta etapa nao implementa Web Push/PWA. Nenhum comando deste guia foi executado
em producao durante a implementacao. O frontend exige o novo backend; publique
na ordem abaixo. Nao reaplique as migrations anteriores.

## Fluxo e limites de autoridade

1. O personal autenticado, com UUID igual a `GOOGLE_CALENDAR_OWNER_USER_ID`, revisa
   e publica o cadastro em Agenda > Autorizar cancelamentos dos alunos.
   O painel mostra IDs de login e todas as ocorrencias com data/horario. Confira
   os IDs contra Supabase Auth; nao confirme automaticamente dados importados.
2. `lesson-cancellation` gera a agenda do pacote no servidor e publica em uma
   transacao as tabelas protegidas de alunos, pacotes e ocorrencias. Nao usa
   `profiles.role`, `user_metadata`, email ou nome como prova de identidade.
   O banco exige usuarios reais em `auth.users` e impede reatribuir um vinculo
   existente. Uma correcao de identidade exige revisao administrativa especifica.
3. O aluno envia packageId, dateKey, horario exibido e um UUID de requisicao.
   A Edge Function valida a sessao e encaminha seu JWT para `cancel_my_lesson`.
   A propria RPC verifica `auth.uid()` contra o vinculo protegido, mesmo quando
   chamada diretamente pela API, sem passar pela Edge Function.
4. Sob bloqueio de `app_state/main`, a RPC valida aula, registro anterior e saldo,
   grava recibo imutavel e uma tarefa Google, e atualiza a projecao do app na mesma
   transacao. O timestamp de recebimento no banco decide a regra das duas horas.
5. O frontend so anuncia sucesso apos o recibo. Erros nao criam cancelamento ou
   credito local. O UUID persiste por usuario/aula; repeticao apos timeout retorna
   o mesmo recibo. Sem rede, o aluno deve tentar novamente; nao ha confirmacao offline.
6. Cron aciona o worker a cada minuto. O servidor usa o refresh token Google
   criptografado existente; nao depende da sessao do personal. Nao ha chamada do
   navegador para acordar a fila: o agendamento e obrigatorio.

O cadastro e um snapshot confirmado, nao um espelho automatico do JSON anonimo.
Publique novamente apos criar/alterar pacotes, horarios, vinculos ou registros de
presenca. Alunos sem login vinculado sao mostrados como excluidos. Uma publicacao
completa desativa entradas omitidas; recibos e tarefas anteriores sao preservados.
O servidor recusa o cancelamento se o horario exibido divergir do cadastrado.

As tabelas novas tem RLS e nenhum acesso direto para anon/authenticated. Somente
a RPC especifica e acessivel ao aluno. Publicacao e operacoes da fila sao
service-role-only, chamadas por endpoints com autorizacao propria.

`lesson_cancellations` e a fonte oficial. Um trigger antes de qualquer INSERT,
UPDATE ou DELETE de `app_state` restaura check-in, evento cancelado e concessao
de credito, inclusive para gravadores legados que nao usam CAS. Identidade,
validade, origem e quantidade de concessoes nao podem ser alteradas pelo JSON.
Outras colecoes permanecem editaveis. DELETE de main com recibos e TRUNCATE por
clientes sao bloqueados. O cache novo tambem prioriza recibos sobre tombstones.

O fluxo existente de **solicitacao/aprovacao/uso da reposicao** continua no
app_state: seus campos de andamento (status, datas de pedido/uso, reagendamento,
observacoes) permanecem editaveis para compatibilidade. Isso nao modifica o
recibo oficial de concessao. Esta etapa nao torna todo o app_state autenticado,
nem transforma presencas legadas e resgate de creditos em um novo livro-razão.
O saldo usa as ocorrencias confirmadas no cadastro, cancelamentos oficiais e,
conservadoramente, presencas legadas mais recentes do app_state.

## Regras preservadas

- Mais de duas horas: nao consome aula, gera exatamente um credito valido ate
  dez dias depois da data da aula.
- Duas horas ou menos: consome aula, nao gera credito; sem saldo, recusa.
- Aula com registro anterior: recusa. Duas requisicoes para a mesma aula retornam
  um unico recibo e uma unica tarefa; nao geram um novo credito.
- Datas e horarios de negocio usam America/Sao_Paulo. O cliente nunca fornece
  o instante oficial do cancelamento, nome autorizado ou decisao de reposicao.
- Avisos internos existentes continuam derivados dos check-ins. Sem push nesta etapa.

## Implantacao futura

1. Em homologacao, conferir `app_state/main`, migrations anteriores aplicadas e
   compatibilidade do schema. Fazer backup antes da nova migration.
2. Aplicar **somente** `supabase/migrations/202610010001_authenticated_cancellations.sql`.
   A migration nao importa vinculos nem agenda do JSON anonimo e nao configura Cron.
3. Conferir `GOOGLE_CALENDAR_OWNER_USER_ID` e a conexao Google existente. Manter
   `GOOGLE_TOKEN_ENCRYPTION_KEY` e demais segredos Google intactos. Criar somente
   o novo segredo `CALENDAR_CANCELLATION_WORKER_SECRET`, forte e exclusivo, no
   ambiente das Edge Functions. Nao gravar seu valor em SQL, logs ou Git.
4. Publicar `lesson-cancellation` e `calendar-cancellation-worker`, respeitando
   `supabase/config.toml`. A primeira exige JWT e valida usuario; a segunda tem
   verify_jwt=false, mas exige POST e o bearer secreto exclusivo antes de trabalhar.
5. Republicar as funcoes Google que usam `_shared/calendar-sync.ts`:
   `google-calendar` e `google-calendar-webhook`. A primeira passa a ignorar
   aulas oficialmente canceladas, deixando o trabalho para a fila.
6. Habilitar pg_cron/pg_net e criar as entradas Vault indicadas em
   `supabase/calendar-cancellation-cron.sql`; so entao revisar e executar esse
   arquivo no ambiente correto. Nao colocar a service role no agendamento.
7. Publicar frontend e pedir recarga das abas antigas. Entrar como personal,
   revisar os logins contra Auth e confirmar o cadastro de aulas. Antes disso,
   cancelamentos novos sao recusados, sem fallback anonimo.
8. Testar com aluno/calendario ficticios: fechar a sessao do personal, cancelar
   uma aula e aguardar o processamento Google. So depois repetir a implantacao
   aprovada em producao. Os testes locais nao acessam Supabase nem Google reais.

## Operacao e recuperacao

O worker reserva ate cinco tarefas por lote, em paralelo, com lease de cinco
minutos e token exclusivo. Outro worker nao pode confirmar um lease antigo.
Tentativas usam backoff exponencial com jitter, respeitam Retry-After (limitado
a 24h) e param apos oito tentativas. Falhas definitivas ficam em `failed`; nao
sao apagadas. Falhas de rede/credencial/persistencia nao sao tratadas como sucesso.

DELETE Google que ja ocorreu pode ser repetido: 404/410 sao tratados como evento
ausente. Sem vinculo, termina como ignorado. Se um POST Google ja em andamento
criar o vinculo depois, o trigger reabre a tarefa. O historico usa chave unica e
atualiza seu resultado, sem criar outra linha. O webhook ignora o eco da exclusao.

Consultar no SQL Editor autorizado (nao na API publica):

```sql
select id, status, attempts, available_at, lease_until, last_error
from public.calendar_cancellation_jobs
where status <> 'done' order by available_at;
```

Apos corrigir a causa de uma falha definitiva (por exemplo, reconectar Google),
reencaminhar **somente o ID revisado**, sem alterar o recibo:

```sql
update public.calendar_cancellation_jobs
set status='pending', attempts=0, available_at=now(),
    lease_until=null, lease_token=null, last_error=null
where id = '<UUID_DA_TAREFA_REVISADA>'::uuid and status='failed';
```

Verificar tambem `cron.job_run_details` e respostas do pg_net: sucesso do job
Cron significa chamada agendada, nao necessariamente evento excluido no Google.
Para interrupcao, suspender o job Cron e impedir novos pedidos na interface;
nao remover tabelas/recibos nem restaurar um app_state anterior sobre eles.

## Testes locais

Node 24: `npm ci` e `npm test`. PGlite e dependencia de desenvolvimento fixada;
executa as migrations em PostgreSQL/WASM descartavel, sem conexao externa.

- Autorizacao de anon, aluno alheio, metadados falsos e acesso direto a RPC/tabelas.
- Vinculos imutaveis, cadastro de ocorrencias e adulteracao do JSON anonimo.
- Cancelamento duplicado, saldo disputado, rollback da transacao e CAS obsoleto.
- Protecao contra sobrescrita, remocao, tombstones e alteracao da concessao.
- Lease expirado, ACK antigo, backoff, limite de tentativas e vinculo Google tardio.
- Timeout depois de DELETE, 410, 429/Retry-After, credencial e persistencia falhando.
- Frontend sem sucesso otimista, chave reutilizada e recibo aplicado apos confirmacao.

PGlite serializa comandos em uma conexao: Promise.all testa pedidos sobrepostos,
unicidade e saldo, mas nao substitui a validacao de locks em duas sessoes reais.
Antes de producao, repetir cancelamentos concorrentes com duas conexoes no
PostgreSQL de homologacao e testar a integracao Edge/Google ponta a ponta.
