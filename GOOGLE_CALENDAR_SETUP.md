# Google Calendar: configuracao e homologacao

Para cancelamento autenticado pelo aluno e processamento Google no servidor,
siga tambem [SERVER_CANCELLATIONS_SETUP.md](SERVER_CANCELLATIONS_SETUP.md).
Essa etapa exige uma nova migration, cadastro revisado pelo personal e worker
agendado; nao reaplique as migrations anteriores.

## Arquitetura de seguranca

O navegador usa apenas a chave publica `anon` ja existente e o JWT da sessao Supabase. O `client secret`, o refresh token, a service role e a chave de criptografia ficam somente nas Edge Functions. O refresh token e cifrado com AES-GCM antes de ser salvo.

As tabelas de conexao, vinculos OAuth e canais nao concedem acesso a `anon` nem `authenticated`. O usuario autenticado pode ler apenas o proprio historico e as proprias notificacoes.

## Variaveis das Edge Functions

Configure com `supabase secrets set` em um projeto de homologacao:

- `GOOGLE_CLIENT_ID`: client ID OAuth do Google Cloud.
- `GOOGLE_CLIENT_SECRET`: client secret OAuth do Google Cloud.
- `GOOGLE_TOKEN_ENCRYPTION_KEY`: segredo aleatorio longo e estavel. Nao altere depois de conectar uma conta, pois os tokens existentes deixarao de ser decifrados.
- `GOOGLE_CALENDAR_OWNER_USER_ID`: UUID do usuario Supabase Auth do personal.
- `GOOGLE_CALENDAR_CRON_SECRET`: segredo aleatorio usado somente pela rotina de renovacao.
- `APP_PUBLIC_URL`: URL exata do app de homologacao, por exemplo `https://homologacao.exemplo.com`.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: fornecidas pelo ambiente das Edge Functions do Supabase.

## Google Cloud

1. Crie ou selecione um projeto exclusivo para homologacao.
2. Ative a Google Calendar API.
3. Configure a tela de consentimento OAuth. Durante homologacao, use modo Testing e cadastre somente a conta Google do personal como test user.
4. Crie credenciais OAuth 2.0 do tipo Web application.
5. Cadastre como Authorized redirect URI: `https://SEU_PROJECT_REF.supabase.co/functions/v1/google-calendar-oauth-callback`.
6. Nao cadastre o client secret no HTML, Vercel ou variaveis com prefixo publico.

## Supabase

1. Crie um projeto separado de homologacao ou um branch de banco.
2. Aplique, nesta ordem, `supabase/migrations/202609010001_google_calendar_integration.sql` e `supabase/migrations/202609300001_app_state_compare_and_swap.sql`. A segunda migration deve estar disponivel antes de atualizar o JavaScript do app ou as Edge Functions.
3. Configure os segredos listados acima.
4. Publique as funcoes `google-calendar`, `google-calendar-oauth-callback`, `google-calendar-webhook` e `google-calendar-renew` no projeto de homologacao.
5. Confirme que `verify_jwt=false` esta aplicado somente ao callback, webhook e renovacao, conforme `supabase/config.toml`. Esses endpoints fazem sua propria validacao de state, token do canal ou segredo de cron.
6. Agende uma chamada diaria `POST` para `/functions/v1/google-calendar-renew`, com `Authorization: Bearer <GOOGLE_CALENDAR_CRON_SECRET>`. Use Supabase Cron/Vault para nao gravar o segredo em SQL versionado.
7. Confirme que o webhook publico responde por HTTPS. O Google nao entrega notificacoes para localhost.

## Homologacao sem producao

1. Use um projeto Supabase, credencial OAuth e calendario Google exclusivos de homologacao.
2. Copie apenas alunos ficticios. Nao copie refresh tokens nem a service role de producao.
3. Entre como o personal de homologacao, abra Administrativo > Agenda e conecte a conta Google de teste.
4. Crie uma aula ficticia e confirme o `google_event_id` no `app_state` e em `google_calendar_event_links`.
5. Altere o horario no app e confirme que o mesmo evento Google foi atualizado.
6. Cancele no app e confirme o cancelamento no Google e uma linha idempotente no historico.
7. Recrie uma aula com mais de duas horas de antecedencia, cancele ou recuse no Google e confirme `checkins`, `makeupCredits`, `cancelado_por`, `cancelado_em`, `origem_da_alteracao` e a notificacao no app.
8. Reagende no Google e use "Sincronizar agora" caso queira testar sem aguardar o webhook.
9. Repita a mesma notificacao/sincronizacao e confirme que nao surge historico ou credito duplicado.
10. Interrompa a rede durante um envio, restaure-a e confirme que o app preservou o estado local/Supabase existente e permite nova sincronizacao.

