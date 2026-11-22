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

Copie `.env.example` para `.env` e preencha os valores públicos de configuração do projeto Firebase. A chave do Gemini deve ficar somente no ambiente das Cloud Functions, sob o parâmetro `GEMINI_API_KEY`; ela nunca deve ser definida como variável `VITE_`.

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

As regras de acesso estão em `firestore.rules` e o índice composto do histórico em `firestore.indexes.json`. Teste as regras com o emulador antes de publicar. O frontend depende das funções `generateQuestions`, `submitExamResult`, `grantAdminAccess` e `deleteUserByAdmin`; alterações no frontend e nas funções devem ser implantadas juntas.

## Administração

O acesso administrativo usa a custom claim `admin: true` do Firebase Authentication. Configure `ADMIN_EMAILS` como parâmetro de ambiente das Functions com os endereços autorizados. A função `grantAdminAccess` exige o ID token de um endereço dessa lista e só concede acesso a outro endereço listado. Após receber a claim, o administrador precisa renovar o ID token (por exemplo, entrando novamente).

Não altere `isUnlocked` ou `generationCount` pelo cliente. O primeiro campo é modificado por administradores; o segundo é reservado de forma transacional pela função de geração. As regras permitem ao usuário editar apenas os campos de perfil.
