
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import * as cors from "cors";
import {defineString} from "firebase-functions/params";

// 1. DEFINIÇÃO DE PARÂMETROS (A NOVA FORMA)
const openAIKey = defineString("OPENAI_KEY");
const openAIModel = defineString("OPENAI_MODEL", {default: "gpt-4-turbo"});

// 2. CONFIGURAÇÃO DO CORS
const corsHandler = cors({ origin: true });

admin.initializeApp();

const bancaProfiles = {
  "Cespe/Cebraspe": "Famosa por questões no formato 'Certo' ou 'Errado', onde uma resposta errada anula uma certa. As questões são complexas, interdisciplinares e exigem muita atenção a detalhes e jurisprudência atualizada.",
  "Fundação Getúlio Vargas (FGV)": "Conhecida por questões longas, com textos e cenários complexos que exigem interpretação e raciocínio lógico. As alternativas são muitas vezes bem elaboradas para induzir ao erro.",
  "Fundação Cesgranrio": "Estilo mais direto e objetivo, com questões que cobram o conhecimento literal da lei ou do conteúdo. Menos interpretativa que a FGV ou o Cespe.",
  "Fundação Carlos Chagas (FCC)": "Alternativas geralmente longas e muito parecidas entre si, exigindo que o candidato conheça o 'decoreba' e a literalidade da lei. A jurisprudência também é cobrada com frequência.",
  "Outra": "Estilo genérico de múltipla escolha (A, B, C, D), focado na precisão do conteúdo e clareza.",
};

const getRelevantContext = (content: string): string => {
  if (!content) {
    return "Nenhum conteúdo de edital fornecido. Usar o tópico principal.";
  }
  return content.substring(0, 4000);
};

const createPrompt = (data: {
  subject: string;
  numQuestions: number;
  banca: keyof typeof bancaProfiles;
  difficulty: string;
  editalContent?: string;
}) => {
  const { subject, numQuestions, banca, difficulty, editalContent } = data;
  const bancaStyle = bancaProfiles[banca] || bancaProfiles["Outra"];
  const context = getRelevantContext(editalContent || "");

  return `
    **Você é um Especialista em Concursos Públicos e membro da banca examinadora "${banca}".**
    **Missão:** Gerar ${numQuestions} questões de concurso de altíssima qualidade.
    **ETAPA 1: ANÁLISE DO CONTEXTO**
    - **Nível de Dificuldade Alvo:** ${difficulty === "medio" ? "Ensino Médio" : "Ensino Superior"}.
    - **Estilo da Banca (${banca}):** ${bancaStyle}.
    - **Fonte de Verdade (Contexto):** Use **APENAS** as informações contidas na seção "CONTEXTO PARA QUESTÕES" abaixo. Se o contexto for insuficiente, recuse-se a criar a questão.
    **CONTEXTO PARA QUESTÕES:**
    ---
    ${context}
    ---
    **Tópico Principal (se o contexto for vazio):** ${subject}.
    **ETAPA 2: REGRAS RÍGIDAS DE GERAÇÃO**
    1.  **FIDELIDADE ABSOLUTA:** Crie todas as ${numQuestions} questões e suas explicações baseando-se **ESTRITAMENTE** no "CONTEXTO PARA QUESTÕES".
    2.  **NÃO INVENTE:** Não adicione informações externas, mesmo que corretas. Se a resposta não estiver no contexto, a questão não pode ser criada.
    3.  **VERIFICAÇÃO TRIPLA:** Antes de finalizar, revise cada questão para garantir que ela (a) respeita o estilo da banca, (b) é apropriada para o nível de dificuldade e (c) pode ser respondida **exclusivamente** com o contexto fornecido.
    4.  **FORMATO JSON OBRIGATÓRIO:** A saída final deve ser um único objeto JSON válido, contendo uma chave "questions", que é um array de objetos.
    **ETAPA 3: GERAÇÃO E FORMATAÇÃO**
    Produza o JSON com a seguinte estrutura para cada questão:
    - "question": (string) O enunciado da pergunta.
    - "options": (string[]) Um array com 4 opções de resposta.
    - "correctAnswer": (number) O índice (0-3) da resposta correta.
    - "explanation": (string) Uma explicação detalhada justificando a resposta correta com base no "CONTEXTO PARA QUESTÕES".
  `;
};

export const generateQuestions = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    const idToken = request.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
      response.status(401).send({ error: { message: "Unauthorized. No token provided.", status: "UNAUTHENTICATED" } });
      return;
    }

    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Error verifying ID token:", error);
      response.status(401).send({ error: { message: "Unauthorized. Invalid token.", status: "UNAUTHENTICATED" } });
      return;
    }

    // 3. USANDO OS PARÂMETROS EM TEMPO DE EXECUÇÃO
    const apiKey = openAIKey.value();
    const model = openAIModel.value();

    if (!apiKey) {
      console.error("A chave da API da OpenAI não foi configurada. Execute 'firebase functions:config:set OPENAI_KEY=sua_chave'");
      response.status(500).send({ error: { message: "A chave da API do OpenAI não está configurada no servidor. Contate o administrador.", status: "FAILED_PRECONDITION" } });
      return;
    }
    
    const openai = new OpenAI({ apiKey });
    const data = request.body.data;
    const { subject, numQuestions, banca, difficulty, editalContent } = data;

    if (!subject || !numQuestions || !banca || !difficulty) {
      response.status(400).send({ error: { message: "Argumentos 'subject', 'numQuestions', 'banca', e 'difficulty' são obrigatórios.", status: "INVALID_ARGUMENT" } });
      return;
    }

    try {
      const prompt = createPrompt({ subject, numQuestions, banca, difficulty, editalContent });
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "Você é um assistente especialista em criar questões de concursos públicos brasileiros. Sua única função é gerar um objeto JSON válido seguindo as regras estritas do usuário. Não adicione nenhum texto ou formatação fora do JSON."
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        response.status(500).send({ error: { message: "A resposta da IA está vazia ou nula.", status: "INTERNAL" } });
        return;
      }

      let responseObject;
      try {
        responseObject = JSON.parse(responseContent);
      } catch (parseError) {
        console.error("Error parsing JSON from OpenAI:", { response: responseContent, error: parseError });
        response.status(500).send({ error: { message: "A resposta da IA não é um JSON válido.", status: "INTERNAL", details: { originalResponse: responseContent } } });
        return;
      }

      const questionsArray = responseObject.questions;
      if (!Array.isArray(questionsArray)) {
        response.status(500).send({ error: { message: "A resposta da IA não contém um array 'questions'.", status: "INTERNAL" } });
        return;
      }

      const allQuestions = questionsArray.map((q, index) => ({
        ...q,
        id: `${subject}-${banca.toLowerCase().replace(/\s/g, "")}-${index}`,
        subject: subject,
      }));

      response.status(200).send({ data: allQuestions });

    } catch (error: any) {
      console.error("Error calling OpenAI API or processing data:", {
        errorMessage: error.message,
        errorCode: error.code,
        requestData: data,
      });
      response.status(500).send({ error: { message: "Ocorreu um erro interno ao chamar a API da IA.", status: "INTERNAL", details: { originalError: error.message } } });
    }
  });
});
