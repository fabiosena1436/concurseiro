# Simulado Concurso IA

Aplicação React, TypeScript e Firebase para consultar provas anteriores em PDF, estudar questões revisadas, acompanhar treinos e criar simulados personalizados por IA. As questões geradas livremente por IA podem conter erros e não são questões oficiais de bancas.

## Acervo de provas e questões revisadas

O painel `/admin/acervo` inclui **Fontes**, uma fila de metadados para análise. Cole até 100 linhas tabuladas por lote (título, ano, banca, órgão, cargo, URL HTTPS); URLs repetidas são reconhecidas. Selecionar uma fonte prepara um rascunho de prova, sem baixar nem publicar conteúdo automaticamente. Veja [a arquitetura e os critérios de expansão](docs/arquitetura-acervo.md).

Na aba **Questões e importação**, é possível colar até 180 mil caracteres de uma prova completa. O navegador divide o texto em blocos de até 14 mil caracteres, e a API salva rascunhos por bloco. Repita a operação após uma falha: blocos idênticos reutilizam os rascunhos já gravados. O PDF pode ser anexado à prova; a extração direta do arquivo ainda requer uma etapa própria de implementação. Na página de uma questão publicada, usuários autenticados podem pedir até 20 dicas de IA por dia.

A reformulação acrescenta `/provas`, `/questoes`, `/treinos` e `/admin/acervo`. O catálogo de metadados, PDFs publicados e questões revisadas é público. O treino e seu histórico exigem login. Os simulados gerados livremente por IA permanecem separados do banco revisado.

No painel do acervo, o administrador cadastra uma prova com ano, banca, concurso, órgão, tipo, cargo, escolaridade, matérias, origem e PDF. A publicação exige confirmação do direito de disponibilizar o arquivo. O servidor verifica a assinatura `%PDF-`, o tipo e o limite de 20 MB. É possível associar um PDF de gabarito, editar metadados, ocultar ou excluir uma prova depois de arquivar suas questões vinculadas. Tentativas antigas continuam disponíveis mesmo após essa exclusão, mas o link para a prova de origem deixa de funcionar.

O administrador pode colar até 18 mil caracteres de texto de questões e solicitar a organização pelo provedor de IA ativo. A IA cria rascunhos persistentes, sem gabarito definido. A importação repetida do mesmo texto para a mesma prova reutiliza os rascunhos. O administrador compara texto original e transcrição, revisa alternativas, matéria, assunto, explicação e avisos, confirma a resposta e publica. Versões anteriores ficam em `bankQuestions/{id}/revisions`. Questões arquivadas deixam de aparecer no banco. Treinos concluídos mantêm uma cópia do conteúdo e do gabarito usados na tentativa.

A aba **Taxonomia** permite definir grafias preferidas para bancas, concursos, órgãos, tipos, cargos, escolaridades, matérias e assuntos. Novos cadastros reutilizam a grafia cadastrada quando há correspondência sem distinção de maiúsculas. Provas com os mesmos campos identificadores e questões publicadas com o mesmo número ou enunciado na mesma prova são recusadas.

Os filtros combináveis são exatos, sem distinção de maiúsculas. A busca por título da prova aceita uma palavra entre as oito primeiras do título, também sem acentos. As consultas públicas são paginadas em lotes de 20, e os treinos aceitam de 1 a 50 questões. O primeiro corte não inclui mídia própria por questão: material com imagem, tabela ou fórmula incompleta deve permanecer em rascunho com aviso até que possa ser transcrito corretamente. O limite de PDFs e de questões por treino pode ser alterado no código após validação com acervo real.

Antes de publicar, implante em conjunto Firestore, índices, Storage e Functions: `firebase deploy --only firestore,storage,functions --project simulado-concurso-ia`. A aplicação depende das funções `catalogApi` e `catalogPdf`; os PDFs publicados são servidos pela segunda função, que verifica se a prova continua publicada a cada acesso. A chave `GEMINI_API_KEY` permanece apenas nas Functions. Teste com uma prova real e questões de múltipla escolha e certo ou errado. A revisão de direitos de disponibilização de cada PDF continua sendo responsabilidade do administrador.

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
GROQ_API_KEY="disabled"
OPENROUTER_API_KEY="disabled"
ADMIN_EMAILS="seu_email_administrativo"
```

Substitua `disabled` pela chave correspondente quando a criar, preservando `GEMINI_API_KEY` e `ADMIN_EMAILS` existentes. Não compartilhe o arquivo nem cole chaves em conversas ou no Git. Depois de salvar, execute `firebase deploy --only functions --project simulado-concurso-ia` e entre no painel **Admin → IA** para selecionar a chave configurada. Uma chave nova exige novo deploy das Functions. Se for necessário manter chaves fora das variáveis de ambiente, migre esses parâmetros para o Secret Manager do Firebase antes de usá-los em equipe.

## Administração

O acesso administrativo usa a custom claim `admin: true` do Firebase Authentication. Configure `ADMIN_EMAILS` como parâmetro de ambiente das Functions com os endereços autorizados. A função `grantAdminAccess` exige o ID token de um endereço dessa lista e só concede acesso a outro endereço listado. Após receber a claim, o administrador precisa renovar o ID token (por exemplo, entrando novamente).

Não altere `isUnlocked` ou `generationCount` pelo cliente. O primeiro campo é modificado por administradores; o segundo é reservado de forma transacional pela função de geração. As regras permitem ao usuário editar apenas os campos de perfil.
