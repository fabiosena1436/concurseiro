
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";

admin.initializeApp();

// 1. VERIFICAÇÃO DA CHAVE DA API
const apiKey = functions.config().openai?.key;

if (!apiKey) {
  // 2. ERRO INFORMATIVO
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("!!! A CHAVE DA API DA OPENAI NÃO FOI CONFIGURADA.         !!!");
  console.error("!!! Execute o comando:                                   !!!");
  console.error("!!! firebase functions:config:set openai.key='SUA_CHAVE' !!!");
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  throw new functions.https.HttpsError("failed-precondition", "A chave da API do OpenAI não está configurada no servidor. Contate o administrador.");
}

const openai = new OpenAI({ apiKey });

const model = functions.config().openai.model || "gpt-4-turbo";

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

export const generateQuestions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "A função deve ser chamada por um usuário autenticado.");
  }
  const { subject, numQuestions, banca, difficulty, editalContent } = data;
  if (!subject || !numQuestions || !banca || !difficulty) {
    throw new functions.https.HttpsError("invalid-argument", "Argumentos 'subject', 'numQuestions', 'banca', e 'difficulty' são obrigatórios.");
  }
  const allQuestions: any[] = [];
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
      throw new functions.https.HttpsError("internal", "A resposta da IA está vazia ou nula.");
    }
    let responseObject;
    try {
      responseObject = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Error parsing JSON from OpenAI:", {
        response: responseContent,
        error: parseError,
      });
      throw new functions.https.HttpsError("internal", "A resposta da IA não é um JSON válido. Verifique os logs.", { originalResponse: responseContent });
    }
    const questionsArray = responseObject.questions;
    if (!Array.isArray(questionsArray)) {
      throw new functions.https.HttpsError("internal", "A resposta da IA não contém um array 'questions'.");
    }
    allQuestions.push(...questionsArray);
    return allQuestions.map((q, index) => ({
      ...q,
      id: `${subject}-${banca.toLowerCase().replace(/\s/g, "")}-${index}`,
      subject: subject,
    }));
  } catch (error: any) {
    console.error("Error calling OpenAI API or processing data:", {
      errorMessage: error.message,
      errorCode: error.code,
      requestData: data,
    });
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao chamar a API da IA.", { originalError: error.message });
  }
});
