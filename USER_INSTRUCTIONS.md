# Configuração da geração com IA

A geração de questões acontece na Cloud Function para que a chave do Gemini não fique exposta no navegador.

## 1. Configure a chave no Firebase

1. Crie ou copie uma chave no [Google AI Studio](https://aistudio.google.com/app/apikey).
2. No diretório `functions`, configure o parâmetro usado pela função em um arquivo de ambiente que não seja versionado, por exemplo `.env.<id-do-projeto>`:

```env
GEMINI_API_KEY="SUA_CHAVE_AQUI"
GEMINI_MODEL="gemini-2.5-flash"
```

O `defineString` usado pela função também pode solicitar o valor durante o deploy. Configure o mesmo parâmetro no projeto Firebase de produção. Nunca coloque essa chave em `VITE_GEMINI_API_KEY` nem a envie para o frontend.

Opcionalmente, defina `GEMINI_MODEL` para escolher outro modelo compatível. O padrão atual é `gemini-2.5-flash`.

## 2. Publique a função

Depois de configurar o valor no projeto Firebase:

```bash
npm --prefix functions run build
firebase deploy --only functions
```

A origem do frontend em produção precisa estar na lista de CORS em `functions/src/index.ts`.

## 3. Configure o frontend

No `.env`, use as credenciais do Firebase. A URL da função já possui um fallback para o projeto atual; só defina `VITE_GENERATE_QUESTIONS_URL` se a função estiver em outro projeto ou endpoint.

## 4. Materiais em PDF

O modo **Por PDF da aula** lê no navegador apenas PDFs com texto selecionável. O arquivo não é salvo no Storage. O texto extraído é enviado de forma autenticada à função, que o utiliza como fonte única para elaborar as questões. O limite atual é de 20 MB, 80 páginas e 120 mil caracteres; PDFs escaneados precisam de OCR antes do envio.
