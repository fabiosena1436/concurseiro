# Simulado Concurso IA

Aplicação React, TypeScript e Firebase para criar simulados personalizados, praticar e revisar resultados. As questões são geradas por IA e podem conter erros; não são questões oficiais de bancas.

## Fluxo

1. Crie uma conta e escolha um simulado por matéria ou pelo conteúdo de um edital.
2. Gere 10 questões. Cada conta pode gerar até três simulados gratuitamente; o desbloqueio é administrado pelo suporte.
3. Responda em até 60 minutos. O progresso é salvo neste navegador e recuperado após recarregar a página.
4. Entregue o simulado para receber a correção e acompanhar o histórico no painel.

## Desenvolvimento local

Requer Node.js 22 ou superior. Para testar regras no emulador do Firebase CLI 15, use também Java 21 ou superior.

```bash
npm ci
npm --prefix functions ci
```

Copie `.env.example` para `.env` e preencha os valores públicos de configuração do projeto Firebase. As chaves de IA ficam somente no ambiente das Cloud Functions; nunca use uma variável `VITE_` para elas.

```bash
npm run dev
```

## Verificação

```bash
npm run type-check
npm run lint
npm run build
npm --prefix functions run build
```

As regras de acesso estão em `firestore.rules` e o índice composto do histórico em `firestore.indexes.json`. Teste as regras com o emulador antes de publicar. O frontend depende das funções `generateQuestions`, `manageAiProvider`, `submitExamResult`, `grantAdminAccess` e `deleteUserByAdmin`; alterações no frontend e nas funções devem ser implantadas juntas.

## IAs gratuitas e troca manual

O painel **Admin → IA** permite escolher Gemini, Groq ou OpenRouter Free. A escolha vale para todas as novas gerações. Se a API ativa responder com erro de cota (HTTP 429), o painel exibe um aviso em até um minuto, e a geração não é descontada da conta do estudante. A troca é manual; não há migração silenciosa para um serviço pago. O aviso aparece no painel, não por e-mail. Consulte os limites atuais na conta de cada provedor, pois eles podem mudar.

Crie as chaves sem cadastrar cartão:

1. **Groq:** acesse [Groq Console](https://console.groq.com/), crie uma conta gratuita, abra [API Keys](https://console.groq.com/keys), clique em **Create API Key** e copie a chave. Permaneça no plano **Free**. Groq é diferente de Grok, da xAI.
2. **OpenRouter:** crie uma conta em [OpenRouter](https://openrouter.ai/), abra [Keys](https://openrouter.ai/settings/keys), crie uma chave e use somente a opção **OpenRouter Free** do painel. O código usa `openrouter/free`, que escolhe modelos gratuitos; a conta sem créditos tem cota diária menor que a do Groq.
3. **Gemini:** abra [Google AI Studio](https://aistudio.google.com/apikey), crie uma chave em um projeto elegível ao nível gratuito e mantenha esse projeto no nível gratuito. A chave atual do projeto pode continuar sendo usada, caso já esteja configurada.

No projeto Firebase `simulado-concurso-ia`, crie ou edite o arquivo ignorado `functions/.env.simulado-concurso-ia`:

```dotenv
GEMINI_API_KEY="sua_chave_gemini_existente"
GEMINI_MODEL="gemini-2.5-flash"
GROQ_API_KEY="sua_chave_groq"
OPENROUTER_API_KEY="sua_chave_openrouter"
ADMIN_EMAILS="seu_email_administrativo"
```

Preencha somente as chaves que já possui, preservando `GEMINI_API_KEY` e `ADMIN_EMAILS` existentes. Não compartilhe o arquivo nem cole chaves em conversas ou no Git. Depois de salvar, execute `firebase deploy --only functions --project simulado-concurso-ia` e entre no painel **Admin → IA** para selecionar a chave configurada. Uma chave nova exige novo deploy das Functions. Se for necessário manter chaves fora das variáveis de ambiente, migre esses parâmetros para o Secret Manager do Firebase antes de usá-los em equipe.

## Administração

O acesso administrativo usa a custom claim `admin: true` do Firebase Authentication. Configure `ADMIN_EMAILS` como parâmetro de ambiente das Functions com os endereços autorizados. A função `grantAdminAccess` exige o ID token de um endereço dessa lista e só concede acesso a outro endereço listado. Após receber a claim, o administrador precisa renovar o ID token (por exemplo, entrando novamente).

Não altere `isUnlocked` ou `generationCount` pelo cliente. O primeiro campo é modificado por administradores; o segundo é reservado de forma transacional pela função de geração. As regras permitem ao usuário editar apenas os campos de perfil.
