
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import * as cors from "cors";
import {defineString} from "firebase-functions/params";

// 1. DEFINIÇÃO DE PARÂMETROS (A NOVA FORMA)
const openAIKey = defineString("OPENAI_KEY");
const openAIModel = defineString("OPENAI_MODEL", {default: "gpt-4o-mini"});

// 2. CONFIGURAÇÃO DO CORS
// Lista de origens permitidas. Adicione a URL do seu app em produção aqui.
const whitelist = [
  'http://localhost:5173', 
  'https://concurseiro-three.vercel.app',
  'https://concurseiro-beryl.vercel.app'
];

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

const corsHandler = cors(corsOptions);

admin.initializeApp();

const bancaProfiles = {
  "Cespe/Cebraspe": "Famosa por questões no formato 'Certo' ou 'Errado', onde uma resposta errada anula uma certa. As questões são complexas, interdisciplinares e exigem muita atenção a detalhes e jurisprudência atualizada.",
  "Fundação Getúlio Vargas (FGV)": "Conhecida por questões longas, com textos e cenários complexos que exigem interpretação e raciocínio lógico. As alternativas são muitas vezes bem elaboradas para induzir ao erro.",
  "Fundação Cesgranrio": "Estilo mais direto e objetivo, com questões que cobram o conhecimento literal da lei ou do conteúdo. Menos interpretativa que a FGV ou o Cespe.",
  "Fundação Carlos Chagas (FCC)": "Alternativas geralmente longas e muito parecidas entre si, exigindo que o candidato conheça o 'decoreba' e a literalidade da lei. A jurisprudência também é cobrada com frequência.",
  "Vunesp": "Conhecida por enunciados diretos e cobrança literal da lei ('lei seca'). As questões frequentemente incluem 'pegadinhas' e detalhes específicos como prazos e exceções. O nível de dificuldade é considerado moderado, mas exige atenção.",
  "KLC": "Estilo de prova com questões objetivas, diretas e bem estruturadas. Foco em testar conhecimentos específicos e habilidades dos candidatos, com padrões de prova mais previsíveis.",
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
  specificContent?: string; // NOVO CAMPO
  existingQuestions?: { question: string }[];
}) => {
  const { subject, numQuestions, banca, difficulty, editalContent, specificContent, existingQuestions } = data;
  const bancaStyle = bancaProfiles[banca] || bancaProfiles["Outra"];
  const context = getRelevantContext(editalContent || "");
  const hasEdital = !!editalContent && editalContent.trim() !== '' && context !== "Nenhum conteúdo de edital fornecido. Usar o tópico principal.";

  // Tópico principal refinado com o conteúdo específico
  const topic = specificContent ? `${subject} (foco específico em: ${specificContent})` : subject;

  // Define o formato da questão e o número de opções
  const isCespe = banca === "Cespe/Cebraspe";
  const questionFormat = isCespe ? "'Certo' ou 'Errado'" : "Múltipla Escolha com 5 alternativas (A, B, C, D, E)";
  const optionsNote = isCespe
    ? "Para questões 'Certo ou Errado', o array de opções deve conter apenas duas strings: 'Certo' e 'Errado'."
    : "Para questões de Múltipla Escolha, o array de opções deve conter exatamente 5 strings, uma para cada alternativa (A, B, C, D, E).";

  const sourceOfTruth = hasEdital
    ? `**Fonte de Verdade (Contexto):** Use **EXCLUSIVAMENTE** as informações contidas na seção "CONTEXTO PARA QUESTÕES". Se o contexto for insuficiente, recuse-se a criar a questão.`
    : `**Fonte de Verdade (Conhecimento Geral):** Use seu conhecimento aprofundado sobre o **Tópico Principal**.`;

  const generationRules = hasEdital
    ? `1. **FIDELIDADE AO CONTEXTO:** Baseie-se **ESTRITAMENTE** no "CONTEXTO PARA QUESTÕES".`
    : `1. **BASE NO CONHECIMENTO:** Baseie-se em seu conhecimento sobre o **Tópico Principal**, garantindo precisão e relevância.`;

  const existingQuestionsSection = (existingQuestions && existingQuestions.length > 0)
    ? `
    **QUESTÕES EXISTENTES (PARA EVITAR REPETIÇÃO):**
    Abaixo estão as questões que já foram geradas. **NÃO GERE** questões semanticamente iguais ou muito parecidas com estas.
    ---
    ${existingQuestions.map((q) => `- ${q.question}`).join("\n")}
    ---
    `
    : "";
    
  // Mapeamento de dificuldade para texto
  const difficultyMap = {
    'fundamental': 'Ensino Fundamental',
    'medio': 'Ensino Médio',
    'superior': 'Ensino Superior'
  };
  const difficultyText = difficultyMap[difficulty as keyof typeof difficultyMap] || "Nível não especificado";

  return `
    **Você é um Especialista em Concursos Públicos criando questões para a banca "${banca}".**
    **Missão:** Gerar ${numQuestions} questões **NOVAS E DISTINTAS** de altíssima qualidade sobre o **Tópico Principal: "${topic}"**.

    **ETAPA 1: REGRAS GERAIS**
    - **Nível de Dificuldade:** ${difficultyText}.
    - **Estilo da Banca (${banca}):** ${bancaStyle}.
    - ${sourceOfTruth}
    - **Formato da Questão:** ${questionFormat}.
    ${existingQuestionsSection}
    **CONTEXTO PARA QUESTÕES (Use apenas se a Fonte de Verdade for 'Contexto'):**
    ---
    ${context}
    ---

    **ETAPA 2: REGRAS DE GERAÇÃO E FORMATAÇÃO**
    ${generationRules}
    2. **EVITAR REPETIÇÃO:** É **PROIBIDO** criar questões que sejam semanticamente similares às listadas na seção "QUESTÕES EXISTENTES".
    3. **PROIBIDO META-QUESTÕES:** Não crie questões sobre "o contexto fornecido" ou a falta de informações. Foque apenas no **Tópico Principal**.
    4. **ESTRUTURA JSON OBRIGATÓRIA:** A saída final **DEVE** ser um único objeto JSON válido, contendo uma chave "questions", que é um array de objetos. Não inclua texto ou comentários fora do JSON.
    
    **ETAPA 3: ESTRUTURA DE CADA QUESTÃO NO JSON**
    Cada objeto no array "questions" deve ter a seguinte estrutura:
    {
      "question": "(string) O enunciado completo da pergunta.",
      "options": (string[]) Um array de strings. ${optionsNote},
      "correctAnswer": (number) O índice da resposta correta (0 para 'Certo' ou 'A', 1 para 'Errado' ou 'B', e assim por diante).
      "explanation": "(string) Uma explicação detalhada e clara, justificando a resposta correta com base na Fonte de Verdade."
    }
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
    const { subject, numQuestions, banca, difficulty, editalContent, existingQuestions, specificContent } = data; // specificContent adicionado

    if (!subject || !numQuestions || !banca || !difficulty) {
      response.status(400).send({ error: { message: "Argumentos 'subject', 'numQuestions', 'banca', e 'difficulty' são obrigatórios.", status: "INVALID_ARGUMENT" } });
      return;
    }

    try {
      const prompt = createPrompt({ subject, numQuestions, banca, difficulty, editalContent, specificContent, existingQuestions }); // specificContent passado
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
