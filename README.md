# 🧠 Simulado Concurso IA

Bem-vindo ao **Simulado Concurso IA**, uma plataforma de estudos inteligente projetada para ajudar candidatos a se prepararem para concursos públicos. A aplicação permite que usuários criem e realizem simulados personalizados, com questões geradas dinamicamente e um sistema robusto para análise de desempenho.

Este projeto foi desenvolvido com tecnologias web modernas, incluindo **React**, **TypeScript**, e **Firebase**, com foco em modularidade, escalabilidade e uma experiência de usuário fluida.

## ✨ Recursos Implementados

-   ✅ **Autenticação de Usuários**: Sistema completo de cadastro e login utilizando **Firebase Authentication**.
-   ✅ **Roteamento e Navegação**: Navegação fluida entre páginas com **React Router**, incluindo rotas públicas e privadas.
-   ✅ **Páginas Essenciais**:
    -   **Home**: Página de apresentação do projeto.
    -   **Login/Signup**: Formulários para entrada e registro de usuários.
    -   **Dashboard**: Painel principal que exibe o histórico de simulados do usuário.
    -   **Exam Creator**: Interface para que o usuário crie novos simulados.
    -   **Exam**: Ambiente de prova com cronômetro e navegação entre questões.
    -   **Results**: Tela para visualização do resultado do simulado (a ser implementada).
-   ✅ **Rotas Protegidas**: O acesso a páginas como o Dashboard e o criador de simulados é restrito a usuários autenticados.
-   ✅ **Gerenciamento de Estado**: Hook customizado `useAuth` para gerenciar o estado de autenticação do usuário em toda a aplicação.
-   ✅ **Banco de Dados**: Integração com **Cloud Firestore** para salvar e recuperar dados de simulados e resultados.
-   ✅ **Estilização Profissional**: Componentização de estilos com **styled-components**, utilizando um tema global para consistência visual.

## 🚀 Roadmap de Desenvolvimento (Próximos Passos)

O projeto tem uma base sólida, mas ainda há funcionalidades importantes a serem implementadas para torná-lo uma ferramenta de estudos completa.

### 1. Módulo: Criador de Simulados
-   [ ] **Integração com IA**: Conectar o formulário a uma API de IA (como Gemini, GPT, etc.) para gerar questões dinamicamente com base nos parâmetros selecionados pelo usuário (matéria, dificuldade, etc.).
-   [ ] **Salvar no Firestore**: Aprimorar a função `createExam` para salvar o simulado gerado pela IA no Firestore.
-   [ ] **Redirecionamento Pós-Criação**: Garantir que o usuário seja redirecionado para a URL da prova recém-criada (`/simulado/<id-do-simulado>`).

### 2. Módulo: Ambiente de Prova
-   [ ] **Lógica do Cronômetro**: Implementar a finalização automática do simulado quando o tempo se esgotar.
-   [ ] **Marcar para Revisão**: Salvar o estado de questões marcadas para revisão e permitir que o usuário navegue facilmente até elas.
-   [ ] **Persistência de Estado**: Salvar as respostas do usuário em tempo real (no `localStorage` ou Firestore) para evitar perda de progresso.

### 3. Módulo: Correção e Resultados
-   [ ] **Página de Resultados Detalhada**: Implementar a busca e exibição dos resultados na página `/resultados/:id`.
-   [ ] **Relatório de Desempenho**: Mostrar um relatório completo, comparando as respostas do usuário com o gabarito e exibindo as explicações de cada questão.
-   [ ] **Métricas de Desempenho**: Salvar métricas como nota, tempo de prova e acertos por matéria no Firestore, associadas ao perfil do usuário.

### 4. Módulo: Dashboard do Usuário
-   [ ] **Gráficos de Desempenho**: Exibir gráficos que mostrem a evolução do desempenho do usuário por matéria e ao longo do tempo.
-   [ ] **Busca de Dados Reais**: Conectar o dashboard para buscar o histórico de simulados e métricas diretamente do Firestore.

