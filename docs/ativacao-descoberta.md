# APIs gratuitas e ativação da descoberta

Esta é a configuração escolhida em 25/11/2026 para não pedir cartão nem permitir cobrança automática. Não ative planos pagos ou opções *pay as you go*. A implantação no Firebase foi interrompida: [Cloud Functions exige Blaze](https://firebase.google.com/docs/functions/faq-and-troubleshooting), e [Blaze exige uma conta de faturamento](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). O código de busca está preparado, mas ainda não está implantado.

## 1. Tavily: busca na rede

1. Abra [Tavily](https://app.tavily.com/) e crie uma conta no plano **Researcher / Free**. A [tabela de preços](https://www.tavily.com/pricing) informa 1.000 créditos por mês sem cartão. A [política de limites](https://help.tavily.com/articles/8298987937-billing-credits-usage-limits) diz que o plano gratuito interrompe as chamadas ao acabar a cota, sem cobrança, desde que você não habilite *pay as you go*.
2. No painel da Tavily, crie uma API key e guarde-a no seu gerenciador de senhas. Cadastre-a como segredo `TAVILY_API_KEY` da função Supabase. Não cole a chave na conversa, no frontend ou no Git.
3. O código usa a [Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search) em modo `basic` (um crédito), até dez resultados por busca, sem resposta de IA nem texto integral. Filtra sites `gov.br`, `edu.br` e bancas selecionadas e só armazena URL e título na fila. A Tavily [permite uso comercial no plano gratuito](https://help.tavily.com/articles/5880393096-permitted-use-customer-applications) e [armazenamento de metadados de resultados](https://help.tavily.com/articles/1612400809-storing-caching-retaining-output). Isso não concede direitos sobre as provas dos sites encontrados.

## 2. Telegram: materiais encaminhados ao bot

1. Abra [@BotFather](https://t.me/BotFather) no Telegram, envie `/newbot` e siga as instruções para criar nome e usuário. O [Bot API](https://core.telegram.org/bots/api) não cobra por esse fluxo.
2. Guarde o token recebido no gerenciador de senhas. Cadastre-o como segredo `TELEGRAM_BOT_TOKEN` da função Supabase. Um segundo segredo aleatório de até 256 caracteres, com letras, números, `_` ou `-`, será usado em `TELEGRAM_WEBHOOK_SECRET`. Não coloque nenhum deles no frontend ou no Git.
3. Depois que o backend gratuito estiver implantado, conecte o webhook no painel de fontes. Envie `/id` em conversa privada com o bot; ele responde seu ID numérico. Autorize esse ID no backend. Para grupos, obtenha autorização dos administradores, adicione o bot e configure o ID do chat. O [modo de privacidade](https://core.telegram.org/bots/features#privacy-mode) limita o que bots veem em grupos.
4. O bot só guarda links oficiais e metadados de PDFs para revisão; não copia histórico de grupos nem publica questões automaticamente.

## 3. Agendamento diário gratuito

1. A primeira opção é [Supabase Cron](https://supabase.com/docs/guides/cron), dentro do mesmo projeto gratuito; confirme sua disponibilidade no projeto criado. Se não estiver disponível, crie uma conta em [cron-job.org](https://cron-job.org/en/). Esse serviço informa que é gratuito e aceita [POST e cabeçalhos personalizados](https://cron-job.org/en/faq/).
2. Depois da implantação do backend, agende uma chamada diária a `https://vgykwicsfguwlxztmiqp.supabase.co/functions/v1/discovery?mode=cron`. Caso use cron-job.org, configure método `POST` e o cabeçalho `X-Discovery-Cron-Key` com o segredo correspondente no backend. Escolha 08:00 no fuso de São Paulo, ou 11:00 UTC. Não coloque o segredo na URL.
3. No painel de fontes, cadastre até cinco temas e ative a pesquisa diária. A função processa **um tema por dia em rodízio** e ignora chamadas repetidas no mesmo dia. Isso usa aproximadamente 30 créditos Tavily por mês. O [limite de 30 segundos do cron-job.org](https://cron-job.org/en/faq/) motivou uma única busca por execução na implementação atual.

## 4. IA para organizar questões e ajudar alunos

A nova chave Gemini já foi colocada no backend. Uma chamada curta ao modelo `gemini-3.5-flash-lite` respondeu HTTP 200, e `GEMINI_MODEL` foi atualizado para ele. O [nível gratuito do Gemini](https://aistudio.google.com/docs/pricing) possui cotas e pode variar. A pesquisa fundamentada do Gemini 3.8 foi retirada deste fluxo: retornou HTTP 429 e [não está disponível no nível gratuito](https://aistudio.google.com/docs/pricing#gemini-3.8-flash). Use Gemini só para transcrição, formatação e dicas, com os limites existentes no aplicativo.

## 5. Backend sem cartão

O site ainda usa Firebase Auth, Firestore, Storage e as funções antigas. A **descoberta de fontes e o bot** agora têm código próprio para o projeto Supabase Free `vgykwicsfguwlxztmiqp`, mas só funcionarão após aplicar a migração SQL e publicar a Edge Function. [Cloud Functions exige Blaze](https://firebase.google.com/docs/functions/faq-and-troubleshooting); nenhuma nova Function será implantada no Firebase sob a exigência de zero cartão. A migração do restante do acervo e do assistente de IA ainda é trabalho pendente.

### Ativar o projeto Supabase

1. Abra o [SQL Editor do projeto](https://supabase.com/dashboard/project/vgykwicsfguwlxztmiqp/sql/new) e execute o conteúdo completo de `supabase/migrations/20261125000000_discovery.sql` **uma vez**. Ele cria a fila de fontes, caixa de entrada do Telegram, preferências, registro de execuções e limite diário. Todas as tabelas têm RLS ativo e nenhuma política pública.
2. Em [Edge Function Secrets](https://supabase.com/dashboard/project/vgykwicsfguwlxztmiqp/settings/functions), cadastre `TAVILY_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DISCOVERY_CRON_KEY` e `TELEGRAM_ALLOWED_USER_IDS`. O último recebe seu ID numérico, obtido com `/id` depois de conectar o bot. `TELEGRAM_ALLOWED_CHAT_IDS` é opcional, para grupos autorizados. Os segredos `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são [fornecidos automaticamente pelo Supabase](https://supabase.com/docs/guides/functions/secrets). Não use chave secreta no navegador.
3. Publique `supabase/functions/discovery/index.ts` como função `discovery`. A [documentação de implantação](https://supabase.com/docs/guides/functions/deploy) usa `supabase login`, `supabase link --project-ref vgykwicsfguwlxztmiqp` e `supabase functions deploy discovery --use-api`. A configuração `verify_jwt = false` em `supabase/config.toml` é necessária porque o site envia tokens Firebase; a função verifica assinatura, projeto e permissão de administrador antes de acessar o banco. É possível [publicar pelo editor do painel](https://supabase.com/docs/guides/functions/quickstart-dashboard) se não quiser usar CLI; nesse caso desative a verificação JWT padrão na configuração da função.
4. Entre como administrador no site, abra **Fontes para análise**, clique em **Conectar bot ao webhook**, envie `/id` ao bot e coloque o número recebido em `TELEGRAM_ALLOWED_USER_IDS`. Volte ao painel e teste **Verificar conexão** e uma pesquisa manual. Configure o agendamento diário por último.

O frontend chama `https://vgykwicsfguwlxztmiqp.supabase.co/functions/v1/discovery` por padrão. Se mudar de projeto, ajuste `VITE_DISCOVERY_ENDPOINT` no ambiente de build. O endereço público do projeto não é uma credencial. A chave Tavily e o token Telegram ficam somente nos segredos da Edge Function.

Antes de publicar provas ou questões para venda, confirme a licença da fonte original, o gabarito e a transcrição. Resultados da Tavily são pistas para análise, não autorização de republicação.
