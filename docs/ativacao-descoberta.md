# APIs gratuitas e ativação da descoberta

Esta é a configuração escolhida em 25/11/2026 para não pedir cartão nem permitir cobrança automática. Não ative planos pagos ou opções *pay as you go*. A implantação no Firebase foi interrompida: [Cloud Functions exige Blaze](https://firebase.google.com/docs/functions/faq-and-troubleshooting), e [Blaze exige uma conta de faturamento](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). O código de busca está preparado, mas ainda não está implantado.

## 1. Tavily: busca na rede

1. Abra [Tavily](https://app.tavily.com/) e crie uma conta no plano **Researcher / Free**. A [tabela de preços](https://www.tavily.com/pricing) informa 1.000 créditos por mês sem cartão. A [política de limites](https://help.tavily.com/articles/8298987937-billing-credits-usage-limits) diz que o plano gratuito interrompe as chamadas ao acabar a cota, sem cobrança, desde que você não habilite *pay as you go*.
2. No painel da Tavily, crie uma API key e guarde-a no seu gerenciador de senhas. Durante a migração ela será cadastrada como segredo `TAVILY_API_KEY` da função de backend. O código Firebase local também reconhece esse nome em `functions/.env.simulado-concurso-ia`, mas não será implantado sob a exigência de zero cartão. Não cole a chave na conversa, no frontend ou no Git.
3. O código usa a [Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search) em modo `basic` (um crédito), até dez resultados por busca, sem resposta de IA nem texto integral. Filtra sites `gov.br`, `edu.br` e bancas selecionadas e só armazena URL e título na fila. A Tavily [permite uso comercial no plano gratuito](https://help.tavily.com/articles/5880393096-permitted-use-customer-applications) e [armazenamento de metadados de resultados](https://help.tavily.com/articles/1612400809-storing-caching-retaining-output). Isso não concede direitos sobre as provas dos sites encontrados.

## 2. Telegram: materiais encaminhados ao bot

1. Abra [@BotFather](https://t.me/BotFather) no Telegram, envie `/newbot` e siga as instruções para criar nome e usuário. O [Bot API](https://core.telegram.org/bots/api) não cobra por esse fluxo.
2. Guarde o token recebido no gerenciador de senhas. Durante a migração ele será cadastrado como segredo `TELEGRAM_BOT_TOKEN` da função de backend. Um segundo segredo aleatório de até 256 caracteres, com letras, números, `_` ou `-`, será usado em `TELEGRAM_WEBHOOK_SECRET`. Não coloque nenhum deles no frontend ou no Git.
3. Depois que o backend gratuito estiver implantado, conecte o webhook no painel de fontes. Envie `/id` em conversa privada com o bot; ele responde seu ID numérico. Autorize esse ID no backend. Para grupos, obtenha autorização dos administradores, adicione o bot e configure o ID do chat. O [modo de privacidade](https://core.telegram.org/bots/features#privacy-mode) limita o que bots veem em grupos.
4. O bot só guarda links oficiais e metadados de PDFs para revisão; não copia histórico de grupos nem publica questões automaticamente.

## 3. Agendamento diário gratuito

1. A primeira opção após a migração é [Supabase Cron](https://supabase.com/docs/guides/cron), dentro do mesmo projeto gratuito; confirme sua disponibilidade no projeto criado. Se não estiver disponível, crie uma conta em [cron-job.org](https://cron-job.org/en/). Esse serviço informa que é gratuito e aceita [POST e cabeçalhos personalizados](https://cron-job.org/en/faq/).
2. Depois da implantação do backend, agende uma chamada diária ao endpoint de descoberta. Caso use cron-job.org, configure método `POST` e o cabeçalho `X-Discovery-Cron-Key` com o segredo correspondente no backend. Escolha 08:00 no fuso de São Paulo, ou 11:00 UTC. Não coloque o segredo na URL.
3. No painel de fontes, cadastre até cinco temas e ative a pesquisa diária. A função processa **um tema por dia em rodízio** e ignora chamadas repetidas no mesmo dia. Isso usa aproximadamente 30 créditos Tavily por mês. O [limite de 30 segundos do cron-job.org](https://cron-job.org/en/faq/) motivou uma única busca por execução na implementação atual.

## 4. IA para organizar questões e ajudar alunos

A nova chave Gemini já foi colocada no backend. Uma chamada curta ao modelo `gemini-3.5-flash-lite` respondeu HTTP 200, e `GEMINI_MODEL` foi atualizado para ele. O [nível gratuito do Gemini](https://aistudio.google.com/docs/pricing) possui cotas e pode variar. A pesquisa fundamentada do Gemini 3.8 foi retirada deste fluxo: retornou HTTP 429 e [não está disponível no nível gratuito](https://aistudio.google.com/docs/pricing#gemini-3.8-flash). Use Gemini só para transcrição, formatação e dicas, com os limites existentes no aplicativo.

## 5. Backend sem cartão

O site atual usa Firebase Functions, Firestore, Auth e Storage. Como [Firebase Functions exige Blaze](https://firebase.google.com/docs/functions/faq-and-troubleshooting), nenhuma nova Function será implantada sob a exigência de zero cartão. A alternativa recomendada é migrar a API e o banco para [Supabase Free](https://supabase.com/pricing): [Edge Functions](https://supabase.com/docs/guides/functions/pricing) têm franquia gratuita e [Supabase Cron](https://supabase.com/docs/guides/cron) pode substituir cron-job.org, caso disponível no projeto criado. Essa migração é trabalho de código e dados; não basta trocar a URL da API. Crie apenas a conta e um projeto gratuitos quando iniciarmos essa etapa, sem adicionar cartão.

Antes de publicar provas ou questões para venda, confirme a licença da fonte original, o gabarito e a transcrição. Resultados da Tavily são pistas para análise, não autorização de republicação.