### 5. Melhorias de UI/UX
-   [ ] **Indicadores de Loading**: Adicionar loaders em todas as operações assíncronas (carregamento de dados, criação de simulado, etc.).
-   [ ] **Tratamento de Erros**: Implementar feedback visual para erros (ex: falha ao carregar simulado, login inválido, etc.).
-   [ ] **Componentes Reutilizáveis**: Criar novos componentes (Cards, Modais, etc.) conforme a necessidade para manter a consistência e a manutenibilidade.

## 🛠️ Tecnologias Utilizadas

-   **Frontend**: React, TypeScript, Vite
-   **Navegação**: React Router DOM
-   **Estilização**: Styled Components
-   **Backend & Banco de Dados**: Firebase (Authentication, Firestore)
-   **Linting**: ESLint, TypeScript-ESLint

## ⚙️ Guia de Instalação e Configuração

Para executar este projeto localmente, siga os passos abaixo:

### 1. Pré-requisitos

-   [Node.js](https://nodejs.org/) (versão 18 ou superior)
-   [Yarn](https://yarnpkg.com/) (gerenciador de pacotes)
-   Uma conta no [Firebase](https://firebase.google.com/) com um projeto web criado.

### 2. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/simulado-concurso-ia.git
cd simulado-concurso-ia
```

### 3. Instalar as Dependências
Use o Yarn para instalar todas as dependências do projeto:
```bash
yarn install
```

### 4. Configurar Variáveis de Ambiente
Este projeto requer credenciais do Firebase para funcionar.
   
1. Crie uma cópia do arquivo de exemplo `.env.example`:
```bash
cp .env.example .env
```
2.  Abra o arquivo `.env` e substitua os valores de placeholder pelas suas credenciais do Firebase, que podem ser encontradas no console do seu projeto Firebase (`Configurações do projeto > Geral > Seus apps`).

```ini
# .env
VITE_API_KEY="SUA_API_KEY"
VITE_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
VITE_PROJECT_ID="SEU_PROJECT_ID"
VITE_STORAGE_BUCKET="SEU_STORAGE_BUCKET"
VITE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID"
VITE_APP_ID="SEU_APP_ID"
```

### 5. Configurar Regras de Segurança do Firestore
Para que a aplicação possa ler e escrever no Firestore, você precisa ajustar as regras de segurança no console do Firebase:

1.  Acesse o **Console do Firebase**.
2.  Vá em **Cloud Firestore** > **Regras**.
3.  Substitua as regras existentes pelas seguintes, que permitem acesso apenas a usuários autenticados:
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
4.  Clique em **Publicar**.

### 6. Rodar o Projeto
Com tudo configurado, inicie o servidor de desenvolvimento:

```bash
yarn dev
```
A aplicação estará disponível em `http://localhost:5173`.

### 7. Configurar Índices do Firestore
Algumas consultas no banco de dados (como buscar o histórico de um usuário ordenado por data) exigem índices compostos. 

Se você encontrar o erro `FirebaseError: The query requires an index`, siga estes passos:
1. Abra o console do navegador (F12).
2. Localize a mensagem de erro que contém um link (começa com `https://console.firebase.google.com/...`).
3. Clique no link. Ele levará você diretamente para a página de criação de índices do Firebase com os campos já preenchidos.
4. Clique em "Create Index". O processo pode levar alguns minutos.


## 📂 Estrutura do Projeto

O projeto é organizado de forma modular para facilitar a manutenção e o desenvolvimento de novas funcionalidades.

```
src/
├── assets/         # Imagens, ícones e outros recursos estáticos
├── components/     # Componentes React reutilizáveis
│   ├── common/     # Componentes genéricos (Loader, Button, etc.)
│   └── layout/     # Componentes de estrutura (Header, Footer, etc.)
├── hooks/          # Hooks customizados (ex: useAuth)
├── pages/          # Componentes que representam as páginas da aplicação
├── routes/         # Configuração do roteamento (React Router)
├── services/       # Módulos para interagir com APIs externas (Firebase, etc.)
├── styles/         # Estilos globais e configuração de tema (Styled Components)
└── types/          # Definições de tipos e interfaces TypeScript
```