## Riscos e limites conhecidos

- O `app_state/main` e um documento JSON compartilhado. A Edge Function e o sincronizador geral do navegador usam `compare_and_swap_app_state`: o UPDATE so ocorre quando o JSON e `updated_at` ainda correspondem ao snapshot lido. Em conflito, ambos releem e refazem a alteracao/mesclagem, com limite de tres tentativas. Nao existe fallback para UPDATE ou UPSERT sem protecao.
- No navegador, a repeticao reaplica somente as diferencas pretendidas sobre o estado mais recente, comparando itens por ID. Se o mesmo campo tiver mudancas divergentes, retorna conflito em vez de escolher silenciosamente um valor. O cache tambem preserva edicoes locais feitas durante a requisicao.
- A nova RPC usa `SECURITY INVOKER`, preserva os grants/RLS existentes e nao altera `profiles`. EXECUTE para `anon` mantem compatibilidade com o cliente anonimo de app_state ja usado pelo app, sem conceder novos direitos sobre a tabela. A criacao inicial de `main` usa INSERT com ON CONFLICT DO NOTHING; a Edge Function exige que `main` ja exista.
- Erros de leitura/gravação ou conflitos persistentes interrompem a aplicacao do evento antes de notificacoes, historico de sucesso, atualizacao do vinculo e avanco do sync token. O webhook retorna erro para permitir nova tentativa; o navegador preserva os dados locais e informa a falha. Os IDs retornados pelo Google so geram mensagem de sucesso depois de sua persistencia no Supabase.
- Atualize/recarregue tambem as abas antigas do app: clientes antigos ou gravadores externos que continuem usando UPSERT sem comparacao podem sobrescrever dados. A RPC protege seus chamadores; nao bloqueia por si so gravacoes diretas de outros clientes. Homologue concorrencia antes de producao.
- A primeira sincronizacao cobre eventos locais e os proximos seis meses de aulas derivadas. Periodos posteriores entram quando se aproximam ou quando uma alteracao da agenda dispara novo envio.
- Eventos recorrentes sao processados como ocorrencias expandidas (`singleEvents=true`), preservando `recurringEventId` e `originalStartTime`. Alterar a serie inteira no Google pode gerar muitas ocorrencias e deve ser testado com um conjunto pequeno.
- Excluir a conexao preserva eventos ja criados no Google. Isso evita perda inesperada de agenda.
- Convites sao enviados ao e-mail do aluno para permitir detectar recusas. Valide consentimento e qualidade dos e-mails antes de habilitar em producao.
- A API do Google Calendar nao informa de forma confiavel quem editou o horario. Para eventos vinculados, a notificacao atribui a mudanca ao aluno associado; valide esse comportamento se outras pessoas tiverem permissao de edicao no calendario.
- O Google exige renovacao dos canais; a rotina deve rodar diariamente e os canais sao renovados antes das ultimas 36 horas.

## Validacao local das correcoes de concorrencia

- `npm test` (Node 24): testa conflitos simultaneos, preservacao de dados/cache, falhas de leitura/gravação, fallback REST protegido e ausencia de sucesso/notificacoes/sync token quando app_state falha.
- `node tests/app-state-migration.mjs CAMINHO_LOCAL_PGLITE/dist/index.js`: teste opcional em PostgreSQL/WASM em memoria, com PGlite instalado separadamente. Valida a migration real com colunas json/jsonb, criacao inicial, comparacao de snapshots, timestamps nulos, grants e RLS. Nao usa conexao com Supabase. Por usar uma unica conexao, nao substitui um teste com transacoes concorrentes em homologacao.
